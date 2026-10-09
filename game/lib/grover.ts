import { serviceError } from "./transport";
import { postJson, QUANTUM_ERROR } from "./request";
export type GroverBlock = "oracle" | "diffuser" | "h" | "x";

export interface GroverCircuit {
  init: "h" | null;
  loop: GroverBlock[];
  repeat: number;
  measure: boolean;
}

export interface GroverStepSnapshot {
  round: number;
  block: "start" | GroverBlock;
  /** Signed amplitudes in the device's secret bar order. */
  amplitudes: number[];
}

export interface GroverRun {
  counts?: Record<string, number>;
  shots?: number;
  backend?: string;
  source?: "simulator" | "hardware";
  kind?: "ideal" | "noise" | "hardware";
  steps: GroverStepSnapshot[];
  measured: string | null;
  labels: string[] | null;
}

/** The quantum core refused to collapse this circuit. */
export class GroverRefusal extends Error {
  constructor(readonly reason: "circuit" | "rounds") {
    super(reason);
  }
}

async function post<T>(path: string, body: object): Promise<T> {
  return postJson<T>(`/api/grover/${path}`, body, {
    timeout: 20000,
    error: async (response) => {
      if (response.status === 409) {
        const data = await response.json().catch(() => null);
        const reason = data?.detail?.reason;
        throw new GroverRefusal(reason === "rounds" ? "rounds" : "circuit");
      }
      return serviceError(response, QUANTUM_ERROR);
    },
  });
}

export const groverApi = {
  device: (previous?: string) =>
    post<{ token: string }>("device", previous ? { previous } : {}),
  query: (token: string, guess: string) =>
    post<{ match: boolean }>("query", { token, guess }),
  run: (token: string, circuit: GroverCircuit) =>
    post<GroverRun>("run", { token, circuit }),
};

/** Probability of the tallest bar, which is the marked PIN once the search works. */
export function tallest(amplitudes: number[]): number {
  return Math.max(...amplitudes.map((amp) => amp * amp));
}
