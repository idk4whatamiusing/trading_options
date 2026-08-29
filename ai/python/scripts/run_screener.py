"""Diagnostic CLI for the dynamic ticker screener: prints today's picks
without running a full cycle.

  uv run python scripts/run_screener.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from alpaca_mcp_client import AlpacaMcpClient  # noqa: E402
from screener import screen_candidates  # noqa: E402


async def main() -> None:
    async with AlpacaMcpClient() as mcp:
        picks = await screen_candidates(mcp)
    print(picks)


if __name__ == "__main__":
    asyncio.run(main())
