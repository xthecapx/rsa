"use client";

import { useState } from "react";
import { PuzzleDragDrop, PuzzlePiece, PuzzleSlot } from "./PuzzleDragDrop";
import type { RegisterStep, RoundsStep } from "@/content/knowledge";
import { amplitudeText, basisStates, formatReg, groverOdds, probsReg, solvesReg, startRegister, traceReg, wireStates, WIRE_KET, WIRE_PIECES, type RegOp, type RegPiece, type Register, type WirePiece } from "@/game/register";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";

const percent = (p: number) => `${Math.round(p * 1000) / 10}%`;

function opLabel(op: RegOp): string {
  if (op === "H") return "H box · every qubit";
  if (op === "D") return "Diffuser · mirror";
  if (op.startsWith("oracle:")) return `Oracle · marks |${op.slice(7)}⟩`;
  if (op.startsWith("ghost:")) return "Oracle · the ghost";
  if (op.startsWith("CX")) return `CNOT · control on line ${op.slice(2)}`;
  if (op.startsWith("h")) return `H on line ${op.slice(1)}`;
  return `${op[0]} on line ${op.slice(1)}`;
}
function opGlyph(op: RegOp): string {
  if (op === "H") return "H";
  if (op === "D") return "D";
  if (op.startsWith("oracle:") || op.startsWith("ghost:")) return "O";
  if (op.startsWith("CX")) return `CX${op.slice(2)}`;
  if (op.startsWith("h")) return `H${op.slice(1)}`;
  return op;
}
const isOracle = (op: RegOp) => op.startsWith("oracle:") || op.startsWith("ghost:");
/** Short name printed inside a box that covers every wire, so "O" always reads as the Oracle. */
const spanName = (op: RegOp) => (op === "H" ? "H box" : op === "D" ? "Diffuser" : isOracle(op) ? "Oracle" : "");
/** How a piece reads in the step-by-step trace: whole words for the Oracle, the Diffuser and CNOT. */
const traceName = (op: RegOp) => (op === "D" ? "Diffuser" : isOracle(op) ? "Oracle" : op.startsWith("CX") ? `CNOT${op.slice(2)}` : opGlyph(op));
const opClass = (op: RegOp) => (op === "H" || op.startsWith("h") ? "hadamard" : op.startsWith("X") ? "pauli-x" : op.startsWith("Z") ? "pauli-z" : op.startsWith("CX") ? "reg-control" : op === "D" ? "reg-diffuser" : "reg-oracle");

/**
 * Amplitude bars over every basis state: up for +, down for −. Each column
 * prints its amplitude, and the chance of reading it (the amplitude squared)
 * underneath. The dashed line is the average the Diffuser mirrors about.
 * Heights animate between states so each piece's effect is visible.
 */
export function AmplitudeBars({ amps, mean = false, highlight, title, legend = true }: { amps: Register; mean?: boolean; highlight?: string; title?: string; legend?: boolean }) {
  useLocale((state) => state.locale);
  const labels = basisStates(Math.log2(amps.length));
  const probs = probsReg(amps);
  const average = amps.reduce((sum, a) => sum + a, 0) / amps.length;
  return <div className="amp-bars" role="img" aria-label={`${title ? `${t(title)}. ` : ""}${t("Amplitudes")}: ${labels.map((label, i) => `|${label}⟩ ${amplitudeText(amps[i])}`).join(", ")}`}>
    <div className="amp-head">
      {title && <strong className="text-accent-teal">{t(title)}</strong>}
      {legend && <span className="text-stage-muted">{t("Bar height = amplitude; below the line means a minus sign. The % is the chance to read that state: the amplitude squared.")}</span>}
    </div>
    <div className="amp-plot" style={{ gridTemplateColumns: `repeat(${amps.length}, minmax(0, 1fr))` }}>
      {amps.map((a, i) => <div key={labels[i]} className={`amp-col ${highlight === labels[i] ? "marked" : ""}`}>
        <div className="amp-half up"><span className="amp-bar" style={{ height: `${Math.max(0, a) * 100}%` }} /></div>
        <div className="amp-half down"><span className="amp-bar negative" style={{ height: `${Math.max(0, -a) * 100}%` }} /></div>
      </div>)}
      {mean && <span className="amp-mean" style={{ top: `${50 - average * 50}%` }} aria-hidden="true"><span className="amp-mean-tag">{t("average")} {amplitudeText(average)}</span></span>}
    </div>
    <div className="amp-labels" style={{ gridTemplateColumns: `repeat(${amps.length}, minmax(0, 1fr))` }}>
      {labels.map((label, i) => <span key={label}>
        <span className="qubit-ket">|{label}⟩</span>
        <strong className={amps[i] < -1e-6 ? "text-accent-amber" : "text-accent-teal"}>{amplitudeText(amps[i])}</strong>
        <span className="text-stage-muted">{percent(probs[i])}</span>
      </span>)}
    </div>
  </div>;
}

