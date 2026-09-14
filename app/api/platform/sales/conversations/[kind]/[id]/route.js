// app/api/platform/sales/conversations/[kind]/[id]/route.js
//
// One rep ↔ prospect conversation, for the owner. Read-only, superadmin-only
// ("chat:audit"); every call writes a PlatformAuditLog row
// (`rep_conversation_audited`), and the rep's own thread then says
// "Reviewed by the owner on <date>" — read back from that same row
// (lib/sales/conversationAudit.js lastReviewOf).
//
// GET /sms/<E.164>?repId=<rep>  → { kind: "sms", rep, with, lead, messages, audited }
// GET /email/<threadId>         → { kind: "email", rep, thread, lead, messages, audited }
//
// No POST. The owner cannot text or email a prospect from here — the rep's
// send paths keep every gate they have (smsGate, outreachGate), and this
// door has none of them because it has no send.
//
// `params` is a Promise in Next 16 — awaited, not destructured.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuditor } from "@/lib/platform/auditGate";
import { CONVERSATION_KINDS, repSmsConversation, repEmailConversation } from "@/lib/sales/conversationAudit";

export async function GET(request, { params }) {
  const { viewer, refusal } = await requireAuditor(request, "chat:audit");
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { kind, id } = await params;
  if (!CONVERSATION_KINDS.includes(kind)) {
    return NextResponse.json({ error: "A conversation is sms or email.", code: "bad_kind" }, { status: 400 });
  }
  const { searchParams } = new URL(request.url);
  const result =
    kind === "sms"
      ? await repSmsConversation(viewer, { repId: searchParams.get("repId") || null, e164: decodeURIComponent(id || "") })
      : await repEmailConversation(viewer, { threadId: id });
  if (!result) return NextResponse.json({ error: "No such conversation.", code: "no_thread" }, { status: 404 });
  return NextResponse.json(result);
}
