"use client";

import clsx from "clsx";
import type { ShorStepPlanEntry } from "@/lib/api";

interface PipelineStripProps {
  steps: ShorStepPlanEntry[];
  classicalLabel?: string;
  quantumLabel?: string;
}

export default function PipelineStrip({
  steps,
  classicalLabel = "Precheck",
  quantumLabel = "Gates in one Shor circuit",
}: PipelineStripProps) {
  if (!steps.length) {
    return (
      <div className="panel p-4 text-sm text-stage-muted">
        Run Shor to see precheck → one QPE circuit → post-process.
      </div>
    );
  }

  const identityCount = steps.filter((s) => s.status === "identity").length;
  const quantumCount = steps.length - identityCount;

  return (
    <div className="panel overflow-x-auto p-4">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wider text-stage-muted">
        <span>{classicalLabel}</span>
        <span className="text-accent-teal">→</span>
        <span>
          {quantumLabel} ({quantumCount} active)
        </span>
        <span className="text-accent-teal">→</span>
        <span>Measure · post-process</span>
      </div>

      <p className="mb-3 text-[11px] text-stage-muted">
        This is <strong className="text-accent-teal">one</strong> Shor circuit
        (phase-estimation ladder). Each tile is a controlled modular-multiply
        slot M_b on a control qubit — not a separate Aer/IBM job. Struck-out
        tiles are identity (skipped). After the circuit runs, you get{" "}
        <strong className="text-accent-amber">one</strong> measurement
        histogram whose peaks encode the period r.
      </p>

      <div className="flex min-w-max gap-1">
        {steps.map((step) => (
          <div
            key={`${step.slot}-${step.b}`}
            title={
              step.status === "identity"
                ? `M_${step.b} = identity (skip)`
                : `Controlled M_${step.b} on control #${step.slot}`
            }
            className={clsx(
              "flex h-10 w-10 flex-col items-center justify-center rounded border text-[10px] font-mono",
              step.status === "identity"
                ? "border-stage-border/50 bg-stage-bg/30 text-stage-muted line-through"
                : "border-accent-teal/60 bg-accent-teal/10 text-accent-teal",
            )}
          >
            <span>M{step.b}</span>
            <span className="opacity-60">c{step.slot}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-stage-muted">
        {identityCount} identity gates skipped · {quantumCount} modular-multiply
        gates compiled into the single circuit
      </p>
    </div>
  );
}
