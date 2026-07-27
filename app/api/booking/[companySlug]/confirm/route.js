// app/api/booking/[companySlug]/confirm/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendBookingConfirmationEmail } from "@/app/admin/lib/email/templates";

// Public — confirms a booking, re-validates the slot is still free (race condition guard)
export async function POST(request, { params }) {
  // Next 16: params is a Promise. Reading it synchronously yields undefined,
  // which made the company lookup below silently 404 every booking.
  const { companySlug } = await params;
  const body = await request.json();
  const { eventTypeSlug, startTime, clientName, clientEmail, clientPhone } =
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

  const company = await db.company.findUnique({
    where: { slug: companySlug },
  });
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

  const appointment = await db.appointment.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      scheduledAt: start,
      location: eventType.location || null,
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
      appointmentId: appointment.id,
    },
  });

  await sendBookingConfirmationEmail({
    to: clientEmail,
    companyName: company.name,
    clientName,
    eventTypeName: eventType.name,
    startTime: start,
    location: eventType.location,
  });

  return NextResponse.json(booking, { status: 201 });
}
