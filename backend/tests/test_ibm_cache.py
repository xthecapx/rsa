"""Tests for the guard around slow IBM calls.

These are the behaviours that keep one unreachable third party from taking the
whole API down, so they are worth pinning precisely.
"""

import threading
import time

import pytest

from app.quantum.ibm_cache import CacheInfo, TtlCache, UpstreamTimeout, annotate


def make_cache(**kwargs) -> TtlCache:
    defaults = dict(ttl_seconds=60.0, timeout_seconds=1.0, max_workers=2, name="test")
    defaults.update(kwargs)
    return TtlCache(**defaults)


def test_second_call_is_served_from_cache():
    cache = make_cache()
    calls = []

    def fetch():
        calls.append(1)
        return {"value": len(calls)}

    first, first_info = cache.get_or_fetch("k", fetch)
    second, second_info = cache.get_or_fetch("k", fetch)

    assert len(calls) == 1
    assert first == second == {"value": 1}
    assert first_info.from_cache is False
    assert second_info.from_cache is True
    assert second_info.stale is False


def test_expired_entry_is_refetched():
    cache = make_cache(ttl_seconds=0.05)
    calls = []

    def fetch():
        calls.append(1)
        return len(calls)

    assert cache.get_or_fetch("k", fetch)[0] == 1
    time.sleep(0.1)
    assert cache.get_or_fetch("k", fetch)[0] == 2


def test_concurrent_callers_share_one_fetch():
    """The pile-up that exhausted the worker pool: many callers, one call."""
    cache = make_cache()
    calls = []
    release = threading.Event()

    def fetch():
        calls.append(1)
        release.wait(timeout=2)
        return "shared"

    results = []
    threads = [
        threading.Thread(target=lambda: results.append(cache.get_or_fetch("k", fetch)[0]))
        for _ in range(6)
    ]
    for thread in threads:
        thread.start()
    time.sleep(0.15)
    release.set()
    for thread in threads:
        thread.join(timeout=3)

    assert len(calls) == 1
    assert results == ["shared"] * 6


def blocking_fetch(release: threading.Event, value: str = "late"):
    """A fetch that hangs until the test lets it go, like an unresponsive IBM."""

    def fetch():
        release.wait(timeout=5)
        return value

    return fetch


def test_timeout_raises_when_nothing_is_cached():
    cache = make_cache(timeout_seconds=0.1)
    release = threading.Event()
    try:
        with pytest.raises(UpstreamTimeout):
            cache.get_or_fetch("k", blocking_fetch(release))
    finally:
        release.set()


def test_timeout_falls_back_to_stale_data():
    """A slow upstream degrades to older data rather than to an error."""
    cache = make_cache(ttl_seconds=0.05, timeout_seconds=0.1)
    cache.get_or_fetch("k", lambda: "first")
    time.sleep(0.1)

    release = threading.Event()
    try:
        value, info = cache.get_or_fetch("k", blocking_fetch(release, "second"))
        assert value == "first"
        assert info.stale is True
        assert info.from_cache is True
    finally:
        release.set()


def test_failure_falls_back_to_stale_data():
    cache = make_cache(ttl_seconds=0.05)
    cache.get_or_fetch("k", lambda: "first")
    time.sleep(0.1)

    def boom():
        raise RuntimeError("IBM is down")

    value, info = cache.get_or_fetch("k", boom)
    assert value == "first"
    assert info.stale is True


def test_failure_propagates_when_nothing_is_cached():
    cache = make_cache()

    def boom():
        raise RuntimeError("IBM is down")

    with pytest.raises(RuntimeError, match="IBM is down"):
        cache.get_or_fetch("k", boom)


def test_failure_does_not_wedge_the_key():
    """A failed fetch must not leave the key permanently in flight."""
    cache = make_cache()
    attempts = []

    def flaky():
        attempts.append(1)
        if len(attempts) == 1:
            raise RuntimeError("transient")
        return "recovered"

    with pytest.raises(RuntimeError):
        cache.get_or_fetch("k", flaky)
    assert cache.get_or_fetch("k", flaky)[0] == "recovered"


def test_keys_are_independent():
    cache = make_cache()
    assert cache.get_or_fetch("a", lambda: 1)[0] == 1
    assert cache.get_or_fetch("b", lambda: 2)[0] == 2
    assert cache.get_or_fetch("a", lambda: 99)[0] == 1


def test_annotate_records_freshness_without_mutating_the_original():
    payload = {"batch_id": "x"}
    out = annotate(payload, CacheInfo(from_cache=True, stale=True, age_seconds=12.34))
    assert out["from_cache"] is True
    assert out["stale"] is True
    assert out["age_seconds"] == 12.3
    assert "from_cache" not in payload
