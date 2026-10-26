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

| Order / ID | Priority | Status | Work item | Effort | Why this comes here |
| --- | --- | --- | --- | --- | --- |
| F01 | P1 | Done | Diagnose slow runs and implement safe timeout/recovery feedback | L | Failures and long waits interrupt every experiment surface. |
| F01b | P1 | Done | Close F01 gaps: cold start, proxy ceiling, per-circuit estimates, remote notice | S–M | F01 added feedback but not the likely cause of the 20 s+ waits (see review below). |
| F02 | P1 | Done | Invalidate Grover results on every configuration change | S | Round transitions and restored previews now keep results tied to their circuit. |
| F03 | P1 | Done | Scope RSA notes to their act and label mathematical values | M | Unrelated or mislabeled values undermine puzzle reasoning. |
| F04 | P1 | Done | Make movement focus explicit and recoverable | M | Keyboard users must be able to resume exploration. |
| F05 | P1 | Done | Summarize large Shor histograms accessibly | M | Hundreds of entries obstruct access to the useful result. |
| F06 | P2 | Done | Add a small, discreet signpost to the campus in Quantum Town | S | The professor's recommendation lacks a findable pointer; no teleport. |
| F07 | P2 | Done | Correct translations, grammar, and misleading directions | M | Fixes comprehension across the existing game. |
| F08 | P2 | Done | Clarify festival markers and synchronize completion displays | S–M | Players should know when their work is finished. |
| F09 | P2 | Done | Give repeated controls contextual accessible names | M | Makes circuit editing understandable without visual position. |
| F10 | P2 | Done | Reduce minimap obstruction and clarify pointer behavior | M | Restores usable exploration space, especially on mobile. |
| F11 | P2 | Open | Improve typewriter text and reveal controls | S–M | Makes dialogue readable without discovering a hidden workaround. |
| F12 | P2 | Open | Clarify that the game breaks a simplified protocol, not real RSA (authentication content deferred) | S | Prevents a false impression; larger lessons wait. |
| F13 | P2 | Open (mostly absorbed by F01b) | Optimize measured simulation/setup bottlenecks | M–L | Requires F01 measurements; avoid speculative caching. |
| F14 | P2 | Open | Distinguish sound preference from successful audio activation | M | The interface should accurately describe audible behavior. |
| F15 | P2 | Open | Investigate engine initialization warnings | M | Repair lifecycle problems if reproduced, rather than hiding warnings. |
| F16 | P3 | Deferred | Optional post-quantum migration epilogue | S–M | Revisit after F12's note and the deferred authentication content. |
| F17 | P2 | Open | Client-side simulator for a backend-free local build | L | Lets the full game run on one machine; waiting times can then be produced in the client. |

## Status: what is done and must not be redone

Legend: **Done** is implemented, tested, and documented; do not re-plan or
re-implement it. **Open** is still to do. **Deferred** is intentionally postponed.
A Done item is reopened only by a new, reproduced defect, which becomes a new ID
(for example F01c) instead of editing the finished work package.

**Done — F01 and F01b (October 17–19, 2026).** Settled decisions and results:

- Shared elapsed-time feedback, translated timeout/unavailable messages, explicit
  retry, Stop waiting on HTTP practice runs, queued-run cancellation on Qollab, and
  “Wait in background” in the laptop. No automatic retry, no claim to cancel
  active native work, and the remote-job allowance is never refunded.
- Server queue/worker timing, browser User Timing, and the repeatable benchmark
  (`backend/tools/benchmark_quantum.py`).
- Backend boot warm-up, one health ping from the first town, proxy timeout raised
  above the longest server timeout, Shor limit 150 s (client 165 s, proxy 170 s).
- Per-circuit measured estimates (`backend/tools/measure_run_estimates.py`,
  `game/lib/runEstimates.json`), per-run timers/labels, first-run “waking up”
  hint, abandoned-run warning, and the one-time remote-run notice. No countdown
  for remote jobs.
- Hosting stays as is: scale-to-zero, no paid always-on instances. Do not propose
  changing `--min-instances`, CPU or memory.
- Side fix: Echo Chamber 500 for PIN 1111 (with tests).

**Done — F02 (October 19, 2026).** Changing Grover rounds or boxes clears the
current preview, including the transition from a ×4 run to “Measure at ×3” and
the whiteboard return. Restore discards mismatched unmeasured previews; collected
round peaks and the saved final PIN/explorer remain intact. See F02 for validation.

**Done — F03 (October 19, 2026).** Laptop notes now follow the active act and
validated workbench evidence, with descriptive EN/ES labels. Caesar shifts never
appear as plaintext/RSA notes, private RSA values appear only when earned, and
missing legacy context is not invented. Recorded-batch re-keying keeps the
capture synchronized. Existing checkpoint data and save keys are preserved.

**Done — F04 (October 21, 2026).** Outdoor keyboard control now belongs to a
named play area, with visible focus, translated instructions and a Return to
exploration control. Destination walking uses existing paths and road locks,
announces arrival/cancellation, and respects concealed lab discoveries and busy
travel guards. See F04 for validation.

