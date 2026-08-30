// app/components/charts/BarComparison.js
//
// Horizontal bars, one per row, scaled to a shared maximum — for comparing a
// handful of named things (aging buckets, trades, estimators) rather than
// plotting a series over time. Deliberately not a bar CHART library: this repo
// has none (see the note in Sparkline.js), and a comparison of five to eight
// rows doesn't need one.
"use client";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * @param {object}   p
 * @param {object[]} p.rows   [{ key, label, value, negative?, tone? }]
 *   `negative` draws the bar in the destructive token instead of chart-1 — for
 *   a KPI where "more" is bad (e.g. overdue receivables). `tone` overrides the
 *   colour entirely with a raw CSS value, for a caller that already knows which
 *   row is the outlier (estimateAccuracy's worst trade, say).
 * @param {(n:number)=>string} p.formatValue
 * @param {number}   [p.max]   shared scale; defaults to the largest |value|
 */
export default function BarComparison({ rows, formatValue, max }) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (list.length === 0) {
    return <p className="text-xs text-muted-foreground">Nothing to compare yet.</p>;
  }
  const scale = max ?? Math.max(1, ...list.map((r) => Math.abs(Number(r.value) || 0)));

  return (
    <div className="space-y-2">
      {list.map((row) => {
        const value = Number(row.value) || 0;
        const pct = clamp((Math.abs(value) / scale) * 100, 0, 100);
        const color = row.tone || (row.negative ? "var(--destructive)" : "var(--chart-1)");
        return (
          <div key={row.key ?? row.label} className="flex items-center gap-3 text-xs">
            <div className="w-28 shrink-0 truncate text-muted-foreground" title={row.label}>
              {row.label}
            </div>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: color, transition: "width 0.3s ease" }}
              />
            </div>
            <div className="w-20 shrink-0 text-right font-medium text-foreground">
              {formatValue ? formatValue(value) : value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
