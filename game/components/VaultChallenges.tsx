"use client";

import { useEffect, useRef, useState } from "react";
import { PuzzleDragDrop, PuzzlePiece, PuzzleSlot } from "./PuzzleDragDrop";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";
import {
  BITS, CANDLES, KEYSPACE, answerLine, bruteForce, formatCount, formatPercent, groverProbability, knownBits, litCandles, optimalRounds, tumblerList,
  type Question, type VaultCircuit, type VaultReason, type VaultRun,
} from "@/lib/vault";

const TUMBLERS = Array.from({ length: BITS }, (_, i) => i);
const GROVER_ROUNDS = optimalRounds(KEYSPACE);
const sub = (n: number) => String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[+d]);

/** Three candles a night; each question to the ghost burns one. */
export function CandleRow({ left }: { left: number }) {
  useLocale((state) => state.locale);
  return <div className="vault-candles" role="img" aria-label={`${t("Candles tonight")}: ${left}/${CANDLES}`}>
    <span>{t("Candles tonight")}</span>
    {Array.from({ length: CANDLES }, (_, i) => <span key={i} className={`vault-candle ${i < left ? "lit" : ""}`} aria-hidden="true" />)}
  </div>;
}

/* ---------- One box at a time: the chip formulas on the séance table. ---------- */

export interface FormulaSpec<S extends string, C extends string> {
  label: string;
  rows: (string | { slot: S })[][];
  order: S[];
  slots: Record<S, { name: string; caption: string; answer: C; prompt: string; wrong?: Partial<Record<C, string>> }>;
  chips: Record<C, string>;
  /** Worked-example slots: shown filled and locked, never asked. */
  given?: S[];
}
export const formulaDone = <S extends string, C extends string>(spec: FormulaSpec<S, C>, value: Record<S, C | null>) =>
  spec.order.every((id) => spec.given?.includes(id) || value[id] === spec.slots[id].answer);
export const emptyFormula = <S extends string, C extends string>(spec: FormulaSpec<S, C>) =>
  Object.fromEntries(spec.order.map((id) => [id, null])) as Record<S, C | null>;

export function StepFormula<S extends string, C extends string>({ spec, value, chipOrder, onChange, onSolved }: {
  spec: FormulaSpec<S, C>; value: Record<S, C | null>; chipOrder: C[];
  onChange: (value: Record<S, C | null>) => void; onSolved: () => void;
}) {
  useLocale((state) => state.locale);
  const [selected, setSelected] = useState<C | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const given = (id: S) => !!spec.given?.includes(id);
  const shown = (id: S) => given(id) ? spec.slots[id].answer : value[id];
  const active = spec.order.find((id) => !given(id) && value[id] !== spec.slots[id].answer) ?? null;
  function place(slot: S, chip = selected) {
    if (!chip || !active) return;
    setSelected(null);
    if (slot !== active) { setMessage(t("Fill the glowing box first.")); gameAudio.playSfx("error"); return; }
    const info = spec.slots[slot];
    if (chip !== info.answer) {
      const reason = info.wrong?.[chip];
      setMessage(reason ? t(reason) : `${t(spec.chips[chip])} ${t("does not fit here.")} ${t(info.prompt).split(" · ").slice(1).join(" · ")}`);
      gameAudio.playSfx("error"); return;
    }
    const next = { ...value, [slot]: chip };
    gameAudio.playSfx("select");
    onChange(next); setMessage(null);
    if (formulaDone(spec, next)) onSolved();
  }
  return <PuzzleDragDrop labels={Object.fromEntries(chipOrder.map((id) => [id, t(spec.chips[id])]))}
    targets={Object.fromEntries(spec.order.filter((id) => !given(id)).map((id) => [id, t(spec.slots[id].name)]))}
    onPlace={(target, source) => place(target as S, source as C)} renderPreview={(id) => <span className="grover-chip">{t(spec.chips[id as C])}</span>}>
    <div className="coin-challenge space-y-3">
      <div className="vault-formula" role="group" aria-label={t(spec.label)}>
        {spec.rows.map((row, r) => <div key={r} className="vault-formula-row">
          {row.map((part, i) => typeof part === "string" ? <span key={i}>{t(part)}</span> : <span key={i} className="grover-slot-cell">
            {given(part.slot) ? <span className="grover-chip-slot filled vault-given" aria-label={`${t(spec.slots[part.slot].name)}: ${t(spec.chips[spec.slots[part.slot].answer])}`}>
              {t(spec.chips[spec.slots[part.slot].answer])}</span>
            : <PuzzleSlot id={part.slot} className={`grover-chip-slot ${value[part.slot] ? "filled" : ""} ${part.slot === active ? "active" : ""}`}
              onSelect={() => place(part.slot)}
              label={`${t(spec.slots[part.slot].name)}: ${shown(part.slot) ? t(spec.chips[shown(part.slot)!]) : t("Empty")}`}>
              {shown(part.slot) ? t(spec.chips[shown(part.slot)!]) : "?"}
            </PuzzleSlot>}
            <small>{t(spec.slots[part.slot].caption)}</small>
          </span>)}
        </div>)}
      </div>
      {active && <p className="coin-callout">{t(spec.slots[active].prompt)}</p>}
      <div className="coin-block-tray" aria-label={t("Chips")}>
        {chipOrder.map((id) => <PuzzlePiece key={id} id={id} label={t(spec.chips[id])} selected={selected === id} className="grover-chip"
          onSelect={() => setSelected(id)}>{t(spec.chips[id])}</PuzzlePiece>)}
      </div>
      {message && <p role="status" className="text-accent-amber">{message}</p>}
      <button className="btn-ghost" onClick={() => { onChange(emptyFormula(spec)); setMessage(null); }}>{t("Reset")}</button>
    </div>
  </PuzzleDragDrop>;
}

