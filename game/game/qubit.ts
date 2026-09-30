/**
 * One-qubit state math for the Coin Town benches. X, Z and H keep every
 * amplitude real and in {0, ±1/√2, ±1}, so a state is two numbers and every
 * result can be written exactly as a ket.
 */
export type Gate = "X" | "Z" | "H";
export type NamedState = "0" | "1" | "+" | "-";
export interface Qubit { a: number; b: number }

const R = Math.SQRT1_2;
export const STATES: Record<NamedState, Qubit> = {
  "0": { a: 1, b: 0 }, "1": { a: 0, b: 1 }, "+": { a: R, b: R }, "-": { a: R, b: -R },
};
export const KET: Record<NamedState, string> = { "0": "|0⟩", "1": "|1⟩", "+": "|+⟩", "-": "|−⟩" };

const EPS = 1e-9;
const clean = (value: number) => (Math.abs(value) < EPS ? 0 : value);

export function apply(q: Qubit, gate: Gate): Qubit {
  if (gate === "X") return { a: q.b, b: q.a };
  if (gate === "Z") return { a: q.a, b: clean(-q.b) };
  return { a: clean(R * (q.a + q.b)), b: clean(R * (q.a - q.b)) };
}

/** The state after each gate; the first entry is the start. */
export function trace(start: Qubit, gates: Gate[]): Qubit[] {
  const states = [start];
  for (const gate of gates) states.push(apply(states[states.length - 1], gate));
  return states;
}

/** Equal up to a global sign, which no measurement can detect. */
export function sameState(p: Qubit, q: Qubit): boolean {
  const close = (s: number) => Math.abs(p.a - s * q.a) < 1e-6 && Math.abs(p.b - s * q.b) < 1e-6;
  return close(1) || close(-1);
}

/** Probabilities of reading 0 and 1 in an ordinary measurement. */
export function probabilities(q: Qubit): [number, number] {
  return [clean(q.a * q.a), clean(q.b * q.b)];
}

export function named(q: Qubit): { state: NamedState; sign: 1 | -1 } | null {
  for (const state of Object.keys(STATES) as NamedState[]) {
    const s = STATES[state];
    if (Math.abs(q.a - s.a) < 1e-6 && Math.abs(q.b - s.b) < 1e-6) return { state, sign: 1 };
    if (Math.abs(q.a + s.a) < 1e-6 && Math.abs(q.b + s.b) < 1e-6) return { state, sign: -1 };
  }
  return null;
}

/** Short ket name, e.g. "|+⟩" or "−|1⟩". */
export function ketName(q: Qubit): string {
  const found = named(q);
  if (!found) return expand(q);
  return `${found.sign < 0 ? "−" : ""}${KET[found.state]}`;
}

/** Written in the computational basis, e.g. "(|0⟩ − |1⟩)/√2". */
export function expand(q: Qubit): string {
  const half = (value: number) => Math.abs(Math.abs(value) - R) < 1e-6;
  if (half(q.a) && half(q.b)) {
    const lead = q.a < 0 ? "−" : "";
    const between = Math.sign(q.a) === Math.sign(q.b) ? "+" : "−";
    return `${lead}(|0⟩ ${between} |1⟩)/√2`;
  }
  if (q.b === 0) return `${q.a < 0 ? "−" : ""}|0⟩`;
  if (q.a === 0) return `${q.b < 0 ? "−" : ""}|1⟩`;
  return `${q.a.toFixed(2)}|0⟩ + ${q.b.toFixed(2)}|1⟩`;
}

export interface BenchCase { start: NamedState; target: NamedState }
/** A bench is solved when the same circuit takes every start to its target. */
export function solves(cases: BenchCase[], gates: Gate[]): boolean {
  return cases.every(({ start, target }) => sameState(trace(STATES[start], gates).at(-1)!, STATES[target]));
}
