"""Shor plan / classical / simulate endpoints."""

import logging

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.models.schemas import ShorPlanRequest, ShorSimulateRequest
from app.quantum import shor_service
from app.quantum.worker import QuantumTimeout, run_on_worker

logger = logging.getLogger(__name__)

router = APIRouter()


def _run(what: str, work):
    """Run a Shor call on the quantum worker thread.

    The worker is not an optimisation: building these circuits on a
    freshly-created thread segfaults the process, and FastAPI's own thread
    pool is made of exactly those. See app/quantum/worker.py.

    Errors used to all surface as 400, which told callers their request was
    wrong even when the fault was ours. Only ValueError means the caller asked
    for something impossible; anything else is a bug worth a traceback.
    """
    try:
        return run_on_worker(work, timeout=get_settings().quantum_timeout)
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except QuantumTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("shor %s failed", what)
        raise HTTPException(status_code=500, detail=f"{what} failed: {exc}") from exc


@router.post("/plan")
def plan(req: ShorPlanRequest):
    return _run("plan", lambda: shor_service.plan_shor(req.N, req.a, req.num_control))


@router.post("/classical")
def classical(req: ShorPlanRequest):
    return _run("classical", lambda: shor_service.classical_shor(req.N, req.a))


@router.post("/simulate")
def simulate(req: ShorSimulateRequest):
    return _run(
        "simulate",
        lambda: shor_service.simulate_shor(
            req.N,
            req.a,
            num_control=req.num_control,
            strategy=req.strategy,
            shots=req.shots,
            include_statevector=req.include_statevector,
        ),
    )
