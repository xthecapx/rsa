# Game feedback: prioritized improvement plan

Prepared October 17, 2026, from [the original Spanish review](feedback.md).

The first improvements should make execution recoverable, keep displayed results
and notes accurate, and remove keyboard and screen-reader barriers. Navigation,
translation, and presentation fixes follow. Additional cryptography content comes
after the core experience is reliable.

This is an implementation backlog, not a record of completed fixes. It combines
the review with inspection of the current source. The reported browser behavior,
timings, and console warnings have not been independently reproduced. Source
findings below identify likely causes or existing safeguards; they do not establish
which build or delivery target the reviewer used. Paths are relative to the
repository root. Keep the original review unchanged for traceability.

## Priority and implementation order

- **P1 — next release:** execution failures, misleading learning evidence, and
  barriers to operating the game or reading its results.
- **P2 — following improvements:** discoverability, comprehension, usability,
  measured performance optimization, and runtime polish.
- **P3 — optional enrichment:** useful new material that does not repair an
  existing interaction.

No P0 incident is established by this review. Promote an item if reproduction
reveals data loss, an unrecoverable progression blocker, or a widespread failure.
Accessibility issues are not cosmetic, even where the review calls them nitpicks.

The table gives the default implementation order. Effort is relative: S is a
focused change, M spans several components, and L affects execution or transport
lifecycle. These are planning estimates, not delivery dates.

| Order / ID | Priority | Work item | Effort | Why this comes here |
| --- | --- | --- | --- | --- |
| F01 | P1 | Diagnose slow runs and implement safe timeout/recovery feedback — implemented | L | Failures and long waits interrupt every experiment surface. |
| F02 | P1 | Invalidate Grover results on every configuration change | M | A graph under the wrong round count teaches the wrong relationship. |
| F03 | P1 | Scope RSA notes to their act and label mathematical values | M | Unrelated or mislabeled values undermine puzzle reasoning. |
| F04 | P1 | Make movement focus explicit and recoverable | M | Keyboard users must be able to resume exploration. |
| F05 | P1 | Summarize large Shor histograms accessibly | M | Hundreds of entries obstruct access to the useful result. |
| F06 | P2 | Add an obvious route from the professor to the campus | S–M | The current recommendation lacks a corresponding action. |
| F07 | P2 | Correct translations, grammar, and misleading directions | M | Fixes comprehension across the existing game. |
| F08 | P2 | Clarify festival markers and synchronize completion displays | S–M | Players should know when their work is finished. |
| F09 | P2 | Give repeated controls contextual accessible names | M | Makes circuit editing understandable without visual position. |
| F10 | P2 | Reduce minimap obstruction and clarify pointer behavior | M | Restores usable exploration space, especially on mobile. |
| F11 | P2 | Improve typewriter text and reveal controls | S–M | Makes dialogue readable without discovering a hidden workaround. |
| F12 | P2 | Explain public-key authentication and textbook RSA limits | M | Corrects conceptual omissions at the relevant story moments. |
| F13 | P2 | Optimize measured simulation/setup bottlenecks | M–L | Requires F01 measurements; avoid speculative caching. |
| F14 | P2 | Distinguish sound preference from successful audio activation | M | The interface should accurately describe audible behavior. |
| F15 | P2 | Investigate engine initialization warnings | M | Repair lifecycle problems if reproduced, rather than hiding warnings. |
| F16 | P3 | Add an optional post-quantum migration epilogue | S–M | Extends the lesson without adding progression requirements. |

## Ordered work packages

### F01 — Execution latency, timeout messages, and recovery

**Feedback covered:** empty-circuit timeout after more than 20 seconds; small runs
taking 6–12 seconds; 16-shot campus runs taking 22–24 seconds; disabled controls;
requests for progress phases, cancellation, retry, and timing separation.

**Source evidence:** `game/lib/request.ts` supports caller-selected timeouts;
`game/components/useAsyncOperation.ts` locks execution and rejects stale owners,
but deliberately does not cancel or retry. HTTP execution uses
`backend/app/api/quantum_execution.py` and a single long-lived worker in
`backend/app/quantum/worker.py`. A worker timeout stops waiting without stopping
the submitted work. The reused worker also protects against a documented native
Qiskit crash; increasing its thread count is not a routine performance fix.
Qollab already has provider progress through `game/components/QuantumJobProgress.tsx`.

