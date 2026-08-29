"""Thin wrapper around TauricResearch/TradingAgents.

Treated as a black box: it decides whether we should be bullish or bearish
on a ticker. It knows nothing about options or Alpaca. Call at most once per
(ticker, date) - it runs a multi-agent LangGraph debate that makes many LLM
calls per invocation.

TradingAgents' Portfolio Manager returns one of a 5-tier rating: Buy,
Overweight, Hold, Underweight, Sell (see
tradingagents/agents/utils/rating.py::parse_rating). We collapse that to a
BUY/SELL/HOLD direction plus a confidence, so the rest of the pipeline
(options structuring, risk gates) only has to reason about three outcomes.
"""

from __future__ import annotations

import os

import strict_openai_compat_patch  # noqa: F401 - side effect: langchain_openai request-format shim

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph

import config
from models import SignalResult

_RATING_TO_DIRECTION = {
    "buy": ("BUY", 1.0),
    "overweight": ("BUY", 0.5),
    "hold": ("HOLD", 0.0),
    "underweight": ("SELL", 0.5),
    "sell": ("SELL", 1.0),
}


def run_signal(ticker: str, date_str: str) -> SignalResult:
    # TradingAgents' openai_compatible client reads its key from this env var
    # (tradingagents/llm_clients/api_key_env.py) - set it from our own config
    # so callers only have to manage CF_API_TOKEN.
    os.environ.setdefault("OPENAI_COMPATIBLE_API_KEY", config.CF_API_TOKEN)

    ta_config = {
        **DEFAULT_CONFIG,
        "llm_provider": "openai_compatible",
        "backend_url": config.CF_BASE_URL,
        "deep_think_llm": config.DEEP_THINK_LLM,
        "quick_think_llm": config.QUICK_THINK_LLM,
        "max_debate_rounds": 1,
        "llm_max_retries": 4,
    }
    graph = TradingAgentsGraph(debug=False, config=ta_config)
    state, rating = graph.propagate(ticker, date_str)

    rating = (rating or "Hold").strip()
    direction, confidence = _RATING_TO_DIRECTION.get(rating.lower(), ("HOLD", 0.0))

    full_report = ""
    if isinstance(state, dict):
        full_report = state.get("final_trade_decision") or ""

    summary = full_report.strip()[:500] if full_report else f"{rating} (no report text returned)"

    return SignalResult(
        ticker=ticker,
        run_date=date_str,
        direction=direction,
        rating=rating,
        confidence=confidence,
        summary=summary,
        full_report=full_report or rating,
    )
