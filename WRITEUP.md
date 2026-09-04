# Options Alpha Agents — One-Page Write-Up

## AI Logic

The agent is a fully autonomous pipeline: **signal → structure → gate → execute → manage**, running daily at 9:35 AM ET (America/New_York) via APScheduler and triggerable on demand via `POST /run-cycle`.

**Signal layer** uses `TauricResearch/TradingAgents` — a multi-agent LangGraph debate that evaluates each ticker and collapses a 5-tier rating into a BUY / SELL / HOLD decision. HOLD skips structuring; BUY/SELL proceeds to the LLM structuring step.

**Structure layer** passes the signal to Claude (Cloudflare Workers AI), which fetches the live option chain through the Alpaca MCP server and proposes a `TradeProposal`: strategy type, legs (side, right, strike, expiry, ratio_qty), quantity, credit/debit, and max profit/loss. Strategies supported: long call, long put, bull/bear put and call spreads, iron condor.

**Manage layer** runs at the top of every cycle: open positions are auto-closed at **+100% take-profit**, **−50% stop-loss**, or **≤3 DTE** to expiry.

## Risk Gates

Twelve deterministic, code-enforced gates sit between Claude's proposal and execution — `executor.py` refuses to run unless all pass. No LLM, no network call beyond what's supplied:

| #   | Gate                           | Threshold                                                      |
| --- | ------------------------------ | -------------------------------------------------------------- |
| 1   | `defined_risk_only`            | Every short leg needs an offsetting long leg (no naked shorts) |
| 2   | `max_loss_per_trade`           | ≤ 8% of equity (~$8K on $100K)                                 |
| 3   | `max_aggregate_risk`           | Open risk + new ≤ 35% of equity (~$35K)                        |
| 4   | `max_concurrent_positions`     | ≤ 10 open positions                                            |
| 5   | `max_positions_per_underlying` | ≤ 2 per ticker                                                 |
| 6   | `dte_bounds`                   | Expiry within [3, 30] days                                     |
| 7   | `liquidity_floor`              | Min open interest; bid-ask spread ≤ 5% of mid                  |
| 8   | `max_contracts_per_leg`        | ≤ 50 contracts per leg                                         |
| 9   | `buying_power`                 | ≤ 20% of options buying power; ≤ 80% utilization after         |
| 10  | `daily_circuit_breaker`        | Day P&L > −3%                                                  |
| 11  | `rolling_5d_circuit_breaker`   | 5-day P&L > −6%                                                |
| 12  | `kill_switch`                  | Total drawdown < −15% from $100K halts the agent permanently   |

Every gate outcome (pass or fail) is written to the `risk_gate_events` table for a full audit trail. Circuit breakers 10–12 stop new trades entirely; the kill switch halts the agent until manually reset.

## Alpaca Infrastructure

**MCP transport (stdio):** `alpaca_mcp_client.py` spawns `uvx alpaca-mcp-server` as a stdio subprocess using the Python `mcp` SDK. A read-only tool whitelist (`get_account_info`, `get_option_chain`, `get_option_contracts`, `get_option_snapshot`, `get_all_positions`, `get_clock`, `get_asset`) is exposed to the LLM. Write tools (`place_option_order`, `close_position`) are **never** exposed — they are called only by `executor.py` and `position_manager.py` after deterministic gates pass. `ALPACA_PAPER_TRADE=true` is hardcoded in the MCP subprocess env.

**LLM backend:** Cloudflare Workers AI powers both the TradingAgents signal debate and the options-structuring prompt. A strict-OpenAI-compat monkeypatch handles Workers AI's non-standard content-block format.

**Full stack:** Go (chi + gqlgen) GraphQL API :8000 → Rust tonic + Postgres gatekeeper :8010 (persistence via gRPC, 4 tables: decisions, trades, risk_gate_events, account_snapshots) → Gleam realtime :8001 (SSE/WS fanout via Redis pub/sub) → Next.js dashboard. Docker compose (Postgres + Redis) for dev; deploy to AWS (EC2 + Caddy + sslip.io) or Cloudflare static export. GitHub Actions CI/CD on push to main. Auth via Google OAuth + dev login. Account starting balance is fixed at **$100,000** paper trading.
