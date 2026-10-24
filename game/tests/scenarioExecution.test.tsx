import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CoinScenario } from "@/components/CoinScenario";
import { GroverScenario, GROVER_SAVE_KEY } from "@/components/GroverScenario";
import { VaultScenario, VAULT_SAVE_KEY } from "@/components/VaultScenario";
import { coinApi, type CoinResult } from "@/lib/coin";
import { groverApi, GroverRefusal, type GroverRun } from "@/lib/grover";
import { vaultApi, VaultRefusal } from "@/lib/vault";
import { useLocale } from "@/i18n";
import { useProgress } from "@/game/progress";
import { useMedals } from "@/game/medals";
import type { GameShell } from "@/components/GameShell";
import type { LaptopShell } from "@/components/LaptopShell";
import type { PuzzlePiece, PuzzleSlot } from "@/components/PuzzleDragDrop";
import { QuantumEqualizer } from "@/components/GroverChallenges";
import { gameAudio } from "@/game/audio";
vi.mock("@/game/audio", () => ({
  gameAudio: { playSfx: vi.fn(), playSynth: vi.fn(), playMusic: vi.fn() },
}));
vi.mock("@/components/useSceneAssets", () => ({
  useCoinSceneAssets: () => "ready",
  useGroverSceneAssets: () => "ready",
  useVaultSceneAssets: () => "ready",
}));
vi.mock("@/components/GameShell", () => ({
  GameShell: ({
    children,
    onBack,
    backDisabled,
  }: ComponentProps<typeof GameShell>) => (
    <>
      <button disabled={backDisabled} onClick={onBack}>
        Leave
      </button>
      {children}
    </>
  ),
}));
vi.mock("@/components/LaptopShell", () => ({
  LaptopShell: ({
    open,
    children,
    onClose,
    closeDisabled,
  }: ComponentProps<typeof LaptopShell>) => (
    <div hidden={!open}>
      <button disabled={closeDisabled} onClick={onClose}>
        Close laptop
      </button>
      {children}
    </div>
  ),
}));
// Replace only the room's rendering/movement. Real lesson state, save migrations,
// controls, API policies and responses remain under test.
vi.mock("@/components/CoinHouse", () => ({
  CoinHouse: ({
    target,
    onInteract,
  }: {
    target: "table";
    onInteract: (place: "table") => void;
  }) => <button onClick={() => onInteract(target)}>Interact</button>,
}));
vi.mock("@/components/GroverHouse", () => ({
  GroverHouse: ({
    target,
    onInteract,
  }: {
    target: "core";
    onInteract: (place: "core") => void;
  }) => <button onClick={() => onInteract(target)}>Interact</button>,
}));
vi.mock("@/components/VaultHouse", () => ({
  VaultHouse: ({
    target,
    onInteract,
  }: {
    target: "desk";
    onInteract: (place: "desk") => void;
  }) => <button onClick={() => onInteract(target)}>Interact</button>,
}));
vi.mock("@/components/StartOverControl", () => ({
  StartOverControl: () => null,
}));
vi.mock("@/components/MedalCase", () => ({ MedalReveal: () => null }));
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
beforeEach(() => {
  localStorage.clear();
  useLocale.setState({ locale: "en" });
  useProgress.setState({ completed: {} });
  useMedals.setState({ earned: {}, fresh: null });
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});
function open() {
  fireEvent.click(screen.getByText("Interact"));
}
const final: CoinResult = {
  hadamard: true,
  shots: 1,
  bits: [1],
  counts: { "0": 0, "1": 1 },
  probabilities: { "0": 0.5, "1": 0.5 },
  backend: "Selected device",
  kind: "noise",
  source: "simulator",
};
it("saves Coin's final toss once; busy blocks leaving/closing, and refresh or language changes never reroll it", async () => {
  localStorage.setItem(
    "quantum-coin-session-v1",
    JSON.stringify({
      step: "table",
      place: "table",
      line: 999,
      practice: [],
      replay: [],
      batches: [],
    }),
  );
  let finish!: (result: CoinResult) => void;
  const request = vi.spyOn(coinApi, "simulate").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<CoinScenario onExit={vi.fn()} />);
  open();
  fireEvent.click(screen.getByRole("button", { name: "Agree & toss once" }));
  fireEvent.click(screen.getByRole("button", { name: "Agree & toss once" }));
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(true, 1, true);
  expect((screen.getByText("Leave") as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByText("Close laptop") as HTMLButtonElement).disabled).toBe(
    true,
  );
  await act(async () => finish(final));
  expect(
    JSON.parse(localStorage.getItem("quantum-coin-session-v1")!).winner,
  ).toBe(1);
  expect(
    JSON.parse(localStorage.getItem("quantum-coin-session-v1")!).step,
  ).toBe("done");
  view.unmount();
  render(<CoinScenario />);
  open();
  act(() => useLocale.setState({ locale: "es" }));
  expect(
    JSON.parse(localStorage.getItem("quantum-coin-session-v1")!).winner,
  ).toBe(1);
  expect(request).toHaveBeenCalledTimes(1);
});
it("preserves Grover's domain refusal and supports explicit retry, without saving a late result", async () => {
  localStorage.setItem(
    GROVER_SAVE_KEY,
    JSON.stringify({
      step: "measure",
      place: "core",
      line: 999,
      token: "device",
      repeat: 3,
      slots: { init: "h", loop0: "oracle", loop1: "diffuser", measure: "m" },
    }),
  );
  let reject!: (cause: Error) => void;
  const request = vi
    .spyOn(groverApi, "run")
    .mockRejectedValueOnce(new GroverRefusal("rounds"))
    .mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
  const view = render(<GroverScenario />);
  open();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Collapse" })),
  );
  expect(
    screen.getByText(
      "Thecap: not at this count. The board said how many rounds make the tallest bar peak.",
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
  fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
  await act(async () => {});
  expect(request).toHaveBeenCalledTimes(2);
  view.unmount();
  await act(async () => reject(new Error("Late failure")));
  expect(
    JSON.parse(localStorage.getItem(GROVER_SAVE_KEY)!).measured,
  ).toBeNull();
});
it("preserves Ghost Key's helper refusal and its saved circuit on laptop reopen", async () => {
  localStorage.setItem(
    VAULT_SAVE_KEY,
    JSON.stringify({
      step: "execute",
      place: "desk",
      line: 999,
      token: "device",
      bv: { prep: "h", helper: "minus", out: "h2", measure: "m", repeat: null },
    }),
  );
  const request = vi
    .spyOn(vaultApi, "run")
    .mockRejectedValue(new VaultRefusal("helper"));
  render(<VaultScenario />);
  open();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Execute (1 Query)" })),
  );
  expect(
    screen.getByText(
      "Notes: the core refused. The helper must be |−⟩ for the answer to become a phase.",
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByText("Close laptop"));
  open();
  act(() => useLocale.setState({ locale: "es" }));
  expect(JSON.parse(localStorage.getItem(VAULT_SAVE_KEY)!).bv.helper).toBe(
    "minus",
  );
  expect(request).toHaveBeenCalledTimes(1);
});

it("restores Ghost Key's returned measurement after refresh without resubmission or waiting for its old reveal timer", async () => {
  const measured = "10101".repeat(5);
  localStorage.setItem(
    VAULT_SAVE_KEY,
    JSON.stringify({
      step: "execute",
      place: "desk",
      line: 999,
      token: "device",
      bv: { prep: "h", helper: "minus", out: "h2", measure: "m", repeat: null },
    }),
  );
  let finish!: (result: Awaited<ReturnType<typeof vaultApi.run>>) => void;
  const request = vi.spyOn(vaultApi, "run").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<VaultScenario />);
  open();
  fireEvent.click(screen.getByRole("button", { name: "Execute (1 Query)" }));
  fireEvent.click(screen.getByRole("button", { name: "Execute (1 Query)" }));
  await act(async () => {});
  expect(request).toHaveBeenCalledExactlyOnceWith("device", {
    prep: "h",
    out: "h",
    helper: "minus",
    measure: true,
    extra: [],
  });
  expect((screen.getByText("Close laptop") as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect((screen.getByText("Leave") as HTMLButtonElement).disabled).toBe(true);
  await act(async () =>
    finish({
      measured,
      queries: 1,
      shots: 1,
      counts: { [measured]: 1 },
      backend: "Selected QPU",
      source: "hardware",
      kind: "hardware",
      frames: [
        { block: "prep" },
        { block: "oracle" },
        { block: "out", bits: measured },
      ],
    }),
  );
  const saved = JSON.parse(localStorage.getItem(VAULT_SAVE_KEY)!);
  expect(saved.run.measured).toBe(measured);
  expect(saved.run.backend).toBe("Selected QPU");
  expect(saved.revealed).toBe(false);
  // Refresh while the original cosmetic reveal would still be playing.
  view.unmount();
  render(<VaultScenario />);
  open();
  expect(
    screen.getByRole("button", { name: "Take the mask to the vault →" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Execute (1 Query)" }),
  ).toBeNull();
  fireEvent.click(screen.getByText("Close laptop"));
  open();
  act(() => useLocale.setState({ locale: "es" }));
  expect(
    screen.getByRole("region", { name: "Conteos observados" }).textContent,
  ).toContain("Selected QPU");
  expect(JSON.parse(localStorage.getItem(VAULT_SAVE_KEY)!).run.measured).toBe(
    measured,
  );
  expect(request).toHaveBeenCalledTimes(1);
});

// Returned frames encode the circuit that produced the counts, independently of
// the currently selected repeat count. Final PINs still belong to their one shot.
function groverResult(
  rounds: number,
  measured: string | null = null,
): GroverRun {
  const amplitudes = Array(16).fill(0.25);
  const steps: GroverRun["steps"] = [
    { round: 0, block: "start", amplitudes: [1, ...Array(15).fill(0)] },
    { round: 0, block: "h", amplitudes },
  ];
  for (let round = 1; round <= rounds; round++) {
    steps.push(
      { round, block: "oracle", amplitudes },
      { round, block: "diffuser", amplitudes },
    );
  }
  return {
    steps,
    measured,
    labels: measured
      ? Array.from({ length: 16 }, (_, i) => i.toString(2).padStart(4, "0"))
      : null,
    counts: measured
      ? { "9": 1 }
      : { "0": rounds === 3 ? 246 : 149, "1": rounds === 3 ? 10 : 107 },
    shots: measured ? 1 : 256,
    backend: "Saved Grover device",
    kind: "noise",
    source: "simulator",
  };
}
function saveGrover(values: Record<string, unknown> = {}) {
  localStorage.setItem(
    GROVER_SAVE_KEY,
    JSON.stringify({
      step: "tuneRun",
      place: "desk",
      line: 999,
      token: "device",
      repeat: 4,
      slots: { init: "h", loop0: "oracle", loop1: "diffuser", measure: null },
      peaks: { 3: 0.96, 4: 0.58 },
      lastRun: groverResult(4),
      runKey: 2,
      ...values,
    }),
  );
}
const savedGrover = () => JSON.parse(localStorage.getItem(GROVER_SAVE_KEY)!);
function finishGroverConversation() {
  const reveal = screen.queryByRole("button", { name: /^Show text/ });
  if (reveal) fireEvent.click(reveal);
  fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
}
const emptyGroverPreview = () => {
  expect(screen.queryByRole("region", { name: "Observed counts" })).toBeNull();
  expect(
    screen.getByText("Run the circuit to see the quantum core’s inner view."),
  ).toBeTruthy();
  expect(savedGrover().lastRun).toBeNull();
};

it("clears the four-round preview when Measure at ×3 advances, retaining both comparison peaks without executing", async () => {
  saveGrover({ repeat: 3, lastRun: null, peaks: {} });
  const request = vi
    .spyOn(groverApi, "run")
    .mockImplementation(async (_token, circuit) =>
      groverResult(circuit.repeat),
    );
  render(<GroverScenario />);
  open();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Run ×3" })),
  );
  fireEvent.click(screen.getByRole("button", { name: "One round more" }));
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Run ×4" })),
  );
  expect(
    screen.getByRole("region", { name: "Observed counts" }).textContent,
  ).toContain("149");
  const peaks = savedGrover().peaks;
  expect(Object.keys(peaks)).toEqual(["3", "4"]);
  fireEvent.click(screen.getByRole("button", { name: "Measure at ×3 →" }));
  expect(savedGrover()).toMatchObject({
    step: "measure",
    repeat: 3,
    lastRun: null,
    peaks,
  });
  finishGroverConversation();
  emptyGroverPreview();
  expect(screen.getByText("×3")).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(2);
});

it("round controls, box edits and Clear discard current Grover counts while keeping historical round peaks", async () => {
  saveGrover();
  const request = vi.spyOn(groverApi, "run").mockResolvedValue(groverResult(3));
  render(<GroverScenario />);
  open();
  fireEvent.click(screen.getByRole("button", { name: "One round fewer" }));
  emptyGroverPreview();
  expect(savedGrover().peaks).toEqual({ 3: 0.96, 4: 0.58 });
  expect(request).not.toHaveBeenCalled();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Run ×3" })),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Repeat box · first: Oracle · sealed black box",
    }),
  );
  emptyGroverPreview();
  fireEvent.click(
    screen.getByRole("button", { name: "Add Oracle · sealed black box" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Repeat box · first: Empty" }),
  );
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Run ×3" })),
  );
  const peaks = savedGrover().peaks;
  fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
  emptyGroverPreview();
  expect(savedGrover().peaks).toEqual(peaks);
  expect(request).toHaveBeenCalledTimes(2);
});

