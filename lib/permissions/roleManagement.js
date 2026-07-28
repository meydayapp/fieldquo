// lib/permissions/roleManagement.js
//
// Who is allowed to change whose role, and to what.
//
// The trap in delegated role management is privilege escalation. If a
// supervisor can edit roles at all, and nothing stops them, the first thing
// they can do is promote themselves to admin — or promote a friend, or demote
// the owner. Every rule below exists to close one of those doors:
//
//   1. You can only assign roles STRICTLY BELOW your own.
//      A supervisor assigning "supervisor" would let them clone their own
//      authority; assigning "admin" would let them exceed it.
//
//   2. You can only edit members strictly below your own rank.
//      Otherwise two supervisors can demote each other, and an admin can
//      demote the owner who hired them.
//
//   3. You can never grant a granular permission you don't hold yourself.
//      Rank alone isn't enough — a supervisor with "quotes: view only" must
//      not be able to hand an employee "view, create, edit, delete".
//
//   4. The last owner can't be demoted or deactivated.
//      An account with no owner has no one who can restore access, and
//      recovering it is a support ticket against the platform console.
//
//   5. Nobody can change their own role.
//      Even an owner — it's the single most common way an account locks
//      itself out, and there's no legitimate case for it that a second owner
//      doesn't solve.
//
// Rank order matches MemberRole in the schema.

import { PERMISSION_CATEGORIES, PERMISSION_TOGGLES } from "@/lib/permissions";

export const ROLE_RANK = {
  owner: 3,
  admin: 2,
  supervisor: 1,
  employee: 0,
};

export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  supervisor: "Supervisor",
  employee: "Employee",
};

export function rankOf(role) {
  return ROLE_RANK[role] ?? -1;
}

/** Roles this actor may assign to someone else. Always strictly below them. */
export function assignableRoles(actorRole) {
  const actorRank = rankOf(actorRole);
  return Object.keys(ROLE_RANK).filter((r) => rankOf(r) < actorRank);
}

/** Can this actor edit this target member at all? */
export function canManageMember(actor, target) {
  if (!actor || !target) return false;
  // Rule 5 — never yourself.
  if (actor.id === target.id) return false;
  // Rule 2 — strictly below.
  return rankOf(actor.role) > rankOf(target.role);
}

/**
 * Rule 3, applied to the granular grid.
 *
 * Each category is an ordered list of levels, least to most access. An actor
 * can grant any level up to and including their own — never beyond. An owner
 * or admin (whose PERMISSIONS entry is "*") is unrestricted.
 */
export function clampPermissions(actorRole, actorPermissions, requested) {
  if (actorRole === "owner" || actorRole === "admin") return requested;
  if (!requested || typeof requested !== "object") return {};

  const out = {};

  for (const [category, config] of Object.entries(PERMISSION_CATEGORIES)) {
    const wanted = requested[category];
    if (wanted === undefined) continue;

    const levels = config.levels.map((l) => l.value);
    const actorLevel = actorPermissions?.[category];
    const actorIndex = levels.indexOf(actorLevel);
    const wantedIndex = levels.indexOf(wanted);

    if (wantedIndex === -1) continue; // not a real level — drop it

    // Actor has no explicit level for this category: they can't delegate it.
    if (actorIndex === -1) continue;

    out[category] = wantedIndex <= actorIndex ? wanted : actorLevel;
  }

  for (const toggle of Object.keys(PERMISSION_TOGGLES)) {
    if (requested[toggle] === undefined) continue;
    // A toggle can only be turned ON by someone who has it on.
    out[toggle] = requested[toggle] && actorPermissions?.[toggle] === true;
  }

  return out;
}

/**
 * Full check for a role change. Returns { ok: true } or { ok: false, error }.
 *
 * `ownerCount` is the number of active owners in the company, needed for
 * rule 4 — the caller queries it because this module stays free of db access
 * so it can be unit-tested without a database.
 */
export function validateRoleChange({ actor, target, nextRole, ownerCount }) {
  if (!canManageMember(actor, target)) {
    if (actor?.id === target?.id) {
      return {
        ok: false,
        error:
          "You can't change your own role. Ask another owner or admin to do it.",
      };
    }
    return {
      ok: false,
      error: "You can only manage team members below your own role.",
    };
  }

  if (nextRole !== undefined) {
    if (!assignableRoles(actor.role).includes(nextRole)) {
      return {
        ok: false,
        error: `As ${ROLE_LABELS[actor.role]?.toLowerCase()}, you can only assign: ${assignableRoles(
          actor.role,
        )
          .map((r) => ROLE_LABELS[r])
          .join(", ")}.`,
      };
    }

    // Rule 4 — demoting the last owner.
    if (target.role === "owner" && nextRole !== "owner" && ownerCount <= 1) {
      return {
        ok: false,
        error:
          "This is the only owner. Promote someone else to owner before changing this.",
      };
    }
  }

  return { ok: true };
}

/** Same rule-4 protection for deactivation. */
export function validateDeactivation({ actor, target, ownerCount }) {
  if (!canManageMember(actor, target)) {
    return {
      ok: false,
      error:
        actor?.id === target?.id
          ? "You can't deactivate your own account."
          : "You can only manage team members below your own role.",
    };
  }
  if (target.role === "owner" && ownerCount <= 1) {
    return {
      ok: false,
      error: "This is the only owner and can't be deactivated.",
    };
  }
  return { ok: true };
}
