import { CAMPUS_STORIES } from "@/content/campusStories";
import type { CampusActivityId, CampusExhibitId } from "@/content/campus";
import type { CampusSession } from "./campus";
import type { ExplorationStatus } from "./explorationStatus";
import { campusEvidence, type CampusSettings } from "./campusExperiment";
import type { CampusResult } from "@/lib/campus";

export const CAMPUS_EXPERIMENT_REVISION = 1;
export type CampusPhase =
  | "intro"
  | "prediction"
  | "investigate"
  | "discuss"
  | "apply"
  | "complete";
export interface CampusJourney {
  phase: CampusPhase;
  investigation: number;
  prediction: string | null;
  answerId: string | null;
  selected: string[];
  application: Record<string, string | number>;
  hints: number;
}
export interface CampusRun {
  key: string;
  result: CampusResult;
  /** Legacy results remain readable without inventing their missing recipe. */
  settings: CampusSettings | null;
  revision: number;
}
export const campusJourney = (): CampusJourney => ({
  phase: "intro",
  investigation: 0,
  prediction: null,
  answerId: null,
  selected: [],
  application: {},
  hints: 0,
});
export function investigationFor(id: CampusActivityId, session: CampusSession) {
  const stages = CAMPUS_STORIES[id].investigations;
  return stages[Math.min(session.journey.investigation, stages.length - 1)];
}
export function festivalDesign(stage: number, s: CampusSettings): boolean {
  return stage === 0
    ? s.sequence.join() === "H,H"
    : stage === 1
      ? s.pair === "bell" && s.basis === "X"
      : stage === 2 && s.disturbance === 0 && s.analyzer;
}
export function runMatches(
  id: CampusActivityId,
  key: string,
  run: CampusRun,
): boolean {
  if (!run.settings)
    return (
      run.revision === 0 &&
      id !== "rotations" &&
      id !== "festival" &&
      run.key === key
    );
  if (run.revision !== CAMPUS_EXPERIMENT_REVISION) return false;
  if (id === "festival")
    return (
      /^repair[012]$/.test(key) &&
      festivalDesign(Number(key.at(-1)), run.settings)
    );
  return campusEvidence(id, run.settings) === key;
}
export function evidenceFor(
  id: CampusActivityId,
  session: CampusSession,
  key: string,
): CampusRun | undefined {
  const run = session.proofs[key];
  if (run && runMatches(id, key, run)) return run;
  return [...session.runs].reverse().find((r) => runMatches(id, key, r));
}
export function rotationPair(
  session: CampusSession,
): { first: CampusRun; inverse: CampusRun } | null {
  // Use the pinned pair, then history. Angles and axes must agree even if the
  // player changes settings between runs; counts never determine correctness.
  const runs = [...Object.values(session.proofs), ...session.runs];
  for (const inverse of [...runs].reverse()) {
    const s = inverse.settings;
    if (
      !s ||
      !runMatches("rotations", "rotation:true", inverse) ||
      s.axis === "Z" ||
      Math.abs(Math.sin(s.angle / 2)) < 0.05
    )
      continue;
    const first = [...runs]
      .reverse()
      .find(
        (r) =>
          r.settings &&
          runMatches("rotations", "rotation:false", r) &&
          r.settings.axis === s.axis &&
          Math.abs(r.settings.angle - s.angle) < 1e-8,
      );
    if (first) return { first, inverse };
  }
  return null;
}
export function investigationReady(
  id: CampusActivityId,
  session: CampusSession,
): boolean {
  if (id === "rotations") return !!rotationPair(session);
  return investigationFor(id, session).keys.every(
    (key) => !!evidenceFor(id, session, key),
  );
}

/** Map, host and journal share the earned completion and current evidence state. */
export function campusActivityStatus(
  id: CampusActivityId,
  progress: {
    completed: readonly CampusExhibitId[];
    sessions: Partial<Record<CampusActivityId, CampusSession>>;
  },
  festivalEarned: boolean,
): ExplorationStatus {
  if (id === "festival" ? festivalEarned : progress.completed.includes(id))
    return "complete";
  const session = progress.sessions[id];
  if (
    !session ||
    session.journey.phase === "intro" ||
    session.journey.phase === "complete"
  )
    return "new";
  if (session.journey.phase === "apply" || investigationReady(id, session))
    return "ready";
  return "working";
}
export function applicationReady(
  id: CampusActivityId,
  session: CampusSession,
): boolean {
  if (!investigationReady(id, session)) return false;
  const stage = investigationFor(id, session);
  if (
    !stage.options.some((o) => o.id === session.journey.answerId && o.correct)
  )
    return false;
  if (stage.select.some((key) => !session.journey.selected.includes(key)))
    return false;
  const application = CAMPUS_STORIES[id].application;
  const values = session.journey.application;
  if (!application.slots.every((slot) => values[slot.id] === slot.correct))
    return false;
  if (id === "arcade") {
    const batch = evidenceFor(id, session, "batch");
    if (!batch || values.frequency !== String(batch.result.counts["0"] ?? 0))
      return false;
  }
  if (id === "rotations") {
    const s = rotationPair(session)?.first.settings;
    if (!s || values.axis !== s.axis || typeof values.angle !== "number")
      return false;
    return Math.abs(Math.sin((values.angle + s.angle) / 2)) < 0.015;
  }
  return true;
}
export type CampusJourneyEvent =
  | { type: "begin" }
  | { type: "predict"; id: string }
  | { type: "return" }
  | { type: "hint" }
  | { type: "select"; key: string }
  | { type: "answer"; id: string }
  | { type: "application"; key: string; value: string | number }
  | { type: "finish" };

