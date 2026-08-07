"use client";

import clsx from "clsx";

import { bandFor, labelFor } from "@/game/suspicion";
import { useGame } from "@/game/state";

const BAR: Record<string, string> = {
  calm: "bg-suspicion-calm",
  uneasy: "bg-suspicion-uneasy",
  alarmed: "bg-suspicion-alarmed",
};

export function SuspicionMeter() {
  const suspicion = useGame((s) => s.suspicion);
  const band = bandFor(suspicion);

  return (
    <div className="panel w-64 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-widest text-stage-muted">
          Suspicion
        </span>
        <span className="text-[11px] text-[#e8f4f8]">{suspicion}%</span>
      </div>

      <div className="h-3 w-full border-2 border-stage-border bg-stage-bg">
        <div
          className={clsx("h-full transition-[width] duration-500", BAR[band])}
          style={{ width: `${suspicion}%` }}
        />
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-stage-muted">
        {labelFor(suspicion)}
      </p>
    </div>
  );
}
