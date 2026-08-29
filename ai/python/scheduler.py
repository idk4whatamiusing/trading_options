"""Autonomous scheduling: fires cycle.run() once/day near market open with
no external cron dependency. Checks Alpaca's real market clock first and
skips on closed days/holidays rather than trusting a fixed weekday cron.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import cycle
from alpaca_mcp_client import AlpacaMcpClient

logger = logging.getLogger("scheduler")


async def _scheduled_run() -> None:
    async with AlpacaMcpClient() as mcp:
        clock = await mcp.call_tool("get_clock", {})
        is_open = clock.get("data", {}).get("is_open") if isinstance(clock, dict) else None
    if not is_open:
        logger.info("market closed - skipping scheduled cycle")
        return
    result = await cycle.run()
    logger.info(
        "scheduled cycle %s: %d evaluated, %d placed, %d blocked, status=%s",
        result.cycle_id,
        result.tickers_evaluated,
        result.trades_placed,
        result.trades_blocked,
        result.status,
    )


def start() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="America/New_York")
    scheduler.add_job(
        _scheduled_run,
        CronTrigger(day_of_week="mon-fri", hour=9, minute=35, timezone="America/New_York"),
        id="daily_cycle",
    )
    scheduler.start()
    logger.info("scheduler started: daily cycle at 09:35 America/New_York, mon-fri")
    return scheduler
