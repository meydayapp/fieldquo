// lib/quotes/listRanking.js
//
// The order the quotes list puts its rows in, and the two dates each row is
// allowed to claim.
//
// ── What was wrong ─────────────────────────────────────────────────────────
//
// The list was a flat `createdAt desc` dump with no date on any row and four
// unclickable tiles above it. The tile that mattered most — the count of
// quotes sitting at `sent` with no answer — was the follow-up queue, and there
// was no way to see the quotes it counted. A quote sent twelve days ago and
// one sent thirty-one looked identical, and the second one expires tomorrow.
//
// GET /api/quotes is a `findMany` with `include` and no `select`, so every
// scalar already ships: createdAt, sentAt, validUntil, acceptedAt. Nothing
// below adds a field, a query or a round trip. It reads what was already on
// the wire.
//
// ── Pure, so the ordering can be executed rather than eyeballed ────────────
//
// Every row and the clock are passed in. scripts/check-quote-list.mjs drives
// this against quotes with no sentAt, no validUntil, an unparseable date and
// an empty list — the cases a rendered screen is worst at showing you.
//
// ── Calendar days, borrowed and not re-derived ─────────────────────────────
//
// `calendarDaysBetween` comes from lib/invoices/lifecycle.js, which argues the
// case at length: a due date is a DAY and not a moment, so an invoice due today
// is not overdue at 4pm. A quote's expiry is the same kind of value — the
// estimator picked a calendar day out of a <input type="date"> — so it gets the
// same arithmetic. lib/analytics/receivables.js already imports it across the
// same boundary for the same reason. A third implementation of "how many days
// between" is the duplication AGENTS.md warns rots, and the copy that rots is
// always the remote one.
import { calendarDaysBetween } from "@/lib/invoices/lifecycle";

/**
 * How close to expiry a sent quote has to be before the row shouts.
 *
 * This is emphasis, not a business rule: nothing is sent, written or decided
 * off it, and the sentence beside it always names the actual date, so a reader
 * who disagrees with the threshold can see what it was computed from. It is
 * deliberately NOT the follow-up automation's delay (FollowUpRule, default 3
 * days after send) — that one fires an email, is configured per company, and
 * borrowing it here would make a display choice look like the automation's
 * state.
 */
export const QUOTE_EXPIRY_SOON_DAYS = 3;

const asDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * The age of a quote in whole calendar days, and WHICH column it came from.
 *
 * The `from` half is the point. `sentAt` is written only after Resend accepts
 * the message (see the Quote schema's own comment), so a quote whose status was
 * flipped to `sent` by hand — a price agreed on the phone, an imported
 * document — has status `sent` and `sentAt` null. Falling back to createdAt
 * there and rendering a bare "12 days ago" beside a "Sent" badge would be the
 * screen inventing a send date. So a sent quote is aged from sentAt or not
 * aged at all, and the caller can tell the difference.
 *
 * @returns {{days: number|null, from: "sentAt"|"createdAt"|null}}
 */
export function quoteAgeDays(quote, now = new Date()) {
  const sent = quote?.status === "sent";
  const column = sent ? "sentAt" : "createdAt";
  const at = asDate(quote?.[column]);
  if (!at) return { days: null, from: null };
  const days = calendarDaysBetween(at, now);
  // A date in the future is not an age. Clock skew and a hand-typed row both
  // produce one, and "-2 days ago" is worse than saying nothing.
  if (days === null || days < 0) return { days: null, from: null };
  return { days, from: column };
}

/**
 * What a quote's own expiry date says about it today.
 *
 * `null` when the quote has no validUntil — which is a real and common state
 * (the builder lets the box be cleared, and clearing it means the quote never
 * expires). Absence is reported as absence; it never becomes a soft "expires
 * soon", and it never becomes a zero.
 *
 * @returns {{date: *, daysLeft: number, expired: boolean, soon: boolean}|null}
 */
export function quoteExpiry(quote, now = new Date()) {
  const until = asDate(quote?.validUntil);
  if (!until) return null;
  const daysLeft = calendarDaysBetween(now, until);
  if (daysLeft === null) return null;
  return {
    date: quote.validUntil,
    daysLeft,
    expired: daysLeft < 0,
    // Inclusive of today (daysLeft 0), because "expires today" is the most
    // urgent version of this, not a boundary case to round away.
    soon: daysLeft >= 0 && daysLeft <= QUOTE_EXPIRY_SOON_DAYS,
  };
}

/** True when this row has earned the accent bar: sent, and running out of time. */
export function quoteNeedsChasing(quote, now = new Date()) {
  if (quote?.status !== "sent") return false;
  const expiry = quoteExpiry(quote, now);
  return Boolean(expiry && (expiry.expired || expiry.soon));
}

/**
 * Counts per chip, or null when the list itself is unknown.
 *
 * `null` in, `null` out — deliberately, and it is the same rule the tiles this
 * replaces already followed: a failed load must render an em dash, never a
 * confident "Accepted 0". Zero won work is a much more convincing lie than a
 * red banner is a correction.
 */
export function countQuotesByStatus(quotes) {
  if (!Array.isArray(quotes)) return null;
  const counts = { all: quotes.length, draft: 0, sent: 0, accepted: 0, declined: 0 };
  for (const q of quotes) {
    if (Object.prototype.hasOwnProperty.call(counts, q?.status)) counts[q.status] += 1;
  }
  return counts;
}

/**
 * The rows, split into the ones somebody has to chase and everything else.
 *
 * `chase` is oldest-sent-first: the quote that has been waiting longest is the
 * one whose client has most likely forgotten it. `rest` keeps the order the API
 * sent (createdAt desc) — the newest thing you typed is the thing you are
 * looking for.
 *
 * Neither input array is mutated: `filter` already copies, and sorting a prop
 * in place is how a list re-renders in a different order than the state it came
 * from.
 */
export function rankQuotes(quotes, now = new Date()) {
  const list = Array.isArray(quotes) ? quotes : [];
  const chase = list.filter((q) => q?.status === "sent");
  const rest = list.filter((q) => q?.status !== "sent");

  chase.sort((a, b) => {
    const aa = asDate(a?.sentAt) || asDate(a?.createdAt);
    const bb = asDate(b?.sentAt) || asDate(b?.createdAt);
    // A row we cannot place in time sinks to the bottom of the group rather
    // than jumping to the top of it — an unknown date is not "the oldest".
    if (!aa && !bb) return 0;
    if (!aa) return 1;
    if (!bb) return -1;
    return aa.getTime() - bb.getTime();
  });

  return { chase, rest, now };
}
