"""Compatibility shim for strict OpenAI-compatible endpoints.

Some OpenAI-compatible providers (Cloudflare Workers AI, in particular)
validate request bodies more strictly than real OpenAI: they reject
`content` as a list-of-blocks (real OpenAI and langchain_openai's "standard
content blocks" both allow this for plain text) and reject `content: null`
on assistant messages that only carry `tool_calls` (real OpenAI allows this
too). TradingAgents' agent nodes go through langchain_openai, which - as of
langchain_openai 1.6 - represents message content as content-block lists by
default, so this monkeypatches `_convert_message_to_dict` to flatten
pure-text block lists to a plain string and to turn `None` content into
`""`, before TradingAgents ever constructs its ChatOpenAI clients.

Harmless no-op against lenient providers (Groq, real OpenAI, etc.) - kept
enabled regardless of which provider is currently configured, since we
switched providers once already (Cloudflare -> Groq, after hitting
Cloudflare's free-tier neuron quota) and may again.

Import this module (for its side effect) before `TradingAgentsGraph` runs
any LLM call - `tradingagents_client.py` does this at module load time.
"""

from __future__ import annotations

from langchain_openai.chat_models import base as _lc_openai_base

_original = _lc_openai_base._convert_message_to_dict


def _patched_convert_message_to_dict(message, api="chat/completions"):
    message_dict = _original(message, api=api)

    content = message_dict.get("content")
    if isinstance(content, list):
        if all(isinstance(b, dict) and b.get("type") == "text" for b in content):
            message_dict["content"] = "".join(b.get("text", "") for b in content)
    elif content is None:
        message_dict["content"] = ""

    return message_dict


_lc_openai_base._convert_message_to_dict = _patched_convert_message_to_dict
