"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLab } from "@/game/lab";
import { useMedals } from "@/game/medals";
import { LAB_ITEMS, itemAvailable } from "@/content/lab";
import {
  algorithmRecipe,
  labTrace,
  starterRecipe,
  validRecipe,
  type LabRecipe,
  type LabOp,
  type LabGate,
} from "@/game/labCircuit";
import { runLab, type LabResult } from "@/lib/lab";
import { runtimeInfo, serviceFetch } from "@/lib/transport";
import { useSimulator } from "@/game/simulator";
import { useGame } from "@/game/state";
import { t, useLocale } from "@/i18n";
import { LaptopShell } from "./LaptopShell";
import { CircuitHistogram } from "./CircuitHistogram";
import { CircuitActions } from "./CircuitActions";
import {
  PuzzleDragDrop,
  PuzzlePiece,
  PuzzleSlot,
  PuzzleCircuitPiece,
  type PuzzleControls,
} from "./PuzzleDragDrop";
interface Experiment {
  recipe: LabRecipe;
  result: LabResult;
  date: string;
}
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const label = (op: LabOp | undefined) =>
  !op
    ? ""
    : op.gate === "RY"
      ? `Ry(${(op.angle! / Math.PI).toFixed(2)}π)`
      : op.gate === "ORACLE"
        ? `O(${op.bits})`
        : op.gate === "PARITY"
          ? `P(${op.bits})`
          : op.gate;
const componentLabel = (gate: LabGate) =>
  gate === "ORACLE"
    ? t("Oracle")
    : gate === "PARITY"
      ? t("Parity oracle")
      : gate === "D"
        ? t("Diffuser")
        : gate === "RY"
          ? t("Y rotation module")
          : gate;
