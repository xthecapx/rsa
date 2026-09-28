"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { t, localize, useLocale } from "@/i18n";
import { gameAudio } from "@/game/audio";
import { applyShorResult, gcd, modPow, pickRsaPlaintext, runApiCall } from "@/game/effects";
import { RAIL, WIRES, boxIndex, boxOf, buildPipeline, expectedTarget, wireFeedback, type Backend, type BoxId } from "@/game/pipeline";
import { missionGeneration } from "@/game/runtime";
import { charOf } from "@/game/secret";
import { VERDICT_LABEL, VERDICT_STYLE, peakIsMisleading, readAnalysis, type Readout } from "@/game/shor";
import { useGame } from "@/game/state";
import { api, type IbmBatchDetail, type IbmBatchSummary, type ShorAnalysis } from "@/lib/api";
import { StepHeader } from "./LaptopControls";
import { PuzzleDragDrop, PuzzlePiece, PuzzleSlot } from "./PuzzleDragDrop";

/** Wide enough that each modulus has one base that shares a factor with it. */
const BASES = [2, 4, 5, 7, 8, 11, 13];
const QUBITS = [3, 4, 6, 8];
const SHOTS = [128, 512, 1024, 2048];
const TOTAL = 3;
const MAX_BARS = 8;

/** One completed run, kept so the boxes stay open after a reload. */
type Run = {
  qpu: string;
  backend: Backend;
  N: number;
  a: number;
  m: number;
  shots: number;
  qubits: number | null;
  depth: number | null;
  usage: number | null;
  consoleUrl: string | null;
  counts: Record<string, number>;
  analysis: ShorAnalysis | undefined;
  /** The bitstring the classical PC accepted, or null when no shot split N. */
  picked: string | null;
  /** True when hardware noise hid the period and the batch's reference order was used. */
  fromReference: boolean;
};
type Scratch = { wired: BoxId[]; backend: Backend; batchId: string; m: number; shots: number; run: Run | null };
const EMPTY: Scratch = { wired: [], backend: "aer", batchId: "", m: 4, shots: 512, run: null };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Act 4 as a program. Five black boxes sit on a rail; the player wires each
 * output into the next box, sets up the QPU (which machine, how many counting
 * qubits, how many shots) and runs the whole thing once. Every box then shows
 * what went in and what came out, so the quantum stage is visibly one step
 * among classical ones.
 */
