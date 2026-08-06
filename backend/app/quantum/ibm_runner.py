"""Read-only IBM Quantum client. Never submits jobs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.config import Settings, get_settings


def listed_batches(settings: Optional[Settings] = None) -> List[Dict[str, str]]:
    settings = settings or get_settings()
    return [
        {
            "label": label,
            "batch_id": batch_id,
            "console_url": settings.workload_url(batch_id),
        }
        for label, batch_id in settings.ibm_batch_ids
    ]


def _service(settings: Settings):
    from qiskit_ibm_runtime import QiskitRuntimeService

    kwargs = {}
    if settings.ibm_quantum_channel:
        kwargs["channel"] = settings.ibm_quantum_channel
    if settings.ibm_quantum_token:
        kwargs["token"] = settings.ibm_quantum_token
    if settings.ibm_quantum_instance:
        kwargs["instance"] = settings.ibm_quantum_instance
    return QiskitRuntimeService(**kwargs)


def _infer_m_from_counts(counts: Dict[str, int]) -> Optional[int]:
    if not counts:
        return None
    sample = next(iter(counts)).replace(" ", "")
    return len(sample) if sample else None


def _extract_counts(job) -> Dict[str, int]:
    result = job.result()
    # SamplerV2: result[0].data.<creg>.get_counts()
    try:
        pub = result[0]
        data = pub.data
        # Prefer named classical register "out"
        if hasattr(data, "out"):
            return {k.replace(" ", ""): v for k, v in data.out.get_counts().items()}
        # Fallback: first attribute with get_counts
        for name in dir(data):
            if name.startswith("_"):
                continue
            attr = getattr(data, name)
            if hasattr(attr, "get_counts"):
                return {k.replace(" ", ""): v for k, v in attr.get_counts().items()}
    except Exception:
        pass
    # Legacy Result
    try:
        return {k.replace(" ", ""): v for k, v in result.get_counts().items()}
    except Exception:
        return {}


def fetch_batch(
    batch_id: str,
    *,
    settings: Optional[Settings] = None,
    label: Optional[str] = None,
    N: int = 15,
    a: int = 7,
) -> Dict[str, Any]:
    """Fetch batch + jobs live from IBM and run Shor post-processing."""
    settings = settings or get_settings()
    from qiskit_ibm_runtime import Batch

    from qward.algorithms.shor import (  # type: ignore
        Shor,
        analyze_counts,
        classical_order,
    )

    service = _service(settings)
    jobs = list(service.jobs(session_id=batch_id, limit=100))
    details = None
    try:
        details = Batch.from_id(batch_id, service).details()
    except Exception as exc:  # noqa: BLE001
        details = {"error": str(exc)}

    true_order = None
    try:
        true_order = classical_order(a, N)
    except Exception:
        true_order = 4 if N == 15 else None

    rows: List[Dict[str, Any]] = []
    inferred_m: Optional[int] = None
    for job in jobs:
        status = str(job.status())
        counts: Dict[str, int] = {}
        error = None
        try:
            if status in ("DONE", "JobStatus.DONE", "COMPLETED"):
                counts = _extract_counts(job)
        except Exception as exc:  # noqa: BLE001
            error = str(exc)
        m = _infer_m_from_counts(counts)
        if m:
            inferred_m = m
        analysis = None
        if counts and m:
            analysis = analyze_counts(
                counts, a, N, m, true_order=true_order
            )
        job_id = job.job_id()
        rows.append(
            {
                "job_id": job_id,
                "status": status,
                "counts": counts,
                "analysis": analysis,
                "error": error,
                "console_url": settings.workload_url(job_id),
                "num_control": m,
            }
        )

    m = inferred_m or _label_to_m(label)
    references = _reference_rows(N=N, a=a, num_control=m or 8)

    return {
        "batch_id": batch_id,
        "label": label,
        "console_url": settings.workload_url(batch_id),
        "details": details,
        "backend_name": (details or {}).get("backend_name")
        or (details or {}).get("backend"),
        "usage_time": (details or {}).get("usage_time"),
        "num_control": m,
        "N": N,
        "a": a,
        "jobs": rows,
        "references": references,
    }


def _label_to_m(label: Optional[str]) -> Optional[int]:
    if not label:
        return None
    # m3, m4, m6, m8 or SHOR-N15-M8
    lower = label.lower()
    for candidate in (3, 4, 6, 8):
        if f"m{candidate}" in lower or f"m{candidate}" == lower:
            return candidate
    return None


def _reference_rows(N: int, a: int, num_control: int) -> Dict[str, Any]:
    from qward.algorithms.shor import Shor  # type: ignore
    from qiskit_aer import AerSimulator

    from qiskit import transpile

    shor = Shor(N, a, num_control=num_control, strategy="swap_network")
    ideal = shor.expected_distribution()
    sim = AerSimulator(method="statevector")
    circuit = transpile(shor.circuit, backend=sim, optimization_level=1)
    job = sim.run(circuit, shots=2048)
    counts = {k.replace(" ", ""): v for k, v in job.result().get_counts().items()}
    return {
        "ideal": ideal,
        "aer_noiseless": counts,
        "true_order": shor.true_order,
    }


def load_cached() -> Dict[str, Any]:
    path = Path(__file__).resolve().parent.parent / "data" / "cached_ibm_runs" / "demo_batch.json"
    if not path.exists():
        return {"error": "no cached run", "path": str(path)}
    return json.loads(path.read_text())