**Done — F05 (October 24, 2026).** Large returned histograms now show up to
eight leading observed outcomes, exact shot/distinct totals, original backend
metadata and the remaining count aggregate. All counts remain in an optional
semantic table. The owner will perform the VoiceOver check; see F05 for validation.

**Done — F06 (October 24, 2026).** A small signpost beside Quantum Town’s
south path explains the ordinary campus route through Cipher Town and Coin Town.
The professor points to it in both completion greetings. EN/ES inspection uses
Space or Inspect and changes no saved state; there is no teleport or new marker.
See F06 for validation.

**Done — F07 (October 24, 2026).** RSA confirmations and Shor wiring logs
translate at display time, count labels use singular/plural templates, and the
reported Spanish typos are corrected. Caesar explains its unchanged English
A–Z message convention; Grover’s exit hint follows its saved entry town. See F07
for validation and the reported “hand” context.

**Done but not yet verified (verification, not new work):** deployed cold/warm
latency on Cloud Run; a >30 s response through the Next proxy; a browser and
screen-reader pass over the new panel and notice; a real physical-QPU wait.

**Done — F08 (October 24, 2026).** Campus activities, including the festival,
share status derivation across map, scene, journal and host completion. The
notebook has a distinct ▤ symbol and its own legend row; completion wins over
retained evidence. See F08 for validation.

**Done — F09 (October 24, 2026).** Circuit palettes announce Add actions;
installed components and their actions identify the affected wire/position or
story slot. Repeated H palette copies have distinct names. EN/ES labels preserve
visible symbols and interaction IDs. Real VoiceOver verification remains for the
owner, following the preference to leave it off; see F09 for validation.

**Done — F10 (October 24, 2026).** Both outdoor minimaps share a compact,
viewport-bounded panel with a fixed collapse toggle and scrollable content.
Collapsed maps hide navigation too; rotation retains the player's choice. Empty
HUD space passes pointers through, while the visible map consumes them. See F10
for validation.

**Open:** F11, F12 (small clarification only), F13 (only if deployed
measurement shows a cause other than cold start and noisy Shor), F14, F15, F17.

**Deferred:** F16 (post-quantum epilogue) and the authentication/man-in-the-middle
lesson originally in F12.

## Ordered work packages

### F01 — Execution latency, timeout messages, and recovery (Done)

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

**F01 review (October 19, 2026):** the client/server mechanics are sound: the
HTTP wait is aborted without claiming to stop native work, queued futures are
cancelled, late results are rejected twice (`throwIfAborted` after fetch and after
`json()`), and Qollab cancels only before Python starts. Client timeouts (20/40/165 s)
exceed the matching server timeouts (15/30/150 s), so the server's 504 normally
arrives first with a translated message. Gaps that keep the reviewer's report open:

1. **The reported waits were not explained.** "signal timed out" is the message of
   the old `AbortSignal.timeout(20000)`, so the empty-circuit failure was most
   likely the previous client timeout, not a server error. 22–24 s for 16 shots
   with 6–12 s typical is not compute cost (local warm median is ~17–41 ms). The
   deploy script runs the backend at `--cpu=1 --memory=512Mi --min-instances=0`
   and the backend has no startup warm-up (`app/main.py`, `worker.py`: no
   lifespan/import preload). A cold Cloud Run instance importing Qiskit/Aer on the
   first request, plus 512 Mi pressure, fits the data. The local benchmark cannot
   see this, and the plan deferred it to F13. Treat it as F01b, not optimization.
2. **Proxy ceiling is unverified.** The game reaches the backend through a Next
   `rewrites()` proxy (`game/next.config.ts`). Next's rewrite proxy has its own
   default timeout (documented as 30 s; confirm for the installed version and set
   `experimental.proxyTimeout` if needed). Shor requests allow 150–165 s, so the
   proxy could cut them first and surface as a generic failure, bypassing the
   translated 504 path. Add a test or manual check with a >30 s response.
3. **Late result still burns the single worker.** After "Stop waiting" or a client
   timeout of an *active* job, the next Run queues behind the abandoned work on
   the one-thread worker, so a retry can look like another timeout. The UI should
   say "the server may still be finishing the previous run" on retry, or the
   server should expose queue depth in `Server-Timing`/status so the wait is
   truthful.
4. **Phase labels are partly invented on the web target.** `labels` in
   `QuantumJobProgress.tsx` only ever receive `waiting`/`retrieving` over HTTP, so
   the reviewer's "queue → submit → simulate → postprocess" request is still not
   met for web. The plan's rule (only show phases instrumentation supplies) is
   right; either accept that, or add a lightweight status/streaming endpoint.
5. **Acceptance was never run against a deployed backend.** The 126-request
   baseline is local. F01b must record cold and warm numbers on the actual Cloud
   Run services.

### F01b — Cold start and transport ceilings (Done)

