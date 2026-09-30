"use client";
import { t, useLocale } from "@/i18n";

import { useEffect, useRef, useState } from "react";
import { VAULT_SCENES, VAULT_STEPS, type VaultPlace, type VaultStep } from "@/content/vault";
import { BITS, CANDLES, formatCount, KEYSPACE, knownBits, litCandles, vaultApi, VaultRefusal, type VaultRun } from "@/lib/vault";
import { useProgress } from "@/game/progress";
import { useMedals } from "@/game/medals";
import { MedalReveal } from "./MedalCase";
import type { Task } from "@/game/state";
import { gameAudio } from "@/game/audio";
import { StartOverControl, type RestartOption } from "./StartOverControl";
import { VaultHouse, type VaultMood } from "./VaultHouse";
import { GameShell } from "./GameShell";
import { MissionObjectives } from "./ObjectiveList";
import { DialogueFrame, DialogueLine, useDialogueText } from "./DialoguePresentation";
import { useVaultSceneAssets } from "./useSceneAssets";
import { TalkControl } from "./TouchControls";
import { LaptopShell } from "./LaptopShell";
import {
  BOARD, EMPTY_BV, EMPTY_TRAP, LEDGER, BvCircuitBuilder, CodeBoard, ComparisonCard, GroverClockRun, GroverTrapBuilder, ManualScan,
  MaskRegister, MidnightQuiz, StepFormula, UnlockPad, bvCircuit, bvHint, bvProblem, emptyFormula, trapHint, trapReady,
  type BoardChip, type BoardSlot, type BvSlots, type LedgerChip, type LedgerSlot, type Question, type QuizAnswer, type TrapSlots,
} from "./VaultChallenges";

export const VAULT_SAVE_KEY = "quantum-vault-session-v1";
const PLACES: VaultPlace[] = ["vault", "desk", "table"];
const MASK = /^[01]{25}$/;

function shuffle<T,>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
const sameItems = <T,>(value: unknown, expected: T[]): value is T[] =>
  Array.isArray(value) && value.length === expected.length && expected.every((item) => value.includes(item));
const BOARD_CHIPS = Object.keys(BOARD.chips) as BoardChip[];
const LEDGER_CHIPS = Object.keys(LEDGER.chips) as LedgerChip[];

interface Session {
  step: VaultStep; line: number; place: VaultPlace;
  token: string | null; night: number;
  /** Candles burned tonight. */
  candles: number;
  tries: string[]; questions: Question[];
  /** What the vault last answered: a question or a key at the door. */
  last: "ask" | "key" | null;
  quiz: QuizAnswer | null;
  lucky: boolean;
  /** A several-candle question knocked: proof the lock is not a match lock. */
  sawParity: boolean;
  trap: TrapSlots; board: Record<BoardSlot, BoardChip | null>; boardSolved: boolean;
  groverRunKey: number; groverDone: boolean;
  scanned: boolean;
  ledger: Record<LedgerSlot, LedgerChip | null>; ledgerSolved: boolean;
  bv: BvSlots; run: VaultRun | null; runKey: number; revealed: boolean;
  variants: { board: BoardChip[]; ledger: LedgerChip[] };
}
const INITIAL: Session = {
  step: "welcome", line: 0, place: "vault", token: null, night: 1, candles: 0,
  tries: [], questions: [], last: null, quiz: null, lucky: false, sawParity: false,
  trap: EMPTY_TRAP, board: emptyFormula(BOARD), boardSolved: false, groverRunKey: 0, groverDone: false,
  scanned: false, ledger: emptyFormula(LEDGER), ledgerSolved: false,
  bv: EMPTY_BV, run: null, runKey: 0, revealed: false,
  variants: { board: BOARD_CHIPS, ledger: LEDGER_CHIPS },
};
const fresh = (): Session => ({
  ...INITIAL, trap: { ...EMPTY_TRAP }, bv: { ...EMPTY_BV },
  variants: { board: shuffle(BOARD_CHIPS), ledger: shuffle(LEDGER_CHIPS) },
});

