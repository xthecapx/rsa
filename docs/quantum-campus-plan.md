# Quantum Campus: optional foundations town

Status: design proposal for review and later implementation. No campus feature has
been implemented by this document. Read the current root `AGENTS.md` and inspect
the code before implementation; the repository may have changed since this plan.

## Purpose and agreed requirements

Add an optional educational town before Coin Town: a school or university where
players can discover the foundations behind the game's circuits and experiments.
It must be fun to explore and play, rather than a lecture or a prerequisite exam.
Players should be able to return when unfamiliar notation or results raise questions.

The user explicitly requested:

- An optional introductory education center, accessible without progression blockers.
- A collectible completion badge that does not gate the rest of the game.
- Coverage of what quantum computing is, why circuits are used, ket notation,
  unitary representations, histograms, and the concepts used throughout the game.
- **Superposition, entanglement, and decoherence as explicit core concepts.**
  Do not relegate entanglement or decoherence to an optional future expansion.
- A staged implementation with an early playable slice to review and iterate.
- This written plan so another model can continue the work later.

The names, story, activities, timings, rewards, and precise layout below are
proposals, not individually approved design decisions. Review them before making
large content or architectural commitments.

## Proposed identity and world integration

Working names: **Quantum Campus / Campus Cuántico**.

Premise: a university is preparing a science-festival open day. Students need help
getting their exhibits working. The player repairs, predicts, experiments, and
helps explain discoveries to visitors. Give the hosts distinct voices and short
dialogue; avoid a professor delivering every explanation.

- Offer new players equally visible choices: Explore Quantum Campus or Go to Coin Town.
- Connect the campus to southern Coin Town with a permanently open, two-way road.
  Determine safe map coordinates during layout work; preserve the existing lab
  approach and all existing roads.
- Keep existing saves at their current location. Do not force returning players
  through a new introduction.
- Allow departure at any time outside an active execution or transition.
- Make every exhibit available immediately. Provide a suggested route without locks.
- Include a hidden entrance to the same personal lab. Return to the campus when
  entered from there, using the existing shared entrance/discovery/travel pattern.
- Campus access, exhibits, badge, and notebook never unlock or block other towns,
  teaching challenges, or functional lab equipment. Existing medal requirements stay intact.

Use a compact, walkable courtyard with identifiable pavilions, student activity,
signs, and small environmental reactions when exhibits are repaired. Reuse the
Kenney asset style and retain licenses. Exact building count and positions are open.

## Teaching and interaction pattern

Each exhibit follows: **try → predict → observe → explain**.

- Begin with a concrete task and let the player touch something quickly.
- Wrong predictions trigger useful feedback and another attempt, without penalties.
- Use three progressive views: Play, Explain, and Show the math. Math should remain
  available without becoming a prerequisite for interacting.
- Keep a persistent visual relationship between the manipulated object, circuit,
  state notation, and observed result. Reveal detail gradually.
- Target roughly 2–4 minutes for a basic exhibit, with optional deeper experiments.
  These are pacing targets to validate, not fixed requirements.
- Reuse the existing circuit workspace, floating tools, measurement panels,
  execution feedback, and keyboard/tap/drag patterns where appropriate.
- Explain each metaphor's limits. Water, couriers, and envelopes are models, not
  physical descriptions of a qubit.

Coin Town already provides practical single-qubit gate puzzles. The campus should
explain their underlying language and evidence, rather than copy the same exercises.

## Core exhibits

### 1. What is a qubit? — the quantum workshop

**Task:** assemble a preparation device, a control device, and a detector into a
working experiment. Compare a classical switch with a controllable qubit.

**Concepts:** bits, qubits, states, preparation, measurement, simulators, and physical
hardware. A qubit is a physical system described by a quantum state; a simulator
models its behavior. Quantum computing offers advantages for particular problems,
not automatic acceleration of every computation.

**Discovery:** preparing a state, changing it, and measuring it are different actions.

**Math drawer:** introduce a two-dimensional state space and the computational basis.

### 2. State passports — pictures, kets, and vectors

**Task:** repair labels on state passports. Match a picture, a ket expression, and
a column vector that describe the same state. Change allowed amplitude controls
and watch ideal probabilities update.

