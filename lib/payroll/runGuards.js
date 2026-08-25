// lib/payroll/runGuards.js
//
// Two questions a pay run should be asked before it becomes money, and was
// not: does this period match what the company actually agreed, and has
// somebody already been paid for it?
//
// ── Report, do not refuse — except at the last step ─────────────────────────
//
// Correction runs are real. A bonus, a missed timesheet, a fortnight somebody
// keyed in wrong: all of them are a second run over a period that already has
// one, and a payroll tool that refuses them is a payroll tool with a
// spreadsheet next to it.
//
// So an overlap is REPORTED at preview and at draft, where it is free to fix,
// and only becomes a refusal at approval — the step after which people get
// paid. A draft is a working document; an approved run is a promise.
import { payPeriodFor, isoDay, resolvePayCycle } from "@/lib/payroll/payCycle";

/**
 * Does this period line up with the company's cadence?
 *
 * Off-cycle is not wrong — see above — but it should never be SILENT, because
 * the drift this whole cycle exists to end was silent by construction: the
 * screen offered "the last fourteen days ending today" and nobody could see
 * that it had moved.
 */
export function cycleMatch(start, end, payCycle) {
  const cycle = resolvePayCycle(payCycle);
  const expected = payPeriodFor(start, cycle);
  if (!expected) return { onCycle: false, expected: null };
  const same =
    isoDay(new Date(start)) === isoDay(expected.start) &&
    isoDay(new Date(end)) === isoDay(expected.end);
  return {
    onCycle: same,
    expected: { start: isoDay(expected.start), end: isoDay(expected.end) },
  };
}

/**
 * Runs whose period overlaps this one.
 *
 * Cancelled runs are excluded: a cancelled run paid nobody, and counting it
 * would make the warning permanent for anyone who has ever cancelled one —
 * which is how a warning becomes wallpaper.
 *
 * @param {Array} runs  existing runs: { id, periodStart, periodEnd, status }
 */
export function overlappingRuns(runs, start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return (Array.isArray(runs) ? runs : []).filter((r) => {
    if (!r || r.status === "cancelled") return false;
    const rs = new Date(r.periodStart);
    const re = new Date(r.periodEnd);
    if (Number.isNaN(rs.getTime()) || Number.isNaN(re.getTime())) return false;
    // Touching at the edges is not overlapping: one period ending on the 30th
    // and the next starting on the 31st is exactly how periods tile.
    return rs <= e && re >= s;
  });
}

/** One sentence per problem, for a screen that has to explain itself. */
export function describeRunGuards({ cycle, overlaps }) {
  const out = [];
  if (cycle && !cycle.onCycle && cycle.expected) {
    out.push(
      `This period doesn't match your pay cycle — the one covering these dates runs ${cycle.expected.start} to ${cycle.expected.end}.`,
    );
  }
  for (const r of overlaps || []) {
    const when = `${isoDay(new Date(r.periodStart))} to ${isoDay(new Date(r.periodEnd))}`;
    out.push(
      r.status === "paid"
        ? `Everyone has already been PAID for ${when}. A second run over the same days pays them twice.`
        : `There is already a ${r.status} run covering ${when}.`,
    );
  }
  return out;
}
