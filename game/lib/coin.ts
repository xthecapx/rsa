export interface ClassicalCoin {
  seed: number;
  bits: number[];
  source: "python_seeded_prng";
}

export interface CoinResult {
  source: "simulator";
  backend: "AerSimulator";
  hadamard: boolean;
  shots: number;
  bits: number[];
  counts: { "0": number; "1": number };
  probabilities: { "0": number; "1": number };
}

async function post<T>(path: string, body: object): Promise<T> {
  const response = await fetch(`/api/coin/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("The experiment could not finish. Check the backend and try again.");
  return response.json();
}

export const coinApi = {
  classical: (flips: number) => post<ClassicalCoin>("classical", { seed: 42, flips }),
  simulate: (hadamard: boolean, shots: number) => post<CoinResult>("simulate", { hadamard, shots }),
};
