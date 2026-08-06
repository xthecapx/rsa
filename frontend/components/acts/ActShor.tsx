"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type IbmBatchDetail, type ShorSimulateResponse } from "@/lib/api";
import { getLevelCopy } from "@/content/levels";
import { useGameStore, type Modulus } from "@/store/game";
import Histogram from "@/components/Histogram";
import IbmBatchTable from "@/components/IbmBatchTable";
import PipelineStrip from "@/components/PipelineStrip";
import ShorPeakTable from "@/components/ShorPeakTable";
import ShorTerminal, { type ShorLogLine } from "@/components/ShorTerminal";

type QuantumSource = "aer" | "ibm";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ActShor() {
  const tier = useGameStore((s) => s.tier);
  const modulus = useGameStore((s) => s.modulus);
  const setModulus = useGameStore((s) => s.setModulus);
  const shorA = useGameStore((s) => s.shorA);
  const setShorA = useGameStore((s) => s.setShorA);
  const shorPlan = useGameStore((s) => s.shorPlan);
  const setShorPlan = useGameStore((s) => s.setShorPlan);
  const shorResult = useGameStore((s) => s.shorResult);
  const setShorResult = useGameStore((s) => s.setShorResult);
  const ibmBatch = useGameStore((s) => s.ibmBatch);
  const setIbmBatch = useGameStore((s) => s.setIbmBatch);
  const setError = useGameStore((s) => s.setError);
  const copy = getLevelCopy(4, tier);

  const [source, setSource] = useState<QuantumSource>("aer");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [logs, setLogs] = useState<ShorLogLine[]>([]);

  const sim = shorResult as ShorSimulateResponse | null;

  const pushLog = useCallback((text: string, tone?: ShorLogLine["tone"]) => {
    setLogs((prev) => [...prev, { text, tone }]);
  }, []);

  const selectSource = (next: QuantumSource) => {
    setSource(next);
    if (next === "aer") setIbmBatch(null);
  };

  const runShorAer = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIbmBatch(null);
    setLogs([]);
    setPhase("plan");

    try {
      pushLog(`$ shor plan --N ${modulus} --a ${shorA}`, "cmd");
      pushLog("[*] classical precheck · build QPE step plan", "meta");
      await sleep(200);

      const plan = await api.shor.plan(modulus, shorA);
      setShorPlan(plan);

      const pre = plan.precheck as {
        needs_quantum?: boolean;
        reason?: string;
      };
      pushLog(
        `[*] precheck: ${pre.reason ?? "ok"} · needs_quantum=${String(pre.needs_quantum)}`,
        "meta",
      );
      pushLog(
        `[*] ladder: ${plan.quantum_required_slots} active M_b gates · ${plan.identity_skipped} identity skipped · m=${plan.num_control} control qubits`,
        "meta",
      );

      if (plan.classical_order != null) {
        const fac = plan.factors_from_classical_order?.factors;
        pushLog(
          `[*] baseline classical order (not Aer): r=${plan.classical_order}` +
            (fac ? ` → factors [${fac.join(", ")}]` : ""),
          "dim",
        );
      }

      if (pre.needs_quantum === false) {
        setShorResult({
          precheck: plan.precheck,
          circuit_built: false,
          factor: plan.factor,
          factors: plan.factors,
        });
        pushLog(
          `[✓] factored in precheck — no quantum circuit` +
            (plan.factors ? ` → [${plan.factors.join(", ")}]` : ""),
          "ok",
        );
        setPhase("done");
        return;
      }

      const strategy =
        modulus === 15 && shorA === 7 ? "swap_network" : "permutation";
      setPhase("simulate");
      pushLog(
        `$ shor simulate --backend AerSimulator --strategy ${strategy} --shots 512`,
        "cmd",
      );
      pushLog(
        "[*] one job: compile full QWARD Shor circuit → sample control register",
        "meta",
      );
      await sleep(150);

      const res = await api.shor.simulate({
        N: modulus,
        a: shorA,
        strategy,
        shots: 512,
      });
      setShorResult(res);

      pushLog(
        `[*] AerSimulator done · qubits=${res.num_qubits} depth=${res.circuit_depth} shots=${res.shots} jobs=${res.jobs_run ?? 1}`,
        "meta",
      );

      const hit = res.shor_result;
      const shots = res.shots ?? 512;
      const hitCount =
        hit?.bitstring && res.counts
          ? res.counts[hit.bitstring] ?? 0
          : 0;
      const hitPct = shots ? (100 * hitCount) / shots : 0;
      const orderPct =
        res.order_hit_rate != null ? 100 * res.order_hit_rate : null;

      if (hit?.found) {
        pushLog(
          `[*] post-process: continued fractions on measured phases`,
          "meta",
        );
        pushLog(
          `[✓] example peak ${hit.bitstring} · ${hitCount}/${shots} shots (${hitPct.toFixed(1)}%) · phase=${hit.phase?.toFixed(3)} ≈ ${hit.fraction} → r=${hit.order_guess}` +
            (hit.order_matches_true ? " ✓" : ""),
          "ok",
        );
        if (hit.factors) {
          pushLog(
            `[✓] factors from that peak: [${hit.factors.join(", ")}]`,
            "ok",
          );
        }
        if (orderPct != null) {
          pushLog(
            `[*] true-order rate (all peaks with r=${hit.true_order}): ${orderPct.toFixed(1)}% of shots — not the same as one bin`,
            "dim",
          );
        }
      } else {
        pushLog(
          "[!] no nontrivial factoring peak ranked yet — inspect histogram",
          "warn",
        );
      }

      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shor simulate failed");
      pushLog(
        `[x] ${e instanceof Error ? e.message : "Shor simulate failed"}`,
        "err",
      );
      setPhase("error");
    } finally {
      setLoading(false);
    }
  }, [
    modulus,
    shorA,
    setShorPlan,
    setShorResult,
    setError,
    setIbmBatch,
    pushLog,
  ]);

  const handleIbmLoad = useCallback(
    (batch: IbmBatchDetail) => {
      setLogs([]);
      setPhase("ibm");
      pushLog(`$ shor load-ibm --batch ${batch.batch_id}`, "cmd");
      pushLog(
        `[*] offline hardware batch · backend=${batch.backend_name ?? "IBM"}`,
        "meta",
      );

      const analysis = batch.jobs?.[0]?.analysis as
        | {
            outcomes?: {
              factoring?: { nontrivial?: boolean; factors?: number[] };
              order_guess?: number;
              bitstring?: string;
              order_matches_true?: boolean;
              count?: number;
              phase?: number;
              fraction?: string;
            }[];
          }
        | undefined;
      const outcomes = analysis?.outcomes ?? [];
      const ranked = [...outcomes]
        .filter((o) => o.factoring?.nontrivial)
        .sort((a, b) => {
          const score = (o: (typeof outcomes)[0]) =>
            (o.order_matches_true ? 1 : 0) * 1000 +
            (o.factoring?.factors?.length ?? 0) * 100 +
            (o.count ?? 0);
          return score(b) - score(a);
        });
      const hit = ranked[0];
      const shots = Object.values(batch.jobs?.[0]?.counts ?? {}).reduce(
        (a, b) => a + b,
        0,
      );
      const hitCount = hit?.count ?? 0;

      setShorResult({
        counts: batch.jobs?.[0]?.counts ?? {},
        analysis: batch.jobs?.[0]?.analysis,
        expected_distribution: batch.references?.ideal,
        precheck: { source: "ibm_batch", batch_id: batch.batch_id },
        backend: batch.backend_name ?? "IBM Quantum",
        engine: "qward.algorithms.Shor (hardware batch)",
        true_order: batch.references?.true_order,
        shots,
        jobs_run: batch.jobs?.length ?? 1,
        successful_outcomes:
          ranked.slice(0, 8) as ShorSimulateResponse["successful_outcomes"],
        shor_result: {
          found: !!hit,
          order_guess: hit?.order_guess,
          factors: hit?.factoring?.factors ?? null,
          bitstring: hit?.bitstring,
          order_matches_true: hit?.order_matches_true,
          true_order: batch.references?.true_order,
          phase: hit?.phase,
          fraction: hit?.fraction,
        },
      });
      setSource("ibm");

      if (hit) {
        pushLog(
          `[✓] peak ${hit.bitstring} · ${hitCount}/${shots} shots (${shots ? ((100 * hitCount) / shots).toFixed(1) : "0"}%) → r=${hit.order_guess}` +
            (hit.factoring?.factors
              ? ` → [${hit.factoring.factors.join(", ")}]`
              : ""),
          "ok",
        );
      }
      pushLog("[*] histogram below is this batch's control-register counts", "dim");
      setPhase("done");
    },
    [setShorResult, pushLog],
  );

  useEffect(() => {
    (window as unknown as { __actShorSend?: () => void }).__actShorSend =
      runShorAer;
    return () => {
      delete (window as unknown as { __actShorSend?: () => void }).__actShorSend;
    };
  }, [runShorAer]);

  const counts = useMemo(() => {
    if (source === "ibm" && ibmBatch?.jobs?.[0]?.counts) {
      return ibmBatch.jobs[0].counts;
    }
    return sim?.counts ?? {};
  }, [source, ibmBatch, sim]);

  const expected = useMemo(() => {
    if (source === "ibm" && ibmBatch?.references?.ideal) {
      const ideal = ibmBatch.references.ideal;
      const total = Object.values(ideal).reduce((a, b) => a + b, 0);
      if (total <= 1) {
        const shots = Object.values(
          ibmBatch.jobs?.[0]?.counts ?? {},
        ).reduce((a, b) => a + b, 0);
        return Object.fromEntries(
          Object.entries(ideal).map(([k, v]) => [k, v * shots]),
        );
      }
      return ideal;
    }
    const dist = sim?.expected_distribution;
    if (!dist) return undefined;
    const shots = sim?.shots ?? 512;
    return Object.fromEntries(
      Object.entries(dist).map(([k, v]) => [k, v * shots]),
    );
  }, [source, ibmBatch, sim]);

  const peakOutcomes = useMemo(() => {
    if (!sim) return [];
    type Outcome = NonNullable<ShorSimulateResponse["successful_outcomes"]>[number];
    const analysisOutcomes =
      (sim.analysis as { outcomes?: Outcome[] } | undefined)?.outcomes ?? [];
    const byBit = new Map(analysisOutcomes.map((o) => [o.bitstring, o]));
    if (!Object.keys(counts).length) return analysisOutcomes.slice(0, 8);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([bitstring, count]) => {
        const row = byBit.get(bitstring);
        return row ?? { bitstring, count };
      });
  }, [sim, counts]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <header className="shrink-0">
        <h2 className="font-display text-base font-bold text-accent-amber sm:text-lg">
          {copy.headline}
        </h2>
        <p className="text-xs text-stage-muted sm:text-sm">{copy.subhead}</p>
      </header>

      <div className="panel shrink-0 px-2 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stage-muted">N</span>
          {([15, 21] as Modulus[]).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setModulus(n)}
              disabled={loading}
              className={
                modulus === n ? "btn-primary text-xs" : "btn-ghost text-xs"
              }
            >
              {n}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-stage-muted">a</span>
            <input
              type="number"
              min={2}
              max={modulus - 1}
              value={shorA}
              disabled={loading}
              onChange={(e) => setShorA(Number(e.target.value) || 7)}
              className="w-14 rounded border border-stage-border bg-stage-bg px-2 py-1 font-mono"
            />
          </label>
          <div className="flex flex-wrap gap-1 sm:ml-auto">
            <button
              type="button"
              onClick={() => selectSource("aer")}
              className={
                source === "aer" ? "btn-primary text-xs" : "btn-ghost text-xs"
              }
            >
              AerSimulator
            </button>
            <button
              type="button"
              onClick={() => selectSource("ibm")}
              className={
                source === "ibm" ? "btn-primary text-xs" : "btn-ghost text-xs"
              }
            >
              IBM batch
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="min-h-0 flex-[1.1] space-y-2 overflow-y-auto">
          <PipelineStrip steps={shorPlan?.step_plan ?? []} />
          <Histogram
            counts={counts}
            expected={expected}
            title={
              source === "ibm"
                ? "IBM · control-register counts"
                : "AerSimulator · control-register counts"
            }
          />
          <ShorPeakTable
            outcomes={peakOutcomes}
            trueOrder={sim?.true_order ?? sim?.shor_result?.true_order}
            highlightBitstring={sim?.shor_result?.bitstring}
          />
          {source === "ibm" && (
            <IbmBatchTable
              active={source === "ibm"}
              onLoadRun={handleIbmLoad}
            />
          )}
        </div>

        <div className="min-h-0 flex-1">
          <ShorTerminal lines={logs} phase={phase} running={loading} />
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {source === "aer" ? (
          <button
            type="button"
            className="btn-primary"
            disabled={loading}
            onClick={runShorAer}
          >
            {loading ? "Running Shor…" : "Run Shor on AerSimulator"}
          </button>
        ) : (
          <span className="text-xs text-stage-muted">
            IBM mode loads your Marrakesh batches from{" "}
            <code className="text-accent-teal">IBM_BATCH_IDS</code> (m3–m8).
          </span>
        )}
        <span className="text-xs text-stage-muted">
          Open <strong className="text-accent-teal">Math</strong> for the
          blackboard.
        </span>
      </div>
    </div>
  );
}
