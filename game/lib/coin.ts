import { postJson } from "./request";
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

const post = <T>(path: string, body: object) =>
  postJson<T>(`/api/coin/${path}`, body, { timeout: 20000 });

export const coinApi = {
  circuit: (starts: NamedState[], gates: Gate[], shots = 256) =>
    post<BenchResult>("circuit", { starts, gates, shots }),
  classical: (flips: number) =>
    post<ClassicalCoin>("classical", { seed: 42, flips }),
  simulate: (hadamard: boolean, shots: number, finalChallenge = false) =>
    post<CoinResult>("simulate", { hadamard, shots, finalChallenge }),
};
