"use client";

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { t, useLocale } from "@/i18n";
import { holdTouchDirection, releaseTouchDirection, type TouchDirection } from "@/engine/touchInput";
import { thumbstick } from "@/engine/thumbstick";

const KEYS: Record<string, TouchDirection> = {
  arrowup: "up", w: "up", arrowdown: "down", s: "down",
  arrowleft: "left", a: "left", arrowright: "right", d: "right",
};
const NEUTRAL = { x: 0, y: 0 };

export function MovementStick() {
  useLocale((s) => s.locale);
  const helpId = useId();
  const pointer = useRef<number | null>(null);
  const [offset, setOffset] = useState(NEUTRAL);
  const reset = useCallback(() => {
    if (pointer.current !== null) releaseTouchDirection(pointer.current);
    pointer.current = null;
    setOffset(NEUTRAL);
  }, []);

  useEffect(() => {
    const hidden = () => { if (document.hidden) reset(); };
    window.addEventListener("blur", reset);
    window.addEventListener("orientationchange", reset);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      if (pointer.current !== null) releaseTouchDirection(pointer.current);
      window.removeEventListener("blur", reset);
      window.removeEventListener("orientationchange", reset);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [reset]);

  function move(event: PointerEvent<HTMLButtonElement>) {
    if (pointer.current !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = thumbstick(event.clientX - bounds.left - bounds.width / 2, event.clientY - bounds.top - bounds.height / 2);
    if (next.direction) holdTouchDirection(event.pointerId, next.direction);
    else releaseTouchDirection(event.pointerId);
    setOffset({ x: next.x, y: next.y });
  }

  return <button type="button" className="movement-pad" aria-label={t("Movement controls")}
    aria-describedby={helpId} aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight W A S D"
    onPointerDown={(event) => {
      if (event.button !== 0 || pointer.current !== null) return;
      event.preventDefault(); event.stopPropagation();
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      move(event);
    }}
    onPointerMove={move}
    onPointerUp={(event) => { event.stopPropagation(); if (pointer.current === event.pointerId) reset(); }}
    onPointerCancel={(event) => { if (pointer.current === event.pointerId) reset(); }}
    onLostPointerCapture={(event) => { if (pointer.current === event.pointerId) reset(); }}
    onKeyDown={(event) => {
      event.stopPropagation();
      const direction = KEYS[event.key.toLowerCase()];
      if (!direction || (pointer.current !== null && pointer.current !== -1)) return;
      event.preventDefault(); pointer.current = -1;
      holdTouchDirection(-1, direction);
      setOffset({ x: direction === "left" ? -34 : direction === "right" ? 34 : 0,
        y: direction === "up" ? -34 : direction === "down" ? 34 : 0 });
    }}
    onKeyUp={(event) => { event.stopPropagation(); if (KEYS[event.key.toLowerCase()] && pointer.current === -1) reset(); }}
    onBlur={() => { if (pointer.current === -1) reset(); }}
    onClick={(event) => event.stopPropagation()}
  >
    <span className="sr-only" id={helpId}>{t("Drag the stick to walk. Release it to stop.")}</span>
    <span className="stick-arrow stick-up" aria-hidden="true">⌃</span>
    <span className="stick-arrow stick-down" aria-hidden="true">⌄</span>
    <span className="stick-arrow stick-left" aria-hidden="true">‹</span>
    <span className="stick-arrow stick-right" aria-hidden="true">›</span>
    <span className="stick-knob" aria-hidden="true" style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }} />
  </button>;
}
