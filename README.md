# Quantum Playground

Playable quantum-computing scenarios on a road of small towns: **Who Goes
First?** in Coin Town, **Echo Chamber** (Grover) in Foundry Town, **Operation
Ghost Key** (Bernstein–Vazirani) in Hollow Town, and **Breaking RSA** in Cipher Town,
across plaintext, Caesar, RSA, and Shor. See [AGENTS.md](AGENTS.md) for the current
game structure and development context. The separate `frontend/` presentation tool retains its depth tiers
and IBM batch readout.

## Live (Cloud Run)

Project `hacking-rsa`, region `us-east1`:

| Service | URL |
| --- | --- |
| **Game** (open this) | https://rsa-game-pzqjescbgq-ue.a.run.app |
| Backend | https://rsa-backend-pzqjescbgq-ue.a.run.app |
| Backend health | https://rsa-backend-pzqjescbgq-ue.a.run.app/api/health |

Redeploy after code changes:

```bash
./deploy-cloudrun.sh
```

The script builds `linux/amd64` images, deploys both services, and prunes older
Artifact Registry images. Cleanup requires Python 3 and Docker Buildx. By default,
it retains two complete image versions (`KEEP_IMAGES=2`), along with tagged releases
and every manifest referenced by retained images. It deletes obsolete image indexes
before their child manifests and reports cleanup failures instead of silently skipping them.
This reduces storage use; actual usage depends on image sizes and retained releases.

Prune existing images without rebuilding or deploying:

```bash
CLEANUP_DRY_RUN=1 ./deploy-cloudrun.sh cleanup  # preview the deletions
./deploy-cloudrun.sh cleanup                  # apply cleanup
```

Use `KEEP_IMAGES=1` to retain only one complete image version, plus any other tagged releases.
Cleanup only affects the configured repository's `backend` and `game` images.

Both services use `min-instances=0` (scale to zero) so idle time stays inside Cloud Run’s Always Free allowance. Before a talk, warm them; afterward, cool them:

```bash
gcloud run services update rsa-backend --region=us-east1 --min-instances=1
gcloud run services update rsa-game --region=us-east1 --min-instances=1
# after the talk:
gcloud run services update rsa-backend --region=us-east1 --min-instances=0
gcloud run services update rsa-game --region=us-east1 --min-instances=0
```

## Qollab bundle

The same game supports a Qollab export alongside the existing Next.js/FastAPI
deployment. Build the upload folder without running a backend server:

```bash
cd game
npm ci
npm run build:qollab
```

Upload the contents of `game/dist/qollab/` to the project's **Edit Code**
file browser, preserving subdirectories and replacing matching entry files.
Upload the complete folder: its Python modules and attribution are required along
with `index.html`, `main.js`, and `main.css`. Keep `README.md` / the Project Card.
The upload contains exactly 19 files: five browser files, twelve Python package
files, `requirements.txt`, and `THIRD-PARTY-NOTICES.txt`. Recorded IBM data is
bundled into `main.js`; images/audio referenced by the game live in `assets.js`.
`requirements.txt` explicitly declares `qiskit>=2.5.2,<3.0.0` for Qollab's Python runtime.

The generated distribution and `game/dist/build-report.json` are ignored by Git.
Rebuild them locally with `npm run build:qollab`; commit the source and build tools.
The report is for review and stays outside the upload.
It lists file sizes/hashes, included/omitted assets, and the largest JS modules.
The esbuild production bundle removes unused code and minifies JS/CSS.
The build refreshes the folder and report without creating a ZIP.
To replace an older upload, remove its obsolete `recorded.js`, `build-info.json`,
and separate license files; the current folder contains the combined attribution.
Use a fresh project file tree when possible.

Choose a free **IBM noise-model simulator** for the full game. Ghost Key retains
25 data qubits plus its helper; the built-in 24-qubit simulator and Braket's
25-qubit local simulator cannot run that lesson. The adapter passes the full
circuit to the selected IBM simulator using matrix product state simulation.
Noisy measurements may fail the key check, so the player can retry. Hardware
jobs are enabled when a physical QPU is selected in Qollab. IonQ remote
simulators and physical QPUs are reserved for final town challenges: the Coin
final toss, Grover final measurement, Ghost Key recovery, and the RSA Shor run.
Practice uses the built-in ideal simulator and labels its actual counts. One
remote submission is allowed per Qollab code Run; a second is blocked locally.
After reviewing the result and collecting the badge, press **Stop**, then
**Run** in Qollab for the next final challenge (or to retry after a noisy failure).
Ghost Key needs Forte/Forte Enterprise (29 qubits); Aria (25) is too small.
Progress and results use browser storage when available, not cookies. Test
restart persistence in Qollab before relying on it; no automatic job is submitted
on startup or restoration.
Provider limits and credits apply. Recorded IBM RSA batches remain a separate option.

