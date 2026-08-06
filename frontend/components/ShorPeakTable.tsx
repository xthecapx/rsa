"use client";

interface PeakRow {
  bitstring: string;
  count: number;
  phase?: number;
  fraction?: string;
  order_guess?: number;
  order_matches_true?: boolean;
  factoring?: {
    factors?: number[] | null;
    nontrivial?: boolean;
  };
}

interface ShorPeakTableProps {
  outcomes: PeakRow[];
  trueOrder?: number | null;
  highlightBitstring?: string | null;
}

/** Links histogram bins to phase → candidate r → factors. */
export default function ShorPeakTable({
  outcomes,
  trueOrder,
  highlightBitstring,
}: ShorPeakTableProps) {
  const rows = [...outcomes]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (!rows.length) return null;

  return (
    <div className="panel overflow-x-auto px-3 py-2">
      <h4 className="mb-1.5 font-display text-[10px] uppercase tracking-wider text-stage-muted">
        Top bins → phase → candidate r (each row is one histogram peak)
      </h4>
      <table className="w-full text-left font-mono text-[11px]">
        <thead>
          <tr className="border-b border-stage-border text-[10px] uppercase text-stage-muted">
            <th className="py-1 pr-2">bitstring</th>
            <th className="py-1 pr-2">shots</th>
            <th className="py-1 pr-2">phase</th>
            <th className="py-1 pr-2">≈ s/r</th>
            <th className="py-1 pr-2">r?</th>
            <th className="py-1">factors</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const fac = row.factoring?.factors;
            const good =
              row.order_matches_true ||
              (trueOrder != null && row.order_guess === trueOrder);
            const hi = highlightBitstring === row.bitstring;
            return (
              <tr
                key={row.bitstring}
                className={
                  hi
                    ? "bg-accent-amber/10 text-accent-amber"
                    : good
                      ? "text-accent-teal"
                      : "text-stage-muted"
                }
              >
                <td className="py-1 pr-2">{row.bitstring}</td>
                <td className="py-1 pr-2">{row.count}</td>
                <td className="py-1 pr-2">
                  {row.phase != null ? row.phase.toFixed(3) : "—"}
                </td>
                <td className="py-1 pr-2">{row.fraction ?? "—"}</td>
                <td className="py-1 pr-2">
                  {row.order_guess ?? "—"}
                  {good ? " ✓" : ""}
                </td>
                <td className="py-1">
                  {fac?.length ? `[${fac.join(", ")}]` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
