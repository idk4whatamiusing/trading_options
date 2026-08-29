"""Shared data shapes passed between the trading-agent pipeline stages."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class SignalResult:
    ticker: str
    run_date: str
    direction: str  # BUY | SELL | HOLD (collapsed from TradingAgents' 5-tier rating)
    rating: str  # raw 5-tier rating: Buy | Overweight | Hold | Underweight | Sell
    confidence: float | None  # 1.0 = Buy/Sell, 0.5 = Overweight/Underweight, 0.0 = Hold
    summary: str
    full_report: str


@dataclass
class Leg:
    side: str  # buy | sell
    right: str  # call | put
    strike: float
    expiry: str  # YYYY-MM-DD
    symbol: str  # exact OCC option symbol, e.g. AAPL250321C00150000 - resolved
    # by Claude from get_option_chain/get_option_contracts, never hand-built
    ratio_qty: int = 1


@dataclass
class TradeProposal:
    ticker: str
    strategy: (
        str  # bull_put_spread | bear_call_spread | iron_condor | bull_call_spread | bear_put_spread
    )
    legs: list[Leg]
    expiry: str
    quantity: int
    credit_debit: str  # credit | debit
    net_premium: float
    max_profit: float
    max_loss: float
    rationale: str


@dataclass
class GateOutcome:
    name: str
    passed: bool
    reason: str


@dataclass
class GateResult:
    passed: bool
    outcomes: list[GateOutcome] = field(default_factory=list)


@dataclass
class CycleResult:
    cycle_id: str
    started_at: str
    finished_at: str = ""
    tickers_evaluated: int = 0
    trades_proposed: int = 0
    trades_placed: int = 0
    trades_blocked: int = 0
    errors: list[str] = field(default_factory=list)
    status: str = "running"  # running | ok | error | idle
