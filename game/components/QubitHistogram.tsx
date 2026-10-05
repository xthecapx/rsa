"use client";

import type { BenchResult, QubitReading } from "@/lib/coin";
import { t, useLocale } from "@/i18n";

type Props = QubitReading & Pick<BenchResult, "backend" | "shots" | "source"> & { kind?: "ideal" | "noise" };

/** Bars always represent provider counts. Ideal probabilities are text only. */
export function QubitHistogram({ counts, probabilities, backend, shots, source, kind }: Props) {
  useLocale((state) => state.locale);
  return <section className="space-y-2" aria-label={t("Observed counts")}>
    <div className="flex flex-wrap justify-between gap-2 text-xs">
      <strong>{t("Observed counts")} · {shots} {t("shots")}</strong>
      <span>{backend} · {t(source === "hardware" ? "Quantum hardware" : kind === "noise" ? "Noise-model simulator" : kind === "ideal" ? "Ideal simulator" : "Simulator")}</span>
    </div>
    <div className="qubit-odds" style={{ gridTemplateColumns: "auto minmax(32px, 1fr) auto" }} role="img" aria-label={t("Measured counts: 0 = {zero}, 1 = {one}.").replace("{zero}", String(counts["0"])).replace("{one}", String(counts["1"]))}>
      {(["0", "1"] as const).map((bit) => <span key={bit} className="contents">
        <span>{bit}</span><span className="qubit-bar"><span style={{ width: `${100 * counts[bit] / shots}%` }} /></span>
        <span>{counts[bit]} · {(100 * counts[bit] / shots).toFixed(1)}%</span>
      </span>)}
    </div>
    <p className="text-xs text-stage-muted">{t("Ideal prediction:")} 0 = {Math.round(probabilities["0"] * 100)}% · 1 = {Math.round(probabilities["1"] * 100)}%</p>
    <p className="text-xs text-stage-muted">{t("Each shot starts from a fresh preparation. These bars show returned measurements, not calculated probabilities.")}</p>
    {kind === "noise" && <p className="text-xs text-accent-amber">{t("Noise can shift these counts away from the ideal prediction.")}</p>}
  </section>;
}