export type BoardSlot = "n" | "root" | "rounds";
export type BoardChip = "bN" | "bRoot" | "bRounds" | "b25" | "b3" | "b16";
export const BOARD: FormulaSpec<BoardSlot, BoardChip> = {
  label: "Grover rounds for 25 bits",
  rows: [["R ≈ π/4 · √", { slot: "n" }, "= π/4 ·", { slot: "root" }, "≈", { slot: "rounds" }, "rounds"]],
  order: ["n", "root", "rounds"],
  slots: {
    n: { name: "N, the number of possible keys", caption: "N = possible keys", answer: "bN", prompt: "Step 1 of 3 · N counts every key the vault could hold: 2²⁵.",
      wrong: { b25: "25 is the number of tumblers. N counts every key they can make.", b16: "16 was the drone’s PIN count. This lock is much bigger." } },
    root: { name: "√N", caption: "√N", answer: "bRoot", prompt: "Step 2 of 3 · Which number times itself makes 33,554,432?" },
    rounds: { name: "Whole rounds", caption: "whole rounds", answer: "bRounds", prompt: "Step 3 of 3 · π/4 · 5,792.6 is about 4,549. Each round asks the ghost once." },
  },
  chips: { bN: "33,554,432", bRoot: "5,792.6", bRounds: "4,549", b25: "25", b3: "3", b16: "16" },
};

export type LedgerSlot = "helper" | "a0" | "a1" | "a2" | "b0" | "b1" | "b2";
export type LedgerChip = "plus" | "minus" | "zero" | "one";
export const LEDGER: FormulaSpec<LedgerSlot, LedgerChip> = {
  label: "Kickback ledger for one tumbler",
  rows: [
    ["Helper qubit:", { slot: "helper" }],
    ["Example, sᵢ = 0:  |0⟩ →H→", { slot: "a0" }, "→ghost→", { slot: "a1" }, "→H→", { slot: "a2" }],
    ["sᵢ = 1:  |0⟩ →H→", { slot: "b0" }, "→ghost→", { slot: "b1" }, "→H→", { slot: "b2" }],
  ],
  order: ["helper", "a0", "a1", "a2", "b0", "b1", "b2"],
  given: ["a0", "a1", "a2"],
  slots: {
    helper: { name: "Helper state", caption: "helper", answer: "minus", prompt: "Step 1 of 4 · The ghost flips the helper when sᵢ·xᵢ = 1. Pick a helper state that a flip only multiplies by −1.",
      wrong: { zero: "With the helper in |0⟩ the ghost just flips it to |1⟩: the answer lands in the helper, not in a phase.", one: "|1⟩ flips to |0⟩: again the answer lands in the helper, not in a phase.", plus: "A flip leaves |+⟩ exactly as it was: nothing kicks back." } },
    a0: { name: "Tumbler qubit after H, sᵢ = 0", caption: "after H", answer: "plus", prompt: "Step 2 of 7 · H turns |0⟩ into an equal mix of 0 and 1. Which state is that?" },
    a1: { name: "Tumbler qubit after the ghost, sᵢ = 0", caption: "after the ghost", answer: "plus", prompt: "Step 3 of 7 · sᵢ = 0: the ghost never touches this tumbler. Nothing changes." },
    a2: { name: "Tumbler qubit after the second H, sᵢ = 0", caption: "after H", answer: "zero", prompt: "Step 4 of 7 · H undoes itself: |+⟩ goes back to…" },
    b0: { name: "Tumbler qubit after H, sᵢ = 1", caption: "after H", answer: "plus", prompt: "Step 2 of 4 · Same start as the example: H on |0⟩." },
    b1: { name: "Tumbler qubit after the ghost, sᵢ = 1", caption: "after the ghost", answer: "minus", prompt: "Step 3 of 4 · sᵢ = 1: the ghost flips |−⟩, which only adds a minus sign. The sign kicks back onto the |1⟩ part of this qubit.",
      wrong: { plus: "Look closer: the minus sign from the helper lands on this qubit’s |1⟩ part. |0⟩ + |1⟩ becomes |0⟩ − |1⟩." } },
    b2: { name: "Tumbler qubit after the second H, sᵢ = 1", caption: "after H", answer: "one", prompt: "Step 4 of 4 · H turns |−⟩ into a definite bit. Which one?" },
  },
  chips: { plus: "|+⟩", minus: "|−⟩", zero: "|0⟩", one: "|1⟩" },
};

