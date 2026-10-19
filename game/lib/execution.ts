import { create } from "zustand";

export interface ServiceProgress {
  state: string;
  jobId?: string;
  /** Only supplied while the bridge can remove work before Python starts. */
  cancelQueued?: () => boolean;
}

/** What the status panel says about one run. Every run owns its own wait: the
 * timer, estimate and label are never carried over to the next circuit. */
export interface RunContext {
  /** English label of the circuit; translated when displayed. */
  label: string;
  /** Measured typical time (web simulators only). */
  estimate?: { lowMs: number; highMs: number };
  /** A physical quantum computer or remote simulator job. */
  remote?: boolean;
  /** First quantum request of this page visit; the server may be cold. */
  firstOfVisit?: boolean;
  /** An earlier run was abandoned moments ago and may still hold the worker. */
  previousMayBeRunning?: boolean;
}

export interface Execution extends ServiceProgress, Partial<RunContext> {
  id: number;
  path: string;
  target: "web" | "qollab";
  started: number;
  stopWaiting?: () => void;
}

export interface BackgroundExperiment {
  owner: string;
  title: string;
  running: boolean;
  canRestore: boolean;
}

/** Transient diagnostics and feedback, never progress or provider allowance. */
export const useExecution = create<{
  active: Execution[];
  feedbackHost: HTMLElement | null;
  background: BackgroundExperiment | null;
  /** Pending first-remote-run notice; resolves true to continue. */
  remoteNotice: { resolve: (proceed: boolean) => void } | null;
}>(() => ({
  active: [],
  feedbackHost: null,
  background: null,
  remoteNotice: null,
}));
let nextId = 0;
let quantumRequestsThisVisit = 0;
let remoteNoticeSeen = false;
/** When a stopped or timed-out web run may still be occupying the worker. */
let abandonedAt: number | null = null;
/** The server frees an abandoned run within its own timeout (150 s at most). */
const ABANDONED_WINDOW_MS = 150_000;

/** Called when a request is begun: marks what the panel should warn about. */
export function claimRunContext(): Pick<
  RunContext,
  "firstOfVisit" | "previousMayBeRunning"
> {
  const firstOfVisit = quantumRequestsThisVisit === 0;
  quantumRequestsThisVisit += 1;
  return {
    firstOfVisit,
    previousMayBeRunning:
      abandonedAt !== null && Date.now() - abandonedAt < ABANDONED_WINDOW_MS,
  };
}

/** The server cannot be told to stop active native work, so remember it. */
export function noteAbandonedRun() {
  abandonedAt = Date.now();
}

/** A later success proves the worker is free again. */
export function noteWorkerFree() {
  abandonedAt = null;
}

/** One calm explanation before the first remote job of a visit. Resolves false
 * when the player declines; nothing is submitted in that case. */
export function requestRemoteNotice(): Promise<boolean> {
  if (remoteNoticeSeen) return Promise.resolve(true);
  return new Promise((resolve) => {
    useExecution.setState({
      remoteNotice: {
        resolve: (proceed) => {
          if (proceed) remoteNoticeSeen = true;
          useExecution.setState({ remoteNotice: null });
          resolve(proceed);
        },
      },
    });
  });
}

/** Mirrors the Qollab adapter's policy: only final challenges and lab runs go
 * to the selected remote backend; practice stays on a local simulator. */
export function isRemoteRun(path: string, body: unknown): boolean {
  const request = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const circuit = (request.circuit ?? {}) as Record<string, unknown>;
  return (
    (path === "/api/coin/simulate" && request.finalChallenge === true) ||
    (path === "/api/grover/run" && circuit.measure === true) ||
    path === "/api/vault/run" ||
    path === "/api/shor/simulate" ||
    path === "/api/lab/run"
  );
}

/** Test hook: a new page visit has no history. */
export function resetExecutionHistory() {
  quantumRequestsThisVisit = 0;
  remoteNoticeSeen = false;
  abandonedAt = null;
  useExecution.setState({ remoteNotice: null });
}

export function restoreExperiment() {
  useExecution.setState({ background: null });
}

/** Navigation must not unmount the experiment that still owns a result. */
export function executionPending() {
  const state = useExecution.getState();
  return state.active.length > 0 || !!state.background?.running;
}

export function beginExecution(
  path: string,
  target: Execution["target"],
  stopWaiting?: () => void,
  context?: RunContext,
) {
  const id = ++nextId;
  useExecution.setState(({ active }) => ({
    active: [
      ...active,
      {
        id,
        path,
        target,
        started: Date.now(),
        state: "waiting",
        stopWaiting,
        ...context,
      },
    ],
  }));
  return {
    progress: (progress: ServiceProgress) =>
      useExecution.setState(({ active }) => ({
        active: active.map((job) =>
          job.id === id
            ? { ...job, ...progress, cancelQueued: progress.cancelQueued }
            : job,
        ),
      })),
    finish: () =>
      useExecution.setState(({ active }) => ({
        active: active.filter((job) => job.id !== id),
      })),
  };
}

export function isQuantumRequest(path: string) {
  return /^\/api\/(?:campus\/run|lab\/run|coin\/(?:simulate|circuit)|register\/circuit|grover\/run|vault\/run|shor\/(?:plan|classical|simulate))$/.test(
    path,
  );
}

/** Final story decisions and remote submissions must keep their execution lock. */
export function canStopWaiting(path: string) {
  return /^\/api\/(?:campus\/run|lab\/run|coin\/circuit|register\/circuit)$/.test(
    path,
  );
}

/** User Timing entries separate service/JSON time from the next rendered frame.
 * Server-Timing supplies measured queue and worker durations on the HTTP target.
 * No recipes, puzzle answers, tokens or counts enter these diagnostics.
 */
export function recordExecutionTiming(
  path: string,
  started: number,
  received: number | undefined,
  decoded: number,
  serverTiming: string | null,
  outcome: "success" | "error",
) {
  if (typeof performance.measure !== "function") return;
  const name = `qward:${path}`;
  const record = (painted?: number) => {
    // A background tab may paint after a newer request has already finished.
    if (
      painted !== undefined &&
      performance.getEntriesByName(name).at(-1)?.startTime !== started
    )
      return;
    performance.clearMeasures(name);
    performance.measure(name, {
      start: started,
      end: decoded,
      detail: {
        outcome,
        responseMs: received === undefined ? null : received - started,
        decodeMs: received === undefined ? null : decoded - received,
        nextPaintMs: painted === undefined ? null : painted - decoded,
        serverTiming,
      },
    });
  };
  record();
  if (outcome === "success" && typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => record(performance.now())),
    );
  }
}
