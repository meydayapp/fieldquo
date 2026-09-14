// app/api/platform/sales/conversations/route.js
//
// A rep's conversations with prospects — texts and emails — for the owner.
// Read-only, superadmin-only ("chat:audit"). The reasons, and why the rep
// is told, are in lib/sales/conversationAudit.js.
//
// GET ?repId=&q=
//   → { rep, reps: [{ id, name, email, active }],
//       sms:   [{ e164, name, leadId, lastAt, lastBody, lastDirection, count }],
//       email: [{ id, subject, lead, lastAt, lastBody, lastDirection, count }] }
//
// No write handler. The list records nothing; opening ONE thread
// ([kind]/[id]) is what writes the audit row.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuditor } from "@/lib/platform/auditGate";
import { repConversations } from "@/lib/sales/conversationAudit";

export async function GET(request) {
  const { refusal } = await requireAuditor(request, "chat:audit");
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { searchParams } = new URL(request.url);
  const result = await repConversations({
    repId: searchParams.get("repId") || null,
    q: searchParams.get("q") || "",
  });
  return NextResponse.json(result);
}
