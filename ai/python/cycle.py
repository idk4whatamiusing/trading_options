"""Orchestrates one full run across the watchlist: signal -> (if not HOLD)
structure -> risk-gate -> (if pass) execute, persisting every step through
`persistence.py` so the dashboard (Phase 4/6) has something to show.

Portfolio-level circuit breaker inputs (day/rolling-5d P&L) are computed
once per cycle from persisted `account_snapshots` history, not per ticker -
an approximation (nearest persisted snapshot, not a precise intraday tick
history) that's good enough for a once/day cadence.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import config
import persistence
import risk_gates
import screener
import tradingagents_client
from alpaca_mcp_client import AlpacaMcpClient
from executor import place
from market_data import account_state, extract_order_id, leg_market_data, open_positions_count
from models import CycleResult
from options_strategy import propose_trade


async def run(tickers: list[str] | None = None) -> CycleResult:
    run_date = date.today().isoformat()
    result = CycleResult(
        cycle_id=uuid.uuid4().hex, started_at=datetime.now(timezone.utc).isoformat()
    )

    try:
        prior_snapshots = persistence.list_account_snapshots(limit=5)
    except Exception as exc:  # noqa: BLE001 - db unreachable shouldn't crash the cycle
        prior_snapshots = []
        result.errors.append(f"could not load prior account snapshots: {exc}")

    day_pnl_pct = 0.0
    rolling_5d_pnl_pct = 0.0

    async with AlpacaMcpClient() as mcp:
        if tickers is None:
            tickers = config.WATCHLIST_OVERRIDE or await screener.screen_candidates(mcp)

        account = await account_state(mcp)
        equity = account["equity"]
        if prior_snapshots:
            baseline = prior_snapshots[0].equity
            if baseline:
                day_pnl_pct = (equity - baseline) / baseline
            oldest = prior_snapshots[-1].equity
            if oldest:
                rolling_5d_pnl_pct = (equity - oldest) / oldest

        for ticker in tickers:
            result.tickers_evaluated += 1
            try:
                signal = tradingagents_client.run_signal(ticker, run_date)
                decision_id = persistence.create_decision(signal)

                if signal.direction == "HOLD":
                    continue

                proposal = await propose_trade(signal)
                if proposal is None:
                    continue

                result.trades_proposed += 1
                trade_id = persistence.create_trade(decision_id, proposal)

                open_trades = persistence.list_trades(status="open")
                account_now = await account_state(mcp)
                leg_md = await leg_market_data(mcp, proposal)
                gate_result = risk_gates.evaluate(
                    proposal,
                    equity=account_now["equity"],
                    options_buying_power=account_now["options_buying_power"],
                    total_buying_power=account_now["total_buying_power"],
                    capital_required=proposal.max_loss,
                    open_trades=open_trades,
                    leg_market_data=leg_md,
                    day_pnl_pct=day_pnl_pct,
                    rolling_5d_pnl_pct=rolling_5d_pnl_pct,
                    as_of=date.today(),
                )
                for outcome in gate_result.outcomes:
                    persistence.log_risk_gate_event(trade_id, outcome)

                if not gate_result.passed:
                    persistence.update_trade_status(trade_id, "rejected")
                    result.trades_blocked += 1
                    continue

                try:
                    order = await place(mcp, proposal)
                    persistence.update_trade_status(
                        trade_id, "open", alpaca_order_id=extract_order_id(order)
                    )
                    result.trades_placed += 1
                except Exception as exc:  # noqa: BLE001
                    persistence.update_trade_status(trade_id, "failed")
                    result.errors.append(f"{ticker}: execution failed: {exc}")

            except Exception as exc:  # noqa: BLE001 - one bad ticker shouldn't kill the cycle
                result.errors.append(f"{ticker}: {exc}")

        try:
            final_account = await account_state(mcp)
            positions = await open_positions_count(mcp)
            persistence.record_account_snapshot(
                equity=final_account["equity"],
                cash=final_account.get("cash", 0.0),
                buying_power=final_account["total_buying_power"],
                options_buying_power=final_account["options_buying_power"],
                day_pnl=final_account["equity"] * day_pnl_pct,
                open_positions_count=positions,
            )
        except Exception as exc:  # noqa: BLE001
            result.errors.append(f"could not record account snapshot: {exc}")

    result.finished_at = datetime.now(timezone.utc).isoformat()
    result.status = "error" if result.errors else "ok"
    return result
