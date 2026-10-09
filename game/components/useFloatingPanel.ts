"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";

type ElementRef = RefObject<HTMLElement | null>;

/** Share panel lifecycle, leaving geometry and mounting strategy to the caller. */
export function useFloatingPanel({
  open,
  onClose,
  trigger,
  panel,
  position,
  observe,
  focusOnOpen = false,
}: {
  open: boolean;
  onClose: () => void;
  trigger: ElementRef;
  panel: ElementRef;
  position: () => void;
  observe: () => (Element | null | undefined)[];
  focusOnOpen?: boolean;
}) {
  // The listeners remain stable while callbacks can read the latest render.
  const latest = useRef({ onClose, position, observe });
  useLayoutEffect(() => {
    latest.current = { onClose, position, observe };
  });
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => latest.current.position();
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    latest.current.observe().forEach((element) => {
      if (element) observer.observe(element);
    });
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    if (focusOnOpen) panel.current?.focus();
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        latest.current.onClose();
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, focusOnOpen, panel, trigger]);

  function close() {
    latest.current.onClose();
    trigger.current?.focus();
  }
  function onKeyDownCapture(event: KeyboardEvent<HTMLElement>) {
    // Escape must reach dnd-kit while a keyboard drag is active.
    if (
      open &&
      event.key === "Escape" &&
      !event.currentTarget.closest('[data-puzzle-dragging="true"]')
    ) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }
  return { close, onKeyDownCapture };
}