**Constraint (owner decision, October 19, 2026):** no added hosting cost. Keep
`--min-instances=0`, current CPU/memory, and the current deploy flags; do not
propose paid always-on instances or larger sizes. Only code-side mitigations.

**Plan:** (a) if the deployed service is reachable, measure first-request and
idle-then-request latency with the existing benchmark and `Server-Timing`;
otherwise rely on local cold-start measurement (fresh process, first request) and
state that deployed numbers are unverified; (b) preload Qiskit/Aer and run one tiny
circuit on the worker at startup (FastAPI lifespan) so the first player request is
not the import; this shifts cost to instance boot, which Cloud Run already pays;
(c) have the game fire one harmless warm-up request when the player reaches the
first town (no circuit data, no job, no allowance) so a cold instance wakes while
they walk; (d) confirm or raise the Next proxy timeout above the longest server
timeout; (e) show a "waking up the server" message when the first response exceeds
a few seconds; (f) warn on retry when a stopped run may still be occupying the
worker. Document that cold starts remain possible on a scale-to-zero service.

**Slow-run communication (owner decisions, October 19, 2026):**

- **Stay in the laptop.** The status panel inside the laptop is the main surface.
  Elapsed time and an expected-time hint are shown there. Leaving is the player's
  choice: keep “Wait in background”/Escape as an opt-out, never nudge it.
- **Per-circuit estimate, measured not guessed.** Run the benchmark on the owner's
  local machine across the real lesson circuits, with the largest ones prioritised:
  Breaking RSA / Shor (N, a, counting qubits, ideal vs noise), Grover (rounds 0–5,
  4 qubits), Ghost Key (25 data qubits, stabilizer ideal / MPS noisy), register
  benches (2–4 qubits), Coin, campus and lab sizes. Store median and p95 per
  circuit class in a small checked-in table (for example `game/lib/runEstimates.ts`)
  keyed by endpoint plus qubits/depth/shots/simulator. The panel shows “Usually
  about X–Y s” from it, and “Taking longer than usual” once past p95. Apply a
  documented safety multiplier and label it as an estimate from a faster local
  machine, because the deployed service has one slow CPU and may cold-start.
  Regenerate the table with a script when circuits change; no circuit data or
  results are stored.
- **Each circuit is a new wait.** The elapsed timer and estimate belong to one run
  of one circuit and reset for the next circuit or Run. Never carry a previous
  circuit's time over; the panel names the circuit/lesson it is waiting for.
- **Physical QPU / remote simulator (Qollab).** Local numbers do not apply. Show
  provider state, job ID, elapsed time, and a static “can take several minutes”
  range; show queue position only if the provider returns one. No countdown.
- **One-time notice, then per-run reminders.** Before the first remote Run in a
  session, show a short EN/ES dialog: remote execution is asynchronous, can take
  minutes, keep the game open and be patient, it cannot be cancelled once started,
  and one remote job is allowed per session (merge with the existing checkpoint
  warning). Do not repeat the dialog for later circuits; each later remote Run
  instead shows its own panel with a fresh timer and “this is a new circuit, new
  wait”. In-memory only, never persisted, never submits a job.

**Acceptance:** cold first run and warm runs recorded before/after (deployed if
reachable, otherwise local fresh-process); no request is cut by the proxy before
the server's own 504; Shor simulation near the server limit returns the translated
timeout message; the warm-up request submits no job and touches no allowance.

**Implementation status — October 19, 2026:** implemented, with no hosting change.

- Backend boot warm-up (`backend/app/quantum/warmup.py`, non-blocking, on the
  single worker, `QUANTUM_WARMUP=0` disables): the first Shor request after boot
  fell from 1646 ms to 245 ms locally; warm-up itself takes ~2.7 s at boot.
- One `GET /api/health` when the first town mounts (`game/lib/warmup.ts`); web
  only, no job, no status entry.
- Confirmed Next 15.5's rewrite proxy defaults to 30 s and set
  `experimental.proxyTimeout` to 170 s (Shor limit later raised from 120 s to 150 s, client wait 165 s). Configuration and build verified; a
  >30 s response through the proxy was not exercised end to end.
- In-laptop panel: circuit label, elapsed time, “Usually about X–Y s” from
  `game/lib/runEstimates.json`, “taking longer than usual” past the bound, a
  first-run “server may be waking up” hint, and a warning when a stopped/timed-out
  run may still occupy the worker. Each run has its own timer and label.
- Remote Qollab runs: static asynchronous/“several minutes” text (no countdown) and
  a one-time EN/ES notice before the first remote submission; declining submits
  nothing; later circuits are not lectured again.
- Measured on the owner's machine (5 warm runs per case; median / p95 ms):
  Shor N=15, ideal 130–191 / 137–198 for 3–10 counting qubits; **noise 1492/1635
  (3), 776/936 (4), 2023/2369 (6), 5973/6630 (8), 18672/22225 (10)**. Grover,
  register, Coin, campus, lab, and Ghost Key all stay under ~260 ms locally. The
  slowest lesson-reachable case is noisy Shor, so a deployed single slow CPU is
  the most plausible source of the reviewer's 20 s+ waits for that case; ordinary
  16-shot runs are not explained by compute cost.
