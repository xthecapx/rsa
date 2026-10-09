"use client";

import { HistogramBars } from "./HistogramBars";
import type { BenchResult, QubitReading } from "@/lib/coin";
import { t, useLocale } from "@/i18n";

type Props = QubitReading & Pick<BenchResult, "backend" | "shots" | "source"> & { highlight?: boolean; kind?: "ideal" | "noise" | "hardware" };

/** Bars always represent provider counts. Ideal probabilities are text only. */
export function QubitHistogram({ counts, probabilities, backend, shots, source, kind, highlight = true }: Props) {
  useLocale((state) => state.locale);
  return <section className={`space-y-2 ${highlight ? "measurement-result" : ""}`} aria-label={t("Observed counts")}>
    <div className="flex flex-wrap justify-between gap-2 text-xs">
      <strong>{t("Observed counts")} · {shots} {t("shots")}</strong>
      <span>{backend} · {t(source === "hardware" ? "Quantum hardware" : kind === "noise" ? "Noise-model simulator" : kind === "ideal" ? "Ideal simulator" : "Simulator")}</span>
    </div>
    <HistogramBars shots={shots} rows={(["0", "1"] as const).map(bit => ({ key: bit, label: bit, count: counts[bit] }))} label={t("Measured counts: 0 = {zero}, 1 = {one}.").replace("{zero}", String(counts["0"])).replace("{one}", String(counts["1"]))} />
    <p className="text-xs text-stage-muted">{t("Ideal prediction:")} 0 = {Math.round(probabilities["0"] * 100)}% · 1 = {Math.round(probabilities["1"] * 100)}%</p>
    <p className="text-xs text-stage-muted">{t("Each shot starts from a fresh preparation. These bars show returned measurements, not calculated probabilities.")}</p>
    {(kind === "noise" || source === "hardware") && <p className="text-xs text-accent-amber">{t("Noise can shift these counts away from the ideal prediction.")}</p>}
  </section>;
}
