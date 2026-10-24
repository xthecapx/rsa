import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CircuitHistogram } from "@/components/CircuitHistogram";
import { useLocale } from "@/i18n";

const counts = Object.freeze(
  Object.fromEntries(
    Array.from({ length: 256 }, (_, i) => [
      i.toString(2).padStart(8, "0"),
      (i % 5) + 1,
    ]),
  ),
);
afterEach(() => {
  cleanup();
  useLocale.setState({ locale: "en" });
});

it("offers a bounded summary by default, and every original count in a semantic table on demand", () => {
  render(
    <CircuitHistogram counts={counts} backend="Saved QPU" source="hardware" />,
  );
  expect(screen.queryByRole("table")).toBeNull();
  expect(
    screen.getByText(/766 shots · Saved QPU · Real hardware/),
  ).toBeTruthy();
  expect(screen.getByText("Distinct measured outcomes: 256")).toBeTruthy();
  expect(
    screen.getByText("Other observed outcomes: 248 · 726 shots · 94.8%"),
  ).toBeTruthy();
  const peaks = screen.getByRole("img", {
    name: /^Leading observed outcomes:/,
  });
  expect(peaks.querySelectorAll(".qubit-bar")).toHaveLength(8);
  const show = screen.getByRole("button", { name: "Show all counts" });
  fireEvent.click(show);
  const table = screen.getByRole("table", { name: "All outcome counts" });
  expect(within(table).getAllByRole("row")).toHaveLength(258);
  const displayed = Object.fromEntries(
    Array.from(table.querySelectorAll("tbody tr"), (row) => [
      row.querySelector("th")!.textContent,
      Number(row.querySelector("td")!.textContent),
    ]),
  );
  expect(displayed).toEqual(counts);
  const total = within(table)
    .getByRole("rowheader", { name: "Total" })
    .closest("tr")!;
  expect(
    within(total)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["766", "100.0%"]);
});
it("Escape and the lower collapse button return focus to the disclosure, without bubbling Escape to the laptop", () => {
  let escaped = 0;
  render(
    <div onKeyDown={() => escaped++}>
      <CircuitHistogram counts={counts} source="simulator" />
    </div>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Show all counts" }));
  // LaptopShell's native bubble listener runs before React bubble handlers.
  screen
    .getByRole("region", { name: "Observed counts" })
    .parentElement!.addEventListener("keydown", () => escaped++);
  const scroll = screen.getByRole("group", { name: "Scrollable counts table" });
  scroll.focus();
  fireEvent.keyDown(scroll, { key: "Escape" });
  expect(escaped).toBe(0);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Show all counts" }),
  );
  expect(screen.queryByRole("table")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show all counts" }));
  fireEvent.click(
    within(
      screen.getByRole("region", { name: "Complete measurement counts" }),
    ).getByRole("button", { name: "Hide all counts" }),
  );
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Show all counts" }),
  );
});
it("keeps a disclosed reading through language changes and re-collapses a new reading", () => {
  const { rerender } = render(
    <CircuitHistogram
      counts={counts}
      backend="Original backend"
      source="simulator"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Show all counts" }));
  act(() => useLocale.setState({ locale: "es" }));
  expect(
    screen.getByRole("table", { name: "Conteos de todos los resultados" }),
  ).toBeTruthy();
  expect(screen.getByText(/Original backend/)).toBeTruthy();
  rerender(
    <CircuitHistogram
      counts={{ ...counts, "00000000": 10 }}
      backend="New backend"
      source="simulator"
    />,
  );
  expect(screen.queryByRole("table")).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Mostrar todos los conteos" })
      .getAttribute("aria-expanded"),
  ).toBe("false");
});
it("does not turn ideal predictions or zero-count keys into observed outcomes", () => {
  const probabilities = Object.fromEntries(
    Object.keys(counts).map((bits) => [bits, 1 / 256]),
  );
  render(
    <CircuitHistogram
      counts={{ "00000000": 0 }}
      probabilities={probabilities}
      source="simulator"
    />,
  );
  expect(screen.getByText("Distinct measured outcomes: 0")).toBeTruthy();
  expect(
    screen.getByText("Other observed outcomes: 0 · 0 shots · 0.0%"),
  ).toBeTruthy();
  expect(screen.queryByText(/00000001:/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show all counts" }));
  const table = screen.getByRole("table");
  expect(
    within(table).getByRole("columnheader", { name: "Ideal probability" }),
  ).toBeTruthy();
  const row = within(table)
    .getByRole("rowheader", { name: "00000001" })
    .closest("tr")!;
  expect(
    within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["0", "0.0%", "0.4%"]);
});
it("keeps all sixteen anonymous Grover bars visible and numerically ordered", () => {
  const counts = Object.fromEntries(
    Array.from({ length: 16 }, (_, i) => [String(15 - i), 16]),
  );
  const { container } = render(
    <CircuitHistogram counts={counts} hiddenLabels source="simulator" />,
  );
  expect(screen.queryByRole("button", { name: "Show all counts" })).toBeNull();
  expect(
    Array.from(
      container.querySelectorAll(".contents > span:first-child"),
      (el) => el.textContent,
    ),
  ).toEqual(Array.from({ length: 16 }, (_, i) => `Bar ${i + 1}`));
});
