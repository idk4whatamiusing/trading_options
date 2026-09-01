"""Unit tests for cycle.py's _is_quota_exhausted - the check that lets a
cycle stop itself early instead of burning through every remaining ticker
on guaranteed-to-fail retries once Cloudflare's daily quota is gone.
"""

from __future__ import annotations

from cycle import _is_quota_exhausted


class _StatusCodeError(Exception):
    def __init__(self, status_code):
        super().__init__("boom")
        self.status_code = status_code


class _Response:
    def __init__(self, status_code):
        self.status_code = status_code


class _HttpxLikeError(Exception):
    def __init__(self, status_code):
        super().__init__("boom")
        self.response = _Response(status_code)


def test_detects_openai_sdk_style_status_code():
    assert _is_quota_exhausted(_StatusCodeError(429))


def test_detects_httpx_style_nested_status_code():
    assert _is_quota_exhausted(_HttpxLikeError(429))


def test_detects_real_cloudflare_error_text_fallback():
    exc = RuntimeError(
        "Error code: 429 - {'errors': [{'message': \"AiError: AiError: you have "
        "used up your daily free allocation of 10,000 neurons, please upgrade "
        "to Cloudflare's Workers Paid plan\", 'code': 4006}]}"
    )
    assert _is_quota_exhausted(exc)


def test_other_status_codes_are_not_quota_exhaustion():
    assert not _is_quota_exhausted(_StatusCodeError(500))
    assert not _is_quota_exhausted(_HttpxLikeError(503))


def test_unrelated_exception_is_not_quota_exhaustion():
    assert not _is_quota_exhausted(ValueError("some other issue entirely"))
