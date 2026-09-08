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

/** Thread status — where it sits in the inbox, NOT what it turned out to be. */
export const THREAD_STATUSES = Object.freeze(["open", "snoozed", "closed"]);

export function normaliseStatus(value) {
  return THREAD_STATUSES.includes(value) ? value : undefined;
}
