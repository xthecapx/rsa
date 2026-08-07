"""Read-only IBM batch endpoints.

Two sources answer these routes: a live read from IBM, and the hardware runs
recorded into the image. Which one is used is decided by `Settings.ibm_mode`,
and every response says which it was, so a deployment without IBM credentials
degrades to real recorded data rather than to an error.
"""

import logging

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.quantum import ibm_recorded, ibm_runner
from app.quantum.ibm_cache import UpstreamTimeout

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/mode")
def mode():
    """What the IBM endpoints will do, and why. Useful on a fresh deploy."""
    settings = get_settings()
    return {
        "mode": "recorded" if settings.use_recorded_ibm else "live",
        "configured": settings.ibm_mode,
        "has_credentials": bool((settings.ibm_quantum_token or "").strip()),
        "configured_batches": len(settings.ibm_batch_ids),
        "recorded_available": ibm_recorded.available(),
    }


@router.get("/batches")
def batches():
    settings = get_settings()
    if settings.use_recorded_ibm and ibm_recorded.available():
        return {
            "batches": ibm_recorded.listed_batches(settings),
            "mode": "recorded",
        }
    return {"batches": ibm_runner.listed_batches(settings), "mode": "live"}


@router.get("/batch/{batch_id}")
def batch(batch_id: str):
    settings = get_settings()

    if settings.use_recorded_ibm:
        found = ibm_recorded.get_batch(batch_id, settings=settings)
        if found is not None:
            return found
        raise HTTPException(
            status_code=404,
            detail=(
                f"no recorded batch {batch_id!r}; this deployment has no IBM "
                "credentials, so only the batches shipped with it can be read"
            ),
        )

    label = next(
        (lbl for lbl, bid in settings.ibm_batch_ids if bid == batch_id), None
    )
    try:
        return ibm_runner.fetch_batch_cached(
            batch_id, settings=settings, label=label
        )
    except Exception as exc:  # noqa: BLE001 - re-raised below when unhandled
        # IBM being slow, absent, or broken should not take the readout away
        # when equivalent recorded hardware data is sitting in the image.
        fallback = ibm_recorded.get_batch(batch_id, settings=settings)
        if fallback is not None:
            logger.warning(
                "live fetch of %s failed (%s); serving the recorded run",
                batch_id,
                exc,
            )
            return {**fallback, "live_error": str(exc)}
        if isinstance(exc, ImportError):
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        if isinstance(exc, UpstreamTimeout):
            raise HTTPException(status_code=504, detail=str(exc)) from exc
        logger.exception("failed to fetch batch %s", batch_id)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/cached")
def cached():
    """The no-credentials readout the frontend falls back to.

    Prefers a recorded hardware run over the hand-written demo batch, so the
    fallback shows real counts wherever the fixtures are present.
    """
    settings = get_settings()
    recorded = ibm_recorded.get_batch(settings=settings)
    if recorded is not None:
        return recorded
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
