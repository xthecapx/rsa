"use client";
import { t, localize, useLocale } from "@/i18n";

import { useEffect, useRef, useState } from "react";
import { GROVER_SCENES, GROVER_STEPS, type GroverPlace, type GroverStep } from "@/content/grover";
import { groverApi, GroverRefusal, tallest, type GroverRun } from "@/lib/grover";
import { useProgress } from "@/game/progress";
import { useMedals } from "@/game/medals";
import { MedalReveal } from "./MedalCase";
import type { Task } from "@/game/state";
import { gameAudio } from "@/game/audio";
import { StartOverControl, type RestartOption } from "./StartOverControl";
import { GroverHouse } from "./GroverHouse";
import { GameShell } from "./GameShell";
import { MissionObjectives } from "./ObjectiveList";
import { DialogueFrame, DialogueLine, useDialogueText } from "./DialoguePresentation";
import { useGroverSceneAssets } from "./useSceneAssets";
import { TalkControl } from "./TouchControls";
import { LaptopShell } from "./LaptopShell";
import {
  ALL_PIECES, CHIPS, EMPTY_FORMULA, EMPTY_SLOTS, TRIES, DisarmPad, GroverCircuitBuilder, Keypad, QuantumEqualizer, RoundsFormula, SearchGrid,
  blockOf, isSearch, loopOf, type ChipId, type CircuitSlots, type FormulaSlots, type PieceId,
} from "./GroverChallenges";

export const GROVER_SAVE_KEY = "quantum-grover-session-v1";
const PLACES: GroverPlace[] = ["core", "desk", "board"];
const DESK_STEPS: GroverStep[] = ["init", "loop", "tuneRun", "measure"];
const percent = (p: number) => t(`${(p * 100).toFixed(1)}%`);

function shuffle<T,>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
const sameItems = <T,>(value: unknown, expected: T[]): value is T[] =>
  Array.isArray(value) && value.length === expected.length && expected.every((item) => value.includes(item));

interface Session {
  step: GroverStep; line: number; place: GroverPlace;
  token: string | null; tried: string[]; lucky: boolean;
  slots: CircuitSlots; repeat: number; lastRun: GroverRun | null; runKey: number;
  /** Tallest bar per repeat count, for full searches only. */
  peaks: Record<string, number>;
  formula: FormulaSlots; boardSolved: boolean;
  measured: string | null; misses: number; notice: string | null;
  variants: { pieces: PieceId[]; chips: ChipId[] };
}
const INITIAL: Session = {
  step: "welcome", line: 0, place: "core", token: null, tried: [], lucky: false,
  slots: EMPTY_SLOTS, repeat: 1, lastRun: null, runKey: 0, peaks: {},
  formula: EMPTY_FORMULA, boardSolved: false, measured: null, misses: 0, notice: null,
  variants: { pieces: ALL_PIECES, chips: CHIPS },
};
const fresh = (): Session => ({ ...INITIAL, slots: { ...EMPTY_SLOTS }, formula: { ...EMPTY_FORMULA }, variants: { pieces: shuffle(ALL_PIECES), chips: shuffle(CHIPS) } });

function restoreSession(saved: Partial<Session>): Session {
  const base = fresh();
  return {
    ...base, ...saved,
    slots: { ...EMPTY_SLOTS, ...saved.slots }, formula: { ...EMPTY_FORMULA, ...saved.formula },
    tried: Array.isArray(saved.tried) ? saved.tried.filter((pin) => /^[01]{4}$/.test(pin)).slice(0, TRIES) : [],
    repeat: Number.isInteger(saved.repeat) && saved.repeat! >= 0 && saved.repeat! <= 5 ? saved.repeat! : 1,
    peaks: saved.peaks && typeof saved.peaks === "object" ? saved.peaks : {},
    variants: {
      pieces: sameItems(saved.variants?.pieces, ALL_PIECES) ? saved.variants!.pieces : base.variants.pieces,
      chips: sameItems(saved.variants?.chips, CHIPS) ? saved.variants!.chips : base.variants.chips,
    },
  };
}

