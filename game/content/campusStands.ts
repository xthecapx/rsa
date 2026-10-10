import {
  CAMPUS_EXHIBITS,
  CAMPUS_FESTIVAL,
  type CampusActivityId,
} from "./campus";

/** Furniture footprints are permanent: finishing an exhibit never changes a route. */
const FURNITURE = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -2, y: -2 },
  { x: -2, y: -1 },
  { x: 2, y: -2 },
  { x: 2, y: -1 },
] as const;
const COLORS = [
  "#efad63",
  "#9c91db",
  "#7ab978",
  "#69c9cb",
  "#829dd8",
  "#e895ae",
  "#a3c69b",
  "#d5b865",
] as const;

export interface CampusStandSpec {
  id: CampusActivityId;
  at: { x: number; y: number };
  color: string;
  number: number;
}

export const CAMPUS_STANDS: CampusStandSpec[] = [
  ...CAMPUS_EXHIBITS.map((e, i) => ({
    id: e.id,
    at: e.at,
    color: COLORS[i],
    number: i + 1,
  })),
  { id: "festival", at: CAMPUS_FESTIVAL.at, color: "#e8be68", number: 9 },
];

export function campusFurniture(at: CampusStandSpec["at"]) {
  return FURNITURE.map((offset) => ({
    x: at.x + offset.x,
    y: at.y + offset.y,
  }));
}
export const CAMPUS_FURNITURE = CAMPUS_STANDS.flatMap(({ at }) =>
  campusFurniture(at),
);
