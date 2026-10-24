"use client";

import { useId, useMemo, useState } from "react";
import { ExplorationNavigation } from "./ExplorationNavigation";
import { LAB_ENTRANCES } from "@/content/labEntrances";
import type { MinimapProps } from "./WorldTownScreen";
import { terrainPaths } from "./TownMinimap";
import { t, useLocale } from "@/i18n";
import {
  EXPLORATION_STATUS,
  type ExplorationStatus,
} from "@/game/explorationStatus";

export interface MinimapPlace {
  id: string;
  at: { x: number; y: number };
  label: string;
  symbol: string;
  status?: ExplorationStatus;
}
/** A road off the edge of the map: an arrow drawn just outside the wall. */
export interface MinimapRoad {
  at: { x: number; y: number };
  glyph: string;
  title: string;
  locked?: boolean;
  walkTo: { x: number; y: number };
}

/** The town as far as the player has walked: unseen tiles stay dark, and places appear once seen. */
export function WorldMinimap({
  map,
  places,
  roads,
  ariaLabel,
  legend,
  position,
  facing,
  done,
  pending,
  tracked,
  explored,
  labTown,
  labRevealed,
}: MinimapProps & {
  map: { width: number; height: number; rows: string[] };
  places: MinimapPlace[];
  roads: MinimapRoad[];
  ariaLabel: string;
  /** Short legend lines under the map, e.g. "C · Coin house". */
  legend: string[];
}) {
  useLocale((state) => state.locale);
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches,
  );
  const lab = labTown ? LAB_ENTRANCES[labTown] : null;
  const mapPlaces: MinimapPlace[] = [
    ...places.filter((place) => place.id !== "labDoor"),
    ...(lab && labRevealed
      ? [
          {
            id: "labDoor",
            at: lab.at,
            label: "Personal quantum lab",
            symbol: "L",
          },
        ]
      : []),
  ];
  const statusOf = (place: MinimapPlace) =>
    place.status ?? (done.includes(place.id) ? "complete" : null);
  const placeLabel = (place: MinimapPlace) => {
    const status = statusOf(place);
    return `${t(place.label)}${status ? ` · ${t(EXPLORATION_STATUS[status].label)}` : ""}${tracked === place.id ? ` · ${t("Tracked destination")}` : ""}`;
  };
  const activityMarkers = places.some((place) => place.status !== undefined);
  const mapId = useId();
  const [terrain] = useState(() => terrainPaths(map.rows));
  const { width, height } = map;
  const seen = useMemo(() => new Set(explored), [explored]);
  const fog = useMemo(() => {
    let path = "";
    for (let y = 0; y < height; y++)
      for (let x = 0, start = -1; x <= width; x++) {
        const hidden = x < width && !seen.has(y * 100 + x);
        if (hidden && start < 0) start = x;
        if (!hidden && start >= 0) {
          path += `M${start} ${y}h${x - start}v1h-${x - start}z`;
          start = -1;
        }
      }
    return path;
  }, [seen, width, height]);
  const visible = (at: { x: number; y: number }) =>
    seen.has(
      Math.min(Math.max(Math.round(at.y), 0), height - 1) * 100 +
        Math.min(Math.max(Math.round(at.x), 0), width - 1),
    );
  const rotation = { up: 0, right: 90, down: 180, left: 270 }[facing];
  const visiblePlaces = mapPlaces.filter(
    (place) =>
      place.id === "labDoor" ||
      visible(place.at) ||
      statusOf(place) === "complete",
  );
  return (
    <aside
      className={`town-minimap panel bg-stage-bg/95 p-2 ${collapsed ? "w-36" : "w-44 sm:w-56"}`}
      aria-label={t("Town minimap")}
    >
      <button
        type="button"
        className="minimap-toggle flex w-full items-center justify-between gap-2 text-xs text-accent-teal"
        aria-expanded={!collapsed}
        aria-controls={mapId}
        title={t(collapsed ? "Show minimap" : "Hide minimap")}
        onClick={() => setCollapsed((value) => !value)}
      >
        <span>{t("Town minimap")}</span>
        <span aria-hidden="true">{collapsed ? "+" : "−"}</span>
      </button>
      <div id={mapId} hidden={collapsed}>
        <svg
          viewBox={`-2 -2 ${width + 4} ${height + 4}`}
          className="mt-2 block w-full border border-stage-border bg-stage-bg"
          role="img"
          aria-label={[
            t(ariaLabel),
            ...visiblePlaces
              .filter((place) => place.status !== undefined)
              .map(placeLabel),
          ].join(" ")}
        >
          {Array.from(terrain, ([color, path]) => (
            <path key={color} d={path} fill={color} />
          ))}
          <path d={fog} fill="#07161f" opacity={0.92} />
          {roads
            .filter((road) => visible(road.at))
            .map((road) => (
              <text
                key={road.title}
                x={road.at.x}
                y={road.at.y}
                textAnchor="middle"
                fontFamily="monospace"
                fontSize={2.6}
                fill={road.locked ? "#f87171" : "#f2c983"}
              >
                {road.locked ? "✕" : road.glyph}
                <title>{`${t(road.title)}${road.locked ? ` · ${t("Locked")}` : ""}`}</title>
              </text>
            ))}
          {visiblePlaces.map((place) => {
            const status = statusOf(place);
            const finished = status === "complete",
              waiting = pending.includes(place.id);
            const color = finished
              ? "#90e0cd"
              : waiting
                ? "#f2c983"
                : "#a9cbd4";
            return (
              <g
                key={place.id}
                transform={`translate(${place.at.x + 0.5} ${place.at.y + 0.5})`}
              >
                <title>{placeLabel(place)}</title>
                {tracked === place.id && (
                  <circle
                    r={2.5}
                    fill="none"
                    stroke="#f2c983"
                    strokeWidth={0.35}
                    strokeDasharray="0.8 0.5"
                  />
                )}
                <rect
                  x={-1.5}
                  y={-1.5}
                  width={3}
                  height={3}
                  rx={0.4}
                  fill={finished ? color : "#102630"}
                  stroke={color}
                  strokeWidth={0.35}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="monospace"
                  fontSize={2.4}
                  fontWeight="bold"
                  fill={finished ? "#102630" : color}
                >
                  {status && status !== "new"
                    ? EXPLORATION_STATUS[status].symbol
                    : place.symbol}
                </text>
              </g>
            );
          })}
          <g
            transform={`translate(${position.x + 0.5} ${position.y + 0.5}) rotate(${rotation})`}
          >
            <title>{t("You")}</title>
            <circle r={1.5} fill="#07161f" />
            <path
              d="M0 -1.5L1.1 1.1L0 0.6L-1.1 1.1Z"
              fill="#fff"
              stroke="#07161f"
              strokeWidth={0.2}
            />
          </g>
        </svg>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-stage-muted">
          {activityMarkers ? (
            Object.entries(EXPLORATION_STATUS)
              .filter(([status]) => status !== "new")
              .map(([status, entry]) => (
                <span key={status}>
                  <span
                    aria-hidden="true"
                    className={
                      status === "complete"
                        ? "text-accent-teal"
                        : "text-accent-amber"
                    }
                  >
                    {entry.symbol}
                  </span>{" "}
                  {t(entry.label)}
                </span>
              ))
          ) : (
            <>
              <span>
                <span className="text-accent-amber">◇</span>{" "}
                {t("Something to learn")}
              </span>
              <span>
                <span className="text-accent-teal">✓</span> {t("Completed")}
              </span>
            </>
          )}
        </div>
        <ul className="mt-2 grid gap-1 border-t border-stage-border pt-2 text-[10px] text-stage-muted">
          {legend.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <ExplorationNavigation
        destinations={[
          ...mapPlaces.map((place) => ({
            id: place.id,
            label: place.label,
            at: place.at,
          })),
          ...roads.map((road) => ({
            id: `road:${road.title}`,
            label: road.title,
            at: road.walkTo,
            locked: road.locked,
            exit: true,
          })),
        ]}
      />
    </aside>
  );
}
