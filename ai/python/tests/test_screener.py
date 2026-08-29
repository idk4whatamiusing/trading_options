"""Unit tests for screener.py against a fake AlpacaMcpClient stub - no
network calls. Response shapes match what get_market_movers/
get_most_active_stocks/get_option_contracts actually returned in a live
test against the real paper account.
"""

from __future__ import annotations

import config
import pytest
from screener import screen_candidates


class FakeMcp:
    def __init__(self, *, movers=None, actives=None, optionable=frozenset(), raise_on=frozenset()):
        self._movers = movers or {"gainers": [], "losers": []}
        self._actives = actives or {"most_actives": []}
        self._optionable = optionable
        self._raise_on = raise_on

    async def call_tool(self, name, args):
        if name in self._raise_on:
            raise RuntimeError(f"{name} failed")
        if name == "get_most_active_stocks":
            return {"data": self._actives}
        if name == "get_market_movers":
            return {"data": self._movers}
        if name == "get_option_contracts":
            sym = args["underlying_symbols"]
            contracts = [{"symbol": f"{sym}250101C00100000"}] if sym in self._optionable else []
            return {"data": {"option_contracts": contracts}}
        raise AssertionError(f"unexpected tool call: {name}")


@pytest.mark.asyncio
async def test_dedup_across_movers_and_actives():
    mcp = FakeMcp(
        movers={"gainers": [{"symbol": "NVDA"}], "losers": []},
        actives={"most_actives": [{"symbol": "NVDA"}, {"symbol": "AAPL"}]},
        optionable={"NVDA", "AAPL"},
    )
    picks = await screen_candidates(mcp)
    assert picks.count("NVDA") == 1
    assert set(picks) == {"NVDA", "AAPL"}


@pytest.mark.asyncio
async def test_excludes_candidates_with_no_option_chain():
    mcp = FakeMcp(
        movers={"gainers": [{"symbol": "MIACW"}], "losers": []},
        actives={"most_actives": [{"symbol": "NVDA"}]},
        optionable={"NVDA"},  # MIACW has no listed options
    )
    picks = await screen_candidates(mcp)
    assert picks == ["NVDA"]


@pytest.mark.asyncio
async def test_caps_at_screener_max_tickers(monkeypatch):
    monkeypatch.setattr(config, "SCREENER_MAX_TICKERS", 2)
    symbols = ["AAA", "BBB", "CCC", "DDD"]
    mcp = FakeMcp(
        actives={"most_actives": [{"symbol": s} for s in symbols]},
        optionable=set(symbols),
    )
    picks = await screen_candidates(mcp)
    assert len(picks) == 2
    assert picks == ["AAA", "BBB"]


@pytest.mark.asyncio
async def test_falls_back_to_default_watchlist_when_screener_errors():
    mcp = FakeMcp(raise_on={"get_most_active_stocks", "get_market_movers"})
    picks = await screen_candidates(mcp)
    assert picks == config.DEFAULT_WATCHLIST


@pytest.mark.asyncio
async def test_falls_back_to_default_watchlist_when_nothing_survives_filter():
    mcp = FakeMcp(
        actives={"most_actives": [{"symbol": "MIACW"}]},
        optionable=set(),
    )
    picks = await screen_candidates(mcp)
    assert picks == config.DEFAULT_WATCHLIST
