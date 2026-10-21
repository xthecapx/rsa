import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GameCanvas } from "@/components/GameCanvas";
import { useAudio } from "@/game/audio";
import { useLocale } from "@/i18n";
const engine = vi.hoisted(() => ({ input: { keyboard: { clear: vi.fn() } } }));
vi.mock("@/engine/createGame", () => ({
  createGame: vi.fn(async () => engine),
  disposeGame: vi.fn(async () => {}),
}));
import { createGame } from "@/engine/createGame";
beforeEach(() => {
  vi.clearAllMocks();
  useAudio.setState({ unlocked: true });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useLocale.setState({ locale: "en" });
});
it("restores play focus after an overlay and clears held keys while inactive", async () => {
  const ready = vi.fn();
  const error = vi.fn();
  const { rerender } = render(
    <GameCanvas onReady={ready} onError={error} active />,
  );
  await waitFor(() => expect(ready).toHaveBeenCalled());
  expect(document.activeElement).toBe(
    screen.getByRole("application", { name: "Town exploration" }),
  );
  rerender(<GameCanvas onReady={ready} onError={error} active={false} />);
  expect(engine.input.keyboard.clear).toHaveBeenCalled();
  rerender(<GameCanvas onReady={ready} onError={error} active />);
  expect(document.activeElement).toBe(screen.getByRole("application"));
  expect(createGame).toHaveBeenCalledTimes(1);
});
it("language changes keep toolbar focus and never reboot the engine", async () => {
  const ready = vi.fn();
  render(
    <>
      <GameCanvas onReady={ready} onError={vi.fn()} />
      <button>Toolbar</button>
    </>,
  );
  await waitFor(() => expect(ready).toHaveBeenCalled());
  screen.getByRole("button").focus();
  act(() => useLocale.setState({ locale: "es" }));
  expect(document.activeElement).toBe(screen.getByRole("button"));
  expect(
    screen.getByRole("application", { name: "Exploración del pueblo" }),
  ).toBeTruthy();
  expect(createGame).toHaveBeenCalledTimes(1);
});

it("does not steal splash focus until the player explicitly enters", async () => {
  useAudio.setState({ unlocked: false });
  const ready = vi.fn();
  render(
    <>
      <button>Enter game</button>
      <GameCanvas onReady={ready} onError={vi.fn()} />
    </>,
  );
  screen.getByRole("button").focus();
  await waitFor(() => expect(ready).toHaveBeenCalled());
  expect(document.activeElement).toBe(screen.getByRole("button"));
  act(() => useAudio.setState({ unlocked: true }));
  expect(document.activeElement).toBe(screen.getByRole("application"));
  expect(createGame).toHaveBeenCalledTimes(1);
});
