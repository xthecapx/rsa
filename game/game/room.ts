export interface RoomPoint { x: number; y: number }
/** Feet-level collision rectangle: [left, top, right, bottom]. */
export type RoomBlock = readonly [number, number, number, number];
export interface RoomConfig<Place extends string> {
  start: RoomPoint;
  stations: Record<Place, RoomPoint>;
  blocks: readonly RoomBlock[];
  /** Walkable floor, in the same order as a block. */
  floor: RoomBlock;
}
export interface Room<Place extends string> extends RoomConfig<Place> {
  canStand(point: RoomPoint): boolean;
  nearbyStation(point: RoomPoint): Place | null;
  nearExit(point: RoomPoint): boolean;
  moveInRoom(from: RoomPoint, dx: number, dy: number): RoomPoint;
  roomRoute(from: RoomPoint, destination: RoomPoint): RoomPoint[];
}

/** Shared house geometry: every interior walks, collides and routes the same way. */
export function createRoom<Place extends string>(config: RoomConfig<Place>): Room<Place> {
  const { start, stations, blocks, floor: [minX, minY, maxX, maxY] } = config;
  function canStand({ x, y }: RoomPoint): boolean {
    return x >= minX && x <= maxX && y >= minY && y <= maxY
      && !blocks.some(([left, top, right, bottom]) => x >= left && x <= right && y >= top && y <= bottom);
  }
  function nearbyStation(point: RoomPoint): Place | null {
    return (Object.keys(stations) as Place[]).find((key) =>
      Math.hypot(point.x - stations[key].x, point.y - stations[key].y) <= 20) ?? null;
  }
  function nearExit(point: RoomPoint): boolean { return Math.hypot(point.x - start.x, point.y - start.y) < 15; }
  /** Small substeps prevent tunnelling through furniture, even after a slow frame. */
  function moveInRoom(from: RoomPoint, dx: number, dy: number): RoomPoint {
    const point = { ...from };
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
    for (let i = 0; i < steps; i++) {
      const x = point.x + dx / steps, y = point.y + dy / steps;
      if (canStand({ x, y: point.y })) point.x = x;
      if (canStand({ x: point.x, y })) point.y = y;
    }
    return point;
  }
  /** Tap-to-walk uses a four-neighbour floor grid, including routes around furniture. */
  function roomRoute(from: RoomPoint, destination: RoomPoint): RoomPoint[] {
    const grid = 4;
    const points: RoomPoint[] = [];
    for (let y = minY; y <= maxY; y += grid) for (let x = minX; x <= maxX; x += grid) {
      if (canStand({ x, y })) points.push({ x, y });
    }
    const key = (p: RoomPoint) => `${p.x},${p.y}`;
    const tiles = new Map(points.map((p) => [key(p), p]));
    const nearest = (p: RoomPoint) => points.reduce((best, item) =>
      Math.hypot(item.x - p.x, item.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? item : best);
    const first = nearest(from), goal = nearest(destination);
    const queue = [first], previous = new Map<string, RoomPoint | null>([[key(first), null]]);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      if (key(current) === key(goal)) {
        const route: RoomPoint[] = [];
        let next: RoomPoint | null = current;
        while (next) { route.unshift(next); next = previous.get(key(next)) ?? null; }
        return route;
      }
      for (const [dx, dy] of [[grid, 0], [-grid, 0], [0, grid], [0, -grid]]) {
        const next = tiles.get(key({ x: current.x + dx, y: current.y + dy }));
        if (!next || previous.has(key(next))) continue;
        previous.set(key(next), current); queue.push(next);
      }
    }
    return [];
  }
  return { ...config, canStand, nearbyStation, nearExit, moveInRoom, roomRoute };
}
