// app/api/messaging/threads/[id]/handling/route.js
//
// GET — "How this was handled": the AI team's steps on one conversation.
//
// Read-only, and built from rows that already exist (the routing log, the
// reply rows, the proposals) by lib/aiEmployee/handlingTimeline.js. No model
// is called and nothing is written — opening the panel costs a company
// nothing and changes nothing.
//
// ── Who may read it ────────────────────────────────────────────────────────
//
// Exactly who may read the thread: the thread GET's rung (requests ≥
// view_only) and the thread looked up under the member's company. A timeline
// is a description of the conversation, so it is never visible to somebody
// the conversation is not.
//
// Inside that, two narrower things, decided here and handed to the pure
// builder so they cannot be forgotten by a second caller:
//
//   cost            `user:manage` — the rung the AI credit top-up and the AI
//                   employee settings screen (which already print per-reply
//                   cost) sit at. A read-only support session may look, as it
//                   may on those screens.
//   client details  clientsProperties ≥ full_view — below it, a proposal's
//                   name / phone / email / address never leave the server.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import {
  loadEnforceableMember,
  requireLevel,
  hasLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { buildHandlingTimeline } from "@/lib/aiEmployee/handlingTimeline";
import { recordError, errorDetail } from "@/lib/platform/errorLog";

/** Per table. A conversation that outgrows this says so on screen rather
 *  than looking complete. */
const LIMIT = 200;

export async function GET(request, { params }) {
  // params is a Promise in Next 16.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = member.id ? await loadEnforceableMember(db, member.id) : null;
  const graded = { ...member, permissions: full?.permissions ?? null };
  try {
    requireLevel(graded, "requests", "view_only", "read messages");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  try {
    const thread = await db.messageThread.findFirst({
      where: { id, companyId: member.companyId },
      select: {
        id: true,
        createdAt: true,
        routingIntent: true,
        routingReason: true,
        routedAt: true,
        humanTookOverAt: true,
      },
    });
    if (!thread) {
      // A sample conversation is computed, not stored, so it has no rows and
      // no steps. Said as an empty timeline (the panel then draws nothing)
      // rather than a 404 that would read as an error on the demo inbox.
      if (String(id).startsWith("demo_")) return NextResponse.json({ steps: [], truncated: false });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // companyId on every where, not only threadId: none of these three
    // tables has a foreign key to the thread (see the schema's note on
    // AiEmployeeReply), so the tenant fence is the column.
    const scope = { companyId: member.companyId, threadId: thread.id };
    const [events, replies, proposals] = await Promise.all([
      db.aiEmployeeRoutingEvent.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
        take: LIMIT,
        select: { id: true, kind: true, fromEmployeeId: true, toEmployeeId: true, intent: true, reason: true, createdAt: true },
      }),
      db.aiEmployeeReply.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
        take: LIMIT,
        // Never draftText: the words are in the thread already when they
        // were sent, and an unsent draft is the suggestions queue's to show.
        select: {
          id: true,
          employeeId: true,
          model: true,
          costCents: true,
          // What the AI credit was debited, when it was — the timeline
          // shows the charge in preference to the vendor cost.
          chargedCents: true,
          toolsUsed: true,
          confidence: true,
          sentAt: true,
          suppressedReason: true,
          handedOff: true,
          handoffReason: true,
          createdAt: true,
        },
      }),
      db.aiEmployeeProposal.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
        take: LIMIT,
        select: {
          id: true,
          employeeId: true,
          tool: true,
          args: true,
          status: true,
          expiresAt: true,
          decidedByUserId: true,
          decidedAt: true,
          failureReason: true,
          createdAt: true,
        },
      }),
    ]);

    // Every employee of the company, disabled ones included — a thread
    // answered last month by an employee switched off since still names them.
    const employees = await db.aiEmployee.findMany({
      where: { companyId: member.companyId },
      select: { id: true, name: true, displayName: true, role: true },
    });

    // The people behind "member:<userId>" and decidedByUserId, looked up
    // THROUGH Member so the lookup is company-scoped: a user id that is not
    // on this team (someone who left, or a crafted row) resolves to no name
    // and the sentence says "someone on the team".
    const userIds = new Set();
    for (const ev of events) {
      const m = typeof ev.reason === "string" ? /^member:(.+)$/.exec(ev.reason) : null;
      if (m) userIds.add(m[1]);
    }
    for (const p of proposals) if (p.decidedByUserId) userIds.add(p.decidedByUserId);
    const members = userIds.size
      ? await db.member.findMany({
          where: { companyId: member.companyId, userId: { in: [...userIds] } },
          select: { userId: true, user: { select: { name: true } } },
        })
      : [];
    const people = Object.fromEntries(members.filter((m) => m.user?.name).map((m) => [m.userId, m.user.name]));

    const timeline = buildHandlingTimeline({
      thread,
      events,
      replies,
      proposals,
      employees,
      people,
      viewer: {
        canSeeCost: Boolean(member.impersonation) || can(member.role, "user:manage"),
        canSeeClientDetails: hasLevel(graded, "clientsProperties", "full_view"),
      },
      now: new Date(),
      truncated: events.length === LIMIT || replies.length === LIMIT || proposals.length === LIMIT,
    });
    return NextResponse.json(timeline);
  } catch (err) {
    // Same treatment as the thread GET: the cause goes to the platform error
    // log, the browser gets a sentence.
    console.error(`[messaging/handling] GET ${id} threw: ${err?.message || err}`);
    await recordError({
      area: "messaging",
      code: "handling_read_threw",
      message: `Handling timeline for thread ${id} could not be read: ${err?.message || "unknown"}`,
      companyId: member.companyId,
      detail: errorDetail(err),
    });
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a moment." }, { status: 500 });
  }
}
