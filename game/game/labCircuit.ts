export type LabGate = "X" | "H" | "Z" | "RY" | "CX" | "ORACLE" | "D" | "PARITY";
export interface LabOp {
  gate: LabGate;
  wire?: number;
  control?: number;
  angle?: number;
  bits?: string;
}
export interface LabRecipe {
  qubits: number;
  start: string;
  operations: LabOp[];
  shots: number;
}
export const starterRecipe = (): LabRecipe => ({
  qubits: 1,
  start: "0",
  operations: [{ gate: "H", wire: 0 }],
  shots: 256,
});
export function validRecipe(value: unknown): value is LabRecipe {
  if (!value || typeof value !== "object") return false;
  const r = value as LabRecipe;
  if (
    !Number.isInteger(r.qubits) ||
    r.qubits < 1 ||
    r.qubits > 4 ||
    typeof r.start !== "string" ||
    !new RegExp(`^[01]{${r.qubits}}$`).test(r.start) ||
    !Number.isInteger(r.shots) ||
    r.shots < 1 ||
    r.shots > 1024 ||
    !Array.isArray(r.operations) ||
    r.operations.length > 32
  )
    return false;
  const wire = (v: unknown) =>
    Number.isInteger(v) && (v as number) >= 0 && (v as number) < r.qubits;
  return r.operations.every((op) => {
    if (!op || typeof op !== "object") return false;
    if (["X", "H", "Z", "RY"].includes(op.gate))
      return (
        wire(op.wire) &&
        (op.gate !== "RY" ||
          (typeof op.angle === "number" &&
            Number.isFinite(op.angle) &&
            Math.abs(op.angle) <= 2 * Math.PI))
      );
    if (op.gate === "CX")
      return wire(op.wire) && wire(op.control) && op.wire !== op.control;
    if (op.gate === "D") return true;
    const size =
      op.gate === "ORACLE"
        ? r.qubits
        : op.gate === "PARITY" && r.qubits >= 2
          ? r.qubits - 1
          : 0;
    return (
      !!size &&
      typeof op.bits === "string" &&
      new RegExp(`^[01]{${size}}$`).test(op.bits)
    );
  });
}
export function labTrace(recipe: LabRecipe): number[][] {
  const n = recipe.qubits,
    size = 2 ** n;
  let a: number[] = Array.from({ length: size }, (_, i) =>
    i === parseInt(recipe.start, 2) ? 1 : 0,
  );
  const states = [a];
  const parity = (v: number) => {
    let p = 0;
    for (; v; v >>= 1) p ^= v & 1;
    return p;
  };
  for (const op of recipe.operations) {
    const bit = 1 << (n - 1 - (op.wire ?? 0));
    if (op.gate === "X") a = a.map((_, i) => a[i ^ bit]);
    else if (op.gate === "Z") a = a.map((v, i) => (i & bit ? -v : v));
    else if (op.gate === "H")
      a = a.map(
        (v, i) => Math.SQRT1_2 * (i & bit ? a[i ^ bit] - v : v + a[i ^ bit]),
      );
    else if (op.gate === "RY") {
      const c = Math.cos(op.angle! / 2),
        s = Math.sin(op.angle! / 2);
      a = a.map((v, i) =>
        i & bit ? c * v + s * a[i ^ bit] : c * v - s * a[i ^ bit],
      );
    } else if (op.gate === "CX") {
      const control = 1 << (n - 1 - op.control!);
      a = a.map((_, i) => a[i & control ? i ^ bit : i]);
    } else if (op.gate === "ORACLE")
      a = a.map((v, i) => (i === parseInt(op.bits!, 2) ? -v : v));
    else if (op.gate === "D") {
      const mean = a.reduce((s, v) => s + v, 0) / size;
      a = a.map((v) => 2 * mean - v);
    } else if (op.gate === "PARITY") {
      const mask = parseInt(op.bits!, 2);
      a = a.map((_, i) => a[parity((i >> 1) & mask) ? i ^ 1 : i]);
    }
    states.push(a);
  }
  return states;
}
export function algorithmRecipe(
  kind: "grover" | "kickback",
  bits: string,
  rounds = 1,
  shots = 256,
): LabRecipe {
  const qubits = kind === "grover" ? bits.length : bits.length + 1;
  const operations: LabOp[] = [];
  if (kind === "kickback") operations.push({ gate: "X", wire: qubits - 1 });
  for (let wire = 0; wire < qubits; wire++)
    operations.push({ gate: "H", wire });
  if (kind === "grover")
    for (let i = 0; i < rounds; i++)
      operations.push({ gate: "ORACLE", bits }, { gate: "D" });
  else {
    operations.push({ gate: "PARITY", bits });
    for (let wire = 0; wire < qubits - 1; wire++)
      operations.push({ gate: "H", wire });
  }
  return { qubits, start: "0".repeat(qubits), operations, shots };
}