- **Bug found while measuring and fixed:** Echo Chamber returned HTTP 500 on every
  Run when the secret PIN was 1111 (about 1 device in 16), because the oracle
  applied X to an empty qubit list. Regression test added (PINs 0000 and 1111).
- Not done / unverified: deployed cold/warm numbers; real physical-QPU
  waits; queue position from a provider; a browser or screen-reader smoke test of
  the new panel and notice.

### F02 — Grover result ownership (Done)

**Feedback covered:** changing four rounds to three leaves the old graph visible.

**Source evidence (verified before the fix):** `game/components/GroverScenario.tsx` clears
`lastRun` in the round-control callback (line ~340, `onRepeat`) and on slot
changes. The measure-step button `next("measure", { repeat: 3 })` (line ~373)
changes `repeat` to 3 without clearing `lastRun`, so after a ×4 run the circuit
header shows ×3 while `QuantumEqualizer`, `CircuitHistogram`, and the circuit's
`measurement` prop (line ~341) still render the ×4 result. This matches the
report exactly and is the primary suspect; the plan's earlier "investigate" hedge
is no longer needed. Also check `onRepeat` is `null` outside `tuneRun`/`measure`,
so no other step can change rounds.

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

**Implementation status — October 19, 2026:** both story transitions that
reset the repeat count now clear `lastRun`, matching the existing round-control
and circuit-edit behavior. On restore, unmeasured preview frames must match the
saved preparation, ordered loop blocks and effective round count. Mismatched
previews are discarded without running a circuit or changing collected peaks.
Final measured runs and the M-block explorer retain their original counts,
backend metadata and PIN. Clearing a preview also stops its amplitude animation.

Validation: eight new React regressions cover the ×4 → measure-at-×3 transition,
whiteboard return, round/box/Clear edits, matching and mismatched saved previews,
reopen/language/refresh without resubmission, final measurement retention and
animation cleanup. The full game checks and both production builds passed.
Chrome using the real Echo Chamber component and Python simulator confirmed
×3/×4 counts, immediate preview removal on the final-stage transition, preserved
EN/ES results on reopen, tap/keyboard controls, portrait/short-landscape layouts,
and the same one-shot PIN/explorer after refresh. The temporary browser fixture
was removed and its prior Grover save restored.

### F03 — RSA notes and mathematical labels (Done)

**Feedback covered:** unexplained `k=20` in plaintext, `k=12` in RSA, and notes
persisting across acts.

**Source evidence (verified before the fix):** `MemoryRail` in
`game/components/LaptopScene.tsx` displayed `k = vars.shift` whenever plaintext
was recovered, without checking the active act. `startAct()` already resets the
run, then generates a random shift for every act. An unrelated shift therefore
appeared after recovering plaintext in Acts 1, 3 or 4; cross-act persistence is
not needed to explain either reported number. The earlier claim that state only
resets on a full-game reset was incorrect. Caesar candidate rows also used bare
`k=` labels, and the Notes panel omitted earned φ(N) and public-key labels.

**Plan:** derive displayed notes from the current act and validated evidence.
Label Caesar shift, modulus N, totient φ(N), public exponent e, and private
exponent d explicitly where relevant and earned. Inspect reset/advance/restore
paths in `game/game/state.ts`, `game/game/runtime.ts`, and `game/game/effects.ts`.
Filter or separate historical notes rather than deleting valid checkpoint data.
Do not reveal future puzzle values or treat a default variable as a discovery.

**Acceptance:** play acts 1–4 consecutively, restart one act, and restore older
checkpoints. No Caesar shift appears as RSA evidence; each displayed value has
the correct meaning and provenance. Missing legacy context is not invented.

**Implementation status — October 19, 2026:** extracted `RsaMemoryRail` and the
pure `game/rsaNotes.ts` evidence selector. Act 1 displays the fetched A1Z26
reference. Act 2 requires a selected candidate that decodes the current capture.
Acts 3–4 identify the captured modulus N and public exponent e; Act 3 adds
validated factor, totient and private-exponent milestones individually. Act 4
requires a matching returned run and checked period/factors before showing its
private results, and distinguishes a recorded reference period from a measured
candidate. Configuration edits remove current private notes. Notes are compact,
accessible name/value rows. Caesar candidates and result messages say “Shift”
or “Caesar shift” in both languages; legacy translation aliases remain.

Changing a recorded Shor batch to another modulus also updates the displayed
capture's public key and ciphertext. Async ownership checks protect that update
after mission changes, backend switches or unmount; switching back to the
simulator also releases the loading controls. Deriving and displaying notes
never runs a tool or submits a job. Save keys, checkpoint
structure and valid stored values are unchanged; absent legacy evidence simply
leaves private notes hidden.

