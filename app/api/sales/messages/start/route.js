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
import { attachThreadToLead } from "@/lib/sales/messages/attachThread";

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const raw = typeof body?.phone === "string" ? body.phone : "";
  if (!raw.trim()) return NextResponse.json({ error: "Type a phone number." }, { status: 400 });
  // "Text them" from a Call button names the lead the number belongs to (or
  // is to be recorded on). An id, re-read against the rep inside
  // startTextThread — never a number to save and never a lead to trust.
  const leadId = typeof body?.leadId === "string" ? body.leadId.trim() || null : null;

  const result = await startTextThread(db, { rep, raw, leadId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  // "Link to a lead" on a conversation that already has words in it: the
  // rep's rows on the number that hang on no lead are hung on this one
  // (lib/sales/messages/attachThread.js). Nothing to hang, nothing written
  // — the ordinary New-text press lands here with an empty thread.
  let attached = null;
  try {
    const hung = await attachThreadToLead({ salesRepId: rep.id, rep, e164: result.e164, leadId: result.leadId, client: db });
    if (hung.attached) attached = { leadId: hung.leadId, rows: hung.rows };
  } catch (err) {
    console.error("[sales messages/start] existing rows not attached:", err?.message);
  }
  return NextResponse.json({
    ok: true,
    with: result.e164,
    leadId: result.leadId,
    created: result.created,
    recorded: result.recorded === true,
    unsaved: result.unsaved || null,
    attached,
  });
}