/** A column of the circuit: one box across every wire, or single-wire pieces. */
interface Column { span: RegOp | null; wire: (WirePiece | null)[] }
const emptyColumns = (slots: number, qubits: number): Column[] => Array.from({ length: slots }, () => ({ span: null, wire: Array(qubits).fill(null) }));
const WIRE_OP: Record<WirePiece, string> = { X: "X", Z: "Z", h: "h", CX: "CX" };
const columnOps = (column: Column): RegOp[] => (column.span ? [column.span] : column.wire.flatMap((piece, i) => (piece ? [`${WIRE_OP[piece]}${i + 1}` as RegOp] : [])));
const isWirePiece = (piece: RegPiece): piece is WirePiece => (WIRE_PIECES as string[]).includes(piece);
const WIRE_LABEL: Record<WirePiece, string> = { X: "X gate · flip", Z: "Z gate · sign", h: "H gate · one wire", CX: "CNOT · flips the helper" };
const WIRE_GLYPH: Record<WirePiece, string> = { X: "X", Z: "Z", h: "H", CX: "●" };
const WIRE_CLASS: Record<WirePiece, string> = { X: "pauli-x", Z: "pauli-z", h: "hadamard", CX: "reg-control" };
const pieceLabel = (piece: RegPiece) => (isWirePiece(piece) ? WIRE_LABEL[piece] : opLabel(piece));
const pieceGlyph = (piece: RegPiece) => (isWirePiece(piece) ? WIRE_GLYPH[piece] : opGlyph(piece));
const pieceClass = (piece: RegPiece) => (isWirePiece(piece) ? WIRE_CLASS[piece] : opClass(piece));
const SUBSCRIPTS = "₀₁₂₃₄";

/**
 * Several-qubit bench, drawn like a real circuit: one wire per qubit. X, Z, a
 * one-wire H and a CNOT's control dot go on a single wire; the H box, the
 * Oracle and the Diffuser cover every wire of their column. On a bench with a
 * helper, the last wire is the helper: every CNOT and the ghost flip it.
 */
