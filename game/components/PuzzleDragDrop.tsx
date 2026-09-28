"use client";

import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import { DragDropProvider, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/react";
import { Accessibility, KeyboardSensor, PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { t, useLocale } from "@/i18n";

const sensors = [
  PointerSensor.configure({
    activationConstraints: (event) => event.pointerType === "touch"
      ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
      : [new PointerActivationConstraints.Distance({ value: 5 })],
  }),
  KeyboardSensor.configure({ keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ["Space"] } }),
];

const PuzzleContext = createContext<{ instructionsId: string; canClick: () => boolean }>({
  instructionsId: "",
  canClick: () => true,
});

/** Shared input, preview, scrolling, and announcements for all lesson builders. */
export function PuzzleDragDrop({ labels, targets, onPlace, renderPreview, children }: {
  labels: Record<string, string>; targets: Record<string, string>;
  onPlace: (target: string, source: string) => void;
  renderPreview: (source: string) => ReactNode; children: ReactNode;
}) {
  useLocale((state) => state.locale);
  const instructionsId = useId();
  const suppressClicksUntil = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const sourceLabel = (id: string | number | undefined) => id === undefined ? "" : labels[String(id)] ?? String(id);
  return <PuzzleContext.Provider value={{ instructionsId, canClick: () => performance.now() > suppressClicksUntil.current }}>
    <DragDropProvider sensors={sensors}
      // Announcements live inside the laptop dialog; body siblings are inert.
      // Keep the default feedback and auto-scroll plugins.
      plugins={(defaults) => defaults.filter((plugin) => plugin !== Accessibility)}
      onDragStart={({ operation }) => {
        suppressClicksUntil.current = Infinity;
        setDragging(true);
        setAnnouncement(`${t("Picked up")}: ${sourceLabel(operation.source?.id)}. ${t("Move to a slot and release.")}`);
      }}
      onDragOver={({ operation }) => {
        const target = operation.target?.id;
        setAnnouncement(target === undefined ? t("Outside a drop slot.") : `${t("Drop here")}: ${targets[String(target)] ?? target}`);
      }}
      onDragEnd={({ operation, canceled }) => {
        suppressClicksUntil.current = performance.now() + 250;
        setDragging(false);
        const source = operation.source?.id, target = operation.target?.id;
        if (!canceled && source !== undefined && target !== undefined
          && Object.hasOwn(labels, String(source)) && Object.hasOwn(targets, String(target))) {
          onPlace(String(target), String(source));
          setAnnouncement(`${t("Placed")}: ${sourceLabel(source)}. ${targets[String(target)]}`);
        } else setAnnouncement(t("Drag canceled. The puzzle is unchanged."));
      }}>
      <div data-puzzle-dragging={dragging}>
        <p className="puzzle-drag-help">{t("Drag a piece into a slot, or tap the piece and then the slot. On a phone, hold briefly before dragging.")}</p>
        <p id={instructionsId} className="sr-only">{t("Press Space to pick up, arrows to move, and Space to drop. Escape cancels. Enter selects a piece or places it in a focused slot.")}</p>
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
        {children}
        <DragOverlay className="puzzle-drag-overlay" dropAnimation={null}>
          {(source) => <div className="puzzle-drag-preview" aria-hidden="true">{renderPreview(String(source.id))}</div>}
        </DragOverlay>
      </div>
    </DragDropProvider>
  </PuzzleContext.Provider>;
}

export function PuzzlePiece({ id, label, selected, onSelect, className = "", children }: {
  id: string; label: string; selected: boolean; onSelect: () => void; className?: string; children: ReactNode;
}) {
  const { ref, isDragSource } = useDraggable({ id, type: "puzzle-piece" });
  const { instructionsId, canClick } = useContext(PuzzleContext);
  return <button ref={ref} type="button" aria-label={label} aria-pressed={selected} aria-describedby={instructionsId}
    className={`coin-block puzzle-drag-piece ${selected ? "selected" : ""} ${isDragSource ? "is-dragging" : ""} ${className}`}
    onClick={(event) => { if (!event.defaultPrevented && canClick()) onSelect(); }}>
    {children}<span className="puzzle-drag-grip" aria-hidden="true">⠿</span>
  </button>;
}

export function PuzzleSlot({ id, label, className, onSelect, children }: {
  id: string; label: string; className: string; onSelect: () => void; children: ReactNode;
}) {
  const { ref, isDropTarget } = useDroppable({ id, accept: "puzzle-piece" });
  const { canClick } = useContext(PuzzleContext);
  return <button ref={ref} type="button" aria-label={label}
    className={`${className} puzzle-drop-slot ${isDropTarget ? "is-over" : ""}`}
    onClick={(event) => { if (!event.defaultPrevented && canClick()) onSelect(); }}>{children}</button>;
}
