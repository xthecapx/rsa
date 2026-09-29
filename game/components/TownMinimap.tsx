"use client";

import { useId, useMemo, useState } from "react";
import { CLIENT_POSITION, TOWN_LOCATIONS, TOWN_TREES } from "@/content/town";
import { townMap } from "@/engine/maps/townMap";
import { useTown } from "@/game/town";
import { useProgress } from "@/game/progress";
import { t, useLocale } from "@/i18n";

const { width, height, rows } = townMap;
const terrain = new Map<string, string>();
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const tile = rows[y][x];
  const color = "pq".includes(tile) ? "#708082" : "ryzm".includes(tile) ? "#354754" : ".,e".includes(tile) ? "#37624e" : "svd".includes(tile) ? "#8a7b5a" : "#ae8967";
  terrain.set(color, (terrain.get(color) ?? "") + `M${x} ${y}h1v1h-1z`);
}
const places = [
  { id: "coinDoor", at: TOWN_LOCATIONS.coinDoor.at, label: "Who Goes First?", symbol: "1", scenario: "coin" },
  { id: "rsa", at: CLIENT_POSITION, label: "RSA client", symbol: "2", scenario: "rsa" },
  { id: "guide", at: TOWN_LOCATIONS.guide.at, label: "Professor Thecap", symbol: "P", scenario: null },
  { id: "sign", at: TOWN_LOCATIONS.sign.at, label: "Signpost", symbol: "S", scenario: null },
  { id: "groverDoor", at: TOWN_LOCATIONS.groverDoor.at, label: "Thecap’s workshop", symbol: "3", scenario: "grover" },
  { id: "futureB", at: TOWN_LOCATIONS.futureB.at, label: "Coming soon", symbol: "?", scenario: null },
] as const;

/** The map stays legible without loading another game engine or canvas. */
export function TownMinimap() {
  useLocale((state) => state.locale);
  const { position, facing, tracked, discovered, explored } = useTown();
  const completed = useProgress((state) => state.completed);
  const [collapsed, setCollapsed] = useState(false);
  const mapId = useId();
  const fog = useMemo(() => {
    const visible = new Set(explored);
    let path = "";
    for (let y = 0; y < height; y++) {
      let start = -1;
      for (let x = 0; x <= width; x++) {
        const hidden = x < width && !visible.has(y * width + x);
        if (hidden && start < 0) start = x;
        if (!hidden && start >= 0) { path += `M${start} ${y}h${x - start}v1h-${x - start}z`; start = -1; }
      }
    }
    return path;
  }, [explored]);
  const rotation = { up: 0, right: 90, down: 180, left: 270 }[facing];
  const coinDone = !!completed.coin?.includes("coin");
  const rsaDone = ["1", "2", "3", "4"].every((act) => completed.rsa?.includes(act));
  const groverDone = !!completed.grover?.includes("grover");
  const visitedCount = places.filter((place) => discovered.includes(place.id) || (place.scenario === "coin" && coinDone) || (place.scenario === "rsa" && rsaDone) || (place.scenario === "grover" && groverDone)).length;

  return <aside className="town-minimap panel w-44 bg-stage-bg/95 p-2 sm:w-56" aria-label={t("Town minimap")}>
    <button type="button" className="flex w-full items-center justify-between gap-2 text-xs text-accent-teal" aria-expanded={!collapsed} aria-controls={mapId}
      title={t(collapsed ? "Show minimap" : "Hide minimap")} onClick={() => setCollapsed((value) => !value)}>
      <span>{t("Town minimap")}</span><span aria-hidden="true">{collapsed ? "+" : "−"}</span>
    </button>
    <div id={mapId} hidden={collapsed}>
      <svg viewBox={`-2 -2 ${width + 4} ${height + 4}`} className="mt-2 block w-full border border-stage-border bg-stage-bg" role="img" aria-label={t("Your position and explored terrain. Number 1 is the coin house; number 2 is the RSA client; number 3 is Thecap’s workshop.")}>
        {Array.from(terrain, ([color, path]) => <path key={color} d={path} fill={color} />)}
        {TOWN_TREES.map(({ x, y }) => <circle key={`${x}:${y}`} cx={x + 0.5} cy={y + 0.5} r={0.7} fill="#214636" />)}
        <path d={fog} fill="#07161f" opacity={0.88} />
        {places.map((place) => {
          const done = place.scenario === "coin" ? coinDone : place.scenario === "rsa" ? rsaDone : place.scenario === "grover" ? groverDone : false;
          const visited = discovered.includes(place.id) || done;
          const selected = place.scenario !== null && tracked === place.scenario;
          const color = done ? "#90e0cd" : visited ? "#a9cbd4" : "#f2c983";
          const status = done ? "Completed" : visited ? "Visited" : "Not visited yet";
          return <g key={place.id} transform={`translate(${place.at.x + 0.5} ${place.at.y + 0.5})`}>
            <title>{`${t(place.label)} · ${t(status)}${selected ? ` · ${t("Tracked destination")}` : ""}`}</title>
            {selected && <circle r={2.5} fill="none" stroke="#f2c983" strokeWidth={0.35} strokeDasharray="0.8 0.5" />}
            <rect x={-1.5} y={-1.5} width={3} height={3} rx={0.4} fill={visited ? color : "#102630"} stroke={color} strokeWidth={0.35} />
            <text textAnchor="middle" dominantBaseline="central" fontFamily="monospace" fontSize={2.4} fontWeight="bold" fill={visited ? "#102630" : color}>{done ? "✓" : place.symbol}</text>
          </g>;
        })}
        <g transform={`translate(${position.x + 0.5} ${position.y + 0.5}) rotate(${rotation})`}>
          <title>{t("You")}</title>
          <circle r={1.5} fill="#07161f" />
          <path d="M0 -1.5L1.1 1.1L0 0.6L-1.1 1.1Z" fill="#fff" stroke="#07161f" strokeWidth={0.2} />
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-stage-muted">
        <span><span className="text-accent-amber">◇</span> {t("Unvisited")}</span>
        <span><span className="text-[#a9cbd4]">◆</span> {t("Visited")}</span>
        <span><span className="text-accent-teal">✓</span> {t("Completed")}</span>
      </div>
      <p className="mt-1 text-[10px] text-stage-muted">{visitedCount}/{places.length} · {t("Places visited")}</p>
      <p className="mt-1 text-[10px] text-stage-muted">1 · {t("Coin house")}　2 · {t("RSA client")}　3 · {t("Workshop")}</p>
      <p className="mt-1 text-[10px] text-stage-muted">P · {t("Professor Thecap")}　S · {t("Signpost")}</p>
    </div>
  </aside>;
}
