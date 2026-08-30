"""Unit tests for position_manager.py against a fake AlpacaMcpClient stub
and a monkeypatched persistence module - no network/gRPC calls.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import config
import persistence
import pytest
from position_manager import manage_open_positions


@dataclass
class FakeLeg:
    symbol: str


@dataclass
class FakeTrade:
    id: str
    legs: list


class FakeMcp:
    def __init__(self, *, positions=None, raise_on_close=frozenset()):
        self._positions = positions or []
        self._raise_on_close = raise_on_close
        self.closed: list[str] = []

    async def call_tool(self, name, args):
        if name == "get_all_positions":
            return {"data": {"result": self._positions}}
        if name == "close_position":
            symbol = args["symbol_or_asset_id"]
            if symbol in self._raise_on_close:
                raise RuntimeError(f"close failed for {symbol}")
            self.closed.append(symbol)
            return {"data": {}}
        raise AssertionError(f"unexpected tool call: {name}")


def _position(symbol, *, plpc=0.0, pl=0.0):
    return {"symbol": symbol, "unrealized_plpc": plpc, "unrealized_pl": pl}


@pytest.mark.asyncio
async def test_no_positions_is_a_noop():
    mcp = FakeMcp(positions=[])
    actions = await manage_open_positions(mcp, as_of=date(2026, 8, 30))
    assert actions == []


@pytest.mark.asyncio
async def test_take_profit_closes_position(monkeypatch):
    monkeypatch.setattr(persistence, "list_trades", lambda status="": [])
    mcp = FakeMcp(positions=[_position("AAPL260925C00150000", plpc=config.TAKE_PROFIT_PCT)])
    actions = await manage_open_positions(mcp, as_of=date(2026, 8, 30))
    assert mcp.closed == ["AAPL260925C00150000"]
    assert "take-profit" in actions[0]


@pytest.mark.asyncio
async def test_stop_loss_closes_position(monkeypatch):
    monkeypatch.setattr(persistence, "list_trades", lambda status="": [])
    mcp = FakeMcp(positions=[_position("AAPL260925C00150000", plpc=config.STOP_LOSS_PCT)])
    actions = await manage_open_positions(mcp, as_of=date(2026, 8, 30))
    assert mcp.closed == ["AAPL260925C00150000"]
    assert "stop-loss" in actions[0]


@pytest.mark.asyncio
async def test_approaching_expiry_forces_close(monkeypatch):
    monkeypatch.setattr(persistence, "list_trades", lambda status="": [])
    as_of = date(2026, 8, 30)
    near_expiry = as_of + timedelta(days=config.MIN_DTE_BEFORE_FORCE_CLOSE)
    symbol = f"AAPL{near_expiry.strftime('%y%m%d')}C00150000"
    mcp = FakeMcp(positions=[_position(symbol, plpc=0.1)])
    actions = await manage_open_positions(mcp, as_of=as_of)
    assert mcp.closed == [symbol]
    assert "expiry" in actions[0]


@pytest.mark.asyncio
async def test_healthy_position_is_left_open(monkeypatch):
    monkeypatch.setattr(persistence, "list_trades", lambda status="": [])
    mcp = FakeMcp(positions=[_position("AAPL270101C00150000", plpc=0.2)])
    actions = await manage_open_positions(mcp, as_of=date(2026, 8, 30))
    assert mcp.closed == []
    assert actions == []


@pytest.mark.asyncio
async def test_updates_matching_trade_to_closed_with_realized_pnl(monkeypatch):
    updates = []
    monkeypatch.setattr(
        persistence,
        "list_trades",
        lambda status="": [FakeTrade(id="trade-1", legs=[FakeLeg(symbol="AAPL260925C00150000")])],
    )
    monkeypatch.setattr(
        persistence,
        "update_trade_status",
        lambda trade_id, status, alpaca_order_id="", realized_pnl=0.0: updates.append(
            (trade_id, status, realized_pnl)
        ),
    )
    mcp = FakeMcp(
        positions=[_position("AAPL260925C00150000", plpc=config.TAKE_PROFIT_PCT, pl=500.0)]
    )
    await manage_open_positions(mcp, as_of=date(2026, 8, 30))
    assert updates == [("trade-1", "closed", 500.0)]


@pytest.mark.asyncio
async def test_close_failure_is_recorded_not_raised(monkeypatch):
    monkeypatch.setattr(persistence, "list_trades", lambda status="": [])
    mcp = FakeMcp(
        positions=[_position("AAPL260925C00150000", plpc=config.TAKE_PROFIT_PCT)],
        raise_on_close={"AAPL260925C00150000"},
    )
    actions = await manage_open_positions(mcp, as_of=date(2026, 8, 30))
    assert "failed to close" in actions[0]
