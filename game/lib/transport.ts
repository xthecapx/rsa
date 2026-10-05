import { useSimulator } from "@/game/simulator";

/** The HTTP game and the embedded Qollab game share the same service contracts. */
export type ServiceTransport = (path: string, init?: RequestInit) => Promise<Response>;

let transport: ServiceTransport | null = null;

/** Install before mounting the embedded game. HTTP remains the default. */
export function setServiceTransport(next: ServiceTransport | null): void {
  transport = next;
}

export function serviceFetch(path: string, init?: RequestInit): Promise<Response> {
  if (runtimeInfo.target === "web" && /^(?:\/api\/(?:coin\/(?:simulate|circuit)|register\/circuit|grover\/run|vault\/run|shor\/simulate))$/.test(path)) {
    const headers = new Headers(init?.headers);
    headers.set("X-Quantum-Simulator", useSimulator.getState().choice);
    init = { ...init, headers };
  }
  return transport ? transport(path, init) : fetch(path, init);
}

/** Embedded capability diagnostics are actionable; keep HTTP's existing fallback. */
export async function serviceError(response: Response, fallback: string): Promise<Error> {
  if (runtimeInfo.target === "qollab") {
    const data = await response.json().catch(() => null);
    if (typeof data?.detail === "string") return new Error(data.detail);
  }
  return new Error(fallback);
}

/** Metadata is display-only; never use the selected device name as a story ID. */
export const runtimeInfo = {
  target: "web" as "web" | "qollab",
  backend: "AerSimulator",
  kind: "ideal" as "ideal" | "noise" | "hardware",
};
