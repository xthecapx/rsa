import { postJson } from "./request";
import type { RegOp } from "@/game/register";
import type { Measurement } from "@/game/histogram";

export interface RegisterResult extends Measurement {
  backend: string;
  shots: number;
}
export async function runRegister(
  qubits: number,
  start: string,
  operations: RegOp[],
  shots = 256,
): Promise<RegisterResult> {
  return postJson(
    "/api/register/circuit",
    { qubits, start, operations, shots },
    { timeout: 20000 },
  );
}
