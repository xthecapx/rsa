"use client";

import { useEffect, useRef, useState } from "react";
import { PuzzleDragDrop, PuzzlePiece, PuzzleSlot } from "./PuzzleDragDrop";
import { gameAudio } from "@/game/audio";
import { tallest, type GroverBlock, type GroverRun } from "@/lib/grover";
import { t, useLocale } from "@/i18n";

export const PINS = Array.from({ length: 16 }, (_, i) => i.toString(2).padStart(4, "0"));
export const TRIES = 3;
const percent = (p: number) => t(`${(p * 100).toFixed(p < 0.1 ? 2 : 1)}%`);

/** Four bit switches and a Query button; each PIN can be asked only once. */
export function Keypad({ tried, disabled, onQuery }: { tried: string[]; disabled: boolean; onQuery: (pin: string) => void }) {
  useLocale((state) => state.locale);
  const [bits, setBits] = useState([0, 0, 0, 0]);
  const pin = bits.join("");
  const left = TRIES - tried.length;
  const repeat = tried.includes(pin);
  return <div className="grover-keypad space-y-3">
    <div className="grover-battery" role="img" aria-label={`${t("Battery")}: ${left}/${TRIES}`}>
      <span>{t("Battery")}</span>
      {Array.from({ length: TRIES }, (_, i) => <span key={i} className={`grover-cell ${i < left ? "full" : ""}`} aria-hidden="true" />)}
    </div>
    <div className="grover-switches" role="group" aria-label={t("PIN switches")}>
      {bits.map((bit, i) => <button key={i} type="button" className={`grover-switch ${bit ? "on" : ""}`} disabled={disabled}
        aria-label={`${t("Switch")} ${i + 1}: ${bit}`} aria-pressed={!!bit}
        onClick={() => { gameAudio.playSfx("switch"); setBits((b) => b.map((v, j) => j === i ? 1 - v : v)); }}>
        <span className="grover-switch-knob" aria-hidden="true" /><strong>{bit}</strong>
      </button>)}
    </div>
    <button className="btn-primary" disabled={disabled || repeat || left <= 0} onClick={() => onQuery(pin)}>
      {repeat ? t("Already tried") : `${t("Query lock")} · ${pin}`}
    </button>
  </div>;
}

/** All sixteen PINs, with the classical tries crossed off. */
export function SearchGrid({ tried }: { tried: string[] }) {
  useLocale((state) => state.locale);
  return <div className="space-y-2">
    <div className="grover-grid" role="list" aria-label={t("Search space: 16 PINs")}>
      {PINS.map((pin) => <span key={pin} role="listitem" className={tried.includes(pin) ? "tried" : ""}
        aria-label={`${pin}${tried.includes(pin) ? `, ${t("tried")}` : ""}`}>{pin}</span>)}
    </div>
    <p className="grover-math">P = {tried.length}/16 = {percent(tried.length / 16)}</p>
  </div>;
}

export type PieceId = "h" | "h2" | "oracle" | "diffuser" | "x" | "m";
export type CircuitSlot = "init" | "loop0" | "loop1" | "measure";
export type CircuitSlots = Record<CircuitSlot, PieceId | null>;
export const EMPTY_SLOTS: CircuitSlots = { init: null, loop0: null, loop1: null, measure: null };
export const ALL_PIECES: PieceId[] = ["h", "oracle", "diffuser", "x", "h2", "m"];
const PIECE_NAMES: Record<PieceId, string> = { h: "H", h2: "H", oracle: "Oracle", diffuser: "Diffuser", x: "X", m: "M" };
const PIECE_HELP: Record<PieceId, string> = {
  h: "H on all four qubits", h2: "H on all four qubits", oracle: "Oracle · sealed black box",
  diffuser: "Diffuser · reflect about the mean", x: "X on all four qubits", m: "M · measure all four qubits",
};
const SLOT_NAMES: Record<CircuitSlot, string> = {
  init: "Prepare the register", loop0: "Repeat box · first", loop1: "Repeat box · second", measure: "Measure",
};

