# RSA Quantum Teaching Game

Interactive talk tool: Ale → Hacker → Brayan across plaintext, Caesar, RSA, and Shor, with depth tiers and live IBM batch readout.

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:7013  
- Game: http://localhost:7019  
- Backend: http://localhost:7001/api/health  

The ports are four-digit primes so the stack never collides with the 3000/8000
crowd that every other dev server defaults to.

The backend installs `qiskit-qward` from PyPI, so nothing outside this repo has
to be checked out. To work against a local qward instead, mount it over the
installed copy and reinstall it editable in the container.

## Local (no Docker)

```bash
# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 7001

# Frontend
cd frontend && npm install && npm run dev
```

## IBM QPU (thesis, from QWARD)

The IBM endpoints have two sources, chosen by `IBM_MODE`:

| mode | behaviour |
| --- | --- |
| `auto` (default) | live when `IBM_QUANTUM_TOKEN` **and** `IBM_BATCH_IDS` are set, recorded otherwise |
| `recorded` | always serve the runs shipped in the image |
| `live` | always call IBM |

Recorded mode serves four real `ibm_marrakesh` batches (m3/m4/m6/m8, N=15,
a=7, 5 runs of 4096 shots each) from `backend/app/data/recorded_batches/`, in
the same response shape as a live read. That means **the app deploys with no
IBM secrets, no network egress to IBM, and no eight-second upstream call** —
and still shows real hardware noise rather than a simulation.

`GET /api/ibm/mode` reports which source is in use and why.

Regenerate the fixtures from a qward campaign (point it at the raw output of a
`shor_ibm.py` run):

```bash
cd backend && python tools/import_qpu_runs.py \
  ../../qiskit-qward/qward/examples/papers/shor/data/qpu/raw
```

Each QPU submit runs a noiseless Aer baseline first (same shots); results are stored as `simulator_baseline` in the JSON.

```bash
cd ../qiskit-qward

# Aer-only dry run (no QPU spend) for all four m values:
SHOR_SIM_ONLY=1 SHOR_SHOTS=1024 ./qward/examples/papers/run_shor_experiments.sh

# Full campaign: Aer baseline + IBM batch per config (opt-level 3, 5 runs, 4096 shots)
./qward/examples/papers/run_shor_experiments.sh

# Single config:
uv run python qward/examples/papers/shor/shor_ibm.py \
  --config SHOR-N15-M8 --opt-levels 3 --runs 5 --shots 4096 --timeout 3600
```

Paste each `batch_id` into `rsa/.env` as `IBM_BATCH_IDS=m3=...,m4=...,m6=...,m8=...` and restart the backend. The talk app only **reads** batches; it never submits jobs.

If a live read fails while in live mode, the backend falls back to the recorded
run for that batch rather than showing an error, and marks the response with
`live_error`.

## Presenter hotkeys

←/→ acts · `1`/`2`/`3` tier · Space send · `R` reset · `P` presenter mode
