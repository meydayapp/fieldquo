// app/api/sales/events/[id]/route.js
//
// One calendar event: read it, edit/reschedule it, or mark it done or
// cancelled. Every read and every write is scoped `salesRepId: rep.id` in the
// WHERE — an id belonging to another rep resolves to nothing (a 404), never to
// their event. There is no DELETE: a rep cancels an event (status), and the
// row stays, because a booking that vanishes with no trace is a delete wearing
// a gentler label.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { requireCalendarRep } from "@/lib/sales/calendar/gate";
import { leadContactSnapshot } from "@/lib/sales/calendar/leadContact";
import {
  isEventType,
  isEventStatus,
  parseWhen,
  clean,
  shapeEvent,
  contactFields,
  leadChanged,
} from "@/lib/sales/calendar/event";

export async function GET(request, { params }) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const event = await db.salesEvent.findFirst({
    where: { id, salesRepId: rep.id },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ event: shapeEvent(event) });
}

export async function PATCH(request, { params }) {
  const { rep, refusal } = await requireCalendarRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "We couldn't read that request. Please try again." },
      { status: 400 },
    );
  }

  // Prove ownership before writing. findFirst with the rep in the WHERE, so an
  // id from another rep is a 404 and never reaches the update below.
  const existing = await db.salesEvent.findFirst({
    where: { id, salesRepId: rep.id },
    // leadId: so a resent lead is told apart from a re-link. endAt: so a start
    // moved past the standing end is refused rather than saved backwards.
    select: { id: true, startAt: true, endAt: true, leadId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = {};

  if (body.type !== undefined) {
    if (!isEventType(body.type)) {
      return NextResponse.json({ error: "Unknown event type." }, { status: 400 });
    }
    data.type = body.type;
  }
  if (body.status !== undefined) {
    if (!isEventStatus(body.status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.title !== undefined) data.title = clean(body.title, 200);
  if (body.location !== undefined) data.location = clean(body.location, 300);
  if (body.notes !== undefined) data.notes = clean(body.notes, 4000);

  // startAt/endAt are validated together against whatever the row will hold
  // after this write, not each alone — an end before a moved-up start is the
  // failure, and only comparing the two final values catches it.
  let nextStart = existing.startAt;
  if (body.startAt !== undefined) {
    const startAt = parseWhen(body.startAt);
    if (!startAt) {
      return NextResponse.json({ error: "That start time isn't valid." }, { status: 400 });
    }
    data.startAt = startAt;
    nextStart = startAt;
    // A start moved past the standing end, with no new end sent, would save
    // an event that ends before it begins. The UI always sends both; the API
    // is what a curl sends.
    if (body.endAt === undefined && existing.endAt && existing.endAt.getTime() <= startAt.getTime()) {
      return NextResponse.json({ error: "The end time has to be after the start." }, { status: 400 });
    }
  }
  if (body.endAt !== undefined) {
    if (body.endAt === null || body.endAt === "") {
      data.endAt = null;
    } else {
      const endAt = parseWhen(body.endAt);
      if (!endAt) {
        return NextResponse.json({ error: "That end time isn't valid." }, { status: 400 });
      }
      if (endAt.getTime() <= new Date(nextStart).getTime()) {
        return NextResponse.json(
          { error: "The end time has to be after the start." },
          { status: 400 },
        );
      }
      data.endAt = endAt;
    }
  }

  // Re-linking to a different lead re-snapshots the contact from THAT lead,
  // scoped to this rep. Passing leadId: null unlinks and leaves the snapshot
  // standing, so the card still says who it was with.
  //
  // Only when the lead actually CHANGES. The modal resends leadId on every
  // save, and the first version re-snapshotted on every save — so a rep who
  // corrected the phone and pressed Save got the lead's number back, every
  // time, and never saw why. leadChanged() is the one place that rule lives.
  let snapshot = null;
  if (leadChanged(body.leadId, existing.leadId)) {
    if (body.leadId === null || body.leadId === "") {
      data.leadId = null;
    } else if (typeof body.leadId === "string") {
      snapshot = await leadContactSnapshot(body.leadId, rep.id);
      // The id the rep-scoped lookup returned, not the one the body carried
      // — the same rule the create route follows (tenant-scope rule 4).
      if (snapshot) data.leadId = snapshot.id ?? body.leadId;
    }
  }
  // Typed wins, a fresh snapshot fills the blanks, and a field the body did
  // not mention is left exactly as stored.
  const typed = contactFields(body, snapshot);
  for (const key of ["businessName", "contactName", "phone", "website"]) {
    if (body[key] !== undefined || snapshot) data[key] = typed[key];
  }

  const updated = await db.salesEvent.update({
    where: { id: existing.id },
    data,
  });

  return NextResponse.json({ event: shapeEvent(updated) });
}
