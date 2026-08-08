import raw from "./street.json";

export interface TileEntry {
  tile: number;
  solid: boolean;
}

export type Landmark = "ale" | "brayan" | "tap" | "car";

export interface GridPos {
  x: number;
  y: number;
}

const legend = raw.legend as Record<string, TileEntry>;
const overlayLegend = raw.overlayLegend as Record<string, TileEntry | null>;

export const street = {
  width: raw.width,
  height: raw.height,
  tileSize: raw.tileSize,
  sheetColumns: raw.sheetColumns,
  rows: raw.rows,
  overlay: raw.overlay,
  legend,
  overlayLegend,
};

interface LandmarkSpec {
  /** Top-left tile of the landmark. */
  at: GridPos;
  /** How many tiles it covers, for working out what counts as "next to it". */
  size: { w: number; h: number };
  /** Where `walkTo` parks the player. */
  stand: GridPos;
  label: string;
}

/** Paint / facing for the parked traffic lining the kerbs. */
export type CarPaint = "slate" | "copper" | "navy" | "rose" | "moss" | "smoke";
export type CarFacing = "east" | "west";

export interface ParkingBay {
  at: GridPos;
  facing: CarFacing;
}

export interface ParkedCarSpec extends ParkingBay {
  paint: CarPaint;
  /** The client's car — also wired as LANDMARKS.car. */
  client?: boolean;
}

/**
 * Fixed kerb bays. Which bay holds the client (and which paint each car
 * wears) is rolled per act / reload so the street has to be searched again.
 * South kerb = y:9. North kerb = y:6.
 */
export const PARKING_BAYS: ParkingBay[] = [
  { at: { x: 4, y: 9 }, facing: "east" },
  { at: { x: 14, y: 9 }, facing: "west" },
  { at: { x: 24, y: 9 }, facing: "east" },
  { at: { x: 31, y: 9 }, facing: "west" },
  { at: { x: 2, y: 6 }, facing: "east" },
  { at: { x: 10, y: 6 }, facing: "west" },
  { at: { x: 26, y: 6 }, facing: "east" },
  { at: { x: 33, y: 6 }, facing: "west" },
];

/** Enough paints for every bay; a couple of colours repeat across eight cars. */
const CAR_PAINTS: CarPaint[] = [
  "slate",
  "copper",
  "navy",
  "rose",
  "moss",
  "smoke",
  "copper",
  "navy",
];

