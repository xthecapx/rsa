import type { MedalId } from "./medals";
export interface LabItem {
  id: string;
  title: string;
  glyph: string;
  tier: number;
  module?: boolean;
  w: number;
  h: number;
}
export const LAB_ITEMS: LabItem[] = [
  { id: "laptop", title: "Quantum laptop", glyph: "▣", tier: 0, w: 1, h: 1 },
  { id: "desk", title: "Lab desk", glyph: "▰", tier: 0, w: 2, h: 1 },
  { id: "lamp", title: "Cave lamp", glyph: "☀", tier: 0, w: 1, h: 1 },
  { id: "storage", title: "Equipment chest", glyph: "▤", tier: 0, w: 1, h: 1 },
  { id: "stool", title: "Lab stool", glyph: "◉", tier: 0, w: 1, h: 1 },
  { id: "plant", title: "Cave garden", glyph: "♣", tier: 1, w: 1, h: 1 },
  { id: "bloch", title: "Bloch display", glyph: "◎", tier: 1, w: 1, h: 1 },
  ...["X", "H", "Z", "RY"].map((id) => ({
    id,
    title: id === "RY" ? "Rotation module" : `${id} gate module`,
    glyph: id === "RY" ? "R(θ)" : id,
    tier: 1,
    module: true,
    w: 1,
    h: 1,
  })),
  {
    id: "register",
    title: "Register kit",
    glyph: "≋",
    tier: 2,
    module: true,
    w: 1,
    h: 1,
  },
  {
    id: "grover",
    title: "Grover algorithm box",
    glyph: "G",
    tier: 2,
    module: true,
    w: 1,
    h: 1,
  },
  {
    id: "kickback",
    title: "Phase-kickback box",
    glyph: "±",
    tier: 3,
    module: true,
    w: 1,
    h: 1,
  },
  {
    id: "crypto",
    title: "Crypto toolkit",
    glyph: "⌁",
    tier: 4,
    module: true,
    w: 1,
    h: 1,
  },
  {
    id: "period",
    title: "Period explorer box",
    glyph: "r",
    tier: 4,
    module: true,
    w: 1,
    h: 1,
  },
];
export function labTier(earned: Partial<Record<MedalId, string>>): number {
  if (
    earned["cipher-town"] ||
    ["codebook", "key-ring", "prime-cutter", "period-lens"].every(
      (id) => earned[id as MedalId],
    )
  )
    return 4;
  if (earned["ghost-key"] || earned["hollow-town"]) return 3;
  if (earned.amplifier || earned["foundry-town"]) return 2;
  return earned["quantum-coin"] || earned["coin-town"] ? 1 : 0;
}
// Individual entitlements follow their medal, even for players who skip ahead.
export function itemAvailable(
  item: LabItem,
  earned: Partial<Record<MedalId, string>>,
): boolean {
  const tier = item.tier;
  if (!tier) return true;
  if (tier === 1) return !!(earned["quantum-coin"] || earned["coin-town"]);
  if (tier === 2) return !!(earned.amplifier || earned["foundry-town"]);
  if (tier === 3) return !!(earned["ghost-key"] || earned["hollow-town"]);
  return (
    !!earned["cipher-town"] ||
    ["codebook", "key-ring", "prime-cutter", "period-lens"].every(
      (id) => earned[id as MedalId],
    )
  );
}
