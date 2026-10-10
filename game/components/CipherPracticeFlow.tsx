"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { StepTabs } from "./ExperimentSteps";
import { t } from "@/i18n";

type View = "math" | "practice" | "results";

/** Classical tools have a check or a dial, never a pretend quantum Run. */
export function CipherPracticeFlow({
  solved,
  children,
}: {
  solved: boolean;
  children: (view: View) => ReactNode;
}) {
  const [view, setView] = useState<View>("math");
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const received = useRef(solved);
  // A newly solved puzzle opens its review; editing makes the review unavailable.
  useEffect(() => {
    if (solved !== received.current) setView(solved ? "results" : "practice");
    received.current = solved;
  }, [solved]);
  useEffect(() => {
    if (view === "results") panel.current?.focus();
  }, [view]);
  return (
    <div className="space-y-4 min-w-0">
      <StepTabs
        id={id}
        value={view}
        onChange={setView}
        busy={false}
        stages={[
          { id: "math", label: "Math" },
          { id: "practice", label: "Practice" },
          { id: "results", label: "Results", disabled: !solved },
        ]}
      />
      <div
        ref={panel}
        tabIndex={-1}
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${view}`}
        className="space-y-3 min-w-0"
      >
        {children(view)}
      </div>
      {view === "math" && (
        <button
          type="button"
          className="btn-primary"
          onClick={() => setView("practice")}
        >
          {t("Try it yourself")}
        </button>
      )}
    </div>
  );
}
