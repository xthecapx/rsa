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
  `npm run build:qollab` produces the upload folder `game/dist/qollab/`;
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

Fresh games and full-game resets start in Coin Town. Mayor Cap introduces the
optional Quantum Campus for fundamentals via the open south road; there is no
starting-choice screen. Existing saves stay at their saved location. Every
teaching town has five knowledge cards and a
lesson. Knowledge cards are optional practice. Completing each challenge earns
its medal and opens the next road directly; no neighbor cards or town ceremony
are required. Each greeter also offers a town badge after its challenge, without
a card requirement.

| Town | Spanish name | Implemented lesson and role |
| --- | --- | --- |
| Quantum Campus | Campus Cuántico | Optional science festival; eight foundations exhibits and **Open the Festival**. |
| Coin Town | Pueblo Moneda | Mayor Cap; single-qubit cards; **Who Goes First?** in Ale's house. |
| Foundry Town | Pueblo Forja | VP Cap; register and Grover cards; **Echo Chamber** in Thecap's workshop. |
| Hollow Town | Pueblo Sepulcral | Keeper Cap; cemetery, CNOT and phase-kickback cards; **Operation Ghost Key** in Casa Ofelia. |
| Cipher Town | Pueblo Cifrado | Root Cap; cryptography cards; **Breaking RSA** on Ale and Brayan's street. |
| Quantum Town | Pueblo cuántico | Professor Thecap; replay hub with doors for the lessons and an RSA replay street. |

Quantum Coin opens Coin Town's east road to Foundry. Amplitude Amplifier opens
Coin Town's west road to Hollow. Ghost Key opens Coin Town's north road to Cipher.
All four RSA act medals open Cipher's north road to Quantum. Older town badges
also unlock their roads, and saves that reached the hub retain access. Short checkpoint
codes provide explicit lesson shortcuts; URL travel passes have been removed.
See `game/game/roads.ts`.

Cipher's client pays an advance and a fee per completed act, each once. Chispa
sells the sniffer, shift wheel, factor kit, and QPU voucher required by the four
jobs. Cero offers repeatable generated bounties. The Quantum replay street shares
the Cipher checkpoint and skips the gear check. Older RSA completions retain
their earned gear.

## Quantum Campus

The optional campus is a science-festival courtyard, joined to Coin Town by a
permanently open road (campus north, Coin south). Arrivals and campus checkpoint
shortcuts start at the north gate facing south, beside the guide and notebook.
Paved aisles run between the pavilions; the suggested exhibit order runs from
north to south, ending at the festival. Existing saved positions are retained.
All eight exhibits and the
three-repair festival are available immediately. `quantum-explorer` is an optional
badge; it never changes roads, knowledge cards, wallets or lab equipment unlocks.
The exhibits cover preparation/control/measurement, kets and amplitudes, circuit
order, superposition/interference, entanglement versus classical correlation,
shots/histograms, decoherence, and X/Y/Z rotations/unitaries. Play, Explain and
Show the math share ideal references and actual returned counts. The searchable
field notebook also appears as read-only help in shared lesson and lab laptops;
opening it preserves work and never submits a job.

`content/campus.ts` owns content/IDs; `CampusScreen`, `CampusLaptop`,
`CampusNotebook` and `CampusVisual` reuse world/laptop/builder/histogram controls.
`game/campusExperiment.ts` owns request and design-evidence rules. Only explicit
Run executes `/api/campus/run`, through shared `core/register_circuit.py` and
`core/game_services.py`; `api/routes/campus.py` adds the HTTP adapter. Qollab
copies the same core without a new Python package file. Campus work is practice,
so IonQ/physical selections use BasicSimulator and leave the remote allowance
untouched; other selections and HTTP ideal/noise choices follow existing policy.
Returned metadata identifies the actual execution backend. No completion rule
requires exact noisy counts.

The quiet room uses a gate-only environment dilation for the explicit channel
E_d(ρ)=(1−d/2)ρ+(d/2)ZρZ, d∈[0,1]. An unobserved helper starts with
Ry(2 asin(sqrt(d/2))) then controls Z on the data; tracing it out shrinks
coherence by 1−d. d=1 fully dephases, never becomes a deterministic Z.
The envelopes comparison dephases a Bell pair with an unobserved helper. Only
data wires appear in returned bitstrings, top wire first. Ideal channel/reference
predictions exclude additional backend noise. Z/X comparisons distinguish these
specific models; the game makes no general entanglement-certification claim.

