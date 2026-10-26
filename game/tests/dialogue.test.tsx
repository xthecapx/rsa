import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  DialogueContinue,
  DialogueFrame,
  DialogueLine,
  useDialogueText,
} from "@/components/DialoguePresentation";
import { DialogBox } from "@/components/DialogBox";
import { useGame } from "@/game/state";
import { t, useLocale } from "@/i18n";
import { advance, choose, submitReport } from "@/game/dialog";
import { gameAudio } from "@/game/audio";
vi.mock("@/game/audio", () => ({
  gameAudio: { playSynth: vi.fn(), playSfx: vi.fn() },
}));
vi.mock("@/game/dialog", () => ({
  advance: vi.fn(),
  choose: vi.fn(),
  submitReport: vi.fn(),
  visibleChoices: () => [{ label: "Choose this answer" }],
}));
const initial = useGame.getState();
const line = "Your turn. Open the laptop to complete this step.";
let motion: {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
let motionChange: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  useLocale.setState({ locale: "en" });
  motion = {
    matches: false,
    addEventListener: vi.fn((_event, listener) => {
      motionChange = listener;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => motion);
});
afterEach(() => {
  cleanup();
  useGame.setState(initial, true);
  useLocale.setState({ locale: "en" });
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  motionChange = undefined;
});
function AnimatedLine() {
  const d = useDialogueText(line);
  return (
    <DialogueFrame
      actions={<DialogueContinue settled={d.settled} onContinue={d.reveal} />}
    >
      <DialogueLine speaker="system" fullText={line}>
        {d.typed}
      </DialogueLine>
    </DialogueFrame>
  );
}
function dialog(options: { choices?: boolean; report?: boolean } = {}) {
  useGame.setState({
    phase: "dialog",
    lines: [{ speaker: "system", text: line }],
    lineIndex: 0,
    choicesVisible: options.choices ?? false,
    feedback: null,
    waitingFor: options.report ? "report" : null,
    nodeId: "review",
    reportError: null,
  });
  return render(<DialogBox />);
}
it("exposes a stable full line while hiding the animated prefix from assistive technology", () => {
  const view = render(<AnimatedLine />);
  const full = screen.getByText(line);
  expect(full.className).toBe("sr-only");
  act(() => vi.advanceTimersByTime(12));
  expect(
    view.container.querySelector('p span[aria-hidden="true"]')?.textContent,
  ).toBe("You");
  expect(full.textContent).toBe(line);
  expect(view.container.querySelector("[aria-live]")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Show full text/ }));
  expect(screen.getByRole("button", { name: /Continue/ })).toBeTruthy();
  expect(vi.getTimerCount()).toBe(0);
});
it("shows the entire line immediately and silently with reduced motion", () => {
  motion.matches = true;
  const { result } = renderHook(() => useDialogueText(line));
  expect(result.current.typed).toBe(line);
  expect(result.current.settled).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  expect(gameAudio.playSynth).not.toHaveBeenCalled();
});
it("finishes a running reveal when reduced motion turns on and cleans up its listener", () => {
  const { result, unmount } = renderHook(() => useDialogueText(line));
  act(() => vi.advanceTimersByTime(12));
  act(() => {
    motion.matches = true;
    motionChange?.();
  });
  expect(result.current.typed).toBe(line);
  expect(vi.getTimerCount()).toBe(0);
  act(() => {
    motion.matches = false;
    motionChange?.();
  });
  expect(result.current.typed).toBe(line);
  unmount();
  expect(motion.removeEventListener).toHaveBeenCalledWith(
    "change",
    expect.any(Function),
  );
});
it("replaces old animation frames on a new line and cancels the timer on unmount", () => {
  const { result, rerender, unmount } = renderHook(
    ({ text }) => useDialogueText(text),
    { initialProps: { text: line } },
  );
  act(() => vi.advanceTimersByTime(36));
  rerender({ text: "Different line." });
  expect(result.current.typed).toBe("");
  act(() => vi.advanceTimersByTime(12));
  expect(result.current.typed).toBe("Dif");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("reveals without advancing, then advances only on a separate press", () => {
  dialog();
  fireEvent.click(screen.getByRole("button", { name: /Show full text/ }));
  expect(advance).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  expect(advance).toHaveBeenCalledTimes(1);
});
it("ignores hidden choice shortcuts after a language change and lets Space reveal first", () => {
  dialog({ choices: true });
  act(() => vi.runAllTimers());
  expect(
    screen.getByRole("button", { name: /Choose this answer/ }),
  ).toBeTruthy();
  act(() => useLocale.setState({ locale: "es" }));
  expect(
    screen.queryByRole("button", { name: /Choose this answer/ }),
  ).toBeNull();
  expect(screen.getByText(t(line))).toBeTruthy();
  fireEvent.keyDown(window, { key: "1", code: "Digit1" });
  expect(choose).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: " ", code: "Space" });
  expect(choose).not.toHaveBeenCalled();
  expect(advance).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: /Choose this answer/ }),
  ).toBeTruthy();
  fireEvent.keyDown(window, { key: "1", code: "Digit1", repeat: true });
  expect(choose).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "1", code: "Digit1" });
  expect(choose).toHaveBeenCalledWith(0);
});
it("keeps report typing separate from dialogue reveal and shortcut handling", async () => {
  dialog({ report: true });
  fireEvent.click(screen.getByRole("button", { name: /Show full text/ }));
  const input = screen.getByRole("textbox");
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: "A 1" } });
  fireEvent.keyDown(input, { key: "1", code: "Digit1" });
  fireEvent.keyDown(input, { key: " ", code: "Space" });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  expect(advance).not.toHaveBeenCalled();
  expect(choose).not.toHaveBeenCalled();
  expect((input as HTMLInputElement).value).toBe("A 1");
  await act(async () => {
    fireEvent.submit(input.closest("form")!);
  });
  expect(submitReport).toHaveBeenCalledWith("A 1");
});
