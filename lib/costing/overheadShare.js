// lib/costing/overheadShare.js
//
// How much of the company's monthly fixed overhead ONE job carries — its fair
// share of the month, measured in crew TIME.
//
// ══ The owner's rule (2026-10-04) ═══════════════════════════════════════════
//
// "If a job takes 2 weeks and they only do 2 jobs a month, or have capacity
// for 3 or 4… the overhead should be based on how much work/money is coming
// in the month per company (its fair share)."
//
// So:
//
//     overhead for the job = monthly fixed overhead
//                          × (the job's crew-hours ÷ the month's crew-hour capacity)
//
// A crew-hour is one paid hour of labour — the same unit the Cost & margin
// panel's labour hours are in (lib/costing/crew.js: the pool of hours, not
// the head count). The month's capacity is ForecastSettings
// .billableHoursPerMonth: the hours the whole field crew can actually invoice
// in a month, all of them together. A two-week job for two people (160
// crew-hours) in a company whose two people can bill 320 hours a month
// carries half the month's overhead; a half-day repair carries almost none.
//
// ══ Why not overhead ÷ jobs a month any more ════════════════════════════════
//
// lib/analytics/minimumPrice.js priceFromBurn divides the month evenly over
// the jobs: a $200,000 commercial job and a $2,000 repair each carry the
// same slice. That under-loads the big job and over-loads the small one —
// the plan's decision #8. The per-job slice stays as the FALLBACK, named as
// such, for a company that has told us its jobs a month but not its hours.
//
// ══ Fallbacks — every one labelled, none invented ═══════════════════════════
//
//   per_hour      billable hours a month is set AND the job has hours: the
//                 time share above.
//   per_job       no hours a month (or a job with no hours yet), but jobs a
//                 month is set: monthly ÷ jobs a month, as before.
//   pct_of_price  neither: FALLBACK_OVERHEAD_PCT of the price, the long-
//                 standing default — the screen already says it is a guess.
//
// Absence is never padded (AGENTS.md failure class 5): no capacity is ever
// derived from a head count times a "typical" 160 hours.
//
// Pure, no imports beyond the fallback constant — imported by the browser,
// the drawing read (lib/planRead/recommendation.js) and the quote costing, so
// the three can never disagree about what a job's share is.

import { FALLBACK_OVERHEAD_PCT } from "./costingDefaults";

const finitePositive = (v) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const round2 = (n) => Math.round(n * 100) / 100;

/** The most crew-hours a month a company can say it bills: 200 people × 744 h. */
export const MAX_BILLABLE_HOURS_PER_MONTH = 150000;

/**
 * A stored or typed "billable crew hours a month" → a number, or null for "not
 * said". 0, negative, garbage and absurd values are all "not said": zero hours
 * would divide by zero, and nobody means it.
 */
export function billableHoursFrom(value) {
  const n = finitePositive(value);
  return n !== null && n <= MAX_BILLABLE_HOURS_PER_MONTH ? n : null;
}

/**
 * The company's overhead rates, from what it has told us. Pure.
 *
 * @param monthlyFixedCosts      burn.totalMonthlyCost (lib/analytics/burnRate.js)
 * @param billableHoursPerMonth  ForecastSettings.billableHoursPerMonth
 * @param jobsPerMonth           the per-job divisor priceFromBurn used
 * @returns {{ monthlyFixedCosts: number|null, billableHoursPerMonth: number|null,
 *             jobsPerMonth: number|null, perHour: number|null, perJob: number|null }}
 */
export function overheadRates({ monthlyFixedCosts, billableHoursPerMonth = null, jobsPerMonth = null } = {}) {
  const monthly = monthlyFixedCosts === null || monthlyFixedCosts === undefined ? null : Number(monthlyFixedCosts);
  const m = Number.isFinite(monthly) && monthly >= 0 ? monthly : null;
  const hours = billableHoursFrom(billableHoursPerMonth);
  const jobs = finitePositive(jobsPerMonth);
  return {
    monthlyFixedCosts: m === null ? null : round2(m),
    billableHoursPerMonth: hours,
    jobsPerMonth: jobs,
    // Unrounded on purpose: the job's share is hours × this, rounded once.
    perHour: m !== null && hours !== null ? m / hours : null,
    perJob: m !== null && jobs !== null ? m / jobs : null,
  };
}

