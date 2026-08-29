use chrono::NaiveDate;
use sqlx::PgPool;
use tonic::{Request, Response, Status};
use uuid::Uuid;

use crate::pb::{
    db_server::Db, AccountSnapshot, CreateDecisionReply, CreateDecisionRequest, CreateTradeReply,
    CreateTradeRequest, Decision, GetLatestAccountSnapshotRequest, Leg, ListAccountSnapshotsReply,
    ListAccountSnapshotsRequest, ListDecisionsReply, ListDecisionsRequest, ListRiskGateEventsReply,
    ListRiskGateEventsRequest, ListTradesReply, ListTradesRequest, LogRiskGateEventReply,
    LogRiskGateEventRequest, RecordAccountSnapshotReply, RecordAccountSnapshotRequest,
    RiskGateEvent, Trade, UpdateTradeStatusReply, UpdateTradeStatusRequest,
};

pub struct DbService {
    pool: PgPool,
    secret: String,
}

impl DbService {
    pub fn new(pool: PgPool, secret: String) -> Self {
        Self { pool, secret }
    }

    // every call must carry x-backend-secret - this service is private-network only
    // tonic::Status is the required error type for every RPC handler's `?` to
    // propagate through - boxing it would ripple into tonic's generated trait
    // signatures, not just this helper.
    #[allow(clippy::result_large_err)]
    fn authorize<T>(&self, req: &Request<T>) -> Result<(), Status> {
        let got = req
            .metadata()
            .get("x-backend-secret")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if constant_time_eq(got.as_bytes(), self.secret.as_bytes()) {
            Ok(())
        } else {
            Err(Status::unauthenticated("bad backend secret"))
        }
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[allow(clippy::result_large_err)]
fn parse_uuid(s: &str) -> Result<Uuid, Status> {
    Uuid::parse_str(s).map_err(|_| Status::invalid_argument("expected uuid"))
}

#[allow(clippy::result_large_err)]
fn parse_date(s: &str) -> Result<NaiveDate, Status> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map_err(|_| Status::invalid_argument(format!("expected YYYY-MM-DD, got {s:?}")))
}

fn db_err(e: sqlx::Error) -> Status {
    tracing::warn!("db error: {e}");
    Status::internal("database error")
}

fn legs_to_json(legs: &[Leg]) -> serde_json::Value {
    serde_json::Value::Array(
        legs.iter()
            .map(|l| {
                serde_json::json!({
                    "side": l.side,
                    "right": l.right,
                    "strike": l.strike,
                    "expiry": l.expiry,
                    "symbol": l.symbol,
                    "ratio_qty": l.ratio_qty,
                })
            })
            .collect(),
    )
}

fn json_to_legs(v: serde_json::Value) -> Vec<Leg> {
    v.as_array()
        .map(|arr| {
            arr.iter()
                .map(|l| Leg {
                    side: l["side"].as_str().unwrap_or_default().to_string(),
                    right: l["right"].as_str().unwrap_or_default().to_string(),
                    strike: l["strike"].as_f64().unwrap_or_default(),
                    expiry: l["expiry"].as_str().unwrap_or_default().to_string(),
                    symbol: l["symbol"].as_str().unwrap_or_default().to_string(),
                    ratio_qty: l["ratio_qty"].as_i64().unwrap_or_default() as i32,
                })
                .collect()
        })
        .unwrap_or_default()
}

#[derive(sqlx::FromRow)]
struct DecisionRow {
    id: Uuid,
    ticker: String,
    run_date: NaiveDate,
    direction: String,
    confidence: Option<f32>,
    summary: String,
    full_report: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

fn decision_from_row(r: DecisionRow) -> Decision {
    Decision {
        id: r.id.to_string(),
        ticker: r.ticker,
        run_date: r.run_date.format("%Y-%m-%d").to_string(),
        direction: r.direction,
        confidence: r.confidence.unwrap_or_default(),
        summary: r.summary,
        full_report: r.full_report.unwrap_or_default(),
        created_at: r.created_at.to_rfc3339(),
    }
}

#[derive(sqlx::FromRow)]
struct TradeRow {
    id: Uuid,
    decision_id: Option<Uuid>,
    ticker: String,
    strategy: String,
    legs: serde_json::Value,
    expiry: NaiveDate,
    quantity: i32,
    credit_debit: String,
    net_premium: f64,
    max_profit: f64,
    max_loss: f64,
    status: String,
    alpaca_order_id: Option<String>,
    realized_pnl: Option<f64>,
    rationale: Option<String>,
    opened_at: Option<chrono::DateTime<chrono::Utc>>,
    closed_at: Option<chrono::DateTime<chrono::Utc>>,
    created_at: chrono::DateTime<chrono::Utc>,
}

fn trade_from_row(r: TradeRow) -> Trade {
    Trade {
        id: r.id.to_string(),
        decision_id: r.decision_id.map(|u| u.to_string()).unwrap_or_default(),
        ticker: r.ticker,
        strategy: r.strategy,
        legs: json_to_legs(r.legs),
        expiry: r.expiry.format("%Y-%m-%d").to_string(),
        quantity: r.quantity,
        credit_debit: r.credit_debit,
        net_premium: r.net_premium,
        max_profit: r.max_profit,
        max_loss: r.max_loss,
        status: r.status,
        alpaca_order_id: r.alpaca_order_id.unwrap_or_default(),
        realized_pnl: r.realized_pnl.unwrap_or_default(),
        rationale: r.rationale.unwrap_or_default(),
        opened_at: r.opened_at.map(|t| t.to_rfc3339()).unwrap_or_default(),
        closed_at: r.closed_at.map(|t| t.to_rfc3339()).unwrap_or_default(),
        created_at: r.created_at.to_rfc3339(),
    }
}

#[derive(sqlx::FromRow)]
struct RiskGateEventRow {
    id: Uuid,
    trade_id: Option<Uuid>,
    gate_name: String,
    passed: bool,
    reason: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

fn risk_gate_event_from_row(r: RiskGateEventRow) -> RiskGateEvent {
    RiskGateEvent {
        id: r.id.to_string(),
        trade_id: r.trade_id.map(|u| u.to_string()).unwrap_or_default(),
        gate_name: r.gate_name,
        passed: r.passed,
        reason: r.reason,
        created_at: r.created_at.to_rfc3339(),
    }
}

#[derive(sqlx::FromRow)]
struct SnapshotRow {
    id: Uuid,
    equity: f64,
    cash: f64,
    buying_power: f64,
    options_buying_power: Option<f64>,
    day_pnl: Option<f64>,
    open_positions_count: i32,
    created_at: chrono::DateTime<chrono::Utc>,
}

fn snapshot_from_row(r: SnapshotRow) -> AccountSnapshot {
    AccountSnapshot {
        id: r.id.to_string(),
        equity: r.equity,
        cash: r.cash,
        buying_power: r.buying_power,
        options_buying_power: r.options_buying_power.unwrap_or_default(),
        day_pnl: r.day_pnl.unwrap_or_default(),
        open_positions_count: r.open_positions_count,
        created_at: r.created_at.to_rfc3339(),
    }
}

#[tonic::async_trait]
impl Db for DbService {
    async fn create_decision(
        &self,
        req: Request<CreateDecisionRequest>,
    ) -> Result<Response<CreateDecisionReply>, Status> {
        self.authorize(&req)?;
        let r = req.into_inner();
        let run_date = parse_date(&r.run_date)?;
        let row: (Uuid,) = sqlx::query_as(
            "INSERT INTO decisions (ticker, run_date, direction, confidence, summary, full_report)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (ticker, run_date) DO UPDATE SET
                direction = EXCLUDED.direction, confidence = EXCLUDED.confidence,
                summary = EXCLUDED.summary, full_report = EXCLUDED.full_report
             RETURNING id",
        )
        .bind(&r.ticker)
        .bind(run_date)
        .bind(&r.direction)
        .bind(r.confidence)
        .bind(&r.summary)
        .bind(&r.full_report)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(Response::new(CreateDecisionReply {
            id: row.0.to_string(),
        }))
    }

