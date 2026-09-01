// lib/analytics/payrollCost.js
//
// What the crew was paid this period — approved hours × each worker's own
// pay rate, summed across the whole company. This is the piece the owner
// asked for directly: "we have all the information from expenses, payroll,
// jobs etc." — and payroll cost had no home on any money screen before this.
// It sits beside lib/analytics/moneyFlow.js on the KPI dashboard rather than
// inside it, because it answers a different question: moneyFlow.js sums
// Expense rows someone typed in; this sums TimeEntry rows the crew clocked,
// which never become an Expense at all. Summing them together would silently
// invent a category neither table actually represents.
//
// ══ Reuses the rate, does not re-decide it ═══════════════════════════════
//
// docs/ROADMAP.md §5 records three pay-rate paths that used to disagree:
// AddEmployeeModal writes Worker.hourlyRate, the New-User/edit-member screen
// writes Member.laborCostPerHour and no Worker at all, and the overhead
// screen writes Salary rows with workerId:null (a business cost, not pay).
// lib/payroll/buildPayRun.js's effectiveWageRate() is the fix already
// shipped for the first two — Worker.hourlyRate wins when set, else the
// Member fallback — and this file imports that function rather than writing
// a fourth path. It never reads Salary at all: an overhead salary is a
// business cost lib/analytics/burnRate.js already counts, not a person's pay.
//
// ══ Pure — DB reads live in the route ═══════════════════════════════════════
//
// No `@/lib/db` import. Every row arrives already fetched and scoped to the
// company by app/api/analytics/finance-overview/route.js, the same split
// lib/analytics/kpis.js and lib/analytics/moneyFlow.js each keep. That is
// what lets scripts/check-money-flow.mjs execute this against fixtures with
// no database, the same discipline it already applies to buildMoneyFlow.
//
// ══ The honesty rules this file keeps ═══════════════════════════════════════
//
//   • No approved time EVER recorded for this company → null, not $0. A
//     company that has never used the time clock has an UNKNOWN payroll
//     cost, not a zero one — the same everRecorded distinction moneyFlow.js
//     draws for income and expenses.
//   • Approved time exists, none in THIS period → a real $0. The crew simply
//     didn't clock anything this period; that is a fact, not an absence.
//   • Approved hours with no resolvable rate (effectiveWageRate() returns
//     null) are NOT folded in as free labour — the same refusal
//     lib/costing/utilisation.js makes for the identical situation. Their
//     hours and a count of the workers affected ride along in `raw` so the
//     screen can say "N hours have no pay rate on file" instead of quietly
//     undercounting the total, and `incomplete: true` flags the figure.
//   • Pending (unapproved) hours are never paid — buildPayRun.js's own rule,
//     restated here rather than re-decided — but the hours are counted and
//     returned so the screen can say how much is still awaiting approval,
//     the same way buildPayRun's own UI does.
import { effectiveWageRate } from "@/lib/payroll/buildPayRun";

const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "object" && typeof v.toNumber === "function" ? v.toNumber() : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => {
  const r = Math.round(num(v) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};

/** English reasons for a null figure, closed vocabulary — moneyFlow.js's REASONS pattern. */
export const REASONS = {
  no_time_entries_recorded: "No approved time has ever been recorded for this company.",
};

/**
 * @param {object}   p
 * @param {object[]} p.workers              [{ id, userId, hourlyRate }] — active workers.
 * @param {Map}      p.laborCostByUser      userId → Member.laborCostPerHour, the same
 *                                           fallback map buildPayRun.js builds.
 * @param {object}   p.approvedHoursByWorker { [workerId]: hours } approved, clocked
 *                                           in [from,to] — from a `timeEntry.groupBy`
 *                                           the same shape lib/analytics/kpis.js already
 *                                           uses for jobHoursById, except unfiltered by
 *                                           jobId (payroll pays for ALL clocked time, not
 *                                           only time that reached a job).
 * @param {object}   p.pendingHoursByWorker  same shape, status:"pending" — informational
 *                                           only, never priced into the total.
 * @param {boolean}  p.everRecordedTime      has this company EVER had an approved
 *                                           TimeEntry, at any date? REQUIRED — see the
 *                                           header on why this can't be inferred from
 *                                           the period alone.
 */
export function buildPayrollCost({
  workers = [],
  laborCostByUser = new Map(),
  approvedHoursByWorker = {},
  pendingHoursByWorker = {},
  everRecordedTime = null,
} = {}) {
  if (typeof everRecordedTime !== "boolean") {
    const err = new Error(
      "buildPayrollCost needs everRecordedTime as a boolean; it will not assume it.",
    );
    err.status = 500;
    throw err;
  }

  let total = 0;
  let ratedHours = 0;
  let unratedHours = 0;
  let unratedWorkers = 0;
  let workersPaid = 0;

  for (const worker of workers) {
    const hours = num(approvedHoursByWorker[worker.id]);
    if (hours <= 0) continue;
    const rate = effectiveWageRate(worker, laborCostByUser);
    if (rate === null) {
      unratedHours = round2(unratedHours + hours);
      unratedWorkers += 1;
      continue;
    }
    total = round2(total + hours * rate);
    ratedHours = round2(ratedHours + hours);
    workersPaid += 1;
  }

  let pendingHours = 0;
  for (const worker of workers) pendingHours = round2(pendingHours + num(pendingHoursByWorker[worker.id]));

  const available = everRecordedTime;
  const incomplete = unratedWorkers > 0;

  return {
    value: available ? total : null,
    available,
    reason: available ? null : "no_time_entries_recorded",
    reasonText: available ? null : REASONS.no_time_entries_recorded,
    incomplete,
    sampleSize: workersPaid,
    raw: {
      ratedHours,
      unratedHours,
      unratedWorkers,
      pendingHours,
    },
  };
}
