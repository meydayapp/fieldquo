// app/api/sales/events/[id]/invite/route.js
//
// "I'll send the invite." — the email that keeps the close's promise.
//
// ══ Why a route of its own, on the OUTREACH gate ═══════════════════════════
//
// Booking a demo writes SalesEvent, through the calendar gate whose one-model
// list is exactly that. Sending the invite writes SalesThread and
// SalesMessage — the outreach gate's tables — from the rep's own mailbox,
// through deliverOutreach, where the do-not-contact list and the rep's
// sender are checked the way every rep-to-contact email is. Two gates, two
// routes; a calendar route that also emailed would be the widening
// lib/sales/calendar/gate.js's header forbids, and an events route that
// emailed around deliverOutreach would be an email nobody suppression-checked.
//
// The invite is an ordinary outreach email with one thing on it the compose
// box cannot add: the .ics, built server-side from the event row so the
// browser never composes a calendar file. Nothing here reads the body from
// the request — the subject and the sentences come from the event and the
// rep, so the invite says what was booked and not what a client posted.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { deliverOutreach, repSendingAddress } from "@/lib/sales/outreachSender";
import { contactOptedOut } from "@/lib/sales/outreachInbound";
import { buildIcs } from "@/lib/calendar/ics";
import { NEXT_STEP_MINUTES } from "@/lib/sales/nextSteps";
import { sanitiseHeaderText } from "@/lib/sales/outreach";

const INVITABLE = new Set(["demo", "walkthrough"]);

function whenLabel(startAt, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || undefined, weekday: "long", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
    }).format(startAt);
  } catch {
    return startAt.toUTCString();
  }
}

export async function POST(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const event = await db.salesEvent.findFirst({
    where: { id, salesRepId: rep.id },
    select: {
      id: true, type: true, startAt: true, endAt: true, title: true, notes: true, businessName: true, contactName: true,
      lead: { select: { id: true, email: true, phone: true, businessName: true, contactName: true, timeZone: true, salesRepId: true } },
    },
  });
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!INVITABLE.has(event.type)) {
    return NextResponse.json({ error: "Only a demo or a walkthrough carries an invite." }, { status: 400 });
  }
  const lead = event.lead && event.lead.salesRepId === rep.id ? event.lead : null;
  if (!lead?.email) {
    return NextResponse.json(
      { error: "This event's lead has no email address, so there is nowhere to send the invite. Add one on the lead, or text them the time.", noEmail: true },
      { status: 409 },
    );
  }

  const optOut = await contactOptedOut(db, { leadId: lead.id, email: lead.email, phone: lead.phone, channel: "email" });
  if (optOut.optedOut) {
    return NextResponse.json({ error: optOut.reason, optedOut: true }, { status: 409 });
  }

  const minutes = event.endAt
    ? Math.max(15, Math.round((event.endAt.getTime() - event.startAt.getTime()) / 60_000))
    : NEXT_STEP_MINUTES[event.type] || 30;
  const end = event.endAt || new Date(event.startAt.getTime() + minutes * 60_000);
  const noun = event.type === "walkthrough" ? "walkthrough" : "demo";
  const when = whenLabel(event.startAt, lead.timeZone);
  const repName = sanitiseHeaderText(rep.name, 120) || "FieldQuo";
  const business = sanitiseHeaderText(lead.businessName || event.businessName, 200) || "your business";
  const firstName = sanitiseHeaderText(lead.contactName || event.contactName, 120).split(/\s+/)[0] || "";

  const ics = buildIcs({
    uid: `sales-${event.type}-${event.id}@fieldquo.com`,
    start: event.startAt,
    end,
    summary: `FieldQuo ${noun} — ${business}`,
    description: `${minutes}-minute FieldQuo ${noun} with ${repName}.`,
    location: "Online",
    organizerName: repName,
    organizerEmail: repSendingAddress(rep) || undefined,
    attendeeName: lead.contactName || lead.businessName || undefined,
    attendeeEmail: lead.email,
  });

  const subject = `Your FieldQuo ${noun} — ${when}`;
  const body = [
    firstName ? `Hi ${firstName},` : "Hi,",
    "",
    `Good to talk today. Our ${minutes}-minute ${noun} is booked for ${when}. The calendar invite is attached, so it lands in your diary.`,
    event.type === "walkthrough"
      ? "It's an hour with a FieldQuo specialist, on your own account, and we'll send the video link before the call."
      : "I'll show you how it works for a business like yours, and we'll send the video link before the call.",
    "",
    "If the time stops suiting you, reply to this email and we'll move it.",
    "",
    repName,
  ].join("\n");

  const result = await deliverOutreach({
    rep,
    lead,
    thread: null,
    subject,
    body,
    attachments: [{ filename: `fieldquo-${noun}.ics`, content: Buffer.from(ics).toString("base64") }],
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, blockers: result.blockers }, { status: result.status });
  }
  return NextResponse.json({ threadId: result.threadId, messageId: result.messageId, sentTo: lead.email }, { status: 201 });
}