    async fn list_decisions(
        &self,
        req: Request<ListDecisionsRequest>,
    ) -> Result<Response<ListDecisionsReply>, Status> {
        self.authorize(&req)?;
        let limit = clamp_limit(req.into_inner().limit);
        let rows: Vec<DecisionRow> = sqlx::query_as(
            "SELECT id, ticker, run_date, direction, confidence, summary, full_report, created_at
             FROM decisions ORDER BY created_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(Response::new(ListDecisionsReply {
            decisions: rows.into_iter().map(decision_from_row).collect(),
        }))
    }

    async fn create_trade(
        &self,
        req: Request<CreateTradeRequest>,
    ) -> Result<Response<CreateTradeReply>, Status> {
        self.authorize(&req)?;
        let r = req.into_inner();
        let decision_id = if r.decision_id.is_empty() {
            None
        } else {
            Some(parse_uuid(&r.decision_id)?)
        };
        let expiry = parse_date(&r.expiry)?;
        let legs = legs_to_json(&r.legs);
        let row: (Uuid,) = sqlx::query_as(
            "INSERT INTO trades (decision_id, ticker, strategy, legs, expiry, quantity,
                credit_debit, net_premium, max_profit, max_loss, rationale)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id",
        )
        .bind(decision_id)
        .bind(&r.ticker)
        .bind(&r.strategy)
        .bind(legs)
        .bind(expiry)
        .bind(r.quantity)
        .bind(&r.credit_debit)
        .bind(r.net_premium)
        .bind(r.max_profit)
        .bind(r.max_loss)
        .bind(&r.rationale)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(Response::new(CreateTradeReply {
            id: row.0.to_string(),
        }))
    }

