"""Env-driven configuration for the trading agent.

Every risk-gate threshold is a named constant here so the numbers are
auditable in one place (this file is what the write-up's "risk gates"
section should be checked against).
"""

import os

from dotenv import load_dotenv

load_dotenv()


def _env(key: str, default: str | None = None) -> str:
    val = os.getenv(key, default)
    if val is None:
        raise RuntimeError(f"missing required env var: {key}")
    return val


def _env_bool(key: str, default: bool) -> bool:
    val = os.getenv(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def _env_float(key: str, default: float) -> float:
    val = os.getenv(key)
    return float(val) if val else default


def _env_int(key: str, default: int) -> int:
    val = os.getenv(key)
    return int(val) if val else default


# ---- credentials ----
ALPACA_API_KEY = os.getenv("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY", "")
ALPACA_PAPER_TRADE = _env_bool("ALPACA_PAPER_TRADE", True)

# ---- LLM: Cloudflare Workers AI (OpenAI-compatible endpoint) ----
# No Anthropic API key available - every LLM call in this project runs on
# Workers AI instead, using a dedicated Workers AI-scoped API token (not the
# earlier fragile wrangler OAuth session token, and not this account's first
# free-tier allocation, which we exhausted mid-testing - hence a fresh
# account + token here). Models confirmed (live test calls) to return proper
# tool_calls, which TradingAgents' analyst agents require internally.
CF_ACCOUNT_ID = os.getenv("CF_ACCOUNT_ID", "")
CF_API_TOKEN = os.getenv("CF_API_TOKEN", "")
CF_BASE_URL = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/v1"

# Groq kept as a documented alternative (tradingagents_client.py used
# llm_provider="groq" briefly) - its free tier's 8000 TPM account-wide cap
# is smaller than a single TradingAgents analyst call, so it's not viable
# without a paid Dev Tier upgrade. Unused by the current code.
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

DEEP_THINK_LLM = os.getenv("DEEP_THINK_LLM", "@cf/meta/llama-3.3-70b-instruct-fp8-fast")
QUICK_THINK_LLM = os.getenv("QUICK_THINK_LLM", "@cf/meta/llama-3.1-8b-instruct-fp8")
STRUCTURING_LLM = os.getenv("STRUCTURING_LLM", "@cf/meta/llama-3.3-70b-instruct-fp8-fast")

# ---- watchlist ----
# DEFAULT_WATCHLIST is only a fallback (screener.py's screen_candidates() use
# it when the live screener errors or turns up nothing) and the manual
# override path: setting WATCHLIST skips screener.py entirely for that run
# (useful for demos/debugging where a deterministic ticker list matters).
DEFAULT_WATCHLIST = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN"]
WATCHLIST_OVERRIDE = [t.strip().upper() for t in os.getenv("WATCHLIST", "").split(",") if t.strip()]
WATCHLIST = WATCHLIST_OVERRIDE or DEFAULT_WATCHLIST

# ---- dynamic ticker screener (cycle.py uses this instead of WATCHLIST
# unless WATCHLIST is explicitly set) ----
# TOP_MOVERS/TOP_ACTIVE only widen the *candidate pool* screener.py picks
# from - plain Alpaca market-data calls, zero LLM/neuron cost, so there's no
# reason to keep these small. MAX_TICKERS is a safety ceiling only, not a
# real target - cycle.py now stops itself the moment it actually hits
# Cloudflare's daily quota (see _is_quota_exhausted), so a normal day is
# bounded by real quota exhaustion, not this number.
SCREENER_TOP_MOVERS = _env_int("SCREENER_TOP_MOVERS", 25)
SCREENER_TOP_ACTIVE = _env_int("SCREENER_TOP_ACTIVE", 25)
SCREENER_MAX_TICKERS = _env_int("SCREENER_MAX_TICKERS", 20)

# ---- persistence / plumbing (Phase 2+, unused by scripts/run_once.py) ----
DB_GRPC_ADDR = os.getenv("DB_GRPC_ADDR", "localhost:8010")
BACKEND_SECRET = os.getenv("BACKEND_SECRET", "change-me")

# ---- risk gates (numeric, $100k account) ----
# "Higher risk" tier (user-confirmed): tuned for return-maximization via long
# calls/puts on high-conviction signals rather than the old credit-spread-
# family's capped-upside design. These are hard ceilings enforced in code
# (risk_gates.py) - the LLM decides how much of each budget to actually use
# per trade (see options_strategy.py's risk-budget disclosure), but can never
# exceed them regardless of its own reasoning.
#
# 1. Defined-risk only is enforced structurally in options_strategy.py /
#    risk_gates.py (every leg must have a matching offsetting leg, OR be a
#    buy-only long call/put whose max loss is the premium paid) - no
#    separate numeric constant.
MAX_LOSS_PCT_OF_EQUITY_PER_TRADE = _env_float("MAX_LOSS_PCT_OF_EQUITY_PER_TRADE", 0.08)  # 2
MAX_AGGREGATE_RISK_PCT_OF_EQUITY = _env_float("MAX_AGGREGATE_RISK_PCT_OF_EQUITY", 0.35)  # 3
MAX_CONCURRENT_OPEN_POSITIONS = _env_int("MAX_CONCURRENT_OPEN_POSITIONS", 10)  # 4
MAX_CONCURRENT_POSITIONS_PER_UNDERLYING = _env_int(
    "MAX_CONCURRENT_POSITIONS_PER_UNDERLYING", 2
)  # 5
MIN_DTE = _env_int("MIN_DTE", 5)  # 6
MAX_DTE = _env_int("MAX_DTE", 30)  # 6
TARGET_DTE_LOW = _env_int("TARGET_DTE_LOW", 7)
TARGET_DTE_HIGH = _env_int("TARGET_DTE_HIGH", 21)
# 7. quality gates, not risk-appetite ones - left unchanged from the
#    conservative tier (loosening these buys worse fills, not more return).
MIN_OPEN_INTEREST = _env_int("MIN_OPEN_INTEREST", 100)
MAX_BID_ASK_SPREAD_PCT_OF_MID = _env_float("MAX_BID_ASK_SPREAD_PCT_OF_MID", 0.15)
MAX_CONTRACTS_PER_LEG = _env_int("MAX_CONTRACTS_PER_LEG", 20)  # 8
MAX_TRADE_PCT_OF_OPTIONS_BUYING_POWER = _env_float(
    "MAX_TRADE_PCT_OF_OPTIONS_BUYING_POWER", 0.50
)  # 9
MAX_BUYING_POWER_UTILIZATION_AFTER_TRADE = _env_float(
    "MAX_BUYING_POWER_UTILIZATION_AFTER_TRADE", 0.95
)  # 9
# Circuit breakers matter *more*, not less, at higher per-trade sizing - left
# unchanged from the conservative tier, they're the actual backstop against
# total ruin.
DAILY_LOSS_CIRCUIT_BREAKER_PCT = _env_float("DAILY_LOSS_CIRCUIT_BREAKER_PCT", -0.03)  # 10
ROLLING_5D_LOSS_CIRCUIT_BREAKER_PCT = _env_float("ROLLING_5D_LOSS_CIRCUIT_BREAKER_PCT", -0.06)  # 11
KILL_SWITCH_DRAWDOWN_PCT = _env_float("KILL_SWITCH_DRAWDOWN_PCT", -0.15)  # 12
STARTING_EQUITY = _env_float("STARTING_EQUITY", 100_000.0)

# ---- position management (exit rules - previously nothing ever closed a
# position once opened) ----
TAKE_PROFIT_PCT = _env_float("TAKE_PROFIT_PCT", 1.00)  # close at +100% unrealized
STOP_LOSS_PCT = _env_float("STOP_LOSS_PCT", -0.50)  # close at -50% unrealized
MIN_DTE_BEFORE_FORCE_CLOSE = _env_int("MIN_DTE_BEFORE_FORCE_CLOSE", 3)

# ---- MCP ----
ALPACA_TOOLSETS = "account,trading,assets,options-data,stock-data"
READ_ONLY_TOOL_WHITELIST = [
    "get_account_info",
    "get_option_chain",
    "get_option_contracts",
    "get_option_snapshot",
    "get_all_positions",
    "get_clock",
    "get_asset",
]