**Concepts:** read `|0⟩` as “ket zero”; `|ψ⟩ = α|0⟩ + β|1⟩`; amplitudes;
normalization `|α|² + |β|² = 1`; probabilities from squared magnitudes; complex phase.
Explain that state notation is neither a circuit instruction nor a measurement result.

**Discovery:** one state can have several equivalent representations.

**Math drawer:** map `|0⟩` to `[1, 0]ᵀ`, `|1⟩` to `[0, 1]ᵀ`, and a general state
to `[α, β]ᵀ`. Introduce complex amplitudes progressively, with phase arrows.
Controls must preserve normalization or explicitly explain invalid proposals.

### 3. Circuit delivery line — reading an experiment

**Task:** guide a courier through preparation, gates, and measurement. Rearrange
operation tiles to repair the route and observe the corresponding circuit.

**Concepts:** wires represent qubits; gates apply transformations; columns describe
operation order; measurement creates classical outcomes. Explain initialization,
the measurement symbol, and classical output. Read circuit time left to right.

**Discovery:** a circuit is an ordered specification of an experiment.

**Math drawer:** applying A then B gives `B A |ψ⟩`. Explicitly connect this matrix
order to the circuit's left-to-right order so the two views do not contradict each other.

### 4. Superposition fountain — same histogram, different state

**Task:** prepare `|+⟩`, change its relative phase to make `|−⟩`, and recombine
contributions to steer the fountain. Compare direct measurements, then add H
before measurement to expose the difference. Also investigate H followed by H.

**Concepts:** superposition, relative phase, constructive/destructive interference,
measurement basis, and the distinction from uncertainty about a hidden classical bit.

**Discovery:** `|+⟩` and `|−⟩` have the same computational-basis probabilities but
behave differently under later gates. One histogram does not describe the whole state.

**Math drawer:** show signed/complex amplitudes combining before magnitudes are
squared. Clarify relative versus global phase. Do not imply that a measurement
reveals every component of the superposition.

### 5. Entangled observatory — paired signals

**Task:** compare two independent superpositions with a Bell pair prepared using H
and CNOT. Collect joint outcomes and change the local measurement bases. Compare
with a classical matching-envelopes model.

**Concepts:** registers, joint states, entanglement, correlations, basis dependence,
and why an entangled state cannot generally be expressed as independent states
for its individual qubits. Explain displayed wire and output-bit ordering.

**Discovery:** matching outcomes in one basis also occur with classical correlation;
additional measurement settings matter. Individual outcomes can remain random
even when the joint outcomes have structure.

**Math drawer:** compare a product state with `(|00⟩ + |11⟩)/√2`. Explain what a
joint histogram shows and what it does not establish. If using an entanglement
witness or Bell test, design and validate it explicitly before claiming certification.

Never award “proof of entanglement” just for observing `00` and `11`. Do not imply
faster-than-light messaging or that one detector sends a controllable signal to another.

### 6. Measurement arcade — from outcomes to histograms

**Task:** measure one preparation, then run batches of fresh preparations. Match
predicted distributions to returned counts and compare small and large batches.

**Concepts:** shots, counts, frequencies, probabilities, bitstring labels, sampling
variation, and why a balanced circuit need not return exactly equal counts.

**Discovery:** every shot repeats the preparation; a batch is not repeated
measurement of the same unchanged qubit. More shots improve statistical estimates
but do not remove systematic noise.

**Math drawer:** distinguish `count / shots` from ideal probability. Do not use
balanced counts as evidence that the source is a physical quantum device.

### 7. The quiet room — protecting interference

**Task:** run H → H, then introduce adjustable environmental disturbance between
the gates. Try to recover the original output. In a companion experiment, measure
after H and the disturbance, without the second H.

**Concepts:** decoherence, loss of phase coherence, environmental interaction,
mixed states, and the differences between decoherence, general device noise,
readout error, and finite-shot variation.

**Discovery:** computational-basis counts may stay balanced while coherence is
lost. The second H makes this loss visible. More shots cannot restore coherence.

**Math drawer:** compare a coherent superposition with a mixture, optionally using
density matrices. Explain why a unitary inverse alone cannot generally recover
coherence lost through interaction with an unobserved environment.

Use an explicitly defined teaching dephasing channel, separate from the selected
backend's native noise. Choose and document its parameter convention: increasing
the control must monotonically reduce coherence over the displayed range. A
phase-flip probability spanning 0 to 1 would not meet that requirement, because
probability 1 is a deterministic Z gate, not maximal dephasing.

