"""The options-structuring step: given a TradingAgents signal, decide which
options structure to use (credit spread / debit spread / iron condor) and
which strikes/expiry, using live Alpaca option chain data fetched via MCP.

Runs on Cloudflare Workers AI (no Anthropic API key available), via its
OpenAI-compatible /v1/chat/completions endpoint - empirically verified (a
live test call) that this endpoint returns proper `tool_calls` for
@cf/meta/llama-3.3-70b-instruct-fp8-fast.

`place_option_order` and every other mutating MCP tool is never included in
this step's tool list (see alpaca_mcp_client.read_only_tool_schemas) - the
model structurally cannot place an order from here, independent of what any
prompt says. It "returns" its answer by calling the synthetic `propose_trade`
tool, whose schema forces a parseable structured object instead of prose.
"""

from __future__ import annotations

import json
import os
import sys

import httpx

_DEBUG = os.getenv("DEBUG_STRATEGY", "").strip().lower() in ("1", "true", "yes")


def _debug(*args: object) -> None:
    if _DEBUG:
        print("[options_strategy]", *args, file=sys.stderr)


import config
from alpaca_mcp_client import AlpacaMcpClient
from models import Leg, SignalResult, TradeProposal

MAX_TOOL_ITERATIONS = 12

PROPOSE_TRADE_FUNCTION = {
    "name": "propose_trade",
    "description": (
        "Submit the final options trade proposal once you have fetched live "
        "chain/IV/OI data and decided on a structure, strikes, and expiry. "
        "Call this exactly once, as your final action."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "strategy": {
                "type": "string",
                "enum": [
                    "bull_put_spread",
                    "bear_call_spread",
                    "iron_condor",
                    "bull_call_spread",
                    "bear_put_spread",
                ],
            },
            "legs": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "side": {"type": "string", "enum": ["buy", "sell"]},
                        "right": {"type": "string", "enum": ["call", "put"]},
                        "strike": {"type": "number"},
                        "expiry": {"type": "string", "description": "YYYY-MM-DD"},
                        "symbol": {
                            "type": "string",
                            "description": (
                                "The exact OCC option symbol for this leg, as returned by "
                                "get_option_chain or get_option_contracts (e.g. "
                                "AAPL250321C00150000). Never hand-construct this."
                            ),
                        },
                        "ratio_qty": {"type": "integer"},
                    },
                    "required": ["side", "right", "strike", "expiry", "symbol", "ratio_qty"],
                },
            },
            "expiry": {"type": "string", "description": "YYYY-MM-DD, common expiry of the legs"},
            "quantity": {
                "type": "integer",
                "description": "number of spreads/condors, 0 if no trade",
            },
            "credit_debit": {"type": "string", "enum": ["credit", "debit"]},
            "net_premium": {
                "type": "number",
                "description": "per-spread net credit or debit received/paid, positive",
            },
            "max_profit": {
                "type": "number",
                "description": "total max profit across `quantity` spreads, in dollars",
            },
            "max_loss": {
                "type": "number",
                "description": "total max loss across `quantity` spreads, in dollars",
            },
            "rationale": {"type": "string"},
        },
        "required": [
            "strategy",
            "legs",
            "expiry",
            "quantity",
            "credit_debit",
            "net_premium",
            "max_profit",
            "max_loss",
            "rationale",
        ],
    },
}


def _to_openai_tools(mcp_schemas: list[dict]) -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": s["name"],
                "description": s["description"],
                "parameters": s["input_schema"] or {"type": "object", "properties": {}},
            },
        }
        for s in mcp_schemas
    ]


