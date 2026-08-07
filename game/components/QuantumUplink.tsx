"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { api } from "@/lib/api";
import type { IbmBatchDetail, IbmBatchSummary, ShorSimulateResponse } from "@/lib/api";
import {
  applyShorResult,
  gcd,
  modPow,
  pickRsaPlaintext,
  runApiCall,
} from "@/game/effects";
import {
  VERDICT_LABEL,
  VERDICT_STYLE,
  peakIsMisleading,
  readAnalysis,
} from "@/game/shor";
import type { Readout } from "@/game/shor";
import { useGame } from "@/game/state";

type Source = "aer" | "qpu";

/** Wide enough that each modulus has one base that shares a factor with it. */
const BASES = [2, 4, 5, 7, 8, 11, 13];
const CONTROL_QUBITS = [3, 4, 6, 8];

/**
 * Act 4's control panel. The hacker owns no quantum hardware, so everything
 * here leaves over the network: a local simulator dry run first, then a batch
 * that already ran on IBM hardware.
 *
 * The two run targets are not symmetric, and the panel says so. A simulator
 * run is configured here and then executed. A hardware batch executed months
 * ago with its parameters already baked in, so selecting one *sets* N, a and m
 * rather than pretending they are still yours to choose.
 */
export function QuantumUplink() {
  const vars = useGame((s) => s.vars);
  const setVars = useGame((s) => s.setVars);
  const pushTerminal = useGame((s) => s.pushTerminal);
  const setError = useGame((s) => s.setError);

  const [source, setSource] = useState<Source>("aer");
  const [batches, setBatches] = useState<IbmBatchSummary[]>([]);
  const [batchId, setBatchId] = useState<string>("");
  const [manifest, setManifest] = useState<IbmBatchDetail | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [prechecked, setPrechecked] = useState(false);
  const [readout, setReadout] = useState<Readout | null>(null);
  const [found, setFound] = useState(false);
  const manifestTicket = useRef(0);

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
   * encrypted with, so changing N re-runs the capture against a fresh key.
   * Otherwise the factors Shor finds would not unlock anything.
   */
  const rekey = useCallback(
    async (n: 15 | 21) => {
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
        message: String.fromCharCode(64 + value),
        value,
        cipherNumber: cipher.c,
        cipherText: String(cipher.c),
      });
      pushTerminal({
        tone: "note",
        text: `Re-keyed against N = ${n}: public exponent e = ${keys.e}, new capture c = ${cipher.c}.`,
      });
    },
    [pushTerminal, setVars],
  );

  const resetRun = () => {
    setPrechecked(false);
    setFound(false);
    setReadout(null);
  };

  const switchModulus = (n: 15 | 21) =>
    guard("Re-keying the captured session", async () => {
      resetRun();
      await rekey(n);
    });

  /**
   * Read a recorded batch's manifest and adopt its parameters. The circuit
   * already ran; these are facts about it, not settings.
   *
   * Reaching IBM takes the better part of ten seconds, so a player flicking
   * through the list can easily have several of these in flight. Only the
   * newest one is allowed to land.
   */
  const loadManifest = useCallback(
    async (id: string) => {
      const ticket = ++manifestTicket.current;
      setLoadingManifest(true);
      setManifest(null);
      resetRun();
      try {
        const detail = id
          ? await api.ibm.batch(id).catch(() => api.ibm.cached())
          : await api.ibm.cached();
        if (ticket !== manifestTicket.current) return;
        setManifest(detail);

        const n = detail.N === 15 || detail.N === 21 ? detail.N : null;
        if (n && n !== vars.modulus) await rekey(n);
        setVars({
          ...(detail.a ? { base: detail.a } : {}),
          ...(detail.num_control ? { numControl: detail.num_control } : {}),
        });
      } catch (error) {
        if (ticket === manifestTicket.current) {
          setError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (ticket === manifestTicket.current) setLoadingManifest(false);
      }
    },
    [rekey, setError, setVars, vars.modulus],
  );

  // Start reading the default batch straight away, so the manifest is on
  // screen by the time the player has finished the dialog.
  useEffect(() => {
    if (source !== "qpu" || !batchId) return;
    void loadManifest(batchId);
    // loadManifest is recreated whenever vars.modulus changes, which would
    // otherwise refetch the batch every time it re-keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, batchId]);

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
      pushTerminal({
        tone: "info",
        text: `${res.backend}: ${res.num_qubits} qubits, depth ${res.circuit_depth}, ${res.shots} shots.`,
      });
      absorb(readAnalysis(res.analysis, vars.modulus), res.backend ?? "AerSimulator");
      applyShorResult(res.shor_result, res.backend ?? "AerSimulator");
      setFound(Boolean(res.shor_result?.found));
    });

  const runQpu = () =>
    guard("Opening uplink to the QPU", async () => {
      const detail = manifest ?? (await api.ibm.cached());
      const backendName = detail.backend_name ?? "IBM Quantum";
      pushTerminal({
        tone: "note",
        text: detail.cached
          ? `No live credentials, replaying a recorded batch from ${backendName}. These counts came off real hardware.`
          : `Connected to ${backendName}. ${detail.jobs.length} completed job(s) in batch ${detail.batch_id}.`,
      });

      const done = detail.jobs.find((job) => Object.keys(job.counts ?? {}).length);
      const analysis = done?.analysis;
      const next = analysis?.outcomes?.length
        ? readAnalysis(analysis, vars.modulus)
        : null;
      if (next) absorb(next, backendName);

      // Deliberately not `analysis.best`, which is only the most-measured
      // successful outcome: under noise that is often a partial factor from
      // the wrong order. Take the row that actually splits N, the same one
      // the table marks.
      const solution = next?.solution;
      if (solution?.factors?.length && solution.order) {
        applyShorResult(
          { order_guess: solution.order, factors: solution.factors, found: true },
          backendName,
        );
        setFound(true);
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

  /** Show a readout and say out loud when the tallest bar is not the answer. */
  function absorb(next: Readout, backendName: string) {
    setReadout(next);
    if (peakIsMisleading(next) && next.solution && next.mostMeasured) {
      pushTerminal({
        tone: "bad",
        text: `${backendName}: the most measured outcome was ${next.mostMeasured.bitstring} (r = ${next.mostMeasured.order}), which is not the period. ${next.solution.bitstring} (r = ${next.solution.order}) is the one that splits N. Never trust the tallest bar without checking it.`,
      });
    }
  }

  const locked = source === "qpu";
  const badBase = gcd(vars.base, vars.modulus) > 1;

  return (
    <div className="space-y-3">
      <div className="border-2 border-stage-border px-2.5 py-2">
        <span className="text-[10px] uppercase tracking-widest text-[#c084fc]">
          Quantum uplink
        </span>
        <p className="mt-1 text-[10px] leading-relaxed text-stage-muted">
          Nothing here runs on your laptop. Every button is a request over the
          network to a machine somewhere else.
        </p>
      </div>

      <div className="space-y-3 text-[11px]">
        <Field
          label="Where the circuit runs"
          hint={
            locked
              ? "A recorded batch. It already ran, so its settings are fixed."
              : "A local simulator. You choose the circuit, then it is built and run."
          }
        >
          <div className="flex gap-2">
            <Toggle
              active={source === "aer"}
              onClick={() => {
                setSource("aer");
                resetRun();
              }}
            >
              Simulator
            </Toggle>
            <Toggle
              active={source === "qpu"}
              onClick={() => {
                setSource("qpu");
                resetRun();
              }}
            >
              Real QPU
            </Toggle>
          </div>
        </Field>

        {locked ? (
          <>
            <Field label="Recorded batch" hint="Each one is the same problem at a different qubit count.">
              <select
                value={batchId}
                onChange={(event) => setBatchId(event.target.value)}
                className="w-full border-2 border-stage-border bg-stage-bg px-2 py-1 text-[11px] text-[#e8f4f8]"
              >
                {batches.length === 0 && <option value="">Recorded demo batch</option>}
                {batches.map((batch) => (
                  <option key={batch.batch_id} value={batch.batch_id}>
                    {describeBatch(batch)}
                  </option>
                ))}
              </select>
            </Field>

            <Manifest detail={manifest} loading={loadingManifest} />
          </>
        ) : (
          <>
            <Field
              label={`Number to factor  N = ${vars.modulus}`}
              hint="Brayan's RSA modulus, straight off the wire. Split it and his private key follows."
            >
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

            <Field
              label={`Base  a = ${vars.base}`}
              hint="Shor measures how many times you can multiply by a before the result comes back to 1. That count is the period."
            >
              <div className="flex flex-wrap gap-2">
                {BASES.map((a) => {
                  const shares = gcd(a, vars.modulus) > 1;
                  return (
                    <Toggle
                      key={a}
                      active={vars.base === a}
                      tone={shares ? "bad" : "normal"}
                      title={
                        shares
                          ? `gcd(${a}, ${vars.modulus}) = ${gcd(a, vars.modulus)}, so this needs no quantum computer`
                          : undefined
                      }
                      onClick={() => {
                        setVars({ base: a });
                        resetRun();
                      }}
                    >
                      {a}
                    </Toggle>
                  );
                })}
              </div>
              {badBase && (
                <p className="text-[10px] leading-relaxed text-actor-hacker">
                  a = {vars.base} shares a factor with N. Ordinary gcd already
                  answers this, so the precheck will stop you.
                </p>
              )}
            </Field>

            <Field
              label={`Counting qubits  m = ${vars.numControl}`}
              hint={`The register reports a fraction over 2^${vars.numControl} = ${2 ** vars.numControl}. A period only lands exactly when it divides ${2 ** vars.numControl}; otherwise you get the nearest fraction and have to round.`}
            >
              <div className="flex gap-2">
                {CONTROL_QUBITS.map((m) => (
                  <Toggle
                    key={m}
                    active={vars.numControl === m}
                    onClick={() => {
                      setVars({ numControl: m });
                      resetRun();
                    }}
                  >
                    {m}
                  </Toggle>
                ))}
              </div>
            </Field>
          </>
        )}

        <button
          type="button"
          onClick={() => void runPrecheck()}
          disabled={Boolean(busy) || loadingManifest}
          className="btn-ghost w-full text-[11px]"
        >
          1. Classical precheck
        </button>

        <button
          type="button"
          onClick={() => void (source === "aer" ? runAer() : runQpu())}
          disabled={Boolean(busy) || !prechecked || loadingManifest}
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

        {readout && <Outcomes readout={readout} numControl={vars.numControl} />}

        {found && (
          <button
            type="button"
            onClick={() => void runApiCall("deriveKey")}
            className="btn-primary w-full border-actor-brayan text-[11px] text-actor-brayan hover:bg-actor-brayan/15"
          >
            3. Take the period and rebuild Brayan&apos;s key
          </button>
        )}
      </div>
    </div>
  );
}

/** What a recorded run actually was, as opposed to what you would have picked. */
function Manifest({
  detail,
  loading,
}: {
  detail: IbmBatchDetail | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <p className="animate-pulse border-2 border-stage-border px-2.5 py-2 text-[10px] text-accent-amber">
        Reading the batch manifest...
      </p>
    );
  }
  if (!detail) return null;

  const rows: [string, string][] = [
    ["backend", detail.backend_name ?? "unknown"],
    ["N", String(detail.N ?? "?")],
    ["base a", String(detail.a ?? "?")],
    ["counting qubits", String(detail.num_control ?? "?")],
    ["jobs", String(detail.jobs.length)],
    ["QPU time", detail.usage_time ? `${detail.usage_time}s` : "?"],
  ];

  return (
    <div className="border-2 border-stage-border px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-widest text-stage-muted">
        Fixed by this run
      </p>
      <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-stage-muted">{key}</dt>
            <dd className="text-[#cfe6ee]">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-[10px] leading-relaxed text-stage-muted">
        This circuit ran once, months ago. You are reading its results, not
        choosing them.
      </p>
    </div>
  );
}

/**
 * Every measured bitstring, and what it is worth. The decimal value and the
 * fraction are the two numbers that turn a bar chart into an answer.
 */
function Outcomes({ readout, numControl }: { readout: Readout; numControl: number }) {
  const max = readout.outcomes[0]?.count ?? 1;
  const misleading = peakIsMisleading(readout);
  const top = useRef<HTMLDivElement | null>(null);

  // This table is the whole point of the act and it sits below a long form,
  // so bring it into view rather than leaving it under the fold.
  useEffect(() => {
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [readout]);

  return (
    <div ref={top} className="space-y-1.5 border-t-2 border-stage-border pt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-widest text-stage-muted">
          Measured outcomes
        </span>
        {readout.trueOrder !== null && (
          <span className="font-mono text-[10px] text-stage-muted">
            true r = {readout.trueOrder}
          </span>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-stage-muted">
        Each row reads the register as a number y, divides it by 2^{numControl} ={" "}
        {2 ** numControl} to get a phase, and takes the nearest simple fraction.
        The denominator is the candidate period r.
        {readout.totalOutcomes > readout.outcomes.length &&
          ` Showing the top ${readout.outcomes.length} of ${readout.totalOutcomes} measured.`}
      </p>

      <div className="grid grid-cols-[auto_auto_auto_1fr_auto] items-center gap-x-2 gap-y-0.5 font-mono text-[10px]">
        <span className="text-stage-muted">bits</span>
        <span className="text-right text-stage-muted">y</span>
        <span className="text-stage-muted">phase</span>
        <span className="text-stage-muted">r</span>
        <span className="text-right text-stage-muted">shots</span>

        {readout.outcomes.map((o) => {
          const winner = o.bitstring === readout.solution?.bitstring;
          return (
            <div key={o.bitstring} className="contents">
              <span
                className={clsx(
                  winner ? "text-actor-brayan" : "text-[#9fc4d0]",
                  winner && "font-bold",
                )}
              >
                {winner ? ">" : " "}
                {o.bitstring}
              </span>
              <span className="text-right text-accent-amber">{o.value}</span>
              <span className="text-[#9fc4d0]">{o.fraction}</span>
              <span className={VERDICT_STYLE[o.verdict]}>
                {o.order ?? "-"}
                <span className="ml-1 opacity-70">
                  {o.factors?.length
                    ? `= ${o.factors.join(" x ")}`
                    : VERDICT_LABEL[o.verdict]}
                </span>
              </span>
              <span className="text-right text-stage-muted">{o.count}</span>
              <div className="col-span-5 mb-0.5 h-1 bg-stage-bg">
                <div
                  className={clsx(
                    "h-full",
                    winner ? "bg-actor-brayan" : "bg-[#c084fc]/60",
                  )}
                  style={{ width: `${(o.count / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {misleading && (
        <p className="border-2 border-actor-hacker/50 bg-actor-hacker/10 px-2 py-1.5 text-[10px] leading-relaxed text-actor-hacker">
          The tallest bar is not the answer. Noise flattened the distribution,
          so {readout.mostMeasured?.bitstring} won on shots while{" "}
          {readout.solution?.bitstring} is the one that splits N. Every
          candidate has to be checked, which is cheap: multiply the factors back
          together.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-widest text-stage-muted">
        {label}
      </div>
      {children}
      {hint && (
        <p className="text-[10px] leading-relaxed text-stage-muted">{hint}</p>
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  tone = "normal",
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: "normal" | "bad";
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={clsx(
        "border-2 px-2.5 py-1 text-[11px] transition-colors",
        active && tone === "bad" && "border-actor-hacker bg-actor-hacker/15 text-actor-hacker",
        active && tone === "normal" && "border-accent-teal bg-accent-teal/15 text-accent-teal",
        !active && tone === "bad" && "border-stage-border text-actor-hacker/60 hover:border-actor-hacker/60",
        !active && tone === "normal" && "border-stage-border text-stage-muted hover:border-accent-teal/60",
      )}
    >
      {children}
      {tone === "bad" && <span className="ml-1 opacity-70">!</span>}
    </button>
  );
}

/** Batch labels are "m3", "m4" and so on: the counting-qubit width. */
function describeBatch(batch: IbmBatchSummary): string {
  const label = batch.label ?? batch.batch_id;
  const width = /^m(\d+)$/.exec(label);
  if (!width) return label;
  return `${width[1]} counting qubits  (${2 ** Number(width[1])} outcomes)`;
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
