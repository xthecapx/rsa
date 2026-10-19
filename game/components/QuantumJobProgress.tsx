"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { t, useLocale } from "@/i18n";
import {
  restoreExperiment,
  useExecution,
  type Execution,
} from "@/lib/execution";
import { estimateSeconds } from "@/lib/runEstimates";

/** Seconds into a web run before the first-run "waking up" hint appears. */
const WAKING_AFTER_SECONDS = 5;

/** What this one run is waiting for. Every run has its own label, timer and
 * estimate; nothing carries over from an earlier circuit. */
function RunDetails({ job, seconds }: { job: Execution; seconds: number }) {
  const web = job.target === "web";
  const range = job.estimate ? estimateSeconds(job.estimate) : null;
  const slow = web && range !== null && seconds > range.high;
  const waking = web && job.firstOfVisit && seconds >= WAKING_AFTER_SECONDS;
  return (
    <>
      {job.label && (
        <p className="text-stage-muted">
          {t("Waiting for:")} {t(job.label)}
        </p>
      )}
      {range && !slow && (
        <p className="text-stage-muted">
          {t(
            `Usually about ${range.low}–${range.high} s. This is an estimate.`,
          )}
        </p>
      )}
      {slow && !waking && (
        <p className="text-accent-amber">
          {t(
            "Taking longer than usual. The server may be busy or waking up. Nothing runs twice.",
          )}
        </p>
      )}
      {waking && (
        <p className="text-stage-muted">
          {t(
            "The server may be waking up. The first run of a visit can take longer.",
          )}
        </p>
      )}
      {web && job.previousMayBeRunning && (
        <p className="text-accent-amber">
          {t(
            "Your earlier run may still be finishing on the server, so this one can start late.",
          )}
        </p>
      )}
      {job.remote && (
        <p className="text-stage-muted">
          {t(
            "This is a remote quantum job. It runs asynchronously and queues can take several minutes. This circuit has its own wait, so keep the game open.",
          )}
        </p>
      )}
    </>
  );
}

