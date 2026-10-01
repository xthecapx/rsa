"use client";

import { COIN_TOWN_DOOR, COIN_TOWN_EAST_SIGN, COIN_TOWN_NORTH_ROAD, COIN_TOWN_NPCS, COIN_TOWN_SIDE_ROAD, COIN_TOWN_WEST_SIGN, CARD_COUNT, KNOWLEDGE, MAYOR, SIGNS, WARDEN,
  type CoinTownNpcId } from "@/content/coinTown";
import { coinTownMap } from "@/engine/maps/coinTownMap";
import { useTown } from "@/game/town";
import { useProgress } from "@/game/progress";
import { useMedals } from "@/game/medals";
import { useTravelPass } from "@/game/travelPass";
import { openRoads } from "@/game/roads";
import { t } from "@/i18n";
import type { RestartOption } from "./StartOverControl";
import { WorldMinimap, type MinimapPlace } from "./WorldMinimap";
import { WorldTownScreen, type TownConfig } from "./WorldTownScreen";

/** The order Mayor Cap suggests: each neighbor builds on the last, the coin house sits in the middle. */
const ROUTE = ["luz", "nico", "coinDoor", "tomas", "marisol", "oscar"];
const TEACHER_ORDER: CoinTownNpcId[] = ["luz", "nico", "tomas", "marisol", "oscar"];
const TEACHERS = TEACHER_ORDER.map((id) => COIN_TOWN_NPCS.find((npc) => npc.id === id)!);
const npcAt = (id: CoinTownNpcId) => COIN_TOWN_NPCS.find((npc) => npc.id === id)!.at;
const PLACES: MinimapPlace[] = [
  { id: "coinDoor", at: COIN_TOWN_DOOR.at, label: "Coin house", symbol: "C" },
  { id: "mayor", at: npcAt("mayor"), label: "Mayor Cap", symbol: "M" },
  ...TEACHERS.map((npc, i) => ({ id: npc.id, at: npc.at, label: npc.title, symbol: String(i + 1) })),
  { id: "warden", at: npcAt("warden"), label: "Beto", symbol: "B" },
  { id: "eastSign", at: COIN_TOWN_EAST_SIGN.at, label: "Foundry Town →", symbol: "→" },
  { id: "westSign", at: COIN_TOWN_WEST_SIGN.at, label: "← Hollow Town", symbol: "←" },
];
const SIDE_ROW = COIN_TOWN_SIDE_ROAD[1] + 0.9;

