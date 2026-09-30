"use client";

import { useId, useState } from "react";
import { COIN_TOWN_DOOR, COIN_TOWN_NORTH_ROAD, COIN_TOWN_NPCS, type CoinTownNpcId } from "@/content/coinTown";
import { coinTownMap } from "@/engine/maps/coinTownMap";
import type { WorldFacing } from "@/content/town";
import { terrainPaths } from "./TownMinimap";
import { t, useLocale } from "@/i18n";

const { width, height } = coinTownMap;
const terrain = terrainPaths(coinTownMap.rows);
const TEACHER_ORDER: CoinTownNpcId[] = ["luz", "nico", "tomas", "marisol", "oscar"];
const npcAt = (id: CoinTownNpcId) => COIN_TOWN_NPCS.find((npc) => npc.id === id)!.at;
const PLACES: { id: string; at: { x: number; y: number }; label: string; symbol: string }[] = [
  { id: "coinDoor", at: COIN_TOWN_DOOR.at, label: "Coin house", symbol: "C" },
  { id: "mayor", at: npcAt("mayor"), label: "Mayor Cap", symbol: "M" },
  ...TEACHER_ORDER.map((id, i) => ({ id, at: npcAt(id), label: COIN_TOWN_NPCS.find((npc) => npc.id === id)!.title, symbol: String(i + 1) })),
  { id: "warden", at: npcAt("warden"), label: "Beto", symbol: "B" },
];

/** Coin Town is small enough to show whole: no fog, just who is where and what is done. */
export function CoinTownMinimap({ position, facing, done, pending, tracked }: {
  position: { x: number; y: number }; facing: WorldFacing;
  /** Places finished (✓): the coin house, teachers whose card you hold, the mayor once the badge is yours. */
  done: string[];
  /** Places with something waiting for you (amber). */
  pending: string[];
  tracked: string | null;
}) {
  useLocale((state) => state.locale);
  const [collapsed, setCollapsed] = useState(false);
  const mapId = useId();
  const rotation = { up: 0, right: 90, down: 180, left: 270 }[facing];
  return <aside className="town-minimap panel w-44 bg-stage-bg/95 p-2 sm:w-56" aria-label={t("Town minimap")}>
    <button type="button" className="flex w-full items-center justify-between gap-2 text-xs text-accent-teal" aria-expanded={!collapsed} aria-controls={mapId}
      title={t(collapsed ? "Show minimap" : "Hide minimap")} onClick={() => setCollapsed((value) => !value)}>
      <span>{t("Town minimap")}</span><span aria-hidden="true">{collapsed ? "+" : "−"}</span>
    </button>
    <div id={mapId} hidden={collapsed}>
      <svg viewBox={`-2 -2 ${width + 4} ${height + 4}`} className="mt-2 block w-full border border-stage-border bg-stage-bg" role="img"
        aria-label={t("Coin Town map: C is the coin house, M is Mayor Cap, 1 to 5 are the neighbors with knowledge cards, and the arrow at the top is the north road to Quantum Town.")}>
        {Array.from(terrain, ([color, path]) => <path key={color} d={path} fill={color} />)}
        <text x={COIN_TOWN_NORTH_ROAD[0] + 1} y={-0.4} textAnchor="middle" fontFamily="monospace" fontSize={2.6} fill="#f2c983">↑<title>{t("North road to Quantum Town")}</title></text>
        {PLACES.map((place) => {
          const finished = done.includes(place.id), waiting = pending.includes(place.id);
          const color = finished ? "#90e0cd" : waiting ? "#f2c983" : "#a9cbd4";
          return <g key={place.id} transform={`translate(${place.at.x + 0.5} ${place.at.y + 0.5})`}>
            <title>{`${t(place.label)}${finished ? ` · ${t("Completed")}` : ""}${tracked === place.id ? ` · ${t("Tracked destination")}` : ""}`}</title>
            {tracked === place.id && <circle r={2.5} fill="none" stroke="#f2c983" strokeWidth={0.35} strokeDasharray="0.8 0.5" />}
            <rect x={-1.5} y={-1.5} width={3} height={3} rx={0.4} fill={finished ? color : "#102630"} stroke={color} strokeWidth={0.35} />
            <text textAnchor="middle" dominantBaseline="central" fontFamily="monospace" fontSize={2.4} fontWeight="bold" fill={finished ? "#102630" : color}>{finished ? "✓" : place.symbol}</text>
          </g>;
        })}
        <g transform={`translate(${position.x + 0.5} ${position.y + 0.5}) rotate(${rotation})`}>
          <title>{t("You")}</title>
          <circle r={1.5} fill="#07161f" />
          <path d="M0 -1.5L1.1 1.1L0 0.6L-1.1 1.1Z" fill="#fff" stroke="#07161f" strokeWidth={0.2} />
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-stage-muted">
        <span><span className="text-accent-amber">◇</span> {t("Something to learn")}</span>
        <span><span className="text-accent-teal">✓</span> {t("Completed")}</span>
      </div>
      <p className="mt-1 text-[10px] text-stage-muted">C · {t("Coin house")}　M · {t("Mayor Cap")}　B · {t("Beto")}</p>
      <p className="mt-1 text-[10px] text-stage-muted">{TEACHER_ORDER.map((id, i) => `${i + 1} · ${t(COIN_TOWN_NPCS.find((npc) => npc.id === id)!.title)}`).join("　")}</p>
    </div>
  </aside>;
}
