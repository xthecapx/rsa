"use client";

import { useAsyncOperation } from "./useAsyncOperation";
import { useExecution } from "@/lib/execution";
import { useEffect, useId, useRef, useState } from "react";
import { PuzzleDragDrop, PuzzlePiece, PuzzleSlot } from "./PuzzleDragDrop";
import { LaptopChoiceButton, LaptopQuestion } from "./LaptopControls";
import type { BenchStep, QuestionStep } from "@/content/coinTown";
import {
  KET,
  STATES,
  expand,
  ketName,
  probabilities,
  solves,
  trace,
  type Gate,
} from "@/game/qubit";
import { labBloch } from "@/game/labCircuit";
import { gameAudio } from "@/game/audio";
import { OceanWaves, RippleGraph } from "./InterferenceWaves";
import { AmplitudeBars } from "./AmplitudeBars";
import { startRegister, traceReg } from "@/game/register";
import { t, useLocale } from "@/i18n";
import { coinApi, type BenchResult } from "@/lib/coin";
import { CircuitActions } from "./CircuitActions";
import { QubitHistogram } from "./QubitHistogram";
import { BlochSphere } from "./BlochSphere";
import {
  ExperimentSteps,
  EXPERIMENT_STEPS,
  type ExperimentStep,
} from "./ExperimentSteps";
import { ExperimentControlCard } from "./ExperimentControlCard";

const GATE_LABELS: Record<Gate, string> = {
  X: "X gate · flip",
  Z: "Z gate · sign",
  H: "Hadamard · H",
};
const GATE_CLASS: Record<Gate, string> = {
  X: "pauli-x",
  Z: "pauli-z",
  H: "hadamard",
};
const percent = (p: number) => `${Math.round(p * 100)}%`;

