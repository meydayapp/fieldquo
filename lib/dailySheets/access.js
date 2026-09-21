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

import { hasLevel } from "@/lib/permissions/enforce";

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
