// app/components/charts/GanttStrip.js
//
// One row per job: the window it was SCHEDULED for, and where it actually
// finished. Job/JobVisit/Shift all carry real dates, so this is the one chart
// in this trio built from a genuine schedule rather than a generic "bar chart"
// — and it exists to make on-time completion legible at a glance instead of as
// a single percentage: a company reading "68% on time" cannot see whether the
// misses are one job three weeks late or eight jobs one day late, and this can.
//
// Dates in, throughout, are "YYYY-MM-DD" strings (dayKey's own format) — never
// a Date object with a timezone to disagree about.
"use client";

function parseDay(key) {
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

/**
 * @param {object}   p
 * @param {object[]} p.rows  [{ id, label, scheduledStart, scheduledEnd, completedAt, onTime }]
 *   all four dates are "YYYY-MM-DD"; a row missing any of them is skipped —
 *   this draws what it can place, never a guessed bar.
 * @param {number}   [p.width=520]
 * @param {number}   [p.rowHeight=22]
 */
export default function GanttStrip({ rows, width = 520, rowHeight = 22 }) {
  const list = (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      ...r,
      startTs: parseDay(r?.scheduledStart),
      endTs: parseDay(r?.scheduledEnd),
      completedTs: parseDay(r?.completedAt),
    }))
    .filter((r) => r.startTs !== null && r.endTs !== null && r.completedTs !== null);

  if (list.length === 0) {
    return <p className="text-xs text-muted-foreground">No completed jobs with a schedule to plot yet.</p>;
  }

  const allTs = list.flatMap((r) => [r.startTs, r.endTs, r.completedTs]);
  const minTs = Math.min(...allTs);
  const maxTs = Math.max(...allTs, minTs + 86400000);
  const labelW = 140;
  const trackW = width - labelW;
  const DAY = 86400000;
  const xOf = (ts) => labelW + ((ts - minTs) / (maxTs - minTs)) * trackW;

  const height = list.length * rowHeight + 8;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Schedule vs completion">
      {list.map((row, i) => {
        const y = i * rowHeight + rowHeight / 2 + 4;
        const barX = xOf(row.startTs);
        const barW = Math.max(2, xOf(row.endTs + DAY) - barX);
        const markX = xOf(row.completedTs + DAY / 2);
        const overrun = row.completedTs > row.endTs;
        return (
          <g key={row.id ?? i}>
            <text x={0} y={y + 3} fontSize="10" fill="var(--muted-foreground)">
              {(row.label || "Job").length > 18 ? `${row.label.slice(0, 17)}…` : row.label || "Job"}
            </text>
            {/* The planned window */}
            <rect x={barX} y={y - 4} width={barW} height={8} rx={4} fill="var(--border)" />
            {/* The overrun, if the job finished after its own scheduled window */}
            {overrun ? (
              <rect
                x={xOf(row.endTs + DAY)}
                y={y - 4}
                width={Math.max(2, xOf(row.completedTs + DAY) - xOf(row.endTs + DAY))}
                height={8}
                rx={4}
                fill="var(--destructive)"
                opacity="0.55"
              />
            ) : null}
            {/* The completion marker */}
            <circle cx={markX} cy={y} r={4} fill={row.onTime ? "var(--chart-1)" : "var(--destructive)"} />
          </g>
        );
      })}
    </svg>
  );
}
