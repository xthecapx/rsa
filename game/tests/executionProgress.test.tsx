import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QuantumJobProgress } from "@/components/QuantumJobProgress";
import { LaptopShell } from "@/components/LaptopShell";
import { useExecution } from "@/lib/execution";
import {
  QUEUED_CANCELLED_ERROR,
  STOPPED_ERROR,
  TIMEOUT_ERROR,
} from "@/lib/executionErrors";
import { postJson } from "@/lib/request";
import { runtimeInfo, setServiceTransport } from "@/lib/transport";
import { createRequestQueue } from "@/qollab/requestQueue";
import { useLocale } from "@/i18n";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.useFakeTimers();
  useExecution.setState({ active: [], feedbackHost: null, background: null });
  useLocale.setState({ locale: "en" });
  runtimeInfo.target = "web";
});
afterEach(() => {
  cleanup();
  setServiceTransport(null);
  runtimeInfo.target = "web";
  vi.useRealTimers();
});

it("stops an HTTP practice wait, rejects late counts, and requires an explicit fresh run", async () => {
  const old = deferred<Response>();
  const transport = vi.fn(() => old.promise);
  setServiceTransport(transport);
  render(<QuantumJobProgress />);
  let pending!: Promise<unknown>;
  act(() => {
    pending = postJson("/api/campus/run", {});
  });
  const failed = expect(pending).rejects.toThrow(STOPPED_ERROR);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(screen.getByText("Elapsed: 2s")).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Stop waiting" }));
    await failed;
  });
  expect(useExecution.getState().active).toHaveLength(0);
  old.resolve(Response.json({ counts: { 0: 16 } }));
  await act(async () => {
    await old.promise;
  });
  expect(transport).toHaveBeenCalledTimes(1);
  setServiceTransport(async () => Response.json({ counts: { 1: 16 } }));
  await act(async () => {
    expect(await postJson("/api/campus/run", {})).toEqual({
      counts: { 1: 16 },
    });
  });
});

it("uses an explicit HTTP deadline and clears the timer after settlement", async () => {
  setServiceTransport(() => new Promise(() => {}));
  const pending = postJson("/api/register/circuit", {}, { timeout: 20 });
  const failed = expect(pending).rejects.toThrow(TIMEOUT_ERROR);
  await vi.advanceTimersByTimeAsync(20);
  await failed;
  expect(useExecution.getState().active).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("turns HTTP connection failures into recovery instructions without submitting again", async () => {
  const { UNAVAILABLE_ERROR } = await import("@/lib/executionErrors");
  const transport = vi.fn(async () => {
    throw new TypeError("Failed to fetch");
  });
  setServiceTransport(transport);
  await expect(postJson("/api/campus/run", {})).rejects.toThrow(
    UNAVAILABLE_ERROR,
  );
  expect(transport).toHaveBeenCalledTimes(1);
  expect(useExecution.getState().active).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("places stop-waiting inside the laptop modal so its focus trap and screen readers can reach it", async () => {
  const active = deferred<Response>();
  setServiceTransport(() => active.promise);
  render(
    <>
      <LaptopShell
        open
        title="Test"
        closeDisabled
        onClose={vi.fn()}
        foundations={false}
      >
        <p>Workspace</p>
      </LaptopShell>
      <QuantumJobProgress />
    </>,
  );
  let pending!: Promise<unknown>;
  act(() => {
    pending = postJson("/api/lab/run", {});
  });
  const failed = expect(pending).rejects.toThrow(STOPPED_ERROR);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  const stop = screen.getByRole("button", { name: "Stop waiting" });
  expect(screen.getByRole("dialog").contains(stop)).toBe(true);
  await act(async () => {
    fireEvent.click(stop);
    await failed;
  });
  expect(document.activeElement).toBe(screen.getByRole("dialog"));
  active.resolve(Response.json({}));
});

it("cancels a queued bridge run without invoking Python, while an active run retains the queue", async () => {
  runtimeInfo.target = "qollab";
  const enqueue = createRequestQueue();
  const active = deferred<Response>();
  const python = vi.fn((path: string) =>
    path === "/api/lab/run"
      ? active.promise
      : Promise.resolve(Response.json({ counts: { 0: 16 } })),
  );
  setServiceTransport((path, _, progress) =>
    enqueue(() => python(path), progress),
  );
  render(<QuantumJobProgress />);
  let first!: Promise<unknown>, second!: Promise<unknown>;
  await act(async () => {
    first = postJson("/api/lab/run", {});
  });
  act(() => {
    second = postJson("/api/campus/run", {});
  });
  const failed = expect(second).rejects.toThrow(QUEUED_CANCELLED_ERROR);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(screen.queryByRole("button", { name: "Stop waiting" })).toBeNull();
  expect(python).toHaveBeenCalledTimes(1);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Cancel queued run" }));
    await failed;
  });
  expect(useExecution.getState().active).toHaveLength(1);
  await act(async () => {
    active.resolve(Response.json({ counts: { 0: 1 } }));
    await first;
  });
  expect(python).toHaveBeenCalledTimes(1);
  expect(useExecution.getState().active).toHaveLength(0);
});

it("never times out Qollab or offers cancellation after Python has started", async () => {
  runtimeInfo.target = "qollab";
  const active = deferred<Response>();
  const enqueue = createRequestQueue();
  let staleCancel: (() => boolean) | undefined;
  setServiceTransport((_, init, progress) => {
    expect(init?.signal).toBeUndefined();
    return enqueue(
      () => active.promise,
      (state) => {
        if (state.cancelQueued) staleCancel = state.cancelQueued;
        progress?.(state);
      },
    );
  });
  render(<QuantumJobProgress />);
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = postJson("/api/coin/simulate", {}, { timeout: 20 });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120000);
  });
  expect(staleCancel?.()).toBe(false);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText(/cannot be cancelled here/)).toBeTruthy();
  await act(async () => {
    active.resolve(Response.json({ counts: { 0: 1 } }));
    await pending;
  });
});

it("translates feedback without submitting another run and keeps remote allowance notices", async () => {
  const active = deferred<Response>();
  const transport = vi.fn(() => active.promise);
  setServiceTransport(transport);
  render(<QuantumJobProgress />);
  let pending!: Promise<unknown>;
  act(() => {
    pending = postJson("/api/vault/run", {});
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  act(() => {
    useLocale.setState({ locale: "es" });
  });
  expect(screen.getByLabelText("Estado del experimento")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  await act(async () => {
    window.dispatchEvent(new Event("quantum-remote-used"));
    active.resolve(Response.json({ counts: { 0: 1 } }));
    await pending;
  });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button")).toBeTruthy();
});
