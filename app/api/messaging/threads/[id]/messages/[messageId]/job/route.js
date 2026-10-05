// app/api/messaging/threads/[id]/messages/[messageId]/job/route.js
//
// POST { jobId: "<job>" | null } — "Which job?" answered on one message in
// Messages (lib/conversations/autoLink.js): the job this text / email /
// WhatsApp is about, or null for "Not about a job". Either is a person's
// decision (Message.jobLinkedBy = "person"), so the automatic rule never
// touches the message again. Changing an automatic tag is the same press.
//
// ══ Who may ════════════════════════════════════════════════════════════════
//
// requests ≥ view_create_edit — the rung that links a thread to a job by hand
// (PATCH /api/messaging/threads/[id]) — and jobs ≥ view_only, not scoped to
// their own jobs: a job is named, so a member who cannot read jobs cannot
// pick one. Never in a support session (impersonation is read-only).
//
// ══ What may be picked ═════════════════════════════════════════════════════
//
// A job of THIS company (ownedIdsRefusal, before anything is written) AND of
// the thread's own client — a message from Jane is never filed to Bob's job.
// A thread with no client has no jobs to offer: link the client first.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, hasLevel, seesOnlyAssignedJobs, permissionErrorResponse } from "@/lib/permissions/enforce";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { JOB_LINKED_BY } from "@/lib/conversations/autoLink";

async function graded(member) {
  const full = member.id ? await loadEnforceableMember(db, member.id) : null;
  return { ...member, permissions: full?.permissions ?? null };
}

export async function POST(request, { params }) {
  const { id, messageId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) return NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 });

  const full = await graded(member);
  try {
    requireLevel(full, "requests", "view_create_edit", "file a message to a job");
    requireLevel(full, "jobs", "view_only", "file a message to a job");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }
  if (seesOnlyAssignedJobs(full)) {
    return NextResponse.json({ error: "Filing conversations to jobs is done from the office.", reason: "scoped" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const jobId = body?.jobId === null ? null : typeof body?.jobId === "string" && body.jobId ? body.jobId : undefined;
  if (jobId === undefined) {
    return NextResponse.json({ error: "Say which job, or none.", reason: "bad_job" }, { status: 400 });
  }
  if (jobId) {
    // A foreign key from the request — proved to be this company's first.
    const bad = await ownedIdsRefusal(NextResponse, db, member.companyId, { jobId });
    if (bad) return bad;
  }

  const thread = await db.messageThread.findFirst({ where: { id: String(id || ""), companyId: member.companyId }, select: { id: true, clientId: true } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const message = await db.message.findFirst({ where: { id: String(messageId || ""), threadId: thread.id }, select: { id: true, direction: true, private: true } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (message.direction !== "in" && message.direction !== "out") {
    return NextResponse.json({ error: "Only a message can be filed to a job.", reason: "not_a_message" }, { status: 400 });
  }

  if (jobId) {
    if (!thread.clientId) {
      return NextResponse.json({ error: "Link this conversation to a client first.", reason: "no_client" }, { status: 409 });
    }
    const job = await db.job.findFirst({ where: { id: jobId, companyId: member.companyId, clientId: thread.clientId }, select: { id: true } });
    if (!job) {
      return NextResponse.json({ error: "That job isn't one of this client's.", reason: "other_client" }, { status: 400 });
    }
  }

  await db.message.update({ where: { id: message.id }, data: { jobId, jobLinkedBy: JOB_LINKED_BY.PERSON } });
  return NextResponse.json({ ok: true, jobId, jobLinkedBy: JOB_LINKED_BY.PERSON });
}
