import {
  WIRE_PIECES,
  type RegOp,
  type RegPiece,
  type WirePiece,
} from "@/game/register";

export function opLabel(op: RegOp): string {
  if (op === "H") return "H box · every qubit";
  if (op === "D") return "Diffuser · mirror";
  if (op.startsWith("oracle:")) return `Oracle · marks |${op.slice(7)}⟩`;
  if (op.startsWith("ghost:")) return "Oracle · the ghost";
  if (op.startsWith("CX")) return `CNOT · control on line ${op.slice(2)}`;
  if (op.startsWith("h")) return `H on line ${op.slice(1)}`;
  return `${op[0]} on line ${op.slice(1)}`;
}
export function opGlyph(op: RegOp): string {
  if (op === "H") return "H";
  if (op === "D") return "D";
  if (op.startsWith("oracle:") || op.startsWith("ghost:")) return "O";
  if (op.startsWith("CX")) return `CX${op.slice(2)}`;
  if (op.startsWith("h")) return `H${op.slice(1)}`;
  return op;
}
const isOracle = (op: RegOp) =>
  op.startsWith("oracle:") || op.startsWith("ghost:");
/** Short name printed inside a box that covers every wire, so "O" always reads as the Oracle. */
export const spanName = (op: RegOp) =>
  op === "H" ? "H box" : op === "D" ? "Diffuser" : isOracle(op) ? "Oracle" : "";
/** How a piece reads in the step-by-step trace: whole words for the Oracle, the Diffuser and CNOT. */
export const traceName = (op: RegOp) =>
  op === "D"
    ? "Diffuser"
    : isOracle(op)
      ? "Oracle"
      : op.startsWith("CX")
        ? `CNOT${op.slice(2)}`
        : opGlyph(op);
export const opClass = (op: RegOp) =>
  op === "H" || op.startsWith("h")
    ? "hadamard"
    : op.startsWith("X")
      ? "pauli-x"
      : op.startsWith("Z")
        ? "pauli-z"
        : op.startsWith("CX")
          ? "reg-control"
          : op === "D"
            ? "reg-diffuser"
            : "reg-oracle";

export const isWirePiece = (piece: RegPiece): piece is WirePiece =>
  (WIRE_PIECES as string[]).includes(piece);
export const WIRE_LABEL: Record<WirePiece, string> = {
  X: "X gate · flip",
  Z: "Z gate · sign",
  h: "H gate · one wire",
  CX: "CNOT · flips the helper",
};
export const WIRE_GLYPH: Record<WirePiece, string> = {
  X: "X",
  Z: "Z",
  h: "H",
  CX: "●",
};
export const WIRE_CLASS: Record<WirePiece, string> = {
  X: "pauli-x",
  Z: "pauli-z",
  h: "hadamard",
  CX: "reg-control",
};
export const pieceLabel = (piece: RegPiece) =>
  isWirePiece(piece) ? WIRE_LABEL[piece] : opLabel(piece);
export const pieceGlyph = (piece: RegPiece) =>
  isWirePiece(piece) ? WIRE_GLYPH[piece] : opGlyph(piece);
export const pieceClass = (piece: RegPiece) =>
  isWirePiece(piece) ? WIRE_CLASS[piece] : opClass(piece);
export const SUBSCRIPTS = "₀₁₂₃₄";
