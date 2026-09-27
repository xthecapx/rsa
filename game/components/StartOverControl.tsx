"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t, useLocale } from "@/i18n";

export interface RestartOption { label: string; description: string; restart: () => void }

/** Explicit reset choices, accessible from the world and from the laptop. */
export function StartOverControl({ options, disabled = false, onOpenChange }: {
  options: RestartOption[]; disabled?: boolean; onOpenChange: (open: boolean) => void;
}) {
  useLocale((state) => state.locale);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); onOpenChange(false); trigger.current?.focus(); }
  useEffect(() => {
    if (open) dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open]);

  return <>
    <button ref={trigger} type="button" aria-label={t("Start over")} className="btn-ghost text-xs" disabled={disabled}
      title={disabled ? t("Finishing the current operation…") : t("Start over")}
      onClick={() => { setOpen(true); onOpenChange(true); }}><span aria-hidden="true">↺</span><span className="ml-1 hidden sm:inline">{t("Start over")}</span></button>
    {open && createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-3" onPointerDown={(event) => event.stopPropagation()}>
      <div ref={dialog} className="textbox max-h-[85dvh] w-full max-w-lg space-y-4 overflow-y-auto p-5" role="dialog" aria-modal="true" aria-labelledby={titleId}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") { event.preventDefault(); close(); }
          if (event.key === "Tab") {
            const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
        <h2 id={titleId} className="text-accent-amber">{t("Start over")}</h2>
        <p className="text-sm text-stage-muted">{t("Choose what to restart. Language and sound settings stay the same.")}</p>
        {options.map((option) => <button key={option.label} type="button" className="btn-ghost block w-full space-y-2 p-3 text-left" disabled={disabled}
          onClick={() => { close(); option.restart(); }}>
          <span className="block text-sm text-accent-teal">{t(option.label)}</span>
          <span className="block text-xs leading-relaxed text-stage-muted">{t(option.description)}</span>
        </button>)}
        <button type="button" className="btn-ghost text-sm" onClick={close}>{t("Cancel")}</button>
      </div>
    </div>, document.body)}
  </>;
}
