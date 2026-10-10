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
import { useCampusInteraction } from "@/components/useCampusInteraction";
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
    if (exhibit.id === "qubit") {
      expect(
        screen.queryByRole("group", { name: "Circuit controls" }),
      ).toBeNull();
    } else {
      expect(run()).toBeTruthy();
    }
    view.unmount();
  }
  expect(transport).not.toHaveBeenCalled();
});
it.each(["web", "qollab"] as const)(
  "Rosa shows Run only after assembly, then returns measurements in %s without resubmitting on reopen",
  async (target) => {
    runtimeInfo.target = target;
    const transport = vi.fn(async (_path: string, _init?: RequestInit) =>
      Response.json(counts),
    );
    setServiceTransport(transport);
    let view = render(<CampusLaptop initial="qubit" onClose={vi.fn()} />);
    expect(
      screen.queryByRole("group", { name: "Circuit controls" }),
    ).toBeNull();
    expect(screen.queryByText("Circuit builder")).toBeNull();
    expect(screen.queryByText("Ideal state explorer")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "Arrange Prepare → Control → Measure before running.",
    );
    fireEvent.click(screen.getByRole("button", { name: "← Prepare" }));
    expect(
      screen.queryByRole("group", { name: "Circuit controls" }),
    ).toBeNull();
    act(() => useLocale.setState({ locale: "es" }));
    expect(screen.getByRole("status").textContent).toBe(
      "Ordena Preparar → Controlar → Medir antes de ejecutar.",
    );
    fireEvent.click(screen.getByRole("button", { name: "← Controlar" }));
    expect(useCampus.getState().sessions.qubit?.settings.order).toEqual([
      "Prepare",
      "Control",
      "Measure",
    ]);
    expect(transport).not.toHaveBeenCalled();
    act(() => useLocale.setState({ locale: "en" }));
    expect(screen.getByText("Circuit builder")).toBeTruthy();
    await act(async () => fireEvent.click(run()));
    expect(transport.mock.calls[0][0]).toBe("/api/campus/run");
    expect(JSON.parse(transport.mock.calls[0][1]?.body as string)).toEqual({
      mode: "circuit",
      recipe: {
        qubits: 1,
        start: "0",
        operations: [{ gate: "H", wire: 0 }],
        shots: 256,
      },
    });
    expect(screen.getByText("120 · 46.9%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Classical flip · X" }));
    await act(async () => fireEvent.click(run()));
    expect(useCampus.getState().sessions.qubit?.evidence).toEqual([
      "prepared:H",
      "prepared:X",
    ]);
    view.unmount();
    await act(async () => useCampus.persist.rehydrate());
    view = render(<CampusLaptop initial="qubit" onClose={vi.fn()} />);
    expect(run()).toBeTruthy();
    expect(screen.getAllByText("120 · 46.9%")).toHaveLength(2);
    expect(transport).toHaveBeenCalledTimes(2);
    // Making the assembly invalid again hides execution and clears stale counts.
    fireEvent.click(screen.getByRole("button", { name: "← Measure" }));
    expect(
      screen.queryByRole("group", { name: "Circuit controls" }),
    ).toBeNull();
    expect(useCampus.getState().sessions.qubit?.result).toBeNull();
    expect(transport).toHaveBeenCalledTimes(2);
  },
);
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
  expect(
    screen.queryByRole("button", { name: "Collect discovery" }),
  ).toBeNull();
  expect(useCampus.getState().completed).toEqual([]);
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
function CampusVisit({ host = "festival" }: { host?: string }) {
  const interaction = useCampusInteraction();
  return (
    <>
      <button
        disabled={interaction.locked}
        onClick={() => interaction.interact(host)}
      >
        Talk
      </button>
      {interaction.layer}
    </>
  );
}
function choose(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}
function beginVisit() {
  choose("Talk");
  choose("Let’s investigate");
  choose("I’m not sure; let’s test it");
  choose("Open the experiment");
}
it("the direct festival requires three explicit experiments, visitor discussions and applied repairs", async () => {
  const transport = vi.fn(async () => Response.json(counts));
  setServiceTransport(transport);
  render(<CampusVisit />);
  beginVisit();
  expect(transport).not.toHaveBeenCalled();
  place("H", 1);
  place("H", 2);
  await act(async () => fireEvent.click(run()));
  choose("Return to host");
  choose("Interference cancels the 1 amplitude");
  choose("Describe the experiment and what its evidence supports");
  choose("Finish this repair");
  choose("Open the experiment");
  choose("Bell pair");
  const bases = screen.getByRole("group", { name: "Both measurement bases" });
  fireEvent.click(within(bases).getByRole("button", { name: "X" }));
  await act(async () => fireEvent.click(run()));
  choose("Return to host");
  choose("No; compare measurement settings and models");
  choose("Describe the experiment and what its evidence supports");
  choose("Finish this repair");
  choose("Open the experiment");
  choose("0%");
  fireEvent.click(screen.getByLabelText("Add the H measurement lens"));
  await act(async () => fireEvent.click(run()));
  choose("Return to host");
  choose("No; more shots improve an estimate");
  choose("Describe the experiment and what its evidence supports");
  await act(async () => choose("Open the Festival"));
  expect(transport).toHaveBeenCalledTimes(3);
  expect(useCampus.getState().completed).toEqual([]);
  expect(useProgress.getState().completed).toEqual({ campus: ["festival"] });
  expect(Object.keys(useMedals.getState().earned)).toEqual([
    "quantum-explorer",
  ]);
});
it("Marisol remembers a wrong prediction, discusses real evidence and resumes an applied response in Spanish", async () => {
  const transport = vi.fn(async () => Response.json(counts));
  setServiceTransport(transport);
  let view = render(<CampusVisit host="fountain" />);
  choose("Talk");
  expect(transport).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /^Run circuit/ })).toBeNull();
  choose("Let’s investigate");
  choose("I expect different probabilities");
  choose("Open the experiment");
  await act(async () => fireEvent.click(run()));
  fireEvent.click(screen.getByLabelText("Paint a relative minus with Z"));
  await act(async () => fireEvent.click(run()));
  choose("Return to host");
  expect(
    screen.getByText("Your prediction: I expect different probabilities"),
  ).toBeTruthy();
  expect(screen.getAllByText("0: 120 · 1: 136")).toHaveLength(2);
  choose("Collect more of the same Z samples");
  expect(screen.getByText(/More Z shots estimate/)).toBeTruthy();
  expect(transport).toHaveBeenCalledTimes(2);
  choose("Use the H measurement lens");
  choose("Open the experiment");
  fireEvent.click(screen.getByLabelText("Add the H measurement lens"));
  await act(async () => fireEvent.click(run()));
  fireEvent.click(screen.getByLabelText("Paint a relative minus with Z"));
  await act(async () => fireEvent.click(run()));
  choose("Return to host");
  fireEvent.click(screen.getByRole("button", { name: /Plus state · H lens/ }));
  fireEvent.click(screen.getByRole("button", { name: /Minus state · H lens/ }));
  choose("Relative phase changes interference");
  view.unmount();
  await act(async () => useCampus.persist.rehydrate());
  act(() => useLocale.setState({ locale: "es" }));
  view = render(<CampusVisit host="fountain" />);
  choose("Talk");
  expect(
    screen.getByText("Elige la explicación para colocar junto a la fuente."),
  ).toBeTruthy();
  choose(
    "Las mismas probabilidades en una base pueden ocultar fases distintas",
  );
  choose("Ponerlo en práctica");
  expect(useCampus.getState().completed).toEqual(["fountain"]);
  expect(transport).toHaveBeenCalledTimes(4);
  choose("Experimentar libremente");
  choose("Close");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(transport).toHaveBeenCalledTimes(4);
});
it("closing without an execution offers resume, while notebook navigation never debriefs a different host", async () => {
  const transport = vi.fn(async () => Response.json(counts));
  setServiceTransport(transport);
  render(<CampusVisit host="fountain" />);
  beginVisit();
  choose("Return to host");
  expect(
    screen.getByRole("button", { name: "Open the experiment" }),
  ).toBeTruthy();
  choose("Later");
  choose("Talk");
  choose("Open the experiment");
  choose("Campus field notebook");
  choose("Close");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(useCampus.getState().sessions.fountain?.journey.phase).toBe(
    "investigate",
  );
  expect(transport).not.toHaveBeenCalled();
});
it("reset invalidates an in-flight campus experiment even if its laptop owner remains mounted", async () => {
  let finish!: (value: Response) => void;
  setServiceTransport(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  render(<CampusLaptop initial="fountain" onClose={vi.fn()} />);
  fireEvent.click(run());
  act(() => useCampus.getState().reset());
  await act(async () => finish(Response.json(counts)));
  expect(useCampus.getState().sessions.fountain).toBeUndefined();
  expect(useGame.getState().operations).toBe(0);
});
