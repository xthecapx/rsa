# Quantum Playground: development context

This file describes the implemented game and the conventions to preserve when
changing it. Use the code as the source of truth for exact behavior. Keep this
context current as features change; completed feature plans do not need separate
Markdown files. See [README.md](README.md) for setup, deployment, and IBM data.

## Repository

- `game/`: the playable game, built with Next.js 15, React 19, Excalibur, Zustand,
  and dnd-kit. It runs on port 7019 and rewrites `/api/*` to `BACKEND_URL`
  (default `http://localhost:7001`). Production builds use Next's standalone output.
- `backend/`: Python 3.11+, FastAPI, Qiskit, Aer, IBM Runtime, and qiskit-qward.
  Classical tools and quantum simulations share this backend with the presentation.
- `frontend/`: a separate presentation app on port 7013, with depth tiers and IBM
  batch results. It is not the game's UI.
- `docker-compose.yml` and `deploy-cloudrun.sh`: local services and Cloud Run deployment.
- `game/qollab/`: browser entry and thin Python adapter for the Qollab target.
  `npm run build:qollab` produces `game/dist/quantum-playground-qollab.zip`;
  `npm run build` retains the Next.js/HTTP target. Qollab injects the selected
  simulator or physical QPU; service calls use a queued Pyodide bridge instead of HTTP. Assets
  and recorded IBM data are embedded, with their licenses retained. Fonts use
  pinned HTTPS Fontsource URLs with system fallbacks because Qollab blocks data fonts.
  Ghost Key keeps 25 data qubits plus its helper; IBM fake backends use MPS for
  this circuit. Physical QPU jobs run only after a player presses Run; startup,
  language changes, and restoring a checkpoint never submit one. See README for delivery.

The web game’s persistent Simulation selector offers ideal Aer and an Aer teaching
noise model (0.3% single-gate, 1% CNOT depolarization, 2% readout error). This is not
an IBM calibration. Each quantum HTTP request carries `X-Quantum-Simulator`; no
server-global preference or credentials are shared between players. Native Ghost
Key uses stabilizer for ideal runs and MPS for noisy runs. Qollab’s choice comes
from its own QPU picker and ignores the web preference. Recorded IBM RSA results
remain a separate source. Result metadata persists with the result; changing the
preference affects only future runs, including Quantum Town replays.

## World and progression

Players begin in Coin Town. Every teaching town has five knowledge cards and a
lesson; cards are required for its badge, but never to enter the lesson.

| Town | Spanish name | Implemented lesson and role |
| --- | --- | --- |
| Coin Town | Pueblo Moneda | Mayor Cap; single-qubit cards; **Who Goes First?** in Ale's house. |
| Foundry Town | Pueblo Forja | VP Cap; register and Grover cards; **Echo Chamber** in Thecap's workshop. |
| Hollow Town | Pueblo Sepulcral | Keeper Cap; cemetery, CNOT and phase-kickback cards; **Operation Ghost Key** in Casa Ofelia. |
| Cipher Town | Pueblo Cifrado | Root Cap; cryptography cards; **Breaking RSA** on Ale and Brayan's street. |
| Quantum Town | Pueblo cuántico | Professor Thecap; replay hub with doors for the lessons and an RSA replay street. |

The Coin badge opens Coin Town's east road to Foundry. The Foundry badge opens
Coin Town's west road to Hollow. The Hollow badge opens Coin Town's north road
to Cipher. The Cipher badge requires all four RSA acts and opens Cipher's north
road to Quantum. Older saves that reached the hub retain access; a temporary
travel pass also has its own route rules. See `game/game/roads.ts`.

Cipher's client pays an advance and a fee per completed act, each once. Chispa
sells the sniffer, shift wheel, factor kit, and QPU voucher required by the four
jobs. Cero offers repeatable generated bounties. The Quantum replay street shares
the Cipher checkpoint and skips the gear check. Older RSA completions retain
their earned gear.

## Lessons

