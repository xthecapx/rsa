/** The Ghost Key vault: 25 tumblers, a parity "ghost", three candles a night. */
export const BITS = 25;
export const KEYSPACE = 2 ** BITS;
export const CANDLES = 3;

export type VaultHelper = "minus" | "plus" | "zero";
export type VaultReason = "prep" | "helper" | "output" | "measure" | "extra";

export interface VaultCircuit {
  prep: "h" | null;
  helper: VaultHelper | null;
  out: "h" | null;
  measure: boolean;
  extra: ("diffuser" | "repeat")[];
}

export interface VaultRun {
  frames: { block: "prep" | "oracle" | "out"; phases?: ("+" | "-")[]; bits?: string }[];
  measured: string;
  queries: number;
}

/** The quantum core refused to execute this wiring. */
export class VaultRefusal extends Error {
  constructor(readonly reason: VaultReason) { super(reason); }
}

const REASONS: VaultReason[] = ["prep", "helper", "output", "measure", "extra"];

async function post<T>(path: string, body: object): Promise<T> {
  const response = await fetch(`/api/vault/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  if (response.status === 409) {
    const data = await response.json().catch(() => null);
    const reason = data?.detail?.reason;
    throw new VaultRefusal(REASONS.includes(reason) ? reason : "prep");
  }
  if (!response.ok) throw new Error("The quantum core did not answer. Check the backend and try again.");
  return response.json();
}

export const vaultApi = {
  device: (previous?: string) => post<{ token: string }>("device", previous ? { previous } : {}),
  key: (token: string, key: string) => post<{ open: boolean }>("key", { token, key }),
  ask: (token: string, x: string) => post<{ knock: 0 | 1 }>("ask", { token, x }),
  run: (token: string, circuit: VaultCircuit) => post<VaultRun>("run", { token, circuit }),
};

/** Grover's target probability after k rounds on n items with one marked. */
export function groverProbability(n: number, k: number): number {
  const theta = Math.asin(1 / Math.sqrt(n));
  return Math.sin((2 * k + 1) * theta) ** 2;
}
/** Rounds that bring the marked item closest to certainty. */
export function optimalRounds(n: number): number {
  const theta = Math.asin(1 / Math.sqrt(n));
  return Math.round(Math.PI / (4 * theta) - 0.5);
}
export function bruteForce(tries: number, n = KEYSPACE): number { return tries / n; }

/** Percent without exponents, keeping `significant` digits of tiny values. */
export function formatPercent(p: number, significant = 2): string {
  const value = p * 100;
  if (value === 0) return "0%";
  const digits = Math.max(0, significant - 1 - Math.floor(Math.log10(Math.abs(value))));
  return `${value.toFixed(Math.min(digits, 12))}%`;
}
export function formatCount(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Bits pinned by one-candle questions: tumbler index → knocked bit. */
export function knownBits(questions: { x: string; knock: 0 | 1 }[]): Map<number, 0 | 1> {
  const known = new Map<number, 0 | 1>();
  for (const { x, knock } of questions) {
    const lit = [...x].flatMap((bit, i) => bit === "1" ? [i] : []);
    if (lit.length === 1) known.set(lit[0], knock);
  }
  return known;
}
export const litCandles = (x: string) => [...x].flatMap((bit, i) => bit === "1" ? [i] : []);
export const vectorOf = (lit: number[]) => Array.from({ length: BITS }, (_, i) => lit.includes(i) ? "1" : "0").join("");

export interface Question { x: string; knock: 0 | 1 }
export const tumblerList = (lit: number[]) => lit.map((i) => i + 1).join(", ");
/** The last thing the vault said, in words. Several tumblers never reveal a single digit. */
export function answerLine(q: Question): string {
  const lit = litCandles(q.x);
  if (lit.length === 1) return q.knock ? `👻 Knock! Tumbler ${lit[0] + 1} is 1.` : `… Silence. Tumbler ${lit[0] + 1} is 0.`;
  return q.knock ? `👻 Knock… but about tumblers ${tumblerList(lit)} together. No single digit is revealed.`
    : `… Silence, about tumblers ${tumblerList(lit)} together. No single digit is revealed.`;
}
