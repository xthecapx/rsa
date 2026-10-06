"use client";

import { useEffect } from "react";
import { useSimulator, type SimulatorChoice } from "@/game/simulator";
import { runtimeInfo } from "@/lib/transport";
import { t, useLocale } from "@/i18n";

export function SimulatorPicker({ disabled = false }: { disabled?: boolean }) {
  useLocale((s) => s.locale);
  const choice = useSimulator((s) => s.choice);
  useEffect(() => { void useSimulator.persist.rehydrate(); }, []);
  return <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-stage-border px-3 py-1 text-xs">
    {runtimeInfo.target === "qollab" ? <p>{runtimeInfo.backend} · {t("Selected before starting the game.")}{runtimeInfo.remoteFinalOnly && <> {t("Practice: built-in ideal simulator. Final challenges: selected backend, one remote job per game session.")}</>}</p> : <>
      <label className="flex items-center gap-2">{t("Simulation")}
        <select aria-label={t("Simulation")} disabled={disabled} value={choice} onChange={(e) => useSimulator.getState().select(e.target.value as SimulatorChoice)} className="min-h-9 rounded border border-stage-border bg-stage-bg px-2 text-base text-accent-teal">
          <option value="ideal">{t("Ideal simulator")}</option>
          <option value="noise">{t("Noise-model simulator")}</option>
        </select>
      </label>
      <span className="text-stage-muted">{t("Applies to your next run. Saved results keep their original backend.")}</span>
    </>}
  </div>;
}
