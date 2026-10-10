"use client";

import type { ReactNode } from "react";
import { t, useLocale } from "@/i18n";

/** Compact actions anchored to the circuit; labels remain available on hover. */
export function CircuitActions({
  onClear,
  onRun,
  busy = false,
  runDisabled = false,
  clearLabel = "Clear circuit",
  runLabel = "Run circuit",
  shots = 256,
  children,
  controlsLabel = "Circuit controls",
}: {
  onClear: () => void;
  onRun?: () => void;
  busy?: boolean;
  runDisabled?: boolean;
  clearLabel?: string;
  runLabel?: string;
  shots?: number;
  children?: ReactNode;
  controlsLabel?: string;
}) {
  useLocale((s) => s.locale);
  const clear = t(clearLabel);
  const run = busy
    ? t("Running circuit…")
    : `${t(runLabel)} · ${shots} ${t("shots")}`;
  return (
    <div className="circuit-actions" role="group" aria-label={t(controlsLabel)}>
      {children}
      <button
        type="button"
        className="circuit-icon-action clear"
        disabled={busy}
        onClick={onClear}
        aria-label={clear}
        title={clear}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
        </svg>
      </button>
      {onRun && (
        <button
          type="button"
          className="circuit-icon-action run"
          disabled={busy || runDisabled}
          onClick={onRun}
          aria-label={run}
          title={run}
        >
          {busy ? (
            <svg
              aria-hidden="true"
              className="motion-safe:animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 12a8 8 0 1 1-8-8" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 4v16l13-8z" />
            </svg>
          )}
          <span className="circuit-shots-badge" aria-hidden="true">
            {shots}
          </span>
        </button>
      )}
    </div>
  );
}
