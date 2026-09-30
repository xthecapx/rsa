#!/usr/bin/env node
/**
 * Draw the town neighbors, the animals wandering the towns and Foundry Town's props as 16x16 front-facing SVG sprites in
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
  vpcap: {
    // Foundry Town's VP of engineering: white hard hat, safety vest over a navy shirt.
    palette: { o: "#141414", h: "#f8fafc", H: "#cbd5e1", s: "#d9a577", e: "#141414", c: "#1e3a8a", C: "#172554", p: "#334155", b: "#0f172a", a: "#f97316", y: "#facc15" },
    rows: { 2: ".....HHHHHH.....", 3: "....hhhhhhhh....", 4: "...HhhhhhhhhH...", 9: "....oacccao.....", 10: "...soayccyaos...", 11: "....oaccccao...." },
  },
  rosa: {
    // Switchboard operator: headset over dark curls.
    palette: { o: "#1a1410", h: "#3b2616", s: "#e0a878", e: "#1a1410", c: "#14b8a6", C: "#0f766e", p: "#1f2937", b: "#111827", a: "#9ca3af", m: "#ef4444" },
    rows: { 3: "...aohhhhhhoa...", 4: "...ahhhhhhhha...", 5: "...ahssssssh....", 6: "...mhsessesh...." },
  },
  paco: {
    // Paint mixer: splattered overalls and a cap.
    palette: { o: "#161616", h: "#2563eb", H: "#1d4ed8", s: "#c68b59", e: "#161616", c: "#e5e7eb", C: "#9ca3af", p: "#1e40af", b: "#0f172a", r: "#ef4444", g: "#22c55e", y: "#facc15" },
    rows: { 2: "....HHHHHH......", 3: "....hhhhhhhHH...", 9: "....ocrcgco.....", 10: "...soccyccros...", 12: "....oprpgppo....", 13: "....oppyppro...." },
  },
  ines: {
    // Quality inspector: goggles and a clipboard.
    palette: { o: "#171717", h: "#7c2d12", s: "#f1c9a3", e: "#171717", c: "#f8fafc", C: "#e2e8f0", p: "#3f3f46", b: "#18181b", g: "#38bdf8", G: "#0c4a6e", k: "#a16207", w: "#fefce8" },
    rows: { 3: "...ohhhhhhhho...", 4: "...hhhhhhhhhh...", 6: "....GggGGggG....", 10: "...soccccckws...", 11: "....occcckwo...." },
  },
  joaquin: {
    // Press operator: welding cap, heavy apron.
    palette: { o: "#141414", h: "#111827", H: "#dc2626", s: "#a8703f", e: "#141414", c: "#78350f", C: "#451a03", p: "#27272a", b: "#09090b", a: "#d4d4d8" },
    rows: { 2: ".....HHHHHH.....", 3: "....HHHHHHHH....", 9: "....occaacco....", 10: "...soccaaccos...", 11: "....occaacco...." },
  },
  vera: {
    // Crane operator: yellow hard hat and hi-vis jacket.
    palette: { o: "#171717", h: "#facc15", H: "#ca8a04", s: "#e8b98f", e: "#171717", c: "#f97316", C: "#c2410c", p: "#1e293b", b: "#0f172a", a: "#e5e7eb", t: "#6b3e1f" },
    rows: { 2: ".....HHHHHH.....", 3: "....hhhhhhhh....", 4: "...HhhhhhhhhH...", 5: "...thssssssht...", 10: "...socaccacos...", 11: "....occaacco...." },
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
  bot: {
    // Foundry delivery robot: a crate on wheels with one blinking eye.
    palette: { g: "#cbd5e1", G: "#64748b", e: "#22d3ee", k: "#1f2937", y: "#facc15", a: "#94a3b8" },
    rows: { 5: ".........a......", 6: "........aaa.....", 7: "....GGGGGGGG....", 8: "....GggggggG....", 9: "....GggggeeG....", 10: "....GgyggggG....", 11: "....GggggggG....", 12: "....GGGGGGGG....", 13: "....k.kk.kk.k...", 14: "...kkk....kkk..." },
  },
};


/** Foundry Town props, one 16x16 tile each; tall things are two tiles stacked. */
const PROPS = {
  "stack-top": { palette: { r: "#b91c1c", w: "#f5f5f4", k: "#292524", d: "#7f1d1d" },
    rows: { 0: "....kkkkkkkk....", 1: "....krrrrrrk....", 2: ".....rrrrrr.....", 3: ".....wwwwww.....", 4: ".....rrrrrr.....", 5: ".....rrrrrd.....", 6: ".....wwwwww.....", 7: ".....rrrrrd.....", 8: ".....rrrrrd.....", 9: ".....wwwwww.....", 10: ".....rrrrrd.....", 11: ".....rrrrrd.....", 12: ".....rrrrrd.....", 13: ".....rrrrrd.....", 14: ".....rrrrrd.....", 15: ".....rrrrrd....." } },
  "stack-base": { palette: { r: "#991b1b", d: "#7f1d1d", k: "#292524", g: "#57534e" },
    rows: { 0: ".....rrrrrd.....", 1: ".....rdrrdd.....", 2: ".....rrrrrd.....", 3: "....rrdrrrdr....", 4: "....rrrrrrdr....", 5: "....rdrrdrrd....", 6: "....rrrrrrdr....", 7: "...rrrdrrrrdr...", 8: "...rrrrrrdrrr...", 9: "...rdrrrrrrdr...", 10: "...rrrrdrrrrr...", 11: "..gggggggggggg..", 12: "..gkkkkkkkkkkg..", 13: "..gggggggggggg..", 14: "................", 15: "................" } },
  "silo-top": { palette: { s: "#e2e8f0", S: "#94a3b8", k: "#475569", y: "#facc15" },
    rows: { 4: "......kkkk......", 5: "....kkssssk.....", 6: "...kssssssSk....", 7: "..kssssssssSk...", 8: "..ksssssssSSk...", 9: "..kkkkkkkkkkk...", 10: "..ksssssssSSk...", 11: "..ksyyyyysSSk...", 12: "..ksssssssSSk...", 13: "..ksssssssSSk...", 14: "..ksssssssSSk...", 15: "..ksssssssSSk..." } },
  "silo-base": { palette: { s: "#e2e8f0", S: "#94a3b8", k: "#475569", g: "#64748b" },
    rows: { 0: "..ksssssssSSk...", 1: "..ksssssssSSk...", 2: "..kkkkkkkkkkk...", 3: "..ksssssssSSk...", 4: "..ksssssssSSk...", 5: "..ksssssssSSk...", 6: "..ksssssssSSk...", 7: "..kkkkkkkkkkk...", 8: "..ksssssssSSk...", 9: "..ksssssssSSk...", 10: "..ksssssssSSk...", 11: "...kg.....gk....", 12: "...kg.....gk....", 13: "..kkkk...kkkk...", 14: "................", 15: "................" } },
  belt: { palette: { k: "#1f2937", g: "#6b7280", G: "#9ca3af", y: "#facc15" },
    rows: { 6: "gggggggggggggggg", 7: "kkkkkkkkkkkkkkkk", 8: "kGkkkGkkkGkkkGkk", 9: "kkkkkkkkkkkkkkkk", 10: "gggggggggggggggg", 11: "y.y.y.y.y.y.y.y.", 12: ".k...k...k...k..", 13: ".k...k...k...k.." } },
  crate: { palette: { w: "#c08a4b", W: "#8a5a2b", k: "#4a2e14" },
    rows: { 1: "....kkkkkkkk....", 2: "....kwwwwwWk....", 3: "....kWwwwWWk....", 4: "....kwWwWwWk....", 5: "....kwwWwwWk....", 6: "....kwWwWwWk....", 7: "....kWwwwWWk....", 8: "....kkkkkkkk...." } },
  "press-top": { palette: { g: "#9ca3af", G: "#4b5563", k: "#1f2937", y: "#facc15", r: "#dc2626" },
    rows: { 2: "..kkkkkkkkkkkk..", 3: "..kggggggggggk..", 4: "..kgrgggggggGk..", 5: "..kggggggggGGk..", 6: "..kkkkkkkkkkkk..", 7: "......kGGk......", 8: "......kGGk......", 9: "......kGGk......", 10: "......kGGk......", 11: "....kkkkkkkk....", 12: "....kggggggk....", 13: "....kkkkkkkk....", 14: "..k..........k..", 15: "..k..........k.." } },
  "press-base": { palette: { g: "#9ca3af", G: "#4b5563", k: "#1f2937", y: "#facc15" },
    rows: { 0: "..k..........k..", 1: "..k..........k..", 2: "..k..........k..", 3: "..kkkkkkkkkkkk..", 4: "..kykykykykykk..", 5: "..kkykykykykyk..", 6: "..kggggggggggk..", 7: "..kgggggggggGk..", 8: "..kggggggggGGk..", 9: "..kkkkkkkkkkkk..", 10: "..GG........GG.." } },
  "crane-top": { palette: { y: "#facc15", Y: "#ca8a04", k: "#1f2937", c: "#6b7280" },
    rows: { 2: "kkkkkkkkkkkkkkkk", 3: "yYyYyYyYyYyYyYyk", 4: "kkkkkkkkkkkkkkkk", 5: "c.........kYYk..", 6: "c.........kyyk..", 7: "c.........kYyk..", 8: "c.........kyYk..", 9: "c.........kYyk..", 10: "k.........kyYk..", 11: "k.........kYyk..", 12: "kk........kyYk..", 13: "..........kYyk..", 14: "..........kyYk..", 15: "..........kYyk.." } },
  "crane-base": { palette: { y: "#facc15", Y: "#ca8a04", k: "#1f2937", g: "#57534e" },
    rows: { 0: "..........kyYk..", 1: "..........kYyk..", 2: "..........kyYk..", 3: "..........kYyk..", 4: "..........kyYk..", 5: "..........kYyk..", 6: "..........kyYk..", 7: "..........kYyk..", 8: "..........kyYk..", 9: "........gggggggg", 10: "........gkkkkkkg", 11: "........gggggggg" } },
  sign: { palette: { w: "#b7793f", W: "#7c4a22", k: "#3b2412", t: "#fef3c7" },
    rows: { 2: "..kkkkkkkkkkkk..", 3: "..kwwwwwwwwwwk..", 4: "..kwtttwtttwwk..", 5: "..kwwwwwwwwwWk..", 6: "..kwttwtttwwWk..", 7: "..kwwwwwwwwWWk..", 8: "..kkkkkkkkkkkk..", 9: ".......kW.......", 10: ".......kW.......", 11: ".......kW.......", 12: ".......kW.......", 13: ".......kW.......", 14: "......kkWW......" } },
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
for (const [name, { palette, rows }] of Object.entries(PROPS)) {
  const pattern = Array.from({ length: 16 }, (_, y) => rows[y] ?? "................");
  fs.writeFileSync(path.join(OUT, `prop-${name}.svg`), svg(pattern, palette));
  console.log(`wrote prop-${name}.svg`);
}
