import { LAB_ITEMS, itemAvailable } from "@/content/lab";
import type { MedalId } from "@/content/medals";
import {
  isRotation,
  rotationAxis,
  validRecipe,
  type LabGate,
  type LabOp,
  type LabOpChange,
  type LabRecipe,
} from "./labCircuit";

/** UI catalogue and equipment grants. RY is the persisted equipment ID. */
export const LAB_GATES: Record<
  LabGate,
  { title: string; equipment: readonly string[] }
> = {
  H: { title: "H", equipment: ["H", "grover", "kickback"] },
  X: { title: "X", equipment: ["X", "kickback"] },
  Z: { title: "Z", equipment: ["Z"] },
  RY: { title: "Rotation", equipment: ["RY"] },
  ROTATION: { title: "Rotation", equipment: ["RY"] },
  CX: { title: "CX", equipment: ["kickback"] },
  ORACLE: { title: "Oracle", equipment: ["grover"] },
  D: { title: "Diffuser", equipment: ["grover"] },
  PARITY: { title: "Parity oracle", equipment: ["kickback"] },
};
const PALETTE: LabGate[] = [
  "H",
  "X",
  "Z",
  "ROTATION",
  "CX",
  "ORACLE",
  "D",
  "PARITY",
];
export function labEquipment(
  installedIds: string[],
  earned: Partial<Record<MedalId, string>>,
) {
  const installed = (id: string) => {
    const item = LAB_ITEMS.find((i) => i.id === id);
    return !!item && installedIds.includes(id) && itemAvailable(item, earned);
  };
  const allowed = (gate: LabGate) =>
    Object.hasOwn(LAB_GATES, gate) && LAB_GATES[gate].equipment.some(installed);
  const multipleQubits = ["register", "grover", "kickback"].some(installed);
  return {
    installed,
    allowed,
    multipleQubits,
    available: PALETTE.filter(allowed),
    canRun(recipe: LabRecipe) {
      const starter =
        recipe.qubits === 1 &&
        recipe.operations.length <= 1 &&
        recipe.operations.every((op) => op.gate === "H" && op.wire === 0);
      return (
        validRecipe(recipe) &&
        (starter || recipe.operations.every((op) => allowed(op.gate))) &&
        (recipe.qubits === 1 || multipleQubits)
      );
    },
  };
}
export const operationLabel = (op: LabOp | undefined): string =>
  !op
    ? ""
    : isRotation(op.gate)
      ? `R(θ=${Number(((op.angle! * 180) / Math.PI).toFixed(1))}° · ${rotationAxis(op)})`
      : op.gate === "ORACLE"
        ? `O(${op.bits})`
        : op.gate === "PARITY"
          ? `P(${op.bits})`
          : op.gate;

export function newLabOperation(
  gate: LabGate,
  wire: number,
  qubits: number,
): LabOp {
  switch (gate) {
    case "ROTATION":
    case "RY":
      return { gate, wire, angle: Math.PI / 2, axis: "Y" };
    case "CX":
      return { gate, wire, control: (wire + 1) % qubits };
    case "ORACLE":
      return { gate, wire, bits: "1".repeat(qubits) };
    case "PARITY":
      return { gate, wire, bits: "1".repeat(qubits - 1) };
    case "D":
      return { gate, wire };
    default:
      return { gate, wire };
  }
}
/** Immutable transitions return null for invalid drops/edits, without touching a save. */
export function placeLabOperation(
  recipe: LabRecipe,
  target: string,
  source: string,
  allowed: (gate: LabGate) => boolean,
): { recipe: LabRecipe; selected: number } | null {
  if (!/^\d+:\d+$/.test(target)) return null;
  const [wire, position] = target.split(":").map(Number);
  if (wire >= recipe.qubits || position > recipe.operations.length) return null;
  let destination = position;
  const operations = recipe.operations.map((op) => ({ ...op }));
  let next: LabOp;
  if (source.startsWith("op-")) {
    if (!/^op-\d+-\d+$/.test(source)) return null;
    const from = Number(source.split("-")[1]);
    next = operations.splice(from, 1)[0];
    if (!next) return null;
    if (from < position) destination--;
  } else {
    if (!Object.hasOwn(LAB_GATES, source) || !allowed(source as LabGate))
      return null;
    next = newLabOperation(source as LabGate, wire, recipe.qubits);
  }
  if (["H", "X", "Z", "RY", "ROTATION", "CX"].includes(next.gate)) {
    next.wire = wire;
    if (next.gate === "CX" && next.control === wire)
      next.control = (wire + 1) % recipe.qubits;
  }
  operations.splice(destination, 0, next);
  const result = { ...recipe, operations };
  return validRecipe(result) ? { recipe: result, selected: destination } : null;
}
export function moveLabOperation(
  recipe: LabRecipe,
  index: number,
  direction: -1 | 1,
): LabRecipe | null {
  const destination = index + direction;
  if (!recipe.operations[index] || !recipe.operations[destination]) return null;
  const operations = [...recipe.operations];
  [operations[index], operations[destination]] = [
    operations[destination],
    operations[index],
  ];
  return { ...recipe, operations };
}
export function editLabOperation(
  recipe: LabRecipe,
  index: number,
  change: LabOpChange,
): LabRecipe | null {
  if (!recipe.operations[index]) return null;
  const next = {
    ...recipe,
    operations: recipe.operations.map((op, i) =>
      i === index ? { ...op, ...change } : op,
    ),
  };
  return validRecipe(next) ? next : null;
}
export function copyRecipe(recipe: LabRecipe): LabRecipe {
  return { ...recipe, operations: recipe.operations.map((op) => ({ ...op })) };
}
