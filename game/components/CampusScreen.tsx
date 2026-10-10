"use client";
import {
  CAMPUS_EXHIBITS,
  CAMPUS_FESTIVAL,
  CAMPUS_GUIDE,
  CAMPUS_NOTEBOOK,
  CAMPUS_WELCOME,
} from "@/content/campus";
import { useCampus } from "@/game/campus";
import { useProgress } from "@/game/progress";
import { useMedals } from "@/game/medals";
import { campusMap } from "@/engine/maps/campusMap";
import { WorldTownScreen, type TownConfig } from "./WorldTownScreen";
import { WorldMinimap } from "./WorldMinimap";
import { CampusLaptop } from "./CampusLaptop";
import type { RestartOption } from "./StartOverControl";
import { t } from "@/i18n";
export function CampusScreen({
  onLeave,
  onEnterLab,
  restartOptions,
}: {
  onLeave: () => void;
  onEnterLab: () => boolean;
  restartOptions: RestartOption[];
}) {
  const completed = useCampus((s) => s.completed);
  const badge = useMedals((s) => !!s.earned["quantum-explorer"]);
  const line = (text: string) => ({ speaker: "vpcap" as const, text });
  const next = CAMPUS_EXHIBITS.find((e) => !completed.includes(e.id));
  const npcs = [
    CAMPUS_GUIDE,
    ...CAMPUS_EXHIBITS.map((e) => ({ id: e.id, title: e.host, at: e.at })),
  ].map((n) => ({
    ...n,
    description: "Campus host",
    intro: [],
    steps: [],
    outro: [],
    repeat: [],
  }));
  const config: TownConfig = {
    world: "campus",
    slot: "campus",
    title: "Quantum Campus",
    subtitle: "Open day · experiment, ask, discover",
    exploration: {
      done: [...completed, ...(badge ? ["festival"] : [])],
      next: next?.id ?? (badge ? null : "festival"),
      objective: next
        ? t("Try any exhibit. Suggested next: {exhibit}").replace(
            "{exhibit}",
            t(next.title),
          )
        : "Visit the festival or keep experimenting. Coin Town is always open.",
    },
    greeter: {
      id: CAMPUS_GUIDE.id,
      title: CAMPUS_GUIDE.title,
      meet: "Meet the campus guide",
      thanks: "Keep exploring",
      count: CAMPUS_WELCOME,
      welcome: [line(CAMPUS_WELCOME)],
      guide: line(
        "Follow the path left to Rosa’s quantum workshop, then explore the exhibits from north to south. The notebook is beside the entrance, and the north road returns to Coin Town. Every exhibit and the festival are open.",
      ),
      waiting: line(CAMPUS_WELCOME),
      challengeDone: line(
        "The festival is open. Your discoveries belong to you!",
      ),
      ready: line("The festival is open. Your discoveries belong to you!"),
      done: line(CAMPUS_WELCOME),
    },
    teachers: [],
    cards: {},
    npcs,
    route: [],
    challenge: {
      door: "festival",
      title: "Open the Festival",
      complete: badge,
      blurb:
        "Repair three exhibits and answer the visitors. You can try directly; the badge never blocks your adventure.",
      enter: "Open the Festival",
      resume: "Open the Festival",
      objective: "Open the Festival",
      journal: "Open the Festival",
      onEnter: () => {},
    },
    badge: {
      medal: "quantum-explorer",
      award: () => {},
      journal: "Earn the Quantum Explorer badge",
      collect: "Earn the Quantum Explorer badge",
    },
    afterBadge: () => null,
    objectiveFor: () => null,
    idle: "Visit the festival or keep experimenting. Coin Town is always open.",
    others: {},
    nearLabels: Object.fromEntries([
      ...CAMPUS_EXHIBITS.map((e) => [e.id, e.title]),
      ["notebook", "Campus field notebook"],
    ]),
    gates: {},
    exits: [
      { test: (at) => at.y === 0 && at.x >= 17 && at.x <= 19, go: onLeave },
    ],
    panels: Object.fromEntries(
      [...CAMPUS_EXHIBITS.map((e) => e.id), "festival", "notebook"].map(
        (id) => [
          id,
          (close: () => void) => (
            <CampusLaptop
              initial={id as Parameters<typeof CampusLaptop>[0]["initial"]}
              onClose={close}
            />
          ),
        ],
      ),
    ),
    journal: {
      title: "Campus field notebook",
      intro: CAMPUS_WELCOME,
      roads: [{ label: "Walk north to Coin Town · always open", open: true }],
      extra: (
        <ul className="space-y-2">
          {CAMPUS_EXHIBITS.map((e) => (
            <li key={e.id}>
              {completed.includes(e.id) ? "✓" : "◇"} {t(e.title)}
            </li>
          ))}
        </ul>
      ),
    },
    restart: {
      label: "Restart campus experiments",
      description:
        "Clear campus experiments and exhibit progress. Your earned badge and other towns stay.",
      restart: () => {
        useCampus.getState().reset();
        useProgress.getState().reset("campus", "orientation");
      },
    },
    minimap: (props) => (
      <WorldMinimap
        {...props}
        map={campusMap}
        places={[
          ...CAMPUS_EXHIBITS.map((e, i) => ({
            id: e.id,
            at: e.at,
            label: e.title,
            symbol: String(i + 1),
          })),
          {
            id: "festival",
            at: CAMPUS_FESTIVAL.at,
            label: "Open the Festival",
            symbol: "F",
          },
          {
            id: "notebook",
            at: CAMPUS_NOTEBOOK.at,
            label: "Campus field notebook",
            symbol: "?",
          },
        ]}
        roads={[
          {
            at: { x: 18, y: -0.6 },
            glyph: "↑",
            title: "Coin Town · always open",
          },
        ]}
        ariaLabel="Quantum Campus map: eight exhibits, festival, notebook and the open north road to Coin Town."
        legend={[t("1–8 · Exhibits　F · Festival　? · Notebook")]}
      />
    ),
  };
  return (
    <WorldTownScreen
      config={config}
      restartOptions={restartOptions}
      onEnterLab={onEnterLab}
    />
  );
}
