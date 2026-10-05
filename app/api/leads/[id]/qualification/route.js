// app/api/leads/[id]/qualification/route.js
//
// The same one tap as on the conversation (lib/leads/tierOverride.js), from
// the lead drawer: the lead's conversation is found — the thread linked to
// it, else the one its evidence names — and its tier is set there. A lead
// with no conversation (a form, a phone call) has no tier, and says so.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import { supportSessionRefusal } from "@/lib/leads/deleteLead";
import { cleanTier, setTierOverride } from "@/lib/leads/tierOverride";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const support = supportSessionRefusal(member);
  if (support) return NextResponse.json(support.body, { status: support.status });
  const { response: denied } = await levelOrRefusal(member, "requests", "view_create_edit", "change a request");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const cleaned = cleanTier(body?.tier);
  if (!cleaned.ok) return NextResponse.json({ error: "Unknown tier." }, { status: 400 });

  const lead = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, conversationEvidence: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const linked = await db.messageThread.findFirst({ where: { companyId: member.companyId, leadId: lead.id }, select: { id: true } });
  const evidenceThread = typeof lead.conversationEvidence?.threadId === "string" ? lead.conversationEvidence.threadId : null;
  const threadId = linked?.id || evidenceThread;
  if (!threadId) {
    return NextResponse.json({ error: "This lead didn't come from a conversation, so it has no tier to set." }, { status: 409 });
  }

  const actorName = member.userId
    ? await db.user.findUnique({ where: { id: member.userId }, select: { name: true, email: true } }).then((u) => u?.name || u?.email || null).catch(() => null)
    : null;
  const result = await setTierOverride(db, {
    companyId: member.companyId,
    threadId,
    tier: cleaned.tier,
    actor: { userId: member.userId || null, name: actorName },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await recordActivity(member, {
    action: "conversation.tier_set",
    entityType: "lead",
    entityId: lead.id,
    summary: cleaned.tier ? `Marked a lead's conversation as "${cleaned.tier}"` : "Cleared a lead's conversation tier",
    metadata: { tier: cleaned.tier, threadId },
  });
  return NextResponse.json({ qualification: result.qualification, threadId });
}
