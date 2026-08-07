/**
 * Turning raw measurement counts into something a player can read.
 *
 * The backend already does the interpretation -- for every bitstring it
 * reports the phase, the continued fraction, the order that implies, and
 * whether that order actually factors N. This module only normalises it, so
 * the results table does not care whether the counts came off a simulator or
 * off IBM hardware.
 */

import type { ShorAnalysis, ShorSuccessfulOutcome } from "@/lib/api";

/** How far a single measurement got. */
export type Verdict =
  /** Recovered the true period and split N completely. */
  | "solved"
  /** Gave a factor, but from an order that is not the real one. */
  | "partial"
  /** The order came out odd, so the a^(r/2) trick does not apply. */
  | "oddOrder"
  /** Led nowhere: phase 0, or only trivial factors. */
  | "dead";

export interface Outcome {
  bitstring: string;
  /** The counting register read as an ordinary integer. */
  value: number;
  count: number;
  probability: number;
  /** value / 2^m, the phase the register encodes. */
  phase: number;
  /** That phase as a continued fraction, e.g. "1/4". */
  fraction: string;
  order: number | null;
  matchesTrueOrder: boolean;
  factors: number[] | null;
  verdict: Verdict;
}

export interface Readout {
  /** Sorted by shots, and capped -- m = 8 would otherwise be 256 rows. */
  outcomes: Outcome[];
  /** How many distinct outcomes were measured before the cap. */
  totalOutcomes: number;
  trueOrder: number | null;
  shots: number;
  /** The measurement with the most counts, which is not always the useful one. */
  mostMeasured: Outcome | null;
  /** The first outcome that actually splits N, if any. */
  solution: Outcome | null;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  solved: "splits N",
  partial: "one factor",
  oddOrder: "odd r",
  dead: "nothing",
};

export const VERDICT_STYLE: Record<Verdict, string> = {
  solved: "text-actor-brayan",
  partial: "text-accent-amber",
  oddOrder: "text-stage-muted",
  dead: "text-stage-muted",
};

function verdictOf(raw: ShorSuccessfulOutcome, N: number): Verdict {
  const factoring = raw.factoring;
  const factors = factoring?.factors ?? null;

  if (factoring?.even_order === false) return "oddOrder";
  if (!factors?.length || !factoring?.nontrivial) return "dead";

  // A measurement can hand over a factor by luck without having found the
  // real period. Only call it solved when the factors multiply back to N.
  const product = factors.reduce((acc, f) => acc * f, 1);
  return product === N && raw.order_matches_true ? "solved" : "partial";
}

/** Enough rows to see the shape of the distribution, few enough to read. */
const MAX_ROWS = 12;

export function readAnalysis(
  analysis: ShorAnalysis | undefined,
  N: number,
): Readout {
  const raw = analysis?.outcomes ?? [];
  const shots = analysis?.shots ?? raw.reduce((acc, o) => acc + (o.count ?? 0), 0);

  const all: Outcome[] = raw
    .map((entry) => ({
      bitstring: entry.bitstring,
      value: parseInt(entry.bitstring, 2),
      count: entry.count ?? 0,
      probability: entry.probability ?? (shots ? (entry.count ?? 0) / shots : 0),
      phase: entry.phase ?? 0,
      fraction: entry.fraction ?? "-",
      order: entry.order_guess ?? null,
      matchesTrueOrder: Boolean(entry.order_matches_true),
      factors: entry.factoring?.factors ?? null,
      verdict: verdictOf(entry, N),
    }))
    .sort((a, b) => b.count - a.count);

  const solution = all.find((o) => o.verdict === "solved") ?? null;
  const outcomes = all.slice(0, MAX_ROWS);

  // The row that actually splits N has to be on screen even when noise pushed
  // it down the list, otherwise the table proves the opposite of the point.
  if (solution && !outcomes.some((o) => o.bitstring === solution.bitstring)) {
    outcomes[outcomes.length - 1] = solution;
  }

  return {
    outcomes,
    totalOutcomes: all.length,
    trueOrder: analysis?.true_order ?? null,
    shots,
    mostMeasured: all[0] ?? null,
    solution,
  };
}

/**
 * The lesson worth calling out: on noisy hardware the tallest bar is often not
 * the answer, so you verify every candidate rather than trusting the peak.
 */
export function peakIsMisleading(readout: Readout): boolean {
  return Boolean(
    readout.solution &&
      readout.mostMeasured &&
      readout.mostMeasured.bitstring !== readout.solution.bitstring,
  );
}