**Plan:**

1. Record the affected build, browser/device, web or Qollab target, actual backend,
   circuit, shots, and cold/warm state. Reproduce empty circuits, small campus
   experiments, and consecutive requests, including one following a timeout.
2. Measure client elapsed time, transport/bridge wait, server queue time, circuit
   preparation, execution, response processing, and result rendering separately.
   Record median and p95 over a repeatable sample; report cold starts separately.
   Do not infer compute cost from shot count alone.
3. Show elapsed time and truthful status. Use queue/simulation/postprocessing
   phases only where instrumentation supplies them; otherwise say that the game
   is waiting for the backend. Reuse provider status rather than inventing progress.
4. Translate timeout, unavailable-backend, and execution-failure messages. Preserve
   the editable recipe and valid earlier evidence. Offer explicit retry where
   execution policy permits, without automatic resubmission.
5. Define cancellation by target before adding a button: remove queued work when
   supported; distinguish stopping the UI wait from actually stopping computation.
   AbortSignal alone does not cancel Python or a provider job. Keep execution
   ownership and travel/reset guards until work is safely settled or detached;
   a detached result must never mutate a newer session. For unsupported active
   cancellation, state the limitation and keep status available.
6. Preserve Qollab's single remote-job allowance, including ambiguous submission
   failures. Cancellation must not refund it or make a second submission possible.
   A remote retry may require the existing checkpoint/export/restart flow.

**Acceptance:** induced timeout and failure produce understandable bilingual
messages and a valid recovery path; no late response changes a newer run; repeated
clicks do not duplicate work; retry occurs only on an explicit permitted action.
Demonstrate queued versus active cancellation behavior separately on each target.
Capture a latency baseline before claiming a speed improvement. Do not simply
increase timeouts or unlock all controls.

**Implementation status — October 17, 2026:** implemented shared elapsed-time
feedback, actionable EN/ES timeout/unavailable errors, and explicit recovery.
HTTP practice supports stopping the client wait and discarding late responses;
final story decisions retain their lock. Qollab can remove queued calls before
Python starts, while active calls retain the serial queue and remote allowance.
The status actions render within the laptop modal so keyboard focus and screen
readers can reach them. Server worker timeouts now cancel queued futures instead
of letting obsolete requests run later. Active native work remains serialized.

Server-Timing headers/logs separate queue and worker time. Browser User Timing
separates response wait, decoding, and next-paint delay. The repeatable benchmark
is `backend/tools/benchmark_quantum.py`; usage and timing limitations are in
README. A first-request and 20-warm-request baseline per case on local macOS ARM
produced the following HTTP results (milliseconds):

| Circuit | Ideal direct: first / warm median / p95 | Noise through game proxy: first / warm median / p95 |
| --- | --- | --- |
| Empty lab, 16 shots | 1157.71 / 37.04 / 41.85 | 53.07 / 17.51 / 20.37 |
| Campus H, 16 shots | 38.03 / 41.06 / 57.45 | 17.09 / 17.31 / 18.16 |
| Campus H, 256 shots | 55.25 / 47.80 / 60.40 | 17.39 / 18.04 / 22.80 |

All 126 requests succeeded. Only the first ideal case started against a fresh
backend; subsequent first samples are not cold starts. These are different
simulator workloads and transport paths, not a before/after speed comparison.
The reviewer's 6–24 second waits were not reproduced locally. Deployment-specific
latency diagnosis remains an F13 follow-up using the new instrumentation.
Native/provider interruption after execution starts is explicitly unsupported.
Queued/active cancellation, timeouts, late results, explicit retry, preserved
campus settings/evidence, and Qollab deadline/allowance behavior have automated
coverage; physical provider execution is not needed for these checks.
Validation passed: 139 Node tests, 107 React tests, 260 backend tests, lint/types,
Next production build, and the 20-file Qollab build/verification. A real Chrome
smoke test used an artificial five-second local delay to confirm EN/ES feedback,
keyboard cancellation within the modal, unchanged circuits, late-result discard,
explicit retry, actual returned counts, refresh/resume, and portrait/short
landscape layouts. The artificial delay was a temporary test harness, not a
production change or a latency measurement.

