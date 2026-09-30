import { townMap } from "./townMap";
import { FOUNDRY_DOOR, FOUNDRY_NPCS, FOUNDRY_PROPS, FOUNDRY_WEST_ROAD } from "@/content/foundry";

/**
 * Foundry Town terrain, in the same Kenney legend as the other towns plus a
 * few industrial tiles. The west road from Coin Town arrives by VP Cap and
 * runs east as the main avenue. Thecap's workshop closes the lane to the
 * north; the silo yard, conveyor line, stamping press and loading dock fill
 * the south. The east end of the avenue is closed.
 */
const width = 40, height = 30;

/** Extra Kenney tiles (index = row * 37 + column): grey factory roofs and walls, pavers, hazard stripes. */
const FOUNDRY_LEGEND: Record<string, { tile: number; solid: boolean }> = {
  E: { tile: 152, solid: true }, F: { tile: 153, solid: true }, G: { tile: 155, solid: true },
  H: { tile: 189, solid: true }, O: { tile: 190, solid: true }, P: { tile: 192, solid: true },
  e: { tile: 704, solid: false }, // grey pavers
  x: { tile: 719, solid: false }, // hazard stripes
};
const FOUNDRY_OVERLAY: Record<string, { tile: number; solid: boolean }> = {
  "0": { tile: 530, solid: true }, // drum
  "8": { tile: 606, solid: true }, // crate
  "^": { tile: 680, solid: true }, // traffic cone
  "7": { tile: 549, solid: true }, // generator
  "6": { tile: 321, solid: true }, // belt machine
};

const ground: string[][] = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
  x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "I" : (x * 7 + y * 11) % 17 === 0 ? "," : "."));
const overlay = Array.from({ length: height }, () => Array<string>(width).fill("."));
function fill(x: number, y: number, w: number, h: number, tile: string) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) ground[y + dy][x + dx] = tile;
}
type Style = "tan" | "grey";
function house(x: number, y: number, style: Style) {
  const [left, middle, right, wallLeft, wall, wallRight] = style === "tan" ? ["C", "c", "D", "K", "k", "L"] : ["E", "F", "G", "H", "O", "P"];
  for (let dx = 0; dx < 10; dx++) {
    ground[y][x + dx] = dx === 0 ? left : dx === 9 ? right : middle;
    for (let dy = 1; dy < 5; dy++) ground[y + dy][x + dx] = dx === 0 ? wallLeft : dx === 9 ? wallRight : wall;
  }
  for (const dx of [2, 7]) { overlay[y + 1][x + dx] = style === "tan" ? "3" : "1"; overlay[y + 2][x + dx] = style === "tan" ? "4" : "2"; }
  overlay[y + 4][x + 5] = "X";
}

// The avenue from the west gate to the closed east end.
fill(0, FOUNDRY_WEST_ROAD[0], 36, FOUNDRY_WEST_ROAD.length, "p");
for (const y of FOUNDRY_WEST_ROAD) overlay[y][36] = "Z";
// North: the control room, Thecap's workshop and the factory hall, each with a lane to the avenue.
house(2, 3, "grey"); house(15, 2, "tan"); house(27, 2, "grey");
// The factory hall opens onto a paved forecourt, stacked with drums.
fill(26, 7, 12, 7, "e");
fill(6, 8, 3, 6, "p"); fill(19, 7, 3, 7, "p"); fill(31, 7, 3, 7, "p");
for (const [x, y] of [[27, 8], [28, 8], [36, 8], [36, 10]]) overlay[y][x] = "0";
overlay[8][35] = "8";
if (ground[FOUNDRY_DOOR.at.y][FOUNDRY_DOOR.at.x] !== "k") throw new Error("Workshop door is off the facade");
// South-west: the silo yard, on gravel, with paint drums.
fill(6, 17, 3, 1, "p"); fill(2, 18, 10, 8, "v");
for (const [x, y] of [[3, 24], [4, 24], [10, 19], [10, 20]]) overlay[y][x] = "0";
// South: the conveyor floor, pavers around a belt with a machine at each end.
fill(19, 17, 3, 1, "p"); fill(14, 18, 13, 7, "e");
overlay[21][15] = "6"; overlay[21][26] = "6";
// South-east: the press floor, hazard stripes under the press, and the loading dock below it.
fill(29, 17, 8, 6, "p"); fill(32, 20, 3, 1, "x"); overlay[18][35] = "7";
fill(30, 23, 2, 1, "p"); fill(28, 24, 10, 4, "v");
for (const [x, y] of [[29, 25], [30, 26], [31, 26], [34, 24]]) overlay[y][x] = "8";

// Lamps along the avenue, cones and drums where work happens, and a few trees.
for (const x of [12, 17, 26, 35]) { overlay[12][x] = "l"; overlay[13][x] = "j"; }
for (const [x, y] of [[13, 17], [27, 17], [28, 22]]) overlay[y][x] = "^";
overlay[13][23] = "w"; overlay[13][10] = "h";
for (const [x, y, top, trunk] of [[13, 5, "G", "g"], [1, 10, "M", "m"], [37, 9, "N", "n"], [12, 27, "G", "g"], [2, 28, "M", "m"], [26, 27, "N", "n"]] as const) {
  overlay[y][x] = trunk; overlay[y - 1][x] = top;
}
for (const [x, y] of [[24, 10], [37, 21], [13, 25]]) overlay[y][x] = "u";

for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
  if (ground[y][x] === "p" && (x * 13 + y * 7) % 11 === 0) ground[y][x] = "q";
}
const blocked = (at: { x: number; y: number }) => ground[at.y][at.x] === "I" || overlay[at.y][at.x] !== "." || FOUNDRY_PROPS.some((prop) => prop.at.x === at.x && prop.at.y === at.y);
for (const npc of FOUNDRY_NPCS) if (blocked(npc.at)) throw new Error(`${npc.id} stands on a solid tile`);

export const foundryMap = {
  width, height, tileSize: townMap.tileSize, sheetColumns: townMap.sheetColumns,
  legend: { ...townMap.legend, ...FOUNDRY_LEGEND }, overlayLegend: { ...townMap.overlayLegend, ...FOUNDRY_OVERLAY },
  rows: ground.map((row) => row.join("")), overlay: overlay.map((row) => row.join("")),
};
