import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlaintextWorkbench } from "@/components/PlaintextWorkbench";
import { ShorPipeline } from "@/components/ShorPipeline";
import { useGame } from "@/game/state";
import { restoreCheckpoint } from "@/game/restoreCheckpoint";
import { invalidateMission } from "@/game/runtime";
import { api } from "@/lib/api";
import type { PuzzlePiece, PuzzleSlot } from "@/components/PuzzleDragDrop";
import { RAIL } from "@/game/pipeline";
import { useLocale } from "@/i18n";
import type { ComponentProps, ReactNode } from "react";
vi.mock("@/components/PuzzleDragDrop", () => ({
  PuzzleDragDrop: ({ children }: { children: ReactNode }) => <>{children}</>,
  PuzzlePiece: ({ label, onSelect }: ComponentProps<typeof PuzzlePiece>) => (
    <button aria-label={label} onClick={onSelect} />
  ),
  PuzzleSlot: ({ label, onSelect }: ComponentProps<typeof PuzzleSlot>) => (
    <button aria-label={label} onClick={onSelect} />
  ),
}));
vi.mock("@/game/audio", () => ({
  gameAudio: { playSfx: vi.fn(), playSynth: vi.fn() },
}));
beforeEach(() => {
  useLocale.setState({ locale: "en" });
  useGame.setState({ labMemory: {}, operations: 0, error: null, terminal: [] });
  useGame.getState().setVars({
    modulus: 15,
    base: 7,
    recovered: null,
    p: null,
    q: null,
    d: null,
  });
  vi.spyOn(api.ibm, "batches").mockResolvedValue({ batches: [] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("ignores an alphabet response from an obsolete RSA mission and releases the UI for a fresh request", async () => {
  let finish!: (value: Awaited<ReturnType<typeof api.keyboard>>) => void;
  const request = vi.spyOn(api, "keyboard").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<PlaintextWorkbench armed />);
  fireEvent.click(screen.getByRole("button", { name: "Fetch alphabet table" }));
  fireEvent.click(screen.getByRole("button", { name: /Working/ }));
  expect(request).toHaveBeenCalledTimes(1);
  invalidateMission();
  await act(async () =>
    finish({ keys: [{ char: "A", value: 1 }] } as Awaited<
      ReturnType<typeof api.keyboard>
    >),
  );
  expect(useGame.getState().labMemory.alphabet).toBeUndefined();
  expect(
    screen.getByRole("button", { name: "Fetch alphabet table" }),
  ).toBeTruthy();
  expect(useGame.getState().terminal).toHaveLength(0);
});
function preparePipeline() {
  useGame.getState().setLabMemory({
    shor4: {
      wired: RAIL.slice(0, -1).map((box) => box.id),
      backend: "aer",
      batchId: "",
      m: 4,
      shots: 512,
      run: null,
    },
  });
}
it.each(["mission change", "unmount"])(
  "never submits a Shor job after %s during its setup animation",
  async (reason) => {
    vi.useFakeTimers();
    preparePipeline();
    const submit = vi.spyOn(api.shor, "simulate");
    const view = render(<ShorPipeline armed />);
    fireEvent.click(
      screen.getByRole("button", { name: "Run the pipeline · 512 shots" }),
    );
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(useGame.getState().operations).toBe(1);
    expect(restoreCheckpoint("ct1")).toBe(false);
    if (reason === "unmount") view.unmount();
    else invalidateMission();
    const before = useGame.getState().terminal.length;
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(submit).not.toHaveBeenCalled();
    expect(useGame.getState().terminal).toHaveLength(before);
    expect(
      (useGame.getState().labMemory.shor4 as { run: unknown }).run,
    ).toBeNull();
  },
);
it("submits a wired pipeline once and saves counts with their original backend metadata", async () => {
  vi.useFakeTimers();
  preparePipeline();
  let finish!: (value: Awaited<ReturnType<typeof api.shor.simulate>>) => void;
  const submit = vi.spyOn(api.shor, "simulate").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<ShorPipeline armed />);
  fireEvent.click(
    screen.getByRole("button", { name: "Run the pipeline · 512 shots" }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Running/ }));
  await act(async () => vi.advanceTimersByTimeAsync(1200));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledWith({
    N: 15,
    a: 7,
    num_control: 4,
    shots: 512,
  });
  await act(async () => {
    finish({
      precheck: {},
      backend: "Noisy device",
      kind: "noise",
      source: "simulator",
      counts: { "0000": 512 },
      shots: 512,
    });
  });
  await act(async () => vi.advanceTimersByTimeAsync(1200));
  const saved = useGame.getState().labMemory.shor4 as {
    run: { qpu: string; kind: string; counts: Record<string, number> };
  };
  expect(useGame.getState().operations).toBe(0);
  expect(saved.run.qpu).toBe("Noisy device");
  expect(saved.run.kind).toBe("noise");
  expect(saved.run.counts).toEqual({ "0000": 512 });
  expect(
    screen.getByRole("tab", { name: "Results" }).getAttribute("aria-selected"),
  ).toBe("true");
  expect(
    screen.getByRole("region", { name: "Observed counts" }).textContent,
  ).toContain("Noisy device");
  expect(screen.queryByRole("button", { name: /Run the pipeline/ })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Run" }));
  expect(
    screen.getByRole("button", { name: "Run the pipeline again · 512 shots" }),
  ).toBeTruthy();
});

it("wires only matching outputs, clears connections, and blocks an unwired or non-coprime job", async () => {
  const submit = vi.spyOn(api.shor, "simulate");
  render(<ShorPipeline armed />);
  fireEvent.keyDown(screen.getByRole("tab", { name: "Math" }), {
    key: "ArrowRight",
  });
  fireEvent.click(screen.getByRole("button", { name: "N, a" }));
  fireEvent.click(
    screen.getByRole("button", { name: "input of Shor circuit" }),
  );
  expect(screen.getByRole("status").textContent).toContain(
    "not fed raw numbers",
  );
  RAIL.slice(0, -1).forEach((box, i) => {
    fireEvent.click(screen.getByRole("button", { name: box.emits!.label }));
    // Two classical PCs share a title; only the final one has an input.
    fireEvent.click(
      screen.getByRole("button", {
        name: `input of ${RAIL[i + 1].title}`,
      }),
    );
  });
  fireEvent.click(screen.getByRole("tab", { name: "Run" }));
  expect(
    screen
      .getByRole("button", { name: /Run the pipeline ·/ })
      .hasAttribute("disabled"),
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "5 !" }));
  expect(
    screen
      .getByRole("button", { name: /Run the pipeline ·/ })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Disconnect pipeline" }));
  expect(
    (useGame.getState().labMemory.shor4 as { wired: string[] }).wired,
  ).toEqual([]);
  expect(
    screen
      .getByRole("button", { name: /Run the pipeline ·/ })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(submit).not.toHaveBeenCalled();
});

it("a successful noisy run opens counts and verified factors, then restores without another submission", async () => {
  vi.useFakeTimers();
  preparePipeline();
  useGame.getState().setVars({ e: 3, cipherNumber: 8 });
  const counts = { "0000": 400, "0100": 112 };
  const submit = vi.spyOn(api.shor, "simulate").mockResolvedValue({
    precheck: {},
    backend: "Selected noise backend",
    kind: "noise",
    source: "simulator",
    shots: 512,
    counts,
    analysis: {
      shots: 512,
      true_order: 4,
      outcomes: [
        { bitstring: "0000", count: 400, phase: 0, order_guess: 1 },
        {
          bitstring: "0100",
          count: 112,
          phase: 0.25,
          fraction: "1/4",
          order_guess: 4,
          order_matches_true: true,
          factoring: { even_order: true, nontrivial: true, factors: [3, 5] },
        },
      ],
    },
  });
  vi.spyOn(api.rsa, "decrypt").mockResolvedValue({
    c: 8,
    d: 3,
    N: 15,
    m: 2,
    equation: "8³ mod 15 = 2",
    trace: [],
  });
  const view = render(<ShorPipeline armed />);
  fireEvent.click(screen.getByRole("button", { name: /Run the pipeline ·/ }));
  expect(
    screen.getByRole("tab", { name: "Run" }).hasAttribute("disabled"),
  ).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(2600));
  expect(useGame.getState().vars.recovered).toBe("B");
  expect(
    screen.getByRole("tab", { name: "Results" }).getAttribute("aria-selected"),
  ).toBe("true");
  expect(
    screen.getByRole("region", { name: "Observed counts" }).textContent,
  ).toContain("400");
  expect(
    screen.getByRole("region", { name: "Classical checks" }).textContent,
  ).toContain("tallest bar is not the answer");
  fireEvent.click(screen.getByRole("tab", { name: "Run" }));
  expect(screen.queryByRole("button", { name: /Run the pipeline/ })).toBeNull();
  view.unmount();
  render(<ShorPipeline armed />);
  expect(
    screen.getByRole("tab", { name: "Results" }).getAttribute("aria-selected"),
  ).toBe("true");
  await act(async () => useLocale.setState({ locale: "es" }));
  expect(
    screen.getByRole("region", { name: "Conteos observados" }).textContent,
  ).toContain("Selected noise backend");
  expect(submit).toHaveBeenCalledTimes(1);
  expect(
    (useGame.getState().labMemory.shor4 as { run: { counts: unknown } }).run
      .counts,
  ).toEqual(counts);
});

it("restores recorded hardware counts with a hardware label without submitting a quantum job", async () => {
  const submit = vi.spyOn(api.shor, "simulate");
  const cached = vi
    .spyOn(api.ibm, "cached")
    .mockResolvedValue({ batch_id: "", jobs: [], N: 15, a: 7 });
  useGame.getState().setLabMemory({
    shor4: {
      wired: RAIL.slice(0, -1).map((box) => box.id),
      backend: "ibm",
      batchId: "",
      m: 4,
      shots: 512,
      run: {
        backend: "ibm",
        qpu: "ibm_recorded",
        N: 15,
        a: 7,
        m: 4,
        shots: 512,
        counts: { "0000": 512 },
        picked: null,
        fromReference: false,
        qubits: null,
        depth: null,
        usage: null,
        consoleUrl: null,
      },
    },
  });
  await act(async () => {
    render(<ShorPipeline armed />);
  });
  expect(
    screen.getByRole("region", { name: "Observed counts" }).textContent,
  ).toContain("Real hardware");
  expect(
    screen.getByRole("region", { name: "Observed counts" }).textContent,
  ).toContain("ibm_recorded");
  expect(cached).toHaveBeenCalledTimes(1);
  expect(submit).not.toHaveBeenCalled();
});
