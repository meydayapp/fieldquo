// lib/kitchen/access.js
//
// Who gets the Kitchen Designer.
//
// Before this file existed, three separate call sites — the quote-detail
// button (app/app/quotes/[id]/page.js), the internal save endpoint
// (app/api/quotes/[id]/kitchen/route.js) and the public self-quote lead
// endpoint (app/api/self-quote/kitchen/route.js) — each carried their own
// copy of the same regex, testing a QUOTE's own scope-group category keys
// against /cabinet|kitchen|countertop|remodel/. That answers "does this
// specific quote already look like a kitchen", which is a different question
// from "does this company offer kitchen design" — and conflating them is
// exactly what the owner reported on 2026-08-30: a company selling only
// countertops got the Kitchen Designer button on every countertop quote
// (the regex matched "countertop"), while a general contractor who genuinely
// installs new kitchens had no way to turn it on, because the only path to
// it was already having a cabinet-ish scope group.
//
// Two questions, kept separate on purpose:
//
//   hasKitchenData()            — has THIS quote already got kitchen-designer
//                                  work on it? If so, the button stays even
//                                  if the company later turns the service
//                                  off — hiding a button over existing work
//                                  is a different bug (AGENTS.md).
//
//   companyOffersKitchenDesign() — has the COMPANY explicitly turned on
//                                  "Kitchen Design & New Installs"
//                                  (lib/trades/catalog.js: kitchen_design)?
//                                  This is the real gate for a quote that
//                                  doesn't have a design yet.
import { db } from "@/lib/db";

export const KITCHEN_DESIGN_KEY = "kitchen_design";

// The scope-group label the designer's PUT handler writes to. Matched by
// label rather than by category so a company that files kitchens under a
// different service (Cabinet Refacing, Remodeling) still gets exactly one
// design-owned group rewritten instead of accumulating a new one on every
// save — see app/api/quotes/[id]/kitchen/route.js.
export const KITCHEN_GROUP_LABEL = "Kitchen — designed";

/**
 * True when this quote already carries Kitchen Designer data: a saved
 * design, a client's own edits from the public designer, or the scope group
 * the designer writes to. Pure — no DB access — so it can run against a
 * quote object from any of the three call sites without a second fetch.
 */
export function hasKitchenData(quote) {
  if (!quote || typeof quote !== "object") return false;
  if (quote.quoteType === "kitchen") return true;
  if (quote.scopeDetails?.serviceType === "kitchen") return true;
  if (quote.clientKitchenConfig) return true;
  return (Array.isArray(quote.scopeGroups) ? quote.scopeGroups : []).some(
    (g) => g && g.label === KITCHEN_GROUP_LABEL,
  );
}

/**
 * The real gate, as a pure function over the company's already-loaded
 * enabled category keys. Split from the DB-reading version below so
 * scripts/check-kitchen-access.mjs can execute it directly against hostile
 * input rather than asserting the shape of a query.
 */
export function canUseKitchenDesignerPure(quote, enabledCategoryKeys) {
  const enabled = Array.isArray(enabledCategoryKeys) ? enabledCategoryKeys : [];
  return enabled.includes(KITCHEN_DESIGN_KEY) || hasKitchenData(quote);
}

/** This company's enabled ServiceCategory keys, for the check above. */
export async function companyEnabledCategoryKeys(companyId) {
  if (!companyId) return [];
  const rows = await db.companyServiceCategory.findMany({
    where: { companyId, enabled: true },
    select: { category: { select: { key: true } } },
  });
  return rows.map((r) => r.category?.key).filter(Boolean);
}

/** Whether the company itself has kitchen_design switched on — no quote involved. */
export async function companyOffersKitchenDesign(companyId) {
  const keys = await companyEnabledCategoryKeys(companyId);
  return keys.includes(KITCHEN_DESIGN_KEY);
}

/**
 * The one gate every authenticated surface should call: reachable when the
 * company opted in, OR when this specific quote already has data to protect.
 * Checks hasKitchenData first so a quote with an existing design never needs
 * the DB round-trip for the company's settings.
 */
export async function canUseKitchenDesigner(quote, companyId) {
  if (hasKitchenData(quote)) return true;
  return companyOffersKitchenDesign(companyId);
}
