# Coin scenario: turn the lesson into a game

Status: **Implemented in the coin scenario; awaiting player review.**

The first scenario should teach through actions: **predict → build → run → observe → explain**. Keep the house, walking, shared laptop, English/Spanish support, and simulator-only execution. Reduce dialogue to short exchanges between challenges. RSA keeps its current mechanics during this work.

## 1. The player’s mission

**Decide who starts game night by building a coin program and investigating whether Brayan can predict it.**

Brayan becomes a friendly challenger. The player assembles a program, makes predictions, discovers the weakness of a known seed, and builds a quantum coin circuit. The final measurement visibly decides who takes the first turn at the table.

Proposed first version: three core mechanics, no combat system:

- **Code assembly:** arrange instructions in a small function scaffold.
- **Prediction and reveal:** commit an answer before seeing an outcome.
- **Circuit assembly:** prepare a qubit, place a gate, and measure.

Walking connects the challenges. Dialogue provides context and reacts to decisions; it does not reveal the solution before the player attempts it.

## 2. Playable sequence

| Stage | Player action | Feedback and progression |
| --- | --- | --- |
| At the table | Walk over, talk, and accept the coin-app challenge. | A clear objective replaces a long introductory explanation. |
| Build the classical program | Place the generator setup outside the function and the bit-return instruction inside it. | Correct placement unlocks Run. Incorrect placement highlights the relevant instruction and gives a short hint. |
| Five practice tosses | Run the program and watch the five coins appear. | Keep the sequence visible for comparison. Do not explain the seed’s repeatability yet. |
| Predict Brayan’s replay | Answer: “Brayan uses seed 42 and makes the same five calls. Will his sequence match yours?” | Lock the answer, run his copy, and reveal the sequences side by side. Explain after the comparison. |
| Predict the sixth toss | Keep the five-call sequences visible, run six calls on Brayan’s copy, inspect the highlighted sixth value, choose your next result, then reveal yours. | The player can rerun the six-call comparison rather than memorizing a value from the previous screen. |
| Measurement without H | Predict whether a freshly prepared zero can produce both results. Run ten shots. | Display the all-zero result, then challenge the player to change the circuit. |
| Build the quantum coin | Place both H and measurement on a single-qubit wire, in that order. | Update the Qiskit-style diagram and code preview immediately. Measurement alone gives the all-zero hint; only H → M unlocks the supported circuit. |
| Investigate the distribution | Predict whether 100 shots must split exactly 50/50, run 100, then compare with 1,000. | Ask a question about the actual counts. Explain that equal probabilities allow unequal counts and streaks. |
| Back to the table | Agree that 0 means Ale and 1 means Brayan; request one final toss. | Animate the winner taking the first turn. Save the result and award completion. |

### Seed checkpoint: exact meaning

The question is about **restarting the generator with the same seed and making the same calls**, not about two consecutive tosses necessarily landing on the same side.

Suggested choices:

- “Yes, the whole sequence will match.” — correct.
- “No, calling a random function always creates a different sequence.”
- “Only the first toss will match.”

Keep seed 42 for this first demonstration. The current Python sequence is 0, 0, 1, 0, 0 for the first five calls, with 0 on call six. Obtain the results through the existing API; do not hard-code these values into answer validation.

A wrong prediction must still allow the reveal. Give a short explanation, then a fresh reasoning question if needed; do not trap the player in repeated identical guesses.

## 3. Code and circuit assembly

### Code puzzle

Use a small scaffold, not an unrestricted editor. Offer a few instruction blocks and clearly distinguish setup from the function body:

```python
# Setup: runs once
coin = random.Random(42)

def flip_coin():
    return coin.randint(0, 1)
```

Use one meaningful distractor initially: the valid Python call `coin.seed(42)`. The player fills setup with `coin = random.Random(42)` and the sole function-body slot with `return coin.randint(0, 1)`. Explain that replacing the return with `coin.seed(42)` would reset on every call and return no bit. A comment must never change whether code is accepted. Avoid turning this into a Python syntax quiz.

Support dragging, tapping a block and then a slot, and keyboard selection/placement. All three methods change the same puzzle state. Include undo/reset and an optional hint.

Validate known instruction IDs and generate the displayed code from that structure. Successful assembly selects the existing seeded-coin API operation. Do not evaluate arbitrary user-authored Python or imply that arbitrary code is supported.

### Circuit puzzle

Show preparation and the classical output wire explicitly. After demonstrating the supported no-H circuit, give the player an empty single-qubit wire and separate H and measurement blocks. Show the corresponding code as the circuit changes.

For the first version, keep the backend’s supported configurations: `|0⟩ → M` and `|0⟩ → H → M`. Misplaced blocks receive feedback; unsupported arrangements must not silently run a different circuit or display fabricated results.

## 4. Challenge, rewards, and randomness

Proposed rewards: three visible achievements for assembling the function, explaining seed replay, and building the fair-probability circuit. Give progress for understanding and completed actions, not lucky toss guesses. No lives, timers, or punishment for asking for a hint in this beginner scenario.

Add variety through shuffled block trays and answer ordering. Save the chosen arrangement so a refresh or language switch does not reshuffle an unfinished challenge.

