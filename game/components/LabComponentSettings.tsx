"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  isRotation,
  rotationAxis,
  type LabOp,
  type LabOpChange,
  type RotationAxis,
} from "@/game/labCircuit";
import { t, useLocale } from "@/i18n";
import { useFloatingPanel } from "./useFloatingPanel";
import { AngleDial } from "./AngleDial";
import { circuitActionLabel } from "@/game/circuitLabels";

/** A selected block's optional parameters, kept outside the scrolling circuit. */
export function LabComponentSettings({
  op,
  qubits,
  onChange,
  componentLabel,
}: {
  op: LabOp;
  qubits: number;
  onChange: (change: LabOpChange) => void;
  componentLabel: string;
}) {
  useLocale((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 280,
    height: 300,
  });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const host = open
    ? trigger.current?.closest<HTMLElement>(".shared-laptop")
    : null;

  const floatingPanel = useFloatingPanel({
    open,
    onClose: () => setOpen(false),
    trigger,
    panel,
    focusOnOpen: true,
    observe: () => [panel.current, trigger.current?.closest(".laptop-screen")],
    position() {
      const anchor = trigger.current?.getBoundingClientRect();
      const bounds = trigger.current
        ?.closest(".laptop-screen")
        ?.getBoundingClientRect();
      if (!anchor || !bounds || !panel.current) return;
      const width = Math.min(280, bounds.width - 16);
      const height = Math.max(60, bounds.height - 16);
      const actualHeight = Math.min(panel.current.scrollHeight, height);
      const below = bounds.bottom - anchor.bottom - 12;
      const top =
        below >= actualHeight
          ? anchor.bottom + 8
          : anchor.top - actualHeight - 8;
      setPosition({
        width,
        height,
        left: Math.max(
          bounds.left + 8,
          Math.min(anchor.left, bounds.right - width - 8),
        ),
        top: Math.max(
          bounds.top + 8,
          Math.min(top, bounds.bottom - actualHeight - 8),
        ),
      });
    },
  });

  if (!["ROTATION", "RY", "CX", "ORACLE", "PARITY"].includes(op.gate))
    return null;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={circuitActionLabel("settings", componentLabel)}
        title={circuitActionLabel("settings", componentLabel)}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 17h16M8 4v6M16 14v6" />
        </svg>
      </button>
      {open &&
        host &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="region"
            aria-label={circuitActionLabel("settings", componentLabel)}
            tabIndex={-1}
            className="lab-component-settings space-y-3"
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: position.height,
            }}
            onKeyDownCapture={floatingPanel.onKeyDownCapture}
          >
            <header>
              <h4>
                {isRotation(op.gate)
                  ? `${t("Rotation")} · θ`
                  : `${t("Component settings")} · ${op.gate}`}
              </h4>
              <button
                type="button"
                aria-label={circuitActionLabel("close", componentLabel)}
                title={circuitActionLabel("close", componentLabel)}
                onClick={floatingPanel.close}
              >
                ×
              </button>
            </header>
            {op.gate === "CX" && (
              <label>
                {t("Control wire")}
                <select
                  className="lab-input"
                  value={op.control}
                  onChange={(event) =>
                    onChange({ control: Number(event.target.value) })
                  }
                >
                  {Array.from({ length: qubits }, (_, i) =>
                    i !== op.wire ? (
                      <option key={i} value={i}>
                        q{qubits - 1 - i}
                      </option>
                    ) : null,
                  )}
                </select>
              </label>
            )}
            {isRotation(op.gate) && (
              <>
                <div
                  role="group"
                  aria-label={t("Rotation axis")}
                  className="lab-rotation-axes"
                >
                  {(["X", "Y", "Z"] as RotationAxis[]).map((axis) => (
                    <button
                      type="button"
                      key={axis}
                      aria-pressed={rotationAxis(op) === axis}
                      onClick={() => onChange({ gate: "ROTATION", axis })}
                    >
                      {axis}
                    </button>
                  ))}
                </div>
                <AngleDial
                  value={op.angle!}
                  onChange={(angle) => onChange({ angle })}
                />
                <label>
                  {t("Rotation angle θ (degrees)")}
                  <input
                    className="lab-input"
                    type="number"
                    min={-360}
                    max={360}
                    aria-label={t("Rotation angle θ (degrees)")}
                    step="1"
                    key={op.angle}
                    defaultValue={Number(
                      ((op.angle! * 180) / Math.PI).toFixed(6),
                    )}
                    onBlur={(event) => {
                      const degrees = Number(event.target.value);
                      if (
                        event.target.value &&
                        Number.isFinite(degrees) &&
                        Math.abs(degrees) <= 360
                      )
                        onChange({ angle: (degrees * Math.PI) / 180 });
                      else
                        event.target.value = String(
                          (op.angle! * 180) / Math.PI,
                        );
                    }}
                    onKeyDownCapture={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                        panel.current?.focus();
                      }
                    }}
                  />
                </label>
                <div className="flex flex-wrap gap-1">
                  {[0, 45, 90, 180, 360].map((angle) => (
                    <button
                      type="button"
                      key={angle}
                      onClick={() =>
                        onChange({ angle: (angle * Math.PI) / 180 })
                      }
                    >
                      {angle}°
                    </button>
                  ))}
                </div>
              </>
            )}
            {["ORACLE", "PARITY"].includes(op.gate) && (
              <label>
                {t("Oracle bits")}
                <input
                  className="lab-input"
                  value={op.bits}
                  maxLength={op.gate === "PARITY" ? qubits - 1 : qubits}
                  onChange={(event) => onChange({ bits: event.target.value })}
                />
              </label>
            )}
          </div>,
          host,
        )}
    </>
  );
}
