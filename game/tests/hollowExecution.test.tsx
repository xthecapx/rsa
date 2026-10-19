import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RegisterBench } from "@/components/RegisterBench";
import { QubitBench } from "@/components/QubitBench";
import {
  BvCircuitBuilder,
  EMPTY_BV,
  GroverTrapBuilder,
  EMPTY_TRAP,
  bvProblem,
  type BvSlots,
  type TrapSlots,
} from "@/components/VaultChallenges";
import { HOLLOW_NPCS } from "@/content/hollow";
import type { BenchStep, RegisterStep } from "@/content/knowledge";
import type { RegOp } from "@/game/register";
import * as registerApi from "@/lib/register";
import { coinApi } from "@/lib/coin";
import { vaultApi } from "@/lib/vault";
import { useLocale } from "@/i18n";
import type { PuzzlePiece, PuzzleSlot } from "@/components/PuzzleDragDrop";

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
beforeEach(() => useLocale.setState({ locale: "en" }));
afterEach(cleanup);

const registers = HOLLOW_NPCS.flatMap((npc) => npc.steps).filter(
  (step): step is RegisterStep => step.kind === "register",
);
const solutions: Record<
  string,
  { piece: string; column: number; wire: string; op: RegOp }[]
> = {
  "Pull the rope": [
    { piece: "CNOT · flips the helper", column: 1, wire: "q₁", op: "CX1" },
  ],
  "Rope at rest": [
    { piece: "CNOT · flips the helper", column: 1, wire: "q₁", op: "CX1" },
  ],
  "Push the spirit": [
    { piece: "H gate · one wire", column: 1, wire: "q₁", op: "h1" },
    { piece: "H gate · one wire", column: 1, wire: "helper", op: "h2" },
    { piece: "CNOT · flips the helper", column: 2, wire: "q₁", op: "CX1" },
  ],
  "Read the push": [
    { piece: "H gate · one wire", column: 1, wire: "q₁", op: "h1" },
    { piece: "H gate · one wire", column: 1, wire: "helper", op: "h2" },
    { piece: "CNOT · flips the helper", column: 2, wire: "q₁", op: "CX1" },
    { piece: "H gate · one wire", column: 3, wire: "q₁", op: "h1" },
  ],
  "Ask one tumbler": [
    { piece: "X gate · flip", column: 1, wire: "q₂", op: "X2" },
  ],
  "One swing": [
    { piece: "H box · every qubit", column: 1, wire: "q₁", op: "H" },
    { piece: "Oracle · the ghost", column: 2, wire: "q₁", op: "ghost:10" },
    { piece: "H box · every qubit", column: 3, wire: "q₁", op: "H" },
  ],
};
function stage(name: string) {
  fireEvent.click(screen.getByRole("tab", { name }));
}
function put(item: { piece: string; column: number; wire: string }) {
  fireEvent.click(screen.getByRole("button", { name: item.piece }));
  fireEvent.click(
    screen.getByRole("button", {
      name: `Wire ${item.wire} · slot ${item.column}: Empty`,
    }),
  );
}
it.each(registers)(
  "$title preserves helper ordering, fixed ghosts and ideal correctness through the guided flow",
  async (step) => {
    const bits = step.qubits;
    const counts = { ["0".repeat(bits)]: 239, ["1".repeat(bits)]: 17 };
    const request = vi.spyOn(registerApi, "runRegister").mockResolvedValue({
      bits,
      backend: "Selected noise device",
      source: "simulator",
      kind: "noise",
      counts,
      shots: 256,
    });
    const solved = vi.fn(),
      edited = vi.fn();
    const view = render(
      <RegisterBench step={step} onSolved={solved} onEdited={edited} />,
    );
    expect(
      screen.getByRole("tab", { name: "Math" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByRole("region", {
        name: "Ideal wire states before measurement",
      }),
    ).toBeTruthy();
    stage("Run");
    const solution = solutions[step.title];
    expect(solution).toBeDefined();
    solution.forEach(put);
    expect(request).not.toHaveBeenCalled();
    if (solution.some((item) => item.op.startsWith("CX"))) {
      expect(
        screen.getByRole("button", { name: /CNOT target · flips the helper/ }),
      ).toBeTruthy();
    }
    stage("Math");
    const wires = screen.getByRole("region", {
      name: "Ideal wire states before measurement",
    });
    if (step.title === "Push the spirit")
      expect(wires.textContent).toContain("q₁ |−⟩helper |−⟩");
    if (step.title === "Read the push")
      expect(wires.textContent).toContain("q₁ |1⟩helper |−⟩");
    if (step.title === "One swing")
      expect(wires.textContent).toContain("q₁ |1⟩q₂ |0⟩helper |1⟩");
    stage("Run");
    expect(
      screen.getAllByRole("group", { name: "Circuit controls" }),
    ).toHaveLength(1);
    expect(
      screen.getByText(/This practice measures the data wires and the helper/),
    ).toBeTruthy();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Run the register/ })),
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(step.qubits, step.start, [
      ...solution.map((item) => item.op),
      ...(step.fixed ?? []),
    ]);
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
    ).toContain("Selected noise device");
    expect(screen.getByText(/el último dígito es el auxiliar/)).toBeTruthy();
    act(() => useLocale.setState({ locale: "en" }));
    stage("Run");
    const first = solution[0];
    fireEvent.click(
      screen.getByRole("button", {
        name:
          first.op === "H"
            ? /^slot 1:/
            : new RegExp(`^Wire ${first.wire} · slot ${first.column}:`),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear line" }));
    expect(edited).toHaveBeenCalled();
    expect(
      (screen.getByRole("tab", { name: "Results" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    solution.forEach(put);
    expect(request).toHaveBeenCalledTimes(1);
    view.unmount();
  },
);

it("a CNOT refuses a helper control, removes its linked target, and never invents a pure state for entangled wires", () => {
  const step = registers.find((step) => step.title === "Push the spirit")!;
  render(<RegisterBench step={step} onSolved={vi.fn()} />);
  stage("Run");
  fireEvent.click(
    screen.getByRole("button", { name: "CNOT · flips the helper" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Wire helper · slot 1: Empty" }),
  );
  expect(screen.getByRole("status").textContent).toContain(
    "A CNOT’s control dot goes on a data wire",
  );
  // Deselect the invalid piece before assembling H on the data wire only.
  fireEvent.click(
    screen.getByRole("button", { name: "CNOT · flips the helper" }),
  );
  put({ piece: "H gate · one wire", column: 1, wire: "q₁" });
  put({ piece: "CNOT · flips the helper", column: 2, wire: "q₁" });
  stage("Math");
  expect(
    screen.getByText(
      "The wires are tangled together: no single state per wire.",
    ),
  ).toBeTruthy();
  stage("Run");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Wire helper · slot 2: CNOT target · flips the helper",
    }),
  );
  expect(
    screen.getByRole("button", { name: "Wire q₁ · slot 2: Empty" }),
  ).toBeTruthy();
});

const candles = HOLLOW_NPCS.flatMap((npc) => npc.steps).filter(
  (step): step is BenchStep => step.kind === "bench",
);
it.each(candles)(
  "$title uses the single-qubit flow and preserves the candle's starting state",
  async (step) => {
    const request = vi.spyOn(coinApi, "circuit").mockResolvedValue({
      backend: "Selected noise device",
      kind: "noise",
      source: "simulator",
      shots: 256,
      circuits: step.cases.map(({ start }) => ({
        start,
        counts: { "0": 119, "1": 137 },
        probabilities: { "0": 0.5, "1": 0.5 },
      })),
    });
    const solved = vi.fn();
    render(<QubitBench step={step} onSolved={solved} />);
    stage("Run");
    const gates = step.slots === 2 ? ["X", "H"] : ["X"];
    gates.forEach((gate, i) => {
      fireEvent.click(
        screen.getByRole("button", {
          name: gate === "X" ? "X gate · flip" : "Hadamard · H",
        }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: `Wire slot ${i + 1}: Empty` }),
      );
    });
    stage("Run");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Run circuit/ })),
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(
      step.cases.map(({ start }) => start),
      gates,
    );
    expect(solved).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("region", { name: "Observed counts" }).textContent,
    ).toContain("137");
    expect(
      screen.getByText(
        "Ideal state after your gates, before measurement. Backend counts do not reconstruct this state.",
      ),
    ).toBeTruthy();
  },
);

