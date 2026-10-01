"use client";

import { useId, useMemo, useState } from "react";
import type { MinimapProps } from "./WorldTownScreen";
import { terrainPaths } from "./TownMinimap";
import { t, useLocale } from "@/i18n";

export interface MinimapPlace { id: string; at: { x: number; y: number }; label: string; symbol: string }
/** A road off the edge of the map: an arrow drawn just outside the wall. */
export interface MinimapRoad { at: { x: number; y: number }; glyph: string; title: string; locked?: boolean }

/** The town as far as the player has walked: unseen tiles stay dark, and places appear once seen. */
export function WorldMinimap({ map, places, roads, ariaLabel, legend, position, facing, done, pending, tracked, explored }: MinimapProps & {
  map: { width: number; height: number; rows: string[] };
  places: MinimapPlace[]; roads: MinimapRoad[]; ariaLabel: string;
  /** Short legend lines under the map, e.g. "C · Coin house". */
  legend: string[];
}) {
  useLocale((state) => state.locale);
  const [collapsed, setCollapsed] = useState(false);
  const mapId = useId();
  const [terrain] = useState(() => terrainPaths(map.rows));
  const { width, height } = map;
  const seen = useMemo(() => new Set(explored), [explored]);
  const fog = useMemo(() => {
    let path = "";
    for (let y = 0; y < height; y++) for (let x = 0, start = -1; x <= width; x++) {
      const hidden = x < width && !seen.has(y * 100 + x);
      if (hidden && start < 0) start = x;
      if (!hidden && start >= 0) { path += `M${start} ${y}h${x - start}v1h-${x - start}z`; start = -1; }
    }
    return path;
  }, [seen, width, height]);
  const visible = (at: { x: number; y: number }) => seen.has(Math.min(Math.max(Math.round(at.y), 0), height - 1) * 100 + Math.min(Math.max(Math.round(at.x), 0), width - 1));
  const rotation = { up: 0, right: 90, down: 180, left: 270 }[facing];
  return <aside className="town-minimap panel w-44 bg-stage-bg/95 p-2 sm:w-56" aria-label={t("Town minimap")}>
    <button type="button" className="flex w-full items-center justify-between gap-2 text-xs text-accent-teal" aria-expanded={!collapsed} aria-controls={mapId}
      title={t(collapsed ? "Show minimap" : "Hide minimap")} onClick={() => setCollapsed((value) => !value)}>
      <span>{t("Town minimap")}</span><span aria-hidden="true">{collapsed ? "+" : "−"}</span>
    </button>
    <div id={mapId} hidden={collapsed}>
      <svg viewBox={`-2 -2 ${width + 4} ${height + 4}`} className="mt-2 block w-full border border-stage-border bg-stage-bg" role="img" aria-label={t(ariaLabel)}>
        {Array.from(terrain, ([color, path]) => <path key={color} d={path} fill={color} />)}
        <path d={fog} fill="#07161f" opacity={0.92} />
        {roads.filter((road) => visible(road.at)).map((road) => <text key={road.title} x={road.at.x} y={road.at.y} textAnchor="middle" fontFamily="monospace" fontSize={2.6}
          fill={road.locked ? "#f87171" : "#f2c983"}>{road.locked ? "✕" : road.glyph}<title>{`${t(road.title)}${road.locked ? ` · ${t("Locked")}` : ""}`}</title></text>)}
        {places.filter((place) => visible(place.at) || done.includes(place.id)).map((place) => {
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
      {legend.map((line) => <p key={line} className="mt-1 text-[10px] text-stage-muted">{line}</p>)}
    </div>
  </aside>;
}
