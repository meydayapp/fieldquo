// app/api/crew/messages/route.js
//
// What the crew inbox has received — so the things it COULDN'T file don't
// vanish. Filed photos already show on the job; this page is for the exceptions
// that need a person: an unanswered "which job?", or a text from a number
// that isn't on the roster.
//
// PATCH resolves a pending message by hand — the owner picks the job the crew
// never chose, and it files exactly as an SMS reply would have.
//
// ══ Whose messages ═════════════════════════════════════════════════════════
//
// This listed the whole company's inbox to every member, with no check beyond
// "you are signed in" — so a crew member on the lowest tier read every other
// crew member's photos and site notes, and could hand-file any of them to any
// job. Narrowed by crewMessageScope: someone whose schedule dial says "their
// own" gets their own messages, matched on CrewInboundMessage.senderUserId. The
// reasoning, and why the schedule ladder is the right dial, is in
// lib/crew/access.js.
//
// The SAME scope goes into the PATCH. A write that lands on a row whose read
// would 403 is the worse half of this bug — the photo moves onto a job and its
// author cannot see that it did.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { crewMessageScope } from "@/lib/crew/access";
import { fileHeldMessage } from "@/lib/crew/inbox";

/**
 * The member with their grid attached. getCurrentMember's session shape has no
 * `permissions`, and a scope decided without it silently widens to "everyone's".
 * A null grid falls back to the coarse role, as it does everywhere else.
 */
async function graded(member) {
  const full = member.id ? await loadEnforceableMember(db, member.id) : null;
  return { ...member, permissions: full?.permissions ?? null };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const scope = crewMessageScope(await graded(member));

  const messages = await db.crewInboundMessage.findMany({
    where: { companyId: member.companyId, ...scope },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, senderPhone: true, senderUserId: true, body: true,
      mediaUrls: true, status: true, method: true, jobId: true,
      jobVisitId: true, latitude: true, longitude: true,
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
      // Both statuses a person can still act on. Computed here rather than by
      // the screen matching status strings, so adding a fourth state can't
      // silently drop a queue of held photos out of the "needs you" list —
      // which is what happened when `superseded` started being written and the
      // page was still filtering on `pending` alone.
      needsYou: m.status === "pending" || m.status === "superseded",
      // Why it stopped being the live question. Shown so "we asked, they sent
      // another photo instead" doesn't read as "we forgot".
      superseded: m.status === "superseded",
      filedTo: m.jobId ? nameOf(m.jobId) : null,
      jobId: m.jobId,
      // Where the media actually landed. Returned so "filed" can be verified
      // against a real visit rather than trusted — a filed row with no visit id
      // is the shape of a photo that went nowhere.
      jobVisitId: m.jobVisitId,
      // The coordinates the carrier sent, when it sent any. Stored since this
      // feature shipped and read by nothing until now: on a message a person has
      // to place by hand, where it was taken is the most useful thing we know.
      point:
        m.latitude != null && m.longitude != null
          ? { lat: Number(m.latitude), lng: Number(m.longitude) }
          : null,
      candidates: (m.candidateJobIds || []).map((id) => ({ jobId: id, name: nameOf(id) })),
      at: m.createdAt,
    })),
  });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { id, jobId } = await request.json().catch(() => ({}));
  if (!id || !jobId) {
    return NextResponse.json({ error: "id and jobId are required." }, { status: 400 });
  }

  // Out-of-scope ids come back as "No such message." rather than a 403: the
  // list this id could only have come from doesn't contain it, and confirming a
  // stranger's message exists is a fact worth nothing to the caller.
  const result = await fileHeldMessage({
    companyId: member.companyId,
    messageId: id,
    jobId,
    scope: crewMessageScope(await graded(member)),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status || 400 });
  }
  return NextResponse.json({ ok: true, filedTo: result.filedTo });
}
