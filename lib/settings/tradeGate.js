// lib/settings/tradeGate.js
//
// Whether a service-specific SETTINGS SCREEN is reachable for this company —
// the settings-sidebar analogue of lib/kitchen/access.js, which asked the
// same question about the Kitchen Designer BUTTON on 2026-08-30. The owner's
// next report was the same bug on a different surface: "Cabinet Rates"
// (/app/settings/cabinet-rates) rendered in the Pricing group for every
// company, including one that sells no cabinetry at all, and its API was
// gated only by role, not by service — so hiding the nav row alone would be
// exactly the "hiding a button is not access control" failure AGENTS.md
// names first.
//
// ── The decision: a small general mechanism, applied to two screens ────────
//
// SettingsSidebar.js already runs every row through two independent filters —
// feature flags (lib/features/nav.js) and the permission grid
// (lib/permissions/settingsAccess.js) — and neither one asks "does the
// company sell the thing this screen configures". Two ways to close that gap
// for Cabinet Rates:
//
//   (a) One-off: gate this row alone, matching the kitchen fix's shape but
//       not its generality. Fast, and leaves the sidebar in a state where one
//       row out of thirty-six answers a question the other thirty-five don't
//       — which is a pattern nobody reading this file six months from now
//       would have reason to follow, so the next trade-specific screen added
//       ships unguarded again, the same way Cabinet Rates did.
//
//   (b) A third filter, shaped like the other two, applied to every screen
//       that is GENUINELY trade-specific — read off the ROUTE the way
//       SETTINGS_ROW_CAPABILITY's own header insists on, not off the row's
//       name or a guess about what "sounds like cabinetry".
//
// Taking (b) only pays off if it is applied to every screen that qualifies,
// not just the one that got reported — a single gated row among many
// ungated ones IS (a) wearing a bigger file. So before writing this, every
// row in the Pricing group (and its neighbours) was checked against what its
// own API actually reads, the same way the header of settingsAccess.js
// insists a capability be chosen:
//
//   Cabinet Rates     TRADE-SPECIFIC. ratesForCompany() (lib/kitchen/rates.js)
//                     has exactly one class of caller: the Kitchen Designer's
//                     own save routes (app/api/quotes/[id]/kitchen/route.js,
//                     app/api/kitchen-design/[token]/route.js). Nothing else
//                     in the codebase reads Company.cabinetRates. The
//                     designer's own gate is kitchen_design
//                     (lib/kitchen/access.js) — a rate card that only feeds a
//                     tool gated on kitchen_design is meaningless without it.
//   Material Costs    TRADE-SPECIFIC. app/data/materialRecipes.js's
//                     MATERIAL_RECIPES has exactly two keys —
//                     cabinet_refinishing and exterior_painting — not "every
//                     trade" and not even "every painting trade" (interior
//                     painting has no recipe here). A roofer, a plumber, a
//                     landscaper has no recipe on this screen to edit, full
//                     stop. This is the same "Material Costs shows for
//                     non-painters too" the owner's report already named as
//                     evidence the sidebar has no such filter at all.
//   Products          UNIVERSAL. The whole-company price book, across every
//                     trade a company sells. There is no version of "sells
//                     nothing" that leaves this screen with nothing to show.
//   Services          UNIVERSAL, and load-bearing: this is the screen where a
//                     company turns kitchen_design (or cabinet_refinishing,
//                     or anything else) ON. Gating it on "does the company
//                     already sell X" would make it unreachable for the one
//                     company that needs it most — the one that hasn't
//                     turned X on yet.
//   Overhead          UNIVERSAL. Fixed costs, salaries, debt — every company
//                     that employs anyone has these, regardless of trade.
//   Custom Fields     UNIVERSAL. Extra intake fields apply across every quote
//                     type a company writes, not to one category.
//   Instant Quotes    Deliberately LEFT ALONE. It already resolves its own
//                     list of cards from the company's wired trades
//                     (lib/trades/catalog.js: instantTradeForCategory) rather
//                     than rendering a fixed set — a company with no
//                     instant-quotable trade sees an empty list on the
//                     screen itself, not a screen full of cards for trades it
//                     doesn't sell. That is a different, already-correct
//                     shape from Cabinet Rates and Material Costs (a fixed
//                     list rendered regardless of what's enabled), and it is
//                     already gated on the showPricing toggle in
//                     SETTINGS_ROW_REQUIREMENTS — a second, unrelated axis.
//                     Extending trade-gating to it would be solving a problem
//                     it does not have.
//   Everything outside the Pricing group (Team, Documents, Messaging, Getting
//     Paid, Client Facing, Account, Business) — UNIVERSAL by inspection: none
//     of them read a fixed, closed set of ServiceCategory keys the way
//     MATERIAL_RECIPES and Company.cabinetRates do. Checklists, for instance,
//     looks trade-shaped (it seeds a starter library "per trade") but a
//     company can create and use a checklist regardless of what it sells —
//     there is no ServiceCategory key that turns the whole screen into a
//     dead end the way disabling kitchen_design does for Cabinet Rates.
//
// So this file gates exactly two screens, not because two is a round number,
// but because two is what "read off the route" produced. If a future screen
// is added that hard-codes a closed set of ServiceCategory keys the way
// these two do, it belongs here too — see scripts/check-trade-gate.mjs,
// which fails if SETTINGS_ROW_TRADE_GATE (lib/settings/tradeGateNav.js)
// drifts from this file's own exports, so the two cannot go stale
// independently of each other the way SETTINGS_ROW_CAPABILITY's header warns
// a restated map always does.
//
// ── The existing-data rule, mirrored ────────────────────────────────────────
//
// lib/kitchen/access.js's hasKitchenData asks "does this QUOTE already carry
// kitchen work" — a company that saved a design keeps the button even after
// switching kitchen_design off. These two screens are company-scoped, not
// quote-scoped, so the equivalent question is "has this COMPANY already saved
// something here": Company.cabinetRates for the rate card (hasOwnRates,
// lib/kitchen/rates.js — the same predicate the settings page itself uses to
// say "these are starting rates, not yours"), and a MaterialRecipeSetting row
// per category for the recipe screen. Either keeps the row and the route
// reachable even after the company turns the trade off — hiding a screen over
// a saved rate card is the same bug as hiding a button over a saved design,
// and AGENTS.md's own "Regenerate on the website builder" example is exactly
// what NOT protecting saved work looks like.
//
// ── Granularity: Cabinet Rates is whole-screen, Material Costs is per-card ──
//
// Cabinet Rates is one form pricing one thing (the kitchen designer), so its
// gate is whole-screen: the nav row disappears, and GET/PUT/DELETE all refuse
// together (mirroring app/app/quotes/[id]/kitchen/page.js's own
// notFound()-on-refusal shape, one layer up).
//
// Material Costs renders TWO independent cards on one page
// (app/app/settings/material-costs/page.js maps over Object.entries of a
// static CATEGORY_META, one per recipe) — a company that sells cabinet
// refinishing but not exterior painting has a real reason to see HALF this
// screen. Gating the whole row on "sells NEITHER" and then still handing back
// both recipes on GET would just move the "control that appears to work and
// doesn't" bug from the row to the card: the card for a trade the company
// doesn't sell would render, invite an edit, and save a number nothing ever
// reads. So GET filters its response to the categories the company may see
// (enabled OR overridden) instead of returning a fixed pair, and the page
// already treats a missing key as "don't render this card" — see
// `if (!draft) return null` in page.js — so filtering the payload is the
// whole fix; nothing in the page itself needed to change. The nav row is
// hidden only when that leaves NOTHING — the "half-relevant" case (one trade
// on, one off) correctly keeps the row and shows one card, not zero or two.
// The pre-existing shape where a company selling only one of the two trades
// still saw BOTH cards is not new to this change and not fixed by it beyond
// this; it's a finer-grained instance of the exact bug this file exists to
// close, on a different day's ticket.
import { db } from "@/lib/db";
import { companyEnabledCategoryKeys } from "@/lib/trades/companyCategories";
import { hasOwnRates } from "@/lib/kitchen/rates";
import { MATERIAL_RECIPES } from "@/app/data/materialRecipes";

