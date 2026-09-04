"""Unit tests for order_confirm.py — verifies the confirmation loop
polls get_all_positions and returns confirmed=False when the position
never appears."""

from __future__ import annotations

import pytest
from order_confirm import confirm_order, CONFIRM_POLLS, CONFIRM_DELAY_S
from models import TradeProposal, Leg


def _proposal() -> TradeProposal:
    return TradeProposal(
        ticker="SPY",
        strategy="long_call",
        legs=[
            Leg(
                side="buy", right="call", strike=500, expiry="2026-10-17",
                symbol="SPY260925C00500000", ratio_qty=1,
            )
        ],
        expiry="2026-10-17", quantity=1, credit_debit="debit",
        net_premium=100.0, max_profit=500.0, max_loss=200.0, rationale="test",
    )


class FakeMcp:
    def __init__(self, position_symbols: frozenset | None = None, call_count: int = 0):
        self._position_symbols = position_symbols or frozenset()
        self._call_count = 0

    async def call_tool(self, name: str, args: dict) -> dict:
        if name == "get_all_positions":
            self._call_count += 1
            return {"data": {"result": [{"symbol": s} for s in self._position_symbols]}}
        raise AssertionError(f"unexpected tool call: {name}")


@pytest.mark.asyncio
async def test_confirmed_when_position_appears():
    """If the target symbol is present in positions on first poll,
    confirm_order returns confirmed=True with polls=1."""
    mcp = FakeMcp(position_symbols=frozenset({"SPY260925C00500000"}))
    result = await confirm_order(mcp, _proposal())
    assert result["confirmed"] is True
    assert result["polls"] == 1


@pytest.mark.asyncio
async def test_not_confirmed_when_never_appears():
    """If the target symbol never appears, confirm_order returns
    confirmed=False after CONFIRM_POLLS polls."""
    mcp = FakeMcp(position_symbols=frozenset())
    result = await confirm_order(mcp, _proposal())
    assert result["confirmed"] is False
    assert result["polls"] == CONFIRM_POLLS


@pytest.mark.asyncio
async def test_confirmed_after_delayed_appearance():
    """If the symbol appears on the third poll, confirmed=True, polls=3."""
    import asyncio

    class DelayedMcp:
        def __init__(self):
            self._call_count = 0

        async def call_tool(self, name: str, args: dict) -> dict:
            self._call_count += 1
            if self._call_count >= 3:
                return {"data": {"result": [{"symbol": "SPY260925C00500000"}]}}
            return {"data": {"result": []}}

    mcp = DelayedMcp()
    result = await confirm_order(mcp, _proposal())
    assert result["confirmed"] is True
    assert result["polls"] == 3


@pytest.mark.asyncio
async def test_symbols_seen_is_sorted():
    """symbols_seen in the result is a sorted list of matched symbols."""
    mcp = FakeMcp(
        position_symbols=frozenset({"SPY260925C00500000", "SPY260925P00500000"})
    )
    proposal = _proposal()
    # Use a proposal with both legs
    proposal2 = TradeProposal(
        ticker="SPY",
        strategy="long_straddle",
        legs=[
            Leg(side="buy", right="call", strike=500, expiry="2026-10-17",
                symbol="SPY260925C00500000", ratio_qty=1),
            Leg(side="buy", right="put", strike=500, expiry="2026-10-17",
                symbol="SPY260925P00500000", ratio_qty=1),
        ],
        expiry="2026-10-17", quantity=1, credit_debit="debit",
        net_premium=200.0, max_profit=1000.0, max_loss=200.0, rationale="test",
    )
    result = await confirm_order(mcp, proposal2)
    assert result["confirmed"] is True
    assert result["symbols_seen"] == ["SPY260925C00500000", "SPY260925P00500000"]
