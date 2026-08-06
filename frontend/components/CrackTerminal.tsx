"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export interface CrackTrial {
  shift: number;
  candidate: string;
  match: boolean;
}

interface CrackTerminalProps {
  ciphertext: string;
  trials: CrackTrial[];
  activeIndex: number;
  elapsedMs: number | null;
}

/**
 * Terminal-style view of the Hacker's Caesar brute-force so the audience
 * can see the actual decrypt attempts, not a cryptic k→letter list.
 */
export default function CrackTerminal({
  ciphertext,
  trials,
  activeIndex,
  elapsedMs,
}: CrackTerminalProps) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [trials.length, elapsedMs]);

  const done = elapsedMs != null;
  const match = trials.find((t) => t.match);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-actor-hacker/40 bg-[#0b1210] shadow-inner"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-actor-hacker/30 px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-actor-hacker" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-actor-hacker">
          hacker@tap — caesar-crack
        </span>
        <span className="ml-auto font-mono text-[10px] text-stage-muted">
          {done ? "done" : `try ${Math.max(activeIndex + 1, 1)}/25`}
        </span>
      </div>

      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 pt-2 font-mono text-[11px] leading-relaxed sm:text-xs"
      >
        <p className="text-accent-teal">
          $ crack caesar --cipher{" "}
          <span className="text-accent-amber">{ciphertext}</span>
        </p>
        <p className="text-stage-muted">
          [*] brute-forcing k ∈ {"{1..25}"} · decrypt(c) = (c − k) mod 26
        </p>

        {trials.map((t) => (
          <p
            key={t.shift}
            className={
              t.match
                ? "text-accent-amber"
                : "text-stage-muted/80"
            }
          >
            {t.match ? "[✓]" : "[ ]"} k={String(t.shift).padStart(2, " ")}{" "}
            decrypt({ciphertext}) →{" "}
            <span className={t.match ? "text-accent-amber" : "text-actor-brayan"}>
              {t.candidate}
            </span>
            {t.match ? "  MATCH" : ""}
          </p>
        ))}

        {done && match && (
          <>
            <p className="pt-1 text-actor-hacker">
              [*] cracked in {elapsedMs.toFixed(3)} ms — plaintext is{" "}
              <strong className="text-accent-amber">{match.candidate}</strong>
            </p>
            <p className="text-accent-teal">
              $ echo &quot;{match.candidate}&quot;{" "}
              <span className="text-stage-muted"># Hacker keeps a copy</span>
            </p>
          </>
        )}

        {!done && (
          <p className="animate-pulse text-actor-hacker">_</p>
        )}
        <div className="h-6 shrink-0" aria-hidden />
      </div>
    </motion.div>
  );
}
