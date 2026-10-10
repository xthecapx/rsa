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

function LaptopSteps() {
  const [step, setStep] = useState<CampusExperimentStep>("math");
  return (
    <LaptopShell open title="Campus" onClose={() => {}} foundations={false}>
      <CampusExperimentSteps
        id="campus-test"
        value={step}
        onChange={setStep}
        busy={false}
        hasMeasurements={false}
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
  const math = screen.getByRole("tab", { name: "Math" });
  const assemble = screen.getByRole("tab", { name: "Assemble" });
  const run = screen.getByRole("tab", { name: "Run" });
  fireEvent.keyDown(math, { key: "ArrowRight" });
  expect(assemble.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(assemble);
  fireEvent.keyDown(assemble, { key: "End" });
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
