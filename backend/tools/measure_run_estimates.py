"""Measure real lesson circuits to build the game's expected-run-time table.

Usage (local backend, no IBM/provider submissions):

    python tools/measure_run_estimates.py --base-url http://localhost:7101 \
        --runs 5 --out ../game/lib/runEstimates.json

The game shows these numbers as "usually about X-Y s". They come from the
machine running this script, which is usually faster than the deployed service,
so the game applies a documented safety multiplier. Re-run when circuits change.
No player data is involved; tokens come from the public /device routes.
"""
import argparse
import json
import math
import platform
import statistics
import sys
from time import perf_counter
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

GROVER_LOOP = ["oracle", "diffuser"]


def post(base, path, body, choice="ideal", timeout=180):
    request = Request(
        base.rstrip("/") + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-Quantum-Simulator": choice},
    )
    started = perf_counter()
    with urlopen(request, timeout=timeout) as response:
        data = json.loads(response.read())
    return (perf_counter() - started) * 1000, data


def register_ops(qubits, rounds):
    marked = "1" * qubits
    ops = ["H"]
    for _ in range(rounds):
        ops += [f"oracle:{marked}", "D"]
    return ops


def cases(base):
    """(key, path, body factory, choice). Keys mirror game/lib/runEstimates.ts."""
    out = []
    for choice in ("ideal", "noise"):
        out.append((f"lab:q1:s16:{choice}", "/api/lab/run", lambda: {"qubits": 1, "start": "0", "operations": [], "shots": 16}, choice))
        out.append((f"lab:q4:s1024:{choice}", "/api/lab/run", lambda: {
            "qubits": 4, "start": "0000", "shots": 1024,
            "operations": [{"gate": "H", "wire": w} for w in range(4)] + [{"gate": "CX", "control": 0, "wire": w} for w in (1, 2, 3)],
        }, choice))
        out.append((f"campus:q1:s256:{choice}", "/api/campus/run", lambda: {"mode": "circuit", "recipe": {"qubits": 1, "start": "0", "operations": [{"gate": "H", "wire": 0}], "shots": 256}}, choice))
        out.append((f"coin:circuit:{choice}", "/api/coin/circuit", lambda: {"starts": ["0", "1", "+", "-"], "gates": ["H", "Z", "H", "X"], "shots": 256}, choice))
        out.append((f"coin:simulate:{choice}", "/api/coin/simulate", lambda: {"hadamard": True, "shots": 1000}, choice))
        for qubits in (2, 3, 4):
            out.append((f"register:q{qubits}:{choice}", "/api/register/circuit", lambda q=qubits: {"qubits": q, "start": "0" * q, "operations": register_ops(q, 3), "shots": 256}, choice))
        for repeat in (0, 1, 3, 5):
            out.append((f"grover:r{repeat}:{choice}", "/api/grover/run", lambda r=repeat: grover_body(base, r), choice))
        out.append((f"vault:{choice}", "/api/vault/run", lambda: vault_body(base), choice))
        for m in (3, 4, 6, 8, 10):
            out.append((f"shor:m{m}:{choice}", "/api/shor/simulate", lambda m=m: {"N": 15, "a": 7, "num_control": m, "shots": 1024}, choice))
    return out


def grover_body(base, repeat):
    _, device = post(base, "/api/grover/device", {})
    return {"token": device["token"], "circuit": {"init": "h", "loop": GROVER_LOOP, "repeat": repeat, "measure": False}}


def vault_body(base):
    _, device = post(base, "/api/vault/device", {})
    return {"token": device["token"], "circuit": {"prep": "h", "helper": "minus", "out": "h", "measure": True}}


def measure(base, runs, only=None):
    report = {"platform": platform.platform(), "python": platform.python_version(), "runs": runs, "cases": {}}
    for index, (key, path, make_body, choice) in enumerate(cases(base)):
        if only and only not in key:
            continue
        samples, error = [], None
        for attempt in range(runs + 1):
            try:
                body = make_body()
                ms, _ = post(base, path, body, choice)
                samples.append(ms)
            except (HTTPError, URLError, TimeoutError) as exc:
                error = str(exc)
                break
        warm = sorted(samples[1:])
        entry = {"path": path, "simulator": choice, "first_ms": round(samples[0], 1) if samples else None}
        if warm:
            entry.update(
                median_ms=round(statistics.median(warm), 1),
                p95_ms=round(warm[math.ceil(0.95 * len(warm)) - 1], 1),
                max_ms=round(warm[-1], 1),
            )
        if error:
            entry["error"] = error
        report["cases"][key] = entry
        print(f"{key}: {entry}", file=sys.stderr, flush=True)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", default="http://localhost:7001")
    parser.add_argument("--runs", type=int, default=5, help="Warm requests per case after one first request")
    parser.add_argument("--out", help="Write the JSON report here instead of stdout")
    parser.add_argument("--only", help="Measure only cases whose key contains this text and merge them into --out")
    args = parser.parse_args()
    if args.runs < 2:
        parser.error("--runs must be at least 2 for a p95")
    report = measure(args.base_url, args.runs, args.only)
    if args.only and args.out:
        with open(args.out) as handle:
            previous = json.load(handle)
        previous["cases"].update(report["cases"])
        report = previous
    text = json.dumps(report, indent=2)
    if args.out:
        with open(args.out, "w") as handle:
            handle.write(text + "\n")
    else:
        print(text)
