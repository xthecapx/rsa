import { runtimeInfo } from "./transport";
import { postJson, experimentError } from "./request";
import type { LabRecipe } from "@/game/labCircuit";
import type { Measurement } from "@/game/histogram";
export interface LabResult extends Measurement {
  backend: string;
  shots: number;
  circuit_text: string;
  depth: number;
}
export async function runLab(recipe: LabRecipe): Promise<LabResult> {
  return postJson("/api/lab/run", recipe, {
    timeout: runtimeInfo.target === "web" ? 40000 : undefined,
    error: experimentError,
  });
}
