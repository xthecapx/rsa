import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LabLaptop } from "@/components/LabLaptop";
import { useLab } from "@/game/lab";
import { useGame } from "@/game/state";
import { useLocale } from "@/i18n";
import { starterRecipe } from "@/game/labCircuit";
import { runtimeInfo, setServiceTransport } from "@/lib/transport";
import { useSimulator } from "@/game/simulator";
import type { LabCircuitEditor } from "@/components/LabCircuitEditor";
vi.mock("@/components/LaptopShell", () => ({
  LaptopShell: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
}));
vi.mock("@/components/LabCircuitEditor", () => ({
  LabCircuitEditor: ({
    editor,
    recipe,
    onRun,
    busy,
  }: ComponentProps<typeof LabCircuitEditor>) => (
    <>
      <button disabled={busy} onClick={onRun}>
        Execute
      </button>
      <button
        disabled={busy}
        onClick={() => editor.update({ ...recipe, operations: [] }, true)}
      >
        Edit
      </button>
    </>
  ),
}));
const counts = {
  counts: { "0": 120, "1": 136 },
  probabilities: { "0": 0.5, "1": 0.5 },
  backend: "AerSimulator",
  kind: "ideal",
  source: "simulator",
  shots: 256,
  depth: 2,
  circuit_text: "H → M",
};
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  useLab.setState({ recipe: starterRecipe() });
  useLocale.setState({ locale: "en" });
  useSimulator.setState({ choice: "ideal" });
  runtimeInfo.target = "web";
});
afterEach(() => {
  cleanup();
  setServiceTransport(null);
  vi.unstubAllGlobals();
});
it("only explicit Run submits; language, close/reopen, edits and backend changes retain previous measurements", async () => {
  const transport = vi.fn(async () => Response.json(counts));
  setServiceTransport(transport);
  const props = {
    open: true,
    onClose: vi.fn(),
    onBusyChange: vi.fn(),
    controls: null,
  };
  const view = render(<LabLaptop {...props} />);
  expect(transport).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByText("Execute")));
  expect(screen.getByText("Current circuit results")).toBeTruthy();
  expect(screen.getByText("120 · 46.9%")).toBeTruthy();
  view.rerender(<LabLaptop {...props} open={false} />);
  view.rerender(<LabLaptop {...props} />);
  act(() => useLocale.setState({ locale: "es" }));
  expect(screen.getByText("120 · 46.9%")).toBeTruthy();
  act(() => useLocale.setState({ locale: "en" }));
  act(() => useSimulator.setState({ choice: "noise" }));
  expect(
    screen.getByText(
      "Previous run — the circuit or selected backend has changed",
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByText("Edit"));
  expect(screen.getByText("120 · 46.9%")).toBeTruthy();
  expect(transport).toHaveBeenCalledTimes(1);
});
it("a pending run keeps one request and balances the operation counter even after unmount", async () => {
  let finish!: (response: Response) => void;
  const transport = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  setServiceTransport(transport);
  const before = useGame.getState().operations;
  const view = render(
    <LabLaptop open onClose={vi.fn()} onBusyChange={vi.fn()} controls={null} />,
  );
  fireEvent.click(screen.getByText("Execute"));
  fireEvent.click(screen.getByText("Execute"));
  expect(transport).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => {
    finish(Response.json(counts));
  });
  expect(useGame.getState().operations).toBe(before);
});
