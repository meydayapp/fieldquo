// lib/team/workProfile.js
//
// Two facts about a worker that decide where their cost lands.
//
// ── They are two questions, not one dropdown ──────────────────────────────
//
// The owner's version was "admin or technician?", and the interesting case
// falls straight through it: a fitter guaranteed 37.5 hours who bills 28 is a
// technician whose last 9.5 hours behave exactly like admin. One list of three
// options cannot hold that, because it is the cross of two independent facts:
//
//   workType              is their time SUPPOSED to land on a job?
//   scheduledHoursPerWeek are they paid for a fixed week regardless?
//
// Cross them and the in-between stops being special. A field worker on a
// guaranteed week has direct labour up to the hours they logged and unabsorbed
// labour after it; an office worker is overhead either way. See
// lib/costing/utilisation.js, which is the only thing that reads the pair.
//
// ── Why not "technician" ──────────────────────────────────────────────────
//
// It reads wrong for half this product's trades — a painter, a landscaper and a
// cabinet maker are not technicians. "field" and "office" say where the cost
// goes rather than what the job is called, which is the thing being decided.

/** The two answers. Stored as these strings; the UI translates them. */
export const WORK_TYPES = ["field", "office"];

/** Longest a week can be. A guarantee above this is a typo, not a contract. */
const MAX_WEEK_HOURS = 168;

/**
 * Clean a work profile off a request body.
 *
 * @returns {{ ok: true, workType, scheduledHoursPerWeek } | { ok: false, error }}
 */
export function validateWorkProfile({ workType, scheduledHoursPerWeek } = {}) {
  // Absent means "field", because every Worker row that existed before this
  // was created by a screen that only ever added people to do jobs. A third
  // "unknown" state would be one nothing knows how to cost.
  const type = workType === undefined || workType === null || workType === "" ? "field" : String(workType);
  if (!WORK_TYPES.includes(type)) {
    return { ok: false, error: "Pick whether this person works on jobs or runs the business." };
  }

  // ── Null is a real answer and must survive ──────────────────────────────
  //
  // "Paid only for the hours they log" is the honest default and the commonest
  // arrangement in this trade. It is NOT zero, and it is NOT forty: defaulting
  // it would invent unabsorbed labour for somebody who has none, which is the
  // same refusal Salary.hoursPerWeek and ForecastSettings.jobsPerWeekCapacity
  // already make. This number ends up next to money.
  const raw = scheduledHoursPerWeek;
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, workType: type, scheduledHoursPerWeek: null };
  }

  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_WEEK_HOURS) {
    return {
      ok: false,
      error: "Guaranteed hours a week must be a number of hours, or left blank.",
    };
  }

  return { ok: true, workType: type, scheduledHoursPerWeek: Math.round(hours * 100) / 100 };
}
