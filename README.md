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

`../qiskit-qward` is bind-mounted into the backend for editable Shor.

## Local (no Docker)

```bash
# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pip install -e ../../qiskit-qward
uvicorn app.main:app --reload --port 7001

# Frontend
cd frontend && npm install && npm run dev
```

## IBM QPU (thesis, from QWARD)

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

## Presenter hotkeys

←/→ acts · `1`/`2`/`3` tier · Space send · `R` reset · `P` presenter mode
