import original from "./street.json";

/** The RSA street is part of the town terrain, with no portal at its edge. */
export const RSA_OFFSET = { x: 26, y: 2 };
const width = 64, height = 36;
const ground: string[][] = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
  x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "I" : (x * 7 + y * 11) % 17 === 0 ? "," : "."));
const overlay = Array.from({ length: height }, () => Array<string>(width).fill("."));
function fill(x: number, y: number, w: number, h: number, tile: string) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) ground[y + dy][x + dx] = tile;
}
// Connected footpaths, a plaza, and a southern arrival path.
fill(7, 6, 3, 25, "p"); fill(20, 6, 3, 25, "p");
fill(7, 14, 49, 3, "p"); fill(19, 18, 10, 6, "p");
fill(23, 22, 3, 13, "p"); fill(20, 28, 6, 3, "p");
for (let y = 0; y < original.height; y++) for (let x = 0; x < original.width; x++) {
  ground[y + RSA_OFFSET.y][x + RSA_OFFSET.x] = original.rows[y][x];
  overlay[y + RSA_OFFSET.y][x + RSA_OFFSET.x] = original.overlay[y][x];
}
// Keep a continuous sidewalk into the district and down to the plaza.
fill(24, 14, 7, 3, "p"); fill(28, 16, 3, 7, "p");
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

export const townMap = {
  ...original, width, height,
  rows: ground.map((row) => row.join("")), overlay: overlay.map((row) => row.join("")),
};