export function CoinTownScreen({ onLeave, onEast, onWest, onEnterCoin, restartOptions }: {
  /** North road to Cipher Town. */
  onLeave: () => void;
  /** East road to Foundry Town. */
  onEast: () => void;
  /** West road to Hollow Town. */
  onWest: () => void;
  onEnterCoin: () => void; restartOptions: RestartOption[];
}) {
  const completed = useProgress((state) => state.completed);
  const coinBadge = useMedals((state) => !!state.earned["coin-town"]);
  const foundryBadge = useMedals((state) => !!state.earned["foundry-town"]);
  const hollowBadge = useMedals((state) => !!state.earned["hollow-town"]);
  const metThecap = useTown((state) => state.welcomed);
  /** The temporary travel pass opens every built road, for checking towns. */
  const pass = useTravelPass((state) => state.active);
  const coinComplete = !!completed.coin?.includes("coin");
  /** The roads open in challenge order (game/roads.ts): Coin Town's badge opens the east road, the Foundry Badge the west road, the Hollow Badge the north road. */
  const cipherBadge = useMedals((state) => !!state.earned["cipher-town"]);
  const roads = openRoads({ pass, badges: { coin: coinBadge, foundry: foundryBadge, hollow: hollowBadge, cipher: cipherBadge }, metThecap,
    rsaActs: ["1", "2", "3", "4"].filter((act) => completed.rsa?.includes(act)).length });
  const { coinNorth: northOpen, coinWest: westOpen, coinEast: eastOpen } = roads;

  const config: TownConfig = {
    world: "coinTown", slot: "coinTown",
    title: "Coin Town", subtitle: "Learn from the neighbors · settle game night",
    greeter: {
      id: "mayor", title: "Mayor Cap", meet: "Meet Mayor Cap by the entrance", thanks: "Thank you, Mayor",
      welcome: [MAYOR.welcome], guide: MAYOR.guide, count: CARD_COUNT,
      waiting: MAYOR.coinWaiting, challengeDone: MAYOR.coinDone, ready: MAYOR.ready, done: MAYOR.done,
    },
    teachers: TEACHERS, cards: KNOWLEDGE, npcs: COIN_TOWN_NPCS,
    challenge: {
      door: "coinDoor", title: "Who Goes First?", complete: coinComplete,
      blurb: "Game night · Beginner. Build a coin program, investigate a known seed, and make your first quantum circuit.",
      enter: "Enter the house", resume: "Resume in the house", objective: "Settle game night in the coin house", journal: "Settle game night in the coin house",
      onEnter: onEnterCoin,
    },
    route: ROUTE,
    badge: { medal: "coin-town", award: () => useProgress.getState().complete("coin", "town"), journal: "Earn the Coin Town badge", collect: "Collect your badge from Mayor Cap" },
    afterBadge: () => (northOpen ? "warden" : westOpen ? "westSign" : "eastSign"),
    objectiveFor: (target) => (target === "warden" ? "Take the north road to Cipher Town" : target === "eastSign" ? "Take the east road to Foundry Town" : target === "westSign" ? "Take the west road to Hollow Town" : null),
    idle: "Coin Town is yours. The east road leads to Foundry Town.",
    others: {
      warden: () => ({ title: "Beto", lines: [northOpen ? WARDEN.open : WARDEN.closed] }),
      eastSign: () => ({ title: "Foundry Town", lines: [eastOpen ? SIGNS.eastOpen : SIGNS.eastClosed] }),
      westSign: () => ({ title: "Hollow Town", lines: [westOpen ? SIGNS.westOpen : SIGNS.westClosed] }),
    },
    nearLabels: { eastSign: "Read the signpost", westSign: "Read the signpost" },
    gates: { north: northOpen, east: eastOpen, west: westOpen },
    gateNotes: { north: WARDEN.closed, east: SIGNS.eastClosed, west: SIGNS.westClosed },
    exits: [
      { test: (at) => at.y === 0 && COIN_TOWN_NORTH_ROAD.includes(at.x), go: onLeave },
      { test: (at) => at.x === coinTownMap.width - 1, go: onEast },
      { test: (at) => at.x === 0, go: onWest },
    ],
    journal: {
      title: "Coin Town journal", intro: "Learn from the neighbors, settle the coin toss, then see Mayor Cap for the town badge.",
      roads: [{ label: "Take the east road to Foundry Town", open: eastOpen }, { label: "Take the west road to Hollow Town", open: westOpen }, { label: "Take the north road to Cipher Town", open: northOpen }],
    },
    restart: { label: "Restart Coin Town", description: "Forget the five knowledge cards and meet Mayor Cap again. Your medals and the coin lesson stay.", restart: () => {} },
    minimap: (props) => <WorldMinimap {...props} map={coinTownMap} places={PLACES}
      roads={[
        { at: { x: COIN_TOWN_NORTH_ROAD[0] + 1, y: -0.4 }, glyph: "↑", title: "North road to Cipher Town", locked: !northOpen },
        { at: { x: coinTownMap.width + 0.8, y: SIDE_ROW }, glyph: "→", title: "East road to Foundry Town", locked: !eastOpen },
        { at: { x: -0.8, y: SIDE_ROW }, glyph: "←", title: "West road to Hollow Town", locked: !westOpen },
      ]}
      ariaLabel="Coin Town map: C is the coin house, M is Mayor Cap, 1 to 5 are the neighbors with knowledge cards, and the arrows are the roads north to Cipher Town, east to Foundry Town and west to Hollow Town."
      legend={[`C · ${t("Coin house")}　M · ${t("Mayor Cap")}　B · ${t("Beto")}`, TEACHERS.map((npc, i) => `${i + 1} · ${t(npc.title)}`).join("　")]} />,
  };
  return <WorldTownScreen config={config} restartOptions={restartOptions} />;
}
