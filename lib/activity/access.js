// lib/activity/access.js
//
// Who may read the company's activity log, and which of its rows.
//
// ══ Owner and admin, and since 2026-10-04 the Manager ══════════════════════
//
// The owner's ruling: "YES managers can read the activity log". A Manager is
// not a role — the preset maps to `supervisor`, the same role a Dispatcher
// has (lib/permissions.js PRESET_TO_ROLE) — so the role alone cannot say it.
// What separates the two presets is the jobCosting toggle: the grant that
// says "this person sees the company's money in full", cost and margin
// included. That is also what the log is full of — payments recorded, a
// rate changed off a price review, a price book edited — so it is the
// honest test, not a proxy picked because it happens to differ.
//
//   owner, admin                         every row
//   supervisor holding jobCosting        every row except PAY (below)
//   anyone else                          refused
//
// A support session (impersonation) reads it as before — non-negotiable #3,
// decided in the route, not here.
//
// ══ Pay stays with payroll ═════════════════════════════════════════════════
//
// The Manager preset excludes payroll ("Not payroll, and not the company's
// billing") and the log carries both: a pay run's net total, a payroll
// component, a worker setting their own rate, commission rates, the
// company's FieldQuo plan. Those rows are left out for anyone who is not a
// payroll admin (owner or admin — lib/permissions/settingsAccess.js
// isPayrollAdmin), so opening the log is not a side door onto pay.
//
// The settings sidebar row reads the same rule (SETTINGS_ROW_CAPABILITY
// "user:manage" + SETTINGS_ROW_REQUIREMENTS { toggle: "jobCosting" }), so the
// row is drawn for exactly the people this lets in.
import { hasToggle } from "@/lib/permissions/enforce";

/** Action prefixes a non-payroll reader never sees. */
export const PAY_ACTION_PREFIXES = Object.freeze([
  "payroll.",
  "settings.payroll_",
  "worker.ownRate",
  "worker.ownPayroll",
  "commissions.",
  "billing.",
  "hr.note_",
]);

/** @param member { role, permissions } — loadEnforceableMember's row */
export function canReadActivityLog(member) {
  if (!member) return false;
  if (member.role === "owner" || member.role === "admin") return true;
  if (member.role !== "supervisor") return false;
  return hasToggle(member, "jobCosting");
}

/** Does this reader see the pay rows? */
export function seesPayActivity(member) {
  return member?.role === "owner" || member?.role === "admin";
}

/** The Prisma `where` that leaves pay rows out — `{}` for a payroll admin. */
export function activityVisibilityWhere(member) {
  if (seesPayActivity(member)) return {};
  return { NOT: PAY_ACTION_PREFIXES.map((p) => ({ action: { startsWith: p } })) };
}
