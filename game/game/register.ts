/**
 * Small-register math for the Foundry Town benches: two or three qubits, real
 * amplitudes, and only the pieces Grover's search is built from. Basis states
 * are written with qubit 1 on the left, so "10" means qubit 1 is |1⟩.
 */
export type RegOp = "H" | "X1" | "X2" | "X3" | `oracle:${string}` | "D";
/** What a bench tray offers: "X" is placed on one wire, which makes it X1, X2 or X3. */
export type RegPiece = "X" | Exclude<RegOp, "X1" | "X2" | "X3">;
export type Register = number[];

const EPS = 1e-9;
const clean = (value: number) => (Math.abs(value) < EPS ? 0 : value);

export const basisStates = (qubits: number) => Array.from({ length: 2 ** qubits }, (_, i) => i.toString(2).padStart(qubits, "0"));

/** A basis state, or "even" for the spread that one H box makes from all zeros. */
export function startRegister(qubits: number, start: string): Register {
  const size = 2 ** qubits;
  if (start === "even") return Array(size).fill(1 / Math.sqrt(size));
  return Array.from({ length: size }, (_, i) => (i === parseInt(start, 2) ? 1 : 0));
}

const popcount = (value: number) => { let count = 0; for (let v = value; v; v >>= 1) count += v & 1; return count; };

export function applyReg(amps: Register, op: RegOp): Register {
  const size = amps.length, qubits = Math.log2(size);
  if (op === "H") {
    const scale = 1 / Math.sqrt(size);
    return amps.map((_, y) => clean(scale * amps.reduce((sum, a, x) => sum + (popcount(x & y) % 2 ? -a : a), 0)));
  }
  if (op === "D") {
    const mean = amps.reduce((sum, a) => sum + a, 0) / size;
    return amps.map((a) => clean(2 * mean - a));
  }
  if (op.startsWith("oracle:")) {
    const marked = parseInt(op.slice(7), 2);
    return amps.map((a, i) => (i === marked ? clean(-a) : a));
  }
  const bit = 1 << (qubits - Number(op.slice(1)));
  return amps.map((_, i) => amps[i ^ bit]);
}

/** The register after each piece; the first entry is the start. */
export function traceReg(start: Register, ops: RegOp[]): Register[] {
  const states = [start];
  for (const op of ops) states.push(applyReg(states[states.length - 1], op));
  return states;
}

export const probsReg = (amps: Register) => amps.map((a) => clean(a * a));

export type RegTarget =
  | { basis: string }
  /** Exact amplitudes, up to a global sign. */
  | { amplitudes: number[] }
  | { marked: string; atLeast: number };

/** Equal up to a global sign, which no measurement can detect. */
export function sameRegister(p: Register, q: Register): boolean {
  const close = (s: number) => p.every((a, i) => Math.abs(a - s * q[i]) < 1e-6);
  return close(1) || close(-1);
}

export function meetsTarget(amps: Register, target: RegTarget): boolean {
  if ("basis" in target) return Math.abs(Math.abs(amps[parseInt(target.basis, 2)]) - 1) < 1e-6;
  if ("amplitudes" in target) return sameRegister(amps, target.amplitudes);
  return probsReg(amps)[parseInt(target.marked, 2)] >= target.atLeast - 1e-9;
}

export function solvesReg(step: { qubits: number; start: string; target: RegTarget }, ops: RegOp[]): boolean {
  return meetsTarget(traceReg(startRegister(step.qubits, step.start), ops).at(-1)!, step.target);
}

/** Probability of reading the marked state after `rounds` Oracle + Diffuser rounds. */
export function groverOdds(qubits: number, marked: string, rounds: number): number {
  const ops: RegOp[] = ["H"];
  for (let i = 0; i < rounds; i++) ops.push(`oracle:${marked}`, "D");
  return probsReg(traceReg(startRegister(qubits, "0".repeat(qubits)), ops).at(-1)!)[parseInt(marked, 2)];
}
export function peakRounds(qubits: number, marked: string, max = 5): number {
  let best = 0;
  for (let k = 1; k <= max; k++) if (groverOdds(qubits, marked, k) > groverOdds(qubits, marked, best) + 1e-9) best = k;
  return best;
}

const COEFFICIENTS: [number, string][] = [[1, "1"], [0.5, "½"], [Math.SQRT1_2, "1/√2"], [1 / Math.sqrt(8), "1/√8"], [0.25, "¼"]];
const coefficient = (value: number) => COEFFICIENTS.find(([v]) => Math.abs(v - value) < 1e-6)?.[1] ?? value.toFixed(2);

/** One amplitude as a signed exact value, e.g. "+½", "−1/√8" or "0". */
export function amplitudeText(value: number): string {
  if (Math.abs(value) < 1e-6) return "0";
  return `${value < 0 ? "−" : "+"}${coefficient(Math.abs(value))}`;
}

/** Written in the basis, e.g. "½(|00⟩ + |01⟩ + |10⟩ − |11⟩)" or "−|10⟩". */
export function formatReg(amps: Register): string {
  const qubits = Math.log2(amps.length);
  const labels = basisStates(qubits);
  const terms = amps.map((a, i) => ({ a, ket: `|${labels[i]}⟩` })).filter(({ a }) => Math.abs(a) > 1e-6);
  if (!terms.length) return "0";
  if (terms.length === 1) return `${terms[0].a < 0 ? "−" : ""}${Math.abs(Math.abs(terms[0].a) - 1) < 1e-6 ? "" : coefficient(Math.abs(terms[0].a))}${terms[0].ket}`;
  const size = Math.abs(terms[0].a);
  if (terms.every(({ a }) => Math.abs(Math.abs(a) - size) < 1e-6)) {
    const lead = terms[0].a < 0 ? -1 : 1;
    const inner = terms.map(({ a, ket }, i) => `${i === 0 ? "" : Math.sign(a) === lead ? " + " : " − "}${ket}`).join("");
    return `${lead < 0 ? "−" : ""}${coefficient(size)}(${inner})`;
  }
  return terms.map(({ a, ket }, i) => `${i === 0 ? (a < 0 ? "−" : "") : a < 0 ? " − " : " + "}${coefficient(Math.abs(a))}${ket}`).join("");
}
