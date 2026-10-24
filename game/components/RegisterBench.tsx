"use client";
import { addComponentLabel } from "@/game/circuitLabels";

import { AmplitudeBars } from "./AmplitudeBars";
import { CircuitActions } from "./CircuitActions";
import { CircuitHistogram } from "./CircuitHistogram";
import { useRegisterRun } from "./useRegisterRun";
import { useState } from "react";
import { ExperimentFlow } from "./ExperimentFlow";
import { ExperimentControlCard } from "./ExperimentControlCard";
import { PuzzleDragDrop, PuzzlePiece } from "./PuzzleDragDrop";
import type { RegisterStep } from "@/content/knowledge";
import {
  formatReg,
  solvesReg,
  startRegister,
  traceReg,
  wireStates,
  WIRE_KET,
  type RegPiece,
} from "@/game/register";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";

import {
  emptyColumns,
  columnOps,
  type RegisterColumn,
} from "@/game/registerColumns";
import { RegisterCircuit } from "./RegisterCircuit";
import {
  isWirePiece,
  pieceClass,
  pieceGlyph,
  pieceLabel,
  traceName,
  SUBSCRIPTS,
} from "./registerPresentation";
export { RoundsDial } from "./RoundsDial";

/**
 * Several-qubit bench, drawn like a real circuit: one wire per qubit. X, Z, a
 * one-wire H and a CNOT's control dot go on a single wire; the H box, the
 * Oracle and the Diffuser cover every wire of their column. On a bench with a
 * helper, the last wire is the helper: every CNOT and the ghost flip it.
 */
