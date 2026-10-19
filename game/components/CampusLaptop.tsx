"use client";
import { useEffect, useId, useRef, useState } from "react";
import { CAMPUS_EXHIBITS, type CampusActivityId } from "@/content/campus";
import { CampusVisual } from "./CampusVisual";
import { useCampus, campusSession } from "@/game/campus";
import { campusRequest, type CampusSettings } from "@/game/campusExperiment";
import { useGame } from "@/game/state";
import { useExecution } from "@/lib/execution";
import { runCampus } from "@/lib/campus";
import { t, useLocale } from "@/i18n";
import { useAsyncOperation } from "./useAsyncOperation";
import { LaptopShell } from "./LaptopShell";
import { CircuitActions } from "./CircuitActions";
import { CampusExperimentControls } from "./CampusExperimentControls";
import {
  CampusExperimentSteps,
  CAMPUS_STEPS,
  type CampusExperimentStep,
} from "./CampusExperimentSteps";
import { CampusExperimentResults } from "./CampusExperimentResults";
import { CampusNotebook } from "./CampusNotebook";
import { CampusTape, CampusCircuit } from "./CampusCircuit";
import { CheckpointControl } from "./CheckpointControl";
import { CAMPUS_STORIES } from "@/content/campusStories";
import { festivalDesign } from "@/game/campusJourney";

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
  const [view, setView] = useState<CampusExperimentStep>(() =>
    initial !== "notebook" && useCampus.getState().sessions[initial]?.result
      ? "results"
      : "math",
  );
  const tabsId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const focusResults = useRef(false);
  const contentTop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!useExecution.getState().background)
      contentTop.current?.scrollIntoView({ block: "start" });
    if (view === "results" && focusResults.current) {
      if (!useExecution.getState().background)
        panel.current?.focus({ preventScroll: true });
      focusResults.current = false;
    }
  }, [selected, view]);
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
      success: (result) => {
        store.record(
          id,
          snapshot,
          result,
          festival ? (design ? `repair${phase}` : "other") : undefined,
        );
        focusResults.current = true;
        setView("results");
      },
      error: (cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "The experiment could not finish. Check the backend and try again.",
        ),
    });
  }
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
    setView(
      next !== "notebook" && store.sessions[next]?.result ? "results" : "math",
    );
    setStep(null);
    setError(null);
  };
  const hasMeasurements = session.runs.length > 0;
  const stageIndex = CAMPUS_STEPS.findIndex((stage) => stage.id === view);
  function resetExperiment() {
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
    });
  }
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
      <div ref={contentTop} className="space-y-4 font-body">
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
            {view === "math" && !(investigation && selected === initial) && (
              <p className="text-sm text-stage-muted">
                {t(
                  festival
                    ? "Three repairs, no prerequisites. Build each experiment, run it and answer a visitor. No perfect noisy counts are required."
                    : exhibit.brief,
                )}
              </p>
            )}
            <CampusExperimentSteps
              id={tabsId}
              value={view}
              onChange={setView}
              busy={operation.busy}
              hasMeasurements={hasMeasurements}
            />
            <p className="text-accent-teal">{t(goal)}</p>
            <div
              ref={panel}
              id={`${tabsId}-panel`}
              role="tabpanel"
              aria-labelledby={`${tabsId}-${view}`}
              tabIndex={-1}
              className="space-y-4 min-w-0"
            >
              {view === "math" && (
                <section className="space-y-4">
                  <h3 className="text-accent-teal">{t("Show the math")}</h3>
                  <p className="leading-relaxed">{t(exhibit.explain)}</p>
                  <p className="panel p-4 leading-relaxed">{t(exhibit.math)}</p>
                  {preparationReady && (
                    <CampusVisual id={exhibitId} settings={s} />
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
                </section>
              )}
              {view === "run" && (
                <fieldset
                  disabled={operation.busy}
                  className="space-y-4 min-w-0"
                >
                  <h3 className="text-accent-teal">{t("Run circuit")}</h3>
                  <div className="circuit-workspace campus-workspace campus-assembly-workspace space-y-4">
                    <CampusExperimentControls
                      id={exhibitId}
                      settings={s}
                      update={update}
                    />
                    {preparationReady && (
                      <>
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
                        <p className="text-sm text-stage-muted">
                          {t(
                            "Each shot starts from a fresh preparation. Increase shots to compare the measured frequencies.",
                          )}
                        </p>
                      </>
                    )}
                    <div
                      className={`campus-circuit-preview ${exhibitId === "delivery" ? "campus-editable-preview" : ""}`}
                    >
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
                          onClear={resetExperiment}
                          onRun={run}
                          shots={s.shots}
                          clearLabel={
                            exhibitId === "delivery"
                              ? "Clear circuit"
                              : "Reset experiment"
                          }
                          busy={operation.busy}
                        />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-stage-muted">
                    {t(
                      "Run executes this circuit. Editing updates only the ideal reference and clears the current result.",
                    )}
                  </p>
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
                </fieldset>
              )}
              {view === "results" && (
                <CampusExperimentResults
                  id={exhibitId}
                  session={session}
                  request={request}
                  step={step}
                  setStep={setStep}
                />
              )}
              <nav
                className="flex flex-wrap justify-between gap-3 pt-2"
                aria-label={t("Step navigation")}
              >
                {stageIndex > 0 && (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={operation.busy}
                    onClick={() => setView(CAMPUS_STEPS[stageIndex - 1].id)}
                  >
                    {t("Previous step")}
                  </button>
                )}
                {view === "results" ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setView("run")}
                  >
                    {t("Edit experiment")}
                  </button>
                ) : (
                  (view !== "run" || hasMeasurements) && (
                    <button
                      type="button"
                      className="btn-primary ml-auto"
                      disabled={operation.busy}
                      onClick={() => setView(CAMPUS_STEPS[stageIndex + 1].id)}
                    >
                      {t(
                        view === "math"
                          ? "Continue to run"
                          : "View measurements",
                      )}
                    </button>
                  )
                )}
              </nav>
            </div>
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
