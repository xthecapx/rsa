import type { GridPos } from "./street";

/** true = solid. Rows first: grid[y][x]. */
export type WorldGrid = boolean[][];

export function walkable(grid: WorldGrid, pos: GridPos): boolean {
  return pos.y >= 0 && pos.y < grid.length && pos.x >= 0 && pos.x < grid[0].length && !grid[pos.y][pos.x];
}

/** Shortest 4-way route between tiles, excluding the start; null if unreachable. */
export function findRoute(grid: WorldGrid, from: GridPos, to: GridPos): GridPos[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  if (!walkable(grid, to)) return null;
  const width = grid[0].length;
  const key = (p: GridPos) => p.y * width + p.x;
  const cameFrom = new Map<number, GridPos>();
  const seen = new Set([key(from)]);
  const queue: GridPos[] = [from];
  while (queue.length) {
    const current = queue.shift()!;
    for (const step of [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      if (seen.has(key(next)) || !walkable(grid, next)) continue;
      seen.add(key(next)); cameFrom.set(key(next), current);
      if (next.x === to.x && next.y === to.y) {
        const path: GridPos[] = [];
        for (let cursor: GridPos | undefined = next; cursor && !(cursor.x === from.x && cursor.y === from.y); cursor = cameFrom.get(key(cursor))) path.unshift(cursor);
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/**
 * Walkable tiles within `radius` of `home` (Manhattan), optionally limited by
 * an extra test. Animals pick their next stop from these.
 */
export function tilesNear(grid: WorldGrid, home: GridPos, radius: number, allowed: (pos: GridPos) => boolean = () => true): GridPos[] {
  const tiles: GridPos[] = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const pos = { x: home.x + dx, y: home.y + dy };
    if (Math.abs(dx) + Math.abs(dy) <= radius && walkable(grid, pos) && allowed(pos)) tiles.push(pos);
  }
  return tiles;
}
