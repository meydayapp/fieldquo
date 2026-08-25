// lib/servicePlans/schedule.js
//
// When a service plan's occurrences fall, and — just as importantly — when a
// plan must produce nothing at all.
//
// Pure. No database, no Stripe, no Date.now() that isn't injectable. Every
// decision about whether money is due passes through here, so it has to be
// executable against hostile input by a check script (scripts/check-service-
// plans.mjs) rather than reasoned about.
//
// ── Why this is not lib/jobs/recurrence.js ─────────────────────────────────
//
// That module advances ONE step from the last visit, iteratively, and clamps a
// short month (Jan 31 → Feb 28). That is right for a calendar: the next visit
// follows the last one.
//
// It is wrong for a billing schedule. Iterating from the clamped date makes a
// plan anchored on the 31st walk backwards — Jan 31 → Feb 28 → Mar 28 → Apr 28
// — and a client who signed up to be billed on the 31st is being debited on a
// date they never agreed to, three days early, for ever. So every occurrence
// here is computed from the START ANCHOR, clamping only for the month it lands
// in: Jan 31 → Feb 28 → Mar 31. The two modules disagree on purpose.

/// The five cadences the contractor can pick, and how far one step moves.
///
/// Closed set. "Twice a year" is `semiannual` and is the case the whole feature
/// was asked for — spring and fall — which is why it is a first-class option
/// rather than something to express as "every 6 months" in a free-text rule.
export const PLAN_FREQUENCIES = {
  weekly: { days: 7 },
  monthly: { months: 1 },
  quarterly: { months: 3 },
  semiannual: { months: 6 },
  annual: { months: 12 },
};

export const PLAN_FREQUENCY_KEYS = Object.keys(PLAN_FREQUENCIES);

/// How a series ends. `open` is genuinely unbounded — the contractor cancels it.
export const PLAN_END_MODES = ["count", "until", "open"];

/// The three plan states. Only `active` can produce anything.
export const PLAN_STATUSES = ["active", "cancelled", "completed"];

/// invoice = raise an invoice and send the pay link, no stored card needed.
/// automatic = attempt an off-session charge, but only against a real mandate.
export const PLAN_COLLECTION_MODES = ["invoice", "automatic"];

/// Ceiling on how far a single run may walk forward looking for a due date.
/// A plan with a corrupt anchor cannot hang the cron; it stops and reports.
const WALK_GUARD = 2000;

/**
 * At most one occurrence is generated per plan per run.
 *
 * This is a money guard, not a performance one. A contractor who mistypes a
 * start date as 2019 would otherwise have a weekly plan raise 340 real invoices
 * — and, on the automatic tier, attempt 340 real charges — the first time the
 * cron sees it. One per run means the daily cron catches up a missed week in a
 * week, and a mistake is caught after one invoice rather than after a burst.
 */
export const MAX_OCCURRENCES_PER_RUN = 1;

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function toDate(value) {
  if (value == null) return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return isValidDate(d) ? d : null;
}

/**
 * The date of the `index`-th occurrence (0-based), measured from the anchor.
 *
 * Returns null for anything it cannot compute rather than a plausible-looking
 * date — an invented billing date is the worst possible fallback.
 */
export function occurrenceDate(startDate, frequency, index) {
  const start = toDate(startDate);
  const step = PLAN_FREQUENCIES[frequency];
  if (!start || !step) return null;
  if (!Number.isInteger(index) || index < 0) return null;

  // ── All of this is UTC arithmetic, and that is a correctness requirement ──
  //
  // A billing date is a CALENDAR date, stored as UTC midnight — the same
  // convention documentFormatters relies on (see its note on why a quote valid
  // until the 30th was printing the 29th). The local-time setters look
  // equivalent and are not: on a server west of UTC, `2026-03-02T00:00:00Z` is
  // the 1st locally, so `setDate(getDate() + 7)` lands on the 8th and the whole
  // series walks a day early — and a spring-forward week shifts it again. A
  // client who agreed to be billed on the 15th would have been debited on the
  // 14th, for ever, depending on where the process happened to be running.
  if (step.days) {
    const d = new Date(start.getTime());
    d.setUTCDate(d.getUTCDate() + step.days * index);
    return d;
  }

  // Month arithmetic, clamped to the TARGET month's length and always measured
  // from the anchor's own day-of-month. See the header for why.
  const anchorDay = start.getUTCDate();
  const d = new Date(start.getTime());
  d.setUTCDate(1); // avoid the overflow before we know the target month's length
  d.setUTCMonth(d.getUTCMonth() + step.months * index);
  // Day 0 of the NEXT month is the last day of this one, in UTC.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(anchorDay, lastDay));
  return d;
}

/**
 * How many occurrences this plan will ever have, or null when it is open-ended.
 *
 * Null means "unknown, and unknowable" — it is not zero and it is not a number
 * to fill in with a default. Every caller that prints a term total has to
 * handle it, which is the point.
 */
