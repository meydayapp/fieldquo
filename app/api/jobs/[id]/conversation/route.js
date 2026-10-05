// app/api/jobs/[id]/conversation/route.js
//
// GET ?scope=job|all&channel=&cursor= — the job's client's timeline
// (lib/conversations/clientTimeline.js): narrowed to the job's window when
// the client has more than one job (quote created → completed + 30 days),
// always including what is filed to this job or its quote. scope=all is the
// "All of this client's messages" toggle.
//
// ══ Who may read it ════════════════════════════════════════════════════════
//
//   jobs ≥ view_only, and the job inside the member's own scope
//   (assignedJobWhere — a crew member sees their own jobs, somebody else's
//   reads as not there), exactly as GET /api/jobs/[id] and the job's "Email"
//   section ask;
//   AND requests ≥ view_only — the inbox's read rung. The job page is not a
//   side door into the inbox: a crew member at requests: none gets a 403
//   here and the section draws nothing.
//
// Below clientsProperties full_view the phone numbers and addresses are
// withheld from the entries (the "Email" section's rule); the words are not,
// because the inbox rung already reads them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel, assignedJobWhere } from "@/lib/permissions/enforce";
import { messagingConnection } from "@/lib/messaging/channels";
import { loadClientTimeline, timelineAccess } from "@/lib/conversations/clientTimeline";
import { CALL_AUDIO_LEVEL } from "@/lib/voice/recording";

async function graded(member) {
  const full = member.id ? await loadEnforceableMember(db, member.id) : null;
  return { ...member, permissions: full?.permissions ?? null };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await graded(member);
  const access = timelineAccess({ member, full, hasLevel, callLevel: CALL_AUDIO_LEVEL });
  if (!member.impersonation && !hasLevel(full, "jobs", "view_only")) {
    return NextResponse.json({ error: "You don't have access to jobs.", reason: "no_job_access" }, { status: 403 });
  }
  if (!access.read) {
    return NextResponse.json({ error: "Your access level for Requests doesn't allow you to read client conversations.", reason: "no_inbox_access" }, { status: 403 });
  }

  const job = await db.job.findFirst({
    where: { id: String(id || ""), companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true, clientId: true, quoteId: true, createdAt: true, completedAt: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const data = await loadClientTimeline(db, {
    companyId: member.companyId,
    clientId: job.clientId,
    job,
    scope: url.searchParams.get("scope") === "all" ? "all" : "job",
    channel: url.searchParams.get("channel"),
    cursor: url.searchParams.get("cursor"),
    access,
    connection: access.reply ? await messagingConnection(member.companyId) : null,
  });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
