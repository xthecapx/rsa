"use client";
import { t } from "@/i18n";
import {
  addComponentLabel,
  circuitPositionLabel,
  circuitActionLabel,
  gateLabel,
} from "@/game/circuitLabels";
import { type LabRecipe, type LabGate } from "@/game/labCircuit";
import { LAB_GATES, operationLabel as label } from "@/game/labEditor";
import { LabComponentPicker } from "./LabComponentPicker";
import { CircuitActions } from "./CircuitActions";
import { LabComponentSettings } from "./LabComponentSettings";
import {
  PuzzleDragDrop,
  PuzzleSlot,
  PuzzleCircuitPiece,
} from "./PuzzleDragDrop";
import type { useLabEditor } from "./useLabEditor";
const componentLabel = (gate: LabGate) => t(LAB_GATES[gate].title);
export function LabCircuitEditor({
  recipe,
  editor,
  available,
  multipleQubits,
  unlocked,
  busy,
  onRun,
}: {
  recipe: LabRecipe;
  editor: ReturnType<typeof useLabEditor>;
  available: LabGate[];
  multipleQubits: boolean;
  unlocked: boolean;
  busy: boolean;
  onRun: () => void;
}) {
  const {
    selected,
    setSelected,
    piece,
    setPiece,
    setPickerOpen,
    puzzleControls,
    circuit,
    update,
    removeComponent,
    moveComponent,
    editOp,
    place,
    chooseSlot,
  } = editor;
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          {t("Qubits")}
          <select
            aria-describedby="lab-qubit-help"
            className="lab-input"
            value={recipe.qubits}
            onChange={(e) => {
              const n = Number(e.target.value);
              update(
                {
                  ...recipe,
                  qubits: n,
                  start: "0".repeat(n),
                  operations: [],
                },
                true,
              );
              setSelected(null);
              setPiece(null);
              setPickerOpen(false);
            }}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n} disabled={n > 1 && !multipleQubits}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Initial bits")}
          <span className="flex gap-1">
            {[...recipe.start].map((bit, wire) => (
              <button
                key={wire}
                className="btn-ghost font-mono"
                aria-label={`${t("Initial bits")} q${recipe.qubits - 1 - wire}: ${bit}`}
                onClick={() =>
                  update({
                    ...recipe,
                    start: [...recipe.start]
                      .map((b, i) => (i === wire ? (b === "0" ? "1" : "0") : b))
                      .join(""),
                  })
                }
              >
                {bit}
              </button>
            ))}
          </span>
        </label>
        <label>
          {t("Shots")}
          <select
            className="lab-input"
            value={recipe.shots}
            onChange={(e) =>
              update({ ...recipe, shots: Number(e.target.value) })
            }
          >
            {[1, 100, 256, 1000, 1024].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <p id="lab-qubit-help" className="text-xs text-stage-muted">
        {t(
          multipleQubits
            ? "Your installed equipment supports 1–4 qubits. Changing the qubit count clears the circuit."
            : "For 2–4 qubits, acquire and install a Register kit or Grover algorithm box (Amplitude Amplifier), or a Phase-kickback box (Ghost Key), from Equipment supplies.",
        )}
      </p>
      {!unlocked && (
        <p className="text-accent-amber">
          {t("Acquire and install the required equipment to run this recipe.")}
        </p>
      )}
      <PuzzleDragDrop
        wholeBlockDrag
        controlsRef={puzzleControls}
        labels={{
          ...Object.fromEntries(
            available.map((gate) => [
              gate,
              addComponentLabel(gateLabel(LAB_GATES[gate].title)),
            ]),
          ),
          ...Object.fromEntries(
            recipe.operations.flatMap((o, i) =>
              Array.from({ length: recipe.qubits }, (_, wire) => [
                `op-${i}-${wire}`,
                circuitPositionLabel(gateLabel(label(o)), wire + 1, i + 1),
              ]),
            ),
          ),
        }}
        targets={Object.fromEntries(
          Array.from(
            { length: recipe.qubits * (recipe.operations.length + 1) },
            (_, i) => [
              `${Math.floor(i / (recipe.operations.length + 1))}:${i % (recipe.operations.length + 1)}`,
              circuitPositionLabel(
                t("Circuit slot"),
                Math.floor(i / (recipe.operations.length + 1)) + 1,
                (i % (recipe.operations.length + 1)) + 1,
              ),
            ],
          ),
        )}
        onPlace={place}
        renderPreview={(source) => (
          <span>
            {source.startsWith("op-")
              ? label(recipe.operations[Number(source.slice(3).split("-")[0])])
              : componentLabel(source as LabGate)}
          </span>
        )}
      >
        <div className="lab-workspace-grid">
          <section className="min-w-0 space-y-3">
            <h3 className="text-accent-teal">{t("Circuit builder")}</h3>
            <div className="circuit-workspace has-actions">
              <div ref={circuit} className="lab-circuit-scroll">
                <table className="lab-circuit">
                  <tbody>
                    {Array.from({ length: recipe.qubits }, (_, wire) => (
                      <tr key={wire}>
                        <th className="font-mono">
                          q{recipe.qubits - 1 - wire} |{recipe.start[wire]}⟩
                        </th>
                        {recipe.operations.map((o, i) => {
                          const global = ["ORACLE", "D", "PARITY"].includes(
                              o.gate,
                            ),
                            on = global || o.wire === wire;
                          const context = circuitPositionLabel(
                            gateLabel(label(o)),
                            wire + 1,
                            i + 1,
                          );
                          return (
                            <td key={i}>
                              {on ? (
                                <PuzzleCircuitPiece
                                  id={`op-${i}-${wire}`}
                                  slotId={`${wire}:${i}`}
                                  label={context}
                                  selected={selected === i}
                                  onRemove={() => removeComponent(i)}
                                  removeLabel={circuitActionLabel(
                                    "remove",
                                    context,
                                  )}
                                  onSelect={() =>
                                    piece
                                      ? place(`${wire}:${i}`, piece)
                                      : setSelected(i)
                                  }
                                  actions={
                                    wire === (o.wire ?? 0) ? (
                                      <span
                                        className="lab-component-actions"
                                        role="group"
                                        aria-label={t("Component controls")}
                                      >
                                        <button
                                          type="button"
                                          aria-label={circuitActionLabel(
                                            "left",
                                            context,
                                          )}
                                          title={circuitActionLabel(
                                            "left",
                                            context,
                                          )}
                                          disabled={i === 0}
                                          onClick={() => moveComponent(i, -1)}
                                        >
                                          <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="m10 6-6 6 6 6M4 12h16" />
                                          </svg>
                                        </button>
                                        <button
                                          type="button"
                                          aria-label={circuitActionLabel(
                                            "right",
                                            context,
                                          )}
                                          title={circuitActionLabel(
                                            "right",
                                            context,
                                          )}
                                          disabled={
                                            i === recipe.operations.length - 1
                                          }
                                          onClick={() => moveComponent(i, 1)}
                                        >
                                          <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="m14 6 6 6-6 6M4 12h16" />
                                          </svg>
                                        </button>
                                        <LabComponentSettings
                                          componentLabel={context}
                                          op={o}
                                          qubits={recipe.qubits}
                                          onChange={editOp}
                                        />
                                      </span>
                                    ) : undefined
                                  }
                                >
                                  <span className="font-mono">{label(o)}</span>
                                </PuzzleCircuitPiece>
                              ) : (
                                <PuzzleSlot
                                  className="lab-wire-slot"
                                  id={`${wire}:${i}`}
                                  label={circuitPositionLabel(
                                    o.gate === "CX" && o.control === wire
                                      ? t("CNOT control")
                                      : t("Empty slot"),
                                    wire + 1,
                                    i + 1,
                                  )}
                                  onSelect={() => chooseSlot(`${wire}:${i}`)}
                                >
                                  {o.gate === "CX" && o.control === wire
                                    ? "●"
                                    : "─"}
                                </PuzzleSlot>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          <PuzzleSlot
                            className="lab-wire-slot"
                            id={`${wire}:${recipe.operations.length}`}
                            label={`${t("Add component on wire")} ${wire + 1}`}
                            onSelect={() =>
                              chooseSlot(`${wire}:${recipe.operations.length}`)
                            }
                          >
                            +
                          </PuzzleSlot>
                        </td>
                        <td className="font-mono">M</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CircuitActions
                busy={busy}
                runDisabled={!unlocked}
                shots={recipe.shots}
                onClear={() => {
                  update({ ...recipe, operations: [] }, true);
                }}
                onRun={() => {
                  if (unlocked) onRun();
                }}
              >
                <LabComponentPicker
                  editor={editor}
                  available={available}
                  qubits={recipe.qubits}
                  count={recipe.operations.length}
                  busy={busy}
                />
              </CircuitActions>
            </div>
            <p role="status" className="text-xs text-accent-teal">
              {piece
                ? t(
                    "{component} selected. Tap + on a wire to place it.",
                  ).replace("{component}", componentLabel(piece))
                : t(
                    "Tap + on a wire or use + in the floating toolbar to add a component.",
                  )}
            </p>
            <p className="text-xs text-stage-muted">
              {t(
                "Select a block to show its arrows and settings. Drag it to change qubits; use × to remove it. Delete or Backspace removes a focused block.",
              )}
            </p>
            <p className="text-xs text-stage-muted">
              {t(
                "Run executes this circuit on the selected backend. Editing only updates the ideal reference.",
              )}
            </p>
            <p className="text-xs">
              {recipe.operations.length}/32 {t("components")} ·{" "}
              {t("All wires are measured at the end.")}
            </p>
          </section>
        </div>
      </PuzzleDragDrop>
    </>
  );
}
