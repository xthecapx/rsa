"use client";
import { useEffect, useRef, useState } from "react";
import {
  CAMPUS_EXHIBITS,
  CAMPUS_GUIDE,
  type CampusActivityId,
} from "@/content/campus";
import { useCampus, campusSession } from "@/game/campus";
import { investigationFor, investigationReady } from "@/game/campusJourney";
import { useTown } from "@/game/town";
import { useGame } from "@/game/state";
import { useExecution } from "@/lib/execution";
import { useMedals } from "@/game/medals";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";
import type { TownConfig } from "./WorldTownScreen";
import { DialogueFrame, DialogueLine } from "./DialoguePresentation";
import { CampusLaptop } from "./CampusLaptop";
import { CampusConversation } from "./CampusConversation";

type LaptopVisit = { id: CampusActivityId | "notebook"; guided: boolean };
/** Owns local overlays, while the world retains its scene and input handling. */
export function useCampusInteraction(): NonNullable<
  TownConfig["interaction"]
> & { suggested: string | null } {
  useLocale((s) => s.locale);
  const background = useExecution((s) => !!s.background);
  const [active, setActive] = useState<CampusActivityId | "guide" | null>(null);
  const [laptop, setLaptop] = useState<LaptopVisit | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const store = useCampus();
  const generation = store.generation;
  const badge = useMedals((s) => !!s.earned["quantum-explorer"]);
  const focus = useRef<HTMLDivElement>(null);
  const previousGeneration = useRef(generation);
  useEffect(() => {
    if (previousGeneration.current !== generation) {
      previousGeneration.current = generation;
      setActive(null);
      setLaptop(null);
    }
  }, [generation]);
  useEffect(() => {
    focus.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [active, laptop]);
  const completed = (id: CampusActivityId) =>
    id === "festival" ? badge : store.completed.includes(id);
  const canInteract = () => {
    const game = useGame.getState();
    return game.operations === 0 && game.phase !== "busy" && !game.busyLabel;
  };
  function meet(id: CampusActivityId) {
    if (!canInteract()) return;
    store.open(id);
    if (!completed(id)) store.event(id, { type: "return" });
    setLaptop(null);
    setActive(id);
  }
  function open(id: CampusActivityId, guided: boolean) {
    if (!canInteract()) return;
    setActive(null);
    setLaptop({ id, guided });
  }
  function closeLaptop(selected: CampusActivityId | "notebook") {
    if (!canInteract()) return;
    const visit = laptop;
    setLaptop(null);
    // A notebook/free-play visit, or another exhibit opened from its notebook,
    // never borrows the original host's investigation or launches a debrief.
    if (visit?.guided && visit.id === selected && selected !== "notebook")
      meet(selected);
  }
  function interact(id: string) {
    if (!canInteract()) return;
    if (id === "notebook") {
      setActive(null);
      setLaptop({ id: "notebook", guided: false });
    } else if (id === CAMPUS_GUIDE.id) {
      const town = useTown.getState();
      town.patch({ campus: { ...town.campus, welcomed: true } });
      setActive("guide");
    } else if (id === "festival" || CAMPUS_EXHIBITS.some((e) => e.id === id))
      meet(id as CampusActivityId);
  }
  const pending = CAMPUS_EXHIBITS.find(
    (e) =>
      !store.completed.includes(e.id) &&
      store.sessions[e.id] &&
      store.sessions[e.id]!.journey.phase !== "intro",
  );
  const later = () => setActive(null);
  const host =
    active && active !== "guide"
      ? CAMPUS_EXHIBITS.find((e) => e.id === active)
      : undefined;
  const session =
    active && active !== "guide"
      ? (store.sessions[active] ?? campusSession())
      : null;
  const festivalHost = session
    ? (["paco", "paloma", "candela"] as const)[
        Math.min(session.journey.investigation, 2)
      ]
    : "vpcap";
  const speaker =
    active === "festival" ? festivalHost : (host?.sprite ?? "vpcap");
  const title =
    active === "guide"
      ? "Campus guide"
      : active === "festival"
        ? "Open the Festival"
        : (host?.host ?? "Quantum Campus");
  function suggest(id: CampusActivityId) {
    setSuggested(id);
    setActive(null);
  }
  return {
    suggested,
    handles: (id) =>
      id === CAMPUS_GUIDE.id ||
      id === "notebook" ||
      id === "festival" ||
      CAMPUS_EXHIBITS.some((e) => e.id === id),
    interact,
    locked: !!active || (!!laptop && !background),
    layer: (
      <>
        {laptop && (
          <CampusLaptop
            key={laptop.id}
            initial={laptop.id}
            investigation={
              laptop.guided && laptop.id !== "notebook"
                ? investigationFor(
                    laptop.id,
                    store.sessions[laptop.id] ?? campusSession(),
                  ).question
                : undefined
            }
            onClose={closeLaptop}
          />
        )}
        {active && !laptop && (
          <div
            ref={focus}
            className="campus-dialogue-layer absolute inset-0 z-20 flex items-end justify-center bg-black/30 p-3 sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-label={t(title)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape") {
                event.preventDefault();
                later();
              }
            }}
          >
            {active === "guide" ? (
              <DialogueFrame
                className="max-w-4xl"
                actions={
                  <div className="flex flex-wrap gap-2">
                    {pending && (
                      <button
                        className="btn-primary"
                        onClick={() => suggest(pending.id)}
                      >
                        {t("Resume with {host}").replace(
                          "{host}",
                          t(pending.host),
                        )}
                      </button>
                    )}
                    <button
                      className="btn-ghost"
                      onClick={() => suggest("passports")}
                    >
                      {t("What do these symbols mean?")}
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => suggest("qubit")}
                    >
                      {t("Why use a circuit?")}
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => suggest("arcade")}
                    >
                      {t("Why do the results vary?")}
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => suggest("festival")}
                    >
                      {t("Help at the festival")}
                    </button>
                    <button className="btn-ghost" onClick={later}>
                      {t("I’ll explore on my own")}
                    </button>
                  </div>
                }
              >
                <DialogueLine speaker="vpcap">
                  {t(
                    "Welcome to our open day! Every stand has a problem you can help investigate. Ask questions, make a prediction, and bring back what you find. Nothing here blocks your trip to Coin Town.",
                  )}
                </DialogueLine>
                <p className="mt-3 text-sm text-stage-muted">
                  {t(
                    "Rosa is to the left of the entrance. Follow the paths south to explore; the north road returns to Coin Town.",
                  )}
                </p>
              </DialogueFrame>
            ) : (
              <CampusConversation
                key={active}
                id={active}
                speaker={speaker}
                completed={completed(active)}
                onLater={later}
                onOpen={(guided) => open(active, guided)}
                onFinish={() => {
                  if (useCampus.getState().event(active, { type: "finish" })) {
                    const updated = useCampus.getState().sessions[active]!;
                    if (updated.journey.phase === "complete")
                      gameAudio.playSynth("fanfare");
                    else gameAudio.playSfx("select");
                    if (
                      updated.journey.phase === "investigate" &&
                      investigationReady(active, updated)
                    )
                      useCampus.getState().event(active, { type: "return" });
                  }
                }}
              />
            )}
          </div>
        )}
      </>
    ),
  };
}
