// app/api/ai-employee/suggestions/route.js
//
// The drafts waiting for a person — SUGGEST mode's output, and the threads the
// employee stopped on.
//
//   GET → drafts nobody has sent yet, plus the threads it handed off
//
// ══ Why the list lives here and not in the inbox ═══════════════════════════
//
// The conversation screen is where a suggestion most obviously belongs, and it
// is where this should end up. It is not where it is today, and the reason is
// worth writing down rather than leaving as an omission: /app/messages is
// under active change in a parallel worktree, and adding a composer branch to
// a file somebody else is restructuring produces a merge that silently keeps
// one half of two people's work. So the queue is rendered on the AI employee's
// own settings screen, which is honest and reachable, and sending goes through
// the messaging feature's OWN reply route rather than a second send path here
// — see the settings page. Moving the panel into the conversation is a UI
// change against this same API and nothing about it is blocked.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // Read-only support may look — non-negotiable #3, and this route has
  // nothing to edit. Same carve-out as the screen's main GET.
  if (!member.impersonation) {
    try {
      requirePermission(member.role, "user:manage");
    } catch {
      return NextResponse.json(
        { error: "Only an owner or admin can review the AI employee's drafts." },
        { status: 403 },
      );
    }
  }

  const employee = await db.aiEmployee.findUnique({
    where: { companyId: member.companyId },
    select: { id: true, instructionsFingerprint: true },
  });
  if (!employee) return NextResponse.json({ suggestions: [], stopped: [] });

  const [waiting, stopped] = await Promise.all([
    db.aiEmployeeReply.findMany({
      where: {
        companyId: member.companyId,
        sentAt: null,
        draftText: { not: null },
        suppressedReason: null,
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    // The stops a person has to act on. NOT every refusal — "outside business
    // hours" is the switch working, and listing it would bury the two that
    // matter (out of credit, and handed off) in noise the contractor chose.
    db.aiEmployeeReply.findMany({
      where: { companyId: member.companyId, handedOff: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  // The threads, read separately and scoped by company — a threadId on an
  // AiEmployeeReply is a plain string with no foreign key behind it (see the
  // schema), so this is where it gets checked against the tenant rather than
  // trusted.
  const threadIds = [...new Set([...waiting, ...stopped].map((r) => r.threadId))];
  const threads = threadIds.length
    ? await db.messageThread.findMany({
        where: { id: { in: threadIds }, companyId: member.companyId },
        select: {
          id: true,
          participantName: true,
          status: true,
          lastMessageAt: true,
          channel: { select: { platform: true } },
        },
      })
    : [];
  const byId = new Map(threads.map((t) => [t.id, t]));

  const shape = (r) => {
    const thread = byId.get(r.threadId) || null;
    return {
      id: r.id,
      threadId: r.threadId,
      // Null when the thread has been deleted since. Reported as null rather
      // than hidden: the spend record outlives the conversation on purpose,
      // and a cost with no conversation beside it is still a cost.
      thread: thread
        ? {
            id: thread.id,
            participantName: thread.participantName,
            status: thread.status,
            platform: thread.channel?.platform || null,
            lastMessageAt: thread.lastMessageAt,
          }
        : null,
      text: r.draftText,
      tools: Array.isArray(r.toolsUsed) ? r.toolsUsed : [],
      costCents: r.costCents,
      handedOff: r.handedOff,
      handoffReason: r.handoffReason,
      suppressedReason: r.suppressedReason,
      createdAt: r.createdAt,
      // "you have changed the instructions since this was written". The one
      // thing somebody reviewing a stale draft actually needs to know.
      stale:
        Boolean(employee.instructionsFingerprint) &&
        r.instructionsFingerprint !== employee.instructionsFingerprint,
    };
  };

  return NextResponse.json({
    suggestions: waiting.map(shape),
    stopped: stopped.map(shape),
  });
}
