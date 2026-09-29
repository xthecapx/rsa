"use client";
import { t } from "@/i18n";

import type { GroverPlace } from "@/content/grover";

import { GROVER_ROOM } from "@/game/groverRoom";
import { HouseRoom } from "@/components/HouseRoom";

const LABELS = { core: "Drone core", desk: "Laptop desk", board: "Whiteboard" };
// The core label sits below its marker so it clears the workbench display.
const LABEL_OFFSETS = { core: 22 };
const TAPS = [
  { box: [28, 0, 134, 108] as const, goal: GROVER_ROOM.stations.desk },
  { box: [275, 0, 367, 95] as const, goal: GROVER_ROOM.stations.board },
  { box: [146, 100, 254, 166] as const, goal: GROVER_ROOM.stations.core },
];
/** Professor Thecap's workshop: the walking loop lives in HouseRoom. */
export function GroverHouse({ initialPlace, target, core, onNear, onInteract, onWalking, disabled, movementLocked, onExit, onNearExit }: {
  initialPlace: GroverPlace | null; target: GroverPlace; core: "armed" | "locked" | "safe";
  disabled: boolean; movementLocked: boolean;
  onWalking: (walking: boolean) => void;
  onExit?: () => void; onNearExit?: (near: boolean) => void;
  onNear: (place: GroverPlace | null) => void; onInteract: (place: GroverPlace) => void;
}) {
  const glow = core === "safe" ? "#5ee0a0" : core === "locked" ? "#f59e0b" : "#ef4444";
  return (
    <HouseRoom room={GROVER_ROOM} labels={LABELS} labelOffsets={LABEL_OFFSETS} tapTargets={TAPS} initialPlace={initialPlace} target={target}
      regionLabel={t("Inside Thecap’s workshop")} mapLabel={t("A workshop with a laptop desk, a whiteboard, and a drone core on the workbench beside Professor Thecap")}
      disabled={disabled} movementLocked={movementLocked} onNear={onNear} onInteract={onInteract} onWalking={onWalking} onExit={onExit} onNearExit={onNearExit}>
        <defs>
          <pattern id="workshop-floor" width="32" height="32" patternUnits="userSpaceOnUse">
            <rect width="32" height="32" fill="#4a4f57" />
            <path d="M0 0H32V32" stroke="#5a616a" fill="none" />
            <rect x="14" y="14" width="3" height="3" fill="#3c4048" />
          </pattern>
        </defs>
        <rect width="400" height="250" fill="#161c24" />
        <rect x="12" y="12" width="376" height="68" fill="#2d3a45" />
        <rect x="12" y="80" width="376" height="158" fill="url(#workshop-floor)" />
        <rect x="12" y="74" width="376" height="8" fill="#8c7a5b" />
        {/* Pegboard with tools. */}
        <rect x="160" y="22" width="80" height="44" fill="#6b5a45" stroke="#4a3d30" strokeWidth="3" />
        <path d="M172 30V52M186 28V46M200 30L208 50M222 28V54" stroke="#b9c2c9" strokeWidth="3" />
        <circle cx="228" cy="32" r="5" fill="none" stroke="#e5b567" strokeWidth="2" />
        {/* Laptop desk. */}
        <rect x="36" y="69" width="91" height="17" fill="#7a6a58" />
        <path d="M42 86V107M120 86V107" stroke="#3a3530" strokeWidth="7" />
        <rect x="61" y="42" width="40" height="27" fill="#10212a" stroke="#98b6b9" strokeWidth="3" />
        <path d="M68 60V52M74 60V48M80 60V55M86 60V46M92 60V54" stroke="#66ddba" strokeWidth="3" />
        <rect x="57" y="68" width="48" height="5" fill="#a9b5bb" />
        {/* Whiteboard. */}
        <rect x="279" y="26" width="84" height="48" fill="#d2ddcc" stroke="#a08460" strokeWidth="5" />
        <text x="321" y="47" textAnchor="middle" fontSize="10" fill="#294953">π/4·√N</text>
        <path d="M292 60Q305 48 318 60T344 58" stroke="#389992" strokeWidth="2" fill="none" />
        {/* Workbench with the drone core. */}
        <rect x="150" y="122" width="100" height="40" fill="#8a6848" stroke="#4f3a2a" strokeWidth="4" />
        <path d="M156 162V176M244 162V176" stroke="#3a2b20" strokeWidth="6" />
        <g className={core === "armed" ? "grover-core-pulse" : ""}>
          <rect x="178" y="104" width="44" height="32" rx="4" fill="#28313b" stroke={glow} strokeWidth="3" />
          <circle cx="200" cy="120" r="7" fill={glow} />
          <path d="M170 110H178M222 110H232M170 128H178M222 128H232" stroke="#9aa6b2" strokeWidth="3" />
        </g>
        <rect x="186" y="142" width="28" height="14" fill="#1e2530" stroke="#9aa6b2" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={189 + i * 6} y="146" width="4" height="6" fill={core === "safe" ? "#5ee0a0" : "#d8ede5"} />)}
        {/* Shelves and a crate of spare parts. */}
        <rect x="33" y="161" width="69" height="43" fill="#3e4a55" stroke="#2d3a45" strokeWidth="5" />
        <path d="M39 178H96M39 192H96" stroke="#5c6b78" strokeWidth="3" />
        <rect x="46" y="168" width="10" height="9" fill="#c77d4a" /><rect x="70" y="183" width="14" height="8" fill="#6fb7c9" />
        <rect x="336" y="188" width="28" height="26" fill="#8a6848" stroke="#4f3a2a" strokeWidth="3" />
        <path d="M336 201H364M350 188V214" stroke="#4f3a2a" strokeWidth="2" />
        {/* Professor Thecap beside the bench. */}
        <image href="/assets/characters/town-doctor.svg" x="262" y="126" width="24" height="24" style={{ imageRendering: "pixelated" }} />
        {core === "safe" && <g className="coin-winner-banner"><rect x="138" y="80" width="124" height="20" rx="4" fill="#173e3b" stroke="#5ee0a0" />
          <text x="200" y="94" textAnchor="middle" fontSize="9" fill="#d9ffe9">{t("Core disarmed!")}</text></g>}
    </HouseRoom>
  );
}
