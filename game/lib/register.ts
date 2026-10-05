import { serviceFetch, serviceError } from "./transport";
import type { RegOp } from "@/game/register";
import type { Measurement } from "@/game/histogram";

export interface RegisterResult extends Measurement { backend: string; shots: number }
export async function runRegister(qubits: number, start: string, operations: RegOp[], shots = 256): Promise<RegisterResult> {
  const response = await serviceFetch("/api/register/circuit", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qubits, start, operations, shots }), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw await serviceError(response, "The experiment could not finish. Check the backend and try again.");
  return response.json();
}
