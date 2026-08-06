"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    api.ibm
      .batches()
      .then((res) => {
        if (!cancelled) setBatches(res.batches ?? []);
      })
      .catch(() => {
        if (!cancelled) setBatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

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

  return (
    <div className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-xs uppercase tracking-wider text-stage-muted">
          IBM batches
        </h4>
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={loading}
          onClick={loadCached}
        >
          Load recorded run
        </button>
      </div>

      {error && <p className="text-sm text-actor-hacker">{error}</p>}

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
              {batches.map((b) => (
                <tr key={b.batch_id} className="border-b border-stage-border/50">
                  <td className="py-2 pr-4 font-mono">{b.label ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{b.batch_id}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      disabled={loading}
                      onClick={() => loadBatch(b.batch_id)}
                    >
                      Load
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {displayBatch && (
        <div className="rounded-lg border border-stage-border bg-stage-bg/40 p-3">
          <div className="mb-2 flex flex-wrap gap-3 text-xs text-stage-muted">
            <span>N={displayBatch.N}</span>
            <span>a={displayBatch.a}</span>
            <span>control={displayBatch.num_control}</span>
            <span>{displayBatch.backend_name}</span>
            {displayBatch.cached && (
              <span className="text-accent-amber">cached demo</span>
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
                          job.status === "DONE"
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
