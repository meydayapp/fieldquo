// app/api/settings/conversation-linking/route.js
//
// "Link conversations to clients automatically" — Company.autoLinkConversations
// (lib/conversations/autoLink.js reads it fresh on every message, the
// brought-number linker too).
//
// GET → { enabled }      anyone who can open Settings → Client messages
// PUT { enabled } → { enabled }   owners and admins, the same rung that edits
//                        the client texts on that page (user:manage). Never a
//                        support session: impersonation is read-only, and
//                        requirePermission refuses its viewer role regardless.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const row = await db.company.findUnique({ where: { id: member.companyId }, select: { autoLinkConversations: true } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ enabled: row.autoLinkConversations !== false });
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) return NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 });
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only owners and admins can change this." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Say on or off.", reason: "bad_value" }, { status: 400 });
  }
  const row = await db.company.update({
    where: { id: member.companyId },
    data: { autoLinkConversations: body.enabled },
    select: { autoLinkConversations: true },
  });
  await recordActivity(member, {
    action: "settings.conversation_linking",
    entityType: "company",
    entityId: member.companyId,
    summary: body.enabled ? "Switched on linking conversations to clients automatically" : "Switched off linking conversations to clients automatically",
    metadata: { enabled: body.enabled },
  });
  return NextResponse.json({ enabled: row.autoLinkConversations !== false });
}
