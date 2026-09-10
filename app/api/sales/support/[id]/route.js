// app/api/sales/support/[id]/route.js
//
// A rep answers a question on their own ticket.
//
// ══ Why a rep may write a note and not a status ════════════════════════════
//
// The channel is worth nothing if support can ask "which invoice?" and the rep
// has no way to answer — that is the black hole this feature exists to close,
// with the arrow pointing the other way. So: a reply, yes.
//
// A STATUS, no. A rep marking their own ticket resolved would take it out of a
// queue FieldQuo has not yet looked at, and the contractor's problem would be
// closed by the one person who cannot verify it was fixed. Status is
// /api/platform/support's to move.
//
// The ticket is re-read under `salesRepId: rep.id` in the same request that
// writes. A ticket id is not a capability — the id in the path is a request.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { MAX_NOTE_LENGTH, sanitiseBody } from "@/lib/support/escalation";

export async function PATCH(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // Next 16: params is a Promise.
  const { id } = await params;

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const body = sanitiseBody(payload.body, MAX_NOTE_LENGTH);
  if (!body) {
    return NextResponse.json({ error: "Type a reply first." }, { status: 400 });
  }

  // Scoped read in the writing request. A ticket belonging to another rep is
  // indistinguishable from one that does not exist, for the reason
  // decideEscalation's header gives: distinct answers make this an oracle for
  // which ids are real.
  const ticket = await db.supportTicket.findFirst({
    where: { id, salesRepId: rep.id },
    select: { id: true, status: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "That ticket isn't one of yours." }, { status: 404 });
  }

  const note = await db.supportTicketNote.create({
    data: {
      ticketId: ticket.id,
      kind: "message",
      authorKind: "rep",
      authorRepId: rep.id,
      body,
      // A rep's reply is never internal — `internal` is FieldQuo's own flag,
      // and accepting it from this side would let a rep write a note they
      // themselves could not read back.
      internal: false,
    },
    select: { id: true, kind: true, authorKind: true, body: true, createdAt: true },
  });

  // Touch the ticket so a reply moves it up the console's list. Without this a
  // rep answering a question two days later leaves the ticket sitting where it
  // was, which is how an answered question looks unanswered.
  await db.supportTicket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });

  return NextResponse.json({ note }, { status: 201 });
}