Validation: 152 Node tests and 139 React tests passed with lint/types and both
production builds. New regressions cover act progression, earned-answer timing,
mathematical/context validation, legacy checkpoints, restart/restore, bilingual
labels, Shor edits, and stale batch re-keying. Chrome with the real workbenches
and local Python backend confirmed recovery in Acts 1–3, the correctly named
φ(N)=12, Act 3 refresh/resume, failed and successful Shor runs, private-note
invalidation after editing, keyboard/tap controls and portrait/short-landscape
layouts in EN/ES. The disposable browser fixture and checkpoint were removed.

### F04 — Keyboard focus and movement

**Feedback covered:** W fails after focusing the minimap; no obvious canvas focus;
typing must not move the player; request for keyboard destination navigation.

**Source evidence (verified):** the original `GameCanvas.tsx` host had no
focus target, label or visible outline. Excalibur 0.32's `Keyboard.init` defaulted
to `window`; React dialogs could stop propagation, but keyboard ownership was
otherwise implicit. The fix binds Excalibur input to the named host and protects
focus transitions rather than depending on whichever control last received a key.

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

**Implemented:** all five teaching towns/campus and Quantum Town share the
focusable application area and minimap navigation. WASD/arrows/Space act only in
that area. Tab, native controls and modifier shortcuts retain their behavior.
Blur, overlays and window changes clear held keys; old repeats/releases cannot
trigger interactions or cancel a newly held movement key. Startup waits for the
explicit Enter action before focusing exploration. Closing an overlay restores
focus without reopening its conversation.

The destination selector includes neighbors, lesson doors and town roads. Walk
reuses collision-aware routes; Stop walking, manual movement and overlays cancel
navigation without false arrival announcements. Doors/hosts still need explicit
interaction. Locked roads and exits during a background operation are disabled;
concealed labs appear only after discovery. Navigation and focus state remain
transient and never execute a backend request or change checkpoint schemas.

**Validation:** `npm run check` passes (157 Node tests and 150 React tests), plus
web and Qollab production builds. The Qollab package retains its 20-file contract;
Spanish translations now share the existing assets module to keep each file below
2 MB. Browser checks cover keyboard movement, minimap toggle/return, destination
arrival, explicit conversation/close, typing WASD in a checkpoint field without
moving, EN/ES, 390 × 760 portrait and 760 × 390 landscape layouts, refresh/resume,
and walking through Quantum Town's south exit into Cipher Town. Coin, Foundry,
Quantum Town and Campus exercised the shared controls and both engine classes.
A native Chrome keyboard pass with macOS VoiceOver enabled verified Tab to the
minimap, toggling it, returning to exploration and movement; the system setting
was confirmed off afterward. Browser preview also checks the packaged Qollab
module and Spanish labels; no physical-QPU execution is part of this UI change.

**Test note:** Chrome reported one WebGL context loss during repeated development
scene transitions and hot reloads. A full refresh recovered the campus and the
remaining checks passed; the packaged browser preview reported no JavaScript
errors. This pass does not establish a cause or change WebGL recovery behavior.

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

**Implemented:** `CircuitHistogram` uses the pure presentation helper in
`game/countsPresentation.ts`. More than 16 listed outcomes switches to the compact
eight-peak view; ties use bitstring order, independent of insertion order and ideal
probabilities. Remaining observed outcomes have an exact aggregate count and share.
The complete table retains every original key, leading zeros, returned count and
shot share, with ideal predictions in a separate column when supplied. Counts
with zero shots do not inflate the distinct-observed total or become peaks.
Histograms of up to 16 outcomes keep their existing full layout, including the
anonymous numeric ordering used by Echo Chamber.

Show all counts starts collapsed. The keyboard-scrollable table has a caption,
column/row headers, totals and a viewport-bounded scroll area. Either collapse
button or Escape returns focus to the disclosure. Escape is handled in capture
so the laptop's native listener does not close the laptop first. Language changes
and laptop reopen preserve the reading; a new counts object starts collapsed.
Saved counts, backend metadata, period analysis and execution behavior are unchanged.

**Validation:** `npm run check` passes (160 Node tests and 156 React tests), including
256-outcome totals, deterministic ties, zero-count/reference-only entries, all
complete-table values, keyboard collapse/focus, translations and restored Shor
readings without resubmission. Web and Qollab production builds pass; Qollab still
has exactly 20 files, each under 2 MB. Browser checks used a temporary, explicitly
labeled fixture with fabricated counts in the actual Shor pipeline and laptop:
EN/ES, keyboard disclosure/Tab/Escape, complete 256-row data, close/reopen,
refresh/restore, 390 × 760 portrait and 760 × 390 landscape. The native browser
accessibility tree exposes only the compact summary before disclosure and the
full semantic table afterward. The fixture recorded zero quantum submissions and
was removed before the production builds.

**Pending owner verification:** the owner requested leaving VoiceOver off and
will test the screen-reader traversal. Native accessibility-tree inspection and
keyboard checks above are not a substitute for that remaining VoiceOver pass.

### F06 — Campus discovery from Quantum Town

**Feedback covered:** the professor recommends the campus, but the reviewer found
only the `qc1` checkpoint route.

