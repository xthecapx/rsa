import {
  CAMPUS_EXHIBITS,
  type CampusActivityId,
  type CampusExhibitId,
} from "@/content/campus";
import { CAMPUS_STORIES } from "@/content/campusStories";
import {
  campusDefaults,
  cleanCampusSettings,
  CAMPUS_EVIDENCE,
  type CampusSettings,
} from "./campusExperiment";
import {
  campusJourney,
  CAMPUS_EXPERIMENT_REVISION,
  investigationReady,
  runMatches,
  type CampusJourney,
  type CampusRun,
} from "./campusJourney";
import type { CampusResult } from "@/lib/campus";
import type { CampusSession } from "./campus";

/** A corrupted browser save must never turn a reference into observed measurements. */
function validResult(value: unknown): value is CampusResult {
  if (!value || typeof value !== "object") return false;
  const r = value as CampusResult;
  if (
    (r.bits !== 1 && r.bits !== 2) ||
    typeof r.backend !== "string" ||
    typeof r.circuit_text !== "string" ||
    !Number.isInteger(r.depth) ||
    r.depth < 0 ||
    !["simulator", "hardware"].includes(r.source) ||
    (r.kind !== undefined &&
      !["ideal", "noise", "hardware"].includes(r.kind)) ||
    !Number.isInteger(r.shots) ||
    r.shots < 1 ||
    r.shots > 1024
  )
    return false;
  const entries = (values: unknown, probability = false): boolean =>
    !!values &&
    typeof values === "object" &&
    !Array.isArray(values) &&
    Object.entries(values).every(
      ([key, n]) =>
        new RegExp(`^[01]{${r.bits}}$`).test(key) &&
        typeof n === "number" &&
        Number.isFinite(n) &&
        n >= 0 &&
        (probability ? n <= 1 : Number.isInteger(n)),
    );
  return (
    entries(r.counts) &&
    Object.values(r.counts).reduce((a, b) => a + b, 0) === r.shots &&
    (r.probabilities === undefined ||
      (entries(r.probabilities, true) &&
        Math.abs(
          Object.values(r.probabilities).reduce((a, b) => a + b, 0) - 1,
        ) < 1e-8))
  );
}
/** A corrupt snapshot must not acquire a fabricated default experiment. */
function validSettings(value: unknown): value is CampusSettings {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  const clean = cleanCampusSettings(value);
  return Object.keys(campusDefaults()).every(
    (key) =>
      JSON.stringify(raw[key]) ===
      JSON.stringify(clean[key as keyof CampusSettings]),
  );
}
const ids = [
  ...CAMPUS_EXHIBITS.map((e) => e.id),
  "festival",
] as CampusActivityId[];