it("Ghost Key's builder removes one box, clears/rebuilds, and locks edits while retaining the final M explorer", () => {
  const request = vi.spyOn(vaultApi, "run");
  const changes = vi.fn();
  function Builder({
    busy = false,
    locked = false,
    measurement = null,
  }: Partial<ComponentProps<typeof BvCircuitBuilder>>) {
    const [slots, setSlots] = useState<BvSlots>({ ...EMPTY_BV });
    return (
      <BvCircuitBuilder
        slots={slots}
        onChange={(next) => {
          changes(next);
          setSlots(next);
        }}
        locked={locked}
        busy={busy}
        measurement={measurement}
      />
    );
  }
  const view = render(<Builder />);
  const add = (piece: string, slot: string) => {
    const choices = screen.getAllByRole("button", { name: piece });
    fireEvent.click(choices[0]);
    fireEvent.click(screen.getByRole("button", { name: `${slot}: Empty` }));
  };
  add("Prepare the helper in |−⟩", "Helper wire · state");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Helper wire · state: Prepare the helper in |−⟩",
    }),
  );
  expect(changes).toHaveBeenLastCalledWith(EMPTY_BV);
  add("Prepare the helper in |−⟩", "Helper wire · state");
  fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
  add("H on all 25 data qubits", "Data bus · before the ghost");
  add("H on all 25 data qubits", "Data bus · after the ghost");
  // The two distinct H pieces can be placed independently.
  // The first H was moved by the preceding selection; use the other tray piece.
  fireEvent.click(
    screen.getAllByRole("button", { name: "H on all 25 data qubits" })[1],
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Data bus · before the ghost: Empty" }),
  );
  add("Prepare the helper in |−⟩", "Helper wire · state");
  add("M · measure all 25 data qubits", "Measure");
  expect(bvProblem(changes.mock.lastCall![0])).toBeNull();
  const count = changes.mock.calls.length;
  view.rerender(<Builder busy />);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Helper wire · state: Prepare the helper in |−⟩",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
  expect(changes).toHaveBeenCalledTimes(count);
  view.rerender(
    <Builder
      locked
      measurement={{
        bits: 25,
        counts: { ["1".repeat(25)]: 1 },
        source: "simulator",
        backend: "Selected device",
      }}
    />,
  );
  expect(screen.queryByRole("button", { name: "Clear circuit" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Explore what the M block measured" }),
  );
  expect(
    screen.getByRole("dialog", { name: "What the M block read" }),
  ).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});

it("the Grover comparison supports removal and clear, but its locked preview never edits or executes", () => {
  const request = vi.spyOn(vaultApi, "run");
  const changes = vi.fn();
  function Builder({ locked = false }: { locked?: boolean }) {
    const [slots, setSlots] = useState<TrapSlots>({ ...EMPTY_TRAP });
    return (
      <GroverTrapBuilder
        slots={slots}
        onChange={(next) => {
          changes(next);
          setSlots(next);
        }}
        repeatLabel="?"
        locked={locked}
      />
    );
  }
  const view = render(<Builder />);
  const addH = () => {
    fireEvent.click(screen.getByRole("button", { name: "H on all 25 qubits" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare the register: Empty" }),
    );
  };
  addH();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Prepare the register: H on all 25 qubits",
    }),
  );
  expect(changes).toHaveBeenLastCalledWith(EMPTY_TRAP);
  addH();
  fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
  addH();
  const count = changes.mock.calls.length;
  view.rerender(<Builder locked />);
  expect(screen.queryByRole("button", { name: "Clear circuit" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Prepare the register: H on all 25 qubits",
    }),
  );
  expect(changes).toHaveBeenCalledTimes(count);
  expect(request).not.toHaveBeenCalled();
});
