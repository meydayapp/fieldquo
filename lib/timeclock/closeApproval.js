// lib/timeclock/closeApproval.js
//
// Does closing an entry approve it, or does it join the queue?
//
// The approval queue exists so a second pair of eyes checks hours before they
// become money. When the person who worked them is the person who would sign
// them off — an owner-operator, anyone at `view_record_edit_all` — there is no
// second pair. The queue becomes a rubber stamp, and from the outside it reads
// as a broken screen: the owner clocks a day onto a job, opens job costing, and
// Labour says $0.00 with no indication that the hours exist and are waiting.
//
// Landing those entries approved grants nobody a permission they didn't hold.
// `view_record_edit_all` could already approve them in one click — this removes
// the click, not the control. Crew stay pending, which is the entire point of
// the queue.
//
// Deliberately NOT a company setting. A toggle here would be a second place for
// the same rule to be wrong, and the rule it encodes ("can this person approve
// their own hours?") is already answered by the permission grid; asking it
// twice is how the two answers drift apart.
//
// The approval is stamped and attributed exactly as the manual path stamps it —
// `approvedById` is the approver — and the caller logs `timeEntry.selfApproved`
// against it, so "who approved these hours" never answers "nobody".
import { hasLevel } from "@/lib/permissions/enforce";

/**
 * Fields to merge into the `data` of a clock-out write. `{}` means "leave it
 * pending", so every caller can spread the result unconditionally.
 *
 * @param {object}  args
 * @param {object}  args.full          member with role + permissions (loadEnforceableMember)
 * @param {?string} args.userId        the user doing the closing
 * @param {?string} args.workerUserId  the user whose hours these are
 * @returns {{status?: "approved", approvedById?: string}}
 */
export function closeApproval({ full, userId, workerUserId }) {
  // Somebody else's timesheet is somebody else's to approve, whatever the
  // closer's level — a supervisor clocking a crew member out has reviewed
  // nothing. Both ids must be present AND equal: two nulls are not a match.
  if (!userId || !workerUserId || userId !== workerUserId) return {};
  if (!hasLevel(full, "timeTracking", "view_record_edit_all")) return {};
  return { status: "approved", approvedById: userId };
}

/** True when `closeApproval` decided to approve — for the audit trail. */
export function didSelfApprove(approval) {
  return approval?.status === "approved";
}
