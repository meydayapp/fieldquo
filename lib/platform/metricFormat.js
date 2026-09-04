// lib/platform/metricFormat.js
//
// How a number is written on FieldQuo's own console, and what is written when
// there isn't one.
//
// ── Absent is not zero ─────────────────────────────────────────────────────
//
// These lived inside app/components/platform/MetricCard.js and read
// `Number(value || 0)`, which turns undefined, null, "" and NaN into a
// confident 0. Zero is finite, so nothing downstream could tell the difference
// afterwards — and on this console every tile answers a question about the
// business, where "we have no MRR" and "MRR didn't load" are opposite answers
// that were rendering as identical pixels.
//
// A real zero still prints $0.00 / 0. Only absence prints UNKNOWN.
//
// Being strict at this layer is safe because the platform routes coalesce
// their aggregates where the meaning is known: Prisma returns
// `_sum.amount === null` for "no payments", and
// app/api/platform/analytics/overview/route.js turns that into 0 at the query.
// So a null arriving here is not an empty table — it is a field that did not
// come back.
//
// ── Why they are here and not in the component ─────────────────────────────
//
// So a check can run them. MetricCard.js contains JSX, which bare node cannot
// parse, so the rule could only ever have been asserted by reading the source
// as text — and a regex looking for `|| 0` proves nothing about what the
// function returns. scripts/check-platform-truth.mjs imports these and calls
// them. MetricCard re-exports both, so every existing call site is unchanged.

/** The glyph for "the number did not arrive". */
export const UNKNOWN = "—";

/**
 * null for anything that is not a real, finite number.
 *
 * Types are checked before Number() rather than after, because Number() is
 * where the fabrication happens: `Number([])` is 0 and `Number([7])` is 7, so
 * an empty array — the shape a route returns when it means "no rows" and the
 * caller reached for the wrong field — used to render as a confident $0.00.
 * `Number({})` is at least NaN. Only a number, or a string that parses as one,
 * counts as a number here.
 */
function finite(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    if (value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ── OPEN, AND DELIBERATELY NOT DECIDED HERE: mixed currencies ─────────────
//
// Every figure this formats is a SUM ACROSS TENANTS, and the tenants are not
// all in one currency. app/api/platform/analytics/overview/route.js adds
// Payment.amount, Quote.total and Invoice.total with a bare Prisma `_sum`, and
// MRR adds Subscription rows whose Plan.currency may be CAD, USD, EUR or GBP.
// The result is printed here as CAD, and on app/platform/TenantBoard.js and
// app/platform/CompanyInsight.js as a bare "$". A euro invoice and a Canadian
// one are being added together and the total wears one symbol.
//
// It is wrong today in the small — the book is mostly CAD — and it gets worse
// with every non-CAD signup, silently, because nothing on the screen says the
// sum is mixed. Somebody has already met this once: the plan mix keys on
// `${plan.name} (${plan.currency})` precisely so two ladders do not merge.
//
// Which way to fix it is a PRODUCT decision about what FieldQuo's own board
// number means, not an implementation detail, so it is written down rather
// than picked:
//
//   A. Convert to one reporting currency at a published rate. One number, and
//      it is the number an investor asks for. Costs: an FX source and a rate
//      DATE on every historical figure, or the dashboard silently rewrites
//      last quarter every time the rate moves. lib/fx exists but nothing on
//      this console reads it.
//   B. Group by currency: "CA$1,200 · US$400 · €150". Nothing is invented and
//      no rate is needed. Costs: there is no single MRR any more — every tile,
//      every sparkline and every CSV export grows a dimension, and "are we up
//      on last month" stops being answerable at a glance.
//   C. Show the CAD subtotal and name the rest: "CA$1,200 (+ 3 companies
//      billed in other currencies, not included)". Cheapest, honest, and it
//      makes the gap visible instead of hiding it inside the total. Costs: the
//      headline number understates the business, permanently and by design.
//
// A fourth option — keep summing and add a "mixed currencies" footnote — is
// the one to avoid: it labels the number as unreliable while still printing it
// as the answer, which is how a wrong figure gets quoted with a clear
// conscience. Whatever is chosen, the money already goes through this one
// function and TenantBoard's local `money`, so it is a small change once the
// question is answered.
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
 * The same "absent is not zero" rule, for a caller that formats its own money.
 *
 * money() above is fixed to CAD because every tile it feeds is FieldQuo's own
 * subscription revenue. /platform/sales/performance formats the COMMISSION
 * ledger's cents and so cannot use it — and, formatting its own, it reproduced
 * exactly the bug this module exists for: `Number(cents) || 0`, printing a
 * confident $0.00 for every field that failed to arrive, on the four tiles that
 * say what FieldQuo owes its own reps.
 *
 * Exported rather than duplicated so a check can execute it: the page is JSX
 * and bare node cannot parse it, which is the same reason money() and count()
 * left MetricCard.js.
 *
 * @returns {number|null} the number, or null for anything that is not one
 */
export function centsOrNull(value) {
  return finite(value);
}
