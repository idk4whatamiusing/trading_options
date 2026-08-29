"""Deterministic risk gates. No LLM calls, no network calls beyond what's
passed in as arguments. This is the enforced veto boundary between "Claude
proposes a trade" and "code executes it" - executor.py refuses to run
unless evaluate() returns passed=True.

Every gate records an outcome, pass or fail, for the audit log
(risk_gate_events table once persistence exists) - not just the blockers.
"""

from __future__ import annotations

from datetime import date, datetime

import config
from models import GateOutcome, GateResult, TradeProposal


def _matched_spread(proposal: TradeProposal) -> GateOutcome:
    name = "defined_risk_only"
    if not proposal.legs:
        return GateOutcome(name, False, "proposal has no legs")

    buys = [leg for leg in proposal.legs if leg.side == "buy"]
    sells = [leg for leg in proposal.legs if leg.side == "sell"]
    if not buys or not sells:
        return GateOutcome(
            name, False, "naked position: every short leg needs an offsetting long leg"
        )

    buy_qty = sum(leg.ratio_qty for leg in buys)
    sell_qty = sum(leg.ratio_qty for leg in sells)
    if buy_qty != sell_qty:
        return GateOutcome(
            name, False, f"unmatched leg quantities (buy={buy_qty}, sell={sell_qty})"
        )

    return GateOutcome(name, True, "matched spread, quantity-balanced")


def _max_loss_per_trade(proposal: TradeProposal, equity: float) -> GateOutcome:
    name = "max_loss_per_trade"
    limit = config.MAX_LOSS_PCT_OF_EQUITY_PER_TRADE * equity
    if proposal.max_loss > limit:
        return GateOutcome(
            name, False,
            f"max_loss ${proposal.max_loss:,.2f} exceeds "
            f"{config.MAX_LOSS_PCT_OF_EQUITY_PER_TRADE:.0%} of equity (${limit:,.2f})",
        )
    return GateOutcome(name, True, f"max_loss ${proposal.max_loss:,.2f} <= ${limit:,.2f}")


def _max_aggregate_risk(proposal: TradeProposal, equity: float, open_trades: list) -> GateOutcome:
    name = "max_aggregate_risk"
    limit = config.MAX_AGGREGATE_RISK_PCT_OF_EQUITY * equity
    total = sum(t.max_loss for t in open_trades) + proposal.max_loss
    if total > limit:
        return GateOutcome(
            name, False,
            f"aggregate open risk ${total:,.2f} would exceed "
            f"{config.MAX_AGGREGATE_RISK_PCT_OF_EQUITY:.0%} of equity (${limit:,.2f})",
        )
    return GateOutcome(name, True, f"aggregate open risk ${total:,.2f} <= ${limit:,.2f}")


def _max_concurrent_positions(open_trades: list) -> GateOutcome:
    name = "max_concurrent_positions"
    n = len(open_trades)
    if n >= config.MAX_CONCURRENT_OPEN_POSITIONS:
        return GateOutcome(
            name, False,
            f"{n} open positions already at/above limit ({config.MAX_CONCURRENT_OPEN_POSITIONS})",
        )
    return GateOutcome(name, True, f"{n} open positions, under limit of {config.MAX_CONCURRENT_OPEN_POSITIONS}")


def _max_positions_per_underlying(proposal: TradeProposal, open_trades: list) -> GateOutcome:
    name = "max_positions_per_underlying"
    n = sum(1 for t in open_trades if t.ticker == proposal.ticker)
    if n >= config.MAX_CONCURRENT_POSITIONS_PER_UNDERLYING:
        return GateOutcome(
            name, False,
            f"{proposal.ticker} already has {n} open positions "
            f"(limit {config.MAX_CONCURRENT_POSITIONS_PER_UNDERLYING})",
        )
    return GateOutcome(name, True, f"{proposal.ticker} has {n} open positions, under limit")


def _dte_bounds(proposal: TradeProposal, as_of: date) -> GateOutcome:
    name = "dte_bounds"
    try:
        expiry = datetime.strptime(proposal.expiry, "%Y-%m-%d").date()
    except ValueError:
        return GateOutcome(name, False, f"unparseable expiry: {proposal.expiry!r}")
    dte = (expiry - as_of).days
    if not (config.MIN_DTE <= dte <= config.MAX_DTE):
        return GateOutcome(
            name, False, f"DTE {dte} outside [{config.MIN_DTE}, {config.MAX_DTE}]"
        )
    return GateOutcome(name, True, f"DTE {dte} within [{config.MIN_DTE}, {config.MAX_DTE}]")


def _liquidity_floor(proposal: TradeProposal, leg_market_data: list[dict]) -> GateOutcome:
    name = "liquidity_floor"
    if len(leg_market_data) != len(proposal.legs):
        return GateOutcome(name, False, "missing market data for one or more legs")
    for leg, md in zip(proposal.legs, leg_market_data):
        oi = md.get("open_interest")
        bid = md.get("bid")
        ask = md.get("ask")
        if oi is None or oi < config.MIN_OPEN_INTEREST:
            return GateOutcome(
                name, False,
                f"{leg.right} {leg.strike} open interest {oi} < {config.MIN_OPEN_INTEREST}",
            )
        if bid is None or ask is None or bid <= 0 or ask <= 0:
            return GateOutcome(name, False, f"{leg.right} {leg.strike} missing/invalid quote")
        mid = (bid + ask) / 2
        spread_pct = (ask - bid) / mid if mid else 1.0
        if spread_pct > config.MAX_BID_ASK_SPREAD_PCT_OF_MID:
            return GateOutcome(
                name, False,
                f"{leg.right} {leg.strike} spread {spread_pct:.1%} > "
                f"{config.MAX_BID_ASK_SPREAD_PCT_OF_MID:.0%} of mid",
            )
    return GateOutcome(name, True, "all legs meet OI and spread floors")


