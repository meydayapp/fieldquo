// lib/invitations/acceptMember.js
//
// Turning an accepted invitation into a Member who holds the access the
// invitation promised — in ONE transaction, and never into a Member holding
// more.
//
// ── The three holes this closes ─────────────────────────────────────────────
//
// The accept route used to do this in separate steps: upsert the Member with
// `update: { active: true }`, then call reconcilePendingProfiles() to copy the
// invited grid across with `permissions: match.permissions ?? p.permissions`,
// with that second call wrapped in a .catch that logged and carried on.
// scripts/check-invite-accept-access.mjs ran the route and observed:
//
//   1. An accept onto an EXISTING Member row kept the old role (the upsert's
//      update branch never wrote one) and the old grid (`??` prefers it). An
//      ex-Manager accepting a Crew invitation came back a Manager.
//   2. The update branch also re-activated anyone, from any invitation the
//      route admits — including the "accepted" one a person was hired with,
//      re-run from their inbox after they were switched off. Deactivation
//      is the owner's decision; an old link must not undo it.
//   3. When the grid copy failed (a Neon cold start is the ordinary version),
//      the person was left ACTIVE with permissions null. enforce.js reads a
//      null grid as "fall back to the coarse role" — for an invited Crew
//      member that is every quote, invoice and client in the company.
//
// ── What happens instead ────────────────────────────────────────────────────
//
//   * The Member write, the role, the grid and consuming the pending profile
//     are one interactive transaction. Any failure rolls all of it back and
//     the route answers 500; the invitation link still works, so a retry
//     lands correctly. There is no "in, but without their grid" state.
//   * When a pending profile exists, its role and grid REPLACE whatever the
//     row held. The invitation is the most recent statement of what this
//     person may do. Contact fields keep the old no-clobber rule — those are
//     the person's own, not the company's grant.
//   * An inactive Member is re-activated only by an invitation that was still
//     PENDING when this request arrived, i.e. a new one somebody sent.
//   * A gridded role (employee, supervisor) is never written with no grid. An
//     invitation that carries none lands the most restrictive preset for its
//     role — measured, not assumed, in check-invite-accept-access.mjs 2c.
//
// ── Why the null-grid fall-open in enforce.js is NOT changed here ──────────
//
// hasLevel() reading a null grid as "coarse role" is load-bearing elsewhere:
// getCurrentMember() returns no `permissions` at all, impersonation runs as
// role "viewer" with none, and routes that grade the session member without
// loading the grid rely on it. Flipping it would refuse working calls across
// the app. Production holds zero non-owner/admin Members with a null or empty
// grid (queried 2026-10-09), so the hole is the WRITE that could create one,
// and that is the write this module owns.

import { Prisma } from "@prisma/client";
import { PERMISSION_PRESETS } from "@/lib/permissions";
import { UNRESTRICTED_ROLES } from "@/lib/permissions/enforce";

/**
 * The preset a gridded role lands on when an invitation states no grid.
 * check-invite-accept-access.mjs asserts each is at or below every other
 * preset of the same role in every category, so a preset edit that makes
 * one of these the more generous of its pair turns that check red.
 */
export const RESTRICTIVE_PRESET_FOR_ROLE = Object.freeze({
  employee: "worker", // Crew
  supervisor: "dispatcher",
});

/** A copy of the most restrictive preset's grid for `role`, or null. */
export function restrictivePresetFor(role) {
  const key = RESTRICTIVE_PRESET_FOR_ROLE[role];
  return key && PERMISSION_PRESETS[key] ? { ...PERMISSION_PRESETS[key].values } : null;
}