function restoreSession(saved: Partial<Session>): Session {
  const base = fresh();
  const questions = Array.isArray(saved.questions)
    ? saved.questions.filter((q) => q && MASK.test(q.x) && (q.knock === 0 || q.knock === 1)).slice(0, CANDLES) : [];
  const tries = Array.isArray(saved.tries) ? saved.tries.filter((key) => MASK.test(key)).slice(0, CANDLES) : [];
  const run = saved.run && typeof saved.run.measured === "string" && MASK.test(saved.run.measured) && Array.isArray(saved.run.frames) ? saved.run : null;
  return {
    ...base, ...saved, questions, tries, run,
    candles: Math.min(CANDLES, Math.max(0, Number.isInteger(saved.candles) ? saved.candles! : 0)),
    last: saved.last === "ask" || saved.last === "key" ? saved.last : null,
    quiz: saved.quiz === "9" || saved.quiz === "25" || saved.quiz === "never" ? saved.quiz : null,
    night: Number.isInteger(saved.night) && saved.night! > 0 ? saved.night! : 1,
    board: { ...base.board, ...saved.board }, ledger: { ...base.ledger, ...saved.ledger },
    trap: { ...EMPTY_TRAP, ...saved.trap }, bv: { ...EMPTY_BV, ...saved.bv },
    variants: {
      board: sameItems(saved.variants?.board, BOARD_CHIPS) ? saved.variants!.board : base.variants.board,
      ledger: sameItems(saved.variants?.ledger, LEDGER_CHIPS) ? saved.variants!.ledger : base.variants.ledger,
    },
  };
}

const REFUSALS: Record<string, string> = {
  extra: "Notes: the core refused. Nothing to amplify — empty the repeat box.",
  prep: "Notes: the core refused. The data bus needs H before the ghost.",
  helper: "Notes: the core refused. The helper must be |−⟩ for the answer to become a phase.",
  output: "Notes: the core refused. Add H after the ghost, or the signs stay invisible.",
  measure: "Notes: the core refused. Put M at the end of the data bus.",
};

