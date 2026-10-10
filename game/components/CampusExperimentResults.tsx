"use client";
import type { CampusExhibitId } from "@/content/campus";
import type { CampusSession } from "@/game/campus";
import type { CampusRequest } from "@/game/campusExperiment";
import { evidenceLabel } from "@/game/campusJourney";
import { t } from "@/i18n";
import { BlochSphere } from "./BlochSphere";
import { CampusVisual } from "./CampusVisual";
import { CircuitHistogram } from "./CircuitHistogram";
import { LabStateExplorer } from "./LabStateExplorer";

/** Returned measurements and ideal references stay distinct, including mixed states. */
export function CampusExperimentResults({
  id,
  session,
  request,
  step,
  setStep,
}: {
  id: CampusExhibitId;
  session: CampusSession;
  request: CampusRequest;
  step: number | null;
  setStep: (step: number) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-accent-teal">{t("Results")}</h3>
      {session.result ? (
        <>
          <CircuitHistogram {...session.result} />
          {request.mode === "circuit" ? (
            <LabStateExplorer
              recipe={request.recipe}
              step={step}
              setStep={setStep}
              showBloch
            />
          ) : request.mode === "dephasing" ? (
            <section className="panel p-3 space-y-3">
              <h4 className="text-accent-teal">
                {t("Teaching model reference")}
              </h4>
              <BlochSphere
                vector={
                  request.basis === "X"
                    ? { x: 0, y: 0, z: 1 - request.disturbance }
                    : { x: 1 - request.disturbance, y: 0, z: 0 }
                }
                explanation="Ideal reference after the teaching channel and measurement lens. Backend noise is additional; counts do not reconstruct this state."
              />
            </section>
          ) : (
            <>
              <CampusVisual id={id} settings={session.settings} />
              <p className="text-sm text-stage-muted">
                {t(
                  "Amplitude reference for the whole register. One Bloch sphere cannot describe an entangled register.",
                )}
              </p>
            </>
          )}
          {request.mode !== "circuit" && (
            <p className="text-sm text-stage-muted">
              {t(
                "Ideal prediction includes the explicitly selected teaching preparation or channel, without additional device noise.",
              )}
            </p>
          )}
        </>
      ) : (
        <p role="status">
          {t(
            "The experiment has changed. Run it again for new measurements; earlier results are kept below.",
          )}
        </p>
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
                  <p className="mb-2 text-sm">{t(evidenceLabel(id, r.key))}</p>
                  <CircuitHistogram {...r.result} />
                </section>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
