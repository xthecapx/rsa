import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  CampusExperimentSteps,
  type CampusExperimentStep,
} from "@/components/CampusExperimentSteps";
import { LaptopShell } from "@/components/LaptopShell";
import { useLocale } from "@/i18n";

afterEach(() => {
  cleanup();
  useLocale.setState({ locale: "en" });
});

function LaptopSteps({ hasMeasurements = false, busy = false } = {}) {
  const [step, setStep] = useState<CampusExperimentStep>("math");
  return (
    <LaptopShell open title="Campus" onClose={() => {}} foundations={false}>
      <CampusExperimentSteps
        id="campus-test"
        value={step}
        onChange={setStep}
        busy={busy}
        hasMeasurements={hasMeasurements}
      />
      <div
        role="tabpanel"
        id="campus-test-panel"
        aria-labelledby={`campus-test-${step}`}
      />
    </LaptopShell>
  );
}

it("supports arrow, Home and End tab keys inside the real laptop keyboard boundary", () => {
  render(<LaptopSteps />);
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "1Math",
    "2Run",
    "3Results",
  ]);
  expect(
    screen.getByRole("tab", { name: "Results" }).hasAttribute("disabled"),
  ).toBe(true);
  const math = screen.getByRole("tab", { name: "Math" });
  const run = screen.getByRole("tab", { name: "Run" });
  fireEvent.keyDown(math, { key: "ArrowRight" });
  expect(run.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(run);
  fireEvent.keyDown(run, { key: "End" });
  expect(document.activeElement).toBe(run);
  fireEvent.keyDown(run, { key: "ArrowRight" });
  expect(document.activeElement).toBe(math);
  fireEvent.keyDown(math, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(run);
  fireEvent.keyDown(run, { key: "Home" });
  expect(document.activeElement).toBe(math);
  expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
    math.id,
  );
});

it("includes Results in keyboard navigation after a measurement and translates all three labels", () => {
  render(<LaptopSteps hasMeasurements />);
  const math = screen.getByRole("tab", { name: "Math" });
  const results = screen.getByRole("tab", { name: "Results" });
  fireEvent.keyDown(math, { key: "End" });
  expect(document.activeElement).toBe(results);
  expect(results.getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(results, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Run" }));
  cleanup();
  useLocale.setState({ locale: "es" });
  render(<LaptopSteps hasMeasurements />);
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "1Matemáticas",
    "2Ejecutar",
    "3Resultados",
  ]);
});

it("disables all three steps while a job runs", () => {
  render(<LaptopSteps hasMeasurements busy />);
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  for (const tab of screen.getAllByRole("tab"))
    expect(tab.hasAttribute("disabled")).toBe(true);
});
