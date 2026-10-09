import type { ReactNode } from "react";
export function HistogramBars({
  rows,
  shots,
  label,
}: {
  rows: { key: string; label: ReactNode; count: number }[];
  shots: number;
  label?: string;
}) {
  return (
    <div
      className="qubit-odds"
      style={{ gridTemplateColumns: "auto minmax(32px, 1fr) auto" }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {rows.map((row) => (
        <div key={row.key} className="contents">
          <span>{row.label}</span>
          <span className="qubit-bar">
            <span
              style={{ width: `${shots ? (100 * row.count) / shots : 0}%` }}
            />
          </span>
          <span>
            {row.count} · {shots ? ((100 * row.count) / shots).toFixed(1) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}