function BenchCircuit({
  step,
  slots,
  onPlace,
}: {
  step: BenchStep;
  slots: (Gate | null)[];
  onPlace?: (index: number) => void;
}) {
  return (
    <div
      className="qiskit-circuit"
      role="group"
      aria-label={t(
        onPlace
          ? "Single-qubit circuit editor"
          : "Single-qubit circuit preview",
      )}
    >
      <div className="qiskit-register-labels">
        <span>q₀</span>
      </div>
      <div className="qiskit-tracks">
        <div
          className="qiskit-quantum-wire"
          style={{
            gridTemplateColumns: `repeat(${step.slots + 1}, minmax(0, 1fr))`,
          }}
        >
          {slots.map((gate, index) => {
            const contents = gate ? (
              <span className={`qiskit-gate ${GATE_CLASS[gate]}`}>{gate}</span>
            ) : (
              <span className="qiskit-empty">{index + 1}</span>
            );
            return onPlace ? (
              <PuzzleSlot
                key={index}
                id={`slot-${index}`}
                className={`qiskit-wire-slot ${gate ? "filled" : ""}`}
                onSelect={() => onPlace(index)}
                label={`${t("Wire slot")} ${index + 1}: ${gate ? t(GATE_LABELS[gate]) : t("Empty")}`}
              >
                {contents}
              </PuzzleSlot>
            ) : (
              <span
                key={index}
                className={`qiskit-wire-slot ${gate ? "filled" : ""}`}
              >
                {contents}
              </span>
            );
          })}
          <span
            className="qiskit-wire-slot filled"
            aria-label={t("Measurement after the gates")}
          >
            <span className="qiskit-gate measure">M</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Shared experiment flow; every case keeps its own starting state and returned counts. */
export function QubitBench({
  step,
  onSolved,
  onEdited,
  onBusyChange,
}: {
  step: BenchStep;
  onSolved: () => void;
  onEdited?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  useLocale((state) => state.locale);
  const [view, setView] = useState<ExperimentStep>("math");
  const tabsId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const focusResults = useRef(false);
  const [slots, setSlots] = useState<(Gate | null)[]>(() =>
    Array(step.slots).fill(null),
  );
  const [selected, setSelected] = useState<Gate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<BenchResult | null>(null);
  const operation = useAsyncOperation(onBusyChange);
  const { busy, running: inFlight } = operation;
  const [error, setError] = useState<string | null>(null);
  const gates = slots.filter((gate): gate is Gate => gate !== null);
  const successful = !!result && solves(step.cases, gates);
  useEffect(() => {
    if (focusResults.current && view === "results") {
      if (!useExecution.getState().background) panel.current?.focus();
      focusResults.current = false;
    }
  }, [view]);

  function place(index: number, gate = selected) {
    if (inFlight.current) return;
    if (!gate) {
      if (slots[index]) update(slots.map((g, i) => (i === index ? null : g)));
      return;
    }
    update(slots.map((g, i) => (i === index ? gate : g)));
    setSelected(null);
  }
  function update(next: (Gate | null)[]) {
    if (inFlight.current) return;
    setSlots(next);
    setMessage(null);
    setResult(null);
    setError(null);
    onEdited?.();
  }
  function clear() {
    update(Array(step.slots).fill(null));
    setSelected(null);
  }
  async function run() {
    if (inFlight.current) return;
    setMessage(null);
    setError(null);
    setResult(null);
    if (step.fill && gates.length < step.slots) {
      gameAudio.playSfx("error");
      setMessage("Fill every slot on the wire before running.");
      return;
    }
    return operation.run(
      () =>
        coinApi.circuit(
          step.cases.map(({ start }) => start),
          gates,
        ),
      {
        success(measured) {
          setResult(measured);
          focusResults.current = true;
          setView("results");
          // Correctness comes from the designed state, never from noisy counts.
          if (solves(step.cases, gates)) {
            gameAudio.playSynth("chime");
            onSolved();
            return;
          }
          gameAudio.playSfx("error");
          const miss = step.cases.find(
            ({ start, target }) => !solves([{ start, target }], gates),
          )!;
          setMessage(
            `From ${KET[miss.start]} your circuit makes ${ketName(trace(STATES[miss.start], gates).at(-1)!)}; the goal is ${KET[miss.target]}.`,
          );
        },
        error(cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The experiment could not finish. Check the backend and try again.",
          );
        },
      },
    );
  }
  function idealCases(measured: boolean) {
    return (
      <div className="qubit-cases">
        {step.cases.map(({ start, target }, index) => {
          const states = trace(STATES[start], gates),
            final = states.at(-1)!;
          const [p0, p1] = probabilities(final);
          return (
            <section
              key={start + target}
              className={`qubit-case space-y-3 ${measured ? "measurement-result" : ""}`}
            >
              <h3 className="text-accent-teal">
                {t("Start {state}").replace("{state}", KET[start])} ·{" "}
                {t("Goal")}: {KET[target]}
              </h3>
              {measured && result && (
                <QubitHistogram
                  {...result}
                  {...result.circuits[index]}
                  highlight={false}
                />
              )}
              <p className="text-xs text-accent-teal">
                {t("Ideal state and probabilities")}
              </p>
              <p
                className="qubit-trace"
                aria-label={t("Ideal state after each gate")}
              >
                {states.map((state, i) => (
                  <span key={i}>
                    {i > 0 && (
                      <span className="qubit-arrow"> —{gates[i - 1]}→ </span>
                    )}
                    <span className="qubit-ket">
                      {i === 0 ? KET[start] : expand(state)}
                    </span>
                  </span>
                ))}
              </p>
              {!measured && (
                <p className="text-xs text-stage-muted">
                  {t("Ideal prediction:")} 0 = {percent(p0)} · 1 = {percent(p1)}
                </p>
              )}
              {measured && (
                <BlochSphere
                  vector={labBloch([
                    { re: final.a, im: 0 },
                    { re: final.b, im: 0 },
                  ])}
                  explanation="Ideal state after your gates, before measurement. Backend counts do not reconstruct this state."
                />
              )}
            </section>
          );
        })}
      </div>
    );
  }
  const stageIndex = EXPERIMENT_STEPS.findIndex((stage) => stage.id === view);
  return (
    <div className="space-y-4 min-w-0">
      <ExperimentSteps
        id={tabsId}
        value={view}
        onChange={setView}
        busy={busy}
        hasMeasurements={!!result}
      />
      <p>{t(step.text)}</p>
      <div
        ref={panel}
        id={`${tabsId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${view}`}
        tabIndex={-1}
        className="space-y-3 min-w-0"
      >
        {view === "math" && (
          <>
            {idealCases(false)}
            {step.waves &&
              (gates.at(-1) === "H" ? (
                <RippleGraph
                  from={
                    trace(STATES[step.cases[0].start], gates.slice(0, -1)).at(
                      -1,
                    )!
                  }
                />
              ) : (
                <p className="text-xs text-accent-teal">
                  {t("Put H in the last slot to see its ripples.")}
                </p>
              ))}
          </>
        )}
        {view === "assemble" && (
          <fieldset disabled={busy} className="space-y-3 min-w-0">
            <div className="qubit-preparations">
              {step.cases.map(({ start, target }) => (
                <ExperimentControlCard
                  key={start + target}
                  icon={KET[start]}
                  title="Prepare"
                >
                  <p className="text-sm">
                    {KET[start]}{" "}
                    <span className="text-stage-muted">→ {t("Goal")}: </span>
                    {KET[target]}
                  </p>
                </ExperimentControlCard>
              ))}
            </div>
            {step.cases.length > 1 && (
              <p className="text-xs text-stage-muted">
                {t(
                  "The same gates run once for each starting state, with 256 fresh shots per case.",
                )}
              </p>
            )}
            <PuzzleDragDrop
              wholeBlockDrag
              labels={Object.fromEntries(
                step.gates.map((gate) => [gate, t(GATE_LABELS[gate])]),
              )}
              targets={Object.fromEntries(
                slots.map((_, i) => [
                  `slot-${i}`,
                  `${t("Wire slot")} ${i + 1}`,
                ]),
              )}
              onPlace={(slot, gate) =>
                place(Number(slot.slice(5)), gate as Gate)
              }
              renderPreview={(gate) => (
                <span className={`qiskit-gate ${GATE_CLASS[gate as Gate]}`}>
                  {gate}
                </span>
              )}
            >
              <div className="coin-block-tray" aria-label={t("Gates")}>
                {step.gates.map((gate) => (
                  <PuzzlePiece
                    key={gate}
                    id={gate}
                    label={t(GATE_LABELS[gate])}
                    className="coin-operation-tool"
                    selected={selected === gate}
                    onSelect={() =>
                      setSelected(selected === gate ? null : gate)
                    }
                  >
                    <span className={`qiskit-gate ${GATE_CLASS[gate]}`}>
                      {gate}
                    </span>
                    <span>{t(GATE_LABELS[gate])}</span>
                  </PuzzlePiece>
                ))}
              </div>
              <div
                className={`circuit-workspace ${successful ? "" : "has-actions"}`}
              >
                <BenchCircuit step={step} slots={slots} onPlace={place} />
                {!successful && <CircuitActions busy={busy} onClear={clear} />}
              </div>
            </PuzzleDragDrop>
            <p className="text-xs text-stage-muted">
              {t(
                "Tap a placed gate with nothing selected to remove it. Empty slots do nothing.",
              )}
            </p>
          </fieldset>
        )}
        {view === "run" && (
          <>
            <p className="text-sm text-stage-muted">
              {t(
                "M measures after your gates. Run sends this circuit to the backend; nothing runs while you edit.",
              )}
            </p>
            <p className="text-accent-teal">
              256 {t("shots")}
              {step.cases.length > 1 ? ` × ${step.cases.length}` : ""}
            </p>
            <div
              className={`circuit-workspace ${successful ? "" : "has-actions"}`}
            >
              <BenchCircuit step={step} slots={slots} />
              {!successful && (
                <CircuitActions
                  busy={busy}
                  onClear={() => {
                    clear();
                    setView("assemble");
                  }}
                  onRun={() => void run()}
                />
              )}
            </div>
            {successful && (
              <p className="text-sm text-accent-teal">
                {t(
                  "Your measurements are saved. Edit the circuit to try something different.",
                )}
              </p>
            )}
          </>
        )}
        {view === "results" && result && (
          <>
            {idealCases(true)}
            <p className="text-xs text-stage-muted">
              {t(
                "The exercise checks the ideal circuit you built. Noisy counts do not change whether it is correct.",
              )}
            </p>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setView("assemble")}
            >
              {t("Edit experiment")}
            </button>
          </>
        )}
        {busy && (
          <p role="status" className="text-accent-teal">
            {t("Waiting for backend measurements…")}
          </p>
        )}
        {error && (
          <p role="alert" className="text-accent-amber">
            {t(error)}
          </p>
        )}
        {message && (
          <p role="status" className="text-accent-amber">
            {t(message)}
          </p>
        )}
      </div>
      <nav
        className="flex flex-wrap justify-between gap-2"
        aria-label={t("Step navigation")}
      >
        {stageIndex > 0 && (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => setView(EXPERIMENT_STEPS[stageIndex - 1].id)}
          >
            {t("Previous step")}
          </button>
        )}
        {stageIndex < 2 && (
          <button
            type="button"
            className="btn-primary ml-auto"
            disabled={busy}
            onClick={() => setView(EXPERIMENT_STEPS[stageIndex + 1].id)}
          >
            {t(view === "math" ? "Continue to assembly" : "Continue to run")}
          </button>
        )}
        {view === "run" && result && (
          <button
            type="button"
            className="btn-primary ml-auto"
            disabled={busy}
            onClick={() => setView("results")}
          >
            {t("View measurements")}
          </button>
        )}
      </nav>
    </div>
  );
}

/** Multiple choice; a wrong answer explains itself and can be retried. */
export function BenchQuestion({ step, onSolved, idealReference = false }: { step: QuestionStep; onSolved: () => void; idealReference?: boolean }) {
  useLocale((state) => state.locale);
  const [picked, setPicked] = useState<number | null>(null);
  const option = picked === null ? null : step.options[picked];
  return <LaptopQuestion prompt={t(step.text)}>
    {idealReference && <p className="mb-3 text-xs text-stage-muted">{t("Answer for the ideal circuit. The benches show actual backend counts, which can differ because of sampling or noise.")}</p>}
    {step.bars && (() => {
      const before = traceReg(startRegister(step.bars.qubits, step.bars.start), step.bars.ops).at(-1)!;
      return <div className="mb-3 space-y-2">
        <AmplitudeBars amps={before} mean={step.bars.mean} title={step.bars.after ? step.bars.titles?.[0] ?? "Before" : undefined} />
        {step.bars.after && option?.correct && <AmplitudeBars amps={traceReg(before, step.bars.after).at(-1)!} title={step.bars.titles?.[1] ?? "After"} legend={false} />}
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
