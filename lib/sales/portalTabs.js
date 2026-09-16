// lib/sales/portalTabs.js
//
// Which of the portal's tabs earn a slot on the phone's bottom bar, and the
// two selectors the tour uses to reach the ones that do not.
//
// ══ Why this is a module and not a constant inside the tab bar ═══════════
//
// Three files need the same answer: app/components/sales/SalesMobileTabBar.js
// draws the five; app/sales/tourSteps.js has to know which steps point at a
// row that lives behind the drawer, because those steps must open the drawer
// before they can ring anything; and scripts/check-sales-mobile.mjs asserts
// both. Written once here — pure, no React, no next/* — so the check imports
// the same list the screen renders, rather than a copy that would pass after
// the screen changed.
//
// The full tab list itself stays where it has always been, as the array
// literal in app/sales/SalesShell.js. Twelve check scripts parse that literal
// for the href/label pairs — it is the single source of "what the portal
// HAS" — and moving it would have meant rewriting all twelve for no gain. This
// file names a SUBSET of that list, by href, and the tab bar filters the real
// list through it at render time; a tab removed from the shell disappears from
// the bar with it, and a stale href here matches nothing and is asserted
// against in the check.
//
// ══ Which five, and why ═══════════════════════════════════════════════════
//
// app/components/layout/MobileTabBar.js took its four from AdminSidebar's own
// stated order — "Requests -> Quotes -> Jobs -> Invoices" — rather than from a
// guess about what a contractor reaches for. Same rule here. SalesShell's tab
// array is ORDERED, and its comments say why each tab sits where it does:
// Today is "the front door, and the only tab that answers what do I do next";
// the queue "is the screen a rep opens first in the morning"; the playbook is
// "read before the call"; then the rep's own leads; then the conversations
// that Today itself calls "the top rung … a reply is the only thing in the
// portal where somebody is already waiting on you". Pay is last in that array
// because it is "visited once when they join and again when their bank
// changes, not every morning" — which is the argument against giving it one
// of five thumb-reach slots, however tempting a settings tab looks.
//
// So the five are the first five of the shell's own order. Today keeps a slot
// where /app's Home does not, because /app's Home is a hub reached from the
// logo, and Today is not a hub — it is the ladder that tells a rep what to do
// next, and the screen the whole day starts from.
//
// The other nine live in the drawer behind the top bar's menu button, all of
// them, in the shell's order. Nothing is dropped: a screen with no way to
// reach it is the failure scripts/check-sales-home.mjs exists for.

/** The hrefs that get a bottom-bar slot below `lg`, in bar order. */
export const TAB_BAR_HREFS = Object.freeze([
  "/sales",
  "/sales/queue",
  "/sales/playbook",
  "/sales/leads",
  "/sales/threads",
]);

/** The control that opens the mobile drawer, and the one that closes it. */
export const SALES_NAV_OPEN = "[data-tour-open='sales-nav']";
export const SALES_NAV_CLOSE = "[data-tour-close='sales-nav']";

/** Does this route get a slot on the bar, rather than a row in the drawer? */
export function isTabBarHref(href) {
  return TAB_BAR_HREFS.includes(href);
}

/**
 * Split the shell's tab list into what the bar shows and what the drawer holds.
 *
 * The bar keeps TAB_BAR_HREFS's order, not the shell's — the two agree today,
 * and if they ever disagree the bar's own order is the one a thumb learned.
 * The drawer keeps the shell's order for everything else, so it reads the
 * same top to bottom as the desktop tab row.
 *
 * Tolerates a missing or malformed list: the check feeds it hostile input and
 * the shell must not throw because a tab was mis-typed.
 */
export function splitPortalTabs(tabs) {
  const list = Array.isArray(tabs) ? tabs.filter((t) => t && typeof t.href === "string") : [];
  const bar = TAB_BAR_HREFS.map((href) => list.find((t) => t.href === href)).filter(Boolean);
  const drawer = list.filter((t) => !isTabBarHref(t.href));
  return { bar, drawer };
}

/**
 * Mirrors SalesShell's own active rule: /sales is exact, everything else is a
 * prefix — because /sales is a prefix of every other tab.
 */
export function isActiveTab(pathname, href) {
  if (typeof pathname !== "string" || typeof href !== "string") return false;
  return href === "/sales" ? pathname === "/sales" : pathname.startsWith(href);
}

/** The agency account's own row — see portalTabsFor. */
export const AGENCY_TEAM_HREF = "/sales/agency";

/**
 * The tab list one account actually gets.
 *
 * `me` is /api/sales/me's answer (null until it arrives). An agency's
 * employee loses Pay — the routes refuse them and a row that opens a refusal
 * is a dead control. An agency gains My team, placed before Pay: it is a
 * working screen, and Pay is the settings screen the shell keeps last.
 * Anyone else, and anyone whose identity has not loaded, gets the list as
 * declared. Pure, so scripts/check-sales-agency.mjs can execute all three.
 */
export function portalTabsFor(tabs, me, { teamLabel = "My team" } = {}) {
  const list = Array.isArray(tabs) ? tabs.filter((t) => t && typeof t.href === "string") : [];
  if (!me || typeof me !== "object") return list;
  if (me.agencyEmployee === true) return list.filter((t) => t.href !== "/sales/pay");
  if (me.isAgency === true) {
    const row = { href: AGENCY_TEAM_HREF, label: teamLabel };
    const at = list.findIndex((t) => t.href === "/sales/pay");
    return at === -1 ? [...list, row] : [...list.slice(0, at), row, ...list.slice(at)];
  }
  return list;
}
