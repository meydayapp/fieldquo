// lib/messaging/outcomes.js
//
// What a Page conversation turned out to be, as a closed list.
//
// The whole feature exists so that once a month somebody can ask "which of
// these became jobs, and what did the answered ones do differently". That
// question is only answerable if the vocabulary is fixed: a free-text
// "outcome" column ends up holding "won", "Won", "yes", "job booked" and
// "invoiced" and cannot be counted.
//
// ── Why `no_reply` is here AND measured separately ─────────────────────────
//
// This one is the CONTRACTOR'S verdict — "we never got back to them", set by
// a person on the thread. lib/messaging/monthlyReview.js separately MEASURES
// the threads with no outbound message at all, which needs nobody to remember
// to set anything. The two disagree usefully: a thread the review measures as
// unanswered but that somebody marked `won` was almost certainly answered by
// phone, and that is worth seeing rather than flattening.
//
// Pure and dependency-free so the check script and both the route and the UI
// resolve one list.

/** Every value MessageThread.outcome may hold, besides null. */
export const THREAD_OUTCOMES = Object.freeze([
  // It became a job. The one that pays for the feature.
  "won",
  // They went elsewhere, or said no.
  "lost",
  // Nobody at the company answered, or the homeowner went quiet after we did.
  "no_reply",
  // Not a sales conversation at all — a supplier, a job application, spam.
  // Counted out of the won-rate denominator: including "someone asked for
  // directions" in a conversion rate makes the rate meaningless.
  "not_a_job",
]);

/** The i18n key for an outcome's label. One place, so a chip and a report agree. */
export function outcomeLabelKey(outcome) {
  return `app.messages.outcome.${outcome}`;
}

/**
 * Validate an outcome coming off a request body.
 *
 * Returns null for "clear it" (an explicit null/empty — a person unsetting a
 * mistake is a real action) and undefined for "this is not a valid outcome",
 * which the route refuses. Those are different answers and the caller must be
 * able to tell them apart, which is why this returns rather than throws.
 */
export function normaliseOutcome(value) {
  if (value === null || value === "") return null;
  return THREAD_OUTCOMES.includes(value) ? value : undefined;
}

// ── Thread status — where it sits in the inbox, NOT what it turned out to be ─
//
// Four states, taken from Chatwoot, and taken because two were not enough to
// describe a week. Ours was open / snoozed / closed, which in practice meant
// open or not, and a contractor lives in the two that were missing:
//
//   open      nobody has dealt with this yet. Our turn.
//   pending   we answered; we are waiting on THEM. Not finished, not ours.
//   snoozed   deliberately parked until a date — and it comes BACK on that
//             date, by /api/cron/messaging-snooze. A snooze nothing brings
//             back is a thread quietly deleted.
//   resolved  done.
//
// The order below is the order the filter chips are drawn in, which is the
// order of what needs attention.

/** Every value MessageThread.status may hold. */
export const THREAD_STATUSES = Object.freeze(["open", "pending", "snoozed", "resolved"]);

/**
 * The status vocabulary before the four states existed.
 *
 * Rows written under the old list carry "closed". Mapping it here rather than
 * running a data migration is deliberate: a stored value nothing recognises
 * renders in NO filter, which loses the thread from every screen at once — and
 * `prisma db push` carries no data step, so the mapping has to live in code
 * either way. "closed" and "resolved" mean the same thing and always did.
 */
const LEGACY_STATUS = Object.freeze({ closed: "resolved" });

/**
 * Read a status off a row. Always returns one of THREAD_STATUSES: an
 * unrecognised value falls back to "open", because a thread nobody can
 * classify is a thread somebody still has to look at.
 */
export function readStatus(value) {
  if (THREAD_STATUSES.includes(value)) return value;
  return LEGACY_STATUS[value] || "open";
}

/**
 * Validate a status coming off a request body. `undefined` means "not a status
 * this app knows", which the route refuses — the same shape normaliseOutcome
 * uses, so a caller cannot confuse "refused" with "cleared".
 *
 * The legacy value is accepted and UPGRADED rather than refused: an old tab
 * left open should not start failing, and what it means is unambiguous.
 */
export function normaliseStatus(value) {
  if (THREAD_STATUSES.includes(value)) return value;
  return LEGACY_STATUS[value];
}

/** The i18n key for a status label. One place, so a chip and a filter agree. */
export function statusLabelKey(status) {
  return `app.messages.status.${status}`;
}

/**
 * Validate a snooze deadline.
 *
 * Returns a Date, or undefined for "that is not a usable date". A snooze in
 * the PAST is refused rather than clamped to now: "parked until yesterday"
 * means somebody mis-typed, and silently reopening it a second later would
 * look exactly like the feature not working.
 *
 * Bounded at one year for the same reason quote expiry is — a date typed with
 * the wrong year is a thread nobody ever sees again.
 */
export function normaliseSnoozeUntil(value, now = new Date()) {
  if (value === null || value === "") return null;
  const at = value instanceof Date ? value : new Date(value);
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) return undefined;
  if (at.getTime() <= now.getTime()) return undefined;
  if (at.getTime() > now.getTime() + 365 * 24 * 60 * 60 * 1000) return undefined;
  return at;
}
