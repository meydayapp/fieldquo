// lib/quotes/validUntil.js
//
// The expiry date on a quote, and the 30-day suggestion the builder opens with.
//
// ── Is pre-filling this "padding absent data with defaults"? ────────────────
//
// AGENTS.md forbids that, and the rule is worth taking seriously here, so:
// what it forbids is INVENTING a statement nobody made and then publishing it
// — a half-filled opening-hours array becoming a confident Mon–Fri on Google.
// The tell is that the person never saw the invented value and never had the
// chance to disagree with it.
//
// This is the other case. The date is rendered into a visible, editable field
// at the top of the money card, before anything is saved, with the wording
// saying it is 30 days from today and can be changed or cleared. Nothing is
// stored until the estimator presses Save on a form they are looking at. A
// pre-filled form field the user reads and confirms is a suggestion; the
// forbidden thing is a value written on their behalf that they never see.
//
// The alternative — an empty date box — is what shipped, and its result was
// that every quote in the product had no expiry, which is why quoteReview's
// `no_expiry` check fired on 100% of quotes and therefore told nobody
// anything. A "safe" default of null was not neutral: it silently chose the
// worse answer for every user.
//
// Clearing the box is a real choice and is honoured: it saves null, the quote
// never expires, and the review flags it. That is the escape hatch that makes
// the default a suggestion rather than a decision made for them.

/** Two to four weeks is the trade norm; 30 days is the round number in it. */
export const DEFAULT_VALID_DAYS = 30;

const pad = (n) => String(n).padStart(2, "0");

/**
 * `YYYY-MM-DD`, ready for an <input type="date">.
 *
 * Built from LOCAL calendar components rather than toISOString(). An estimator
 * in Toronto quoting at 8pm has already crossed into tomorrow in UTC, so
 * `new Date().toISOString().slice(0,10)` would silently hand them a date one
 * day further out than the label above the field claims.
 *
 * The value goes back as a plain date string, which the API turns into UTC
 * midnight — the storage convention every client-facing date formatter in
 * lib/i18n/documentLabels.js already reads back with timeZone: "UTC".
 */
export function toDateInputValue(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Today + DEFAULT_VALID_DAYS as a date-input value.
 *
 * `from` is injectable so the check script can assert month and year rollover
 * without waiting for December.
 */
export function defaultValidUntil(from = new Date(), days = DEFAULT_VALID_DAYS) {
  const base = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(base.getTime())) return "";
  // Day arithmetic through the Date constructor, not by adding milliseconds:
  // a DST change makes some days 23 or 25 hours long, and 30 * 86_400_000 lands
  // on the wrong calendar day twice a year.
  const d = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + days,
  );
  return toDateInputValue(d);
}
