import original from "./street.json";
import { TOWN_TREES, type TreeKind } from "@/content/town";

/** The RSA street is part of the town terrain, with no portal at its edge. */
export const RSA_OFFSET = { x: 26, y: 2 };
const width = 64, height = 36;

/** Extra Kenney tiles the town uses beyond the street legend (index = row * 37 + column). */
const TOWN_LEGEND: Record<string, { tile: number; solid: boolean }> = {
  q: { tile: 891, solid: false }, // worn sidewalk
  s: { tile: 894, solid: false }, // sand
  v: { tile: 896, solid: false }, // gravel
};
const TOWN_OVERLAY: Record<string, { tile: number; solid: boolean }> = {
  // Trees: tall ones are two tiles, canopy over trunk.
  G: { tile: 401, solid: true }, g: { tile: 438, solid: true },
  N: { tile: 402, solid: true }, n: { tile: 439, solid: true },
  M: { tile: 403, solid: true }, m: { tile: 440, solid: true },
  o: { tile: 514, solid: true }, u: { tile: 517, solid: true },
  // Street furniture.
  b: { tile: 570, solid: true }, // bench
  h: { tile: 533, solid: true }, // hydrant
  w: { tile: 496, solid: true }, // bin
  F: { tile: 540, solid: true }, "[": { tile: 538, solid: true }, "]": { tile: 542, solid: true }, "|": { tile: 575, solid: true }, // fence
  Z: { tile: 645, solid: true }, // road-end barrier
};
const TREE_TILES: Record<TreeKind, { top?: string; trunk: string }> = {
  tall: { top: "G", trunk: "g" }, orange: { top: "N", trunk: "n" }, dark: { top: "M", trunk: "m" }, round: { trunk: "o" }, bush: { trunk: "u" },
};

const ground: string[][] = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
  x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "I" : (x * 7 + y * 11) % 17 === 0 ? "," : "."));
const overlay = Array.from({ length: height }, () => Array<string>(width).fill("."));
function fill(x: number, y: number, w: number, h: number, tile: string) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) ground[y + dy][x + dx] = tile;
}
function stamp(x: number, y: number, rows: string[]) {
  rows.forEach((row, dy) => [...row].forEach((tile, dx) => { if (tile !== " ") overlay[y + dy][x + dx] = tile; }));
}

// Connected footpaths, a plaza, and a southern arrival path.
fill(7, 6, 3, 25, "p"); fill(20, 6, 3, 25, "p");
fill(7, 14, 49, 3, "p"); fill(19, 18, 10, 6, "p");
fill(23, 22, 3, 14, "p"); fill(20, 28, 6, 3, "p");
fill(7, 28, 14, 3, "p"); // west loop back to the plaza
for (let y = 0; y < original.height; y++) for (let x = 0; x < original.width; x++) {
  ground[y + RSA_OFFSET.y][x + RSA_OFFSET.x] = original.rows[y][x];
  overlay[y + RSA_OFFSET.y][x + RSA_OFFSET.x] = original.overlay[y][x];
}
// The street continues west past the plaza path and ends at a barrier short of the coin house.
fill(14, 8, 12, 1, "p"); fill(14, 12, 12, 1, "p");
fill(14, 9, 12, 1, "r"); fill(14, 10, 12, 1, "y"); fill(14, 11, 12, 1, "r");
fill(20, 9, 3, 3, "z");
for (const y of [9, 10, 11]) overlay[y][14] = "Z";
// Keep a continuous sidewalk into the district and down to the plaza.
fill(24, 14, 7, 3, "p"); fill(28, 16, 3, 7, "p");

// The park: a path loop around a pool, with a fenced garden beside the main path.
fill(44, 17, 3, 6, "p");
fill(36, 22, 19, 2, "p"); fill(36, 30, 19, 2, "p"); fill(36, 22, 2, 10, "p"); fill(53, 22, 2, 10, "p");
fill(43, 24, 5, 6, "v"); fill(38, 24, 3, 6, "d"); fill(50, 24, 3, 6, "d");
fill(57, 18, 3, 3, "s"); // sandpit
fill(34, 19, 8, 2, "d"); // garden beds
stamp(33, 18, ["[FFFFFFF]"]);
for (const y of [19, 20]) { overlay[y][33] = "|"; overlay[y][41] = "|"; }
stamp(33, 21, ["[FF]   [FF]"]);

function house(x: number, y: number, tan: boolean) {
  const [left, middle, right, wallLeft, wall, wallRight] = tan ? ["C", "c", "D", "K", "k", "L"] : ["A", "a", "B", "I", "i", "J"];
  for (let dx = 0; dx < 10; dx++) {
    ground[y][x + dx] = dx === 0 ? left : dx === 9 ? right : middle;
    for (let dy = 1; dy < 5; dy++) ground[y + dy][x + dx] = dx === 0 ? wallLeft : dx === 9 ? wallRight : wall;
  }
  for (const dx of [2, 7]) { overlay[y + 1][x + dx] = tan ? "3" : "1"; overlay[y + 2][x + dx] = tan ? "4" : "2"; }
  overlay[y + 4][x + 5] = "X";
}
house(3, 1, true); house(16, 1, false); house(3, 8, false);

// Benches, lamps, bins and hydrants where people would actually stop.
for (const [x, y] of [[10, 17], [17, 17], [4, 27], [30, 24], [19, 24], [41, 25], [41, 27], [49, 25], [49, 27], [56, 21], [60, 19]]) overlay[y][x] = "b";
for (const [x, y] of [[18, 20], [29, 20], [18, 31], [27, 31], [35, 24], [55, 24], [35, 29], [55, 29], [15, 12], [12, 27]]) { overlay[y][x] = "l"; overlay[y + 1][x] = "j"; }
overlay[13][13] = "h"; overlay[13][27] = "w"; overlay[6][13] = "w"; overlay[6][26] = "w"; overlay[17][47] = "h";

// Worn paving and the odd bare patch keep the ground from tiling visibly.
for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
  if (ground[y][x] === "p" && (x * 13 + y * 7) % 11 === 0) ground[y][x] = "q";
  if (ground[y][x] === "." && (x * 5 + y * 3) % 23 === 0) ground[y][x] = ",";
}
// The southern entrance opens the wall for the arrival path.
fill(23, 35, 3, 1, "p");

for (const tree of TOWN_TREES) {
  const tiles = TREE_TILES[tree.kind];
  overlay[tree.y][tree.x] = tiles.trunk;
  if (tiles.top) overlay[tree.y - 1][tree.x] = tiles.top;
}

export const townMap = {
  ...original, width, height,
  legend: { ...original.legend, ...TOWN_LEGEND },
  overlayLegend: { ...original.overlayLegend, ...TOWN_OVERLAY },
  rows: ground.map((row) => row.join("")), overlay: overlay.map((row) => row.join("")),
};
