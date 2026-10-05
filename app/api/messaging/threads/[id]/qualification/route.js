// app/api/messaging/threads/[id]/qualification/route.js
//
// One tap on a conversation: "Lead" / "Conversation" / "Only a tap" / "Not
// relevant" — or back to what the rules said (tier: null). The tier sticks:
// every later pass of the rules carries it (lib/leads/tierOverride.js).
//
// Same rung as recording what a conversation became (the thread PATCH):
// requests at view_create_edit. A read-only support session never reaches the
// handler (middleware) and is refused again by supportSessionRefusal, the
// same third check the lead delete makes.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { messagingConnection } from "@/lib/messaging/channels";
import { recordActivity } from "@/lib/activity/log";
import { supportSessionRefusal } from "@/lib/leads/deleteLead";
import { cleanTier, setTierOverride } from "@/lib/leads/tierOverride";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const support = supportSessionRefusal(member);
  if (support) return NextResponse.json(support.body, { status: support.status });

  try {
    const full = member.id ? await loadEnforceableMember(db, member.id) : null;
    requireLevel({ ...member, permissions: full?.permissions ?? null }, "requests", "view_create_edit", "change what a conversation is");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    return NextResponse.json({ error: "This is a sample conversation, so changes to it aren't saved." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const cleaned = cleanTier(body?.tier);
  if (!cleaned.ok) return NextResponse.json({ error: "Unknown tier." }, { status: 400 });

  const actorName = member.userId
    ? await db.user.findUnique({ where: { id: member.userId }, select: { name: true, email: true } }).then((u) => u?.name || u?.email || null).catch(() => null)
    : null;
  const result = await setTierOverride(db, {
    companyId: member.companyId,
    threadId: id,
    tier: cleaned.tier,
    actor: { userId: member.userId || null, name: actorName },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await recordActivity(member, {
    action: "conversation.tier_set",
    entityType: "conversation",
    entityId: id,
    summary: cleaned.tier ? `Marked a conversation as "${cleaned.tier}"` : "Cleared a conversation's tier",
    metadata: { tier: cleaned.tier, leadId: result.leadId, leadCreated: result.created },
  });
  return NextResponse.json({ qualification: result.qualification, leadId: result.leadId, leadCreated: result.created });
}
