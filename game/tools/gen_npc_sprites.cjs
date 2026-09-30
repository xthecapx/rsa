#!/usr/bin/env node
/**
 * Draw the Coin Town neighbors (and the animals wandering the town) as 16x16 front-facing SVG sprites in
 * public/assets/characters/, in the same pixel idiom as tools/gen_characters.py.
 * NPCs never walk, so one frame per character is enough; the same file is the
 * world sprite and the dialogue portrait.
 *
 * Run:  node tools/gen_npc_sprites.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const OUT = path.join(__dirname, "../public/assets/characters");

const BODY = [
  "................",
  "................",
  ".....oooooo.....",
  "....ohhhhhho....",
  "....hhhhhhhh....",
  "....hssssssh....",
  "....hsessesh....",
  "....osssssso....",
  ".....osssso.....",
  "....occcccco....",
  "...soccccccos...",
  "....occcccco....",
  "....oCCCCCCo....",
  "....oppppppo....",
  "....oppooppo....",
  "....obboobbo....",
];

/** Row overrides give each neighbor a silhouette as well as a palette. */
const NPCS = {
  mayor: {
    palette: { o: "#1d1a24", h: "#b9bcc4", s: "#e8b98f", e: "#1d1a24", c: "#7c3aed", C: "#5b21b6", p: "#2b2f3a", b: "#15171d", a: "#f5c451" },
    rows: { 9: "....ocaccaco....", 10: "...socaaaacos...", 11: "....occaacco...." },
  },
  luz: {
    palette: { o: "#20160e", h: "#e07a2e", s: "#f1c9a3", e: "#20160e", c: "#fbbf24", C: "#c98a12", p: "#3b2f25", b: "#1c140d", a: "#fff4b0" },
    rows: { 1: ".......aa.......", 2: ".....oaaaao....." },
  },
  nico: {
    palette: { o: "#141d2b", h: "#dc2626", H: "#991b1b", s: "#e2ab7c", e: "#141d2b", c: "#22c55e", C: "#15803d", p: "#1e3a5f", b: "#0f1d30" },
    rows: { 2: ".....hhhhhh.....", 3: "....hhhhhhhHH...", 4: "....hssssssh....", 5: "....hssssssh...." },
  },
  tomas: {
    palette: { o: "#1a1a1a", h: "#2f2f2f", H: "#1f4fd8", s: "#c98c5a", e: "#1a1a1a", c: "#f8fafc", C: "#cbd5e1", p: "#475569", b: "#1e293b", a: "#ef4444", z: "#3b82f6" },
    rows: { 2: "....HHHHHHH.....", 3: "...HHHHHHHHH....", 10: "...socczcacos...", 11: "....occcacco...." },
  },
  marisol: {
    palette: { o: "#1b1420", h: "#3f2a1d", s: "#d69a6a", e: "#1b1420", c: "#0ea5e9", C: "#0369a1", p: "#1f2937", b: "#111827", a: "#f9a8d4" },
    rows: { 3: "...ohhhhhhhho...", 4: "...hhhhhhhhhha..", 5: "...hhssssssh....", 6: "...hhsessesh....", 7: "...ohsssssso....", 8: "...hhosssso....." },
  },
  oscar: {
    palette: { o: "#161616", h: "#e5e7eb", s: "#e9c29a", e: "#1f2937", c: "#44403c", C: "#292524", p: "#1c1917", b: "#0c0a09", g: "#93c5fd", G: "#1f2937" },
    rows: { 2: "................", 3: ".....hhhhhh.....", 4: "....hssssssh....", 6: "....GggGGggG....", 8: ".....ohhhho....." },
  },
  warden: {
    palette: { o: "#171717", h: "#f97316", H: "#c2410c", s: "#c68b59", e: "#171717", c: "#fde047", C: "#a16207", p: "#1f2937", b: "#0b0f14", a: "#e5e7eb" },
    rows: { 2: "....HHHHHHHH....", 3: "...HhhhhhhhhH...", 4: "...HHHHHHHHHH...", 10: "...socaccacos..." },
  },
};

/** Side-view animals, facing right; the scene mirrors them to walk left. Rows not listed are empty. */
const ANIMALS = {
  cat: {
    palette: { c: "#e8893a", C: "#b8621f", e: "#1a1208", p: "#f4a3b5" },
    rows: { 7: "..........C..C..", 8: "..........cccc..", 9: ".C........cecep.", 10: "..C.......ccccc.", 11: "..cccccccccccc..", 12: "..cCcCcCccccc...", 13: "..cc.cc..cc.cc..", 14: "..CC.CC..CC.CC.." },
  },
  dog: {
    palette: { d: "#9a6b3f", D: "#5e3d22", e: "#140c05", n: "#1f1f1f", w: "#f1e3cf" },
    rows: { 6: "...........ddd..", 7: "..........dedddn", 8: "..........dddww.", 9: ".d........Dddw..", 10: "..d.dddddddddd..", 11: "...ddddddddddd..", 12: "...dwwwwwwwwdd..", 13: "...dd.dd..dd.dd.", 14: "...DD.DD..DD.DD." },
  },
  pigeon: {
    palette: { g: "#9aa3ad", G: "#5f6b78", e: "#e0572e", k: "#3b2f2a", y: "#d98b5f", n: "#4fa39a" },
    rows: { 10: "..........gg....", 11: ".........gegk...", 12: "...ggggggnn.....", 13: "..gGGGGggg......", 14: "....gggg........", 15: ".....y..y......." },
  },
  duck: {
    palette: { w: "#f5f5f0", W: "#c9ccc4", e: "#1a1a1a", y: "#f59e0b", b: "#5fb3d9" },
    rows: { 9: "..........ww....", 10: ".........wweyy..", 11: "..........ww....", 12: "..w.wwwwwww.....", 13: "..wwwWWwwww.....", 14: "...wwwwwww......", 15: "..bbbbbbbbbb...." },
  },
};

function svg(rows, palette) {
  const byColor = new Map();
  rows.forEach((line, y) => {
    let x = 0;
    while (x < 16) {
      const ch = line[x];
      if (ch === "." || !palette[ch]) { x++; continue; }
      let run = 1;
      while (x + run < 16 && line[x + run] === ch) run++;
      byColor.set(ch, `${byColor.get(ch) ?? ""}M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  });
  const paths = [...byColor].map(([ch, d]) => `  <path fill="${palette[ch]}" d="${d}"/>`).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges">\n${paths}\n</svg>\n`;
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, { palette, rows }] of Object.entries(NPCS)) {
  const pattern = BODY.map((line, y) => rows[y] ?? line);
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg(pattern, palette));
  console.log(`wrote ${name}.svg`);
}
for (const [name, { palette, rows }] of Object.entries(ANIMALS)) {
  const pattern = Array.from({ length: 16 }, (_, y) => rows[y] ?? "................");
  fs.writeFileSync(path.join(OUT, `animal-${name}.svg`), svg(pattern, palette));
  console.log(`wrote animal-${name}.svg`);
}
