// lib/permissions/enforce.js
//
// Makes the granular permission grid actually mean something.
//
// The gap this closes: PERMISSION_CATEGORIES and the Manage Team editor have
// existed for a while, and Member.permissions is populated and displayed —
// but no API route ever read it. Every route checked only the coarse role, so
// a member set to "Quotes: view only" could still POST /api/quotes, because
// PERMISSIONS.employee includes "quote:create".
//
// That's worse than having no grid at all. A company can configure access,
// see it saved, and reasonably believe an employee is restricted when they
// aren't — which is a staffing decision made on a false premise.
//
// Design notes:
//
//   * Owners and admins bypass everything. PERMISSIONS.owner/admin are ["*"]
//     and the grid was never meant to constrain them.
//
//   * A member with NO permissions object falls back to their role's coarse
//     rights. Existing members predate the grid, and defaulting them to "no
//     access" would lock out working accounts on deploy.
//
//   * Levels are ordered least-to-most within each category, so "at least X"
//     is an index comparison rather than a set of hardcoded strings.

import { PERMISSION_CATEGORIES } from "@/lib/permissions";

/** Roles the grid doesn't apply to. */
const UNRESTRICTED_ROLES = new Set(["owner", "admin"]);

/**
 * Does this member have at least `level` in `category`?
 *
 * @param {object} member    { role, permissions }
 * @param {string} category  key of PERMISSION_CATEGORIES
 * @param {string} level     minimum level value required
 */
export function hasLevel(member, category, level) {
  if (!member) return false;
  if (UNRESTRICTED_ROLES.has(member.role)) return true;

  const config = PERMISSION_CATEGORIES[category];
  if (!config) return true; // unknown category — don't invent a restriction

  const permissions = member.permissions;
  // No grid configured: fall back to coarse role behaviour rather than
  // denying. See the note above about pre-existing members.
  if (!permissions || typeof permissions !== "object") return true;

  const current = permissions[category];
  if (current === undefined) return true;

  const levels = config.levels.map((l) => l.value);
  const currentIndex = levels.indexOf(current);
  const requiredIndex = levels.indexOf(level);

  if (requiredIndex === -1) return true; // asked for a level that isn't real
  if (currentIndex === -1) return false; // stored a level that isn't real

  return currentIndex >= requiredIndex;
}

/** On/off switches — showPricing, jobCosting, payments. */
export function hasToggle(member, toggle) {
  if (!member) return false;
  if (UNRESTRICTED_ROLES.has(member.role)) return true;
  const permissions = member.permissions;
  if (!permissions || typeof permissions !== "object") return true;
  if (permissions[toggle] === undefined) return true;
  return permissions[toggle] === true;
}

/**
 * Throws a 403-shaped error when the level isn't met. Mirrors
 * requirePermission's contract so route handlers catch it the same way.
 */
export function requireLevel(member, category, level, action = "do that") {
  if (!hasLevel(member, category, level)) {
    const err = new Error(
      `Your access level for ${PERMISSION_CATEGORIES[category]?.label || category} doesn't allow you to ${action}.`,
    );
    err.status = 403;
    throw err;
  }
}

export function requireToggle(member, toggle, action = "do that") {
  if (!hasToggle(member, toggle)) {
    const err = new Error(`You don't have permission to ${action}.`);
    err.status = 403;
    throw err;
  }
}

/**
 * Scope filter for categories whose levels distinguish "their own" from
 * "everyone's" — schedule, timeTracking, expenses.
 *
 * These aren't gates. "View their own schedule" doesn't mean 403 on the list
 * endpoint, it means the list should contain only their rows. Returning a
 * Prisma `where` fragment keeps that decision here rather than duplicated as
 * an if-statement in every route.
 *
 * @param ownerField  the column identifying who a row belongs to. Differs per
 *                    model — appointments use assignedToId, time entries use
 *                    workerId — so the caller names it.
 * @returns {} for full access, or { [ownerField]: userId } to narrow
 */
export function scopeFilter(member, category, ownerField, userId) {
  if (!member) return { [ownerField]: "__none__" };
  if (UNRESTRICTED_ROLES.has(member.role)) return {};

  const config = PERMISSION_CATEGORIES[category];
  const permissions = member.permissions;
  if (!config || !permissions || typeof permissions !== "object") return {};

  const current = permissions[category];
  if (current === undefined) return {};

  // Every "see everything" level in these categories contains "_all". That's
  // a naming convention rather than a guarantee, so it's asserted here in one
  // place instead of matching level strings across a dozen routes.
  const seesEverything = String(current).includes("_all");
  return seesEverything ? {} : { [ownerField]: userId };
}

/**
 * Loads the member with the fields enforcement needs.
 *
 * getCurrentMember returns a lightweight session shape that doesn't include
 * `permissions`, so routes doing granular checks need this. Kept separate so
 * routes that only need the coarse role don't pay for an extra query.
 */
export async function loadEnforceableMember(db, memberId) {
  return db.member.findUnique({
    where: { id: memberId },
    select: { id: true, role: true, permissions: true, companyId: true },
  });
}

/** Turns a thrown permission error into a NextResponse-friendly shape. */
export function permissionErrorResponse(err) {
  return {
    body: { error: err.message || "Forbidden" },
    status: err.status || 403,
  };
}
