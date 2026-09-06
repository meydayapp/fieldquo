// lib/analytics/dayRange.js
//
// The two instants that bound a calendar-day range in a Prisma date filter.
//
// ══ Why this exists ═════════════════════════════════════════════════════════
//
// A report takes `?from=2026-03-01&to=2026-03-31`. `new Date("2026-03-31")` is
// 31 March at 00:00:00.000 UTC — the first instant of the day, not the last —
// so `lte: new Date(to)` admits nothing from the 31st except a row stamped at
// exactly midnight. Two routes (expenses, marketing spend) filtered that way
// and silently dropped the last day of every range a user asked for, while
// six other analytics routes each carried their own private copy of
// `${to}T23:59:59.999Z`. Same bug class as the spend table rendering a day
// early: a calendar day and an instant are different things, and the moment
// one is used as the other is where the day falls off.
//
// Rules, stated once:
//   * A bare day ("YYYY-MM-DD") is read as a UTC calendar day — the same axis
//     lib/analytics/periodPresets.js builds presets on and the accounting
//     export documents ("grouped by UTC calendar day, not the company's local
//     timezone"). Company.timezone is not consulted here, on purpose: nothing
//     in analytics reads it yet, and a helper that half-did would make two
//     reports disagree by a few hours at the month boundary.
//   * A full instant (anything with a "T") is taken as given, so a caller that
//     already computed a precise bound is not rounded to a day it did not ask
//     for.
//   * Anything unparseable returns null, and a null bound must not become a
//     filter — the callers spread `...(range && {date: range})` so a bad `to`
//     drops the filter loudly in the response rather than matching nothing.

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function instant(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value ?? "").trim();
  if (!s) return null;
  // Only an ISO instant is read as an instant. V8 parses "2026-3-1" or
  // "March 1 2026" as LOCAL midnight, which on a laptop in Toronto is 05:00Z
  // and on Vercel is 00:00Z — the same string filtering two different days
  // depending on where the code runs. Refusing it is the only reading that is
  // the same everywhere.
  if (!s.includes("T")) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** First instant of the day (UTC) for "YYYY-MM-DD"; the instant itself otherwise. */
export function dayStartUtc(value) {
  const s = typeof value === "string" ? value.trim() : value;
  if (typeof s === "string" && DAY_RE.test(s)) return instant(`${s}T00:00:00.000Z`);
  return instant(s);
}

/** Last instant of the day (UTC) for "YYYY-MM-DD"; the instant itself otherwise. */
export function dayEndUtc(value) {
  const s = typeof value === "string" ? value.trim() : value;
  if (typeof s === "string" && DAY_RE.test(s)) return instant(`${s}T23:59:59.999Z`);
  return instant(s);
}

/**
 * `{ gte, lte }` for a Prisma DateTime filter, or null when either end is
 * missing or unreadable — never a half-open filter built from one good end
 * and one guess.
 */
export function dayRangeUtc(from, to) {
  const gte = dayStartUtc(from);
  const lte = dayEndUtc(to);
  if (!gte || !lte) return null;
  if (gte.getTime() > lte.getTime()) return null;
  return { gte, lte };
}
