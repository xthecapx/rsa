"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { api, type IbmBatchDetail, type IbmBatchSummary } from "@/lib/api";
import { useGameStore } from "@/store/game";

interface IbmBatchTableProps {
  onLoadRun?: (batch: IbmBatchDetail) => void;
  /** Only fetch IBM APIs when this panel is actually shown (Aer mode must not hit /ibm). */
  active?: boolean;
}

export default function IbmBatchTable({
  onLoadRun,
  active = true,
}: IbmBatchTableProps) {
  const setIbmBatch = useGameStore((s) => s.setIbmBatch);
  const ibmBatch = useGameStore((s) => s.ibmBatch);
  const [batches, setBatches] = useState<IbmBatchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoLoaded = useRef(false);

  const loadBatch = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const batch = await api.ibm.batch(id);
      setIbmBatch(batch);
      onLoadRun?.(batch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load batch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) {
      autoLoaded.current = false;
      return;
    }
    let cancelled = false;
    api.ibm
      .batches()
      .then((res) => {
        if (cancelled) return;
        const list = res.batches ?? [];
        setBatches(list);
        // Prefer a real hardware batch over the offline demo.
        if (
          list.length > 0 &&
          !autoLoaded.current &&
          (!ibmBatch || ibmBatch.cached)
        ) {
          autoLoaded.current = true;
          void loadBatch(list[0].batch_id);
        }
      })
      .catch(() => {
        if (!cancelled) setBatches([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when IBM panel opens
  }, [active]);

  const loadCached = async () => {
    setLoading(true);
    setError(null);
    try {
      const batch = await api.ibm.cached();
      setIbmBatch(batch);
      onLoadRun?.(batch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cached run");
    } finally {
      setLoading(false);
    }
  };

  const displayBatch = ibmBatch;
  const selectedId = displayBatch?.batch_id;

  return (
    <div className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-xs uppercase tracking-wider text-stage-muted">
          IBM batches (offline readout)
        </h4>
        <button
          type="button"
          className="btn-ghost text-xs"
          disabled={loading}
          onClick={loadCached}
          title="Fallback demo JSON — not your Marrakesh runs"
        >
          Load demo fallback
        </button>
      </div>

      {error && <p className="text-sm text-actor-hacker">{error}</p>}

      {batches.length === 0 && !loading && (
        <p className="text-xs text-stage-muted">
          No batch IDs in <code className="text-accent-teal">IBM_BATCH_IDS</code>
          . Restart backend after updating <code>.env</code>, or use the demo
          fallback.
        </p>
      )}

      {batches.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stage-border text-xs uppercase text-stage-muted">
                <th className="py-2 pr-4">Label</th>
                <th className="py-2 pr-4">Batch ID</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const selected = selectedId === b.batch_id;
                return (
                  <tr
                    key={b.batch_id}
                    className={clsx(
                      "border-b border-stage-border/50",
                      selected && "bg-accent-teal/10",
                    )}
                  >
                    <td className="py-2 pr-4 font-mono">{b.label ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{b.batch_id}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        className={clsx(
                          "text-xs",
                          selected ? "btn-primary" : "btn-ghost",
                        )}
                        disabled={loading}
                        onClick={() => loadBatch(b.batch_id)}
                      >
                        {loading && selected
                          ? "Loading…"
                          : selected
                            ? "Loaded"
                            : "Load"}
                      </button>
                      {b.console_url && (
                        <a
                          href={b.console_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost ml-2 text-xs"
                        >
                          Console
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loading && !displayBatch && (
        <p className="text-xs text-stage-muted">Fetching batch from IBM…</p>
      )}

      {displayBatch && (
        <div className="rounded-lg border border-stage-border bg-stage-bg/40 p-3">
          <div className="mb-2 flex flex-wrap gap-3 text-xs text-stage-muted">
            <span>N={displayBatch.N}</span>
            <span>a={displayBatch.a}</span>
            <span>control={displayBatch.num_control}</span>
            <span>{displayBatch.backend_name ?? "backend?"}</span>
            {displayBatch.label && (
              <span className="text-accent-teal">{displayBatch.label}</span>
            )}
            {displayBatch.cached && (
              <span className="text-accent-amber">cached demo (not QPU)</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stage-border text-xs uppercase text-stage-muted">
                  <th className="py-2 pr-3">Job</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Shots</th>
                  <th className="py-2">Link</th>
                </tr>
              </thead>
              <tbody>
                {displayBatch.jobs?.map((job) => (
                  <tr key={job.job_id} className="border-b border-stage-border/40">
                    <td className="py-2 pr-3 font-mono text-xs">{job.job_id}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={clsx(
                          job.status === "DONE" ||
                            String(job.status).includes("DONE")
                            ? "text-accent-teal"
                            : "text-stage-muted",
                        )}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {Object.values(job.counts ?? {}).reduce((a, b) => a + b, 0)}
                    </td>
                    <td className="py-2">
                      {job.console_url && (
                        <a
                          href={job.console_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-teal hover:underline"
                        >
                          console
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {displayBatch.references && (
            <div className="mt-3 grid gap-2 text-xs text-stage-muted sm:grid-cols-2">
              {displayBatch.references.ideal && (
                <div>
                  <span className="text-accent-teal">Ideal:</span>{" "}
                  {Object.keys(displayBatch.references.ideal).length} peaks
                </div>
              )}
              {displayBatch.references.aer_noiseless && (
                <div>
                  <span className="text-accent-teal">Aer noiseless:</span>{" "}
                  {Object.values(displayBatch.references.aer_noiseless).reduce(
                    (a, b) => a + b,
                    0,
                  )}{" "}
                  shots
                </div>
              )}
              {displayBatch.references.true_order != null && (
                <div>
                  True order r = {displayBatch.references.true_order}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
