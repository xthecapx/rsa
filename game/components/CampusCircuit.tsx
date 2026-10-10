"use client";
import { useEffect, useState } from "react";
import { campusRequest, type CampusGate } from "@/game/campusExperiment";
import { PuzzleDragDrop, PuzzlePiece, PuzzleSlot } from "./PuzzleDragDrop";
import { t } from "@/i18n";
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
  const labels = { X: "X", H: "H", Z: "Z" };
  const targets = Object.fromEntries(
    Array.from(
      { length: Math.min(6, Math.max(2, gates.length + 1)) },
      (_, i) => [String(i), `${t("Circuit slot")} ${i + 1}`],
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
            label={g}
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
        <div className="mt-3 flex flex-wrap gap-2">
          {gates.map((g, i) => (
            <button
              key={i}
              className="btn-ghost text-xs"
              disabled={i === 0}
              aria-label={t("Move gate {number} left").replace(
                "{number}",
                String(i + 1),
              )}
              onClick={() => {
                const next = [...gates];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
            >
              ← {g} {i + 1}
            </button>
          ))}
        </div>
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
        <div className="campus-tape">
          <span className="font-mono">q₀ |0⟩</span>
          {gates.map((label, i) => (
            <span className="campus-gate-slot" key={i}>
              {label}
            </span>
          ))}
          <span className="campus-gate-slot">M</span>
        </div>
      )}
      {(request.mode === "dephasing" || (correlated && request.pair === "envelopes")) && (
        <p className="text-xs text-stage-muted">
          {t(
            "E(d) couples an unobserved helper. It is an environmental channel, not a unitary gate on the data alone.",
          )}
        </p>
      )}
    </div>
  );
}
