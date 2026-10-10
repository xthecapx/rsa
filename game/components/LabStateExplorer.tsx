"use client";
import { useMemo } from "react";
import { t } from "@/i18n";
import { BlochSphere } from "./BlochSphere";
import {
  labTrace,
  labProbability,
  labBloch,
  amplitudeLabel,
  validRecipe,
  type LabRecipe,
} from "@/game/labCircuit";
export function LabStateExplorer({
  recipe,
  step,
  setStep,
  showBloch,
}: {
  recipe: LabRecipe;
  step: number | null;
  setStep: (step: number) => void;
  showBloch: boolean;
}) {
  const valid = validRecipe(recipe);
  const states = useMemo(
      () => (valid ? labTrace(recipe) : []),
      [recipe, valid],
    ),
    index = Math.min(
      step ?? recipe.operations.length,
      recipe.operations.length,
    ),
    amplitudes = states[index] ?? [];
  const bloch = labBloch(amplitudes);
  return (
    <section className="panel p-3 space-y-3">
      <h3 className="text-accent-teal">{t("Ideal state explorer")}</h3>
      <label>
        {t("Circuit step")} {index}/{recipe.operations.length}
        <input
          className="w-full"
          type="range"
          min={0}
          max={recipe.operations.length}
          value={index}
          onChange={(e) => setStep(Number(e.target.value))}
        />
      </label>
      {recipe.qubits === 1 && showBloch ? (
        <BlochSphere vector={bloch} />
      ) : (
        <p className="text-xs">
          {t(
            "Amplitude reference for the whole register. One Bloch sphere cannot describe an entangled register.",
          )}
        </p>
      )}
      <div className="lab-amplitudes">
        {amplitudes.map((a, i) => (
          <div key={i}>
            <span className="font-mono">
              |{i.toString(2).padStart(recipe.qubits, "0")}⟩
            </span>
            <meter min={0} max={1} value={labProbability(a)} />
            <span className="font-mono">
              {amplitudeLabel(a)} · {(labProbability(a) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
