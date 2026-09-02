// app/api/sales/threads/[id]/messages/route.js
//
// The rep answers. Same send path as a first message, one thread later.
//
// A reply keeps the thread's own subject and its own reply token — the token is
// what makes the prospect's next answer land back here rather than starting a
// third conversation, so it is read from the thread and never regenerated.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { deliverOutreach } from "@/lib/sales/outreachSender";
import { leadIsOptedOut } from "@/lib/sales/outreachInbound";
import { threadWhere } from "@/lib/sales/outreach";

export async function POST(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  const thread = await db.salesThread.findFirst({
    where: threadWhere(rep.id, id),
    select: {
      id: true,
      subject: true,
      replyToken: true,
      lead: { select: { id: true, email: true, status: true, businessName: true } },
    },
  });
  if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (await leadIsOptedOut(db, rep.id, thread.lead.id)) {
    return NextResponse.json(
      {
        error:
          "This prospect asked not to be emailed again. That request stands — " +
          "call them if you have another reason to be in touch.",
        optedOut: true,
      },
      { status: 409 },
    );
  }

  const result = await deliverOutreach({
    rep,
    lead: thread.lead,
    thread,
    body: body.body,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, blockers: result.blockers },
      { status: result.status },
    );
  }

  return NextResponse.json({ messageId: result.messageId }, { status: 201 });
}