it("returning from the whiteboard clears an earlier preview when resetting the repeat count", () => {
  saveGrover({ step: "tune", place: "board", boardSolved: true });
  const request = vi.spyOn(groverApi, "run");
  render(<GroverScenario />);
  open();
  fireEvent.click(screen.getByRole("button", { name: "Back to the laptop →" }));
  expect(savedGrover()).toMatchObject({
    step: "tuneRun",
    repeat: 1,
    lastRun: null,
    peaks: { 3: 0.96, 4: 0.58 },
  });
  open();
  finishGroverConversation();
  emptyGroverPreview();
  expect(request).not.toHaveBeenCalled();
});

it.each([
  { title: "matching preview", repeat: 4, loop0: "oracle", keep: true },
  {
    title: "old four-round preview relabeled as three",
    repeat: 3,
    loop0: "oracle",
    keep: false,
  },
  { title: "preview from different boxes", repeat: 4, loop0: "x", keep: false },
])(
  "restoring $title preserves only owned Grover evidence, without submission on reopen or language change",
  ({ repeat, loop0, keep }) => {
    saveGrover({
      repeat,
      slots: { init: "h", loop0, loop1: "diffuser", measure: null },
    });
    const request = vi.spyOn(groverApi, "run");
    const view = render(<GroverScenario />);
    open();
    expect(!!screen.queryByRole("region", { name: "Observed counts" })).toBe(
      keep,
    );
    expect(!!savedGrover().lastRun).toBe(keep);
    expect(savedGrover().peaks).toEqual({ 3: 0.96, 4: 0.58 });
    fireEvent.click(screen.getByText("Close laptop"));
    open();
    act(() => useLocale.setState({ locale: "es" }));
    expect(!!screen.queryByRole("region", { name: "Conteos observados" })).toBe(
      keep,
    );
    view.unmount();
    render(<GroverScenario />);
    open();
    expect(!!screen.queryByRole("region", { name: "Conteos observados" })).toBe(
      keep,
    );
    expect(request).not.toHaveBeenCalled();
  },
);

