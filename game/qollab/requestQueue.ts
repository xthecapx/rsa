import { QUEUED_CANCELLED_ERROR } from "@/lib/executionErrors";
import type { ServiceProgress } from "@/lib/execution";

/** Serial Python calls; cancellation only removes a call that has not started.
 * Active calls retain the queue and their provider allowance until they settle.
 */
export function createRequestQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(
    work: () => Promise<T>,
    progress?: (state: ServiceProgress) => void,
  ): Promise<T> {
    let started = false;
    let cancelled = false;
    let rejectQueued: (error: Error) => void;
    const result = new Promise<T>((resolve, reject) => {
      rejectQueued = reject;
      const next = tail.then(async () => {
        if (cancelled) return;
        started = true;
        progress?.({ state: "preparing" });
        try {
          resolve(await work());
        } catch (error) {
          reject(error);
        }
      });
      tail = next.catch(() => undefined);
    });
    progress?.({
      state: "bridge_queued",
      cancelQueued: () => {
        if (started || cancelled) return false;
        cancelled = true;
        rejectQueued(new Error(QUEUED_CANCELLED_ERROR));
        return true;
      },
    });
    return result;
  };
}
