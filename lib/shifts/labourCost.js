// lib/shifts/labourCost.js
//
// What the rota COSTS before it is published: scheduled hours per person for
// the week, which of them are overtime, and the money — so a manager sees
// "this week: $4,120, Marc is at 46 h" while the shifts are still drafts,
// not on the pay run a fortnight later.
//
// Pure. The hours come from lib/shifts/coverage.js's scheduledMinutes (net of
// unpaid breaks, the same arithmetic the coverage strip uses) and the
// overtime split and multiplier are IMPORTED from lib/payroll/computePayRun.js
// rather than restated: a scheduler that priced overtime at 1.5 while payroll
// paid 1.5 would agree today and drift the day either changed. The figure
// here is the figure the pay run will compute, by construction.
//
// ── A missing rate is named, never zero ─────────────────────────────────────
//
// Worker.hourlyRate is nullable and null means "not set", not "$0/h". A cost
// line that silently treated it as zero would show a week costing $1,900 when
// three of the five people are simply unpriced — the padding failure
// AGENTS.md lists fifth. So the total covers the priced people only, and the
// unpriced ones come back by name in `missingRate` for the screen to say.
//
// Who may SEE the money is not decided here: the route omits every rate
// unless canSeeAllPay (lib/permissions/enforce.js), and with no rates this
// module returns hours and an empty cost, which is what a dispatcher without
// payroll access is shown.

import { scheduledMinutes } from "@/lib/shifts/coverage";
import { DEFAULT_OT_THRESHOLD_WEEKLY, OVERTIME_MULTIPLIER, splitOvertime } from "@/lib/payroll/computePayRun";

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function money(n) {
  return Math.round((num(n) + Number.EPSILON) * 100) / 100;
}
function hours2(n) {
  return Math.round((num(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Scheduled minutes per worker inside a range, net of unpaid breaks.
 * Drafts count — the whole point is seeing the cost BEFORE publishing.
 *
 * @returns {Object<string, number>} workerId → minutes
 */
export function minutesByWorker(shifts, rangeStart, rangeEnd) {
  const byWorker = {};
  for (const s of Array.isArray(shifts) ? shifts : []) {
    if (!s?.workerId) continue;
    (byWorker[s.workerId] ||= []).push(s);
  }
  const out = {};
  for (const [workerId, list] of Object.entries(byWorker)) {
    out[workerId] = scheduledMinutes(list, rangeStart, rangeEnd);
  }
  return out;
}

/**
 * The week's cost, per person and in total.
 *
 * @param {object} p
 * @param {Object<string, number>} p.minutes     workerId → scheduled minutes this week
 * @param {Array}  p.workers                     [{ id, name, hourlyRate? }] — hourlyRate
 *                                               absent/null means "not set"
 * @param {number} [p.thresholdWeekly]           overtime after this many hours
 * @returns {{
 *   thresholdWeekly: number,
 *   multiplier: number,
 *   rows: Array<{ workerId, name, hours, regularHours, overtimeHours,
 *                 overtime: boolean, rate: number|null, cost: number|null }>,
 *   total: number|null,        null when NOBODY is priced
 *   regularCost: number, overtimeCost: number,
 *   pricedHours: number,       hours the total actually covers
 *   missingRate: Array<{ workerId, name, hours }>   scheduled people with no rate
 * }}
 */
export function weeklyLabourCost({ minutes = {}, workers = [], thresholdWeekly = DEFAULT_OT_THRESHOLD_WEEKLY } = {}) {
  const threshold = Math.max(0, num(thresholdWeekly, DEFAULT_OT_THRESHOLD_WEEKLY));
  const byId = new Map((Array.isArray(workers) ? workers : []).map((w) => [String(w.id), w]));
  const rows = [];
  const missingRate = [];
  let regularCost = 0;
  let overtimeCost = 0;
  let pricedHours = 0;
  let priced = 0;

  for (const [workerId, mins] of Object.entries(minutes || {})) {
    const w = byId.get(String(workerId)) || { id: workerId, name: "" };
    const hours = hours2(Math.max(0, num(mins)) / 60);
    const { regularHours, overtimeHours } = splitOvertime(hours, { weeks: 1, thresholdWeekly: threshold });
    const rate = w.hourlyRate == null || w.hourlyRate === "" ? null : num(w.hourlyRate, NaN);
    const hasRate = rate != null && Number.isFinite(rate) && rate >= 0;
    let cost = null;
    if (hasRate) {
      const reg = money(regularHours * rate);
      const ot = money(overtimeHours * money(rate * OVERTIME_MULTIPLIER));
      cost = money(reg + ot);
      regularCost += reg;
      overtimeCost += ot;
      pricedHours += hours;
      priced += 1;
    } else if (hours > 0) {
      missingRate.push({ workerId, name: w.name || "", hours });
    }
    rows.push({
      workerId,
      name: w.name || "",
      hours,
      regularHours,
      overtimeHours,
      overtime: overtimeHours > 0,
      rate: hasRate ? rate : null,
      cost,
    });
  }

  rows.sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  return {
    thresholdWeekly: threshold,
    multiplier: OVERTIME_MULTIPLIER,
    rows,
    total: priced > 0 ? money(regularCost + overtimeCost) : null,
    regularCost: money(regularCost),
    overtimeCost: money(overtimeCost),
    pricedHours: hours2(pricedHours),
    missingRate,
  };
}

/**
 * One day's cost: the day's minutes priced at each person's rate, with the
 * overtime portion decided by WHERE IN THE WEEK the day's hours fall — the
 * hours a person has already been scheduled earlier in the week fill the
 * regular bucket first. Monday's eight hours are regular; Saturday's eight,
 * after forty Monday-to-Friday, are all overtime.
 *
 * @param {object} p
 * @param {Object<string, number>} p.dayMinutes      workerId → minutes on the day
 * @param {Object<string, number>} p.weekMinutesBefore workerId → minutes scheduled
 *                                                   in the week BEFORE this day
 */
export function dailyLabourCost({ dayMinutes = {}, weekMinutesBefore = {}, workers = [], thresholdWeekly = DEFAULT_OT_THRESHOLD_WEEKLY } = {}) {
  const threshold = Math.max(0, num(thresholdWeekly, DEFAULT_OT_THRESHOLD_WEEKLY));
  const byId = new Map((Array.isArray(workers) ? workers : []).map((w) => [String(w.id), w]));
  let total = 0;
  let priced = 0;
  const missingRate = [];
  let overtimeHours = 0;
  for (const [workerId, mins] of Object.entries(dayMinutes || {})) {
    const hours = hours2(Math.max(0, num(mins)) / 60);
    if (hours <= 0) continue;
    const before = hours2(Math.max(0, num(weekMinutesBefore?.[workerId])) / 60);
    const regularRoom = Math.max(0, threshold - before);
    const regular = Math.min(hours, regularRoom);
    const ot = hours2(hours - regular);
    overtimeHours += ot;
    const w = byId.get(String(workerId)) || { id: workerId, name: "" };
    const rate = w.hourlyRate == null || w.hourlyRate === "" ? null : num(w.hourlyRate, NaN);
    if (rate == null || !Number.isFinite(rate) || rate < 0) {
      missingRate.push({ workerId, name: w.name || "", hours });
      continue;
    }
    total += money(regular * rate) + money(ot * money(rate * OVERTIME_MULTIPLIER));
    priced += 1;
  }
  return {
    total: priced > 0 ? money(total) : null,
    overtimeHours: hours2(overtimeHours),
    missingRate,
  };
}
