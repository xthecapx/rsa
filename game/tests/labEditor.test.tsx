import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef, useState, type ComponentProps } from "react";
import { useLabEditor } from "@/components/useLabEditor";
import { LabCircuitEditor } from "@/components/LabCircuitEditor";
import { type LabRecipe } from "@/game/labCircuit";
import type {
  PuzzlePiece,
  PuzzleSlot,
  PuzzleCircuitPiece,
} from "@/components/PuzzleDragDrop";
import { useLocale } from "@/i18n";

// Exercise the editor's tap/keyboard contract; dnd-kit owns pointer geometry.
vi.mock("@/components/PuzzleDragDrop", () => ({
  PuzzleDragDrop: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
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
  PuzzleCircuitPiece: ({
    children,
    label,
    onSelect,
    onRemove,
    removeLabel,
    actions,
    selected,
  }: ComponentProps<typeof PuzzleCircuitPiece>) => (
    <div>
      <button aria-label={label} onClick={onSelect}>
        {children}
      </button>
      <button aria-label={removeLabel} onClick={onRemove}>
        ×
      </button>
      {selected && actions}
    </div>
  ),
}));
const initial: LabRecipe = {
  qubits: 1,
  start: "0",
  shots: 256,
  operations: [],
};
function Editor({ busy = false, run = vi.fn() }) {
  const [recipe, setRecipe] = useState(initial);
  const running = useRef(busy);
  running.current = busy;
  const editor = useLabEditor({
    recipe,
    allowed: () => true,
    running,
    onChange: setRecipe,
  });
  useLocale((s) => s.locale);
  return (
    <>
      <fieldset disabled={busy}>
        <LabCircuitEditor
          recipe={recipe}
          editor={editor}
          busy={busy}
          unlocked
          multipleQubits
          available={["H", "ROTATION"]}
          onRun={run}
        />
      </fieldset>
      <output aria-label="Recipe">{JSON.stringify(recipe)}</output>
    </>
  );
}
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  useLocale.setState({ locale: "en" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const recipe = () => JSON.parse(screen.getByLabelText("Recipe").textContent!);
function addRotation() {
  fireEvent.click(
    screen.getByRole("button", { name: "Add component on wire 1" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Rotation" }));
}
describe("lab circuit editing", () => {
  it("adds from empty, removes one, clears all and adds again without running", () => {
    const run = vi.fn();
    render(<Editor run={run} />);
    addRotation();
    addRotation();
    expect(recipe().operations).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: /Remove .* at step 1/ }),
    );
    expect(recipe().operations).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
    expect(recipe().operations).toHaveLength(0);
    addRotation();
    expect(recipe().operations[0].axis).toBe("Y");
    expect(run).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Run circuit/ }));
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("preserves the circuit when switching language and can dismiss the picker with Escape", () => {
    render(<Editor />);
    addRotation();
    const before = recipe();
    fireEvent.click(screen.getByRole("button", { name: "Add component" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Add component" }), {
      key: "Escape",
    });
    expect(
      screen
        .getByRole("button", { name: "Add component" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    act(() => useLocale.setState({ locale: "es" }));
    expect(recipe()).toEqual(before);
    expect(screen.queryByText("Circuit builder")).toBeNull();
  });
  it("blocks edits and execution while a request is pending", () => {
    const run = vi.fn();
    const view = render(<Editor run={run} />);
    addRotation();
    view.rerender(<Editor busy run={run} />);
    const before = recipe();
    fireEvent.click(screen.getByRole("button", { name: "Clear circuit" }));
    fireEvent.click(screen.getByRole("button", { name: /Running circuit/ }));
    expect(recipe()).toEqual(before);
    expect(run).not.toHaveBeenCalled();
  });
});
