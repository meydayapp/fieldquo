// lib/kitchen/key.js
//
// The strings — and the one pure rule — that say whether a company has the
// Kitchen Designer, in a file with no imports, so a CLIENT component can read
// them. lib/kitchen/access.js exports the same names and re-exports these,
// but it also imports lib/db, and a browser bundle that reaches for the key
// must not drag the database driver in behind it. Share your links
// (app/app/settings/lead-form), the public self-quote flow and Settings ›
// Services are those clients.
//
// kitchen_design is a ServiceCategory key (Settings → Services → "Kitchen
// Design & New Installs"), NOT a platform feature flag —
// lib/features/registry.js has no entry for it. A company turns the designer
// on by saying it does the work, which is the only honest switch: the public
// page asks strangers to draw a kitchen they expect this company to build.
export const KITCHEN_DESIGN_KEY = "kitchen_design";

// ── Which trades grant it, and which deliberately don't ─────────────────────
//
// 2026-08-30 the owner reported the designer showing for every company with
// a countertop or cabinet key: "new kitchen installs can be done by few types
// of contractors, not just kitchen refinishers, and not all kitchen cabinet
// refinishers do them." The fix made kitchen_design the only key that opened
// it. 2026-09-25 he widened it: "those that have enabled kitchen remodel or
// construction should have access to the kitchen designer — construction
// trades, remodeling, renovation — maybe handyman if they enable that — and
// kitchen refacing could also do it."
//
// So a trade grants it when the trade itself is one that builds or rebuilds a
// kitchen. There is no separate "kitchen remodel" key in lib/trades/catalog.js
// — kitchen remodelling is a service INSIDE remodeling and general
// contracting (app/data/serviceSeeds/general_contracting.js "kitchen"
// heading) — so those two trades are how "kitchen remodel" arrives.
//
// Deliberately NOT here, and why:
//   cabinet_refinishing, countertop, stairs, interior/exterior_painting —
//     the 08-30 rule stands: these re-coat or top an existing kitchen, and
//     the owner's own words are that not every refinisher installs one.
//   handyman — "maybe if they enable that": NOT automatic. A handyman
//     company that does kitchens ticks Kitchen Design & New Installs (or sets
//     the override to on) — Settings › Services says so beside the switch.
//   carpentry, drywall, tiling, demolition — trades a kitchen job USES, not
//     trades that sell one; the owner named none of them.
//
// Order matters only for filing: the first of these a company has enabled is
// the category a kitchen lead or design is filed under (kitchenCategoryRow in
// lib/kitchen/access.js), so the most kitchen-specific comes first.
export const KITCHEN_GRANTING_TRADE_KEYS = Object.freeze([
  KITCHEN_DESIGN_KEY,
  "remodeling",
  "general_contracting_reno",
  "general_contracting",
  "construction",
  "cabinet_refacing",
]);

/** The subset of a company's enabled keys that grant the designer, in grant order. */
export function kitchenGrantingKeys(enabledCategoryKeys) {
  const enabled = Array.isArray(enabledCategoryKeys) ? enabledCategoryKeys : [];
  return KITCHEN_GRANTING_TRADE_KEYS.filter((key) => enabled.includes(key));
}

/**
 * Does the COMPANY have the Kitchen Designer? Pure, and the only place the
 * answer is computed — lib/kitchen/access.js calls this, the settings screen
 * previews with it, nothing restates it.
 *
 *   override === true   on, whatever the trades (a handyman, a cabinet
 *                       refinisher who does install kitchens)
 *   override === false  off, even when a trade grants it — the company's own
 *                       word beats our guess about its trade
 *   anything else       follow the trades above
 *
 * Only a real boolean overrides. A string "false" from a sloppy caller is
 * not the company saying no — it falls through to the trades, which is the
 * state the company was in before anyone touched the setting.
 */
export function kitchenDesignerOnPure(enabledCategoryKeys, override) {
  if (override === true) return true;
  if (override === false) return false;
  return kitchenGrantingKeys(enabledCategoryKeys).length > 0;
}
