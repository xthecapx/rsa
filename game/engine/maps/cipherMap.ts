import original from "./street.json";
import { RSA_OFFSET, townMap } from "./townMap";
import { CIPHER_BOARD, CIPHER_NORTH_ROAD, CIPHER_NPCS, CIPHER_PROPS, CIPHER_SOUTH_ROAD } from "@/content/cipher";

/**
 * Cipher Town terrain, in Quantum Town's legend. Ale and Brayan's street is
 * stamped at the same RSA_OFFSET as in Quantum Town, so every landmark, parking
 * bay and scripted walk of the RSA acts lands on the same tiles in both maps.
 * The road from Coin Town climbs in from the south edge to the kiosk row and the
 * street; the north road to Quantum Town leaves from the north-west corner.
 */
const width = 64, height = 36;

const ground: string[][] = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
  x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "I" : (x * 7 + y * 11) % 17 === 0 ? "," : "."));
const overlay = Array.from({ length: height }, () => Array<string>(width).fill("."));
function fill(x: number, y: number, w: number, h: number, tile: string) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) ground[y + dy][x + dx] = tile;
}

// A dark asphalt district south of the street, paved walkways on top and a few grass planters left.
fill(1, 14, width - 2, height - 15, "r");
for (const [x, y, w, h] of [[2, 16, 10, 4], [19, 15, 8, 6], [34, 15, 14, 5], [54, 14, 8, 4], [19, 31, 8, 3], [35, 29, 7, 5]]) fill(x, y, w, h, ".");
for (let y = 0; y < original.height; y++) for (let x = 0; x < original.width; x++) {
  ground[y + RSA_OFFSET.y][x + RSA_OFFSET.x] = original.rows[y][x];
  overlay[y + RSA_OFFSET.y][x + RSA_OFFSET.x] = original.overlay[y][x];
}
// The street runs west past the server hall and ends at a barrier by the north road.
fill(10, 7, 16, 2, "p"); fill(10, 9, 16, 1, "r"); fill(10, 10, 16, 1, "y"); fill(10, 11, 16, 1, "r"); fill(10, 12, 16, 2, "p");
for (const y of [9, 10, 11]) overlay[y][10] = "Z";
// The north road to Quantum Town, through the town wall.
fill(CIPHER_NORTH_ROAD[0], 0, CIPHER_NORTH_ROAD.length, 14, "p");
// The server hall on the north-west block, with no door: everything in this town happens outside.
const [left, middle, right, wallLeft, wall, wallRight] = ["A", "a", "B", "I", "i", "J"];
for (let dx = 0; dx < 10; dx++) {
  ground[1][13 + dx] = dx === 0 ? left : dx === 9 ? right : middle;
  for (let dy = 1; dy < 5; dy++) ground[1 + dy][13 + dx] = dx === 0 ? wallLeft : dx === 9 ? wallRight : wall;
}
for (const dx of [2, 5, 8]) { overlay[2][13 + dx] = "1"; overlay[3][13 + dx] = "2"; }

// The avenue from Coin Town, through the south wall and up to the street.
fill(CIPHER_SOUTH_ROAD[0], 14, CIPHER_SOUTH_ROAD.length, height - 14, "p");
// The kiosk row: one long paved strip from Lupe's mural to the server racks.
fill(3, 24, 58, 3, "p");
// Lanes up to the street sidewalk on both sides of the avenue.
fill(15, 14, 2, 10, "p"); fill(50, 14, 2, 10, "p");
// Nina's arcade corner and Dante's plaza.
fill(5, 27, 12, 6, "p"); fill(8, 30, 5, 2, "v");
fill(44, 27, 14, 6, "p"); fill(48, 30, 7, 2, "v");
// Sidewalk in front of the stalls.
fill(19, 23, 32, 1, "p");

// Street furniture: lamps along the kiosk row, a bench or two, bins.
for (const [x, y] of [[11, 23], [28, 23], [45, 26], [58, 23]]) { overlay[y][x] = "l"; overlay[y + 1][x] = "j"; }
for (const [x, y] of [[27, 28], [33, 28]]) overlay[y][x] = "b";
overlay[22][31] = "w"; overlay[13][17] = "h";

for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
  if (ground[y][x] === "p" && (x * 13 + y * 7) % 11 === 0) ground[y][x] = "q";
}

const legend = townMap.legend as Record<string, { tile: number; solid: boolean }>;
const overlayLegend = townMap.overlayLegend as Record<string, { tile: number; solid: boolean } | null>;
const blocked = (at: { x: number; y: number }) => !!legend[ground[at.y][at.x]]?.solid || !!overlayLegend[overlay[at.y][at.x]]?.solid
  || CIPHER_PROPS.some((prop) => prop.at.x === at.x && prop.at.y === at.y);
for (const npc of CIPHER_NPCS) if (blocked(npc.at)) throw new Error(`${npc.id} stands on a solid tile`);
if (blocked(CIPHER_BOARD.stand)) throw new Error("Nobody can reach the bounty board");

export const cipherMap = {
  width, height, tileSize: townMap.tileSize, sheetColumns: townMap.sheetColumns,
  legend, overlayLegend,
  rows: ground.map((row) => row.join("")), overlay: overlay.map((row) => row.join("")),
};