/** Which pieces the tray offers at each desk step. */
function trayFor(step: GroverStep, order: PieceId[]): PieceId[] {
  const allowed: PieceId[] = step === "init" ? ["h", "x"] : step === "measure" ? ALL_PIECES : ALL_PIECES.filter((id) => id !== "m");
  return order.filter((id) => allowed.includes(id));
}

function loopHint(slots: CircuitSlots): string {
  const loop = loopOf(slots);
  if (blockOf(slots.init) !== "h") return "Start from the H box: without it the register is a single PIN, not all sixteen.";
  if (loop.includes("h") || loop.includes("x")) return "That extra box scrambles the register. A round needs only the Oracle and the Diffuser.";
  if (!loop.includes("oracle")) return "Without the Oracle nothing marks the PIN, so nothing can grow.";
  if (!loop.includes("diffuser")) return "The Oracle flipped a sign, but the bars are just as tall. The Diffuser turns the flip into a taller bar.";
  if (loop[0] === "diffuser") return "The Diffuser reflects about the average, but nothing was flipped yet. Let the Oracle mark the PIN first.";
  return "Put the Oracle first and the Diffuser second.";
}

function countHint(repeat: number): string {
  if (repeat === 0) return "Zero rounds: no questions to the lock, just the flat spread of H.";
  if (repeat < 3) return "Still climbing. Another round makes the tallest bar taller.";
  if (repeat === 3) return "The peak: about 96%. The board said three rounds.";
  return "Over-rotation! Grover is a rotation — keep turning and you point away again.";
}

