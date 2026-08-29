"""Shared live-account/market-data helpers used by both scripts/run_once.py
(Phase 1 standalone verification) and cycle.py (Phase 2 scheduled runs) to
build the inputs risk_gates.evaluate() needs.
"""

from __future__ import annotations

from alpaca_mcp_client import AlpacaMcpClient


def num(x, default=0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


async def account_state(mcp: AlpacaMcpClient) -> dict:
    resp = await mcp.call_tool("get_account_info", {})
    info = resp.get("data", {}) if isinstance(resp, dict) else {}
    if not info:
        raise RuntimeError(f"get_account_info returned unexpected shape: {resp!r}")
    return {
        "equity": num(info.get("equity")),
        "cash": num(info.get("cash")),
        "options_buying_power": num(info.get("options_buying_power") or info.get("buying_power")),
        "total_buying_power": num(info.get("buying_power")),
    }


async def open_positions_count(mcp: AlpacaMcpClient) -> int:
    resp = await mcp.call_tool("get_all_positions", {})
    positions = resp.get("data", {}).get("result", []) if isinstance(resp, dict) else []
    return len(positions)


def extract_order_id(order: dict) -> str:
    return (order.get("data", {}) if isinstance(order, dict) else {}).get("id", "") or ""


async def leg_market_data(mcp: AlpacaMcpClient, proposal) -> list[dict]:
    # bid/ask come from get_option_snapshot (batched, one call for all legs);
    # open_interest only exists on get_option_contracts, queried per-leg since
    # it filters by underlying/expiry/type/strike-range, not an exact symbol.
    symbols = ",".join(leg.symbol for leg in proposal.legs)
    snap_resp = await mcp.call_tool("get_option_snapshot", {"symbols": symbols})
    snapshots = snap_resp.get("data", {}).get("snapshots", {})

    out = []
    for leg in proposal.legs:
        quote = snapshots.get(leg.symbol, {}).get("latestQuote", {})

        contracts_resp = await mcp.call_tool(
            "get_option_contracts",
            {
                "underlying_symbols": proposal.ticker,
                "expiration_date": leg.expiry,
                "type": leg.right,
                "strike_price_gte": str(leg.strike),
                "strike_price_lte": str(leg.strike),
                "limit": 1,
            },
        )
        contracts = contracts_resp.get("data", {}).get("option_contracts", [])
        open_interest = num(contracts[0]["open_interest"]) if contracts else None

        out.append(
            {
                "open_interest": open_interest,
                "bid": num(quote.get("bp")),
                "ask": num(quote.get("ap")),
            }
        )
    return out
