// lib/platform/metricsScope.js
//
// Which companies a FieldQuo number counts. One answer, used everywhere.
//
// ══ Why one file (owner, 2026-10-03) ═══════════════════════════════════════
//
// Demos (Company.isDemo — FieldQuo's own sales fixtures) were left out of the
// dashboard by a `NOT_DEMO = { isDemo: false }` constant re-declared in six
// files, plus `bucket !== "demo"` in three routes and `"isDemo" = false` in
// two raw queries. The owner then asked for a second kind of company to leave
// out — a TEST company, marked by a superadmin on /platform/companies/[id]
// (the owner's live payment tests, a QA account). Adding `isTestCompany:
// false` beside each of those eleven copies is exactly how the twelfth one
// gets forgotten, so they all read from here now, and a third kind later is
// one line.
//
// ══ What it is NOT ═════════════════════════════════════════════════════════
//
// A metrics filter, never a behaviour switch. A test company keeps working:
// its trial reminders, its billing, its crons and its emails are untouched —
// those routes keep their own `isDemo` checks (a demo has nobody to write
// to; a test company does). Only the numbers FieldQuo reads about itself
// leave it out.
//
// Pure and import-free so a client page can import it too.

/**
 * The Prisma `where` fragment for "a company FieldQuo's numbers count".
 * Spread it into a company where, or nest it under a relation:
 *
 *     db.company.count({ where: { ...METRICS_COMPANY_WHERE, ... } })
 *     db.quote.findMany({ where: { company: METRICS_COMPANY_WHERE } })
 *
 * Both columns are non-null booleans, so `false` is exact — no NULL branch.
 */
export const METRICS_COMPANY_WHERE = Object.freeze({ isDemo: false, isTestCompany: false });

/** The columns countsInMetrics reads — spread into any select that feeds it. */
export const METRICS_COMPANY_SELECT = Object.freeze({ isDemo: true, isTestCompany: true });

/**
 * The same rule over a row already in memory.
 *
 * A row that does not carry the columns is refused by name rather than read
 * as "counts": an unselected `isTestCompany` is undefined, and undefined
 * reading as "not a test" is how a test company quietly lands back in MRR.
 */
export function countsInMetrics(company) {
  if (!company) return false;
  if (company.isDemo === undefined || company.isTestCompany === undefined) {
    throw new Error("countsInMetrics: select isDemo and isTestCompany (METRICS_COMPANY_SELECT) — a missing column is not 'counts'");
  }
  return company.isDemo !== true && company.isTestCompany !== true;
}

/**
 * The subscriber-book buckets that stand for "not counted" — the two kinds
 * above, as lib/platform/trialCounting.js subscriberBucket names them.
 * (lib/platform/subscriberBuckets.js holds the full bucket list.)
 */
export const METRICS_EXCLUDED_BUCKETS = Object.freeze(["demo", "test"]);

export const isMetricsBucket = (bucket) => Boolean(bucket) && !METRICS_EXCLUDED_BUCKETS.includes(bucket);