it("retains Grover's saved final PIN and measurement explorer through refresh and language changes", () => {
  const result = groverResult(3, "1001");
  saveGrover({
    step: "measure",
    repeat: 3,
    measured: "1001",
    lastRun: result,
    slots: { init: "h", loop0: "oracle", loop1: "diffuser", measure: "m" },
  });
  const request = vi.spyOn(groverApi, "run");
  const view = render(<GroverScenario />);
  open();
  fireEvent.click(
    screen.getByRole("button", { name: "Explore what the M block measured" }),
  );
  expect(
    screen.getByRole("dialog", { name: "What the M block read" }).textContent,
  ).toContain("Saved Grover device");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("button", { name: "Collapse" })).toBeNull();
  expect(
    (
      screen.getByRole("button", {
        name: "One round fewer",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  view.unmount();
  render(<GroverScenario />);
  open();
  act(() => useLocale.setState({ locale: "es" }));
  expect(
    screen.getByRole("region", { name: "Conteos observados" }).textContent,
  ).toContain("Saved Grover device");
  expect(savedGrover()).toMatchObject({ measured: "1001", lastRun: result });
  expect(request).not.toHaveBeenCalled();
});

it("stops the old Grover amplitude animation immediately when its preview is invalidated", () => {
  vi.useFakeTimers();
  const view = render(<QuantumEqualizer run={null} runKey={0} animate />);
  view.rerender(<QuantumEqualizer run={groverResult(4)} runKey={1} animate />);
  act(() => vi.advanceTimersByTime(520));
  const ticks = vi.mocked(gameAudio.playSynth).mock.calls.length;
  expect(ticks).toBeGreaterThan(0);
  view.rerender(<QuantumEqualizer run={null} runKey={1} animate />);
  act(() => vi.advanceTimersByTime(6000));
  expect(gameAudio.playSynth).toHaveBeenCalledTimes(ticks);
  expect(screen.queryByRole("img")).toBeNull();
  expect(
    screen.getByText("Run the circuit to see the quantum core’s inner view."),
  ).toBeTruthy();
});