function standBeside(at: GridPos): GridPos {
  // North kerb cars sit on y:6-7; stand on the roadway just south of them.
  // South kerb cars sit on y:9-10; stand on the roadway just north.
  return at.y <= 7 ? { x: at.x, y: at.y + 2 } : { x: at.x, y: at.y - 1 };
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export interface ClientCarAssignment {
  clientIndex: number;
  paints: CarPaint[];
}

/**
 * Pick a random bay as the client's car and reshuffle paints so colour is not
 * a tell. Updates LANDMARKS.car so walk/interact targets follow the new bay.
 */
export function assignClientCar(): ClientCarAssignment {
  const paints = shuffleInPlace([...CAR_PAINTS]);
  const clientIndex = Math.floor(Math.random() * PARKING_BAYS.length);
  const bay = PARKING_BAYS[clientIndex];
  LANDMARKS.car.at = { ...bay.at };
  LANDMARKS.car.stand = standBeside(bay.at);
  return { clientIndex, paints };
}

/** Where the cast and the props live, in tile coordinates. */
export const LANDMARKS: Record<Landmark, LandmarkSpec> = {
  ale: { at: { x: 6, y: 5 }, size: { w: 1, h: 1 }, stand: { x: 6, y: 6 }, label: "Ale" },
  brayan: {
    at: { x: 30, y: 5 },
    size: { w: 1, h: 1 },
    stand: { x: 30, y: 6 },
    label: "Brayan",
  },
  tap: {
    at: { x: 19, y: 5 },
    size: { w: 1, h: 1 },
    stand: { x: 19, y: 6 },
    label: "Junction box",
  },
  car: {
    // Placeholder; assignClientCar() overwrites this before play begins.
    at: { ...PARKING_BAYS[0].at },
    size: { w: 2, h: 2 },
    stand: standBeside(PARKING_BAYS[0].at),
    label: "Your client's car",
  },
};

/** Middle of the road — centred in the camera, easy to spot on a phone. */
export const PLAYER_SPAWN: GridPos = { x: 19, y: 8 };

/** Screen-space centre of a tile, in world pixels. */
export function tileCenter(pos: GridPos): { x: number; y: number } {
  const t = raw.tileSize;
  return { x: pos.x * t + t / 2, y: pos.y * t + t / 2 };
}

/** Centre of a landmark's whole footprint, in world pixels. */
export function landmarkCenter(key: Landmark): { x: number; y: number } {
  const { at, size } = LANDMARKS[key];
  const t = raw.tileSize;
  return {
    x: at.x * t + (size.w * t) / 2,
    y: at.y * t + (size.h * t) / 2,
  };
}

/**
 * Solidity grid combining both layers. Tiles outside the map count as solid so
 * the player cannot walk off the edge.
 */
export function buildSolidGrid(): boolean[][] {
  const grid: boolean[][] = [];
  for (let y = 0; y < raw.height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < raw.width; x++) {
      const base = legend[raw.rows[y][x]];
      const over = overlayLegend[raw.overlay[y][x]];
      row.push(Boolean(base?.solid) || Boolean(over?.solid));
    }
    grid.push(row);
  }
  // Parked cars and the cast are actors rather than tiles, so block them by hand.
  for (const bay of PARKING_BAYS) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        if (grid[bay.at.y + dy]?.[bay.at.x + dx] !== undefined) {
          grid[bay.at.y + dy][bay.at.x + dx] = true;
        }
      }
    }
  }
  for (const key of ["ale", "brayan"] as const) {
    const { at, size } = LANDMARKS[key];
    for (let dy = 0; dy < size.h; dy++) {
      for (let dx = 0; dx < size.w; dx++) {
        if (grid[at.y + dy]?.[at.x + dx] !== undefined) {
          grid[at.y + dy][at.x + dx] = true;
        }
      }
    }
  }
  return grid;
}

export function isWalkable(grid: boolean[][], pos: GridPos): boolean {
  if (pos.x < 0 || pos.y < 0 || pos.x >= raw.width || pos.y >= raw.height) return false;
  return !grid[pos.y][pos.x];
}

/**
 * The landmark the player is standing next to, if any. Anywhere orthogonally
 * touching the landmark's footprint counts, so walking one tile too far does
 * not silently break the interaction prompt.
 */
export function landmarkAt(pos: GridPos): Landmark | null {
  for (const key of Object.keys(LANDMARKS) as Landmark[]) {
    const { at, size } = LANDMARKS[key];
    const withinColumns = pos.x >= at.x - 1 && pos.x <= at.x + size.w;
    const withinRows = pos.y >= at.y - 1 && pos.y <= at.y + size.h;
    const insideFootprint =
      pos.x >= at.x && pos.x < at.x + size.w && pos.y >= at.y && pos.y < at.y + size.h;
    if (withinColumns && withinRows && !insideFootprint) return key;
  }
  return null;
}

/**
 * Breadth-first route between two tiles. The street is small and mostly open,
 * so an unweighted search is more than enough and always finds the shortest
 * path. Returns the tiles to step through, excluding the starting tile.
 */
export function findPath(
  grid: boolean[][],
  from: GridPos,
  to: GridPos,
): GridPos[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  if (!isWalkable(grid, to)) return null;

  const key = (p: GridPos) => p.y * raw.width + p.x;
  const cameFrom = new Map<number, GridPos>();
  const seen = new Set<number>([key(from)]);
  const queue: GridPos[] = [from];
  const steps = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  while (queue.length) {
    const current = queue.shift() as GridPos;
    for (const step of steps) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const id = key(next);
      if (seen.has(id) || !isWalkable(grid, next)) continue;
      seen.add(id);
      cameFrom.set(id, current);
      if (next.x === to.x && next.y === to.y) {
        const path: GridPos[] = [];
        let cursor: GridPos | undefined = next;
        while (cursor && !(cursor.x === from.x && cursor.y === from.y)) {
          path.unshift(cursor);
          cursor = cameFrom.get(key(cursor));
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}
