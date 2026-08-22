// lib/costing/actualJobCost.js
//
// What a job ACTUALLY cost, against what it was estimated to cost.
//
// ── The gap this fills ─────────────────────────────────────────────────────
//
// The quote side of costing is good: estimateQuoteCost works out materials,
// labour hours, overhead and margin, and the quote screen shows all of it.
// Then the job happens, expenses get tagged to it, crews log hours against it
// — and none of that appeared anywhere on the job. QA recorded a $125.50
// materials expense against a job, watched it show up in Expense Tracking, and
// found the job itself had no cost section at all.
//
// So a contractor could see what they THOUGHT a job would cost and never what
// it did. "Did this one make money" is the question the whole feature exists
// to answer, and it was the half that was missing.
//
// ── Rules ──────────────────────────────────────────────────────────────────
//
//   * Only APPROVED hours count as cost. Pending hours are a claim, not a
//     payroll liability, and counting them would make every job look worse
//     until someone got round to the timesheets. They are reported separately
//     so the number isn't silently incomplete either.
//
//   * A worker with no rate contributes hours and no cost, and is COUNTED. An
//     unrated worker silently costing nothing is how a job shows a fake profit.
//
//   * Nothing is estimated, extrapolated or annualised. This is a sum of things
//     that actually happened.
//
//   * No estimate and no actuals means no comparison — not a 0% variance. A
//     job with nothing recorded has not come in on budget.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;

/**
 * Actual spend on one job.
 *
 * @param {object[]} expenses     rows tagged to this job: { category, amount }
 * @param {object[]} timeEntries  rows for this job: { hours, status, worker }
 */
export function actualJobCost(expenses = [], timeEntries = []) {
  const exp = Array.isArray(expenses) ? expenses : [];
  const entries = Array.isArray(timeEntries) ? timeEntries : [];

  const byCategory = new Map();
  let expenseTotal = 0;
  for (const e of exp) {
    const amount = num(e?.amount);
    if (!amount) continue;
    const key = e?.category || "other";
    byCategory.set(key, round2((byCategory.get(key) || 0) + amount));
    expenseTotal += amount;
  }

  let approvedHours = 0;
  let pendingHours = 0;
  let labourCost = 0;
  let unratedHours = 0;
  const workersSeen = new Set();

  for (const t of entries) {
    const hours = num(t?.hours);
    if (!hours) continue;
    if (t?.status !== "approved") {
      pendingHours += hours;
      continue;
    }
    approvedHours += hours;
    if (t?.workerId) workersSeen.add(t.workerId);
    const rate = t?.worker?.hourlyRate;
    // Explicitly null-checked before Number(): Number(null) is 0, which would
    // turn "we don't know this person's rate" into "this person is free".
    if (rate === null || rate === undefined || rate === "") {
      unratedHours += hours;
      continue;
    }
    labourCost += hours * num(rate);
  }

  return {
    expenses: {
      total: round2(expenseTotal),
      byCategory: [...byCategory.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    },
    labour: {
      approvedHours: round2(approvedHours),
      pendingHours: round2(pendingHours),
      cost: round2(labourCost),
      // Hours from people with no rate on file. Surfaced rather than folded
      // into the total as zero, because a job showing profit only because
      // nobody priced the crew is the worst kind of wrong number.
      unratedHours: round2(unratedHours),
      workers: workersSeen.size,
    },
    total: round2(expenseTotal + labourCost),
    // True when the total is knowably short. The UI says so instead of
    // presenting a partial figure as final.
    incomplete: pendingHours > 0 || unratedHours > 0,
  };
}

/**
 * Estimated vs actual vs invoiced.
 *
 * Every field is null when the input for it is absent. A caller must be able
 * to tell "nothing spent yet" from "we don't know", and a zero cannot.
 */
export function compareJobCost({ estimatedCost, actualCost, revenue } = {}) {
  const est = estimatedCost == null ? null : round2(estimatedCost);
  const act = actualCost == null ? null : round2(actualCost);
  const rev = revenue == null ? null : round2(revenue);

  const variance = est === null || act === null ? null : round2(act - est);
  // Percentage against the ESTIMATE, which is the thing being tested. A zero
  // estimate has no percentage — dividing by it would produce Infinity and
  // render as a number.
  const variancePct =
    variance === null || !est ? null : Math.round((variance / est) * 1000) / 10;

  const profit = rev === null || act === null ? null : round2(rev - act);
  const marginPct =
    profit === null || !rev ? null : Math.round((profit / rev) * 1000) / 10;

  return {
    estimatedCost: est,
    actualCost: act,
    revenue: rev,
    variance,
    variancePct,
    profit,
    marginPct,
    // Over budget is worth flagging; on or under budget is not an alert.
    // Null-safe: unknown is not "over".
    overBudget: variance !== null && variance > 0,
  };
}
