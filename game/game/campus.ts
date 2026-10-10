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
import {
  campusJourney,
  CAMPUS_EXPERIMENT_REVISION,
  rotationPair,
  runMatches,
  transitionCampus,
  type CampusJourney,
  type CampusJourneyEvent,
  type CampusRun,
} from "./campusJourney";
import { useGame } from "./state";
import { readCampusSessions } from "./campusSave";
export interface CampusSession {
  settings: CampusSettings;
  answer: number | null;
  evidence: string[];
  result: CampusResult | null;
  stage: number;
  runs: CampusRun[];
  proofs: Record<string, CampusRun>;
  journey: CampusJourney;
}
export const campusSession = (): CampusSession => ({
  settings: campusDefaults(),
  answer: null,
  evidence: [],
  result: null,
  stage: 0,
  runs: [],
  proofs: {},
  journey: campusJourney(),
});
const ids = [
  ...CAMPUS_EXHIBITS.map((e) => e.id),
  "festival",
] as CampusActivityId[];
interface CampusState {
  /** Transient ownership: reset invalidates an in-flight experiment. */
  generation: number;
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
  event: (id: CampusActivityId, event: CampusJourneyEvent) => boolean;
  reset: () => void;
}
export const useCampus = create<CampusState>()(
  persist(
    (set, get) => ({
      generation: 0,
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
        const run: CampusRun = {
          key,
          result,
          settings: cleanCampusSettings(settings),
          revision: CAMPUS_EXPERIMENT_REVISION,
        };
        const proofs = { ...prior.proofs };
        if (CAMPUS_EVIDENCE[id].includes(key) && runMatches(id, key, run))
          proofs[key] = run;
        if (id === "rotations") {
          // Keep the last compatible pair while the player tries unrelated runs.
          const candidate = rotationPair({
            ...prior,
            runs: [...prior.runs, run],
          });
          if (candidate) {
            proofs["rotation:false"] = candidate.first;
            proofs["rotation:true"] = candidate.inverse;
          } else if (
            prior.proofs["rotation:false"] &&
            prior.proofs["rotation:true"]
          ) {
            proofs["rotation:false"] = prior.proofs["rotation:false"];
            proofs["rotation:true"] = prior.proofs["rotation:true"];
          }
        }
        get().update(id, {
          result,
          runs: [...prior.runs, run].slice(-6),
          proofs,
          evidence: [...new Set([...prior.evidence, key])].filter((k) =>
            CAMPUS_EVIDENCE[id].includes(k),
          ),
        });
      },
      complete: (id) => {
        if (get().completed.includes(id)) return;
        set((s) => ({ completed: [...new Set([...s.completed, id])] }));
        if (get().completed.length === CAMPUS_EXHIBITS.length)
          useProgress.getState().complete("campus", "orientation");
      },
      open: (id) => set((s) => ({ opened: [...new Set([...s.opened, id])] })),
      event: (id, event) => {
        const game = useGame.getState();
        if (game.operations > 0 || game.phase === "busy" || game.busyLabel)
          return false;
        const session = get().sessions[id] ?? campusSession();
        const journey = transitionCampus(id, session, event);
        if (journey === session.journey) return false;
        get().update(id, {
          journey,
          ...(id === "festival"
            ? {
                stage: journey.phase === "complete" ? 3 : journey.investigation,
                ...(journey.investigation !== session.journey.investigation
                  ? {
                      result: null,
                      settings: {
                        ...session.settings,
                        pair: "independent",
                        basis: "Z",
                        disturbance: 1,
                        analyzer: false,
                      },
                    }
                  : {}),
              }
            : {}),
        });
        if (event.type === "finish" && journey.phase === "complete") {
          if (id === "festival")
            useProgress.getState().complete("campus", "festival");
          else get().complete(id);
        }
        return true;
      },
      reset: () =>
        set((s) => ({
          completed: [],
          sessions: {},
          opened: [],
          generation: s.generation + 1,
        })),
    }),
    {
      name: "quantum-campus-v1",
      version: 2,
      migrate: (saved) =>
        (saved && typeof saved === "object"
          ? saved
          : {}) as Partial<CampusState>,
      storage: saveStorage(),
      skipHydration: true,
      partialize: (s) => ({
        completed: s.completed,
        sessions: s.sessions,
        opened: s.opened,
      }),
      merge: (saved, current) => {
        const data = saved as Partial<CampusState> | null;
        const sessions = readCampusSessions(data);
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
