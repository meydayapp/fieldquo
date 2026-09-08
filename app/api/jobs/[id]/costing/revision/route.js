// app/api/jobs/[id]/costing/revision/route.js
//
// "Update" or "Leave as is" — the answer to the close-out's one question.
//
// The close-out (app/components/jobs/CostReview.js) asks it only when the
// job came in over the company's threshold (lib/costing/costRevision.js), and
// whichever button is pressed lands here: Job.costRevisionDecision and the
// time it was decided. "Update" is recorded when the person applies a
// suggested rate or presses Done on the suggestions — NOT when they merely
// open them, because opening and closing without changing anything is not a
// revision.
//
// A sibling of the review endpoint rather than a mode of it, because the two
// happen at different moments: the decision is made mid-review, and stamping
// costReviewedAt at that point would close a review the person has not
// finished. The review endpoint accepts the same field for the one case
// where completing IS the decision (its own comment explains).
//
// Writes the decision and nothing else. The suggested rates themselves go
// through the settings routes they belong to, from the browser, exactly as
// the material calibration does.
//
// Gated exactly like the review and calibration endpoints beside it: the
// job's view level, the jobCosting toggle, the job's edit level, and the
// caller's assigned-jobs scope on the query.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle, assignedJobWhere, requireLevel } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { normaliseRevisionDecision } from "@/lib/costing/costRevision";

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
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
  const decision = normaliseRevisionDecision(body.decision);
  if (!decision) {
    return NextResponse.json(
      { error: "Choose Update or Leave as is." },
      { status: 400 },
    );
  }

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true, title: true, status: true, costRevisionDecision: true, costRevisionDecidedAt: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "completed") {
    return NextResponse.json(
      { error: "Mark the job completed first — its cost isn't final until the work is." },
      { status: 409 },
    );
  }
  // Asked once, answered once. A second answer is reported as the first
  // rather than overwritten: the person pressing Done after applying a line
  // has not changed their mind, and a stale tab's "Leave as is" must not undo
  // an Update that already happened.
  if (job.costRevisionDecision) {
    return NextResponse.json({
      decision: job.costRevisionDecision,
      decidedAt: job.costRevisionDecidedAt,
      alreadyDecided: true,
    });
  }

  const updated = await db.job.update({
    where: { id: job.id, companyId: member.companyId },
    data: { costRevisionDecision: decision, costRevisionDecidedAt: new Date() },
    select: { costRevisionDecision: true, costRevisionDecidedAt: true },
  });
  await recordActivity(member, {
    action: "job.cost_revision_decided",
    entityType: "job",
    entityId: job.id,
    summary:
      decision === "updated"
        ? `Revised the costing from what ${job.title} really cost`
        : `Kept the costing as it is after ${job.title}`,
    metadata: { jobId: job.id, decision },
  });
  return NextResponse.json({
    decision: updated.costRevisionDecision,
    decidedAt: updated.costRevisionDecidedAt,
    alreadyDecided: false,
  });
}
