// lib/kitchen/access.js
//
// Who gets the Kitchen Designer. The ONE gate — every surface that shows,
// links to or serves the designer asks this file, and scripts/
// check-kitchen-access.mjs fails if one grows its own answer again.
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
//                                  is a different bug (AGENTS.md). That holds
//                                  for the company override too: "off" stops
//                                  NEW designs, it does not lock a drawn one.
//
//   companyOffersKitchenDesign() — does the COMPANY have the designer? Since
//                                  2026-09-25: yes when it enabled a trade
//                                  that builds kitchens (KITCHEN_GRANTING_
//                                  TRADE_KEYS in ./key.js — kitchen_design,
//                                  remodeling, renovation, general
//                                  contracting, new construction, cabinet
//                                  refacing), unless Company.
//                                  kitchenDesignerOverride says otherwise.
//                                  The rule itself is kitchenDesignerOnPure
//                                  in ./key.js, so the settings screen can
//                                  preview it without importing lib/db.
import { db } from "@/lib/db";
import { companyEnabledCategoryKeys } from "@/lib/trades/companyCategories";

// Lives in ./key.js, which has no imports, so client components can read it
// without pulling lib/db into the browser. Re-exported here so every server
// import site keeps working unchanged.
export { KITCHEN_DESIGN_KEY } from "./key";
export { KITCHEN_GRANTING_TRADE_KEYS, kitchenGrantingKeys, kitchenDesignerOnPure } from "./key";
import { KITCHEN_GRANTING_TRADE_KEYS, kitchenDesignerOnPure } from "./key";

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
 * enabled category keys and its override. Split from the DB-reading version
 * below so scripts/check-kitchen-access.mjs can execute it directly against
 * hostile input rather than asserting the shape of a query.
 */
export function canUseKitchenDesignerPure(quote, enabledCategoryKeys, override = null) {
  return hasKitchenData(quote) || kitchenDesignerOnPure(enabledCategoryKeys, override);
}

// companyEnabledCategoryKeys used to live here. Re-exported so nothing that
// already imports it from this file breaks — see
// lib/trades/companyCategories.js for why it moved and what it does.
export { companyEnabledCategoryKeys };

/** The two inputs the company-level rule needs, read once. */
export async function companyKitchenDesignerState(companyId) {
  if (!companyId) return { enabledCategoryKeys: [], override: null };
  const [enabledCategoryKeys, company] = await Promise.all([
    companyEnabledCategoryKeys(companyId),
    db.company.findUnique({
      where: { id: companyId },
      select: { kitchenDesignerOverride: true },
    }),
  ]);
  return {
    enabledCategoryKeys,
    override: company?.kitchenDesignerOverride ?? null,
  };
}

/** Whether the company itself has the designer — no quote involved. */
export async function companyOffersKitchenDesign(companyId) {
  const { enabledCategoryKeys, override } = await companyKitchenDesignerState(companyId);
  return kitchenDesignerOnPure(enabledCategoryKeys, override);
}

/**
 * The one gate every authenticated surface should call: reachable when the
 * company has the designer, OR when this specific quote already has data to
 * protect. Checks hasKitchenData first so a quote with an existing design
 * never needs the DB round-trip for the company's settings.
 */
export async function canUseKitchenDesigner(quote, companyId) {
  if (hasKitchenData(quote)) return true;
  return companyOffersKitchenDesign(companyId);
}

/**
 * Which of a company's enabled CompanyServiceCategory rows (each carrying
 * `category: { id, key }`) a kitchen design or kitchen lead is filed under.
 * NOT an access question — both routes answer that with the gate above
 * first. This only picks a label for work already allowed: kitchen_design,
 * then the granting trades in their order, then — for a quote that reached
 * the designer only because it already carries a design — the nearest
 * cabinetry-ish service. Null when nothing fits; each caller decides what
 * null means (the lead lands uncategorised, the quote falls back further).
 * One copy, because the two routes used to carry two and the copy is the
 * one that rots.
 */
export function kitchenCategoryRow(enabledRows) {
  const rows = Array.isArray(enabledRows) ? enabledRows.filter((r) => r?.category?.key) : [];
  for (const key of KITCHEN_GRANTING_TRADE_KEYS) {
    const hit = rows.find((r) => r.category.key === key);
    if (hit) return hit;
  }
  return rows.find((r) => /cabinet|kitchen|countertop|remodel/.test(r.category.key)) || null;
}