/** Pure, guarded transitions; restoring a phase cannot submit or award anything. */
export function transitionCampus(
  id: CampusActivityId,
  session: CampusSession,
  event: CampusJourneyEvent,
): CampusJourney {
  const j = session.journey;
  const stage = investigationFor(id, session);
  switch (event.type) {
    case "begin":
      return j.phase === "intro"
        ? { ...j, phase: "prediction", answerId: null }
        : j;
    case "predict":
      return j.phase === "prediction" &&
        (event.id === "unsure" ||
          CAMPUS_STORIES[id].predictions.some((p) => p.id === event.id))
        ? { ...j, prediction: event.id, phase: "investigate" }
        : j;
    case "return":
      return (j.phase === "investigate" || j.phase === "discuss") &&
        investigationReady(id, session)
        ? { ...j, phase: "discuss" }
        : j;
    case "hint":
      return { ...j, hints: Math.min(3, j.hints + 1) };
    case "select":
      return j.phase === "discuss" &&
        stage.keys.includes(event.key) &&
        evidenceFor(id, session, event.key)
        ? {
            ...j,
            selected: j.selected.includes(event.key)
              ? j.selected.filter((k) => k !== event.key)
              : [...j.selected, event.key],
          }
        : j;
    case "answer": {
      if (
        j.phase !== "discuss" ||
        !investigationReady(id, session) ||
        stage.select.some((key) => !j.selected.includes(key))
      )
        return j;
      const option = stage.options.find((o) => o.id === event.id);
      if (!option) return j;
      if (option.correct && id === "fountain" && j.investigation === 0)
        return {
          ...j,
          phase: "investigate",
          investigation: 1,
          hints: 0,
          selected: [],
          answerId: null,
        };
      return {
        ...j,
        answerId: option.id,
        phase: option.correct ? "apply" : "discuss",
      };
    }
    case "application": {
      if (j.phase !== "apply") return j;
      const slot = CAMPUS_STORIES[id].application.slots.find(
        (s) => s.id === event.key,
      );
      const valid =
        slot?.options.some((o) => o.id === event.value) ||
        (id === "rotations" &&
          ((event.key === "axis" &&
            ["X", "Y", "Z"].includes(String(event.value))) ||
            (event.key === "angle" &&
              typeof event.value === "number" &&
              Number.isFinite(event.value) &&
              Math.abs(event.value) <= 2 * Math.PI))) ||
        (id === "arcade" &&
          event.key === "frequency" &&
          typeof event.value === "string" &&
          /^\d{1,4}$/.test(event.value));
      return valid
        ? { ...j, application: { ...j.application, [event.key]: event.value } }
        : j;
    }
    case "finish": {
      if (j.phase !== "apply" || !applicationReady(id, session)) return j;
      return j.investigation + 1 < CAMPUS_STORIES[id].investigations.length
        ? {
            ...j,
            phase: "investigate",
            investigation: j.investigation + 1,
            hints: 0,
            selected: [],
            answerId: null,
            application: {},
          }
        : { ...j, phase: "complete" };
    }
  }
}

export function evidenceLabel(id: CampusActivityId, key: string): string {
  if (id === "fountain")
    return key === "true:true"
      ? "Minus state · H lens"
      : key === "true:false"
        ? "Minus state · Z measurement"
        : key === "false:true"
          ? "Plus state · H lens"
          : "Plus state · Z measurement";
  if (id === "quiet")
    return key === "0:true"
      ? "No disturbance · H lens"
      : key === "1:true"
        ? "Full dephasing · H lens"
        : "Full dephasing · Z measurement";
  if (id === "observatory")
    return key.startsWith("bell")
      ? key.endsWith("X")
        ? "Bell pair · X"
        : "Bell pair · Z"
      : key.startsWith("envelopes")
        ? key.endsWith("X")
          ? "Matching envelopes · X"
          : "Matching envelopes · Z"
        : "Independent signals · Z";
  if (id === "arcade")
    return key === "single" ? "Single shot" : "Batch of fresh preparations";
  if (id === "qubit")
    return key.endsWith("X")
      ? "Classical flip · X"
      : "Quantum superposition · H";
  if (id === "delivery") return key === "delivery" ? "X → H" : "H → X";
  if (id === "rotations")
    return key === "rotation:true"
      ? "Rotation with its inverse"
      : "Rotation alone";
  if (id === "festival")
    return key === "repair0"
      ? "H → H"
      : key === "repair1"
        ? "Bell pair · X"
        : "No disturbance · H lens";
  return "State passport experiment";
}
