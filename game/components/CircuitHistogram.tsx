"use client";

import { HistogramBars } from "./HistogramBars";
import { t, useLocale } from "@/i18n";
import type { Measurement } from "@/game/histogram";

/** Only returned measurements make bars; ideal probabilities stay a reference. */
export function CircuitHistogram({ counts, probabilities, backend, kind, source, hiddenLabels = false }: Pick<Measurement, "counts" | "probabilities" | "backend" | "kind" | "source"> & { hiddenLabels?: boolean }) {
  useLocale((s) => s.locale);
  const shots = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const keys = Array.from(new Set([...Object.keys(probabilities ?? {}), ...Object.keys(counts)]));
  keys.sort(hiddenLabels ? (a, b) => Number(a) - Number(b) : undefined);
  return <section className="measurement-result space-y-2" aria-label={t("Observed counts")}>
    <p className="text-xs text-accent-teal">{t("Observed counts")} · {shots} {t("shots")} · {backend} · {t(source === "hardware" ? "Real hardware" : kind === "noise" ? "Noise-model simulator" : "Ideal simulator")}</p>
    <HistogramBars shots={shots} rows={keys.map(key => ({ key, count: counts[key] ?? 0, label: hiddenLabels ? t("Bar {number}").replace("{number}", String(Number(key) + 1)) : key }))} />
    <p className="text-xs text-stage-muted">{t("Each shot starts from a fresh preparation. These bars show returned measurements, not calculated probabilities.")}</p>
    {probabilities && <p className="text-xs text-stage-muted">{t("Ideal prediction:")} {keys.map((key) => `${hiddenLabels ? Number(key) + 1 : key}: ${((probabilities[key] ?? 0) * 100).toFixed(1)}%`).join(" · ")}</p>}
    {(kind === "noise" || source === "hardware") && <p className="text-xs text-accent-amber">{t("Noise can shift these counts away from the ideal prediction.")}</p>}
  </section>;
}
