// app/components/platform/Sparkline.js
//
// Inline SVG rather than a charting library. These are 30-point series with
// no axes, legend or interaction — pulling in Recharts for that would add far
// more to the bundle than it earns, and the platform console is internal.
"use client";

export default function Sparkline({
  points = [],
  height = 48,
  stroke = "#bd9d60",
  fill = "rgba(189,157,96,0.12)",
}) {
  const values = points.map((p) => Number(p ?? 0));
  if (values.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ height }}
      >
        Not enough data yet
      </div>
    );
  }

  const width = 300;
  const max = Math.max(...values, 1);
  // Baseline at zero rather than at the minimum. Starting the axis at the
  // lowest value exaggerates small movements into dramatic swings — fine for
  // a stock ticker, misleading for "did we sign up more companies this week".
  const min = 0;
  const range = Math.max(1, max - min);

  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 2 - ((v - min) / range) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const line = `M ${coords.join(" L ")}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
    >
      <path d={area} fill={fill} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
