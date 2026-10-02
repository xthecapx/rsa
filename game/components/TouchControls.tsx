"use client";
import { t, useLocale } from "@/i18n";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { MovementStick } from "./MovementStick";

import { clearTouchInput, queueTouchInteract } from "@/engine/touchInput";

/**
 * Hold a direction to walk using the same tile movement as the keyboard.
 * Map taps and the Talk button remain available.
 */
export function TouchControls({
  canInteract,
  visible,
}: {
  canInteract: boolean;
  visible: boolean;
}) {
  useLocale((state) => state.locale);
  useEffect(() => {
    clearTouchInput();
    const onVisibility = () => { if (document.hidden) clearTouchInput(); };
    window.addEventListener("blur", clearTouchInput);
    window.addEventListener("orientationchange", clearTouchInput);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTouchInput();
      window.removeEventListener("blur", clearTouchInput);
      window.removeEventListener("orientationchange", clearTouchInput);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [visible]);

  return <>
    {visible && <MovementStick />}
    <TalkControl canInteract={canInteract} visible={visible} onTalk={queueTouchInteract} />
  </>;
}

export function TalkControl({ canInteract, visible, onTalk, label = "Talk", inline = false }: {
  canInteract: boolean; visible: boolean; onTalk: () => void; label?: string; inline?: boolean;
}) {
  useLocale((state) => state.locale);
  const touchPress = useRef(false);
  if (!visible) return null;

  return (
    <div className={inline ? "mt-3" : "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"}>
      <button
        type="button"
        aria-label={t(label)}
        disabled={!canInteract}
        onPointerDown={(event) => {
          event.stopPropagation();
          touchPress.current = false;
          // A second finger doesn't produce a compatibility click while the
          // first is holding the stick. Touch actions fire on the press.
          if (event.pointerType === "touch" && canInteract) {
            event.preventDefault();
            touchPress.current = true;
            onTalk();
          }
        }}
        onKeyDown={(event) => { event.stopPropagation(); touchPress.current = false; }}
        onKeyUp={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (touchPress.current && event.detail !== 0) { touchPress.current = false; return; }
          touchPress.current = false;
          if (!canInteract) return;
          onTalk();
        }}
        className={clsx(
          "pointer-events-auto flex min-h-12 touch-manipulation select-none items-center justify-center rounded-md border-2 px-5 py-3 text-sm",
          inline ? "w-full" : "talk-control min-w-24",
          canInteract
            ? "border-accent-amber bg-accent-amber/25 text-accent-amber active:bg-accent-amber/45"
            : "border-stage-border bg-stage-surface/70 text-stage-muted opacity-50",
        )}
      >{!inline && <svg className="talk-glyph" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M7 5h18a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4h-9l-7 5v-5H7a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z" fill="currentColor" />
        <circle cx="10" cy="14" r="1.7" fill="#102630" /><circle cx="16" cy="14" r="1.7" fill="#102630" /><circle cx="22" cy="14" r="1.7" fill="#102630" />
      </svg>}<span>{t(label)}</span></button>
    </div>
  );
}
