// lib/jobs/visitInRange.js
//
// Whether a visit falls inside the job's own start/end — a nudge, not a rule.
//
// ── Why this doesn't block anything ──────────────────────────────────────────
//
// A pre-job site assessment legitimately happens before Job.startDate, and a
// warranty callback legitimately happens after Job.endDate — see the comment
// on JobVisit in prisma/schema.prisma. Refusing either at the API would make
// this feature actively wrong for two of its most ordinary uses. What's worth
// flagging is the case that's actually a mistake far more often than not: a
// visit booked for a Tuesday that falls in the middle of a date range nobody
// meant it to sit outside of — a fat-fingered month, a job whose dates moved
// and the visit didn't move with them.
//
// ── Day comparison, not timestamp comparison ─────────────────────────────────
//
// startDate/endDate are calendar dates (stored as UTC midnight, same
// convention as Quote.validUntil / Invoice.dueDate). A visit is a real
// timestamp — 2pm on the job's own last day is still on-range, but comparing
// raw epoch millis against an end date stored at 00:00 UTC would flag it as
// twelve hours "late". Comparing UTC calendar days instead makes the end date
// inclusive of its whole day, which is what "the job ends the 17th" means to
// the person reading it.
function utcDayNumber(value) {
  // `new Date(null)` is midnight 1970-01-01 — a VALID date, not NaN — so a
  // missing value has to be caught before it ever reaches `new Date()`.
  // Without this, a job with no dates at all read as "everything is after
  // 1970", which flagged every visit on every job that simply hadn't been
  // given a range yet.
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * @param visit  { scheduledAt }
 * @param job    { startDate, endDate }
 * @returns true only when the job HAS a start date and the visit's day falls
 *          strictly outside it. No start date means nothing to compare
 *          against, so it's never flagged — the range is the exception here,
 *          not the default.
 */
export function isVisitOutsideJobRange(visit, job) {
  const visitDay = utcDayNumber(visit?.scheduledAt);
  const startDay = utcDayNumber(job?.startDate);
  if (visitDay === null || startDay === null) return false;

  if (visitDay < startDay) return true;

  const endDay = utcDayNumber(job?.endDate);
  if (endDay !== null && visitDay > endDay) return true;

  return false;
}
