"use client";
import { t, localize, useLocale } from "@/i18n";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BackendLabel } from "./BackendLabel";
import { LanguageSwitch } from "./LanguageSwitch";
import { Calculator, useCalculator } from "./Calculator";
import { CampusReference } from "./CampusNotebook";
import { useExecution } from "@/lib/execution";

/** Shared laptop chrome and controls for every scenario. Contents stay mounted
 * while closed so a player never loses an experiment by lowering the lid. */
export function LaptopShell({
  open,
  title,
  status,
  memory,
  footer,
  children,
  onClose,
  closeDisabled = false,
  restartControl,
  calculator = false,
  selectedBackend = false,
  foundations = true,
}: {
  open: boolean;
  title: string;
  status?: ReactNode;
  memory?: ReactNode;
  restartControl?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  /** Offer the whole-number calculator, for benches with sums to work out. */
  calculator?: boolean;
  selectedBackend?: boolean;
  /** Campus laptops already provide the full notebook in their navigation. */
  foundations?: boolean;
}) {
  useLocale((state) => state.locale);
  const owner = useId();
  const background = useExecution((state) => state.background);
  const requestsActive = useExecution((state) => state.active.length > 0);
  const minimized = background?.owner === owner;
  const visible = open && !minimized;
  const canMinimize = closeDisabled && requestsActive;
  function minimize() {
    if (!canMinimize) return;
    useExecution.setState({
      background: { owner, title, running: true, canRestore: open },
    });
  }
  const calculatorOpen = useCalculator((state) => state.open);
  const [mounted, setMounted] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = () => {
    if (canMinimize) minimize();
    else if (!closeDisabled) onClose();
  };
  useEffect(() => {
    if (useExecution.getState().background?.owner !== owner) return;
    useExecution.setState({
      background: { owner, title, running: closeDisabled, canRestore: open },
    });
  }, [owner, title, closeDisabled, open]);
  useEffect(
    () => () => {
      if (useExecution.getState().background?.owner === owner)
        useExecution.setState({ background: null });
    },
    [owner],
  );
  // Match the server and first client render before creating a body portal.
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted || !visible || !feedback.current) return;
    const host = feedback.current;
    useExecution.setState({ feedbackHost: host });
    return () => {
      if (useExecution.getState().feedbackHost === host)
        useExecution.setState({ feedbackHost: null });
    };
  }, [mounted, visible]);
  useEffect(() => {
    if (!mounted || !visible) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    const background = Array.from(document.body.children)
      .filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child !== element?.parentElement,
      )
      .map((child) => ({ child, inert: child.inert }));
    background.forEach(({ child }) => {
      child.inert = true;
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.focus();
    function key(event: KeyboardEvent) {
      // A puzzle owns Escape/Tab while dragging. The dnd-kit keyboard sensor
      // also marks handled events before they reach this dialog.
      if (
        event.defaultPrevented ||
        element?.querySelector('[data-puzzle-dragging="true"]')
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !element?.contains(document.activeElement) ||
          document.activeElement === element)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !element?.contains(document.activeElement) ||
          document.activeElement === element)
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    // Keep game keyboard shortcuts from consuming typing and interaction keys.
    function stop(event: KeyboardEvent) {
      if (!element?.querySelector('[data-puzzle-dragging="true"]'))
        event.stopPropagation();
    }
    element?.addEventListener("keydown", key);
    element?.addEventListener("keydown", stop);
    return () => {
      element?.removeEventListener("keydown", key);
      element?.removeEventListener("keydown", stop);
      background.forEach(({ child, inert }) => {
        child.inert = inert;
      });
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [mounted, visible]);
  if (!mounted) return null;
  return createPortal(
    <div className="laptop-overlay viewport-overlay" hidden={!visible}>
      <div
        className="shared-laptop"
        role="dialog"
        aria-modal="true"
        aria-label={t("Laptop")}
        tabIndex={-1}
        ref={dialog}
      >
        <div className="laptop-bezel">
          <div className="laptop-camera">● &nbsp; th3c4p</div>
          <div className="laptop-screen">
            <header className="laptop-toolbar">
              <div className="min-w-0">
                <h2>{localize(title)}</h2>
                <BackendLabel selected={selectedBackend} />
                {localize(
                  status && (
                    <div className="laptop-status">{localize(status)}</div>
                  ),
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {calculator && (
                  <button
                    type="button"
                    className="btn-ghost"
                    aria-pressed={calculatorOpen}
                    onClick={() => useCalculator.getState().toggle()}
                  >
                    🧮 {t("Calculator")}
                  </button>
                )}
                {restartControl}
                <LanguageSwitch />
                {canMinimize && (
                  <button className="btn-ghost min-h-11" onClick={minimize}>
                    {t("Wait in background")}
                  </button>
                )}
                <button
                  className="btn-ghost"
                  disabled={closeDisabled}
                  onClick={onClose}
                >
                  {t("Close laptop")}
                </button>
              </div>
            </header>
            <div className="laptop-scroll">
              {calculator && calculatorOpen && <Calculator />}
              {localize(
                memory && (
                  <div className="laptop-memory">{localize(memory)}</div>
                ),
              )}
              {foundations && <CampusReference />}
              {localize(children)}
            </div>
            <footer className="laptop-footer">
              {localize(
                footer ?? (
                  <p>{t("Results stay here when you close the laptop.")}</p>
                ),
              )}
            </footer>
            <div ref={feedback} />
          </div>
        </div>
        <div className="laptop-deck">
          <span />
        </div>
      </div>
    </div>,
    document.body,
  );
}