Coin Town's one-qubit neighbor benches run their named starting states and X/Z/H
gate sequences through `/api/coin/circuit` on both delivery targets, with 256 shots
per case. Python/Aer and Qollab share lesson logic in `backend/app/core/game_services.py`,
Shor processing in `backend/app/core/shor_service.py`, and the circuit builder in
`backend/app/core/coin_circuit.py`. Barriers preserve consecutive gates such as
Marisol's H→H during transpilation. Histograms display returned counts and backend
identity; ideal state traces, probabilities, and waves are labeled references.
Exercise correctness comes from the ideal designed state, never noisy counts.
Editing clears the previous result and solved state. Laptop close and next/reset
actions are disabled during execution; closing/reopening retains the current
neighbor's circuit and counts without resubmitting. The coin house uses the same
count histogram and retains simulator kind in the measurement explorer.

- **Who Goes First?**: assemble a seeded Python coin function from known
  instruction IDs; compare Ale and Brayan's five-call sequences and inspect the
  sixth call; measure a fresh zero; build H followed by measurement; compare
  100 and 1,000 shots; make one final measured toss (0 = Ale, 1 = Brayan).
  The scaffold never executes arbitrary player Python. The private PRNG starts
  with seed 42 per backend request. Aer runs a real one-qubit circuit, with at
  most 1,024 shots. The final decision is saved and is not rerolled on refresh.
Foundry and Hollow neighbor register benches and Foundry’s rounds dial now run
real 2–4-qubit circuits through the shared `core/register_circuit.py`. Displayed
wire 1 is Qiskit’s highest-index wire, matching the frontend register math.
Every editable operation has a barrier. Histograms show 256 returned shots;
amplitude bars, card requirements, and round targets remain ideal references.
Busy controls, edit invalidation, and close/reopen retention match Coin Town.

- **Echo Chamber**: search sixteen PINs with a four-qubit Grover circuit and
  three classical guesses. One round is the oracle followed by the diffuser;
  the initial H layer prepares the register. Three rounds give about 96% success,
  not a guarantee. Preview runs sample 256 fresh preparations and return counts
  in shuffled anonymous bar order. The final collapse remains one shot.
  Device tokens identify the puzzle; the backend validates the
  circuit and round count before the final measurement.
- **Operation Ghost Key**: recover a 25-bit secret using a parity oracle and a
  helper qubit in |−⟩. Classical questions consume three candles; checking a whole
  key is a separate interaction. Bernstein–Vazirani uses one ideal quantum query.
  The backend uses Aer's stabilizer simulation for this Clifford circuit. The
  large Grover comparison is an estimate, not a second implemented search circuit.
  In Qollab, ideal phase frames explain the algorithm while the selected
  backend supplies the measurement. Noise can yield a wrong key; retry is
  available without changing the secret. The 24/25-qubit local devices are too small.
- **Breaking RSA**: four acts cover letter encoding, Caesar shifts, small RSA,
  and Shor's quantum/classical pipeline. Each act runs prologue → client briefing
  → install a listener → intercept → decode in the laptop → type the plaintext
  at the car. Wrong reports raise suspicion; reaching 100 offers a retry.
  Arithmetic and circuit tools call the backend. IBM views read existing batches
  or recorded hardware results. The web server does not submit IBM jobs; Qollab
  can submit a fresh run to its selected physical QPU as a separate option.

## Where to change behavior

Paths below are relative to the repository root.

