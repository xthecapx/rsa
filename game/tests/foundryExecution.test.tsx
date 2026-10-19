import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RegisterBench, RoundsDial } from "@/components/RegisterBench";
import {
  GroverCircuitBuilder,
  EMPTY_SLOTS,
  type CircuitSlots,
} from "@/components/GroverChallenges";
import { FOUNDRY_NPCS } from "@/content/foundry";
import type { RegisterStep, RoundsStep } from "@/content/knowledge";
import type { RegOp } from "@/game/register";
import * as registerApi from "@/lib/register";
import type { RegisterResult } from "@/lib/register";
import type { PuzzlePiece, PuzzleSlot } from "@/components/PuzzleDragDrop";
import { useLocale } from "@/i18n";

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
const reading: RegisterResult = {
  bits: 2,
  backend: "Teaching noise",
  kind: "noise",
  source: "simulator",
  shots: 256,
  counts: { "00": 239, "11": 17 },
  probabilities: { "00": 0, "01": 0, "10": 1, "11": 0 },
};
const benches = FOUNDRY_NPCS.flatMap((npc) =>
  npc.steps.filter((step): step is RegisterStep => step.kind === "register"),
);
const solutions: Record<
  string,
  { piece: string; column: number; wire?: number; op: RegOp }[]
> = {
  "Patch line 1": [{ piece: "X gate · flip", column: 1, op: "X1" }],
  "Both lines": [
    { piece: "X gate · flip", column: 1, op: "X1" },
    { piece: "X gate · flip", column: 1, wire: 2, op: "X2" },
  ],
  "Level every pot": [{ piece: "H box · every qubit", column: 1, op: "H" }],
  "A messy start": [
    { piece: "X gate · flip", column: 1, op: "X1" },
    { piece: "H box · every qubit", column: 2, op: "H" },
  ],
  "Pick the right Oracle": [
    { piece: "Oracle · marks |10⟩", column: 1, op: "oracle:10" },
  ],
  "One full round": [
    { piece: "H box · every qubit", column: 1, op: "H" },
    { piece: "Oracle · marks |11⟩", column: 2, op: "oracle:11" },
    { piece: "Diffuser · mirror", column: 3, op: "D" },
  ],
};
const subscript = "₀₁₂₃₄";
function stage(name: string) {
  fireEvent.click(screen.getByRole("tab", { name }));
}
function put(piece: string, column: number, wire = 1) {
  fireEvent.click(screen.getByRole("button", { name: piece }));
  fireEvent.click(
    screen.getByRole("button", {
      name: `Wire q${subscript[wire]} · slot ${column}: Empty`,
    }),
  );
}
beforeEach(() => useLocale.setState({ locale: "en" }));
afterEach(cleanup);

it.each(benches)(
  "$title executes the same register through focused stages, independent of noisy counts",
  async (step) => {
    const request = vi
      .spyOn(registerApi, "runRegister")
      .mockResolvedValue(reading);
    const solved = vi.fn();
    render(<RegisterBench step={step} onSolved={solved} />);
    expect(
      screen.getByRole("tab", { name: "Math" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.queryByRole("button", { name: /Run the register/ }),
    ).toBeNull();
    stage("Run");
    const solution = solutions[step.title];
    expect(solution).toBeDefined();
    for (const item of solution) put(item.piece, item.column, item.wire);
    expect(request).not.toHaveBeenCalled();
    stage("Run");
    expect(
      screen.getAllByRole("group", { name: "Circuit controls" }),
    ).toHaveLength(1);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Run the register/ })),
    );
    expect(request).toHaveBeenCalledWith(
      step.qubits,
      step.start,
      solution.map((item) => item.op),
    );
    expect(solved).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("tab", { name: "Results" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByRole("region", { name: "Observed counts" }).textContent,
    ).toContain("239");
    expect(
      screen.queryByRole("button", { name: /Run the register/ }),
    ).toBeNull();
    act(() => useLocale.setState({ locale: "es" }));
    expect(
      screen.getByRole("region", { name: "Conteos observados" }).textContent,
    ).toContain("239");
    expect(request).toHaveBeenCalledTimes(1);
    act(() => useLocale.setState({ locale: "en" }));
    stage("Run");
    const first = solution[0];
    const cell =
      first.op === "H" || first.op.startsWith("oracle:")
        ? new RegExp(`^slot ${first.column}:`)
        : new RegExp(`^Wire q₁ · slot ${first.column}:`);
    fireEvent.click(screen.getByRole("button", { name: cell }));
    expect(
      (screen.getByRole("tab", { name: "Results" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Clear line" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear line" }));
    for (const item of solution) put(item.piece, item.column, item.wire);
    expect(request).toHaveBeenCalledTimes(1);
  },
);

