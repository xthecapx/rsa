import { runtimeInfo } from "./transport";

let sent = false;

/** Wakes a scale-to-zero backend while the player walks around the first town.
 * It requests the cheap health route: no circuit, no job, no player data, and
 * no execution status or provider allowance. Fire-and-forget, once per visit.
 * Qollab has no HTTP backend to wake. */
export function warmBackend(): void {
  if (sent || runtimeInfo.target !== "web" || typeof fetch !== "function")
    return;
  sent = true;
  fetch("/api/health", { cache: "no-store" }).catch(() => undefined);
}

/** Test hook. */
export function resetWarmBackend(): void {
  sent = false;
}
