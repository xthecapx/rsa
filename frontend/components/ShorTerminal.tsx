"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export type ShorLogTone =
  | "cmd"
  | "meta"
  | "ok"
  | "warn"
  | "err"
  | "dim";

export interface ShorLogLine {
  text: string;
  tone?: ShorLogTone;
}

interface ShorTerminalProps {
  lines: ShorLogLine[];
  phase: string;
  running?: boolean;
}

const TONE: Record<ShorLogTone, string> = {
  cmd: "text-accent-teal",
  meta: "text-stage-muted",
  ok: "text-accent-amber",
  warn: "text-actor-hacker",
  err: "text-actor-hacker",
  dim: "text-stage-muted/70",
};

/** Talk terminal for Shor Aer / IBM runs — mirrors Caesar / RSA log style. */
export default function ShorTerminal({
  lines,
  phase,
  running = false,
}: ShorTerminalProps) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length, phase]);

  if (!lines.length && !running) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-accent-teal/40 bg-[#0b1210] shadow-inner"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-accent-teal/30 px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-accent-teal" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-accent-teal">
          shor@qward — aer / ibm
        </span>
        <span className="ml-auto font-mono text-[10px] text-stage-muted">
          {phase}
        </span>
      </div>

      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 pt-2 font-mono text-[11px] leading-relaxed sm:text-xs"
      >
        {lines.map((line, i) => (
          <p key={`${i}-${line.text.slice(0, 24)}`} className={TONE[line.tone ?? "meta"]}>
            {line.text}
          </p>
        ))}
        {running && (
          <p className="animate-pulse text-accent-teal">_</p>
        )}
        <div className="h-6 shrink-0" aria-hidden />
      </div>
    </motion.div>
  );
}