    async fn update_trade_status(
        &self,
        req: Request<UpdateTradeStatusRequest>,
    ) -> Result<Response<UpdateTradeStatusReply>, Status> {
        self.authorize(&req)?;
        let r = req.into_inner();
        let id = parse_uuid(&r.id)?;
        let alpaca_order_id = (!r.alpaca_order_id.is_empty()).then_some(r.alpaca_order_id);
        sqlx::query(
            "UPDATE trades SET status = $2, alpaca_order_id = COALESCE($3, alpaca_order_id),
                realized_pnl = $4,
                opened_at = CASE WHEN $2 = 'open' AND opened_at IS NULL THEN now() ELSE opened_at END,
                closed_at = CASE WHEN $2 = 'closed' AND closed_at IS NULL THEN now() ELSE closed_at END
             WHERE id = $1",
        )
        .bind(id)
        .bind(&r.status)
        .bind(alpaca_order_id)
        .bind(r.realized_pnl)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(Response::new(UpdateTradeStatusReply { ok: true }))
    }

    async fn list_trades(
        &self,
        req: Request<ListTradesRequest>,
    ) -> Result<Response<ListTradesReply>, Status> {
        self.authorize(&req)?;
        let r = req.into_inner();
        let limit = clamp_limit(r.limit);
        let rows: Vec<TradeRow> = if r.status.is_empty() {
            sqlx::query_as(
                "SELECT id, decision_id, ticker, strategy, legs, expiry, quantity, credit_debit,
                    net_premium::float8, max_profit::float8, max_loss::float8, status,
                    alpaca_order_id, realized_pnl::float8, rationale, opened_at, closed_at, created_at
                 FROM trades ORDER BY created_at DESC LIMIT $1",
            )
            .bind(limit)
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?
        } else {
            sqlx::query_as(
                "SELECT id, decision_id, ticker, strategy, legs, expiry, quantity, credit_debit,
                    net_premium::float8, max_profit::float8, max_loss::float8, status,
                    alpaca_order_id, realized_pnl::float8, rationale, opened_at, closed_at, created_at
                 FROM trades WHERE status = $2 ORDER BY created_at DESC LIMIT $1",
            )
            .bind(limit)
            .bind(&r.status)
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?
        };
        Ok(Response::new(ListTradesReply {
            trades: rows.into_iter().map(trade_from_row).collect(),
        }))
    }