/** Does this value state anything? `{}` reads as fully open, same as null. */
export function hasGrid(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

/**
 * The grid a member of `role` should hold when the invitation carried
 * `stored`. Owner/admin skip the grid entirely, so nothing is invented for
 * them; a gridded role never gets none.
 */
export function gridForInvitedRole(role, stored) {
  if (UNRESTRICTED_ROLES.has(role)) return hasGrid(stored) ? stored : null;
  if (hasGrid(stored)) return stored;
  return restrictivePresetFor(role);
}

const CONTACT_FIELDS = [
  "phone",
  "address",
  "city",
  "province",
  "postalCode",
  "country",
  "imageUrl",
  "laborCostPerHour",
  "invitationLanguage",
];

/**
 * Create or update the Member for an accepted invitation, atomically.
 *
 * @param db  the Prisma client (must support interactive $transaction)
 * @param p.companyId
 * @param p.userId
 * @param p.email              the invitation's email
 * @param p.invitationRole     Better Auth's role on the invitation (admin|member)
 * @param p.wasPending         the invitation's status was "pending" BEFORE this
 *                             request accepted it — i.e. a fresh invitation
 * @returns {{ ok: true, member, pending }} or {{ ok: false, status, error }}
 *          `pending` is the consumed profile's title/startOnboarding, which
 *          the route's later, non-access steps still need.
 */
export async function acceptInvitationMembership(db, { companyId, userId, email, invitationRole, wasPending }) {
  return db.$transaction(async (tx) => {
    const existing = await tx.member.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });

    const pending = await tx.pendingTeamProfile.findUnique({
      where: { companyId_email: { companyId, email: String(email).toLowerCase() } },
    });

    // A switched-off member comes back only on a NEW invitation: one still
    // pending when this request arrived, or — on a retry after this very
    // transaction rolled back, when Better Auth has already flipped the
    // invitation to accepted — the pending profile that invitation wrote,
    // which success consumes in the same transaction. An old accepted link
    // has neither.
    if (existing && existing.active === false && !wasPending && !pending) {
      return {
        ok: false,
        status: 403,
        error: "Your access to this company was switched off. Ask them to reactivate you or send a new invitation.",
      };
    }

    let role;
    let grid;
    if (existing?.role === "owner") {
      // The invite doors refuse an email that already has a Member row, so
      // this is not a path anyone is meant to reach — but an invitation must
      // never be the thing that demotes an owner, possibly the last one.
      role = "owner";
      grid = existing.permissions ?? null;
    } else if (pending) {
      // The invitation's terms, replacing the row's — see the header.
      role = pending.role || (invitationRole === "admin" ? "admin" : "employee");
      grid = gridForInvitedRole(role, pending.permissions);
    } else if (existing) {
      // A re-run with nothing new to apply (the bookmarked link): the row
      // keeps what it holds, except that a gridded role is never left open.
      role = existing.role;
      grid = hasGrid(existing.permissions) ? existing.permissions : gridForInvitedRole(role, null);
    } else {
      role = invitationRole === "admin" ? "admin" : "employee";
      grid = gridForInvitedRole(role, null);
    }

    const contact = {};
    for (const f of CONTACT_FIELDS) {
      // No-clobber: only fill what the person has not set themselves.
      const mine = existing?.[f];
      const offered = pending?.[f];
      if ((mine === null || mine === undefined) && offered !== null && offered !== undefined) contact[f] = offered;
    }

    const member = existing
      ? await tx.member.update({
          where: { id: existing.id },
          data: {
            active: true,
            role,
            // Prisma refuses a bare null on a Json column; DbNull clears the
            // old grid for an admin, whose grid is never read anyway.
            permissions: grid ?? Prisma.DbNull,
            ...contact,
          },
        })
      : await tx.member.create({
          data: {
            userId,
            companyId,
            role,
            active: true,
            ...(grid && { permissions: grid }),
            ...contact,
          },
        });

    if (pending) await tx.pendingTeamProfile.delete({ where: { id: pending.id } });

    return {
      ok: true,
      member,
      pending: pending ? { title: pending.title ?? null, startOnboarding: Boolean(pending.startOnboarding) } : null,
    };
  });
}
