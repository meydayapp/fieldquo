// app/api/jobs/[id]/costing/review/route.js
//
// "I have looked at what this job actually cost, and it is complete."
//
// ══ Why a person has to say it ═════════════════════════════════════════════
//
// The estimate-versus-actual comparison (lib/costing/actualJobCost.js) has
// been on the job page since job costing shipped. What nothing did was ask
// anyone to make the ACTUAL side whole: hours sat pending, receipts sat
// untagged, and the comparison measured an estimate against half a job — and
// then the estimate-accuracy report rolled those half-jobs up as if they
// were the company's estimating record.
//
// Completing a job now raises a task ("Review what X actually cost") and the
// job page opens the review. This endpoint is the "done" at the end of it:
// it stamps Job.costReviewedAt, keeps the note, and settles the task. It
// writes nothing else — approving hours and tagging receipts happen where
// they always have, and this only records that somebody checked.
//
// Gated like the costing screen it closes (jobs:view_only + the jobCosting
// toggle) AND like the job's own PATCH (jobs:view_create_edit): a person who
// may not edit the job may not sign off its cost either.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle, assignedJobWhere, requireLevel } from "@/lib/permissions/enforce";
import { resolveTaskBySource, jobCostReviewKey } from "@/lib/tasks/autoCreate";
import { recordActivity } from "@/lib/activity/log";
import { normaliseRevisionDecision } from "@/lib/costing/costRevision";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return denied;
  if (!hasToggle(full, "jobCosting")) {
    return NextResponse.json({ error: "You don't have access to job costing." }, { status: 403 });
  }
  try {
    requireLevel(full, "jobs", "view_create_edit", "edit jobs");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  let body = {};
  try {
    body = (await request.json()) || {};
  } catch {
    body = {};
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) || null : null;
  // ── The threshold decision, when completing IS the decision ──────────────
  //
  // The modal's "The cost is complete" button says, under itself, that
  // completing while the "update your costing?" prompt is still open counts
  // as leaving the costing as it is — and sends that explicitly. Absent or
  // unrecognised here means "this request did not decide" and touches
  // nothing: an already-recorded decision must survive a second review, and
  // a bare completion on a job under the threshold must not stamp one.
  const revisionDecision = normaliseRevisionDecision(body.revisionDecision);

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true, title: true, status: true, costReviewedAt: true, costRevisionDecision: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "completed") {
    // A review of a job still running would be a review of a number that is
    // about to change. Say so rather than stamping it.
    return NextResponse.json(
      { error: "Mark the job completed first — its cost isn't final until the work is." },
      { status: 409 },
    );
  }

  // A job decides once. A decision already on the row wins over one sent
  // now — the prompt never showed on this review, so nothing sent with it
  // can have been an answer to it.
  const decides = Boolean(revisionDecision) && !job.costRevisionDecision;
  const updated = await db.job.update({
    where: { id: job.id, companyId: member.companyId },
    data: {
      costReviewedAt: new Date(),
      costReviewNote: note,
      ...(decides && { costRevisionDecision: revisionDecision, costRevisionDecidedAt: new Date() }),
    },
    select: { id: true, costReviewedAt: true, costReviewNote: true, costRevisionDecision: true, costRevisionDecidedAt: true },
  });
  await resolveTaskBySource(jobCostReviewKey(job.id));
  await recordActivity(member, {
    action: "job.cost_reviewed",
    entityType: "job",
    entityId: job.id,
    summary: `Reviewed the actual cost of ${job.title}${job.costReviewedAt ? " (again)" : ""}`,
    metadata: { jobId: job.id, note, revisionDecision: decides ? revisionDecision : null },
  });
  return NextResponse.json(updated);
}
