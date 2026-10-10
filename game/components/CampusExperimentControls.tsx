"use client";
import type { CampusExhibitId } from "@/content/campus";
import type { CampusSettings } from "@/game/campusExperiment";
import { AngleDial } from "./AngleDial";
import { CampusDeviceAssembly } from "./CampusDeviceAssembly";
import { t } from "@/i18n";

/** Each exhibit owns its parameters; the laptop owns execution and navigation. */
export function CampusExperimentControls({
  id: exhibitId,
  settings: s,
  update,
}: {
  id: CampusExhibitId;
  settings: CampusSettings;
  update: (patch: Partial<CampusSettings>) => void;
}) {
  const choose = <T extends string>(
    label: string,
    values: readonly T[],
    value: T,
    change: (v: T) => void,
    names?: Record<string, string>,
  ) => (
    <fieldset className="campus-choice">
      <legend>{t(label)}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <button
            type="button"
            key={v}
            className="btn-ghost"
            aria-pressed={v === value}
            onClick={() => change(v)}
          >
            {t(names?.[v] ?? v)}
          </button>
        ))}
      </div>
    </fieldset>
  );
  return (
    <div className="space-y-4">
      {exhibitId === "qubit" && (
        <CampusDeviceAssembly settings={s} update={update} />
      )}
      {(exhibitId === "passports" || exhibitId === "rotations") && (
        <>
          {exhibitId === "rotations" &&
            choose("Rotation axis", ["X", "Y", "Z"] as const, s.axis, (axis) =>
              update({ axis }),
            )}
          <div className="flex flex-wrap items-start gap-4">
            <div>
              <p className="text-accent-teal">θ</p>
              <AngleDial
                value={s.angle}
                onChange={(angle) => update({ angle })}
              />
            </div>
            {exhibitId === "passports" && (
              <div>
                <p className="text-accent-teal">φ</p>
                <AngleDial
                  symbol="φ"
                  label="Relative phase dial"
                  value={s.phase}
                  onChange={(phase) => update({ phase })}
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {[0, 90, 180].map((degrees) => (
              <button
                key={degrees}
                className="btn-ghost text-sm"
                onClick={() => update({ angle: (degrees * Math.PI) / 180 })}
              >
                θ {degrees}°
              </button>
            ))}
            {exhibitId === "passports" && (
              <button
                className="btn-ghost"
                onClick={() => update({ phase: 0 })}
              >
                φ 0°
              </button>
            )}
          </div>
          {exhibitId === "rotations" && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={s.inverse}
                onChange={(e) => update({ inverse: e.target.checked })}
              />
              {t("Add inverse rotation")}
            </label>
          )}
        </>
      )}
      {exhibitId === "fountain" && (
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.minus}
              onChange={(e) => update({ minus: e.target.checked })}
            />
            {t("Paint a relative minus with Z")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.analyzer}
              onChange={(e) => update({ analyzer: e.target.checked })}
            />
            {t("Add the H measurement lens")}
          </label>
        </>
      )}
      {exhibitId === "observatory" && (
        <>
          {choose(
            "Signal preparation",
            ["independent", "bell", "envelopes"] as const,
            s.pair,
            (pair) => update({ pair }),
            {
              independent: "Independent signals",
              bell: "Bell pair",
              envelopes: "Matching envelopes model",
            },
          )}
          {choose(
            "Both measurement bases",
            ["Z", "X"] as const,
            s.basis,
            (basis) => update({ basis }),
          )}
          <p className="text-sm text-stage-muted">
            {t(
              "The envelopes model is a dephased Bell preparation. An unobserved helper removes its coherence; it is not a physical source of paper envelopes.",
            )}
          </p>
        </>
      )}
      {exhibitId === "quiet" && (
        <>
          <label className="block">
            {t("Teaching disturbance")} · {Math.round(s.disturbance * 100)}%
            <input
              className="mt-3 block w-full"
              type="range"
              min={0}
              max={1}
              step={0.25}
              value={s.disturbance}
              onChange={(e) => update({ disturbance: Number(e.target.value) })}
            />
          </label>
          <div className="flex gap-2">
            {[0, 0.5, 1].map((d) => (
              <button
                key={d}
                className="btn-ghost"
                onClick={() => update({ disturbance: d })}
              >
                {d * 100}%
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.analyzer}
              onChange={(e) => update({ analyzer: e.target.checked })}
            />
            {t("Add the H measurement lens")}
          </label>
          <p className="text-sm text-stage-muted">
            {t(
              "The helper is unobserved. Only the data qubit appears in counts. Device noise is additional to the teaching channel.",
            )}
          </p>
        </>
      )}
    </div>
  );
}