| Concern | Main locations |
| --- | --- |
| World entry, travel, mission offers | `game/app/page.tsx`, `game/components/TownScreen.tsx` |
| Town cast, cards, locations | `game/content/{coinTown,foundry,hollow,cipher,town}.ts`, `game/content/knowledge.ts` |
| Town UI and shared configuration | `game/components/WorldTownScreen.tsx` and the town screen components |
| Outdoor scenes, maps, movement | `game/engine/`, especially `scenes/WorldScene.ts`, `maps/`, `createGame.ts`, `bus.ts` |
| Lesson metadata and prose | `game/content/scenarios.ts`, `game/content/{coin,grover,vault}.ts` |
| Interior lessons and room movement | `game/components/{CoinScenario,GroverScenario,VaultScenario}.tsx`, `game/game/*Room.ts` |
| RSA scripts and validation | `game/content/acts/act1.ts` through `act4.ts`, `game/content/{defineAct,types,index}.ts` |
| RSA state, dialogue, effects, async ownership | `game/game/{state,dialog,effects,runtime,town}.ts` |
| Progress, cards, badges, economy | `game/game/{progress,knowledge,medals,wallet,travelPass}.ts` |
| Shared UI | `game/components/{GameShell,LaptopShell,DialoguePresentation,SceneLoading,TouchControls}.tsx` |
| Tools and math | `game/components/` benches/workbenches, `game/game/{qubit,register,crypto,calc,histogram}.ts` |
| API clients and implementations | `game/lib/`, shared `backend/app/core/{game_services,shor_service,coin_circuit,register_circuit}.py`, HTTP adapters in `backend/app/api/routes/`, Qollab adapter in `game/qollab/python/quantum/services.py` |
| Translation | `game/i18n/{index,translate}.ts`, `game/i18n/es.json` |
| Sound and PWA | `game/game/{audio,synth}.ts`, `game/public/sw.js`, `game/components/PwaBootstrap.tsx` |
| Visible viewport and mobile layout | `game/game/viewport.ts`, `game/components/ViewportBootstrap.tsx`, `game/app/globals.css` |

Dogs and cats in the teaching towns can be petted: Space or the contextual Pet
button when nearby, or click/tap an animal to walk over and pet it. They pause
near players and respond with a floating heart and a translated status message.
Petting does not open a dialog or change lesson progress. Other animals still
wander normally.

Excalibur owns outdoor pixels and animation; React owns text and tools. They
coordinate through the Zustand game store and typed command bus. Preserve one
active engine, pause movement during overlays, and require a fresh interaction
press after closing a conversation. Interior lessons share the shell and return
flow while owning their room and workbench.

RSA scripts use `defineAct` to validate node IDs, reachable exits, choices, and
checklist effects. Interpolation variables are defined in `content/index.ts`.
Keep effects typed: backend calls, walking, packets, bubbles, tap glow, panels,
tasks, captured payloads, and flags belong in the effect system.

## Saves and shared controls

Progress is browser-local; no account or database is required. Towns, lesson
sessions, completion, knowledge, and wallet state have separate stores. Preserve
existing save keys and migration behavior. Quantum replay doors reuse the same
lesson sessions. Language and mute preferences persist independently of progress.
Persisted Zustand stores use `game/game/storage.ts` to keep their hydration APIs
available when iframe/private-mode storage is blocked. Its in-memory fallback
retains state across rehydration for the current run only; existing browser save
keys and serialization are unchanged.

RSA checkpoints contain serializable story progress, secrets, suspicion, captured
messages, and laptop results. Restore the last safe checkpoint without rerunning
entry effects or resubmitting unfinished work. Async operations belong to the
runtime generation; stale results must not mutate a newer run. Leaving or resetting
is disabled while a computation or scripted sequence finishes.

Start over supports individual lessons, the current RSA act, all RSA, and the full
game. Full reset clears exploration and progress but retains language and sound.
Legacy scenario and act URLs resolve entry hints and normalize to `/`; opening
an act link must not silently discard an existing attempt.

Keep keyboard, mouse, and touch controls equivalent. Outdoor towns show a
circular thumbstick on touch devices and a round Talk button on the right. Talk responds on touch press
to support a second finger while the stick is held, without duplicating a click.
Drag past the dead zone to
walk in a cardinal direction; release, pointer cancellation,
rotation, leaving the tab, or opening an overlay clears held movement. Block
builders support drag, tap a block then a slot, and keyboard selection. Shared laptop contents survive
closing; language changes preserve circuits, puzzle answers, and results. Objectives
start collapsed and become a sheet on small screens. Loading failures need a
translated retry action and inactive gameplay controls until initialization ends.

## Narrative and Spanish

