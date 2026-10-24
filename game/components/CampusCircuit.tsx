"use client";
import { useEffect, useState } from "react";
import { campusRequest, type CampusGate } from "@/game/campusExperiment";
import { PuzzleDragDrop, PuzzlePiece, PuzzleSlot } from "./PuzzleDragDrop";
import { t } from "@/i18n";
import {
  addComponentLabel,
  circuitPositionLabel,
  circuitActionLabel,
  gateLabel,
} from "@/game/circuitLabels";
/** One circuit tape with the same drag/tap/keyboard interaction as story benches. */
export function CampusTape({
  gates,
  onChange,
}: {
  gates: CampusGate[];
  onChange: (gates: CampusGate[]) => void;
}) {
  const [selected, setSelected] = useState<CampusGate | null>(null);
  useEffect(() => {
    if (!gates.length) setSelected(null);
  }, [gates]);
  const labels = Object.fromEntries(
    ["X", "H", "Z"].map((g) => [g, addComponentLabel(gateLabel(g))]),
  );
  const targets = Object.fromEntries(
    Array.from(
      { length: Math.min(6, Math.max(2, gates.length + 1)) },
      (_, i) => [
        String(i),
        circuitPositionLabel(
          gates[i] ? gateLabel(gates[i]) : t("Empty slot"),
          1,
          i + 1,
        ),
      ],
    ),
  );
  function place(slot: string, gate: string) {
    if (!["X", "H", "Z"].includes(gate)) return;
    const next = [...gates];
    const at = Math.min(Number(slot), next.length);
    if (at === next.length) next.push(gate as CampusGate);
    else next[at] = gate as CampusGate;
    onChange(next.slice(0, 6));
    setSelected(null);
  }
  return (
    <PuzzleDragDrop
      labels={labels}
      targets={targets}
      onPlace={place}
      wholeBlockDrag
      renderPreview={(g) => <span className="campus-gate">{g}</span>}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {(["X", "H", "Z"] as const).map((g) => (
          <PuzzlePiece
            key={g}
            id={g}
            label={labels[g]}
            selected={selected === g}
            onSelect={() => setSelected(selected === g ? null : g)}
          >
            <span className="campus-gate">{g}</span>
          </PuzzlePiece>
        ))}
      </div>
      <p className="mb-3 text-sm text-stage-muted">
        {t(
          "Select or drag a gate into a slot. Tap an occupied slot with no gate selected to remove it.",
        )}
      </p>
      <div className="campus-tape">
        <span className="font-mono">q₀ |0⟩</span>
        {Object.keys(targets).map((i) => (
          <PuzzleSlot
            key={i}
            id={i}
            label={targets[i]}
            description={
              gates[Number(i)]
                ? t(
                    "Place the selected component here, or activate with nothing selected to remove this component.",
                  )
                : undefined
            }
            className="campus-gate-slot"
            onSelect={() =>
              selected
                ? place(i, selected)
                : onChange(gates.filter((_, j) => j !== Number(i)))
            }
          >
            {gates[Number(i)] ?? "+"}
          </PuzzleSlot>
        ))}
        <span className="campus-gate-slot">M</span>
      </div>
      {gates.length > 1 && (
        <fieldset className="campus-sequence-order">
          <legend className="mb-2 text-sm text-stage-muted">
            {t("Gate order")}
          </legend>
          <div className="campus-sequence-cards">
            {gates.map((gate, index) => (
              <div
                key={index}
                className="campus-sequence-card"
                role="group"
                aria-label={t("Gate {number}: {gate}")
                  .replace("{number}", String(index + 1))
                  .replace("{gate}", gate)}
              >
                <span className="text-xs text-stage-muted">{index + 1}</span>
                <span className="font-mono">{gate}</span>
                <div>
                  {([-1, 1] as const).map((offset) => {
                    const label = circuitActionLabel(
                      offset === -1 ? "left" : "right",
                      circuitPositionLabel(gateLabel(gate), 1, index + 1),
                    );
                    return (
                      <button
                        type="button"
                        key={offset}
                        aria-label={label}
                        title={label}
                        disabled={
                          index + offset < 0 || index + offset >= gates.length
                        }
                        onClick={() => {
                          const next = [...gates];
                          [next[index], next[index + offset]] = [
                            next[index + offset],
                            next[index],
                          ];
                          onChange(next);
                        }}
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
                          <path
                            d={
                              offset === -1 ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"
                            }
                          />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      )}
    </PuzzleDragDrop>
  );
}

/** Read-only specification: helpers are summarized as channels, data wires stay distinct. */
export function CampusCircuit({
  request,
}: {
  request: ReturnType<typeof campusRequest>;
}) {
  const correlated = request.mode === "correlation";
  const columns: { cells: string[]; connected?: boolean }[] = correlated
    ? request.pair === "independent"
      ? [{ cells: ["H", "H"] }]
      : [
          { cells: ["H", "—"] },
          { cells: ["●", "⊕"], connected: true },
          ...(request.pair === "envelopes" ? [{ cells: ["E(1)", "—"] }] : []),
        ]
    : [];
  if (correlated && request.basis === "X") columns.push({ cells: ["H", "H"] });
  const gates =
    request.mode === "circuit"
      ? request.recipe.operations.map((op) =>
          op.gate === "ROTATION"
            ? `R${op.axis}(${Number(((op.angle! * 180) / Math.PI).toFixed(1))}°)`
            : op.gate,
        )
      : request.mode === "dephasing"
        ? ["H", "E(d)", ...(request.basis === "X" ? ["H"] : [])]
        : [];
  return (
    <div className="space-y-3">
      <h4 className="text-accent-teal">{t("Circuit builder")}</h4>
      {correlated ? (
        <div
          className="campus-register"
          role="img"
          aria-label={t(
            request.pair === "independent"
              ? "Two independent data wires. H prepares each wire; M measures each output bit."
              : "Two data wires. H prepares the top wire; the connected dot and target apply CNOT. M measures each output bit.",
          )}
        >
          <div className="campus-register-column font-mono">
            <span>q₀ |0⟩</span>
            <span>q₁ |0⟩</span>
          </div>
          {columns.map((column, i) => (
            <div
              className={`campus-register-column ${column.connected ? "connected" : ""}`}
              key={i}
            >
              {column.cells.map((cell, wire) => (
                <span className="campus-gate-slot" key={wire}>
                  {cell}
                </span>
              ))}
            </div>
          ))}
          <div className="campus-register-column">
            <span className="campus-gate-slot">M</span>
            <span className="campus-gate-slot">M</span>
          </div>
        </div>
      ) : (
        <div className="campus-tape campus-tape-readonly">
          <span className="font-mono">q₀ |0⟩</span>
          {gates.map((label, i) => (
            <span className="campus-gate-slot" key={i}>
              {label}
            </span>
          ))}
          <span className="campus-gate-slot">M</span>
        </div>
      )}
      {(request.mode === "dephasing" ||
        (correlated && request.pair === "envelopes")) && (
        <p className="text-xs text-stage-muted">
          {t(
            "E(d) couples an unobserved helper. It is an environmental channel, not a unitary gate on the data alone.",
          )}
        </p>
      )}
    </div>
  );
}
