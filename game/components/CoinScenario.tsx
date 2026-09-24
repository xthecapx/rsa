"use client";
import { t, tOptional, localize, useLocale } from "@/i18n";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { COIN_SCENES, COIN_STEPS, type CoinStep, type RoomPlace } from "@/content/coin";
import { coinApi, type CoinResult } from "@/lib/coin";
import { useProgress } from "@/game/progress";
import type { Task } from "@/game/state";
import { gameAudio } from "@/game/audio";
import { CoinHouse } from "./CoinHouse";
import { GameShell } from "./GameShell";
import { MissionObjectives } from "./ObjectiveList";
import { DialogueFrame, DialogueLine, useDialogueText } from "./DialoguePresentation";
import { useCoinSceneAssets } from "./useSceneAssets";
import { TalkControl } from "./TouchControls";
import { LaptopShell } from "./LaptopShell";

const SAVE_KEY = "quantum-coin-session-v1";
interface Session {
  step: CoinStep; line: number; place: RoomPlace;
  practice: number[]; replay: number[]; prediction: number | null; sixth: number | null;
  hadamard: boolean; result: CoinResult | null; batches: CoinResult[]; winner: number | null;
}
const INITIAL: Session = {
  step: "welcome", line: 0, place: "table", practice: [], replay: [], prediction: null,
  sixth: null, hadamard: false, result: null, batches: [], winner: null,
};

function Coins({ bits }: { bits: number[] }) {
  useLocale((state) => state.locale);
  return <div className="flex flex-wrap gap-2" aria-label={bits.map((b) => t(b === 0 ? "Heads" : "Tails")).join(", ")}>
    {bits.map((bit, i) => <span key={i} className={`coin-token ${bit ? "tails" : ""}`} aria-hidden>{t(bit ? "Tails" : "Heads").slice(0, 1)}<small>{bit}</small></span>)}
  </div>;
}

function Results({ result }: { result: CoinResult }) {
  useLocale((state) => state.locale);
  const heads = result.counts["0"];
  return <div className="coin-results" aria-live="polite">
    <div className="flex justify-between gap-3"><strong>{result.shots}{t(" simulated shots")}</strong><span>{t("AerSimulator")}</span></div>
    <div className="coin-bar" role="img" aria-label={tOptional(`${heads} heads, ${result.counts["1"]} tails`)}>
      <div style={{ width: `${100 * heads / result.shots}%` }} />
    </div>
    <div className="flex justify-between"><span>{t("Heads ")}{heads} · {localize((heads / result.shots * 100).toFixed(1))}%</span><span>{t("Tails ")}{result.counts["1"]}</span></div>
    <p className="mt-2 text-stage-muted">{t("Expected probabilities: ")}{localize(result.hadamard ? "50% / 50%" : "100% / 0%")}{t(". Observed counts can vary.")}</p>
  </div>;
}

