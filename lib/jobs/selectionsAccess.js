// lib/jobs/selectionsAccess.js
//
// Who may read and who may change a job's colours and materials — one gate for
// the three routes under app/api/jobs/[id]/selections, so the fourth copy that
// forgets the scope never gets written.
//
//   read   jobs:view_only, and the job must be one the member may see:
//          assignedJobWhere narrows Crew to the jobs they are on. Crew reads
//          the colours — they are the people mixing the paint.
//   change jobs:view_create_edit — the level PATCH /api/jobs/[id] edits the
//          job at. Not a role check: an owner who doesn't want Managers
//          editing jobs sets the grid, and this follows it.
//
// A job in another company, or one a Crew member is not on, is "Not found" —
// the same answer, so an id copied off a shared screen tells them nothing.
// Readable and not editable is a 403 that says so.
//
// `db` is passed in (the routes pass lib/db; scripts/check-job-selections.mjs
// passes a fake), so the gate the check executes is the gate that ships.
import {
  loadEnforceableMember,
  hasLevel,
  assignedJobWhere,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

/**
 * @param member  the session member (memberOrRefusal) — id and companyId
 * @param jobId   the job from the URL
 * @param write   true for every verb that changes a row
 * @returns {{ full, job, canEdit }} or {{ refusal: { status, body } }}
 */
export async function selectionsAccess(db, member, jobId, { write = false } = {}) {
  const full = await loadEnforceableMember(db, member?.id);
  try {
    requireLevel(full, "jobs", "view_only", "see jobs");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return { refusal: { status, body } };
  }
  const companyId = member?.companyId;
  if (!companyId || !jobId) return { refusal: { status: 404, body: { error: "Not found" } } };

  const job = await db.job.findFirst({
    where: { id: String(jobId), companyId, ...assignedJobWhere(full) },
    select: { id: true, companyId: true, quoteId: true },
  });
  if (!job) return { refusal: { status: 404, body: { error: "Not found" } } };

  const canEdit = hasLevel(full, "jobs", "view_create_edit");
  if (write && !canEdit) {
    return {
      refusal: {
        status: 403,
        body: {
          error: "You can read this job's colours and materials. Changing them needs access to edit jobs.",
          code: "read_only",
        },
      },
    };
  }
  return { full, job, canEdit };
}
