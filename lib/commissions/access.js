// lib/commissions/access.js
//
// Who may see whose commissions, and who may decide them.
//
// A commission is pay. The payroll category's rule — "their own only" by
// default, everyone's as a deliberate grant — is the rule here too, with one
// addition the owner named: jobCosting also sees everyone's, because a
// commission is a cost of the job and the job-costing panel already shows
// what a job's labour cost. Nothing else widens it.
//
//   seesAll   payroll ≥ view_all, OR the jobCosting toggle
//   canEdit   payroll ≥ view_all — rates, splits and fixed overrides are pay
//             decisions, the same gate that lets someone set a labour rate
//             (lib/permissions/inviteGuard.js#canSetPay)
//   canSettle payroll ≥ run_payroll — including a commission on a pay run is
//             running payroll, and is enforced by the pay-run route itself
//
// Everyone else sees their OWN commission and nobody else's: the report and
// the job card filter to their member id on the server, not by hiding rows.
//
// Pure over the enforceable member (lib/permissions/enforce.js#
// loadEnforceableMember), so scripts/check-commissions.mjs can run every
// preset through it.

import { canSeeAllPay, hasLevel, hasToggle } from "@/lib/permissions/enforce";

export function commissionAccess(member) {
  if (!member) return { seesAll: false, canEdit: false, canSettle: false };
  const payAll = canSeeAllPay(member);
  return {
    seesAll: payAll || hasToggle(member, "jobCosting"),
    canEdit: payAll,
    canSettle: hasLevel(member, "payroll", "run_payroll"),
  };
}

/** Owners and admins switch the feature on and choose its basis. */
export function canConfigureCommissions(member) {
  return member?.role === "owner" || member?.role === "admin";
}

/**
 * Narrow a list of earner rows to what this member may see: all of them, or
 * only their own. The rows keep their shape; others are removed, not blanked,
 * because a blanked row still says "someone else earned on this job".
 */
export function visibleEarners(member, rows, ownMemberId) {
  const list = Array.isArray(rows) ? rows : [];
  if (commissionAccess(member).seesAll) return list;
  return list.filter((r) => r?.memberId && r.memberId === ownMemberId);
}

/**
 * A price-book row with its commission rates removed for someone who may not
 * see pay. The catalogue itself is gated on showPricing, which a quote writer
 * holds; an item's commission rate is what a worker earns on it, which they
 * do not. `commissionable` goes too — it is the same decision in one bit.
 */
export function redactProductCommission(member, product) {
  if (!product || typeof product !== "object") return product;
  if (canSeeAllPay(member)) return product;
  const out = { ...product };
  delete out.workedByPct;
  delete out.soldByPct;
  delete out.commissionable;
  return out;
}
