"""Dynamic ticker screening: instead of a fixed watchlist, pick today's
candidates from Alpaca's real-time movers/most-active screeners, then keep
only the ones with an actual listed, liquid option chain. A screener hit
with no options market is useless to an options-only strategy and would
just burn a TradingAgents LLM call before getting rejected by
risk_gates.py's liquidity gate anyway - raw movers/most-actives output is
dominated by penny-stock warrants and micro-caps with no listed options
(confirmed live: MIACW/GFAIW/SAIHW-style names top the gainers list most
days), so the options-chain check is the real filter, not a symbol-shape
heuristic.
"""

from __future__ import annotations

import config
from alpaca_mcp_client import AlpacaMcpClient


async def screen_candidates(mcp: AlpacaMcpClient) -> list[str]:
    candidates: list[str] = []
    seen: set[str] = set()

    try:
        actives = await mcp.call_tool(
            "get_most_active_stocks", {"by": "volume", "top": config.SCREENER_TOP_ACTIVE}
        )
        actives_data = actives.get("data", {}) if isinstance(actives, dict) else {}
        for row in actives_data.get("most_actives", []):
            sym = row.get("symbol")
            if sym and sym not in seen:
                seen.add(sym)
                candidates.append(sym)
    except Exception:
        pass

    try:
        movers = await mcp.call_tool(
            "get_market_movers", {"market_type": "stocks", "top": config.SCREENER_TOP_MOVERS}
        )
        movers_data = movers.get("data", {}) if isinstance(movers, dict) else {}
        for row in movers_data.get("gainers", []) + movers_data.get("losers", []):
            sym = row.get("symbol")
            if sym and sym not in seen:
                seen.add(sym)
                candidates.append(sym)
    except Exception:
        pass

    picked: list[str] = []
    for sym in candidates:
        if len(picked) >= config.SCREENER_MAX_TICKERS:
            break
        try:
            contracts = await mcp.call_tool(
                "get_option_contracts", {"underlying_symbols": sym, "limit": 1}
            )
            contracts_data = contracts.get("data", {}) if isinstance(contracts, dict) else {}
            has_options = bool(contracts_data.get("option_contracts"))
        except Exception:
            has_options = False
        if has_options:
            picked.append(sym)

    return picked or config.DEFAULT_WATCHLIST
