import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LaptopShell } from "@/components/LaptopShell";
import { QuantumJobProgress } from "@/components/QuantumJobProgress";
import { CampusLaptop } from "@/components/CampusLaptop";
import { useCampusInteraction } from "@/components/useCampusInteraction";
import { useAsyncOperation } from "@/components/useAsyncOperation";
import { executionPending, useExecution } from "@/lib/execution";
import { postJson } from "@/lib/request";
import { runtimeInfo, setServiceTransport } from "@/lib/transport";
import { useLocale } from "@/i18n";
import { useCampus } from "@/game/campus";
import { useGame } from "@/game/state";
import { restoreCheckpoint } from "@/game/restoreCheckpoint";

// Browser drag geometry is unrelated to request ownership and modal lifecycle.
vi.mock("@/components/PuzzleDragDrop", () => ({
  PuzzleDragDrop: ({ children }: { children: ReactNode }) => <>{children}</>,
  PuzzlePiece: ({ children }: { children: ReactNode }) => <>{children}</>,
  PuzzleSlot: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useExecution.setState({ active: [], feedbackHost: null, background: null });
  useLocale.setState({ locale: "en" });
  useCampus.getState().reset();
  useGame.getState().resetRun(1);
  runtimeInfo.target = "web";
});
afterEach(() => {
  cleanup();
  setServiceTransport(null);
  runtimeInfo.target = "web";
});

function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((a) => {
    resolve = a;
  });
  return { promise, resolve };
}
function Experiment() {
  const operation = useAsyncOperation();
  const [result, setResult] = useState("No result");
  const [steps, setSteps] = useState(0);
  const background = useExecution((s) => !!s.background);
  return (
    <>
      <button onClick={() => setSteps(steps + 1)} disabled={!background}>
        Walk
      </button>
      <p>Steps: {steps}</p>
      <LaptopShell
        open
        title="Quantum laboratory"
        closeDisabled={operation.busy}
        onClose={vi.fn()}
        foundations={false}
      >
        <button
          disabled={operation.busy}
          onClick={() =>
            void operation.run(
              () => postJson<{ value: string }>("/api/lab/run", {}),
              {
                success: (data) => setResult(data.value),
                error: () => setResult("Run failed"),
              },
            )
          }
        >
          Run experiment
        </button>
        <p>{result}</p>
      </LaptopShell>
      <QuantumJobProgress />
    </>
  );
}