export function RegisterBench({
  step,
  onSolved,
  onEdited,
  onBusyChange,
}: {
  step: RegisterStep;
  onSolved: () => void;
  onEdited?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  useLocale((state) => state.locale);
  const [columns, setColumns] = useState<RegisterColumn[]>(() =>
    emptyColumns(step.slots, step.qubits),
  );
  const [selected, setSelected] = useState<RegPiece | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const experiment = useRegisterRun(onBusyChange);
  const fixed = step.fixed ?? [];
  const ops = [...columns.flatMap(columnOps), ...fixed];
  const successful = !!experiment.reading && solvesReg(step, ops);
  const start = startRegister(step.qubits, step.start);
  const states = traceReg(start, ops);
  const final = states.at(-1)!;
  const marked = "marked" in step.target ? step.target.marked : undefined;
  const wires = Array.from({ length: step.qubits }, (_, q) => q);
  const helper = step.helper ? step.qubits - 1 : -1;
  const outputs = step.helper ? wireStates(final) : null;

  function update(next: RegisterColumn[]) {
    if (experiment.running.current) return;
    setColumns(next);
    setMessage(null);
    experiment.clear();
    onEdited?.();
  }
  function place(c: number, q: number, piece = selected) {
    if (experiment.running.current) return;
    const next = columns.map((column) => ({
      span: column.span,
      wire: [...column.wire],
    }));
    const column = next[c];
    const hasControl = column.wire.includes("CX");
    if (!piece) {
      // Tap with nothing selected: remove what is there. The ⊕ on the helper belongs to the CNOTs in its column.
      if (column.span) column.span = null;
      else if (q === helper && hasControl)
        column.wire = column.wire.map((p) => (p === "CX" ? null : p));
      else column.wire[q] = null;
      update(next);
      return;
    }
    if (isWirePiece(piece)) {
      if (piece === "CX" && q === helper) {
        gameAudio.playSfx("error");
        setMessage(
          "A CNOT’s control dot goes on a data wire. Its ⊕ lands on the helper by itself.",
        );
        return;
      }
      column.span = null;
      column.wire[q] = piece;
      // A CNOT uses the helper wire of its column, so nothing else can sit there.
      if (piece === "CX") column.wire[helper] = null;
      else if (q === helper && hasControl)
        column.wire = column.wire.map((p, i) =>
          p === "CX" ? null : i === q ? piece : p,
        );
    } else {
      column.span = piece;
      column.wire = column.wire.map(() => null);
    }
    gameAudio.playSfx("select");
    update(next);
    setSelected(null);
  }
  async function run() {
    if (experiment.running.current) return;
    setMessage(null);
    if (step.fill && columns.some((column) => !columnOps(column).length)) {
      gameAudio.playSfx("error");
      setMessage("Fill every slot on the line before running.");
      return;
    }
    if (!(await experiment.run(step.qubits, step.start, ops))) return;
    if (solvesReg(step, ops)) {
      gameAudio.playSynth("chime");
      onSolved();
      return;
    }
    gameAudio.playSfx("error");
    setMessage(
      `Your register ends at ${formatReg(final)}. Goal: ${t(step.goal)}`,
    );
  }
  const wireName = (q: number) =>
    q === helper ? t("helper") : `q${SUBSCRIPTS[q + 1]}`;
  const cellLabel = (c: number, q: number) =>
    `${t("Wire")} ${wireName(q)} · ${t("slot")} ${c + 1}`;
  const targets = Object.fromEntries(
    columns.flatMap((_, c) =>
      wires.map((q) => [`cell-${c}-${q}`, cellLabel(c, q)]),
    ),
  );
  const hasHelper = helper >= 0;
  const helperHint =
    "X, Z, H and a CNOT’s control dot sit on one wire; every CNOT flips the helper, the bottom wire. The H box and the Oracle cover every wire. Tap a placed piece with nothing selected to remove it.";

  const reference = (
    <>
      <p className="qubit-trace" aria-label={t("Register after each piece")}>
        {states.map((state, i) => (
          <span key={i}>
            {i > 0 && (
              <span className="qubit-arrow">
                {" "}
                —{t(traceName(ops[i - 1]))}→{" "}
              </span>
            )}
            <span className="qubit-ket">{formatReg(state)}</span>
          </span>
        ))}
      </p>
      {hasHelper && (
        <section
          className="panel p-3 space-y-2"
          aria-label={t("Ideal wire states before measurement")}
        >
          <p className="text-sm text-accent-teal">
            {t("Ideal wire states before measurement")}
          </p>
          {outputs ? (
            <div className="flex flex-wrap gap-2">
              {outputs.map((state, q) => (
                <span key={q} className="coin-badge">
                  {wireName(q)} {WIRE_KET[state]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm">
              {t("The wires are tangled together: no single state per wire.")}
            </p>
          )}
          <p className="text-xs text-stage-muted">
            {t(
              "Measuring in 0/1 does not reveal a relative minus sign. H can turn that sign into a different reading.",
            )}
          </p>
        </section>
      )}
      <AmplitudeBars amps={final} mean={ops.includes("D")} highlight={marked} />
      <p className="text-xs text-stage-muted">
        {t("Goal")}: {t(step.goal)}
      </p>
    </>
  );
  const palette = (
    <div className="coin-block-tray" aria-label={t("Register pieces")}>
      {step.tray.map((piece) => (
        <PuzzlePiece
          key={piece}
          id={piece}
          label={addComponentLabel(t(pieceLabel(piece)))}
          className="coin-operation-tool"
          selected={selected === piece}
          onSelect={() => setSelected(selected === piece ? null : piece)}
        >
          <span className={`qiskit-gate ${pieceClass(piece)}`}>
            {pieceGlyph(piece)}
          </span>
          <span>{t(pieceLabel(piece))}</span>
        </PuzzlePiece>
      ))}
    </div>
  );
  function clear() {
    update(emptyColumns(step.slots, step.qubits));
    setSelected(null);
  }
  return (
    <ExperimentFlow
      text={step.text}
      measurement={experiment.reading}
      busy={experiment.busy}
    >
      {(view) => (
        <>
          {view === "math" && reference}
          {view === "run" && (
            <fieldset disabled={experiment.busy} className="space-y-3 min-w-0">
              <p className="text-sm text-stage-muted">
                {t(
                  hasHelper
                    ? "This practice measures the data wires and the helper, in that order. The full Ghost Key circuit reads only the data wires. Run sends this circuit to the backend; editing does not execute it."
                    : "M measures every wire after your boxes. Run sends this circuit to the backend; editing does not execute it.",
                )}
              </p>
              <p className="text-accent-teal">256 {t("shots")}</p>

              <ExperimentControlCard icon="▦" title="Prepare">
                <p className="qubit-ket">{formatReg(start)}</p>
                <p className="text-sm">
                  {t("Goal")}: {t(step.goal)}
                </p>
              </ExperimentControlCard>
              <PuzzleDragDrop
                wholeBlockDrag
                labels={Object.fromEntries(
                  step.tray.map((piece) => [
                    piece,
                    addComponentLabel(t(pieceLabel(piece))),
                  ]),
                )}
                targets={targets}
                onPlace={(target, piece) => {
                  const [, c, q] = target.split("-");
                  place(Number(c), Number(q), piece as RegPiece);
                }}
                renderPreview={(piece) => (
                  <span
                    className={`qiskit-gate ${pieceClass(piece as RegPiece)}`}
                  >
                    {pieceGlyph(piece as RegPiece)}
                  </span>
                )}
              >
                {palette}
                <div
                  className={`circuit-workspace ${successful ? "" : "has-actions"}`}
                >
                  <RegisterCircuit
                    step={step}
                    columns={columns}
                    onPlace={place}
                    showMeasurement
                  />
                  {!successful && (
                    <CircuitActions
                      busy={experiment.busy}
                      clearLabel="Clear line"
                      onClear={clear}
                      runLabel="Run the register"
                      onRun={() => void run()}
                    />
                  )}
                </div>
              </PuzzleDragDrop>
              <p className="text-xs text-stage-muted">
                {t(
                  hasHelper
                    ? helperHint
                    : "X sits on one wire. The H box, the Oracle and the Diffuser cover every wire. Tap a placed piece with nothing selected to remove it.",
                )}
              </p>
              {successful && (
                <p className="text-sm text-accent-teal">
                  {t(
                    "Your measurements are saved. Edit the circuit to try something different.",
                  )}
                </p>
              )}
            </fieldset>
          )}
          {view === "results" && experiment.reading && (
            <>
              <CircuitHistogram {...experiment.reading} />
              {hasHelper && (
                <p className="text-xs text-stage-muted">
                  {t(
                    "Read bitstrings from top wire to bottom wire; the last digit is the helper. Counts come from the backend. Wire states and signed amplitudes are ideal references.",
                  )}
                </p>
              )}
              <details className="panel p-3">
                <summary className="cursor-pointer text-accent-teal">
                  {t("Explore the ideal amplitudes")}
                </summary>
                <div className="space-y-3 mt-3">{reference}</div>
              </details>
              <p className="text-xs text-stage-muted">
                {t(
                  "The card checks the ideal circuit. Noise changes measurements, not the lesson’s goal.",
                )}
              </p>
            </>
          )}
          {message && (
            <p role="status" className="text-accent-amber">
              {t(message)}
            </p>
          )}
          {experiment.busy && (
            <p role="status">{t("Asking the quantum core…")}</p>
          )}
          {experiment.error && (
            <p role="alert" className="text-actor-hacker">
              {t(experiment.error)}
            </p>
          )}
        </>
      )}
    </ExperimentFlow>
  );
}