Edit English prose and Spanish together. Use short, natural dialogue with distinct
character voices and a clear next action. Preserve lamps, paint, bells, ghosts,
and padlocks as metaphors while explaining the quantum idea. Name actual badge
requirements. Spanish uses broadly understood Latin American phrasing and informal
singular instructions ("prepara", "arrastra", "mide"); translate idioms by meaning.
Keep the town names in the table exactly, including **Pueblo cuántico**, and retain
**Quantum Playground** as the game name.

| English | Spanish |
| --- | --- |
| qubit / qubits | cúbit / cúbits |
| gate | compuerta |
| shot / shots | ejecución / ejecuciones |
| laptop | portátil |
| helper qubit | cúbit auxiliar |
| phase kickback | retroceso de fase |
| plaintext | texto sin cifrar; texto claro in compact labels |
| ciphertext | texto cifrado |
| sniffer / listener device | dispositivo de escucha |
| vault tumbler | cilindro |
| vault's secret mask | código secreto |

A fair coin is "equilibrada"; use "cara" and "sello" consistently. Distinguish
simulation from physical quantum randomness; balanced counts do not prove a quantum
source. Each shot starts from a fresh preparation, unlike repeatedly measuring
one qubit. Explain superposition using amplitudes and measurement probabilities.
Bernstein–Vazirani's parity problem takes one ideal quantum query versus n
classical queries for n bits; this is not an exponential advantage. Shor returns
measurement samples; classical processing finds and checks candidate periods,
then extracts factors using a coprime base, an even period, and a suitable halfway
value. Tiny demonstration RSA moduli are distinct from real RSA key sizes.

`es.json` uses English display messages as keys and supports templates. Preserve
every `{placeholder}`, formula, code instruction, puzzle answer, state ID, and API
value. Translate labels and explanations, including technical displays. Keep old
English keys as aliases when they may occur in persisted RSA checkpoints. Unknown
backend diagnostics retain the existing fallback. RSA puzzle plaintext stays in
English; Spanish instructions explain this to players.

## Assets and delivery

Preserve the Kenney CC0 license files under `game/public/assets/`. Cast and NPC
sprites, PWA icons, and map previews have generator scripts in `game/tools/`.
Audio unlocks on a user gesture; mute persists. Computation audio has one owner
per successful run and must not overlap or replay on checkpoint restoration.

The PWA is installable and supports portrait and landscape without an orientation
lock or rotation notice. Its service worker is
network-only. Builds generate `NEXT_PUBLIC_PWA_BUILD_ID`; `PWA_BUILD_ID` can override
it. New workers clear old `mitm-shell-*` caches and reload clients. Development
unregisters leftover workers. Preserve this behavior when changing asset delivery.

## Validation

For game changes, run appropriate checks from `game/`: `npm test` for behavior and
translation integrity, `npx tsc --noEmit` for types, and `npm run build` for
production validation. Backend tests live in `backend/tests/` and run with `pytest`
from `backend/` after installing the development dependencies. Documentation-only
changes need reference and whitespace checks rather than a full build.

For UI, prose, or save changes, smoke-test the affected lesson in both languages,
keyboard and touch interactions, laptop reopen, and refresh/resume. Check that a
language switch preserves results and that restoring a save never repeats a toss
or backend operation.

Mobile overlays and the engine container share the visible viewport, including
keyboard resize and pan. Use the shared viewport variables instead of independent
window-height calculations. Excalibur positions the touch canvas in
FitContainerAndZoom; keep its host out of flex centering to avoid doubling the
crop offset. The shared camera in `game/engine/camera.ts` clamps to the visible
content area so players remain visible near map edges in either orientation.
Dialog text scrolls separately from its action row; every story step needs a
visible button. Preserve tap-to-place as well as drag
and keyboard input in puzzle builders. Check short landscape screens with browser
bars visible and report fields with the keyboard open. Mobile dialog portraits stay visible at 40px in both orientations. Mobile prose
is two pixels
smaller. Existing small labels and code keep their sizes; form inputs stay 16px
to avoid focus zoom. Minimap panels start collapsed on touch devices, remain
scrollable when expanded, and preserve the player’s toggle when rotating. Wide
laptop circuits scroll horizontally and also support tapping a piece then its slot.
