"use client";
import { t, localize, useLocale } from "@/i18n";

import clsx from "clsx";

import { bandFor, labelFor } from "@/game/suspicion";
import { useGame } from "@/game/state";

const BAR: Record<string, string> = {
  calm: "bg-suspicion-calm",
  uneasy: "bg-suspicion-uneasy",
  alarmed: "bg-suspicion-alarmed",
};

export function SuspicionMeter() {
  useLocale((state) => state.locale);
  const suspicion = useGame((s) => s.suspicion);
  const band = bandFor(suspicion);

  return (
    <div className="panel w-32 p-2 lg:w-64 lg:p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 lg:mb-2">
        <span className="text-[8px] uppercase tracking-widest text-stage-muted lg:text-[10px]">{t("Suspicion")}</span>
        <span className="text-[9px] text-[#e8f4f8] lg:text-[11px]">{suspicion}%</span>
      </div>

      <div className="h-2 w-full border-2 border-stage-border bg-stage-bg lg:h-3">
        <div
          className={clsx("h-full transition-[width] duration-500", BAR[band])}
          style={{ width: `${suspicion}%` }}
        />
      </div>

      {/* The read on the street is flavour; a phone needs the bar more. */}
      <p className="mt-2 hidden text-[10px] leading-relaxed text-stage-muted lg:block">
        {localize(labelFor(suspicion))}
      </p>
    </div>
  );
}
