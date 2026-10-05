// app/api/clients/[id]/conversation/route.js
//
// GET ?channel=&cursor= — one timeline of everything said with this client,
// every channel (lib/conversations/clientTimeline.js), newest page first.
//
// ══ Who may read it ════════════════════════════════════════════════════════
//
//   requests ≥ view_only           the inbox's own read rung — a member barred
//                                  from the inbox reads no conversation here
//   clientsProperties ≥ full_view  the client page's contact-data rung, the
//                                  same one the "Email" section asks
//                                  (app/api/mailbox/filed)
//
// A FieldQuo support session reads, like the platform console reads
// everything, and the timeline tells the page it may not reply — the reply
// route and middleware.js refuse the write regardless.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
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
  if (!access.read) {
    return NextResponse.json({ error: "Your access level for Requests doesn't allow you to read client conversations.", reason: "no_inbox_access" }, { status: 403 });
  }
  if (!access.contacts) {
    return NextResponse.json({ error: "You don't have access to client contact details.", reason: "no_contact_access" }, { status: 403 });
  }

  const url = new URL(request.url);
  const data = await loadClientTimeline(db, {
    companyId: member.companyId,
    clientId: String(id || ""),
    channel: url.searchParams.get("channel"),
    cursor: url.searchParams.get("cursor"),
    access,
    connection: access.reply ? await messagingConnection(member.companyId) : null,
  });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
