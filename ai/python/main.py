"""FastAPI wrapper around the trading brain (Phase 2). Owns nothing about
trading logic itself - cycle.py does the work, this just exposes it over
HTTP for the Go `ai` service to proxy, and starts the autonomous scheduler.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

import config
import cycle
import scheduler as scheduler_module
from models import CycleResult

logging.basicConfig(level=logging.INFO)

_last_cycle: CycleResult | None = None
_lock = asyncio.Lock()


async def _run_cycle(tickers: list[str] | None) -> None:
    global _last_cycle
    async with _lock:
        result = await cycle.run(tickers)
        _last_cycle = result


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler_module.start()
    yield


app = FastAPI(title="alpaca-agent trading brain", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/run-cycle")
async def run_cycle(body: dict | None = None):
    tickers = (body or {}).get("tickers") or None
    if _lock.locked():
        return {"cycle_id": "", "status": "already_running"}
    asyncio.create_task(_run_cycle(tickers))
    watchlist_label = tickers or config.WATCHLIST_OVERRIDE or "dynamic-screener"
    return {"cycle_id": "", "status": "running", "watchlist": watchlist_label}


@app.get("/last-cycle")
def last_cycle():
    if _last_cycle is None:
        return {
            "cycle_id": "",
            "started_at": "",
            "finished_at": "",
            "tickers_evaluated": 0,
            "trades_proposed": 0,
            "trades_placed": 0,
            "trades_blocked": 0,
            "positions_closed": 0,
            "errors": [],
            "status": "idle",
        }
    return {
        "cycle_id": _last_cycle.cycle_id,
        "started_at": _last_cycle.started_at,
        "finished_at": _last_cycle.finished_at,
        "tickers_evaluated": _last_cycle.tickers_evaluated,
        "trades_proposed": _last_cycle.trades_proposed,
        "trades_placed": _last_cycle.trades_placed,
        "trades_blocked": _last_cycle.trades_blocked,
        "positions_closed": _last_cycle.positions_closed,
        "errors": _last_cycle.errors,
        "status": _last_cycle.status,
    }
