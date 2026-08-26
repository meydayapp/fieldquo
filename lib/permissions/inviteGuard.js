// lib/permissions/inviteGuard.js
//
// May this caller invite somebody on these terms?
//
// ── Why this is a shared function and not a check in a route ───────────────
//
// There are TWO invite routes: /api/settings/members (the full New User form)
// and /api/team/quick-add (the modal). They write the same PendingTeamProfile,
// which becomes a Member with that role and grid on accept.
//
// The full route was hardened after QA created an Administrator from a
// Manager account — it grew an assignableRoles check, an isAdministrator
// refusal, clampPermissions, and a pay-rate clamp. Quick-add got none of them
// and still validated `role` against a list of legal VALUES, which says
// nothing about whether this caller may hand one out. The escalation was
// closed on one door and left open on the other, which is worse than leaving
// both open: the fix reads as done.
//
// So the rule lives here, once, and both routes call it. A third invite path
// added later has one obvious thing to call.

import {
  assignableRoles,
  assignableAccessLabels,
  clampPermissions,
} from "./roleManagement";
import { hasLevel } from "./enforce";

/**
 * @param {object} p
 * @param {object} p.actor  { role, permissions } — from the DB, never the body
 * @param {string} p.role
 * @param {object} [p.permissions]
 * @param {number|string|null} [p.laborCostPerHour]
 * @returns {{ok: false, error: string, status: number}
 *          |{ok: true, role: string, permissions: object|null, laborCostPerHour: number|null}}
 */
export function validateInvite({ actor, role, permissions, laborCostPerHour }) {
  const allowed = assignableRoles(actor?.role);

  if (!allowed.includes(role)) {
    // Same reason as validateRoleChange: the sentence used to open "As
    // manager…" for a Dispatcher, naming the shared TIER rather than the
    // access they actually hold, and then listed tier names for choices the
    // invite screen shows by preset name.
    const available = assignableAccessLabels(allowed);
    return {
      ok: false,
      status: 403,
      error: available.length
        ? `You can only add someone with access below your own. Available to you: ${available.join(", ")}.`
        : "You can't add team members.",
    };
  }

  // A second door to the same room: the New User page uses isAdministrator to
  // mean "full access, ignore the grid". Someone who cannot assign `admin`
  // must not be able to grant admin-shaped permissions under another key.
  if (permissions?.isAdministrator === true && !allowed.includes("admin")) {
    return {
      ok: false,
      status: 403,
      error: "You can't give someone full administrator access.",
    };
  }

  // You cannot hand out more than you hold. Without this, a Manager on
  // payroll: view_own invites someone with run_payroll and reaches the payroll
  // they are denied through a person they hired.
  const safePermissions = clampPermissions(actor?.role, actor?.permissions, permissions);

  // A pay rate is payroll. Someone who may not see other people's pay must not
  // be able to set it — QA put 99 on a probe invite.
  const canSetPay = hasLevel(actor, "payroll", "view_all");
  const rate = laborCostPerHour == null || laborCostPerHour === "" ? null : Number(laborCostPerHour);

  return {
    ok: true,
    role,
    permissions: safePermissions,
    laborCostPerHour: canSetPay && Number.isFinite(rate) ? rate : null,
  };
}
