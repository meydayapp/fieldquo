// app/api/sales/threads/[id]/route.js
//
// One conversation, both directions, oldest first.
//
// `replyToken` is not in the select. It is a routing label rather than a
// secret, but it is also the string that decides which thread an inbound
// message joins, and there is no screen that needs it — the reply address is
// built server-side at send time. Leaving it out of the payload keeps it off
// every surface that could copy, log or screenshot it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { outreachStatus } from "@/lib/sales/outreachSender";
import { threadWhere } from "@/lib/sales/outreach";
import { contactOptedOut } from "@/lib/sales/outreachInbound";
import { publicAttachments } from "@/lib/messaging/attachments";
import { lastReviewOf } from "@/lib/sales/conversationAudit";

export async function GET(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;

  const thread = await db.salesThread.findFirst({
    where: threadWhere(rep.id, id),
    select: {
      id: true,
      subject: true,
      lastMessageAt: true,
      createdAt: true,
      lead: {
        select: {
          id: true,
          businessName: true,
          contactName: true,
          email: true,
          phone: true,
          status: true,
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          direction: true,
          fromAddress: true,
          toAddress: true,
          subject: true,
          body: true,
          sentAt: true,
          // Inbound only, through the Resend Receiving door: what the prospect
          // attached, re-hosted, and whether a copy of the message went to the
          // rep's own mailbox. Both null on outbound rows and on rows written
          // before the columns existed.
          attachments: true,
          forwardProviderId: true,
        },
      },
    },
  });

  if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // The same public shape the messaging inbox serves — the fetcher-only
  // fields (sourceUrl, mediaId) never reach a browser — and a boolean rather
  // than Resend's id for the forward, which no screen needs.
  thread.messages = thread.messages.map(({ attachments, forwardProviderId, ...m }) => ({
    ...m,
    attachments: publicAttachments(attachments),
    forwardedToMailbox: Boolean(forwardProviderId),
  }));

  // The screen must reach the same verdict the send path enforces, through
  // the same function. Reading it from this thread's messages alone was the
  // narrow version: it could not see an opt-out this prospect gave another rep
  // by phone, so the compose box stayed open on a person FieldQuo may not
  // write to and the send failed at the last moment instead.
  const optOut = await contactOptedOut(db, {
    leadId: thread.lead.id,
    email: thread.lead.email,
    phone: thread.lead.phone,
    channel: "email",
  });

  return NextResponse.json({
    thread,
    // When the owner last read this thread from the console — the rep is
    // told on the thread (lib/sales/conversationAudit.js). Null when never.
    reviewedByOwner: await lastReviewOf({ repId: rep.id, kind: "email", threadId: thread.id }),
    optedOut: optOut.optedOut,
    optedOutReason: optOut.reason,
    // The English sentence AND the key that composed it. The screen prefers
    // the key so a Spanish rep reads Spanish; `optedOutReason` stays the
    // fallback for a payload from a build that predates the key, and stays
    // the thing check-sales-home.mjs asserts is rendered.
    optedOutReasonKey: optOut.reasonKey || null,
    optedOutReasonParams: optOut.reasonParams || null,
    outreach: await outreachStatus(rep),
  });
}
