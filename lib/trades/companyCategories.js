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

/** This company's enabled ServiceCategory keys. */
export async function companyEnabledCategoryKeys(companyId) {
  if (!companyId) return [];
  const rows = await db.companyServiceCategory.findMany({
    where: { companyId, enabled: true },
    select: { category: { select: { key: true } } },
  });
  return rows.map((r) => r.category?.key).filter(Boolean);
}
