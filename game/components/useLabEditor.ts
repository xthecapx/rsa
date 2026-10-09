"use client";
import { useId, useRef, useState, type RefObject } from "react";
import {
  validRecipe,
  type LabRecipe,
  type LabGate,
  type LabOpChange,
} from "@/game/labCircuit";
import {
  moveLabOperation,
  editLabOperation,
  placeLabOperation,
} from "@/game/labEditor";
import { useFloatingPanel } from "./useFloatingPanel";
import type { PuzzleControls } from "./PuzzleDragDrop";

export function useLabEditor({
  recipe,
  allowed,
  running,
  onChange,
}: {
  recipe: LabRecipe;
  allowed: (gate: LabGate) => boolean;
  running: RefObject<boolean>;
  onChange: (recipe: LabRecipe) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [piece, setPiece] = useState<LabGate | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const pickerId = useId();
  const puzzleControls = useRef<PuzzleControls>(null);
  const circuit = useRef<HTMLDivElement>(null);
  const pickerTools = useRef<HTMLDivElement>(null);
  const pickerButton = useRef<HTMLButtonElement>(null);
  const [pickerPosition, setPickerPosition] = useState({
    below: false,
    height: 240,
  });
  const pickerPanel = useFloatingPanel({
    open: pickerOpen,
    onClose: () => setPickerOpen(false),
    trigger: pickerButton,
    panel: pickerTools,
    observe: () => [
      pickerTools.current?.parentElement,
      pickerTools.current?.closest(".laptop-scroll"),
    ],
    position() {
      const actions = pickerTools.current?.parentElement;
      const viewport = actions?.closest(".laptop-scroll");
      if (!actions || !viewport) return;
      const bounds = actions.getBoundingClientRect();
      const visible = viewport.getBoundingClientRect();
      const above = bounds.top - visible.top - 20;
      const below = visible.bottom - bounds.bottom - 20;
      const next = {
        below: above < 120 && below > above,
        height: Math.max(
          60,
          Math.min(240, above < 120 && below > above ? below : above),
        ),
      };
      setPickerPosition((previous) =>
        previous.below === next.below && previous.height === next.height
          ? previous
          : next,
      );
    },
  });
  function resetInteraction() {
    puzzleControls.current?.resetInteraction();
    setSelected(null);
    setPiece(null);
    setPendingSlot(null);
    setPickerOpen(false);
  }
  function update(next: LabRecipe, reset = false) {
    if (running.current || !validRecipe(next)) return;
    if (reset) resetInteraction();
    onChange(next);
  }
  function removeComponent(index: number) {
    if (!recipe.operations[index]) return;
    update(
      {
        ...recipe,
        operations: recipe.operations.filter((_, i) => i !== index),
      },
      true,
    );
    pickerButton.current?.focus();
  }
  function moveComponent(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (
      running.current ||
      destination < 0 ||
      destination >= recipe.operations.length
    )
      return;
    const next = moveLabOperation(recipe, index, direction);
    if (!next) return;
    const operations = next.operations;
    update(next, true);
    setSelected(destination);
    requestAnimationFrame(() => {
      const wire = operations[destination].wire ?? 0;
      circuit.current
        ?.querySelector<HTMLButtonElement>(
          `[data-puzzle-id="op-${destination}-${wire}"]`,
        )
        ?.focus();
    });
  }
  function editOp(change: LabOpChange) {
    if (selected === null) return;
    const next = editLabOperation(recipe, selected, change);
    if (next) update(next);
  }
  function place(target: string, source: string) {
    if (running.current) return;
    const next = placeLabOperation(recipe, target, source, allowed);
    if (!next) return;
    update(next.recipe);
    setPiece(null);
    setPickerOpen(false);
    setPendingSlot(null);
    setSelected(next.selected);
  }
  function chooseSlot(target: string) {
    if (piece) place(target, piece);
    else {
      setPendingSlot(target);
      setPickerOpen(true);
    }
  }
  return {
    selected,
    setSelected,
    piece,
    setPiece,
    pickerOpen,
    setPickerOpen,
    pendingSlot,
    setPendingSlot,
    pickerId,
    puzzleControls,
    circuit,
    pickerTools,
    pickerButton,
    pickerPosition,
    pickerPanel,
    resetInteraction,
    update,
    removeComponent,
    moveComponent,
    editOp,
    place,
    chooseSlot,
  };
}
