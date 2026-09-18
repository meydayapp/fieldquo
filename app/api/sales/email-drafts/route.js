// app/api/sales/email-drafts/route.js
//
// The rep's unsent emails: list them, save one.
//
// PUT saves — by id when the box has one, else at the place (thread, or
// lead with no thread) — and answers with the row, or `null` when the
// content was empty and any draft there was removed. The place is checked
// against the rep's OWN rows here (threadWhere / leadWhere), never taken on
// trust: a draft on somebody else's thread is a 404 before anything is
// written. lib/sales/emailDrafts.js says why drafts are their own table.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { leadWhere, threadWhere } from "@/lib/sales/outreach";
import { listDrafts, saveDraft } from "@/lib/sales/emailDrafts";

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  return NextResponse.json({ drafts: await listDrafts(db, rep.id) });
}

export async function PUT(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  let threadId = null;
  let leadId = null;
  if (typeof body.threadId === "string" && body.threadId) {
    const thread = await db.salesThread.findFirst({ where: threadWhere(rep.id, body.threadId), select: { id: true, leadId: true } });
    if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });
    threadId = thread.id;
    leadId = thread.leadId;
  }
  if (!threadId) {
    const lead = await db.salesLead.findFirst({ where: leadWhere(rep.id, body.leadId), select: { id: true } });
    if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });
    leadId = lead.id;
  }
  if (!leadId) {
    // A thread with nobody's lead: the draft still needs a lead column. The
    // model requires one, and a draft on an "Everything else" thread is a
    // thing the inbox does not offer (its reply box sends straight away).
    return NextResponse.json({ error: "This conversation has no lead, so a draft can't be kept on it." }, { status: 400 });
  }

  const draft = await saveDraft(db, {
    salesRepId: rep.id,
    leadId,
    threadId,
    id: typeof body.id === "string" && body.id ? body.id : null,
    input: body,
  });
  return NextResponse.json({ draft });
}