export function RegisterBench({ step, onSolved }: { step: RegisterStep; onSolved: () => void }) {
  useLocale((state) => state.locale);
  const [columns, setColumns] = useState<Column[]>(() => emptyColumns(step.slots, step.qubits));
  const [selected, setSelected] = useState<RegPiece | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fixed = step.fixed ?? [];
  const ops = [...columns.flatMap(columnOps), ...fixed];
  const start = startRegister(step.qubits, step.start);
  const states = traceReg(start, ops);
  const final = states.at(-1)!;
  const marked = "marked" in step.target ? step.target.marked : undefined;
  const wires = Array.from({ length: step.qubits }, (_, q) => q);
  const helper = step.helper ? step.qubits - 1 : -1;
  const startKets = step.start === "even" ? wires.map(() => "|+⟩") : [...step.start].map((bit) => `|${bit}⟩`);
  const outputs = step.helper ? wireStates(final) : null;

  function update(next: Column[]) { setColumns(next); setMessage(null); }
  function place(c: number, q: number, piece = selected) {
    const next = columns.map((column) => ({ span: column.span, wire: [...column.wire] }));
    const column = next[c];
    const hasControl = column.wire.includes("CX");
    if (!piece) {
      // Tap with nothing selected: remove what is there. The ⊕ on the helper belongs to the CNOTs in its column.
      if (column.span) column.span = null;
      else if (q === helper && hasControl) column.wire = column.wire.map((p) => (p === "CX" ? null : p));
      else column.wire[q] = null;
      update(next); return;
    }
    if (isWirePiece(piece)) {
      if (piece === "CX" && q === helper) { gameAudio.playSfx("error"); setMessage("A CNOT’s control dot goes on a data wire. Its ⊕ lands on the helper by itself."); return; }
      column.span = null;
      column.wire[q] = piece;
      // A CNOT uses the helper wire of its column, so nothing else can sit there.
      if (piece === "CX") column.wire[helper] = null;
      else if (q === helper && hasControl) column.wire = column.wire.map((p, i) => (p === "CX" ? null : i === q ? piece : p));
    } else { column.span = piece; column.wire = column.wire.map(() => null); }
    gameAudio.playSfx("select");
    update(next); setSelected(null);
  }
  function run() {
    if (step.fill && columns.some((column) => !columnOps(column).length)) { gameAudio.playSfx("error"); setMessage("Fill every slot on the line before running."); return; }
    if (solvesReg(step, ops)) { gameAudio.playSynth("chime"); onSolved(); return; }
    gameAudio.playSfx("error");
    setMessage(`Your register ends at ${formatReg(final)}. Goal: ${t(step.goal)}`);
  }
  const wireName = (q: number) => (q === helper ? t("helper") : `q${SUBSCRIPTS[q + 1]}`);
  const cellLabel = (c: number, q: number) => `${t("Wire")} ${wireName(q)} · ${t("slot")} ${c + 1}`;
  const targets = Object.fromEntries(columns.flatMap((_, c) => wires.map((q) => [`cell-${c}-${q}`, cellLabel(c, q)])));
  const hasHelper = helper >= 0;

  return <PuzzleDragDrop labels={Object.fromEntries(step.tray.map((piece) => [piece, t(pieceLabel(piece))]))} targets={targets}
    onPlace={(target, piece) => { const [, c, q] = target.split("-"); place(Number(c), Number(q), piece as RegPiece); }}
    renderPreview={(piece) => <span className="coin-operation-tool"><span className={`qiskit-gate ${pieceClass(piece as RegPiece)}`}>{pieceGlyph(piece as RegPiece)}</span><span>{t(pieceLabel(piece as RegPiece))}</span></span>}>
    <div className="coin-challenge space-y-3">
      <p>{t(step.text)}</p>
      <div className="coin-block-tray" aria-label={t("Register pieces")}>
        {step.tray.map((piece) => <PuzzlePiece key={piece} id={piece} label={t(pieceLabel(piece))} className="coin-operation-tool"
          selected={selected === piece} onSelect={() => setSelected(selected === piece ? null : piece)}>
          <span className={`qiskit-gate ${pieceClass(piece)}`}>{pieceGlyph(piece)}</span><span>{t(pieceLabel(piece))}</span>
        </PuzzlePiece>)}
      </div>
      <div className="qiskit-circuit" role="group" aria-label={t("Register line editor")}>
        <div className="reg-grid" style={{ gridTemplateColumns: `${hasHelper ? 96 : 68}px repeat(${step.slots + fixed.length}, minmax(58px, 1fr))${outputs ? " 52px" : ""}`, gridTemplateRows: `repeat(${step.qubits}, 64px)` }}>
          {wires.map((q) => <span key={`label-${q}`} className="reg-label" style={{ gridRow: q + 1, gridColumn: 1 }}>{wireName(q)} <small>{startKets[q]}</small></span>)}
          {wires.map((q) => <span key={`wire-${q}`} className="reg-wire" style={{ gridRow: q + 1, gridColumn: `2 / ${step.slots + fixed.length + 2}` }} aria-hidden="true" />)}
          {columns.map((column, c) => {
            if (column.span) return <div key={`span-${c}`} className="reg-square" style={{ gridColumn: c + 2, gridRow: `1 / span ${step.qubits}` }}>
              {/* A box across every wire fills the whole column. */}
              <PuzzleSlot id={`cell-${c}-0`} className="reg-cell filled" onSelect={() => place(c, 0)} label={`${t("slot")} ${c + 1}: ${t(opLabel(column.span))}`}>
                <span className={`qiskit-gate reg-span ${opClass(column.span)}`}>{opGlyph(column.span)}<small className="reg-span-name">{t(spanName(column.span))}
                  {column.span.startsWith("oracle:") && <><br />|{column.span.slice(7)}⟩</>}
                  {column.span.startsWith("ghost:") && <><br />{t("the ghost")}</>}</small></span>
              </PuzzleSlot>
            </div>;
            const controls = column.wire.flatMap((piece, q) => (piece === "CX" ? [q] : []));
            return [
              ...(controls.length ? [<span key={`link-${c}`} className="reg-link" style={{ gridColumn: c + 2, gridRow: `${controls[0] + 1} / ${helper + 2}` }} aria-hidden="true" />] : []),
              ...wires.map((q) => {
                const piece = column.wire[q];
                const target = q === helper && controls.length > 0;
                return <div key={`cell-${c}-${q}`} className="reg-square" style={{ gridColumn: c + 2, gridRow: q + 1 }}>
                  <PuzzleSlot id={`cell-${c}-${q}`} className={`reg-cell ${piece || target ? "filled" : ""}`} onSelect={() => place(c, q)}
                    label={`${cellLabel(c, q)}: ${target ? t("CNOT target · flips the helper") : piece ? t(WIRE_LABEL[piece]) : t("Empty")}`}>
                    {target ? <span className="reg-target" aria-hidden="true">⊕</span>
                      : piece ? <span className={`qiskit-gate ${WIRE_CLASS[piece]}`}>{WIRE_GLYPH[piece]}</span> : <span className="qiskit-empty">{c + 1}</span>}
                  </PuzzleSlot>
                </div>;
              }),
            ];
          })}
          {fixed.map((op, i) => <div key={`fixed-${i}`} className="reg-square" style={{ gridColumn: step.slots + i + 2, gridRow: `1 / span ${step.qubits}` }}
            role="img" aria-label={`${t("Fixed on the bench")}: ${t(opLabel(op))}`}>
            <span className={`qiskit-gate reg-span reg-fixed ${opClass(op)}`}>{opGlyph(op)}<small className="reg-span-name">{t(spanName(op))}{op.startsWith("ghost:") && <><br />{t("the ghost")}</>}</small></span>
          </div>)}
          {outputs && wires.map((q) => <span key={`out-${q}`} className="reg-out" style={{ gridRow: q + 1, gridColumn: step.slots + fixed.length + 2 }}>{WIRE_KET[outputs[q]]}</span>)}
        </div>
      </div>
      <p className="text-xs text-stage-muted">{t(hasHelper
        ? "X, Z, H and a CNOT’s control dot sit on one wire; every CNOT flips the helper, the bottom wire. The H box and the Oracle cover every wire. Tap a placed piece with nothing selected to remove it."
        : "X sits on one wire. The H box, the Oracle and the Diffuser cover every wire. Tap a placed piece with nothing selected to remove it.")}</p>
      {hasHelper && <p className="text-xs text-stage-muted" aria-live="polite">{outputs
        ? `${t("Each wire now")}: ${wires.map((q) => `${wireName(q)} ${WIRE_KET[outputs[q]]}`).join(" · ")}`
        : t("The wires are tangled together: no single state per wire.")}</p>}
      <p className="qubit-trace" aria-label={t("Register after each piece")}>
        {states.map((state, i) => <span key={i}>{i > 0 && <span className="qubit-arrow"> —{t(traceName(ops[i - 1]))}→ </span>}<span className="qubit-ket">{formatReg(state)}</span></span>)}
      </p>
      <AmplitudeBars amps={final} mean={ops.includes("D")} highlight={marked} />
      <p className="text-xs text-stage-muted">{t("Goal")}: {t(step.goal)}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => { update(emptyColumns(step.slots, step.qubits)); setSelected(null); }}>{t("Clear line")}</button>
        <button className="btn-primary" onClick={run}>{t("Run the register")}</button>
      </div>
      {message && <p role="status" className="text-accent-amber">{t(message)}</p>}
    </div>
  </PuzzleDragDrop>;
}

