import table from "./runEstimates.json";

/** Expected time for one run of one circuit. Never a countdown or a promise. */
export interface RunEstimate {
  lowMs: number;
  highMs: number;
}

/** The table was measured on a development computer
 * (`backend/tools/measure_run_estimates.py`). The deployed service has one slower
 * CPU and may start cold, so the displayed upper bound is stretched. */
export const SAFETY_MULTIPLIER = 3;

type Cases = Record<string, { median_ms?: number; p95_ms?: number }>;
const cases = (table as { cases: Cases }).cases;

function parse(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== "string") return {};
  try {
    const value = JSON.parse(body);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export const parseBody = parse;

function number(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Smallest measured step that is at least `value`, else the largest. */
function ceilStep(value: number, steps: number[]): number {
  return steps.find((step) => step >= value) ?? steps[steps.length - 1];
}

function measured(key: string): RunEstimate | null {
  const entry = cases[key];
  if (!entry?.median_ms || !entry.p95_ms) return null;
  return {
    lowMs: entry.median_ms,
    highMs: Math.max(entry.p95_ms, entry.median_ms) * SAFETY_MULTIPLIER,
  };
}

/** Which measured case a request resembles. Larger circuits round upward. */
export function estimateKey(
  path: string,
  body: BodyInit | null | undefined,
  choice: "ideal" | "noise",
): string | null {
  const request = parse(body);
  switch (path) {
    case "/api/lab/run": {
      const heavy =
        number(request.qubits, 1) > 2 || number(request.shots, 16) > 256;
      return `lab:${heavy ? "q4:s1024" : "q1:s16"}:${choice}`;
    }
    case "/api/campus/run": {
      const recipe = (request.recipe ?? {}) as Record<string, unknown>;
      const heavy =
        number(recipe.qubits, 1) > 2 || number(recipe.shots, 256) > 256;
      return heavy ? `lab:q4:s1024:${choice}` : `campus:q1:s256:${choice}`;
    }
    case "/api/coin/circuit":
      return `coin:circuit:${choice}`;
    case "/api/coin/simulate":
      return `coin:simulate:${choice}`;
    case "/api/register/circuit":
      return `register:q${ceilStep(number(request.qubits, 2), [2, 3, 4])}:${choice}`;
    case "/api/grover/run": {
      const circuit = (request.circuit ?? {}) as Record<string, unknown>;
      return `grover:r${ceilStep(number(circuit.repeat, 1), [0, 1, 3, 5])}:${choice}`;
    }
    case "/api/vault/run":
      return `vault:${choice}`;
    case "/api/shor/simulate":
      return `shor:m${ceilStep(number(request.num_control, 4), [3, 4, 6, 8, 10])}:${choice}`;
    default:
      return null;
  }
}

export function estimateRun(
  path: string,
  body: BodyInit | null | undefined,
  choice: "ideal" | "noise",
): RunEstimate | null {
  const key = estimateKey(path, body, choice);
  return key ? measured(key) : null;
}

/** Whole-second range for display: "about 2–9 s". */
export function estimateSeconds(estimate: RunEstimate): {
  low: number;
  high: number;
} {
  const low = Math.max(1, Math.floor(estimate.lowMs / 1000));
  return { low, high: Math.max(low + 1, Math.ceil(estimate.highMs / 1000)) };
}

/** Human name for the circuit being waited on. Each run owns its own wait. */
export function runLabel(
  path: string,
  body: BodyInit | null | undefined,
): string {
  const request = parse(body);
  switch (path) {
    case "/api/lab/run":
      return "Lab circuit";
    case "/api/campus/run":
      return "Campus experiment";
    case "/api/coin/circuit":
    case "/api/coin/simulate":
      return "Coin circuit";
    case "/api/register/circuit":
      return "Register circuit";
    case "/api/grover/run": {
      const circuit = (request.circuit ?? {}) as Record<string, unknown>;
      return `Grover search ×${number(circuit.repeat, 1)}`;
    }
    case "/api/vault/run":
      return "Ghost Key circuit";
    case "/api/shor/simulate":
      return `Shor period finding · ${number(request.num_control, 4)} counting qubits`;
    default:
      return "Quantum circuit";
  }
}
