import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QubitBench } from "@/components/QubitBench";
import { coinApi, type BenchResult } from "@/lib/coin";
import type { PuzzlePiece, PuzzleSlot } from "@/components/PuzzleDragDrop";
import type { BenchStep } from "@/content/coinTown";
import { useLocale } from "@/i18n";
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
const step: BenchStep = {
  kind: "bench",
  title: "Flip",
  text: "Flip",
  feedback: "Good",
  slots: 1,
  gates: ["X"],
  cases: [{ start: "0", target: "1" }],
  fill: true,
};
const measured: BenchResult = {
  backend: "Noisy device",
  kind: "noise",
  source: "simulator",
  shots: 256,
  circuits: [
    {
      start: "0",
      counts: { "0": 17, "1": 239 },
      probabilities: { "0": 0, "1": 1 },
    },
  ],
};
beforeEach(() => useLocale.setState({ locale: "en" }));
afterEach(cleanup);
function place() {
  fireEvent.click(screen.getByRole("button", { name: "X gate · flip" }));
  fireEvent.click(screen.getByRole("button", { name: /Wire slot 1/ }));
}
it("validates ideal correctness while displaying noisy returned counts; edits restore Run and Clear", async () => {
  const request = vi.spyOn(coinApi, "circuit").mockResolvedValue(measured),
    solved = vi.fn();
  render(<QubitBench step={step} onSolved={solved} />);
  fireEvent.click(screen.getByRole("button", { name: /Run circuit/ }));
  expect(request).not.toHaveBeenCalled();
  place();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: /Run circuit/ })),
  );
  expect(request).toHaveBeenCalledWith(["0"], ["X"]);
  expect(solved).toHaveBeenCalledTimes(1);
  expect(screen.getByText("239 · 93.4%")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Clear circuit" })).toBeNull();
  act(() => useLocale.setState({ locale: "es" }));
  expect(screen.getByText("239 · 93.4%")).toBeTruthy();
  act(() => useLocale.setState({ locale: "en" }));
  fireEvent.click(screen.getByRole("button", { name: /Wire slot 1/ }));
  expect(screen.queryByText("239 · 93.4%")).toBeNull();
  expect(screen.getByRole("button", { name: "Clear circuit" })).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(1);
});
it("blocks duplicate submissions, allows explicit retry after error, and discards late results on unmount", async () => {
  let finish!: (result: BenchResult) => void;
  const request = vi
    .spyOn(coinApi, "circuit")
    .mockRejectedValueOnce(new Error("Provider refused"))
    .mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const solved = vi.fn(),
    busy = vi.fn();
  const view = render(
    <QubitBench step={step} onSolved={solved} onBusyChange={busy} />,
  );
  place();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: /Run circuit/ })),
  );
  expect(screen.getByRole("alert").textContent).toBe("Provider refused");
  fireEvent.click(screen.getByRole("button", { name: /Run circuit/ }));
  fireEvent.click(screen.getByRole("button", { name: /Running circuit/ }));
  expect(request).toHaveBeenCalledTimes(2);
  expect(
    (screen.getByRole("button", { name: "Clear circuit" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  view.unmount();
  expect(busy).toHaveBeenLastCalledWith(false);
  await act(async () => finish(measured));
  expect(solved).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(2);
});
