# Echo Chamber: The 4-Bit Disarm (Grover house)

Status: **Implemented (plan v2).**

Third Quantum Town lesson (difficulty **Advanced**). It opens the closed north-west house **futureA**
(tile 8,5), which becomes Professor Thecap's workshop. The player walks inside, loses a classical brute
force against an armed drone core, then builds Grover's search on the laptop and disarms the core with
one measurement. Every interaction is a button press or drag/tap-to-place; nothing is typed. The UI never
says "simulator"; it talks about the **quantum core**.

## 0. Confirmed decisions (review round 1)

| Topic | Decision |
| --- | --- |
| House / NPC | North-west house (`futureA`), Professor Thecap's workshop. `futureB` stays closed for the next scenario. |
| Blocks | Four blocks, each **one box spanning all 4 qubits**: `H`, `Oracle` (black box), `Diffuser`, `M`. No per-wire gates, no visible ancilla. |
| Oracle | A sealed black box: "it knows the PIN and flips the sign of the right answer — nothing else". The ancilla/phase-kickback lives inside the box and is never shown. |
| Iterations | Oracle and Diffuser go **inside a repeat box**. The player sets the count on the box itself (`×0 … ×5`, − / + buttons). The count is the number of Oracle → Diffuser rounds, i.e. the number of questions asked to the lock. |
| Running | Any count 0–5 can be run and watched on the equalizer (so over-rotation is visible). |
| Winning | **Collapse (measure) only unlocks at exactly ×3** with the full `H → [Oracle → Diffuser]×3 → M` circuit. Other counts show a Thecap hint instead. A wrong measured PIN (≈3.9%) is a free re-run. |
| Bar labels | Bars are unlabelled **and shuffled** until measurement; after collapse they are relabelled with bitstrings and sorted back to `0000…1111`. |
| Measurement | `M` is a piece the player must place; it is part of the exercise, not a button that appears by itself. |
| Lucky guess | If a classical try hits the PIN (3/16 chance): *"You're lucky! But luck isn't a method."* The core re-arms with a backup cipher (a fresh PIN) and the player continues to the quantum core. The medal is only earned through the quantum path. |

## 1. Story and cast

- **Where:** Professor Thecap's workshop. Thecap is the town doctor on weekdays and a tinkerer on weekends.
  A decommissioned delivery-drone core on the workbench re-armed itself during a repair and started an
  "echo" countdown — the name of the level.
- **Threat:** a 4-bit PIN lock, 16 combinations `0000–1111`. Three wrong classical entries trigger a
  lockdown. The lock is a strict black box `f(x) = 1 if x = s else 0`: yes or no, no hot/cold hints.
- **Tone:** urgent but non-fatal. Failure is an overload + reroute, never game over.
- **Callback to earlier lessons:** `H` is the same gate that made the fair coin in *Who Goes First?*; RSA
  showed that quantum speed-ups are specific to structure (Shor), Grover shows the speed-up for search with
  no structure at all.

Thecap stands by the town entrance as the guide and also appears inside the workshop (they walk ahead;
the portrait and name already exist, no new art).

Room stations (same walking vocabulary as the coin house: arrows/WASD, tap to walk, Space/Talk):

| Station | Used for |
| --- | --- |
| `core` — workbench with the drone core and keypad | Phase 1 keypad, final PIN entry |
| `desk` — laptop | Circuit builder, equalizer, measurement |
| `board` — whiteboard | How many rounds? (R ≈ π/4·√N) |

## 2. Town narrative: Thecap's first dialogue (rewrite)

The current greeting only knows two challenges. It becomes a progress-aware introduction to **three**
challenges, each recommended in order but all open.

### 2.1 First meeting (nothing completed)

> **Professor Thecap:** Welcome to Quantum Town! I'm Professor Thecap, the town doctor — and, on weekends,
> the town tinkerer. Three problems need a quantum hand today.
>
> **Professor Thecap:** At the house to the west, Ale and Brayan can't agree who goes first at game night.
> On the street, someone is listening to their messages. And in my workshop up north, an old drone core
> has locked itself — I can't guess its PIN in time.
>
> **Professor Thecap:** Start with the coin: each challenge uses what the last one taught you.

