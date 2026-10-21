import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorldMinimap } from "@/components/WorldMinimap";
import { bus } from "@/engine/bus";
import { useLocale } from "@/i18n";
import { useExecution } from "@/lib/execution";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  useLocale.setState({ locale: "en" });
  useExecution.setState({ background: null, active: [] });
  bus.setCommandHandler(null);
  bus.drain();
});
function map(labRevealed = false) {
  return (
    <>
      <div
        role="application"
        aria-label="Town exploration"
        data-exploration-area="true"
        tabIndex={0}
      />
      <WorldMinimap
        map={{ width: 3, height: 3, rows: ["...", "...", "..."] }}
        places={[
          { id: "mayor", at: { x: 1, y: 1 }, label: "Mayor Cap", symbol: "M" },
        ]}
        roads={[
          {
            at: { x: 1, y: -1 },
            walkTo: { x: 1, y: 0 },
            title: "North road to Cipher Town",
            glyph: "↑",
            locked: true,
          },
          {
            at: { x: 1, y: 4 },
            walkTo: { x: 1, y: 2 },
            title: "South road to Coin Town",
            glyph: "↓",
          },
        ]}
        ariaLabel="Coin Town"
        legend={[]}
        position={{ x: 1, y: 1 }}
        facing="up"
        done={[]}
        pending={[]}
        explored={[]}
        tracked={null}
        labTown="coinTown"
        labRevealed={labRevealed}
      />
    </>
  );
}
it("returns keyboard focus from the minimap and walks through the engine without opening a lesson", () => {
  const commands = vi.fn();
  bus.setCommandHandler(commands);
  render(map());
  fireEvent.click(
    screen.getByRole("button", { name: "Return to exploration" }),
  );
  expect(document.activeElement).toBe(screen.getByRole("application"));
  fireEvent.click(screen.getByText("Walk to a destination"));
  fireEvent.click(screen.getByRole("button", { name: "Walk" }));
  expect(commands).toHaveBeenCalledWith({
    type: "navigate",
    at: { x: 1, y: 1 },
    label: "Mayor Cap",
  });
  expect(document.activeElement).toBe(screen.getByRole("application"));
  act(() =>
    bus.emit({ type: "navigation", state: "arrived", label: "Mayor Cap" }),
  );
  expect(screen.getByRole("status").textContent).toBe("Arrived at: Mayor Cap");
});
it("does not disclose a concealed lab and disables locked exits and travel during a background job", () => {
  const { rerender } = render(map());
  fireEvent.click(screen.getByText("Walk to a destination"));
  expect(
    screen.queryByRole("option", { name: "Personal quantum lab" }),
  ).toBeNull();
  expect(
    (screen.getByRole("option", { name: /North road/ }) as HTMLOptionElement)
      .disabled,
  ).toBe(true);
  act(() =>
    useExecution.setState({
      background: {
        owner: "test",
        title: "Circuit",
        running: true,
        canRestore: true,
      },
    }),
  );
  expect(
    (screen.getByRole("option", { name: /South road/ }) as HTMLOptionElement)
      .disabled,
  ).toBe(true);
  rerender(map(true));
  expect(
    screen.getByRole("option", { name: "Personal quantum lab" }),
  ).toBeTruthy();
});
it("keeps the selection and translates the arrival announcement without issuing another walk", () => {
  const commands = vi.fn();
  bus.setCommandHandler(commands);
  render(map());
  fireEvent.click(screen.getByText("Walk to a destination"));
  fireEvent.change(screen.getByLabelText("Destination"), {
    target: { value: "road:South road to Coin Town" },
  });
  act(() =>
    bus.emit({ type: "navigation", state: "arrived", label: "Mayor Cap" }),
  );
  act(() => useLocale.setState({ locale: "es" }));
  expect((screen.getByLabelText("Destino") as HTMLSelectElement).value).toBe(
    "road:South road to Coin Town",
  );
  expect(screen.getByRole("status").textContent).toBe(
    "Llegaste a: Alcaldesa Cap",
  );
  expect(commands).not.toHaveBeenCalled();
});
