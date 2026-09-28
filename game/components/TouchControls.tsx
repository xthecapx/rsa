"use client";
import { t, useLocale } from "@/i18n";

import { useEffect } from "react";
import clsx from "clsx";

import { clearTouchInput, queueTouchInteract } from "@/engine/touchInput";

/**
 * Talk button for mouse and touch play. Walking is handled by clicking or
 * tapping the world; Space remains available for keyboard interaction.
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
