"use client";

import { useState } from "react";
import { PuzzleDragDrop, PuzzlePiece, PuzzleSlot } from "./PuzzleDragDrop";
import { LaptopChoiceButton, LaptopQuestion } from "./LaptopControls";
import type { BenchStep, QuestionStep } from "@/content/coinTown";
import { KET, STATES, expand, ketName, probabilities, solves, trace, type Gate } from "@/game/qubit";
import { gameAudio } from "@/game/audio";
import { OceanWaves, RippleGraph } from "./InterferenceWaves";
import { AmplitudeBars } from "./RegisterBench";
import { startRegister, traceReg } from "@/game/register";
import { t, useLocale } from "@/i18n";

const GATE_LABELS: Record<Gate, string> = { X: "X gate · flip", Z: "Z gate · sign", H: "Hadamard · H" };
const GATE_CLASS: Record<Gate, string> = { X: "pauli-x", Z: "pauli-z", H: "hadamard" };
const percent = (p: number) => `${Math.round(p * 100)}%`;

/**
 * One-qubit workbench: drag gates onto the wire, then run it. Every case shows
 * the state after each gate and the odds of reading 0 or 1, so the math is on
 * screen the whole time.
 */
export function QubitBench({ step, onSolved }: { step: BenchStep; onSolved: () => void }) {
  useLocale((state) => state.locale);
  const [slots, setSlots] = useState<(Gate | null)[]>(() => Array(step.slots).fill(null));
  const [selected, setSelected] = useState<Gate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ran, setRan] = useState(false);
  const gates = slots.filter((gate): gate is Gate => gate !== null);

  function place(index: number, gate = selected) {
    if (!gate) { if (slots[index]) update(slots.map((g, i) => (i === index ? null : g))); return; }
    update(slots.map((g, i) => (i === index ? gate : g))); setSelected(null);
  }
  function update(next: (Gate | null)[]) { setSlots(next); setMessage(null); setRan(false); }
  function run() {
    setRan(true);
    if (step.fill && gates.length < step.slots) { gameAudio.playSfx("error"); setMessage("Fill every slot on the wire before running."); return; }
    if (solves(step.cases, gates)) { gameAudio.playSynth("chime"); onSolved(); return; }
    gameAudio.playSfx("error");
    const miss = step.cases.find(({ start, target }) => !solves([{ start, target }], gates))!;
    setMessage(`From ${KET[miss.start]} your circuit makes ${ketName(trace(STATES[miss.start], gates).at(-1)!)}; the goal is ${KET[miss.target]}.`);
  }

  return <PuzzleDragDrop labels={Object.fromEntries(step.gates.map((gate) => [gate, t(GATE_LABELS[gate])]))}
    targets={Object.fromEntries(slots.map((_, i) => [`slot-${i}`, `${t("Wire slot")} ${i + 1}`]))}
    onPlace={(slot, gate) => place(Number(slot.slice(5)), gate as Gate)}
    renderPreview={(gate) => <span className="coin-operation-tool"><span className={`qiskit-gate ${GATE_CLASS[gate as Gate]}`}>{gate}</span><span>{t(GATE_LABELS[gate as Gate])}</span></span>}>
    <div className="coin-challenge space-y-3">
      <p>{t(step.text)}</p>
      <div className="coin-block-tray" aria-label={t("Gates")}>
        {step.gates.map((gate) => <PuzzlePiece key={gate} id={gate} label={t(GATE_LABELS[gate])} className="coin-operation-tool"
          selected={selected === gate} onSelect={() => setSelected(selected === gate ? null : gate)}>
          <span className={`qiskit-gate ${GATE_CLASS[gate]}`}>{gate}</span><span>{t(GATE_LABELS[gate])}</span>
        </PuzzlePiece>)}
      </div>
      <div className="qiskit-circuit" role="group" aria-label={t("Single-qubit circuit editor")}>
        <div className="qiskit-register-labels"><span>q₀</span></div>
        <div className="qiskit-tracks">
          <div className="qiskit-quantum-wire" style={{ gridTemplateColumns: `repeat(${step.slots}, minmax(0, 1fr))` }}>
            {slots.map((gate, i) => <PuzzleSlot key={i} id={`slot-${i}`} className={`qiskit-wire-slot ${gate ? "filled" : ""}`} onSelect={() => place(i)}
              label={`${t("Wire slot")} ${i + 1}: ${gate ? t(GATE_LABELS[gate]) : t("Empty")}`}>
              {gate ? <span className={`qiskit-gate ${GATE_CLASS[gate]}`}>{gate}</span> : <span className="qiskit-empty">{i + 1}</span>}
            </PuzzleSlot>)}
          </div>
        </div>
      </div>
      <p className="text-xs text-stage-muted">{t("Tap a placed gate with nothing selected to remove it. Empty slots do nothing.")}</p>
      <div className="qubit-cases">
        {step.cases.map(({ start, target }) => {
          const states = trace(STATES[start], gates);
          const [p0, p1] = probabilities(states.at(-1)!);
          return <div key={start + target} className="qubit-case">
            <p className="qubit-trace" aria-label={t("State after each gate")}>
              {states.map((state, i) => <span key={i}>{i > 0 && <span className="qubit-arrow"> —{gates[i - 1]}→ </span>}<span className="qubit-ket">{i === 0 ? KET[start] : expand(state)}</span></span>)}
            </p>
            <p className="text-xs text-stage-muted">{t("Goal")}: <span className="qubit-ket">{KET[target]}{target === "+" || target === "-" ? ` = ${expand(STATES[target])}` : ""}</span></p>
            <div className="qubit-odds" aria-label={`${t("Measurement odds")}: 0 ${percent(p0)}, 1 ${percent(p1)}`}>
              <span>0</span><span className="qubit-bar"><span style={{ width: percent(p0) }} /></span><span>{percent(p0)}</span>
              <span>1</span><span className="qubit-bar"><span style={{ width: percent(p1) }} /></span><span>{percent(p1)}</span>
            </div>
          </div>;
        })}
      </div>
      {step.waves && (gates.at(-1) === "H"
        ? <RippleGraph from={trace(STATES[step.cases[0].start], gates.slice(0, -1)).at(-1)!} />
        : <p className="text-xs text-accent-teal">{t("Put H in the last slot to see its ripples.")}</p>)}
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => { update(Array(step.slots).fill(null)); setSelected(null); }}>{t("Clear circuit")}</button>
        <button className="btn-primary" onClick={run}>{t("Run circuit")}</button>
      </div>
      {ran && message && <p role="status" className="text-accent-amber">{t(message)}</p>}
    </div>
  </PuzzleDragDrop>;
}

