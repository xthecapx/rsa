"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface HistogramProps {
  counts: Record<string, number>;
  title?: string;
  expected?: Record<string, number>;
}

export default function Histogram({
  counts,
  title = "Measurement counts",
  expected,
}: HistogramProps) {
  const data = Object.entries(counts)
    .map(([bitstring, count]) => ({
      bitstring,
      count,
      expected: expected?.[bitstring],
    }))
    .sort((a, b) => a.bitstring.localeCompare(b.bitstring));

  if (!data.length) {
    return (
      <div className="panel flex h-48 items-center justify-center text-sm text-stage-muted">
        No counts yet — run simulator or load IBM batch.
      </div>
    );
  }

  return (
    <div className="panel p-4">
      <h4 className="mb-3 font-display text-xs uppercase tracking-wider text-stage-muted">
        {title}
      </h4>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e4450" />
            <XAxis
              dataKey="bitstring"
              tick={{ fill: "#7a9aa6", fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fill: "#7a9aa6", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "#122a33",
                border: "1px solid #1e4450",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#f5a623" }}
            />
            <Bar dataKey="count" fill="#f5a623" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
