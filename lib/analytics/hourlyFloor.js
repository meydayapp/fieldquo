// lib/analytics/hourlyFloor.js
//
// The HOURLY price floor, and the quote check that reads it.
//
// ── Why this exists (owner, 2026-10-03) ─────────────────────────────────────
//
// lib/analytics/minimumPrice.js has carried calculateHourlyFloor for months
// with no caller, so a trade priced by the hour — an electrician at $80 an
// hour, a cleaner at $65 — could quote below what an hour of the business
// costs and nothing said so. The per-JOB floor already reaches every quote
// (its cost per job is the overhead line of the Cost & margin panel, which
// turns the margin badge red — "losing money"); this is the same idea per
// invoiced hour, and it is mirrored the same way: a warning in the quote
// builder, never a block, never a changed price.
//
// ── The inputs, and which of them is a default ──────────────────────────────
//
//   monthly costs   the cost basis of Settings → Overhead (calculateBurnRate's
//                   totalMonthlyCost — fixed costs, salaries, debt interest,
//                   depreciation), the same figure the per-job floor divides.
//   billable hours  ForecastSettings.billableHoursPerMonth, the owner's own
//                   answer on Settings → Overhead: hours the business can
//                   INVOICE in a month, across everyone. NOT defaulted — no
//                   answer, no floor (calculateHourlyFloor's own rule: a price
//                   floor computed against a number we made up is worse than
//                   none). The builder then says where to set it.
//   profit          $0 — FieldQuo's default, said in the warning: the floor is
//                   BREAK-EVEN, "below cost" in the owner's words. Nothing
//                   stores a desired monthly profit; inventing one would be
//                   the padding AGENTS.md failure class 5 names.
//   crew            1 — an hourly line's quantity is invoiced person-hours, so
//                   the floor per invoiced hour is the figure to compare.
//
// Pure — no database. scripts/check-hourly-floor.mjs executes it.

import { isHourUnit } from "@/lib/invoices/labourRates";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(num(n) * 100) / 100;

/**
 * The most billable hours a month the form accepts. The figure is the WHOLE
 * crew's together (the floor divides the month's costs by every invoiced
 * person-hour — see the header), so it is not bounded by one person's month:
 * 744 (a 31-day month of one person) silently refused a real answer from any
 * crew of five or more. 20,000 is a crew of well over a hundred billing full
 * time; above it is a typo.
 */
export const MAX_BILLABLE_HOURS_PER_MONTH = 20000;

/**
 * A stored billable-hours answer, or null when there isn't a usable one.
 * Null, "", 0, negative, NaN, above MAX_BILLABLE_HOURS_PER_MONTH: all "not said".
 */
export function billableHoursFrom(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= MAX_BILLABLE_HOURS_PER_MONTH ? n : null;
}

/**
 * What the settings form posted, as the column stores it — or an error.
 * `undefined` = not mentioned (leave the column); null / "" = clear it.
 */
export function parseBillableHours(raw) {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === "") return { value: null };
  if (typeof raw !== "number" && typeof raw !== "string") return { error: true };
  const n = Number(typeof raw === "string" ? raw.trim() : raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_BILLABLE_HOURS_PER_MONTH) return { error: true };
  return { value: n };
}

/**
 * The arithmetic of calculateHourlyFloor, without the database — the same
 * formula, the same rounding, so the route and the check run one function.
 * Returns null when there are no usable hours (the caller says why).
 */
export function hourlyFloorFromCost({ totalMonthlyCost, billableHoursPerMonth, desiredMonthlyProfit = 0, crewSize = 1 }) {
  const hours = Number(billableHoursPerMonth);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  const cost = num(totalMonthlyCost);
  const profit = Math.max(0, Number(desiredMonthlyProfit) || 0);
  const crew = Math.max(1, Math.floor(Number(crewSize) || 1));
  const hourlyFloor = (cost + profit) / hours;
  return {
    monthlyFixedCosts: round2(cost),
    desiredMonthlyProfit: profit,
    billableHoursPerMonth: hours,
    hourlyFloor: round2(hourlyFloor),
    crewSize: crew,
    perCleanerRate: round2(hourlyFloor / crew),
  };
}

/**
 * A quote's hourly lines against the floor.
 *
 * Lines billed by the hour (any spelling isHourUnit accepts) are summed: the
 * floor is per invoiced hour across the business, so a $40 helper hour beside
 * a $120 lead hour is judged on their average, not on the helper alone. A
 * line with no positive quantity counts nowhere. Optional add-ons the client
 * has not taken are the caller's to leave out.
 *
 * @returns null when the quote has no hourly line or there is no floor;
 *          otherwise { hours, amount, rate, floor, below, gapPerHour, gapTotal }
 */
export function checkHourlyFloor(lines, floor) {
  const f = num(floor);
  if (!(f > 0)) return null;
  let hours = 0;
  let amount = 0;
  for (const l of Array.isArray(lines) ? lines : []) {
    if (!l || typeof l !== "object" || !isHourUnit(l.unit)) continue;
    const q = num(l.quantity);
    if (!(q > 0)) continue;
    hours += q;
    // The line's amount when it states one, else quantity × rate.
    const a = l.amount !== undefined && l.amount !== null && l.amount !== "" ? num(l.amount) : q * num(l.rate);
    amount += a;
  }
  if (!(hours > 0)) return null;
  const rate = round2(amount / hours);
  const below = rate < f;
  return {
    hours: round2(hours),
    amount: round2(amount),
    rate,
    floor: round2(f),
    below,
    gapPerHour: below ? round2(f - rate) : 0,
    gapTotal: below ? round2((f - rate) * hours) : 0,
  };
}

/** Does any line on the quote bill by the hour? (The "set your hours" hint.) */
export function hasHourlyLine(lines) {
  return (Array.isArray(lines) ? lines : []).some((l) => l && isHourUnit(l.unit) && num(l.quantity) > 0);
}
