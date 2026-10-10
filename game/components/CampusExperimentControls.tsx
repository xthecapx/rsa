"use client";
import type { CampusExhibitId } from "@/content/campus";
import type { CampusSettings } from "@/game/campusExperiment";
import { AngleDial } from "./AngleDial";
import { CampusDeviceAssembly } from "./CampusDeviceAssembly";
import {
  CampusChoice,
  CampusControlCard,
  CampusToggleCard,
} from "./CampusControlCard";
import { t } from "@/i18n";

/** Presets belong to their dial, so θ and φ never share an ambiguous button row. */
function CampusAngle({
  symbol,
  value,
  onChange,
}: {
  symbol: "θ" | "φ";
  value: number;
  onChange: (angle: number) => void;
}) {
  return (
    <div className="campus-angle-setting">
      <AngleDial
        symbol={symbol}
        label={symbol === "φ" ? "Relative phase dial" : "Rotation angle dial"}
        value={value}
        onChange={onChange}
      />
      <div
        className="campus-angle-presets"
        role="group"
        aria-label={t(
          symbol === "θ" ? "Rotation angle presets" : "Relative phase presets",
        )}
      >
        {[0, 90, 180].map((degrees) => (
          <button
            type="button"
            key={degrees}
            className="btn-ghost text-sm"
            aria-pressed={Math.abs(value - (degrees * Math.PI) / 180) < 0.001}
            onClick={() => onChange((degrees * Math.PI) / 180)}
          >
            {symbol} {degrees}°
          </button>
        ))}
      </div>
    </div>
  );
}

/** Each exhibit owns its parameters; the laptop owns execution and navigation. */
export function CampusExperimentControls({
  id,
  settings: s,
  update,
}: {
  id: CampusExhibitId;
  settings: CampusSettings;
  update: (patch: Partial<CampusSettings>) => void;
}) {
  const lens = (
    <CampusToggleCard
      icon="H"
      label="Add the H measurement lens"
      description="Read in X instead of Z to reveal phase differences."
      checked={s.analyzer}
      onChange={(analyzer) => update({ analyzer })}
    />
  );
  if (id === "qubit")
    return <CampusDeviceAssembly settings={s} update={update} />;
  if (id === "delivery") return null; // The editable tape owns its gate palette.
  if (id === "passports")
    return (
      <div className="campus-control-grid campus-angle-grid">
        <CampusControlCard icon="θ" title="State angle">
          <p className="campus-control-help">
            {t("Turn from |0⟩ toward |1⟩ with θ.")}
          </p>
          <CampusAngle
            symbol="θ"
            value={s.angle}
            onChange={(angle) => update({ angle })}
          />
        </CampusControlCard>
        <CampusControlCard icon="φ" title="Relative phase">
          <p className="campus-control-help">
            {t(
              "Turn the relative phase with φ; Z-basis probabilities stay the same.",
            )}
          </p>
          <CampusAngle
            symbol="φ"
            value={s.phase}
            onChange={(phase) => update({ phase })}
          />
        </CampusControlCard>
      </div>
    );
  if (id === "rotations")
    return (
      <div className="campus-control-grid">
        <CampusControlCard icon="R" title="Rotation">
          <CampusChoice
            label="Rotation axis"
            options={(["X", "Y", "Z"] as const).map((value) => ({
              value,
              label: value,
            }))}
            value={s.axis}
            onChange={(axis) => update({ axis })}
          />
          <CampusAngle
            symbol="θ"
            value={s.angle}
            onChange={(angle) => update({ angle })}
          />
        </CampusControlCard>
        <CampusToggleCard
          icon="U†"
          label="Add inverse rotation"
          description="Apply the opposite angle after the first rotation."
          checked={s.inverse}
          onChange={(inverse) => update({ inverse })}
        />
      </div>
    );
  if (id === "fountain")
    return (
      <div className="campus-control-grid">
        <CampusToggleCard
          icon="Z"
          label="Paint a relative minus with Z"
          description="Switch |+⟩ to |−⟩ without changing the Z-basis probabilities."
          checked={s.minus}
          onChange={(minus) => update({ minus })}
        />
        {lens}
      </div>
    );
  if (id === "observatory")
    return (
      <div className="space-y-3">
        <CampusChoice
          label="Signal preparation"
          cards
          options={
            [
              {
                value: "independent",
                label: "Independent signals",
                icon: "⊗",
                description: "Two separately prepared |+⟩ states.",
              },
              {
                value: "bell",
                label: "Bell pair",
                icon: "∞",
                description: "One joint state, prepared with H and CNOT.",
              },
              {
                value: "envelopes",
                label: "Matching envelopes model",
                icon: "▤",
                description: "Matching Z outcomes with coherence removed.",
              },
            ] as const
          }
          value={s.pair}
          onChange={(pair) => update({ pair })}
        />
        <CampusControlCard icon="M" title="Measurement">
          <CampusChoice
            label="Both measurement bases"
            options={
              [
                { value: "Z", label: "Z" },
                { value: "X", label: "X" },
              ] as const
            }
            value={s.basis}
            onChange={(basis) => update({ basis })}
          />
          <p className="campus-control-help">
            {t(
              "Both detectors use the selected basis. Compare their joint outcomes.",
            )}
          </p>
        </CampusControlCard>
        {s.pair === "envelopes" && (
          <p className="campus-control-help">
            {t(
              "The envelopes model is a dephased Bell preparation. An unobserved helper removes its coherence; it is not a physical source of paper envelopes.",
            )}
          </p>
        )}
      </div>
    );
  if (id === "quiet")
    return (
      <div className="campus-control-grid">
        <CampusControlCard icon="E(d)" title="Teaching disturbance">
          <label className="campus-disturbance">
            <span className="campus-disturbance-value">
              {Math.round(s.disturbance * 100)}%
            </span>
            <input
              aria-label={t("Teaching disturbance")}
              type="range"
              min={0}
              max={1}
              step={0.25}
              value={s.disturbance}
              onChange={(e) => update({ disturbance: Number(e.target.value) })}
            />
          </label>
          <div className="campus-choice-buttons">
            {[0, 0.5, 1].map((disturbance) => (
              <button
                type="button"
                key={disturbance}
                className="btn-ghost"
                aria-pressed={s.disturbance === disturbance}
                onClick={() => update({ disturbance })}
              >
                {disturbance * 100}%
              </button>
            ))}
          </div>
          <p className="campus-control-help">
            {t(
              "The helper is unobserved. Only the data qubit appears in counts. Device noise is additional to the teaching channel.",
            )}
          </p>
        </CampusControlCard>
        {lens}
      </div>
    );
  return (
    <div className="campus-control-grid">
      <CampusControlCard icon="H" title="Prepare">
        <p className="campus-control-help">
          {t("H prepares a balanced superposition from |0⟩.")}
        </p>
      </CampusControlCard>
      <CampusControlCard icon="M" title="Measure">
        <p className="campus-control-help">
          {t(
            "Choose the batch size in Run. Each shot prepares and measures a fresh qubit.",
          )}
        </p>
      </CampusControlCard>
    </div>
  );
}
