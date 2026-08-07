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
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="quantum")


class QuantumTimeout(Exception):
    """A circuit took longer than the caller was willing to wait."""


def run_on_worker(work: Callable[[], T], *, timeout: float | None = None) -> T:
    """Run `work` on the quantum thread and return its result.

    Exceptions raised inside `work` propagate to the caller unchanged.
    """
    future = _executor.submit(work)
    try:
        return future.result(timeout=timeout)
    except FutureTimeout:
        logger.warning("quantum work exceeded %.0fs", timeout or 0)
        raise QuantumTimeout(
            f"circuit did not finish within {timeout:.0f}s"
        ) from None
