"use client";
import { useMemo } from "react";
import { t } from "@/i18n";
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
  // Orthographic projection: X and Y cross the equatorial plane; Z points up.
  const blochPoint = {
    x: 65 * ((Math.sqrt(3) / 2) * bloch.x - 0.5 * bloch.y),
    y:
      65 *
      (Math.sin(Math.PI / 9) * (0.5 * bloch.x + (Math.sqrt(3) / 2) * bloch.y) -
        Math.cos(Math.PI / 9) * bloch.z),
  };
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
        <div className="flex flex-wrap gap-4 items-center">
          <svg
            viewBox="0 0 220 180"
            className="w-56"
            role="img"
            aria-label={t("Ideal Bloch sphere")}
          >
            <circle cx="100" cy="90" r="65" fill="#123941" stroke="#90e0cd" />
            <ellipse
              cx="100"
              cy="90"
              rx="65"
              ry="20"
              fill="none"
              stroke="#63858a"
            />
            <path
              d="M44 79l112 22 M100 29v122 M132.5 71l-65 38"
              stroke="#63858a"
            />
            <text x="164" y="108" fill="#fff">
              X
            </text>
            <text x="54" y="120" fill="#fff">
              Y
            </text>
            <text x="106" y="25" fill="#fff">
              Z
            </text>
            <line
              x1="100"
              y1="90"
              x2="165"
              y2="90"
              className="lab-bloch-vector"
              style={{
                transformOrigin: "100px 90px",
                transform: `rotate(${Math.atan2(blochPoint.y, blochPoint.x)}rad) scaleX(${Math.hypot(blochPoint.x, blochPoint.y) / 65})`,
              }}
              stroke="#ffb13d"
              strokeWidth="4"
            />
            <circle
              cx="100"
              cy="90"
              className="lab-bloch-vector"
              style={{
                transform: `translate(${blochPoint.x}px, ${blochPoint.y}px)`,
              }}
              r="5"
              fill="#ffb13d"
            />
          </svg>
          <p className="text-sm">
            <span className="block font-mono">
              X {Number(bloch.x.toFixed(3)).toFixed(3)} · Y{" "}
              {Number(bloch.y.toFixed(3)).toFixed(3)} · Z{" "}
              {Number(bloch.z.toFixed(3)).toFixed(3)}
            </span>
            {t(
              "Ideal Bloch reference. Rotate around X, Y or Z to explore the whole sphere; measurement counts do not reconstruct this state.",
            )}
          </p>
        </div>
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
