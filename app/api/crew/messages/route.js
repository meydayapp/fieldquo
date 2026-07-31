// app/api/crew/messages/route.js
//
// What the crew inbox has received — so the things it COULDN'T file don't
// vanish. Filed photos already show on the job; this page is for the exceptions
// that need a person: an unanswered "which job?", or a text from a number
// that isn't on the roster.
//
// PATCH resolves a pending message by hand — the owner picks the job the crew
// never chose, and it files exactly as an SMS reply would have.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { fileHeldMessage } from "@/lib/crew/inbox";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await db.crewInboundMessage.findMany({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, senderPhone: true, senderUserId: true, body: true,
      mediaUrls: true, status: true, method: true, jobId: true,
      candidateJobIds: true, createdAt: true,
    },
  });

  // Resolve the names for pending candidates and filed jobs in one pass, so the
  // list can say "Oak St" rather than a cuid.
  const jobIds = [
    ...new Set(messages.flatMap((m) => [...(m.candidateJobIds || []), m.jobId].filter(Boolean))),
  ];
  const jobs = jobIds.length
    ? await db.job.findMany({
        where: { id: { in: jobIds }, companyId: member.companyId },
        select: { id: true, title: true, client: { select: { name: true } } },
      })
    : [];
  const nameOf = (id) => {
    const j = jobs.find((x) => x.id === id);
    return j ? j.client?.name || j.title || "a job" : "a job";
  };

  const senderIds = [...new Set(messages.map((m) => m.senderUserId).filter(Boolean))];
  const users = senderIds.length
    ? await db.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true } })
    : [];

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      from: m.senderPhone,
      crew: users.find((u) => u.id === m.senderUserId)?.name || null,
      known: Boolean(m.senderUserId),
      body: m.body,
      photoCount: m.mediaUrls.length,
      photos: m.mediaUrls.slice(0, 4),
      status: m.status,
      method: m.method,
      filedTo: m.jobId ? nameOf(m.jobId) : null,
      candidates: (m.candidateJobIds || []).map((id) => ({ jobId: id, name: nameOf(id) })),
      at: m.createdAt,
    })),
  });
}

export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, jobId } = await request.json().catch(() => ({}));
  if (!id || !jobId) {
    return NextResponse.json({ error: "id and jobId are required." }, { status: 400 });
  }

  const result = await fileHeldMessage({ companyId: member.companyId, messageId: id, jobId });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status || 400 });
  }
  return NextResponse.json({ ok: true, filedTo: result.filedTo });
}