/* ── Cabinet Rates ──────────────────────────────────────────────────────── */

// Kitchen Design & New Installs — the only trade whose feature (the Kitchen
// Designer) reads Company.cabinetRates at all. Not cabinet_refinishing or
// cabinet_refacing: those price from app/data/tradePriceBooks and this
// screen's sibling Instant Quotes, never from this rate card — see the
// header comment above for the grep that confirmed it.
export const CABINET_RATES_CATEGORY_KEYS = ["kitchen_design"];

/** Pure: does this set of enabled category keys unlock Cabinet Rates? */
export function cabinetRatesEnabledPure(enabledCategoryKeys) {
  const enabled = Array.isArray(enabledCategoryKeys) ? enabledCategoryKeys : [];
  return CABINET_RATES_CATEGORY_KEYS.some((key) => enabled.includes(key));
}

/**
 * The real gate: reachable when the company opted into kitchen_design, OR
 * when it already saved its own rate card (the existing-data rule above).
 * Mirrors canUseKitchenDesigner's shape one level up — company-scoped instead
 * of quote-scoped, because this screen has no single quote to ask.
 */
export async function canUseCabinetRatesSettings(companyId) {
  if (!companyId) return false;
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { cabinetRates: true },
  });
  if (hasOwnRates(company?.cabinetRates)) return true;
  const keys = await companyEnabledCategoryKeys(companyId);
  return cabinetRatesEnabledPure(keys);
}

