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
//
// ══ Three next steps, two of them here ═════════════════════════════════════
//
// lib/sales/nextSteps.js says what they are. A "demo" is a thirty-minute
// SalesEvent on the rep's own calendar and is written exactly like a callback
// with an end time. A "walkthrough" is an hour with a SPECIALIST and is TWO
// rows in one transaction: the SalesEvent on the rep's calendar, and a
// DemoBooking on FieldQuo's own demo calendar — the same DemoHostAvailability
// hosts the homepage and the migration service book against, so a
// walkthrough, a homepage demo and a migration call cannot land on one
// superadmin at once. It is offered only when the lead is linked to a company
// whose onboarding is complete; walkthroughGate() is re-asked here, from a
// fresh read, whatever the screen showed.
//
// GET ?walkthroughSlots=1 lists the hour-long starts a specialist is free for,
// from the same loader, so the picker cannot offer a time this route refuses.

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
  contactFields,
} from "@/lib/sales/calendar/event";
import { NEXT_STEP_MINUTES, WALKTHROUGH_SOURCE, endOf, walkthroughGate } from "@/lib/sales/nextSteps";
import { loadMigrationHosts } from "@/lib/migrations/hosts";
import { availableSlotsByDayFor, hostsFreeFor, pickHost } from "@/lib/demo/slots";
import { sendHostHeadsUp } from "@/lib/demo/bookingEmails";
import { getOnboardingStatus } from "@/lib/onboarding";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { searchParams } = new URL(request.url);

  // The specialist's free hours, for the walkthrough picker. Derived from the
  // same loader the POST checks against — a slot offered here is a slot the
  // write will accept, short of somebody taking it in between.
  if (searchParams.get("walkthroughSlots") === "1") {
    const now = new Date();
    const hosts = await loadMigrationHosts(now);
    return NextResponse.json({
      minutes: NEXT_STEP_MINUTES.walkthrough,
      days: availableSlotsByDayFor(hosts, NEXT_STEP_MINUTES.walkthrough, now),
      // Honest empty: nobody has stated availability, and the screen says so
      // rather than inventing a grid — lib/demo/slots.js's own rule.
      noHosts: hosts.length === 0,
    });
  }

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
  // The linked id is the one the rep-scoped read RETURNED, never the one the
  // browser sent: leadContactSnapshot resolves body.leadId inside a
  // `salesRepId: rep.id` WHERE, so `snapshot.id` is a lead the database
  // proved is this rep's. Writing body.leadId instead — even when equal —
  // is a foreign key nothing proved, which is what check:tenant-scope
  // refuses, and rightly.
  let leadId = null;
  let snapshot = null;
  if (typeof body.leadId === "string" && body.leadId) {
    snapshot = await leadContactSnapshot(body.leadId, rep.id);
    if (snapshot) leadId = snapshot.id;
  }

  // A demo and a walkthrough are spans. The browser may send an end; when it
  // does not, the length is the kind's own (thirty minutes, an hour), never
  // a point that would draw a callback-shaped dot for a meeting.
  const spanEnd = endAt || endOf(type, startAt);

  const data = {
    salesRepId: rep.id,
    type,
    title: clean(body.title, 200),
    startAt,
    endAt: spanEnd || null,
    location: clean(body.location, 300),
    notes: clean(body.notes, 4000),
    status: "scheduled",
    leadId,
    // Typed wins, snapshot fills — lib/sales/calendar/event.js contactFields
    // says why the other order silently discarded every correction.
    ...contactFields(body, snapshot),
  };

  if (type !== "walkthrough") {
    const created = await db.salesEvent.create({ data });
    return NextResponse.json({ event: shapeEvent(created) }, { status: 201 });
  }

  // ── The walkthrough: the specialist's calendar, gated on onboarding ─────
  //
  // Re-decided here from fresh reads — the lead, its linked company, the
  // company's checklist — never trusted from the screen that offered the
  // button. lib/migrations/state.js's canWrite() rule, applied to a booking.
  const lead = leadId
    ? await db.salesLead.findFirst({
        where: { id: leadId, salesRepId: rep.id },
        select: { id: true, businessName: true, contactName: true, email: true, phone: true, convertedCompanyId: true },
      })
    : null;
  let onboarding = null;
  if (lead?.convertedCompanyId) {
    try {
      onboarding = await getOnboardingStatus(lead.convertedCompanyId);
    } catch {
      onboarding = null;
    }
  }
  const gate = walkthroughGate({ lead, onboarding });
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason, reasonKey: gate.reasonKey }, { status: 409 });
  }
  if (!lead.email) {
    // DemoBooking.email is required, and it is where the specialist's invite
    // goes. Refused rather than booked without one: a walkthrough nobody can
    // be told about is a slot spent on an empty call.
    return NextResponse.json(
      { error: "Add the contact's email address to the lead first — that is where the walkthrough invite goes.", reasonKey: "app.salesCall.walkthroughRefusal.no_email" },
      { status: 409 },
    );
  }

  const now = new Date();
  const hosts = await loadMigrationHosts(now);
  const free = hostsFreeFor(hosts, startAt.toISOString(), NEXT_STEP_MINUTES.walkthrough, now);
  if (free.length === 0) {
    return NextResponse.json(
      { error: "No specialist is free for a full hour at that time. Pick one of the offered slots.", reasonKey: "app.salesCall.walkthroughRefusal.no_slot" },
      { status: 409 },
    );
  }
  const host = pickHost(free);

  let created;
  try {
    created = await db.$transaction(async (tx) => {
      const booking = await tx.demoBooking.create({
        data: {
          name: lead.contactName || lead.businessName || "Unnamed contact",
          email: lead.email,
          companyName: lead.businessName || null,
          phone: lead.phone || null,
          notes: `One-hour onboarding walkthrough booked by ${rep.name || "a sales rep"} from lead ${lead.id}.${data.notes ? ` ${data.notes}` : ""}`,
          scheduledAt: startAt,
          hostAdminId: host.adminId,
          source: WALKTHROUGH_SOURCE,
        },
      });
      const event = await tx.salesEvent.create({
        data: {
          ...data,
          endAt: new Date(startAt.getTime() + NEXT_STEP_MINUTES.walkthrough * 60_000),
          title: data.title || `Walkthrough with a FieldQuo specialist`,
          // The host is on the event so the rep's calendar says WHO, and the
          // booking id so the two rows can be found from each other.
          notes: [data.notes, `Specialist: ${host.email || host.adminId}. Booking ${booking.id}.`].filter(Boolean).join("\n"),
        },
      });
      return { event, booking };
    });
  } catch (err) {
    // Unique violation on (hostAdminId, scheduledAt): the slot went between
    // the check and the write. The rep picks again rather than being moved.
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Someone just booked that slot — pick another.", reasonKey: "app.salesCall.walkthroughRefusal.no_slot" }, { status: 409 });
    }
    throw err;
  }

  // The heads-up to the specialist and the superadmins, with the .ics —
  // best-effort, the same rule the homepage route keeps: the booking is
  // saved and a mail hiccup must not make the rep book it twice. The
  // customer's own invite goes through /api/sales/events/[id]/invite, from
  // the rep's mailbox, where the suppression list and the rep's sender are
  // checked the way every other rep-to-contact email is.
  let headsUp = false;
  try {
    await sendHostHeadsUp(created.booking, host.email, {
      kind: "walkthrough",
      bookedBy: `Booked by ${rep.name || "a sales rep"} (${rep.workEmail || rep.email || "sales"}) from lead ${lead.id}`,
    });
    headsUp = true;
  } catch (err) {
    console.error("[walkthrough] host heads-up failed:", err?.message);
  }

  return NextResponse.json(
    { event: shapeEvent(created.event), specialist: host.email || null, bookingId: created.booking.id, hostNotified: headsUp },
    { status: 201 },
  );
}