/* ---------- Phase 1: marking tumblers for the ghost. ---------- */

export type { Question } from "@/lib/vault";

/** The vault's code as 25 dials: mark tumblers for the ghost, ask, and watch digits appear. */
export function CodeBoard({ candlesLeft, questions, tries, last, busy, onAsk, onTryKey }: {
  candlesLeft: number; questions: Question[]; tries: string[]; last: "ask" | "key" | null; busy: boolean;
  onAsk: (x: string) => void; onTryKey: (key: string) => void;
}) {
  useLocale((state) => state.locale);
  const [marked, setMarked] = useState<number[]>([]);
  const [several, setSeveral] = useState(false);
  const [guessing, setGuessing] = useState(false);
  const [guess, setGuess] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const known = knownBits(questions);
  const clues = new Set(questions.filter((q) => litCandles(q.x).length > 1).flatMap((q) => litCandles(q.x)));
  const guided = questions.length === 0 && tries.length === 0;
  const out = candlesLeft <= 0 || busy;
  function mark(i: number) {
    setMessage(null);
    if (several) { gameAudio.playSfx("select"); setMarked((m) => m.includes(i) ? m.filter((j) => j !== i) : [...m, i].sort((a, b) => a - b)); return; }
    if (known.has(i)) { gameAudio.playSfx("error"); setMessage("You already know this one. Mark a tumbler that still shows ?."); return; }
    gameAudio.playSfx("select"); setMarked((m) => m[0] === i ? [] : [i]);
  }
  function ask() {
    onAsk(TUMBLERS.map((i) => marked.includes(i) ? "1" : "0").join(""));
    setMarked([]);
  }
  const rollGuess = () => setGuess(TUMBLERS.map((i) => known.get(i) ?? (Math.random() < 0.5 ? 0 : 1)).join(""));
  const question = !marked.length ? (guided ? "Mark a tumbler for the ghost, then ask." : "Mark a tumbler for the ghost.")
    : marked.length === 1 ? `Is tumbler ${marked[0] + 1} a 1?` : `Ask about tumblers ${tumblerList(marked)} together?`;
  const latest = last === "ask" ? questions.at(-1) : null;
  return <div className="space-y-4">
    <div className="vault-rules">
      <p>👻 <strong>{t("The ghost is the vault’s lock.")}</strong> {t("Mark a tumbler for the ghost and ask.")} <strong>{t("Knock = that digit is 1 · Silence = it’s 0.")}</strong></p>
      <p>🕯 <strong>{t("3 questions per night.")}</strong> {t("At midnight the vault changes its code.")}</p>
    </div>
    <CandleRow left={candlesLeft} />
    <div className="vault-code" role="group" aria-label={t("The vault’s code")}>
      <p className="vault-code-title">{t("THE VAULT’S CODE")}</p>
      <div className="vault-dials">
        {TUMBLERS.map((i) => {
          const digit = known.get(i);
          const state = marked.includes(i) ? "marked" : digit !== undefined ? "known" : clues.has(i) ? "clue" : "";
          return <button key={i} type="button" className={`vault-dial ${state}`} disabled={out}
            aria-pressed={marked.includes(i)} aria-label={`${t("Tumbler")} ${i + 1}: ${digit ?? "?"}`} onClick={() => mark(i)}>
            <small>{i + 1}</small><strong>{digit ?? "?"}</strong>
          </button>;
        })}
      </div>
    </div>
    <div className="vault-question">
      <p><span className="text-stage-muted">{t("Question")}:</span> <strong>{t(question)}</strong></p>
      <button className="btn-primary" disabled={out || !marked.length} onClick={ask}>{t("👻 Ask the ghost · 1 candle")}</button>
    </div>
    {latest && <p className="vault-answer" role="status">{t(answerLine(latest))}</p>}
    {last === "key" && <p className="vault-answer" role="status">{t("The door rattles. Wrong code. (1 in 33,554,432.)")}</p>}
    {message && <p role="status" className="text-accent-amber">{t(message)}</p>}
    <p className="text-sm">{t("Digits known")}: <strong>{known.size} / {BITS}</strong> · {candlesLeft} {t(candlesLeft === 1 ? "candle left" : "candles left")} · {BITS - known.size} {t("digits to go")}</p>
    {!guided && <div className="grover-actions">
      <button type="button" className={`vault-toggle ${several ? "on" : ""}`} aria-pressed={several} disabled={out}
        onClick={() => { gameAudio.playSfx("click"); setSeveral((s) => !s); setMarked([]); setMessage(null); }}>
        {several ? "☑" : "☐"} {t("Ask about several tumblers at once")}
      </button>
      <button type="button" className="btn-ghost" disabled={out} onClick={() => { gameAudio.playSfx("click"); setGuessing((g) => !g); if (!guess) rollGuess(); }}>
        {t(guessing ? "Hide the guess" : "Guess the whole code instead…")}
      </button>
    </div>}
    {guessing && guess && !guided && <div className="vault-guess space-y-2">
      <p className="text-sm">{t("Known digits stay; every ? becomes a random 0 or 1.")}</p>
      <p className="vault-mask">{guess}</p>
      <div className="grover-actions">
        <button className="btn-ghost" disabled={out} onClick={() => { gameAudio.playSynth("glow"); rollGuess(); }}>{t("Shuffle the unknown digits")}</button>
        <button className="btn-primary" disabled={out || tries.includes(guess)} onClick={() => onTryKey(guess)}>{t("Try this code at the door · 1 candle")}</button>
      </div>
    </div>}
    {(questions.length > 0 || tries.length > 0) && <div className="vault-log">
      <p className="text-xs text-stage-muted">{t("Tonight")}</p>
      {questions.map((q, i) => <p key={`q${i}`}>{t(answerLine(q))}</p>)}
      {tries.map((key, i) => <p key={`k${i}`}>{t("Code")} <code>{key}</code> → {t("the door rattles: denied")}</p>)}
    </div>}
  </div>;
}

