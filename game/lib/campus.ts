import type { CampusRequest } from "@/game/campusExperiment";
import type { LabResult } from "./lab";
import { postJson, experimentError } from "./request";
import { runtimeInfo } from "./transport";
export type CampusResult = LabResult;
export function runCampus(request: CampusRequest): Promise<CampusResult> {
  return postJson("/api/campus/run", request, {
    timeout: runtimeInfo.target === "web" ? 40000 : undefined,
    error: experimentError,
  });
}
