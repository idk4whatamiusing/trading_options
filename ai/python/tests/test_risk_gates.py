"""Unit tests for risk_gates.py - the deterministic veto boundary between
"the LLM proposes a trade" and "executor.py places it". Pure logic, no
network/API dependency: every gate gets one passing case and one failing
case, driven off the same numeric thresholds risk_gates.py itself reads
from config.py (so these stay correct if the thresholds are ever tuned).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import config
import risk_gates
from models import Leg, TradeProposal


@dataclass
class FakeOpenTrade:
    ticker: str
    max_loss: float


def _leg(side: str, right: str, strike: float, ratio_qty: int = 1) -> Leg:
    return Leg(
        side=side,
        right=right,
        strike=strike,
        expiry="2026-09-25",
        symbol=f"SPY260925{right[0].upper()}{int(strike * 1000):08d}",
        ratio_qty=ratio_qty,
    )


def _baseline_proposal() -> TradeProposal:
    return TradeProposal(
        ticker="SPY",
        strategy="bull_put_spread",
        legs=[_leg("sell", "put", 500), _leg("buy", "put", 495)],
        expiry="2026-09-25",
        quantity=1,
        credit_debit="credit",
        net_premium=150.0,
        max_profit=150.0,
        max_loss=350.0,
        rationale="test fixture",
    )


def _baseline_market_data() -> list[dict]:
    return [
        {"open_interest": 500, "bid": 4.90, "ask": 5.10},
        {"open_interest": 500, "bid": 2.90, "ask": 3.10},
    ]


def _evaluate(proposal: TradeProposal | None = None, **overrides):
    kwargs = dict(
        equity=100_000.0,
        options_buying_power=50_000.0,
        total_buying_power=100_000.0,
        capital_required=350.0,
        open_trades=[],
        leg_market_data=_baseline_market_data(),
        day_pnl_pct=0.0,
        rolling_5d_pnl_pct=0.0,
        as_of=date(2026, 8, 29),
    )
    kwargs.update(overrides)
    return risk_gates.evaluate(proposal or _baseline_proposal(), **kwargs)


def _outcome(result, name: str):
    return next(o for o in result.outcomes if o.name == name)


def test_baseline_proposal_passes_every_gate():
    result = _evaluate()
    assert result.passed
    assert all(o.passed for o in result.outcomes)


# 1. defined-risk only (matched spread)
def test_defined_risk_fails_on_naked_leg():
    proposal = _baseline_proposal()
    proposal.legs = [proposal.legs[0]]  # short leg only, no offsetting long
    assert not _outcome(_evaluate(proposal), "defined_risk_only").passed


def test_defined_risk_fails_on_unmatched_quantities():
    proposal = _baseline_proposal()
    proposal.legs[0].ratio_qty = 2
    assert not _outcome(_evaluate(proposal), "defined_risk_only").passed


# 2. max loss per trade
def test_max_loss_per_trade_fails_over_limit():
    proposal = _baseline_proposal()
    proposal.max_loss = config.MAX_LOSS_PCT_OF_EQUITY_PER_TRADE * 100_000.0 + 1
    assert not _outcome(_evaluate(proposal), "max_loss_per_trade").passed


# 3. max aggregate risk across open positions
def test_max_aggregate_risk_fails_when_open_plus_new_exceeds_limit():
    open_trades = [FakeOpenTrade("AAPL", config.MAX_AGGREGATE_RISK_PCT_OF_EQUITY * 100_000.0)]
    assert not _outcome(_evaluate(open_trades=open_trades), "max_aggregate_risk").passed


# 4. max concurrent open positions
def test_max_concurrent_positions_fails_at_limit():
    open_trades = [FakeOpenTrade("AAPL", 0.0) for _ in range(config.MAX_CONCURRENT_OPEN_POSITIONS)]
    assert not _outcome(_evaluate(open_trades=open_trades), "max_concurrent_positions").passed


# 5. max concurrent positions per underlying
def test_max_positions_per_underlying_fails_at_limit():
    open_trades = [
        FakeOpenTrade("SPY", 0.0) for _ in range(config.MAX_CONCURRENT_POSITIONS_PER_UNDERLYING)
    ]
    assert not _outcome(_evaluate(open_trades=open_trades), "max_positions_per_underlying").passed


# 6. DTE bounds
def test_dte_bounds_fails_when_too_soon():
    proposal = _baseline_proposal()
    proposal.expiry = "2026-09-01"  # 3 days out from as_of, below MIN_DTE
    assert not _outcome(_evaluate(proposal), "dte_bounds").passed


def test_dte_bounds_fails_when_too_far():
    proposal = _baseline_proposal()
    proposal.expiry = "2027-06-01"  # far beyond MAX_DTE
    assert not _outcome(_evaluate(proposal), "dte_bounds").passed


# 7. liquidity floor (open interest + bid/ask spread)
def test_liquidity_floor_fails_on_low_open_interest():
    market_data = _baseline_market_data()
    market_data[0]["open_interest"] = 1
    assert not _outcome(_evaluate(leg_market_data=market_data), "liquidity_floor").passed


def test_liquidity_floor_fails_on_wide_spread():
    market_data = _baseline_market_data()
    market_data[0]["bid"], market_data[0]["ask"] = 1.0, 5.0
    assert not _outcome(_evaluate(leg_market_data=market_data), "liquidity_floor").passed


# 8. max contracts per leg
def test_max_contracts_per_leg_fails_over_limit():
    proposal = _baseline_proposal()
    proposal.quantity = config.MAX_CONTRACTS_PER_LEG + 1
    assert not _outcome(_evaluate(proposal), "max_contracts_per_leg").passed


# 9. buying power (per-trade cap, then post-trade utilization)
def test_buying_power_fails_when_capital_required_exceeds_per_trade_cap():
    result = _evaluate(
        capital_required=60_000.0, options_buying_power=50_000.0, total_buying_power=1_000_000.0
    )
    assert not _outcome(result, "buying_power").passed


def test_buying_power_fails_when_utilization_after_trade_too_high():
    result = _evaluate(
        capital_required=200_000.0, options_buying_power=1_000_000.0, total_buying_power=200_000.0
    )
    assert not _outcome(result, "buying_power").passed


# 10. daily circuit breaker
def test_daily_circuit_breaker_fails_at_threshold():
    result = _evaluate(day_pnl_pct=config.DAILY_LOSS_CIRCUIT_BREAKER_PCT)
    assert not _outcome(result, "daily_circuit_breaker").passed


def test_daily_circuit_breaker_passes_above_threshold():
    result = _evaluate(day_pnl_pct=config.DAILY_LOSS_CIRCUIT_BREAKER_PCT + 0.01)
    assert _outcome(result, "daily_circuit_breaker").passed


# 11. rolling 5-day circuit breaker
def test_rolling_5d_circuit_breaker_fails_at_threshold():
    result = _evaluate(rolling_5d_pnl_pct=config.ROLLING_5D_LOSS_CIRCUIT_BREAKER_PCT)
    assert not _outcome(result, "rolling_5d_circuit_breaker").passed


def test_rolling_5d_circuit_breaker_passes_above_threshold():
    result = _evaluate(rolling_5d_pnl_pct=config.ROLLING_5D_LOSS_CIRCUIT_BREAKER_PCT + 0.01)
    assert _outcome(result, "rolling_5d_circuit_breaker").passed


# 12. hard kill-switch
def test_kill_switch_fails_at_drawdown_threshold():
    equity = config.STARTING_EQUITY * (1 + config.KILL_SWITCH_DRAWDOWN_PCT)
    assert not _outcome(_evaluate(equity=equity), "kill_switch").passed


def test_kill_switch_passes_above_drawdown_threshold():
    equity = config.STARTING_EQUITY * (1 + config.KILL_SWITCH_DRAWDOWN_PCT) + 1
    assert _outcome(_evaluate(equity=equity), "kill_switch").passed
