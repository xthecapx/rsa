import clsx from "clsx";

import type { Speaker } from "@/content/types";

/**
 * A bust from Kenney's Roguelike Characters sheet, which is 16px tiles with
 * 1px between them. Positioned with CSS so no canvas is needed in the HUD.
 */
const SHEET = { tile: 16, margin: 1, columns: 54, rows: 12 };
const STRIDE = SHEET.tile + SHEET.margin;

const CAST: Record<Exclude<Speaker, "system">, { col: number; row: number }> = {
  ale: { col: 0, row: 5 },
  brayan: { col: 1, row: 6 },
  hacker: { col: 0, row: 10 },
};

const BORDER: Record<Speaker, string> = {
  ale: "border-actor-ale",
  brayan: "border-actor-brayan",
  hacker: "border-actor-hacker",
  system: "border-stage-border",
};

export const SPEAKER_NAME: Record<Speaker, string> = {
  ale: "Ale",
  brayan: "Brayan",
  hacker: "You",
  system: "",
};

export const SPEAKER_COLOR: Record<Speaker, string> = {
  ale: "text-actor-ale",
  brayan: "text-actor-brayan",
  hacker: "text-actor-hacker",
  system: "text-accent-teal",
};

export function Portrait({ speaker, size = 64 }: { speaker: Speaker; size?: number }) {
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

  const { col, row } = CAST[speaker];
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
      aria-label={SPEAKER_NAME[speaker]}
    />
  );
}
