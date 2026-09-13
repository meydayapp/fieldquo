// lib/payroll/ownPayGate.js
//
// May this person see THEIR OWN pay? One answer, read by the my-payslips
// route, the employee home (the "est. earnings for this shift" line) and the
// Earnings tab — so a worker whose payroll dial is "No access" is shown
// hours everywhere and money nowhere, and the three screens cannot drift.
//
// The rule is the one app/api/payroll/my-payslips/route.js has enforced
// since it was written: owners and admins always; everyone else needs the
// payroll ladder at view_own or above. Pure, so the check script runs it
// against every preset.
import { hasLevel } from "@/lib/permissions/enforce";

/**
 * @param member  loadEnforceableMember's shape ({ role, permissions }) — or
 *                the PermissionProvider's, which is the same two fields
 */
export function canSeeOwnPay(member) {
  if (!member || typeof member.role !== "string") return false;
  if (member.role === "owner" || member.role === "admin") return true;
  return (
    hasLevel(member, "payroll", "view_own") ||
    hasLevel(member, "payroll", "view_all") ||
    hasLevel(member, "payroll", "run_payroll")
  );
}
