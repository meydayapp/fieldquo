// lib/permissions/nav.js
//
// The nav layer of the permission grid. Pure — no database, no React — so both
// sidebars share one implementation and a check script can execute it.
//
// ── This is cosmetics, and says so ─────────────────────────────────────────
//
// Removing a row from a menu is not access control, and this file is not what
// stops anybody doing anything. lib/permissions/enforce.js is. This exists so
// an employee's sidebar stops listing eleven screens that will refuse them —
// which QA reported as reading like a broken product rather than a boundary.
//
// Mirrors lib/features/nav.js exactly, including its failure posture: an
// unknown row is SHOWN. A nav that empties itself because a map was missing is
// a far worse failure than a row leading to a page that gates itself.
import { hasLevel, hasToggle } from "./enforce";

/**
 * nav i18n key → what the grid must say for the row to be worth showing.
 *
 * Only rows a restricted member genuinely cannot use are listed. A row that
 * merely shows LESS at a lower level — jobs, quotes, invoices, the schedule,
 * the clock — is deliberately absent: view_only is a real, useful level, and
 * hiding the quotes list from someone allowed to read quotes would remove
 * their job rather than a temptation.
 *
 * `toggle` rows are all-or-nothing switches; `category`/`level` rows are the
 * ladder.
 */
export const NAV_REQUIREMENTS = {
  // Money screens. Nothing on them survives showPricing:false — a revenue
  // dashboard with the revenue removed is not a smaller dashboard.
  "app.nav.insights": { toggle: "showPricing" },

  // The company expense roll-up: burn rate, runway, spend by category. A
  // member confined to their own expenses has no use for it, and QA found the
  // aggregate half was never scoped.
  "app.nav.expenses": { category: "expenses", level: "view_record_edit_all" },

  // Approving an instant estimate is supervisor-and-up, enforced server-side.
  // An employee opening this finds a list of Approve buttons that are all
  // disabled, which reads as the product being broken.
  "app.nav.estimateReviews": { role: ["owner", "admin", "supervisor"] },

  // Timesheet review and payout runs. Both refuse an employee at the API;
  // both were reachable and rendered enabled controls.
  "app.nav.timesheets": { category: "timeTracking", level: "view_record_edit_all" },

  // Roster, invitations, licence headroom, the owner's email address.
  "app.nav.team": { role: ["owner", "admin", "supervisor"] },
};

/**
 * Should this nav row be shown to this member?
 *
 * @param navKey  the row's i18n key
 * @param member  { role, permissions } — or null, which shows everything
 */
export function navRowAllowed(navKey, member) {
  const req = NAV_REQUIREMENTS[navKey];
  if (!req) return true;          // no rule — the common case
  if (!member) return true;       // provider missing; see the header

  // Owners and admins hold everything; the grid was never meant to bind them.
  if (member.role === "owner" || member.role === "admin") return true;

  if (req.role) return req.role.includes(member.role);
  if (req.toggle) return hasToggle(member, req.toggle);
  if (req.category) return hasLevel(member, req.category, req.level);
  return true;
}

/**
 * Drop disallowed rows from a group list, keeping every other property intact.
 *
 * Groups that lose all their items are dropped too — a header with nothing
 * under it announces "something used to be here", which is the trace hiding
 * the rows was meant to avoid.
 */
export function filterNavGroupsByPermission(groups, member) {
  if (!Array.isArray(groups)) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: (group.items || []).filter((item) => navRowAllowed(item.key, member)),
    }))
    .filter((group) => (group.items || []).length > 0);
}

/** The flat-list variant, for the bottom rail and the search corpus. */
export function filterNavItemsByPermission(items, member) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => navRowAllowed(item.key, member));
}
