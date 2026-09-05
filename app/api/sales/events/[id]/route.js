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
    select: { id: true, startAt: true },
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
  if (body.leadId !== undefined) {
    if (body.leadId === null || body.leadId === "") {
      data.leadId = null;
    } else if (typeof body.leadId === "string") {
      const snapshot = await leadContactSnapshot(body.leadId, rep.id);
      if (snapshot) {
        data.leadId = body.leadId;
        data.businessName = snapshot.businessName;
        data.contactName = snapshot.contactName;
        data.phone = snapshot.phone;
        data.website = snapshot.website;
      }
    }
  }
  // Direct edits to the snapshot fields, when no lead re-link overrode them.
  if (body.businessName !== undefined && data.businessName === undefined)
    data.businessName = clean(body.businessName, 200);
  if (body.contactName !== undefined && data.contactName === undefined)
    data.contactName = clean(body.contactName, 200);
  if (body.phone !== undefined && data.phone === undefined)
    data.phone = clean(body.phone, 60);
  if (body.website !== undefined && data.website === undefined)
    data.website = clean(body.website, 300);

  const updated = await db.salesEvent.update({
    where: { id: existing.id },
    data,
  });

  return NextResponse.json({ event: shapeEvent(updated) });
}
