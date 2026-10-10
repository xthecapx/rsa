"use client";
import { useEffect, useRef, useState } from "react";
import { CAMPUS_EXHIBITS, type CampusActivityId } from "@/content/campus";
import { CampusVisual } from "./CampusVisual";
import { useCampus, campusSession } from "@/game/campus";
import { campusRequest, type CampusSettings } from "@/game/campusExperiment";
import { useGame } from "@/game/state";
import { runCampus } from "@/lib/campus";
import { t, useLocale } from "@/i18n";
import { useAsyncOperation } from "./useAsyncOperation";
import { LaptopShell } from "./LaptopShell";
import { CircuitActions } from "./CircuitActions";
import { CircuitHistogram } from "./CircuitHistogram";
import { AngleDial } from "./AngleDial";
import { LabStateExplorer } from "./LabStateExplorer";
import { CampusNotebook } from "./CampusNotebook";
import { CampusTape, CampusCircuit } from "./CampusCircuit";
import { CheckpointControl } from "./CheckpointControl";
import { CAMPUS_STORIES } from "@/content/campusStories";
import { evidenceLabel, festivalDesign } from "@/game/campusJourney";

export function CampusLaptop({
  initial,
  onClose,
  investigation,
}: {
  initial: CampusActivityId | "notebook";
  onClose: (selected: CampusActivityId | "notebook") => void;
  investigation?: string;
}) {
  useLocale((s) => s.locale);
  const [selected, setSelected] = useState(initial);
  const contentTop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentTop.current?.scrollIntoView({ block: "start" });
  }, [selected]);
  const [view, setView] = useState<"play" | "explain" | "math">("play");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const store = useCampus();
  const operation = useAsyncOperation();
  const id = selected === "notebook" ? "qubit" : selected;
  const session = store.sessions[id] ?? campusSession();
  const s = session.settings;
  const festival = selected === "festival";
  const phase = Math.min(session.stage, 2);
  const exhibit = CAMPUS_EXHIBITS.find(
    (e) =>
      e.id ===
      (festival ? (["delivery", "observatory", "quiet"] as const)[phase] : id),
  )!;
  const exhibitId = exhibit.id;
  const request = campusRequest(
    festival && phase === 0 ? "festival" : exhibitId,
    s,
  );
  const preparationReady =
    exhibitId !== "qubit" || s.order.join() === "Prepare,Control,Measure";
  useEffect(() => {
    if (selected !== "notebook") useCampus.getState().open(selected);
  }, [selected]);
  function update(patch: Partial<CampusSettings>) {
    if (operation.running.current) return;
    store.update(id, { settings: { ...s, ...patch }, result: null });
    setError(null);
    setStep(null);
  }
  const design = festivalDesign(phase, s);
  const completed = store.completed.includes(exhibit.id);
  function run() {
    if (operation.running.current) return;
    if (!preparationReady) {
      setError("Arrange Prepare → Control → Measure before running.");
      return;
    }
    const snapshot = { ...s };
    const generation = useCampus.getState().generation;
    void operation.run(() => runCampus(request), {
      isCurrent: () => generation === useCampus.getState().generation,
      start: () => {
        setError(null);
        useGame.getState().changeOperations(1);
      },
      settled: () => useGame.getState().changeOperations(-1),
      success: (result) =>
        store.record(
          id,
          snapshot,
          result,
          festival ? (design ? `repair${phase}` : "other") : undefined,
        ),
      error: (cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "The experiment could not finish. Check the backend and try again.",
        ),
    });
  }
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
  const title =
    selected === "notebook"
      ? "Campus field notebook"
      : festival
        ? "Open the Festival"
        : exhibit.title;
  const goal =
    investigation && selected === initial
      ? investigation
      : CAMPUS_STORIES[id].investigations[festival ? phase : 0].question;
  const switchActivity = (next: CampusActivityId | "notebook") => {
    if (operation.running.current) return;
    setSelected(next);
    setView("play");
    setStep(null);
    setError(null);
  };
  return (
    <LaptopShell
      open
      foundations={false}
      title={title}
      restartControl={
        <CheckpointControl
          disabled={operation.busy}
          onOpenChange={() => {
            /* The laptop already locks world input. */
          }}
        />
      }
      closeDisabled={operation.busy}
      onClose={() => {
        if (!operation.running.current) onClose(selected);
      }}
      status={
        selected === "notebook"
          ? undefined
          : festival
            ? `${t("Repair")} ${phase + 1}/3`
            : t(exhibit.host)
      }
      footer={
        <p>
          {t(
            "Explore freely. Experiments use your backend’s practice policy; nothing runs until you press Run.",
          )}
        </p>
      }
    >
      <div ref={contentTop} className="space-y-5 font-body">
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost text-sm"
            disabled={operation.busy}
            onClick={() => switchActivity("notebook")}
          >
            {t("Campus field notebook")}
          </button>
          {selected === "notebook" && (
            <button
              className="btn-ghost text-sm"
              onClick={() => switchActivity("festival")}
            >
              {t("Open the Festival")}
            </button>
          )}
        </div>
        {selected === "notebook" ? (
          <CampusNotebook onOpen={switchActivity} />
        ) : (
          <>
            <section className="campus-exhibit-intro panel p-4">
              <span className="campus-exhibit-glyph" aria-hidden="true">
                {exhibit.glyph}
              </span>
              <div>
                <h3 className="text-lg text-accent-amber">{t(title)}</h3>
                {!(investigation && selected === initial) && (
                  <p className="mt-2">
                    {t(
                      festival
                        ? "Three repairs, no prerequisites. Build each experiment, run it and answer a visitor. No perfect noisy counts are required."
                        : investigation && selected === initial
                          ? investigation
                          : exhibit.brief,
                    )}
                  </p>
                )}
              </div>
            </section>
            <nav
              className="flex flex-wrap gap-2"
              aria-label={t("Exhibit views")}
            >
              {(["play", "explain", "math"] as const).map((v) => (
                <button
                  key={v}
                  className="btn-ghost"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {t(
                    v === "play"
                      ? "Play"
                      : v === "explain"
                        ? "Explain"
                        : "Show the math",
                  )}
                </button>
              ))}
            </nav>
            {view !== "play" && (
              <section className="panel p-4 leading-relaxed">
                <p>{t(view === "explain" ? exhibit.explain : exhibit.math)}</p>
              </section>
            )}
            <p className="text-accent-teal">{t(goal)}</p>
            <fieldset disabled={operation.busy} className="space-y-4">
              <div className="campus-experiment-layout">
                <div className="space-y-4">
                  {exhibitId === "qubit" && (
                    <>
                      {choose(
                        "Control device",
                        ["X", "H"] as const,
                        s.gate as "X" | "H",
                        (gate) => update({ gate }),
                        {
                          X: "Classical flip · X",
                          H: "Quantum superposition · H",
                        },
                      )}
                    </>
                  )}
                  {(exhibitId === "passports" || exhibitId === "rotations") && (
                    <>
                      {exhibitId === "rotations" &&
                        choose(
                          "Rotation axis",
                          ["X", "Y", "Z"] as const,
                          s.axis,
                          (axis) => update({ axis }),
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
                            onClick={() =>
                              update({ angle: (degrees * Math.PI) / 180 })
                            }
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
                            onChange={(e) =>
                              update({ inverse: e.target.checked })
                            }
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
                          onChange={(e) =>
                            update({ analyzer: e.target.checked })
                          }
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
                        {t("Teaching disturbance")} ·{" "}
                        {Math.round(s.disturbance * 100)}%
                        <input
                          className="mt-3 block w-full"
                          type="range"
                          min={0}
                          max={1}
                          step={0.25}
                          value={s.disturbance}
                          onChange={(e) =>
                            update({ disturbance: Number(e.target.value) })
                          }
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
                          onChange={(e) =>
                            update({ analyzer: e.target.checked })
                          }
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
                  <label className="block">
                    {t("Shots")}
                    <select
                      className="ml-3 rounded border border-stage-border bg-stage-bg p-2 text-base"
                      value={s.shots}
                      onChange={(e) =>
                        update({ shots: Number(e.target.value) })
                      }
                    >
                      {[1, 16, 256, 1024].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="min-w-0 space-y-3">
                  {preparationReady && (
                    <CampusVisual id={exhibitId} settings={s} />
                  )}
                  <div className="circuit-workspace campus-workspace">
                    {exhibitId === "qubit" && (
                      <section className="mb-4 space-y-3">
                        <h4 className="text-accent-teal">
                          {t("Experiment assembly")}
                        </h4>
                        <p className="text-sm text-stage-muted">
                          {t(
                            "Arrange the experiment. Move a device left to change its order.",
                          )}
                        </p>
                        <ol
                          className="flex gap-2 overflow-x-auto pb-2"
                          aria-label={t("Device order")}
                        >
                          {s.order.map((device, i) => (
                            <li
                              key={device}
                              className="flex shrink-0 items-center gap-2"
                            >
                              <span className="text-stage-muted">{i + 1}.</span>
                              <button
                                type="button"
                                className="btn-ghost"
                                disabled={i === 0}
                                onClick={() => {
                                  const order = [...s.order];
                                  [order[i - 1], order[i]] = [
                                    order[i],
                                    order[i - 1],
                                  ];
                                  update({ order });
                                }}
                              >
                                ← {t(device)}
                              </button>
                            </li>
                          ))}
                        </ol>
                        {!preparationReady && (
                          <p className="text-accent-amber" role="status">
                            {t(
                              "Arrange Prepare → Control → Measure before running.",
                            )}
                          </p>
                        )}
                      </section>
                    )}
                    {exhibitId === "delivery" ? (
                      <CampusTape
                        gates={s.sequence}
                        onChange={(sequence) => update({ sequence })}
                      />
                    ) : preparationReady ? (
                      <CampusCircuit request={request} />
                    ) : null}
                    {preparationReady && (
                      <CircuitActions
                        clearLabel={
                          exhibitId === "delivery"
                            ? "Clear circuit"
                            : "Reset experiment"
                        }
                        busy={operation.busy}
                        shots={s.shots}
                        onRun={run}
                        onClear={() =>
                          update({
                            sequence: [],
                            inverse: false,
                            analyzer: false,
                            minus: false,
                            angle: Math.PI / 2,
                            phase: 0,
                            disturbance: 0,
                            pair: "independent",
                            basis: "Z",
                          })
                        }
                      />
                    )}
                  </div>
                  {preparationReady && (
                    <p className="text-sm text-stage-muted">
                      {t(
                        "Run executes this circuit. Editing updates only the ideal reference and clears the current result.",
                      )}
                    </p>
                  )}
                  {preparationReady && request.mode === "circuit" && (
                    <LabStateExplorer
                      recipe={request.recipe}
                      step={step}
                      setStep={setStep}
                      showBloch
                    />
                  )}
                  {request.mode === "dephasing" && (
                    <section className="panel p-3">
                      <h4 className="text-accent-teal">
                        {t("Teaching model reference")}
                      </h4>
                      <p className="font-mono">
                        ρ = [[½, {(0.5 * (1 - s.disturbance)).toFixed(3)}], [
                        {(0.5 * (1 - s.disturbance)).toFixed(3)}, ½]]
                      </p>
                      <p className="mt-2 text-sm">
                        {t(
                          "Density matrix before the measurement lens. The shrinking off-diagonal entries describe loss of coherence.",
                        )}
                      </p>
                    </section>
                  )}
                </div>
              </div>
            </fieldset>
            {error && (
              <p className="text-accent-amber" role="alert">
                {t(error)}
              </p>
            )}
            {operation.busy && (
              <p role="status" aria-live="polite">
                {t("Running circuit…")}
              </p>
            )}
            {session.result && (
              <>
                <CircuitHistogram {...session.result} />
                {request.mode !== "circuit" && (
                  <p className="text-sm text-stage-muted">
                    {t(
                      "Ideal prediction includes the explicitly selected teaching preparation or channel, without additional device noise.",
                    )}
                  </p>
                )}
              </>
            )}
            {session.runs.length > (session.result ? 1 : 0) && (
              <details className="panel p-3">
                <summary className="cursor-pointer text-accent-teal">
                  {t("Compare earlier measurements")}
                </summary>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  {session.runs
                    .slice(0, session.result ? -1 : undefined)
                    .map((r, i) => (
                      <section key={i}>
                        <p className="mb-2 text-sm">
                          {t(evidenceLabel(exhibitId, r.key))}
                        </p>
                        <CircuitHistogram {...r.result} />
                      </section>
                    ))}
                </div>
              </details>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="btn-primary"
                disabled={operation.busy}
                onClick={() => onClose(selected)}
              >
                {t(
                  investigation && selected === initial
                    ? "Return to host"
                    : "Close laptop",
                )}
              </button>
              <p className="text-sm text-stage-muted">
                {t(
                  "Your measurements stay saved. Discuss them with the host when you return.",
                )}
              </p>
            </div>
            {!festival && completed && (
              <p className="panel p-3 text-accent-teal" role="status">
                {t(exhibit.discovery)}
              </p>
            )}
          </>
        )}
      </div>
    </LaptopShell>
  );
}