**Source evidence (verified):** `TownScreen.tsx` includes the campus in the
professor's prose (`GREETING_ALL`) but his choices are only the challenge tracks
plus "Keep exploring". `travelCampus(true)` already exists but is wired only to
Coin Town's `onCampus`. Ordinary travel already exists through Coin Town's south
road; the problem is discoverability from the hub, not a missing campus entrance.

**Decision (owner, October 19, 2026):** no teleport choice in the professor's
menu. Add a small, understated in-world sign, in the spirit of the concealed lab
entrances, that points toward the campus. It rewards noticing and keeps the
journey through Coin Town's south road.

**Implemented (October 24, 2026):** the small sign at (25, 31), beside the
main south path, reuses existing Kenney timber art with a compact arrow board.
It has no floating caption, beacon, quest marker, minimap label or destination.
Space and the contextual Inspect control open short EN/ES directions: Quantum
Town → south through Cipher Town → Coin Town → Coin’s south road → campus.
Only Keep exploring is offered. The professor hints at the sign both when offering
qWard and in the repeat completion greeting. There is no teleport action.

The sign is nonblocking so older saved positions remain valid. It is excluded
from automatic landmark discovery, needs no new save field, and is always
inspectable. Inspection only opens local dialogue; it never changes position,
progress, equipment, circuits, rewards or the remote allowance.

**Validation:** EN/ES browser smoke checks covered the completion greetings,
Space inspection, the Inspect button at a 390 × 760 mobile viewport, and refresh
at the saved position. A temporary browser audit compared the town, progress,
medals, knowledge, wallet, lab, campus and RSA variables before/after inspection;
both language checks were identical. The minimap destination list excludes the
new sign. After checkpoint setup, the ordinary walking route was followed from
Quantum Town through Cipher Town and Coin Town to the campus without reopening
Save progress. The temporary audit route was removed afterward.
`npm run check` passed (160 Node tests and 156 UI tests); production web and
Qollab builds passed. Qollab retains its 20-file package and per-file size cap.

**Acceptance:** a player finishing the four challenges can learn where the campus
is from the professor's line plus the sign, without opening Save progress. No
medals, discoveries, circuits, equipment, or remote allowance change. The sign
does not move the player.

### F07 — Translation, grammar, and directions

**Feedback covered:** “Backend agrees: m=…”, “Measure -> Classical PC: counts”,
“reconstruida mediante hand”, English-word prompts for CAFE, “Un complemento paral
portátil”, “1 cúbits”, “1 ejecuciones”, “Escáner de el portátil”, “Cierral portátil”,
and a Foundry instruction pointing to Quantum Town.

**Implemented (October 24, 2026):**

- Added complete EN/ES templates for both RSA backend confirmations and all four
  Shor connection logs. Wiring feedback keeps source text until rendering, so a
  language switch updates it without changing connections or submitting a job.
- Shared measurement explorers, histograms, execution buttons and campus evidence
  use explicit singular/plural count templates. One returned shot now reads
  “1 shot” / “1 ejecución”; one measured wire reads “1 qubit” / “1 cúbit”.
  The explorer also uses “1 observed outcome” / “1 resultado observado”.
- Corrected “Cierra el portátil”, “Escáner del portátil” and “Un complemento para
  el portátil”.
- Caesar now asks for the readable message and describes selection as a candidate,
  rather than claiming any selection is the English answer. Its story and laptop
  explain that both game languages retain short English messages in A–Z without
  accents, including CAFE for café, a meeting place. Answers, shifts and validation
  remain unchanged. Legacy source-message aliases remain supported.
- The workshop exit hint reads the same saved `groverFrom` origin as the return
  action: Foundry Town for its main lesson, Quantum Town for replay entry. The
  standalone fallback uses neutral “return to town” wording. Coin’s existing
  Coin Town return and Hollow’s neutral wording already match their exit behavior.

**Reported “hand” context:** the exact phrase “reconstruida mediante hand” is
not present in current source. Act 3’s private-key narrative already says
“reconstruida a mano”. The nearby generic factorization log `N = … by {method}.`
could leave an English method untranslated. Current backend `trial_division`
now has readable source wording and Spanish translation; explicit legacy aliases
for `trial_division` and `hand` prevent that mixing in restored logs, without
changing API method IDs or inventing execution history.

**Validation:** translation regressions cover dynamic equations, all Shor wires,
legacy factorization methods, unchanged mathematical placeholders, and zero/one/
many counts in both languages. UI regressions cover wiring and feedback across
language changes without a job, single-shot measurements, and a selected CAFE
answer/shift across language changes and laptop reopen. Browser smoke checks
used temporary previews of the real laptop, explorer and workshop components:
EN/ES text, keyboard placement/selection/close, mobile 390 × 760 layout, Shor
connection logs, restored RSA method logs, and both workshop return towns. Seeded
results were used for display checks; no quantum execution was required. The
temporary preview route was removed afterward. `npm run check` passed (162 Node
tests and 160 UI tests), as did the production web and Qollab builds. Qollab
retains its 20-file package and per-file size cap.

