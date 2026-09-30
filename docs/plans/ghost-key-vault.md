# Operation Ghost Key: The 25-Bit Parity Vault (Bernstein–Vazirani)

Status: **Implemented (plan v4: §11 playtest revision applied).**

Fourth Quantum Town lesson (difficulty **Expert**). It opens the last closed house, **futureB** (tile 21,5):
the old house on the north-east street that the whole town says is **haunted**. It is a direct follow-up
to *Echo Chamber*: the player arrives confident with Grover, loses classically, watches Grover fail against
the scale, and finally learns that the "ghost" has **structure** — an inner-product parity oracle — which
Bernstein–Vazirani (BV) cracks with **one query** using phase kickback.

**The hook:** it plays like a haunted-house story (knocks, candles, flickering lights, a house that "goes
cold"), and every spooky thing turns out to be a quantum box doing exactly what the math says. The final
reveal: *there is no ghost — the only thing you can't see is the phase, and one H layer makes it visible.*

Every interaction is a button press or drag/tap-to-place; nothing is typed. The UI never says "simulator";
the laptop talks to the **quantum core**.

## 0. Confirmed decisions (review rounds 1–2)

| Topic | Decision |
| --- | --- |
| House | `futureB` becomes **Casa Ofelia**, the "haunted house". No closed houses remain after this. |
| New character | **Doña Ofelia**, an elderly widow (new speaker `ofelia`, new SVG portrait + room sprite in the same style as `town-doctor.svg`). She needs the vault opened. Thecap stays in town as the recommender and lends the laptop; in the house, hints are laptop **Notes** (the existing `system` speaker, labelled "Notes" as in the other lessons). |
| Continuity | Ofelia's late husband, **Colonel Anselmo**, was an army cryptographer. He built the drone core the player disarmed in *Echo Chamber* and brought a decommissioned military data vault home. Since the drone went silent, the vault started "knocking". |
| Query budget | The vault has **3 questions per night** ("three candles"). The BV solve uses **1 of 3**: the final key entry at the door is **free** (it is not a question to the ghost). The comparison card shows the **two candles left burning**. |
| Freeze → re-key | **Re-key on every freeze** (see §0.1). When the 3rd candle goes out without the vault opening, the house "goes cold" and the clock strikes midnight: 3 new candles and a **new mask**. |
| Black boxes | Same philosophy as Echo Chamber: **boxes, not per-wire gates**. `H` spans all 25 data qubits, the `Oracle` (the "ghost") is sealed and spans every wire, `M` spans the data bus. The only thing opened up is the ancilla: one **helper wire** with one slot for a **state-prep box** (`|−⟩`, distractors `|0⟩`, `|+⟩`). |
| Execute gating | **Execute (1 Query)** stays disabled until the wiring is correct (validated on the client, re-checked on the server with `409 { reason }`). Wrong wiring gets a concept hint, never a burned candle. |
| Phase 1 | Richer: key dials, candle probes (single **and** multi-bit), Ofelia's notebook deduction, and a whiteboard-style odds card (§3, `classical`). |
| Naming | Scenario id `vault`, route `/scenarios/vault`, title **Operation Ghost Key**, difficulty **Expert**. |
| Grover twist | Kept: diagnostics reveal the lock was never a match lock, so Grover's premise was wrong too. |
| Names | **Doña Ofelia**, **Colonel Anselmo**, **Casa Ofelia** (confirmed). |
| Audio | New synthesized SFX for the haunting (§8, Audio). |
| Order | All four lessons stay open; Thecap recommends 1 → 2 → 3 → 4. If *Echo Chamber* is not done, the Grover step includes a short recap from laptop Notes. |

### 0.1 Why re-key on freeze (answer to question 3)

Re-keying is the better choice:

1. **Honest phases.** If the mask survived, the 3 probed bits from Phase 1 and any leak from Phase 2 would
   carry over. The player could then "win" partly classically, and the BV run would look like it only
   finished the job. With a fresh mask, BV provably learns all 25 bits from nothing.
2. **It sharpens the lesson.** Each freeze says "whatever you learned is gone — only a method that works
   within one night counts". BV is the only method that fits, and it uses 1 of 3.
3. **It fits the ghost story.** "At midnight the house forgets" is spooky, and it explains why the knocks
   from before don't help.
4. **No extra backend state.** A freeze just calls `/device { previous }`, as the Echo Chamber backup cipher
   already does.

Cost: the Phase 1 notebook resets, so the notebook keeps a greyed "last night" page for flavour (no
usable bits, since the mask changed).

## 1. Story and cast

- **Doña Ofelia** — mid-70s, shawl, reading glasses on a chain, a candlestick in hand. Warm, sharp,
  stubborn, a little superstitious. She doesn't know quantum computing, but she knew her husband's habits.
  Voice: short, dry humour ("Anselmo never locked anything he couldn't open. Until now.").
- **Colonel Anselmo** (never on screen) — the "ghost". His portrait hangs over the fireplace; his army
  manual is in the desk drawer. He built the vault lock as a parity machine.
- **What's in the vault:** his last letter to Ofelia and their wedding ring, sealed the week he died. The
  lock's 25-bit mask died with him.
- **The haunting:** since the drone went silent, the vault knocks at night. Ask it a question (light
  candles over the lock's bits) and it answers with **one knock or silence**. After three questions the
  candles gutter out, the house goes cold, and at midnight the lock "forgets".
- **Tone:** cosy-spooky, never scary. Flicker, drafts, knocks, a clock; no jump scares, no failure state.

Room stations (same walking vocabulary as the coin house and the workshop):

| Station | Used for |
| --- | --- |
| `vault` — the vault door in the study, 25 brass tumblers + 3 candle sconces | Key dials, candle probes, final key entry |
| `desk` — the Colonel's desk with Thecap's laptop and the drawer | Grover wiring + run, diagnostics (the manual), BV circuit + execute |
| `table` — the séance table with Ofelia's notebook | Phase 1 notebook + odds card, Grover rounds formula, kickback ledger |

## 2. Town narrative changes

### 2.1 Greeting rewrite (four lessons)

`GREETINGS` is keyed by a 3-bit progress string today (`"000"`…`"111"`). Sixteen hand-written strings do
not scale, so the greeting is **composed**: first-meeting text, or a "done so far" sentence + "next
recommended" sentence built from per-lesson fragments, plus a special all-done line.

> **Professor Thecap (first meeting):** Welcome to Quantum Town! I'm Professor Thecap, the town doctor —
> and, on weekends, the town tinkerer. Four problems need a quantum hand today. Ale and Brayan can't agree
> who goes first at game night. Someone is listening to their messages on the street. An old drone core
> has locked itself in my workshop. And Doña Ofelia swears her house is haunted. Start with the coin: each
> challenge uses what the last one taught you.

Next-recommendation fragments (examples):

| Next | Thecap says |
| --- | --- |
| Vault (after Echo Chamber) | "Doña Ofelia came by. Her house has been knocking every night since we silenced that drone — her husband built it. She thinks it's his ghost. I think it's his vault. Take my laptop." |
| Vault before Echo Chamber | "Ofelia's haunted house? Bold. My workshop teaches the trick you'll try first there — and why it isn't enough." |
| All four done | "Coin, codes, a disarmed core and a ghost laid to rest. You've seen both kinds of quantum speed-up. Replay anything you like — your medals stay." |

Choices gain `4 · Operation Ghost Key (Expert)`.

### 2.2 Other town touches

- `futureB` → `vaultDoor` (`kind: "vault"`), prompt "Knock on Doña Ofelia's door", marker label
  `Casa Ofelia`, minimap symbol `4`, scenario `vault`.
- Door conversation: "Emergency · Expert. Doña Ofelia's house knocks at night. She needs her late
  husband's vault opened. 25 bits, three questions."
- Signpost: drop "One more house will open for a future lesson", add `Casa Ofelia` with its direction.
- Journal: fourth card `04 · Operation Ghost Key · Expert · Casa Ofelia`.
- Optional ambience: the house window on the town map flickers until the lesson is complete (small
  `CityScene` tween; skip if it complicates the tile renderer).

## 3. Playable sequence inside the house

### Phase 1 — The séance (classical impossibility)

| Step | Station | Player action | Feedback |
| --- | --- | --- | --- |
| `welcome` | vault | Talk to Ofelia. | Lines below. Brass counter above the door: **33,554,432 combinations**. |
| `odds` | table | Before touching the lock, fill Ofelia's odds card by dragging chips: `P = □ / □` (chips `3`, `33,554,432`; distractors `25`, `1`, `2`) and `bits per knock = □`, `knocks to read all bits = □` (chips `1`, `25`). | Worked result stays on the card: **3 / 33,554,432 ≈ 0.0000089%**, **25 knocks needed, 3 allowed**. Ofelia: "So guessing is hopeless. And one bit per knock is too slow. Let's try anyway — I want to hear him." |
| `classical` | vault | Spend up to 3 candles, any mix of: **(a) Try the key** — turn 25 tumblers (tap 0 ↔ 1), or pull the **planchette** for a random key, then **Try key**. **(b) Ask the ghost** — drag 1 to 25 **candles** onto tumbler positions (a lit candle = a `1` in the question `x`), then **Ask**. | Door: "denied" rattle for a wrong key. Ghost: **one knock** (`f(x) = 1`) or **silence** (`0`), plus a flicker per lit candle. Candle sconces burn down 3 → 0. Live panel: brute-force `P = tries / N`; notebook progress `known bits k / 25`, candidates left `2^(25−k)`. |
| `notebook` (inline, after each question) | table / overlay | Drag the knock (or silence) token into Ofelia's notebook next to the question. For a **one-candle** question the token lands on that bit (`s₇ = 1`). For a **multi-candle** question it becomes an equation row (`s₂ ⊕ s₉ ⊕ s₁₄ = 1`) that pins no single bit. | Notebook explains in Ofelia's words: "One candle, one answer. Three candles, still just one answer — about all three together." Planting the seed of **parity** without naming it. |
| `freeze1` | vault | — (3rd candle out, vault shut) | Candles gutter, frost on the window, the clock strikes twelve. Card: brute force vs. probing numbers from the odds card. System: "The house has gone cold. At midnight the lock forgets." New mask, 3 new candles. Notebook page greys out ("last night"). Ofelia: "Your doctor friend left a laptop. Let's see what it can do." |
| `lucky` (branch) | vault | — (a key try hit, p ≈ 9·10⁻⁸) | Ofelia: "You're lucky! But luck isn't a method." The door slams before it opens; the lock re-keys. Joins at `groverWire`. Medal only via the quantum path. |

### Phase 2 — The Grover trap

| Step | Station | Player action | Feedback |
| --- | --- | --- | --- |
| `groverWire` | desk | Rebuild the Echo Chamber circuit on a **25-qubit bus**: `H` box, `Oracle` + `Diffuser` inside the repeat box. Same builder as Echo Chamber, register labelled "25 qubits". | Notes: "Same trick as the drone core. It found one PIN in sixteen." Ofelia: "Anselmo's drone lost to this? Then it'll work on his vault." |
| `groverBoard` | table | Drag chips into `R ≈ π/4 · √□ = π/4 · □ ≈ □ rounds`. Chips `33,554,432`, `5,792.6`, `4,549`; distractors `25`, `3`, `16`. | Worked arithmetic stays. Ofelia: "Four thousand five hundred and forty-nine questions. I have three candles." |
| `groverRun` | desk | Repeat box snaps to `×4,549`. Press **Run**. | Séance-clock counter `1 / 4,549 → 2 → 3`, one candle burns out per cycle; target meter (log scale) creeps to **0.000146%**. At cycle 3 the laptop prints the error: **"Buffer Depleted. Target probability after 3 iterations: < 0.0002%. Grover quadratic speedup is insufficient for large unstructured keys under single-digit query limits."** → freeze2, midnight, new mask. |

### Phase 3 — The paradigm shift (Bernstein–Vazirani)

| Step | Station | Player action | Feedback |
| --- | --- | --- | --- |
| `diagnostics` | desk | Open the drawer, drag the **Colonel's manual** onto the laptop to "scan" it. | The laptop shows the lock's spec page: **`VAULT_ORACLE: f(x) = s · x mod 2`**. If the player asked a multi-candle question in Phase 1: "Your three-candle question got one knock. A match lock only knocks for the exact key — this lock was never a match lock." Guidance: **"Stop amplifying amplitudes through iteration. Exploit phase interference with a single query."** Ofelia: "So the ghost is… arithmetic? Anselmo would have loved that." |
| `ledger` | table | The kickback ledger for **one** tumbler (black-box level, no gates): drag state chips into two rows, `s_i = 0` and `s_i = 1`: `|0⟩ →H→ □ →ghost→ □ →H→ □`. Chips `|+⟩`, `|−⟩`, `|0⟩`, `|1⟩`. A second mini-row for the helper: `helper = □` → `|−⟩` (distractor `|0⟩`: "then the ghost's answer lands in the helper, not the phase"). | Notes: "The ghost only ever flips the helper. But flip a `|−⟩` and all you get is a minus sign — and that sign **kicks back** onto the tumbler's qubit. You can't measure a sign. It's the real ghost: invisible. Until H turns it into a 0 or a 1." |
| `bvWire` | desk | Build the circuit from boxes (§5): data bus `H` → `Oracle` → `H` → `M`; helper wire slot → `|−⟩`. Distractors: `Diffuser`, the repeat box (greyed: "no loop needed"), a helper prep `|+⟩`/`|0⟩`, a second `M`. | Slot hints about the **concept**: helper `|0⟩` → "the answer goes into the helper, not the phase"; missing first `H` → "one candle at a time again: ask all 25 at once"; missing second `H` → "the signs are there, but you can't measure a sign"; `Diffuser`/repeat → "nothing to amplify — this is one question". **Execute** disabled until valid. |
| `execute` | desk | Press **Execute (1 Query)** — one candle lights. | One pulse sweeps the 26 wires; every lamp in the room flickers once; after the Oracle each data wire shows a faint `+`/`−` "ghost" glow; after the second `H` the glows turn into bits and the 25-bit mask resolves in **1 clock cycle**. It becomes a draggable brass key chip. |
| `unlock` | vault | Drag the key chip onto the tumblers (free, not a question). | Tumblers roll left-to-right, the door swings open, warm light, rising win jingle, medal. Inside: the letter and the ring. BV is deterministic — no wrong-result branch. |
| `done` | vault | Ofelia reads a line of the letter; **Return to town** / **Replay**. | Comparison card (§6) + reveal line. |

### 3.1 Dialogue drafts

- **welcome** — Ofelia: "You're the one who quieted Anselmo's drone? Good. Then you can quiet his vault." /
  "Every night it knocks. Light candles over the tumblers and it answers — one knock or nothing. Three
  questions, then the candles die and the house goes cold." / "Twenty-five tumblers. Anselmo's letter is in
  there. Help me open it."
- **classical (multi-candle)** — Ofelia: "Three candles, one knock. It's answering about all three at once…
  but what, exactly?"
- **freeze1** — System: "The house has gone cold. At midnight the lock forgets." / Ofelia: "Every morning he
  changed the combination. Even now, apparently."
- **groverWire (Echo Chamber not done)** — Notes: "Grover: spread a guess over every key, then
  grow the right one round by round. It's how I beat the drone."
- **groverRun (error)** — Notes: "√N is a huge win for sixteen PINs. √(33 million) is still
  thousands of questions. Squaring down isn't enough here." / Ofelia: "Then the ghost wins?"
- **diagnostics** — Ofelia: "He always said a lock should have a rule, not a secret list." / Notes:
  "Read that line again. It's not asking *is x the key?* — it's the parity of the key and your question.
  That's structure. And structure is where quantum really shines."
- **bvWire** — Notes: "Remember my sealed Oracle? It had a helper qubit hidden inside. This time you
  prepare the helper yourself. Put it in `|−⟩` and the ghost's answer becomes a phase."
- **execute** — Ofelia: "One candle. All twenty-five tumblers?" / Notes: "One question."
- **unlock** — Ofelia: "…It's his handwriting."
- **done** — Ofelia: "So there never was a ghost." / Notes: "Only one thing in that house was
  invisible: the phase. Twenty-five questions classically, four and a half thousand with Grover, one with
  Bernstein–Vazirani. Unstructured search is only ever quadratically faster — but give quantum structure,
  and the gap becomes exponential." / Ofelia: "Two candles left. I'll keep them for Anselmo."

## 4. Numbers shown on screen (verified)

N = 2²⁵, θ = asin(1/√N) ≈ 1.7263·10⁻⁴ rad, P(k) = sin²((2k+1)θ):

| Quantity | Value |
| --- | --- |
| N | 33,554,432 |
| √N | 5,792.6 |
| π/4 · √N | 4,549.5 → optimal R = round(π/(4θ) − ½) = **4,549** (P ≈ 1 − 2·10⁻¹¹) |
| Brute force, 3 tries | 3/N = **0.0000089%** |
| Probing, 3 single-candle questions | 3 / 25 bits, 2²² = **4,194,304** candidates left |
| Grover P after k = 1, 2, 3 | 0.0000268%, 0.0000745%, **0.000146%** (< 0.0002% ✓) |
| Full statevector (complex128) | 2²⁵ · 16 B = **512 MiB** (why the core never builds it) |

All values are computed from formulas at runtime (client lib for Grover and odds, backend for BV); this
table is for tests only.

## 5. Circuit construction (BV, black-box level)

```
data (25 qubits):  |0…0⟩ ─[ H ]─┤        ├─[ H ]─[ M ]═▶ display register (25 bits)
                                │ ORACLE │
helper (1 qubit):  ─[ |−⟩ ]─────┤ "ghost"├──────────────
```

- Pieces are boxes, as in Echo Chamber: `H` (all 25 data qubits), `Oracle` (sealed, all 26 wires), `M`
  (all 25 data qubits), helper prep `|−⟩`. The player never places per-qubit gates.
- Inside the boxes (backend only, never shown): helper prep = `X` then `H`; Oracle = `CNOT(q_i → helper)`
  for each `s_i = 1`.
- Per wire: `H|0⟩ = |+⟩ → (|0⟩ + (−1)^{s_i}|1⟩)/√2 → H → |s_i⟩`. Deterministic, O(n).
- Builder slots: data `prep`, `out`, `measure`; helper `helper`; the Oracle is pre-placed and fixed (it is
  the vault itself — you route wires *through* it, you don't own it). Distractor slot: the greyed repeat box.
- Visual: 25 hairline wires grouped as a bus (≈6 px pitch, expandable to show all 25), the helper wire below
  in candle-amber. Fits 360 px; only the circuit strip scrolls inside the laptop.

## 6. Victory state

- **Visual climax:** candle lights → pulse sweep → faint `±` ghost glows → bits resolve left-to-right in one
  tick → e.g. `1011001110100101101001101` → tumblers roll → door opens.
- **Comparison card** (questions to learn the mask, candles on the side):

  | Method | Questions | Fits in 3 candles? |
  | --- | --- | --- |
  | Classical probing | 25 | ✗ |
  | Grover (as if unstructured) | ≈ 4,549 | ✗ |
  | Bernstein–Vazirani | **1** | ✓ — 2 candles left |

- **Core lesson:** "Unstructured search is quadratically bounded (Grover). Algebraic structure unlocks
  exponential acceleration (Bernstein–Vazirani)."
- **Reveal line:** "There was no ghost. The only invisible thing in the house was the phase."
- **Medal:** `ghost-key` — "Ghost Key", glyph `±`, skill *Phase kickback · Bernstein–Vazirani*,
  description "You put a helper qubit in |−⟩, turned a parity lock's answers into phases, and read a 25-bit
  secret with one question.", ability *"Parity Read: learn an n-bit secret s from f(x) = s·x in a single
  query."*, hint "Open the vault in Casa Ofelia."

## 7. Backend: `/api/vault/*`

New router `backend/app/api/routes/vault.py`, same token + `run_on_worker` pattern as `grover.py` (move
`_sign` / token helpers into a small shared module `app/api/game_token.py`; `grover.py` imports it,
behaviour unchanged).

- `POST /api/vault/device { previous? }` → `{ token }`. Draws `s` uniformly from 25 bits (never equal to
  `previous`, never all zeros). Stateless HMAC token.
- `POST /api/vault/key { token, key }` → `{ open }`, `key` pattern `^[01]{25}$`.
- `POST /api/vault/ask { token, x }` → `{ knock }` = `popcount(s & x) mod 2`. Any non-zero 25-bit vector.
- `POST /api/vault/run { token, circuit }` with
  `circuit: { prep: "h"|null, helper: "minus"|"plus"|"zero"|null, out: "h"|null, measure: bool, extra: ("diffuser"|"repeat")[] }`.
  - Only the valid BV wiring runs; otherwise `409 { reason: "prep" | "helper" | "output" | "measure" | "extra" }`
    (mirrors the client hints).
  - Builds a real `QuantumCircuit(26, 25)` and runs **`AerSimulator(method="stabilizer")`**, 1 shot. Returns
    `{ frames: [{ block: "h" | "oracle" | "h2", phases?: ("+"|"-")[25], bits?: string }], measured }`.
    `phases` come from O(n) kickback tracking; `measured` from the stabilizer shot; a test asserts they agree.
  - Bit order: display `s₀ … s₂₄` left-to-right, normalised explicitly (Qiskit prints little-endian).
- Grover step has no endpoint: it never measures, and its numbers are formula-only (`game/lib/vault.ts`).
- Candle budget is **client-side** (session), as in Echo Chamber; the server is stateless. Documented, not a
  security boundary.
- Tests `backend/tests/test_vault.py`: token round-trip + tamper, `previous`/non-zero rule, ask parity
  (single and multi-bit), key check, stabilizer result == s for many random masks, O(n) phases == s, every
  invalid wiring → its 409 reason, bit order, 26-qubit run < 1 s.

## 8. Frontend structure

| Area | Change |
| --- | --- |
| `game/public/assets/characters/ofelia.svg` (new) | Portrait in the `town-doctor.svg` style: grey bun, shawl, glasses on a chain. Also a small in-room sprite. |
| `content/types.ts`, `Portrait.tsx`, `useSceneAssets.ts` | New speaker `ofelia` (`SPEAKER_NAME` "Doña Ofelia", own border/text colour, portrait `ofelia.svg`). Hints reuse the existing `system` speaker ("Notes"); no new speaker variant. |
| `game/game/vaultRoom.ts` (new) | `createRoom<VaultPlace>` with `vault`, `desk`, `table`; `vaultRoom.test.cjs`. |
| `game/components/VaultHouse.tsx` (new) | Study SVG: vault door with 25 brass tumblers and 3 candle sconces, the Colonel's portrait, desk + laptop + drawer, séance table + notebook, clock, Ofelia. Overlays: flicker, frost ("gone cold"), warm light on unlock. |
| `game/content/vault.ts` (new) | Steps, stations, dialogue, objectives (`Scene` shape as in `grover.ts`). |
| `game/components/VaultScenario.tsx` (new) | Session state + persistence (`quantum-vault-session-v1`), step flow, nights/re-key, candles, LaptopShell. |
| `game/components/VaultChallenges.tsx` (new) | `OddsCard`, `VaultLock` (tumblers, planchette, candle drag, Ask/Try), `Notebook` (drag knock tokens into bit/equation rows), `GroverClockRun` (cycle counter, burning candles, log-scale meter), `ManualScan`, `KickbackLedger`, `BvCircuitBuilder` (bus + helper wire on `PuzzleDragDrop`), `MaskRegister` (pulse, ghost glows, resolve), `ComparisonCard`. |
| `GroverChallenges.tsx` | Let `GroverCircuitBuilder` take a `qubits` label (4 vs 25) and a fixed repeat count (`×4,549`); reuse `RoundsFormula` with new chips. No behaviour change for Echo Chamber. |
| `game/lib/vault.ts` (new) | API client + pure helpers `groverProbability(n, k)`, `optimalRounds(n)`, `bruteForce(tries, n)`, `parity(s, x)` for the notebook; unit-tested. |
| `content/town.ts`, `content/scenarios.ts` | `futureB` → `vaultDoor`; scenario `vault` (`04`, "Operation Ghost Key", Expert, "Haunted house · Casa Ofelia", lessons "Structure · phase kickback · Bernstein–Vazirani", missions `["vault"]`). |
| `TownScreen.tsx`, `game/town.ts` | `location`/`Challenge` add `"vault"`, composed greeting (§2.1), track/visit keys, door conversation, journal card, `restartVault`, full reset clears the vault session. |
| `CityScene.ts`, `TownMinimap.tsx` | `vault` kind mounted, marker/label, minimap `4`, signpost, optional window flicker. |
| `content/medals.ts` | Medal `ghost-key` (§6). |
| `app/scenarios/vault/page.tsx` | Route like `scenarios/grover/page.tsx`. |
| `game/i18n/es.json` + `i18n.test.cjs` | Spanish for every new/changed string ("Doña Ofelia", "Casa Ofelia" stay as-is); test scans vault content. |
| Audio (`game/game/synth.ts`, `game/game/audio.ts`) | Add synthesized `SynthId`s (Web Audio, no new asset files): **`knock`** (two short low thuds; one per ghost answer, silence = no sound), **`snuff`** (short filtered-noise puff when a candle goes out), **`toll`** (low bell with long decay, played 12× quickly-fading at midnight / re-key), **`cold`** (soft rising-then-falling noise wind for "the house goes cold"), **`glow`** (soft shimmer for the ± ghost glows during Execute). Reuse: `tick` per Grover cycle, `error` for the Buffer Depleted message, `select`/`click` for placements, rising `win` jingle on unlock (no stacking, per the win-sound rule). Every new cue respects the existing SFX volume/mute setting. Unit test: each new id is playable without throwing when `AudioContext` is missing. |

Session save stores: step, night number, candles used, current token, odds-card answers, this night's
questions + answers + notebook placements, lucky flag, circuit placements (Grover + BV), formula + ledger
answers, Grover run done, execute result, unlocked, completion. Refresh never re-draws a mask mid-night or
re-runs a finished run.

## 9. Open questions

None. Names confirmed, hints stay as laptop Notes, new synthesized SFX approved.

## 10. Delivery order

1. Shared token module + `vault.py` router + tests (stabilizer run, O(n) tracking).
2. Ofelia portrait/sprite, speaker wiring, new synth SFX, room config + `VaultHouse` SVG.
3. Town wiring: door, location, composed greeting, journal, restart, medal, minimap, signpost.
4. Scenario flow: odds card → lock + notebook → freeze/re-key → Grover trap (builder reuse, board, clock
   run) → manual scan → kickback ledger → BV builder → execute → unlock → comparison card.
5. Spanish strings, typecheck, lint, frontend + backend tests.

## 11. v4 — playtest revision (Phase 1 and the ledger)

### 11.1 What the playtest showed

| Problem | Cause |
| --- | --- |
| The rules are unclear: what the ghost is, what a knock means, what a candle is for. | The rule is never stated in Phase 1; it was held back for the Phase 3 reveal. |
| "Candle" means two things. | The 3 table candles are the **budget**, but the player also drags a "candle" onto tumblers to build a **question**. |
| Dropping a candle on a circle means nothing to the player. | The 5×5 grid of empty circles has no visible meaning: no digit, no "unknown", no link to the vault's code. The question itself is never put into words. |
| The odds card feels like homework, not solving. | Four chip drags of arithmetic (`3 / 33,554,432`, `1 bit`, `25 knocks`) come **before** the player has touched the lock, so there is no problem yet to solve. |
| Phase 1 feels like losing without knowing why. | Nothing says the classical attempt is an experiment that is meant to fail. |
| Too many drags overall. | The notebook asks for one extra drag per answer; the kickback ledger has 7 drags. |

### 11.2 Design rules for the revision

1. **One word, one meaning.** Candles are **only** the budget (3 per night). A question is made by **choosing tumblers**; nothing is dragged to ask.
2. **Say the rule before the first question**, in one line, and keep it visible on the lock panel.
3. **Every question and answer is shown in words**: "Is tumbler 7 a 1?" → "👻 Knock! Tumbler 7 is **1**."
4. **Learn by playing, then one tap to conclude.** No arithmetic before the lock. The classical conclusion is one multiple-choice question with a twist.
5. **Fewer drags.** Drags stay where they build something (the circuits); answers and notes fill in by themselves.

### 11.3 New rules card (always visible on the lock panel)

> 👻 **The ghost is the vault's lock.** Choose a tumbler and ask. **Knock = that digit is 1 · Silence = it's 0.**
> 🕯🕯🕯 **3 questions per night.** At midnight the vault changes its code.

Ofelia introduces it in the `classical` dialogue instead of the current generic line:
- Ofelia: "The vault hides a code: 25 digits, each 0 or 1. The ghost knows it."
- Ofelia: "Choose a tumbler and ask. A knock means its digit is 1. Silence means 0."
- Ofelia: "Three candles, three questions. At midnight the code changes. We can't open it tonight — let's find out why."

### 11.4 New lock panel (replaces the candle drag and the 5×5 circles)

```
 🕯 🕯 🕯   Candles tonight: 3 of 3
┌───────────────────────── THE VAULT'S CODE ─────────────────────────┐
│  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 … 25  │
│  ?  ?  ?  ?  ?  ?  ?  ?  ?  ?  ?  ?  ?  ?  ?  ?  ?  ?  ?  ?  …  ?  │
└────────────────────────────────────────────────────────────────────┘
  Question:  "Is tumbler 7 a 1?"          [ 👻 Ask the ghost · 1 candle ]
  ▸ Digits known: 0 / 25                  ▸ Guess the whole code instead…
```

- **The code row is the board.** 25 dials in reading order (a 5×5 grid on phones, same numbering), each showing `?` until known. Tapping a dial **selects** it (glow) and the question line updates in words. No drag, no candle piece.
- **Asking**: candle snuffs (animation + `snuff`), then `knock` or silence, then the dial flips from `?` to `1`/`0` with an answer line: "👻 Knock! Tumbler 7 is 1." / "… Silence. Tumbler 7 is 0." Known dials stay lit; asking about a known dial is disabled ("You already know this one").
- **Progress line** under the row: "Digits known: 1 / 25 · 2 candles left · 24 digits to go."
- **Several tumblers (the Phase 3 clue)**: a small toggle "Ask about several tumblers at once" lets the player select more than one dial. The question reads **"Ask about tumblers 2, 9 and 14 together?"** (it does not say "odd" yet: that is the Phase 3 reveal), and the answer is **"👻 Knock… but about all three together. No single digit is revealed."** Those dials get a dotted outline, not a digit. The diagnostics step still refers back to it.
- **Guessing the whole code** moves to a secondary link that opens a small inline strip: current dials (known digits kept, unknown ones random) + "Try this code at the door · 1 candle". Result: "The door rattles. Wrong code. (1 in 33,554,432.)"
- **The notebook drag is removed.** The dial row is the record; a short log under it lists this night's questions and answers.

### 11.5 Guided first question

The first question is guided so the rule is felt before it is free: only the dials are active, the Ask button reads "Choose a tumbler first", and Ofelia's Notes line says "Tap any tumbler, then ask." After the first answer, both remaining candles are free (single, several, or guess).

### 11.6 Midnight: one-tap conclusion (replaces the odds card)

After the 3rd candle, the house goes cold and one question appears:

> You learned **2 of 25 digits** tonight. With 3 questions a night, how many nights until the vault opens?
> [ 9 nights ] [ 25 nights ] [ Never ]

- **Never** → correct: "At midnight the code changed. The 2 digits you learned are gone. One bit per question, 3 questions a night: classical questioning can never catch up." Then the card shows the two facts computed from the night, with no drag: *Guessing: 3 in 33,554,432 ≈ 0.0000089% · Asking: 1 digit per question, 25 needed, 3 allowed.*
- **9 nights** → "That would work if the code stayed put. Listen…" (clock toll) → reveals *Never*.
- **25 nights** → "That's one digit a night. You get three. But listen…" → reveals *Never*.
- The digits count in the question is the real number from the night (0–3).
- The `odds` step and its chip formula are **deleted**; the lesson starts at the lock.

### 11.7 Kickback ledger: 7 drags → 4

- The `sᵢ = 0` row is **pre-filled** as the worked example (`|0⟩ → |+⟩ → |+⟩ → |0⟩`, greyed, "the ghost never touches this tumbler").
- The player fills only the helper (`|−⟩`) and the `sᵢ = 1` row (`|+⟩`, `|−⟩`, `|1⟩`), one box at a time as now, with the same targeted hints.
- The Grover rounds board stays (3 drags): it produces the 4,549 that makes Phase 2 fail.

### 11.8 Copy and naming changes

| Where | Old | New |
| --- | --- | --- |
| Lock tabs | "Try a key" / "Ask the ghost" (equal tabs) | One main action "Ask the ghost"; secondary "Guess the whole code instead…" |
| Budget | "Candles" and a draggable "Candle" | "Candles tonight: n of 3" only |
| Question | (none) | "Is tumbler 7 a 1?" / "Ask about tumblers 2, 9 and 14 together?" |
| Freeze card | Static text + stats | The midnight question (§11.6) |
| `welcome` last line | "Come, sit at the table first. We count before we knock." | "Come to the vault. I'll show you how he answers." |

### 11.9 Implementation list

| Area | Change |
| --- | --- |
| `content/vault.ts` | Remove `odds` step; rewrite `welcome`/`classical`/`freeze` lines per §11.3; `freeze` objective "Answer the midnight question." |
| `VaultChallenges.tsx` | Replace `VaultLock` + `Notebook` with `CodeBoard` (dial row, selection, question line, answer line, progress, several-tumblers toggle, guess strip, night log); add `MidnightQuiz`; delete `ODDS`; `LEDGER` spec with pre-filled example row. |
| `VaultScenario.tsx` | Session: drop `odds`, `oddsSolved`, `placed`; add `quiz: null \| "never" \| "9" \| "25"`, `guided` flag; freeze triggers immediately after the 3rd candle; restore migrates old saves (an `odds` step resumes at `classical`). |
| `StepFormula` | Support pre-filled, locked slots (for the ledger example row). |
| CSS | Dial row (`vault-code`), selected/known/clue states, answer line, quiz buttons; remove unused candle-piece/notebook-drag styles. |
| `es.json` | New strings; stale ones removed. |
| Tests | `vault.test.cjs`: several-tumbler questions never reveal a digit; quiz copy uses the night's real count. Backend unchanged. |
| Playtest | Re-run the Playwright pass at 1280 and 390 px, EN + ES. |

### 11.10 Decisions (review round 3)

1. **Verb:** "mark a tumbler for the ghost" (confirmed).
2. **Several-tumbler toggle:** kept as an optional clue after the guided first question; it powers the Phase 3 "this was never a match lock" line. Tumbler lists read "2, 9, 14" (commas only) so the Spanish templates stay clean.

Review notes / requested modifications:

> Add your changes here.
