// lib/photoComments/mentionable.js
//
// Who may be @mentioned on a job's photos — which is the same question as
// "who may see this job", asked with the same predicate the job list itself
// uses.
//
// ══ Why this can't just be "everyone at jobs:view_only or above" ══════════
//
// The Crew preset sits at jobs:view_only, but is SCOPED — a crew member only
// sees the jobs they have a visit on (lib/permissions/enforce.js,
// seesOnlyAssignedJobs / assignedJobWhere). Offering every Crew member in the
// company as a mention target on THIS job would let someone tag a colleague
// who has never heard of it and, worse, would leak that this job exists to a
// crew member who cannot open it — the exact hole the owner named: "the
// picker must respect the permission grid — do not offer to mention someone
// who cannot see the job."
//
// So this reuses seesOnlyAssignedJobs/assignedJobWhere's own logic rather than
// re-deriving it: an unscoped member (owner, admin, Dispatcher, Manager,
// Estimator) sees every job and is always offered; a scoped member (Crew) is
// offered only when their userId is on one of THIS job's visits.
//
// ══ Recomputed fresh at write time, not just at picker time ═══════════════
//
// The picker's list can go stale between page load and hitting send — a
// reassignment, a deactivation. The comment route re-derives this exact set
// immediately before writing mentions rather than trusting whatever the
// browser had open, for the same reason every write route in this codebase
// re-checks scope at the door instead of trusting a client-supplied id.
import { seesOnlyAssignedJobs } from "@/lib/permissions/enforce";

/**
 * Pure: may this member see a job whose visits are assigned to the given set
 * of user ids?
 *
 * @param memberRow          { role, permissions, userId } — enforce.js shape
 * @param assignedUserIds    Set<string> of JobVisit.assignedToId on the job
 */
export function memberCanSeeJob(memberRow, assignedUserIds) {
  if (!memberRow) return false;
  if (!seesOnlyAssignedJobs(memberRow)) return true;
  return Boolean(memberRow.userId) && assignedUserIds.has(memberRow.userId);
}

/**
 * Active company members who may be @mentioned on this job, shaped for a
 * picker: { memberId, userId, name, role }.
 *
 * Returns [] for a job that doesn't exist or isn't this company's — same
 * "not found looks like not found" posture as every other job route, so a
 * guessed id can't be used to fish for who is on a job.
 */
export async function mentionableMembersForJob(db, { companyId, jobId }) {
  if (!companyId || !jobId) return [];

  const job = await db.job.findFirst({
    where: { id: jobId, companyId },
    select: { visits: { select: { assignedToId: true } } },
  });
  if (!job) return [];

  const assignedUserIds = new Set(
    job.visits.map((v) => v.assignedToId).filter(Boolean),
  );

  const members = await db.member.findMany({
    where: { companyId, active: true },
    select: {
      id: true,
      userId: true,
      role: true,
      permissions: true,
      user: { select: { id: true, name: true } },
    },
  });

  return members
    .filter((m) => memberCanSeeJob(m, assignedUserIds))
    .map((m) => ({
      memberId: m.id,
      userId: m.userId,
      name: m.user?.name || "",
      role: m.role,
    }));
}

/**
 * Narrow a caller-supplied list of member ids down to ones that are real,
 * active, in THIS company, and eligible to see THIS job — dropping (never
 * erroring on) anything else: another tenant's member id, a deactivated one,
 * one who can't see the job, a duplicate, or an id that matches nobody. The
 * comment itself is worth saving even when every mention target turns out to
 * be bogus, so this filters rather than refuses.
 *
 * The author's own id is dropped here too — mentioning yourself notifies
 * nobody, so it is treated the same as an invalid target rather than kept
 * around as a mention with nothing to deliver.
 */
export async function resolveMentions(db, { companyId, jobId, authorMemberId, requestedMemberIds }) {
  const requested = Array.from(
    new Set(
      (Array.isArray(requestedMemberIds) ? requestedMemberIds : [])
        .filter((id) => typeof id === "string" && id.trim())
        .map((id) => id.trim()),
    ),
    // A generous cap, not a feature limit — five is the number named in the
    // owner's own hostile-input list; twenty guards against a payload trying
    // to fan out a write to every member row in the company.
  ).slice(0, 20);

  if (!requested.length) return [];

  const eligible = await mentionableMembersForJob(db, { companyId, jobId });
  const eligibleIds = new Set(eligible.map((m) => m.memberId));

  return requested.filter((id) => id !== authorMemberId && eligibleIds.has(id));
}