**Background-wait refinement:** the shared laptop can now be minimized with
Wait in background or Escape during a quantum request. Its existing owner stays
mounted, allowing movement within the current area with a compact execution
indicator. Return opens the same experiment; completion remains minimized and
does not steal focus or scroll. Controls that could replace the executing circuit
or unmount its owner remain guarded. This is a UI lifecycle change over the
existing HTTP/Qollab requests, without a new Python polling service.
Validation: 139 Node tests and 112 React tests passed, with lint/types and both
production targets. Dedicated background tests cover owner retention, duplicate
prevention, modal/focus release, completion and errors while hidden, language
changes, protected checkpoint restoration and stale-result suppression. Chrome
with a temporary 15-second response delay confirmed walking and changing language
during execution, completion without reopening, a compact phone layout, and
keyboard return to fresh measurements without a second request.

### F02 — Grover result ownership

**Feedback covered:** changing four rounds to three leaves the old graph visible.

**Source evidence:** `game/components/GroverScenario.tsx` already clears `lastRun`
in the round-control callback. However, the transition to the measurement step
sets `repeat: 3` without explicitly clearing `lastRun`. This is a concrete path
to investigate, alongside the exact reported interaction and deployed version.

**Plan:** audit every circuit/round transition, restored session, and animated
view in `GroverScenario.tsx` and `game/components/GroverChallenges.tsx`. Clear the
current preview immediately when its configuration changes. Keep collected round
peaks as explicitly historical comparisons. If retaining another old result,
show its original configuration and label it as previous; never relabel it with
the new rounds. Preserve the saved final measurement and its explorer.

**Acceptance:** execute four rounds, change to three, and enter the final
measurement stage after comparing several rounds. In every path, current counts
and ideal animation match their own configuration or disappear until Run.
Closing/reopening, changing language, and refresh do not submit another job.

### F03 — RSA notes and mathematical labels

**Feedback covered:** unexplained `k=20` in plaintext, `k=12` in RSA, and notes
persisting across acts.

**Source evidence:** `MemoryRail` in `game/components/LaptopScene.tsx` renders
`k = vars.shift` whenever a recovered value and shift exist, without an act check.
This supports investigating unrelated Caesar values in other acts. It does not
prove that the reported 12 was intended to be φ(N).

**Plan:** derive displayed notes from the current act and validated evidence.
Label Caesar shift, modulus N, totient φ(N), public exponent e, and private
exponent d explicitly where relevant and earned. Inspect reset/advance/restore
paths in `game/game/state.ts`, `game/game/runtime.ts`, and `game/game/effects.ts`.
Filter or separate historical notes rather than deleting valid checkpoint data.
Do not reveal future puzzle values or treat a default variable as a discovery.

**Acceptance:** play acts 1–4 consecutively, restart one act, and restore older
checkpoints. No Caesar shift appears as RSA evidence; each displayed value has
the correct meaning and provenance. Missing legacy context is not invented.

### F04 — Keyboard focus and movement

**Feedback covered:** W fails after focusing the minimap; no obvious canvas focus;
typing must not move the player; request for keyboard destination navigation.

**Source evidence:** `game/components/GameCanvas.tsx` returns a host without an
explicit focus target or accessible name. The exact keyboard failure still needs
reproduction through the engine and surrounding controls.

**Plan:** provide a named, focusable play area with a visible focus indicator and
concise movement instructions. Give players an obvious keyboard route back from
the minimap and toolbars. Restore appropriate focus after overlays while requiring
a fresh interaction press. Scope movement shortcuts so fields, editable content,
dialogs, and button interactions retain their expected behavior. Add keyboard
destination controls using existing movement/pathfinding, initially for available
town exits and key destinations; respect locks and concealed lab discoveries.

**Likely locations:** `GameCanvas.tsx`, `game/components/WorldTownScreen.tsx`,
`game/components/TownScreen.tsx`, and `game/engine/scenes/WorldScene.ts`.

**Acceptance:** keyboard-only players can enter the play area, move, open/close
the minimap, and resume movement without a mouse. Typing WASD in a field never
moves the character. Tab remains usable, overlays pause movement, and touch
controls continue to work. Verify with a screen reader, not only DOM assertions.

### F05 — Large Shor result accessibility

**Feedback covered:** an eight-bit result exposes up to 256 count entries.

**Source evidence:** `game/components/CircuitHistogram.tsx` sends every outcome
to `HistogramBars`; Shor uses that shared display.

