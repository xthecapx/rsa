# Man in the Middle

A top-down pixel game about eavesdropping. Ale works in the building on the
left, Brayan works in the building on the right, and you are parked between
them with a laptop and a junction box. Over four acts they try harder and
harder to keep you out: plaintext, a Caesar shift, RSA, and finally the
assumption underneath RSA.

Every attack calls the same FastAPI backend the main `frontend/` app uses, so
the Caesar brute force, the RSA arithmetic and the Shor circuit are real
rather than scripted.

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
approach: {
  onEnter: [{ kind: "walkTo", target: "tap" }],
  lines: [{ speaker: "hacker", text: "So. How do I get in the middle of this?" }],
  choices: [
    { label: "Clip a passive tap across the pair.", outcome: "advance", next: "tapped" },
    { label: "Wait and pull the logs later.", outcome: "retry", feedback: "There are no logs on a copper pair." },
    { label: "Cut the line.", outcome: "suspicion", suspicion: 40, feedback: "Brayan picks up his desk phone." },
  ],
},
```

A choice either advances to another node, loops with a teaching hint
(`retry`), or loops and raises the suspicion meter (`suspicion`). At 100
suspicion the act cuts to its `caught` node and offers a retry.

`defineAct` is generic over the node ids, so a typo in any `next` is a
TypeScript error rather than a dead end at runtime. It also refuses scripts
with empty nodes, unreachable exits, or a decision where every option loops.

Lines can interpolate run variables as `{name}` — `{letter}`, `{shift}`,
`{factors}`, `{projectedYears}` and the rest are listed at the top of
`content/index.ts`.

The `effects` on a node are what make the world move and the backend run:

| effect | what it does |
| --- | --- |
| `{ kind: "api", call }` | hits a real backend endpoint and writes the result into the run vars |
| `{ kind: "walkTo", target }` | walks the player to a landmark and waits |
| `{ kind: "packet", style, from, to, intercept }` | animates a payload along the wire |
| `{ kind: "bubble", actor, face }` | Pokemon-style `?` / `!` over a character |
| `{ kind: "tapGlow", on }` | the amber halo on the junction box |
| `{ kind: "panel", open }` | raises the terminal or the quantum uplink |
| `{ kind: "flag", set }` | sets a flag a later choice can require |

## How the pieces fit

Excalibur owns pixels, React owns text. They never call each other: both read
and write one zustand store (`game/state.ts`), plus a small typed command bus
(`engine/bus.ts`) that React uses to drive the scene and await animations.

```
content/acts/*.ts   the writing
game/dialog.ts      node cursor, choices, suspicion transitions
game/effects.ts     runs effects, including every backend call
engine/             Excalibur scene, tilemap, actors, command bus
components/         HUD: dialog box, suspicion meter, terminal, uplink
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
