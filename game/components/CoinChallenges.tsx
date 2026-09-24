"use client";

import { useState, type DragEvent } from "react";
import { t, useLocale } from "@/i18n";

export type CodeBlock = "seed" | "reset" | "return";
export type CodeSlot = "setup" | "body";
export type CodeSlots = Record<CodeSlot, CodeBlock | null>;
export const EMPTY_CODE: CodeSlots = { setup: null, body: null };
const CODE_BLOCKS: Record<CodeBlock, string> = {
  seed: "coin = random.Random(42)",
  reset: "coin.seed(42)",
  return: "return coin.randint(0, 1)",
};
const CODE_LABELS: Record<CodeSlot, string> = {
  setup: "Setup · runs once", body: "Inside flip_coin() · return a bit",
};

export type CircuitOperation = "H" | "M";
export type CircuitPosition = "first" | "second";
export type CircuitSlots = Record<CircuitPosition, CircuitOperation | null>;
export const EMPTY_CIRCUIT: CircuitSlots = { first: null, second: null };

export function ChoiceChallenge<T extends string>({ prompt, choices, order, value, onChoose }: {
  prompt: string; choices: Record<T, string>; order: T[]; value: T | null; onChoose: (choice: T) => void;
}) {
  useLocale((state) => state.locale);
  return <div className="coin-challenge"><p className="font-semibold">{t(prompt)}</p>
    <div className="coin-choices">{order.map((id) => <button key={id} type="button"
      className={value === id ? "coin-choice selected" : "coin-choice"} disabled={value !== null}
      aria-pressed={value === id} onClick={() => onChoose(id)}>{t(choices[id])}</button>)}</div>
  </div>;
}

export function CodePuzzle({ slots, order, onChange, onSolved }: {
  slots: CodeSlots; order: CodeBlock[]; onChange: (slots: CodeSlots) => void; onSolved: () => void;
}) {
  useLocale((state) => state.locale);
  const [selected, setSelected] = useState<CodeBlock | null>(null);
  const [history, setHistory] = useState<CodeSlots[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  function update(next: CodeSlots) { setHistory((past) => [...past, slots]); onChange(next); setMessage(null); }
  function place(slot: CodeSlot, block = selected) {
    if (!block) return;
    const next = { ...slots };
    for (const key of Object.keys(next) as CodeSlot[]) if (next[key] === block) next[key] = null;
    next[slot] = block; update(next); setSelected(null);
  }
  function check() {
    if (slots.setup === "reset") setMessage("coin.seed(42) needs an existing generator. Create coin once above the function.");
    else if (slots.setup !== "seed") setMessage("Put the generator setup outside flip_coin(), so it runs only once.");
    else if (slots.body === "reset") setMessage("coin.seed(42) inside flip_coin() would restart the sequence on every call and return no bit.");
    else if (slots.body !== "return") setMessage("Inside flip_coin(), return the next bit from coin.");
    else onSolved();
  }
  return <div className="coin-challenge space-y-3">
    <p>{t("Build the program. Select or drag a line into a slot; then check it.")}</p>
    <div className="coin-block-tray" aria-label={t("Available code lines")}>{order.map((id) => <button key={id} type="button" draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", id)}
      onClick={() => setSelected(id)} aria-pressed={selected === id}
      className={selected === id ? "coin-block selected" : "coin-block"}>{CODE_BLOCKS[id]}</button>)}</div>
    <div className="coin-code-scaffold"><code>import random</code>
      {(Object.keys(CODE_LABELS) as CodeSlot[]).map((slot) => <div key={slot} className={`coin-slot-row ${slot}`}>
        {slot === "body" && <code>def flip_coin():</code>}
        <span>{t(CODE_LABELS[slot])}</span>
        <button type="button" className="coin-drop-slot" onClick={() => place(slot)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); if (id === "seed" || id === "reset" || id === "return") place(slot, id); }}
          aria-label={`${t(CODE_LABELS[slot])}: ${slots[slot] ? CODE_BLOCKS[slots[slot]] : t("Empty")}`}>
          <code>{slots[slot] ? CODE_BLOCKS[slots[slot]] : t("Tap to place selected line")}</code>
        </button>
      </div>)}</div>
    <div className="flex flex-wrap gap-2"><button className="btn-ghost" disabled={!history.length} onClick={() => { onChange(history.at(-1)!); setHistory((past) => past.slice(0, -1)); setMessage(null); }}>{t("Undo")}</button>
      <button className="btn-ghost" onClick={() => update(EMPTY_CODE)}>{t("Reset")}</button>
      <button className="btn-ghost" onClick={() => setMessage("Hint: create coin once above the function. Inside flip_coin(), only return its next bit.")}>{t("Hint")}</button>
      <button className="btn-primary" onClick={check}>{t("Check program")}</button></div>
    {message && <p role="status" className="text-accent-amber">{t(message)}</p>}
  </div>;
}

function MeasurementIcon() {
  return <svg viewBox="0 0 36 36" width="34" height="34" aria-hidden="true" focusable="false">
    <path d="M5 25a13 13 0 0 1 26 0" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <path d="m18 24 8-11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="18" cy="24" r="2" fill="currentColor" />
  </svg>;
}