Before implementation, establish a scientifically valid, shared execution method
for both delivery targets, including Qollab's available capabilities. Avoid
backend-specific duplicate lesson logic. Do not silently fall back to fabricated
counts or use a gate-only circuit that fails to model the intended channel. If
the proposed method is unsupported, surface the limitation and review an explicit
alternative. The exhibit is still part of the initial complete campus scope.

### 8. Reversible machine shop — rotations and unitaries

**Task:** turn a circular angle control, choose X/Y/Z rotation axes, and construct
an operation that undoes the transformation. Switch between circuit, Bloch sphere,
ket/vector, and matrix views.

**Concepts:** rotation axis and angle, unitary transformations, normalization,
inverses, and how measurement/decoherence differ from reversible gates.

**Discovery:** applying a gate and its inverse restores the ideal input state.

**Math drawer:** highlight the same operation across `X|0⟩ = |1⟩`, vector
multiplication, and the matrix. Introduce conjugate transpose and `U†U = I` only
after the visual experiment. Explain that Bloch-sphere ideal state views are not
state reconstruction from the measured histogram.

## Notebook and contextual help

Provide a searchable, revisitable notebook with concise answers and links to exhibits:

- What is a ket? What do α and β mean? Why is there a minus sign or an i?
- What is a circuit? Which operation happens first? What does M mean?
- What are superposition, interference, entanglement, and decoherence?
- What does each histogram bar mean? Which wire corresponds to which output bit?
- Why do results differ from the prediction? What changes when I select a noisy backend?
- What are an oracle, phase kickback, Grover search, and period finding?

For algorithms already taught elsewhere, link to the existing towns and explain
the prerequisites rather than duplicating entire lessons. Contextual help from
the lab or a lesson must preserve the current work and never submit a job. Decide
during UI design whether help opens an overlay or offers explicit campus travel.

## Optional festival finale and reward

Working title: **Open the Festival**. Working badge: **Quantum Explorer**.

Offer three short exhibit repairs covering superposition, entanglement, and
decoherence, with a final visitor question about what the evidence means. Include
reading a circuit and distinguishing ideal predictions from observed measurements.

- Permit direct attempts without collecting every exhibit completion.
- Offer hints and unlimited attempts; algebra quizzes are not prerequisites.
- Judge correct designs and explanations independently of exact noisy counts.
- Require actual execution where an activity asks the player to run an experiment.
- Badge completion never changes the existing road or functional equipment gates.
- A decorative lab pennant is a proposed reward, not required first-release scope.

## Execution, scientific presentation, and persistence

- Use the same frontend lesson logic and shared backend services on Python and Qollab.
- Python executions honor the existing per-player ideal/noisy preference.
- Qollab honors its selected backend and existing remote-execution policy. Campus
  activities are practice; do not consume IonQ's limited final-job allowance.
  Follow the existing local practice route and identify the backend actually used.
- Inspect current lab and physical-QPU policies before wiring routes. No automatic
  submission on entry, editing, language change, restoration, or help navigation.
- Show actual returned counts, backend metadata, errors, and transient job progress.
- Label ideal state animations, vectors, probability bars, and Bloch views as references.
  A single histogram does not reconstruct a noisy quantum state.
- Do not require equal counts, exact correlations, or a perfect output to pass an
  exercise on a noisy simulator. Validate the intended ideal design and interpretation.
- Save completed exhibits, earned badge, campus/lab discovery, and relevant notebook
  progress using existing storage fallback and migration conventions.
- Public checkpoint codes should support arrival, completed orientation, and badge
  completion. Choose a non-conflicting prefix during implementation. They remain
  milestone shortcuts, not exact recordings of circuits or backend results.
- Campus checkpoint restoration must not grant unrelated town completions. The
  current checkpoint registry assumes a linear teaching sequence; do not insert
  this optional town into that sequence without separating its semantics.
- Define unfinished experiment persistence before implementation. Regardless of
  the chosen scope, restoration must never rerun measurements or provider jobs.
- Preserve language/sound preferences and all existing save keys. Full reset clears
  campus progress; lesson resets must not silently erase unrelated campus achievements.

## Implementation stages and review points

1. **Campus foundation:** map, open travel, optional new-player choice, guide,
   notebook shell, progress model, and shared hidden lab entrance. Validate old-save
   entry, round trips, and independence from road/equipment gates.
