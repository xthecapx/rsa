/** Adding a lesson only needs a world entry and start/resume behavior. */
export const TOWN_LOCATIONS = {
  coinDoor: { at: { x: 8, y: 12 }, stand: { x: 8, y: 13 }, title: "Who Goes First?", prompt: "Enter the coin house", kind: "coin" },
  groverDoor: { at: { x: 8, y: 5 }, stand: { x: 8, y: 6 }, title: "Echo Chamber", prompt: "Enter Thecap’s workshop", kind: "grover" },
  vaultDoor: { at: { x: 21, y: 5 }, stand: { x: 21, y: 6 }, title: "Operation Ghost Key", prompt: "Knock on Doña Ofelia’s door", kind: "vault" },
  guide: { at: { x: 24, y: 28 }, stand: { x: 24, y: 29 }, title: "Professor Thecap", prompt: "Talk to Professor Thecap", kind: "guide" },
  sign: { at: { x: 24, y: 23 }, stand: { x: 24, y: 24 }, title: "Quantum Town", prompt: "Read the signpost", kind: "sign" },
  southPath: { at: { x: 24, y: 34 }, stand: { x: 24, y: 34 }, title: "South road", prompt: "Walk south to Coin Town", kind: "path" },
} as const;
export type TownTarget = keyof typeof TOWN_LOCATIONS;
export type WorldFacing = "up" | "down" | "left" | "right";
export const TOWN_SPAWN = { x: 24, y: 32 };
export const CLIENT_POSITION = { x: 40, y: 10 };
export type TreeKind = "tall" | "orange" | "dark" | "round" | "bush";
/** Trees are map overlay tiles (stamped by engine/maps/townMap.ts); a tall tree also blocks the tile above its trunk. */
export const TOWN_TREES: { x: number; y: number; kind: TreeKind }[] = [
  // Around the houses and the coin-house courtyard.
  { x: 14, y: 4, kind: "tall" }, { x: 1, y: 7, kind: "dark" }, { x: 2, y: 18, kind: "tall" }, { x: 13, y: 18, kind: "orange" },
  { x: 2, y: 24, kind: "round" }, { x: 2, y: 30, kind: "tall" }, { x: 13, y: 24, kind: "bush" }, { x: 17, y: 27, kind: "dark" },
  // Between Ale's and Brayan's buildings, north of the wire.
  { x: 42, y: 5, kind: "tall" }, { x: 47, y: 5, kind: "orange" }, { x: 44, y: 3, kind: "dark" },
  // Plaza edge and the southern lawn.
  { x: 31, y: 25, kind: "tall" }, { x: 3, y: 33, kind: "tall" }, { x: 11, y: 33, kind: "orange" }, { x: 18, y: 33, kind: "tall" }, { x: 30, y: 33, kind: "dark" },
  // The park: a ring of trees outside the loop, low planting inside it.
  { x: 34, y: 27, kind: "tall" }, { x: 34, y: 33, kind: "orange" }, { x: 40, y: 33, kind: "tall" }, { x: 48, y: 33, kind: "dark" }, { x: 56, y: 33, kind: "tall" },
  { x: 61, y: 21, kind: "tall" }, { x: 61, y: 24, kind: "orange" }, { x: 58, y: 26, kind: "dark" }, { x: 61, y: 29, kind: "tall" }, { x: 58, y: 32, kind: "orange" },
  { x: 39, y: 25, kind: "round" }, { x: 51, y: 25, kind: "round" }, { x: 39, y: 29, kind: "bush" }, { x: 51, y: 29, kind: "bush" },
  { x: 42, y: 24, kind: "bush" }, { x: 48, y: 24, kind: "bush" }, { x: 42, y: 29, kind: "round" }, { x: 48, y: 29, kind: "round" },
  // Centre of the park loop.
  { x: 45, y: 26, kind: "round" }, { x: 44, y: 25, kind: "bush" }, { x: 46, y: 25, kind: "bush" }, { x: 44, y: 27, kind: "bush" }, { x: 46, y: 27, kind: "bush" },
  // Garden beds behind the fence.
  { x: 35, y: 20, kind: "bush" }, { x: 38, y: 20, kind: "round" }, { x: 41, y: 20, kind: "bush" },
];

export function townTargetAt(pos: { x: number; y: number }): TownTarget | null {
  return (Object.keys(TOWN_LOCATIONS) as TownTarget[]).find((key) => {
    const at = TOWN_LOCATIONS[key].at;
    return Math.abs(at.x - pos.x) + Math.abs(at.y - pos.y) <= 1;
  }) ?? null;
}
