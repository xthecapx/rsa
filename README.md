# RSA Quantum Teaching Game

Interactive talk tool: Ale → Hacker → Brayan across plaintext, Caesar, RSA, and Shor, with depth tiers and live IBM batch readout.

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000  
- Backend: http://localhost:8000/api/health  

`../qiskit-qward` is bind-mounted into the backend for editable Shor.

## Local (no Docker)

```bash
# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pip install -e ../../qiskit-qward
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

## IBM QPU (thesis, from QWARD)

```bash
cd ../qiskit-qward
uv run python qward/examples/papers/shor/shor_ibm.py \
  --config SHOR-N15-M8 --opt-levels 3 --runs 5 --shots 4096 --timeout 3600
# or: ./qward/examples/papers/run_shor_experiments.sh
```

Paste each `batch_id` into `rsa/.env` as `IBM_BATCH_IDS=m3=...,m4=...,m6=...,m8=...` and restart the backend. The talk app only **reads** batches; it never submits jobs.

## Presenter hotkeys

←/→ acts · `1`/`2`/`3` tier · Space send · `R` reset · `P` presenter mode
