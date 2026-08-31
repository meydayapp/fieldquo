// lib/team/workerArchive.js
//
// Whether a Worker row is safe to hard-delete.
//
// ── The rule, one level down from the company ────────────────────────────
//
// lib/billing/access.js states it for a COMPANY that stops paying: "a locked
// account is inaccessible, not erased." The same rule applies to a PERSON —
// a pay run naming somebody who worked in March is an accounting record, and
// a worker's timesheets are somebody's employment history, and neither gets
// a hole in it because the person left in August.
//
// Pulled into its own function, pure and DB-free, because DELETE
// /api/workers/[id] used to answer this question by checking only
// `payouts.length` — a worker paid through Stripe was protected, but one who
// had logged hours (TimeEntry) or already appeared on a committed pay run
// (PayRunLine) was hard-deleted anyway. A pure function is what a check
// script can throw hostile inputs at without a database; the route below
// only has to supply real counts.
export function hasWorkerHistory({
  payoutCount = 0,
  timeEntryCount = 0,
  payRunLineCount = 0,
} = {}) {
  return (
    Number(payoutCount) > 0 ||
    Number(timeEntryCount) > 0 ||
    Number(payRunLineCount) > 0
  );
}
