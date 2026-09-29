"use client";
import { t, localize, useLocale } from "@/i18n";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Room, RoomBlock, RoomPoint } from "@/game/room";

const DIRECTIONS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
};
export interface HouseRoomProps<Place extends string> {
  room: Room<Place>;
  labels: Record<Place, string>;
  /** Vertical label offset from a station's marker; defaults to above the player. */
  labelOffsets?: Partial<Record<Place, number>>;
  /** Tapping inside a box walks to its interaction point, never through its furniture. */
  tapTargets: { box: RoomBlock; goal: RoomPoint }[];
  regionLabel: string; mapLabel: string;
  initialPlace: Place | null; target: Place | null; disabled: boolean; movementLocked: boolean;
  onWalking: (walking: boolean) => void;
  onExit?: () => void; onNearExit?: (near: boolean) => void;
  onNear: (place: Place | null) => void; onInteract: (place: Place) => void;
  /** Furniture and characters, drawn under the markers and the player. */
  children: ReactNode;
}
/** Same walking vocabulary as the street: arrows/WASD, tap to walk, Space to talk. */
export function HouseRoom<Place extends string>({ room: house, labels, labelOffsets, tapTargets, regionLabel, mapLabel, initialPlace, target, onNear, onInteract, onWalking, disabled, movementLocked, onExit, onNearExit, children }: HouseRoomProps<Place>) {
  useLocale((state) => state.locale);
  const room = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const position = useRef<RoomPoint>({ ...(initialPlace ? house.stations[initialPlace] : house.start) });
  const keys = useRef(new Set<string>());
  const route = useRef<RoomPoint[]>([]);
  const config = useRef({ house, disabled, movementLocked, onNear, onInteract, onWalking, onExit, onNearExit });
  config.current = { house, disabled, movementLocked, onNear, onInteract, onWalking, onExit, onNearExit };
  const [actor, setActor] = useState({ ...position.current, column: 1 });
  const [destination, setDestination] = useState<RoomPoint | null>(null);

  useEffect(() => {
    if (!disabled && !movementLocked) return;
    keys.current.clear(); route.current = []; setDestination(null);
  }, [disabled, movementLocked]);

  useEffect(() => {
    let frame = 0, previousTime = 0, facing = 0, wasWalking = false;
    const geometry = () => config.current.house;
    let reported = geometry().nearbyStation(position.current);
    config.current.onNear(reported);
    let nearExit = geometry().nearExit(position.current);
    config.current.onNearExit?.(nearExit);
    function stop() { keys.current.clear(); route.current = []; setDestination(null); }
    function down(event: KeyboardEvent) {
      if (config.current.disabled || event.altKey || event.ctrlKey || event.metaKey) return;
      const element = event.target as HTMLElement;
      if (element.closest?.("input, textarea, select, [contenteditable=true]")) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (DIRECTIONS[key]) {
        if (config.current.movementLocked) return;
        event.preventDefault();
        if (!keys.current.has(key)) {
          const [dx, dy] = DIRECTIONS[key];
          position.current = geometry().moveInRoom(position.current, dx * 4, dy * 4);
          facing = dx ? dx > 0 ? 9 : 6 : dy > 0 ? 0 : 3;
        }
        keys.current.add(key); route.current = []; setDestination(null);
      } else if (event.code === "Space" && !event.repeat && !element.closest?.("button, a")) {
        event.preventDefault();
        if (geometry().nearExit(position.current)) { config.current.onExit?.(); return; }
        const place = geometry().nearbyStation(position.current);
        if (place) config.current.onInteract(place);
      }
    }
    function up(event: KeyboardEvent) { keys.current.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key); }
    function tick(time: number) {
      const distance = Math.min((time - (previousTime || time)) / 1000, 0.05) * 80;
      previousTime = time;
      const before = position.current;
      let point = before;
      if (!config.current.disabled && !config.current.movementLocked) {
        let dx = 0, dy = 0;
        for (const key of keys.current) { dx += DIRECTIONS[key]?.[0] ?? 0; dy += DIRECTIONS[key]?.[1] ?? 0; }
        const length = Math.hypot(dx, dy);
        if (length) point = geometry().moveInRoom(point, dx / length * distance, dy / length * distance);
        else if (route.current.length) {
          let remaining = distance;
          while (route.current.length && remaining > 0) {
            const next = route.current[0], x = next.x - point.x, y = next.y - point.y, gap = Math.hypot(x, y);
            const step = Math.min(gap, remaining);
            if (gap > 0) point = geometry().moveInRoom(point, x / gap * step, y / gap * step);
            remaining -= step;
            if (Math.hypot(point.x - next.x, point.y - next.y) < 0.1) route.current.shift();
            else break;
          }
          if (!route.current.length) setDestination(null);
        }
      }
      const dx = point.x - before.x, dy = point.y - before.y, walking = Math.hypot(dx, dy) > 0.01;
      if (walking) facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 9 : 6 : dy > 0 ? 0 : 3;
      if (walking !== wasWalking) { wasWalking = walking; config.current.onWalking(walking); }
      position.current = point;
      const column = facing + (walking ? [0, 1, 2, 1][Math.floor(time / 130) % 4] : 1);
      setActor((old) => old.x === point.x && old.y === point.y && old.column === column ? old : { ...point, column });
      const atExit = geometry().nearExit(point);
      if (atExit !== nearExit) { nearExit = atExit; config.current.onNearExit?.(atExit); }
      const current = geometry().nearbyStation(point);
      if (current !== reported) { reported = current; config.current.onNear(current); }
      frame = requestAnimationFrame(tick);
    }
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    window.addEventListener("blur", stop); document.addEventListener("visibilitychange", stop);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", stop);
    };
  }, []);

  function walkTo(event: React.PointerEvent<SVGSVGElement>) {
    if (disabled || movementLocked || event.button !== 0 || !event.isPrimary) return;
    room.current?.focus({ preventScroll: true });
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    const tap = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const exit = house.start;
    const hit = [...tapTargets, { box: [exit.x - 44, 218, exit.x + 44, 250] as RoomBlock, goal: exit }]
      .find(({ box: [left, top, right, bottom] }) => tap.x >= left && tap.x <= right && tap.y >= top && tap.y <= bottom);
    const goal: RoomPoint = hit?.goal ?? { x: tap.x, y: tap.y };
    keys.current.clear(); route.current = house.roomRoute(position.current, goal);
    setDestination(route.current.at(-1) ?? null);
  }
  const marker = target ? house.stations[target] : null;
  const exit = house.start;
  return (
    <div ref={room} tabIndex={0} className="coin-room" role="region" aria-label={regionLabel} aria-describedby="game-controls-help">
      <svg ref={svg} className="coin-house-map" viewBox="0 0 400 250" role="img" onPointerDown={walkTo} aria-label={mapLabel} shapeRendering="crispEdges">
        {children}
        <g aria-hidden="true">
          <rect x={exit.x - 44} y="234" width="88" height="12" fill="#162b32" stroke="#bba783" strokeWidth="2" />
          <path d={`M${exit.x - 7} 225h14m-7-4v8m-4-4 4 4 4-4`} stroke="#90e0cd" fill="none" strokeWidth="2" />
          <text x={exit.x} y="243" textAnchor="middle" fontSize="7" fill="#ffe4a2">{t("Exit to town")}</text>
          {marker && target && <>
            <ellipse cx={marker.x} cy={marker.y} rx="19" ry="8" fill="#f2c98322" stroke="#f2c983" strokeDasharray="3 3" />
            <text x={marker.x} y={marker.y + (labelOffsets?.[target] ?? -29)} textAnchor="middle" fontSize="9" fill="#ffe4a2">{localize(labels[target])}</text>
          </>}
          {destination && <path d={`M${destination.x - 4} ${destination.y}h8 M${destination.x} ${destination.y - 4}v8`} stroke="#90e0cd" strokeWidth="2" />}
        </g>
        <g transform={`translate(${actor.x - 12} ${actor.y - 24})`} data-player-x={actor.x.toFixed(1)} data-player-y={actor.y.toFixed(1)}>
          <ellipse cx="12" cy="23" rx="10" ry="3" fill="#1b272d" opacity=".4" />
          <svg width="24" height="24" viewBox={`${actor.column * 16} 0 16 16`}><image href="/assets/kenney/characters.png" width="192" height="48" /></svg>
        </g>
      </svg>
    </div>
  );
}
