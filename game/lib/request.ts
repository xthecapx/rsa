import { runtimeInfo, serviceError, serviceFetch } from "./transport";
import {
  beginExecution,
  canStopWaiting,
  claimRunContext,
  isQuantumRequest,
  isRemoteRun,
  noteAbandonedRun,
  noteWorkerFree,
  recordExecutionTiming,
  requestRemoteNotice,
} from "./execution";
import {
  REMOTE_DECLINED_ERROR,
  STOPPED_ERROR,
  TIMEOUT_ERROR,
  UNAVAILABLE_ERROR,
} from "./executionErrors";
import { estimateRun, parseBody, runLabel } from "./runEstimates";
import { useSimulator } from "@/game/simulator";

/** Abort only the HTTP wait. A late response cannot reattach to its old owner. */
function waitFor<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

export const EXPERIMENT_ERROR =
  "The experiment could not finish. Check the backend and try again.";
export const QUANTUM_ERROR =
  "The quantum core did not answer. Check the backend and try again.";
/** Response decoding is shared; refusals and mission ownership stay with the caller. */
export async function requestJson<T>(
  path: string,
  init?: RequestInit,
  error: (response: Response) => Promise<Error> = (response) =>
    serviceError(response, EXPERIMENT_ERROR),
  options: { timeout?: number } = {},
): Promise<T> {
  const quantum = isQuantumRequest(path);
  const web = runtimeInfo.target === "web";
  const remote =
    quantum &&
    !web &&
    runtimeInfo.remoteFinalOnly &&
    isRemoteRun(path, parseBody(init?.body));
  // Before any timer or status: the player decides, nothing is submitted yet.
  if (remote && !(await requestRemoteNotice()))
    throw new Error(REMOTE_DECLINED_ERROR);
  const controller =
    web && (quantum || options.timeout !== undefined)
      ? new AbortController()
      : null;
  const timeout =
    options.timeout ??
    (path.startsWith("/api/shor/")
      ? 165000
      : /\/api\/(campus|lab)\//.test(path)
        ? 40000
        : 20000);
  const abort = () => controller?.abort(init?.signal?.reason);
  if (controller && init?.signal) {
    if (init.signal.aborted) abort();
    else init.signal.addEventListener("abort", abort, { once: true });
  }
  const timer = controller
    ? setTimeout(() => controller.abort(new Error(TIMEOUT_ERROR)), timeout)
    : undefined;
  const execution = quantum
    ? beginExecution(
        path,
        runtimeInfo.target,
        controller && canStopWaiting(path)
          ? () => controller.abort(new Error(STOPPED_ERROR))
          : undefined,
        {
          label: runLabel(path, init?.body),
          remote,
          ...claimRunContext(),
          // Measured on a development computer; only meaningful for the web
          // simulators. Remote queues have no honest estimate.
          estimate: web
            ? (estimateRun(path, init?.body, useSimulator.getState().choice) ??
              undefined)
            : undefined,
        },
      )
    : null;
  const started = performance.now();
  let received: number | undefined;
  let serverTiming: string | null = null;
  let outcome: "success" | "error" = "error";
  try {
    controller?.signal.throwIfAborted();
    const response = await waitFor(
      serviceFetch(
        path,
        controller ? { ...init, signal: controller.signal } : init,
        execution?.progress,
      ),
      controller?.signal,
    );
    // A bridge/mock may not observe abort. Never apply its late result anyway.
    controller?.signal.throwIfAborted();
    received = performance.now();
    serverTiming = response.headers.get("Server-Timing");
    execution?.progress({ state: "retrieving" });
    if (quantum && web && response.status === 504) {
      noteAbandonedRun();
      throw new Error(TIMEOUT_ERROR);
    }
    if (quantum && web && response.status === 503)
      throw new Error(UNAVAILABLE_ERROR);
    if (!response.ok) throw await error(response);
    const data = await waitFor(response.json(), controller?.signal);
    controller?.signal.throwIfAborted();
    outcome = "success";
    // An answer proves the single worker is free again.
    if (quantum && web) noteWorkerFree();
    return data;
  } catch (cause) {
    if (controller?.signal.aborted) {
      const reason = controller.signal.reason;
      if (
        reason instanceof Error &&
        (reason.message === STOPPED_ERROR || reason.message === TIMEOUT_ERROR)
      ) {
        // The server cannot stop active native work; a retry may queue behind it.
        if (quantum && web) noteAbandonedRun();
        throw reason;
      }
      if (reason?.name === "TimeoutError") throw new Error(TIMEOUT_ERROR);
    }
    if (quantum && web && cause instanceof TypeError)
      throw new Error(UNAVAILABLE_ERROR);
    throw cause;
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener("abort", abort);
    execution?.finish();
    if (quantum)
      recordExecutionTiming(
        path,
        started,
        received,
        performance.now(),
        serverTiming,
        outcome,
      );
  }
}
export function postJson<T>(
  path: string,
  body: unknown,
  options: {
    timeout?: number;
    error?: (response: Response) => Promise<Error>;
  } = {},
): Promise<T> {
  return requestJson(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    options.error,
    options,
  );
}
/** Lab tools expose validation details in both delivery targets. */
export async function experimentError(response: Response): Promise<Error> {
  const data = await response.json();
  return new Error(
    typeof data.detail === "string" ? data.detail : EXPERIMENT_ERROR,
  );
}
