"use client";

import { useEffect, useState } from "react";
import { t, useLocale } from "@/i18n";

const labels: Record<string, string> = {
  preparing: "Preparing the circuit…",
  submitting: "Submitting to the selected backend…",
  initializing: "Initializing the quantum job…",
  validating: "Validating the circuit…",
  queued: "Queued at the backend…",
  running: "Executing the circuit…",
  waiting: "Waiting for backend measurements…",
  done: "Retrieving measurements…",
  retrieving: "Retrieving measurements…",
  error: "The backend reported an error…",
  cancelled: "The backend cancelled the job…",
};

/** One runtime listener covers every embedded lesson, including laptop overlays. */
export function QuantumJobProgress() {
  useLocale((s) => s.locale);
  const [job, setJob] = useState<{ state: string; jobId: string; started: number } | null>(null);
  const [remoteUsed, setRemoteUsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ state: string; jobId: string }>).detail;
      setJob((previous) => detail.state === "idle" ? null : {
        ...detail, started: previous?.started ?? Date.now(),
      });
      setNow(Date.now());
    };
    const used = () => { setRemoteUsed(true); setDismissed(false); };
    window.addEventListener("quantum-remote-used", used);
    window.addEventListener("quantum-job-progress", update);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.removeEventListener("quantum-remote-used", used); window.removeEventListener("quantum-job-progress", update); window.clearInterval(timer); };
  }, []);
  if (!job || now - job.started < 1000) {
    if (!remoteUsed || dismissed) return null;
    return <div role="status" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="fixed bottom-3 left-3 right-3 z-[100] mx-auto max-h-[calc(var(--game-viewport-height)-1.5rem)] max-w-xl overflow-y-auto rounded border-2 border-accent-amber bg-stage-bg p-3 text-xs shadow-xl">
      <p className="text-accent-amber">{t("Remote job used for this game session.")}</p>
      <p className="mt-1 text-stage-muted">{t("If this was a challenge run, collect its badge before keeping your code.")}</p>
      <p className="mt-1 text-stage-muted">{t("Keep your checkpoint code and export any custom lab layout, then restart the game before another remote experiment or final challenge.")}</p>
      <p className="mt-1 text-stage-muted">{t("If noise gives an unsuccessful result, restart before retrying.")}</p>
      <p className="mt-1 text-stage-muted">{t("After restarting, use Save progress to restore your checkpoint. No circuit runs automatically.")}</p>
      <button className="btn-ghost mt-2" onClick={() => setDismissed(true)}>{t("Continue exploring")}</button>
    </div>;
  }
  return <div style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="fixed bottom-3 left-3 right-3 z-[100] mx-auto max-h-[calc(var(--game-viewport-height)-1.5rem)] max-w-xl overflow-y-auto rounded border-2 border-accent-teal bg-stage-bg p-3 text-xs shadow-xl">
    <p role="status" aria-live="polite" className="text-accent-teal">{t(labels[job.state] ?? "Waiting for backend measurements…")}</p>
    <p className="mt-1 text-stage-muted">{t(`Elapsed: ${Math.floor((now - job.started) / 1000)}s`)} · {t("Your job is still active. Remote backends can take several minutes.")}</p>
    {job.jobId && <p className="mt-1 break-all text-stage-muted">{t(`Job ID: ${job.jobId}`)}</p>}
  </div>;
}