`quantum-campus-v1` saves exhibit settings, explanations, successful execution
evidence, latest counts and up to six comparison snapshots per exhibit, festival
stage, discoveries and exhibit visits. Hydration validates saved results and
never repeats a job. Blocked storage retains only current-run memory. Campus
restart clears its experiments/orientation while retaining the earned badge;
full-game reset clears campus too and returns to Coin Town. Existing
`quantum-town-v1` saves discard the retired `entryChosen` flag without moving the player.
Independent codes `qc1` (arrival), `qc2` (all eight discoveries) and `qc3` (festival
badge plus orientation preset) merge campus milestones only. They never grant
other town completion or encode circuits/results. Busy operations block travel,
restore, restart and closing the executing laptop.

## Personal lab

Each outdoor town has a concealed sand-and-stones entrance to one shared, ungated
personal lab. `content/labEntrances.ts` owns entrance/standing tiles and hints:
Campus (34,30), Coin (36,25), Foundry (25,9), Hollow (12,10), Cipher (19,29),
Quantum (57,28).
Inspect reveals and saves only that town’s entrance before offering entry; ordinary
fog exploration never exposes its name or L marker. Revealed passages enter directly.
The shared Kenney entrance actor updates through the typed bus and respects reduced
motion. `game/labTravel.ts` owns discovery and guarded travel; `town.ts` persists
validated `labFrom` and per-town `labEntrances` under its existing save key. After
both stores hydrate, legacy lab discovery migrates to Coin only. Invalid/missing
origins default to Coin. Return controls and the physical lab exit use the same
registry standing tile and face away, requiring a fresh interaction press. RSA
pauses to its safe checkpoint; returning never replays effects or submits work.
Shor setup and execution hold the shared operation lock throughout.
`LabScreen` uses the shared React/SVG HouseRoom for exploration; the outdoor Excalibur engine is paused.
Exploration has a bounded viewport and follows the player with the shared camera
clamp. Supplies and Build mode scroll independently of the scene. A collapsible
minimap shows the player and visible area whenever the cave exceeds the viewport;
tap it to route to distant floor/equipment. It starts collapsed on small/touch
screens and retains its toggle on rotation. Camera resize uses the shared visible
viewport and never resets the player or submits work.
`LabArt` draws the room and matching inventory/build previews from original Kenney
Roguelike Indoors and Caves & Dungeons sheets under `public/assets/kenney/lab/`.
Keep the original CC0 licenses and crop gutters. Existing game-authored CRT/rack
sprites and SVG quantum display overlays supplement these sheets. Art and sprite
rotation are separate from item IDs, footprints, collision, unlocks and saves.
Free Build mode supports drag, tap and keyboard placement, rotate/store/undo,
footprint validation and connected floor access. The doorway stays reserved.
Medals or legacy town badges unlock equipment and expand the bounded 8×8 plot
up to 16×8. Cards are optional; Cipher wallet credits are not spent here.

`content/lab.ts` defines actual acquired items. X/H/Z/Rotation and Bloch unlock from
Quantum Coin, register/Grover from Amplitude Amplifier, controlled gates/phase
kickback from Ghost Key, and crypto/period tools from all RSA medals. Players
acquire supplies for free and install modules inside the laptop. Ownership is
idempotent; eligibility remains derived from medals even after importing a plan.

`LabLaptop` is free play, not a lesson: no correctness check, reward, or completion
flow. Its bounded recipes support 1–4 wires, 32 operations and 1–1,024 shots,
with X/H/Z/Rotation/CX, phase oracles, diffusion and parity components. The component
picker opens from + beside the floating Clear/Run controls; an empty wire's +
also opens it and places the chosen gate directly, without loading a recipe.
Tap selection, dragging and keyboard placement remain available. Each
lab block is draggable from its whole surface, without a separate grip; touch
uses a brief hold, with scrolling available outside the blocks. Palette and
circuit blocks keep a minimum 44px target. A selected
component has a 44px × removal action on the circuit; Delete/Backspace on a
focused component uses the same deletion path. Selected blocks show left/right
arrows below the block for reordering. Target wires change by dragging. Rotation axes/angles,
CNOT control wires and oracle bits use a floating settings panel anchored to the
block's settings button, clamped to the laptop viewport with Escape/outside-click
dismissal. The circuit occupies the full width; there is no inspector column.
Clear, deletion and recipe/wire replacement cancel any picked-up component before
mutating the circuit, reset pending selections, and invalidate deferred drops.
`game/puzzleInteraction.ts` owns the shared drag click guard and cancellation
lifetime. The lab palette stays mounted when closed so selecting a gate cannot
unregister an active source. Optional starter
and algorithm recipes live below the workspace. Qubit controls explain installed
equipment requirements and warn that changing wire count clears the circuit.
Rotation components select X/Y/Z axes and store finite radians within ±2π.
The floating editor uses a circular θ degree dial, exact degree input and
presets, with a π reference. Pointer dragging unwraps
zero crossings smoothly within ±360°; keyboard arrows adjust 1° (Shift: 15°).
`labCircuit.ts` provides complex-amplitude ideal states and full X/Y/Z Bloch
vectors, with animated projected vectors that respect reduced motion. The sphere
is explicitly ideal, not reconstructed from measurement counts. The existing
`RY` equipment ID/save key remains unchanged and unlocks the generic Rotation
component; legacy `RY` circuit operations still mean Y rotation. New operations
use `ROTATION` with a validated X/Y/Z axis, shared by both backend targets.
Algorithm boxes load editable Grover and phase-kickback recipes. The period box executes the existing separate
N=15/a=7 Shor pipeline; the crypto toolkit is classical.