**Review follow-up (October 24, 2026):** found and corrected missing Spanish
templates for Shor's classical-input, job-setup, connected-batch and counts logs,
including the older counts-log format. The measurement summary now handles one
distinct bitstring and one shot independently. Also corrected the remaining
Ghost Key “Usal portátil” typo in current and legacy copy. Regression coverage
checks logs emitted by an actual component run with a mocked response, language
switching without a second submission, provider names and mathematical payloads,
and the hardware/reference log branches. Browser checks with seeded counts
confirmed EN/ES summaries and retained results after component reopen.
`npm run check` passed with 163 Node tests and 160 UI tests. Production web and
Qollab builds passed; the Qollab package still contains 20 files within its size cap.

**Acceptance:** every reported phrase is corrected or documented with its actual
context; EN/ES walkthroughs show no unexplained language mixing. Puzzle answers,
codes, IDs, formulas, and saves remain compatible. Switching language preserves
work. Cover dynamic templates and singular counts in translation regressions.

### F08 — Festival state and legend clarity

**Feedback covered:** a visual “F · Festival ?” appeared after completion while
accessible text said completed.

**Finding:** the completed festival already used its earned badge for the map's
checkmark and the scene's star. The static legend placed `F · Festival` beside
`? · Notebook` on the same line, making the notebook key look like a festival
status. Festival sessions were also missing from the investigation/discussion
marker lists, although exhibit sessions were included.

**Implemented (October 24, 2026):** `campusActivityStatus` derives new,
investigating, ready-to-discuss and completed states from the existing earned
progress and session evidence. Campus map symbols/accessibility labels, scene
marker lists, journal and host completion use it. The earned festival badge
overrides retained evidence, including after a campus restart. Completion
requirements and saves are unchanged. The minimap identifies the notebook with
▤ and puts exhibit, festival and notebook keys on separate rows. It separately
explains … / ? / ✓, with translated status text in the map's accessible name.

**Validation:** the guarded three-repair regression checks each status transition,
completion, hydration, revisit and restart. UI coverage checks map/scene-config/
host agreement, separate legend entries, EN/ES switching and hydration without
a service request. Real-browser checks use the completed `qc3` checkpoint, walk
to the festival, revisit its host, switch EN/ES, refresh and inspect the outdoor
star, map checkmark and notebook legend. No quantum job was submitted during
browser validation. The temporary server and browser tab were closed afterward.
`npm run check` passed (163 Node tests and 161 UI tests), along with the production
web and Qollab builds. Qollab retains 20 files, each within its 2 MB limit.

**Acceptance:** complete the festival, revisit it, change language, and reload.
Map, host, legend, and accessible status agree; the notebook symbol cannot be
mistaken for an unfinished festival. Do not alter completion requirements.

### F09 — Contextual names for repeated controls

**Feedback covered:** multiple controls announced only as H.

**Implemented:** shared translated names distinguish “Add H gate (Hadamard)”
from “H gate (Hadamard), wire 1, position 2”. Campus and lab move actions include
their component and location; lab removal, settings panels and close controls
carry the same context. Drag announcements use those names while IDs remain
unchanged. Coin and register palettes announce Add actions and retain existing
installed-slot context. Editable occupied slots explain removal without a
selected piece. Grover and Ghost Key retain named story slots and distinguish
their two H palette copies. Visible symbols, saved recipes and execution rules
are unchanged.

**Validation:** lint, TypeScript, 325 automated tests, production build and Qollab
20-file validation pass. Regression coverage checks repeated H gates, current
positions after reordering/removal, Spanish names, unchanged drag target IDs,
settings focus, and existing Coin/register/Grover/Ghost Key editing flows. A
temporary preview using real campus/lab components verified browser accessibility
names, keyboard add/reorder/removal, settings dismissal and language switching;
it was removed afterward. No quantum job was submitted. VoiceOver was left off
as requested; a real screen-reader pass remains owner verification.

**Acceptance:** a screen-reader user can identify, add, move, configure, and remove
the intended gate when several identical gates exist. Check Coin, register,
campus, lab, Grover, and Ghost Key surfaces.

### F10 — Minimap size and pointer behavior

**Feedback covered:** expanded minimaps cover substantial terrain and intercept clicks.

**Implemented:** `MinimapPanel` is shared by `WorldMinimap` and `TownMinimap`.
Touch, narrow (600 px or less), and short (550 px or less) viewports start
collapsed. The initial server markup stays collapsed until hydration chooses the
viewport default; later resizing or rotation never overrides the player's choice.
Collapse hides the map, legend and navigation together. Expanded panels use at
most 208 px / 46% of viewport width and 360 px / 48% of viewport height, while
respecting the containing scene. The 44 px toggle stays above a separately
scrollable body. Escape collapses and restores toggle focus; keyboard navigation
still reaches Return to exploration and the guarded destination controls.
HUD containers pass pointers through empty space; the visible panel handles its
own clicks without forwarding them to the world.

