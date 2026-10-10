"use client";
import { useRef } from "react";
import { t } from "@/i18n";

export const EXPERIMENT_STEPS = [
  { id: "math", label: "Math" },
  { id: "assemble", label: "Assemble" },
  { id: "run", label: "Run" },
  { id: "results", label: "Results" },
] as const;
export type ExperimentStep = (typeof EXPERIMENT_STEPS)[number]["id"];

/** One accessible sequence for every exhibit, with no execution side effects. */
export function ExperimentSteps({
  id,
  value,
  onChange,
  busy,
  hasMeasurements,
}: {
  id: string;
  value: ExperimentStep;
  onChange: (step: ExperimentStep) => void;
  busy: boolean;
  hasMeasurements: boolean;
}) {
  const buttons = useRef<
    Partial<Record<ExperimentStep, HTMLButtonElement | null>>
  >({});
  const available = EXPERIMENT_STEPS.filter(
    (stage) => stage.id !== "results" || hasMeasurements,
  );
  return (
    <div
      className="campus-steps"
      role="tablist"
      aria-label={t("Experiment steps")}
    >
      {EXPERIMENT_STEPS.map((stage, index) => (
        <button
          key={stage.id}
          type="button"
          role="tab"
          ref={(element) => {
            buttons.current[stage.id] = element;
          }}
          id={`${id}-${stage.id}`}
          aria-controls={`${id}-panel`}
          aria-selected={value === stage.id}
          tabIndex={value === stage.id ? 0 : -1}
          disabled={busy || (stage.id === "results" && !hasMeasurements)}
          onClick={() => onChange(stage.id)}
          // The laptop stops bubbling keys before they reach the world/React root.
          onKeyDownCapture={(event) => {
            if (busy) return;
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const at = available.findIndex((item) => item.id === stage.id);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? available.length - 1
                  : (at +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      available.length) %
                    available.length;
            onChange(available[next].id);
            buttons.current[available[next].id]?.focus();
          }}
        >
          <span className="campus-step-number" aria-hidden="true">
            {index + 1}
          </span>
          {t(stage.label)}
        </button>
      ))}
    </div>
  );
}
