import { serviceError, serviceFetch } from "./transport";
import type { Gate, NamedState } from "@/game/qubit";
export interface QubitReading {
  counts: { "0": number; "1": number };
  /** Ideal mathematical reference, never the measured histogram. */
  probabilities: { "0": number; "1": number };
}
export interface BenchResult {
  source: "simulator" | "hardware";
  backend: string;
  kind: "ideal" | "noise" | "hardware";
  shots: number;
  circuits: (QubitReading & { start: NamedState })[];
}
export interface ClassicalCoin {
  seed: number;
  bits: number[];
  source: "python_seeded_prng";
}

export interface CoinResult {
  source: "simulator" | "hardware";
  backend: string;
  kind?: "ideal" | "noise" | "hardware";
  hadamard: boolean;
  shots: number;
  bits: number[];
  memory_reconstructed?: boolean;
  counts: { "0": number; "1": number };
  probabilities: { "0": number; "1": number };
}

async function post<T>(path: string, body: object): Promise<T> {
  const response = await serviceFetch(`/api/coin/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw await serviceError(response, "The experiment could not finish. Check the backend and try again.");
  return response.json();
}

export const coinApi = {
  circuit: (starts: NamedState[], gates: Gate[], shots = 256) => post<BenchResult>("circuit", { starts, gates, shots }),
  classical: (flips: number) => post<ClassicalCoin>("classical", { seed: 42, flips }),
  simulate: (hadamard: boolean, shots: number) => post<CoinResult>("simulate", { hadamard, shots }),
};