export function blockOf(piece: PieceId | null): GroverBlock | null {
  if (piece === "h" || piece === "h2") return "h";
  return piece === "oracle" || piece === "diffuser" || piece === "x" ? piece : null;
}
export function loopOf(slots: CircuitSlots): GroverBlock[] {
  return [slots.loop0, slots.loop1].map(blockOf).filter((b): b is GroverBlock => b !== null);
}
export function isSearch(slots: CircuitSlots) {
  const loop = loopOf(slots);
  return blockOf(slots.init) === "h" && loop.length === 2 && loop[0] === "oracle" && loop[1] === "diffuser";
}

function Piece({ id }: { id: PieceId }) {
  useLocale((state) => state.locale);
  return <span className={`grover-box ${id === "h2" ? "h" : id}`}>{id === "oracle" ? <>⬛ {t("Oracle")}</> : t(PIECE_NAMES[id])}</span>;
}

/** One box per block, each spanning all four qubits, with the repeat box in the middle. */
export function GroverCircuitBuilder({ slots, onChange, tray, showLoop, showMeasure, repeat, onRepeat }: {
  slots: CircuitSlots; onChange: (slots: CircuitSlots) => void; tray: PieceId[];
  showLoop: boolean; showMeasure: boolean; repeat: number; onRepeat: ((repeat: number) => void) | null;
}) {
  useLocale((state) => state.locale);
  const [selected, setSelected] = useState<PieceId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  function place(slot: CircuitSlot, piece = selected) {
    if (!piece) return;
    if (slot === "measure" && piece !== "m") { setMessage("Only M goes at the end: it reads all four qubits."); return; }
    if (slot !== "measure" && piece === "m") { setMessage("Measure last. M belongs after the repeat box."); return; }
    if (slot === "init" && blockOf(piece) !== "h" && piece !== "x") { setMessage("Prepare the register first; the Oracle and Diffuser belong in the repeat box."); return; }
    const next = { ...slots };
    for (const key of Object.keys(next) as CircuitSlot[]) if (next[key] === piece) next[key] = null;
    next[slot] = piece;
    gameAudio.playSfx("select");
    onChange(next); setSelected(null); setMessage(null);
  }
  const slotsShown: CircuitSlot[] = ["init", ...(showLoop ? ["loop0", "loop1"] as const : []), ...(showMeasure ? ["measure"] as const : [])];
  const labels = Object.fromEntries(tray.map((id) => [id, t(PIECE_HELP[id])]));
  const targets = Object.fromEntries(slotsShown.map((slot) => [slot, t(SLOT_NAMES[slot])]));
  const slot = (id: CircuitSlot, index: number) => <PuzzleSlot id={id} className={`grover-slot ${slots[id] ? "filled" : ""}`}
    onSelect={() => place(id)} label={`${t(SLOT_NAMES[id])}: ${slots[id] ? t(PIECE_HELP[slots[id]]) : t("Empty")}`}>
    {slots[id] ? <Piece id={slots[id]} /> : <span className="grover-empty">{index}</span>}
  </PuzzleSlot>;
  return <PuzzleDragDrop labels={labels} targets={targets} onPlace={(target, source) => place(target as CircuitSlot, source as PieceId)}
    renderPreview={(id) => <Piece id={id as PieceId} />}>
    <div className="coin-challenge space-y-3">
      <div className="coin-block-tray" aria-label={t("Circuit boxes")}>
        {tray.map((id) => <PuzzlePiece key={id} id={id} label={t(PIECE_HELP[id])} selected={selected === id}
          className="grover-piece" onSelect={() => setSelected(id)}><Piece id={id} /></PuzzlePiece>)}
      </div>
      <div className="grover-circuit" role="group" aria-label={t("Four-qubit circuit")}>
        <div className="grover-register" aria-hidden="true">{[3, 2, 1, 0].map((q) => <span key={q}>q{q} <small>|0⟩</small></span>)}</div>
        <div className="grover-track">
          {slot("init", 1)}
          {showLoop && <div className="grover-repeat">
            <div className="grover-repeat-head">
              <span>{t("Repeat")}</span>
              <button type="button" className="grover-count" disabled={!onRepeat || repeat <= 0} aria-label={t("One round fewer")}
                onClick={() => { gameAudio.playSfx("click"); onRepeat?.(repeat - 1); }}>−</button>
              <strong aria-live="polite">×{repeat}</strong>
              <button type="button" className="grover-count" disabled={!onRepeat || repeat >= 5} aria-label={t("One round more")}
                onClick={() => { gameAudio.playSfx("click"); onRepeat?.(repeat + 1); }}>+</button>
            </div>
            <div className="grover-repeat-body">{slot("loop0", 2)}{slot("loop1", 3)}</div>
          </div>}
          {showMeasure && slot("measure", 4)}
        </div>
      </div>
      <p className="text-sm text-stage-muted">{t("Each box acts on all four qubits at once. The Oracle is sealed: it knows the PIN and flips the sign of that one answer.")}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => { onChange({ ...EMPTY_SLOTS }); setSelected(null); setMessage(null); }}>{t("Clear circuit")}</button>
      </div>
      {message && <p role="status" className="text-accent-amber">{t(message)}</p>}
    </div>
  </PuzzleDragDrop>;
}

