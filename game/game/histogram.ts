/**
 * What a measurement returned, in a shape a simulator and a real backend can
 * both fill: shot counts per bitstring, optionally the ideal probabilities the
 * simulator knows. Summaries keep a 25-qubit result readable: the few strings
 * that got shots, everything else in one bucket, and a qubit-by-qubit vote.
 */
export interface Measurement {
  bits: number;
  /** Shots per bitstring, leftmost character first, as the screen shows them. */
  counts: Record<string, number>;
  /** Ideal probabilities, when a simulator knows them. */
  probabilities?: Record<string, number>;
  source: "simulator" | "hardware";
  /** Which machine ran it, e.g. "ibm_torino". */
  backend?: string;
  /** The string the story cares about: the mask, the PIN, the shot that split N. */
  highlight?: string | null;
}

export interface OutcomeRow { bitstring: string; count: number; share: number; probability: number | null; highlight: boolean }
export interface Summary {
  shots: number;
  /** Distinct strings that got at least one shot. */
  distinct: number;
  possible: bigint;
  rows: OutcomeRow[];
  /** Everything not in `rows`. */
  other: { outcomes: number; count: number; share: number };
  /** P(qubit i reads 1), from the shots (or the ideal probabilities when there are none). */
  ones: number[];
  /** Each qubit's more frequent reading. */
  vote: string;
  /** The tallest bar, and whether the qubit vote agrees with it. */
  top: string | null;
}

export function summarize(measurement: Measurement, limit = 8): Summary {
  const shots = Object.values(measurement.counts).reduce((sum, count) => sum + count, 0);
  const probabilities = measurement.probabilities ?? {};
  // With no shots yet, the ideal distribution stands in for the counts.
  const weights = shots > 0 ? measurement.counts : probabilities;
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0) || 1;
  const ranked = Object.entries(weights).filter(([, w]) => w > 0)
    .sort(([a, x], [b, y]) => y - x || (probabilities[b] ?? 0) - (probabilities[a] ?? 0) || a.localeCompare(b));
  const row = ([bitstring, weight]: [string, number]): OutcomeRow => ({
    bitstring, count: measurement.counts[bitstring] ?? 0, share: weight / total,
    probability: measurement.probabilities ? probabilities[bitstring] ?? 0 : null, highlight: bitstring === measurement.highlight,
  });
  const rows = ranked.slice(0, limit).map(row);
  const highlight = measurement.highlight;
  if (highlight && !rows.some((r) => r.bitstring === highlight)) rows.push(row([highlight, weights[highlight] ?? 0]));
  const shown = new Set(rows.map((r) => r.bitstring));
  const rest = ranked.filter(([bitstring]) => !shown.has(bitstring));
  const restWeight = rest.reduce((sum, [, w]) => sum + w, 0);
  const ones = Array.from({ length: measurement.bits }, (_, i) =>
    ranked.reduce((sum, [bitstring, w]) => sum + (bitstring[i] === "1" ? w : 0), 0) / total);
  return {
    shots, distinct: Object.values(measurement.counts).filter((count) => count > 0).length,
    possible: BigInt(2) ** BigInt(measurement.bits),
    rows, other: { outcomes: rest.length, count: rest.reduce((sum, [b]) => sum + (measurement.counts[b] ?? 0), 0), share: restWeight / total },
    ones, vote: ones.map((p) => (p > 0.5 ? "1" : "0")).join(""), top: ranked[0]?.[0] ?? null,
  };
}

/** Long strings read better in groups of five: 00010 00000 11100 … */
export function groupBits(bitstring: string): string {
  return bitstring.length > 8 ? bitstring.replace(/(.{5})(?=.)/g, "$1 ") : bitstring;
}