const MAX_ROUNDS = 5;

/** Choose a round count; the bars follow it. Solved when the marked bar is at its peak. */
export function RoundsDial({ step, onSolved }: { step: RoundsStep; onSolved: () => void }) {
  useLocale((state) => state.locale);
  const [rounds, setRounds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const ops: RegOp[] = ["H"];
  for (let i = 0; i < rounds; i++) ops.push(`oracle:${step.marked}`, "D");
  const amps = traceReg(startRegister(step.qubits, "0".repeat(step.qubits)), ops).at(-1)!;
  const odds = groverOdds(step.qubits, step.marked, rounds);
  function set(value: number) { setRounds(Math.max(0, Math.min(MAX_ROUNDS, value))); setMessage(null); }
  function stop() {
    if (rounds === step.answer) { gameAudio.playSynth("chime"); onSolved(); return; }
    gameAudio.playSfx("error");
    setMessage(rounds < step.answer ? "Still climbing: another round makes the marked bar taller." : "Past the top: the marked bar is shrinking again. Turn back.");
  }
  return <div className="coin-challenge space-y-3">
    <p>{t(step.text)}</p>
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label={t("Grover rounds")}>
      <button className="btn-ghost" onClick={() => set(rounds - 1)} disabled={rounds === 0} aria-label={t("One round fewer")}>−</button>
      <span className="text-lg text-accent-amber" aria-live="polite">{rounds} {t(rounds === 1 ? "round" : "rounds")}</span>
      <button className="btn-ghost" onClick={() => set(rounds + 1)} disabled={rounds === MAX_ROUNDS} aria-label={t("One round more")}>+</button>
      <span className="text-sm">{t("Chance of")} <span className="qubit-ket">|{step.marked}⟩</span>: <strong className="text-accent-teal">{percent(odds)}</strong></span>
    </div>
    <p className="text-xs text-stage-muted">{t("Each round is one Oracle and one Diffuser, after the H box.")}</p>
    <AmplitudeBars amps={amps} highlight={step.marked} />
    <button className="btn-primary" onClick={stop}>{t("Stop here")}</button>
    {message && <p role="status" className="text-accent-amber">{t(message)}</p>}
  </div>;
}
