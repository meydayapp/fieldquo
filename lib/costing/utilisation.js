// lib/costing/utilisation.js
//
// The hours you paid for that never reached a job.
//
// ══ Why this number does not exist anywhere else ═══════════════════════════
//
// A contractor who guarantees somebody 37.5 hours and gets 28 hours of job time
// out of the week has paid for 9.5 hours of nothing in particular. Those hours
// are a real cost and they behave exactly like overhead — but nothing in the
// product could see them, because the two halves lived in different places:
// `TimeEntry` knows the hours that reached a job, and until `Worker`
// carried a guaranteed week there was nothing to compare them against.
//
// The consequence was quiet and expensive. A job costed at 28 hours looks like
// it cost 28 hours. The other 9.5 came out of the same bank account and
// appeared in no margin, no price floor and no report.
//
// ══ It REPORTS, and deliberately does not reprice ══════════════════════════
//
// The obvious next step — add unabsorbed labour to the monthly burn so
// `costPerJob` and the minimum price rise — is not taken here, and that is a
// decision rather than an omission. This figure is only as good as the time
// entries behind it, and a company whose crew logs time patchily would see
// most of the week as "unabsorbed" and price themselves out of work on data
// nobody has checked yet. So it is shown first. Wiring it into
// lib/analytics/burnRate.js is one addition when the number has been believed
// for a month or two, and there is a note there pointing here.
//
// ══ The absence rules, which are the same ones the rest of costing uses ════
//
// Every field is null when its input is missing, never zero:
//
//   • No guaranteed week      → this person is paid for what they log. There is
//                               no gap to report, which is different from a gap
//                               of zero.
//   • No hourly rate          → hours are known, money is not. Reported as
//                               hours with a null cost and counted in
//                               `unrated`, never folded in as free.
//   • Office worker           → excluded outright. Their whole cost is overhead
//                               already; asking what share of a bookkeeper's
//                               Tuesday belongs to a job is the wrong question.
//
// A total that had to leave somebody out says so, for the same reason
// actualJobCost reports `incomplete` rather than presenting a partial sum as
// final.

/** Weeks in a period, as a fraction. 7 days = 1, 30 days ≈ 4.29. */
export function weeksBetween(from, to) {
  const a = from instanceof Date ? from.getTime() : Date.parse(from);
  const b = to instanceof Date ? to.getTime() : Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return (b - a) / (7 * 24 * 60 * 60 * 1000);
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;

/** Is this a real, usable number rather than null/""/undefined/NaN? */
function set(v) {
  if (v === null || v === undefined || v === "") return false;
  return Number.isFinite(Number(v));
}

/**
 * Scheduled hours vs hours that reached a job, per worker.
 *
 * Pure — hand it rows, it answers. Nothing here reads the database, so the
 * check script drives every branch without one.
 *
 * @param workers      [{ id, name, workType, scheduledHoursPerWeek, hourlyRate }]
 * @param jobHoursById { [workerId]: approved hours logged AGAINST A JOB }
 * @param weeks        weeks in the period (see weeksBetween)
 */
export function labourUtilisation({ workers = [], jobHoursById = {}, weeks = 0 } = {}) {
  const rows = [];
  let unabsorbedCost = 0;
  let unratedWorkers = 0;
  let noScheduleWorkers = 0;
  let anyCost = false;

  for (const w of Array.isArray(workers) ? workers : []) {
    if (!w || !w.id) continue;
    // Office time is overhead in full. There is no "utilisation" question to
    // ask about it, and putting them in the table with a 100% gap would read
    // as a problem rather than as how they are employed.
    if (w.workType === "office") continue;

    const jobHours = round2(num(jobHoursById?.[w.id]));
    const hasSchedule = set(w.scheduledHoursPerWeek) && num(w.scheduledHoursPerWeek) > 0;
    const scheduled = hasSchedule ? round2(num(w.scheduledHoursPerWeek) * num(weeks)) : null;

    if (!hasSchedule) noScheduleWorkers += 1;

    // Clamped at zero in both directions and reported separately. Somebody who
    // worked 45 hours against a 37.5 week has no unabsorbed time and an
    // overtime problem, and one number cannot say both.
    const unabsorbedHours = scheduled === null ? null : round2(Math.max(0, scheduled - jobHours));
    const overHours = scheduled === null ? null : round2(Math.max(0, jobHours - scheduled));

    const hasRate = set(w.hourlyRate);
    if (scheduled !== null && !hasRate) unratedWorkers += 1;

    const cost =
      unabsorbedHours === null || !hasRate ? null : round2(unabsorbedHours * num(w.hourlyRate));
    if (cost !== null) {
      unabsorbedCost += cost;
      anyCost = true;
    }

    rows.push({
      workerId: w.id,
      name: w.name || null,
      scheduledHours: scheduled,
      jobHours,
      unabsorbedHours,
      overHours,
      unabsorbedCost: cost,
      // Why this row has no money on it, so the screen can say which of the two
      // it is rather than showing a blank.
      missing: scheduled === null ? "schedule" : !hasRate ? "rate" : null,
    });
  }

  rows.sort((a, b) => (b.unabsorbedCost ?? -1) - (a.unabsorbedCost ?? -1));

  return {
    rows,
    // Null, not 0, when nothing could be costed at all — "nobody is unabsorbed"
    // and "we could not work it out for anybody" are different sentences.
    unabsorbedCost: anyCost ? round2(unabsorbedCost) : null,
    unabsorbedHours: rows.reduce((s, r) => s + (r.unabsorbedHours ?? 0), 0),
    // The total is short by this many people. Reported so the figure is never
    // presented as the whole picture when it isn't.
    unratedWorkers,
    noScheduleWorkers,
    incomplete: unratedWorkers > 0,
  };
}
