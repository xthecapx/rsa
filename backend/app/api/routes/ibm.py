"""Read-only IBM batch endpoints."""

import logging

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.quantum import ibm_runner
from app.quantum.ibm_cache import UpstreamTimeout

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/batches")
def batches():
    return {"batches": ibm_runner.listed_batches()}


@router.get("/batch/{batch_id}")
def batch(batch_id: str):
    settings = get_settings()
    label = next(
        (lbl for lbl, bid in settings.ibm_batch_ids if bid == batch_id), None
    )
    try:
        return ibm_runner.fetch_batch_cached(
            batch_id, settings=settings, label=label
        )
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except UpstreamTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - upstream is out of our control
        logger.exception("failed to fetch batch %s", batch_id)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/cached")
def cached():
    try:
        return ibm_runner.load_cached()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        # A corrupt demo file is our problem, not the caller's.
        logger.exception("cached run is not valid JSON")
        raise HTTPException(
            status_code=500, detail="cached run is not valid JSON"
        ) from exc
