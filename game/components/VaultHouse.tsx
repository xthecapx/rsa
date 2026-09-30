"use client";
import { t } from "@/i18n";

import type { VaultPlace } from "@/content/vault";

import { VAULT_ROOM } from "@/game/vaultRoom";
import { HouseRoom } from "@/components/HouseRoom";

const LABELS = { vault: "The vault", desk: "The Colonel’s desk", table: "Séance table" };
// Labels sit below their markers so they clear the vault lamps and the candles.
const LABEL_OFFSETS = { table: 22, vault: 22 };
const TAPS = [
  { box: [28, 0, 134, 108] as const, goal: VAULT_ROOM.stations.desk },
  { box: [270, 0, 366, 100] as const, goal: VAULT_ROOM.stations.vault },
  { box: [146, 100, 254, 166] as const, goal: VAULT_ROOM.stations.table },
];
export type VaultMood = "haunted" | "cold" | "open";

/** Casa Ofelia's study: the walking loop lives in HouseRoom. */
export function VaultHouse({ initialPlace, target, mood, candles, onNear, onInteract, onWalking, disabled, movementLocked, onExit, onNearExit }: {
  initialPlace: VaultPlace | null; target: VaultPlace; mood: VaultMood;
  /** Candles still burning on the séance table tonight. */
  candles: number;
  disabled: boolean; movementLocked: boolean;
  onWalking: (walking: boolean) => void;
  onExit?: () => void; onNearExit?: (near: boolean) => void;
  onNear: (place: VaultPlace | null) => void; onInteract: (place: VaultPlace) => void;
}) {
  const open = mood === "open";
  const lamp = open ? "#5ee0a0" : mood === "cold" ? "#7fb4d8" : "#efbe67";
  return (
    <HouseRoom room={VAULT_ROOM} labels={LABELS} labelOffsets={LABEL_OFFSETS} tapTargets={TAPS} initialPlace={initialPlace} target={target}
      regionLabel={t("Inside Casa Ofelia")} mapLabel={t("An old study with the Colonel’s desk and laptop, a séance table with candles, and a steel vault door beside Doña Ofelia")}
      disabled={disabled} movementLocked={movementLocked} onNear={onNear} onInteract={onInteract} onWalking={onWalking} onExit={onExit} onNearExit={onNearExit}>
        <defs>
          <pattern id="vault-floor" width="40" height="12" patternUnits="userSpaceOnUse">
            <rect width="40" height="12" fill="#4a3526" />
            <path d="M0 11.5H40M26 0V12" stroke="#3a281c" />
            <path d="M4 5H14" stroke="#553d2c" />
          </pattern>
          <radialGradient id="vault-candlelight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffcf7a" stopOpacity=".35" />
            <stop offset="100%" stopColor="#ffcf7a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="250" fill="#120f17" />
        <rect x="12" y="12" width="376" height="68" fill="#2c2136" />
        <path d="M12 30H388M12 50H388" stroke="#34283f" strokeWidth="2" />
        <rect x="12" y="80" width="376" height="158" fill="url(#vault-floor)" />
        <rect x="12" y="74" width="376" height="8" fill="#5b4332" />
        {/* The Colonel's portrait over the mantel. */}
        <rect x="172" y="18" width="48" height="40" fill="#1b1622" stroke="#b08a4a" strokeWidth="4" />
        <path d="M188 52V40Q196 30 204 40V52Z" fill="#3a3346" />
        <circle cx="196" cy="34" r="6" fill="#3a3346" />
        <path d="M190 45H202" stroke="#b08a4a" strokeWidth="2" />
        <rect x="156" y="62" width="80" height="12" fill="#4e3a2c" stroke="#2f2219" strokeWidth="2" />
        {/* Steel vault door with 25 tumbler lamps. */}
        <rect x="274" y="14" width="86" height="66" fill="#23262d" stroke="#4d535c" strokeWidth="3" />
        {open ? <>
          <rect x="280" y="20" width="56" height="54" fill="#f6d69a" opacity=".85" />
          <rect x="300" y="46" width="16" height="10" fill="#e8e0cc" /><circle cx="324" cy="62" r="3" fill="#e5b567" stroke="#8a6a2a" />
          <path d="M336 20L356 26V70L336 74Z" fill="#646b75" stroke="#9aa6b2" strokeWidth="2" />
        </> : <>
          <circle cx="317" cy="44" r="24" fill="#3a3f48" stroke="#9aa6b2" strokeWidth="3" />
          <circle cx="317" cy="44" r="8" fill="none" stroke="#c9a45c" strokeWidth="3" />
          <path d="M317 30V58M303 44H331M307 34L327 54M327 34L307 54" stroke="#c9a45c" strokeWidth="2" />
        </>}
        {Array.from({ length: 25 }, (_, i) => <rect key={i} x={277 + i * 3.2} y="75" width="2" height="3" fill={open ? "#5ee0a0" : lamp} opacity={open ? 1 : 0.8} />)}
        {/* Colonel's desk with the drawer and Thecap's laptop. */}
        <rect x="36" y="69" width="91" height="17" fill="#6a4a34" />
        <rect x="46" y="74" width="26" height="8" fill="#56392a" stroke="#c9a45c" strokeWidth="1" />
        <path d="M42 86V107M120 86V107" stroke="#2f2219" strokeWidth="7" />
        <rect x="76" y="44" width="40" height="25" fill="#10212a" stroke="#98b6b9" strokeWidth="3" />
        <path d="M83 62V54M89 62V50M95 62V57M101 62V48M107 62V56" stroke="#66ddba" strokeWidth="3" />
        <rect x="72" y="67" width="48" height="4" fill="#a9b5bb" />
        {/* Séance table with tonight's candles and Ofelia's notebook. */}
        <ellipse cx="200" cy="140" rx="54" ry="24" fill="#5a2f3f" stroke="#2f1822" strokeWidth="4" />
        <ellipse cx="200" cy="136" rx="46" ry="16" fill="#743b50" />
        <rect x="206" y="138" width="22" height="14" fill="#e8e0cc" stroke="#8a7a5a" transform="rotate(-8 217 145)" />
        {[176, 200, 224].map((x, i) => {
          const lit = i < candles && !open;
          return <g key={x}>
            <rect x={x - 2} y="118" width="4" height="12" fill="#efe6c8" />
            {lit ? <>
              <circle cx={x} cy="113" r="12" fill="url(#vault-candlelight)" />
              <path d={`M${x} 110Q${x + 3} 114 ${x} 117Q${x - 3} 114 ${x} 110Z`} fill="#f4b942" className="vault-flame" />
            </> : <path d={`M${x} 116Q${x + 2} 110 ${x - 1} 104`} stroke="#8a8a96" strokeWidth="1" fill="none" opacity=".6" />}
          </g>;
        })}
        {/* Armchair and grandfather clock. */}
        <rect x="32" y="166" width="62" height="40" rx="6" fill="#4b2e3d" stroke="#2f1822" strokeWidth="4" />
        <rect x="40" y="176" width="46" height="18" rx="3" fill="#6a3f55" />
        <rect x="340" y="140" width="28" height="80" fill="#4e3a2c" stroke="#2f2219" strokeWidth="3" />
        <circle cx="354" cy="156" r="9" fill="#e8e0cc" stroke="#b08a4a" strokeWidth="2" />
        <path d="M354 156V150M354 156L358 158" stroke="#2f2219" strokeWidth="1.5" />
        <path d="M354 170V200" stroke="#c9a45c" strokeWidth="2" /><circle cx="354" cy="202" r="4" fill="#c9a45c" />
        {/* Doña Ofelia beside the vault. */}
        <image href="/assets/characters/ofelia.svg" x="234" y="102" width="24" height="24" style={{ imageRendering: "pixelated" }} />
        {mood === "cold" && <g pointerEvents="none">
          <rect width="400" height="250" fill="#9ec9ff" opacity=".12" />
          <path d="M12 12L40 12L12 40ZM388 12L360 12L388 40Z" fill="#dff0ff" opacity=".35" />
        </g>}
        {mood === "haunted" && <rect width="400" height="250" fill="#000" className="vault-flicker" pointerEvents="none" />}
        {open && <g className="coin-winner-banner"><rect x="138" y="84" width="124" height="20" rx="4" fill="#173e3b" stroke="#5ee0a0" />
          <text x="200" y="98" textAnchor="middle" fontSize="9" fill="#d9ffe9">{t("The vault is open!")}</text></g>}
    </HouseRoom>
  );
}
