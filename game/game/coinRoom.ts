import type { RoomPlace } from "@/content/coin";

export interface RoomPoint { x: number; y: number }
export const ROOM_START: RoomPoint = { x: 200, y: 224 };
export const ROOM_STATIONS: Record<RoomPlace, RoomPoint> = {
  table: { x: 200, y: 192 }, desk: { x: 80, y: 112 }, board: { x: 320, y: 108 },
};
// Collision bounds describe the player's feet, with a margin around furniture.
const BLOCKS = [
  [28, 80, 134, 106], [152, 127, 251, 177], [26, 154, 110, 212],
  [325, 176, 369, 224], [126, 136, 158, 162], [242, 136, 279, 162],
];
export function canStand({ x, y }: RoomPoint): boolean {
  return x >= 24 && x <= 376 && y >= 92 && y <= 228
    && !BLOCKS.some(([left, top, right, bottom]) => x >= left && x <= right && y >= top && y <= bottom);
}
export function nearbyStation(point: RoomPoint): RoomPlace | null {
  return (Object.keys(ROOM_STATIONS) as RoomPlace[]).find((key) =>
    Math.hypot(point.x - ROOM_STATIONS[key].x, point.y - ROOM_STATIONS[key].y) <= 20) ?? null;
}
/** Small substeps prevent tunnelling through furniture, even after a slow frame. */
export function moveInRoom(from: RoomPoint, dx: number, dy: number): RoomPoint {
  let point = { ...from };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
  for (let i = 0; i < steps; i++) {
    const x = point.x + dx / steps, y = point.y + dy / steps;
    if (canStand({ x, y: point.y })) point.x = x;
    if (canStand({ x: point.x, y })) point.y = y;
  }
  return point;
}
/** Tap-to-walk uses a four-neighbour floor grid, including routes around the table. */
export function roomRoute(from: RoomPoint, destination: RoomPoint): RoomPoint[] {
  const grid = 4;
  const points: RoomPoint[] = [];
  for (let y = 92; y <= 228; y += grid) for (let x = 24; x <= 376; x += grid) {
    if (canStand({ x, y })) points.push({ x, y });
  }
  const key = (p: RoomPoint) => `${p.x},${p.y}`;
  const floor = new Map(points.map((p) => [key(p), p]));
  const nearest = (p: RoomPoint) => points.reduce((best, item) =>
    Math.hypot(item.x - p.x, item.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? item : best);
  const start = nearest(from), goal = nearest(destination);
  const queue = [start], previous = new Map<string, RoomPoint | null>([[key(start), null]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (key(current) === key(goal)) {
      const route: RoomPoint[] = [];
      let next: RoomPoint | null = current;
      while (next) { route.unshift(next); next = previous.get(key(next)) ?? null; }
      return route;
    }
    for (const [dx, dy] of [[grid, 0], [-grid, 0], [0, grid], [0, -grid]]) {
      const next = floor.get(key({ x: current.x + dx, y: current.y + dy }));
      if (!next || previous.has(key(next))) continue;
      previous.set(key(next), current); queue.push(next);
    }
  }
  return [];
}