Use actual simulator counts to shape result questions. Handle exact ties and unequal counts; never assume the 1,000-shot batch must be closer to 50/50 than the 100-shot batch. Both batch sizes should be completed before leaving the comparison challenge.

Individual quantum-coin predictions are demonstrations of uncertainty, not scored knowledge questions. Keep the distinction explicit: Qiskit Aer samples quantum probabilities using software randomness. This scenario does not provide physical quantum randomness or prove that a simulator is cryptographically superior to classical generators.

The final toss is made once and persisted. Refreshing, reopening the laptop, or changing language must not reroll it.

## 5. Bug: duplicated computation sound

Reported feedback: “en el experimento en el que se ejecuta 100 y 1000 veces, suena 2 veces … en vez de ser 1 sola”.

**Interpretation for this plan:** each completed batch should produce one short computation cue. Running 100 shots and then 1,000 shots is two separate operations and should produce one cue for each, not two cues for either operation.

What the source currently shows:

- Both buttons call `simulate`, which uses the same `run` wrapper in `game/components/CoinScenario.tsx`.
- `run` has an in-flight guard and one explicit `gameAudio.playSfx("computer")` after success.
- `game/game/audio.ts` clones the audio element for every call, allowing overlapping playback.
- The selected asset is `game/public/assets/kenney/audio/sfx/computer.ogg`.

**Source finding:** the application requests one computation cue per successful run, while `computer.ogg` lasts five seconds. Two separate batches can therefore leave two long cues overlapping. This explains the reported double sound without assuming two backend requests. The audible result still needs your review.

**Implemented for your review:**

1. Derived a 0.7-second cue with a fade from the licensed Kenney clip; unrelated effects keep their original files.
2. The audio controller stops an active computation cue before starting the next and stops it when muted.
3. The 100- and 1,000-shot buttons close after their respective successful result is saved, so accidental repeat clicks cannot rerun a completed batch.
4. The existing experiment runner remains the single owner of the success sound. Failures and restored results do not play it.

Your acceptance check: one 100-shot run gives one audible cue, and one 1,000-shot run gives one cue. Rapid repeated input must not duplicate the operation. Mute, retries, and reopening saved results must remain consistent.

## 6. Implementation structure

| Area | Planned changes |
| --- | --- |
| `game/content/coin.ts` | Shorten pre-action dialogue; move explanations into outcome-specific feedback and define checkpoints. |
| `game/components/CoinScenario.tsx` | Coordinate puzzle completion, locked predictions, run results, rewards, and existing scene navigation. |
| New coin challenge components | Code assembly, prediction/reveal, and circuit assembly; keep interaction logic out of dialogue strings. |
| Coin session persistence | Store puzzle placements, committed answers, challenge variants, completion flags, and final result. Use stable IDs independent of language. |
| `game/i18n/es.json` | Add Spanish prompts, answer choices, hints, accessible controls, and feedback. |
| `game/game/audio.ts` and the experiment runner | Apply the targeted sound fix after identifying its cause. |
| Existing coin API | Reuse seeded randomness and no-H/H simulation. Change the API only if a reviewed mechanic needs it. |

Keep existing saves usable. Completed lessons remain complete, and stored results are retained. If an in-progress save lacks new puzzle state, initialize the relevant challenge with clear instructions rather than silently skipping it or clearing the player’s session. Define these migration rules before changing the save format.

## 7. Delivery order

1. **Computation sound fix:** implemented separately; ready for your listening review.
2. **Seed prediction and reveal:** address the quoted feedback first and move the explanation after the decision.
3. **Code assembly:** introduce creation as the first laptop interaction.
4. **Circuit assembly and result questions:** turn the simulator into an experiment the player designs and interprets.
5. **Narrative, rewards, and replay variety:** shorten dialogue, connect outcomes to the characters, and finish the board-game payoff.
6. **Bilingual copy and save compatibility:** implement throughout the preceding steps, then prepare the complete version for your review.

No combat, arbitrary code execution, real quantum hardware, or RSA redesign in this iteration.

## 8. Review decisions

These are proposed defaults you can change before implementation:

- [x] Use Brayan’s prediction challenge as the central game mechanic; defer combat.
- [x] Start with a small code scaffold and one meaningful distractor.
- [x] Require a prediction before each important reveal, with no penalty for probabilistic outcomes.
- [x] Require both the 100- and 1,000-shot experiments before the final toss.
- [x] Use achievements and character reactions rather than points or lives.
- [x] Keep seed 42 fixed; randomize presentation and use actual simulator outcomes for variety.
- [x] Implement the duplicate-sound fix as the first separate change; listening review remains with you.

Review notes / requested modifications:

> Add your changes here.

## 9. Validation ownership

You handle testing. This plan does not authorize automated tests, browser playthroughs, audio playback checks, or validation builds by the assistant. Implementation should include a concise checklist of behaviors for you to review. No publishing is included.

Suggested review checklist: a new player must act before receiving the seed explanation; wrong answers produce useful feedback; blocks work with mouse, touch, and keyboard; refresh/language switching preserve challenge state; both batch sizes advance correctly and sound once each; final toss and completion persist; the flow retains the shared RSA interface.
