"""Phase-1 verification CLI: run the full pipeline for one ticker with no
FastAPI/gRPC/Postgres dependency.

  uv run python scripts/run_once.py SPY --date 2026-08-28 [--dry-run]

Pipeline: TradingAgents signal -> (if not HOLD) Claude options structuring
-> risk-gate printout -> (if pass and not --dry-run) execute via Alpaca MCP.

Note: day/rolling-5d P&L circuit breakers and open-position limits are
stubbed at "no open positions, 0% P&L" here, since there is no persistence
dependency in this standalone script (Phase 2's cycle.py wires them for
real from the `trades` and `account_snapshots` tables). Every other gate
runs for real against live account/market data.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import risk_gates  # noqa: E402
import tradingagents_client  # noqa: E402
from alpaca_mcp_client import AlpacaMcpClient  # noqa: E402
from executor import place  # noqa: E402
from market_data import account_state, leg_market_data  # noqa: E402
from options_strategy import propose_trade  # noqa: E402


async def run(ticker: str, run_date: str, dry_run: bool) -> None:
    print(f"=== TradingAgents signal: {ticker} @ {run_date} ===")
    signal = tradingagents_client.run_signal(ticker, run_date)
    print(f"rating={signal.rating} direction={signal.direction} confidence={signal.confidence}")
    print(signal.summary)
    print()

    if signal.direction == "HOLD":
        print("HOLD signal - no trade attempted (per pipeline: only BUY/SELL signals go to structuring).")
        return

    print("=== Options structuring ===")
    proposal = await propose_trade(signal)
    if proposal is None:
        print("Model decided no trade is warranted for this ticker today.")
        return

    print(f"strategy={proposal.strategy} legs={len(proposal.legs)} qty={proposal.quantity}")
    for leg in proposal.legs:
        print(f"  {leg.side:4s} {leg.right:4s} {leg.strike:>8.2f} {leg.expiry} x{leg.ratio_qty}  {leg.symbol}")
    print(
        f"{proposal.credit_debit} ${proposal.net_premium:.2f}/spread  "
        f"max_profit=${proposal.max_profit:.2f}  max_loss=${proposal.max_loss:.2f}"
    )
    print(f"rationale: {proposal.rationale}")
    print()

    async with AlpacaMcpClient() as mcp:
        print("=== Risk gates ===")
        account = await account_state(mcp)
        leg_md = await leg_market_data(mcp, proposal)
        result = risk_gates.evaluate(
            proposal,
            equity=account["equity"],
            options_buying_power=account["options_buying_power"],
            total_buying_power=account["total_buying_power"],
            capital_required=proposal.max_loss,
            open_trades=[],
            leg_market_data=leg_md,
            day_pnl_pct=0.0,
            rolling_5d_pnl_pct=0.0,
            as_of=datetime.strptime(run_date, "%Y-%m-%d").date(),
        )
        for outcome in result.outcomes:
            status = "PASS" if outcome.passed else "FAIL"
            print(f"  [{status}] {outcome.name}: {outcome.reason}")
        print()

        if not result.passed:
            print("BLOCKED: one or more risk gates failed - not placing an order.")
            return

        if dry_run:
            print("--dry-run: all gates passed, but not placing an order.")
            return

        print("=== Executing via Alpaca MCP place_option_order ===")
        order = await place(mcp, proposal)
        print(order)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("ticker")
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.ticker.upper(), args.date, args.dry_run))


if __name__ == "__main__":
    main()
