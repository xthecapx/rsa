import type { RegOp, WirePiece } from "./register";

/** A column of the circuit: one box across every wire, or single-wire pieces. */
export interface RegisterColumn {
  span: RegOp | null;
  wire: (WirePiece | null)[];
}
export const emptyColumns = (slots: number, qubits: number): RegisterColumn[] =>
  Array.from({ length: slots }, () => ({
    span: null,
    wire: Array(qubits).fill(null),
  }));
const WIRE_OP: Record<WirePiece, string> = { X: "X", Z: "Z", h: "h", CX: "CX" };
export const columnOps = (column: RegisterColumn): RegOp[] =>
  column.span
    ? [column.span]
    : column.wire.flatMap((piece, i) =>
        piece ? [`${WIRE_OP[piece]}${i + 1}` as RegOp] : [],
      );
