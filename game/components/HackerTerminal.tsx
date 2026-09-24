"use client";
import { t, localize, useLocale } from "@/i18n";

import { useEffect, useRef } from "react";
import clsx from "clsx";

import { useGame } from "@/game/state";

const TONE: Record<string, string> = {
  info: "text-[#9fc4d0]",
  good: "text-actor-brayan",
  bad: "text-actor-hacker",
  note: "text-accent-amber",
};

/**
 * The laptop in the van: whatever the backend actually returned, verbatim.
 *
 * `flow` gives up the fixed height and inner scrollbar so the log can sit in a
 * page that scrolls as one piece, which is how the phone sheet reads it.
 */
export function HackerTerminal({ flow = false }: { flow?: boolean }) {
  useLocale((state) => state.locale);
  const terminal = useGame((s) => s.terminal);
  const busyLabel = useGame((s) => s.busyLabel);
  const error = useGame((s) => s.error);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Following the tail would drag the whole sheet around under the reader.
    if (flow) return;
    bottom.current?.scrollIntoView({ block: "end" });
  }, [terminal.length, busyLabel, flow]);

  return (
    <div
      className={clsx(
        "panel scanline flex flex-col overflow-hidden",
        !flow && "h-full",
      )}
    >
      <div className="flex items-center justify-between border-b-2 border-stage-border px-3 py-2">
        <span className="text-[10px] uppercase tracking-widest text-accent-teal">{t("tap0 · live")}</span>
        {localize(busyLabel && (
          <span className="animate-pulse text-[10px] text-accent-amber">
            {localize(busyLabel)}...
          </span>
        ))}
      </div>

      <div
        className={clsx(
          "space-y-1 px-3 py-2 font-mono text-[11px] leading-relaxed",
          !flow && "flex-1 overflow-y-auto",
        )}
      >
        {terminal.length === 0 && !busyLabel && (
          <p className="text-stage-muted">{t("Waiting for traffic.")}</p>
        )}
        {terminal.map((line, index) => (
          <p key={index} className={clsx("whitespace-pre-wrap", TONE[line.tone])}>
            {localize(line.text)}
          </p>
        ))}
        {localize(error && <p className="text-actor-hacker">! {localize(error)}</p>)}
        <div ref={bottom} />
      </div>
    </div>
  );
}
