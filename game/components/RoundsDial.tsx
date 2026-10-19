"use client";
import { useState } from "react";
import { AmplitudeBars } from "./AmplitudeBars";
import { CircuitActions } from "./CircuitActions";
import { CircuitHistogram } from "./CircuitHistogram";
import { useRegisterRun } from "./useRegisterRun";
import { ExperimentFlow } from "./ExperimentFlow";
import { ExperimentControlCard } from "./ExperimentControlCard";
import type { RoundsStep } from "@/content/knowledge";
import {
  groverOdds,
  startRegister,
  traceReg,
  type RegOp,
} from "@/game/register";
import { SUBSCRIPTS } from "./registerPresentation";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";
const percent = (p: number) => `${Math.round(p * 1000) / 10}%`;

const MAX_ROUNDS = 5;

/** The repeat box is a circuit instruction: H once, then Oracle → Diffuser n times. */
function RoundsCircuit({ step, rounds }: { step: RoundsStep; rounds: number }) {
  return (
    <div
      className="qiskit-circuit"
      role="group"
      aria-label={t("Grover circuit preview")}
    >
      <p className="text-sm text-center mb-2">
        {t("Repeat")}: {rounds} {t(rounds === 1 ? "round" : "rounds")}
      </p>
      <div
        className="reg-grid"
        style={{
          gridTemplateColumns: "68px repeat(4, minmax(65px, 1fr))",
          gridTemplateRows: `repeat(${step.qubits}, 64px)`,
        }}
      >
        {Array.from({ length: step.qubits }, (_, q) => (
          <span
            key={`label-${q}`}
            className="reg-label"
            style={{ gridColumn: 1, gridRow: q + 1 }}
          >
            q{SUBSCRIPTS[q + 1]} <small>|0⟩</small>
          </span>
        ))}
        {Array.from({ length: step.qubits }, (_, q) => (
          <span
            key={`wire-${q}`}
            className="reg-wire"
            style={{ gridColumn: "2 / 6", gridRow: q + 1 }}
            aria-hidden="true"
          />
        ))}
        <span
          className="reg-square"
          style={{ gridColumn: 2, gridRow: `1 / span ${step.qubits}` }}
        >
          <span className="qiskit-gate reg-span hadamard">
            H<small className="reg-span-name">{t("H box")}</small>
          </span>
        </span>
        <div
          className="foundry-repeat-box"
          style={{ gridColumn: "3 / 5", gridRow: `1 / span ${step.qubits}` }}
          aria-label={`${t("Repeat")}: ${rounds}`}
        >
          <span className="foundry-repeat-count">×{rounds}</span>
          <span className="qiskit-gate reg-span reg-oracle">
            O
            <small className="reg-span-name">
              {t("Oracle")}
              <br />|{step.marked}⟩
            </small>
          </span>
          <span className="qiskit-gate reg-span reg-diffuser">
            D<small className="reg-span-name">{t("Diffuser")}</small>
          </span>
        </div>
        {Array.from({ length: step.qubits }, (_, q) => (
          <span
            key={`measure-${q}`}
            className="reg-square"
            style={{ gridColumn: 5, gridRow: q + 1 }}
            aria-label={t("Measurement after the gates")}
          >
            <span className="qiskit-gate measure">M</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Choose and execute rounds explicitly; lesson correctness stays independent of noisy counts. */
export function RoundsDial({
  step,
  onSolved,
  onEdited,
  onBusyChange,
}: {
  step: RoundsStep;
  onSolved: () => void;
  onEdited?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  useLocale((state) => state.locale);
  const [rounds, setRounds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const experiment = useRegisterRun(onBusyChange);
  const ops: RegOp[] = ["H"];
  for (let i = 0; i < rounds; i++) ops.push(`oracle:${step.marked}`, "D");
  const amps = traceReg(
    startRegister(step.qubits, "0".repeat(step.qubits)),
    ops,
  ).at(-1)!;
  const odds = groverOdds(step.qubits, step.marked, rounds);
  const successful = !!experiment.reading && rounds === step.answer;
  function set(value: number) {
    if (experiment.running.current) return;
    experiment.clear();
    onEdited?.();
    setRounds(Math.max(0, Math.min(MAX_ROUNDS, value)));
    setMessage(null);
  }
  async function run() {
    if (experiment.running.current) return;
    setMessage(null);
    if (!(await experiment.run(step.qubits, "0".repeat(step.qubits), ops)))
      return;
    if (rounds === step.answer) {
      gameAudio.playSynth("chime");
      onSolved();
      return;
    }
    gameAudio.playSfx("error");
    setMessage(
      rounds < step.answer
        ? "Still climbing: another round makes the marked bar taller."
        : "Past the top: the marked bar is shrinking again. Turn back.",
    );
  }
  const prediction = (
    <p className="text-sm">
      {t("Ideal prediction:")} {t("Chance of")}{" "}
      <span className="qubit-ket">|{step.marked}⟩</span>:{" "}
      <strong className="text-accent-teal">{percent(odds)}</strong>
    </p>
  );
  const reference = (
    <>
      {prediction}
      <p className="text-xs text-stage-muted">
        {t("Each round is one Oracle and one Diffuser, after the H box.")}
      </p>
      <AmplitudeBars amps={amps} highlight={step.marked} />
    </>
  );
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
                  "M measures every wire after your boxes. Run sends this circuit to the backend; editing does not execute it.",
                )}
              </p>
              <p className="text-accent-teal">256 {t("shots")}</p>

              <ExperimentControlCard icon="↻" title="Grover rounds">
                <div
                  className="flex flex-wrap items-center gap-3"
                  role="group"
                  aria-label={t("Grover rounds")}
                >
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => set(rounds - 1)}
                    disabled={rounds === 0}
                    aria-label={t("One round fewer")}
                  >
                    −
                  </button>
                  <span
                    className="text-lg text-accent-amber"
                    aria-live="polite"
                  >
                    {rounds} {t(rounds === 1 ? "round" : "rounds")}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => set(rounds + 1)}
                    disabled={rounds === MAX_ROUNDS}
                    aria-label={t("One round more")}
                  >
                    +
                  </button>
                </div>
                {prediction}
                <p className="text-xs text-stage-muted">
                  {t(
                    "Each round is one Oracle and one Diffuser, after the H box.",
                  )}
                </p>
              </ExperimentControlCard>
              <div
                className={`circuit-workspace ${successful ? "" : "has-actions"}`}
              >
                <RoundsCircuit step={step} rounds={rounds} />
                {!successful && (
                  <CircuitActions
                    busy={experiment.busy}
                    onClear={() => set(0)}
                    runLabel="Run these rounds"
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
            </fieldset>
          )}
          {view === "results" && experiment.reading && (
            <>
              <CircuitHistogram {...experiment.reading} />
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
