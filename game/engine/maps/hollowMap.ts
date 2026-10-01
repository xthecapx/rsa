import { townMap } from "./townMap";
import { HOLLOW_DOOR, HOLLOW_EAST_ROAD, HOLLOW_NPCS, HOLLOW_PROPS } from "@/content/hollow";

/**
 * Hollow Town terrain, in the same Kenney legend as the other towns plus a
 * few old-town tiles. The east road from Coin Town arrives by Keeper Cap and
 * runs west past the fenced cemetery. Casa Ofelia closes the lane on the
 * north-west hill and the chapel sits north-east; the wax shop, the crypt, the
 * pumpkin patch and the lantern row fill the south. The west end is closed.
 */
const width = 40, height = 30;

/** Extra Kenney tiles (index = row * 37 + column): grey stone roofs and walls, bare earth. */
const HOLLOW_LEGEND: Record<string, { tile: number; solid: boolean }> = {
  E: { tile: 152, solid: true }, F: { tile: 153, solid: true }, G: { tile: 155, solid: true },
  H: { tile: 189, solid: true }, O: { tile: 190, solid: true }, P: { tile: 192, solid: true },
  e: { tile: 975, solid: false }, // bare earth
  W: { tile: 264, solid: true }, // old stone wall around the town
};

const ground: string[][] = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
  x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "W" : (x * 7 + y * 11) % 17 === 0 ? "," : "."));
const overlay = Array.from({ length: height }, () => Array<string>(width).fill("."));
function fill(x: number, y: number, w: number, h: number, tile: string) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) ground[y + dy][x + dx] = tile;
}
type Style = "stone" | "chapel";
function house(x: number, y: number, style: Style) {
  const [left, middle, right, wallLeft, wall, wallRight] = style === "stone" ? ["E", "F", "G", "H", "O", "P"] : ["A", "a", "B", "I", "i", "J"];
  for (let dx = 0; dx < 10; dx++) {
    ground[y][x + dx] = dx === 0 ? left : dx === 9 ? right : middle;
    for (let dy = 1; dy < 5; dy++) ground[y + dy][x + dx] = dx === 0 ? wallLeft : dx === 9 ? wallRight : wall;
  }
  for (const dx of [2, 7]) { overlay[y + 1][x + dx] = "1"; overlay[y + 2][x + dx] = "2"; }
  overlay[y + 4][x + 5] = "X";
}

// The road from the east gate, ending short of the closed west edge.
fill(4, HOLLOW_EAST_ROAD[0], width - 4, HOLLOW_EAST_ROAD.length, "p");
// North: Casa Ofelia on the hill and the chapel, each with a lane down to the road.
house(5, 2, "stone"); house(26, 2, "chapel");
fill(9, 7, 3, 7, "p"); fill(30, 7, 3, 7, "p");
if (ground[HOLLOW_DOOR.at.y][HOLLOW_DOOR.at.x] !== "O") throw new Error("Casa Ofelia's door is off the facade");
// The cemetery: bare earth inside an iron fence, with a gap onto the road.
fill(15, 4, 10, 8, "e"); fill(19, 12, 2, 2, "p"); fill(19, 4, 2, 8, "v");
for (let x = 14; x <= 25; x++) {
  overlay[3][x] = x === 14 ? "[" : x === 25 ? "]" : "F";
  if (x !== 19 && x !== 20) overlay[12][x] = x === 14 ? "[" : x === 25 ? "]" : x === 18 ? "]" : x === 21 ? "[" : "F";
}
for (let y = 4; y < 12; y++) { overlay[y][14] = "|"; overlay[y][25] = "|"; }
// South-west: Candela's wax yard and the pumpkin patch below it.
fill(11, 17, 3, 1, "p"); fill(9, 18, 7, 4, "p");
fill(2, 22, 7, 6, "e");
// South: Rocío's corner by the crypt.
fill(21, 17, 2, 2, "p"); fill(19, 19, 8, 5, "v");
// South-east: the lantern row.
fill(31, 17, 2, 5, "p"); fill(27, 22, 11, 4, "p");

// Bushes and a bin; the town is otherwise left to the dead trees.
for (const [x, y] of [[3, 8], [13, 20], [26, 26], [36, 18], [17, 18]]) overlay[y][x] = "u";
overlay[13][29] = "w";

for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
  if (ground[y][x] === "p" && (x * 13 + y * 7) % 11 === 0) ground[y][x] = "q";
}
const legend: Record<string, { solid: boolean }> = { ...townMap.legend, ...HOLLOW_LEGEND };
const blocked = (at: { x: number; y: number }) => !!legend[ground[at.y][at.x]]?.solid
  || overlay[at.y][at.x] !== "." || HOLLOW_PROPS.some((prop) => prop.at.x === at.x && prop.at.y === at.y);
for (const npc of HOLLOW_NPCS) if (blocked(npc.at)) throw new Error(`${npc.id} stands on a solid tile`);

export const hollowMap = {
  width, height, tileSize: townMap.tileSize, sheetColumns: townMap.sheetColumns,
  legend: { ...townMap.legend, ...HOLLOW_LEGEND }, overlayLegend: townMap.overlayLegend,
  rows: ground.map((row) => row.join("")), overlay: overlay.map((row) => row.join("")),
};
