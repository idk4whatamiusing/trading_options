"""Order confirmation: after placing an order via executor.py,
poll get_all_positions to verify the new position actually appeared
in the account — closing the fire-and-forget gap."""

from __future__ import annotations

import asyncio
from typing import Any

from alpaca_mcp_client import AlpacaMcpClient
from models import TradeProposal

CONFIRM_POLLS = int(__import__("os").environ.get("CONFIRM_POLLS", "5"))
CONFIRM_DELAY_S = float(__import__("os").environ.get("CONFIRM_DELAY_S", "2.0"))


def _leg_symbols(proposal: TradeProposal) -> set[str]:
    return {leg.symbol for leg in proposal.legs}


async def confirm_order(mcp: AlpacaMcpClient, proposal: TradeProposal) -> dict[str, Any]:
    """Poll get_all_positions up to CONFIRM_POLLS times, checking
    whether any of the proposal's leg symbols appear in the account.

    Returns {"confirmed": bool, "polls": int, "symbols_seen": list[str]}.
    A single successful match before exhausting polls counts as confirmed.
    """
    symbols = _leg_symbols(proposal)
    seen: list[str] = []
    for i in range(CONFIRM_POLLS):
        try:
            resp = await mcp.call_tool("get_all_positions", {})
            positions = resp.get("data", {}).get("result", []) if isinstance(resp, dict) else []
            position_symbols = {p.get("symbol") for p in positions if isinstance(p, dict)}
            seen = sorted(position_symbols & symbols)
            if seen:
                return {"confirmed": True, "polls": i + 1, "symbols_seen": seen}
        except Exception:
            pass
        await asyncio.sleep(CONFIRM_DELAY_S)
    return {"confirmed": False, "polls": CONFIRM_POLLS, "symbols_seen": seen}
