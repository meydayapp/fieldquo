// app/api/sales/threads/route.js
//
// Every conversation this rep has, and the one place a new one starts.
//
// ══ Nothing here sends without a person pressing send ══════════════════════
//
// POST is called by exactly one thing: the compose form on the lead screen,
// after the rep has typed a subject and a message. There is no cron behind it,
// no sequence, no "send to all". Automatic outreach is a different product with
// a different consent posture, and the brief for this one was explicit that a
// rep emailing a real prospect is intended and must not be blocked — which is a
// reason to make the send deliberate, not a reason to make it easy to trigger
// by accident.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { deliverOutreach, outreachStatus } from "@/lib/sales/outreachSender";
import { contactOptedOut } from "@/lib/sales/outreachInbound";
import { leadWhere, threadListWhere } from "@/lib/sales/outreach";

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const threads = await db.salesThread.findMany({
    where: threadListWhere(rep.id),
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    select: {
      id: true,
      subject: true,
      lastMessageAt: true,
      lead: { select: { id: true, businessName: true, status: true } },
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { direction: true, sentAt: true, body: true },
      },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ threads, outreach: await outreachStatus(rep) });
}

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  // `phone` is selected even though this is the email path: a prospect who
  // said "stop" on the phone has stopped the email too, and the suppression
  // lookup can only ask about a number it was given. Leaving it out was the
  // gap that would have made a phone opt-out invisible to the mail path.
  const lead = await db.salesLead.findFirst({
    where: leadWhere(rep.id, body.leadId),
    select: { id: true, email: true, phone: true, status: true, businessName: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Asked here so the rep gets the reason on the screen they are looking at.
  // deliverOutreach asks again immediately before the send — see its header
  // for why the second ask is the one that counts.
  const optOut = await contactOptedOut(db, {
    leadId: lead.id,
    email: lead.email,
    phone: lead.phone,
    channel: "email",
  });
  if (optOut.optedOut) {
    return NextResponse.json({ error: optOut.reason, optedOut: true }, { status: 409 });
  }

  const result = await deliverOutreach({
    rep,
    lead,
    thread: null,
    subject: body.subject,
    body: body.body,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, blockers: result.blockers },
      { status: result.status },
    );
  }

  return NextResponse.json(
    { threadId: result.threadId, messageId: result.messageId },
    { status: 201 },
  );
}