function frameLabel(step: GroverRun["steps"][number]) {
  if (step.block === "start") return t("Start · |0000⟩");
  if (step.round === 0) return t("After H");
  const block = step.block === "h" ? "H" : step.block === "x" ? "X" : step.block === "oracle" ? "Oracle" : "Diffuser";
  return `${t("Round")} ${step.round} · ${t("after")} ${t(block)}`;
}

/** The core's inner view: signed amplitude bars, shuffled until a measurement names them. */
export function QuantumEqualizer({ run, runKey, animate }: { run: GroverRun | null; runKey: number; animate: boolean }) {
  useLocale((state) => state.locale);
  const last = run ? run.steps.length - 1 : 0;
  const [frame, setFrame] = useState(Number.MAX_SAFE_INTEGER);
  // A restored run shows its final frame; each new run replays once.
  const played = useRef(runKey);
  useEffect(() => {
    if (!run || played.current === runKey) return;
    played.current = runKey;
    if (!animate) { setFrame(Number.MAX_SAFE_INTEGER); return; }
    setFrame(0);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      if (index >= run.steps.length) { window.clearInterval(timer); return; }
      setFrame(index);
      gameAudio.playSynth("tick");
    }, 520);
    return () => { window.clearInterval(timer); played.current = -1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);
  if (!run) return <p className="coin-placeholder">{t("Run the circuit to see the quantum core’s inner view.")}</p>;
  const step = run.steps[Math.min(frame, last)];
  const amps = step.amplitudes;
  const mean = amps.reduce((sum, amp) => sum + amp, 0) / amps.length;
  const labelled = !!run.labels && frame >= last;
  // Before measurement bars keep the core's secret order; after it they slide into 0000…1111.
  const slotOf = amps.map((_, i) => labelled ? parseInt(run.labels![i], 2) : i);
  const axis = 72, scale = 60;
  const top = tallest(amps);
  return <figure className="grover-equalizer">
    <figcaption className="flex flex-wrap justify-between gap-2 text-sm"><span>{frameLabel(step)}</span>
      <span>{t("Tallest bar")}: <strong>{percent(top)}</strong></span></figcaption>
    <svg viewBox="0 0 320 156" role="img" aria-label={`${frameLabel(step)}. ${t("Tallest bar")}: ${percent(top)}`}>
      <line x1="0" x2="320" y1={axis} y2={axis} className="grover-axis" />
      {amps.map((amp, i) => {
        const h = Math.min(Math.abs(amp) * scale, 64);
        const measured = labelled && run.labels![i] === run.measured;
        return <g key={i} className="grover-bar-slot" style={{ transform: `translateX(${slotOf[i] * 20 + 2}px)` }}>
          <rect className={`grover-bar ${amp < 0 ? "negative" : ""} ${measured ? "measured" : ""}`} width="16"
            y={amp >= 0 ? axis - h : axis} height={Math.max(h, 0.5)} />
          {labelled && <text x="8" y="150" textAnchor="middle" className={`grover-bar-label ${measured ? "measured" : ""}`}>{run.labels![i]}</text>}
        </g>;
      })}
      <line x1="0" x2="320" y1={axis - mean * scale} y2={axis - mean * scale} className="grover-mean" />
    </svg>
    <p className="text-xs text-stage-muted">{labelled ? t("Measured: the bars now carry their PINs, back in order 0000…1111.")
      : t("Bars are signed amplitudes, shuffled and unnamed. The dashed line is the average. Only a measurement names a bar.")}</p>
  </figure>;
}

