// app/api/booking/[companySlug]/confirm/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendBookingConfirmationEmail } from "@/app/admin/lib/email/templates";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { geocodeAddress } from "@/lib/measure/roofMeasurement";

// Public — confirms a booking, re-validates the slot is still free (race condition guard)
export async function POST(request, { params }) {
  // Next 16: params is a Promise. Reading it synchronously yields undefined,
  // which made the company lookup below silently 404 every booking.
  const { companySlug } = await params;
  const body = await request.json();
  const { eventTypeSlug, startTime, clientName, clientEmail, clientPhone, mode, address } =
    body;

  if (!eventTypeSlug || !startTime || !clientName || !clientEmail) {
    return NextResponse.json(
      {
        error:
          "eventTypeSlug, startTime, clientName, and clientEmail are required",
      },
      { status: 400 },
    );
  }

  const company = await findBookingCompany(companySlug);
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const eventType = await db.eventType.findFirst({
    where: { companyId: company.id, slug: eventTypeSlug, active: true },
  });
  if (!eventType)
    return NextResponse.json(
      { error: "Event type not found" },
      { status: 404 },
    );

  const start = new Date(startTime);
  const end = new Date(start.getTime() + eventType.durationMinutes * 60000);

  // Re-check for a conflict right before booking (another visitor may have taken it)
  const conflict = await db.booking.findFirst({
    where: {
      eventType: { userId: eventType.userId },
      status: "confirmed",
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });

  if (conflict) {
    return NextResponse.json(
      {
        error:
          "That slot was just booked by someone else. Please pick another time.",
      },
      { status: 409 },
    );
  }

  // Create/find client record for this company
  let client = await db.client.findFirst({
    where: { companyId: company.id, email: clientEmail },
  });
  if (!client) {
    client = await db.client.create({
      data: {
        companyId: company.id,
        name: clientName,
        email: clientEmail,
        phone: clientPhone || null,
      },
    });
  }

  // Validated against what the company ACTUALLY offers, not just against the
  // three known strings. A visitor posting mode:"video" to a company that only
  // does site visits would otherwise book a video call nobody can host.
  const offered = Array.isArray(company.bookingModes) && company.bookingModes.length
    ? company.bookingModes
    : ["visit"];
  const chosenMode = offered.includes(mode) ? mode : offered[0];

  // ── The visit address, geocoded ─────────────────────────────────────────
  //
  // Re-geocoded here rather than trusting coordinates from the browser: a
  // client posting lat/lng directly could place an appointment anywhere, and
  // these coordinates decide whether OTHER slots get offered. The availability
  // step already resolved this address, so it's a cache hit at Google and the
  // visitor sees no delay.
  //
  // A failed geocode stores the typed address with null coordinates. That's
  // honest — the crew still needs the street address — and travel filtering
  // treats missing coordinates as unknown rather than as the middle of the
  // ocean.
  const visitAddress = typeof address === "string" && address.trim() ? address.trim() : null;
  let visitPoint = null;
  if (visitAddress && chosenMode === "visit") {
    const hit = await geocodeAddress(visitAddress);
    if (hit) visitPoint = { lat: hit.lat, lng: hit.lng };
  }

  const appointment = await db.appointment.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      scheduledAt: start,
      // The CLIENT's address when they gave one — that's where the van goes.
      // eventType.location is a label ("On-site visit"), not a destination.
      location: visitAddress || eventType.location || null,
      ...(visitPoint && { latitude: visitPoint.lat, longitude: visitPoint.lng }),
      status: "scheduled",
      createdById: eventType.userId,
      assignedToId: eventType.userId,
    },
  });

  const booking = await db.booking.create({
    data: {
      eventTypeId: eventType.id,
      clientName,
      clientEmail,
      clientPhone: clientPhone || null,
      startTime: start,
      endTime: end,
      mode: chosenMode,
      address: visitAddress,
      ...(visitPoint && { latitude: visitPoint.lat, longitude: visitPoint.lng }),
      appointmentId: appointment.id,
    },
  });

  await sendBookingConfirmationEmail({
    to: clientEmail,
    companyName: company.name,
    clientName,
    eventTypeName: eventType.name,
    startTime: start,
    // What the client chose beats the event type's free-text label: "Phone or
    // on-site visit" told them nothing about which one they're getting.
    location:
      chosenMode === "call"
        ? `Phone call${company.phone ? ` — we'll ring you${clientPhone ? ` on ${clientPhone}` : ""}` : ""}`
        : chosenMode === "video"
          ? "Video call — we'll email a link"
          : visitAddress || eventType.location || "On-site visit",
  });

  return NextResponse.json(booking, { status: 201 });
}