Choices (each shows difficulty; completed ones show ✓):

1. `1 · Who Goes First? (Beginner)` → track coin
2. `2 · Breaking RSA (Intermediate)` → track rsa
3. `3 · Echo Chamber (Advanced)` → track grover
4. `I'll explore`

### 2.2 Returning (progress-aware)

The text is built from what is done; the recommended next challenge is the first incomplete one in
order 1 → 2 → 3.

| State | Thecap says |
| --- | --- |
| Coin done, next RSA | "A fair coin from one qubit — nicely done. Next, the street: someone is intercepting Ale and Brayan's messages. Or, if you're feeling bold, my workshop." |
| Coin + RSA done, next Grover | "You settled game night and broke RSA. One problem left: my drone core. No structure, no hints, sixteen PINs, three tries. Come to the workshop." |
| RSA done but not coin | "You broke RSA before learning the coin? Impressive. The coin house explains the gate you'll need in my workshop." |
| Grover done, others not | Same pattern: name what's left, recommend the lowest-numbered incomplete one. |
| All three done | "Coin, codes and a disarmed core. Quantum Town owes you one. Replay anything you like — your medals stay." |

### 2.3 Other town touches

- Guide marker label: `Professor Thecap · <next recommended challenge>` instead of the hard-coded
  "Who Goes First?".
- Workshop door marker label: `Thecap's workshop`; minimap symbol `3`, scenario `grover`.
- Signpost text gains the workshop direction (exact arrows checked against tile positions when
  implementing, e.g. `Coin ← · RSA → · Workshop ↖`).
- Journal: third card from `SCENARIOS` (`03 · Echo Chamber · Advanced · Thecap's workshop`).

## 3. Playable sequence inside the workshop

| Step | Station | Player action | Feedback |
| --- | --- | --- | --- |
| `welcome` | core | Talk to Thecap. | Lines below; objective "Try to open the lock". |
| `classical` | core | Flip 4 bit switches (tap: 0 ↔ 1), press **Query lock**. 3 battery cells. | Each try crosses off a cell on a 16-cell grid. Live math `P = tried / 16`, ending at `3/16 = 18.75%`. Repeating a tried PIN is disabled. |
| `overload` | core | — (after 3rd miss) | Sparks + alarm, message: *"Unstructured search space too large for classical trial-and-error under emergency constraints. Switch to Quantum Core."* Button **Route to the laptop →**. |
| `lucky` (branch) | core | — (a try hit the PIN) | *"You're lucky! But luck isn't a method."* Core re-arms with a backup cipher; button **Solve it with quantum →**. Joins the flow at `init`. |
| `init` | desk | Drag the `H` box onto the 4-qubit register. | Equalizer goes from one bar (`????` at 100%) to 16 flat bars at 6.25%. |
| `loop` | desk | Drag `Oracle` then `Diffuser` into the repeat box (starts at `×1`). Distractor pieces: `X`, a second `H`. Press **Run**. | Equalizer animates the round: one bar dips below the axis (oracle), then everything reflects about the dashed mean line and that bar jumps to 47.3% (diffuser). Wrong order → real result, with a Thecap hint. |
| `tune` | board | Drag chips into `R ≈ π/4 · √□ = □ → □ rounds`. Chips `16`, `4`, `3.14`, `3`; distractors `2`, `8`, `15`. | Worked arithmetic stays on the board. Thecap: "Three rounds means three questions to the lock — the same budget you just burned by hand." |
| `tune-run` | desk | Change the repeat box count with − / + (0–5), press **Run** as often as wanted. | Equalizer + target meter: ×0 6.25%, ×1 47.3%, ×2 90.8%, ×3 **96.1%**, ×4 58.2% (over-rotation warning), ×5 12.5%. |
| `measure` | desk | Drag `M` onto the end of the circuit, press **Collapse**. Enabled only at ×3 with a valid circuit; otherwise the button reads "Thecap: not at this count" with a hint. | One shot. Bars relabel and unshuffle; the measured PIN lands as a draggable chip. |
| `disarm` | core | Drag the PIN chip into the keypad (or tap **Send PIN**). | Correct → core turns green, rising win jingle, medal. Wrong → *"Grover is probabilistic — 96%, not 100%. Measure again."* Free, no battery cost. |
| `done` | core | Closing lines; **Return to town** / **Replay**. | Lesson complete, comparison card: *3 classical questions → 18.75% · 3 quantum questions → 96.1%*. |

