"use client";

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import type { Speaker } from "@/content/types";
import { Portrait, SPEAKER_COLOR, SPEAKER_NAME } from "./Portrait";
import { t, useLocale } from "@/i18n";

export function DialogueFrame({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx("game-dialogue textbox flex max-h-[min(70dvh,36rem)] w-full flex-col gap-3 overflow-hidden p-3 sm:max-h-[min(75dvh,40rem)] sm:gap-4 sm:p-4", className)} />;
}

export function DialogueLine({ speaker, label, children }: { speaker: Speaker; label?: string; children: ReactNode }) {
  useLocale((s) => s.locale);
  return <div className="flex min-h-0 shrink-0 gap-3 sm:gap-4">
    <div className="hidden sm:block"><Portrait speaker={speaker} size={72} /></div>
    <div className="sm:hidden"><Portrait speaker={speaker} size={40} /></div>
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
    let length = 0;
    timer.current = setInterval(() => {
      length = Math.min(text.length, length + 3);
      setTyped(text.slice(0, length));
      if (length >= text.length && timer.current) clearInterval(timer.current);
    }, 12);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [text]);
  return { typed, settled: typed === text, reveal: () => { if (timer.current) clearInterval(timer.current); setTyped(text); } };
}
