"""Hardware results that ship with the image, for running without IBM.

Reaching IBM needs a token, an instance, and a network path to a third party
that takes about eight seconds to answer when it is healthy. None of that is
available in a deployment that has no secrets attached, and none of it is
wanted during a talk where the demo has to work on conference wifi.

These are the same runs, recorded: real counts from ibm_marrakesh, converted by
`tools/import_qpu_runs.py` into the shape `ibm_runner.fetch_batch` returns, so
the frontend cannot tell the two paths apart beyond the `recorded` flag it uses
to label them honestly.

Post-processing was done at import time, so serving one of these is a file read
and a JSON parse -- no circuit construction, no simulator, no network.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


def data_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "recorded_batches"


@lru_cache(maxsize=1)
def _index() -> List[Dict[str, Any]]:
    """The batch list, read once per process.

    An empty list rather than an exception when the directory is missing: the
    caller's job is to fall back, not to crash on a deployment that chose not
    to ship the fixtures.
    """
    path = data_dir() / "index.json"
    if not path.exists():
        logger.warning("no recorded batches at %s", path)
        return []
    try:
        return list(json.loads(path.read_text()).get("batches", []))
    except (OSError, ValueError):
        logger.exception("recorded batch index is unreadable")
        return []


@lru_cache(maxsize=8)
def _load(label: str) -> Optional[Dict[str, Any]]:
    path = data_dir() / f"{label}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        logger.exception("recorded batch %s is unreadable", label)
        return None


def available() -> bool:
    return bool(_index())


def listed_batches(settings: Optional[Settings] = None) -> List[Dict[str, str]]:
    """The recorded batches, in the shape /api/ibm/batches already returns."""
    settings = settings or get_settings()
    return [
        {
            "label": row["label"],
            "batch_id": row["batch_id"],
            "console_url": settings.session_url(row["batch_id"]),
            "backend_name": row.get("backend_name"),
            "num_control": row.get("num_control"),
            "recorded": True,
        }
        for row in _index()
    ]


def _label_for(batch_id: str) -> Optional[str]:
    """Accept either the recorded batch id or its `m4` style label."""
    wanted = (batch_id or "").strip()
    if not wanted:
        return None
    for row in _index():
        if wanted in (row["batch_id"], row["label"]):
            return row["label"]
    return None


def default_label() -> Optional[str]:
    rows = _index()
    if not rows:
        return None
    # The widest register: the most convincing readout of the four.
    return max(rows, key=lambda row: row.get("num_control") or 0)["label"]


def get_batch(
    batch_id: Optional[str] = None, *, settings: Optional[Settings] = None
) -> Optional[Dict[str, Any]]:
    """A recorded batch by id or label, or the default one when asked for none.

    Returns None when nothing matches, so the caller can decide between a 404
    and falling through to the live path.
    """
    settings = settings or get_settings()
    label = _label_for(batch_id) if batch_id else default_label()
    if label is None:
        return None
    batch = _load(label)
    if batch is None:
        return None

    # Console links depend on the configured instance, which is deployment
    # state rather than something to bake into a fixture.
    batch = dict(batch)
    batch["console_url"] = settings.session_url(batch["batch_id"])
    batch["jobs"] = [
        {**job, "console_url": settings.job_url(job["job_id"])}
        for job in batch.get("jobs", [])
    ]
    return batch