export function ShorPipeline({ armed }: { armed: boolean }) {
  useLocale((state) => state.locale);
  const vars = useGame((s) => s.vars);
  const recovered = useGame((s) => s.vars.recovered);
  const setVars = useGame((s) => s.setVars);
  const pushTerminal = useGame((s) => s.pushTerminal);
  const setError = useGame((s) => s.setError);
  const [scratch, setScratch] = useState<Scratch>(() => ({ ...EMPTY, ...((useGame.getState().labMemory.shor4 as Partial<Scratch> | undefined) ?? {}) }));
  const [batches, setBatches] = useState<IbmBatchSummary[]>([]);
  const [manifest, setManifest] = useState<IbmBatchDetail | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<BoxId | null>(null);
  const [selected, setSelected] = useState<BoxId | null>(null);
  const [note, setNote] = useState<{ tone: "bad" | "good" | "note"; text: ReactNode } | null>(null);
  const ticket = useRef(0);

  useEffect(() => { useGame.getState().setLabMemory({ shor4: scratch }); }, [scratch]);

  useEffect(() => {
    let alive = true;
    api.ibm.batches()
      .then((res) => {
        if (!alive) return;
        setBatches(res.batches);
        if (res.batches[0]) setScratch((prev) => (prev.batchId ? prev : { ...prev, batchId: res.batches[0].batch_id }));
      })
      .catch(() => { if (alive) setBatches([]); });
    return () => { alive = false; };
  }, []);

  // A recorded batch already ran, so reading its manifest *sets* a, m and the
  // shots. Reaching IBM can take seconds; only the newest request may land.
  const { backend, batchId } = scratch;
  useEffect(() => {
    if (backend !== "ibm") return;
    const token = missionGeneration();
    const mine = ++ticket.current;
    setLoadingManifest(true);
    setManifest(null);
    (batchId ? api.ibm.batch(batchId).catch(() => api.ibm.cached()) : api.ibm.cached())
      .then(async (detail) => {
        if (mine !== ticket.current || token !== missionGeneration()) return;
        const n = detail.N === 15 || detail.N === 21 ? detail.N : null;
        if (n && n !== useGame.getState().vars.modulus) await rekey(n);
        if (mine !== ticket.current || token !== missionGeneration()) return;
        setManifest(detail);
        if (detail.a) useGame.getState().setVars({ base: detail.a });
        const job = detail.jobs.find((entry) => Object.keys(entry.counts ?? {}).length);
        const shots = Object.values(job?.counts ?? {}).reduce((sum, v) => sum + v, 0);
        setScratch((prev) => ({ ...prev, m: detail.num_control ?? prev.m, shots: shots || prev.shots }));
      })
      .catch((error) => {
        if (mine === ticket.current && token === missionGeneration()) setError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => { if (mine === ticket.current && token === missionGeneration()) setLoadingManifest(false); });
  }, [backend, batchId, setError]);

  const wired = new Set(scratch.wired);
  const allWired = scratch.wired.length >= WIRES;
  const N = vars.modulus;
  const a = vars.base;
  const e = vars.e ?? 0;
  const c = vars.cipherNumber ?? 0;
  const g = gcd(a, N);
  const badBase = g > 1;
  const locked = backend === "ibm";
  const run = scratch.run;
  const readout = run ? readAnalysis(run.analysis, run.N) : null;
  const step = recovered ? 3 : allWired ? 2 : 1;

  const labels = Object.fromEntries(RAIL.filter((box) => box.emits && !wired.has(box.id)).map((box) => [`out:${box.id}`, t(box.emits!.label)]));
  const targets = Object.fromEntries(RAIL.slice(1).filter((box, i) => !wired.has(RAIL[i].id)).map((box) => [`in:${box.id}`, `${t("input of")} ${t(box.title)}`]));

  /** Forget the last run whenever a setting changes, so what is shown always matches the settings. */
  function clearRun(patch: Partial<Scratch> = {}) {
    setScratch((prev) => ({ ...prev, ...patch, run: null }));
    if (useGame.getState().vars.p !== null || recovered) {
      setVars({ p: null, q: null, d: null, factors: null, order: null, recovered: null });
    }
    setNote(null);
  }

  function place(target: string, source: string) {
    if (!armed || busy) return;
    const from = source.replace("out:", "") as BoxId;
    const to = target.replace("in:", "") as BoxId;
    setSelected(null);
    if (expectedTarget(from) !== to) {
      gameAudio.playSfx("error");
      setNote({ tone: "bad", text: t(wireFeedback(from, to)) });
      return;
    }
    gameAudio.playSynth("wire");
    const next = [...scratch.wired, from];
    setScratch((prev) => ({ ...prev, wired: next }));
    pushTerminal({ tone: "info", text: `${boxOf(from).title} -> ${boxOf(to).title}: ${boxOf(from).emits?.label}` });
    setNote(next.length >= WIRES
      ? { tone: "good", text: t("Every box is connected. Set up the QPU, then run the pipeline.") }
      : { tone: "note", text: `${t(boxOf(from).emits!.label)} → ${t(boxOf(to).title)}` });
  }

  async function runPipeline() {
    if (!armed || busy || !allWired || badBase || useGame.getState().operations) return;
    const token = missionGeneration();
    const alive = () => token === missionGeneration();
    const hop = async (id: BoxId, ms: number) => {
      if (!alive()) throw new Error("aborted");
      setStage(id);
      gameAudio.playSynth("tick");
      await wait(ms);
    };
    const { m, shots } = scratch;
    setBusy(true);
    setError(null);
    setNote(null);
    setSelected(null);
    setScratch((prev) => ({ ...prev, run: null }));
    setVars({ recovered: null, p: null, q: null, d: null, factors: null, order: null, numControl: m });
    try {
      await hop("classical-in", 500);
      pushTerminal({ tone: "info", text: `Classical PC: N = ${N}, a = ${a}, gcd(a, N) = 1. This one needs the QPU.` });
      await hop("qpu-setup", 500);
      let next: Run;
      let reference: number | null = null;
      if (backend === "aer") {
        pushTerminal({ tone: "info", text: `Job: N = ${N}, a = ${a}, m = ${m}, ${shots} shots -> local simulator.` });
        await hop("shor", 200);
        const res = await api.shor.simulate({ N, a, num_control: m, shots });
        if (!alive()) return;
        next = {
          qpu: res.backend ?? "AerSimulator", backend, N, a, m, shots: res.shots ?? shots,
          qubits: res.num_qubits ?? null, depth: res.circuit_depth ?? null, usage: null, consoleUrl: null,
          counts: res.counts ?? {}, analysis: res.analysis, picked: null, fromReference: false,
        };
      } else {
        const detail = manifest ?? (await api.ibm.cached());
        if (!alive()) return;
        const qpu = detail.backend_name ?? "IBM Quantum";
        pushTerminal({
          tone: "note",
          text: detail.cached
            ? `No live credentials, replaying a recorded batch from ${qpu}. These counts came off real hardware.`
            : `Connected to ${qpu}. Batch ${detail.batch_id}, ${detail.jobs.length} completed job(s).`,
        });
        await hop("shor", 200);
        const job = detail.jobs.find((entry) => Object.keys(entry.counts ?? {}).length);
        const counts = job?.counts ?? {};
        next = {
          qpu, backend, N: detail.N ?? N, a: detail.a ?? a, m: detail.num_control ?? m,
          shots: Object.values(counts).reduce((sum, v) => sum + v, 0),
          qubits: null, depth: null, usage: detail.usage_time ?? null,
          consoleUrl: job?.console_url ?? detail.console_url ?? null,
          counts, analysis: job?.analysis, picked: null, fromReference: false,
        };
        reference = detail.references?.true_order ?? null;
      }
      await hop("measure", 700);
      gameAudio.playSfx("computer");
      pushTerminal({ tone: "info", text: `${next.qpu}: ${Object.keys(next.counts).length} distinct outcomes over ${next.shots} shots.` });
      await hop("classical-out", 500);

      const read = readAnalysis(next.analysis, next.N);
      const solution = read.solution;
      if (solution?.factors?.length && solution.order) {
        next.picked = solution.bitstring;
        if (peakIsMisleading(read) && read.mostMeasured) {
          pushTerminal({
            tone: "bad",
            text: `${next.qpu}: the most measured outcome was ${read.mostMeasured.bitstring} (r = ${read.mostMeasured.order}), which is not the period. ${solution.bitstring} (r = ${solution.order}) is the one that splits N. Never trust the tallest bar without checking it.`,
          });
        }
        applyShorResult({ order_guess: solution.order, factors: solution.factors, found: true }, next.qpu);
      } else if (reference) {
        next.fromReference = true;
        pushTerminal({ tone: "note", text: `Hardware noise smeared the peaks. The reference distribution for this circuit peaks at r = ${reference}.` });
        applyShorResult({ order_guess: reference, factors: factorsFromOrder(next.N, next.a, reference), found: true }, next.qpu);
      } else {
        applyShorResult(undefined, next.qpu);
      }
      if (!alive()) return;
      setScratch((prev) => ({ ...prev, run: next }));
      useGame.getState().setLabMemory({
        pipeline: buildPipeline({
          "classical-in": { N: next.N, a: next.a, e, c },
          "qpu-setup": { backend: next.qpu, source: next.backend, m: next.m, shots: next.shots },
          shor: { qubits: next.qubits, depth: next.depth },
          measure: { outcomes: Object.keys(next.counts).length },
          "classical-out": { picked: next.picked, order: useGame.getState().vars.order, factors: useGame.getState().vars.factors },
        }),
      });
      if (useGame.getState().vars.p !== null) await runApiCall("deriveKey");
    } catch (error) {
      if (alive() && !(error instanceof Error && error.message === "aborted")) {
        setError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (alive()) {
        setBusy(false);
        setStage(null);
      }
    }
  }

  const p = vars.p;
  const q = vars.q;
  const d = vars.d;
  const phi = p !== null && q !== null ? (p - 1) * (q - 1) : null;

  function body(id: BoxId): ReactNode {
    switch (id) {
      case "classical-in":
        return <>
          <p className="pipe-fact">c = {c} · e = {e} · N = {N}</p>
          <p className="laptop-note">{t("The capture, straight off the wire. Now pick the base a: Shor counts how many times you multiply by a before the remainder mod N comes back to 1.")}</p>
          <div className="flex flex-wrap gap-1.5">
            {BASES.map((base) => {
              const shares = gcd(base, N) > 1;
              return <Toggle key={base} active={a === base} tone={shares ? "bad" : "normal"} disabled={locked || busy}
                onClick={() => { setVars({ base }); clearRun(); }}>{base}</Toggle>;
            })}
          </div>
          <p className={clsx("pipe-fact", badBase ? "text-actor-hacker" : "text-accent-teal")}>
            gcd({a}, {N}) = {g}. {badBase
              ? t(`${g} already divides ${N}: N = ${g} × ${N / g}. No QPU needed, so the run is blocked. Pick a base that shares nothing with N.`)
              : t("Coprime, so trial division learns nothing. The QPU has real work to do.")}
          </p>
        </>;

      case "qpu-setup":
        return <>
          <Row label={t("Machine")}>
            <Toggle active={!locked} disabled={busy} onClick={() => clearRun({ backend: "aer" })}>{t("Simulator")}</Toggle>
            <Toggle active={locked} disabled={busy} onClick={() => clearRun({ backend: "ibm" })}>{t("IBM QPU, recorded run")}</Toggle>
          </Row>
          {locked && <>
            <select value={batchId} disabled={busy} onChange={(event) => clearRun({ batchId: event.target.value })}
              className="min-h-11 w-full rounded border-2 border-stage-border bg-stage-bg px-3 py-2 text-sm text-[#e8f4f8]">
              {batches.length === 0 && <option value="">{t("Recorded demo batch")}</option>}
              {batches.map((batch) => <option key={batch.batch_id} value={batch.batch_id}>{localize(describeBatch(batch))}</option>)}
            </select>
            <Manifest detail={manifest} loading={loadingManifest} />
          </>}
          <Row label={t("Counting qubits m")}>
            {QUBITS.map((m) => <Toggle key={m} active={scratch.m === m} disabled={locked || busy} onClick={() => clearRun({ m })}>{m}</Toggle>)}
          </Row>
          <p className="laptop-note">{t("More qubits read the phase on a finer ruler. The period lands exactly only when it divides 2^m; otherwise you get the nearest fraction.")}</p>
          <Row label={t("Shots")}>
            {SHOTS.map((shots) => <Toggle key={shots} active={scratch.shots === shots} disabled={locked || busy} onClick={() => clearRun({ shots })}>{shots}</Toggle>)}
          </Row>
          <p className="laptop-note">{t("Each shot is one sample. More shots make the true peaks stand out from noise and from bad luck.")}</p>
          {locked && <p className="laptop-note">{t("A recorded run already happened, so a, m and the shots are facts about it, not choices.")}</p>}
          <p className="pipe-fact">{t("job")}: N = {N}, a = {a}, m = {scratch.m}, {scratch.shots} {t("shots")}</p>
        </>;

      case "shor":
        return <>
          <p className="laptop-note">{t("You never open this box. Inside are the controlled multiplications by a mod N and the inverse Fourier transform from the earlier lessons. The job goes in, a quantum state comes out.")}</p>
          {run && run.qubits !== null && <p className="pipe-fact">{t(`${run.qubits} qubits in total: ${run.m} counting, ${run.qubits - run.m} holding the value. Circuit depth ${run.depth ?? "?"}.`)}</p>}
          {run && run.qubits === null && <p className="pipe-fact">{t(`Ran on ${run.qpu}.`)}{run.usage !== null && ` ${t(`${run.usage} s of QPU time.`)}`}</p>}
        </>;

      case "measure":
        return !run
          ? <p className="laptop-note">{t("Waiting for a run.")}</p>
          : <>
            <p className="pipe-fact">{t(`${run.shots} shots, ${Object.keys(run.counts).length} distinct bitstrings.`)}</p>
            <Histogram counts={run.counts} picked={run.picked} />
            <p className="laptop-note">{t("Each bar is one bitstring and how many shots landed on it. This is everything the QPU ever says; nothing here is a factor yet.")}</p>
            {run.consoleUrl && <a href={run.consoleUrl} target="_blank" rel="noreferrer" className="text-xs text-[#c084fc] underline">{t("Open this job on IBM Quantum")}</a>}
          </>;

      case "classical-out":
        return !run || !readout
          ? <p className="laptop-note">{t("Waiting for counts.")}</p>
          : <>
            <p className="laptop-note">{t("Read each bitstring as a number y, divide by 2^m for the phase, take the nearest simple fraction s/r, and test r: it must be even, and gcd(a^(r/2) ± 1, N) must split N. The first row that passes wins.")}</p>
            <Outcomes readout={readout} m={run.m} picked={run.picked} />
            {peakIsMisleading(readout) && readout.mostMeasured && readout.solution && (
              <p className="border-2 border-actor-hacker/50 bg-actor-hacker/10 px-2 py-1.5 text-[10px] leading-relaxed text-actor-hacker">
                {t(`The tallest bar is not the answer. ${readout.mostMeasured.bitstring} won on shots, but ${readout.solution.bitstring} is the one that splits N. Every candidate gets checked; multiplying two factors back together is cheap.`)}
              </p>
            )}
            {run.fromReference && <p className="laptop-note text-accent-amber">{t("Noise smeared every peak on this hardware run, so the classical PC fell back to the reference distribution recorded with the batch.")}</p>}
            {p !== null && q !== null && d !== null && phi !== null
              ? <>
                <div className="rsa-eq text-sm leading-relaxed">
                  <div>N = {p} × {q} = {N}</div>
                  <div>φ(N) = ({p} − 1)({q} − 1) = {phi}</div>
                  <div>{e} × {d} mod {phi} = 1 → d = {d}</div>
                  <div>m = {c}^{d} mod {N} = {modPow(c, d, N)} → “{charOf(modPow(c, d, N))}”</div>
                </div>
                <p className="laptop-note">{t("Act 3 was this by hand. Here the laptop does it in one go: the QPU gave r, and everything after r is classical.")}</p>
              </>
              : <p className="laptop-note text-actor-hacker">{t("No shot gave a usable period. Shor is probabilistic: add shots or change a, then run again.")}</p>}
          </>;
    }
  }

  return (
    <div className={clsx("laptop-challenge space-y-3", !armed && "pointer-events-none opacity-50")}>
      <StepHeader step={step} total={TOTAL} title={recovered ? t("Message recovered") : allWired ? t("Set up the QPU and run") : t("Wire the boxes")} />
      {step === 1 && <p className="laptop-note">{t("A quantum computer is one stage in an ordinary program. Drag each box's output into the input of the box that needs it.")}</p>}

      <PuzzleDragDrop labels={labels} targets={targets} onPlace={place}
        renderPreview={(source) => <span className="rsa-chip coin-block">{labels[source]}</span>}>
        <div className="pipe-rail">
          {RAIL.map((box, i) => {
            const prev = RAIL[i - 1];
            const inputWired = !prev || wired.has(prev.id);
            const outWired = wired.has(box.id);
            const active = stage === box.id;
            return (
              <div key={box.id} className="contents">
                <section className={clsx("pipe-box", active && "is-active", run && !busy && "is-done", !inputWired && "is-unplugged")}>
                  {prev && (
                    <div className="pipe-port">
                      <span className="pipe-port-label">{t("in")}</span>
                      {inputWired
                        ? <span className="rsa-slot filled">{t(prev.emits!.label)}</span>
                        : <PuzzleSlot id={`in:${box.id}`} label={`${t("input of")} ${t(box.title)}`} className="rsa-slot pipe-slot"
                          onSelect={() => { if (selected) place(`in:${box.id}`, `out:${selected}`); }}>
                          {t("drop input")}
                        </PuzzleSlot>}
                    </div>
                  )}
                  <header className="pipe-head">
                    <span className="pipe-index">{i + 1}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-[#e8f4f8]">{t(box.title)}</h3>
                      <p className="text-[11px] text-stage-muted">{t(box.role)}</p>
                    </div>
                  </header>
                  <div className="pipe-body space-y-2">{body(box.id)}</div>
                  {box.emits && (
                    <div className="pipe-port out">
                      <span className="pipe-port-label">{t("out")}</span>
                      {outWired
                        ? <span className="rsa-chip coin-block spent">{t(box.emits.label)} → {t(RAIL[i + 1].title)}</span>
                        : <PuzzlePiece id={`out:${box.id}`} label={t(box.emits.label)} selected={selected === box.id}
                          onSelect={() => setSelected(selected === box.id ? null : box.id)} className="rsa-chip">
                          {t(box.emits.label)}<small>{t(box.emits.caption)}</small>
                        </PuzzlePiece>}
                    </div>
                  )}
                </section>
                {i < RAIL.length - 1 && <div aria-hidden="true" className={clsx("pipe-link", outWired && "is-wired", busy && stage && boxIndex(stage) > i && "is-flowing")} />}
              </div>
            );
          })}
        </div>
      </PuzzleDragDrop>

      <button type="button" className="btn-primary w-full" disabled={!armed || busy || !allWired || badBase || loadingManifest} onClick={() => void runPipeline()}>
        {busy ? `${t("Running")}…` : run ? t("Run the pipeline again") : t("Run the pipeline")}
      </button>
      {!allWired && <p className="laptop-note">{t("Wire every output into the next box before running.")}</p>}
      {allWired && badBase && <p className="laptop-note text-actor-hacker">{t("The classical PC refuses to send this job: gcd(a, N) already factors N.")}</p>}
      {recovered && <p className="laptop-note">{t("Hit “I have it” and report the letter to the client.")}</p>}

      {note && <p role="status" className={clsx("laptop-note font-mono", note.tone === "bad" ? "text-actor-hacker" : note.tone === "good" ? "text-accent-teal" : "text-[#cfe6ee]")}>{note.text}</p>}
    </div>
  );
}

/** The captured session only decrypts under the modulus it was keyed with, so a batch at another N re-keys the capture. */
async function rekey(n: number) {
  const { setVars, pushTerminal } = useGame.getState();
  const keys = await api.rsa.keygen(n);
  const value = pickRsaPlaintext(keys.N, keys.e);
  const cipher = await api.rsa.encrypt(value, keys.e, n);
  setVars({
    modulus: n, e: keys.e, value, letter: charOf(value), message: charOf(value),
    cipherNumber: cipher.c, cipherText: String(cipher.c),
    p: null, q: null, d: null, factors: null, order: null, recovered: null,
  });
  pushTerminal({ tone: "note", text: `Re-keyed against N = ${n}: public exponent e = ${keys.e}, new capture c = ${cipher.c}.` });
}

/** gcd(a^(r/2) +/- 1, N), the classical half of Shor. */
function factorsFromOrder(N: number, a: number, r: number): number[] | null {
  if (r % 2 !== 0) return null;
  const half = modPow(a, r / 2, N);
  const candidates = [gcd(half - 1, N), gcd(half + 1, N)].filter((f) => f > 1 && f < N);
  return candidates.length ? Array.from(new Set(candidates)).sort((x, y) => x - y) : null;
}

/** Batch labels are "m3", "m4" and so on: the counting-qubit width. */
function describeBatch(batch: IbmBatchSummary): string {
  const label = batch.label ?? batch.batch_id;
  const width = /^m(\d+)$/.exec(label);
  if (!width) return label;
  return `${width[1]} counting qubits  (${2 ** Number(width[1])} outcomes)`;
}

/** What a recorded run actually was, as opposed to what you would have picked. */
function Manifest({ detail, loading }: { detail: IbmBatchDetail | null; loading: boolean }) {
  useLocale((state) => state.locale);
  if (loading) return <p className="animate-pulse text-xs text-accent-amber">{t("Reading the batch manifest...")}</p>;
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
      <p className="text-[9px] uppercase tracking-widest text-stage-muted">{t("Fixed by this run")}</p>
      <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-stage-muted">{localize(key)}</dt>
            <dd className="text-[#cfe6ee]">{localize(value)}</dd>
          </div>
        ))}
      </dl>
      {detail.console_url && <a href={detail.console_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-[#c084fc] underline">{t("Open this batch on IBM Quantum")}</a>}
    </div>
  );
}

/** Raw counts, tallest first. What the measure box hands over, before any interpretation. */
function Histogram({ counts, picked }: { counts: Record<string, number>; picked: string | null }) {
  useLocale((state) => state.locale);
  const rows = Object.entries(counts).sort((x, y) => y[1] - x[1]);
  const shown = rows.slice(0, MAX_BARS);
  if (picked && !shown.some(([bits]) => bits === picked)) {
    const hit = rows.find(([bits]) => bits === picked);
    if (hit) shown[shown.length - 1] = hit;
  }
  const max = shown[0]?.[1] ?? 1;
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-0.5 font-mono text-[10px]">
      {shown.map(([bits, count]) => {
        const winner = bits === picked;
        return (
          <div key={bits} className="contents">
            <span className={clsx(winner ? "font-bold text-actor-brayan" : "text-[#9fc4d0]")}>{bits}</span>
            <div className="h-2 bg-stage-bg"><div className={clsx("h-full", winner ? "bg-actor-brayan" : "bg-[#c084fc]/60")} style={{ width: `${(count / max) * 100}%` }} /></div>
            <span className="text-right text-stage-muted">{count}</span>
          </div>
        );
      })}
      {rows.length > shown.length && <span className="col-span-3 text-stage-muted">{t(`Showing the top ${shown.length} of ${rows.length} bitstrings.`)}</span>}
    </div>
  );
}

/** Every measured bitstring and what the classical PC made of it. */
function Outcomes({ readout, m, picked }: { readout: Readout; m: number; picked: string | null }) {
  useLocale((state) => state.locale);
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="grid min-w-[18rem] grid-cols-[auto_auto_auto_1fr_auto] items-center gap-x-2 gap-y-0.5 font-mono text-[10px]">
        <span className="text-stage-muted">{t("bits")}</span>
        <span className="text-right text-stage-muted">y</span>
        <span className="text-stage-muted">y / {2 ** m}</span>
        <span className="text-stage-muted">r</span>
        <span className="text-right text-stage-muted">{t("shots")}</span>
        {readout.outcomes.map((o) => {
          const winner = o.bitstring === picked;
          return (
            <div key={o.bitstring} className="contents">
              <span className={clsx(winner ? "font-bold text-actor-brayan" : "text-[#9fc4d0]")}>{winner ? ">" : " "}{o.bitstring}</span>
              <span className="text-right text-accent-amber">{o.value}</span>
              <span className="text-[#9fc4d0]">{o.fraction}</span>
              <span className={VERDICT_STYLE[o.verdict]}>
                {o.order ?? "-"}
                <span className="ml-1 opacity-70">{o.factors?.length ? `= ${o.factors.join(" × ")}` : t(VERDICT_LABEL[o.verdict])}</span>
              </span>
              <span className="text-right text-stage-muted">{o.count}</span>
            </div>
          );
        })}
      </div>
      {readout.totalOutcomes > readout.outcomes.length && <p className="mt-1 text-[10px] text-stage-muted">{t(`Showing the top ${readout.outcomes.length} of ${readout.totalOutcomes} measured.`)}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-[#e8f4f8]">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Toggle({ active, onClick, tone = "normal", disabled, children }: {
  active: boolean; onClick: () => void; tone?: "normal" | "bad"; disabled?: boolean; children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={clsx(
        "min-h-11 rounded border-2 px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        active && tone === "bad" && "border-actor-hacker bg-actor-hacker/15 text-actor-hacker",
        active && tone === "normal" && "border-accent-teal bg-accent-teal/15 text-accent-teal",
        !active && tone === "bad" && "border-stage-border text-actor-hacker/60 hover:border-actor-hacker/60",
        !active && tone === "normal" && "border-stage-border text-stage-muted hover:border-accent-teal/60",
      )}>
      {children}{tone === "bad" && <span className="ml-1 opacity-70">!</span>}
    </button>
  );
}
