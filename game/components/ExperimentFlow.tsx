"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { t } from "@/i18n";
import {
  ExperimentSteps,
  EXPERIMENT_STEPS,
  type ExperimentStep,
} from "./ExperimentSteps";

/** Focused practice stages. Only a new returned measurement advances to Results. */
export function ExperimentFlow({
  text,
  measurement,
  busy,
  initialView,
  children,
}: {
  text: string;
  measurement: object | null;
  busy: boolean;
  initialView?: ExperimentStep;
  children: (
    view: ExperimentStep,
    changeView: (view: ExperimentStep) => void,
  ) => ReactNode;
}) {
  const [view, setView] = useState<ExperimentStep>(initialView ?? "math");
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const received = useRef(measurement);
  const focusResults = useRef(false);
  useEffect(() => {
    if (measurement && measurement !== received.current) {
      focusResults.current = true;
      setView("results");
    }
    received.current = measurement;
  }, [measurement]);
  useEffect(() => {
    if (view === "results" && focusResults.current) {
      panel.current?.focus();
      focusResults.current = false;
    }
  }, [view, measurement]);
  const index = EXPERIMENT_STEPS.findIndex((stage) => stage.id === view);
  return (
    <div className="space-y-4 min-w-0">
      <ExperimentSteps
        id={id}
        value={view}
        onChange={setView}
        busy={busy}
        hasMeasurements={!!measurement}
      />
      <p>{t(text)}</p>
      <div
        ref={panel}
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${view}`}
        tabIndex={-1}
        className="space-y-3 min-w-0"
      >
        {children(view, setView)}
      </div>
      <nav
        className="flex flex-wrap justify-between gap-2"
        aria-label={t("Step navigation")}
      >
        {index > 0 && (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => setView(EXPERIMENT_STEPS[index - 1].id)}
          >
            {t("Previous step")}
          </button>
        )}
        {index < 2 && (
          <button
            type="button"
            className="btn-primary ml-auto"
            disabled={busy}
            onClick={() => setView(EXPERIMENT_STEPS[index + 1].id)}
          >
            {t(view === "math" ? "Continue to assembly" : "Continue to run")}
          </button>
        )}
        {view === "run" && measurement && (
          <button
            type="button"
            className="btn-primary ml-auto"
            disabled={busy}
            onClick={() => setView("results")}
          >
            {t("View measurements")}
          </button>
        )}
        {view === "results" && (
          <button
            type="button"
            className="btn-ghost ml-auto"
            disabled={busy}
            onClick={() => setView("assemble")}
          >
            {t("Edit experiment")}
          </button>
        )}
      </nav>
    </div>
  );
}
