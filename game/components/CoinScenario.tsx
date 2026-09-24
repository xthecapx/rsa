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
import { ChoiceChallenge, CodePuzzle, CircuitPuzzle, CircuitSnapshot, EMPTY_CODE, EMPTY_CIRCUIT, type CodeBlock, type CodeSlots, type CircuitSlots } from "./CoinChallenges";

type ReplayChoice = "same" | "different" | "first";
type ReasonChoice = "seed" | "luck";
type ZeroChoice = "zero" | "both";
type SplitChoice = "exact" | "varies";
type ExplainChoice = "equal" | "alternate";
const REPLAY_CHOICES: Record<ReplayChoice, string> = {
  same: "Yes, the whole sequence will match.", different: "No, a random function always makes a different sequence.", first: "Only the first toss will match.",
};
const REASON_CHOICES: Record<ReasonChoice, string> = { seed: "Same seed and same call count.", luck: "Both laptops happened to get lucky." };
const ZERO_CHOICES: Record<ZeroChoice, string> = { zero: "Only zero.", both: "Zero and one." };
const SPLIT_CHOICES: Record<SplitChoice, string> = { exact: "Yes, exactly 50 heads and 50 tails.", varies: "No, the counts can differ." };
const EXPLAIN_CHOICES: Record<ExplainChoice, string> = { equal: "Each fresh shot gives both outcomes equal probability.", alternate: "It must alternate heads and tails." };
function shuffle<T,>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
interface Variants {
  code: CodeBlock[]; replay: ReplayChoice[]; reason: ReasonChoice[]; sixth: number[]; zero: ZeroChoice[]; split: SplitChoice[]; explain: ExplainChoice[];
}
const DEFAULT_VARIANTS: Variants = {
  code: ["seed", "reset", "return"], replay: ["same", "different", "first"], reason: ["seed", "luck"], sixth: [0, 1], zero: ["zero", "both"], split: ["exact", "varies"], explain: ["equal", "alternate"],
};
function newVariants(): Variants {
  return { code: shuffle(DEFAULT_VARIANTS.code), replay: shuffle(DEFAULT_VARIANTS.replay), reason: shuffle(DEFAULT_VARIANTS.reason), sixth: shuffle(DEFAULT_VARIANTS.sixth), zero: shuffle(DEFAULT_VARIANTS.zero), split: shuffle(DEFAULT_VARIANTS.split), explain: shuffle(DEFAULT_VARIANTS.explain) };
}
function validOrder<T extends string | number>(value: unknown, expected: T[]): value is T[] {
  return Array.isArray(value) && value.length === expected.length && expected.every((item) => value.includes(item));
}

const SAVE_KEY = "quantum-coin-session-v1";
interface Session {
  step: CoinStep; line: number; place: RoomPlace;
  practice: number[]; replay: number[]; comparison: number[]; prediction: number | null; sixth: number | null;
  hadamard: boolean; result: CoinResult | null; batches: CoinResult[]; winner: number | null;
  codeSlots: CodeSlots; codeBuilt: boolean; circuitSlots: CircuitSlots; circuitBuilt: boolean;
  replayChoice: ReplayChoice | null; seedReason: ReasonChoice | null; sixthChoice: number | null; zeroChoice: ZeroChoice | null;
  splitChoice: SplitChoice | null; explainChoice: ExplainChoice | null;
  badges: { code: boolean; seed: boolean; circuit: boolean }; variants: Variants;
}
const INITIAL: Session = {
  step: "welcome", line: 0, place: "table", practice: [], replay: [], comparison: [], prediction: null,
  sixth: null, hadamard: false, result: null, batches: [], winner: null,
  codeSlots: EMPTY_CODE, codeBuilt: false, circuitSlots: EMPTY_CIRCUIT, circuitBuilt: false,
  replayChoice: null, seedReason: null, sixthChoice: null, zeroChoice: null, splitChoice: null, explainChoice: null,
  badges: { code: false, seed: false, circuit: false }, variants: DEFAULT_VARIANTS,
};

