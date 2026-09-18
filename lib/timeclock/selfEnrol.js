// lib/timeclock/selfEnrol.js
//
// Whether the person at the time clock may set THEMSELVES up as a worker, and
// what that costs.
//
// ══ Why the owner was locked out of their own clock ════════════════════════
//
// /app/clock resolves the caller's Worker row by companyId + userId and, with
// none, says "You're not set up as a worker yet. Ask an admin to add you under
// Team." The owner IS the admin. They created the company, never accepted an
// invitation (invite acceptance is where Worker rows are normally made —
// lib/team/ensureWorker.js), and so had nobody to ask. Foremen and managers
// who work on the tools as well as run them sat in the same hole.
//
// ══ Who may, and why it is the HR authority ════════════════════════════════
//
// `user:manage` — owner, admin, supervisor (lib/permissions.js). That is the
// authority that adds anybody to Team → Workers, so letting its holders add
// themselves widens nothing: they could already create the row by hand on
// that screen, with more fields. An employee-role member keeps today's
// sentence, because a Worker row is also a payroll row and creating one for
// yourself is a thing a manager does for you.
//
// Impersonation is read-only (AGENTS.md non-negotiable #2), and this creates
// a row, so it is refused under impersonation regardless of the role the
// impersonated member holds.
//
// ══ Seats ══════════════════════════════════════════════════════════════════
//
// A Worker row consumes NO seat. Seats are counted off MEMBERS — role and
// permission grid — by countSeats in lib/pricing/ladder.js, and a Worker row
// is neither: it is the payroll and timesheet record for a person who is
// already a member (or for a hand-entered crew member with no login at all).
// The caller here is a member by definition, so the seat they hold is held
// whether or not this row exists. scripts/check-clock-self-enrol.mjs proves
// that with the real countSeats rather than restating it. The screen says
// so in one line, because the owner asked.
//
// ══ What is NOT set ════════════════════════════════════════════════════════
//
// No pay rate. hourlyRate stays null — the same rule ensureWorkerForMember
// applies, for the same reason: Member.laborCostPerHour is a COST and a pay
// rate is what lands in a bank account, and copying one into the other would
// invent a wage. Whoever runs payroll sets it under Team → Workers, and the
// screen says so before the row is created.

import { can } from "@/lib/permissions";

/** The authority that adds people to Team → Workers. */
export const SELF_ENROL_PERMISSION = "user:manage";

/** May this member create their own Worker row from the clock? */
export function canSelfEnrol(member) {
  if (!member || member.impersonation) return false;
  return can(member.role, SELF_ENROL_PERMISSION);
}

/**
 * Does creating a Worker row for this member change the seat count?
 *
 * Always false, for the reason in the header — kept as a named function so
 * the screen and the check both ask it rather than assuming it.
 */
export function selfEnrolAddsSeat() {
  return false;
}

/**
 * The verdict on a self-enrol request, given what the database says.
 *
 * @param {object} args
 * @param {object} args.member        the caller (role, companyId, userId, impersonation)
 * @param {object|null} args.existing the caller's Worker row in THIS company, if any
 * @param {object|null} args.linkedElsewhere a Worker row anywhere carrying
 *                                    this userId — Worker.userId is globally
 *                                    unique, so a row at another company means
 *                                    the link cannot be made here
 * @returns {{ ok: true, action: "already" | "create" }}
 *       or {{ ok: false, status: number, error: string }}
 */
export function selfEnrolVerdict({ member, existing = null, linkedElsewhere = null } = {}) {
  if (!member?.companyId || !member?.userId) {
    return { ok: false, status: 401, error: "Sign in first." };
  }
  if (member.impersonation) {
    return {
      ok: false,
      status: 403,
      error: "Impersonation is read-only — a worker record can't be created from a support session.",
    };
  }
  if (!canSelfEnrol(member)) {
    return {
      ok: false,
      status: 403,
      error: "You're not set up as a worker yet. Ask an admin to add you under Team → Workers.",
    };
  }
  if (existing) return { ok: true, action: "already" };
  if (linkedElsewhere && linkedElsewhere.companyId !== member.companyId) {
    return {
      ok: false,
      status: 409,
      error:
        "Your login is already linked to a worker record at another company, so it can't be linked here too. Ask an admin to add you under Team → Workers with a different email.",
    };
  }
  return { ok: true, action: "create" };
}
