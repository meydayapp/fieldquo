// lib/reviews/request.js
//
// Asking a customer for a review once the work is done.
//
// ══ Why this is worth automating ═══════════════════════════════════════════
//
// Reviews are the single biggest driver of inbound work for a small
// contractor, and asking for one is the step that gets skipped: the crew is
// packing the van, the homeowner is holding a cheque, and nobody wants to be
// the person who says "could you go on Google and say something nice". So it
// never happens, and a business with two hundred happy customers has eleven
// reviews.
//
// ══ Why the rules below are strict ═════════════════════════════════════════
//
// The failure mode of automated review requests is not "it didn't send". It's
// "it sent twice", or "it sent to the customer who is currently furious", or
// "it sent to the person who unsubscribed last year". Each of those costs more
// than the review was worth, so every one of them is a hard gate here rather
// than a filter in the query — the reasons are strings so a person can be told
// WHY a particular job wasn't asked, instead of staring at a job that silently
// isn't in the list.
//
// ══ What this file is not ══════════════════════════════════════════════════
//
// It does not send anything and it does not touch the network. It answers "may
// we ask this customer, and is it time yet". The cron route sends. That split
// is what makes the rules executable against hostile input without a database.

/** Milliseconds in an hour, named because `3600000` in a date expression reads as noise. */
const HOUR = 60 * 60 * 1000;

/**
 * Bounds on the delay a company may configure.
 *
 * The floor is 1 hour, not 0: "we finished, please review us" arriving while
 * the crew is still loading the truck reads as automated, which is exactly the
 * impression that stops someone leaving a review. The ceiling is 30 days
 * because past that they've forgotten who you are, and an ask they ignore is
 * worse than no ask — it trains them to ignore your email.
 */
export const MIN_DELAY_HOURS = 1;
export const MAX_DELAY_HOURS = 24 * 30;

export function clampDelay(hours) {
  // `hours == null` before Number(), because Number(null) is 0 — finite, so it
  // would sail past the guard below and clamp to the 1-hour floor. A company
  // that hasn't set a delay would then be asking for reviews an hour after the
  // van pulls away instead of the next day.
  if (hours == null || hours === "") return 24;
  const n = Number(hours);
  if (!Number.isFinite(n)) return 24;
  return Math.min(MAX_DELAY_HOURS, Math.max(MIN_DELAY_HOURS, Math.round(n)));
}

/**
 * Does this look like somewhere a review can actually be left?
 *
 * Deliberately permissive about WHICH site — Google, Facebook, Yelp, HomeStars,
 * a Trustpilot page, the company's own testimonials form are all legitimate.
 * What it refuses is a non-URL, and anything not http(s): a `javascript:` or
 * `data:` URI in an email that carries the contractor's branding is their
 * reputation, not ours, and this is the only place it's checked.
 */
export function validReviewUrl(url) {
  if (typeof url !== "string" || !url.trim()) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * May we ask about this job, and is it time?
 *
 * Pure: hand it plain objects and a clock. No database, so the rules can be
 * executed against the cases that matter — the cancelled job, the job that was
 * marked complete and then reopened, the customer who unsubscribed, the second
 * run of the same cron ten minutes later.
 *
 * @param {object}  job          { status, completedAt, reviewRequestedAt }
 * @param {object}  company      { reviewUrl, reviewDelayHours, reviewRequestsEnabled }
 * @param {object}  client       { email }
 * @param {boolean} subscribed   false only if they've actively unsubscribed
 * @param {Date}    now
 * @returns {{ send: boolean, reason: string }}
 */
export function shouldRequestReview({ job, company, client, subscribed = true, now = new Date() }) {
  if (!job || !company) return { send: false, reason: "Nothing to check." };

  // ── Once. Ever. ─────────────────────────────────────────────────────────
  //
  // First, before anything else, because this is the gate that has to hold when
  // every other input is in flux. A cron that overlaps its own previous run,
  // a job edited twice, a manual "ask now" pressed by two people — all of them
  // arrive here, and all of them stop.
  if (job.reviewRequestedAt) {
    return { send: false, reason: "Already asked." };
  }

  if (!company.reviewRequestsEnabled) {
    return { send: false, reason: "Review requests are switched off." };
  }

  // No destination, no ask. An email that says "leave us a review" with no
  // link spends the customer's goodwill and returns nothing — it's worse than
  // staying quiet, because you only get to ask once.
  if (!validReviewUrl(company.reviewUrl)) {
    return { send: false, reason: "No review link has been set." };
  }

  if (job.status !== "completed") {
    return { send: false, reason: "The job isn't finished." };
  }

  // Trust the stamp, not the status. A job carrying `completed` with no
  // `completedAt` predates that column; we don't know when it finished, and
  // guessing "now" would mean the day this shipped every historical job in the
  // system asked for a review at once.
  if (!job.completedAt) {
    return { send: false, reason: "We don't know when this job finished." };
  }

  if (!client?.email) {
    return { send: false, reason: "No email address for this customer." };
  }

  // An unsubscribe covers this. A review request is not an invoice — nobody
  // needs it — so it belongs on the side of the line where "leave me alone"
  // wins.
  if (subscribed === false) {
    return { send: false, reason: "They've unsubscribed." };
  }

  const due = new Date(new Date(job.completedAt).getTime() + clampDelay(company.reviewDelayHours) * HOUR);
  if (!(due <= now)) {
    return { send: false, reason: "Too soon — still inside the waiting period." };
  }

  // Not an unbounded backlog. A company that switches this on today should not
  // fire a review request at every customer they've had since 2023; that's a
  // spam complaint and possibly a domain reputation problem. Anything older
  // than the window is left alone, silently and permanently.
  if (now - new Date(job.completedAt) > MAX_DELAY_HOURS * HOUR) {
    return { send: false, reason: "That job finished too long ago to ask about now." };
  }

  return { send: true, reason: "Ready to ask." };
}
