// lib/dailySheets/access.js
//
// Who sees whose sheet, and who may evaluate one.
//
// The rule is the timesheet's, borrowed rather than restated: someone with
// timeTracking at view_record_edit_all (owner, admin, the coordinator) sees
// every crew member's day and writes the evaluation; everyone else sees
// their own sheet and nothing else — not a colleague's photos, not a
// colleague's score. `sheetScope` returns the Prisma filter the route
// applies, so the narrowing is a query and not a UI decision; the check
// script executes it for the three cases.

import { hasLevel, canSeeMoney } from "@/lib/permissions/enforce";

/**
 * May this member see every sheet in the company and evaluate them?
 *
 * hasLevel fails OPEN for a member with no permission grid (a pre-existing
 * row, see enforce.js). That is tolerable for a timesheet list and not for
 * a colleague's evaluation and photos, so a member without a grid is a
 * coordinator only by role: owner, admin or supervisor. With a grid, the
 * grid decides, the way it does for the timesheets screen.
 */
export function coordinatesSheets(member) {
  if (!member) return false;
  if (member.role === "owner" || member.role === "admin") return true;
  if (!member.permissions || typeof member.permissions !== "object") return member.role === "supervisor";
  return hasLevel(member, "timeTracking", "view_record_edit_all");
}

/**
 * The `where` fragment on DailyObjectiveSheet for this member.
 *
 * @param {object} member   loadEnforceableMember's row (needs userId, role, permissions)
 * @param {string|null} ownWorkerId   the Worker row for this member's user, or null
 * @returns {object|null}   a filter, or null meaning "nothing at all" (no
 *                          worker record and no coordinator rights)
 */
export function sheetScope(member, ownWorkerId) {
  if (coordinatesSheets(member)) return {};
  if (!ownWorkerId) return null;
  return { workerId: ownWorkerId };
}

/** May this member write objectives/upsells on a sheet for `workerId`? */
export function mayEditSheet(member, ownWorkerId, workerId) {
  if (coordinatesSheets(member)) return true;
  return Boolean(ownWorkerId) && ownWorkerId === workerId;
}

/** Only a coordinator evaluates — a person cannot score their own day. */
export function mayEvaluate(member) {
  return coordinatesSheets(member);
}

// ── Upsells are selling, and crew do not sell (owner, 2026-10-04) ─────────
//
// The sheet credited a crew member with the add-ons and change orders on
// their job, amounts included, because their bonus could be a percentage of
// them. The owner's ruling: crew do not sell, so crew do not see upsell
// amounts at all — estimators and up only. An upsell's amount IS a price on
// the quote (an add-on, a change order), so the rule is the one that already
// decides who reads quote prices: showPricing, plus a quotes level at all.
// Crew hold neither; Estimator, Dispatcher and Manager hold both.
//
// Applied to every door that carried the amounts: GET .../upsells (refused),
// the day's sheets and the week (stripped, and said so with upsellsHidden),
// and PUT (a non-seller cannot write upsells, and their save leaves the ones
// on file alone rather than wiping them).
export function seesUpsells(member) {
  if (!member) return false;
  return canSeeMoney(member) && hasLevel(member, "quotes", "view_only");
}

/**
 * A sheet as a non-seller may read it: no upsells, and the bonus's upsell line
 * without the base it was a percentage of (its percentage would give the base
 * back). The line's cents stay — that is the person's own pay, and their pay
 * is theirs to read. Returns a new object.
 */
export function withoutUpsells(sheet) {
  if (!sheet || typeof sheet !== "object") return sheet;
  const { upsells: _u, ...rest } = sheet;
  const lines = Array.isArray(sheet.bonusBreakdown)
    ? sheet.bonusBreakdown.map((l) => {
        if (!l || l.key !== "upsell") return l;
        const { base: _b, pct: _p, ...keep } = l;
        return keep;
      })
    : sheet.bonusBreakdown;
  return { ...rest, bonusBreakdown: lines, upsellsHidden: true };
}
