"""Python writes directly to the Rust `db` service over gRPC.

Rationale (see plan Phase 2): the scaffold's convention is "any caller with
the shared secret may call db" - round-tripping through ai (Go) -> api (Go)
-> db would require inventing a push channel that doesn't exist. Go's
RunCycle/GetLastCycleResult stay pure orchestration/status, not
persistence.
"""

from __future__ import annotations

import sys
from pathlib import Path

import grpc

sys.path.insert(0, str(Path(__file__).resolve().parent / "pb"))
import db_pb2  # noqa: E402
import db_pb2_grpc  # noqa: E402

import config
from models import GateOutcome, Leg, SignalResult, TradeProposal

_channel: grpc.Channel | None = None
_stub: db_pb2_grpc.DbStub | None = None


def _stub_instance() -> db_pb2_grpc.DbStub:
    global _channel, _stub
    if _stub is None:
        _channel = grpc.insecure_channel(config.DB_GRPC_ADDR)
        _stub = db_pb2_grpc.DbStub(_channel)
    return _stub


def _metadata():
    return (("x-backend-secret", config.BACKEND_SECRET),)


def _leg_to_pb(leg: Leg) -> db_pb2.Leg:
    return db_pb2.Leg(
        side=leg.side,
        right=leg.right,
        strike=leg.strike,
        expiry=leg.expiry,
        symbol=leg.symbol,
        ratio_qty=leg.ratio_qty,
    )


def create_decision(signal: SignalResult) -> str:
    reply = _stub_instance().CreateDecision(
        db_pb2.CreateDecisionRequest(
            ticker=signal.ticker,
            run_date=signal.run_date,
            direction=signal.direction,
            confidence=signal.confidence or 0.0,
            summary=signal.summary,
            full_report=signal.full_report,
        ),
        metadata=_metadata(),
    )
    return reply.id


def create_trade(decision_id: str, proposal: TradeProposal) -> str:
    reply = _stub_instance().CreateTrade(
        db_pb2.CreateTradeRequest(
            decision_id=decision_id,
            ticker=proposal.ticker,
            strategy=proposal.strategy,
            legs=[_leg_to_pb(leg) for leg in proposal.legs],
            expiry=proposal.expiry,
            quantity=proposal.quantity,
            credit_debit=proposal.credit_debit,
            net_premium=proposal.net_premium,
            max_profit=proposal.max_profit,
            max_loss=proposal.max_loss,
            rationale=proposal.rationale,
        ),
        metadata=_metadata(),
    )
    return reply.id


def update_trade_status(
    trade_id: str, status: str, alpaca_order_id: str = "", realized_pnl: float = 0.0
) -> None:
    _stub_instance().UpdateTradeStatus(
        db_pb2.UpdateTradeStatusRequest(
            id=trade_id, status=status, alpaca_order_id=alpaca_order_id, realized_pnl=realized_pnl
        ),
        metadata=_metadata(),
    )


def log_risk_gate_event(trade_id: str, outcome: GateOutcome) -> None:
    _stub_instance().LogRiskGateEvent(
        db_pb2.LogRiskGateEventRequest(
            trade_id=trade_id,
            gate_name=outcome.name,
            passed=outcome.passed,
            reason=outcome.reason,
        ),
        metadata=_metadata(),
    )


def list_trades(status: str = "", limit: int = 100) -> list:
    reply = _stub_instance().ListTrades(
        db_pb2.ListTradesRequest(status=status, limit=limit), metadata=_metadata()
    )
    return list(reply.trades)


def list_account_snapshots(limit: int = 5) -> list:
    reply = _stub_instance().ListAccountSnapshots(
        db_pb2.ListAccountSnapshotsRequest(limit=limit), metadata=_metadata()
    )
    return list(reply.snapshots)


def record_account_snapshot(
    *,
    equity: float,
    cash: float,
    buying_power: float,
    options_buying_power: float,
    day_pnl: float,
    open_positions_count: int,
) -> str:
    reply = _stub_instance().RecordAccountSnapshot(
        db_pb2.RecordAccountSnapshotRequest(
            equity=equity,
            cash=cash,
            buying_power=buying_power,
            options_buying_power=options_buying_power,
            day_pnl=day_pnl,
            open_positions_count=open_positions_count,
        ),
        metadata=_metadata(),
    )
    return reply.id