export type QuizAnswer = "9" | "25" | "never";
const QUIZ_FEEDBACK: Record<QuizAnswer, string> = {
  "9": "That would work if the code stayed put. Listen…",
  "25": "That’s one digit a night. You get three. But listen…",
  never: "Right.",
};
/** Midnight: one tap that sums up the classical attempt. */
export function MidnightQuiz({ known, answer, onAnswer, onContinue }: {
  known: number; answer: QuizAnswer | null; onAnswer: (answer: QuizAnswer) => void; onContinue: () => void;
}) {
  useLocale((state) => state.locale);
  const digits = known === 1 ? `${known} ${t("digit")}` : `${known} ${t("digits")}`;
  return <div className="space-y-4">
    <p className="coin-callout grover-alert" role="alert">❄ {t("The house has gone cold. At midnight the lock forgets.")}</p>
    <p className="vault-quiz-question">{t("You learned")} <strong>{digits}</strong> {t("of 25 tonight. With 3 questions a night, how many nights until the vault opens?")}</p>
    <div className="vault-quiz">
      {(["9", "25", "never"] as const).map((id) => <button key={id} type="button" disabled={!!answer}
        className={`vault-quiz-option ${answer === id ? (id === "never" ? "right" : "wrong") : answer && id === "never" ? "right" : ""}`}
        onClick={() => { if (id === "never") gameAudio.playSfx("confirm"); else gameAudio.playSynth("toll"); onAnswer(id); }}>
        {id === "never" ? t("Never") : `${id} ${t("nights")}`}
      </button>)}
    </div>
    {answer && <>
      {answer !== "never" && <p className="text-accent-amber">{t(QUIZ_FEEDBACK[answer])}</p>}
      <p className="coin-callout">{t("Never. At midnight the code changed: the digits you learned are gone. One digit per question, 3 questions a night — classical questioning can never catch up.")}</p>
      <div className="vault-facts">
        <p>{t("Guessing")}: {CANDLES} / {formatCount(KEYSPACE)} ≈ {formatPercent(bruteForce(CANDLES))} {t("per night at best")}</p>
        <p>{t("Asking")}: {t("1 digit per question · 25 needed · 3 allowed")}</p>
      </div>
      <p>{t("Your doctor friend left a laptop. Let’s see what it can do.")}</p>
      <button className="btn-primary" onClick={onContinue}>{t("Take it to the laptop →")}</button>
    </>}
  </div>;
}

/* ---------- Phase 2: the Grover trap. ---------- */

export type TrapPiece = "h" | "oracle" | "diffuser" | "x";
export type TrapSlot = "init" | "loop0" | "loop1";
export type TrapSlots = Record<TrapSlot, TrapPiece | null>;
export const EMPTY_TRAP: TrapSlots = { init: null, loop0: null, loop1: null };
export const TRAP_PIECES: TrapPiece[] = ["h", "oracle", "diffuser", "x"];
const TRAP_NAMES: Record<TrapPiece, string> = { h: "H", oracle: "Oracle", diffuser: "Diffuser", x: "X" };
const TRAP_HELP: Record<TrapPiece, string> = { h: "H on all 25 qubits", oracle: "Oracle · the vault’s ghost", diffuser: "Diffuser · reflect about the mean", x: "X on all 25 qubits" };
const TRAP_SLOTS: Record<TrapSlot, string> = { init: "Prepare the register", loop0: "Repeat box · first", loop1: "Repeat box · second" };
export const trapReady = (s: TrapSlots) => s.init === "h" && s.loop0 === "oracle" && s.loop1 === "diffuser";
export function trapHint(s: TrapSlots): string {
  if (s.init !== "h") return "Start from the H box: it spreads one guess over all 33,554,432 keys.";
  if (s.loop0 === "x" || s.loop1 === "x" || s.loop0 === "h" || s.loop1 === "h") return "A round needs only the Oracle and the Diffuser.";
  if (s.loop0 !== "oracle" || s.loop1 !== "diffuser") return "Same order as in the workshop: the Oracle marks, then the Diffuser grows the mark.";
  return "That is the Echo Chamber search, now on 25 qubits.";
}