export function CoinScenario() {
  useLocale((state) => state.locale);
  const assetStatus = useCoinSceneAssets();
  const [session, setSession] = useState<Session>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [laptopOpen, setLaptopOpen] = useState(false);
  const [activePlace, setActivePlace] = useState<RoomPlace | null>(null);
  const [roomKey, setRoomKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const [nearbyPlace, setNearbyPlace] = useState<RoomPlace | null>(null);
  const [walking, setWalking] = useState(false);

  const sceneReady = hydrated && assetStatus === "ready";
  const scene = COIN_SCENES[session.step];
  const atPlace = activePlace === scene.place;
  const finishedDialog = session.line >= scene.lines.length;
  const index = COIN_STEPS.indexOf(session.step);
  const line = scene.lines[session.line];
  const dialogue = useDialogueText(sceneReady && atPlace && !laptopOpen && line ? t(line.text) : "");

  useEffect(() => {
    alive.current = true;
    void gameAudio.playMusic("play");
    void useProgress.persist.rehydrate();
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
      if (saved && COIN_STEPS.includes(saved.step) && ["table", "desk", "board"].includes(saved.place)
        && Number.isInteger(saved.line) && saved.line >= 0 && Array.isArray(saved.practice)
        && Array.isArray(saved.replay) && Array.isArray(saved.batches)) {
        setSession({ ...INITIAL, ...saved });
      }
    } catch { /* Missing or invalid local progress starts a fresh lesson. */ }
    setHydrated(true);
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(session)); }
    catch { setStorageNote(true); }
    if (session.step === "done") useProgress.getState().complete("coin", "coin");
  }, [session, hydrated]);

  useEffect(() => {
    if (sceneReady && atPlace && finishedDialog && session.step !== "welcome") setLaptopOpen(true);
  }, [sceneReady, atPlace, finishedDialog, session.step]);

  function interact(place: RoomPlace) {
    if (!sceneReady || place !== scene.place || busy || laptopOpen) return;
    gameAudio.playSfx("click");
    if (!atPlace) { setActivePlace(place); patch({ place }); }
    else if (!finishedDialog) {
      if (!dialogue.settled) dialogue.reveal();
      else patch({ line: session.line + 1 });
    } else if (session.step === "welcome") next("classical");
    else setLaptopOpen(true);
  }

  function patch(values: Partial<Session>) { setSession((s) => ({ ...s, ...values })); }
  function next(step: CoinStep) {
    setLaptopOpen(false);
    patch({ step, line: 0 }); setFeedback(null); setError(null); gameAudio.playSfx("confirm");
  }
  async function run(work: () => Promise<Partial<Session>>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const values = await work();
      if (alive.current) { patch(values); gameAudio.playSfx("computer"); }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Please try the experiment again.");
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const simulate = (hadamard: boolean, shots: number) => run(async () => {
    const result = await coinApi.simulate(hadamard, shots);
    return { result, batches: [...session.batches.filter((b) => b.shots !== shots), result] };
  });
  const action = (label: string, onClick: () => void, disabled = false) => (
    <button className="btn-primary" disabled={busy || disabled} onClick={onClick}>{localize(label)}</button>
  );

  const objectives = <MissionObjectives tasks={COIN_STEPS.map((step, i): Task => ({
    id: step, label: COIN_SCENES[step].title,
    status: i < index || session.step === "done" ? "done" : i === index ? "active" : "pending",
  }))} />;
  const sidebar = <>
    {objectives}
    <div className="panel p-4 space-y-3 text-sm leading-relaxed">
      <p className="text-accent-teal">{t("GAME NIGHT · ALE’S HOUSE")}</p>
      <p>{t(scene.objective)}</p>
      <p className="text-stage-muted">{t("Simulator only")}</p>
      {session.result && <p>{t("Heads")}: {session.result.counts["0"]} · {t("Tails")}: {session.result.counts["1"]}</p>}
      {storageNote && <p role="status">{t("Browser storage is unavailable. Progress will last for this visit only.")}</p>}
    </div>
  </>;
  return <GameShell title={t("Who Goes First?")} subtitle={t(scene.title)} backHref="/" backLabel={t("← Scenarios")}
    sceneReady={sceneReady} sceneFailed={assetStatus === "error"}
    sidebar={sidebar} objectives={objectives} laptopOpen={laptopOpen} laptopReady={atPlace && finishedDialog}
    onOpenLaptop={() => { if (sceneReady) setLaptopOpen(true); }}>
    <div className="coin-world">
      {sceneReady && <CoinHouse key={roomKey} initialPlace={session.step === "welcome" ? null : session.place} target={scene.place}
        disabled={busy || laptopOpen} movementLocked={atPlace && !finishedDialog}
        onNear={(place) => { setNearbyPlace(place); setActivePlace((active) => active === place ? active : null); }}
        onWalking={setWalking} onInteract={interact} />}
    </div>
    {!laptopOpen && <div className={`pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-4 ${!atPlace ? "pb-20 lg:pb-4" : ""}`}>
      {!atPlace ? <div className={`textbox max-w-lg px-4 py-3 text-center transition-opacity ${walking ? "opacity-20" : ""}`}>
        <p className="text-sm leading-relaxed">{t(scene.objective)}</p>
        <p className="mt-2 text-xs text-accent-amber">{nearbyPlace === scene.place ? t("Press Space or tap Talk") : t("Walk to the glowing marker.")}</p>
      </div> : <div className="pointer-events-auto w-full max-w-4xl">
        <DialogueFrame role={!finishedDialog ? "button" : undefined} tabIndex={!finishedDialog ? 0 : undefined}
          onClick={() => { if (!finishedDialog) interact(scene.place); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); interact(scene.place); } }}>
          {!finishedDialog && line ? <>
            <DialogueLine speaker={line.speaker}>{dialogue.typed}{!dialogue.settled && <span className="animate-pulse">|</span>}</DialogueLine>
            <p className="text-xs text-stage-muted">{dialogue.settled ? t("Space to continue") : t("Space to skip")}{" · "}{t("Tap to continue")}</p>
          </> : <>
            <DialogueLine speaker="hacker">{t(session.step === "done" ? "Achievement unlocked: Quantum Coin. Your first circuit is ready." : "Your turn. Open the laptop to complete this step.")}</DialogueLine>
            <button className="btn-primary self-start text-sm" onClick={() => interact(scene.place)}>
              {t(session.step === "welcome" ? "Let’s write the function →" : "Open laptop")}
            </button>
          </>}
        </DialogueFrame>
      </div>}
    </div>}
    <TalkControl canInteract={nearbyPlace === scene.place && !busy} visible={!atPlace && !laptopOpen} onTalk={() => interact(scene.place)} />

      <LaptopShell open={sceneReady && laptopOpen} title={t("Quantum Coin")} status={busy ? "Running the experiment…" : "Simulator only"} onClose={() => setLaptopOpen(false)}
        footer={<p>{t("Close the laptop to return to the room. Your results are saved.")}</p>}
        memory={<div className="grid grid-cols-3 gap-3 text-sm"><div>{t("Seed")}<br /><strong>42</strong></div><div>{t("Circuit")}<br /><strong>{localize(session.hadamard ? "|0⟩ → H → M" : "|0⟩ → M")}</strong></div><div>{t("Result")}<br /><strong>{localize(session.winner === null ? "—" : session.winner === 0 ? "Heads" : "Tails")}</strong></div></div>}
      >
      <section className="coin-workbench" aria-label={t("Experiment workbench")}>
        <div className="flex items-center justify-between gap-2"><h2>{localize(index < 4 ? "THE LAPTOP" : "QUANTUM COIN LAB")}</h2><span className="coin-badge">{localize(index < 4 ? "Python · seed 42" : "Simulator only")}</span></div>
        <p className="my-4 text-stage-muted">{localize(index < 4 ? "0 = heads · 1 = tails. The generator is seeded once, then advances with every call." : "A real one-qubit circuit, simulated by Qiskit Aer on the backend. No quantum hardware is used.")}</p>
        {index > 0 && index < 4 && <pre>{`import random\ncoin = random.Random(42)\n\ndef flip_coin():\n    return coin.randint(0, 1)`}</pre>}
        {index >= 4 && <>
          <div className="coin-circuit" aria-label={t(session.hadamard ? "Prepare zero, Hadamard gate, measure" : "Prepare zero, measure")}>
            <span>|0⟩</span><span className="wire" /><span className={session.hadamard ? "gate" : "empty-gate"}>{localize(session.hadamard ? "H" : "?")}</span><span className="wire" /><span className="gate measure">{t("M")}</span><span>→ 0 / 1</span>
          </div>
          <pre>{`circuit = QuantumCircuit(1, 1)\n${session.hadamard ? "circuit.h(0)\n" : "# Start without a gate\n"}circuit.measure(0, 0)`}</pre>
        </>}
        {busy && <p role="status" className="my-4 text-accent-teal">{t("Running the experiment…")}</p>}
        {localize(error && <p role="alert" className="my-4 text-actor-hacker">{localize(error)}</p>)}
        {session.step === "done" && <div className="coin-achievement mt-5" aria-live="polite"><span>{t("QUANTUM COIN")}</span><h2>{localize(session.winner === 0 ? "Ale" : "Brayan")}{t(" goes first!")}</h2>
          <Coins bits={[session.winner ?? 0]} /><p>{t("Your first quantum program, tested in a simulator.")}</p></div>}
        {!atPlace || !finishedDialog ? <p className="coin-placeholder">{localize(!atPlace ? "Visit the highlighted location to open this step." : "Finish the conversation to unlock the experiment.")}</p> :
          <div className="mt-5 space-y-5">
            {session.step === "welcome" && <>
              <p>{t("Build a coin-flip function to decide who starts. No prior quantum knowledge needed.")}</p>
              {action("Let’s write the function →", () => next("classical"))}
            </>}
            {session.step === "classical" && <>
              {session.practice.length ? <><Coins bits={session.practice} /><p>{t("Five calls, five outcomes. Keep this sequence for comparison.")}</p>{action("Show Brayan the program →", () => next("predict"))}</>
                : action("Run five practice tosses", () => void run(async () => ({ practice: (await coinApi.classical(5)).bits })))}
            </>}
            {session.step === "predict" && <>
              <p>{t("Your first five tosses")}</p><Coins bits={session.practice} />
              {session.replay.length ? <><p>{t("Brayan’s generator · same seed, same first five")}</p><Coins bits={session.replay} />
                <div className="coin-callout">{t("Prediction for toss six: ")}<strong>{localize(session.prediction === 0 ? "HEADS (0)" : "TAILS (1)")}</strong>{t(". Locked before your result.")}</div>
                {action("Check his prediction →", () => next("reveal"))}</>
                : action("Replay seed 42 on Brayan’s laptop", () => void run(async () => {
                  const copy = await coinApi.classical(6);
                  return { replay: copy.bits.slice(0, 5), prediction: copy.bits[5] };
                }))}
            </>}
            {session.step === "reveal" && <>
              <div className="coin-callout">{t("Brayan predicts: ")}<strong>{localize(session.prediction === 0 ? "Heads" : "Tails")}</strong></div>
              {session.sixth === null ? action("Reveal your sixth toss", () => void run(async () => ({ sixth: (await coinApi.classical(6)).bits[5] })))
                : <><Coins bits={[session.sixth]} /><p>{t("He matched it. The same seed and the same call sequence reproduce the result. Our API replays those six calls to show the comparison.")}</p>{action("Explore a quantum coin →", () => next("qubit"))}</>}
            </>}
            {session.step === "qubit" && <>
              <p>{t("Prediction: will measuring a freshly prepared zero give us two possibilities?")}</p>
              {session.result && !session.result.hadamard ? <><Results result={session.result} />{action("Something is missing →", () => next("hadamard"))}</>
                : action("Measure |0⟩ · 10 shots", () => void simulate(false, 10))}
            </>}
            {session.step === "hadamard" && <>
              {!session.hadamard ? <><p>{t("Place a Hadamard gate before measurement to prepare equal probabilities.")}</p>{action("+ Add Hadamard (H)", () => patch({ hadamard: true, result: null }))}</>
                : session.result?.hadamard ? <><Results result={session.result} /><Coins bits={session.result.bits.slice(0, 10)} />{action("Compare more shots at the board →", () => next("experiment"))}</>
                  : action("Run the circuit · 10 shots", () => void simulate(true, 10))}
            </>}
            {session.step === "experiment" && <>
              <div className="flex flex-wrap gap-2">{[100, 1000].map((shots) => <button key={shots} className="btn-primary" disabled={busy} onClick={() => void simulate(true, shots)}>{t("Run ")}{shots}{t(" shots")}</button>)}</div>
              {session.result && <Results result={session.result} />}
              <table className="w-full text-left"><caption className="mb-2 text-left text-stage-muted">{t("Your experiments")}</caption><thead><tr><th>{t("Shots")}</th><th>{t("Heads")}</th><th>{t("Tails")}</th></tr></thead>
                <tbody>{session.batches.filter((b) => b.hadamard).sort((a, b) => a.shots - b.shots).map((b) => <tr key={b.shots}><td>{b.shots}</td><td>{b.counts["0"]}</td><td>{b.counts["1"]}</td></tr>)}</tbody></table>
              {session.batches.some((b) => b.shots >= 100) && <div className="space-y-3"><p>{t("What makes the ideal circuit a fair coin?")}</p>
                <button className="btn-ghost w-full text-left" onClick={() => setFeedback("Alternating gives balanced counts, but makes the next toss predictable. Equal chances allow streaks.")}>{t("It must alternate heads and tails.")}</button>
                <button className="btn-primary w-full text-left" disabled={busy} onClick={() => next("table")}>{t("Each fresh shot gives both outcomes equal probability.")}</button>
                {localize(feedback && <p role="status" className="text-accent-amber">{localize(feedback)}</p>)}
              </div>}
            </>}
            {session.step === "table" && <>
              <div className="grid grid-cols-2 gap-3"><div className="coin-callout">{t("0 · Heads")}<br /><strong>{t("Ale starts")}</strong></div><div className="coin-callout">{t("1 · Tails")}<br /><strong>{t("Brayan starts")}</strong></div></div>
              <pre>{`POST /api/coin/simulate\n{"hadamard": true, "shots": 1}`}</pre>
              <p>{t("Use the first returned bit. The result is saved; refreshing won’t give another toss.")}</p>
              {action("Agree & toss once", () => void run(async () => {
                const result = await coinApi.simulate(true, 1);
                return { result, winner: result.bits[0], step: "done", line: 0 };
              }))}
            </>}
            {session.step === "done" && <>
              <p>{t("Next: take your circuit skills onto the street and explore how period finding helps break toy RSA.")}</p>
              <Link className="btn-primary inline-block" href="/scenarios/rsa">{t("Continue to Breaking RSA →")}</Link>
              <button className="btn-ghost block" onClick={() => { setLaptopOpen(false); setActivePlace(null); setRoomKey((key) => key + 1); setSession(INITIAL); setFeedback(null); setError(null); }}>{t("Replay the whole lesson")}</button>
            </>}
          </div>}
      </section>
      </LaptopShell>
  </GameShell>;
}
