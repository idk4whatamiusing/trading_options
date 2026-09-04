"""Unit tests for AlpacaMcpClient's timeout + reconnect-once-and-retry
handling. The real failure mode this covers happened live: the
alpaca-mcp-server subprocess died mid-cycle with no crash/error logged, and
without a timeout the calling code was left awaiting a response that would
never arrive - no error, no retry, nothing in the logs. These tests fake out
the mcp session (no real subprocess/transport involved) to verify a hung
call turns into a bounded, catchable error instead of an indefinite hang.
"""

from __future__ import annotations

import asyncio
import json

import pytest
from alpaca_mcp_client import AlpacaMcpClient


class FakeContent:
    def __init__(self, text: str) -> None:
        self.type = "text"
        self.text = text


class FakeToolResult:
    def __init__(self, payload: dict, *, is_error: bool = False) -> None:
        self.content = [FakeContent(json.dumps(payload))]
        self.is_error = is_error


class FakeSession:
    """call_tool sleeps `delay` seconds before returning `payload` - long
    enough to blow past a short test timeout when delay > timeout."""

    def __init__(self, *, delay: float = 0.0, payload: dict | None = None) -> None:
        self.delay = delay
        self.payload = payload or {"ok": True}
        self.calls = 0

    async def call_tool(self, name: str, args: dict) -> FakeToolResult:
        self.calls += 1
        await asyncio.sleep(self.delay)
        return FakeToolResult(self.payload)


def _client_with_session(session: FakeSession) -> AlpacaMcpClient:
    client = AlpacaMcpClient()
    client.session = session
    return client


@pytest.mark.asyncio
async def test_call_tool_returns_parsed_result_without_timeout(monkeypatch):
    monkeypatch.setattr("config.MCP_CALL_TIMEOUT_S", 1.0)
    session = FakeSession(payload={"equity": 100000})
    client = _client_with_session(session)

    result = await client.call_tool("get_account_info", {})

    assert result == {"equity": 100000}
    assert session.calls == 1


@pytest.mark.asyncio
async def test_call_tool_reconnects_and_retries_once_on_timeout(monkeypatch):
    monkeypatch.setattr("config.MCP_CALL_TIMEOUT_S", 0.05)
    hung_session = FakeSession(delay=1.0)
    healthy_session = FakeSession(payload={"recovered": True})
    client = _client_with_session(hung_session)

    reconnects = {"connect": 0, "close": 0}

    async def fake_close():
        reconnects["close"] += 1
        client.session = None

    async def fake_connect():
        reconnects["connect"] += 1
        client.session = healthy_session

    client.close = fake_close
    client.connect = fake_connect

    result = await client.call_tool("get_option_chain", {"symbol": "SPY"})

    assert result == {"recovered": True}
    assert reconnects == {"close": 1, "connect": 1}
    assert healthy_session.calls == 1


@pytest.mark.asyncio
async def test_call_tool_raises_clear_error_when_retry_also_times_out(monkeypatch):
    monkeypatch.setattr("config.MCP_CALL_TIMEOUT_S", 0.05)
    always_hangs = FakeSession(delay=1.0)
    client = _client_with_session(always_hangs)

    reconnect_calls = {"count": 0}

    async def fake_close():
        pass

    async def fake_connect():
        reconnect_calls["count"] += 1
        client.session = always_hangs  # still broken after "reconnecting"

    client.close = fake_close
    client.connect = fake_connect

    with pytest.raises(TimeoutError, match="get_option_chain.*timed out"):
        await client.call_tool("get_option_chain", {"symbol": "SPY"})

    # exactly one reconnect attempt - never loops indefinitely
    assert reconnect_calls["count"] == 1


@pytest.mark.asyncio
async def test_connect_timeout_raises_clear_error_and_cleans_up(monkeypatch):
    monkeypatch.setattr("config.MCP_CONNECT_TIMEOUT_S", 0.05)

    async def hanging_do_connect(self, stack, params):
        await asyncio.sleep(1.0)

    monkeypatch.setattr(AlpacaMcpClient, "_do_connect", hanging_do_connect)
    client = AlpacaMcpClient()

    with pytest.raises(TimeoutError, match="MCP connect timed out"):
        await client.connect()

    assert client._stack is None