/* ── Material Costs ─────────────────────────────────────────────────────── */

// Read off app/data/materialRecipes.js itself rather than hand-typed, so a
// third recipe added there is visible here automatically instead of needing
// a second edit somebody forgets.
export const MATERIAL_COSTS_CATEGORY_KEYS = Object.keys(MATERIAL_RECIPES);

/**
 * Pure: is this ONE category's card visible — sold, or already carrying a
 * saved override? `overriddenKeys` are categoryKeys with a MaterialRecipeSetting
 * row, i.e. exactly what GET already computes as `_hasOverrides`.
 */
export function materialCostsCategoryAllowedPure(
  categoryKey,
  enabledCategoryKeys,
  overriddenKeys,
) {
  const enabled = Array.isArray(enabledCategoryKeys) ? enabledCategoryKeys : [];
  const overridden = Array.isArray(overriddenKeys) ? overriddenKeys : [];
  return enabled.includes(categoryKey) || overridden.includes(categoryKey);
}

/** Pure: which of the catalogue's recipe categories this company may see. */
export function materialCostsVisibleCategoriesPure(enabledCategoryKeys, overriddenKeys) {
  return MATERIAL_COSTS_CATEGORY_KEYS.filter((key) =>
    materialCostsCategoryAllowedPure(key, enabledCategoryKeys, overriddenKeys),
  );
}

/** The two DB-backed inputs the pure functions above need, fetched once. */
export async function companyMaterialCostsState(companyId) {
  if (!companyId) return { enabledCategoryKeys: [], overriddenKeys: [] };
  const [enabledCategoryKeys, overrides] = await Promise.all([
    companyEnabledCategoryKeys(companyId),
    db.materialRecipeSetting.findMany({
      where: { companyId },
      select: { categoryKey: true },
    }),
  ]);
  return {
    enabledCategoryKeys,
    overriddenKeys: overrides.map((o) => o.categoryKey),
  };
}

/** The categories this company's GET should return. */
export async function materialCostsVisibleCategories(companyId) {
  const { enabledCategoryKeys, overriddenKeys } = await companyMaterialCostsState(companyId);
  return materialCostsVisibleCategoriesPure(enabledCategoryKeys, overriddenKeys);
}

/** Is ONE categoryKey writable by this company right now? For PUT/DELETE. */
export async function canUseMaterialCostsCategory(companyId, categoryKey) {
  if (!companyId || !categoryKey) return false;
  const { enabledCategoryKeys, overriddenKeys } = await companyMaterialCostsState(companyId);
  return materialCostsCategoryAllowedPure(categoryKey, enabledCategoryKeys, overriddenKeys);
}

/** Whole-row question for the sidebar: is there anything at all to show? */
export async function canUseMaterialCostsSettings(companyId) {
  const visible = await materialCostsVisibleCategories(companyId);
  return visible.length > 0;
}

/* ── Both, in one round trip, for the settings sidebar ─────────────────── */

/**
 * { cabinetRates, materialCosts } for this company. Never throws — the
 * caller (app/app/settings/layout.js) already treats a null result as
 * "leave the menu untouched", the same fail-open posture featureFlags and
 * access carry there; a trade-gate lookup failing must not blank three rows
 * out of thirty-six any more than a role lookup failing should.
 */
export async function companyTradeGate(companyId) {
  if (!companyId) return null;
  const [cabinetRates, materialCosts] = await Promise.all([
    canUseCabinetRatesSettings(companyId),
    canUseMaterialCostsSettings(companyId),
  ]);
  return { cabinetRates, materialCosts };
}
