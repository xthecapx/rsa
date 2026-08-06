"""Read-only IBM batch endpoints."""

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.quantum import ibm_runner

router = APIRouter()


@router.get("/batches")
def batches():
    return {"batches": ibm_runner.listed_batches()}


@router.get("/batch/{batch_id}")
def batch(batch_id: str):
    settings = get_settings()
    label = None
    for lbl, bid in settings.ibm_batch_ids:
        if bid == batch_id:
            label = lbl
            break
    try:
        return ibm_runner.fetch_batch(batch_id, settings=settings, label=label)
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/cached")
def cached():
    return ibm_runner.load_cached()
