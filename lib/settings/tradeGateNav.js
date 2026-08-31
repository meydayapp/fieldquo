// lib/settings/tradeGateNav.js
//
// The nav layer of the trade gate. Pure — no database, no React — so
// SettingsSidebar.js (a "use client" component) can filter by it without
// pulling Prisma into a browser bundle, and so a check script can execute it
// directly. Mirrors lib/features/nav.js and lib/permissions/nav.js on
// purpose: same shape, same "an unknown row/unresolved gate shows it" fail
// posture, because a nav filter that empties itself when a lookup is slow
// reads as a broken account and every one of these rows is refused
// server-side regardless (lib/settings/tradeGate.js, which is where the real
// decision and its reasoning live).
//
// ── This is cosmetics, and says so ─────────────────────────────────────────
//
// Removing a row from the sidebar is not access control. GET/PUT/DELETE
// /api/settings/cabinet-rates and GET/PUT/DELETE /api/settings/material-recipes
// all refuse independently of whether this ever hides anything.

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

/** Should this settings row be drawn, given the company's resolved trade gate? */
export function tradeGateAllowsRow(tradeGate, navKey) {
  const field = SETTINGS_ROW_TRADE_GATE[navKey];
  if (!field) return true; // no rule — every row but the two above
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