    async fn log_risk_gate_event(
        &self,
        req: Request<LogRiskGateEventRequest>,
    ) -> Result<Response<LogRiskGateEventReply>, Status> {
        self.authorize(&req)?;
        let r = req.into_inner();
        let trade_id = if r.trade_id.is_empty() {
            None
        } else {
            Some(parse_uuid(&r.trade_id)?)
        };
        let row: (Uuid,) = sqlx::query_as(
            "INSERT INTO risk_gate_events (trade_id, gate_name, passed, reason)
             VALUES ($1, $2, $3, $4) RETURNING id",
        )
        .bind(trade_id)
        .bind(&r.gate_name)
        .bind(r.passed)
        .bind(&r.reason)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(Response::new(LogRiskGateEventReply {
            id: row.0.to_string(),
        }))
    }

    async fn list_risk_gate_events(
        &self,
        req: Request<ListRiskGateEventsRequest>,
    ) -> Result<Response<ListRiskGateEventsReply>, Status> {
        self.authorize(&req)?;
        let limit = clamp_limit(req.into_inner().limit);
        let rows: Vec<RiskGateEventRow> = sqlx::query_as(
            "SELECT id, trade_id, gate_name, passed, reason, created_at
             FROM risk_gate_events ORDER BY created_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(Response::new(ListRiskGateEventsReply {
            events: rows.into_iter().map(risk_gate_event_from_row).collect(),
        }))
    }

    async fn record_account_snapshot(
        &self,
        req: Request<RecordAccountSnapshotRequest>,
    ) -> Result<Response<RecordAccountSnapshotReply>, Status> {
        self.authorize(&req)?;
        let r = req.into_inner();
        let row: (Uuid,) = sqlx::query_as(
            "INSERT INTO account_snapshots (equity, cash, buying_power, options_buying_power,
                day_pnl, open_positions_count)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        )
        .bind(r.equity)
        .bind(r.cash)
        .bind(r.buying_power)
        .bind(r.options_buying_power)
        .bind(r.day_pnl)
        .bind(r.open_positions_count)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(Response::new(RecordAccountSnapshotReply {
            id: row.0.to_string(),
        }))
    }

    async fn get_latest_account_snapshot(
        &self,
        req: Request<GetLatestAccountSnapshotRequest>,
    ) -> Result<Response<AccountSnapshot>, Status> {
        self.authorize(&req)?;
        let row: Option<SnapshotRow> = sqlx::query_as(
            "SELECT id, equity::float8, cash::float8, buying_power::float8,
                options_buying_power::float8, day_pnl::float8, open_positions_count, created_at
             FROM account_snapshots ORDER BY created_at DESC LIMIT 1",
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)?;
        match row {
            Some(r) => Ok(Response::new(snapshot_from_row(r))),
            None => Err(Status::not_found("no account snapshots yet")),
        }
    }

    async fn list_account_snapshots(
        &self,
        req: Request<ListAccountSnapshotsRequest>,
    ) -> Result<Response<ListAccountSnapshotsReply>, Status> {
        self.authorize(&req)?;
        let limit = clamp_limit(req.into_inner().limit);
        let rows: Vec<SnapshotRow> = sqlx::query_as(
            "SELECT id, equity::float8, cash::float8, buying_power::float8,
                options_buying_power::float8, day_pnl::float8, open_positions_count, created_at
             FROM account_snapshots ORDER BY created_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(Response::new(ListAccountSnapshotsReply {
            snapshots: rows.into_iter().map(snapshot_from_row).collect(),
        }))
    }
}

fn clamp_limit(limit: i32) -> i64 {
    if limit <= 0 {
        50
    } else {
        limit.clamp(1, 500) as i64
    }
}
