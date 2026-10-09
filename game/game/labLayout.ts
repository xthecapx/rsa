import { LAB_ITEMS } from "@/content/lab";
export interface Placement {
  id: string;
  x: number;
  y: number;
  rotated: boolean;
}
export const LAB_HEIGHT = 8;
export const labWidth = (tier: number) => 8 + tier * 2;
export const LAB_ENTRY = { x: 3, y: 7 };
export function footprint(p: Placement): { x: number; y: number }[] {
  const item = LAB_ITEMS.find((i) => i.id === p.id)!;
  const w = p.rotated ? item.h : item.w,
    h = p.rotated ? item.w : item.h;
  return Array.from({ length: w * h }, (_, i) => ({
    x: p.x + (i % w),
    y: p.y + Math.floor(i / w),
  }));
}
export const defaultLayout = (): Placement[] => [
  { id: "desk", x: 2, y: 2, rotated: false },
  { id: "laptop", x: 4, y: 2, rotated: false },
  { id: "lamp", x: 1, y: 1, rotated: false },
  { id: "storage", x: 6, y: 1, rotated: false },
];
export function validLayout(layout: unknown, tier = 4): layout is Placement[] {
  if (!Array.isArray(layout) || layout.length > LAB_ITEMS.length) return false;
  const width = labWidth(tier),
    occupied = new Set<string>(),
    ids = new Set<string>();
  for (const p of layout) {
    if (
      !p ||
      !LAB_ITEMS.some((item) => item.id === p.id && !item.module) ||
      ids.has(p.id) ||
      !Number.isInteger(p.x) ||
      !Number.isInteger(p.y) ||
      typeof p.rotated !== "boolean"
    )
      return false;
    ids.add(p.id);
    for (const cell of footprint(p)) {
      const key = `${cell.x},${cell.y}`;
      if (
        cell.x < 0 ||
        cell.y < 0 ||
        cell.x >= width ||
        cell.y >= LAB_HEIGHT ||
        occupied.has(key) ||
        (cell.x === LAB_ENTRY.x && cell.y === LAB_ENTRY.y)
      )
        return false;
      occupied.add(key);
    }
  }
  const reachable = new Set([`${LAB_ENTRY.x},${LAB_ENTRY.y}`]),
    queue = [LAB_ENTRY];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = p.x + dx,
        y = p.y + dy,
        key = `${x},${y}`;
      if (
        x >= 0 &&
        y >= 0 &&
        x < width &&
        y < LAB_HEIGHT &&
        !occupied.has(key) &&
        !reachable.has(key)
      ) {
        reachable.add(key);
        queue.push({ x, y });
      }
    }
  }
  if (reachable.size !== width * LAB_HEIGHT - occupied.size) return false;
  return layout.every((p) =>
    footprint(p).some((cell) =>
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => reachable.has(`${cell.x + dx},${cell.y + dy}`)),
    ),
  );
}
