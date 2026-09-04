"""MCP client for Alpaca's official MCP server (alpacahq/alpaca-mcp-server).

Spawns `uvx alpaca-mcp-server` as a stdio subprocess and exposes:
  - read_only_tool_schemas(): the whitelisted, read-only tool subset,
    converted to Anthropic's `tools` request shape. This is what
    options_strategy.py hands to Claude - it never sees `place_option_order`
    or any other mutating tool, so Claude structurally cannot place an order
    from that step.
  - call_tool(name, args): generic passthrough, used both by the (read-only)
    Claude loop and by executor.py's direct (non-LLM) `place_option_order`
    call.

Toolset filtering on the server itself (ALPACA_TOOLSETS) additionally scopes
what the subprocess exposes at all; the whitelist here is the second,
independent boundary enforced in our own process.

Every await that talks to the subprocess is timeout-bounded (see config's
MCP_CONNECT_TIMEOUT_S/MCP_CALL_TIMEOUT_S). Observed live: the subprocess can
die silently mid-cycle - no crash logged, no OOM, just gone from `docker top`
- and without a timeout that leaves the calling code awaiting a response
that will never arrive, indefinitely, with nothing in the logs to explain
why. A single call_tool() timeout triggers one reconnect+retry so a dead
subprocess is recoverable mid-cycle rather than failing every remaining
ticker identically for the rest of the run.
"""

from __future__ import annotations

import asyncio
import json
from contextlib import AsyncExitStack
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

import config


class AlpacaMcpClient:
    def __init__(self) -> None:
        self._stack: AsyncExitStack | None = None
        self.session: ClientSession | None = None
        self._tools: list[Any] = []

    async def connect(self) -> None:
        params = StdioServerParameters(
            command="uvx",
            # Pinned, not just "alpaca-mcp-server": every connect() spawns a
            # fresh `uvx` resolution (this runs on every cycle, including
            # unattended scheduled ones), and an unpinned invocation silently
            # picks up whatever the vendor just published - which broke
            # outright when a newer fastmcp release removed
            # fastmcp.tools.tool.ToolResult that alpaca-mcp-server's install
            # depends on. 2.3.0 + fastmcp 3.4.7 is the last combination
            # confirmed working end-to-end (tool listing, real account
            # calls) against this account.
            args=["--with", "fastmcp==3.4.7", "alpaca-mcp-server==2.3.0"],
            env={
                "ALPACA_API_KEY": config.ALPACA_API_KEY,
                "ALPACA_SECRET_KEY": config.ALPACA_SECRET_KEY,
                "ALPACA_PAPER_TRADE": "true" if config.ALPACA_PAPER_TRADE else "false",
                "ALPACA_TOOLSETS": config.ALPACA_TOOLSETS,
            },
        )
        stack = AsyncExitStack()
        try:
            await asyncio.wait_for(
                self._do_connect(stack, params), timeout=config.MCP_CONNECT_TIMEOUT_S
            )
        except TimeoutError:
            await stack.aclose()
            raise TimeoutError(
                f"MCP connect timed out after {config.MCP_CONNECT_TIMEOUT_S}s - "
                "the alpaca-mcp-server subprocess may have failed to start"
            ) from None
        except Exception:
            await stack.aclose()
            raise
        self._stack = stack

    async def _do_connect(self, stack: AsyncExitStack, params: StdioServerParameters) -> None:
        read_stream, write_stream = await stack.enter_async_context(stdio_client(params))
        self.session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
        await self.session.initialize()
        result = await self.session.list_tools()
        self._tools = result.tools

    async def close(self) -> None:
        if self._stack is not None:
            await self._stack.aclose()
            self._stack = None
            self.session = None

    async def __aenter__(self) -> "AlpacaMcpClient":
        await self.connect()
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.close()

    def read_only_tool_schemas(self) -> list[dict[str, Any]]:
        whitelist = set(config.READ_ONLY_TOOL_WHITELIST)
        schemas = []
        for tool in self._tools:
            if tool.name not in whitelist:
                continue
            schemas.append(
                {
                    "name": tool.name,
                    "description": tool.description or "",
                    "input_schema": tool.input_schema,
                }
            )
        return schemas

    async def call_tool(self, name: str, args: dict[str, Any]) -> Any:
        assert self.session is not None, "call connect() first"
        try:
            return await self._call_tool_once(name, args)
        except TimeoutError:
            # One reconnect+retry: a dead subprocess otherwise poisons every
            # remaining call for the rest of the cycle in the exact same way.
            await self.close()
            await self.connect()
            return await self._call_tool_once(name, args)

    async def _call_tool_once(self, name: str, args: dict[str, Any]) -> Any:
        assert self.session is not None
        try:
            result = await asyncio.wait_for(
                self.session.call_tool(name, args), timeout=config.MCP_CALL_TIMEOUT_S
            )
        except TimeoutError:
            raise TimeoutError(
                f"MCP tool '{name}' timed out after {config.MCP_CALL_TIMEOUT_S}s - "
                "the alpaca-mcp-server subprocess may have died"
            ) from None

        texts = [block.text for block in result.content if getattr(block, "type", None) == "text"]
        raw = "\n".join(texts)

        if result.is_error:
            raise RuntimeError(f"MCP tool {name} returned an error: {raw}")

        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return raw