/** The Echo Chamber builder, stretched over 25 qubits. The repeat count is set by the board. */
export function GroverTrapBuilder({ slots, onChange, repeatLabel, locked }: {
  slots: TrapSlots; onChange: (slots: TrapSlots) => void; repeatLabel: string; locked: boolean;
}) {
  useLocale((state) => state.locale);
  const [selected, setSelected] = useState<TrapPiece | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  function place(slot: TrapSlot, piece = selected) {
    if (!piece || locked) return;
    if (slot === "init" && piece !== "h" && piece !== "x") { setMessage("Prepare the register first; the Oracle and Diffuser belong in the repeat box."); return; }
    const next = { ...slots };
    for (const key of Object.keys(next) as TrapSlot[]) if (next[key] === piece) next[key] = null;
    next[slot] = piece;
    gameAudio.playSfx("select");
    onChange(next); setSelected(null); setMessage(null);
  }
  const box = (id: TrapPiece) => <span className={`grover-box ${id}`}>{id === "oracle" ? <>⬛ {t("Oracle")}</> : t(TRAP_NAMES[id])}</span>;
  const slot = (id: TrapSlot, index: number) => <PuzzleSlot id={id} className={`grover-slot ${slots[id] ? "filled" : ""}`} onSelect={() => place(id)}
    label={`${t(TRAP_SLOTS[id])}: ${slots[id] ? t(TRAP_HELP[slots[id]!]) : t("Empty")}`}>
    {slots[id] ? box(slots[id]!) : <span className="grover-empty">{index}</span>}
  </PuzzleSlot>;
  return <PuzzleDragDrop labels={Object.fromEntries(TRAP_PIECES.map((id) => [id, t(TRAP_HELP[id])]))}
    targets={Object.fromEntries((Object.keys(TRAP_SLOTS) as TrapSlot[]).map((id) => [id, t(TRAP_SLOTS[id])]))}
    onPlace={(target, source) => place(target as TrapSlot, source as TrapPiece)} renderPreview={(id) => box(id as TrapPiece)}>
    <div className="coin-challenge space-y-3">
      {!locked && <div className="coin-block-tray" aria-label={t("Circuit boxes")}>
        {TRAP_PIECES.map((id) => <PuzzlePiece key={id} id={id} label={t(TRAP_HELP[id])} selected={selected === id} className="grover-piece"
          onSelect={() => setSelected(id)}>{box(id)}</PuzzlePiece>)}
      </div>}
      <div className="grover-circuit" role="group" aria-label={t("25-qubit circuit")}>
        <div className="grover-register" aria-hidden="true"><span>{t("25 qubits")}</span><small>|0…0⟩</small></div>
        <div className="grover-track">
          {slot("init", 1)}
          <div className="grover-repeat">
            <div className="grover-repeat-head"><span>{t("Repeat")}</span><strong>×{repeatLabel}</strong></div>
            <div className="grover-repeat-body">{slot("loop0", 2)}{slot("loop1", 3)}</div>
          </div>
        </div>
      </div>
      {message && <p role="status" className="text-accent-amber">{t(message)}</p>}
    </div>
  </PuzzleDragDrop>;
}

