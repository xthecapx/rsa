import { serviceFetch, runtimeInfo } from "./transport";
import type { LabRecipe } from "@/game/labCircuit";
import type { Measurement } from "@/game/histogram";
export interface LabResult extends Measurement {
  backend: string;
  shots: number;
  circuit_text: string;
  depth: number;
}
export async function runLab(recipe: LabRecipe): Promise<LabResult> {
  const response = await serviceFetch("/api/lab/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recipe),
    ...(runtimeInfo.target === "web"
      ? { signal: AbortSignal.timeout(40000) }
      : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "The experiment could not finish. Check the backend and try again.",
    );
  return data;
}
