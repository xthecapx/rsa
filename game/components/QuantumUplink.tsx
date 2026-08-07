"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";

import { api } from "@/lib/api";
import type { IbmBatchSummary, ShorSimulateResponse } from "@/lib/api";
import { applyShorResult, gcd, modPow, pickRsaPlaintext } from "@/game/effects";
import { goTo } from "@/game/dialog";
import { useGame } from "@/game/state";

type Source = "aer" | "qpu";

/**
 * Act 4's control panel. The hacker has no quantum hardware in the van, so
 * everything here is a request that leaves over the network: a local simulator
 * dry run first, then a real batch that already ran on IBM hardware.
 */
export function QuantumUplink() {
  const vars = useGame((s) => s.vars);
  const setVars = useGame((s) => s.setVars);
  const pushTerminal = useGame((s) => s.pushTerminal);
  const setError = useGame((s) => s.setError);

  const [source, setSource] = useState<Source>("aer");
  const [batches, setBatches] = useState<IbmBatchSummary[]>([]);
  const [batchId, setBatchId] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [prechecked, setPrechecked] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [found, setFound] = useState(false);

  useEffect(() => {
    api.ibm
      .batches()
      .then((res) => {
        setBatches(res.batches);
        if (res.batches[0]) setBatchId(res.batches[0].batch_id);
      })
      .catch(() => setBatches([]));
  }, []);

  const guard = useCallback(
    async (label: string, work: () => Promise<void>) => {
      setBusy(label);
      setError(null);
      try {
        await work();
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(null);
      }
    },
    [setError],
  );

  /**
   * The captured ciphertext only makes sense under the modulus it was
   * encrypted with, so switching N re-runs the capture against the new key.
   * Otherwise the factors Shor finds would not unlock anything.
   */
  const switchModulus = (n: 15 | 21) =>
    guard("Re-keying the captured session", async () => {
      setPrechecked(false);
      setFound(false);
      setCounts(null);

      const keys = await api.rsa.keygen(n);
      const value = pickRsaPlaintext(keys.N, keys.e);
      const cipher = await api.rsa.encrypt(value, keys.e, n);
      setVars({
        modulus: n,
        e: keys.e,
        d: keys.d,
        p: keys.p,
        q: keys.q,
        letter: String.fromCharCode(64 + value),
        value,
        cipherNumber: cipher.c,
      });
      pushTerminal({
        tone: "note",
        text: `Re-keyed against N = ${n}: public exponent e = ${keys.e}, new capture c = ${cipher.c}.`,
      });
    });

  const runPrecheck = () =>
    guard("Running precheck", async () => {
      const res = await api.shor.plan(vars.modulus, vars.base, vars.numControl);
      const shortcut = Boolean(res.factor);
      pushTerminal({
        tone: shortcut ? "bad" : "good",
        text: shortcut
          ? `Precheck: gcd(${vars.base}, ${vars.modulus}) is already a factor. Classical arithmetic answers this, the QPU would be doing nothing. Pick a base coprime to N.`
          : `Precheck: a = ${vars.base} is coprime to N = ${vars.modulus}. ${res.quantum_required_slots} controlled-multiply slots genuinely need qubits; ${res.identity_skipped} are identities and get skipped.`,
      });
      setPrechecked(!shortcut);
    });

  const runAer = () =>
    guard("Submitting to the simulator", async () => {
      const res: ShorSimulateResponse = await api.shor.simulate({
        N: vars.modulus,
        a: vars.base,
        num_control: vars.numControl,
        shots: 512,
      });
      setCounts(res.counts ?? null);
      pushTerminal({
        tone: "info",
        text: `${res.backend}: ${res.num_qubits} qubits, depth ${res.circuit_depth}, ${res.shots} shots.`,
      });
      applyShorResult(res.shor_result, res.backend ?? "AerSimulator");
      setFound(Boolean(res.shor_result?.found));
    });

  const runQpu = () =>
    guard("Opening uplink to the QPU", async () => {
      const detail = batchId
        ? await api.ibm.batch(batchId).catch(() => api.ibm.cached())
        : await api.ibm.cached();

      const backendName = detail.backend_name ?? "IBM Quantum";
      pushTerminal({
        tone: "note",
        text: detail.cached
          ? `No live credentials, replaying a recorded batch from ${backendName}. These counts came off real hardware.`
          : `Connected to ${backendName}. ${detail.jobs.length} completed job(s) in batch ${detail.batch_id}.`,
      });

      const done = detail.jobs.find((job) => Object.keys(job.counts ?? {}).length);
      if (done) setCounts(done.counts);

      const analysis = done?.analysis as
        | { shor_result?: { order_guess?: number; factors?: number[]; found?: boolean } }
        | undefined;

      if (analysis?.shor_result) {
        applyShorResult(analysis.shor_result, backendName);
        setFound(Boolean(analysis.shor_result.found));
      } else if (detail.references?.true_order) {
        pushTerminal({
          tone: "note",
          text: `Hardware noise smeared the peaks. The reference distribution for this circuit peaks at r = ${detail.references.true_order}.`,
        });
        applyShorResult(
          {
            order_guess: detail.references.true_order,
            factors: factorsFromOrder(
              detail.N ?? vars.modulus,
              detail.a ?? vars.base,
              detail.references.true_order,
            ),
            found: true,
          },
          backendName,
        );
        setFound(true);
      } else {
        pushTerminal({
          tone: "bad",
          text: "This batch has no usable counts. Try the simulator, or another batch.",
        });
      }
    });

  const bars = counts ? topCounts(counts, 8) : [];
  const maxCount = bars.length ? Math.max(...bars.map(([, n]) => n)) : 1;

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <div className="border-b-2 border-stage-border px-3 py-2">
        <span className="text-[10px] uppercase tracking-widest text-[#c084fc]">
          Quantum uplink
        </span>
        <p className="mt-1 text-[10px] leading-relaxed text-stage-muted">
          Nothing here runs in the van. Every button is a request over the
          network to a machine somewhere else.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-[11px]">
        <Field label={`Modulus N = ${vars.modulus}`}>
          <div className="flex gap-2">
            {([15, 21] as const).map((n) => (
              <Toggle
                key={n}
                active={vars.modulus === n}
                onClick={() => void switchModulus(n)}
              >
                {n}
              </Toggle>
            ))}
          </div>
        </Field>

        <Field label={`Base a = ${vars.base}`}>
          <div className="flex flex-wrap gap-2">
            {[2, 4, 7, 8, 11, 13].map((a) => (
              <Toggle
                key={a}
                active={vars.base === a}
                onClick={() => {
                  setVars({ base: a });
                  setPrechecked(false);
                  setFound(false);
                }}
              >
                {a}
              </Toggle>
            ))}
          </div>
        </Field>

        <Field label={`Control qubits = ${vars.numControl}`}>
          <div className="flex gap-2">
            {[3, 4, 6, 8].map((m) => (
              <Toggle
                key={m}
                active={vars.numControl === m}
                onClick={() => setVars({ numControl: m })}
              >
                {m}
              </Toggle>
            ))}
          </div>
        </Field>

        <button
          type="button"
          onClick={() => void runPrecheck()}
          disabled={Boolean(busy)}
          className="btn-ghost w-full text-[11px]"
        >
          1. Classical precheck
        </button>

        <Field label="Where does the circuit run">
          <div className="flex gap-2">
            <Toggle active={source === "aer"} onClick={() => setSource("aer")}>
              Simulator
            </Toggle>
            <Toggle active={source === "qpu"} onClick={() => setSource("qpu")}>
              Real QPU
            </Toggle>
          </div>
        </Field>

        {source === "qpu" && (
          <Field label="Batch">
            <select
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              className="w-full border-2 border-stage-border bg-stage-bg px-2 py-1 text-[11px] text-[#e8f4f8]"
            >
              {batches.length === 0 && <option value="">Recorded demo batch</option>}
              {batches.map((batch) => (
                <option key={batch.batch_id} value={batch.batch_id}>
                  {batch.label ?? batch.batch_id}
                </option>
              ))}
            </select>
          </Field>
        )}

        <button
          type="button"
          onClick={() => void (source === "aer" ? runAer() : runQpu())}
          disabled={Boolean(busy) || !prechecked}
          className="btn-primary w-full text-[11px]"
        >
          2. {source === "aer" ? "Run locally on the simulator" : "Submit over the uplink"}
        </button>

        {!prechecked && (
          <p className="text-[10px] leading-relaxed text-stage-muted">
            Run the precheck first. If gcd(a, N) is already bigger than 1 there
            is nothing for a quantum computer to do.
          </p>
        )}

        {busy && (
          <p className="animate-pulse text-[10px] text-accent-amber">{busy}...</p>
        )}

        {bars.length > 0 && (
          <div className="space-y-1 border-t-2 border-stage-border pt-3">
            <div className="text-[10px] uppercase tracking-widest text-stage-muted">
              Measured outcomes
            </div>
            {bars.map(([bitstring, count]) => (
              <div key={bitstring} className="flex items-center gap-2">
                <span className="w-20 shrink-0 font-mono text-[10px] text-[#9fc4d0]">
                  {bitstring}
                </span>
                <div className="h-2 flex-1 bg-stage-bg">
                  <div
                    className="h-full bg-[#c084fc]"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-[10px] text-stage-muted">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}

        {found && (
          <button
            type="button"
            onClick={() => void goTo("recovered")}
            className="btn-primary w-full border-actor-brayan text-[11px] text-actor-brayan hover:bg-actor-brayan/15"
          >
            3. Take the period and rebuild Brayan&apos;s key
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-widest text-stage-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "border-2 px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-accent-teal bg-accent-teal/15 text-accent-teal"
          : "border-stage-border text-stage-muted hover:border-accent-teal/60",
      )}
    >
      {children}
    </button>
  );
}

function topCounts(counts: Record<string, number>, limit: number) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/** gcd(a^(r/2) +/- 1, N), the classical half of Shor. */
function factorsFromOrder(N: number, a: number, r: number): number[] | null {
  if (r % 2 !== 0) return null;
  const half = modPow(a, r / 2, N);
  const candidates = [gcd(half - 1, N), gcd(half + 1, N)].filter(
    (f) => f > 1 && f < N,
  );
  return candidates.length ? Array.from(new Set(candidates)).sort((x, y) => x - y) : null;
}

