// lib/receipts/access.js
//
// Who sees which receipts, and who may put them where.
//
// ══ The owner's rule, as the expenses grid already expresses it ═══════════
//
// "Crew can snap receipts and pick among THEIR jobs (or 'not sure — let the
// office decide'); they can't see other members' expenses or reassign; office
// and admin see all and can re-link."
//
// The permission grid already has exactly this ladder under Expenses:
//
//   view_record_edit_own  — the crew rung: capture, see and confirm their own
//                           receipts, against their own jobs only
//   view_record_edit_all  — the office rung: every receipt, any job, re-link
//
// So no new permission category was invented; a receipt IS an expense before
// it is booked, and gating it on a second dial would let the two disagree.
// Owners and admins pass through hasLevel as they do everywhere.
//
// Every route re-checks from a freshly loaded member (loadEnforceableMember);
// nothing here trusts what the browser says the person is allowed.
import { hasLevel } from "@/lib/permissions/enforce";

/** Does this member see and manage everyone's receipts? */
export function seesAllReceipts(full) {
  return hasLevel(full, "expenses", "view_record_edit_all");
}

/** A Prisma `where` narrowing receipts to the ones this member may see. */
export function receiptScope(full, userId) {
  if (seesAllReceipts(full)) return {};
  // Both sides truthy, the rule app/api/expenses/[id]/route.js states: a
  // session without a userId must match nothing, never every null row.
  return { createdById: userId || "__none__" };
}

/** May this member act on this one receipt row? */
export function mayTouchReceipt(full, userId, receipt) {
  if (!receipt) return false;
  if (seesAllReceipts(full)) return true;
  return Boolean(userId) && receipt.createdById === userId;
}
