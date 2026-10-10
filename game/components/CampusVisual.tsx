"use client";
import type { CampusExhibitId } from "@/content/campus";
import type { CampusSettings } from "@/game/campusExperiment";
import { campusRequest } from "@/game/campusExperiment";
import { labTrace, amplitudeLabel } from "@/game/labCircuit";
import { t } from "@/i18n";
/** Explanatory pictures are mathematical references; never animations of measured counts. */
export function CampusVisual({
  id,
  settings: s,
}: {
  id: CampusExhibitId;
  settings: CampusSettings;
}) {
  const request = campusRequest(id, s);
  const a =
    request.mode === "circuit" ? labTrace(request.recipe).at(-1)! : null;
  const c = Number(Math.cos(s.angle / 2).toFixed(3)),
    k = Number(Math.sin(s.angle / 2).toFixed(3));
  const matrix =
    s.axis === "Y"
      ? `[[${c}, ${-k}], [${k}, ${c}]]`
      : s.axis === "X"
        ? `[[${c}, ${-k}i], [${-k}i, ${c}]]`
        : `[[${c} − ${k}i, 0], [0, ${c} + ${k}i]]`;
  return (
    <section className="panel space-y-2 overflow-hidden p-3">
      <h4 className="text-sm text-accent-teal">
        {t("Ideal mathematical picture")}
      </h4>
      {a && (
        <div className="campus-state-passport font-mono">
          <strong>
            |ψ⟩ = ({amplitudeLabel(a[0])})|0⟩ + ({amplitudeLabel(a[1])})|1⟩
          </strong>
          <span>
            [{amplitudeLabel(a[0])}, {amplitudeLabel(a[1])}]ᵀ
          </span>
        </div>
      )}
      {id === "rotations" && (
        <p className="overflow-x-auto whitespace-nowrap font-mono">
          R{s.axis}(θ) = {matrix}
        </p>
      )}
      {(id === "fountain" || id === "quiet") && (
        <svg
          viewBox="0 0 360 100"
          role="img"
          aria-label={t("Amplitude interference reference")}
          className="w-full max-w-lg"
        >
          <path
            d="M15 35Q35 5 55 35T95 35T135 35T175 35"
            stroke="#90e0cd"
            strokeWidth="3"
            fill="none"
          />
          <path
            d={
              s.minus
                ? "M15 75Q35 105 55 75T95 75T135 75T175 75"
                : "M15 75Q35 45 55 75T95 75T135 75T175 75"
            }
            stroke="#ffb13d"
            strokeWidth="3"
            fill="none"
            opacity={id === "quiet" ? 1 - s.disturbance * 0.8 : 1}
          />
          <path d="M200 15V90M200 55H335" stroke="#63858a" fill="none" />
          <text x="215" y="35" fill="#90e0cd" fontSize="14">
            {id === "quiet"
              ? `ρ₀₁ = ${(0.5 * (1 - s.disturbance)).toFixed(2)}`
              : s.minus
                ? "|−⟩"
                : "|+⟩"}
          </text>
          <text x="215" y="78" fill="#ffb13d" fontSize="14">
            {id === "quiet"
              ? `d = ${s.disturbance}`
              : s.analyzer
                ? s.minus
                  ? "H → |1⟩"
                  : "H → |0⟩"
                : "P(0) = P(1) = ½"}
          </text>
        </svg>
      )}
      {id === "observatory" && (
        <div className="campus-paired-signals">
          <span aria-hidden="true">◉</span>
          <div className="text-center font-mono">
            {s.pair === "bell"
              ? "(|00⟩ + |11⟩)/√2"
              : s.pair === "independent"
                ? "|+⟩ ⊗ |+⟩"
                : "½|00⟩⟨00| + ½|11⟩⟨11|"}
            <p>
              {t("Measurement basis")} {s.basis} ⊗ {s.basis}
            </p>
          </div>
          <span aria-hidden="true">◉</span>
        </div>
      )}
    </section>
  );
}
