import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ActNumber } from "@/content/types";
import { LaptopScene } from "@/components/LaptopScene";
import type { LaptopShell } from "@/components/LaptopShell";
import type { PuzzlePiece, PuzzleSlot } from "@/components/PuzzleDragDrop";
import { useGame } from "@/game/state";
import { captureRsa, restoreRsa } from "@/game/town";
import { useLocale } from "@/i18n";
import { api } from "@/lib/api";
import * as effects from "@/game/effects";

vi.mock("@/engine/bus", () => ({ bus: { send: vi.fn(async () => {}) } }));
vi.mock("@/game/audio", () => ({
  gameAudio: { playSfx: vi.fn(), playSynth: vi.fn() },
}));
vi.mock("@/components/LaptopShell", () => ({
  LaptopShell: ({
    open,
    onClose,
    memory,
    children,
  }: ComponentProps<typeof LaptopShell>) => (
    <div hidden={!open}>
      <button onClick={onClose}>Close laptop</button>
      {memory}
      {children}
    </div>
  ),
}));
vi.mock("@/components/PuzzleDragDrop", () => ({
  PuzzleDragDrop: ({ children }: { children: ReactNode }) => <>{children}</>,
  PuzzlePiece: ({
    children,
    label,
    onSelect,
  }: ComponentProps<typeof PuzzlePiece>) => (
    <button aria-label={label} onClick={onSelect}>
      {children}
    </button>
  ),
  PuzzleSlot: ({
    children,
    label,
    onSelect,
  }: ComponentProps<typeof PuzzleSlot>) => (
    <button aria-label={label} onClick={onSelect}>
      {children}
    </button>
  ),
}));
function enter(act: ActNumber) {
  const store = useGame.getState();
  store.resetRun(act);
  useGame.setState({
    laptopOpen: true,
    waitingFor: "workbench",
    panel: "workbench",
    phase: "dialog",
  });
  if (act >= 3) {
    store.setVars({ modulus: 21, e: 5, cipherNumber: 11, shift: 12, base: 2 });
    store.setCapture({ scheme: "RSA, e=5 N=21", payload: "c = 11" });
  }
}
const notes = () => within(screen.getByRole("region", { name: "Notes" }));
function place(piece: string, slot: string) {
  fireEvent.click(screen.getByRole("button", { name: piece }));
  fireEvent.click(screen.getByRole("button", { name: slot }));
}
beforeEach(() => {
  useLocale.setState({ locale: "en" });
  enter(1);
  vi.spyOn(api.ibm, "batches").mockResolvedValue({ batches: [] });
  vi.spyOn(effects, "runApiCall").mockResolvedValue(); // Courtesy confirmation after the hand factorization.
});
afterEach(cleanup);

it("progresses from plaintext through Caesar and RSA with only the active act's earned notes, and restores without requests", async () => {
  const keyboard = vi.spyOn(api, "keyboard").mockResolvedValue({
    keys: Array.from({ length: 26 }, (_, i) => ({
      char: String.fromCharCode(65 + i),
      value: i + 1,
    })),
  } as Awaited<ReturnType<typeof api.keyboard>>);
  const quantum = vi.spyOn(api.shor, "simulate");
  useGame.getState().setVars({ values: "3 1 6 5", shift: 20 });
  useGame.getState().setCapture({ scheme: "raw numbers", payload: "3 1 6 5" });
  const view = render(<LaptopScene act={1} />);
  expect(notes().queryByText("Caesar shift k")).toBeNull();
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Fetch alphabet table" }),
    ),
  );
  for (const name of ["C 3", "A 1", "F 6", "E 5"])
    fireEvent.click(screen.getByRole("button", { name }));
  expect(useGame.getState().vars.recovered).toBe("CAFE");
  expect(notes().getByText("Alphabet encoding")).toBeTruthy();
  expect(notes().queryByText(/shift|exponent|Totient/i)).toBeNull();

  act(() => {
    enter(2);
    useGame.getState().setVars({ cipherText: "OMRQ", shift: 12 });
    useGame
      .getState()
      .setCapture({ scheme: "Caesar, shift unknown", payload: "OMRQ" });
    useGame
      .getState()
      .setLabMemory({ candidates: [{ shift: 12, word: "CAFE" }] });
  });
  view.rerender(<LaptopScene act={2} />);
  expect(notes().getByText("Run a tool")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Shift k = 12.*CAFE/ }));
  expect(notes().getByText("Caesar shift k")).toBeTruthy();
  expect(notes().getByText("12")).toBeTruthy();
  expect(notes().queryByText("Alphabet encoding")).toBeNull();

  act(() => enter(3));
  view.rerender(<LaptopScene act={3} />);
  expect(notes().getByText("Modulus N")).toBeTruthy();
  expect(
    notes().queryByText(/Caesar|Totient|Private exponent|Prime factors/),
  ).toBeNull();
  place("3", "first prime");
  place("7", "second prime");
  expect(notes().getByText("Prime factors p, q")).toBeTruthy();
  expect(notes().queryByText("Totient φ(N)")).toBeNull();
  place("2", "p minus one");
  place("6", "q minus one");
  place("12", "the product φ(N)");
  expect(notes().getByText("Totient φ(N)")).toBeTruthy();
  expect(notes().getByText("12")).toBeTruthy();
  expect(notes().queryByText("Private exponent d")).toBeNull();
  place("5, 5 × 5 = 25", "private exponent d");
  expect(notes().getByText("Private exponent d")).toBeTruthy();
  const saved = JSON.parse(JSON.stringify(captureRsa()));
  view.unmount();
  act(() => {
    useGame.getState().resetRun(1);
    restoreRsa(saved);
    useGame.getState().setLaptopOpen(true);
  });
  const restored = render(<LaptopScene act={3} />);
  expect(notes().getByText("Private exponent d")).toBeTruthy();
  fireEvent.click(screen.getByText("Close laptop"));
  act(() => useGame.getState().setLaptopOpen(true));
  act(() => useLocale.setState({ locale: "es" }));
  const spanish = within(screen.getByRole("region", { name: "Notas" }));
  expect(spanish.getByText("Totiente de Euler φ(N)")).toBeTruthy();
  expect(spanish.queryByText(/César/)).toBeNull();
  expect(keyboard).toHaveBeenCalledTimes(1);
  expect(quantum).not.toHaveBeenCalled();
  expect(effects.runApiCall).toHaveBeenCalledTimes(1);
  act(() => {
    enter(3);
    useLocale.setState({ locale: "en" });
  });
  restored.unmount();
  render(<LaptopScene act={3} />);
  expect(
    notes().queryByText(/Prime factors|Totient|Private exponent/),
  ).toBeNull();
});

