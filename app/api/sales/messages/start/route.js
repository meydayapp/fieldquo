// app/api/sales/messages/start/route.js
//
// "New text": a rep types a number, and a conversation is opened with it —
// or the reason it cannot be is returned. All of the deciding is
// lib/sales/messages/startThread.js; this file is the door.
//
// requireOutreachRep, because a lead may be created (REP_OUTREACH_WRITES
// names salesLead) and because it is the gate every rep-side write of this
// kind stands behind. Nothing is sent from here: the first text goes through
// app/api/sales/sms with every refusal that route has.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { startTextThread } from "@/lib/sales/messages/startThread";

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const raw = typeof body?.phone === "string" ? body.phone : "";
  if (!raw.trim()) return NextResponse.json({ error: "Type a phone number." }, { status: 400 });

  const result = await startTextThread(db, { rep, raw });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json({ ok: true, with: result.e164, leadId: result.leadId, created: result.created });
}
