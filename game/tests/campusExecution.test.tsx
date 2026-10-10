import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CampusLaptop } from "@/components/CampusLaptop";
import { useCampus } from "@/game/campus";
import { useGame } from "@/game/state";
import { useProgress } from "@/game/progress";
import { useMedals } from "@/game/medals";
import { useLocale } from "@/i18n";
import { useSimulator } from "@/game/simulator";
import { runtimeInfo, setServiceTransport } from "@/lib/transport";
import { restoreCheckpoint } from "@/game/restoreCheckpoint";
import { CAMPUS_EXHIBITS } from "@/content/campus";
vi.mock("@/components/LaptopShell", () => ({
  LaptopShell: ({
    children,
    onClose,
    closeDisabled,
  }: {
    children: ReactNode;
    onClose: () => void;
    closeDisabled: boolean;
  }) => (
    <div>
      <button disabled={closeDisabled} onClick={onClose}>
        Close
      </button>
      {children}
    </div>
  ),
}));
// Tap/keyboard placement is game behavior; dnd-kit owns browser pointer geometry.
vi.mock("@/components/PuzzleDragDrop", () => ({
  PuzzleDragDrop: ({ children }: { children: ReactNode }) => <>{children}</>,
  PuzzlePiece: ({
    children,
    label,
    onSelect,
  }: {
    children: ReactNode;
    label: string;
    onSelect: () => void;
  }) => (
    <button aria-label={label} onClick={onSelect}>
      {children}
    </button>
  ),
  PuzzleSlot: ({
    children,
    label,
    onSelect,
  }: {
    children: ReactNode;
    label: string;
    onSelect: () => void;
  }) => (
    <button aria-label={label} onClick={onSelect}>
      {children}
    </button>
  ),
}));
const counts = {
  bits: 1,
  counts: { "0": 120, "1": 136 },
  probabilities: { "0": 0.5, "1": 0.5 },
  backend: "Teaching Aer",
  kind: "noise",
  source: "simulator",
  shots: 256,
  depth: 2,
  circuit_text: "H → M",
};
const run = () => screen.getByRole("button", { name: /^Run circuit ·/ });
function place(gate: string, slot: number) {
  fireEvent.click(screen.getByRole("button", { name: gate }));
  fireEvent.click(screen.getByRole("button", { name: `Circuit slot ${slot}` }));
}
beforeEach(async () => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  useCampus.getState().reset();
  useProgress.getState().reset();
  await useMedals.persist.rehydrate();
  useMedals.getState().reset();
  useGame.getState().resetRun(1);
  useLocale.setState({ locale: "en" });
  useSimulator.setState({ choice: "noise" });
  runtimeInfo.target = "web";
});
afterEach(() => {
  cleanup();
  setServiceTransport(null);
  vi.unstubAllGlobals();
});
it("all eight exhibits open without submitting any operation", () => {
  const transport = vi.fn();
  setServiceTransport(transport);
  for (const exhibit of CAMPUS_EXHIBITS) {
    const view = render(
      <CampusLaptop initial={exhibit.id} onClose={vi.fn()} />,
    );
    expect(screen.getByText(exhibit.brief)).toBeTruthy();
    expect(run()).toBeTruthy();
    view.unmount();
  }
  expect(transport).not.toHaveBeenCalled();
});
it("Run honors the per-player backend; language, help, refresh and reopen never resubmit", async () => {
  const transport = vi.fn(async (_path: string, _init?: RequestInit) =>
    Response.json(counts),
  );
  setServiceTransport(transport);
  const close = vi.fn();
  let view = render(<CampusLaptop initial="fountain" onClose={close} />);
  await act(async () => fireEvent.click(run()));
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][0]).toBe("/api/campus/run");
  expect(
    new Headers(transport.mock.calls[0][1]?.headers).get("X-Quantum-Simulator"),
  ).toBe("noise");
  expect(screen.getByText("120 · 46.9%")).toBeTruthy();
  act(() => useLocale.setState({ locale: "es" }));
  expect(screen.getByText("120 · 46.9%")).toBeTruthy();
  act(() => useLocale.setState({ locale: "en" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Campus field notebook" }),
  );
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "decoherence" },
  });
  expect(screen.getByText("The quiet room")).toBeTruthy();
  view.unmount();
  await act(async () => useCampus.persist.rehydrate());
  view = render(<CampusLaptop initial="fountain" onClose={close} />);
  expect(screen.getByText("120 · 46.9%")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(close).toHaveBeenCalledTimes(1);
  expect(transport).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByLabelText("Paint a relative minus with Z"));
  expect(useCampus.getState().sessions.fountain?.result).toBeNull();
  expect(screen.getByText("Compare earlier measurements")).toBeTruthy();
  expect(transport).toHaveBeenCalledTimes(1);
});
it("clearing an empty tape and deleting individual gates leaves every slot usable", async () => {
  const transport = vi.fn(async (_path: string, _init?: RequestInit) =>
    Response.json(counts),
  );
  setServiceTransport(transport);
  render(<CampusLaptop initial="delivery" onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
  place("X", 1);
  place("H", 2);
  expect(useCampus.getState().sessions.delivery?.settings.sequence).toEqual([
    "X",
    "H",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Circuit slot 1" }));
  expect(useCampus.getState().sessions.delivery?.settings.sequence).toEqual([
    "H",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
  place("X", 1);
  place("H", 2);
  await act(async () => fireEvent.click(run()));
  expect(useCampus.getState().sessions.delivery?.evidence).toEqual([
    "delivery",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "H X |0⟩" }));
  fireEvent.click(screen.getByRole("button", { name: "Collect discovery" }));
  expect(useCampus.getState().completed).toEqual(["delivery"]);
});
it("busy runs prevent duplicate requests, edits, close and checkpoint restore; stale results are ignored", async () => {
  let finish!: (value: Response) => void;
  const transport = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  setServiceTransport(transport);
  const close = vi.fn();
  const view = render(<CampusLaptop initial="quiet" onClose={close} />);
  fireEvent.click(run());
  fireEvent.click(screen.getByRole("button", { name: "Running circuit…" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(close).not.toHaveBeenCalled();
  expect(transport).toHaveBeenCalledTimes(1);
  expect(restoreCheckpoint("qc3")).toBe(false);
  view.unmount();
  await act(async () => finish(Response.json(counts)));
  expect(useGame.getState().operations).toBe(0);
  expect(useCampus.getState().sessions.quiet?.result).toBeFalsy();
});
it("the direct festival requires three explicit experiments and grants only its optional badge", async () => {
  const transport = vi.fn(async (_path: string, _init?: RequestInit) =>
    Response.json(counts),
  );
  setServiceTransport(transport);
  render(<CampusLaptop initial="festival" onClose={vi.fn()} />);
  expect(transport).not.toHaveBeenCalled();
  place("H", 1);
  place("H", 2);
  await act(async () => fireEvent.click(run()));
  fireEvent.click(
    screen.getByRole("button", {
      name: "Interference cancels the 1 amplitude",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next repair" }));
  fireEvent.click(screen.getByRole("button", { name: "Bell pair" }));
  const bases = screen.getByRole("group", { name: "Both measurement bases" });
  fireEvent.click(within(bases).getByRole("button", { name: "X" }));
  await act(async () => fireEvent.click(run()));
  fireEvent.click(
    screen.getByRole("button", {
      name: "No; compare measurement settings and models",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next repair" }));
  fireEvent.click(screen.getByRole("button", { name: "0%" }));
  fireEvent.click(screen.getByLabelText("Add the H measurement lens"));
  await act(async () => fireEvent.click(run()));
  fireEvent.click(
    screen.getByRole("button", { name: "No; more shots improve an estimate" }),
  );
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Open the Festival" })),
  );
  expect(transport).toHaveBeenCalledTimes(3);
  expect(useCampus.getState().completed).toEqual([]);
  expect(useProgress.getState().completed).toEqual({ campus: ["festival"] });
  expect(Object.keys(useMedals.getState().earned)).toEqual([
    "quantum-explorer",
  ]);
});