### 3.1 Dialogue drafts (in-house)

- **welcome** — Thecap: "You came! This drone core woke up mid-repair and armed itself. Four switches,
  sixteen PINs. It answers only yes or no — no 'warmer', no 'colder'." / "Three wrong answers and it locks
  forever. Try your luck on the keypad."
- **overload** — System message (spec text). Thecap: "Three tries out of sixteen was never going to be
  enough. My laptop talks to the quantum core — let's ask all sixteen at once."
- **lucky** — Thecap: "You're lucky! But luck isn't a method." / System: "Backup cipher engaged. New PIN
  armed." / Thecap: "See? Solve it with quantum — that works every time."
- **init** — Thecap: "Remember the fair coin? One `H` made one qubit heads *and* tails. One `H` box on four
  qubits makes all sixteen PINs at once, each at 1/16."
- **loop** — Thecap: "The Oracle is sealed; it knows the PIN and flips the sign of the right answer —
  nothing else. You can't see the sign by measuring. The Diffuser turns that hidden flip into a taller bar:
  it reflects every bar about the average."
- **tune** — Thecap: "Too few rounds and the bar is short. Too many and it swings past the top and falls.
  How many rounds for sixteen PINs?"
- **tune-run (×4)** — Thecap: "Over-rotation! Grover is a rotation — keep turning and you point away again."
- **measure** — Thecap: "Measuring collapses all sixteen into one. Once. Make it count."
- **done** — Thecap: "Same three questions — 18.75% by hand, 96% with Grover. That's the √N speed-up:
  a million PINs would take about 785 rounds instead of up to a million tries."

## 4. Numbers shown on screen (verified)

N = 16, one marked item, θ = asin(1/4) ≈ 14.48°, P(k) = sin²((2k+1)θ):

| k | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| P(target) | 6.25% | 47.3% | 90.8% | **96.1%** | 58.2% | 12.5% |

Classical: 3/16 = 18.75%. √10⁶ · π/4 ≈ 785. On-screen values come from the backend run; this table is
only used in tests.

## 5. The Quantum Equalizer

- 16 vertical bars with a dashed **mean amplitude** line; bar direction = signed amplitude (below the
  axis after the oracle flips it), height = probability.
- Sub-steps per round: after Oracle, after Diffuser, so "flip, then reflect about the mean" is visible.
  Rounds animate in sequence with a `tick` per round.
- **Shuffled and unlabelled** until measurement. The order is a secret permutation derived from the device
  token on the server, so the bar position never reveals the PIN, and the page can't unshuffle it. After a
  collapse the response carries the bitstring per bar; bars relabel and slide into `0000…1111` order.
- Framed as "the core's inner view": the player sees what a real measurement cannot, which is why only the
  final collapse gives an answer.

## 6. Backend: `/api/grover/*`

New router `backend/app/api/routes/grover.py`, same `run_on_worker` pattern as `coin.py`.

- `POST /api/grover/device` → `{ token }`. Server draws `s ∈ [0, 15]` and a permutation seed, returns an
  HMAC-signed stateless token (works across Cloud Run instances). Key from env `GAME_TOKEN_KEY`, fixed
  fallback for local play. Optional `{ previous }` to guarantee the backup cipher differs from the old PIN.
- `POST /api/grover/query { token, guess }` → `{ match }`. Classical oracle; also checks the final PIN.
- `POST /api/grover/run { token, circuit: { init: "H" | null, loop: ("oracle"|"diffuser"|"h"|"x")[], repeat: 0..5, measure: bool } }`
  builds a real `QuantumCircuit(4, 4)`: optional `H⊗4`, then `repeat × loop`, then optional measurement.
  Oracle = X on zero-bits of `s`, MCZ, X (phase oracle, equivalent to the ancilla-kickback form inside the
  black box). Diffuser = `H⊗4 X⊗4 MCZ X⊗4 H⊗4`. Returns per-round snapshots `{ after: [block, amps[16]] }`
  of signed amplitudes from `Statevector`, **in shuffled order**, plus `target_probability` is *not*
  returned (it would reveal the bar). When `measure` is true and the circuit is `H → [oracle, diffuser] ×3 → M`,
  one Aer shot → `{ bits: "1011", labels: [...16 bitstrings in shuffled order] }`; otherwise
  `measure` is rejected with `409 { reason: "rounds" | "circuit" }` so the rule is enforced server-side too.
