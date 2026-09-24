"use client";
import { t, localize, useLocale } from "@/i18n";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LanguageSwitch } from "./LanguageSwitch";

/** Shared laptop chrome and controls for every scenario. Contents stay mounted
 * while closed so a player never loses an experiment by lowering the lid. */
export function LaptopShell({ open, title, status, memory, footer, children, onClose }: {
  open: boolean; title: string; status?: ReactNode; memory?: ReactNode;
  footer?: ReactNode; children: ReactNode; onClose: () => void;
}) {
  useLocale((state) => state.locale);
  const [mounted, setMounted] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Match the server and first client render before creating a body portal.
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    const background = Array.from(document.body.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== element?.parentElement)
      .map((child) => ({ child, inert: child.inert }));
    background.forEach(({ child }) => { child.inert = true; });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]',
      ) ?? []).filter((el) => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !element?.contains(document.activeElement) || document.activeElement === element)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !element?.contains(document.activeElement) || document.activeElement === element)) {
        event.preventDefault(); first.focus();
      }
    }
    // Keep game keyboard shortcuts from consuming typing and interaction keys.
    function stop(event: KeyboardEvent) { event.stopPropagation(); }
    element?.addEventListener("keydown", key);
    element?.addEventListener("keydown", stop);
    return () => {
      element?.removeEventListener("keydown", key);
      element?.removeEventListener("keydown", stop);
      background.forEach(({ child, inert }) => { child.inert = inert; });
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [mounted, open]);
  if (!mounted) return null;
  return createPortal(
    <div className="laptop-overlay" hidden={!open}>
      <div className="shared-laptop" role="dialog" aria-modal="true" aria-label={t("Laptop")} tabIndex={-1} ref={dialog}>
        <div className="laptop-bezel"><div className="laptop-camera">● &nbsp; th3c4p</div>
          <div className="laptop-screen">
            <header className="laptop-toolbar"><div><h2>{localize(title)}</h2>{localize(status && <div className="laptop-status">{localize(status)}</div>)}</div>
              <div className="flex flex-wrap items-center justify-end gap-2"><LanguageSwitch /><button className="btn-ghost" onClick={onClose}>{t("Close laptop")}</button></div>
            </header>
            <div className="laptop-scroll">{localize(memory && <div className="laptop-memory">{localize(memory)}</div>)}{localize(children)}</div>
            <footer className="laptop-footer">{localize(footer ?? <p>{t("Results stay here when you close the laptop.")}</p>)}</footer>
          </div>
        </div>
        <div className="laptop-deck"><span /></div>
      </div>
    </div>, document.body,
  );
}
