"""Keeping a slow, unreliable third party from taking the whole API down.

Fetching a batch from IBM is a blocking round trip of roughly eight seconds
with no timeout available on the client. FastAPI runs synchronous endpoints in
a bounded worker pool, so calls that never return hold those workers forever
and eventually every route stops responding -- including /api/health, which
has nothing to do with IBM.

Three things prevent that here:

* IBM work runs on its own small executor, so the worst case is that IBM data
  becomes unavailable, never that the rest of the API does.
* Callers wait a bounded time and then give up, freeing the request worker
  even though the underlying call is still stuck.
* Identical requests in flight share one fetch, and results are cached, so a
  room full of people loading the same batch produces one call rather than one
  each.

The results being cached are finished quantum jobs, which do not change.
"""

from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass
from typing import Any, Callable, Dict, Generic, Hashable, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class UpstreamTimeout(Exception):
    """The upstream call did not answer in time and no stale copy was held."""


@dataclass(frozen=True)
class CacheInfo:
    """Where a returned value came from, for the caller to pass on."""

    from_cache: bool
    stale: bool
    age_seconds: float


@dataclass
class _Entry(Generic[T]):
    value: T
    stored_at: float


class TtlCache(Generic[T]):
    def __init__(
        self,
        *,
        ttl_seconds: float,
        timeout_seconds: float,
        max_workers: int = 2,
        name: str = "upstream",
    ) -> None:
        self._ttl = ttl_seconds
        self._timeout = timeout_seconds
        self._name = name
        # Reentrant: a future that is already finished runs its done-callback
        # inline on the thread that registers it, so _finish can re-enter this
        # lock while get_or_fetch still holds it.
        self._lock = threading.RLock()
        self._entries: Dict[Hashable, _Entry[T]] = {}
        self._inflight: Dict[Hashable, "Future[T]"] = {}
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers, thread_name_prefix=f"{name}-fetch"
        )

    def get_or_fetch(
        self, key: Hashable, fetch: Callable[[], T]
    ) -> tuple[T, CacheInfo]:
        """Return a cached value, or fetch one, falling back to stale data.

        Raises UpstreamTimeout, or whatever `fetch` raised, only when there is
        no previous value to fall back on.
        """
        now = time.monotonic()

        with self._lock:
            entry = self._entries.get(key)
            if entry is not None and now - entry.stored_at < self._ttl:
                return entry.value, CacheInfo(
                    from_cache=True, stale=False, age_seconds=now - entry.stored_at
                )

            future = self._inflight.get(key)
            started = future is None
            if started:
                future = self._executor.submit(fetch)
                self._inflight[key] = future

        # Registered outside the lock: a fetch that finished already will run
        # this callback right here, on this thread.
        if started:
            future.add_done_callback(lambda done, k=key: self._finish(k, done))

        try:
            value = future.result(timeout=self._timeout)
        except FutureTimeout:
            logger.warning(
                "%s: no answer for %r within %.1fs", self._name, key, self._timeout
            )
            fallback = self._stale(key)
            if fallback is not None:
                return fallback
            raise UpstreamTimeout(
                f"{self._name} did not respond within {self._timeout:.0f}s "
                "and nothing is cached for this request yet"
            ) from None
        except Exception as exc:  # noqa: BLE001 - re-raised unless stale exists
            logger.warning("%s: fetch for %r failed: %s", self._name, key, exc)
            fallback = self._stale(key)
            if fallback is not None:
                return fallback
            raise

        return value, CacheInfo(from_cache=False, stale=False, age_seconds=0.0)

    def _finish(self, key: Hashable, future: "Future[T]") -> None:
        with self._lock:
            if self._inflight.get(key) is future:
                del self._inflight[key]
            if future.cancelled() or future.exception() is not None:
                return
            self._entries[key] = _Entry(future.result(), time.monotonic())

    def _stale(self, key: Hashable) -> Optional[tuple[T, CacheInfo]]:
        with self._lock:
            entry = self._entries.get(key)
        if entry is None:
            return None
        age = time.monotonic() - entry.stored_at
        logger.info("%s: serving stale %r (%.0fs old)", self._name, key, age)
        return entry.value, CacheInfo(from_cache=True, stale=True, age_seconds=age)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


def annotate(payload: Any, info: CacheInfo) -> Any:
    """Record on the response how fresh the data it carries is."""
    if isinstance(payload, dict):
        payload = dict(payload)
        payload["from_cache"] = info.from_cache
        payload["stale"] = info.stale
        payload["age_seconds"] = round(info.age_seconds, 1)
    return payload
