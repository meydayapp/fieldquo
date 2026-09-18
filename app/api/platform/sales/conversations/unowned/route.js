// app/api/platform/sales/conversations/unowned/route.js
//
// The texts nobody could file — lib/sales/smsAttribution.js rung (d) — and
// the one control that files them.
//
// A route of its own rather than a handler on ../route.js, because that
// route is read-only by contract (scripts/check-platform-conversation-audit
// asserts no write handler on it) and this one has a write. The write is
// small and single: attributeSmsMessage(), the same function the webhook's
// ladder and the repair script go through, with `matchedBy: "manual"` and
// the admin's id on the audit row. It does not send anything to anybody;
// the rep it is filed to is pushed the same copy the webhook would have sent
// had the ladder found them.
//
// Superadmin-only, on "chat:audit" — the permission the page it sits on is
// already gated by. Deciding whose conversation a text is decides who gets
// to answer it and, downstream, who is credited; that is not a support
// tier's call.
//
// GET  → { unowned: [{ id, fromE164, toE164, body, sentAt, triage, lineHolder }], reps: [{ id, name }] }
// POST { messageId, repId } → { ok, before, after }
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuditor } from "@/lib/platform/auditGate";
import { SMS_MATCHED_BY_MANUAL, attributeSmsMessage, unownedInboundTexts } from "@/lib/sales/smsAttribution";

export async function GET(request) {
  const { refusal } = await requireAuditor(request, "chat:audit");
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const [unowned, reps] = await Promise.all([
    unownedInboundTexts({ limit: 100 }),
    db.salesRep.findMany({
      where: { active: true, endedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);
  return NextResponse.json({ unowned, reps });
}

export async function POST(request) {
  const { viewer, refusal } = await requireAuditor(request, "chat:audit");
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }
  const messageId = typeof body?.messageId === "string" ? body.messageId : "";
  const repId = typeof body?.repId === "string" ? body.repId : "";
  if (!messageId || !repId) return NextResponse.json({ error: "A message and a rep." }, { status: 400 });

  // The rep must be a live one: filing a text to an ended account is losing
  // it a second time.
  const rep = await db.salesRep.findFirst({ where: { id: repId, active: true, endedAt: null }, select: { id: true } });
  if (!rep) return NextResponse.json({ error: "No active rep with that id." }, { status: 404 });

  const result = await attributeSmsMessage({
    messageId,
    salesRepId: rep.id,
    matchedBy: SMS_MATCHED_BY_MANUAL,
    by: { platformAdminId: viewer.id },
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 });
  return NextResponse.json({ ok: true, before: result.before, after: result.after });
}