export function VaultScenario({ onExit, onRestartGame }: { onExit?: () => void; onRestartGame?: () => void }) {
  useLocale((state) => state.locale);
  const assetStatus = useVaultSceneAssets();
  const [session, setSession] = useState<Session>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [laptopOpen, setLaptopOpen] = useState(false);
  const [activePlace, setActivePlace] = useState<VaultPlace | null>(null);
  const [roomKey, setRoomKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const [nearbyPlace, setNearbyPlace] = useState<VaultPlace | null>(null);
  const [walking, setWalking] = useState(false);
  const [nearExit, setNearExit] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);

  const sceneReady = hydrated && assetStatus === "ready";
  const scene = VAULT_SCENES[session.step];
  const atPlace = activePlace === scene.place;
  const finishedDialog = session.line >= scene.lines.length;
  const index = VAULT_STEPS.indexOf(session.step);
  const line = scene.lines[session.line];
  const dialogue = useDialogueText(sceneReady && atPlace && !laptopOpen && line ? t(line.text) : "");

  useEffect(() => {
    alive.current = true;
    void gameAudio.playMusic("play");
    void useProgress.persist.rehydrate(); void useMedals.persist.rehydrate();
    try {
      const saved = JSON.parse(localStorage.getItem(VAULT_SAVE_KEY) ?? "null");
      // v3 saves may sit on the removed odds card: resume at the lock.
      if (saved?.step === "odds") Object.assign(saved, { step: "classical", line: 0, place: "vault" });
      if (saved && VAULT_STEPS.includes(saved.step) && PLACES.includes(saved.place)
        && Number.isInteger(saved.line) && saved.line >= 0) setSession(restoreSession(saved));
      else setSession(fresh());
    } catch { setSession(fresh()); }
    setHydrated(true);
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(VAULT_SAVE_KEY, JSON.stringify(session)); }
    catch { setStorageNote(true); }
    if (session.step === "done") useProgress.getState().complete("vault", "vault");
  }, [session, hydrated]);

  useEffect(() => {
    if (sceneReady && atPlace && finishedDialog && session.step !== "welcome") setLaptopOpen(true);
  }, [sceneReady, atPlace, finishedDialog, session.step]);

  function interact(place: VaultPlace) {
    if (!sceneReady || place !== scene.place || busy || laptopOpen || journalOpen || restartOpen) return;
    gameAudio.playSfx("click");
    if (!atPlace) { setActivePlace(place); patch({ place }); }
    else if (!finishedDialog) {
      if (!dialogue.settled) dialogue.reveal();
      else patch({ line: session.line + 1 });
    } else if (session.step === "welcome") next("classical");
    else setLaptopOpen(true);
  }

  function patch(values: Partial<Session>) { setSession((s) => ({ ...s, ...values })); }
  function next(step: VaultStep, values: Partial<Session> = {}) {
    setLaptopOpen(false); setMessage(null);
    patch({ ...values, step, line: 0 }); setError(null); gameAudio.playSfx("confirm");
  }
  async function run(work: () => Promise<Partial<Session>>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const values = await work();
      if (!alive.current) return;
      patch(values);
      if (values.step && values.step !== session.step) setLaptopOpen(false);
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof VaultRefusal) { gameAudio.playSfx("error"); setMessage(REFUSALS[e.reason]); }
      else setError(e instanceof Error ? e.message : "The quantum core did not answer. Try again.");
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const token = async () => session.token ?? (await vaultApi.device()).token;
  /** The third candle is out: the house goes cold and, at midnight, the lock forgets. */
  function freeze(values: Partial<Session>): Partial<Session> {
    gameAudio.playSynth("snuff"); gameAudio.playSynth("cold"); gameAudio.playSynth("toll");
    return { ...values, step: "freeze", line: 0 };
  }
  /** A new night: fresh candles and a fresh mask. Nothing learned before still applies. */
  const newNight = (step: VaultStep) => run(async () => {
    const { token: rekeyed } = await vaultApi.device(session.token ?? undefined);
    gameAudio.playSfx("confirm");
    return { token: rekeyed, night: session.night + 1, candles: 0, tries: [], questions: [], last: null, step, line: 0 };
  });

  const tryKey = (key: string) => run(async () => {
    const device = await token();
    const { open } = await vaultApi.key(device, key);
    const tries = [...session.tries, key], candles = session.candles + 1;
    if (open) { gameAudio.playSfx("confirm"); return { token: device, tries, candles, last: "key", lucky: true, step: "lucky", line: 0 }; }
    gameAudio.playSfx("error"); gameAudio.playSynth("snuff");
    const values: Partial<Session> = { token: device, tries, candles, last: "key" };
    return candles >= CANDLES ? freeze(values) : values;
  });
  const ask = (x: string) => run(async () => {
    const device = await token();
    const { knock } = await vaultApi.ask(device, x);
    if (knock) gameAudio.playSynth("knock"); else gameAudio.playSynth("snuff");
    const sawParity = session.sawParity || (knock === 1 && litCandles(x).length > 1);
    const candles = session.candles + 1;
    const values: Partial<Session> = { token: device, questions: [...session.questions, { x, knock }], candles, last: "ask", sawParity };
    return candles >= CANDLES ? freeze(values) : values;
  });

  const execute = () => run(async () => {
    const device = await token();
    const result = await vaultApi.run(device, bvCircuit(session.bv));
    gameAudio.playSfx("computer");
    return { token: device, run: result, runKey: session.runKey + 1, candles: 1, revealed: false };
  });
  const unlock = () => run(async () => {
    if (!session.token || !session.run) return {};
    const { open } = await vaultApi.key(session.token, session.run.measured);
    if (open) { gameAudio.playSynth("door"); return { step: "done", line: 0 }; }
    gameAudio.playSfx("error");
    throw new Error("The tumblers did not turn. Execute the circuit again.");
  });

  const action = (label: string, onClick: () => void, disabled = false) => (
    <button className="btn-primary" disabled={busy || disabled} onClick={onClick}>{t(label)}</button>
  );

  function leaveHouse() {
    if (inFlight.current || !hydrated) return;
    try { localStorage.setItem(VAULT_SAVE_KEY, JSON.stringify(session)); } catch { setStorageNote(true); }
    gameAudio.playSfx("switch");
    if (onExit) onExit(); else window.location.assign("/");
  }
  function restartLesson() {
    if (inFlight.current || !hydrated) return;
    const start = fresh();
    try { localStorage.setItem(VAULT_SAVE_KEY, JSON.stringify(start)); } catch { setStorageNote(true); }
    useProgress.getState().reset("vault");
    setLaptopOpen(false); setActivePlace(null); setNearbyPlace(null); setNearExit(false); setMessage(null);
    setRoomKey((key) => key + 1); setSession(start); setError(null);
    gameAudio.playSfx("confirm");
  }
  const restartOptions: RestartOption[] = [
    { label: "Restart this lesson", description: "Clear Operation Ghost Key: a new mask, fresh candles, empty circuits, and no completion. Start inside Casa Ofelia.", restart: restartLesson },
    ...(onRestartGame ? [{ label: "Start the whole game over", description: "Clear every lesson and town progress. Return to Mayor Cap’s welcome in Coin Town.", restart: onRestartGame }] : []),
  ];
  const restartControl = <StartOverControl options={restartOptions} disabled={busy || !sceneReady} onOpenChange={setRestartOpen} />;
  const skipped: VaultStep = session.lucky ? "freeze" : "lucky";
  const objectives = <MissionObjectives tasks={VAULT_STEPS.filter((step) => step !== skipped).map((step): Task => ({
    id: step, label: VAULT_SCENES[step].title,
    status: VAULT_STEPS.indexOf(step) < index || session.step === "done" ? "done" : step === session.step ? "active" : "pending",
  }))} />;
  const candlesLeft = CANDLES - session.candles;
  const sidebar = <>
    {objectives}
    <div className="panel p-4 space-y-3 text-sm leading-relaxed">
      <p className="text-accent-amber">{t("HAUNTED HOUSE · CASA OFELIA")}</p>
      <p>{t(scene.objective)}</p>
      <p className="text-stage-muted">{t("Night")} {session.night} · {t("Candles left")}: {candlesLeft}/{CANDLES}</p>
      {storageNote && <p role="status">{t("Browser storage is unavailable. Progress will last for this visit only.")}</p>}
    </div>
  </>;
  const cold = session.step === "freeze" || session.step === "lucky" || (session.step === "groverRun" && session.groverDone)
    || (session.step === "diagnostics" && session.line === 0);
  const mood: VaultMood = session.step === "done" ? "open" : cold ? "cold" : "haunted";
  const panelTitle = scene.place === "desk" ? "Quantum core" : scene.place === "table" ? "Séance table" : "The vault";
  const problem = bvProblem(session.bv);

  return <GameShell restartControl={restartControl} title={t("Operation Ghost Key")} subtitle={t(scene.title)} backHref="/" backLabel={t("Return to town")} onBack={leaveHouse} backDisabled={busy || !sceneReady} onObjectivesOpen={setJournalOpen}
    sceneReady={sceneReady} sceneFailed={assetStatus === "error"}
    sidebar={sidebar} objectives={objectives} laptopOpen={laptopOpen} laptopReady={atPlace && finishedDialog}
    onOpenLaptop={() => { if (sceneReady) setLaptopOpen(true); }}>
    <div className="coin-world">
      {sceneReady && <VaultHouse key={roomKey} initialPlace={session.step === "welcome" ? null : session.place} target={scene.place}
        mood={mood} candles={session.step === "done" ? 0 : candlesLeft}
        disabled={busy || laptopOpen || journalOpen || restartOpen} movementLocked={atPlace && !finishedDialog}
        onNear={(place) => { setNearbyPlace(place); setActivePlace((active) => active === place ? active : null); }}
        onWalking={setWalking} onInteract={interact} onExit={leaveHouse} onNearExit={setNearExit} />}
    </div>
    {!laptopOpen && !journalOpen && !restartOpen && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {!atPlace ? <div className={`textbox max-w-lg px-4 py-3 text-center transition-opacity ${walking ? "opacity-20" : ""}`}>
        <p className="text-sm leading-relaxed">{t(scene.objective)}</p>
        <p className="mt-2 text-xs text-accent-amber">{nearExit ? t("Leave Casa Ofelia and return to Quantum Town. Your lesson is saved.") : nearbyPlace === scene.place ? t("Use Talk to interact.") : t("Walk to the glowing marker.")}</p>
        {(nearExit || nearbyPlace === scene.place) && <>
          <p className="coin-keyboard-hint mt-2 text-xs text-stage-muted">{t(nearExit ? "Press Space to return to town." : "Press Space to talk.")}</p>
          <TalkControl inline label={nearExit ? "Return to town" : "Talk"} canInteract={sceneReady && !busy}
            visible={true} onTalk={() => { if (nearExit) leaveHouse(); else interact(scene.place); }} />
        </>}
      </div> : <div className="pointer-events-auto w-full max-w-4xl">
        <DialogueFrame role={!finishedDialog ? "button" : undefined} tabIndex={!finishedDialog ? 0 : undefined}
          onClick={() => { if (!finishedDialog) interact(scene.place); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); interact(scene.place); } }}>
          {!finishedDialog && line ? <>
            <DialogueLine speaker={line.speaker}>{dialogue.typed}{!dialogue.settled && <span className="animate-pulse">|</span>}</DialogueLine>
            <p className="text-xs text-stage-muted">{dialogue.settled ? t("Space to continue") : t("Space to skip")}{" · "}{t("Tap to continue")}</p>
          </> : <>
            <DialogueLine speaker="ofelia">{t(session.step === "done" ? "Take your medal. You opened it the quantum way." : session.step === "welcome" ? "Come to the vault. I’ll show you how he answers." : "Your turn. Open the panel to complete this step.")}</DialogueLine>
            <button className="btn-primary self-start text-sm" onClick={() => interact(scene.place)}>
              {t(session.step === "welcome" ? "Show me →" : "Open panel")}
            </button>
          </>}
        </DialogueFrame>
      </div>}
    </div>}

    <LaptopShell restartControl={restartControl} closeDisabled={busy} open={sceneReady && laptopOpen} title={t(panelTitle)} status={busy ? "Asking the quantum core…" : "Quantum core ready"} onClose={() => setLaptopOpen(false)}
      footer={<p>{t("Close the panel to return to the study. Your progress is saved.")}</p>}
      memory={<div className="grid grid-cols-3 gap-3 text-sm"><div>{t("Night")}<br /><strong>{session.night}</strong></div>
        <div>{t("Candles left")}<br /><strong>{candlesLeft}/{CANDLES}</strong></div>
        <div>{t("Mask")}<br /><strong className="break-all">{session.revealed || session.step === "done" ? session.run?.measured : "?".repeat(BITS)}</strong></div></div>}
    >
      <section className="coin-workbench" aria-label={t(panelTitle)}>
        <div className="flex items-center justify-between gap-2"><h2>{t(panelTitle).toUpperCase()}</h2><span className="coin-badge">{t("25 tumblers")} · {formatCount(KEYSPACE)} {t("keys")}</span></div>
        {busy && <p role="status" className="my-4 text-accent-teal">{t("Asking the quantum core…")}</p>}
        {error && <p role="alert" className="my-4 text-actor-hacker">{t(error)}</p>}
        {!atPlace || !finishedDialog ? <p className="coin-placeholder">{t(!atPlace ? "Visit the highlighted location to open this step." : "Finish the conversation to unlock this step.")}</p> :
          <div className="mt-5 space-y-5">
            {session.step === "classical" && <CodeBoard candlesLeft={candlesLeft} questions={session.questions} tries={session.tries}
              last={session.last} busy={busy} onAsk={(x) => void ask(x)} onTryKey={(key) => void tryKey(key)} />}
            {session.step === "freeze" && <MidnightQuiz known={knownBits(session.questions).size} answer={session.quiz}
              onAnswer={(quiz) => patch({ quiz })} onContinue={() => void newNight("groverWire")} />}
            {session.step === "lucky" && <>
              <p className="coin-callout">{t("You’re lucky! But luck isn’t a method.")}</p>
              <p>{t("That key had a 1 in 33,554,432 chance per try. The door slammed and the lock re-keyed; this time, use the quantum core.")}</p>
              {action("Solve it with quantum →", () => void newNight("groverWire"))}
            </>}
            {session.step === "groverWire" && <>
              <p>{t("Rebuild the workshop search: H on the register, then the Oracle and the Diffuser inside the repeat box.")}</p>
              <GroverTrapBuilder slots={session.trap} onChange={(trap) => patch({ trap })} repeatLabel="?" locked={false} />
              <p className={trapReady(session.trap) ? "coin-callout" : "text-accent-amber"}>{t(trapHint(session.trap))}</p>
              {trapReady(session.trap) && action("How many rounds? To the table →", () => next("groverBoard"))}
            </>}
            {session.step === "groverBoard" && <>
              <p>{t("For N possible keys and one right one, Grover needs about π/4 · √N rounds. Fill the boxes one at a time.")}</p>
              {!session.boardSolved ? <StepFormula spec={BOARD} value={session.board} chipOrder={session.variants.board}
                onChange={(board) => patch({ board })} onSolved={() => { patch({ boardSolved: true }); gameAudio.playSfx("confirm"); }} />
                : <>
                  <p className="vault-formula solved">R ≈ π/4 · √33,554,432 = π/4 · 5,792.6 ≈ 4,549 {t("rounds")}</p>
                  <p className="coin-callout">{t("Each round asks the ghost once. 4,549 questions — and three candles a night.")}</p>
                  {action("Back to the laptop →", () => next("groverRun"))}
                </>}
            </>}
            {session.step === "groverRun" && <>
              <GroverTrapBuilder slots={session.trap} onChange={() => undefined} repeatLabel={formatCount(4549)} locked={true} />
              <GroverClockRun finished={session.groverDone} runKey={session.groverRunKey} disabled={busy}
                onRun={() => patch({ groverRunKey: session.groverRunKey + 1 })} onFinished={() => patch({ groverDone: true, candles: CANDLES })} />
              {session.groverDone && <>
                <p>{t("Grover is √N: a huge win for sixteen PINs, but √(33 million) is still thousands of questions. Squaring down isn’t enough here.")}</p>
                {action("Midnight: the lock re-keys →", () => { gameAudio.playSynth("cold"); gameAudio.playSynth("toll"); void newNight("diagnostics"); })}
              </>}
            </>}
            {session.step === "diagnostics" && <>
              <ManualScan scanned={session.scanned} parityHint={session.sawParity}
                onScan={() => { gameAudio.playSfx("computer"); patch({ scanned: true }); }} />
              {session.scanned && action("Follow one tumbler · to the table →", () => next("ledger"))}
            </>}
            {session.step === "ledger" && <>
              <p>{t("Follow one tumbler’s qubit through the circuit, for both values of its secret bit sᵢ. Fill the boxes one at a time.")}</p>
              {!session.ledgerSolved ? <StepFormula spec={LEDGER} value={session.ledger} chipOrder={session.variants.ledger}
                onChange={(ledger) => patch({ ledger })} onSolved={() => { patch({ ledgerSolved: true }); gameAudio.playSynth("glow"); }} />
                : <>
                  <p className="vault-formula solved">sᵢ = 0: |0⟩ → |+⟩ → |+⟩ → |0⟩ · sᵢ = 1: |0⟩ → |+⟩ → |−⟩ → |1⟩</p>
                  <p className="coin-callout">{t("The ghost only ever flips the helper. But flip a |−⟩ and all you get is a minus sign, and that sign kicks back onto the tumbler’s qubit. You can’t measure a sign: it’s the real ghost. Until H turns it into a 0 or a 1.")}</p>
                  <p>{t("Each tumbler keeps its own sign. Twenty-five tumblers, twenty-five signs, one question.")}</p>
                  {action("Build the circuit →", () => next("bvWire"))}
                </>}
            </>}
            {(session.step === "bvWire" || session.step === "execute") && <>
              {session.step === "bvWire" && <p>{t("Build the one-question circuit from boxes. The Oracle is the vault itself: it stays sealed in the middle.")}</p>}
              <BvCircuitBuilder slots={session.bv} onChange={(bv) => patch({ bv })} locked={session.step === "execute"} />
              {session.step === "bvWire" && <>
                <p className={problem ? "text-accent-amber" : "coin-callout"}>{t(bvHint(session.bv))}</p>
                {!problem && action("Wiring checks out →", () => next("execute"))}
              </>}
              {session.step === "execute" && <>
                <MaskRegister run={session.run} runKey={session.runKey} onDone={() => patch({ revealed: true })} />
                {message && <p role="status" className="text-accent-amber">{t(message)}</p>}
                <div className="grover-actions">
                  {!session.run && <button className="btn-primary" disabled={busy || !!problem || candlesLeft <= 0} onClick={() => void execute()}>
                    {t("Execute (1 Query)")}</button>}
                  {session.run && session.revealed && action("Take the mask to the vault →", () => next("unlock"))}
                </div>
                {session.run && <p className="text-sm text-stage-muted">{t("Candles used: 1 of 3. The whole mask resolved in one clock cycle.")}</p>}
              </>}
            </>}
            {session.step === "unlock" && session.run && <>
              <p>{t("Drag the mask onto the tumblers, or tap Set the tumblers. Opening the door is not a question: no candle is used.")}</p>
              <UnlockPad mask={session.run.measured} disabled={busy} onSend={() => void unlock()} />
            </>}
            {session.step === "done" && <>
              <div className="coin-achievement" aria-live="polite"><span>{t("OPERATION GHOST KEY")}</span><h2>{t("The vault is open!")}</h2>
                <p>{t("Mask")} <strong className="grover-pin break-all">{session.run?.measured}</strong></p></div>
              <ComparisonCard />
              <p className="coin-callout">{t("Unstructured search is quadratically bounded (Grover). Algebraic structure unlocks exponential acceleration (Bernstein–Vazirani).")}</p>
              <p>{t("There was no ghost. The only invisible thing in the house was the phase.")}</p>
              <MedalReveal id="ghost-key" />
              <button className="btn-primary inline-block" onClick={leaveHouse}>{t("Return to town →")}</button>
              <button className="btn-ghost block" onClick={restartLesson}>{t("Replay the whole lesson")}</button>
            </>}
          </div>}
      </section>
    </LaptopShell>
  </GameShell>;
}
