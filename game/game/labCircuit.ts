export type LabGate =
  | "X"
  | "H"
  | "Z"
  | "RY"
  | "ROTATION"
  | "CX"
  | "ORACLE"
  | "D"
  | "PARITY";
export type RotationAxis = "X" | "Y" | "Z";
export const isRotation = (gate: LabGate) =>
  gate === "ROTATION" || gate === "RY";
export const rotationAxis = (op: LabOp): RotationAxis =>
  op.gate === "RY" ? "Y" : op.axis!;
export interface LabOp {
  gate: LabGate;
  wire?: number;
  control?: number;
  angle?: number;
  axis?: RotationAxis;
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
    if (["X", "H", "Z", "RY", "ROTATION"].includes(op.gate))
      return (
        wire(op.wire) &&
        (!isRotation(op.gate) ||
          (typeof op.angle === "number" &&
            Number.isFinite(op.angle) &&
            Math.abs(op.angle) <= 2 * Math.PI &&
            (op.gate === "RY" || ["X", "Y", "Z"].includes(op.axis!))))
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
export interface LabAmplitude {
  re: number;
  im: number;
}
export const labProbability = (a: LabAmplitude) => a.re ** 2 + a.im ** 2;
const scale = (a: LabAmplitude, k: number): LabAmplitude => ({
  re: a.re * k,
  im: a.im * k,
});
const add = (a: LabAmplitude, b: LabAmplitude): LabAmplitude => ({
  re: a.re + b.re,
  im: a.im + b.im,
});
export function amplitudeLabel(a: LabAmplitude): string {
  const clean = (v: number) => (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3);
  if (Math.abs(a.im) < 0.0005) return clean(a.re);
  return `${clean(a.re)} ${a.im < 0 ? "−" : "+"} ${clean(Math.abs(a.im))}i`;
}
/** Pure single-qubit Bloch vector: <X>, <Y>, <Z>. */
export function labBloch(a: LabAmplitude[]): {
  x: number;
  y: number;
  z: number;
} {
  if (a.length !== 2) return { x: 0, y: 0, z: 0 };
  return {
    x: 2 * (a[0].re * a[1].re + a[0].im * a[1].im),
    y: 2 * (a[0].re * a[1].im - a[0].im * a[1].re),
    z: labProbability(a[0]) - labProbability(a[1]),
  };
}
/** Complex ideal states, including the phases created by X and Z rotations. */
export function labTrace(recipe: LabRecipe): LabAmplitude[][] {
  const n = recipe.qubits,
    size = 2 ** n;
  let a: LabAmplitude[] = Array.from({ length: size }, (_, i) => ({
    re: i === parseInt(recipe.start, 2) ? 1 : 0,
    im: 0,
  }));
  const states = [a];
  const parity = (v: number) => {
    let p = 0;
    for (; v; v >>= 1) p ^= v & 1;
    return p;
  };
  for (const op of recipe.operations) {
    const bit = 1 << (n - 1 - (op.wire ?? 0));
    if (op.gate === "X") a = a.map((_, i) => a[i ^ bit]);
    else if (op.gate === "Z") a = a.map((v, i) => scale(v, i & bit ? -1 : 1));
    else if (op.gate === "H")
      a = a.map((v, i) =>
        scale(
          i & bit ? add(a[i ^ bit], scale(v, -1)) : add(v, a[i ^ bit]),
          Math.SQRT1_2,
        ),
      );
    else if (isRotation(op.gate)) {
      const c = Math.cos(op.angle! / 2),
        s = Math.sin(op.angle! / 2),
        axis = rotationAxis(op);
      a = a.map((v, i) => {
        const pair = a[i ^ bit];
        if (axis === "Y")
          return add(scale(v, c), scale(pair, i & bit ? s : -s));
        if (axis === "X")
          return { re: c * v.re + s * pair.im, im: c * v.im - s * pair.re };
        const phase = i & bit ? s : -s;
        return { re: c * v.re - phase * v.im, im: c * v.im + phase * v.re };
      });
    } else if (op.gate === "CX") {
      const control = 1 << (n - 1 - op.control!);
      a = a.map((_, i) => a[i & control ? i ^ bit : i]);
    } else if (op.gate === "ORACLE")
      a = a.map((v, i) => (i === parseInt(op.bits!, 2) ? scale(v, -1) : v));
    else if (op.gate === "D") {
      const mean = scale(a.reduce(add, { re: 0, im: 0 }), 1 / size);
      a = a.map((v) => add(scale(mean, 2), scale(v, -1)));
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