/** Old saves keep their experiments and completion, while unfinished new challenges remain playable. */
function restoreSession(saved: Partial<Session>): Session {
  const laterThanClassical = COIN_STEPS.indexOf(saved.step ?? "welcome") > COIN_STEPS.indexOf("classical");
  const reachedReveal = COIN_STEPS.indexOf(saved.step ?? "welcome") >= COIN_STEPS.indexOf("reveal");
  const laterThanHadamard = COIN_STEPS.indexOf(saved.step ?? "welcome") > COIN_STEPS.indexOf("hadamard");
  const codeBuilt = !!saved.codeBuilt || !!saved.practice?.length || laterThanClassical;
  const circuitBuilt = !!saved.circuitBuilt || !!saved.hadamard || laterThanHadamard;
  const raw = saved.variants;
  const validBlock = (value: unknown): value is CodeBlock | null => value === null || value === "seed" || value === "reset" || value === "return";
  const oldCodeSlots = saved.codeSlots as (Partial<CodeSlots> & { inside?: CodeBlock | null; output?: CodeBlock | null }) | undefined;
  const codeSlots: CodeSlots = codeBuilt ? { setup: "seed", body: "return" }
    : oldCodeSlots && validBlock(oldCodeSlots.setup) && validBlock(oldCodeSlots.body)
      ? { setup: oldCodeSlots.setup, body: oldCodeSlots.body }
      : oldCodeSlots && validBlock(oldCodeSlots.setup)
        ? { setup: oldCodeSlots.setup, body: oldCodeSlots.inside === "reset" ? "reset"
          : oldCodeSlots.output === "return" || oldCodeSlots.inside === "return" ? "return" : null }
        : { ...EMPTY_CODE };
  const oldGateSlot = (saved as Partial<Session> & { gateSlot?: "before" | "after" | null }).gateSlot;
  const validOperation = (value: unknown): value is "H" | "M" | null => value === null || value === "H" || value === "M";
  const circuitSlots: CircuitSlots = circuitBuilt ? { first: "H", second: "M" }
    : saved.circuitSlots && validOperation(saved.circuitSlots.first) && validOperation(saved.circuitSlots.second)
      && !(saved.circuitSlots.first === saved.circuitSlots.second && saved.circuitSlots.first !== null)
      ? saved.circuitSlots
      : oldGateSlot === "before" ? { first: "H", second: null }
        : oldGateSlot === "after" ? { first: "M", second: "H" } : { ...EMPTY_CIRCUIT };
  // Earlier sessions stored the sixth value but not the full six-call display.
  const comparison = Array.isArray(saved.comparison) && saved.comparison.length === 6 && saved.comparison.every((bit) => bit === 0 || bit === 1) ? saved.comparison
    : saved.replay?.length === 5 && (saved.prediction === 0 || saved.prediction === 1)
      ? [...saved.replay, saved.prediction] : [];
  return {
    ...INITIAL, ...saved, step: saved.winner === 0 || saved.winner === 1 ? "done" : saved.step ?? "welcome",
    codeSlots, circuitSlots, comparison, prediction: comparison.length === 6 ? comparison[5] : saved.prediction ?? null,
    codeBuilt, circuitBuilt,
    badges: { code: codeBuilt, seed: !!saved.badges?.seed || !!saved.seedReason || reachedReveal, circuit: circuitBuilt },
    variants: {
      code: validOrder(raw?.code, DEFAULT_VARIANTS.code) ? raw!.code : shuffle(DEFAULT_VARIANTS.code),
      replay: validOrder(raw?.replay, DEFAULT_VARIANTS.replay) ? raw!.replay : shuffle(DEFAULT_VARIANTS.replay),
      reason: validOrder(raw?.reason, DEFAULT_VARIANTS.reason) ? raw!.reason : shuffle(DEFAULT_VARIANTS.reason),
      sixth: validOrder(raw?.sixth, DEFAULT_VARIANTS.sixth) ? raw!.sixth : shuffle(DEFAULT_VARIANTS.sixth),
      zero: validOrder(raw?.zero, DEFAULT_VARIANTS.zero) ? raw!.zero : shuffle(DEFAULT_VARIANTS.zero),
      split: validOrder(raw?.split, DEFAULT_VARIANTS.split) ? raw!.split : shuffle(DEFAULT_VARIANTS.split),
      explain: validOrder(raw?.explain, DEFAULT_VARIANTS.explain) ? raw!.explain : shuffle(DEFAULT_VARIANTS.explain),
    },
  };
}

