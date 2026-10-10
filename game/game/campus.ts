"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CAMPUS_EXHIBITS,
  type CampusActivityId,
  type CampusExhibitId,
} from "@/content/campus";
import {
  campusDefaults,
  cleanCampusSettings,
  campusEvidence,
  CAMPUS_EVIDENCE,
  type CampusSettings,
} from "./campusExperiment";
import type { CampusResult } from "@/lib/campus";
import { useProgress } from "./progress";
import { saveStorage } from "./storage";
export interface CampusSession {
  settings: CampusSettings;
  answer: number | null;
  evidence: string[];
  result: CampusResult | null;
  stage: number;
  runs: { key: string; result: CampusResult }[];
}
export const campusSession = (): CampusSession => ({
  settings: campusDefaults(),
  answer: null,
  evidence: [],
  result: null,
  stage: 0,
  runs: [],
});
const ids = [
  ...CAMPUS_EXHIBITS.map((e) => e.id),
  "festival",
] as CampusActivityId[];
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
interface CampusState {
  completed: CampusExhibitId[];
  sessions: Partial<Record<CampusActivityId, CampusSession>>;
  opened: string[];
  update: (id: CampusActivityId, patch: Partial<CampusSession>) => void;
  record: (
    id: CampusActivityId,
    settings: CampusSettings,
    result: CampusResult,
    evidenceKey?: string,
  ) => void;
  complete: (id: CampusExhibitId) => void;
  open: (id: string) => void;
  reset: () => void;
}
export const useCampus = create<CampusState>()(
  persist(
    (set, get) => ({
      completed: [],
      sessions: {},
      opened: [],
      update: (id, patch) =>
        set((s) => ({
          sessions: {
            ...s.sessions,
            [id]: { ...(s.sessions[id] ?? campusSession()), ...patch },
          },
        })),
      record: (id, settings, result, evidenceKey) => {
        const prior = get().sessions[id] ?? campusSession();
        const key = evidenceKey ?? campusEvidence(id, settings);
        get().update(id, {
          result,
          runs: [...prior.runs, { key, result }].slice(-6),
          evidence: [...new Set([...prior.evidence, key])].filter((k) =>
            CAMPUS_EVIDENCE[id].includes(k),
          ),
        });
      },
      complete: (id) => {
        set((s) => ({ completed: [...new Set([...s.completed, id])] }));
        if (get().completed.length === CAMPUS_EXHIBITS.length)
          useProgress.getState().complete("campus", "orientation");
      },
      open: (id) => set((s) => ({ opened: [...new Set([...s.opened, id])] })),
      reset: () => set({ completed: [], sessions: {}, opened: [] }),
    }),
    {
      name: "quantum-campus-v1",
      storage: saveStorage(),
      skipHydration: true,
      partialize: (s) => ({
        completed: s.completed,
        sessions: s.sessions,
        opened: s.opened,
      }),
      merge: (saved, current) => {
        const data = saved as Partial<CampusState> | null;
        const sessions: CampusState["sessions"] = {};
        for (const id of ids) {
          const session = data?.sessions?.[id];
          if (!session || typeof session !== "object") continue;
          sessions[id] = {
            stage:
              Number.isInteger(session.stage) &&
              session.stage >= 0 &&
              session.stage <= 3
                ? session.stage
                : 0,
            runs: Array.isArray(session.runs)
              ? session.runs
                  .filter(
                    (run) =>
                      run &&
                      typeof run.key === "string" &&
                      validResult(run.result),
                  )
                  .slice(-6)
              : [],
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
                    session.evidence.filter((k) =>
                      CAMPUS_EVIDENCE[id].includes(k),
                    ),
                  ),
                ]
              : [],
            result: validResult(session.result) ? session.result : null,
          };
        }
        return {
          ...current,
          sessions,
          completed: Array.isArray(data?.completed)
            ? [
                ...new Set(
                  data.completed.filter((id) =>
                    CAMPUS_EXHIBITS.some((e) => e.id === id),
                  ),
                ),
              ]
            : [],
          opened: Array.isArray(data?.opened)
            ? data.opened.filter((id) => ids.includes(id as CampusActivityId))
            : [],
        };
      },
    },
  ),
);
