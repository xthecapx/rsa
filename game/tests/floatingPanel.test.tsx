import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useFloatingPanel } from "@/components/useFloatingPanel";
import { LabComponentSettings } from "@/components/LabComponentSettings";
import { useLocale } from "@/i18n";

let resized: () => void;
const observe = vi.fn(),
  disconnect = vi.fn();
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  useLocale.setState({ locale: "en" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Panel({
  position,
  dragging = false,
}: {
  position: () => void;
  dragging?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const floating = useFloatingPanel({
    open,
    onClose: () => setOpen(false),
    trigger,
    panel,
    position,
    observe: () => [panel.current],
    focusOnOpen: true,
  });
  return (
    <div data-puzzle-dragging={dragging}>
      <button ref={trigger} onClick={() => setOpen(!open)}>
        Toggle
      </button>
      {open && (
        <div
          ref={panel}
          tabIndex={-1}
          role="region"
          aria-label="Panel"
          onKeyDownCapture={floating.onKeyDownCapture}
        >
          <button onClick={floating.close}>Close</button>
        </div>
      )}
      <button>Outside</button>
    </div>
  );
}
it("tracks scroll/resize and content resize, dismisses outside without stealing focus, and cleans up listeners", () => {
  const position = vi.fn();
  const view = render(<Panel position={position} />);
  expect(position).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Toggle"));
  expect(document.activeElement).toBe(screen.getByRole("region"));
  expect(observe).toHaveBeenCalledWith(screen.getByRole("region"));
  fireEvent.scroll(window);
  fireEvent.resize(window);
  act(() => resized());
  expect(position).toHaveBeenCalledTimes(4);
  screen.getByText("Outside").focus();
  fireEvent.pointerDown(screen.getByText("Outside"));
  expect(screen.queryByRole("region")).toBeNull();
  expect(document.activeElement).toBe(screen.getByText("Outside"));
  expect(disconnect).toHaveBeenCalled();
  view.unmount();
  fireEvent.resize(window);
  expect(position).toHaveBeenCalledTimes(4);
});
it("returns focus for Escape and explicit Close, while keyboard drags keep ownership of Escape", () => {
  const view = render(<Panel position={vi.fn()} />);
  fireEvent.click(screen.getByText("Toggle"));
  fireEvent.keyDown(screen.getByRole("region"), { key: "Escape" });
  expect(screen.queryByRole("region")).toBeNull();
  expect(document.activeElement).toBe(screen.getByText("Toggle"));
  fireEvent.click(screen.getByText("Toggle"));
  view.rerender(<Panel position={vi.fn()} dragging />);
  fireEvent.keyDown(screen.getByRole("region"), { key: "Escape" });
  expect(screen.getByRole("region")).toBeTruthy();
  fireEvent.click(screen.getByText("Close"));
  expect(document.activeElement).toBe(screen.getByText("Toggle"));
});
it("keeps the settings portal within the laptop and preserves rotation parameters across language changes", () => {
  const change = vi.fn();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return (
        this.classList.contains("laptop-screen")
          ? {
              left: 10,
              top: 20,
              right: 310,
              bottom: 420,
              width: 300,
              height: 400,
            }
          : {
              left: 270,
              top: 360,
              right: 300,
              bottom: 400,
              width: 30,
              height: 40,
            }
      ) as DOMRect;
    },
  );
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(300);
  render(
    <div className="shared-laptop">
      <div className="laptop-screen">
        <LabComponentSettings
          componentLabel="Rotation, wire 1, position 1"
          op={{ gate: "ROTATION", axis: "Z", angle: Math.PI / 2, wire: 0 }}
          qubits={1}
          onChange={change}
        />
      </div>
    </div>,
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Settings for Rotation, wire 1, position 1",
    }),
  );
  const panel = screen.getByRole("region");
  expect(panel.style.left).toBe("22px");
  expect(panel.style.top).toBe("52px");
  expect(
    screen.getByRole("button", { name: "Z" }).getAttribute("aria-pressed"),
  ).toBe("true");
  act(() => useLocale.setState({ locale: "es" }));
  expect(screen.getByRole("spinbutton").getAttribute("value")).toBe("90");
  expect(change).not.toHaveBeenCalled();
  fireEvent.keyDown(panel, { key: "Escape" });
  expect(screen.queryByRole("region")).toBeNull();
});
