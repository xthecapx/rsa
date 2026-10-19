"""All Qiskit circuit construction runs on one long-lived thread.

Building a Shor circuit from a thread that was just created segfaults the
interpreter. The crash is inside Qiskit's `qs_decomposition`, reached from
`gate.control()` while decomposing the controlled modular multiply, and it
takes the whole process down rather than failing the one request.

It is not a stack size problem -- raising the thread stack to 256 MB did not
help, and the same call succeeds every time on the main thread. It behaves
like state in Qiskit or its native dependencies that does not survive being
re-established on new threads.

What is reproducible is the cure. Building circuits on freshly created threads
crashed on every attempt; running the identical calls through a single reused
worker survived every attempt. FastAPI hands synchronous endpoints to an anyio
thread pool whose threads come and go, which is exactly the bad case, so the
quantum work is moved off it onto a thread that is created once and kept.

Serialising this work is no loss: it is CPU-bound, and running several of
these at once would only make each slower.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from contextvars import ContextVar
from time import perf_counter
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="quantum")
_timings: ContextVar[dict | None] = ContextVar("quantum_timings", default=None)


@contextmanager
def request_timings(path: str):
    """Mutable per-request metrics shared with FastAPI's sync route thread.

    ContextVar values are copied into that thread, but its writes to a new
    ContextVar value would not reach middleware. Share only this request's dict.
    No recipe, secret, player preference or result is stored here.
    """
    timings = {"path": path, "queue_ms": None, "execution_ms": None}
    token = _timings.set(timings)
    try:
        yield timings
    finally:
        _timings.reset(token)


class QuantumTimeout(Exception):
    """A circuit took longer than the caller was willing to wait."""


def run_on_worker(work: Callable[[], T], *, timeout: float | None = None) -> T:
    """Run `work` on the quantum thread and return its result.

    Exceptions raised inside `work` propagate to the caller unchanged.
    """
    submitted = perf_counter()
    timings = _timings.get()
    path = timings["path"] if timings else "direct"

    def measured():
        started = perf_counter()
        queue_ms = (started - submitted) * 1000
        if timings is not None:
            timings["queue_ms"] = queue_ms
        try:
            return work()
        finally:
            execution_ms = (perf_counter() - started) * 1000
            if timings is not None:
                timings["execution_ms"] = execution_ms
            logger.info("quantum work path=%s queue_ms=%.1f execution_ms=%.1f", path, queue_ms, execution_ms)

    future = _executor.submit(measured)
    try:
        return future.result(timeout=timeout)
    except FutureTimeout:
        # A TimeoutError raised by work is not an executor wait timeout.
        if future.done():
            return future.result()
        cancelled = future.cancel()
        elapsed_ms = (perf_counter() - submitted) * 1000
        if cancelled and timings is not None:
            timings["queue_ms"] = elapsed_ms
        logger.warning("quantum timeout path=%s elapsed_ms=%.1f queued_cancelled=%s", path, elapsed_ms, cancelled)
        raise QuantumTimeout(
            "The queued circuit timed out and was cancelled before execution."
            if cancelled else "The circuit timed out. It may still finish on the server; this request will not return its result."
        ) from None
