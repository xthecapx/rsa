import { create } from "zustand";

export interface ServiceProgress {
  state: string;
  jobId?: string;
  /** Only supplied while the bridge can remove work before Python starts. */
  cancelQueued?: () => boolean;
}

export interface Execution extends ServiceProgress {
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
}>(() => ({
  active: [],
  feedbackHost: null,
  background: null,
}));
let nextId = 0;

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
) {
  const id = ++nextId;
  useExecution.setState(({ active }) => ({
    active: [
      ...active,
      { id, path, target, started: Date.now(), state: "waiting", stopWaiting },
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
