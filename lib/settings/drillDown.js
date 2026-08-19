// lib/settings/drillDown.js
//
// The one decision behind the "Back to …" bar on settings drill-downs, kept
// out of the component so it can be run against every way a user can arrive at
// a page. See app/components/settings/SettingsDrillDown.js for the why;
// scripts/check-drill-down.mjs runs the cases.

/**
 * The pathname half of an href, which is all `usePathname()` ever returns.
 *
 * Without this, a drill-down link written as "/app/settings/services?tab=types"
 * would claim a `to` that can never equal the pathname it lands on, and the bar
 * would silently never appear — a control that quietly does nothing, which is
 * the same failure as one that visibly does nothing.
 */
export function pathnameOf(href) {
  return String(href ?? "").split(/[?#]/)[0];
}

/**
 * Should this visit show a back bar, and to where?
 *
 * @param claim    what the clicked link said it was doing: { from, to, label }.
 *                 null for a sidebar click, a reload, a pasted URL, or the
 *                 browser's back button — none of which run our onClick.
 * @param previous the pathname the app was on immediately before. null on a
 *                 cold load, where there is no previous page to go back to.
 * @param current  the pathname now.
 * @returns the claim when the browser actually made that move, else null.
 */
export function resolveArrival({ claim, previous, current } = {}) {
  if (!claim || !previous || !current) return null;
  if (!claim.from || !claim.to || !claim.label) return null;
  // Both halves must match. `to === current` alone would let a claim survive a
  // detour (click Manage, hit back, then reach Services from the sidebar);
  // `from === previous` alone would let any link out of Company Settings claim
  // a bar on whatever page happened to load.
  if (claim.from !== previous || claim.to !== current) return null;
  // A page cannot be a drill-down from itself.
  if (claim.from === claim.to) return null;
  return claim;
}
