# qWard: A Quantum Computing Adventure

This effort is supported by Qollab & IonQ

Playable quantum-computing scenarios on a road of small towns: **Who Goes
First?** in Coin Town, **Echo Chamber** (Grover) in Foundry Town, **Operation
Ghost Key** (Bernstein–Vazirani) in Hollow Town, and **Breaking RSA** in Cipher Town,
across plaintext, Caesar, RSA, and Shor. The optional **Quantum Campus** offers
eight interactive foundations exhibits and a science-festival badge. See [AGENTS.md](AGENTS.md) for the current
game structure and development context. The separate `frontend/` presentation tool retains its depth tiers
and IBM batch readout.

## Origin and hackathon work

qWard: A Quantum Computing Adventure began as an idea for teaching quantum computing through
familiar classical software problems: fair choices, search, hidden information,
and cryptography. For the hackathon, the existing game was adapted to Qollab with
shared Python services, selected-backend measurements, and checkpoint codes. The
adventure also gained the optional Quantum Campus and a customizable quantum lab.
The game shares its name with [qWard](https://pypi.org/project/qiskit-qward/), the
quantum-circuit analysis library developed as part of the author's PhD research.
The [project description](docs/project-description.md) is ready to copy into the
Qollab project page. Use the [demo pitch](docs/demo-pitch.md) to practice a
2–3 minute screen-sharing presentation for the Quantum Unlocked category.

## License

Original project code and documentation, including `game/`, `backend/`, and
`frontend/`, are released under the [MIT License](LICENSE). Third-party code,
assets, and fonts retain their respective licenses and notices. The Qollab upload
includes the project `LICENSE` and a consolidated `THIRD-PARTY-NOTICES.txt`;
upstream license files remain in the source tree.

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

Docker builds use public npm/PyPI, with Node 22 for the game. The script checks
the game's clean dependency install before deploying either service. Keep
`game/package.json` and `game/package-lock.json` together; the lockfile must use
public npm tarballs. Vite and the Qollab bundler share a compatible esbuild version.

BuildKit caches npm/pip downloads and Next's compilation cache. Source-only edits
reuse dependency layers. The backend production image contains runtime packages
and application code; compilers, tests, and development dependencies are excluded.
Docker Compose selects its separate development stage, retaining pytest and httpx.
The game already ships Next's standalone output, not the full build environment;
generated Qollab exports are excluded from its Docker context.

If the backend deployed successfully but the game failed, retry only the game:

```bash
./deploy-cloudrun.sh game
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

## Development checks

Use Node 22.12+ for the game and its React regression tests. From `game/`:

```bash
npm ci
npm run check          # ESLint, TypeScript, Node tests and React interaction tests
npm run build          # Next.js / Python HTTP target
npm run build:qollab   # regenerate and verify the upload folder
```

`npm run test:unit` runs the domain/save/translation checks; `npm run test:ui`
runs the Vitest and Testing Library checks in jsdom. These tests need no running
backend and no generated distribution. Format only edited files with
`npm run format -- <paths>` and verify them with `npm run format:check -- <paths>`.
Backend checks run from `backend/` with `pytest` in its development environment.

The lab separates circuit editing, equipment permissions, presentation and explicit
execution. Lesson saves share hydration/writing while keeping their existing keys
and migrations. HTTP and Qollab still use the same domain services; the shared
request helper never retries quantum jobs automatically. See `AGENTS.md` for
ownership boundaries and the required real-browser checks.

## Extend the game

Start with `game/content/` for lessons, dialogue, and town definitions, and
`game/components/` for laptop experiments. Quantum circuits and classical tools
belong in `backend/app/core/`, shared by FastAPI and the Qollab adapter. Update
English and `game/i18n/es.json` together. Run the development checks and rebuild
the Qollab folder after changing shared services; generated files are not edited
directly. See [AGENTS.md](AGENTS.md) for progression, saves, and execution rules.

## Quantum Campus

New games begin in **Coin Town**, where Mayor Cap invites players to visit
**Quantum Campus** for optional quantum fundamentals. Returning saves continue
where they left off. Walk south from Coin Town to visit the campus;
you arrive at its north gate beside the guide and notebook. Start with Rosa’s
workshop to the left and follow the exhibits south toward the festival. The north
road leads back freely, with no badge requirement. The disturbed sand
near the campus’s eastern wall hides another entrance to your shared personal lab.

Help students prepare a science festival through eight open-air demonstration
stands. Decorated tables, laptops, colorful rugs, experiment apparatus and picnic
seating make the campus a quantum fair in a park:

| Exhibit | Try it |
| --- | --- |
| Quantum workshop | Arrange preparation, control and measurement; compare X and H. |
| State passports | Connect the Bloch picture, ket and vector using θ and φ. |
| Circuit delivery line | Place and reorder gates; compare circuit and matrix order. |
| Superposition fountain | Compare plus/minus states before and after the H lens. |
| Entangled observatory | Compare independent, Bell and classical-correlated models in Z/X. |
| Measurement arcade | Run one shot and batches of fresh preparations. |
| Quiet room | Introduce environmental dephasing and inspect lost interference. |
| Reversible machine shop | Explore X/Y/Z rotations and undo them with an inverse. |

Talk to each host to hear their problem, make a prediction, and choose an
experiment. Close the laptop to discuss your actual measurements, then help with
a practical repair: match passports, label drawers, fix instructions, advise a
visitor, or set an inverse rotation. Wrong predictions and answers lead to clues;
valid measurements remain available without repeating a run. Finished hosts
welcome free experimentation. The guide can suggest a topic or unfinished visit.

Use **Play**, **Explain**, or **Show the math** at any time. **Open the Festival**
is a separate three-repair activity that can be attempted directly. Its
**Quantum Explorer** badge never unlocks or blocks a town or lab equipment.
The searchable **Campus field notebook** is also available inside lesson
and personal-lab laptops without leaving the current experiment.

Only **Run** executes a circuit. Histograms show returned measurements; Bloch,
ket/vector, density-matrix and interference displays are labeled ideal references.
The Python version uses your ideal/noisy Aer selection. Qollab uses its selected
local simulator; when IonQ or a physical QPU is selected, campus practice uses
BasicSimulator, preserving the remote job for a final challenge or lab experiment.
Completion depends on the intended experiment and explanation, not perfect noisy counts.

The quiet room explicitly models E_d(ρ)=(1−d/2)ρ+(d/2)ZρZ for d between zero
and one, with a coupled, unobserved helper. Coherence decreases monotonically;
100% means full dephasing. This teaching channel is separate from device noise.
Only data qubits are measured. The observatory’s envelopes model likewise uses
a dephased Bell preparation; comparing its Z/X distributions with a Bell pair
does not constitute general certification of entanglement.

Browser saves retain unfinished conversations, predictions, application drafts,
settings, explanations, returned results, up to six recent measurements per exhibit,
pinned investigation comparisons, discoveries and festival progress. Older earned
discoveries and valid results are retained. Short checkpoint codes restore milestones,
not these exact conversations or experiments.
Refresh or reopening never resubmits work. When storage is blocked or the runtime
restarts, use **Save progress**: `qc1` restores campus arrival, `qc2` restores all
eight discoveries, and `qc3` restores the orientation and festival badge preset.
These independent shortcuts merge existing progress without granting other towns’
medals, cards, money or equipment. They do not encode experiment results.
Campus restart retains the earned badge; full-game reset clears campus progress.

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
The upload contains exactly 20 files: five browser files, twelve Python package
files, `requirements.txt`, `LICENSE`, and `THIRD-PARTY-NOTICES.txt`. Recorded IBM data is
bundled into `main.js`; images/audio referenced by the game live in `assets.js`.
`requirements.txt` explicitly declares `qiskit>=2.5.2,<3.0.0` for Qollab's Python runtime.

The generated distribution and `game/dist/build-report.json` are ignored by Git.
Rebuild them locally with `npm run build:qollab`; commit the source and build tools.
The report is for review and stays outside the upload.
It lists file sizes/hashes, included/omitted assets, and the largest JS modules.
The esbuild production bundle removes unused code and minifies JS/CSS.
The build refreshes the folder and report without creating a ZIP.
To replace an older upload, remove its obsolete `recorded.js`, `build-info.json`,
and obsolete separate third-party license files; keep the new project `LICENSE`
and consolidated `THIRD-PARTY-NOTICES.txt`.
Use a fresh project file tree when possible.

Choose a free **IBM noise-model simulator** for the full game. Ghost Key retains
25 data qubits plus its helper; the built-in 24-qubit simulator and Braket's
25-qubit local simulator cannot run that lesson. The adapter passes the full
circuit to the selected IBM simulator using matrix product state simulation.
Noisy measurements may fail the key check, so the player can retry. Hardware
jobs are enabled when a physical QPU is selected in Qollab. IonQ remote
simulators and physical QPUs run final town challenges or explicit personal-lab
experiments: the Coin final toss, Grover final measurement, Ghost Key recovery,
and the RSA Shor run.
Practice uses the built-in ideal simulator and labels its actual counts. One
remote submission is allowed per Qollab code Run, shared by lab experiments and
final challenges; a second is blocked locally. The lab always uses the selected
backend and explains this allowance before Run.
After reviewing the result and collecting the badge, press **Stop**, then
**Run** in Qollab for the next final challenge (or to retry after a noisy failure).
Ghost Key needs Forte/Forte Enterprise (29 qubits); Aria (25) is too small.
The server version preserves main lesson sessions and progress in browser storage.
Neighbor benches retain unfinished activities and counts during the current visit;
earned knowledge cards survive refresh, but those bench activities restart.
Qollab's
sandbox does not persist storage across runs, so keep a short checkpoint code
before restarting. Export a custom lab plan too; checkpoint codes restore medals,
not furniture layouts. No automatic job is submitted on startup or restoration.
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
live RSA simulations, campus exhibits and personal-lab experiments use this preference. Saved
results retain their original backend metadata. Full game resets retain this
preference, like language and sound.
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

### Short lesson checkpoints

Knowledge cards are optional. Earn Quantum Coin to open Foundry Town, Amplitude
Amplifier to open Hollow Town, and Ghost Key to open Cipher Town. Completing all
four RSA acts opens Quantum Town. Challenge medals unlock these roads directly;
the greeters' extra town badges require only the challenge, and older earned
town badges still unlock their roads.

**Save progress** in the top bar or laptop shows a short checkpoint code to keep
before restarting or changing backends. The same codes work in both the Python
server and Qollab versions. Enter one in the same menu after restarting, or
choose a checkpoint directly to reach a lesson quickly. Coin Town
uses `ct1` (arrival), `ct2` (all five neighbor lessons complete), and `ct3`
(town challenge complete / next road open). Foundry uses `ft1`–`ft3`, Hollow
uses `ht1`–`ht3`, and Cipher uses `ci1`–`ci3`. `qt1` opens Quantum Town's replay hub.
Later-town codes restore earlier town badges and required RSA gear for completed
acts. These are public teaching milestones, not full save snapshots: incomplete
neighbor activities, individual circuits, puzzle answers, measurements, and RSA
mid-act checkpoints are not encoded. Code 3 is available after the challenge
even without cards; its preset also restores optional neighbor lessons and the
town badge, preserving the existing codes. Earned medals keep code 3 available
during lesson replays; a full reset clears them. Existing progress in the current run is
retained; restoration never executes a circuit or changes the selected backend.

### Personal quantum lab

From Coin Town's southern arrival area, follow the narrow path east to the hidden
cave on the right side of the map. Every later town also has a passage into this
same lab. No medal is required to enter or run the starter experiment. Inspect
disturbed sand or loose stones to reveal a passage, then choose **Enter the lab**.
Discovery saves
immediately, even if you keep exploring. An **L** marker appears only after
discovery. Leaving returns to the town and passage you entered from.
The journal offers a directional hint in each town. Checkpoint codes reveal the
destination town’s passage; the code shown inside the lab follows its entry town.

The scene stays within the visible screen and its camera follows the player.
Equipment supplies scroll separately. Larger caves show a minimap with the player
and camera area; tap it to walk across the base. On small screens, open the
minimap or supplies when needed without scrolling the scene.

Lab furniture, storage, plants and stone tiles use Kenney's CC0 Roguelike Indoors
and Caves & Dungeons art. Matching previews appear in the supplies list and build
grid. The original sheets and licenses live in `game/public/assets/kenney/lab/`;
sprite changes do not alter saved layouts or equipment footprints.

**Build mode** supports placing, moving, rotating, storing and undoing furniture.
Use drag, tap an inventory item then a floor tile, or keyboard selection. Placement
checks bounds, overlapping footprints and access to the entrance and equipment.
Challenge medals expand the cave and unlock free supplies:

| Medal | Acquirable equipment |
| --- | --- |
| Quantum Coin | X/H/Z gate modules, Rotation R(θ) around X/Y/Z, Bloch display, garden |
| Amplitude Amplifier | Register kit and Grover algorithm box |
| Ghost Key | Controlled-gate and phase-kickback box |
| Four RSA medals | Classical crypto toolkit and quantum period explorer |

Acquire equipment in the supply catalog, then install laptop modules or place
physical furniture. Knowledge cards are optional. Existing town badges also grant
compatible unlocks; restoring a checkpoint never duplicates an item or changes a
custom layout. Construction is free and independent of Cipher's mission wallet.

The quantum laptop is a free-play workspace with a full-width circuit builder,
ideal state explorer and measured results. Open the component picker with **+**
beside the floating Clear/Run buttons, then drag a gate or select it and tap a wire.
The whole block is draggable, with no separate grip; on a phone, hold the block
briefly to drag and swipe outside blocks to scroll.
Tapping a wire's **+** also lets you choose and place a gate directly; loading a
starter recipe is optional. Select a placed gate and use its **×** button to
remove only that operation, or press Delete/Backspace on the focused gate. Clear
cancels any picked-up piece and resets the editor for a fresh circuit.
Selected blocks show left/right arrows underneath for reordering. Drag a block
to change its target qubit. Its settings button opens floating rotation-angle,
control-wire or oracle-bit controls without taking space from the circuit.
Qubit controls explain equipment unlocks and warn
that changing the count clears the circuit. It supports 1–4
qubits, at most 32 operations and 1–1,024 shots. Rotation uses an X/Y/Z axis
selector and a circular θ angle dial,
numeric degrees and presets, with a π reference. Turn clockwise for positive
angles and counterclockwise for negative angles, within ±360°. The saved circuit
and backend continue to use radians. The Bloch display is an ideal single-qubit
reference for all three axes; returned counts do not reconstruct it. Complex
amplitudes retain phase during mixed rotations. Existing Y rotation equipment
and saved Ry recipes remain compatible. Multi-qubit recipes show register
amplitudes.
Grover and phase-kickback boxes load editable oracle/diffuser/helper recipes.
The period box runs a separate N=15, a=7 Shor experiment.

Only **Run** submits work. Editing, acquiring items, moving furniture, importing a
plan, switching language and restoring progress never submit a job. Results keep
their circuit snapshot and actual backend identity; edits label them as previous
runs. Closing/reopening retains current-visit results, and successful experiments
keep Run available. The Python build uses the player's ideal/noisy Aer preference;
Qollab uses its selected backend, including its remote job limit.

Layouts, ownership, installations and named recipes persist in the separate
`quantum-player-lab-v1` save. **Export / import lab** provides a versioned JSON file
and copy/paste fallback for restarts or switching delivery targets. Keep a short
checkpoint code separately for medals. Import validates layout and recipes without
awarding medals; unavailable equipment waits in storage. Results and provider jobs
are transient and excluded from exports. Lesson resets retain the lab; full-game
reset clears it. **Reset lab layout** restores only the starter arrangement.

Both targets share `/api/lab/run`, the validated circuit builder in
`backend/app/core/register_circuit.py`, and execution/result handling in
`game_services.py`. Native HTTP exposes the route through `api/routes/lab.py`;
Qollab copies the shared core unchanged and applies only provider policy.

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
