"use client";
import type { ComponentProps } from "react";
import { PuzzleSlot } from "./PuzzleDragDrop";
import { columnOps, type RegisterColumn } from "@/game/registerColumns";
import type { RegisterStep } from "@/content/knowledge";
import { wireStates, startRegister, traceReg, WIRE_KET } from "@/game/register";
import { t } from "@/i18n";
import {
  opLabel,
  opGlyph,
  opClass,
  spanName,
  WIRE_LABEL,
  WIRE_GLYPH,
  WIRE_CLASS,
  SUBSCRIPTS,
} from "./registerPresentation";

/** Read-only previews keep the same wire geometry without mounting drop targets. */
function RegisterCell({
  editable,
  ...props
}: ComponentProps<typeof PuzzleSlot> & { editable: boolean }) {
  return editable ? (
    <PuzzleSlot {...props} />
  ) : (
    <span className={props.className} aria-label={props.label}>
      {props.children}
    </span>
  );
}

/** Editor and execution preview share the same wire order and box footprints. */
export function RegisterCircuit({
  step,
  columns,
  onPlace,
  showMeasurement = false,
}: {
  step: RegisterStep;
  columns: RegisterColumn[];
  onPlace?: (column: number, wire: number) => void;
  showMeasurement?: boolean;
}) {
  const editable = !!onPlace;
  const fixed = step.fixed ?? [];
  const wires = Array.from({ length: step.qubits }, (_, q) => q);
  const helper = step.helper ? step.qubits - 1 : -1;
  const hasHelper = helper >= 0;
  const startKets =
    step.start === "even"
      ? wires.map(() => "|+⟩")
      : [...step.start].map((bit) => `|${bit}⟩`);
  const outputs =
    step.helper && !showMeasurement
      ? wireStates(
          traceReg(startRegister(step.qubits, step.start), [
            ...columns.flatMap(columnOps),
            ...fixed,
          ]).at(-1)!,
        )
      : null;
  const wireName = (q: number) =>
    q === helper ? t("helper") : `q${SUBSCRIPTS[q + 1]}`;
  const cellLabel = (c: number, q: number) =>
    `${t("Wire")} ${wireName(q)} · ${t("slot")} ${c + 1}`;
  return (
    <div
      className="qiskit-circuit"
      role="group"
      aria-label={t(
        editable ? "Register line editor" : "Register circuit preview",
      )}
    >
      <div
        className="reg-grid"
        style={{
          gridTemplateColumns: `${hasHelper ? 96 : 68}px repeat(${step.slots + fixed.length + (showMeasurement ? 1 : 0)}, minmax(58px, 1fr))${outputs ? " 52px" : ""}`,
          gridTemplateRows: `repeat(${step.qubits}, 64px)`,
        }}
      >
        {wires.map((q) => (
          <span
            key={`label-${q}`}
            className={`reg-label ${q === helper ? "reg-helper-label" : ""}`}
            style={{ gridRow: q + 1, gridColumn: 1 }}
          >
            {wireName(q)} <small>{startKets[q]}</small>
          </span>
        ))}
        {wires.map((q) => (
          <span
            key={`wire-${q}`}
            className="reg-wire"
            style={{
              gridRow: q + 1,
              gridColumn: `2 / ${step.slots + fixed.length + 2 + (showMeasurement ? 1 : 0)}`,
            }}
            aria-hidden="true"
          />
        ))}
        {columns.map((column, c) => {
          if (column.span)
            return (
              <div
                key={`span-${c}`}
                className="reg-square"
                style={{
                  gridColumn: c + 2,
                  gridRow: `1 / span ${step.qubits}`,
                }}
              >
                {/* A box across every wire fills the whole column. */}
                <RegisterCell
                  editable={editable}
                  id={`cell-${c}-0`}
                  className="reg-cell filled"
                  onSelect={() => onPlace?.(c, 0)}
                  label={`${t("slot")} ${c + 1}: ${t(opLabel(column.span))}`}
                  description={t(
                    "Place the selected component here, or activate with nothing selected to remove this component.",
                  )}
                >
                  <span
                    className={`qiskit-gate reg-span ${opClass(column.span)}`}
                  >
                    {opGlyph(column.span)}
                    <small className="reg-span-name">
                      {t(spanName(column.span))}
                      {column.span.startsWith("oracle:") && (
                        <>
                          <br />|{column.span.slice(7)}⟩
                        </>
                      )}
                      {column.span.startsWith("ghost:") && (
                        <>
                          <br />
                          {t("the ghost")}
                        </>
                      )}
                    </small>
                  </span>
                </RegisterCell>
              </div>
            );
          const controls = column.wire.flatMap((piece, q) =>
            piece === "CX" ? [q] : [],
          );
          return [
            ...(controls.length
              ? [
                  <span
                    key={`link-${c}`}
                    className="reg-link"
                    style={{
                      gridColumn: c + 2,
                      gridRow: `${controls[0] + 1} / ${helper + 2}`,
                    }}
                    aria-hidden="true"
                  />,
                ]
              : []),
            ...wires.map((q) => {
              const piece = column.wire[q];
              const target = q === helper && controls.length > 0;
              return (
                <div
                  key={`cell-${c}-${q}`}
                  className="reg-square"
                  style={{ gridColumn: c + 2, gridRow: q + 1 }}
                >
                  <RegisterCell
                    editable={editable}
                    id={`cell-${c}-${q}`}
                    className={`reg-cell ${piece || target ? "filled" : ""}`}
                    onSelect={() => onPlace?.(c, q)}
                    label={`${cellLabel(c, q)}: ${target ? t("CNOT target · flips the helper") : piece ? t(WIRE_LABEL[piece]) : t("Empty")}`}
                    description={
                      piece || target
                        ? t(
                            "Place the selected component here, or activate with nothing selected to remove this component.",
                          )
                        : undefined
                    }
                  >
                    {target ? (
                      <span className="reg-target" aria-hidden="true">
                        ⊕
                      </span>
                    ) : piece ? (
                      <span className={`qiskit-gate ${WIRE_CLASS[piece]}`}>
                        {WIRE_GLYPH[piece]}
                      </span>
                    ) : (
                      <span className="qiskit-empty">{c + 1}</span>
                    )}
                  </RegisterCell>
                </div>
              );
            }),
          ];
        })}
        {fixed.map((op, i) => (
          <div
            key={`fixed-${i}`}
            className="reg-square"
            style={{
              gridColumn: step.slots + i + 2,
              gridRow: `1 / span ${step.qubits}`,
            }}
            role="img"
            aria-label={`${t("Fixed on the bench")}: ${t(opLabel(op))}`}
          >
            <span className={`qiskit-gate reg-span reg-fixed ${opClass(op)}`}>
              {opGlyph(op)}
              <small className="reg-span-name">
                {t(spanName(op))}
                {op.startsWith("ghost:") && (
                  <>
                    <br />
                    {t("the ghost")}
                  </>
                )}
              </small>
            </span>
          </div>
        ))}
        {showMeasurement &&
          wires.map((q) => (
            <span
              key={`measure-${q}`}
              className="reg-square"
              style={{
                gridColumn: step.slots + fixed.length + 2,
                gridRow: q + 1,
              }}
              aria-label={t("Measurement after the gates")}
            >
              <span className="qiskit-gate measure">M</span>
            </span>
          ))}
        {outputs &&
          wires.map((q) => (
            <span
              key={`out-${q}`}
              className="reg-out"
              style={{
                gridRow: q + 1,
                gridColumn:
                  step.slots + fixed.length + 2 + (showMeasurement ? 1 : 0),
              }}
            >
              {WIRE_KET[outputs[q]]}
            </span>
          ))}
      </div>
    </div>
  );
}