export function CircuitSnapshot({ hadamard }: { hadamard: boolean }) {
  useLocale((state) => state.locale);
  return <div className="qiskit-circuit" role="img" aria-label={t(hadamard ? "Prepare zero, Hadamard gate, measure" : "Prepare zero, measure")}>
    <div className="qiskit-register-labels"><span>q₀ <small>|0⟩</small></span><span>c₀</span></div>
    <div className="qiskit-tracks">
      <div className={`qiskit-quantum-wire ${hadamard ? "" : "single"}`}>
        {hadamard && <span className="qiskit-gate hadamard">H</span>}
        <span className="qiskit-gate measure"><MeasurementIcon /></span>
      </div>
      <div className="qiskit-classical-wire" />
      <span className={`qiskit-measure-link ${hadamard ? "second" : "middle"}`} aria-hidden="true" />
    </div>
  </div>;
}

export function CircuitPuzzle({ slots, onChange, onSolved }: { slots: CircuitSlots; onChange: (slots: CircuitSlots) => void; onSolved: () => void }) {
  useLocale((state) => state.locale);
  const [selected, setSelected] = useState<CircuitOperation | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  function place(position: CircuitPosition, operation = selected) {
    if (!operation) return;
    const next = { ...slots };
    for (const key of ["first", "second"] as const) if (next[key] === operation) next[key] = null;
    next[position] = operation;
    onChange(next); setSelected(null); setMessage(null);
  }
  const drop = (position: CircuitPosition) => ({
    onDragOver: (event: DragEvent) => event.preventDefault(),
    onDrop: (event: DragEvent) => {
      event.preventDefault(); const operation = event.dataTransfer.getData("text/plain");
      if (operation === "H" || operation === "M") place(position, operation);
    },
  });
  function hint() {
    if (slots.first === "M" && slots.second === "H")
      setMessage("H after measurement cannot change a result that was already read. Swap the operations.");
    else if (slots.first === "M" || (slots.second === "M" && !slots.first))
      setMessage("Measuring |0⟩ without H always returns zero. Add H before measurement to make both outcomes possible.");
    else if (slots.first === "H" && !slots.second) setMessage("Add measurement after H so the circuit produces a bit.");
    else setMessage("Build the circuit from left to right: prepare |0⟩, apply H, then measure.");
  }
  function check() {
    if (slots.first === "H" && slots.second === "M") onSolved();
    else hint();
  }
  const codeLines = ["circuit = QuantumCircuit(1, 1)"];
  for (const operation of [slots.first, slots.second]) {
    if (operation === "H") codeLines.push("circuit.h(0)");
    if (operation === "M") codeLines.push("circuit.measure(0, 0)");
  }
  return <div className="coin-challenge space-y-3">
    <p>{t("Build a one-qubit circuit. Select or drag H and measurement onto the wire in the order they should run.")}</p>
    <div className="coin-block-tray" aria-label={t("Circuit operations")}>
      {(["H", "M"] as const).map((operation) => <button key={operation} type="button" draggable
        className={selected === operation ? "coin-block selected coin-operation-tool" : "coin-block coin-operation-tool"}
        onDragStart={(event) => event.dataTransfer.setData("text/plain", operation)}
        onClick={() => setSelected(operation)} aria-pressed={selected === operation}>
        <span className={`qiskit-gate ${operation === "H" ? "hadamard" : "measure"}`}>{operation === "H" ? "H" : <MeasurementIcon />}</span>
        <span>{t(operation === "H" ? "Hadamard · H" : "Measurement · M")}</span>
      </button>)}
    </div>
    <div className="qiskit-circuit" role="group" aria-label={t("Single-qubit circuit editor")}>
      <div className="qiskit-register-labels"><span>q₀ <small>|0⟩</small></span><span>c₀</span></div>
      <div className="qiskit-tracks">
        <div className="qiskit-quantum-wire">
          {(["first", "second"] as const).map((position, index) => <button key={position} type="button"
            className={`qiskit-wire-slot ${slots[position] ? "filled" : ""}`}
            {...drop(position)} onClick={() => place(position)}
            aria-label={`${t(index === 0 ? "First operation" : "Second operation")}: ${slots[position] ? t(slots[position] === "H" ? "Hadamard" : "Measurement") : t("Empty")}`}>
            {slots[position] === "H" ? <span className="qiskit-gate hadamard">H</span>
              : slots[position] === "M" ? <span className="qiskit-gate measure"><MeasurementIcon /></span>
                : <span className="qiskit-empty">{index + 1}</span>}
          </button>)}
        </div>
        <div className="qiskit-classical-wire" />
        {(["first", "second"] as const).map((position) => slots[position] === "M" && <span key={position}
          className={`qiskit-measure-link ${position}`} aria-hidden="true" />)}
      </div>
    </div>
    <p className="text-sm text-stage-muted">{t("The top wire carries the qubit. Measurement writes its result to the classical bit below.")}</p>
    <pre>{codeLines.join("\n")}</pre>
    <div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={() => { onChange({ ...EMPTY_CIRCUIT }); setSelected(null); setMessage(null); }}>{t("Clear circuit")}</button>
      <button className="btn-ghost" onClick={hint}>{t("Hint")}</button>
      <button className="btn-primary" onClick={check}>{t("Check circuit")}</button></div>
    {message && <p role="status" className="text-accent-amber">{t(message)}</p>}
  </div>;
}
