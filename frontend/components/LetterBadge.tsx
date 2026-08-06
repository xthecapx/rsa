"use client";

import clsx from "clsx";
import { motion } from "framer-motion";

export type LetterTone = "ale" | "hacker" | "brayan" | "amber";

const TONES: Record<LetterTone, string> = {
  ale: "border-actor-ale bg-actor-ale/15 text-actor-ale",
  hacker: "border-actor-hacker bg-actor-hacker/20 text-actor-hacker",
  brayan: "border-actor-brayan bg-actor-brayan/15 text-actor-brayan",
  amber: "border-accent-amber bg-accent-amber/15 text-accent-amber",
};

interface LetterBadgeProps {
  letter: string;
  tone?: LetterTone;
  label?: string;
  size?: "sm" | "md";
}

/** Shared letter chip for Ale / Hacker / Brayan across all acts. */
export default function LetterBadge({
  letter,
  tone = "amber",
  label,
  size = "md",
}: LetterBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex flex-col items-center gap-0.5"
    >
      <div
        className={clsx(
          "flex items-center justify-center rounded-md border-2 font-mono font-bold shadow-glow",
          size === "sm" ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm sm:h-9 sm:w-9 sm:text-base",
          TONES[tone],
        )}
      >
        {letter}
      </div>
      {label && (
        <span className="text-[9px] font-semibold uppercase tracking-wider text-stage-muted">
          {label}
        </span>
      )}
    </motion.div>
  );
}
