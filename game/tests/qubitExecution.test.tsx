import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QubitBench } from "@/components/QubitBench";
import { coinApi, type BenchResult } from "@/lib/coin";
import type { PuzzlePiece, PuzzleSlot } from "@/components/PuzzleDragDrop";
import type { BenchStep } from "@/content/coinTown";
import { useLocale } from "@/i18n";
import { COIN_TOWN_NPCS } from "@/content/coinTown";
import {
  CircuitPuzzle,
  EMPTY_CIRCUIT,
  type CircuitSlots,
} from "@/components/CoinChallenges";
vi.mock("@/game/audio", () => ({
  gameAudio: { playSfx: vi.fn(), playSynth: vi.fn() },
}));
vi.mock("@/components/PuzzleDragDrop", () => ({
  PuzzleDragDrop: ({ children }: { children: ReactNode }) => <>{children}</>,
  PuzzlePiece: ({ label, onSelect }: ComponentProps<typeof PuzzlePiece>) => (
    <button aria-label={label} onClick={onSelect} />
  ),
  PuzzleSlot: ({ label, onSelect }: ComponentProps<typeof PuzzleSlot>) => (
    <button aria-label={label} onClick={onSelect} />
  ),
}));
const step: BenchStep = {
  kind: "bench",
  title: "Flip",
  text: "Flip",
  feedback: "Good",
  slots: 1,
  gates: ["X"],
  cases: [{ start: "0", target: "1" }],
  fill: true,
};
const measured: BenchResult = {
  backend: "Noisy device",
  kind: "noise",
  source: "simulator",
  shots: 256,
  circuits: [
    {
      start: "0",
      counts: { "0": 17, "1": 239 },
      probabilities: { "0": 0, "1": 1 },
    },
  ],
};
beforeEach(() => useLocale.setState({ locale: "en" }));
afterEach(cleanup);
function assemble() {
  fireEvent.click(screen.getByRole("tab", { name: "Assemble" }));
}
function runStage() {
  fireEvent.click(screen.getByRole("tab", { name: "Run" }));
}
function place() {
  assemble();
  fireEvent.click(screen.getByRole("button", { name: "X gate · flip" }));
  fireEvent.click(screen.getByRole("button", { name: /Wire slot 1/ }));
}
it("validates ideal correctness while displaying noisy returned counts; edits restore Run and Clear", async () => {
  const request = vi.spyOn(coinApi, "circuit").mockResolvedValue(measured),
    solved = vi.fn();
  render(<QubitBench step={step} onSolved={solved} />);
  runStage();
  fireEvent.click(screen.getByRole("button", { name: /Run circuit/ }));
  expect(request).not.toHaveBeenCalled();
  place();
  runStage();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: /Run circuit/ })),
  );
  expect(request).toHaveBeenCalledWith(["0"], ["X"]);
  expect(solved).toHaveBeenCalledTimes(1);
  expect(screen.getByText("239 · 93.4%")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Clear circuit" })).toBeNull();
  act(() => useLocale.setState({ locale: "es" }));
  expect(screen.getByText("239 · 93.4%")).toBeTruthy();
  act(() => useLocale.setState({ locale: "en" }));
  assemble();
  fireEvent.click(screen.getByRole("button", { name: /Wire slot 1/ }));
  expect(screen.queryByText("239 · 93.4%")).toBeNull();
  expect(screen.getByRole("button", { name: "Clear circuit" })).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(1);
});
it("blocks duplicate submissions, allows explicit retry after error, and discards late results on unmount", async () => {
  let finish!: (result: BenchResult) => void;
  const request = vi
    .spyOn(coinApi, "circuit")
    .mockRejectedValueOnce(new Error("Provider refused"))
    .mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const solved = vi.fn(),
    busy = vi.fn();
  const view = render(
    <QubitBench step={step} onSolved={solved} onBusyChange={busy} />,
  );
  place();
  runStage();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: /Run circuit/ })),
  );
  expect(screen.getByRole("alert").textContent).toBe("Provider refused");
  fireEvent.click(screen.getByRole("button", { name: /Run circuit/ }));
  fireEvent.click(screen.getByRole("button", { name: /Running circuit/ }));
  expect(request).toHaveBeenCalledTimes(2);
  expect(
    (screen.getByRole("button", { name: "Clear circuit" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  view.unmount();
  expect(busy).toHaveBeenLastCalledWith(false);
  await act(async () => finish(measured));
  expect(solved).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(2);
});

it("clears and rebuilds the house circuit; Check validates without submitting a job", () => {
  const solved = vi.fn();
  const circuit = vi.spyOn(coinApi, "circuit");
  const simulate = vi.spyOn(coinApi, "simulate");
  function HouseAssembly() {
    const [slots, setSlots] = useState<CircuitSlots>({ ...EMPTY_CIRCUIT });
    return (
      <CircuitPuzzle slots={slots} onChange={setSlots} onSolved={solved} />
    );
  }
  render(<HouseAssembly />);
  function put(gate: "H" | "M", position: "First" | "Second") {
    fireEvent.click(
      screen.getByRole("button", {
        name: gate === "H" ? "Hadamard · H" : "Measurement · M",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(`${position} operation:`),
      }),
    );
  }
  put("M", "First");
  put("H", "Second");
  fireEvent.click(screen.getByRole("button", { name: "Check circuit" }));
  expect(solved).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain(
    "Swap the operations",
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
  expect(
    screen.getByRole("button", { name: "First operation: Empty" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Second operation: Empty" }),
  ).toBeTruthy();
  put("H", "First");
  put("M", "Second");
  fireEvent.click(screen.getByRole("button", { name: "Check circuit" }));
  expect(solved).toHaveBeenCalledTimes(1);
  expect(circuit).not.toHaveBeenCalled();
  expect(simulate).not.toHaveBeenCalled();
});

it.each(
  COIN_TOWN_NPCS.flatMap((npc) =>
    npc.steps
      .filter((candidate): candidate is BenchStep => candidate.kind === "bench")
      .map((step) => ({ host: npc.title, step })),
  ),
)(
  "$host · $step.title uses focused steps and separate counts for each start",
  async ({ step }) => {
    const response: BenchResult = {
      ...measured,
      circuits: step.cases.map(({ start }) => ({
        start,
        counts: { "0": 17, "1": 239 },
        probabilities: { "0": 0.5, "1": 0.5 },
      })),
    };
    const request = vi.spyOn(coinApi, "circuit").mockResolvedValue(response);
    const view = render(<QubitBench step={step} onSolved={vi.fn()} />);
    expect(
      screen.getByRole("tab", { name: "Math" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.queryByRole("button", { name: /Run circuit/ })).toBeNull();
    assemble();
    expect(screen.queryByRole("button", { name: /Run circuit/ })).toBeNull();
    for (let i = 0; i < step.slots; i++) {
      fireEvent.click(
        screen.getByRole("button", {
          name:
            step.gates[0] === "X"
              ? "X gate · flip"
              : step.gates[0] === "H"
                ? "Hadamard · H"
                : "Z gate · sign",
        }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: new RegExp(`Wire slot ${i + 1}:`) }),
      );
    }
    expect(request).not.toHaveBeenCalled();
    runStage();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Run circuit/ })),
    );
    expect(request).toHaveBeenCalledWith(
      step.cases.map(({ start }) => start),
      Array(step.slots).fill(step.gates[0]),
    );
    expect(
      screen
        .getByRole("tab", { name: "Results" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getAllByText("239 · 93.4%")).toHaveLength(step.cases.length);
    expect(
      screen.getAllByRole("img", { name: "Ideal Bloch sphere" }),
    ).toHaveLength(step.cases.length);
    act(() => useLocale.setState({ locale: "es" }));
    expect(screen.getAllByText("239 · 93.4%")).toHaveLength(step.cases.length);
    expect(request).toHaveBeenCalledTimes(1);
    view.unmount();
  },
);
