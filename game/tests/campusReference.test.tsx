import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LaptopShell } from "@/components/LaptopShell";
import { useLocale } from "@/i18n";

afterEach(() => {
  cleanup();
  useLocale.getState().setLocale("en");
  vi.unstubAllGlobals();
});

function Experiment({ open }: { open: boolean }) {
  const [value, setValue] = useState("H → Z");
  return (
    <LaptopShell open={open} title="Experiment" onClose={() => {}}>
      <input
        aria-label="Circuit draft"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </LaptopShell>
  );
}

it("offers read-only foundations without losing a lesson draft across language and lid changes", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  useLocale.getState().setLocale("en");
  const view = render(<Experiment open />);
  fireEvent.change(screen.getByLabelText("Circuit draft"), {
    target: { value: "H → X → H" },
  });
  const help = screen.getByText("Quantum questions? Open the field notebook");
  fireEvent.click(help);
  expect(help.closest("details")?.open).toBe(true);
  fireEvent.change(screen.getByLabelText("Search concepts"), {
    target: { value: "decoherence" },
  });
  expect(screen.getByText("The quiet room")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Español" }));
  expect(screen.getByLabelText("Circuit draft").getAttribute("value")).toBe(
    "H → X → H",
  );
  expect(screen.getByLabelText("Buscar conceptos")).toBeTruthy();
  view.rerender(<Experiment open={false} />);
  view.rerender(<Experiment open />);
  expect(screen.getByLabelText("Circuit draft").getAttribute("value")).toBe(
    "H → X → H",
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("lets the campus use its own notebook without a duplicate help panel", () => {
  render(
    <LaptopShell open title="Campus" foundations={false} onClose={() => {}}>
      Notebook
    </LaptopShell>,
  );
  expect(
    screen.queryByText("Quantum questions? Open the field notebook"),
  ).toBeNull();
});
