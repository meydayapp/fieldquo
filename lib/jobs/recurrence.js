// lib/jobs/recurrence.js
//
// Recurring jobs used to be a dead control: the "repeats" toggle and the rule
// saved to Job.recurring / Job.recurrenceRule, and nothing on earth read them.
// A company ticked "weekly", trusted it, and a second visit never appeared.
// This is the half that makes the tick mean something.
//
// The rule is one of three words the job form offers — not an RRULE. Keeping it
// that small is deliberate: a cabinet shop booking a biweekly clean doesn't need
// BYSETPOS, and a closed set can't encode a date that doesn't exist.

export const RECURRENCE_RULES = new Set(["weekly", "biweekly", "monthly"]);

/**
 * rule -> the catalogue key for what a human calls it.
 *
 * Here rather than in either form, because BOTH forms offer this picker and
 * both had the three <option> elements written out by hand. Two hand-written
 * lists beside one Set is how a fourth rule gets scheduled by the cron and
 * offered by neither screen — or, worse, offered by one and unknown to the
 * other. The words stay in app/i18n; only the key lives here, for the same
 * reason lib/jobs/statusLabels.js gives (English in lib/ is English in every
 * office).
 *
 * The keys keep their `app.jobNew.*` names: they are already translated into
 * all nine languages under those names, and renaming them to `app.recurrence.*`
 * would be nine blocks of churn for no reader's benefit.
 */
export const RECURRENCE_LABEL_KEYS = {
  weekly: "app.jobNew.weekly",
  biweekly: "app.jobNew.biweekly",
  monthly: "app.jobNew.monthly",
};

// Advance a date by ONE interval. Monthly clamps to the last day of a shorter
// month (Jan 31 → Feb 28), which is what "monthly" means to a person — naive
// setMonth(+1) rolls Jan 31 into Mar 3, silently skipping February.
export function advance(date, rule) {
  const d = new Date(date);
  if (rule === "weekly") d.setDate(d.getDate() + 7);
  else if (rule === "biweekly") d.setDate(d.getDate() + 14);
  else if (rule === "monthly") {
    const day = d.getDate();
    d.setDate(1); // avoid the overflow before we know the target month's length
    d.setMonth(d.getMonth() + 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
  }
  return d;
}

// The next occurrence STRICTLY AFTER `now`, rolling forward from the last
// scheduled visit. A job left idle for months yields the next FUTURE slot, not a
// burst of backdated ones — the calendar should show what's coming, not a
// backlog nobody is going to drive to.
export function nextVisitDate(lastScheduledAt, rule, now = new Date()) {
  if (!RECURRENCE_RULES.has(rule)) return null;
  let next = advance(lastScheduledAt, rule);
  // Bounded: ~11 years of weekly steps. A stale anchor can't hang the loop.
  let guard = 0;
  while (next <= now && guard < 600) {
    next = advance(next, rule);
    guard += 1;
  }
  return next;
}

/**
 * Ensure an ACTIVE recurring job has exactly one upcoming visit.
 *
 * Idempotent by design — the guard is "does a future visit already exist" — so
 * it's safe to call from BOTH the nightly cron (every recurring job) and the
 * moment a visit is marked complete (one job). Neither can double-book, because
 * both enforce the same single invariant.
 *
 * Anchors on the most recent visit. With no visits at all it does nothing: the
 * FIRST visit is put on the calendar by a human, and recurrence only continues a
 * series — inventing a start date would be guessing at the one thing the company
 * actually chose.
 *
 * @returns the created JobVisit, or null when nothing was needed.
 */
export async function ensureUpcomingVisit(db, jobId, { now = new Date() } = {}) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { id: true, recurring: true, recurrenceRule: true, status: true },
  });
  if (!job?.recurring || !RECURRENCE_RULES.has(job.recurrenceRule)) return null;
  // A finished or cancelled series doesn't roll forward.
  if (job.status === "completed" || job.status === "cancelled") return null;

  const upcoming = await db.jobVisit.count({
    where: { jobId, scheduledAt: { gt: now } },
  });
  if (upcoming > 0) return null;

  const last = await db.jobVisit.findFirst({
    where: { jobId },
    orderBy: { scheduledAt: "desc" },
    select: { scheduledAt: true, assignedToId: true, checklistItems: true },
  });
  if (!last) return null;

  const scheduledAt = nextVisitDate(last.scheduledAt, job.recurrenceRule, now);
  if (!scheduledAt) return null;

  return db.jobVisit.create({
    data: {
      jobId,
      scheduledAt,
      // Carry the crew and the checklist forward — next week's clean is the same
      // clean, by the same person, off the same list, until someone changes it.
      assignedToId: last.assignedToId,
      checklistItems: last.checklistItems ?? undefined,
      status: "scheduled",
    },
  });
}
