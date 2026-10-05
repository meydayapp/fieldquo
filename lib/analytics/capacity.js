// lib/analytics/capacity.js
//
// How many jobs a company takes on — as the Settings › Overhead form sends it —
// turned into the two ForecastSettings columns PUT /api/settings/forecast
// writes. Pure, so scripts/check-costing-defaults.mjs can execute it; the
// route only calls it.

import { billableHoursFrom, MAX_BILLABLE_HOURS_PER_MONTH } from "@/lib/costing/overheadShare";

/** 200 a week × 4.33, rounded up: the monthly ceiling matches the weekly one. */
export const MAX_JOBS_PER_MONTH = 900;

/**
 * The capacity the form sent, as `{ week, month }` to write — or `{ error }`.
 *
 * Per week (`jobsPerWeekCapacity`): 1–200 whole jobs, or null/"" to clear it,
 * exactly as the route always took it — including refusing a body that says
 * nothing about capacity at all, rather than reading silence as "clear". The
 * monthly column is cleared, so an old "4 a month" can't keep winning over
 * the newer weekly answer.
 *
 * Per month (`jobsPerMonthCapacity`, when present and not blank): 1–900 whole
 * jobs, kept as typed — lib/analytics/minimumPrice.js divides by it directly.
 * The weekly column is still written, rounded and at least 1, because it is
 * what "has this company set a capacity?" has always been read from; it is
 * never the divisor while the monthly one is set.
 *
 * `week: 0` means "unknown" — see the route's upsert for why 0 and not a
 * missing field (Prisma would otherwise apply @default(3)).
 */
export function parseCapacity(body) {
  const monthRaw = body?.jobsPerMonthCapacity;
  if (monthRaw !== undefined && monthRaw !== null && monthRaw !== "") {
    const n = Number(monthRaw);
    if (!Number.isInteger(n) || n < 1 || n > MAX_JOBS_PER_MONTH) {
      return { error: `Jobs per month must be a whole number between 1 and ${MAX_JOBS_PER_MONTH}.` };
    }
    return { week: Math.min(200, Math.max(1, Math.round(n / 4.33))), month: n };
  }
  const raw = body?.jobsPerWeekCapacity;
  const value = raw === null || raw === "" ? null : Number(raw);
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 200)) {
    return { error: "Jobs per week must be a whole number between 1 and 200." };
  }
  return { week: value === null ? 0 : value, month: null };
}

/**
 * Billable crew hours a month (ForecastSettings.billableHoursPerMonth), as the
 * Settings › Overhead form sends it — `{ value }` to write, `{ skip: true }`,
 * or `{ error }`.
 *
 * Same three states as the target margin beside it: `undefined` is a client
 * that did not mention it (an older screen saving capacity alone) and the
 * column is left as it is; null / "" clears it, and a quote's overhead goes
 * back to the per-job split, labelled; anything else must be a positive
 * number of hours no larger than MAX_BILLABLE_HOURS_PER_MONTH. Rejected
 * rather than clamped: 0 would divide the month by nothing, and a capped
 * figure is one the owner never typed. Rounded to the column's two places
 * before the bound is re-checked, so 0.001 is refused rather than stored as 0.
 * The bound is billableHoursFrom's — the one the costing reads it back through
 * — so nothing can be saved that the costing would then ignore.
 */
export function parseBillableHours(raw) {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === "") return { value: null };
  const error = `Billable crew hours a month must be a number of hours above 0 and no more than ${MAX_BILLABLE_HOURS_PER_MONTH.toLocaleString("en-US")} — or blank if you'd rather not say.`;
  if (typeof raw !== "number" && typeof raw !== "string") return { error };
  const n = billableHoursFrom(typeof raw === "string" ? raw.trim() : raw);
  if (n === null) return { error };
  const rounded = Math.round(n * 100) / 100;
  return billableHoursFrom(rounded) === null ? { error } : { value: rounded };
}
