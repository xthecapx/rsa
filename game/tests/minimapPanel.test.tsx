import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MinimapPanel } from "@/components/MinimapPanel";
import { TownMinimap } from "@/components/TownMinimap";
import { useLocale } from "@/i18n";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useLocale.setState({ locale: "en" });
});

it("starts compact, hides all navigation, and preserves the user's choice through rotation and translation", () => {
  let compact = true;
  vi.stubGlobal("matchMedia", () => ({ matches: compact }));
  render(<TownMinimap />);
  const toggle = screen.getByRole("button", { name: "Town minimap" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(
    screen.queryByRole("button", { name: "Return to exploration" }),
  ).toBeNull();
  fireEvent.click(toggle);
  expect(
    screen.getByRole("button", { name: "Return to exploration" }),
  ).toBeTruthy();
  compact = false;
  fireEvent(window, new Event("resize"));
  fireEvent(window, new Event("orientationchange"));
  act(() => useLocale.setState({ locale: "es" }));
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(
    screen.getByRole("button", { name: "Volver a explorar" }),
  ).toBeTruthy();
  fireEvent.click(toggle);
  compact = true;
  fireEvent(window, new Event("orientationchange"));
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

it("keeps the toggle outside the scroll area and returns focus to it when Escape collapses the body", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  render(
    <MinimapPanel>
      <button>Destination control</button>
    </MinimapPanel>,
  );
  const toggle = screen.getByRole("button", { name: "Town minimap" });
  const body = document.getElementById(toggle.getAttribute("aria-controls")!);
  expect(body?.contains(toggle)).toBe(false);
  const destination = screen.getByRole("button", {
    name: "Destination control",
  });
  destination.focus();
  fireEvent.keyDown(destination, { key: "Escape" });
  expect(document.activeElement).toBe(toggle);
  expect(body?.hidden).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Destination control" }),
  ).toBeNull();
});

it("consumes map pointer interactions without triggering the surrounding world", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const click = vi.fn(),
    pointer = vi.fn();
  render(
    <div onClick={click} onPointerDown={pointer}>
      <MinimapPanel>
        <svg role="img" aria-label="Map terrain" />
      </MinimapPanel>
    </div>,
  );
  const map = screen.getByRole("img");
  fireEvent.pointerDown(map);
  fireEvent.click(map);
  fireEvent.click(screen.getByRole("button", { name: "Town minimap" }));
  expect(click).not.toHaveBeenCalled();
  expect(pointer).not.toHaveBeenCalled();
});

it("hydrates the compact server markup without a viewport mismatch", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const content = (
    <MinimapPanel>
      <button>Navigation</button>
    </MinimapPanel>
  );
  const container = document.createElement("div");
  container.innerHTML = renderToString(content);
  document.body.append(container);
  const recover = vi.fn();
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, content, { onRecoverableError: recover });
  });
  expect(recover).not.toHaveBeenCalled();
  expect(container.querySelector("button")?.getAttribute("aria-expanded")).toBe(
    "false",
  );
  act(() => root.unmount());
  container.remove();
});
