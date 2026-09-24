# Quantum Playground

The home screen is a scenario catalog. Players can start with **Who Goes
First?** (`/scenarios/coin`), then continue to **Breaking RSA**
(`/scenarios/rsa`). Both are available immediately. The original `/play/1`
through `/play/4` links still work; new RSA links use
`/scenarios/rsa/play/[act]`.

## Who Goes First?

A beginner story set inside Ale’s house on game night. Walk with the arrow keys or WASD, or tap the floor to walk around furniture on touch screens. The same character and four-direction
walk animations appear in RSA. Approach the highlighted table, laptop desk, or
whiteboard, then press Space or tap Talk. Short conversations lead into playable challenges:

1. Assemble a seeded Python function from code blocks, then run five coin tosses.
2. Predict whether Brayan's copy repeats those five results before revealing his run.
3. Keep both five-call sequences on screen, run six calls on Brayan's copy,
   inspect his highlighted sixth value, then predict and reveal your own.
4. Predict the result of measuring a freshly prepared zero and run ten shots.
5. Place both H and measurement on a Qiskit-style single-qubit wire, in that
   order, then run the circuit. Measurement alone gets an all-zero hint.
6. Predict whether 100 shots must split exactly in half, compare 100 with 1,000 shots, and explain the observed counts.
7. Agree that 0 means Ale and 1 means Brayan, then use one simulated shot.

Code and gate blocks support drag-and-drop, tap/click selection followed by a
slot, and keyboard activation. Hints, undo/reset, and feedback are available
without penalties. The three achievement badges reward building the program,
explaining the seed replay, and building the circuit. Block trays and answer choices
are shuffled once per lesson and saved with progress. The code scaffold has a
setup slot and one function-body slot. Its distractor is the valid Python call
`coin.seed(42)`, which would reset the generator if called for every toss; a
comment is never treated as executable behavior. The scaffold uses known
instruction IDs; it never executes arbitrary player-written Python.

`POST /api/coin/classical` creates a private Python PRNG per request and
replays the requested number of calls. `POST /api/coin/simulate` runs an
actual `QuantumCircuit(1, 1)` through Qiskit Aer on the existing quantum
worker. The circuit resets to its initial state for every shot. Requests are
bounded to 1,024 shots. **The entire coin scenario is simulator-only:** it
does not read or submit IBM jobs. Dialogue distinguishes classical
simulation from physical quantum randomness; statistical balance is not
presented as proof of a quantum source.

The full coin session, including puzzle placements, locked answers, achievements,
and the final decision, is saved in this
browser. Refresh resumes it without another toss. “Replay the whole lesson”
starts a new session. Scenario completion is saved separately for the hub.
Older saves keep their completed results and gain the new challenges at the
current unfinished step. No account or database is needed.

## Shared game experience

Both worlds use `GameShell`: a full-height play area, a compact header, the same
laptop button, and a collapsible Objectives panel. The panel starts closed to give
the world the available width. On smaller screens it opens as a sheet.
`DialoguePresentation` shares the portrait layout and readable dialogue styling;
coin dialogue now reveals progressively, with Space or a tap to reveal/continue.
Movement pauses during conversations, and finishing the conversation opens the
laptop when an experiment is ready. Touch players tap the world to walk and use
the same Talk control as RSA.

Scene loading also belongs to the shared shell: `SceneLoading` shows Quantum
Playground branding until RSA finishes engine/story initialization or the coin
scene has hydrated its save and decoded its artwork. Gameplay controls stay
inactive while loading. Failed loads show a bilingual retry action; the coin
artwork request also has a timeout. Excalibur's canvas remains hidden during boot,
and its fallback logo uses the game's icon.

## Shared laptop and languages

Both scenarios use `components/LaptopShell.tsx`: the same screen, memory strip,
experiment area, close button, language switch, and Escape/Tab controls. Closing
the laptop preserves its contents. Scenario-specific tools stay inside the shell.

Choose **EN / ES** on any page or inside the laptop. English and Spanish cover
scenario cards, dialogue, choices, objectives, tool instructions, and result labels.
The preference persists independently of game progress. Switching language keeps
the current step, seeded sequence, circuit, and results. Code, formulas, API values,
and RSA puzzle words retain their original spelling; Spanish instructions explain
that the RSA plaintext is in English.

`i18n/es.json` maps source messages to Spanish. Templates preserve dynamic values
such as ciphertext and measurement counts. Translate display text only, never
state IDs, answers, or request data. Add translations when adding scenario prose.
Unknown diagnostic messages from the backend fall back to their original text.