def _max_contracts_per_leg(proposal: TradeProposal) -> GateOutcome:
    name = "max_contracts_per_leg"
    for leg in proposal.legs:
        qty = leg.ratio_qty * proposal.quantity
        if qty > config.MAX_CONTRACTS_PER_LEG:
            return GateOutcome(
                name, False,
                f"{leg.right} {leg.strike} qty {qty} > limit {config.MAX_CONTRACTS_PER_LEG}",
            )
    return GateOutcome(name, True, f"all legs <= {config.MAX_CONTRACTS_PER_LEG} contracts")


def _buying_power(proposal: TradeProposal, options_buying_power: float, total_buying_power: float, capital_required: float) -> GateOutcome:
    name = "buying_power"
    per_trade_limit = config.MAX_TRADE_PCT_OF_OPTIONS_BUYING_POWER * options_buying_power
    if capital_required > per_trade_limit:
        return GateOutcome(
            name, False,
            f"capital required ${capital_required:,.2f} exceeds "
            f"{config.MAX_TRADE_PCT_OF_OPTIONS_BUYING_POWER:.0%} of options buying power "
            f"(${per_trade_limit:,.2f})",
        )
    utilization_after = 1 - ((total_buying_power - capital_required) / total_buying_power) if total_buying_power else 1.0
    if utilization_after > config.MAX_BUYING_POWER_UTILIZATION_AFTER_TRADE:
        return GateOutcome(
            name, False,
            f"buying-power utilization after trade {utilization_after:.0%} exceeds "
            f"{config.MAX_BUYING_POWER_UTILIZATION_AFTER_TRADE:.0%} limit",
        )
    return GateOutcome(name, True, f"buying power OK (utilization after: {utilization_after:.0%})")


def _daily_circuit_breaker(day_pnl_pct: float) -> GateOutcome:
    name = "daily_circuit_breaker"
    if day_pnl_pct <= config.DAILY_LOSS_CIRCUIT_BREAKER_PCT:
        return GateOutcome(
            name, False,
            f"today's P&L {day_pnl_pct:.1%} at/below circuit breaker "
            f"{config.DAILY_LOSS_CIRCUIT_BREAKER_PCT:.1%} - no new trades today",
        )
    return GateOutcome(name, True, f"today's P&L {day_pnl_pct:.1%}, above circuit breaker")


def _rolling_5d_circuit_breaker(rolling_5d_pnl_pct: float) -> GateOutcome:
    name = "rolling_5d_circuit_breaker"
    if rolling_5d_pnl_pct <= config.ROLLING_5D_LOSS_CIRCUIT_BREAKER_PCT:
        return GateOutcome(
            name, False,
            f"5-day P&L {rolling_5d_pnl_pct:.1%} at/below circuit breaker "
            f"{config.ROLLING_5D_LOSS_CIRCUIT_BREAKER_PCT:.1%} - paused until manually cleared",
        )
    return GateOutcome(name, True, f"5-day P&L {rolling_5d_pnl_pct:.1%}, above circuit breaker")


def _kill_switch(equity: float) -> GateOutcome:
    name = "kill_switch"
    drawdown_pct = (equity - config.STARTING_EQUITY) / config.STARTING_EQUITY
    if drawdown_pct <= config.KILL_SWITCH_DRAWDOWN_PCT:
        return GateOutcome(
            name, False,
            f"drawdown {drawdown_pct:.1%} from ${config.STARTING_EQUITY:,.0f} start "
            f"breaches kill-switch {config.KILL_SWITCH_DRAWDOWN_PCT:.1%} - agent halted",
        )
    return GateOutcome(name, True, f"drawdown {drawdown_pct:.1%}, above kill-switch threshold")


def evaluate(
    proposal: TradeProposal,
    *,
    equity: float,
    options_buying_power: float,
    total_buying_power: float,
    capital_required: float,
    open_trades: list,
    leg_market_data: list[dict],
    day_pnl_pct: float,
    rolling_5d_pnl_pct: float,
    as_of: date | None = None,
) -> GateResult:
    as_of = as_of or date.today()
    outcomes = [
        _matched_spread(proposal),
        _max_loss_per_trade(proposal, equity),
        _max_aggregate_risk(proposal, equity, open_trades),
        _max_concurrent_positions(open_trades),
        _max_positions_per_underlying(proposal, open_trades),
        _dte_bounds(proposal, as_of),
        _liquidity_floor(proposal, leg_market_data),
        _max_contracts_per_leg(proposal),
        _buying_power(proposal, options_buying_power, total_buying_power, capital_required),
        _daily_circuit_breaker(day_pnl_pct),
        _rolling_5d_circuit_breaker(rolling_5d_pnl_pct),
        _kill_switch(equity),
    ]
    return GateResult(passed=all(o.passed for o in outcomes), outcomes=outcomes)
