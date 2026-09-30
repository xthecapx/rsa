"use client";

import { CARD_COUNT, FOUNDRY_DOOR, FOUNDRY_NPCS, FOUNDRY_WEST_ROAD, KNOWLEDGE, VP, type FoundryNpcId } from "@/content/foundry";
import { foundryMap } from "@/engine/maps/foundryMap";
import { useProgress } from "@/game/progress";
import { t } from "@/i18n";
import type { RestartOption } from "./StartOverControl";
import { WorldMinimap, type MinimapPlace } from "./WorldMinimap";
import { WorldTownScreen, type TownConfig } from "./WorldTownScreen";

/** The order VP Cap suggests: register, spread, Oracle, Diffuser, then the workshop, then Vera's rounds to confirm the whiteboard. */
const ROUTE = ["rosa", "paco", "ines", "joaquin", "workshopDoor", "vera"];
const TEACHER_ORDER: FoundryNpcId[] = ["rosa", "paco", "ines", "joaquin", "vera"];
const TEACHERS = TEACHER_ORDER.map((id) => FOUNDRY_NPCS.find((npc) => npc.id === id)!);
const PLACES: MinimapPlace[] = [
  { id: "workshopDoor", at: FOUNDRY_DOOR.at, label: "Thecap’s workshop", symbol: "W" },
  { id: "vpcap", at: FOUNDRY_NPCS.find((npc) => npc.id === "vpcap")!.at, label: "VP Cap", symbol: "V" },
  ...TEACHERS.map((npc, i) => ({ id: npc.id, at: npc.at, label: npc.title, symbol: String(i + 1) })),
];

export function FoundryScreen({ onWest, onEnterWorkshop, restartOptions }: {
  /** West road back to Coin Town. */
  onWest: () => void;
  onEnterWorkshop: () => void; restartOptions: RestartOption[];
}) {
  const groverComplete = useProgress((state) => !!state.completed.grover?.includes("grover"));

  const config: TownConfig = {
    world: "foundry", slot: "foundry",
    title: "Foundry Town", subtitle: "Learn from the crew · disarm the drone core",
    greeter: {
      id: "vpcap", title: "VP Cap", meet: "Meet VP Cap by the west gate", thanks: "Thank you, VP",
      welcome: [VP.welcome, VP.thecap], guide: VP.guide, count: CARD_COUNT,
      waiting: VP.workshopWaiting, challengeDone: VP.workshopDone, ready: VP.ready, done: VP.done,
    },
    teachers: TEACHERS, cards: KNOWLEDGE, npcs: FOUNDRY_NPCS,
    challenge: {
      door: "workshopDoor", title: "Echo Chamber", complete: groverComplete,
      blurb: "Emergency · Intermediate. An old drone core has locked itself with a 4-bit PIN and three tries. Build Grover’s search on the quantum core and disarm it.",
      enter: "Enter the workshop", resume: "Resume in the workshop", objective: "Disarm the drone core in Thecap’s workshop", journal: "Disarm the drone core in Thecap’s workshop",
      onEnter: onEnterWorkshop,
    },
    route: ROUTE,
    badge: { medal: "foundry-town", award: () => useProgress.getState().complete("grover", "town"), journal: "Earn the Foundry Badge", collect: "Collect your badge from VP Cap" },
    afterBadge: () => null,
    objectiveFor: () => null,
    idle: "The Foundry Badge is yours. The west road leads back to Coin Town, and its north road is open.",
    others: {},
    nearLabels: {},
    gates: {},
    exits: [{ test: (at) => at.x === 0 && FOUNDRY_WEST_ROAD.includes(at.y), go: onWest }],
    journal: {
      title: "Foundry Town journal", intro: "Learn from the crew, disarm the drone core in Thecap’s workshop, then see VP Cap for the Foundry Badge.",
      roads: [{ label: "Take the west road back to Coin Town", open: true }],
    },
    restart: { label: "Restart Foundry Town", description: "Forget the five Foundry cards and meet VP Cap again. Your medals and the workshop lesson stay.", restart: () => {} },
    minimap: (props) => <WorldMinimap {...props} map={foundryMap} places={PLACES}
      roads={[{ at: { x: -0.8, y: FOUNDRY_WEST_ROAD[1] + 0.9 }, glyph: "←", title: "West road to Coin Town" }]}
      ariaLabel="Foundry Town map: W is Thecap’s workshop, V is VP Cap, 1 to 5 are the crew with knowledge cards, and the arrow on the left is the west road to Coin Town."
      legend={[`W · ${t("Thecap’s workshop")}　V · ${t("VP Cap")}`, TEACHERS.map((npc, i) => `${i + 1} · ${t(npc.title)}`).join("　")]} />,
  };
  return <WorldTownScreen config={config} restartOptions={restartOptions} />;
}