- Bit order normalized to big-endian `q3…q0` for display.
- Bounded vocabulary; every allowed arrangement runs for real (no `H` → the PIN stays unlikely, Diffuser before
  Oracle → real wrong result). Nothing fabricated.
- Tests `backend/tests/test_grover.py`: token round-trip + tamper rejection, probability table within 1e-3
  (after unshuffling in the test), over-rotation, shuffled order differs per seed and hides the target
  index, measure rejected unless ×3, bit order.

The equalizer's target meter ("tallest bar") is computed client-side as the max bar, so it never needs
the target index.

## 7. Frontend structure

| Area | Change |
| --- | --- |
| `game/game/coinRoom.ts` → `game/game/room.ts` | Parametrize room geometry (`{ start, stations, blocks, exit }`). Coin config identical; `coinRoom.test.cjs` still passes; add a workshop-room test. |
| `game/components/HouseRoom.tsx` (new) | Walking loop extracted from `CoinHouse.tsx`; takes room config + SVG furniture. `CoinHouse` becomes a thin wrapper, behavior unchanged. |
| `game/components/GroverHouse.tsx` (new) | Workshop SVG: workbench + drone core (pulsing red → green), laptop desk, whiteboard, Thecap. |
| `game/content/grover.ts` (new) | Steps, stations, dialogue, objectives (same `Scene` shape as `coin.ts`). |
| `game/components/GroverScenario.tsx` (new) | Session state + persistence (`quantum-grover-session-v1`), step flow, LaptopShell, core panel. |
| `game/components/GroverChallenges.tsx` (new) | `Keypad`, `SearchGrid`, `GroverCircuit` (4-qubit register, `H` slot, repeat box with count badge, `M` slot, on `PuzzleDragDrop`), `QuantumEqualizer`, `RoundsFormula` (whiteboard). |
| `game/lib/grover.ts` (new) | API client. |
| `content/town.ts`, `content/scenarios.ts` | `futureA` → `groverDoor` (`kind: "grover"`); scenario `grover` (`03`, "Echo Chamber", Advanced, "Emergency · Thecap's workshop", lessons "Search · oracle · amplitude amplification"). |
| `TownScreen.tsx`, `game/town.ts` | `location: "town" \| "coin" \| "grover"`, tracked `"grover"`, enter/leave, **new progress-aware greeting (§2)**, journal card, restart options (`restartGrover`, full reset clears `quantum-grover-session-v1`). |
| `CityScene.ts`, `TownMinimap.tsx` | Workshop marker/label, guide label from next recommendation, signpost text, minimap `3`. |
| `content/medals.ts` | Medal `amplifier` — "Amplitude Amplifier", skill *Grover search*, ability *"Needle Finder: find one marked item among N in about √N queries."* |
| `game/i18n/es.json` | Spanish for every new and changed string (including the rewritten greeting). |
| Audio | Reuse cues: alarm on overload, tick per round, rising win jingle on disarm (no stacking). No new music. |

Session save stores step, battery, tried PINs, token(s), lucky flag, circuit placements, repeat count,
last run, formula answer, measured PIN and completion. Refresh never re-draws the PIN or re-runs a
finished run.

## 8. Delivery order

1. Backend router + tests.
2. Room refactor (`room.ts`, `HouseRoom`), coin house unchanged.
3. Town wiring: door, location, greeting rewrite, journal, restart, medal, labels.
4. Grover scenario: classical → circuit builder → equalizer → rounds → measure/disarm.
5. Spanish strings, typecheck, lint, frontend + backend tests.

Review notes / requested modifications:

> Add your changes here.
