// lib/analytics/minimumPrice.js
// lib/analytics/minimumPrice.js
//
// The lowest price a job can go out at and still cover the business.
//
// ── Why capacity is not defaulted ───────────────────────────────────────────
//
// This read `forecast?.jobsPerWeekCapacity || 3`, and nothing in the product
// could set that field — there was no Forecast Settings screen, despite the
// error message below naming one. So every company's minimum price was computed
// against an invented capacity of three jobs a week.
//
// That is the worst version of padding absent data with a default: the output is
// a PRICE FLOOR. A contractor who priced a job against it was pricing against a
// number FieldQuo made up, and nothing on the way told them so.
//
// Capacity is now required. No capacity means no answer, and the caller says so.
import { db } from "@/lib/db";
import { calculateBurnRate } from "./burnRate";

// ── Why the margin is clamped ───────────────────────────────────────────────
//
// The price is `cost / (1 - margin)`. At a margin of 1 that divides by zero and
// returns Infinity; above 1 it returns a NEGATIVE price; a non-numeric margin
// returns NaN, which serialises to `null` and renders as "$0". All three were
// reachable from `?targetMargin=` on /api/analytics/minimum-price with no
// validation anywhere between the query string and the number a contractor
// quotes against. 0.95 is the ceiling — a 95% margin is already absurd, and
// past it the formula stops describing anything real.
const MAX_TARGET_MARGIN = 0.95;

export function normaliseTargetMargin(value, fallback = 0.2) {
  // Absent is not zero. `Number(null)` and `Number("")` are both 0, which is a
  // legitimate margin (price at cost) — so "no margin given" has to be caught
  // before the conversion, or an omitted query parameter would quietly mean
  // "quote every job at break-even".
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, MAX_TARGET_MARGIN);
}

export async function calculateMinimumPrice({ companyId, targetMargin = 0.2 }) {
  const margin = normaliseTargetMargin(targetMargin);
  const [burn, forecast] = await Promise.all([
    calculateBurnRate({ companyId, cashOnHand: null }),
    db.forecastSettings.findUnique({ where: { companyId } }),
  ]);

  const capacity = Number(forecast?.jobsPerWeekCapacity || 0);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return {
      needsCapacity: true,
      error:
        "Tell us how many jobs a week you can take on and we'll work out your minimum price. Without it there's nothing to divide your overhead by.",
    };
  }

  const jobsPerMonth = capacity * 4.33;

  if (jobsPerMonth <= 0) {
    return {
      needsCapacity: true,
      error:
        "Tell us how many jobs a week you can take on and we'll work out your minimum price.",
    };
  }

  const costPerJob = burn.totalMonthlyBurn / jobsPerMonth;
  const minimumPrice = costPerJob / (1 - margin);

  return {
    monthlyFixedCosts: burn.totalMonthlyBurn,
    jobsPerMonth: Math.round(jobsPerMonth * 10) / 10,
    costPerJob: Math.round(costPerJob * 100) / 100,
    targetMargin: margin,
    minimumPrice: Math.round(minimumPrice * 100) / 100,
    // What the three sections of Settings → Overhead each contribute, so the
    // screen can show WHY the floor is what it is. A contractor who sees only
    // a total has no way to tell a mis-typed rent from a real one.
    breakdown: burn.breakdown,
  };
}

/**
 * The lowest HOURLY rate that still covers the business.
 *
 * ── Why this is separate from the per-job floor above ──────────────────────
 *
 * The per-job version divides overhead by jobs-per-week, which only works when
 * jobs are roughly the same size. Cleaning, detailing and any labour-priced
 * trade aren't like that: they charge per hour, per person, and a two-hour job
 * with two cleaners is four billable hours out of a finite monthly supply.
 *
 * So this divides by BILLABLE HOURS instead:
 *
 *     (monthly costs + the profit you want) ÷ billable hours a month
 *
 * A contractor who skips this and copies a competitor's rate has no idea
 * whether they're profitable — that's the single most common way a cleaning
 * business runs busy and broke.
 *
 * ── Billable hours are not worked hours ────────────────────────────────────
 *
 * Drive time, quoting, admin and the hour spent at the supplier are all real
 * and none of them are billable. Asking for "hours you can actually invoice"
 * rather than "hours you work" is the difference between a floor that holds and
 * one that's 30% too low — which is worse than no floor at all, because it
 * comes with confidence.
 *
 * @param billableHoursPerMonth  hours they can actually invoice
 * @param desiredMonthlyProfit   what they want to clear, on top of costs
 * @param crewSize               people on a typical job. The returned
 *                               `perCleanerRate` is what to charge PER PERSON
 *                               per hour, which is how the trade quotes it.
 */
export async function calculateHourlyFloor({
  companyId,
  billableHoursPerMonth,
  desiredMonthlyProfit = 0,
  crewSize = 1,
}) {
  const burn = await calculateBurnRate({ companyId, cashOnHand: null });

  const hours = Number(billableHoursPerMonth);
  if (!Number.isFinite(hours) || hours <= 0) {
    // Same rule as the per-job floor: no invented default. The output is a
    // PRICE, and a price computed against a number we made up is worse than no
    // answer, because nothing on the way tells them so.
    return {
      needsHours: true,
      error:
        "Tell us how many hours a month you can actually invoice — not hours worked, since drive time and quoting aren't billable — and we'll work out your floor.",
    };
  }

  const profit = Math.max(0, Number(desiredMonthlyProfit) || 0);
  const crew = Math.max(1, Math.floor(Number(crewSize) || 1));

  const hourlyFloor = (burn.totalMonthlyBurn + profit) / hours;

  return {
    monthlyFixedCosts: Math.round(burn.totalMonthlyBurn * 100) / 100,
    desiredMonthlyProfit: profit,
    billableHoursPerMonth: hours,
    // What the JOB has to earn per hour.
    hourlyFloor: Math.round(hourlyFloor * 100) / 100,
    crewSize: crew,
    // What to charge per person per hour — how the trade actually quotes, and
    // the number a cleaner compares against "$35–$75 per cleaner".
    perCleanerRate: Math.round((hourlyFloor / crew) * 100) / 100,
  };
}
