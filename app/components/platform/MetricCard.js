// app/components/platform/MetricCard.js
"use client";

// The formatting rules live in lib/platform/metricFormat.js so a check can
// execute them — this file contains JSX, which bare node cannot parse, and a
// regex hunting for `|| 0` proves nothing about what a function returns.
// Re-exported here because seven call sites already import them from this path.
import { UNKNOWN } from "@/lib/platform/metricFormat";
export { money, count, UNKNOWN } from "@/lib/platform/metricFormat";

/**
 * `note` exists because several of these numbers are easy to misread —
 * "total billed" is money that flowed through FieldQuo to tenants, not
 * FieldQuo's revenue. A dashboard that lets those blur together produces
 * confident wrong answers in investor conversations.
 */
export default function MetricCard({ label, value, note, tone = "default" }) {
  // A tile whose number never arrived says so in FORM as well as glyph. An
  // em dash in the same heavy black as a real figure still reads, at a glance
  // across four tiles, as a number — and the glance is all these tiles get.
  const unknown = value === UNKNOWN;

  const toneClass = unknown
    ? "text-muted-foreground"
    : tone === "positive"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-300"
        : "text-foreground";

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div>
      {/* Replaces the note rather than sitting beside it: a note that explains
          a number is misleading under a number that isn't there. */}
      {unknown ? (
        <div className="mt-1 text-xs text-muted-foreground">
          Didn&apos;t load — not zero.
        </div>
      ) : (
        note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>
      )}
    </div>
  );
}
