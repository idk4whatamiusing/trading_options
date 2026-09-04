"""Unit tests for options_strategy.py - strategy enum completeness and
proposal parsing for all supported structures (long_call, long_put,
spreads, iron_condor, long_straddle, long_strangle)."""

from __future__ import annotations

import datetime

import config
import pytest
from options_strategy import PROPOSE_TRADE_FUNCTION, _parse_proposal
from models import TradeProposal


STRATEGIES = PROPOSE_TRADE_FUNCTION["parameters"]["properties"]["strategy"]["enum"]

EXPECTED = [
    "long_call",
    "long_put",
    "bull_put_spread",
    "bear_call_spread",
    "iron_condor",
    "bull_call_spread",
    "bear_put_spread",
    "long_straddle",
    "long_strangle",
]


def test_all_expected_strategies_present():
    for s in EXPECTED:
        assert s in STRATEGIES, f"{s} missing from strategy enum"


def test_no_unexpected_strategies():
    assert set(STRATEGIES) == set(EXPECTED)


def _parse(strategy: str, legs: list, quantity: int = 1, credit_debit: str = "debit") -> TradeProposal | None:
    return _parse_proposal(
        "SPY",
        {
            "strategy": strategy,
            "legs": [
                {
                    "side": l.side,
                    "right": l.right,
                    "strike": l.strike,
                    "expiry": l.expiry,
                    "symbol": l.symbol,
                    "ratio_qty": l.ratio_qty,
                }
                for l in legs
            ],
            "expiry": "2026-09-25",
            "quantity": quantity,
            "credit_debit": credit_debit,
            "net_premium": 100.0,
            "max_profit": 500.0,
            "max_loss": 200.0,
            "rationale": "test",
        },
    )


def test_parse_long_straddle():
    from models import Leg
    p = _parse("long_straddle", [Leg(side="buy", right="call", strike=500, expiry="2026-09-25", symbol="SPY260925C00500000", ratio_qty=1), Leg(side="buy", right="put", strike=500, expiry="2026-09-25", symbol="SPY260925P00500000", ratio_qty=1)])
    assert p is not None
    assert p.strategy == "long_straddle"
    assert len(p.legs) == 2
    assert all(l.side == "buy" for l in p.legs)


def test_parse_long_strangle():
    from models import Leg
    p = _parse("long_strangle", [Leg(side="buy", right="call", strike=520, expiry="2026-09-25", symbol="SPY260925C00520000", ratio_qty=1), Leg(side="buy", right="put", strike=480, expiry="2026-09-25", symbol="SPY260925P00480000", ratio_qty=1)])
    assert p is not None
    assert p.strategy == "long_strangle"
    assert len(p.legs) == 2
    assert all(l.side == "buy" for l in p.legs)


def test_parse_iron_condor():
    from models import Leg
    legs = [
        Leg(side="sell", right="call", strike=520, expiry="2026-09-25", symbol="SPY260925C00520000", ratio_qty=1),
        Leg(side="buy", right="call", strike=530, expiry="2026-09-25", symbol="SPY260925C00530000", ratio_qty=1),
        Leg(side="sell", right="put", strike=480, expiry="2026-09-25", symbol="SPY260925P00480000", ratio_qty=1),
        Leg(side="buy", right="put", strike=470, expiry="2026-09-25", symbol="SPY260925P00470000", ratio_qty=1),
    ]
    p = _parse("iron_condor", legs)
    assert p is not None
    assert p.strategy == "iron_condor"
    assert len(p.legs) == 4
    assert p.legs[0].side == "sell"


def test_parse_long_call():
    from models import Leg
    p = _parse("long_call", [Leg(side="buy", right="call", strike=500, expiry="2026-09-25", symbol="SPY260925C00500000", ratio_qty=1)])
    assert p is not None
    assert p.strategy == "long_call"
    assert len(p.legs) == 1
    assert p.legs[0].side == "buy"


def test_parse_quantity_zero_returns_none():
    from models import Leg
    result = _parse("long_call", [Leg(side="buy", right="call", strike=500, expiry="2026-09-25", symbol="SPY260925C00500000", ratio_qty=1)], quantity=0)
    assert result is None


def test_iron_condor_passes_defined_risk_gate():
    """Iron condor (matched spread) passes the defined_risk_only gate."""
    import risk_gates
    from models import Leg
    legs = [
        Leg(side="sell", right="call", strike=520, expiry="2026-10-17", symbol="X", ratio_qty=1),
        Leg(side="buy", right="call", strike=530, expiry="2026-10-17", symbol="X", ratio_qty=1),
        Leg(side="sell", right="put", strike=480, expiry="2026-10-17", symbol="X", ratio_qty=1),
        Leg(side="buy", right="put", strike=470, expiry="2026-10-17", symbol="X", ratio_qty=1),
    ]
    proposal = TradeProposal(
        ticker="SPY", strategy="iron_condor", legs=legs, expiry="2026-10-17",
        quantity=1, credit_debit="credit", net_premium=100.0, max_profit=100.0, max_loss=400.0, rationale="test",
    )
    result = risk_gates.evaluate(
        proposal,
        equity=100_000.0,
        options_buying_power=50_000.0,
        total_buying_power=100_000.0,
        capital_required=400.0,
        open_trades=[],
        leg_market_data=[{"open_interest": 500, "bid": 4.9, "ask": 5.1}] * 4,
        day_pnl_pct=0.0,
        rolling_5d_pnl_pct=0.0,
        as_of=datetime.date(2026, 9, 25),
    )
    assert result.passed


def test_long_straddle_passes_defined_risk_gate():
    """Long straddle is buy-only -> defined risk."""
    import risk_gates
    from models import Leg
    legs = [
        Leg(side="buy", right="call", strike=500, expiry="2026-10-17", symbol="X", ratio_qty=1),
        Leg(side="buy", right="put", strike=500, expiry="2026-10-17", symbol="X", ratio_qty=1),
    ]
    proposal = TradeProposal(
        ticker="SPY", strategy="long_straddle", legs=legs, expiry="2026-10-17",
        quantity=1, credit_debit="debit", net_premium=200.0, max_profit=1000.0, max_loss=200.0, rationale="test",
    )
    result = risk_gates.evaluate(
        proposal,
        equity=100_000.0,
        options_buying_power=50_000.0,
        total_buying_power=100_000.0,
        capital_required=200.0,
        open_trades=[],
        leg_market_data=[{"open_interest": 500, "bid": 4.9, "ask": 5.1}] * 2,
        day_pnl_pct=0.0,
        rolling_5d_pnl_pct=0.0,
        as_of=datetime.date(2026, 9, 25),
    )
    assert result.passed
