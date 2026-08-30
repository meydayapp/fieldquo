// app/components/charts/Sparkline.js
//
// A minimal trend line — no library, because there isn't one in this repo
// (app/components/dashboard/CircularProgress.js is the only precedent, a
// hand-rolled SVG ring). This is the same idea for a short time series: six or
// so points, read at a glance, not a chart you zoom into.
//
// Theme-aware on purpose: every colour is a CSS custom property already
// defined in app/globals.css and used throughout /app, not a literal hex the
// way CircularProgress.js has one. Those tokens carry their own measured
// contrast for both themes (see the comments beside --chart-1..5 there), so
// this file has no contrast maths of its own to get wrong.
"use client";

/**
 * @param {object}   p
 * @param {object[]} p.series        [{ label, value, partial? }] — `partial`
 *                                    (an in-progress period) renders lighter
 *                                    and is excluded from the trend line's own
 *                                    min/max so one unfinished bar can't flatten
 *                                    the rest of the line.
 * @param {number}   [p.width=220]
 * @param {number}   [p.height=48]
 * @param {(n:number)=>string} [p.formatValue]  for the last-point tooltip text
 */
export default function Sparkline({ series, width = 220, height = 48, formatValue }) {
  const points = Array.isArray(series) ? series.filter((p) => p && Number.isFinite(Number(p.value))) : [];

  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ width, height }}
      >
        Not enough periods yet
      </div>
    );
  }

  const complete = points.filter((p) => !p.partial);
  const basis = complete.length ? complete : points;
  const values = basis.map((p) => Number(p.value));
  const min = Math.min(0, ...values);
  const max = Math.max(...values, min + 1);
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const x = (i) => pad + (i / (points.length - 1)) * innerW;
  const y = (v) => pad + innerH - ((v - min) / (max - min)) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(Number(p.value))}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1)} ${pad + innerH} L ${x(0)} ${pad + innerH} Z`;

  const last = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend">
      <path d={areaPath} fill="var(--chart-1)" opacity="0.12" stroke="none" />
      <path d={linePath} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(Number(p.value))}
          r={i === points.length - 1 ? 3 : 2}
          fill={p.partial ? "var(--muted-foreground)" : "var(--chart-1)"}
        />
      ))}
      {formatValue ? (
        <text
          x={x(points.length - 1)}
          y={Math.max(10, y(Number(last.value)) - 8)}
          textAnchor="end"
          fontSize="10"
          fill="var(--foreground)"
          fontWeight="600"
        >
          {formatValue(Number(last.value))}
        </text>
      ) : null}
    </svg>
  );
}
