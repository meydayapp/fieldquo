// lib/analytics/capacity.js
//
// How many jobs a company takes on — as the Settings › Overhead form sends it —
// turned into the two ForecastSettings columns PUT /api/settings/forecast
// writes. Pure, so scripts/check-costing-defaults.mjs can execute it; the
// route only calls it.

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
