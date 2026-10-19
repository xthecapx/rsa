"""Measure small HTTP teaching circuits without IBM/provider submissions.

Run against a local backend or the game's /api proxy. The first request is
reported separately; only a freshly restarted backend makes it a cold start.
"""
import argparse
import json
import math
import platform
import statistics
from time import perf_counter
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def benchmark(base_url, runs, choice):
    cases = [
        ("empty_lab_16", "/api/lab/run", {"qubits": 1, "start": "0", "operations": [], "shots": 16}),
        ("campus_h_16", "/api/campus/run", {"mode": "circuit", "recipe": {"qubits": 1, "start": "0", "operations": [{"gate": "H", "wire": 0}], "shots": 16}}),
        ("campus_h_256", "/api/campus/run", {"mode": "circuit", "recipe": {"qubits": 1, "start": "0", "operations": [{"gate": "H", "wire": 0}], "shots": 256}}),
    ]
    report = {"platform": platform.platform(), "base_url": base_url, "simulator": choice, "cases": {}}
    for name, path, body in cases:
        samples = []
        for _ in range(runs + 1):
            request = Request(base_url.rstrip("/") + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "X-Quantum-Simulator": choice})
            started = perf_counter()
            try:
                with urlopen(request, timeout=45) as response:
                    response.read()
                    samples.append({"ms": round((perf_counter() - started) * 1000, 2), "status": response.status, "server_timing": response.headers.get("Server-Timing")})
            except (HTTPError, URLError, TimeoutError) as error:
                samples.append({"ms": round((perf_counter() - started) * 1000, 2), "error": str(error)})
        warm = sorted(s["ms"] for s in samples[1:] if s.get("status") == 200)
        report["cases"][name] = {
            "first": samples[0],
            "warm_median_ms": statistics.median(warm) if warm else None,
            "warm_p95_ms": warm[math.ceil(.95 * len(warm)) - 1] if warm else None,
            "failed": sum(s.get("status") != 200 for s in samples),
            "samples": samples,
        }
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:7001")
    parser.add_argument("--runs", type=int, default=20, help="Warm requests per case, after one first request")
    parser.add_argument("--simulator", choices=("ideal", "noise"), default="ideal")
    args = parser.parse_args()
    if args.runs < 1:
        parser.error("--runs must be positive")
    print(json.dumps(benchmark(args.base_url, args.runs, args.simulator), indent=2))
