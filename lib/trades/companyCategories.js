// lib/trades/companyCategories.js
//
// A company's own enabled ServiceCategory keys, read once.
//
// Split out of lib/kitchen/access.js, which was the first caller and the only
// one until this file existed. The question "which trades has this company
// switched on" is not a kitchen question — lib/settings/tradeGate.js needs
// the identical query for a screen (Material Costs) that has nothing to do
// with kitchens — so the lookup lives here and lib/kitchen/access.js imports
// it like any other caller would. Kept genuinely empty of dependencies beyond
// the database, the same reason lib/trades/catalog.js gives for importing
// nothing: neither file should ever become the thing that makes a lighter
// caller heavy.
import { db } from "@/lib/db";

/**
 * This company's enabled service categories WITH their rate overrides —
 * `[{ key, rates }]`.
 *
 * The keys alone answered "does this company sell it?". The public instant
 * estimator now also needs "and at what price?", because it prices off the
 * company's own price book rather than off a copy of it saved on the instant
 * row (see lib/estimate/instantSeed.js). `rates` is that override exactly as
 * Settings › Services & Pricing writes it, and `getPriceBook(key, rates)`
 * merges it over the code book. One query answers both questions, so the
 * public pricer doesn't make two on a homeowner's phone.
 */
export async function companyEnabledCategoryRows(companyId) {
  if (!companyId) return [];
  const rows = await db.companyServiceCategory.findMany({
    where: { companyId, enabled: true },
    select: { rates: true, category: { select: { key: true } } },
  });
  return rows
    .filter((r) => r.category?.key)
    .map((r) => ({ key: r.category.key, rates: r.rates }));
}

/** This company's enabled ServiceCategory keys. */
export async function companyEnabledCategoryKeys(companyId) {
  return (await companyEnabledCategoryRows(companyId)).map((r) => r.key);
}
