"use client";
import { useEffect, useRef } from "react";
import type { LabRecipe } from "@/game/labCircuit";
import { operationLabel as label } from "@/game/labEditor";
import type { LabResult } from "@/lib/lab";
import { t, useLocale } from "@/i18n";
import { CircuitHistogram } from "./CircuitHistogram";

export interface LabExperiment {
  recipe: LabRecipe;
  result: LabResult;
  date: string;
}

/** Render completed snapshots independently of editing and request ownership. */
export function LabResults({
  recipe,
  selectedBackend,
  latest,
  previous,
  crypto,
  period,
}: {
  recipe: LabRecipe;
  selectedBackend: string;
  latest: LabExperiment | null;
  previous: LabExperiment | null;
  crypto: string | null;
  period: Record<string, unknown> | null;
}) {
  useLocale((s) => s.locale);
  const results = useRef<HTMLElement>(null);
  const periodResults = useRef<HTMLElement>(null);
  const same =
    !!latest &&
    JSON.stringify(latest.recipe) === JSON.stringify(recipe) &&
    latest.result.backend === selectedBackend;
  useEffect(() => {
    if (latest || period)
      (period ? periodResults.current : results.current)?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [latest, period]);
  return (
    <>
      {latest && (
        <section ref={results} className="space-y-2">
          <h3>
            {t(
              same
                ? "Current circuit results"
                : "Previous run — the circuit or selected backend has changed",
            )}
          </h3>
          <p className="text-xs text-stage-muted">
            {latest.date} · {latest.recipe.start} ·{" "}
            {latest.recipe.operations.map(label).join(" → ") || "M"}
          </p>
          <CircuitHistogram {...latest.result} />
          <details>
            <summary>{t("Executed circuit")}</summary>
            <pre className="overflow-auto text-xs">
              {latest.result.circuit_text}
            </pre>
          </details>
        </section>
      )}
      {previous && (
        <details>
          <summary>{t("Compare with previous run")}</summary>
          <p>
            {previous.result.backend} ·{" "}
            {previous.recipe.operations.map(label).join(" → ")}
          </p>
          <CircuitHistogram {...previous.result} />
        </details>
      )}
      {crypto && (
        <pre className="panel p-3 overflow-auto text-sm">{crypto}</pre>
      )}
      {period && (
        <section ref={periodResults} className="space-y-2">
          <h3>{t("Period experiment results")}</h3>
          <CircuitHistogram
            counts={period.counts as Record<string, number>}
            backend={period.backend as string}
            kind={period.kind as "ideal" | "noise" | "hardware"}
            source={period.source as "simulator" | "hardware"}
          />
          <pre className="panel p-3 overflow-auto text-xs">
            {JSON.stringify(period.shor_result, null, 2)}
          </pre>
          <details>
            <summary>{t("Executed circuit")}</summary>
            <pre className="overflow-auto text-xs">
              {String(period.circuit_text)}
            </pre>
          </details>
        </section>
      )}
    </>
  );
}