/** Candle-clock run of Grover: the buffer is three questions, the search needs 4,549. */
export function GroverClockRun({ finished, runKey, onRun, onFinished, disabled }: {
  finished: boolean; runKey: number; onRun: () => void; onFinished: () => void; disabled: boolean;
}) {
  useLocale((state) => state.locale);
  const [cycle, setCycle] = useState(finished ? CANDLES : 0);
  const played = useRef(runKey);
  useEffect(() => {
    if (played.current === runKey) return;
    played.current = runKey;
    setCycle(0);
    let k = 0;
    const timer = window.setInterval(() => {
      k += 1;
      setCycle(k);
      gameAudio.playSynth("tick"); gameAudio.playSynth("snuff");
      if (k >= CANDLES) {
        window.clearInterval(timer);
        gameAudio.playSfx("error"); gameAudio.playSynth("alarm");
        onFinished();
      }
    }, 900);
    return () => { window.clearInterval(timer); played.current = -1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);
  const p = groverProbability(KEYSPACE, cycle);
  // Log scale from 10⁻⁸ (empty) to 1 (certain); the needle barely leaves the floor.
  const width = cycle === 0 ? 0 : Math.max(1, Math.min(100, ((Math.log10(p) + 8) / 8) * 100));
  const running = cycle > 0 && cycle < CANDLES;
  const done = finished || cycle >= CANDLES;
  return <div className="vault-clock space-y-3">
    <div className="vault-clock-row">
      <div><span>{t("Clock cycle")}</span><strong aria-live="polite">{cycle} / {formatCount(GROVER_ROUNDS)}</strong></div>
      <CandleRow left={CANDLES - cycle} />
    </div>
    <div>
      <p className="text-sm">{t("Target probability")}: <strong>{cycle === 0 ? formatPercent(1 / KEYSPACE, 3) : formatPercent(p, 3)}</strong> · {t("needed: about 100%")}</p>
      <div className="vault-meter" role="img" aria-label={`${t("Target probability")}: ${formatPercent(p, 3)}`}><span style={{ width: `${width}%` }} /></div>
      <p className="text-xs text-stage-muted">{t("Log scale: each step to the right is ten times more likely.")}</p>
    </div>
    {done ? <p className="coin-callout grover-alert" role="alert">⚠ {t("Buffer Depleted. Target probability after 3 iterations: < 0.0002%. Grover quadratic speedup is insufficient for large unstructured keys under single-digit query limits.")}</p>
      : <button className="btn-primary" disabled={disabled || running} onClick={onRun}>{t(running ? "Running…" : "Run ×4,549")}</button>}
  </div>;
}

/* ---------- Phase 3: the manual, the black-box BV circuit, the one-question run. ---------- */

export function ManualScan({ scanned, onScan, parityHint }: { scanned: boolean; onScan: () => void; parityHint: boolean }) {
  useLocale((state) => state.locale);
  const [holding, setHolding] = useState(false);
  if (!scanned) return <PuzzleDragDrop labels={{ manual: t("The Colonel’s manual") }} targets={{ scanner: t("Laptop scanner") }}
    onPlace={() => onScan()} renderPreview={() => <span className="vault-manual">📕 {t("VAULT-7 manual")}</span>}>
    <div className="coin-challenge space-y-3">
      <p>{t("Drag the manual from the drawer onto the laptop to scan it.")}</p>
      <div className="grover-disarm">
        <PuzzlePiece id="manual" label={t("The Colonel’s manual")} selected={holding} className="vault-manual" onSelect={() => setHolding(true)}>📕 {t("VAULT-7 manual")}</PuzzlePiece>
        <span aria-hidden="true">→</span>
        <PuzzleSlot id="scanner" className="grover-keypad-slot" label={t("Laptop scanner")} onSelect={() => { if (holding) onScan(); }}>{t("Scanner")} · ▭</PuzzleSlot>
      </div>
    </div>
  </PuzzleDragDrop>;
  return <div className="space-y-3">
    <pre className="vault-spec">{`VAULT-7 · GHOST KEY LOCK
ORACLE:  f(x) = s · x  mod 2
         s = 25-bit mask (secret)
         x = the tumblers you mark`}</pre>
    <p>{t("The lock never asks “is x the key?”. It answers the parity of the tumblers where both s and x are 1: an odd count knocks, an even count stays silent.")}</p>
    {parityHint && <p className="coin-callout">{t("Your several-tumbler question got one knock. A match lock only knocks for the exact key — this lock was never a match lock. Grover’s premise was wrong too.")}</p>}
    <p className="coin-callout">{t("Stop amplifying amplitudes through iteration. Exploit phase interference with a single query.")}</p>
  </div>;
}

export type BvPiece = "h" | "h2" | "minus" | "plus" | "zero" | "m" | "diffuser";
export type BvSlot = "prep" | "helper" | "out" | "measure" | "repeat";
export type BvSlots = Record<BvSlot, BvPiece | null>;
export const EMPTY_BV: BvSlots = { prep: null, helper: null, out: null, measure: null, repeat: null };
export const BV_PIECES: BvPiece[] = ["h", "minus", "diffuser", "h2", "plus", "m", "zero"];
const BV_NAMES: Record<BvPiece, string> = { h: "H", h2: "H", minus: "|−⟩", plus: "|+⟩", zero: "|0⟩", m: "M", diffuser: "Diffuser" };
const BV_HELP: Record<BvPiece, string> = {
  h: "H on all 25 data qubits", h2: "H on all 25 data qubits", minus: "Prepare the helper in |−⟩", plus: "Prepare the helper in |+⟩",
  zero: "Leave the helper in |0⟩", m: "M · measure all 25 data qubits", diffuser: "Diffuser · reflect about the mean",
};
const BV_SLOTS: Record<BvSlot, string> = {
  prep: "Data bus · before the ghost", helper: "Helper wire · state", out: "Data bus · after the ghost", measure: "Measure", repeat: "Repeat box",
};
const isH = (p: BvPiece | null) => p === "h" || p === "h2";
export function bvProblem(s: BvSlots): VaultReason | null {
  if (s.repeat) return "extra";
  if (!isH(s.prep)) return "prep";
  if (s.helper !== "minus") return "helper";
  if (!isH(s.out)) return "output";
  if (s.measure !== "m") return "measure";
  return null;
}
export function bvCircuit(s: BvSlots): VaultCircuit {
  return {
    prep: isH(s.prep) ? "h" : null, out: isH(s.out) ? "h" : null, measure: s.measure === "m",
    helper: s.helper === "minus" || s.helper === "plus" || s.helper === "zero" ? s.helper : null,
    extra: s.repeat ? [s.repeat === "diffuser" ? "diffuser" : "repeat"] : [],
  };
}
export function bvHint(s: BvSlots): string {
  switch (bvProblem(s)) {
    case "extra": return "Nothing to amplify: this is one question, not a loop. Empty the repeat box.";
    case "prep": return "Start with H on the data bus: mark every tumbler at once, in superposition.";
    case "helper": return s.helper === "zero" || !s.helper ? "With the helper in |0⟩ the ghost’s answer goes into the helper, not the phase."
      : "A flip leaves |+⟩ unchanged: nothing kicks back. The helper needs |−⟩.";
    case "output": return "The signs are on the wires now, but you can’t measure a sign. Add H after the ghost.";
    case "measure": return "Read all 25 bits at once: put M at the end of the data bus.";
    default: return "The wiring checks out: H, the ghost with a |−⟩ helper, H, then M.";
  }
}

/** Boxes only, like the workshop: the Oracle is the vault itself and stays sealed. */
export function BvCircuitBuilder({ slots, onChange, locked }: { slots: BvSlots; onChange: (slots: BvSlots) => void; locked: boolean }) {
  useLocale((state) => state.locale);
  const [selected, setSelected] = useState<BvPiece | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  function place(slot: BvSlot, piece = selected) {
    if (!piece || locked) return;
    const state = piece === "minus" || piece === "plus" || piece === "zero";
    if (slot === "helper" && !state) { setMessage("The helper wire takes a state box: |0⟩, |+⟩ or |−⟩."); return; }
    if (slot !== "helper" && state) { setMessage("State boxes prepare the helper wire, below the data bus."); return; }
    if (slot === "measure" && piece !== "m") { setMessage("Only M goes at the end: it reads all 25 qubits."); return; }
    if (slot !== "measure" && piece === "m") { setMessage("Measure last. M belongs at the end of the data bus."); return; }
    if ((slot === "prep" || slot === "out") && piece === "diffuser") { setMessage("The Diffuser only makes sense inside a repeat box."); return; }
    const next = { ...slots };
    for (const key of Object.keys(next) as BvSlot[]) if (next[key] === piece) next[key] = null;
    next[slot] = piece;
    gameAudio.playSfx("select");
    onChange(next); setSelected(null); setMessage(null);
  }
  const box = (id: BvPiece) => <span className={`grover-box ${id === "h2" ? "h" : id === "minus" || id === "plus" || id === "zero" ? "vault-state" : id}`}>{t(BV_NAMES[id])}</span>;
  const slot = (id: BvSlot, extra = "") => <PuzzleSlot id={id} className={`grover-slot vault-slot ${extra} ${slots[id] ? "filled" : ""}`} onSelect={() => place(id)}
    label={`${t(BV_SLOTS[id])}: ${slots[id] ? t(BV_HELP[slots[id]!]) : t("Empty")}`}>
    {slots[id] ? box(slots[id]!) : <span className="grover-empty">{id === "repeat" ? t("no loop needed") : "□"}</span>}
  </PuzzleSlot>;
  return <PuzzleDragDrop labels={Object.fromEntries(BV_PIECES.map((id) => [id, t(BV_HELP[id])]))}
    targets={Object.fromEntries((Object.keys(BV_SLOTS) as BvSlot[]).map((id) => [id, t(BV_SLOTS[id])]))}
    onPlace={(target, source) => place(target as BvSlot, source as BvPiece)} renderPreview={(id) => box(id as BvPiece)}>
    <div className="coin-challenge space-y-3">
      {!locked && <div className="coin-block-tray" aria-label={t("Circuit boxes")}>
        {BV_PIECES.map((id) => <PuzzlePiece key={id} id={id} label={t(BV_HELP[id])} selected={selected === id} className="grover-piece"
          onSelect={() => setSelected(id)}>{box(id)}</PuzzlePiece>)}
      </div>}
      <div className="vault-bv" role="group" aria-label={t("Bernstein–Vazirani circuit")}>
        <div className="vault-bv-label"><span>{t("25 qubits")}</span><small>|0…0⟩</small></div>
        <div className="vault-bv-wire data">{slot("prep")}</div>
        <div className="vault-bv-oracle" aria-label={t("The vault’s ghost, sealed")}>⬛<br />{t("Oracle")}<small>{t("the ghost")}</small></div>
        <div className="vault-bv-wire data">{slot("out")}{slot("measure")}</div>
        <div className="vault-bv-label helper"><span>{t("helper")}</span><small>|0⟩</small></div>
        <div className="vault-bv-wire helper">{slot("helper")}</div>
        <div className="vault-bv-wire helper" aria-hidden="true" />
        <div className="vault-bv-repeat">{slot("repeat", "vault-repeat-slot")}</div>
      </div>
      <p className="text-sm text-stage-muted">{t("Each box acts on a whole wire group. The ghost is sealed: you route the wires through it, you don’t open it.")}</p>
      <button className="btn-ghost" disabled={locked} onClick={() => { onChange({ ...EMPTY_BV }); setSelected(null); setMessage(null); }}>{t("Clear circuit")}</button>
      {message && <p role="status" className="text-accent-amber">{t(message)}</p>}
    </div>
  </PuzzleDragDrop>;
}

const STAGE_CAPTIONS = [
  "After H: every tumbler is asked at once, all signs +",
  "After the ghost: a minus sign kicked back onto every tumbler where s is 1. A measurement can’t see a sign.",
  "After H: each sign became a definite bit. One question, 25 bits.",
];
/** The display register: one pulse, ghost glows, then the whole mask in one clock cycle. */
export function MaskRegister({ run, runKey, onDone }: { run: VaultRun | null; runKey: number; onDone: () => void }) {
  useLocale((state) => state.locale);
  const [stage, setStage] = useState(run ? 2 : -1);
  const played = useRef(runKey);
  useEffect(() => {
    if (!run || played.current === runKey) return;
    played.current = runKey;
    setStage(0); gameAudio.playSynth("wire");
    const timers = [
      window.setTimeout(() => { setStage(1); gameAudio.playSynth("glow"); }, 900),
      window.setTimeout(() => { setStage(2); gameAudio.playSynth("tick"); }, 2200),
      window.setTimeout(() => onDone(), 2200 + BITS * 40 + 400),
    ];
    return () => { timers.forEach((id) => window.clearTimeout(id)); played.current = -1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);
  if (!run || stage < 0) return <p className="coin-placeholder">{t("Execute the circuit to read the display register.")}</p>;
  const phases = run.frames.find((f) => f.block === "oracle")?.phases ?? [];
  return <figure className={`vault-register stage-${stage}`}>
    <figcaption className="text-sm">{t(STAGE_CAPTIONS[stage])}</figcaption>
    <div className="vault-register-cells">
      {TUMBLERS.map((i) => <span key={i} style={{ transitionDelay: stage === 2 ? `${i * 40}ms` : "0ms" }}
        className={stage === 1 && phases[i] === "-" ? "minus" : stage === 2 ? `bit b${run.measured[i]}` : ""}>
        {stage === 2 ? run.measured[i] : stage === 1 ? (phases[i] === "-" ? "−" : "+") : "+"}
      </span>)}
    </div>
    {stage === 2 && <p className="vault-mask">{run.measured}</p>}
  </figure>;
}

/** Final entry: drag the mask chip onto the tumblers. No candle is spent. */
export function UnlockPad({ mask, disabled, onSend }: { mask: string; disabled: boolean; onSend: () => void }) {
  useLocale((state) => state.locale);
  const [selected, setSelected] = useState(false);
  return <PuzzleDragDrop labels={{ mask: `${t("Mask")} ${mask}` }} targets={{ door: t("Vault tumblers") }}
    onPlace={() => { if (!disabled) onSend(); }} renderPreview={() => <span className="grover-chip pin">{mask}</span>}>
    <div className="coin-challenge space-y-3">
      <div className="grover-disarm">
        <PuzzlePiece id="mask" label={`${t("Mask")} ${mask}`} selected={selected} className="grover-chip pin vault-mask-chip" onSelect={() => setSelected(true)}>{mask}</PuzzlePiece>
        <span aria-hidden="true">→</span>
        <PuzzleSlot id="door" className="grover-keypad-slot vault-door-slot" label={t("Vault tumblers")} onSelect={() => { if (selected && !disabled) onSend(); }}>
          {t("Tumblers")} · ◎
        </PuzzleSlot>
      </div>
      <button className="btn-primary" disabled={disabled} onClick={onSend}>{t("Set the tumblers")}</button>
    </div>
  </PuzzleDragDrop>;
}

export function ComparisonCard() {
  useLocale((state) => state.locale);
  const rows: [string, string, boolean][] = [
    ["Classical probing", "25", false],
    ["Grover (as if unstructured)", `≈ ${formatCount(GROVER_ROUNDS)}`, false],
    ["Bernstein–Vazirani", "1", true],
  ];
  return <table className="vault-compare">
    <caption>{t("Questions needed to learn the 25-bit mask")}</caption>
    <thead><tr><th>{t("Method")}</th><th>{t("Questions")}</th><th>{t("Fits in 3 candles?")}</th></tr></thead>
    <tbody>{rows.map(([method, count, fits]) => <tr key={method} className={fits ? "win" : ""}>
      <td>{t(method)}</td><td>{count}</td><td>{fits ? t("✓ 2 candles left") : "✗"}</td>
    </tr>)}</tbody>
  </table>;
}