def _system_prompt(signal: SignalResult) -> str:
    return f"""You are an options strategist for an autonomous trading agent on a
${config.STARTING_EQUITY:,.0f} Alpaca paper account.

Today's date is {signal.run_date}. Do not rely on any date, price, or strike
you recall from training - the option chain tools below always return the
current, correct data for today. If your memory of "today's date" or typical
strike levels conflicts with what a tool returns, the tool is right.

A separate multi-agent research system (TradingAgents) has produced this
directional view on {signal.ticker}:

  Rating: {signal.rating} (direction: {signal.direction}, confidence: {signal.confidence})

Report:
{signal.full_report[:6000]}

Your job: decide whether and how to express this view as a defined-risk
options structure, using LIVE market data you fetch yourself via the
provided tools (get_option_chain, get_option_snapshot, get_option_contracts,
get_asset, get_account_info, get_all_positions, get_clock). Do not assume
prices or strikes - always fetch first.

Guidance (hard limits are enforced separately after you propose - stay
within these as a target, but a downstream risk gate is the real
enforcement, not this prompt):
- direction BUY -> prefer a bull put spread (sell OTM put, buy further OTM
  put) or, on strong conviction, a bull call spread.
- direction SELL -> prefer a bear call spread, or a bear put spread on
  strong conviction.
- direction HOLD, or when you judge conviction too weak/chain too illiquid
  for a directional trade -> consider an iron condor if IV looks rich, or
  propose no trade at all (call propose_trade with quantity 0 and explain
  why in rationale).
- Target days-to-expiration in the {config.TARGET_DTE_LOW}-{config.TARGET_DTE_HIGH} range.
- Prefer strikes with open interest >= {config.MIN_OPEN_INTEREST} and tight bid/ask spreads.
- This is a single-ticker decision; do not consider portfolio-level
  position limits (a separate system checks those).
- Your context window is limited. When calling get_option_chain, always pass
  a narrow strike_price_gte/strike_price_lte range (a handful of strikes
  around the current price) and a specific expiration_date or tight
  expiration_date_gte/lte window, plus a small `limit` (e.g. 20) - never
  fetch a wide, unfiltered chain.

Every leg you propose must carry the exact OCC option symbol you resolved
from get_option_chain/get_option_contracts for that strike/expiry/right -
never construct the symbol string yourself.

When you have fetched what you need and decided, call propose_trade exactly
once with your final structure. Every leg quantity must balance (equal buy
and sell contract counts) - no naked legs."""


async def _chat_completion(
    client: httpx.AsyncClient, messages: list[dict], tools: list[dict]
) -> dict:
    resp = await client.post(
        f"{config.CF_BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {config.CF_API_TOKEN}"},
        json={
            "model": config.STRUCTURING_LLM,
            "messages": messages,
            "tools": tools,
            "max_tokens": 4096,
            # This model/endpoint 400s on a conversation containing an
            # assistant turn with more than one tool_call - enforce one at a
            # time (see the truncation safeguard below too).
            "parallel_tool_calls": False,
        },
        timeout=120,
    )
    if resp.status_code >= 400:
        _debug(f"HTTP {resp.status_code} error body: {resp.text[:2000]}")
    resp.raise_for_status()
    return resp.json()


# Tools that prove the model actually looked at a real, live option chain
# before it's allowed to propose anything - see the grounding gate below.
_CHAIN_LOOKUP_TOOLS = {"get_option_chain", "get_option_contracts"}

# get_option_chain/get_option_snapshot responses carry dailyBar/latestTrade/
# minuteBar/prevDailyBar per contract, which the model doesn't need to pick
# strikes (only the live bid/ask does) - a wide chain query easily blew past
# the model's 24000-token context window with this cruft included. Strip to
# just the bid/ask before it goes back into the conversation.
_SLIMMED_TOOLS = {"get_option_chain", "get_option_snapshot"}


def _slim_snapshots(result: dict) -> dict:
    snapshots = result.get("data", {}).get("snapshots")
    if not isinstance(snapshots, dict):
        return result
    slimmed = {}
    for symbol, snap in snapshots.items():
        quote = snap.get("latestQuote", {}) if isinstance(snap, dict) else {}
        slimmed[symbol] = {"bid": quote.get("bp"), "ask": quote.get("ap")}
    return {**result, "data": {**result.get("data", {}), "snapshots": slimmed}}