Run `npm test` for translation coverage and placeholder checks, and `npm run build`
for the production check. For a manual smoke test, run the seeded coin in Spanish,
close/reopen the laptop, switch to English, and confirm the same results remain.
Check the same controls in an RSA mission, including keyboard focus and Escape.

## Adding scenarios

- `content/scenarios.ts`: catalog order, routes, learning goals, and mission IDs.
- `content/coin.ts`: the coin story, dialogue, and destination for each step.
- `components/CoinScenario.tsx`: the lesson workbench and progression.
- `components/CoinHouse.tsx`: the walkable house, input, animation, and proximity interaction.
- `game/coinRoom.ts`: floor collision bounds, movement, and tap-to-walk routing.
- `game/progress.ts`: scenario-scoped completion, shared with RSA.

Add a catalog entry and its `/scenarios/<id>` route for a new scenario.
Each scenario owns its mechanics and world; the existing RSA runner retains
its four act IDs instead of forcing unrelated games into those IDs.

## Breaking RSA: Man in the Middle

A top-down pixel game about eavesdropping. Ale works in the building on the
left, Brayan works in the building on the right, and they are seeing each
other in secret. A man in a car up the street pays you to find out what they
say. Over four acts they try harder and harder to keep you out: a letter-to-
number mapping, a Caesar shift, RSA, and finally the assumption underneath
RSA.

Every attack calls the same FastAPI backend the main `frontend/` app uses, so
the Caesar brute force, the RSA arithmetic and the Shor circuit are real
rather than scripted.

## The loop

All four acts run the same route, and only the crypto changes:

1. **Prologue** — Ale and Brayan agree on a scheme, in their own words.
2. **Briefing** — walk to the client's car and take the job.
3. **Install** — walk to the junction box and put a listener on the line.
4. **Intercept** — Ale sends; the payload crosses the tap.
5. **Decode** — do the actual work in the workbench, which is a panel of
   act-specific tools that each hit a real endpoint.
6. **Report** — walk back to the car and *type* the plaintext. A wrong answer
   raises suspicion and sends you back to the workbench rather than ending the
   act.

Open Objectives to show the job sheet and backend log beside the world.
Decoding tools open in the shared laptop. The objectives panel starts closed
to leave more room for gameplay.

## Running it

The game is a standalone Next.js app on port 7019 and reaches the backend
through a `/api/*` rewrite.

```bash
# With the rest of the stack
docker compose up game

# Or on its own, with the backend already running on :7001
cd game
npm install
BACKEND_URL=http://localhost:7001 npm run dev
```

Then open http://localhost:7019.

The port is the same in and out of Docker, so only one of the two can run at a
time.

### PWA (installable, landscape)

The game ships as a Progressive Web App so phones can add it to the home
screen and run it fullscreen in landscape.

```bash
# Prefer a production build for install testing — Next's HMR and the
# service worker fight each other in `next dev`.
npm run build
BACKEND_URL=http://localhost:7001 npm start
```

Local checks:

1. Open http://localhost:7019 in Chrome.
2. DevTools → Application → Manifest: name, icons, `orientation: landscape`,
   `display: standalone` should all be present.
3. Application → Service Workers: `/sw.js?v=...` should be activated.
4. Install the app (install icon in the address bar, or Application →
   Manifest → "Install").
5. Open the installed window and rotate to portrait — play should stay
   blocked until you return to landscape.

On a physical phone, install only works over HTTPS (or `localhost`). For a
quick LAN smoke-test, tunnel the production server (`npx localtunnel --port
7019`, Cloudflare Tunnel, etc.) and open the HTTPS URL.

#### Cache invalidation

Every `npm run build` bakes a unique `NEXT_PUBLIC_PWA_BUILD_ID` (package
version + optional git short hash + a per-build stamp). The client registers
`/sw.js?v=<id>`, so a new deploy:

1. Installs a new service worker.
2. Deletes every previous `mitm-shell-*` Cache Storage entry on activate.
3. Reloads open clients once the new worker takes control.

The worker is **network-only** (no page/asset caching) so local `next dev`
and frequent deploys cannot freeze the client on a stale shell. It still
satisfies installability.

Override the id when you need a stable or explicit bust:

```bash
PWA_BUILD_ID=0.1.0+manual.1 npm run build
```

`next dev` does not register a worker; if a leftover worker from a prior
`next start` is still controlling the tab, it unregisters it and reloads
once so `/_next` chunks load again.

PWA icons are Kenney's lock glyph on the stage background. Regenerate with:

```bash
python3 tools/gen_pwa_icons.py   # needs Pillow
```

Controls: arrow keys or WASD to walk, Space to talk and to advance a line,
number keys to pick an answer.

## Rewriting the story