export function plannedOccurrenceCount(plan) {
  if (!plan) return null;
  if (plan.endMode === "count") {
    const n = Number(plan.occurrenceCount);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  if (plan.endMode === "until") {
    const end = toDate(plan.endDate);
    if (!end) return null;
    let count = 0;
    for (let i = 0; i < WALK_GUARD; i++) {
      const d = occurrenceDate(plan.startDate, plan.frequency, i);
      if (!d) return null;
      if (d > end) break;
      count += 1;
    }
    return count;
  }
  return null; // open-ended
}

/**
 * Is `seq` inside the length the contractor sold?
 *
 * Split out from the generator so the check script can assert the boundary on
 * its own: the last occurrence of a 6-visit plan is seq 5, and seq 6 must be
 * refused whichever path reaches it.
 */
export function seqWithinTerm(plan, seq) {
  if (!plan || !Number.isInteger(seq) || seq < 0) return false;
  const date = occurrenceDate(plan.startDate, plan.frequency, seq);
  if (!date) return false;

  if (plan.endMode === "count") {
    const n = Number(plan.occurrenceCount);
    if (!Number.isInteger(n) || n <= 0) return false;
    return seq < n;
  }
  if (plan.endMode === "until") {
    const end = toDate(plan.endDate);
    if (!end) return false;
    return date <= end;
  }
  if (plan.endMode === "open") return true;
  return false; // an end mode we don't recognise sells nothing
}

/**
 * Why this plan cannot bill right now — or null when it can.
 *
 * A reason string rather than a boolean because both the run engine and the
 * contractor's plan screen need to SAY which of these it is. "This plan is
 * cancelled" and "this plan has finished its 6 visits" are different sentences
 * and a boolean loses that.
 *
 * Returns one of:
 *   "cancelled" | "completed" | "not_active" | "malformed" | "not_started"
 */
export function planBlockedReason(plan, { now = new Date() } = {}) {
  if (!plan) return "malformed";
  if (plan.status === "cancelled" || plan.cancelledAt) return "cancelled";
  if (plan.status === "completed" || plan.completedAt) return "completed";
  if (plan.status !== "active") return "not_active";
  if (!PLAN_FREQUENCIES[plan.frequency]) return "malformed";
  if (!PLAN_END_MODES.includes(plan.endMode)) return "malformed";
  const start = toDate(plan.startDate);
  if (!start) return "malformed";
  if (start > now) return "not_started";
  return null;
}

/**
 * The occurrences this plan owes RIGHT NOW.
 *
 * @param plan
 * @param opts.now            clock, injected
 * @param opts.existingSeqs   sequence numbers already generated (Set or array).
 *                            The idempotency guard — the database's unique
 *                            index on (planId, seq) is the real one, this is
 *                            the fast path.
 * @param opts.createdAt      when the plan row was created. Occurrences dated
 *                            BEFORE this are never generated: a plan entered
 *                            today with a start date last spring describes work
 *                            already done and paid for by other means, and
 *                            back-billing it is the single most damaging thing
 *                            this file could do. Defaults to the plan's own
 *                            createdAt.
 * @param opts.limit          how many to return. Defaults to
 *                            MAX_OCCURRENCES_PER_RUN — see that constant.
 *
 * @returns { due: [{ seq, dueDate }], blocked: string|null, exhausted: boolean }
 *          `exhausted` is true when the term is finished and nothing further
 *          will ever be due — the signal the run engine uses to mark the plan
 *          completed rather than leaving it active for ever.
 */
export function dueOccurrences(plan, {
  now = new Date(),
  existingSeqs = [],
  createdAt = undefined,
  limit = MAX_OCCURRENCES_PER_RUN,
} = {}) {
  const blocked = planBlockedReason(plan, { now });
  if (blocked) return { due: [], blocked, exhausted: false };

  const seen = existingSeqs instanceof Set ? existingSeqs : new Set(existingSeqs);
  const floor = toDate(createdAt ?? plan.createdAt);
  const due = [];
  let exhausted = false;

  for (let seq = 0; seq < WALK_GUARD; seq++) {
    if (!seqWithinTerm(plan, seq)) {
      // Past the end of what was sold. Nothing further can ever be due, and
      // there is nothing outstanding, so the plan is finished.
      exhausted = due.length === 0;
      break;
    }
    const date = occurrenceDate(plan.startDate, plan.frequency, seq);
    if (!date) break;
    if (date > now) break; // the future — not due, and neither is anything after it
    if (seen.has(seq)) continue;
    // Dated before the plan existed: skip it, permanently. Deliberately
    // `continue`, not `break` — a plan whose anchor predates it still owes the
    // occurrences that fall after its creation.
    if (floor && date < floor) continue;
    due.push({ seq, dueDate: date });
    if (due.length >= limit) break;
  }

  return { due, blocked: null, exhausted };
}

/**
 * True when every occurrence the contractor sold has been generated and the
 * term is over. Used to flip a plan to `completed`.
 *
 * Open-ended plans are never finished — that is what open-ended means, and
 * inventing an end for one would be the "absence padded with a default" failure.
 */
export function termIsFinished(plan, { now = new Date(), existingSeqs = [] } = {}) {
  if (!plan || plan.endMode === "open") return false;
  const total = plannedOccurrenceCount(plan);
  if (total === null) return false;
  const seen = existingSeqs instanceof Set ? existingSeqs : new Set(existingSeqs);
  if (seen.size < total) return false;
  const last = occurrenceDate(plan.startDate, plan.frequency, total - 1);
  return Boolean(last) && last <= now;
}

/**
 * The next date this plan will bill on, or null when there isn't one.
 *
 * Null covers three genuinely different situations — cancelled, finished, and
 * open-ended-but-malformed — and the caller is expected to have already asked
 * planBlockedReason which. This exists to print "Next: 14 April" and must never
 * print a date for a plan that will not bill.
 */
export function nextDueDate(plan, { now = new Date(), existingSeqs = [] } = {}) {
  if (planBlockedReason(plan, { now })) return null;
  const seen = existingSeqs instanceof Set ? existingSeqs : new Set(existingSeqs);
  for (let seq = 0; seq < WALK_GUARD; seq++) {
    if (!seqWithinTerm(plan, seq)) return null;
    const date = occurrenceDate(plan.startDate, plan.frequency, seq);
    if (!date) return null;
    if (seen.has(seq)) continue;
    if (date > now) return date;
  }
  return null;
}
