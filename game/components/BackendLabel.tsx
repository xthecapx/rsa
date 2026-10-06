"use client";

import { useSimulator } from "@/game/simulator";
import { runtimeInfo } from "@/lib/transport";
import { t, useLocale } from "@/i18n";

/** Shared display for the outdoor header and the laptop's visible toolbar. */
export function BackendLabel() {
  useLocale((s) => s.locale);
  const choice = useSimulator((s) => s.choice);
  const name = runtimeInfo.target === "qollab" ? runtimeInfo.backend : choice === "noise" ? "Aer teaching noise" : "AerSimulator";
  return <p className="break-words text-[10px] leading-normal text-stage-muted">
    {runtimeInfo.remoteFinalOnly
      ? <>{t("Practice backend")}: basic_simulator · {t("Final challenge backend")}: {name}</>
      : <>{t("Backend")}: {name} · {t(runtimeInfo.target === "qollab" ? runtimeInfo.kind === "noise" ? "Noise-model simulator" : runtimeInfo.kind === "hardware" ? "Physical QPU" : "Ideal simulator" : choice === "noise" ? "Noise-model simulator" : "Ideal simulator")}</>}
  </p>;
}
