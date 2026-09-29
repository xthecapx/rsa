"use client";
import { t } from "@/i18n";

import type { RoomPlace } from "@/content/coin";

import { COIN_ROOM } from "@/game/coinRoom";
import { HouseRoom } from "@/components/HouseRoom";

const LABELS = { table: "Game table", desk: "Laptop desk", board: "Whiteboard" };
const TAPS = [
  { box: [28, 0, 134, 108] as const, goal: COIN_ROOM.stations.desk },
  { box: [275, 0, 367, 95] as const, goal: COIN_ROOM.stations.board },
  { box: [150, 126, 253, 177] as const, goal: COIN_ROOM.stations.table },
];
/** Ale's living room: the walking loop lives in HouseRoom. */
export function CoinHouse({ initialPlace, target, winner, onNear, onInteract, onWalking, disabled, movementLocked, onExit, onNearExit }: {
  initialPlace: RoomPlace | null; target: RoomPlace; winner: number | null; disabled: boolean; movementLocked: boolean;
  onWalking: (walking: boolean) => void;
  onExit?: () => void; onNearExit?: (near: boolean) => void;
  onNear: (place: RoomPlace | null) => void; onInteract: (place: RoomPlace) => void;
}) {
  return (
    <HouseRoom room={COIN_ROOM} labels={LABELS} tapTargets={TAPS} initialPlace={initialPlace} target={target}
      regionLabel={t("Inside Ale’s house")} mapLabel={t("A cozy living room with a laptop desk, a whiteboard, and Ale and Brayan beside a board game")}
      disabled={disabled} movementLocked={movementLocked} onNear={onNear} onInteract={onInteract} onWalking={onWalking} onExit={onExit} onNearExit={onNearExit}>
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
        <svg className={winner === 0 ? "coin-winner" : ""} x="132" y="130" width="24" height="24" viewBox="16 16 16 16"><image href="/assets/kenney/characters.png" width="192" height="48" /></svg>
        <svg className={winner === 1 ? "coin-winner" : ""} x="248" y="130" width="24" height="24" viewBox="16 32 16 16"><image href="/assets/kenney/characters.png" width="192" height="48" /></svg>
        {winner !== null && <g className="coin-winner-banner"><rect x="138" y="98" width="124" height="23" rx="4" fill="#173e3b" stroke="#efbe67" />
          <text x="200" y="113" textAnchor="middle" fontSize="9" fill="#ffe9a5">{t(winner === 0 ? "Ale goes first!" : "Brayan goes first!")}</text></g>}
    </HouseRoom>
  );
}
