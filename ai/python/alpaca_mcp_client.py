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
"""

from __future__ import annotations

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
            args=["alpaca-mcp-server"],
            env={
                "ALPACA_API_KEY": config.ALPACA_API_KEY,
                "ALPACA_SECRET_KEY": config.ALPACA_SECRET_KEY,
                "ALPACA_PAPER_TRADE": "true" if config.ALPACA_PAPER_TRADE else "false",
                "ALPACA_TOOLSETS": config.ALPACA_TOOLSETS,
            },
        )
        self._stack = AsyncExitStack()
        read_stream, write_stream = await self._stack.enter_async_context(stdio_client(params))
        self.session = await self._stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )
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
        result = await self.session.call_tool(name, args)

        texts = [block.text for block in result.content if getattr(block, "type", None) == "text"]
        raw = "\n".join(texts)

        if result.is_error:
            raise RuntimeError(f"MCP tool {name} returned an error: {raw}")

        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return raw
