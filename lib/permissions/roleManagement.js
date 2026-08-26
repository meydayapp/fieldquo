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

import {
  PERMISSION_CATEGORIES,
  PERMISSION_TOGGLES,
  PERMISSION_PRESETS,
  PRESET_TO_ROLE,
} from "@/lib/permissions";

export const ROLE_RANK = {
  owner: 3,
  admin: 2,
  supervisor: 1,
  employee: 0,
};

// ── What these tiers are CALLED, everywhere a person sees one ──────────────
//
// The invite screen offered "Worker / Dispatcher / Manager" and Manage Team
// then showed "Employee / Supervisor / Admin" for the same people. Two
// vocabularies for one concept, with nothing on either screen connecting them:
// the owner invited a Manager, later saw "Admin", and reasonably concluded
// somebody had escalated their own role.
//
// Job titles win, because that is the language the owner meets first and the
// language a contractor with a crew actually uses. `admin` keeps a formal name
// rather than a crew name — after the manager remap no preset creates one, and
// it is the co-owner/bookkeeper tier that can touch billing.
//
// This is the ONLY definition. app/app/settings/team/page.js carried a private
// copy of this map (and of ROLE_RANK), which is how the two screens were free
// to disagree in the first place.
//
// ── These are TIERS, and a tier is not a person's access ───────────────────
//
// Read this before rendering ROLE_LABELS anywhere. There are two vocabularies
// in this product and they are NOT 1:1:
//
//   role (this map)     4 values. The Postgres enum. What gates API routes via
//                       PERMISSIONS/can(), and what UNRESTRICTED_ROLES is about.
//   preset (the grid)   5 choices the UI actually offers. Two of them land on
//                       `employee` and two on `supervisor`.
//
// So `ROLE_LABELS[member.role]` cannot answer "what access does this person
// have?" — it collapses Dispatcher and Manager into the single word "Manager".
// Manage Team's read-only badge did exactly that, and an owner who had
// assigned Dispatcher read it as Manager: delete, job costing, payments,
// everyone's expenses. Nothing on the screen said the two vocabularies existed.
//
// Use describeAccess() in lib/permissions/accessPresets.js for anything a
// person reads as "who is this". Use this map only where the TIER is genuinely
// the subject, and label it as a tier when you do (see TIER_NOTE below).
export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Administrator",
  supervisor: "Manager",
  employee: "Worker",
};

/**
 * The presets that share each tier, by tier.
 *
 * Derived rather than written out, so a sixth preset cannot appear without the
 * screens that explain the tiers picking it up.
 */
export function presetsForRole(role) {
  return Object.entries(PRESET_TO_ROLE)
    .filter(([, r]) => r === role)
    .map(([key]) => PERMISSION_PRESETS[key]?.label || key)
    .filter(Boolean);
}

/**
 * "Manager tier — shared by Dispatcher and Manager."
 *
 * The one sentence that makes the two vocabularies legible at the point a
 * person meets them. Every screen that shows a tier next to an access level
 * shows this, so none of them has to invent its own wording.
 */
export function tierNote(role) {
  const tier = ROLE_LABELS[role] || role;
  const shared = presetsForRole(role);
  if (shared.length < 2) return `${tier} tier`;
  return `${tier} tier — shared by ${shared.join(" and ")}`;
}

/**
 * The names of what this actor may actually hand out, in the vocabulary the
 * invite and Manage Team screens use.
 *
 * The refusals below and in inviteGuard.js listed ROLE_LABELS for the
 * assignable ROLES — the other vocabulary. A Dispatcher was told "As manager,
 * you can only assign: Worker": it named a tier they do not hold, and offered
 * one word for two of the choices the screen behind the message shows.
 */
export function assignableAccessLabels(roleList) {
  const roles = new Set(roleList || []);
  const out = [];
  for (const [key, preset] of Object.entries(PERMISSION_PRESETS)) {
    if (roles.has(PRESET_TO_ROLE[key])) out.push(preset.label);
  }
  if (roles.has("admin")) out.push(ROLE_LABELS.admin);
  // A tier no preset produces still has to be nameable, or the sentence
  // silently drops an option somebody had.
  const covered = new Set(Object.values(PRESET_TO_ROLE));
  for (const role of roles) {
    if (!covered.has(role) && role !== "admin") out.push(ROLE_LABELS[role] || role);
  }
  return out;
}

export function rankOf(role) {
  return ROLE_RANK[role] ?? -1;
}

/**
 * Who may switch a team member's access on or off.
 *
 * NOT `can(role, "user:manage")`, which is what this route used. Supervisors
 * hold user:manage — it means "may run a crew": invite an estimator, fix a
 * phone number, set a labour rate. None of that implies authority to revoke
 * somebody's login.
 *
 * Deactivation ends a person's access to their employer's system, frees a
 * licensed seat, and — as QA proved — can lock an account out entirely. The
 * owner's call: that belongs to whoever owns the account, not to whoever can
 * edit the roster.
 *
 * Deliberately the same two roles as isBillingAdmin, and deliberately a
 * SEPARATE function. They answer different questions and will not always agree;
 * one file each is what stopped the billing gate from drifting, and this is the
 * same reasoning.
 */
export function canRevokeAccess(role) {
  return role === "owner" || role === "admin";
}

/**
 * Who may change what a team member can see and do.
 *
 * The mirror of canRevokeAccess, and deliberately the same answer. QA found
 * the asymmetry: a Dispatcher could open Daniel's row and move him from
 * "Worker (limited access)" to "Worker" — granting him every client's contact
 * details and every price in the company — but could not have switched his
 * login off afterwards. Granting access was the wider power of the two, and it
 * was the one left open.
 *
 * The owner's ruling, in their words: a dispatcher's job is assigning work,
 * not deciding who sees what. So supervisors keep the whole of "may run a
 * crew" — invite an estimator, set a labour rate, publish shifts, approve
 * leave, schedule anybody — and lose exactly one thing: editing the standing
 * access of somebody who is already on the roster.
 *
 * Note what this does NOT gate. Inviting is still a supervisor's job and is
 * still clamped by assignableRoles + clampPermissions, because staffing a crew
 * is the thing the tier exists for. Altering a colleague's account is not.
 *
 * Separate function from canRevokeAccess rather than an alias: they answer
 * different questions and a future owner may well want a Manager who can
 * re-grade a worker but never lock one out. Aliasing would make that a
 * two-file change with one of them easy to miss.
 */
export function canGrantAccess(role) {
  return role === "owner" || role === "admin";
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
      // Deliberately does NOT open with "As <your tier>". It used to, and a
      // Dispatcher read "As manager, you can only assign: Worker" — a tier
      // they do not hold, in a vocabulary nothing they can see uses. What the
      // reader needs is the list, in the words the control offers.
      const available = assignableAccessLabels(assignableRoles(actor.role));
      return {
        ok: false,
        error: available.length
          ? `You can only give someone access below your own. Available to you: ${available.join(", ")}.`
          : "You can't change anyone's access.",
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
