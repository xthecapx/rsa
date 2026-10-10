/** One passage per outdoor town; all lead to the same personal lab. */
export const LAB_ENTRANCES = {
  coinTown: {
    at: { x: 36, y: 25 },
    stand: { x: 36, y: 26 },
    facing: "down",
    title: "Coin Town",
    hint: "Look for disturbed sand along the southeast edge of town.",
  },
  foundry: {
    at: { x: 25, y: 9 },
    stand: { x: 25, y: 10 },
    facing: "down",
    title: "Foundry Town",
    hint: "Loose gravel beside the workshop yard hides a passage.",
  },
  hollow: {
    at: { x: 12, y: 10 },
    stand: { x: 12, y: 11 },
    facing: "down",
    title: "Hollow Town",
    hint: "Look for loose stones outside the cemetery’s west fence.",
  },
  cipher: {
    at: { x: 19, y: 29 },
    stand: { x: 19, y: 30 },
    facing: "down",
    title: "Cipher Town",
    hint: "A dusty hatch hides near the southern district’s west edge.",
  },
  town: {
    at: { x: 57, y: 28 },
    stand: { x: 57, y: 29 },
    facing: "down",
    title: "Quantum Town",
    hint: "Disturbed sand near the park’s east edge hides a passage.",
  },
} as const;
export type LabTown = keyof typeof LAB_ENTRANCES;
export type LabDiscoveries = Partial<Record<LabTown, boolean>>;
export const LAB_ENTRANCE_ID = "labDoor";
export const LAB_REVEAL =
  "There’s a passage under the sand. It leads to your quantum lab. Every town’s passage reaches this same room.";
export function isLabTown(value: unknown): value is LabTown {
  return typeof value === "string" && Object.hasOwn(LAB_ENTRANCES, value);
}
export function cleanLabDiscoveries(value: unknown): LabDiscoveries {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.keys(LAB_ENTRANCES)
      .filter((id) => (value as Record<string, unknown>)[id] === true)
      .map((id) => [id, true]),
  );
}
