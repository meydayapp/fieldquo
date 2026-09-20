// app/api/messaging/threads/[id]/ai-resume/route.js
//
// "Let {name} continue." A member replied on this thread from Conversations,
// which cleared the AI employee's assignment and stamped humanTookOverAt
// (lib/aiEmployee/routing.js); this is the one door that hands the thread
// back. The employee it goes to is resumeCandidate's answer — the last one
// that held it, else whoever the front desk would pick — and it is the same
// function the thread GET used to print the name on the button, so what was
// pressed is what happens.
//
// The rung is the PATCH route's: deciding who answers a conversation is a
// change to it, not a read of it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { resumeEmployee } from "@/lib/aiEmployee/routing";
import { recordActivity } from "@/lib/activity/log";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = member.id ? await loadEnforceableMember(db, member.id) : null;
  try {
    requireLevel({ ...member, permissions: full?.permissions ?? null }, "requests", "view_create_edit", "hand a conversation back to the AI employee");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  // Company-scoped by findFirst — the id alone would let anyone reassign
  // another tenant's conversation.
  const thread = await db.messageThread.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, assignedEmployeeId: true, humanTookOverAt: true, routingIntent: true, channel: { select: { platform: true } } },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!thread.humanTookOverAt) {
    return NextResponse.json({ error: "Nobody has taken this conversation over, so there is nothing to hand back.", reason: "not_taken_over" }, { status: 409 });
  }

  const channel = thread.channel?.platform === "web" ? "web" : thread.channel?.platform === "sms" ? "sms" : "meta";
  const employee = await resumeEmployee({ prisma: db, companyId: member.companyId, thread, channel, userId: member.userId || null });
  if (!employee) {
    return NextResponse.json({ error: "No AI employee is switched on, so there is nobody to continue.", reason: "no_employee" }, { status: 409 });
  }

  await recordActivity(member, {
    action: "ai_employee.resumed",
    entityType: "conversation",
    entityId: thread.id,
    summary: `Let the AI ${employee.role} continue a conversation`,
    summaryKey: "app.activity.event.aiEmployee.resumed",
    summaryParams: { role: employee.role },
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    assignedEmployee: { id: employee.id, name: employee.displayName || employee.name, role: employee.role, avatarUrl: employee.avatarUrl || null },
  });
}