export type ChipId = "c16" | "c4" | "c314" | "c3" | "c2" | "c8" | "c15";
export type FormulaSlot = "n" | "root" | "value" | "rounds";
export type FormulaSlots = Record<FormulaSlot, ChipId | null>;
export const EMPTY_FORMULA: FormulaSlots = { n: null, root: null, value: null, rounds: null };
export const CHIPS: ChipId[] = ["c16", "c4", "c314", "c3", "c2", "c8", "c15"];
const CHIP_TEXT: Record<ChipId, string> = { c16: "16", c4: "4", c314: "3.14", c3: "3", c2: "2", c8: "8", c15: "15" };
const ANSWER: FormulaSlots = { n: "c16", root: "c4", value: "c314", rounds: "c3" };
const FORMULA_NAMES: Record<FormulaSlot, string> = { n: "N, the number of possible PINs", root: "√N", value: "π/4 · √N", rounds: "Whole rounds" };
const FORMULA_ORDER: FormulaSlot[] = ["n", "root", "value", "rounds"];
/** Caption printed under each box, so every blank says what it holds. */
const FORMULA_CAPTIONS: Record<FormulaSlot, string> = { n: "N = possible PINs", root: "√N", value: "π/4 · √N", rounds: "whole rounds" };
/** One question per box; only the active box takes a chip. */
const FORMULA_PROMPTS: Record<FormulaSlot, string> = {
  n: "Step 1 of 4 · N counts the different PINs the lock could hold, not the digits in one PIN. Each qubit doubles the count: 4 qubits give 2 · 2 · 2 · 2 combinations, 0000 to 1111.",
  root: "Step 2 of 4 · Now √16: which number times itself makes 16?",
  value: "Step 3 of 4 · π/4 · 4 is just π. Which chip is π?",
  rounds: "Step 4 of 4 · You can only run whole rounds. Round 3.14 down.",
};