it.each(["web", "qollab"] as const)(
  "%s keeps one request alive while the modal is hidden, then offers its result",
  async (target) => {
    runtimeInfo.target = target;
    const job = deferred();
    const transport = vi.fn(
      (_path: string, _init?: RequestInit) => job.promise,
    );
    setServiceTransport(transport);
    render(<Experiment />);
    fireEvent.click(screen.getByRole("button", { name: "Run experiment" }));
    expect(transport).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Wait in background" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(screen.getByText("Experiment running…")).toBeTruthy();
    expect(executionPending()).toBe(true);
    expect(restoreCheckpoint("qc3")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Walk" }));
    expect(screen.getByText("Steps: 1")).toBeTruthy();
    // Opening the existing owner is not a fresh submission.
    fireEvent.click(
      screen.getByRole("button", { name: "Return to experiment" }),
    );
    expect(
      screen
        .getByRole("button", { name: "Run experiment" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Wait in background" }));
    await act(async () => {
      job.resolve(Response.json({ value: "Measured once" }));
      await job.promise;
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Experiment finished")).toBeTruthy();
    expect(executionPending()).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Return to experiment" }),
    );
    expect(
      within(screen.getByRole("dialog")).getByText("Measured once"),
    ).toBeTruthy();
    expect(transport).toHaveBeenCalledTimes(1);
  },
);

it("keeps errors visible on return and preserves the run when language changes", async () => {
  const job = deferred();
  const transport = vi.fn((_path: string, _init?: RequestInit) => job.promise);
  setServiceTransport(transport);
  render(<Experiment />);
  fireEvent.click(screen.getByRole("button", { name: "Run experiment" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => useLocale.setState({ locale: "es" }));
  expect(screen.getByText("Experimento en ejecución…")).toBeTruthy();
  await act(async () => {
    job.resolve(Response.json({ detail: "failure" }, { status: 503 }));
    await job.promise;
  });
  expect(screen.getByText("El experimento terminó")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Volver al experimento" }),
  );
  expect(screen.getByText("Run failed")).toBeTruthy();
  expect(transport).toHaveBeenCalledTimes(1);
});

function CampusVisit() {
  const interaction = useCampusInteraction();
  return (
    <>
      <p>{interaction.locked ? "World paused" : "World ready"}</p>
      <button onClick={() => interaction.interact("fountain")}>
        Meet host
      </button>
      {interaction.layer}
      <QuantumJobProgress />
    </>
  );
}

it("unlocks campus exploration without unmounting its laptop or awarding a discovery early", async () => {
  const job = deferred();
  const transport = vi.fn((_path: string, _init?: RequestInit) => job.promise);
  setServiceTransport(transport);
  render(<CampusVisit />);
  fireEvent.click(screen.getByRole("button", { name: "Meet host" }));
  fireEvent.click(screen.getByRole("button", { name: "Let’s investigate" }));
  fireEvent.click(
    screen.getByRole("button", { name: "I’m not sure; let’s test it" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Open the experiment" }));
  fireEvent.click(screen.getByRole("tab", { name: "Run" }));
  fireEvent.click(screen.getByRole("button", { name: /^Run circuit ·/ }));
  const request = JSON.parse(transport.mock.calls[0]?.[1]?.body as string);
  fireEvent.click(screen.getByRole("button", { name: "Wait in background" }));
  expect(screen.getByText("World ready")).toBeTruthy();
  expect(useGame.getState().operations).toBe(1);
  expect(restoreCheckpoint("qc3")).toBe(false);
  expect(useCampus.getState().completed).toEqual([]);
  const worldControl = screen.getByRole("button", { name: "Meet host" });
  worldControl.focus();
  await act(async () => {
    job.resolve(
      Response.json({
        bits: 1,
        shots: 256,
        counts: { "0": 128, "1": 128 },
        backend: "Test simulator",
        kind: "ideal",
        source: "simulator",
        probabilities: { "0": 0.5, "1": 0.5 },
        depth: 2,
        circuit_text: "H → M",
      }),
    );
    await job.promise;
  });
  expect(useGame.getState().operations).toBe(0);
  expect(document.activeElement).toBe(worldControl);
  expect(screen.getByText("World ready")).toBeTruthy();
  expect(useCampus.getState().sessions.fountain?.result?.counts).toEqual({
    "0": 128,
    "1": 128,
  });
  expect(useCampus.getState().completed).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Return to experiment" }));
  expect(screen.getByRole("region", { name: "Observed counts" })).toBeTruthy();
  expect(JSON.parse(transport.mock.calls[0]?.[1]?.body as string)).toEqual(
    request,
  );
  expect(transport).toHaveBeenCalledTimes(1);
});

it("cleans up a minimized owner without applying stale campus results to a new run", async () => {
  const job = deferred();
  setServiceTransport(() => job.promise);
  const view = render(
    <>
      <CampusLaptop initial="fountain" onClose={vi.fn()} />
      <QuantumJobProgress />
    </>,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Run" }));
  fireEvent.click(screen.getByRole("button", { name: /^Run circuit ·/ }));
  fireEvent.click(screen.getByRole("button", { name: "Wait in background" }));
  view.unmount();
  expect(useExecution.getState().background).toBeNull();
  await act(async () => {
    job.resolve(Response.json({ counts: { "0": 256 } }));
    await job.promise;
  });
  expect(useCampus.getState().sessions.fountain?.result).toBeFalsy();
  expect(useGame.getState().operations).toBe(0);
});