**Plan:** show a concise summary with shot total, distinct outcomes, backend,
leading peaks, and the remaining outcomes' aggregate count. Start with a small
fixed number of peaks, such as eight, with deterministic tie ordering. Offer
“Show all counts” as a collapsed, labeled region containing a semantic table.
Prefer disclosure or pagination over virtualization unless measurement justifies
it; off-screen virtual rows can be difficult for assistive technology to reach.
Keep every count in the data used for period analysis and preserve bit ordering.

**Acceptance:** the default screen-reader traversal reaches the summary and next
action without reading 256 entries. All outcomes remain available on demand;
summary totals reconcile with the complete distribution. Collapsing the table
returns focus predictably. Smaller lesson histograms remain clear.

### F06 — Campus discovery from Quantum Town

**Feedback covered:** the professor recommends the campus, but the reviewer found
only the `qc1` checkpoint route.

**Source evidence:** `TownScreen.tsx` includes the campus in the professor's prose
but not in his choices. Ordinary travel already exists through Coin Town's south
road; the problem is discoverability from the hub, not a missing campus entrance.

**Plan:** add an explicit “Visit Quantum Campus” choice that performs guarded
travel to the campus arrival point. Explain that the campus is optional and also
reachable from Coin Town's south road. Reuse normal travel behavior, not checkpoint
restoration. Keep the qWard reward conversation reachable and make the campus
choice available on the subsequent normal greeting.

**Acceptance:** a player finishing the four challenges can reach the campus from
the professor without opening Save progress. No medals, discoveries, circuits,
equipment, or remote allowance change. Travel remains blocked during active work.

### F07 — Translation, grammar, and directions

**Feedback covered:** “Backend agrees: m=…”, “Measure -> Classical PC: counts”,
“reconstruida mediante hand”, English-word prompts for CAFE, “Un complemento paral
portátil”, “1 cúbits”, “1 ejecuciones”, “Escáner de el portátil”, “Cierral portátil”,
and a Foundry instruction pointing to Quantum Town.

**Source evidence:** several exact typos exist in `game/i18n/es.json`, and
`game/components/RsaWorkbench.tsx` constructs “Backend agrees” dynamically.
Other strings and the wrong-town instruction need contextual reproduction.

**Plan:** audit source text and runtime interpolation in `game/i18n/translate.ts`,
`es.json`, RSA tools, Shor wiring labels, and lesson content. Translate complete
templates; preserve mathematical placeholders and persisted-message aliases.
Use proper singular/plural forms. Correct “Cierra el portátil”, “Escáner del
portátil”, and “Un complemento para el portátil”. Explain the game's fixed
English plaintext convention without presenting CAFE as a uniquely recognizable
English word; use a more precise prompt where needed. Check return instructions
against the actual lesson entry town, including replay entry from Quantum Town.

**Acceptance:** every reported phrase is corrected or documented with its actual
context; EN/ES walkthroughs show no unexplained language mixing. Puzzle answers,
codes, IDs, formulas, and saves remain compatible. Switching language preserves
work. Cover dynamic templates and singular counts in translation regressions.

### F08 — Festival state and legend clarity

**Feedback covered:** a visual “F · Festival ?” appeared after completion while
accessible text said completed.

**Source evidence:** `game/components/CampusScreen.tsx` already includes the
festival in completed map targets when the badge exists. Its static legend also
contains a separate `? · Notebook` key. Verify whether the reviewer saw a stale
status marker or ambiguous spacing between legend entries.

**Plan:** make legend entries visually distinct and derive visual markers,
accessible names, and completion props from the same semantic state. Inspect
`game/components/WorldMinimap.tsx`, campus interaction state, and scene updates.

**Acceptance:** complete the festival, revisit it, change language, and reload.
Map, host, legend, and accessible status agree; the notebook symbol cannot be
mistaken for an unfinished festival. Do not alter completion requirements.

### F09 — Contextual names for repeated controls

**Feedback covered:** multiple controls announced only as H.

**Plan:** audit shared gate palettes and circuit builders. Distinguish “Add H
gate” from an installed “H gate, wire 1, position 2”, and contextualize remove,
reorder, and settings actions. Preserve compact visible symbols and translate
accessible labels. Use native control semantics and existing keyboard behavior.

