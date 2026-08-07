# Man in the Middle

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

The right-hand column is the job sheet, the workbench, and the raw backend
log, all three visible for the whole act.

## Running it

The game is a standalone Next.js app on port 3001 and reaches the backend
through a `/api/*` rewrite.

```bash
# With the rest of the stack
docker compose up game

# Or on its own, with the backend already running on :8000
cd game
npm install
BACKEND_URL=http://localhost:8000 npm run dev
```

Then open http://localhost:3001.

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
CC0. See `public/assets/kenney/LICENSE.txt`.

Kenney's character pack ships front-facing busts rather than four-direction
walk cycles, so the busts are used for dialog portraits and the overworld
sprites are generated in the same style by `tools/gen_characters.py`.

Two scripts help when changing the scene:

```bash
python3 tools/gen_characters.py   # redraw the cast (needs Pillow)
python3 tools/preview_map.py      # render engine/maps/street.json to a PNG
```

The street itself is `engine/maps/street.json`: an ASCII grid plus a legend
mapping each character to a tile index and whether it blocks movement.
