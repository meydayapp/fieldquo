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
//                     in the codebase reads Company.cabinetRates. So it
//                     follows the designer's own gate (lib/kitchen/access.js:
//                     a kitchen-building trade, or the company's override) —
//                     a rate card that only feeds the designer is meaningless
//                     without it, and a designer without it prices blind.
//   Material Costs    TRADE-SPECIFIC. app/data/materialRecipes.js's
//                     MATERIAL_RECIPES has exactly two keys —
//                     cabinet_refinishing and exterior_painting — not "every
//                     trade" and not even "every painting trade" (interior
//                     painting has no recipe here). A roofer, a plumber, a
//                     landscaper has no recipe on this screen to edit, full
//                     stop. This is the same "Material Costs shows for
//                     non-painters too" the owner's report already named as
//                     evidence the sidebar has no such filter at all.
//   Equipment &       TRADE-SPECIFIC, and MISSED by this audit on 2026-09-21,
//     access          because it reads as an equipment screen rather than a
//                     painting one and because it is the only settings row
//                     whose href is an ANCHOR (/app/settings/services
//                     #equipment-access) rather than a page — so "read off the
//                     route" landed on Services, which is universal, and the
//                     section behind the anchor never got read. It renders on
//                     `c.id === firstPaintingId` in ServicesEditor.js, i.e.
//                     only for a company with an enabled category in
//                     PAINT_TAKEOFF_CATEGORIES (interior_painting,
//                     exterior_painting). Everyone else was shown a row that
//                     navigated to an anchor that was not on the page. Added
//                     2026-11-04; see the Equipment & access section below for
//                     why its rule has no existing-data carve-out when the
//                     other two do, and why it is cosmetic rather than a gate.
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
// So this file gates exactly three screens, not because three is a round
// number, but because three is what "read off the route" produced — two of
// them on 2026-09-21 and the third on 2026-11-04, when the owner's bug report
// about the Settings menu turned up the row this audit had skipped. The miss
// is worth keeping on the record: the rule "read off the route" is only as
// good as what the route resolves to, and for an anchor it resolves to a page
// that answers a different question than the section does. If a future screen
// is added that hard-codes a closed set of ServiceCategory keys the way
// these three do, it belongs here too — see scripts/check-trade-gate.mjs,
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
import { KITCHEN_GRANTING_TRADE_KEYS, kitchenDesignerOnPure } from "@/lib/kitchen/key";
import { MATERIAL_RECIPES } from "@/app/data/materialRecipes";
import { PAINT_TAKEOFF_CATEGORIES } from "@/lib/pricing/sanitiseRates";

/* ── Cabinet Rates ──────────────────────────────────────────────────────── */

// The rate card exists only to price the Kitchen Designer — nothing else
// reads Company.cabinetRates (see the header comment above for the grep that
// confirmed it). So it opens exactly when the designer does, by the designer's
// own rule rather than a list restated here: 2026-09-25 the owner widened the
// designer from kitchen_design alone to every kitchen-building trade plus a
// company override (lib/kitchen/key.js), and a copied ["kitchen_design"] here
// would have handed a remodeler a designer pricing off rates they could not
// reach. Read off the designer's own list so the two cannot disagree.
export const CABINET_RATES_CATEGORY_KEYS = KITCHEN_GRANTING_TRADE_KEYS;

/**
 * Pure: do these enabled keys, and the company's designer override, unlock
 * Cabinet Rates? Exactly the designer's company-level answer.
 */
export function cabinetRatesEnabledPure(enabledCategoryKeys, kitchenDesignerOverride = null) {
  return kitchenDesignerOnPure(enabledCategoryKeys, kitchenDesignerOverride);
}

/**
 * The real gate: reachable when the company has the Kitchen Designer, OR
 * when it already saved its own rate card (the existing-data rule above).
 * Mirrors canUseKitchenDesigner's shape one level up — company-scoped instead
 * of quote-scoped, because this screen has no single quote to ask.
 */
export async function canUseCabinetRatesSettings(companyId) {
  if (!companyId) return false;
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { cabinetRates: true, kitchenDesignerOverride: true },
  });
  if (hasOwnRates(company?.cabinetRates)) return true;
  const keys = await companyEnabledCategoryKeys(companyId);
  return cabinetRatesEnabledPure(keys, company?.kitchenDesignerOverride ?? null);
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

/* ── Equipment & access ─────────────────────────────────────────────────── */

// The third screen, added 2026-11-04, and the first that is a SECTION rather
// than a page: the row's href is /app/settings/services#equipment-access, an
// anchor into the (universal) Services screen. That changes what this gate is
// for, so it is worth being explicit rather than letting it read as a third
// copy of the two above.
//
// What was wrong: ServicesEditor.js draws the Equipment & access section on
// `c.id === firstPaintingId` — the first ENABLED category in
// PAINT_TAKEOFF_CATEGORIES. For a roofer, a plumber, a landscaper, a cabinet
// refinisher, that is null, the section never renders, and the sidebar row
// still did. Clicking it navigated to an anchor that does not exist on the
// page, so the browser landed at the top of Services and nothing happened:
// AGENTS.md's first rule, a control that appears to work and doesn't.
//
// What this gate is NOT: access control. There is no endpoint that belongs to
// this section alone — /api/settings/painting-rates serves the painting
// takeoff inside a quote builder, which a company with no painting trade
// cannot open in the first place (tradeGateNav.js's header makes the same
// point about the takeoff, the roof measure and the designers). The Services
// page itself keeps its own row and stays reachable. So unlike Cabinet Rates
// and Material Costs, nothing here is being protected — a dead link is being
// removed. Anyone later reading this as a security boundary would be wrong.
export const EQUIPMENT_ACCESS_CATEGORY_KEYS = PAINT_TAKEOFF_CATEGORIES;

/**
 * Pure: does this company have a painting trade switched on?
 *
 * NO existing-data carve-out, and that is the whole point of writing this
 * separately. Both screens above keep themselves for a company that already
 * saved something, because both still RENDER for such a company. This one
 * does not — firstPaintingId is the first *enabled* painting category, null
 * when painting is off however many takeoff overrides sit on the row. Keeping
 * the row for a company with saved overrides and no enabled painting trade
 * would hand it back the very dead link this gate exists to remove. Mirror
 * the renderer's own condition; never be more generous than the thing being
 * linked to.
 */
export function equipmentAccessEnabledPure(enabledCategoryKeys) {
  const enabled = Array.isArray(enabledCategoryKeys) ? enabledCategoryKeys : [];
  return enabled.some((k) => EQUIPMENT_ACCESS_CATEGORY_KEYS.includes(k));
}

/** The real gate: the company's enabled categories, nothing else. */
export async function canUseEquipmentAccessSettings(companyId) {
  if (!companyId) return false;
  const keys = await companyEnabledCategoryKeys(companyId);
  return equipmentAccessEnabledPure(keys);
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
  const [cabinetRates, materialCosts, equipmentAccess] = await Promise.all([
    canUseCabinetRatesSettings(companyId),
    canUseMaterialCostsSettings(companyId),
    canUseEquipmentAccessSettings(companyId),
  ]);
  return { cabinetRates, materialCosts, equipmentAccess };
}
