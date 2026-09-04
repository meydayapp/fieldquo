// app/components/platform/MetricCard.js
"use client";

// The glyph for "the number did not arrive". Exported so a check can assert on
// it and so callers can compare against it rather than re-typing an em dash.
export const UNKNOWN = "—";

/**
 * Absent is not zero.
 *
 * These two functions used to read `Number(value || 0)`, which turns
 * undefined, null, "" and NaN into a confident 0 — and 0 is finite, so nothing
 * downstream could tell the difference afterwards. On FieldQuo's own console
 * that is the worst possible failure mode: every tile here answers a question
 * about the business, and "we have no MRR" and "MRR didn't load" are opposite
 * answers that were rendering as the same pixels.
 *
 * A real zero still prints as $0.00 / 0. Only absence prints as "—".
 *
 * Safe to be strict at this layer because the platform routes coalesce their
 * aggregates where the meaning is known: Prisma returns `_sum.amount === null`
 * for "no payments", and app/api/platform/analytics/overview/route.js turns
 * that into 0 at the query, not here. So a null reaching this function is not
 * an empty table — it is a field that did not come back.
 */
function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function money(value, { compact = false } = {}) {
  const n = finite(value);
  if (n === null) return UNKNOWN;
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: compact && n >= 10000 ? 0 : 2,
    minimumFractionDigits: compact && n >= 10000 ? 0 : 2,
  });
}

export function count(value) {
  const n = finite(value);
  if (n === null) return UNKNOWN;
  return n.toLocaleString("en-CA");
}

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
