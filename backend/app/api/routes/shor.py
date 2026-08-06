"""Shor plan / classical / simulate endpoints."""

from fastapi import APIRouter, HTTPException

from app.models.schemas import ShorPlanRequest, ShorSimulateRequest
from app.quantum import shor_service

router = APIRouter()


@router.post("/plan")
def plan(req: ShorPlanRequest):
    try:
        return shor_service.plan_shor(req.N, req.a, req.num_control)
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/classical")
def classical(req: ShorPlanRequest):
    try:
        return shor_service.classical_shor(req.N, req.a)
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/simulate")
def simulate(req: ShorSimulateRequest):
    try:
        return shor_service.simulate_shor(
            req.N,
            req.a,
            num_control=req.num_control,
            strategy=req.strategy,
            shots=req.shots,
            include_statevector=req.include_statevector,
        )
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