export function GroverScenario({ onExit, onRestartGame }: { onExit?: () => void; onRestartGame?: () => void }) {
  useLocale((state) => state.locale);
  const assetStatus = useGroverSceneAssets();
  const [session, setSession] = useState<Session>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [laptopOpen, setLaptopOpen] = useState(false);
  const [activePlace, setActivePlace] = useState<GroverPlace | null>(null);
  const [roomKey, setRoomKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const [nearbyPlace, setNearbyPlace] = useState<GroverPlace | null>(null);
  const [walking, setWalking] = useState(false);
  const [nearExit, setNearExit] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);

  const sceneReady = hydrated && assetStatus === "ready";
  const scene = GROVER_SCENES[session.step];
  const atPlace = activePlace === scene.place;
  const finishedDialog = session.line >= scene.lines.length;
  const index = GROVER_STEPS.indexOf(session.step);
  const line = scene.lines[session.line];
  const dialogue = useDialogueText(sceneReady && atPlace && !laptopOpen && line ? t(line.text) : "");
  const lastPeak = session.lastRun ? tallest(session.lastRun.steps.at(-1)!.amplitudes) : 0;

  useEffect(() => {
    alive.current = true;
    void gameAudio.playMusic("play");
    void useProgress.persist.rehydrate(); void useMedals.persist.rehydrate();
    try {
      const saved = JSON.parse(localStorage.getItem(GROVER_SAVE_KEY) ?? "null");
      if (saved && GROVER_STEPS.includes(saved.step) && PLACES.includes(saved.place)
        && Number.isInteger(saved.line) && saved.line >= 0) setSession(restoreSession(saved));
      else setSession(fresh());
    } catch { setSession(fresh()); }
    setHydrated(true);
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(GROVER_SAVE_KEY, JSON.stringify(session)); }
    catch { setStorageNote(true); }
    if (session.step === "done") useProgress.getState().complete("grover", "grover");
  }, [session, hydrated]);

  useEffect(() => {
    if (sceneReady && atPlace && finishedDialog && session.step !== "welcome") setLaptopOpen(true);
  }, [sceneReady, atPlace, finishedDialog, session.step]);

  function interact(place: GroverPlace) {
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
  function next(step: GroverStep, values: Partial<Session> = {}) {
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
      if (e instanceof GroverRefusal) {
        gameAudio.playSfx("error");
        setMessage(e.reason === "rounds" ? "Thecap: not at this count. The board said how many rounds make the tallest bar peak." : "Thecap: the core only collapses the full search: H, then the Oracle and the Diffuser in the repeat box, then M.");
      } else setError(e instanceof Error ? e.message : "The quantum core did not answer. Try again.");
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const token = async () => session.token ?? (await groverApi.device()).token;

  const query = (pin: string) => run(async () => {
    const device = await token();
    const { match } = await groverApi.query(device, pin);
    const tried = [...session.tried, pin];
    if (match) { gameAudio.playSfx("confirm"); return { token: device, tried, lucky: true, step: "lucky", line: 0 }; }
    gameAudio.playSfx("error");
    if (tried.length >= TRIES) { gameAudio.playSynth("alarm"); return { token: device, tried, step: "overload", line: 0 }; }
    return { token: device, tried };
  });

  const execute = (repeat: number, measure = false) => run(async () => {
    const device = await token();
    const init = blockOf(session.slots.init) === "h" ? "h" : null;
    const loop = session.step === "init" ? [] : loopOf(session.slots);
    const result = await groverApi.run(device, { init, loop, repeat: session.step === "init" ? 0 : repeat, measure });
    gameAudio.playSfx("computer");
    const peak = tallest(result.steps.at(-1)!.amplitudes);
    const peaks = isSearch(session.slots) && session.step !== "init" ? { ...session.peaks, [repeat]: peak } : session.peaks;
    return { token: device, lastRun: result, runKey: session.runKey + 1, peaks, measured: result.measured ?? session.measured, notice: null };
  });

  const disarm = () => run(async () => {
    if (!session.token || !session.measured) return {};
    const { match } = await groverApi.query(session.token, session.measured);
    if (match) return { step: "done", line: 0, notice: null };
    gameAudio.playSfx("error");
    return {
      step: "measure", line: GROVER_SCENES.measure.lines.length, place: "core", measured: null, lastRun: null, misses: session.misses + 1,
      notice: "Grover is probabilistic — 96%, not 100%. Measure again.",
    };
  });

  const action = (label: string, onClick: () => void, disabled = false) => (
    <button className="btn-primary" disabled={busy || disabled} onClick={onClick}>{t(label)}</button>
  );

  function leaveHouse() {
    if (inFlight.current || !hydrated) return;
    try { localStorage.setItem(GROVER_SAVE_KEY, JSON.stringify(session)); } catch { setStorageNote(true); }
    gameAudio.playSfx("switch");
    if (onExit) onExit(); else window.location.assign("/");
  }
  function restartLesson() {
    if (inFlight.current || !hydrated) return;
    const start = fresh();
    try { localStorage.setItem(GROVER_SAVE_KEY, JSON.stringify(start)); } catch { setStorageNote(true); }
    useProgress.getState().reset("grover", "grover");
    setLaptopOpen(false); setActivePlace(null); setNearbyPlace(null); setNearExit(false); setMessage(null);
    setRoomKey((key) => key + 1); setSession(start); setError(null);
    gameAudio.playSfx("confirm");
  }
  const restartOptions: RestartOption[] = [
    { label: "Restart this lesson", description: "Clear Echo Chamber: a new PIN, an empty circuit, and no completion. Start inside the workshop.", restart: restartLesson },
    ...(onRestartGame ? [{ label: "Start the whole game over", description: "Clear every lesson and town progress. Return to Mayor Cap’s welcome in Coin Town.", restart: onRestartGame }] : []),
  ];
  const restartControl = <StartOverControl options={restartOptions} disabled={busy || !sceneReady} onOpenChange={setRestartOpen} />;
  const skipped: GroverStep = session.lucky ? "overload" : "lucky";
  const objectives = <MissionObjectives tasks={GROVER_STEPS.filter((step) => step !== skipped).map((step): Task => ({
    id: step, label: GROVER_SCENES[step].title,
    status: GROVER_STEPS.indexOf(step) < index || session.step === "done" ? "done" : step === session.step ? "active" : "pending",
  }))} />;
  const circuitText = () => {
    const name = (id: PieceId | null) => id ? (blockOf(id) === "h" ? "H" : id === "m" ? "M" : id === "x" ? "X" : id === "oracle" ? "Oracle" : "Diffuser") : "□";
    if (session.step === "init") return `|0000⟩ → ${name(session.slots.init)}`;
    return `${name(session.slots.init)} → [${name(session.slots.loop0)} → ${name(session.slots.loop1)}]×${session.repeat}${session.step === "measure" || session.measured ? ` → ${name(session.slots.measure)}` : ""}`;
  };
  const sidebar = <>
    {objectives}
    <div className="panel p-4 space-y-3 text-sm leading-relaxed">
      <p className="text-accent-teal">{t("EMERGENCY · THECAP’S WORKSHOP")}</p>
      <p>{t(scene.objective)}</p>
      <p className="text-stage-muted">{t("Classical tries")}: {session.tried.length}/{TRIES}</p>
      {storageNote && <p role="status">{t("Browser storage is unavailable. Progress will last for this visit only.")}</p>}
    </div>
  </>;
  const core = session.step === "done" ? "safe" : session.step === "overload" || index > GROVER_STEPS.indexOf("lucky") ? "locked" : "armed";
  const deskStep = DESK_STEPS.includes(session.step);
  const panelTitle = scene.place === "desk" ? "Quantum core" : scene.place === "board" ? "Whiteboard" : "Drone core";

  return <GameShell restartControl={restartControl} title={t("Echo Chamber")} subtitle={t(scene.title)} backHref="/" backLabel={t("Return to town")} onBack={leaveHouse} backDisabled={busy || !sceneReady} onObjectivesOpen={setJournalOpen}
    sceneReady={sceneReady} sceneFailed={assetStatus === "error"}
    sidebar={sidebar} objectives={objectives} laptopOpen={laptopOpen} laptopReady={atPlace && finishedDialog}
    onOpenLaptop={() => { if (sceneReady) setLaptopOpen(true); }}>
    <div className="coin-world">
      {sceneReady && <GroverHouse key={roomKey} initialPlace={session.step === "welcome" ? null : session.place} target={scene.place} core={core}
        disabled={busy || laptopOpen || journalOpen || restartOpen} movementLocked={atPlace && !finishedDialog}
        onNear={(place) => { setNearbyPlace(place); setActivePlace((active) => active === place ? active : null); }}
        onWalking={setWalking} onInteract={interact} onExit={leaveHouse} onNearExit={setNearExit} />}
    </div>
    {!laptopOpen && !journalOpen && !restartOpen && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {!atPlace ? <div className={`textbox max-w-lg px-4 py-3 text-center transition-opacity ${walking ? "opacity-20" : ""}`}>
        {session.notice && <p className="mb-2 text-sm text-accent-amber">{t(session.notice)}</p>}
        <p className="text-sm leading-relaxed">{t(scene.objective)}</p>
        <p className="mt-2 text-xs text-accent-amber">{nearExit ? t("Leave the workshop and return to Quantum Town. Your lesson is saved.") : nearbyPlace === scene.place ? t("Use Talk to interact.") : t("Walk to the glowing marker.")}</p>
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
            <DialogueLine speaker="guide">{t(session.step === "done" ? "The core is safe. Take your medal — you earned it the quantum way." : session.step === "welcome" ? "The keypad is yours. Three tries." : "Your turn. Open the panel to complete this step.")}</DialogueLine>
            <button className="btn-primary self-start text-sm" onClick={() => interact(scene.place)}>
              {t(session.step === "welcome" ? "Try the keypad →" : "Open panel")}
            </button>
          </>}
        </DialogueFrame>
      </div>}
    </div>}

    <LaptopShell restartControl={restartControl} closeDisabled={busy} open={sceneReady && laptopOpen} title={t(panelTitle)} status={busy ? "Asking the quantum core…" : "Quantum core ready"} onClose={() => setLaptopOpen(false)}
      footer={<p>{t("Close the panel to return to the workshop. Your progress is saved.")}</p>}
      memory={<div className="grid grid-cols-3 gap-3 text-sm"><div>{t("Classical tries")}<br /><strong>{session.tried.length}/{TRIES}</strong></div>
        <div>{t("Circuit")}<br /><strong>{index >= GROVER_STEPS.indexOf("init") ? circuitText() : "—"}</strong></div>
        <div>{t("PIN")}<br /><strong>{session.step === "done" ? session.measured : "????"}</strong></div></div>}
    >
      <section className="coin-workbench" aria-label={t(panelTitle)}>
        <div className="flex items-center justify-between gap-2"><h2>{t(panelTitle).toUpperCase()}</h2><span className="coin-badge">{t("4 qubits · 16 possible PINs")}</span></div>
        {busy && <p role="status" className="my-4 text-accent-teal">{t("Asking the quantum core…")}</p>}
        {error && <p role="alert" className="my-4 text-actor-hacker">{t(error)}</p>}
        {!atPlace || !finishedDialog ? <p className="coin-placeholder">{t(!atPlace ? "Visit the highlighted location to open this step." : "Finish the conversation to unlock this step.")}</p> :
          <div className="mt-5 space-y-5">
            {session.step === "classical" && <>
              <p>{t("The lock answers yes or no. Flip the switches to a PIN and query it. Each query drains one battery cell.")}</p>
              <Keypad tried={session.tried} disabled={busy} onQuery={(pin) => void query(pin)} />
              <SearchGrid tried={session.tried} />
              {session.tried.length > 0 && <p className="text-accent-amber">{t("No. The lock gives no hint about how close you were.")}</p>}
            </>}
            {session.step === "overload" && <>
              <p className="coin-callout grover-alert" role="alert">⚠ {t("Unstructured search space too large for classical trial-and-error under emergency constraints. Switch to Quantum Core.")}</p>
              <SearchGrid tried={session.tried} />
              <p>{t("Three questions by hand found the PIN with probability 3/16 = 18.75%.")}</p>
              {action("Route to the laptop →", () => next("init"))}
            </>}
            {session.step === "lucky" && <>
              <p className="coin-callout">{t("You’re lucky! But luck isn’t a method.")}</p>
              <SearchGrid tried={session.tried} />
              <p>{t("That was a 3/16 = 18.75% chance. The core armed a backup cipher with a new PIN; this time, use the quantum core.")}</p>
              {action("Solve it with quantum →", () => void run(async () => {
                const { token: backup } = await groverApi.device(session.token ?? undefined);
                return { token: backup, step: "init", line: 0 };
              }))}
            </>}
            {deskStep && <>
              {session.notice && <p className="coin-callout" role="status">{t(session.notice)}</p>}
              {session.step === "init" && <p>{t("Drag the H box onto the register, then run it. Watch how many bars appear.")}</p>}
              {session.step === "loop" && <p>{t("Drag the Oracle and the Diffuser into the repeat box, in the order they act, and run one round.")}</p>}
              {session.step === "tuneRun" && <p>{t("Use − and + on the repeat box. Run any count and compare the tallest bar.")}</p>}
              {session.step === "measure" && <p>{t("Drag M to the end of the circuit and collapse it. One shot.")}</p>}
              <GroverCircuitBuilder slots={session.slots} onChange={(slots) => patch({ slots })}
                tray={trayFor(session.step, session.variants.pieces)} showLoop={session.step !== "init"} showMeasure={session.step === "measure"}
                repeat={session.step === "loop" ? 1 : session.repeat}
                onRepeat={session.step === "tuneRun" || session.step === "measure" ? (repeat) => patch({ repeat }) : null} />
              <QuantumEqualizer run={session.lastRun} runKey={session.runKey} animate={true} />

              {session.step === "init" && session.lastRun && (session.lastRun.steps.at(-1)!.block === "h"
                ? <p className="coin-callout">{t("Sixteen flat bars, each 1/16 = 6.25%. Every PIN is in play at once — but a measurement now is still a blind guess.")}</p>
                : <p className="text-accent-amber">{t("One bar holds everything: the register is still |0000⟩. Add H.")}</p>)}
              {session.step === "loop" && session.lastRun && (isSearch(session.slots)
                ? <p className="coin-callout">{t("One round, one question to the lock: the tallest bar reached")} {percent(lastPeak)}.</p>
                : <p className="text-accent-amber">{t(loopHint(session.slots))}</p>)}
              {session.step === "tuneRun" && <>
                <table className="w-full text-left"><caption className="mb-2 text-left text-stage-muted">{t("Your runs · tallest bar")}</caption>
                  <thead><tr>{[0, 1, 2, 3, 4, 5].map((k) => <th key={k}>×{k}</th>)}</tr></thead>
                  <tbody><tr>{[0, 1, 2, 3, 4, 5].map((k) => <td key={k}>{session.peaks[k] === undefined ? "—" : percent(session.peaks[k])}</td>)}</tr></tbody></table>
                {session.lastRun && !isSearch(session.slots) && <p className="text-accent-amber">{t(loopHint(session.slots))}</p>}
                {session.lastRun && isSearch(session.slots) && <p className={session.repeat > 3 ? "coin-callout" : "text-accent-amber"}>{t(countHint(session.lastRun.steps.at(-1)!.round))}</p>}
              </>}
              {session.step === "measure" && session.measured && <p className="coin-callout">{t("The core collapsed to one PIN")}: <strong className="grover-pin">{session.measured}</strong></p>}
              {message && <p role="status" className="text-accent-amber">{t(message)}</p>}

              {/* Run and the next step share one row, below the bars. */}
              <div className="grover-actions">
                {session.step !== "measure" && <button className="btn-primary" disabled={busy} onClick={() => void execute(session.step === "loop" ? 1 : session.repeat)}>
                  {t("Run")}{session.step === "init" ? "" : ` ×${session.step === "loop" ? 1 : session.repeat}`}</button>}
                {session.step === "measure" && !session.measured && <button className="btn-primary" disabled={busy || !session.slots.measure}
                  onClick={() => void execute(session.repeat, true)}>
                  {!session.slots.measure ? t("Place M first") : session.repeat !== 3 ? t("Thecap: not at this count") : t("Collapse")}
                </button>}
                {session.step === "init" && session.lastRun?.steps.at(-1)!.block === "h" && action("Continue →", () => next("loop", { lastRun: null }))}
                {session.step === "loop" && session.lastRun && isSearch(session.slots) && action("How many rounds? To the whiteboard →", () => next("tune"))}
                {session.step === "tuneRun" && session.peaks[3] !== undefined && action("Measure at ×3 →", () => next("measure", { repeat: 3 }))}
                {session.step === "measure" && session.measured && action("Take the PIN to the core →", () => next("disarm"))}
              </div>
            </>}
            {session.step === "tune" && <>
              <p>{t("For N possible answers and one right one, Grover needs about π/4 · √N rounds. Fill the boxes one at a time.")}</p>
              {!session.boardSolved ? <RoundsFormula slots={session.formula} order={session.variants.chips}
                onChange={(formula) => patch({ formula })}
                onSolved={() => { patch({ boardSolved: true }); gameAudio.playSfx("confirm"); }} />
                : <><p className="grover-formula solved">R ≈ π/4 · √16 = π/4 · 4 ≈ {localize("3.14")} → 3 {t("rounds")}</p>
                  <p className="coin-callout">{t("Three rounds means three questions to the lock — the same budget you just burned by hand.")}</p>
                  {action("Back to the laptop →", () => next("tuneRun", { repeat: 1 }))}</>}
            </>}
            {session.step === "disarm" && session.measured && <>
              <p>{t("Drag the measured PIN into the keypad, or tap Send PIN. This check is free: no battery cell is used.")}</p>
              <DisarmPad pin={session.measured} disabled={busy} onSend={() => void disarm()} />
            </>}
            {session.step === "done" && <>
              <div className="coin-achievement" aria-live="polite"><span>{t("ECHO CHAMBER")}</span><h2>{t("Core disarmed!")}</h2>
                <p>{t("PIN")} <strong className="grover-pin">{session.measured}</strong>{session.misses > 0 && <> · {t("measured")} {session.misses + 1}×</>}</p></div>
              <div className="grover-compare">
                <div><span>{t("3 classical questions")}</span><strong>{localize("18.75%")}</strong></div>
                <div><span>{t("3 quantum questions")}</span><strong>{localize("96.1%")}</strong></div>
              </div>
              <p>{t("That is the √N speed-up: a million PINs would take about 785 rounds instead of up to a million tries.")}</p>
              <MedalReveal id="amplifier" />
              <button className="btn-primary inline-block" onClick={leaveHouse}>{t("Return to town →")}</button>
              <button className="btn-ghost block" onClick={restartLesson}>{t("Replay the whole lesson")}</button>
            </>}
          </div>}
      </section>
    </LaptopShell>
  </GameShell>;
}
