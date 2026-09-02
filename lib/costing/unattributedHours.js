// lib/costing/unattributedHours.js
//
// The hours that reached no job at all.
//
// ── Why a job's costing screen has to mention them ─────────────────────────
//
// `TimeEntry.jobId` is nullable, and until the self-serve clock learned to set
// it (app/api/time-clock/route.js, lib/timeclock/jobChoices.js) every hour
// punched from a phone was null. Job costing queries `where: { jobId }`, so
// those hours never appeared on any job — the labour figure was not merely
// approximate, it was systematically short, and nothing on the screen said so.
//
// Setting `jobId` fixes it going forward. It does NOT fix the rows already
// written, and it must not: guessing which job a punch from three weeks ago
// belonged to would be inventing a fact, and an invented attribution is worse
// than a known gap — it is a gap you can no longer see. So the old rows stay
// null and the screen SAYS they are there. Absence of a statement is not a
// statement.
//
// ── What the number means, and what it does not ────────────────────────────
//
// It is COMPANY-WIDE, over the window this job was worked in. It is not "hours
// that probably belong to this job" — nothing here claims that, and the copy on
// the screen must not either. It is "in the period this job ran, your team
// recorded N hours against no job, so they are in nobody's costing, including
// this one's." That is actionable (go and tag them) and it is true.
//
// It carries hours only, never money. A cost figure would be company-wide
// payroll spend rendered on one job's panel, which is a different and much
// wider disclosure than the jobCosting toggle is asking for.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => {
  const r = Math.round(num(v) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};

const asDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * The window this job was actually worked in.
 *
 * Preference order, and the reason for it:
 *
 *   1. The job's OWN time entries — first clock-in to last clock-out. This is
 *      measured rather than planned, so it is the truest window available.
 *   2. The job's stated dates, when nothing has been logged against it yet.
 *      `endDate ?? completedAt ?? now` for the upper bound: a job still running
 *      has no end, and an open-ended window is the honest shape for one.
 *   3. Null. A job with no logged hours and no start date has no window, and
 *      there is nothing truthful to say about "this period". The screen says
 *      nothing rather than picking an arbitrary thirty days.
 *
 * Returns `{ from, to }` as Dates, or null.
 */
export function jobActivitySpan({ entries = [], job = {}, now = new Date() } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  let from = null;
  let to = null;

  for (const e of list) {
    const inAt = asDate(e?.clockIn);
    if (!inAt) continue;
    if (!from || inAt < from) from = inAt;
    // An entry still open has no clockOut; its clock-in is the latest thing we
    // can honestly say happened.
    const outAt = asDate(e?.clockOut) || inAt;
    if (!to || outAt > to) to = outAt;
  }

  if (from && to) return { from, to };

  const start = asDate(job?.startDate);
  if (!start) return null;
  const end = asDate(job?.endDate) || asDate(job?.completedAt) || asDate(now) || new Date();
  // A start date later than the end we found (a job marked complete before its
  // stated start — data entry happens) would produce a backwards window that
  // silently matches nothing. Say nothing instead.
  if (end < start) return null;
  return { from: start, to: end };
}

/**
 * Sum unattributed rows.
 *
 * Rejected entries are excluded outright. A rejected hour is not a gap in the
 * costing — somebody looked at it and said it did not happen — and counting it
 * would inflate a figure whose entire purpose is to be trusted as a floor.
 *
 * Approved and pending are reported separately for the same reason
 * actualJobCost separates them: they are different claims. They are also
 * summed, because the sentence on screen is about hours that are missing from
 * costing, and both kinds are.
 */
export function summariseUnattributed(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  let approved = 0;
  let pending = 0;
  let entries = 0;
  const workers = new Set();

  for (const r of list) {
    const hours = num(r?.hours);
    if (!hours) continue;
    if (r?.status === "rejected") continue;
    entries++;
    if (r?.workerId) workers.add(r.workerId);
    if (r?.status === "approved") approved += hours;
    else pending += hours;
  }

  return {
    hours: round2(approved + pending),
    approvedHours: round2(approved),
    pendingHours: round2(pending),
    entries,
    workers: workers.size,
  };
}

/**
 * The company's unattributed hours over one job's window.
 *
 * Returns null when there is no window to speak about, and null when the window
 * exists but nothing unattributed falls inside it — the screen renders nothing
 * in both cases, because "0 h were untagged" and "we could not tell" must not
 * look identical, and neither is worth a line of a phone-sized panel.
 *
 * `db` is a parameter for the same reason lib/tenant/ownedIds.js takes one:
 * so the arithmetic above and the query shape below are both exercisable
 * without a Postgres.
 */
export async function unattributedLabourForJob(
  db,
  { companyId, jobId, attributed = [], now = new Date() } = {},
) {
  // The job's own dates are fetched ONLY when its time entries give no window —
  // which is precisely the case this whole file exists for, a job with nothing
  // logged against it because every hour went to the phone clock and landed
  // nowhere. Every other job costs one query fewer.
  let span = jobActivitySpan({ entries: attributed, now });
  if (!span) {
    const job = await db.job.findFirst({
      where: { id: jobId, companyId },
      select: { startDate: true, endDate: true, completedAt: true },
    });
    span = job ? jobActivitySpan({ entries: [], job, now }) : null;
  }
  if (!span) return null;

  const rows = await db.timeEntry.findMany({
    where: {
      jobId: null,
      // Scoped through the worker, because TimeEntry has no companyId of its
      // own — the same join every other tenant-scoped read of this table uses.
      worker: { companyId },
      clockIn: { gte: span.from, lte: span.to },
    },
    select: { hours: true, status: true, workerId: true },
  });

  const summary = summariseUnattributed(rows);
  if (!summary.hours) return null;

  return {
    ...summary,
    from: span.from.toISOString(),
    to: span.to.toISOString(),
  };
}
