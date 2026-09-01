// lib/costing/equipmentUsage.js
//
// What a job's LOGGED equipment use is worth, in depreciation terms — the raw
// allocation only. See lib/costing/actualJobCost.js for the rule that decides
// whether this is safe to add to a job's cost (short version: usually not —
// see the double-count note there).
//
// Pure. No database, no `t()`, no `new Date()` without an argument — same
// discipline lib/accounting/depreciation.js keeps, for the same reason:
// scripts/check-job-costing.mjs and scripts/check-depreciation.mjs execute
// this against hostile input (zero-life assets, disposed-mid-job assets,
// assets on two jobs the same day) without a database.
import { assetCharge } from "@/lib/accounting/depreciation";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => {
  const r = Math.round(num(v) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};

// Average days in a month — 365.25 / 12, the same averaging payroll and
// accounting systems use to turn a monthly figure into a daily one, rather
// than a flat 30 that would systematically over-charge February and
// under-charge August.
const AVG_DAYS_PER_MONTH = 365.25 / 12;

// A logged day with NO hours recorded charges as a FULL day. AssetUseLog.hours
// is optional on purpose — "the rig was on this job" is worth recording even
// when nobody timed it — and a blank duration reads as "it was there all day",
// not as zero. A day WITH hours recorded charges the fraction of a standard
// field-service day (8 hours) those hours represent, capped at one full day:
// an 11-hour day on the tools does not charge 1.4 days of wear.
export const STANDARD_WORKDAY_HOURS = 8;

/**
 * One asset's current per-day depreciation charge — its monthly charge
 * (lib/accounting/depreciation.js#assetCharge) spread across an average
 * month. Zero, with a `reason`, for anything not currently chargeable
 * (disposed, fully depreciated, not yet in service, incomplete data) — the
 * exact reason vocabulary assetCharge already returns, so a screen can
 * explain a $0 the same way Settings → Overhead does for the same asset.
 *
 * @param asset  { cost, salvageValue, inServiceDate, usefulLifeMonths,
 *                 disposedOn, active } — the same shape assetCharge expects
 * @param asOf   the moment to value it at, always passed, never defaulted
 *               inside the maths
 */
export function dailyAssetRate(asset, asOf) {
  const charge = assetCharge(asset, asOf);
  if (!charge.chargeable) return { rate: 0, reason: charge.reason };
  return { rate: charge.monthly / AVG_DAYS_PER_MONTH, reason: "in_service" };
}

/**
 * What one job's logged equipment use is worth right now, from a set of
 * AssetUseLog rows.
 *
 * Two logs for the SAME asset on the SAME job (an asset used two separate
 * days) sum normally. Two logs for the SAME asset on the SAME DAY but
 * DIFFERENT jobs are each priced independently and correctly here — this
 * function only ever sees one job's rows, so it has no way to double-book a
 * day across jobs, and it does not try to detect that a company's crew
 * physically cannot have the same compressor on two sites at once. That is an
 * honesty gap worth naming (see docs/SAFETY-AND-EQUIPMENT.md) rather than a
 * bug this file can fix: nothing here knows which OTHER jobs an asset was
 * logged against.
 *
 * @param {object[]} useLogs  rows for this job, each { hours, asset } where
 *                            `asset` is the full Asset row assetCharge needs
 * @param {Date}     asOf     the moment to value every asset at
 */
export function equipmentCostForJob({ useLogs = [], asOf } = {}) {
  const rows = Array.isArray(useLogs) ? useLogs : [];
  const now = asOf instanceof Date ? asOf : new Date();

  const byAsset = new Map();
  let total = 0;

  for (const row of rows) {
    const asset = row?.asset;
    if (!asset?.id) continue;

    const { rate, reason } = dailyAssetRate(asset, now);
    const hours =
      row?.hours === null || row?.hours === undefined || row?.hours === ""
        ? null
        : num(row.hours);
    const dayFraction =
      hours === null ? 1 : Math.min(1, Math.max(0, hours / STANDARD_WORKDAY_HOURS));
    const charge = round2(rate * dayFraction);

    const existing = byAsset.get(asset.id);
    if (existing) {
      existing.days = round2(existing.days + dayFraction);
      existing.cost = round2(existing.cost + charge);
    } else {
      byAsset.set(asset.id, {
        assetId: asset.id,
        name: asset.name || null,
        days: round2(dayFraction),
        cost: charge,
        chargeable: rate > 0,
        reason,
      });
    }
    total += charge;
  }

  return {
    total: round2(total),
    byAsset: [...byAsset.values()].sort((a, b) => b.cost - a.cost),
  };
}
