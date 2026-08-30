"""Position management: previously nothing anywhere ever closed a position
once opened, took a profit, or cut a loss - a placed trade just sat until
expiration/assignment. Runs at the start of every cycle.run(), before new
signals are evaluated: checks every open position against take-profit /
stop-loss / approaching-expiry rules and closes matches via close_position.
"""

from __future__ import annotations

import re
from datetime import date

import config
import persistence
from alpaca_mcp_client import AlpacaMcpClient
from market_data import num

# OCC option symbol: ROOT + YYMMDD + C/P + strike*1000 (8 digits), e.g.
# AAPL250321C00150000. Parsed directly rather than trusting a separate
# expiry field, since it's always present and unambiguous.
_OCC_RE = re.compile(r"^[A-Z]+(?P<yy>\d{2})(?P<mm>\d{2})(?P<dd>\d{2})[CP]\d{8}$")


def _days_to_expiry(symbol: str, as_of: date) -> int | None:
    m = _OCC_RE.match(symbol)
    if not m:
        return None
    expiry = date(2000 + int(m["yy"]), int(m["mm"]), int(m["dd"]))
    return (expiry - as_of).days


async def manage_open_positions(mcp: AlpacaMcpClient, *, as_of: date | None = None) -> list[str]:
    as_of = as_of or date.today()
    actions: list[str] = []

    resp = await mcp.call_tool("get_all_positions", {})
    positions = resp.get("data", {}).get("result", []) if isinstance(resp, dict) else []
    if not positions:
        return actions

    open_trades = persistence.list_trades(status="open")
    trade_by_symbol = {leg.symbol: trade for trade in open_trades for leg in trade.legs}

    for pos in positions:
        symbol = pos.get("symbol")
        if not symbol:
            continue
        plpc = num(pos.get("unrealized_plpc"))
        unrealized_pl = num(pos.get("unrealized_pl"))
        dte = _days_to_expiry(symbol, as_of)

        reason = None
        if plpc >= config.TAKE_PROFIT_PCT:
            reason = f"take-profit ({plpc:.0%} >= {config.TAKE_PROFIT_PCT:.0%})"
        elif plpc <= config.STOP_LOSS_PCT:
            reason = f"stop-loss ({plpc:.0%} <= {config.STOP_LOSS_PCT:.0%})"
        elif dte is not None and dte <= config.MIN_DTE_BEFORE_FORCE_CLOSE:
            reason = f"approaching expiry (DTE {dte} <= {config.MIN_DTE_BEFORE_FORCE_CLOSE})"

        if reason is None:
            continue

        try:
            await mcp.call_tool("close_position", {"symbol_or_asset_id": symbol})
            actions.append(f"closed {symbol}: {reason}")
            trade = trade_by_symbol.get(symbol)
            if trade is not None:
                persistence.update_trade_status(trade.id, "closed", realized_pnl=unrealized_pl)
        except Exception as exc:  # noqa: BLE001 - one bad close shouldn't block the others
            actions.append(f"failed to close {symbol}: {exc}")

    return actions
