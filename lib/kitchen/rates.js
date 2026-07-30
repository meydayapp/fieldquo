// lib/kitchen/rates.js
//
// The one way to get a company's cabinet rate card.
//
// Split from pricing.js because that file is pure and reachable from a browser
// bundle; this one touches the database. Anything client-side that imported
// pricing.js would otherwise pull Prisma in with it.
import { db } from "@/lib/db";
import { normaliseRates, DEFAULT_CABINET_RATES } from "./pricing";

/**
 * The rates to price this company's kitchens with.
 *
 * Always returns a complete, finite rate card — never null — so no caller has
 * to decide what to do when a company hasn't set one up. A company that has
 * never opened the settings page gets the defaults and can still quote.
 */
export async function ratesForCompany(companyId) {
  if (!companyId) return normaliseRates(null);
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { cabinetRates: true },
  });
  return normaliseRates(company?.cabinetRates);
}

/**
 * Has this company actually set its own rates?
 *
 * The settings page uses this to say so. It matters because the defaults are
 * one cabinet maker's real prices, and a shop quoting at them without noticing
 * is quoting someone else's business — so "you're on the starting rates" has to
 * be visible, not inferred from the numbers looking plausible.
 */
export function hasOwnRates(cabinetRates) {
  return Boolean(cabinetRates && typeof cabinetRates === "object" && Object.keys(cabinetRates).length);
}

export { DEFAULT_CABINET_RATES };
