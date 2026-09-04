"""The only code path allowed to call Alpaca MCP's `place_option_order`.

Must only be invoked after risk_gates.evaluate() has returned an all-pass
GateResult. Claude's structuring step (options_strategy.py) never sees this
tool at all - this module is the sole caller, driven entirely by plain
Python, not by any LLM decision at execution time.

After placing, `place()` confirms the order landed by polling
`get_all_positions` via order_confirm.py — closing the fire-and-forget gap.
"""

from __future__ import annotations

import uuid

from alpaca_mcp_client import AlpacaMcpClient
from models import TradeProposal
from order_confirm import confirm_order


def _limit_price(proposal: TradeProposal) -> str:
    # place_option_order convention: positive = debit/cost, negative = credit/proceeds.
    signed = proposal.net_premium if proposal.credit_debit == "debit" else -proposal.net_premium
    return f"{signed:.2f}"


async def place(mcp: AlpacaMcpClient, proposal: TradeProposal) -> dict:
    legs = [
        {
            "symbol": leg.symbol,
            "ratio_qty": str(leg.ratio_qty),
            "side": leg.side,
            "position_intent": "buy_to_open" if leg.side == "buy" else "sell_to_open",
        }
        for leg in proposal.legs
    ]

    order_args = {
        "qty": str(proposal.quantity),
        "type": "limit",
        "time_in_force": "day",
        "limit_price": _limit_price(proposal),
        "client_order_id": f"alpaca-agent-{uuid.uuid4().hex[:24]}",
        "order_class": "mleg" if len(legs) > 1 else None,
        "legs": legs,
    }
    order_args = {k: v for k, v in order_args.items() if v is not None}

    order = await mcp.call_tool("place_option_order", order_args)
    confirmation = await confirm_order(mcp, proposal)
    return {"order": order, **confirmation}
