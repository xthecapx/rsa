import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import { CryptoBench, DialBench } from "@/components/CryptoBench";
import type { PuzzlePiece, PuzzleSlot } from "@/components/PuzzleDragDrop";
import { CIPHER_NPCS, KNOWLEDGE } from "@/content/cipher";
import type { CryptoStep } from "@/content/knowledge";
import { useLocale } from "@/i18n";
import { api } from "@/lib/api";

vi.mock("@/game/audio", () => ({
  gameAudio: { playSfx: vi.fn(), playSynth: vi.fn() },
}));
vi.mock("@/components/PuzzleDragDrop", () => ({
  PuzzleDragDrop: ({ children }: { children: ReactNode }) => <>{children}</>,
  PuzzlePiece: ({ label, onSelect }: ComponentProps<typeof PuzzlePiece>) => (
    <button aria-label={label} onClick={onSelect} />
  ),
  PuzzleSlot: ({ label, onSelect }: ComponentProps<typeof PuzzleSlot>) => (
    <button aria-label={label} onClick={onSelect} />
  ),
}));
beforeEach(() => useLocale.setState({ locale: "en" }));
afterEach(cleanup);
const puzzles = CIPHER_NPCS.flatMap((npc) =>
  npc.steps
    .filter((step): step is CryptoStep => step.kind === "crypto")
    .map((step) => ({
      step,
      reference: npc.knowledge
        ? KNOWLEDGE[npc.knowledge as keyof typeof KNOWLEDGE]
        : undefined,
    })),
);

it.each(puzzles)(
  "$step.title keeps answers through tabs and language, and invalidates completion on edit",
  async ({ step, reference }) => {
    const solved = vi.fn(),
      edited = vi.fn();
    const quantum = vi.spyOn(api.shor, "simulate");
    render(
      <CryptoBench
        step={step}
        reference={reference}
        onSolved={solved}
        onEdited={edited}
      />,
    );
    expect(
      screen.getByRole("tab", { name: "Math" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByText(
        "These are classical calculations, not quantum measurements.",
      ),
    ).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Math" }), {
      key: "ArrowRight",
    });
    const fill = () =>
      step.slots.forEach((slot) => {
        fireEvent.click(
          screen.getByRole("button", { name: slot.answer }),
        );
        fireEvent.click(
          screen.getByRole("button", {
            name: `${slot.ask}: Empty`,
              }),
        );
      });
    fill();
    fireEvent.click(screen.getByRole("tab", { name: "Math" }));
    fireEvent.click(screen.getByRole("tab", { name: "Practice" }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(solved).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("tab", { name: "Results" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    step.slots.forEach((slot) =>
      expect(
        screen.getByRole("region", { name: "Checked answers" }).textContent,
      ).toContain(`${slot.ask} → ${slot.answer}`),
    );
    await act(async () => useLocale.setState({ locale: "es" }));
    expect(
      screen.getByRole("region", { name: "Respuestas verificadas" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Vaciar las fichas" }),
    ).toBeNull();
    await act(async () => useLocale.setState({ locale: "en" }));
    fireEvent.click(screen.getByRole("tab", { name: "Practice" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: `${step.slots[0].ask}: ${step.slots[0].answer}`,
      }),
    );
    expect(edited).toHaveBeenCalled();
    expect(
      screen.getByRole("tab", { name: "Results" }).hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear tiles" }));
    expect(
      screen
        .getByRole("button", { name: "Check" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(solved).toHaveBeenCalledTimes(2);
    expect(quantum).not.toHaveBeenCalled();
  },
);

it("keeps wrong tiles editable and the result locked", () => {
  const step = puzzles[0].step,
    solved = vi.fn();
  render(<CryptoBench step={step} onSolved={solved} />);
  fireEvent.click(screen.getByRole("button", { name: "Try it yourself" }));
  step.slots.forEach((slot) => {
    const wrong = step.tray.find((tile) => tile !== slot.answer)!;
    fireEvent.click(screen.getByRole("button", { name: wrong }));
    fireEvent.click(screen.getByRole("button", { name: `${slot.ask}: Empty` }));
  });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(solved).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain("red slots");
  expect(
    screen.getByRole("tab", { name: "Results" }).hasAttribute("disabled"),
  ).toBe(true);
});

it("Tadeo's dial keeps its key across tabs and reviews the solved word without more turns", async () => {
  const step = CIPHER_NPCS.find((npc) => npc.id === "tadeo")!.steps.find(
    (step) => step.kind === "dial",
  )!;
  if (step.kind !== "dial") throw new Error("Missing dial lesson");
  const solved = vi.fn();
  render(<DialBench step={step} onSolved={solved} />);
  fireEvent.click(screen.getByRole("tab", { name: "Practice" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Turn the wheel forward" }),
  );
  fireEvent.click(screen.getByRole("tab", { name: "Math" }));
  fireEvent.click(screen.getByRole("tab", { name: "Practice" }));
  for (let key = 1; key < step.key; key++)
    fireEvent.click(
      screen.getByRole("button", { name: "Turn the wheel forward" }),
    );
  expect(solved).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("tab", { name: "Results" }).getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getByText("OPEN")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Turn the wheel forward" }),
  ).toBeNull();
  await act(async () => useLocale.setState({ locale: "es" }));
  expect(screen.getByText("OPEN")).toBeTruthy();
});