**Acceptance:** a screen-reader user can identify, add, move, configure, and remove
the intended gate when several identical gates exist. Check Coin, register,
campus, lab, Grover, and Ghost Key surfaces.

### F10 — Minimap size and pointer behavior

**Feedback covered:** expanded minimaps cover substantial terrain and intercept clicks.

**Plan:** review `game/components/WorldMinimap.tsx`,
`game/components/TownMinimap.tsx`, and `game/app/globals.css`. Keep touch defaults
collapsed, constrain expanded size using the shared visible viewport, and retain
the user's toggle on rotation. Provide a reachable collapse control. Confine
pointer interception to visible interactive map content; do not make actual map
clicks pass through and move the character underneath.

**Acceptance:** portrait and short landscape layouts leave usable play space;
uncovered terrain accepts clicks; map interactions never trigger unintended world
movement. Keyboard access follows F04.

### F11 — Dialogue reveal and clipping

**Feedback covered:** typewriter text appears temporarily truncated; “Show text”
exists but is not sufficiently discoverable.

**Plan:** distinguish intentional partial reveal from layout clipping. Keep a
clearly labeled reveal action visible during typing, preserve the full-text
reading path for assistive technology, and respect reduced motion. Check shared
`game/components/DialoguePresentation.tsx`, `game/components/DialogBox.tsx`, and
lesson dialogue wrappers. Keep actions visible while long prose scrolls.

**Acceptance:** long EN/ES dialogue works on short landscape screens and with an
open mobile keyboard. Reveal does not accidentally advance a choice, and screen
readers are not flooded with per-character announcements.

### F12 — Authentication and realistic RSA context

**Feedback covered:** key substitution misses a teaching opportunity; direct
letter-to-number RSA lacks an explanation of real encoding and padding.

**Plan:** add brief bilingual explanations near the key-substitution decision and
the small-RSA workbench, with optional deeper reading. Explain that encryption
alone does not establish who owns a public key. A certificate, trusted signature,
or authenticated channel needs a trusted verification basis; an attacker signing
their own replacement key does not solve the problem.

