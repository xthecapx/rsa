"""HTTP-only worker policy; circuit services remain usable in Qollab/Pyodide."""
from collections.abc import Callable
from typing import TypeVar

from fastapi import HTTPException

from app.core.game_services import ServiceError
from app.quantum.worker import QuantumTimeout, run_on_worker

T = TypeVar("T")


def run_quantum(
    work: Callable[[], T],
    *,
    timeout: float = 15,
    service_errors: bool = False,
    aer_unavailable: bool = True,
) -> T:
    """Execute once, preserving each route's timeout and error contract.

    Never retry: a timeout does not prove that a submitted job did not run.
    Lab historically propagates ImportError; register and lab expose ServiceError.
    """
    try:
        return run_on_worker(work, timeout=timeout)
    except ServiceError as exc:
        if not service_errors:
            raise
        raise HTTPException(exc.status, exc.detail) from exc
    except QuantumTimeout as exc:
        raise HTTPException(504, str(exc)) from exc
    except ImportError as exc:
        if not aer_unavailable:
            raise
        raise HTTPException(503, "Qiskit Aer is unavailable") from exc