it("Act 4 shows returned pipeline evidence, and editing its configuration removes those notes immediately", () => {
  enter(4);
  useGame.getState().setVars({ p: 3, q: 7, d: 5, order: 6, recovered: "B" });
  useGame.getState().setLabMemory({
    shor4: {
      wired: [],
      backend: "aer",
      m: 4,
      shots: 128,
      run: {
        N: 21,
        a: 2,
        m: 4,
        backend: "aer",
        qpu: "Saved device",
        picked: "011",
        counts: { "011": 128 },
        fromReference: false,
      },
    },
  });
  const submit = vi.spyOn(api.shor, "simulate");
  render(<LaptopScene act={4} />);
  expect(notes().getByText("Period r")).toBeTruthy();
  expect(notes().getByText("Totient φ(N)")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Run" }));
  fireEvent.click(
    within(screen.getByRole("region", { name: "Classical input" })).getByRole(
      "button",
      { name: "4" },
    ),
  );
  expect(notes().getByText("Modulus N")).toBeTruthy();
  expect(
    notes().queryByText(/Period|Totient|Prime factors|Private exponent/),
  ).toBeNull();
  expect(submit).not.toHaveBeenCalled();
});

it("legacy RSA checkpoints with no workshop evidence retain their data but cannot reveal private notes", () => {
  enter(3);
  useGame.getState().setVars({ p: 3, q: 7, d: 5, recovered: "B", shift: 12 });
  const saved = captureRsa();
  const legacy = { ...saved, labMemory: undefined } as unknown as typeof saved;
  restoreRsa(legacy);
  useGame.getState().setLaptopOpen(true);
  render(<LaptopScene act={3} />);
  expect(notes().getByText("Public exponent e")).toBeTruthy();
  expect(
    notes().queryByText(/Private|Totient|Caesar|Prime factors/),
  ).toBeNull();
  expect(useGame.getState().vars.d).toBe(5);
  expect(useGame.getState().vars.recovered).toBe("B");
});

it("keeps a selected CAFE candidate and its shift through language changes and laptop reopen", () => {
  enter(2);
  useGame.getState().setVars({ cipherText: "FDIH", recovered: null });
  useGame
    .getState()
    .setCapture({ scheme: "Caesar, shift unknown", payload: "FDIH" });
  useGame.getState().setLabMemory({ candidates: [{ shift: 3, word: "CAFE" }] });
  const crack = vi.spyOn(api.caesar, "crack");
  const view = render(<LaptopScene act={2} />);
  expect(screen.getByText(/CAFE means café/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Shift k = 3.*CAFE/ }));
  expect(screen.getByText(/You selected a candidate message/)).toBeTruthy();
  const saved = JSON.stringify(captureRsa());
  act(() => useLocale.getState().setLocale("es"));
  expect(screen.getByText(/CAFE significa café/)).toBeTruthy();
  expect(screen.getByText(/Seleccionaste un posible mensaje/)).toBeTruthy();
  expect(JSON.stringify(captureRsa())).toBe(saved);
  view.unmount();
  render(<LaptopScene act={2} />);
  expect(screen.getByText(/Seleccionaste un posible mensaje/)).toBeTruthy();
  expect(useGame.getState().vars.recovered).toBe("CAFE");
  expect(useGame.getState().vars.shift).toBe(3);
  expect(crack).not.toHaveBeenCalled();
});
