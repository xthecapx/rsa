"use client";
import { t } from "@/i18n";
import { isRotation, type LabGate } from "@/game/labCircuit";
import { LAB_GATES } from "@/game/labEditor";
import { PuzzlePiece } from "./PuzzleDragDrop";
import { addComponentLabel, gateLabel } from "@/game/circuitLabels";
import type { useLabEditor } from "./useLabEditor";
const componentLabel = (gate: LabGate) => t(LAB_GATES[gate].title);
/** Keep the hidden palette mounted: dnd-kit must retain its registered sources. */
export function LabComponentPicker({
  editor,
  available,
  qubits,
  count,
  busy,
}: {
  editor: ReturnType<typeof useLabEditor>;
  available: LabGate[];
  qubits: number;
  count: number;
  busy: boolean;
}) {
  const {
    piece,
    setPiece,
    pickerOpen,
    setPickerOpen,
    pendingSlot,
    setPendingSlot,
    pickerId,
    pickerTools,
    pickerButton,
    pickerPosition,
    pickerPanel,
    place,
  } = editor;
  return (
    <div
      ref={pickerTools}
      className="lab-component-tools"
      onKeyDownCapture={pickerPanel.onKeyDownCapture}
    >
      <button
        type="button"
        ref={pickerButton}
        className="circuit-icon-action lab-add-component"
        aria-label={t("Add component")}
        title={t("Add component")}
        aria-expanded={pickerOpen}
        aria-controls={pickerId}
        disabled={busy || count >= 32}
        onClick={() => {
          setPendingSlot(null);
          setPickerOpen(!pickerOpen);
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        {piece && (
          <span className="lab-selected-gate" aria-hidden="true">
            {isRotation(piece) ? "R(θ)" : componentLabel(piece)}
          </span>
        )}
      </button>
      <section
        hidden={!pickerOpen}
        id={pickerId}
        className="lab-component-picker"
        style={{
          maxHeight: pickerPosition.height,
          ...(pickerPosition.below
            ? { top: "calc(100% + 14px)", bottom: "auto" }
            : {}),
        }}
        aria-label={t("Components")}
      >
        <h4>{t("Components")}</h4>
        <div className="flex flex-wrap gap-2">
          {available
            .filter((g) => qubits > 1 || !["CX", "PARITY"].includes(g))
            .map((gate) => (
              <PuzzlePiece
                key={gate}
                id={gate}
                label={addComponentLabel(gateLabel(LAB_GATES[gate].title))}
                selected={piece === gate}
                onSelect={() => {
                  if (pendingSlot) {
                    place(pendingSlot, gate);
                    pickerButton.current?.focus();
                  } else {
                    setPiece(gate);
                    setPickerOpen(false);
                    pickerButton.current?.focus();
                  }
                }}
              >
                <span className="font-mono">
                  {isRotation(gate)
                    ? `${t("Rotation")} (θ)`
                    : componentLabel(gate)}
                </span>
              </PuzzlePiece>
            ))}
        </div>
        <p className="text-xs text-stage-muted">
          {t(
            pendingSlot
              ? "Choose a component to place on this wire."
              : "Drag a component onto a wire, or select it and tap + on a wire.",
          )}
        </p>
        {!available.length && (
          <p className="text-xs">
            {t(
              "Acquire and install gate modules from Equipment supplies, or load the optional starter recipe below.",
            )}
          </p>
        )}
      </section>
    </div>
  );
}