All the prose lives in `content/acts/act1.ts` through `act4.ts` and nothing
else needs to change to rewrite it. Each act is a map of dialog nodes:

```ts
box: {
  lines: [{ speaker: "hacker", text: "So. How do I get in the middle of this?" }],
  choices: [
    { label: "Clip a passive tap across the pair.", outcome: "advance", next: "installed" },
    { label: "Wait and pull the logs later.", outcome: "retry", feedback: "There are no logs on a copper pair." },
    { label: "Cut the line.", outcome: "suspicion", suspicion: 40, feedback: "Brayan picks up his desk phone." },
  ],
},
```

A choice either advances to another node, loops with a teaching hint
(`retry`), or loops and raises the suspicion meter (`suspicion`). At 100
suspicion the act cuts to its `caught` node and offers a retry.

A node moves the player around the street with `travelTo`, which plays its
lines and then gives the world back until the player walks to that landmark
and presses Space:

```ts
travelTo: { at: "car", objective: "Walk back to the car and press Space.", next: "report" },
```

A node hands the story to the sidebar with `waitsFor: "workbench"` or
`waitsFor: "report"`; the panel enters that node's `next` when the player is
done with it.

`defineAct` is generic over the node ids, so a typo in any `next` is a
TypeScript error rather than a dead end at runtime. It also refuses scripts
with empty nodes, unreachable exits, a decision where every option loops, or a
checklist item that nothing ever ticks.

Lines can interpolate run variables as `{name}` — `{message}`, `{cipherText}`,
`{shift}`, `{factors}`, `{projectedYears}` and the rest are listed at the top
of `content/index.ts`.

The `effects` on a node are what make the world move and the backend run:

| effect | what it does |
| --- | --- |
| `{ kind: "api", call }` | hits a real backend endpoint and writes the result into the run vars |
| `{ kind: "walkTo", target }` | walks the player to a landmark and waits |
| `{ kind: "packet", style, from, to, intercept }` | animates a payload along the wire |
| `{ kind: "bubble", actor, face }` | Pokemon-style `?` / `!` over a character |
| `{ kind: "tapGlow", on }` | the amber halo on the junction box |
| `{ kind: "panel", open }` | swaps the sidebar between the workbench and the report form |
| `{ kind: "task", id, status }` | ticks a line of the job sheet |
| `{ kind: "capture", payload, scheme }` | puts the intercepted payload on the workbench |
| `{ kind: "flag", set }` | sets a flag a later choice can require |

## How the pieces fit

Excalibur owns pixels, React owns text. They never call each other: both read
and write one zustand store (`game/state.ts`), plus a small typed command bus
(`engine/bus.ts`) that React uses to drive the scene and await animations.

```
content/acts/*.ts   the writing
game/dialog.ts      node cursor, travel, choices, suspicion, the typed report
game/effects.ts     runs effects, including every backend call
game/secret.ts      picks the message Ale sends this run
engine/             Excalibur scene, tilemap, actors, command bus
components/         HUD: dialog box, job sheet, workbench, report form, log
```

## Art

City tiles and character busts are Kenney's
[Roguelike Modern City](https://kenney.nl/assets/roguelike-modern-city) and
[Roguelike Characters](https://kenney.nl/assets/roguelike-characters), both
CC0. The home-screen / PWA glyph is from Kenney
[Game Icons](https://kenney.nl/assets/game-icons) (`locked.png`). Splash UI
chrome comes from the [UI Pack](https://kenney.nl/assets/ui-pack). Music and
SFX are from Kenney's [Music Loops](https://kenney.nl/assets),
[Music Jingles](https://kenney.nl/assets/music-jingles),
[UI Audio](https://kenney.nl/assets/ui-audio),
[Interface Sounds](https://kenney.nl/assets/interface-sounds) and
[Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds). See
`public/assets/kenney/LICENSE.txt`.

The boot splash (lock icon, Kenney panels, load bar, “Tap to enter”) unlocks
audio on the first gesture — browsers block autoplay — then loops *Mission
Plausible* on the title screen and *Infinite Descent* during play. Mute is
available on the title and play headers.

Kenney's character pack ships front-facing busts rather than four-direction
walk cycles, so the busts are used for dialog portraits and the overworld
sprites are generated in the same style by `tools/gen_characters.py`.

Scripts that help when changing art:

```bash
python3 tools/gen_characters.py   # redraw the cast (needs Pillow)
python3 tools/gen_pwa_icons.py    # rebuild public/icons from Kenney locked.png
python3 tools/preview_map.py      # render engine/maps/street.json to a PNG
```

The street itself is `engine/maps/street.json`: an ASCII grid plus a legend
mapping each character to a tile index and whether it blocks movement.