/** Migrate old experiments without resubmitting them or inventing missing recipes. */
export function readCampusSessions(
  data:
    | {
        sessions?: Partial<Record<CampusActivityId, CampusSession>>;
        completed?: CampusExhibitId[];
      }
    | null
    | undefined,
) {
  const sessions: Partial<Record<CampusActivityId, CampusSession>> = {};
  for (const id of ids) {
    const session = data?.sessions?.[id];
    if (!session || typeof session !== "object") continue;
    const base = { journey: campusJourney() };
    function validRun(value: unknown): CampusRun | null {
      if (!value || typeof value !== "object") return null;
      const run = value as CampusRun;
      if (typeof run.key !== "string" || !validResult(run.result)) return null;
      return {
        key: run.key,
        result: run.result,
        settings:
          run.revision === CAMPUS_EXPERIMENT_REVISION &&
          validSettings(run.settings)
            ? cleanCampusSettings(run.settings)
            : null,
        revision: Number.isInteger(run.revision) ? run.revision : 0,
      };
    }
    const runs = Array.isArray(session.runs)
      ? session.runs
          .map(validRun)
          .filter((r): r is CampusRun => !!r)
          .slice(-6)
      : [];
    const proofs: Record<string, CampusRun> = {};
    for (const value of [...runs, ...Object.values(session.proofs ?? {})]) {
      const run = validRun(value);
      if (
        run &&
        CAMPUS_EVIDENCE[id].includes(run.key) &&
        runMatches(id, run.key, run)
      )
        proofs[run.key] = run;
    }
    const story = CAMPUS_STORIES[id];
    const raw =
      session.journey && typeof session.journey === "object"
        ? session.journey
        : undefined;
    const investigation =
      raw &&
      Number.isInteger(raw.investigation) &&
      raw.investigation >= 0 &&
      raw.investigation < story.investigations.length
        ? raw.investigation
        : id === "festival"
          ? Number.isInteger(session.stage) &&
            session.stage >= 0 &&
            session.stage <= 3
            ? Math.min(session.stage, 2)
            : 0
          : 0;
    const current = story.investigations[investigation];
    const application: CampusJourney["application"] = {};
    for (const slot of story.application.slots) {
      const value = raw?.application?.[slot.id];
      if (slot.options.some((o) => o.id === value))
        application[slot.id] = value!;
    }
    for (const key of ["axis", "angle", "frequency"] as const) {
      const value = raw?.application?.[key];
      if (
        (key === "axis" && ["X", "Y", "Z"].includes(String(value))) ||
        (key === "angle" &&
          typeof value === "number" &&
          Number.isFinite(value) &&
          Math.abs(value) <= 2 * Math.PI) ||
        (key === "frequency" &&
          typeof value === "string" &&
          /^\d{1,4}$/.test(value))
      )
        application[key] = value!;
    }
    const legacyCompatible = [
      "qubit",
      "fountain",
      "arcade",
      "quiet",
      "festival",
    ].includes(id);
    const oldCorrect =
      session.answer ===
      (id === "festival"
        ? investigation === 0
          ? 0
          : 1
        : CAMPUS_EXHIBITS.find((e) => e.id === id)?.answer);
    const oldAnswer =
      legacyCompatible && oldCorrect
        ? (current.options.find((o) => o.correct)?.id ?? null)
        : null;
    const journey: CampusJourney = {
      ...base.journey,
      investigation,
      application,
      phase:
        raw &&
        [
          "intro",
          "prediction",
          "investigate",
          "discuss",
          "apply",
          "complete",
        ].includes(raw.phase)
          ? raw.phase
          : "intro",
      prediction:
        raw?.prediction === "unsure" ||
        story.predictions.some((p) => p.id === raw?.prediction)
          ? (raw?.prediction ?? null)
          : null,
      answerId: current.options.some((o) => o.id === raw?.answerId)
        ? (raw?.answerId ?? null)
        : oldAnswer,
      selected: Array.isArray(raw?.selected)
        ? [...new Set(raw.selected.filter((key) => current.keys.includes(key)))]
        : [],
      hints:
        raw && Number.isInteger(raw.hints)
          ? Math.min(3, Math.max(0, raw.hints))
          : 0,
    };
    // A claimed terminal dialogue alone is never an earned discovery.
    if (
      journey.phase === "complete" &&
      !(
        Array.isArray(data?.completed) &&
        data.completed.includes(id as CampusExhibitId)
      ) &&
      id !== "festival"
    )
      journey.phase = "investigate";
    if (id === "festival" && journey.phase === "complete")
      journey.phase = "apply";
    sessions[id] = {
      stage:
        id === "festival" && raw
          ? journey.investigation
          : Number.isInteger(session.stage) &&
              session.stage >= 0 &&
              session.stage <= 3
            ? session.stage
            : 0,
      runs,
      proofs,
      journey,
      settings: cleanCampusSettings(session.settings),
      answer:
        Number.isInteger(session.answer) &&
        session.answer! >= 0 &&
        session.answer! <= 2
          ? session.answer
          : null,
      evidence: Array.isArray(session.evidence)
        ? [
            ...new Set(
              session.evidence.filter((k) => CAMPUS_EVIDENCE[id].includes(k)),
            ),
          ]
        : [],
      result: validResult(session.result) ? session.result : null,
    };
    const restored = sessions[id]!;
    if (
      (journey.phase === "apply" || journey.phase === "discuss") &&
      !investigationReady(id, restored)
    )
      journey.phase = "investigate";
    if (
      journey.phase === "apply" &&
      (!current.options.some((o) => o.id === journey.answerId && o.correct) ||
        current.select.some((key) => !journey.selected.includes(key)))
    )
      journey.phase = "discuss";
  }

  return sessions;
}