def _extract_symbols(name: str, result: dict) -> set[str]:
    """Symbols actually present in a tool result - the ground truth a
    proposal's legs are checked against (see the symbol-grounding gate
    below). Guards against the model fabricating a plausible-looking but
    wrong OCC symbol (observed in testing: proposed a leg with `expiry`
    2026-09-17 but `symbol` encoding 2023-09-17)."""
    if not isinstance(result, dict):
        return set()
    data = result.get("data", {})
    if name == "get_option_chain":
        snapshots = data.get("snapshots")
        return set(snapshots.keys()) if isinstance(snapshots, dict) else set()
    if name == "get_option_contracts":
        contracts = data.get("option_contracts")
        if isinstance(contracts, list):
            return {c["symbol"] for c in contracts if isinstance(c, dict) and "symbol" in c}
    return set()


async def propose_trade(signal: SignalResult) -> TradeProposal | None:
    """Returns None if the model decides no trade is warranted (quantity 0).

    `propose_trade` is withheld from the tool list until the model has made
    at least one real get_option_chain/get_option_contracts call - otherwise
    weaker models happily "propose" a trade using hallucinated strikes/dates
    from training data on the very first turn without looking anything up
    (observed in testing: fabricated a 2024 expiry against a 2026 "today").
    This is a code-enforced grounding requirement, not a prompt request.
    """
    async with AlpacaMcpClient() as mcp, httpx.AsyncClient() as http_client:
        read_tools = _to_openai_tools(mcp.read_only_tool_schemas())
        propose_tool = {"type": "function", "function": PROPOSE_TRADE_FUNCTION}
        if not read_tools:
            raise RuntimeError(
                "no read-only MCP tools were found - check ALPACA_TOOLSETS / "
                "the whitelist in config.READ_ONLY_TOOL_WHITELIST against the "
                "server's actual tool names"
            )

        messages: list[dict] = [
            {"role": "system", "content": _system_prompt(signal)},
            {
                "role": "user",
                "content": f"Structure a trade (or decide not to) for {signal.ticker}.",
            },
        ]

        # Note: the schema-omission trick alone isn't a reliable gate - this
        # model has been observed calling `propose_trade` even in turns where
        # it wasn't in the offered `tools` list at all (Cloudflare's function
        # calling doesn't strictly validate call names against the schema).
        # So `tools` always includes propose_trade; the real enforcement is
        # the explicit `chain_looked_up` check below, which rejects the call
        # at the result level instead of trusting the schema to prevent it.
        tools = read_tools + [propose_tool]
        chain_looked_up = False
        observed_symbols: set[str] = set()
        stall_nudges = 0
        for turn in range(MAX_TOOL_ITERATIONS):
            data = await _chat_completion(http_client, messages, tools)
            choice = data["choices"][0]
            message = choice["message"]
            tool_calls = message.get("tool_calls") or []
            if len(tool_calls) > 1:
                # Belt-and-suspenders: parallel_tool_calls=False should
                # prevent this, but if the model still batches multiple
                # calls, keep only the first - a multi-tool_call assistant
                # turn 400s on the *next* request against this endpoint.
                tool_calls = tool_calls[:1]
            _debug(
                f"turn={turn} finish_reason={choice.get('finish_reason')} "
                f"chain_looked_up={chain_looked_up} "
                f"content={(message.get('content') or '')[:300]!r} "
                f"tool_calls={[c['function']['name'] for c in tool_calls]}"
            )

            assistant_message = {"role": "assistant", "content": message.get("content") or ""}
            if tool_calls:
                assistant_message["tool_calls"] = tool_calls
            messages.append(assistant_message)

            if not tool_calls:
                if not chain_looked_up:
                    # Stopped without ever checking a real chain - nudge it, don't
                    # silently accept "no trade" from an ungrounded model.
                    messages.append(
                        {
                            "role": "user",
                            "content": (
                                "You have not called get_option_chain or "
                                "get_option_contracts yet. Look up the real, "
                                "current option chain before deciding."
                            ),
                        }
                    )
                    continue
                # Chain was checked but it stopped narrating in plain text
                # instead of calling propose_trade (observed in testing) -
                # give it a couple of nudges before accepting "no trade".
                stall_nudges += 1
                if stall_nudges <= 2:
                    messages.append(
                        {
                            "role": "user",
                            "content": (
                                "Call the propose_trade function now with your "
                                "final structure (or quantity 0 if you've "
                                "decided against a trade) - do not describe it "
                                "in plain text."
                            ),
                        }
                    )
                    continue
                return None

            accepted = False
            accepted_proposal: TradeProposal | None = None
            for call in tool_calls:
                name = call["function"]["name"]

                if name == "propose_trade":
                    if not chain_looked_up:
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": call["id"],
                                "content": (
                                    "Rejected: you must call get_option_chain or "
                                    "get_option_contracts at least once before "
                                    "propose_trade, to ground strikes/expiry in "
                                    "real current data."
                                ),
                            }
                        )
                        continue
                    args = json.loads(call["function"]["arguments"])
                    proposed_symbols = {leg["symbol"] for leg in args.get("legs", [])}
                    unverified = proposed_symbols - observed_symbols
                    if unverified:
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": call["id"],
                                "content": (
                                    f"Rejected: symbol(s) {sorted(unverified)} were not "
                                    "present in any get_option_chain/get_option_contracts "
                                    "result you've seen this conversation. Only use exact "
                                    "symbols copied from a tool result, never construct or "
                                    "guess one."
                                ),
                            }
                        )
                        continue
                    accepted = True
                    accepted_proposal = _parse_proposal(signal.ticker, args)
                    messages.append(
                        {"role": "tool", "tool_call_id": call["id"], "content": "accepted"}
                    )
                    continue

                if name in _CHAIN_LOOKUP_TOOLS:
                    chain_looked_up = True
                try:
                    args = json.loads(call["function"]["arguments"] or "{}")
                    result = await mcp.call_tool(name, args)
                    observed_symbols |= _extract_symbols(name, result)
                    if name in _SLIMMED_TOOLS and isinstance(result, dict):
                        result = _slim_snapshots(result)
                    content = json.dumps(result) if not isinstance(result, str) else result
                except Exception as exc:  # noqa: BLE001 - surface to the model, not our caller
                    content = f"Error calling {name}: {exc}"
                messages.append({"role": "tool", "tool_call_id": call["id"], "content": content})

            if accepted:
                # accepted_proposal is None here means the model explicitly
                # proposed quantity 0 (a grounded "no trade" decision).
                return accepted_proposal

        raise RuntimeError(
            f"options_strategy: exceeded {MAX_TOOL_ITERATIONS} tool iterations without a proposal"
        )


def _parse_proposal(ticker: str, data: dict) -> TradeProposal | None:
    if int(data.get("quantity", 0)) <= 0:
        return None
    legs = [
        Leg(
            side=leg["side"],
            right=leg["right"],
            strike=float(leg["strike"]),
            expiry=leg["expiry"],
            symbol=leg["symbol"],
            ratio_qty=int(leg["ratio_qty"]),
        )
        for leg in data["legs"]
    ]
    return TradeProposal(
        ticker=ticker,
        strategy=data["strategy"],
        legs=legs,
        expiry=data["expiry"],
        quantity=int(data["quantity"]),
        credit_debit=data["credit_debit"],
        net_premium=float(data["net_premium"]),
        max_profit=float(data["max_profit"]),
        max_loss=float(data["max_loss"]),
        rationale=data["rationale"],
    )
