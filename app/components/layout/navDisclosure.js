// app/components/layout/navDisclosure.js
//
// The rules that decide what a grouped sidebar actually renders. Both sidebars
// import these; neither reimplements them.
//
// ── Why this file has no imports at all ─────────────────────────────────────
//
// Not React, not lucide, not `@/`. scripts/check-sidebar.mjs imports it under
// plain node to PROVE the reachability invariant below on the real functions
// rather than on a restatement of them. A restatement is the thing that rots:
// it agrees with the component on the day it is written and silently stops
// agreeing later. Anything needing React lives in NavFilter.js.
//
// ── The invariant ───────────────────────────────────────────────────────────
//
// Collapsing a group must never be the reason a page becomes unreachable.
// Three structural guarantees, in the order they apply:
//
//   1. A non-empty query overrides disclosure entirely. Typing an item's own
//      label always renders that item, whatever is collapsed. This is the
//      guarantee the check asserts item by item.
//   2. Group headers are never hidden by disclosure state — only by a query
//      that doesn't match them. A closed group is therefore always one visible
//      click from open.
//   3. The icon-only rail has no headers to click, so it ignores disclosure
//      and renders every item. Collapsing the rail cannot combine with a
//      collapsed group to hide something.
//
// Item and group shape: `{ key, items: [{ key, href, icon }] }`. `label` is the
// caller's translator — these functions never touch i18n themselves, which is
// what lets the check run them with a stub.

/**
 * Groups whose name matches, or whose items match, `query`.
 *
 * A group-name match keeps ALL of that group's items: searching "team" should
 * surface everything filed under Team & scheduling, including the items whose
 * own label never says "team". Groups left with nothing disappear rather than
 * rendering a heading over empty space.
 */
export function filterGroups(groups, query, label) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((group) => {
      const groupMatches = label(group.key).toLowerCase().includes(q);
      return {
        ...group,
        items: group.items.filter(
          (item) => groupMatches || label(item.key).toLowerCase().includes(q),
        ),
      };
    })
    .filter((group) => group.items.length > 0);
}

/**
 * Is the row at `href` the current page? A prefix match ("/app" exact), except
 * that among the rows in `hrefs`, a longer one that ALSO matches wins. Since
 * 2026-09-28 the rail carries Marketing (/app/marketing) and the designer
 * beneath it (/app/marketing/designer) side by side, and a bare prefix match
 * lit both as "you are here" on the designer — two current pages is none. The
 * same longest-href rule activeGroupKey below already uses for the group.
 *
 * A row NOT in `hrefs` keeps the plain prefix match: the Settings row at the
 * rail's foot stays lit on every settings page, which is how it has always
 * told the reader the settings list is where they are.
 */
export function isRowActive(href, pathname, hrefs = []) {
  const path = typeof pathname === "string" ? pathname : "";
  const matches = (h) => (h === "/app" ? path === "/app" : Boolean(h) && path.startsWith(h));
  if (!matches(href)) return false;
  if (!hrefs.includes(href)) return true;
  return !hrefs.some((h) => h !== href && h.length > href.length && h.startsWith(href) && matches(h));
}

/** The group holding the current route, by longest matching href. */
export function activeGroupKey(groups, pathname, isActive) {
  let best = null;
  let bestLen = -1;
  for (const group of groups) {
    for (const item of group.items) {
      if (isActive(item.href) && item.href.length > bestLen) {
        best = group.key;
        bestLen = item.href.length;
      }
    }
  }
  return best;
}

/**
 * The open set at mount: defaults, then the user's stored overrides, then the
 * active group forced open on top.
 *
 * Forcing the active group is deliberately a LOAD-time rule and not a render-
 * time one. Applied on every render it would silently undo a click on the
 * current group's header — a control that appears to work and doesn't. The
 * component re-applies it when the route changes, so deep-linking into a
 * closed group still lands you looking at your surroundings.
 */
export function initialOpenKeys({ defaultOpenKeys = [], overrides = {}, active = null }) {
  const open = new Set(defaultOpenKeys);
  for (const [key, isOpen] of Object.entries(overrides || {})) {
    if (isOpen) open.add(key);
    else open.delete(key);
  }
  if (active) open.add(active);
  return open;
}

/**
 * One-open-at-a-time ("exclusive") disclosure — the owner's rule since
 * 2026-09-29 for EVERY accordion sidebar: the main rail, the settings list
 * and the /platform console. Opening a group closes the others, so the
 * sidebar stays short. The invariant above still holds — headers never hide,
 * a query shows every match, the rail ignores disclosure — this only decides
 * WHICH one group is open. No group is exempt: "pinned" groups (Work and AI,
 * kept open for the welcome tour's anchors) were retired the same day; the
 * tour unfolds the group it needs through the header instead.
 *
 * The one open group at mount: the group holding the current page, else the
 * group the user last opened (the one `true` in their stored overrides), else
 * the first default. Never more than one.
 */
export function initialExclusiveKey({ defaultOpenKeys = [], overrides = {}, active = null }) {
  if (active) return active;
  const stored = Object.entries(overrides || {}).filter(([, isOpen]) => isOpen);
  if (stored.length) return stored[stored.length - 1][0];
  return defaultOpenKeys[0] ?? null;
}

/** The open set after clicking `key` in exclusive mode: it alone, or none. */
export function exclusiveToggle(openKeys, key) {
  return openKeys.has(key) ? new Set() : new Set([key]);
}

/**
 * Whether a group shows its items. The single source of truth for guarantees
 * 1 and 3 — both sidebars call this rather than deciding for themselves, so
 * the check script exercises the rule that actually ships.
 *
 * There is no `pinned` escape hatch any more (retired 2026-09-29, owner:
 * every accordion folds). A group that must be seen by the tour is opened by
 * the tour through its header — see NAV_GROUPS in AdminSidebar.js.
 */
export function isGroupOpen({ group, openKeys, searching = false, railCollapsed = false }) {
  // A query, or a rail with no room for headings, shows everything it found.
  if (searching || railCollapsed) return true;
  return openKeys.has(group.key);
}

/** The items a sidebar renders, given its full state. */
export function visibleItems({ groups, query, openKeys, label, railCollapsed = false }) {
  const filtered = filterGroups(groups, query, label);
  const searching = String(query || "").trim().length > 0;
  const out = [];
  for (const group of filtered) {
    if (isGroupOpen({ group, openKeys, searching, railCollapsed })) out.push(...group.items);
  }
  return out;
}

/** Group headers always survive disclosure state; only a query can filter them. */
export function visibleGroups({ groups, query, label }) {
  return filterGroups(groups, query, label);
}

/** Disclosure is a preference, not a record — localStorage, never the schema. */
export function readOverrides(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Private mode, quota, or somebody's hand-edited JSON. Defaults are a fine
    // answer; a nav that throws on boot is not.
    return {};
  }
}

export function writeOverrides(storageKey, overrides) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(overrides));
  } catch {
    /* nothing to do — the nav still works, it just won't remember */
  }
}
