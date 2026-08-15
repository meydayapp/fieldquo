// lib/features/nav.js
//
// The nav layer of the feature gate. Pure — no database, no React — so both
// sidebars share one implementation and a check script can execute it.
//
// ── This is cosmetics, and says so ─────────────────────────────────────────
//
// Removing a row from a menu is not access control. AGENTS.md is explicit about
// that, and the real enforcement is in lib/currentMember.js (every API route)
// and app/components/FeatureGate.js (every page). This file exists so a hidden
// feature leaves no visible trace, not so it becomes unreachable — it is already
// unreachable before anyone looks at the menu.
import { featureForNavKey } from "./registry";

/**
 * What a nav row should do, given the resolved flags.
 *
 * @param navKey  the i18n key of the row
 * @param flags   { [featureKey]: { state, visible, usable } } from navFlagsFrom
 * @returns { show, state }
 *          state is null for a row no feature owns — the common case, and the
 *          reason an unknown flags object leaves the menu completely intact
 *          rather than emptying it.
 */
export function navRowState(navKey, flags) {
  const featureKey = featureForNavKey(navKey);
  if (!featureKey) return { show: true, state: null };

  // No flags resolved yet (first paint, or a caller that didn't pass them).
  // Show the row: the page behind it is gated regardless, so the worst case is
  // one click to a 404 — whereas hiding rows on a missing map would blank most
  // of the menu every time the provider was slow.
  const flag = flags?.[featureKey];
  if (!flag) return { show: true, state: null };

  return { show: flag.state !== "hidden", state: flag.state };
}

/**
 * Drop hidden rows from a group list, keeping every other property intact.
 *
 * Groups that lose all their items are dropped too — a header with nothing
 * under it is a placeholder announcing "something used to be here", which is the
 * trace `hidden` exists to avoid.
 */
export function filterNavGroups(groups, flags) {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((g) => ({
      ...g,
      items: (g.items || []).filter((i) => navRowState(i.key, flags).show),
    }))
    .filter((g) => g.items.length > 0);
}

/** Drop hidden entries from a flat item list (the quick-add popup, bottom rows). */
export function filterNavItems(items, flags) {
  if (!Array.isArray(items)) return [];
  return items.filter((i) => navRowState(i.key, flags).show);
}