**Validation:** lint, TypeScript, 329 automated tests, production build and the
Qollab 20-file/size checks pass. Regression tests cover hidden collapsed controls,
rotation/language retention, Escape focus, pointer event containment and clean
hydration. Browser checks in a temporary real-component preview at 390×700 and
740×360 confirmed bounded scrolling, an always-reachable toggle, keyboard return
to exploration, retained state across resize, and terrain clicks through empty
HUD space without map clicks reaching terrain. The preview was removed and its
server/tab closed; no simulation or save changes were needed.

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

**Scope decision (owner, October 19, 2026):** for now, only clarify the
simplification. Do not add authentication, certificate, or padding lessons yet.

**Plan:** add one brief bilingual note, at the small-RSA workbench and again where
Act 4 concludes, saying plainly that: (1) the game breaks a toy protocol with tiny
numbers and a letter-by-letter encoding, not real RSA; (2) real RSA keys are far
larger and real systems do not encrypt single letters, they use an encoding scheme
(RSAES-OAEP in RFC 8017) usually to protect key material; (3) a quantum computer
running Shor's algorithm is a threat to real RSA only at a scale far beyond the
game's demonstration. Keep these three claims separate and do not imply that the
game's small Shor run endangers production RSA. Label the letter/number exercise
“textbook arithmetic”. Spanish and English kept in sync.
See [RFC 8017, section 7](https://www.rfc-editor.org/rfc/rfc8017.html#section-7).

**Deferred (revisit after the core fixes):** the key-substitution and
authentication teaching moment (certificates, signatures, authenticated channels,
man-in-the-middle). Keep the original review item as a backlog idea; do not drop
it.

**Likely locations:** `game/content/acts/act3.ts`, `game/content/acts/act4.ts`,
`game/components/RsaWorkbench.tsx`, knowledge content, and `game/i18n/es.json`.

**Acceptance:** the two notes state that the game attacks a simplified protocol,
distinguish the toy letter encoding from real padded RSA, and make no claim that
production RSA is broken. No new required puzzle, and no change to RSA answers,
arithmetic, rewards, or save structure.

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

**Source evidence (verified):** `AudioManager.unlock()` in `game/game/audio.ts`
sets `unlocked = true` unconditionally on the first call and never checks the
`AudioContext` state; `synth.ts` resumes its own context only opportunistically.
Excalibur creates a separate context, so the warning and a truthful “sound on”
UI can coexist. This supports the report.

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

**Status (owner, October 19, 2026):** deferred. The F12 clarification note is
enough for now. F16 depends on the deferred authentication content (distinction
between encryption and signatures), so build that first if this is revived.

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

### F17 — Backend-free local build with a client-side simulator

**Owner request (October 19, 2026):** remove the dependency on the Python
backend for local play by adding a mock/simulator layer in the frontend, so the
complete application runs on the owner's machine with a simulated backend. Wait
times (and therefore the progress panel, estimates, timeouts and cancellation)
can then be created entirely in the client.

**Starting points:** `game/lib/transport.ts` already has a pluggable
`setServiceTransport`, and Qollab already supplies a non-HTTP transport with the
same `path/init/progress` contract. A third transport (for example `mock`)
should reuse that seam instead of touching lesson code. `runtimeInfo.target`
currently distinguishes `web` and `qollab`; decide whether `mock` is a new
target or a flag on `web` before building.

**Plan:**

1. Define the scope: which endpoints must work offline (lab, campus, coin,
   register, Grover, Ghost Key, Shor, classical RSA/Caesar tools, recorded IBM
   data) and which can return a recorded or approximate result.
2. Choose the engine. Options to evaluate: reuse the Qollab Pyodide Python
   (`game/qollab/python`, already shares `backend/app/core`), a JavaScript
   state-vector simulator, or canned deterministic responses. Pyodide gives the
   same circuits and counts as the real backend; canned responses are simplest
   but do not teach real measurement. Record the trade-off before choosing.
3. Keep the real contract: returned counts must be sampled fresh per Run, carry
   backend metadata (name the mock honestly, never as Aer or IBM), and keep the
   ideal-reference versus observation distinction.
4. Make the delay a controllable setting (fixed, by estimate table, or random
   within the measured median/p95) so the status panel, "taking longer than
   usual", timeouts, Stop waiting, and the remote-run notice can be tested and
   demonstrated without a real slow backend. Also allow injecting failures
   (timeout, unavailable, 409 refusals).
5. Keep it out of production: select the mock only by an explicit build or
   environment flag; the deployed web game and the Qollab upload stay unchanged
   and the 20-file Qollab allowlist is not affected.
6. Tests must run without a Python backend in a clean checkout, and the existing
   HTTP and Qollab suites keep passing.

**Acceptance:** with the mock selected, every lesson that needs a quantum or
classical service completes without a running backend; simulated waits show the
same panel, estimate, cancellation and error messages as HTTP; no job reaches
IBM, IonQ or any provider; the mock is unreachable in normal production builds.

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
