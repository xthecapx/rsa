/** Adding a lesson only needs a world entry and start/resume behavior. */
export const TOWN_LOCATIONS = {
  coinDoor: { at: { x: 8, y: 12 }, stand: { x: 8, y: 13 }, title: "Who Goes First?", prompt: "Enter the coin house", kind: "coin" },
  futureA: { at: { x: 8, y: 5 }, stand: { x: 8, y: 6 }, title: "A future adventure", prompt: "Inspect the closed door", kind: "closed" },
  futureB: { at: { x: 21, y: 5 }, stand: { x: 21, y: 6 }, title: "A future adventure", prompt: "Inspect the closed door", kind: "closed" },
  guide: { at: { x: 24, y: 28 }, stand: { x: 24, y: 29 }, title: "Town guide", prompt: "Talk to the town guide", kind: "guide" },
  sign: { at: { x: 24, y: 23 }, stand: { x: 24, y: 24 }, title: "Quantum Town", prompt: "Read the signpost", kind: "sign" },
} as const;
export type TownTarget = keyof typeof TOWN_LOCATIONS;
export type WorldFacing = "up" | "down" | "left" | "right";
export const TOWN_SPAWN = { x: 24, y: 32 };
export const CLIENT_POSITION = { x: 40, y: 10 };
export const TOWN_TREES = [
  { x: 2, y: 18 }, { x: 13, y: 18 }, { x: 17, y: 27 }, { x: 31, y: 25 },
  ...[39, 47, 55, 61].flatMap((x) => [21, 27, 33].map((y) => ({ x, y }))),
  ...[3, 11, 18, 30].map((x) => ({ x, y: 33 })),
];

export function townTargetAt(pos: { x: number; y: number }): TownTarget | null {
  return (Object.keys(TOWN_LOCATIONS) as TownTarget[]).find((key) => {
    const at = TOWN_LOCATIONS[key].at;
    return Math.abs(at.x - pos.x) + Math.abs(at.y - pos.y) <= 1;
  }) ?? null;
}
