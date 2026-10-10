import type { CampusActivityId } from "@/content/campus";
import type { LabRecipe, RotationAxis } from "./labCircuit";
export type CampusGate = "X" | "H" | "Z";
export interface CampusSettings {
  angle: number;
  phase: number;
  axis: RotationAxis;
  inverse: boolean;
  gate: CampusGate;
  sequence: CampusGate[];
  order: string[];
  minus: boolean;
  analyzer: boolean;
  pair: "independent" | "bell" | "envelopes";
  basis: "Z" | "X";
  disturbance: number;
  shots: number;
}
export const campusDefaults = (): CampusSettings => ({
  angle: Math.PI / 2,
  phase: 0,
  axis: "Y",
  inverse: false,
  gate: "H",
  sequence: [],
  order: ["Measure", "Prepare", "Control"],
  minus: false,
  analyzer: false,
  pair: "independent",
  basis: "Z",
  disturbance: 0,
  shots: 256,
});
export function cleanCampusSettings(raw: unknown): CampusSettings {
  const base = campusDefaults();
  if (!raw || typeof raw !== "object") return base;
  const v = raw as CampusSettings;
  const finite = (n: number, lo: number, hi: number, fallback: number) =>
    Number.isFinite(n) && n >= lo && n <= hi ? n : fallback;
  return {
    angle: finite(v.angle, -2 * Math.PI, 2 * Math.PI, base.angle),
    phase: finite(v.phase, -2 * Math.PI, 2 * Math.PI, 0),
    axis: ["X", "Y", "Z"].includes(v.axis) ? v.axis : "Y",
    inverse: v.inverse === true,
    gate: ["X", "H", "Z"].includes(v.gate) ? v.gate : "H",
    sequence: Array.isArray(v.sequence)
      ? v.sequence.filter((g) => ["X", "H", "Z"].includes(g)).slice(0, 6)
      : [],
    order:
      Array.isArray(v.order) &&
      v.order.length === 3 &&
      new Set(v.order).size === 3 &&
      v.order.every((x) => ["Prepare", "Control", "Measure"].includes(x))
        ? v.order
        : base.order,
    minus: v.minus === true,
    analyzer: v.analyzer === true,
    pair: ["independent", "bell", "envelopes"].includes(v.pair)
      ? v.pair
      : "independent",
    basis: v.basis === "X" ? "X" : "Z",
    disturbance: finite(v.disturbance, 0, 1, 0),
    shots: [1, 16, 256, 1024].includes(v.shots) ? v.shots : 256,
  };
}
export type CampusRequest =
  | { mode: "circuit"; recipe: LabRecipe }
  | { mode: "dephasing"; disturbance: number; basis: "X" | "Z"; shots: number }
  | {
      mode: "correlation";
      pair: CampusSettings["pair"];
      basis: "X" | "Z";
      shots: number;
    };
export function campusRequest(
  id: CampusActivityId,
  s: CampusSettings,
): CampusRequest {
  if (id === "quiet")
    return {
      mode: "dephasing",
      disturbance: s.disturbance,
      basis: s.analyzer ? "X" : "Z",
      shots: s.shots,
    };
  if (id === "observatory")
    return {
      mode: "correlation",
      pair: s.pair,
      basis: s.basis,
      shots: s.shots,
    };
  const recipe: LabRecipe = {
    qubits: 1,
    start: "0",
    operations: [],
    shots: s.shots,
  };
  if (id === "delivery" || id === "festival")
    recipe.operations = s.sequence.map((gate) => ({ gate, wire: 0 }));
  else if (id === "passports")
    recipe.operations = [
      { gate: "ROTATION", wire: 0, axis: "Y", angle: s.angle },
      { gate: "ROTATION", wire: 0, axis: "Z", angle: s.phase },
    ];
  else if (id === "rotations")
    recipe.operations = [
      { gate: "ROTATION", wire: 0, axis: s.axis, angle: s.angle },
      ...(s.inverse
        ? [
            {
              gate: "ROTATION" as const,
              wire: 0,
              axis: s.axis,
              angle: -s.angle,
            },
          ]
        : []),
    ];
  else if (id === "qubit") recipe.operations = [{ gate: s.gate, wire: 0 }];
  else {
    recipe.operations = [{ gate: "H", wire: 0 }];
    if (s.minus) recipe.operations.push({ gate: "Z", wire: 0 });
    if (s.analyzer) recipe.operations.push({ gate: "H", wire: 0 });
  }
  return { mode: "circuit", recipe };
}
/** Evidence records successful user-triggered executions, never estimated counts. */
export function campusEvidence(
  id: CampusActivityId,
  s: CampusSettings,
): string {
  if (id === "fountain") return `${s.minus}:${s.analyzer}`;
  if (id === "observatory") return `${s.pair}:${s.basis}`;
  if (id === "quiet") return `${s.disturbance}:${s.analyzer}`;
  if (id === "arcade")
    return s.shots === 1 ? "single" : s.shots >= 256 ? "batch" : "small";
  if (id === "rotations")
    return Math.abs(s.angle) > 0.01 ? `rotation:${s.inverse}` : "zero";
  if (id === "passports")
    return Math.abs(s.angle - Math.PI / 2) < 0.01 && Math.abs(s.phase) < 0.01
      ? "passport"
      : "other";
  if (id === "delivery")
    return s.sequence.join() === "X,H"
      ? "delivery"
      : s.sequence.join() === "H,X"
        ? "reversed"
        : "other";
  if (id === "qubit")
    return s.order.join() === "Prepare,Control,Measure"
      ? `prepared:${s.gate}`
      : "other";
  return s.sequence.join() === "H,H" ? "festival" : "other";
}
export const CAMPUS_EVIDENCE: Record<CampusActivityId, string[]> = {
  qubit: ["prepared:X", "prepared:H"],
  passports: ["passport"],
  delivery: ["delivery", "reversed"],
  fountain: ["false:false", "true:false", "false:true", "true:true"],
  observatory: [
    "independent:Z",
    "bell:Z",
    "bell:X",
    "envelopes:Z",
    "envelopes:X",
  ],
  arcade: ["single", "batch"],
  quiet: ["0:true", "1:true", "1:false"],
  rotations: ["rotation:false", "rotation:true"],
  festival: ["repair0", "repair1", "repair2"],
};
export function campusReady(
  id: CampusActivityId,
  evidence: readonly string[],
  correct: boolean,
): boolean {
  return correct && CAMPUS_EVIDENCE[id].every((key) => evidence.includes(key));
}
