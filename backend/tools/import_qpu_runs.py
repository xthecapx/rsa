"""Turn qward's raw QPU experiment dumps into batches the API can serve offline.

The raw files are ~2.5 MB each of experiment metadata: per-run qward metrics,
transpilation statistics, gate error characterisation. The API needs a small
fraction of that, in the shape `ibm_runner.fetch_batch` returns, so the offline
path and the live path are indistinguishable to the frontend.

The post-processing (continued fractions, factor recovery, the ideal
distribution) is done here rather than at request time so the deployed
container never has to build a circuit or run Aer to show recorded hardware
results.

Usage:
    python tools/import_qpu_runs.py [SOURCE_DIR] [--out DIR]

Reads qward's raw campaign output, which lives outside this repo, so this is a
development step rather than part of the deployment.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_SOURCE = Path(
    "~/Documents/code/qiskit-qward/qward/examples/papers/shor/data/qpu/raw"
).expanduser()

DEFAULT_OUT = Path(__file__).resolve().parent.parent / "app" / "data" / "recorded_batches"


def label_for(config_id: str, num_control: int) -> str:
    """`SHOR-N15-M4` -> `m4`, matching the IBM_BATCH_IDS label convention."""
    match = re.search(r"M(\d+)", config_id or "", re.IGNORECASE)
    return f"m{match.group(1)}" if match else f"m{num_control}"


def build_jobs(
    raw: Dict[str, Any], N: int, a: int, num_control: int, true_order: Optional[int]
) -> List[Dict[str, Any]]:
    from qward.algorithms.shor import analyze_counts  # type: ignore

    jobs: List[Dict[str, Any]] = []
    for run in raw.get("individual_results", []):
        counts = {str(k).replace(" ", ""): int(v) for k, v in (run.get("counts") or {}).items()}
        jobs.append(
            {
                "job_id": run.get("job_id") or run.get("experiment_id"),
                "status": run.get("status") or "DONE",
                "counts": counts,
                "analysis": (
                    analyze_counts(counts, a, N, num_control, true_order=true_order)
                    if counts
                    else None
                ),
                "error": run.get("error"),
                "num_control": num_control,
                # Facts about how this run was executed, shown in the manifest.
                "optimization_level": run.get("optimization_level"),
                "shots": run.get("shots"),
                "transpiled_depth": run.get("transpiled_depth"),
                "success_rate": run.get("success_rate"),
            }
        )
    return jobs


def build_references(
    raw: Dict[str, Any], N: int, a: int, num_control: int, true_order: Optional[int]
) -> Dict[str, Any]:
    """The two comparison curves: the ideal peaks and the noiseless simulator.

    `aer_noiseless` is the baseline qward recorded alongside the hardware run,
    so it is the same circuit at the same shot count rather than something
    re-simulated later under different settings.
    """
    from qward.algorithms.shor import Shor  # type: ignore

    ideal: Dict[str, float] = {}
    try:
        ideal = Shor(N, a, num_control=num_control, strategy="swap_network").expected_distribution()
    except Exception as exc:  # noqa: BLE001 - a missing ideal curve is not fatal
        print(f"    ideal distribution unavailable: {exc}")

    baseline = raw.get("simulator_baseline") or {}
    aer = {str(k).replace(" ", ""): int(v) for k, v in (baseline.get("counts") or {}).items()}
    return {
        "ideal": ideal,
        "aer_noiseless": aer,
        "true_order": true_order,
        "aer_evaluation": baseline.get("evaluation"),
    }


def convert(path: Path) -> Dict[str, Any]:
    raw = json.loads(path.read_text())
    config = raw.get("config") or {}
    summary = raw.get("batch_summary") or {}

    N = int(config.get("N", 15))
    a = int(config.get("a", 7))
    num_control = int(config.get("num_control") or 8)
    true_order = config.get("true_order")
    label = label_for(raw.get("config_id", ""), num_control)

    jobs = build_jobs(raw, N, a, num_control, true_order)
    return {
        "batch_id": raw.get("batch_id"),
        "label": label,
        "backend_name": raw.get("backend_name") or summary.get("backend_name"),
        "num_control": num_control,
        "N": N,
        "a": a,
        "jobs": jobs,
        "references": build_references(raw, N, a, num_control, true_order),
        "details": {
            "backend_name": raw.get("backend_name"),
            "status": raw.get("status"),
            "mode": "batch",
            "num_runs": summary.get("num_runs"),
            "shots_per_run": summary.get("shots_per_run"),
            "mean_success_rate": summary.get("mean_success_rate"),
            "std_success_rate": summary.get("std_success_rate"),
            "recorded_at": raw.get("saved_at"),
        },
        "calibration": raw.get("backend_calibration"),
        # Flagged so the UI can say these are recorded rather than live, and so
        # nobody mistakes them for a fresh QPU call.
        "recorded": True,
        "cached": True,
        "source_file": path.name,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    if not args.source.is_dir():
        print(f"no such directory: {args.source}")
        return 1

    files = sorted(args.source.glob("*.json"))
    if not files:
        print(f"no .json files in {args.source}")
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    index: List[Dict[str, Any]] = []

    for path in files:
        print(f"  {path.name}")
        batch = convert(path)
        target = args.out / f"{batch['label']}.json"
        target.write_text(json.dumps(batch, indent=1, sort_keys=False))
        size_kb = target.stat().st_size / 1024
        print(
            f"    -> {target.name}  {len(batch['jobs'])} jobs, "
            f"m={batch['num_control']}, {size_kb:.0f} KB "
            f"(from {path.stat().st_size / 1024:.0f} KB)"
        )
        index.append(
            {
                "label": batch["label"],
                "batch_id": batch["batch_id"],
                "backend_name": batch["backend_name"],
                "num_control": batch["num_control"],
                "N": batch["N"],
                "a": batch["a"],
            }
        )

    index.sort(key=lambda row: row["num_control"])
    (args.out / "index.json").write_text(json.dumps({"batches": index}, indent=1))
    print(f"wrote {len(index)} batches + index.json to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