/** Multiple choice; a wrong answer explains itself and can be retried. */
export function BenchQuestion({ step, onSolved }: { step: QuestionStep; onSolved: () => void }) {
  useLocale((state) => state.locale);
  const [picked, setPicked] = useState<number | null>(null);
  const option = picked === null ? null : step.options[picked];
  return <LaptopQuestion prompt={t(step.text)}>
    {step.bars && (() => {
      const before = traceReg(startRegister(step.bars.qubits, step.bars.start), step.bars.ops).at(-1)!;
      return <div className="mb-3 space-y-2">
        <AmplitudeBars amps={before} mean={step.bars.mean} title={step.bars.after ? "Before the press" : undefined} />
        {step.bars.after && option?.correct && <AmplitudeBars amps={traceReg(before, step.bars.after).at(-1)!} title="After the press" legend={false} />}
      </div>;
    })()}
    <div className="coin-choices">{step.options.map((choice, i) => <LaptopChoiceButton key={choice.label} selected={picked === i}
      disabled={!!option?.correct} aria-pressed={picked === i}
      onClick={() => {
        setPicked(i);
        if (choice.correct) { gameAudio.playSynth("chime"); onSolved(); } else gameAudio.playSfx("error");
      }}>{t(choice.label)}</LaptopChoiceButton>)}</div>
    {option && !option.correct && <p role="status" className="mt-3 text-accent-amber">{t(option.wrong ?? "Not quite. Try another answer.")}</p>}
    {step.waves && <div className="mt-3"><OceanWaves from={STATES["+"]} reveal={!!option} /></div>}
  </LaptopQuestion>;
}
