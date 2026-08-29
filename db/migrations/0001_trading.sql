CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE decisions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker      TEXT NOT NULL,
    run_date    DATE NOT NULL,
    direction   TEXT NOT NULL CHECK (direction IN ('BUY','SELL','HOLD')),
    confidence  REAL,
    summary     TEXT NOT NULL,
    full_report TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ticker, run_date)
);

CREATE TABLE trades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id     UUID REFERENCES decisions(id),
    ticker          TEXT NOT NULL,
    strategy        TEXT NOT NULL,          -- bull_put_spread | bear_call_spread | iron_condor | bull_call_spread | bear_put_spread
    legs            JSONB NOT NULL,         -- [{side, right, strike, expiry, symbol, ratio_qty}, ...]
    expiry          DATE NOT NULL,
    quantity        INT NOT NULL,
    credit_debit    TEXT NOT NULL CHECK (credit_debit IN ('credit','debit')),
    net_premium     NUMERIC(12,2) NOT NULL,
    max_profit      NUMERIC(12,2) NOT NULL,
    max_loss        NUMERIC(12,2) NOT NULL,
    status          TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed','open','closed','rejected','failed')),
    alpaca_order_id TEXT,
    realized_pnl    NUMERIC(12,2),
    rationale       TEXT,
    opened_at       TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trades_status_idx ON trades (status);

CREATE TABLE risk_gate_events (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id           UUID REFERENCES trades(id),
    gate_name          TEXT NOT NULL,
    passed             BOOLEAN NOT NULL,
    reason             TEXT NOT NULL,
    snapshot           JSONB,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX risk_gate_events_created_idx ON risk_gate_events (created_at DESC);

CREATE TABLE account_snapshots (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equity                NUMERIC(14,2) NOT NULL,
    cash                  NUMERIC(14,2) NOT NULL,
    buying_power          NUMERIC(14,2) NOT NULL,
    options_buying_power  NUMERIC(14,2),
    day_pnl               NUMERIC(14,2),
    open_positions_count  INT NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX account_snapshots_created_idx ON account_snapshots (created_at DESC);