it("validates filled columns before submission and blocks duplicate runs while busy", async () => {
  const step = benches.find((step) => step.title === "One full round")!;
  let finish!: (result: RegisterResult) => void;
  const request = vi.spyOn(registerApi, "runRegister").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const solved = vi.fn(),
    busy = vi.fn();
  const view = render(
    <RegisterBench step={step} onSolved={solved} onBusyChange={busy} />,
  );
  stage("Run");
  fireEvent.click(screen.getByRole("button", { name: /Run the register/ }));
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain("Fill every slot");
  stage("Run");
  for (const item of solutions[step.title]) put(item.piece, item.column);
  stage("Run");
  fireEvent.click(screen.getByRole("button", { name: /Run the register/ }));
  fireEvent.click(screen.getByRole("button", { name: /Running circuit/ }));
  expect(request).toHaveBeenCalledTimes(1);
  expect(
    (screen.getByRole("tab", { name: "Run" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Clear line" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  view.unmount();
  await act(async () => finish(reading));
  expect(solved).not.toHaveBeenCalled();
  expect(busy).toHaveBeenLastCalledWith(false);
});

it("Vera runs the chosen repeat count, retries errors explicitly, and clears back to zero rounds", async () => {
  const step = FOUNDRY_NPCS.flatMap((npc) => npc.steps).find(
    (step): step is RoundsStep => step.kind === "rounds",
  )!;
  const request = vi
    .spyOn(registerApi, "runRegister")
    .mockRejectedValueOnce(new Error("Provider unavailable"))
    .mockResolvedValue({ ...reading, bits: 3 });
  const solved = vi.fn(),
    edited = vi.fn();
  render(<RoundsDial step={step} onSolved={solved} onEdited={edited} />);
  stage("Run");
  fireEvent.click(screen.getByRole("button", { name: "One round more" }));
  fireEvent.click(screen.getByRole("button", { name: "One round more" }));
  expect(request).not.toHaveBeenCalled();
  stage("Run");
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: /Run these rounds/ })),
  );
  expect(screen.getByRole("alert").textContent).toBe("Provider unavailable");
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: /Run these rounds/ })),
  );
  expect(request).toHaveBeenLastCalledWith(3, "000", [
    "H",
    "oracle:101",
    "D",
    "oracle:101",
    "D",
  ]);
  expect(solved).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("tab", { name: "Results" }).getAttribute("aria-selected"),
  ).toBe("true");
  act(() => useLocale.setState({ locale: "es" }));
  expect(
    screen.getByRole("region", { name: "Conteos observados" }).textContent,
  ).toContain("239");
  act(() => useLocale.setState({ locale: "en" }));
  stage("Run");
  fireEvent.click(screen.getByRole("button", { name: "One round more" }));
  expect(
    (screen.getByRole("tab", { name: "Results" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
  expect(
    (
      screen.getByRole("button", {
        name: "One round fewer",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(request).toHaveBeenCalledTimes(2);
  expect(edited).toHaveBeenCalled();
});

it("the workshop removes one box, clears and rebuilds without executing a job; busy edits are refused", () => {
  const request = vi.spyOn(registerApi, "runRegister");
  const changes = vi.fn();
  function Workshop({
    busy = false,
    measurement = null,
  }: Pick<
    ComponentProps<typeof GroverCircuitBuilder>,
    "busy" | "measurement"
  >) {
    const [slots, setSlots] = useState<CircuitSlots>({ ...EMPTY_SLOTS });
    return (
      <GroverCircuitBuilder
        slots={slots}
        onChange={(next) => {
          changes(next);
          setSlots(next);
        }}
        tray={["h", "oracle", "diffuser", "m"]}
        showLoop
        showMeasure
        repeat={3}
        onRepeat={null}
        busy={busy}
        measurement={measurement}
      />
    );
  }
  const view = render(<Workshop />);
  const addH = () => {
    fireEvent.click(
      screen.getByRole("button", { name: "H on all four qubits" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare the register: Empty" }),
    );
  };
  addH();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Prepare the register: H on all four qubits",
    }),
  );
  expect(
    screen.getByRole("button", { name: "Prepare the register: Empty" }),
  ).toBeTruthy();
  addH();
  fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
  addH();
  expect(changes).toHaveBeenLastCalledWith({ ...EMPTY_SLOTS, init: "h" });
  const count = changes.mock.calls.length;
  view.rerender(<Workshop busy />);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Prepare the register: H on all four qubits",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
  expect(changes).toHaveBeenCalledTimes(count);
  view.rerender(<Workshop />);
  fireEvent.click(
    screen.getByRole("button", { name: "M · measure all four qubits" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Measure: Empty" }));
  const measuredCount = changes.mock.calls.length;
  view.rerender(
    <Workshop
      measurement={{
        ...reading,
        bits: 4,
        counts: { "1001": 1 },
        probabilities: { "1001": 0.96 },
      }}
    />,
  );
  expect(screen.queryByRole("button", { name: "Clear circuit" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Prepare the register: H on all four qubits",
    }),
  );
  expect(changes).toHaveBeenCalledTimes(measuredCount);
  fireEvent.click(
    screen.getByRole("button", { name: "Explore what the M block measured" }),
  );
  expect(
    screen.getByRole("dialog", { name: "What the M block read" }),
  ).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});
