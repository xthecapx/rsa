import { townMap } from "./townMap";
import { CAMPUS_STANDS } from "@/content/campusStands";
/** An outdoor open house: grass, demonstration rugs, and continuous approach paths. */
const width = 38,
  height = 34;
const ground: string[][] = Array.from({ length: height }, (_, y) =>
  Array.from({ length: width }, (_, x) =>
    x === 0 || x === width - 1 || y === height - 1 || y === 0
      ? "I"
      : (x * 7 + y * 11) % 17 === 0
        ? ","
        : ".",
  ),
);
const overlay = Array.from({ length: height }, () =>
  Array<string>(width).fill("."),
);
// Coin Town is north. The welcome plaza branches into aisles between the
// stands, so following the pavement never runs into furniture.
for (let y = 0; y <= 3; y++) for (const x of [17, 18, 19]) ground[y][x] = "p";
for (let y = 3; y <= 31; y++)
  for (const x of [12, 13, 14, 23, 24, 25]) ground[y][x] = "p";
for (const y of [2, 3, 4, 9, 18, 27, 31])
  for (let x = 4; x < 34; x++) ground[y][x] = "p";
for (const { at: { x, y } } of CAMPUS_STANDS)
  for (let dx = -3; dx <= 3; dx++) ground[y][x + dx] = "q";
for (const [x, y] of [
  [3, 4],
  [34, 4],
  [3, 13],
  [34, 13],
  [3, 22],
  [34, 22],
  [3, 30],
]) {
  overlay[y - 1][x] = "G";
  overlay[y][x] = "g";
}
for (const [x, y] of [
  [11, 10],
  [24, 10],
  [11, 19],
  [24, 19],
  [24, 28],
])
  overlay[y][x] = "b";
// Sand beside the eastern boundary conceals the shared lab entrance.
ground[30][34] = "s";
ground[31][34] = "q";
export const campusMap = {
  width,
  height,
  tileSize: townMap.tileSize,
  sheetColumns: townMap.sheetColumns,
  legend: townMap.legend,
  overlayLegend: townMap.overlayLegend,
  rows: ground.map((r) => r.join("")),
  overlay: overlay.map((r) => r.join("")),
};