/** Shown once per visit, before the first remote job is submitted. */
function RemoteNotice({ resolve }: { resolve: (proceed: boolean) => void }) {
  return (
    <section
      aria-labelledby="remote-notice-title"
      className="space-y-2 border-b border-stage-border pb-3 mb-3"
    >
      <h3 id="remote-notice-title" className="text-accent-amber">
        {t("Before you run on a quantum computer")}
      </h3>
      <p>
        {t(
          "This run goes to a real quantum backend. It is asynchronous: the job joins a queue and can take several minutes to finish. Please be patient and keep the game open.",
        )}
      </p>
      <p>
        {t(
          "Once it starts it cannot be cancelled here, and this game session can submit only one remote job. A later circuit is a new job with its own wait, after you restart the game.",
        )}
      </p>
      <p>
        {t(
          "Keep your checkpoint code and export your lab layout before you continue.",
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          autoFocus
          className="btn-primary min-h-11"
          onClick={() => resolve(true)}
        >
          {t("Run on the quantum backend")}
        </button>
        <button className="btn-ghost min-h-11" onClick={() => resolve(false)}>
          {t("Not yet")}
        </button>
      </div>
    </section>
  );
}

const labels: Record<string, string> = {
  bridge_queued: "Queued in this game…",
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

/** Shared HTTP/bridge feedback. Provider states are supplied by Qollab itself. */
export function QuantumJobProgress() {
  useLocale((s) => s.locale);
  const jobs = useExecution((s) => s.active);
  const feedbackHost = useExecution((s) => s.feedbackHost);
  const background = useExecution((s) => s.background);
  const remoteNotice = useExecution((s) => s.remoteNotice);
  const [expanded, setExpanded] = useState(false);
  const [remoteUsed, setRemoteUsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const restoreFocus = () =>
    feedbackHost
      ?.closest<HTMLElement>('[role="dialog"]')
      ?.focus({ preventScroll: true });
  useEffect(() => {
    // Disabled Run / disappearing status buttons can leave focus on the body.
    if (document.activeElement === document.body)
      feedbackHost
        ?.closest<HTMLElement>('[role="dialog"]')
        ?.focus({ preventScroll: true });
  }, [feedbackHost, jobs.length]);
  useEffect(() => {
    const used = () => {
      setRemoteUsed(true);
      setDismissed(false);
    };
    window.addEventListener("quantum-remote-used", used);
    return () => window.removeEventListener("quantum-remote-used", used);
  }, []);
  useEffect(() => {
    if (!jobs.length) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [jobs.length]);
  const visible = jobs.filter((job) => now - job.started >= 1000);
  if (background)
    return (
      <aside
        aria-label={t("Experiment status")}
        className="fixed bottom-3 right-3 z-[100] w-[calc(100%-1.5rem)] max-w-sm max-h-[40vh] overflow-y-auto rounded border-2 border-accent-teal bg-stage-bg p-3 font-body text-xs shadow-xl"
      >
        <p className="text-accent-teal" role="status">
          <span
            aria-hidden="true"
            className={`mr-2 inline-block h-2 w-2 rounded-full bg-accent-teal ${background.running ? "motion-safe:animate-pulse" : ""}`}
          />
          {t(
            background.running ? "Experiment running…" : "Experiment finished",
          )}
        </p>
        <p className="mt-1 text-stage-muted">{t(background.title)}</p>
        {jobs[0] && (
          <p className="mt-1 text-stage-muted">
            {t(labels[jobs[0].state] ?? "Waiting for backend measurements…")} ·{" "}
            {t(
              `Elapsed: ${Math.max(0, Math.floor((now - jobs[0].started) / 1000))}s`,
            )}
          </p>
        )}
        {jobs[0] && (
          <div className="mt-1 space-y-1">
            <RunDetails
              job={jobs[0]}
              seconds={Math.max(0, Math.floor((now - jobs[0].started) / 1000))}
            />
          </div>
        )}
        <p className="mt-1 text-stage-muted">
          {t(
            background.running
              ? "You can wait here or return to the experiment. Your run will continue."
              : "Open the laptop to check the result or error. Nothing runs again automatically.",
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            autoFocus
            className="btn-ghost min-h-11"
            onClick={restoreExperiment}
          >
            {t(background.canRestore ? "Return to experiment" : "Dismiss")}
          </button>
          {jobs.length > 0 && (
            <button
              className="btn-ghost min-h-11"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {t("Run details")}
            </button>
          )}
        </div>
        {expanded &&
          jobs.map((job) => (
            <div
              key={job.id}
              className="mt-2 space-y-2 border-t border-stage-border pt-2"
            >
              {job.jobId && (
                <p className="break-all">{t(`Job ID: ${job.jobId}`)}</p>
              )}
              {job.cancelQueued ? (
                <button
                  className="btn-ghost min-h-11"
                  onClick={() => job.cancelQueued?.()}
                >
                  {t("Cancel queued run")}
                </button>
              ) : job.stopWaiting ? (
                <>
                  <p>
                    {t(
                      "Stopping the wait discards this result. The server may continue computing.",
                    )}
                  </p>
                  <button
                    className="btn-ghost min-h-11"
                    onClick={job.stopWaiting}
                  >
                    {t("Stop waiting")}
                  </button>
                </>
              ) : (
                <p>
                  {t(
                    "This run has started and cannot be cancelled here. Keep the game open; remote backends can take several minutes.",
                  )}
                </p>
              )}
            </div>
          ))}
      </aside>
    );
  if (
    !remoteNotice &&
    !visible.length &&
    (!remoteUsed || dismissed || jobs.length)
  )
    return null;
  const panel = (
    <aside
      aria-label={t("Experiment status")}
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
      className="fixed bottom-3 left-3 right-3 z-[100] mx-auto max-h-[min(40vh,calc(var(--game-viewport-height)-1.5rem))] max-w-xl overflow-y-auto rounded border-2 border-accent-teal bg-stage-bg p-3 text-xs shadow-xl"
    >
      {remoteNotice && <RemoteNotice resolve={remoteNotice.resolve} />}
      {visible.map((job) => (
        <div key={job.id} className="space-y-1">
          <p role="status" className="text-accent-teal">
            {t(labels[job.state] ?? "Waiting for backend measurements…")}
          </p>
          <p className="text-stage-muted">
            {t(
              `Elapsed: ${Math.max(0, Math.floor((now - job.started) / 1000))}s`,
            )}
          </p>
          <RunDetails
            job={job}
            seconds={Math.max(0, Math.floor((now - job.started) / 1000))}
          />
          {job.jobId && (
            <p className="break-all text-stage-muted">
              {t(`Job ID: ${job.jobId}`)}
            </p>
          )}
          {job.cancelQueued ? (
            <>
              <p className="text-stage-muted">
                {t(
                  "This run has not started. You can remove it from the game queue.",
                )}
              </p>
              <button
                className="btn-ghost min-h-11"
                onClick={() => {
                  restoreFocus();
                  job.cancelQueued?.();
                }}
              >
                {t("Cancel queued run")}
              </button>
            </>
          ) : job.stopWaiting ? (
            <>
              <p className="text-stage-muted">
                {t(
                  "Stopping the wait discards this result. The server may continue computing.",
                )}
              </p>
              <button
                className="btn-ghost min-h-11"
                onClick={() => {
                  restoreFocus();
                  job.stopWaiting?.();
                }}
              >
                {t("Stop waiting")}
              </button>
            </>
          ) : (
            <p className="text-stage-muted">
              {t(
                job.target === "qollab"
                  ? "This run has started and cannot be cancelled here. Keep the game open; remote backends can take several minutes."
                  : "This run cannot be cancelled here. Waiting does not submit another job.",
              )}
            </p>
          )}
        </div>
      ))}
      {!jobs.length && remoteUsed && !dismissed && (
        <div role="status">
          <p className="text-accent-amber">
            {t("Remote job used for this game session.")}
          </p>
          <p className="mt-1 text-stage-muted">
            {t(
              "If this was a challenge run, collect its badge before keeping your code.",
            )}
          </p>
          <p className="mt-1 text-stage-muted">
            {t(
              "Keep your checkpoint code and export any custom lab layout, then restart the game before another remote experiment or final challenge.",
            )}
          </p>
          <p className="mt-1 text-stage-muted">
            {t(
              "If noise gives an unsuccessful result, restart before retrying.",
            )}
          </p>
          <p className="mt-1 text-stage-muted">
            {t(
              "After restarting, use Save progress to restore your checkpoint. No circuit runs automatically.",
            )}
          </p>
          <button
            className="btn-ghost mt-2 min-h-11"
            onClick={() => {
              restoreFocus();
              setDismissed(true);
            }}
          >
            {t("Continue exploring")}
          </button>
        </div>
      )}
    </aside>
  );
  // Keep actions within the laptop's modal focus trap and accessible subtree.
  return feedbackHost ? createPortal(panel, feedbackHost) : panel;
}
