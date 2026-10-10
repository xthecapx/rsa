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
import { groverApi, GroverRefusal } from "@/lib/grover";
import { vaultApi, VaultRefusal } from "@/lib/vault";
import { useLocale } from "@/i18n";
import { useProgress } from "@/game/progress";
import { useMedals } from "@/game/medals";
import type { GameShell } from "@/components/GameShell";
import type { LaptopShell } from "@/components/LaptopShell";
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
  PuzzlePiece: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PuzzleSlot: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
