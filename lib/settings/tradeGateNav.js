// lib/settings/tradeGateNav.js
//
// The nav layer of the trade gate. Pure — no database, no React — so the
// shell's client components (AdminSidebar.js, the settings index, the More
// page, the phone sheet) can filter by it without pulling Prisma into a
// browser bundle, and so a check script can execute it directly. Mirrors
// lib/features/nav.js and lib/permissions/nav.js on purpose: same shape,
// same "an unknown row/unresolved gate shows it" fail posture, because a nav
// filter that empties itself when a lookup is slow reads as a broken account
// and every one of these rows is refused server-side regardless
// (lib/settings/tradeGate.js, which is where the real decision and its
// reasoning live).
//
// ── This is cosmetics, and says so ─────────────────────────────────────────
//
// Removing a row from the sidebar is not access control. GET/PUT/DELETE
// /api/settings/cabinet-rates and GET/PUT/DELETE /api/settings/material-recipes
// all refuse independently of whether this ever hides anything.
//
// ── One table for every surface (2026-09-21) ───────────────────────────────
//
// The owner's rule for the shell reorganisation: "every button we have is
// good for all trades — maybe just reorganisation". So the DEFAULT is show,
// and a row leaves the menu only when companyTradeGate() proves the company
// cannot use it. The main rail, the More page, the phone sheet, the settings
// index and the settings slide panel all read THIS map through the two
// filters below, so a trade-specific row added tomorrow is hidden in every
// one of them by one entry — and scripts/check-shell.mjs proves the gate
// hides only rows named here, never an AI, scheduling, dispatch, money or
// people row.
//
// NAV_ROW_TRADE_GATE is the main-rail half of the table and is EMPTY today,
// deliberately. tradeGate.js's header audits every screen against what its
// own API reads, and the only two that hard-code a closed set of
// ServiceCategory keys are settings screens. The paint takeoff, the roof
// measure, the paver designer and the kitchen designer are all reached from
// inside a quote (the takeoff picks itself by the quote's service), not from
// a rail row, so there is nothing to gate at the rail yet. The map exists so
// the next trade-specific PAGE lands in it instead of shipping ungated, the
// way Cabinet Rates once did.

/**
 * Row i18n key → the field of `tradeGate` (lib/settings/tradeGate.js's
 * companyTradeGate()) that decides it. Deliberately NOT every row — see
 * tradeGate.js's header comment for which settings screens are genuinely
 * trade-specific and which are universal, and why.
 */
export const SETTINGS_ROW_TRADE_GATE = {
  "app.settings.cabinetRates": "cabinetRates",
  "app.settings.materialCosts": "materialCosts",
};

/** Main-rail / More rows decided by the trade gate. Empty on purpose — see above. */
export const NAV_ROW_TRADE_GATE = {};

/** Every trade-gated row key, whichever surface draws it. */
export const ROW_TRADE_GATE = Object.freeze({ ...SETTINGS_ROW_TRADE_GATE, ...NAV_ROW_TRADE_GATE });

/** Should this row be drawn, given the company's resolved trade gate? */
export function tradeGateAllowsRow(tradeGate, navKey) {
  const field = ROW_TRADE_GATE[navKey];
  if (!field) return true; // no rule — every row but the ones above
  if (!tradeGate) return true; // unresolved; see the header on companyTradeGate
  return Boolean(tradeGate[field]);
}

/**
 * Drop rows the company has no reason to see. Groups left with nothing
 * disappear too, matching filterNavGroups and filterSettingsGroups — a
 * heading over empty space is the trace a hidden row leaves behind.
 */
export function filterSettingsGroupsByTrade(groups, tradeGate) {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((g) => ({
      ...g,
      items: (g.items || []).filter((i) => tradeGateAllowsRow(tradeGate, i.key)),
    }))
    .filter((g) => g.items.length > 0);
}

/** The same filter for the main rail's groups — one rule, two names, so each caller reads as what it is. */
export function filterNavGroupsByTrade(groups, tradeGate) {
  return filterSettingsGroupsByTrade(groups, tradeGate);
}

/** Flat lists (the Create menu, the account rows) — same rule. */
export function filterNavItemsByTrade(items, tradeGate) {
  if (!Array.isArray(items)) return [];
  return items.filter((i) => tradeGateAllowsRow(tradeGate, i.key));
}
