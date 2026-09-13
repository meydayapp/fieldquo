// lib/hr/access.js
//
// Who may open a person's HR file, and who may see their own.
//
// ══ Two doors, on purpose ══════════════════════════════════════════════════
//
// A person's file — their licence, their write-ups, their onboarding — has
// exactly two readers: the managers who keep it, and the person it is about.
// Nobody else. So there are two gates and every /api/hr route calls one:
//
//   requireHrManage(member)   the manager side: `user:manage`, the same
//                             coarse authority the subcontractor roster and
//                             the team roster sit behind. Supervisors hold
//                             it (lib/permissions.js), Crew do not.
//   myWorker(db, member)      the worker side: the caller's OWN Worker row,
//                             found by companyId + userId and nothing off the
//                             request. A route that takes a workerId from the
//                             URL is a manager route; a route about "me" never
//                             reads an id at all.
//
// The `notes` permission category is NOT reused here. It gates job and
// client notes, which are about the work; a write-up is about the person and
// is far more sensitive. Reusing the category would let anybody who may edit
// a job note read a colleague's performance file.
//
// ══ companyId on every read ════════════════════════════════════════════════
//
// Every query in lib/hr and lib/onboarding takes the company from the
// session's member and puts it in the `where`. scripts/check-hr.mjs executes
// the loaders against a fake database holding two companies' rows and fails
// if a row from the other company ever comes back.
import { can } from "@/lib/permissions";

/** The coarse authority a person's HR file sits behind. */
export const HR_PERMISSION = "user:manage";

/** May this member open and change people's HR files? */
export function canManageHr(member) {
  return !!member && can(member.role, HR_PERMISSION);
}

const DENIAL = "Only an owner, admin or supervisor can see or change a person's HR file.";

/** Throws a 403-shaped error, matching requireLevel / requireSubcontractorRead. */
export function requireHrManage(member) {
  if (!canManageHr(member)) {
    const err = new Error(DENIAL);
    err.status = 403;
    throw err;
  }
}

/**
 * The caller's own Worker row, or null when they have none.
 *
 * companyId + userId, the pattern app/api/time-clock/route.js uses: a Worker
 * links to a User, not to a Member, and the user id comes from the session.
 * An office admin with no Worker row simply has no "me" file — the screens
 * say so rather than inventing one, because a Worker row is also a payroll
 * row and creating one from an HR screen would put somebody on the roster.
 */
export async function myWorker(db, member) {
  if (!member?.companyId || !member?.userId) return null;
  return db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: { id: true, name: true, title: true, hiredOn: true, userId: true, companyId: true },
  });
}

/**
 * A worker in the CALLER's company, or null. The only way a manager route
 * turns a URL id into a row — the companyId is the session's.
 */
export async function ownWorker(db, member, workerId) {
  if (!member?.companyId || typeof workerId !== "string" || !workerId) return null;
  return db.worker.findFirst({
    where: { id: workerId, companyId: member.companyId },
    select: { id: true, name: true, title: true, hiredOn: true, userId: true, companyId: true, active: true, email: true },
  });
}
