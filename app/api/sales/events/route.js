// app/api/sales/events/route.js
//
// A rep's own calendar: the events in a date range, and creating one.
//
// ══ Scoped by salesRepId, from the session, every request ══════════════════
//
// Same argument the leads and notes routes make: there is no tenant behind the
// sales portal, so `salesRepId: rep.id` in the WHERE IS the boundary. It comes
// from the gate's fresh read of the SalesRep row, never from the query string
// or the body — a rep id a client could name is a client that can read, or
// write into, a colleague's calendar.
//
// GET is read-only and rides requireSalesRep (which refuses every write).
// POST writes SalesEvent and rides requireCalendarRep — the sixth named write
// gate, whose one-model list check:sales-auth holds this route to.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { requireCalendarRep } from "@/lib/sales/calendar/gate";
import { leadContactSnapshot } from "@/lib/sales/calendar/leadContact";
import {
  isEventType,
  parseWhen,
  clean,
  shapeEvent,
} from "@/lib/sales/calendar/event";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { searchParams } = new URL(request.url);
  // A window, so a rep viewing March never pulls their whole history into the
  // browser. Defaults to a wide-but-bounded range rather than "everything", so
  // an unparametrised call from a test or an old client is still bounded.
  const from = parseWhen(searchParams.get("from"));
  const to = parseWhen(searchParams.get("to"));
  const now = new Date();
  const gte = from || new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lte = to || new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);

  const events = await db.salesEvent.findMany({
    where: {
      salesRepId: rep.id,
      startAt: { gte, lte },
      // Cancelled events stay in the DB (never deleted) but drop off the
      // calendar — a booking the rep called off is not their day.
      status: { not: "cancelled" },
    },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({ events: events.map(shapeEvent) });
}

export async function POST(request) {
  const { rep, refusal } = await requireCalendarRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "We couldn't read that request. Please try again." },
      { status: 400 },
    );
  }

  const type = isEventType(body.type) ? body.type : "callback";
  const startAt = parseWhen(body.startAt);
  if (!startAt) {
    return NextResponse.json(
      { error: "Pick a date and time for this event." },
      { status: 400 },
    );
  }
  const endAt = parseWhen(body.endAt);
  if (endAt && endAt.getTime() <= startAt.getTime()) {
    return NextResponse.json(
      { error: "The end time has to be after the start." },
      { status: 400 },
    );
  }

  // The contact is snapshotted from the rep's own lead when one is named, and
  // the leadId is only kept when that lookup succeeds — a leadId belonging to
  // another rep resolves to null and is dropped rather than linked. An event
  // with no lead (a rep blocking out a meeting) is allowed, and then the
  // contact fields the browser sent stand on their own.
  let leadId = null;
  let snapshot = null;
  if (typeof body.leadId === "string" && body.leadId) {
    snapshot = await leadContactSnapshot(body.leadId, rep.id);
    if (snapshot) leadId = body.leadId;
  }

  const created = await db.salesEvent.create({
    data: {
      salesRepId: rep.id,
      type,
      title: clean(body.title, 200),
      startAt,
      endAt: endAt || null,
      location: clean(body.location, 300),
      notes: clean(body.notes, 4000),
      status: "scheduled",
      leadId,
      businessName: snapshot?.businessName ?? clean(body.businessName, 200),
      contactName: snapshot?.contactName ?? clean(body.contactName, 200),
      phone: snapshot?.phone ?? clean(body.phone, 60),
      website: snapshot?.website ?? clean(body.website, 300),
    },
  });

  return NextResponse.json({ event: shapeEvent(created) }, { status: 201 });
}
