"use client";
import { t, useLocale } from "@/i18n";

import { useEffect } from "react";
import clsx from "clsx";

import { clearTouchInput, queueTouchInteract } from "@/engine/touchInput";

/**
 * Talk button for touch play. Walking is handled by tapping the street, so
 * this is the only control the HUD needs; the keyboard covers desktop.
 */
export function TouchControls({
  canInteract,
  visible,
}: {
  canInteract: boolean;
  visible: boolean;
}) {
  useLocale((state) => state.locale);
  useEffect(() => () => clearTouchInput(), []);

  return <TalkControl canInteract={canInteract} visible={visible} onTalk={queueTouchInteract} />;
}

export function TalkControl({ canInteract, visible, onTalk }: { canInteract: boolean; visible: boolean; onTalk: () => void }) {
  useLocale((state) => state.locale);
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <button
        type="button"
        aria-label={t("Talk")}
        disabled={!canInteract}
        onPointerDown={(event) => {
          event.preventDefault();
          if (!canInteract) return;
          onTalk();
        }}
        className={clsx(
          "pointer-events-auto flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border-2 text-[10px] uppercase tracking-widest",
          canInteract
            ? "animate-pulse border-accent-amber bg-accent-amber/25 text-accent-amber active:bg-accent-amber/45"
            : "border-stage-border bg-stage-surface/70 text-stage-muted opacity-50",
        )}
      >{t("Talk")}</button>
    </div>
  );
}