Label the small integer/letter exercise as textbook arithmetic. Explain that
practical RSA encryption uses an encoding scheme such as RSAES-OAEP, often to
protect key material, rather than independently encrypting letters. RFC 8017
requires OAEP support for new applications within its scope. Keep these
explanations separate from claims about resistance to quantum attacks.
See [RFC 8017, section 7](https://www.rfc-editor.org/rfc/rfc8017.html#section-7).

**Likely locations:** `game/content/acts/act3.ts`, `game/content/acts/act4.ts`,
`game/components/RsaWorkbench.tsx`, knowledge content, and `game/i18n/es.json`.

**Acceptance:** the story distinguishes confidentiality, key authentication,
encoding, and quantum vulnerability without adding a new required puzzle or
changing RSA answers, arithmetic, rewards, or save structure.

### F13 — Performance optimization after measurement

**Feedback covered:** repeated resource/setup work and suggested caching of small
teaching circuits.

**Dependency:** F01 must identify the dominant delay. If it identifies a concrete
cause of the P1 timeouts, move that corrective optimization into F01 immediately.

**Plan:** optimize the measured cause: cold initialization, queue buildup, repeated
backend setup, circuit construction/transpilation, resource loading, or rendering.
Cache deterministic reusable preparation only where safe. Key caches by relevant
circuit parameters, backend configuration, noise model, and implementation version;
bound their memory use and prevent mutation of shared cached objects.

Do not cache sampled counts as the answer to a new Run. Fresh preparations, real
returned counts, original backend metadata, and the distinction between ideal
references and observations are part of the lesson. Reopening an existing result
should reuse its snapshot without submitting anything. Do not replace the
long-lived worker without resolving its documented native-runtime constraint.

**Acceptance:** compare the same cold/warm benchmark cases before and after.
Report end-to-end median/p95 and stage timings, with no unexplained timeouts in
the agreed sample. Set a numeric warm-run budget after baseline collection;
there is not enough deployment evidence to promise a defensible number now.
Tests demonstrate fresh execution per Run and separation between ideal/noise modes.

### F14 — Audio activation

**Feedback covered:** Excalibur cannot unlock the audio context while the UI says
sound is enabled.

**Plan:** reproduce first load, mute/unmute, background/resume, and Qollab iframe
entry. Inspect `game/game/audio.ts`, `game/game/synth.ts`,
`game/components/MuteButton.tsx`, and engine audio ownership. Distinguish stored
sound preference from actual playback readiness. Resume audio on an eligible user
gesture and provide an actionable state if activation fails; do not suppress the
warning as the fix.

**Acceptance:** successful activation produces audible feedback; blocked activation
does not falsely claim playback is active. Mute persists and computation sounds
remain single-owner, without replaying after checkpoint restoration.

### F15 — Engine initialization lifecycle

**Feedback covered:** update/draw warnings before scene initialization.

**Plan:** capture full warnings and reproduction steps on first load, rapid travel,
overlay close, and teardown. Inspect `game/engine/createGame.ts`,
`game/components/GameCanvas.tsx`, and scene readiness. Guard commands and updates
with the correct lifecycle state; preserve one active engine and translated
loading/retry behavior. Classify a harmless development-only warning separately
from an actual initialization race. Promote to P1 if it blocks play or leaks engines.

**Acceptance:** reproduced production paths no longer update/draw uninitialized
scenes, leak engines, or leave a blank world. Any unresolved warning has a recorded
cause and impact rather than being silently filtered.

### F16 — Optional post-quantum epilogue

**Feedback covered:** introduce migration after Shor and RSA.

**Dependency:** F12 establishes the distinction between encryption and signatures.

**Plan:** add an optional final conversation or notebook entry explaining why
organizations prepare for migration, inventory vulnerable cryptography, and plan
replacement. Identify ML-KEM as key encapsulation and ML-DSA/SLH-DSA as signature
schemes. NIST finalized these first three standards in August 2024 and encouraged
transition planning; do not describe all three as encryption algorithms or claim
the game's small Shor run breaks production RSA. Link to
[NIST's standards announcement](https://www.nist.gov/news-events/news/2024/08/nist-releases-first-3-finalized-post-quantum-encryption-standards)
and recheck current guidance when writing the final lesson.

**Acceptance:** short bilingual content is available after the RSA lesson without
a new medal, mandatory task, cryptographic implementation, or provider job.
Any migration dates or standards-status claims have current primary sources.

## Delivery and validation

1. **Establish the baseline:** reproduce F01–F05 against an identified build;
   capture the remaining reports while walking the affected lessons. Record
   confirmed, not reproduced, and already fixed outcomes separately.
2. **Ship the P1 fixes:** complete F01–F05 in table order. F01 diagnosis comes
   first, but a provider cancellation limitation should not block independent
   result, note, or accessibility fixes. Document supported recovery behavior.
3. **Ship navigation and comprehension improvements:** F06–F12. Apply small
   confirmed copy corrections early when touching those surfaces; accessibility
   names and focus changes must be reviewed together.
4. **Finish measured runtime work:** F13–F15, promoting any verified execution
   blocker to the first batch. Avoid speculative infrastructure changes.
5. **Add optional enrichment:** F16 after the corrected core experience is verified.

For each implementation item, record its reproduction, changed behavior, and
acceptance evidence here until complete. Once implemented, move enduring behavior
into `AGENTS.md`/`README.md` as appropriate; do not keep this plan as a competing
description of the shipped game.

Shared release checks:

- Exercise affected paths in English and Spanish, keyboard-only use, mouse,
  touch, portrait, and short landscape. Use a real screen reader for F04/F05/F09.
- Verify close/reopen, language switching, refresh, old-save restoration,
  checkpoints, and lesson resets. Preserve earned progress and current evidence;
  none of these actions may implicitly submit work.
- Validate web ideal/noise runs and Qollab bridge behavior separately. Use mocked
  provider lifecycle tests for queued/running/failed/cancelled/late responses;
  remote-job allowance rules remain intact.
- Add focused regressions for actual behavior changes, using existing suites such
  as `scenarioExecution`, `rsaExecution`, `asyncOperation`, `campusExecution`,
  `request`, `transport`, and `i18n`. Do not rely solely on text snapshots for
  focus, cancellation, or stale-response correctness.
- For game implementation, run `npm run check` and `npm run build` from `game/`;
  run relevant backend `pytest` coverage for Python changes. Build and verify
  Qollab when shared execution or packaging changes. Keep generated uploads out
  of Git.
- For this documentation-only task, check local references and whitespace;
  no application build or provider execution is required.
