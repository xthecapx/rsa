"use client";

import { CARD_COUNT, HOLLOW_DOOR, HOLLOW_EAST_ROAD, HOLLOW_NPCS, KEEPER, KNOWLEDGE, type HollowNpcId } from "@/content/hollow";
import { hollowMap } from "@/engine/maps/hollowMap";
import { useProgress } from "@/game/progress";
import { t } from "@/i18n";
import type { RestartOption } from "./StartOverControl";
import { WorldMinimap, type MinimapPlace } from "./WorldMinimap";
import { WorldTownScreen, type TownConfig } from "./WorldTownScreen";

/** The order Keeper Cap suggests: the controlled flip, the flip-proof |−⟩, kickback, parity, then the vault, then Aurelio's one question to confirm it. */
const ROUTE = ["fausto", "candela", "rocio", "ramiro", "vaultDoor", "aurelio"];
const TEACHER_ORDER: HollowNpcId[] = ["fausto", "candela", "rocio", "ramiro", "aurelio"];
const TEACHERS = TEACHER_ORDER.map((id) => HOLLOW_NPCS.find((npc) => npc.id === id)!);
const PLACES: MinimapPlace[] = [
  { id: "vaultDoor", at: HOLLOW_DOOR.at, label: "Casa Ofelia", symbol: "O" },
  { id: "keepercap", at: HOLLOW_NPCS.find((npc) => npc.id === "keepercap")!.at, label: "Keeper Cap", symbol: "K" },
  ...TEACHERS.map((npc, i) => ({ id: npc.id, at: npc.at, label: npc.title, symbol: String(i + 1) })),
];

export function HollowScreen({ onEast, onEnterVault, restartOptions }: {
  /** East road back to Coin Town. */
  onEast: () => void;
  onEnterVault: () => void; restartOptions: RestartOption[];
}) {
  const vaultComplete = useProgress((state) => !!state.completed.vault?.includes("vault"));

  const config: TownConfig = {
    world: "hollow", slot: "hollow",
    title: "Hollow Town", subtitle: "Learn from the neighbors · quiet Casa Ofelia",
    greeter: {
      id: "keepercap", title: "Keeper Cap", meet: "Meet Keeper Cap by the east gate", thanks: "Thank you, Keeper",
      welcome: [KEEPER.welcome, KEEPER.ofelia], guide: KEEPER.guide, count: CARD_COUNT,
      waiting: KEEPER.vaultWaiting, challengeDone: KEEPER.vaultDone, ready: KEEPER.ready, done: KEEPER.done,
    },
    teachers: TEACHERS, cards: KNOWLEDGE, npcs: HOLLOW_NPCS,
    challenge: {
      door: "vaultDoor", title: "Operation Ghost Key", complete: vaultComplete,
      blurb: "Haunted house · Advanced. Doña Ofelia’s house knocks at night. She needs her late husband’s vault opened: 25 bits, three questions.",
      enter: "Knock and go in", resume: "Resume in Casa Ofelia", objective: "Open the vault in Casa Ofelia", journal: "Open the vault in Casa Ofelia",
      onEnter: onEnterVault,
    },
    route: ROUTE,
    badge: { medal: "hollow-town", award: () => useProgress.getState().complete("vault", "town"), journal: "Earn the Hollow Badge", collect: "Collect your badge from Keeper Cap" },
    afterBadge: () => null,
    objectiveFor: () => null,
    idle: "The Hollow Badge is yours. The east road leads back to Coin Town, and its north road is open.",
    others: {},
    nearLabels: {},
    gates: {},
    exits: [{ test: (at) => at.x === hollowMap.width - 1 && HOLLOW_EAST_ROAD.includes(at.y), go: onEast }],
    journal: {
      title: "Hollow Town journal", intro: "Learn from the neighbors, open the vault in Casa Ofelia, then see Keeper Cap for the Hollow Badge.",
      roads: [{ label: "Take the east road back to Coin Town", open: true }],
    },
    restart: { label: "Restart Hollow Town", description: "Forget the five Hollow cards and meet Keeper Cap again. Your medals and the vault lesson stay.", restart: () => {} },
    minimap: (props) => <WorldMinimap {...props} map={hollowMap} places={PLACES}
      roads={[{ at: { x: hollowMap.width + 0.8, y: HOLLOW_EAST_ROAD[1] + 0.9 }, glyph: "→", title: "East road to Coin Town" }]}
      ariaLabel="Hollow Town map: O is Casa Ofelia, K is Keeper Cap, 1 to 5 are the neighbors with knowledge cards, and the arrow on the right is the east road to Coin Town."
      legend={[`O · ${t("Casa Ofelia")}　K · ${t("Keeper Cap")}`, TEACHERS.map((npc, i) => `${i + 1} · ${t(npc.title)}`).join("　")]} />,
  };
  return <WorldTownScreen config={config} restartOptions={restartOptions} />;
}
