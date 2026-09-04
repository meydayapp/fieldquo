// app/components/charts/FlowChart.js
//
// Two lines over the days in a period: money in, money out. The gap-free
// third primitive alongside Sparkline (one series) and BarComparison (a
// handful of named things) — this repo has no charting library (see
// Sparkline.js's header), and a daily line for a period of a month or a
// quarter doesn't need one.
//
// Theme-aware like its siblings: income draws in --chart-1 (the same token
// Sparkline uses for "money coming in"), expenses in --destructive — the same
// choice GanttStrip makes for "the thing you don't want more of".
//
// `income` and `expenses` on each point are EITHER real numbers on every
// point in the series or null on every point — lib/analytics/moneyFlow.js
// only nulls out a whole side when the company has never recorded it at all
// (see that file's header); its own gap-filling guarantees there is no
// single missing day inside an otherwise-real series. So this file only has
// to ask "is this WHOLE side present", never point by point.
//
// ── Days that have not happened are not drawn ──────────────────────────────
//
// "This month" and "This quarter" run to the LAST day of the period, so on
// the 3rd of September twenty-seven of the thirty points are the future. They
// arrive as a real 0 — the gap-filling above cannot tell "nothing came in"
// from "this day hasn't happened" — and drawn, they were a confident flat
// line to the right saying the company stops earning tomorrow. moneyFlow.js
// now flags them (`future: true`) and they are dropped here rather than
// plotted at zero.
"use client";

/**
 * @param {object}   p
 * @param {object[]} p.series        [{ date, income, expenses, future? }] — "YYYY-MM-DD"
 * @param {number}   [p.width=640]
 * @param {number}   [p.height=180]
 * @param {string}   [p.emptyLabel]  what to say when there is nothing to draw
 */
export default function FlowChart({ series, width = 640, height = 180, emptyLabel }) {
  const all = Array.isArray(series) ? series : [];
  // An older payload with no `future` key draws in full, exactly as before.
  const points = all.filter((p) => p?.future !== true);
  const hasIncome = points.length > 0 && points.every((p) => p?.income !== null && p?.income !== undefined);
  const hasExpenses = points.length > 0 && points.every((p) => p?.expenses !== null && p?.expenses !== undefined);

  if (points.length < 2 || (!hasIncome && !hasExpenses)) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ width, height }}
      >
        {emptyLabel || "Not enough days to chart yet"}
      </div>
    );
  }

  const values = [
    0,
    ...(hasIncome ? points.map((p) => Number(p.income)) : []),
    ...(hasExpenses ? points.map((p) => Number(p.expenses)) : []),
  ];
  // Both series are sums of non-negative amounts (a Payment or an Expense is
  // never recorded negative in this schema), so the axis floor is a fixed 0
  // rather than a computed min — a chart that let a quiet day push the
  // baseline above zero would visually flatter every other day on it.
  const min = 0;
  const max = Math.max(1, ...values);
  const pad = 6;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const x = (i) => pad + (i / (points.length - 1)) * innerW;
  const y = (v) => pad + innerH - ((v - min) / (max - min)) * innerH;

  const lineFor = (key) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(Number(p[key]))}`).join(" ");
  const areaFor = (key) =>
    `${lineFor(key)} L ${x(points.length - 1)} ${pad + innerH} L ${x(0)} ${pad + innerH} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Income and expenses by day"
    >
      {hasIncome && <path d={areaFor("income")} fill="var(--chart-1)" opacity="0.08" stroke="none" />}
      {hasExpenses && (
        <path
          d={lineFor("expenses")}
          fill="none"
          stroke="var(--destructive)"
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.9"
        />
      )}
      {hasIncome && (
        <path
          d={lineFor("income")}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
