# Options Alpha Agents

Build an autonomous AI trading agent that generates P&L using Alpaca's paper trading platform. The agent runs a fully autonomous signal → structure → gate → execute → manage pipeline on Alpaca's Trading API, MCP server, and CLI — all in the paper trading environment with a $100,000 starting balance.

## Quickstart

```bash
# Clone and configure
cp .env.example .env
# set ALPACA_API_KEY, ALPACA_SECRET_KEY, CF_ACCOUNT_ID, CF_API_TOKEN

# Run the full stack (dev)
docker compose up -d          # postgres + redis
bun run dev:api               # Go GraphQL API :8000
cargo run --manifest-path db/Cargo.toml &   # Rust gatekeeper :8010
bun run dev:realtime          # Gleam events :8001
bun run dev:ai                # Python AI + gRPC bridge
bun run dev:ui                # Next.js dashboard :3000

# Or run the trading cycle directly
bun run --workspace ai -- python -m ai.python.main
```

## The Agent Pipeline

1. **Signal** — `TradingAgents` (LangGraph multi-agent debate) generates BUY/SELL/HOLD per ticker from the most-active/gainers screener (optionable names only).
2. **Structure** — Claude (Cloudflare Workers AI) structures the trade using the live option chain via Alpaca MCP: strategy, legs, strikes, expiries, max profit/loss.
3. **Gates** — 12 deterministic risk gates (defined-risk-only, max loss, aggregate risk, DTE bounds, liquidity, buying power, circuit breakers, kill switch) must all pass before execution.
4. **Execute** — `place_option_order` is called via Alpaca MCP stdio (write tools are never exposed to the LLM).
5. **Manage** — Open positions auto-close at +100% take-profit, −50% stop-loss, or ≤3 DTE to expiry.

## Risk Gates

| Gate                           | Threshold                   |
| ------------------------------ | --------------------------- |
| `defined_risk_only`            | No naked shorts             |
| `max_loss_per_trade`           | ≤ 8% of equity              |
| `max_aggregate_risk`           | ≤ 35% aggregate             |
| `max_concurrent_positions`     | ≤ 10                        |
| `max_positions_per_underlying` | ≤ 2 per ticker              |
| `dte_bounds`                   | 3–30 DTE                    |
| `liquidity_floor`              | Min OI; spread ≤ 5% of mid  |
| `max_contracts_per_leg`        | ≤ 50/leg                    |
| `buying_power`                 | ≤ 20% of options BP         |
| `daily_circuit_breaker`        | Day P&L > −3%               |
| `rolling_5d_circuit_breaker`   | 5-day P&L > −6%             |
| `kill_switch`                  | Drawdown < −15% halts agent |

## Stack

| Layer    | Tech                                            |
| -------- | ----------------------------------------------- |
| Frontend | Next.js 16 + Tailwind 4 dashboard               |
| API      | Go (chi + gqlgen) GraphQL :8000                 |
| DB       | Rust (tonic + SQLx) Postgres :8010              |
| Realtime | Gleam + Redis pub/sub :8001                     |
| AI       | Python (FastAPI) + Cloudflare Workers AI        |
| Trading  | Alpaca MCP server (stdio) + paper trading       |
| Deploy   | Docker compose · AWS (EC2 + Caddy) · Cloudflare |

## Hackathon Requirements

- ✅ Autonomous agents — TradingAgents multi-agent debate + autonomous daily cycle
- ✅ MCP — Alpaca MCP server via stdio (read-only whitelist + guarded write tools)
- ✅ Options trading — long calls/puts, spreads, condors, all options-based
- ✅ Paper trading — `ALPACA_PAPER_TRADE=true`, $100,000 starting balance

## Docs

- `WRITEUP.md` — one-page write-up covering AI logic, risk gates, and Alpaca infrastructure
- `DEPLOY.md` — deployment instructions (AWS + Cloudflare)
- `ui/` — Next.js dashboard (live positions, trades, risk gate events, account snapshots)