/** Whiteboard: R ≈ π/4 · √N, worked one box at a time with number chips. */
export function RoundsFormula({ slots, order, onChange, onSolved }: {
  slots: FormulaSlots; order: ChipId[]; onChange: (slots: FormulaSlots) => void; onSolved: () => void;
}) {
  useLocale((state) => state.locale);
  const [selected, setSelected] = useState<ChipId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const active = FORMULA_ORDER.find((id) => slots[id] !== ANSWER[id]) ?? null;
  function place(slot: FormulaSlot, chip = selected) {
    if (!chip || !active) return;
    setSelected(null);
    if (slot !== active) { setMessage(t("Fill the glowing box first.")); gameAudio.playSfx("error"); return; }
    if (slot === "n" && chip === "c4") {
      setMessage(t("4 is the length of one PIN: 4 bits. N counts every PIN the lock could hold."));
      gameAudio.playSfx("error"); return;
    }
    if (chip !== ANSWER[slot]) {
      setMessage(`${t(CHIP_TEXT[chip])} ${t("does not fit here.")} ${t(FORMULA_PROMPTS[slot]).split(" · ").slice(1).join(" · ")}`);
      gameAudio.playSfx("error"); return;
    }
    const next = { ...slots, [slot]: chip };
    gameAudio.playSfx("select");
    onChange(next); setMessage(null);
    if (FORMULA_ORDER.every((id) => next[id] === ANSWER[id])) onSolved();
  }
  const slot = (id: FormulaSlot) => <span className="grover-slot-cell">
    <PuzzleSlot id={id} className={`grover-chip-slot ${slots[id] ? "filled" : ""} ${id === active ? "active" : ""}`} onSelect={() => place(id)}
      label={`${t(FORMULA_NAMES[id])}: ${slots[id] ? CHIP_TEXT[slots[id]] : t("Empty")}`}>{slots[id] ? t(CHIP_TEXT[slots[id]]) : "?"}</PuzzleSlot>
    <small>{t(FORMULA_CAPTIONS[id])}</small>
  </span>;
  return <PuzzleDragDrop labels={Object.fromEntries(order.map((id) => [id, t(CHIP_TEXT[id])]))}
    targets={Object.fromEntries(FORMULA_ORDER.map((id) => [id, t(FORMULA_NAMES[id])]))}
    onPlace={(target, source) => place(target as FormulaSlot, source as ChipId)} renderPreview={(id) => <span className="grover-chip">{t(CHIP_TEXT[id as ChipId])}</span>}>
    <div className="coin-challenge space-y-3">
      <div className="grover-formula" role="group" aria-label={t("Rounds formula")}>
        <span>R ≈ π/4 · √</span>{slot("n")}<span>= π/4 ·</span>{slot("root")}<span>=</span>{slot("value")}<span>→</span>{slot("rounds")}<span>{t("rounds")}</span>
      </div>
      {active && <p className="coin-callout">{t(FORMULA_PROMPTS[active])}</p>}
      <div className="coin-block-tray" aria-label={t("Number chips")}>
        {order.map((id) => <PuzzlePiece key={id} id={id} label={t(CHIP_TEXT[id])} selected={selected === id} className="grover-chip"
          onSelect={() => setSelected(id)}>{t(CHIP_TEXT[id])}</PuzzlePiece>)}
      </div>
      {message && <p role="status" className="text-accent-amber">{message}</p>}
      <button className="btn-ghost" onClick={() => { onChange({ ...EMPTY_FORMULA }); setMessage(null); }}>{t("Reset")}</button>
    </div>
  </PuzzleDragDrop>;
}
export const formulaSolved = (slots: FormulaSlots) => (Object.keys(ANSWER) as FormulaSlot[]).every((key) => slots[key] === ANSWER[key]);

/** Final entry: drag the measured PIN chip into the keypad. */
export function DisarmPad({ pin, disabled, onSend }: { pin: string; disabled: boolean; onSend: () => void }) {
  useLocale((state) => state.locale);
  const [selected, setSelected] = useState(false);
  return <PuzzleDragDrop labels={{ pin: `${t("Measured PIN")} ${pin}` }} targets={{ keypad: t("Drone core keypad") }}
    onPlace={() => { if (!disabled) onSend(); }} renderPreview={() => <span className="grover-chip pin">{pin}</span>}>
    <div className="coin-challenge space-y-3">
      <div className="grover-disarm">
        <PuzzlePiece id="pin" label={`${t("Measured PIN")} ${pin}`} selected={selected} className="grover-chip pin" onSelect={() => setSelected(true)}>{pin}</PuzzlePiece>
        <span aria-hidden="true">→</span>
        <PuzzleSlot id="keypad" className="grover-keypad-slot" label={t("Drone core keypad")} onSelect={() => { if (selected && !disabled) onSend(); }}>
          {t("Keypad")} · ▢▢▢▢
        </PuzzleSlot>
      </div>
      <button className="btn-primary" disabled={disabled} onClick={onSend}>{t("Send PIN")} · {pin}</button>
    </div>
  </PuzzleDragDrop>;
}
