"use client";
import { t, useLocale } from "@/i18n";
import clsx from "clsx";

import type { Speaker } from "@/content/types";

/**
 * A bust from Kenney's Roguelike Characters sheet, which is 16px tiles with
 * 1px between them. Positioned with CSS so no canvas is needed in the HUD.
 */
const SHEET = { tile: 16, margin: 1, columns: 54, rows: 12 };
const STRIDE = SHEET.tile + SHEET.margin;

/** Speakers drawn as their own SVG sprite rather than a Kenney bust. */
const SVG_SPRITES: Partial<Record<Speaker, string>> = {
  guide: "town-doctor", ofelia: "ofelia", mayor: "mayor", luz: "luz", nico: "nico", tomas: "tomas", marisol: "marisol", oscar: "oscar", warden: "warden",
  vpcap: "vpcap", rosa: "rosa", paco: "paco", ines: "ines", joaquin: "joaquin", vera: "vera",
  keepercap: "keepercap", fausto: "fausto", candela: "candela", rocio: "rocio", ramiro: "ramiro", aurelio: "aurelio",
};
const CAST: Record<"ale" | "brayan" | "hacker" | "boss", { col: number; row: number }> = {
  ale: { col: 0, row: 5 },
  brayan: { col: 1, row: 6 },
  hacker: { col: 0, row: 10 },
  boss: { col: 1, row: 9 },
};

const BORDER: Record<Speaker, string> = {
  ale: "border-actor-ale",
  brayan: "border-actor-brayan",
  hacker: "border-actor-hacker",
  boss: "border-actor-boss",
  guide: "border-accent-teal",
  ofelia: "border-accent-amber",
  system: "border-stage-border",
  mayor: "border-accent-amber", luz: "border-accent-amber", nico: "border-accent-teal", tomas: "border-accent-teal",
  marisol: "border-accent-teal", oscar: "border-accent-amber", warden: "border-stage-border",
  vpcap: "border-accent-amber", rosa: "border-accent-teal", paco: "border-accent-amber", ines: "border-accent-teal", joaquin: "border-accent-amber", vera: "border-accent-teal",
  keepercap: "border-accent-amber", fausto: "border-accent-teal", candela: "border-accent-amber", rocio: "border-accent-teal", ramiro: "border-stage-border", aurelio: "border-accent-amber",
};

export const SPEAKER_NAME: Record<Speaker, string> = {
  ale: "Ale",
  brayan: "Brayan",
  hacker: "You",
  boss: "The client",
  guide: "Professor Thecap",
  ofelia: "Doña Ofelia",
  system: "Notes",
  mayor: "Mayor Cap", luz: "Luz", nico: "Nico", tomas: "Tomás", marisol: "Marisol", oscar: "Don Óscar", warden: "Beto",
  vpcap: "VP Cap", rosa: "Rosa", paco: "Paco", ines: "Inés", joaquin: "Joaquín", vera: "Vera",
  keepercap: "Keeper Cap", fausto: "Fausto", candela: "Candela", rocio: "Rocío", ramiro: "Ramiro", aurelio: "Aurelio",
};

export const SPEAKER_COLOR: Record<Speaker, string> = {
  ale: "text-actor-ale",
  brayan: "text-actor-brayan",
  hacker: "text-actor-hacker",
  boss: "text-actor-boss",
  guide: "text-accent-teal",
  ofelia: "text-accent-amber",
  system: "text-accent-teal",
  mayor: "text-accent-amber", luz: "text-accent-amber", nico: "text-accent-teal", tomas: "text-accent-teal",
  marisol: "text-accent-teal", oscar: "text-accent-amber", warden: "text-stage-muted",
  vpcap: "text-accent-amber", rosa: "text-accent-teal", paco: "text-accent-amber", ines: "text-accent-teal", joaquin: "text-accent-amber", vera: "text-accent-teal",
  keepercap: "text-accent-amber", fausto: "text-accent-teal", candela: "text-accent-amber", rocio: "text-accent-teal", ramiro: "text-stage-muted", aurelio: "text-accent-amber",
};

export function Portrait({ speaker, size = 64 }: { speaker: Speaker; size?: number }) {
  useLocale((state) => state.locale);
  const scale = size / SHEET.tile;

  if (speaker === "system") {
    return (
      <div
        className={clsx(
          "flex shrink-0 items-center justify-center border-4 bg-stage-bg text-accent-teal",
          BORDER.system,
        )}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        aria-hidden
      >
        {">_"}
      </div>
    );
  }

  const sprite = SVG_SPRITES[speaker];
  if (sprite) return <div className={clsx("shrink-0 border-4 bg-stage-bg", BORDER[speaker])} style={{ width: size, height: size,
    backgroundImage: `url(/assets/characters/${sprite}.svg)`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", imageRendering: "pixelated" }}
    role="img" aria-label={t(SPEAKER_NAME[speaker])} />;

  const { col, row } = CAST[speaker as keyof typeof CAST];
  return (
    <div
      className={clsx("shrink-0 border-4 bg-stage-bg", BORDER[speaker])}
      style={{
        width: size,
        height: size,
        backgroundImage: "url(/assets/kenney/portraits.png)",
        backgroundRepeat: "no-repeat",
        backgroundSize: `${SHEET.columns * STRIDE * scale}px ${SHEET.rows * STRIDE * scale}px`,
        backgroundPosition: `-${col * STRIDE * scale}px -${row * STRIDE * scale}px`,
        imageRendering: "pixelated",
      }}
      role="img"
      aria-label={t(SPEAKER_NAME[speaker])}
    />
  );
}
