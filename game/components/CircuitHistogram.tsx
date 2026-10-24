"use client";

import { HistogramBars } from "./HistogramBars";
import { useId, useRef, useState } from "react";
import { countsPresentation } from "@/game/countsPresentation";
import { t, tCount, useLocale } from "@/i18n";
import type { Measurement } from "@/game/histogram";

/** Only returned measurements make bars; ideal probabilities stay a reference. */
export function CircuitHistogram({
  counts,
  probabilities,
  backend,
  kind,
  source,
  hiddenLabels = false,
}: Pick<
  Measurement,
  "counts" | "probabilities" | "backend" | "kind" | "source"
> & { hiddenLabels?: boolean }) {
  useLocale((s) => s.locale);
  const { shots, keys, peaks, large, distinct, other } = countsPresentation(
    counts,
    probabilities,
    hiddenLabels,
  );
  const label = (key: string) =>
    hiddenLabels
      ? t("Bar {number}").replace("{number}", String(Number(key) + 1))
      : key;
  const share = (count: number) =>
    shots ? ((100 * count) / shots).toFixed(1) : "0.0";
  const shown = large ? peaks : keys;
  return (
    <section
      className="measurement-result space-y-2"
      aria-label={t("Observed counts")}
    >
      <p className="text-xs text-accent-teal">
        {t("Observed counts")} ·{" "}
        {tCount(shots, "{count} shot", "{count} shots")} · {backend} ·{" "}
        {t(
          source === "hardware"
            ? "Real hardware"
            : kind === "noise"
              ? "Noise-model simulator"
              : "Ideal simulator",
        )}
      </p>
      {large && (
        <>
          <p className="text-xs">
            {t("Distinct measured outcomes")}: {distinct}
          </p>
          <h3 className="text-sm text-accent-teal">
            {t("Leading observed outcomes")}
          </h3>
        </>
      )}
      <HistogramBars
        shots={shots}
        rows={shown.map((key) => ({
          key,
          count: counts[key] ?? 0,
          label: label(key),
        }))}
        label={
          large
            ? `${t("Leading observed outcomes")}: ${shown.map((key) => `${label(key)}: ${counts[key]} · ${share(counts[key])}%`).join("; ")}`
            : undefined
        }
      />
      {large && (
        <p className="text-xs">
          {t("Other observed outcomes")}: {other.outcomes} ·{" "}
          {tCount(other.count, "{count} shot", "{count} shots")} ·{" "}
          {share(other.count)}%
        </p>
      )}
      <p className="text-xs text-stage-muted">
        {t(
          "Each shot starts from a fresh preparation. These bars show returned measurements, not calculated probabilities.",
        )}
      </p>
      {probabilities && (
        <p className="text-xs text-stage-muted">
          {large ? (
            t("Ideal predictions are listed separately in the complete table.")
          ) : (
            <>
              {t("Ideal prediction:")}{" "}
              {keys
                .map(
                  (key) =>
                    `${hiddenLabels ? Number(key) + 1 : key}: ${((probabilities[key] ?? 0) * 100).toFixed(1)}%`,
                )
                .join(" · ")}
            </>
          )}
        </p>
      )}
      {(kind === "noise" || source === "hardware") && (
        <p className="text-xs text-accent-amber">
          {t("Noise can shift these counts away from the ideal prediction.")}
        </p>
      )}
      {large && (
        <CompleteCounts
          counts={counts}
          probabilities={probabilities}
          keys={keys}
          label={label}
          shots={shots}
          share={share}
        />
      )}
    </section>
  );
}

function CompleteCounts({
  counts,
  probabilities,
  keys,
  label,
  shots,
  share,
}: {
  counts: Record<string, number>;
  probabilities?: Record<string, number>;
  keys: string[];
  label: (key: string) => string;
  shots: number;
  share: (count: number) => string;
}) {
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  // A new reading starts collapsed; language switches retain the current view.
  const [view, setView] = useState({ counts, open: false });
  const open = view.counts === counts && view.open;
  function close() {
    setView({ counts, open: false });
    toggle.current?.focus();
  }
  return (
    <div className="space-y-2">
      <button
        ref={toggle}
        type="button"
        className="btn-ghost min-h-11 text-xs"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close() : setView({ counts, open: true }))}
      >
        {t(open ? "Hide all counts" : "Show all counts")}
      </button>
      <div
        id={id}
        hidden={!open}
        role="region"
        aria-label={t("Complete measurement counts")}
        className="space-y-2 rounded border border-stage-border p-2"
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      >
        {open && (
          <>
            <p className="text-xs text-stage-muted" id={`${id}-help`}>
              {t("Escape closes the counts table and returns to its button.")}
            </p>
            <div
              className="overflow-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-teal"
              style={{
                maxHeight:
                  "min(20rem, calc(var(--game-viewport-height) * 0.45))",
              }}
              tabIndex={0}
              role="group"
              aria-label={t("Scrollable counts table")}
              aria-describedby={`${id}-help`}
            >
              <table className="w-full text-left text-xs [&_td]:px-2 [&_td]:py-2 [&_th]:px-2 [&_th]:py-2">
                <caption className="py-2 text-left text-accent-teal">
                  {t("All outcome counts")}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t("Outcome")}</th>
                    <th scope="col">{t("Count")}</th>
                    <th scope="col">{t("Share of shots")}</th>
                    {probabilities && (
                      <th scope="col">{t("Ideal probability")}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key} className="border-t border-stage-border">
                      <th scope="row">
                        <code className="whitespace-nowrap">{label(key)}</code>
                      </th>
                      <td>{counts[key] ?? 0}</td>
                      <td>{share(counts[key] ?? 0)}%</td>
                      {probabilities && (
                        <td>{((probabilities[key] ?? 0) * 100).toFixed(1)}%</td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stage-border">
                    <th scope="row">{t("Total")}</th>
                    <td>{shots}</td>
                    <td>{share(shots)}%</td>
                    {probabilities && <td>—</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
            <button
              type="button"
              className="btn-ghost min-h-11 text-xs"
              onClick={close}
            >
              {t("Hide all counts")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
