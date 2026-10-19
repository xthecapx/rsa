import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QuantumJobProgress } from "@/components/QuantumJobProgress";
import {
  claimRunContext,
  resetExecutionHistory,
  useExecution,
} from "@/lib/execution";
import { REMOTE_DECLINED_ERROR } from "@/lib/executionErrors";
import { postJson } from "@/lib/request";
import { runtimeInfo, setServiceTransport } from "@/lib/transport";
import { resetWarmBackend, warmBackend } from "@/lib/warmup";
import { useLocale } from "@/i18n";
import { useSimulator } from "@/game/simulator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
const counts = () => Response.json({ counts: { 0: 1 } });

beforeEach(() => {
  vi.useFakeTimers();
  useExecution.setState({ active: [], feedbackHost: null, background: null });
  resetExecutionHistory();
  resetWarmBackend();
  useLocale.setState({ locale: "en" });
  useSimulator.setState({ choice: "ideal" });
  runtimeInfo.target = "web";
  runtimeInfo.remoteFinalOnly = false;
});
afterEach(() => {
  cleanup();
  setServiceTransport(null);
  runtimeInfo.target = "web";
  runtimeInfo.remoteFinalOnly = false;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("names the circuit and shows a measured typical time, then admits when a run is slow", async () => {
  claimRunContext(); // an earlier run this visit: not a cold start
  const pending = deferred<Response>();
  setServiceTransport(() => pending.promise);
  render(<QuantumJobProgress />);
  let request!: Promise<unknown>;
  act(() => {
    request = postJson("/api/shor/simulate", { N: 15, a: 7, num_control: 8 });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(
    screen.getByText(/Shor period finding · 8 counting qubits/),
  ).toBeTruthy();
  expect(
    screen.getByText(/Usually about \d+–\d+ s\. This is an estimate\./),
  ).toBeTruthy();
  expect(screen.queryByText(/Taking longer than usual/)).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(screen.getByText(/Taking longer than usual/)).toBeTruthy();
  await act(async () => {
    pending.resolve(counts());
    await request;
  });
});

it("gives every run its own wait: a new circuit starts a fresh timer and label", async () => {
  const first = deferred<Response>();
  const second = deferred<Response>();
  let calls = 0;
  setServiceTransport(() => (calls++ === 0 ? first.promise : second.promise));
  render(<QuantumJobProgress />);
  let a!: Promise<unknown>;
  act(() => {
    a = postJson("/api/lab/run", { qubits: 1, shots: 16 });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(screen.getByText("Elapsed: 4s")).toBeTruthy();
  await act(async () => {
    first.resolve(counts());
    await a;
  });
  let b!: Promise<unknown>;
  act(() => {
    b = postJson("/api/grover/run", { token: "t", circuit: { repeat: 3 } });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  expect(screen.getByText("Elapsed: 1s")).toBeTruthy();
  expect(screen.getByText(/Grover search ×3/)).toBeTruthy();
  expect(screen.queryByText(/Lab circuit/)).toBeNull();
  await act(async () => {
    second.resolve(counts());
    await b;
  });
});

it("says the server may be waking up only on the first run of a visit", async () => {
  const pending = deferred<Response>();
  setServiceTransport(() => pending.promise);
  render(<QuantumJobProgress />);
  let request!: Promise<unknown>;
  act(() => {
    request = postJson("/api/campus/run", {});
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(screen.queryByText(/may be waking up/)).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(screen.getByText(/may be waking up/)).toBeTruthy();
  await act(async () => {
    pending.resolve(counts());
    await request;
  });
  // The second run is not a cold start.
  const next = deferred<Response>();
  setServiceTransport(() => next.promise);
  let again!: Promise<unknown>;
  act(() => {
    again = postJson("/api/campus/run", {});
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(7000);
  });
  expect(screen.queryByText(/may be waking up/)).toBeNull();
  await act(async () => {
    next.resolve(counts());
    await again;
  });
});

it("warns that an abandoned run may still occupy the server, until a run succeeds", async () => {
  const abandoned = deferred<Response>();
  setServiceTransport(() => abandoned.promise);
  render(<QuantumJobProgress />);
  let first!: Promise<unknown>;
  act(() => {
    first = postJson("/api/campus/run", {});
  });
  const stopped = first.catch(() => "stopped");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Stop waiting" }));
    await stopped;
  });
  const retry = deferred<Response>();
  setServiceTransport(() => retry.promise);
  let second!: Promise<unknown>;
  act(() => {
    second = postJson("/api/campus/run", {});
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(screen.getByText(/earlier run may still be finishing/)).toBeTruthy();
  await act(async () => {
    retry.resolve(counts());
    await second;
  });
  const third = deferred<Response>();
  setServiceTransport(() => third.promise);
  let last!: Promise<unknown>;
  act(() => {
    last = postJson("/api/campus/run", {});
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(screen.queryByText(/earlier run may still be finishing/)).toBeNull();
  await act(async () => {
    third.resolve(counts());
    await last;
  });
});

it("explains remote runs once, submits nothing until the player agrees, and never repeats it", async () => {
  runtimeInfo.target = "qollab";
  runtimeInfo.remoteFinalOnly = true;
  const transport = vi.fn(async () => counts());
  setServiceTransport(transport);
  render(<QuantumJobProgress />);
  let request!: Promise<unknown>;
  act(() => {
    request = postJson("/api/lab/run", { qubits: 1, shots: 16 });
  });
  expect(screen.getByText("Before you run on a quantum computer")).toBeTruthy();
  expect(screen.getByText(/asynchronous/)).toBeTruthy();
  expect(screen.getByText(/only one remote job/)).toBeTruthy();
  expect(transport).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Run on the quantum backend" }),
    );
    await request;
  });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Before you run on a quantum computer")).toBeNull();
  // A later remote circuit is a new wait, not a new lecture.
  await act(async () => {
    await postJson("/api/shor/simulate", { N: 15, a: 7, num_control: 4 });
  });
  expect(screen.queryByText("Before you run on a quantum computer")).toBeNull();
  expect(transport).toHaveBeenCalledTimes(2);
});

it("declining the remote notice submits nothing and keeps the next press possible", async () => {
  runtimeInfo.target = "qollab";
  runtimeInfo.remoteFinalOnly = true;
  const transport = vi.fn(async () => counts());
  setServiceTransport(transport);
  render(<QuantumJobProgress />);
  let request!: Promise<unknown>;
  act(() => {
    request = postJson("/api/vault/run", {});
  });
  const refused = expect(request).rejects.toThrow(REMOTE_DECLINED_ERROR);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));
    await refused;
  });
  expect(transport).not.toHaveBeenCalled();
  expect(useExecution.getState().active).toHaveLength(0);
  // Asking again explains again, because the player never agreed.
  act(() => {
    void postJson("/api/vault/run", {}).catch(() => undefined);
  });
  expect(screen.getByText("Before you run on a quantum computer")).toBeTruthy();
});

it("practice runs on a remote-capable Qollab backend are not preceded by the notice", async () => {
  runtimeInfo.target = "qollab";
  runtimeInfo.remoteFinalOnly = true;
  const transport = vi.fn(async () => counts());
  setServiceTransport(transport);
  render(<QuantumJobProgress />);
  await act(async () => {
    await postJson("/api/register/circuit", { qubits: 2 });
    await postJson("/api/grover/run", {
      token: "t",
      circuit: { repeat: 1, measure: false },
    });
  });
  expect(transport).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Before you run on a quantum computer")).toBeNull();
});

it("remote runs show their own asynchronous wait, with no invented countdown", async () => {
  runtimeInfo.target = "qollab";
  runtimeInfo.remoteFinalOnly = true;
  const pending = deferred<Response>();
  setServiceTransport(() => pending.promise);
  render(<QuantumJobProgress />);
  let request!: Promise<unknown>;
  act(() => {
    request = postJson("/api/lab/run", { qubits: 1, shots: 16 });
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Run on the quantum backend" }),
    );
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(screen.getByText(/queues can take several minutes/)).toBeTruthy();
  expect(screen.queryByText(/Usually about/)).toBeNull();
  await act(async () => {
    pending.resolve(counts());
    await request;
  });
});

it("warms a sleeping backend once per visit with the health route only", () => {
  const fetchMock = vi.fn(async (..._args: unknown[]) =>
    Response.json({ status: "ok" }),
  );
  vi.stubGlobal("fetch", fetchMock);
  warmBackend();
  warmBackend();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/health");
  expect(useExecution.getState().active).toHaveLength(0);
  resetWarmBackend();
  runtimeInfo.target = "qollab";
  warmBackend();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("shows the circuit and elapsed time in the background indicator too", async () => {
  const pending = deferred<Response>();
  setServiceTransport(() => pending.promise);
  useExecution.setState({
    background: { owner: "x", title: "Lab", running: true, canRestore: true },
  });
  render(<QuantumJobProgress />);
  let request!: Promise<unknown>;
  act(() => {
    request = postJson("/api/lab/run", { qubits: 1, shots: 16 });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(screen.getByText(/Lab circuit/)).toBeTruthy();
  await act(async () => {
    pending.resolve(counts());
    await request;
  });
});
