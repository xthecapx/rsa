"use client";
import { t, localize, useLocale } from "@/i18n";

import type { RoomPlace } from "@/content/coin";

import { useEffect, useRef, useState } from "react";
import { ROOM_START, ROOM_STATIONS, moveInRoom, nearbyStation, roomRoute, type RoomPoint } from "@/game/coinRoom";

const LABELS = { table: "Game table", desk: "Laptop desk", board: "Whiteboard" };
const DIRECTIONS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
};
/** Same walking vocabulary as the street: arrows/WASD, tap to walk, Space to talk. */
export function CoinHouse({ initialPlace, target, onNear, onInteract, onWalking, disabled, movementLocked }: {
  initialPlace: RoomPlace | null; target: RoomPlace; disabled: boolean; movementLocked: boolean;
  onWalking: (walking: boolean) => void;
  onNear: (place: RoomPlace | null) => void; onInteract: (place: RoomPlace) => void;
}) {
  useLocale((state) => state.locale);
  const room = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const position = useRef<RoomPoint>({ ...(initialPlace ? ROOM_STATIONS[initialPlace] : ROOM_START) });
  const keys = useRef(new Set<string>());
  const route = useRef<RoomPoint[]>([]);
  const config = useRef({ disabled, movementLocked, onNear, onInteract, onWalking });
  config.current = { disabled, movementLocked, onNear, onInteract, onWalking };
  const [actor, setActor] = useState({ ...position.current, column: 1 });
  const [destination, setDestination] = useState<RoomPoint | null>(null);

  useEffect(() => {
    if (!disabled && !movementLocked) return;
    keys.current.clear(); route.current = []; setDestination(null);
  }, [disabled, movementLocked]);

  useEffect(() => {
    let frame = 0, previousTime = 0, facing = 0, wasWalking = false;
    let reported = nearbyStation(position.current);
    config.current.onNear(reported);
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
          position.current = moveInRoom(position.current, dx * 4, dy * 4);
          facing = dx ? dx > 0 ? 9 : 6 : dy > 0 ? 0 : 3;
        }
        keys.current.add(key); route.current = []; setDestination(null);
      } else if (event.code === "Space" && !event.repeat && !element.closest?.("button, a")) {
        event.preventDefault();
        const place = nearbyStation(position.current);
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
        if (length) point = moveInRoom(point, dx / length * distance, dy / length * distance);
        else if (route.current.length) {
          let remaining = distance;
          while (route.current.length && remaining > 0) {
            const next = route.current[0], x = next.x - point.x, y = next.y - point.y, gap = Math.hypot(x, y);
            const step = Math.min(gap, remaining);
            if (gap > 0) point = moveInRoom(point, x / gap * step, y / gap * step);
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
      const current = nearbyStation(point);
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
    if (disabled || movementLocked || event.button !== 0) return;
    room.current?.focus({ preventScroll: true });
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    const tap = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    let goal: RoomPoint = { x: tap.x, y: tap.y };
    // Tapping an object walks to its interaction point, never through its furniture.
    if (tap.x >= 28 && tap.x <= 134 && tap.y < 108) goal = ROOM_STATIONS.desk;
    else if (tap.x >= 275 && tap.x <= 367 && tap.y < 95) goal = ROOM_STATIONS.board;
    else if (tap.x >= 150 && tap.x <= 253 && tap.y >= 126 && tap.y <= 177) goal = ROOM_STATIONS.table;
    keys.current.clear(); route.current = roomRoute(position.current, goal);
    setDestination(route.current.at(-1) ?? null);
  }
  return (
    <div ref={room} tabIndex={0} className="coin-room" role="region" aria-label={t("Inside Ale’s house")} aria-describedby="game-controls-help">
      <svg ref={svg} className="coin-house-map" viewBox="0 0 400 250" role="img" onPointerDown={walkTo} aria-label={t("A cozy living room with a laptop desk, a whiteboard, and Ale and Brayan beside a board game")} shapeRendering="crispEdges">
        <defs>
          <pattern id="floor" width="40" height="24" patternUnits="userSpaceOnUse">
            <rect width="40" height="24" fill="#705042" />
            <path d="M0 0H40V24H0Z M4 20H30" stroke="#805e4b" fill="none" />
          </pattern>
        </defs>
        <rect width="400" height="250" fill="#152f38" />
        <rect x="12" y="12" width="376" height="68" fill="#294953" />
        <rect x="12" y="80" width="376" height="158" fill="url(#floor)" />
        <rect x="12" y="74" width="376" height="8" fill="#ba9972" />
        <rect x="168" y="22" width="64" height="45" fill="#122833" stroke="#bba783" strokeWidth="5" />
        <path d="M200 23V67M168 44H232" stroke="#bba783" strokeWidth="3" />
        <rect x="177" y="29" width="4" height="4" fill="#fae3ac" />
        <rect x="218" y="34" width="3" height="3" fill="#fae3ac" />
        <rect x="36" y="69" width="91" height="17" fill="#ba865a" />
        <path d="M42 86V107M120 86V107" stroke="#49352e" strokeWidth="7" />
        <rect x="61" y="42" width="40" height="27" fill="#10212a" stroke="#98b6b9" strokeWidth="3" />
        <path d="M70 53L76 57L70 61M82 61H91" stroke="#66ddba" strokeWidth="2" fill="none" />
        <rect x="57" y="68" width="48" height="5" fill="#a9b5bb" />
        <rect x="279" y="26" width="84" height="48" fill="#d2ddcc" stroke="#a08460" strokeWidth="5" />
        <path d="M289 50H352" stroke="#294953" strokeWidth="2" />
        <rect x="310" y="39" width="19" height="22" fill="#389992" />
        <text x="315" y="54" fontSize="12" fill="white">{t("H")}</text>
        <rect x="134" y="126" width="140" height="89" fill="#354b68" stroke="#d1a56e" strokeWidth="3" />
        <rect x="159" y="134" width="85" height="35" fill="#b58151" stroke="#563b30" strokeWidth="4" />
        <rect x="182" y="141" width="38" height="21" fill="#d4c89f" />
        <path d="M190 141V162M200 141V162M210 141V162M182 151H220" stroke="#8b9a74" />
        <rect x="192" y="144" width="5" height="5" fill="#38bdf8" />
        <rect x="212" y="154" width="5" height="5" fill="#a3e635" />
        <rect x="33" y="161" width="69" height="43" fill="#47666d" stroke="#294953" strokeWidth="5" />
        <path d="M39 178H96M67 164V199" stroke="#67858b" strokeWidth="3" />
        <rect x="337" y="187" width="20" height="26" fill="#bb7955" />
        <path d="M346 190V153M346 178L330 166M346 170L360 156" stroke="#7cb887" strokeWidth="8" />
        <svg x="132" y="130" width="24" height="24" viewBox="16 16 16 16"><image href="/assets/kenney/characters.png" width="192" height="48" /></svg>
        <svg x="248" y="130" width="24" height="24" viewBox="16 32 16 16"><image href="/assets/kenney/characters.png" width="192" height="48" /></svg>
        <g aria-hidden="true">
          <ellipse cx={ROOM_STATIONS[target].x} cy={ROOM_STATIONS[target].y} rx="19" ry="8" fill="#f2c98322" stroke="#f2c983" strokeDasharray="3 3" />
          <text x={ROOM_STATIONS[target].x} y={ROOM_STATIONS[target].y - 29} textAnchor="middle" fontSize="9" fill="#ffe4a2">{localize(LABELS[target])}</text>
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