function Coins({ bits }: { bits: number[] }) {
  useLocale((state) => state.locale);
  return <div className="flex flex-wrap gap-2" aria-label={bits.map((b) => t(b === 0 ? "Heads" : "Tails")).join(", ")}>
    {bits.map((bit, i) => <span key={i} className={`coin-token ${bit ? "tails" : ""}`} aria-hidden>{t(bit ? "Tails" : "Heads").slice(0, 1)}<small>{bit}</small></span>)}
  </div>;
}

function NumberedCoins({ bits }: { bits: number[] }) {
  useLocale((state) => state.locale);
  return <div className="coin-sequence" role="group" aria-label={bits.map((bit, index) => `${t("Call")} ${index + 1}: ${t(bit === 0 ? "Heads" : "Tails")}`).join(", ")}>
    {bits.map((bit, index) => <div key={index} className={`coin-sequence-item ${index === 5 ? "sixth" : ""}`}>
      <small>{t("Call")} {index + 1}</small>
      <span className={`coin-token ${bit ? "tails" : ""}`} aria-hidden>{t(bit ? "Tails" : "Heads").slice(0, 1)}<small>{bit}</small></span>
    </div>)}
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
        setSession(restoreSession(saved));
      } else setSession({ ...INITIAL, codeSlots: { ...EMPTY_CODE }, variants: newVariants() });
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
    patch({ step, line: 0 }); setError(null); gameAudio.playSfx("confirm");
  }
  async function run(work: () => Promise<Partial<Session>>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const values = await work();
      if (alive.current) { patch(values); if (values.step === "done") setLaptopOpen(false); gameAudio.playSfx("computer"); }
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
      <div className="coin-rewards" aria-label={t("Achievements")}>
        {([ ["code", "Program builder"], ["seed", "Seed detective"], ["circuit", "Circuit maker"] ] as const).map(([id, label]) =>
          <span key={id} className={session.badges[id] ? "earned" : ""}>{session.badges[id] ? "★ " : "☆ "}{t(label)}</span>)}
      </div>
      {storageNote && <p role="status">{t("Browser storage is unavailable. Progress will last for this visit only.")}</p>}
    </div>
  </>;
  return <GameShell title={t("Who Goes First?")} subtitle={t(scene.title)} backHref="/" backLabel={t("← Scenarios")}
    sceneReady={sceneReady} sceneFailed={assetStatus === "error"}
    sidebar={sidebar} objectives={objectives} laptopOpen={laptopOpen} laptopReady={atPlace && finishedDialog}
    onOpenLaptop={() => { if (sceneReady) setLaptopOpen(true); }}>
    <div className="coin-world">
      {sceneReady && <CoinHouse key={roomKey} initialPlace={session.step === "welcome" ? null : session.place} target={scene.place} winner={session.step === "done" ? session.winner : null}
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
        memory={<div className="grid grid-cols-3 gap-3 text-sm"><div>{t("Seed")}<br /><strong>42</strong></div><div>{t("Circuit")}<br /><strong>{session.step === "hadamard" && !session.circuitBuilt
          ? `|0⟩ → ${session.circuitSlots.first ?? "□"} → ${session.circuitSlots.second ?? "□"}`
          : localize(session.hadamard ? "|0⟩ → H → M" : "|0⟩ → M")}</strong></div><div>{t("Result")}<br /><strong>{localize(session.winner === null ? "—" : session.winner === 0 ? "Heads" : "Tails")}</strong></div></div>}
      >
      <section className="coin-workbench" aria-label={t("Experiment workbench")}>
        <div className="flex items-center justify-between gap-2"><h2>{localize(index < 4 ? "THE LAPTOP" : "QUANTUM COIN LAB")}</h2><span className="coin-badge">{localize(index < 4 ? "Python · seed 42" : "Simulator only")}</span></div>
        <div className="coin-rewards mt-3" aria-label={t("Achievements")}>
          {([ ["code", "Program builder"], ["seed", "Seed detective"], ["circuit", "Circuit maker"] ] as const).map(([id, label]) =>
            <span key={id} className={session.badges[id] ? "earned" : ""}>{session.badges[id] ? "★ " : "☆ "}{t(label)}</span>)}
        </div>
        <p className="my-4 text-stage-muted">{localize(index < 4 ? "0 = heads · 1 = tails. Build and inspect the seeded function." : "A real one-qubit circuit, simulated by Qiskit Aer on the backend. No quantum hardware is used.")}</p>
        {index > 0 && index < 4 && session.codeBuilt && <pre>{`import random\ncoin = random.Random(42)\n\ndef flip_coin():\n    return coin.randint(0, 1)`}</pre>}
        {index >= 4 && (session.step !== "hadamard" || session.circuitBuilt) && <>
          <CircuitSnapshot hadamard={session.hadamard} />
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
              {!session.codeBuilt && <CodePuzzle slots={session.codeSlots} order={session.variants.code}
                onChange={(codeSlots) => patch({ codeSlots })}
                onSolved={() => { patch({ codeBuilt: true, badges: { ...session.badges, code: true } }); gameAudio.playSfx("confirm"); }} />}
              {session.codeBuilt && <div className="coin-callout">★ {t("Program builder unlocked. The seed is set once; each call returns the next bit.")}</div>}
              {session.practice.length ? <><Coins bits={session.practice} /><p>{t("Five calls, five outcomes. Keep this sequence for comparison.")}</p>{action("Show Brayan the program →", () => next("predict"))}</>
                : session.codeBuilt && action("Run five practice tosses", () => void run(async () => ({ practice: (await coinApi.classical(5)).bits })))}
            </>}
            {session.step === "predict" && <>
              <p>{t("Your first five tosses")}</p><Coins bits={session.practice} />
              {!session.replay.length && <ChoiceChallenge prompt="Brayan restarts with seed 42 and makes the same five calls. What happens?"
                choices={REPLAY_CHOICES} order={session.variants.replay} value={session.replayChoice}
                onChoose={(replayChoice) => patch({ replayChoice })} />}
              {session.replay.length ? <><p>{t("Brayan’s generator · same seed, same first five")}</p><Coins bits={session.replay} />
                <p className="coin-callout">{t(session.replayChoice === "same" ? "Your prediction matched: all five results are the same." : "Surprise: all five results match your sequence.")}</p>
                <ChoiceChallenge prompt="Why did all five results match?" choices={REASON_CHOICES} order={session.variants.reason}
                  value={session.seedReason} onChoose={(seedReason) => patch({ seedReason, badges: { ...session.badges, seed: true } })} />
                {session.seedReason && <p className="text-accent-amber">{t(session.seedReason === "seed" ? "Exactly. A seeded generator repeats when restarted and called the same number of times." : "It was reproducible, not luck: the same seed and same calls recreate the sequence.")}</p>}
                {session.seedReason && action("Investigate call six →", () => next("reveal"))}</>
                : session.replayChoice && action("Run five calls on Brayan’s copy", () => void run(async () => {
                  const copy = await coinApi.classical(5);
                  return { replay: copy.bits };
                }))}
            </>}
            {session.step === "reveal" && <>
              <div className="coin-compare">
                <div><p>{t("Your first five calls")}</p><NumberedCoins bits={session.practice} /></div>
                <div><p>{t("Brayan’s first five calls")}</p><NumberedCoins bits={session.replay} /></div>
              </div>
              <p>{t("Run the same seed for six calls on Brayan’s copy. Keep the results here while you choose your answer.")}</p>
              {session.sixth === null && action(session.comparison.length === 6 ? "Run six calls again" : "Run six calls on Brayan’s copy", () => void run(async () => {
                const copy = await coinApi.classical(6);
                return { comparison: copy.bits, prediction: copy.bits[5] };
              }))}
              {session.comparison.length === 6 && <>
                <p>{t("Brayan’s six-call replay · seed 42")}</p><NumberedCoins bits={session.comparison} />
                <p className="coin-callout">{t("Brayan’s sixth value")}: <strong>{t(session.prediction === 0 ? "Heads (0)" : "Tails (1)")}</strong></p>
              </>}
              {session.comparison.length === 6 && session.sixth === null ? <>
                <p>{t("What will your sixth call return? Choose before revealing it.")}</p>
                <div className="coin-choices">{session.variants.sixth.map((bit) => <button key={bit} className={session.sixthChoice === bit ? "coin-choice selected" : "coin-choice"}
                  disabled={session.sixthChoice !== null} onClick={() => patch({ sixthChoice: bit })}>{t(bit === 0 ? "Heads (0)" : "Tails (1)")}</button>)}</div>
                {session.sixthChoice !== null && action("Reveal your sixth toss", () => void run(async () => ({ sixth: (await coinApi.classical(6)).bits[5] })))}
              </> : session.sixth !== null && <><p>{t("Your sixth call")}</p><Coins bits={[session.sixth]} />
                <p className="coin-callout">{t(session.sixthChoice === session.sixth ? "Your prediction matched. Replaying a known seed and call count reveals the next value." : "Brayan’s prediction matched. The same seed and call sequence reproduce the next value; your guess does not affect progress.")}</p>
                <p className="text-sm text-stage-muted">{t("For this demo, each API request restarts seed 42 and replays the requested number of calls.")}</p>
                {action("Explore a quantum coin →", () => next("qubit"))}</>}
            </>}
            {session.step === "qubit" && <>
              {!session.result || session.result.hadamard ? <>
                <ChoiceChallenge prompt="If we prepare |0⟩ and immediately measure it, which outcomes can appear?"
                  choices={ZERO_CHOICES} order={session.variants.zero} value={session.zeroChoice} onChoose={(zeroChoice) => patch({ zeroChoice })} />
                {session.zeroChoice && action("Measure |0⟩ · 10 shots", () => void simulate(false, 10))}
              </> : <><Results result={session.result} />
                <p className="coin-callout">{t(session.zeroChoice === "zero" ? "Right. Measuring a qubit prepared as zero returns zero without another gate." : "Only zero appeared. Measuring alone did not create two possible outcomes.")}</p>
                {action("Something is missing →", () => next("hadamard"))}</>}
            </>}
            {session.step === "hadamard" && <>
              {!session.circuitBuilt ? <CircuitPuzzle slots={session.circuitSlots} onChange={(circuitSlots) => patch({ circuitSlots })}
                onSolved={() => { patch({ circuitBuilt: true, hadamard: true, circuitSlots: { first: "H", second: "M" }, result: null, badges: { ...session.badges, circuit: true } }); gameAudio.playSfx("confirm"); }} />
                : session.result?.hadamard ? <><Results result={session.result} /><Coins bits={session.result.bits.slice(0, 10)} />{action("Compare more shots at the board →", () => next("experiment"))}</>
                  : <><div className="coin-callout">★ {t("Circuit maker unlocked. H acts before M, so each outcome has a 50% chance in the ideal circuit.")}</div>{action("Run the circuit · 10 shots", () => void simulate(true, 10))}</>}
            </>}
            {session.step === "experiment" && <>
              <ChoiceChallenge prompt="Will 100 fair shots have to show exactly 50 heads and 50 tails?"
                choices={SPLIT_CHOICES} order={session.variants.split} value={session.splitChoice} onChoose={(splitChoice) => patch({ splitChoice })} />
              {session.splitChoice && <p className="text-stage-muted">{t("Prediction locked. Run both batches to compare the observed counts.")}</p>}
              <div className="flex flex-wrap gap-2">{[100, 1000].map((shots) => {
                const completed = session.batches.some((batch) => batch.hadamard && batch.shots === shots);
                return <button key={shots} className="btn-primary" disabled={busy || completed || !session.splitChoice} onClick={() => void simulate(true, shots)}>
                  {completed ? "✓ " : ""}{t("Run ")}{shots}{t(" shots")}
                </button>;
              })}</div>
              {session.result && <Results result={session.result} />}
              <table className="w-full text-left"><caption className="mb-2 text-left text-stage-muted">{t("Your experiments")}</caption><thead><tr><th>{t("Shots")}</th><th>{t("Heads")}</th><th>{t("Tails")}</th></tr></thead>
                <tbody>{session.batches.filter((b) => b.hadamard).sort((a, b) => a.shots - b.shots).map((b) => <tr key={b.shots}><td>{b.shots}</td><td>{b.counts["0"]}</td><td>{b.counts["1"]}</td></tr>)}</tbody></table>
              {session.batches.some((b) => b.shots === 100) && session.batches.some((b) => b.shots === 1000) && <div className="space-y-3">
                <p className="coin-callout">{t(session.splitChoice === "varies" ? "Correct: equal chances do not require equal counts in a finite batch." : "Equal chances do not require exactly equal counts in a finite batch.")}</p>
                <p>{t(`Your 100-shot batch had ${session.batches.find((b) => b.shots === 100)?.counts["0"]} heads; your 1,000-shot batch had ${session.batches.find((b) => b.shots === 1000)?.counts["0"]} heads. What makes this circuit fair?`)}</p>
                <ChoiceChallenge prompt="Choose the explanation" choices={EXPLAIN_CHOICES} order={session.variants.explain}
                  value={session.explainChoice} onChoose={(explainChoice) => patch({ explainChoice })} />
                {session.explainChoice && <p role="status" className="text-accent-amber">{t(session.explainChoice === "equal" ? "Yes. Each fresh shot has equal probabilities; streaks and uneven counts are possible." : "Alternating would make the next bit predictable. Equal probabilities still allow streaks and uneven counts.")}</p>}
                {session.explainChoice && action("Take the coin to the table →", () => next("table"))}
              </div>}
            </>}
            {session.step === "table" && <>
              <div className="grid grid-cols-2 gap-3"><div className="coin-callout">{t("0 · Heads")}<br /><strong>{t("Ale starts")}</strong></div><div className="coin-callout">{t("1 · Tails")}<br /><strong>{t("Brayan starts")}</strong></div></div>
              <pre>{`POST /api/coin/simulate\n{"hadamard": true, "shots": 1}`}</pre>
              <p>{t("Use the first returned bit. The result is saved; refreshing won’t give another toss.")}</p>
              {session.winner === null && action("Agree & toss once", () => void run(async () => {
                const result = await coinApi.simulate(true, 1);
                const final = { result, winner: result.bits[0], step: "done" as const, line: 0 };
                try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...session, ...final })); }
                catch { if (alive.current) setStorageNote(true); }
                return final;
              }))}
            </>}
            {session.step === "done" && <>
              <p>{t("Next: take your circuit skills onto the street and explore how period finding helps break toy RSA.")}</p>
              <Link className="btn-primary inline-block" href="/scenarios/rsa">{t("Continue to Breaking RSA →")}</Link>
              <button className="btn-ghost block" onClick={() => { setLaptopOpen(false); setActivePlace(null); setRoomKey((key) => key + 1); setSession({ ...INITIAL, codeSlots: { ...EMPTY_CODE }, variants: newVariants() }); setError(null); }}>{t("Replay the whole lesson")}</button>
            </>}
          </div>}
      </section>
      </LaptopShell>
  </GameShell>;
}