/**
 * One job's overhead, by the rule in the header. Pure.
 *
 * @param rates     overheadRates() output (or null — nothing known)
 * @param jobHours  the job's crew-hours (labour hours on the estimate)
 * @param price     the job's price, for the pct-of-price fallback; when the
 *                  price is not known yet (a price being SOLVED for), pass
 *                  null and read `pct` — the caller solves
 *                  price = cost ÷ (1 − margin − pct/100)
 * @returns {{ amount: number|null, basis: "per_hour"|"per_job"|"pct_of_price",
 *             share: number|null, perHour: number|null, hours: number|null,
 *             perJob: number|null, pct: number|null,
 *             monthlyFixedCosts: number|null, billableHoursPerMonth: number|null,
 *             jobsPerMonth: number|null }}
 *   share = the fraction of the month's crew time the job takes (per_hour only).
 */
export function overheadForJob({ rates = null, jobHours = null, price = null, fallbackPct = FALLBACK_OVERHEAD_PCT } = {}) {
  const r = rates || {};
  const hours = finitePositive(jobHours);
  const base = {
    monthlyFixedCosts: r.monthlyFixedCosts ?? null,
    billableHoursPerMonth: r.billableHoursPerMonth ?? null,
    jobsPerMonth: r.jobsPerMonth ?? null,
    perHour: r.perHour ?? null,
    perJob: r.perJob ?? null,
  };
  if (r.perHour !== null && r.perHour !== undefined && hours !== null) {
    return {
      ...base,
      amount: round2(r.perHour * hours),
      basis: "per_hour",
      share: hours / r.billableHoursPerMonth,
      hours,
      pct: null,
    };
  }
  if (r.perJob !== null && r.perJob !== undefined) {
    return { ...base, amount: round2(r.perJob), basis: "per_job", share: null, hours, pct: null };
  }
  const pct = Number.isFinite(Number(fallbackPct)) && Number(fallbackPct) >= 0 ? Number(fallbackPct) : FALLBACK_OVERHEAD_PCT;
  const p = price === null || price === undefined ? null : Number(price);
  return {
    ...base,
    amount: p !== null && Number.isFinite(p) ? round2((Math.max(0, p) * pct) / 100) : null,
    basis: "pct_of_price",
    share: null,
    hours,
    pct,
  };
}

/**
 * The hourly floor: what every billable crew-hour has to earn, before labour
 * and materials, for the month's fixed costs to be covered — monthly fixed
 * overhead ÷ billable crew-hours. Null without both. (lib/analytics/
 * minimumPrice.js calculateHourlyFloor is the same division over a live burn,
 * with an optional profit on top.)
 */
export function overheadPerHourFloor(rates) {
  return rates?.perHour === null || rates?.perHour === undefined ? null : round2(rates.perHour);
}

/**
 * The overhead inputs a quote's costing takes, read off a calculateMinimumPrice
 * result (or the GET /api/analytics/minimum-price body, which is the same
 * object) — the ONE reading of it, used by the builder's bootstrap and by both
 * server paths that save or derive a quote's costing (app/api/quotes/
 * costingWrite.js, lib/costing/quoteCostEstimate.js). Three copies of "is
 * costPerJob usable" are how the panel and the saved row would come to
 * disagree by a basis.
 *
 *   overheadPerJob        costPerJob, only on an answer that is not a refusal
 *                         — exactly the test each caller used to make inline.
 *   overheadPerHour       monthly fixed costs ÷ billable crew-hours, unrounded
 *                         so the job's share is rounded once (overheadForJob).
 *                         Present even on a needsCapacity refusal: a company
 *                         that told us its hours but not its jobs a month still
 *                         has a time share.
 *   billableHoursPerMonth the divisor, for the panel's explanation.
 *   monthlyFixedCosts     the dividend, likewise.
 *
 * Every field null when the answer did not say it. Pure.
 */
export function overheadInputsFrom(min) {
  const m = min && typeof min === "object" ? min : {};
  const perJob = !m.error && Number.isFinite(Number(m.costPerJob)) && m.costPerJob !== null ? Number(m.costPerJob) : null;
  const perHour = finitePositive(m.overheadPerHour);
  const hours = billableHoursFrom(m.billableHoursPerMonth);
  const monthly =
    m.monthlyFixedCosts === null || m.monthlyFixedCosts === undefined || !Number.isFinite(Number(m.monthlyFixedCosts))
      ? null
      : Number(m.monthlyFixedCosts);
  return {
    overheadPerJob: perJob,
    // A rate without the hours it was divided by is not one we can explain,
    // and is not one this module produced — so both or neither.
    overheadPerHour: perHour !== null && hours !== null ? perHour : null,
    billableHoursPerMonth: perHour !== null && hours !== null ? hours : null,
    monthlyFixedCosts: monthly,
  };
}
