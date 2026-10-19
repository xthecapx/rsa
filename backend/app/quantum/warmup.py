"""Pay Qiskit/Aer's import and first-circuit cost at boot, not on a player's Run.

The deployed service scales to zero, so its first request used to include the
imports. Warm-up runs on the same single worker thread as every other circuit
(building circuits on any other thread can crash the process; see worker.py),
never blocks the server from listening, and only logs if it fails.
"""
import asyncio
import logging
import os
from time import perf_counter

from app.quantum.worker import run_on_worker

logger = logging.getLogger(__name__)


def _warm() -> None:
    from qiskit import QuantumCircuit
    from app.quantum.simulators import simulator

    circuit = QuantumCircuit(1, 1)
    circuit.h(0)
    circuit.measure(0, 0)
    # Both lesson simulators: the noise model imports its own modules.
    for choice in ("ideal", "noise"):
        simulator(choice).run(circuit, shots=1).result()
    # The first Shor request measured ~1.5 s slower than the rest: the vendored
    # engine and its circuit library import lazily. A tiny plan loads them.
    from app.quantum import shor_service

    shor_service.plan_shor(15, 7, 3)


def enabled() -> bool:
    return os.environ.get("QUANTUM_WARMUP", "1") != "0"


async def warm_up() -> None:
    started = perf_counter()
    try:
        await asyncio.to_thread(run_on_worker, _warm, timeout=120)
        logger.info("quantum warm-up finished in %.0f ms", (perf_counter() - started) * 1000)
    except Exception:  # noqa: BLE001 - a failed warm-up must not stop the server
        logger.warning("quantum warm-up failed; the first run will pay the import", exc_info=True)