Explicit Run calls the selected backend through `/api/lab/run`; the HTTP route
and Qollab dispatcher share the builder and service in `core/register_circuit.py`
and `core/game_services.py`. Barrier-separated oracle/diffuser/parity helpers are
shared with register lessons. Histograms contain actual counts with immutable
recipe/backend metadata. Editing retains old counts as previous results. Latest
and comparison results survive laptop close/language changes for the current
visit, but are not persisted. Imports, placement, entry, refresh and ideal state
playback never submit jobs. Busy controls prevent edits, exit and restore.

The separate versioned `quantum-player-lab-v1` store uses saveStorage. Preserve
ownership, installation, custom layout and named recipes across lesson resets
and checkpoint restoration. Full reset clears the lab. Export/import JSON includes
only validated lab data, never medals, jobs or an execution allowance. Short
codes restore progress/unlocks separately. Locked imported equipment remains
unavailable until its medal is restored. Reset lab layout retains ownership,
recipes and medals. Save progress inside the lab reports its entrance town’s milestone. Restoring a
short code reveals only its destination entrance and merges existing discoveries;
it never enters the lab, acquires supplies or executes a circuit. Full-game reset
clears discoveries/origin; lesson and layout resets retain them.

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
neighbor's circuit and counts without resubmitting. Neighbor activity state is
in memory for the current visit; refresh retains earned cards but resets the
unfinished bench. The coin house persists its full lesson session in the native
version and uses the same
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
| Campus foundations and notebook | `game/content/campus.ts`, `game/components/Campus*.tsx`, `game/game/{campus,campusExperiment}.ts`, `game/lib/campus.ts` |
| Personal lab and free-play experiments | `game/components/{LabScreen,LabLaptop}.tsx`, `game/content/{lab,labEntrances}.ts`, `game/game/{lab,labTravel,labLayout,labCircuit}.ts`, `game/lib/lab.ts` |
| Progress, cards, badges, economy, checkpoint shortcuts | `game/game/{progress,knowledge,medals,wallet,checkpoints,restoreCheckpoint}.ts` |
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

## Code organization and refactoring

`LabLaptop` coordinates explicit execution and result snapshots. `useLabEditor`
owns transient selection, focus and drag resets; pure transitions and equipment
permissions live in `game/game/labEditor.ts`. `LabCircuitEditor`,
`LabComponentPicker`, `LabRecipes` and `LabStateExplorer` render those concerns.
`LabResults` renders completed snapshots, comparison and period/classical results;
it never submits work. `useFloatingPanel` shares resize/scroll tracking, outside
dismissal and Escape/focus behavior. Each panel keeps its own geometry: the
picker stays mounted beside its trigger, while settings use a bounded portal.
Keep the hidden component picker mounted so dnd-kit retains its drag sources.
`LabBuildGrid`, `LabSupplies` and `LabTransfer` separate the base's controls from
its scene and placement validation. Gate-specific `LabOp` types require their
parameters; runtime validation still protects imports and old saves.

`lib/request.ts` shares JSON requests, with endpoint-owned refusal/error policies.
`useAsyncOperation` gives lab, neighbor benches, lesson runners and RSA tools one synchronous execution lock and
suppresses results after their owner unmounts; it never retries or cancels jobs.
RSA supplies its mission-generation predicate; staged Shor work checks ownership
before and after each animation wait, before any later submission or mutation.
Each lesson still owns refusal messages, ideal correctness, completion and the
final Coin toss's explicit save. `useLessonSession` hydrates before
writing and reports unavailable storage; each lesson keeps its save validation,
migrations, completion and explicit flush points. Neither hook starts execution
on mount. `HistogramBars` and `AmplitudeBars` are shared display primitives;
lesson wrappers retain their captions, backend metadata and ideal references.
HTTP worker/error translation lives in `backend/app/api/quantum_execution.py`,
outside the shared Python circuit services and the Qollab upload.

