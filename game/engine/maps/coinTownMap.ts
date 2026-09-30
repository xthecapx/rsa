import { townMap } from "./townMap";
import { COIN_TOWN_DOOR, COIN_TOWN_EAST_SIGN, COIN_TOWN_NORTH_ROAD, COIN_TOWN_NPCS, COIN_TOWN_SIDE_ROAD, COIN_TOWN_WEST_SIGN } from "@/content/coinTown";

/**
 * Coin Town terrain, drawn with the same Kenney legend as Quantum Town. The
 * game starts at the south end of the main path; the coin house closes its
 * north end, the neighbors sit along a crossing street, and a road beside the
 * coin house climbs north to Quantum Town. The crossing street runs out of
 * town both ways: east to Foundry Town, west to Hollow Town (gated for now).
 */
const width = 40, height = 30;

const ground: string[][] = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
  x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "I" : (x * 7 + y * 11) % 17 === 0 ? "," : "."));
const overlay = Array.from({ length: height }, () => Array<string>(width).fill("."));
function fill(x: number, y: number, w: number, h: number, tile: string) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) ground[y + dy][x + dx] = tile;
}
function house(x: number, y: number, tan: boolean) {
  const [left, middle, right, wallLeft, wall, wallRight] = tan ? ["C", "c", "D", "K", "k", "L"] : ["A", "a", "B", "I", "i", "J"];
  for (let dx = 0; dx < 10; dx++) {
    ground[y][x + dx] = dx === 0 ? left : dx === 9 ? right : middle;
    for (let dy = 1; dy < 5; dy++) ground[y + dy][x + dx] = dx === 0 ? wallLeft : dx === 9 ? wallRight : wall;
  }
  for (const dx of [2, 7]) { overlay[y + 1][x + dx] = tan ? "3" : "1"; overlay[y + 2][x + dx] = tan ? "4" : "2"; }
  overlay[y + 4][x + 5] = "X";
}

// The main path runs from the arrival square up to the coin house door.
fill(19, 6, 3, height - 7, "p");
// The north road to Quantum Town, past the coin house, through the town wall.
fill(COIN_TOWN_NORTH_ROAD[0], 0, COIN_TOWN_NORTH_ROAD.length, 14, "p");
// The crossing street, through the town wall at both ends.
fill(0, COIN_TOWN_SIDE_ROAD[0], width, COIN_TOWN_SIDE_ROAD.length, "p");
// Door paths for the two side houses.
fill(7, 12, 3, 2, "p"); fill(31, 12, 3, 2, "p");
// The fountain square, south-west, with a gravel basin.
fill(7, 17, 3, 3, "p"); fill(5, 20, 11, 7, "p"); fill(8, 22, 4, 3, "v");
// The weathervane plaza, south-east.
fill(24, 17, 3, 2, "p"); fill(24, 19, 8, 5, "p"); fill(28, 20, 1, 1, "d");

house(15, 1, true); house(3, 7, false); house(27, 7, false);
if (ground[COIN_TOWN_DOOR.at.y][COIN_TOWN_DOOR.at.x] !== "k") throw new Error("Coin house door is off the facade");

// Lamps along Luz's stretch of street, the weathervane pole and a little furniture.
for (const [x, y] of [[12, 12], [16, 12], [24, 12], [28, 19]]) { overlay[y][x] = "l"; overlay[y + 1][x] = "j"; }
for (const [x, y] of [[6, 19], [14, 19], [30, 24], [17, 17]]) overlay[y][x] = "b";
overlay[13][18] = "w"; overlay[13][22] = "h";
// Trees: canopy over trunk, like Quantum Town.
for (const [x, y, top, trunk] of [[2, 4, "G", "g"], [13, 4, "N", "n"], [29, 4, "G", "g"], [37, 4, "M", "m"], [2, 12, "M", "m"], [2, 25, "G", "g"],
  [36, 21, "N", "n"], [34, 26, "G", "g"], [17, 25, "M", "m"], [25, 27, "N", "n"], [37, 27, "M", "m"], [3, 28, "N", "n"]] as const) {
  overlay[y][x] = trunk; overlay[y - 1][x] = top;
}
for (const [x, y] of [[6, 22], [15, 24], [23, 22], [33, 20], [11, 27], [29, 27]]) overlay[y][x] = "u";

for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
  if (ground[y][x] === "p" && (x * 13 + y * 7) % 11 === 0) ground[y][x] = "q";
}
for (const sign of [COIN_TOWN_EAST_SIGN, COIN_TOWN_WEST_SIGN]) if (ground[sign.at.y][sign.at.x] === "I" || overlay[sign.at.y][sign.at.x] !== ".") throw new Error("A signpost stands on a solid tile");
for (const npc of COIN_TOWN_NPCS) if (ground[npc.at.y][npc.at.x] === "I" || overlay[npc.at.y][npc.at.x] !== ".") throw new Error(`${npc.id} stands on a solid tile`);

export const coinTownMap = {
  width, height, tileSize: townMap.tileSize, sheetColumns: townMap.sheetColumns,
  legend: townMap.legend, overlayLegend: townMap.overlayLegend,
  rows: ground.map((row) => row.join("")), overlay: overlay.map((row) => row.join("")),
};