export function LabLaptop({
  open,
  onClose,
  onBusyChange,
  controls,
}: {
  open: boolean;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  controls: ReactNode;
}) {
  useLocale((s) => s.locale);
  const lab = useLab(),
    recipe = lab.recipe,
    earned = useMedals((s) => s.earned),
    preference = useSimulator((s) => s.choice);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<number | null>(null),
    [piece, setPiece] = useState<LabGate | null>(null);
  const [latest, setLatest] = useState<Experiment | null>(null),
    [previous, setPrevious] = useState<Experiment | null>(null),
    [step, setStep] = useState<number | null>(null);
  const [bits, setBits] = useState("11"),
    [rounds, setRounds] = useState(1),
    [name, setName] = useState(""),
    [notice, setNotice] = useState(""),
    [crypto, setCrypto] = useState<string | null>(null),
    [period, setPeriod] = useState<Record<string, unknown> | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const pickerId = useId();
  const puzzleControls = useRef<PuzzleControls>(null);
  const pickerTools = useRef<HTMLDivElement>(null);
  const pickerButton = useRef<HTMLButtonElement>(null);
  const [pickerPosition, setPickerPosition] = useState({
    below: false,
    height: 240,
  });
  useLayoutEffect(() => {
    if (!pickerOpen) return;
    function positionPicker() {
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
    }
    positionPicker();
    window.addEventListener("scroll", positionPicker, true);
    window.addEventListener("resize", positionPicker);
    return () => {
      window.removeEventListener("scroll", positionPicker, true);
      window.removeEventListener("resize", positionPicker);
    };
  }, [pickerOpen]);
  useEffect(() => {
    if (!pickerOpen) return;
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !pickerTools.current?.contains(event.target)
      )
        setPickerOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [pickerOpen]);
  const results = useRef<HTMLElement>(null);
  const periodResults = useRef<HTMLElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error)
      feedback.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
  }, [error]);
  useEffect(() => {
    if (latest || period)
      (period ? periodResults.current : results.current)?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [latest, period]);
  const alive = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const installed = (id: string) =>
    lab.installed.includes(id) &&
    itemAvailable(LAB_ITEMS.find((i) => i.id === id)!, earned);
  const allowed = (gate: LabGate) =>
    (gate === "H" &&
      (installed("H") || installed("grover") || installed("kickback"))) ||
    installed(gate) ||
    (gate === "X" && installed("kickback")) ||
    (gate === "CX" && installed("kickback")) ||
    ((gate === "D" || gate === "ORACLE") && installed("grover")) ||
    (gate === "PARITY" && installed("kickback"));
  const available = (
    ["H", "X", "Z", "RY", "CX", "ORACLE", "D", "PARITY"] as LabGate[]
  ).filter(allowed);
  const multipleQubits =
    installed("register") || installed("grover") || installed("kickback");
  const starter =
    recipe.qubits === 1 &&
    recipe.operations.length <= 1 &&
    recipe.operations.every((op) => op.gate === "H" && op.wire === 0);
  const valid = validRecipe(recipe),
    unlocked =
      valid &&
      (starter || recipe.operations.every((op) => allowed(op.gate))) &&
      (recipe.qubits === 1 || multipleQubits);
  const states = useMemo(
      () => (valid ? labTrace(recipe) : []),
      [JSON.stringify(recipe), valid],
    ),
    index = Math.min(
      step ?? recipe.operations.length,
      recipe.operations.length,
    ),
    amplitudes = states[index] ?? [],
    op = selected === null ? null : recipe.operations[selected];
  const selectedBackend =
    runtimeInfo.target === "qollab"
      ? runtimeInfo.backend
      : preference === "noise"
        ? "Aer teaching noise"
        : "AerSimulator";
  const same =
    !!latest &&
    JSON.stringify(latest.recipe) === JSON.stringify(recipe) &&
    latest.result.backend === selectedBackend;
  function resetInteraction() {
    puzzleControls.current?.resetInteraction();
    setSelected(null);
    setPiece(null);
    setPendingSlot(null);
    setPickerOpen(false);
  }
  function update(next: LabRecipe, reset = false) {
    if (inFlight.current || !validRecipe(next)) return;
    if (reset) resetInteraction();
    useLab.setState({ recipe: clone(next) });
    setError("");
    setStep(null);
    setPeriod(null);
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
  function editOp(change: Partial<LabOp>) {
    if (selected === null) return;
    update({
      ...recipe,
      operations: recipe.operations.map((o, i) =>
        i === selected ? { ...o, ...change } : o,
      ),
    });
  }
  function place(target: string, source: string) {
    if (inFlight.current) return;
    const [wire, position] = target.split(":").map(Number);
    let destination = position;
    const ops = clone(recipe.operations);
    let next: LabOp;
    if (source.startsWith("op-")) {
      const from = Number(source.slice(3).split("-")[0]);
      next = ops.splice(from, 1)[0];
      if (!next) return;
      if (from < position) destination--;
    } else {
      const gate = source as LabGate;
      if (!allowed(gate)) return;
      next = {
        gate,
        wire,
        ...(gate === "RY" ? { angle: Math.PI / 2 } : {}),
        ...(gate === "CX" ? { control: (wire + 1) % recipe.qubits } : {}),
        ...(gate === "ORACLE" ? { bits: "1".repeat(recipe.qubits) } : {}),
        ...(gate === "PARITY" ? { bits: "1".repeat(recipe.qubits - 1) } : {}),
      };
    }
    if (["H", "X", "Z", "RY", "CX"].includes(next.gate)) {
      next.wire = wire;
      if (next.control === wire) next.control = (wire + 1) % recipe.qubits;
    }
    ops.splice(Math.min(destination, ops.length), 0, next);
    if (!validRecipe({ ...recipe, operations: ops })) return;
    update({ ...recipe, operations: ops });
    setPiece(null);
    setPickerOpen(false);
    setPendingSlot(null);
    setSelected(Math.min(destination, ops.length - 1));
  }
  function chooseSlot(target: string) {
    if (piece) place(target, piece);
    else {
      setPendingSlot(target);
      setPickerOpen(true);
    }
  }
  async function execute(kind: "circuit" | "period" | "crypto" = "circuit") {
    if (inFlight.current) return;
    const snapshot = clone(recipe);
    resetInteraction();
    inFlight.current = true;
    setBusy(true);
    onBusyChange(true);
    useGame.getState().changeOperations(1);
    setError("");
    try {
      if (kind === "crypto") {
        const res = await serviceFetch("/api/rsa/keygen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ N: 15 }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(
            data.detail ??
              "The experiment could not finish. Check the backend and try again.",
          );
        if (alive.current) setCrypto(JSON.stringify(data, null, 2));
      } else if (kind === "period") {
        const res = await serviceFetch("/api/shor/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            N: 15,
            a: 7,
            num_control: 4,
            shots: snapshot.shots,
          }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(
            data.detail ??
              "The experiment could not finish. Check the backend and try again.",
          );
        if (alive.current) setPeriod(data);
      } else {
        const result = await runLab(snapshot);
        if (alive.current) {
          setPrevious(latest);
          setLatest({
            recipe: snapshot,
            result,
            date: new Date().toLocaleTimeString(),
          });
          setPeriod(null);
        }
      }
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The experiment could not finish. Check the backend and try again.",
        );
    } finally {
      inFlight.current = false;
      useGame.getState().changeOperations(-1);
      if (alive.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  return (
    <LaptopShell
      open={open}
      title="Quantum laboratory"
      onClose={() => {
        resetInteraction();
        onClose();
      }}
      closeDisabled={busy}
      restartControl={controls}
      selectedBackend
      footer={
        <p>
          {t(
            "Explore, change a component, and run again. Recipes are saved; no experiment runs automatically.",
          )}
        </p>
      }
    >
      <div className="lab-experiment space-y-4">
        {busy && (
          <p role="status" className="text-accent-teal">
            {t("Waiting for backend measurements…")}
          </p>
        )}
        {error && (
          <p ref={feedback} role="alert" className="text-accent-amber">
            {t(error)}
          </p>
        )}
        {runtimeInfo.remoteFinalOnly && (
          <p className="panel p-3 text-accent-amber text-sm">
            {t(
              "This lab uses your selected remote backend. Run consumes the one job available for this game session. Keep your checkpoint code and export your lab before restarting for another run or final challenge.",
            )}
          </p>
        )}
        <fieldset disabled={busy} className="min-w-0 space-y-3">
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
                          .map((b, i) =>
                            i === wire ? (b === "0" ? "1" : "0") : b,
                          )
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
              {t(
                "Acquire and install the required equipment to run this recipe.",
              )}
            </p>
          )}
          <PuzzleDragDrop
            controlsRef={puzzleControls}
            labels={{
              ...Object.fromEntries(
                available.map((gate) => [gate, componentLabel(gate)]),
              ),
              ...Object.fromEntries(
                recipe.operations.flatMap((o, i) =>
                  Array.from({ length: recipe.qubits }, (_, wire) => [
                    `op-${i}-${wire}`,
                    label(o),
                  ]),
                ),
              ),
            }}
            targets={Object.fromEntries(
              Array.from(
                { length: recipe.qubits * (recipe.operations.length + 1) },
                (_, i) => [
                  `${Math.floor(i / (recipe.operations.length + 1))}:${i % (recipe.operations.length + 1)}`,
                  `${Math.floor(i / (recipe.operations.length + 1))}:${i % (recipe.operations.length + 1)}`,
                ],
              ),
            )}
            onPlace={place}
            renderPreview={(source) => (
              <span>
                {source.startsWith("op-")
                  ? label(
                      recipe.operations[Number(source.slice(3).split("-")[0])],
                    )
                  : componentLabel(source as LabGate)}
              </span>
            )}
          >
            <div className="lab-workspace-grid">
              <section className="min-w-0 space-y-3">
                <h3 className="text-accent-teal">{t("Circuit builder")}</h3>
                <div className="circuit-workspace has-actions">
                  <div className="lab-circuit-scroll">
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
                              return (
                                <td key={i}>
                                  {on ? (
                                    <PuzzleCircuitPiece
                                      id={`op-${i}-${wire}`}
                                      slotId={`${wire}:${i}`}
                                      label={`${t("Circuit slot")} ${wire + 1}, ${i + 1}: ${label(o)}`}
                                      selected={selected === i}
                                      onRemove={() => removeComponent(i)}
                                      removeLabel={t(
                                        "Remove {component} at step {step}",
                                      )
                                        .replace("{component}", label(o))
                                        .replace("{step}", String(i + 1))}
                                      onSelect={() =>
                                        piece
                                          ? place(`${wire}:${i}`, piece)
                                          : setSelected(i)
                                      }
                                    >
                                      <span className="font-mono">
                                        {label(o)}
                                      </span>
                                    </PuzzleCircuitPiece>
                                  ) : (
                                    <PuzzleSlot
                                      className="lab-wire-slot"
                                      id={`${wire}:${i}`}
                                      label={`${t("Circuit slot")} ${wire + 1}, ${i + 1}`}
                                      onSelect={() =>
                                        chooseSlot(`${wire}:${i}`)
                                      }
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
                                  chooseSlot(
                                    `${wire}:${recipe.operations.length}`,
                                  )
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
                      if (unlocked) void execute();
                    }}
                  >
                    <div
                      ref={pickerTools}
                      className="lab-component-tools"
                      onKeyDownCapture={(event) => {
                        if (
                          event.key === "Escape" &&
                          pickerOpen &&
                          !event.currentTarget.closest(
                            '[data-puzzle-dragging="true"]',
                          )
                        ) {
                          event.preventDefault();
                          event.stopPropagation();
                          setPickerOpen(false);
                          pickerButton.current?.focus();
                        }
                      }}
                    >
                      <button
                        type="button"
                        ref={pickerButton}
                        className="circuit-icon-action lab-add-component"
                        aria-label={t("Add component")}
                        title={t("Add component")}
                        aria-expanded={pickerOpen}
                        aria-controls={pickerId}
                        disabled={busy || recipe.operations.length >= 32}
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
                          <span
                            className="lab-selected-gate"
                            aria-hidden="true"
                          >
                            {piece === "RY" ? "Ry" : componentLabel(piece)}
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
                            .filter(
                              (g) =>
                                recipe.qubits > 1 ||
                                !["CX", "PARITY"].includes(g),
                            )
                            .map((gate) => (
                              <PuzzlePiece
                                key={gate}
                                id={gate}
                                label={componentLabel(gate)}
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
                                  {gate === "RY"
                                    ? "Ry(θ)"
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
                    "Select a placed component to edit it; use × to remove it. Delete or Backspace removes a focused component.",
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
              <section className="panel p-3 space-y-3">
                <h3 className="text-accent-teal">{t("Component inspector")}</h3>
                {op ? (
                  <>
                    <p className="font-mono">{label(op)}</p>
                    {["H", "X", "Z", "RY", "CX"].includes(op.gate) && (
                      <label>
                        {t("Target wire")}
                        <select
                          className="lab-input"
                          value={op.wire}
                          onChange={(e) => {
                            const wire = Number(e.target.value);
                            editOp({
                              wire,
                              ...(op.gate === "CX" && op.control === wire
                                ? { control: (wire + 1) % recipe.qubits }
                                : {}),
                            });
                          }}
                        >
                          {Array.from({ length: recipe.qubits }, (_, i) => (
                            <option key={i} value={i}>
                              q{recipe.qubits - 1 - i}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {op.gate === "CX" && (
                      <label>
                        {t("Control wire")}
                        <select
                          className="lab-input"
                          value={op.control}
                          onChange={(e) =>
                            editOp({ control: Number(e.target.value) })
                          }
                        >
                          {Array.from({ length: recipe.qubits }, (_, i) =>
                            i !== op.wire ? (
                              <option key={i} value={i}>
                                q{recipe.qubits - 1 - i}
                              </option>
                            ) : null,
                          )}
                        </select>
                      </label>
                    )}
                    {op.gate === "RY" && (
                      <>
                        <label>
                          {t("Y rotation angle (radians)")}
                          <input
                            aria-label={t("Y rotation slider")}
                            type="range"
                            min={-2 * Math.PI}
                            max={2 * Math.PI}
                            step={Math.PI / 180}
                            value={op.angle}
                            onChange={(e) =>
                              editOp({ angle: Number(e.target.value) })
                            }
                          />
                          <input
                            className="lab-input"
                            type="number"
                            min={-2 * Math.PI}
                            max={2 * Math.PI}
                            aria-label={t("Y rotation angle (radians)")}
                            step="0.01"
                            key={`${selected}:${op.angle}`}
                            defaultValue={op.angle}
                            onBlur={(e) => {
                              const angle = Number(e.target.value);
                              if (
                                e.target.value &&
                                Number.isFinite(angle) &&
                                Math.abs(angle) <= 2 * Math.PI
                              )
                                editOp({ angle });
                              else e.target.value = String(op.angle);
                            }}
                            onKeyDownCapture={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                          />
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {[
                            0,
                            Math.PI / 4,
                            Math.PI / 2,
                            Math.PI,
                            Math.PI * 2,
                          ].map((a) => (
                            <button
                              key={a}
                              className="btn-ghost text-xs"
                              onClick={() => editOp({ angle: a })}
                            >
                              {a === 0 ? "0" : `${a / Math.PI}π`}
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
                          maxLength={
                            op.gate === "PARITY"
                              ? recipe.qubits - 1
                              : recipe.qubits
                          }
                          onChange={(e) => editOp({ bits: e.target.value })}
                        />
                      </label>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-ghost"
                        disabled={selected === 0}
                        onClick={() => {
                          const operations = clone(recipe.operations);
                          [operations[selected! - 1], operations[selected!]] = [
                            operations[selected!],
                            operations[selected! - 1],
                          ];
                          update({ ...recipe, operations });
                          setSelected(selected! - 1);
                        }}
                      >
                        {t("Move left")}
                      </button>
                      <button
                        className="btn-ghost"
                        disabled={selected === recipe.operations.length - 1}
                        onClick={() => {
                          const operations = clone(recipe.operations);
                          [operations[selected! + 1], operations[selected!]] = [
                            operations[selected!],
                            operations[selected! + 1],
                          ];
                          update({ ...recipe, operations });
                          setSelected(selected! + 1);
                        }}
                      >
                        {t("Move right")}
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() =>
                          selected !== null && removeComponent(selected)
                        }
                      >
                        {t("Remove component")}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs">
                    {t("Select a placed component to inspect or change it.")}
                  </p>
                )}
              </section>
            </div>
          </PuzzleDragDrop>
          <details className="panel p-3 lab-recipes">
            <summary>{t("Starter and algorithm recipes")}</summary>
            <div className="space-y-3 pt-3">
              <p className="text-xs text-stage-muted">
                {t(
                  "Recipes are optional. Use + in the circuit toolbar to add your own components.",
                )}
              </p>
              <button
                className="btn-ghost"
                onClick={() => {
                  update({ ...starterRecipe(), shots: recipe.shots }, true);
                  setSelected(null);
                }}
              >
                {t("Load starter experiment")}
              </button>
              {(installed("grover") || installed("kickback")) && (
                <>
                  <h4>{t("Installed algorithm boxes")}</h4>
                  <label>
                    {t("Marked value / parity mask")}
                    <input
                      className="lab-input"
                      maxLength={4}
                      value={bits}
                      onChange={(e) =>
                        setBits(e.target.value.replace(/[^01]/g, ""))
                      }
                    />
                  </label>
                  <label>
                    {t("Grover rounds")}
                    <input
                      className="lab-input"
                      type="number"
                      min={0}
                      max={5}
                      value={rounds}
                      onChange={(e) =>
                        setRounds(
                          Math.max(0, Math.min(5, Number(e.target.value))),
                        )
                      }
                    />
                  </label>
                  <button
                    className="btn-ghost w-full"
                    disabled={!installed("grover") || bits.length < 1}
                    onClick={() => {
                      update(
                        algorithmRecipe("grover", bits, rounds, recipe.shots),
                        true,
                      );
                      setSelected(null);
                    }}
                  >
                    {t("Load Grover recipe")}
                  </button>
                  <button
                    className="btn-ghost w-full"
                    disabled={
                      !installed("kickback") ||
                      bits.length < 1 ||
                      bits.length > 3
                    }
                    onClick={() => {
                      update(
                        algorithmRecipe("kickback", bits, 1, recipe.shots),
                        true,
                      );
                      setSelected(null);
                    }}
                  >
                    {t("Load phase-kickback recipe")}
                  </button>
                  <p className="text-xs text-stage-muted">
                    {t(
                      "Grover uses oracle → diffuser rounds. Phase kickback prepares the helper in |−⟩, applies the parity oracle, then reads the data wires with H.",
                    )}
                  </p>
                </>
              )}
            </div>
          </details>
          <section className="panel p-3 space-y-3">
            <h3 className="text-accent-teal">{t("Ideal state explorer")}</h3>
            <label>
              {t("Circuit step")} {index}/{recipe.operations.length}
              <input
                className="w-full"
                type="range"
                min={0}
                max={recipe.operations.length}
                value={index}
                onChange={(e) => setStep(Number(e.target.value))}
              />
            </label>
            {recipe.qubits === 1 &&
            lab.owned.includes("bloch") &&
            itemAvailable(LAB_ITEMS.find((i) => i.id === "bloch")!, earned) ? (
              <div className="flex flex-wrap gap-4 items-center">
                <svg
                  viewBox="0 0 220 180"
                  className="w-56"
                  role="img"
                  aria-label={t("Ideal Bloch sphere")}
                >
                  <circle
                    cx="100"
                    cy="90"
                    r="65"
                    fill="#123941"
                    stroke="#90e0cd"
                  />
                  <ellipse
                    cx="100"
                    cy="90"
                    rx="65"
                    ry="20"
                    fill="none"
                    stroke="#63858a"
                  />
                  <path
                    d="M25 90h150 M100 15v150 M60 125l80 -70"
                    stroke="#63858a"
                  />
                  <text x="178" y="94" fill="#fff">
                    X
                  </text>
                  <text x="141" y="51" fill="#fff">
                    Y
                  </text>
                  <text x="106" y="15" fill="#fff">
                    Z
                  </text>
                  <line
                    x1="100"
                    y1="90"
                    x2={100 + 65 * 2 * amplitudes[0] * amplitudes[1]}
                    y2={90 - 65 * (amplitudes[0] ** 2 - amplitudes[1] ** 2)}
                    stroke="#ffb13d"
                    strokeWidth="4"
                  />
                  <circle
                    cx={100 + 65 * 2 * amplitudes[0] * amplitudes[1]}
                    cy={90 - 65 * (amplitudes[0] ** 2 - amplitudes[1] ** 2)}
                    r="5"
                    fill="#ffb13d"
                  />
                </svg>
                <p className="text-sm">
                  {t(
                    "Ideal Bloch reference. X/H/Z/Ry from real starting states stay in the X–Z plane; measurement counts do not reconstruct this sphere.",
                  )}
                </p>
              </div>
            ) : (
              <p className="text-xs">
                {t(
                  "Amplitude reference for the whole register. One Bloch sphere cannot describe an entangled register.",
                )}
              </p>
            )}
            <div className="lab-amplitudes">
              {amplitudes.map((a, i) => (
                <div key={i}>
                  <span className="font-mono">
                    |{i.toString(2).padStart(recipe.qubits, "0")}⟩
                  </span>
                  <meter min={0} max={1} value={a * a} />
                  <span className="font-mono">
                    {a.toFixed(3)} · {(a * a * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </section>
          <div className="flex flex-wrap gap-2">
            <label>
              {t("Recipe name")}
              <input
                className="lab-input"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              className="btn-ghost"
              disabled={
                !name.trim() ||
                !valid ||
                (lab.recipes.length >= 12 &&
                  !lab.recipes.some((r) => r.name === name.trim()))
              }
              onClick={() => {
                useLab.setState({
                  recipes: [
                    ...lab.recipes.filter((r) => r.name !== name.trim()),
                    { name: name.trim(), recipe: clone(recipe) },
                  ],
                });
                setNotice(t("Recipe saved."));
              }}
            >
              {t("Save recipe")}
            </button>
            {lab.recipes.map((r) => (
              <button
                key={r.name}
                className="btn-ghost"
                onClick={() => {
                  update(r.recipe, true);
                  setSelected(null);
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
          {installed("crypto") && (
            <button
              className="btn-ghost"
              onClick={() => void execute("crypto")}
            >
              {t("Explore RSA keys (N=15, classical)")}
            </button>
          )}
          {installed("period") && (
            <section className="panel p-3 space-y-2">
              <h3>{t("Period explorer · N=15, a=7")}</h3>
              <p className="text-sm">
                {t(
                  "Prepare control qubits → controlled modular multiplication → inverse QFT → measure. This runs a separate Shor circuit, not the circuit editor above.",
                )}
              </p>
              <button
                className="btn-primary"
                onClick={() => void execute("period")}
              >
                {t("Run period experiment")}
              </button>
            </section>
          )}
        </fieldset>
        {notice && <p role="status">{notice}</p>}
        {latest && (
          <section ref={results} className="space-y-2">
            <h3>
              {t(
                same
                  ? "Current circuit results"
                  : "Previous run — the circuit or selected backend has changed",
              )}
            </h3>
            <p className="text-xs text-stage-muted">
              {latest.date} · {latest.recipe.start} ·{" "}
              {latest.recipe.operations.map(label).join(" → ") || "M"}
            </p>
            <CircuitHistogram {...latest.result} />
            <details>
              <summary>{t("Executed circuit")}</summary>
              <pre className="overflow-auto text-xs">
                {latest.result.circuit_text}
              </pre>
            </details>
          </section>
        )}
        {previous && (
          <details>
            <summary>{t("Compare with previous run")}</summary>
            <p>
              {previous.result.backend} ·{" "}
              {previous.recipe.operations.map(label).join(" → ")}
            </p>
            <CircuitHistogram {...previous.result} />
          </details>
        )}
        {crypto && (
          <pre className="panel p-3 overflow-auto text-sm">{crypto}</pre>
        )}
        {period && (
          <section ref={periodResults} className="space-y-2">
            <h3>{t("Period experiment results")}</h3>
            <CircuitHistogram
              counts={period.counts as Record<string, number>}
              backend={period.backend as string}
              kind={period.kind as "ideal" | "noise" | "hardware"}
              source={period.source as "simulator" | "hardware"}
            />
            <pre className="panel p-3 overflow-auto text-xs">
              {JSON.stringify(period.shor_result, null, 2)}
            </pre>
            <details>
              <summary>{t("Executed circuit")}</summary>
              <pre className="overflow-auto text-xs">
                {String(period.circuit_text)}
              </pre>
            </details>
          </section>
        )}
      </div>
    </LaptopShell>
  );
}