## Validation

For game changes, run appropriate checks from `game/`: `npm test` for Node behavior/translation tests and Vitest React regressions,
`npm run lint` (zero warnings), `npm run typecheck` for types, and `npm run build` for
production validation. Backend tests live in `backend/tests/` and run with `pytest`
from `backend/` after installing the development dependencies. Documentation-only
changes need reference and whitespace checks rather than a full build.

`npm run check` combines lint, types and both frontend test suites. React tests
cover editor interactions, duplicate execution, stale responses, reopen/language
changes and blocked-storage hydration. They complement real browser smoke tests.
Format edited files with `npm run format -- <paths>`; avoid unrelated whole-repo
formatting.

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

Qollab remote runs display provider job states, elapsed time, and the job ID in a
shared status panel. Poll via the provider’s `wait_for_final_state` callback; never
resubmit a job to refresh status. Status feedback is transient, not saved progress.

IonQ remote simulators and physical QPUs run final challenges or explicit lab
experiments in the Qollab adapter: Coin’s explicitly marked final toss, Grover’s
final measurement, Ghost Key’s recovery run, RSA’s Shor simulation and `/api/lab/run`. Lab runs
always use the selected backend and share the same single-job allowance as finals.
Warn before Run to keep a checkpoint code and export the custom lab plan.
Practice outside the lab uses BasicSimulator with real returned counts and its
own backend metadata. A runtime-only allowance
is claimed immediately before submission, including ambiguous submission failure;
a second remote job is refused without contacting the provider. After a job, a
dismissible notice asks players to keep a code/export and restart before the next
remote experiment, final challenge or retry. The allowance is never persisted.
Aria’s 25 qubits cannot run Ghost Key; Forte’s 29 can. Preserve existing save keys
and keep automatic progression gated. Public short checkpoint codes now offer
explicit lesson shortcuts because Qollab's sandbox does not persist storage.

The outdoor top bar and laptop toolbar share `BackendLabel`, showing the selected
backend; IonQ mode labels local practice and the remote final challenge separately,
while the lab displays the actual selected backend.

`CheckpointControl` appears beside Start over in shared world/laptop controls.
Public short codes restore teaching milestones on both targets: ct/ft/ht/ci +
1 (arrival), 2 (all five neighbor lessons), or 3 (challenge complete / next road open);
qt1 opens Quantum Town with prior towns complete. These are user-authorized
lesson shortcuts, not exact saves or proof of completion. Earlier badges/cards
and gear for completed RSA acts are restored; current earned progress is merged.
Partial conversations, circuits, measurements, and active RSA checkpoints are
not encoded. A completed challenge yields code 3 even without knowledge cards.
Earned medals retain code 3 when a lesson is restarted; full reset clears them.
Existing public code-3 presets still restore the optional cards and town badge
for compatibility; they are not exact snapshots. Save/restart wording is platform-neutral; the same codes work in
both versions. Remote-job notices tell players to keep a code before restarting.
Restore via the TownScreen event owner to rebuild the scene without
reloading Qollab, changing the backend, or submitting jobs. Busy controls block
restore; code validation precedes mutation. Keep all labels bilingual.

Neighbor circuit benches anchor Run/Clear inside the circuit workspace at the
bottom right as 44px icon buttons with hover/accessibility labels and a shot-count
badge, with reserved space so tools never cover wires. A successful
backend result plus the existing ideal correctness check hides these actions;
editing invalidates the result and restores them. Measured histogram panels
share a teal border/shadow and a brief arrival highlight, respecting reduced
motion. Rounds exercises also hide Run after a successful answer.

Keep the generated Qollab distribution (`game/dist/qollab/` and sibling
`build-report.json`) ignored by Git; regenerate it with `npm run build:qollab`.
Commit the source, requirements and build tools. Tests must run without a generated
distribution in a clean checkout. The platform folder has an
exact 19-file allowlist in `verify-qollab.mjs`: five browser files, twelve Python
files, explicit requirements and consolidated attribution. Keep reports out of the upload. Esbuild
bundles/minifies JS and CSS, filters unused public assets conservatively, and
bundles recorded data into main.js. Source Python remains copied unchanged.
Preserve all dependency/asset/font/QWARD license texts in THIRD-PARTY-NOTICES.txt.
Delivery uses the folder; do not generate or commit a ZIP. The build copies
`game/qollab/requirements.txt` into the folder and removes any obsolete build ZIP.