2. **First playable slice:** state passports, circuit delivery, and measurement
   arcade. Review actual dialogue, layouts, interactions, and pacing with the user
   before expanding the pattern. This slice is not the complete educational release.
3. **Core quantum exhibits:** superposition fountain, entangled observatory, and
   quiet room. Verify the scientific claims and execution strategy, especially
   dephasing and comparisons across measurement bases. All three belong in the
   initial complete release, not a deferred advanced expansion.
4. **Mathematical connections:** complete the qubit workshop and reversible machine
   shop; connect notation, vectors, rotations, and unitary matrices throughout.
5. **Festival and polish:** optional finale/badge, notebook links, bilingual copy,
   accessibility, save/restore behavior, and both delivery builds.

Suggested next review artifact: a detailed state-passport exhibit walkthrough,
including screens, dialogue, player actions, incorrect-answer feedback, math
drawer, completion criteria, and return-to-world flow. Do not treat this document
alone as approval of every screen or NPC script.

## Likely integration points

Inspect and reuse these existing areas rather than building a separate mini-game framework:

| Concern | Existing locations |
| --- | --- |
| World routing and town shells | `game/components/TownScreen.tsx`, `WorldTownScreen.tsx`, town screen components |
| Maps and interaction | `game/engine/scenes/WorldScene.ts`, `game/engine/maps/`, `game/engine/bus.ts` |
| Teaching content and activities | `game/content/knowledge.ts`, `coinTown.ts`, related bench components |
| Lab entrance and origin-aware return | `game/content/labEntrances.ts`, `game/game/labTravel.ts`, `game/game/town.ts` |
| Lab circuit editor and ideal references | `game/components/` lab components, `game/game/labCircuit.ts`, `labEditor.ts`, `qubit.ts`, `register.ts` |
| Execution | `game/lib/`, `backend/app/core/game_services.py`, `coin_circuit.py`, `register_circuit.py`, Qollab Python adapter |
| Progress and milestones | `game/game/knowledge.ts`, `medals.ts`, `checkpoints.ts`, `restoreCheckpoint.ts`, `storage.ts` |
| Road rules that must stay independent | `game/game/roads.ts` |
| Translation and shared layout | `game/i18n/es.json`, shared world/laptop shells, `game/app/globals.css` |

Use typed content definitions and small reusable visualization components. Extend
existing activity types only where the interaction semantics fit. Keep ideal math,
backend execution, narrative content, and progress rules separately testable. Audit
existing pure-state/register tooling before introducing mixed-state demonstrations.

## Acceptance criteria for the complete feature

- A fresh player can choose the campus or Coin Town and freely travel between them.
- Existing saves and all current progression routes continue to work.
- All eight exhibits are playable, with superposition, entanglement, and decoherence
  explicitly explained and demonstrated.
- The badge can be attempted directly and never blocks unrelated content.
- Histograms use returned measurements; ideal references and teaching noise are labeled.
- Python and Qollab share behavior and respect the selected-backend execution policies.
- Changing language or closing/reopening an activity preserves the expected session;
  refresh/checkpoint restoration never repeats a backend operation.
- The campus lab entrance leads to the same lab and returns to a safe campus tile.
- Keyboard, mouse, touch, portrait, and short landscape layouts remain usable.
- English and natural Latin American Spanish ship together with intact notation.
- Meaningful tests cover math, dephasing semantics, progression independence,
  migration/checkpoints, busy-state ownership, and no automatic submission.
- Run the checks required by `AGENTS.md`, relevant backend tests for service changes,
  native production build, and Qollab build/verification. Keep generated distribution
  ignored and preserve the upload allowlist or explicitly update its contract if needed.

## Open decisions before implementation

- Final campus name, hosts, map layout, and the new-player entry presentation.
- The exact first-exhibit interaction and the depth of math shown by default.
- A portable, valid dephasing implementation and its parameter convention.
- Whether the entanglement exhibit only compares models or includes a validated witness.
- Finale tasks, badge artwork, and whether the decorative reward is in initial scope.
- Checkpoint prefix, unfinished-session persistence, and contextual-help navigation.

When implementation is complete, fold durable behavior into `AGENTS.md` and
`README.md` and remove or archive this pending plan according to repository conventions.