Qollab runs the included Python services in its browser runtime and supplies the
quantum backend; no FastAPI server, provider credential, or backend URL is shipped.
Coin Town's neighbor benches execute the constructed one-qubit circuit with 256
shots per starting state through either backend. The shared histogram shows the
returned counts, selected backend, and a separate ideal prediction. Correctness
checks the designed circuit so noise does not block a knowledge card. Closing and
reopening a neighbor's laptop retains its current circuit and counts.
The server game includes a persistent **Simulation** selector for ideal Aer or
**Aer teaching noise**. The latter models 0.3% single-gate depolarization, 1% CNOT
depolarization, and 2% readout error; it does not claim to reproduce a device’s
calibration. Selection is carried per request, so players do not change one
another’s backend. Coin, Foundry/Hollow register benches, Grover, Ghost Key, and
live RSA simulations use this preference. Saved results retain their original
backend metadata. Full game resets retain this preference, like language and sound.
Qollab uses its external QPU selection, including authorized live hardware runs.
Foundry’s rounds dial submits real shots while ideal amplitude illustrations and
card goals stay labeled references. Recorded IBM counts stay labeled hardware.

Existing `npm run build` and Cloud Run commands still use the HTTP backend.
Backend lesson changes belong in `backend/app/core/game_services.py`; Shor planning,
execution result processing, and factor extraction belong in
`backend/app/core/shor_service.py`. Both targets call these implementations.
FastAPI routes provide HTTP validation, worker timeouts, signed tokens, and local
Aer selection. `game/qollab/python/quantum/services.py` provides the browser bridge
and Qollab capability limits. Classical primitives also remain shared in `core/`.
`npm run build:qollab` copies the current core modules and requirements into the
upload folder automatically; do not edit generated files under `game/dist/`.

See [Qollab delivery and test notes](docs/qollab-deployment-plan.md) for the
package layout, validation limits, and test checklist.

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Compose builds the game’s development stage and bind-mounts its source, so it
does not run a production Next build on every local image rebuild. The game
Docker context excludes local `node_modules` and `.next` output. For a release,
`deploy-cloudrun.sh` builds a separate standalone production image. If only
the game changed, use `./deploy-cloudrun.sh game` to reuse the deployed backend
instead of rebuilding its Qiskit dependencies.

- Game: http://localhost:7019  
- Backend: http://localhost:7001/api/health  
- Slides (optional): http://localhost:7013, started with `docker compose --profile slides up`  

The ports are four-digit primes so the stack never collides with the 3000/8000
crowd that every other dev server defaults to.

The backend installs `qiskit-qward` from PyPI, so nothing outside this repo has
to be checked out. To work against a local qward instead, mount it over the
installed copy and reinstall it editable in the container.

## Local (no Docker)

Start each service in a separate terminal, beginning at the repository root.

```bash
# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 7001
```

```bash
# Game (with the backend running)
cd game && npm install
BACKEND_URL=http://localhost:7001 npm run dev
```

```bash
# Presentation (optional)
cd frontend && npm install && npm run dev
```

## Game controls and installation

Walk with arrows/WASD, the on-screen pad, or a click/tap on the map.
Press Space or tap Talk near a person,
door, or sign. The shared laptop holds experiments; closing it preserves results.
EN / ES switches language without resetting progress. Start over can reset a
lesson, RSA act, or the whole game; language and sound settings are retained.

The game can be installed as a PWA over HTTPS or localhost. Use a production
build to test installation, with the backend running:

```bash
cd game
BACKEND_URL=http://localhost:7001 npm run build
BACKEND_URL=http://localhost:7001 npm start
```

Open http://localhost:7019 and use the browser's install action. The app supports
portrait and landscape orientations and uses a network-only service worker, so
it requires a connection. Development and production servers share port 7019; run
one at a time.

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
