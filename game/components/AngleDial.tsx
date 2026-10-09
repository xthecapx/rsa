"use client";

import { useId, useRef, useState, type PointerEvent } from "react";
import {
  advanceDialDegrees,
  clampDegrees,
  pointerDegrees,
} from "@/game/angleDial";
import { t, useLocale } from "@/i18n";

/** Degrees for the player, radians for the saved circuit and backend. */
export function AngleDial({
  value,
  onChange,
}: {
  value: number;
  onChange: (radians: number) => void;
}) {
  const locale = useLocale((s) => s.locale);
  const help = useId();
  const [active, setActive] = useState(false);
  const gesture = useRef<{
    id: number;
    pointer: number;
    degrees: number;
  } | null>(null);
  const degrees = (value * 180) / Math.PI;
  const display = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(degrees);
  const change = (next: number) =>
    onChange((clampDegrees(next) * Math.PI) / 180);
  const point = (radius: number) => ({
    x: 110 + radius * Math.sin(value),
    y: 110 - radius * Math.cos(value),
  });
  const inner = point(36),
    outer = point(72);
  const circumference = 2 * Math.PI * 72;

  function move(event: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    // The center has no direction; keep the last angle while crossing it.
    if (
      Math.hypot(
        event.clientX - bounds.left - bounds.width / 2,
        event.clientY - bounds.top - bounds.height / 2,
      ) < 16
    )
      return;
    const pointer = pointerDegrees(event.clientX, event.clientY, bounds);
    drag.degrees = advanceDialDegrees(drag.degrees, drag.pointer, pointer);
    drag.pointer = pointer;
    change(Math.round(drag.degrees));
  }
  function stop(event: PointerEvent<HTMLDivElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    setActive(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="lab-angle-control">
      <div
        role="slider"
        tabIndex={0}
        className="lab-angle-dial"
        data-active={active}
        aria-label={t("Rotation angle dial")}
        aria-describedby={help}
        aria-valuemin={-360}
        aria-valuemax={360}
        aria-valuenow={degrees}
        aria-valuetext={t("{degrees} degrees; {radians} radians")
          .replace("{degrees}", display)
          .replace("{radians}", String(Number(value.toFixed(3))))}
        onPointerDown={(event) => {
          if (event.button !== 0 || gesture.current) return;
          event.preventDefault();
          event.currentTarget.focus();
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            Math.hypot(
              event.clientX - bounds.left - bounds.width / 2,
              event.clientY - bounds.top - bounds.height / 2,
            ) < 16
          )
            return;
          const pointer = pointerDegrees(event.clientX, event.clientY, bounds);
          const next = Math.round(
            advanceDialDegrees(degrees, degrees, pointer),
          );
          gesture.current = { id: event.pointerId, pointer, degrees: next };
          event.currentTarget.setPointerCapture(event.pointerId);
          setActive(true);
          change(next);
        }}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onKeyDownCapture={(event) => {
          const step = event.shiftKey ? 15 : 1;
          const next =
            event.key === "ArrowRight" || event.key === "ArrowUp"
              ? degrees + step
              : event.key === "ArrowLeft" || event.key === "ArrowDown"
                ? degrees - step
                : event.key === "PageUp"
                  ? degrees + 15
                  : event.key === "PageDown"
                    ? degrees - 15
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 360
                        : null;
          if (next === null) return;
          event.preventDefault();
          event.stopPropagation();
          change(next);
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 220 220">
          <circle className="lab-angle-ring" cx="110" cy="110" r="72" />
          <g
            transform={`translate(110 110) rotate(-90) ${degrees < 0 ? "scale(1 -1)" : ""}`}
          >
            <circle
              className="lab-angle-arc"
              r="72"
              strokeDasharray={`${(Math.abs(degrees) / 360) * circumference} ${circumference}`}
            />
          </g>
          {Array.from({ length: 24 }, (_, i) => {
            // A horizontal tick beside 90° can look like a minus sign.
            if (i === 6 || i === 18) return null;
            const angle = (i * Math.PI) / 12;
            return (
              <line
                key={i}
                className="lab-angle-tick"
                x1={110 + 81 * Math.sin(angle)}
                y1={110 - 81 * Math.cos(angle)}
                x2={110 + (i % 6 === 0 ? 89 : 85) * Math.sin(angle)}
                y2={110 - (i % 6 === 0 ? 89 : 85) * Math.cos(angle)}
              />
            );
          })}
          <g
            className="lab-angle-labels"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            <text x="110" y="13">
              0°
            </text>
            <text x="205" y="110">
              90°
            </text>
            <text x="110" y="208">
              ±180°
            </text>
            <text x="16" y="110">
              −90°
            </text>
          </g>
          <line
            className="lab-angle-needle"
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
          />
          <circle className="lab-angle-knob" cx={outer.x} cy={outer.y} r="8" />
          <text className="lab-angle-value" x="110" y="105" textAnchor="middle">
            θ {display}°
          </text>
          <text
            className="lab-angle-radians"
            x="110"
            y="128"
            textAnchor="middle"
          >
            {(value / Math.PI).toFixed(2)}π
          </text>
        </svg>
      </div>
      <p className="text-xs text-stage-muted">
        {t("Clockwise + · Counterclockwise −")}
      </p>
      <p id={help} className="text-xs text-stage-muted">
        {t("Drag around the dial. Arrow keys: 1°; Shift + arrows: 15°.")}
      </p>
    </div>
  );
}
