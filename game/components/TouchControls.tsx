"use client";
import { t, useLocale } from "@/i18n";

import { useEffect } from "react";
import clsx from "clsx";

import { clearTouchInput, holdTouchDirection, releaseTouchDirection, queueTouchInteract, type TouchDirection } from "@/engine/touchInput";

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
    {visible && <div className="movement-pad" role="group" aria-label={t("Movement controls")}>
      {(["up", "left", "down", "right"] as TouchDirection[]).map((direction) => <button
        key={direction} type="button" className={`movement-pad-${direction}`} aria-label={t({ up: "Move up", down: "Move down", left: "Move left", right: "Move right" }[direction])}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault(); event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          holdTouchDirection(event.pointerId, direction);
        }}
        onPointerUp={(event) => { event.stopPropagation(); releaseTouchDirection(event.pointerId); }}
        onPointerCancel={(event) => releaseTouchDirection(event.pointerId)}
        onLostPointerCapture={(event) => releaseTouchDirection(event.pointerId)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === " " || event.key === "Enter") { event.preventDefault(); holdTouchDirection(-1, direction); }
        }}
        onKeyUp={(event) => { event.stopPropagation(); releaseTouchDirection(-1); }}
        onBlur={() => releaseTouchDirection(-1)}
        onClick={(event) => event.stopPropagation()}
      ><span aria-hidden="true">{{ up: "▲", down: "▼", left: "◀", right: "▶" }[direction]}</span></button>)}
    </div>}
    <TalkControl canInteract={canInteract} visible={visible} onTalk={queueTouchInteract} />
  </>;
}

export function TalkControl({ canInteract, visible, onTalk, label = "Talk", inline = false }: {
  canInteract: boolean; visible: boolean; onTalk: () => void; label?: string; inline?: boolean;
}) {
  useLocale((state) => state.locale);
  if (!visible) return null;

  return (
    <div className={inline ? "mt-3" : "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"}>
      <button
        type="button"
        aria-label={t(label)}
        disabled={!canInteract}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onKeyUp={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (!canInteract) return;
          onTalk();
        }}
        className={clsx(
          "pointer-events-auto flex min-h-12 touch-manipulation select-none items-center justify-center rounded-md border-2 px-5 py-3 text-sm",
          inline ? "w-full" : "min-w-24",
          canInteract
            ? "border-accent-amber bg-accent-amber/25 text-accent-amber active:bg-accent-amber/45"
            : "border-stage-border bg-stage-surface/70 text-stage-muted opacity-50",
        )}
      >{t(label)}</button>
    </div>
  );
}
