"use client";

import { gameAudio } from "@/game/audio";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import clsx from "clsx";
import type { Speaker } from "@/content/types";
import { Portrait, SPEAKER_COLOR, SPEAKER_NAME } from "./Portrait";
import { t, useLocale } from "@/i18n";

export function DialogueFrame({
  className,
  children,
  actions,
  pageKey,
  ...props
}: HTMLAttributes<HTMLDivElement> & { actions?: ReactNode; pageKey?: string }) {
  return (
    <div {...props} className={clsx("game-dialogue textbox", className)}>
      <div key={pageKey} className="dialogue-body" tabIndex={0}>
        {children}
      </div>
      {actions && (
        <div
          className="dialogue-actions"
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

export function DialogueContinue({
  settled,
  onContinue,
}: {
  settled: boolean;
  onContinue: () => void;
}) {
  useLocale((s) => s.locale);
  return (
    <button
      type="button"
      className="btn-primary dialogue-continue"
      onClick={onContinue}
    >
      {t(settled ? "Continue" : "Show full text")}{" "}
      <span aria-hidden="true">▸</span>
    </button>
  );
}

export function DialogueLine({
  speaker,
  label,
  children,
  fullText,
}: {
  speaker: Speaker;
  label?: string;
  children: ReactNode;
  fullText?: string;
}) {
  useLocale((s) => s.locale);
  return (
    <div className="dialogue-line flex min-h-0 gap-3 sm:gap-4">
      <div className="dialogue-portrait-desktop hidden shrink-0 sm:block">
        <Portrait speaker={speaker} size={72} />
      </div>
      <div className="dialogue-portrait-mobile shrink-0 sm:hidden">
        <Portrait speaker={speaker} size={40} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={clsx(
            "mb-1.5 text-xs uppercase tracking-widest sm:mb-2",
            SPEAKER_COLOR[speaker],
          )}
        >
          {label ?? t(SPEAKER_NAME[speaker])}
        </div>
        <p className="text-sm leading-relaxed text-[#e8f4f8] sm:text-base">
          {fullText === undefined ? (
            children
          ) : (
            <>
              <span className="sr-only">{fullText}</span>
              <span aria-hidden="true">{children}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** Keep the accessible line complete; this hook controls only its visual reveal. */
export function useDialogueText(text: string) {
  const [frame, setFrame] = useState({ text: "", typed: "" });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const reveal = () => {
      stop();
      setFrame({ text, typed: text });
    };
    const onMotionChange = () => {
      if (motion?.matches) reveal();
    };
    stop();
    if (!text || motion?.matches) reveal();
    else {
      setFrame({ text, typed: "" });
      let length = 0,
        ticks = 0;
      timer.current = setInterval(() => {
        length = Math.min(text.length, length + 3);
        if (ticks++ % 4 === 0 && length < text.length)
          gameAudio.playSynth("tick");
        setFrame({ text, typed: text.slice(0, length) });
        if (length >= text.length) stop();
      }, 12);
    }
    motion?.addEventListener?.("change", onMotionChange);
    return () => {
      stop();
      motion?.removeEventListener?.("change", onMotionChange);
    };
  }, [text, stop]);
  const reveal = useCallback(() => {
    stop();
    setFrame({ text, typed: text });
  }, [text, stop]);
  // A new line or language must never expose the previous line's animation frame.
  const typed = frame.text === text ? frame.typed : "";
  return { typed, settled: typed === text, reveal };
}
