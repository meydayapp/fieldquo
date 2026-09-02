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
import { leadOptedOut, threadWhere } from "@/lib/sales/outreach";

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
        },
      },
    },
  });

  if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    thread,
    optedOut: leadOptedOut(thread.messages),
    outreach: await outreachStatus(rep),
  });
}
