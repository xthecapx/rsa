"use client";

import { gameAudio } from "@/game/audio";
import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import type { Speaker } from "@/content/types";
import { Portrait, SPEAKER_COLOR, SPEAKER_NAME } from "./Portrait";
import { t, useLocale } from "@/i18n";

export function DialogueFrame({ className, children, actions, pageKey, ...props }: HTMLAttributes<HTMLDivElement> & { actions?: ReactNode; pageKey?: string }) {
  return <div {...props} className={clsx("game-dialogue textbox", className)}>
    <div key={pageKey} className="dialogue-body" tabIndex={0}>{children}</div>
    {actions && <div className="dialogue-actions" onClick={(event) => event.stopPropagation()}>{actions}</div>}
  </div>;
}

export function DialogueContinue({ settled, onContinue }: { settled: boolean; onContinue: () => void }) {
  useLocale((s) => s.locale);
  return <button type="button" className="btn-primary dialogue-continue" onClick={onContinue}>
    {t(settled ? "Continue" : "Show text")} <span aria-hidden="true">▸</span>
  </button>;
}

export function DialogueLine({ speaker, label, children }: { speaker: Speaker; label?: string; children: ReactNode }) {
  useLocale((s) => s.locale);
  return <div className="dialogue-line flex min-h-0 gap-3 sm:gap-4">
    <div className="dialogue-portrait-desktop hidden shrink-0 sm:block"><Portrait speaker={speaker} size={72} /></div>
    <div className="dialogue-portrait-mobile shrink-0 sm:hidden"><Portrait speaker={speaker} size={40} /></div>
    <div className="min-w-0 flex-1">
      <div className={clsx("mb-1.5 text-xs uppercase tracking-widest sm:mb-2", SPEAKER_COLOR[speaker])}>{label ?? t(SPEAKER_NAME[speaker])}</div>
      <p className="text-sm leading-relaxed text-[#e8f4f8] sm:text-base">{children}</p>
    </div>
  </div>;
}

export function useDialogueText(text: string) {
  const [typed, setTyped] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    setTyped("");
    let length = 0, ticks = 0;
    timer.current = setInterval(() => {
      length = Math.min(text.length, length + 3);
      if (ticks++ % 4 === 0 && length < text.length) gameAudio.playSynth("tick");
      setTyped(text.slice(0, length));
      if (length >= text.length && timer.current) clearInterval(timer.current);
    }, 12);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [text]);
  const reveal = useCallback(() => { if (timer.current) clearInterval(timer.current); setTyped(text); }, [text]);
  return { typed, settled: typed === text, reveal };
}
