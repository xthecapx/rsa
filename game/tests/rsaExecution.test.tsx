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
import { invalidateMission } from "@/game/runtime";
import { api } from "@/lib/api";
import { RAIL } from "@/game/pipeline";
import { useLocale } from "@/i18n";
import type { ReactNode } from "react";
vi.mock("@/components/PuzzleDragDrop", () => ({
  PuzzleDragDrop: ({ children }: { children: ReactNode }) => <>{children}</>,
  PuzzlePiece: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PuzzleSlot: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/game/audio", () => ({
  gameAudio: { playSfx: vi.fn(), playSynth: vi.fn() },
}));
beforeEach(() => {
  useLocale.setState({ locale: "en" });
  useGame.setState({ labMemory: {}, operations: 0, error: null, terminal: [] });
  useGame
    .getState()
    .setVars({
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
  useGame
    .getState()
    .setLabMemory({
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
    fireEvent.click(screen.getByRole("button", { name: "Run the pipeline" }));
    await act(async () => vi.advanceTimersByTimeAsync(100));
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
  fireEvent.click(screen.getByRole("button", { name: "Run the pipeline" }));
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
  expect(saved.run.qpu).toBe("Noisy device");
  expect(saved.run.kind).toBe("noise");
  expect(saved.run.counts).toEqual({ "0000": 512 });
  expect(
    screen.getByRole("button", { name: "Run the pipeline again" }),
  ).toBeTruthy();
});
