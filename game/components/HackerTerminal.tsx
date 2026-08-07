"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";

import { useGame } from "@/game/state";

const TONE: Record<string, string> = {
  info: "text-[#9fc4d0]",
  good: "text-actor-brayan",
  bad: "text-actor-hacker",
  note: "text-accent-amber",
};

/** The laptop in the van: whatever the backend actually returned, verbatim. */
export function HackerTerminal() {
  const terminal = useGame((s) => s.terminal);
  const busyLabel = useGame((s) => s.busyLabel);
  const error = useGame((s) => s.error);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [terminal.length, busyLabel]);

  return (
    <div className="panel scanline flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-stage-border px-3 py-2">
        <span className="text-[10px] uppercase tracking-widest text-accent-teal">
          tap0 &middot; live
        </span>
        {busyLabel && (
          <span className="animate-pulse text-[10px] text-accent-amber">
            {busyLabel}...
          </span>
        )}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
        {terminal.length === 0 && !busyLabel && (
          <p className="text-stage-muted">Waiting for traffic.</p>
        )}
        {terminal.map((line, index) => (
          <p key={index} className={clsx("whitespace-pre-wrap", TONE[line.tone])}>
            {line.text}
          </p>
        ))}
        {error && <p className="text-actor-hacker">! {error}</p>}
        <div ref={bottom} />
      </div>
    </div>
  );
}
