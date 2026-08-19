// app/api/booking/[companySlug]/confirm/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { geocodeAddress } from "@/lib/measure/roofMeasurement";
import { finalizeBooking } from "@/lib/booking/finalizeBooking";
import { effectiveBookingFeeCents } from "@/lib/booking/fee";
import { createBookingFeeCheckoutSession } from "@/lib/stripe";
import { getAppOrigin } from "@/lib/appUrl";

// Public — confirms a booking, re-validates the slot is still free (race condition guard)
export async function POST(request, { params }) {
  // Next 16: params is a Promise. Reading it synchronously yields undefined,
  // which made the company lookup below silently 404 every booking.
  const { companySlug } = await params;
  const body = await request.json();
  const { eventTypeSlug, startTime, clientName, clientEmail, clientPhone, mode, address, quoteId } =
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

  // Re-check for a conflict right before booking (another visitor may have taken
  // it). Includes recent pending_payment holds so two people can't both be sent
  // to pay for the same slot; a hold older than 30 minutes is treated as
  // abandoned and no longer blocks.
  const holdSince = new Date(Date.now() - 30 * 60 * 1000);
  const conflict = await db.booking.findFirst({
    where: {
      eventType: { userId: eventType.userId },
      startTime: { lt: end },
      endTime: { gt: start },
      OR: [
        { status: "confirmed" },
        { status: "pending_payment", createdAt: { gte: holdSince } },
      ],
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

  // ── The estimate this visit is about, if the booking came from one ────────
  //
  // The instant-estimate result offers "book a visit" straight after revealing
  // the range, so the browser is the only party that knows which session this
  // is — the id has to arrive from it. It is therefore checked, not trusted.
  //
  // Two conditions, both required. The quote must belong to THIS company, so a
  // cuid harvested from another tenant cannot be attached. And its client email
  // must match the one booking the visit, so a guessed id from the same company
  // cannot staple someone else's quote to your booking — that reference is
  // printed in a confirmation email, and a wrong one tells a homeowner about a
  // job that isn't theirs.
  //
  // A failure resolves to null rather than rejecting: the booking is the thing
  // the client came to do, and losing it over a decorative cross-reference
  // would be the wrong trade.
  let linkedQuoteId = null;
  if (typeof quoteId === "string" && quoteId) {
    const q = await db.quote.findFirst({
      where: { id: quoteId, companyId: company.id },
      select: { id: true, client: { select: { email: true } } },
    });
    const sameClient =
      q?.client?.email &&
      q.client.email.trim().toLowerCase() === String(clientEmail).trim().toLowerCase();
    if (sameClient) linkedQuoteId = q.id;
  }
  let visitPoint = null;
  if (visitAddress && chosenMode === "visit") {
    const hit = await geocodeAddress(visitAddress);
    if (hit) visitPoint = { lat: hit.lat, lng: hit.lng };
  }

  // ── Paid visit vs free booking ──────────────────────────────────────────
  //
  // The fee is resolved server-side (the browser never says what a visit costs).
  const { feeCents } = effectiveBookingFeeCents(company, eventType);

  if (feeCents > 0) {
    // PAID: hold the slot with a pending_payment booking and send the client to
    // Stripe. Deliberately NO appointment yet — an unpaid appointment must not
    // appear on the crew's calendar. The webhook (metadata.bookingId) creates
    // the appointment, records the fee, flips to confirmed, and finalises once
    // payment lands.
    if (!company.stripeAccountId) {
      return NextResponse.json(
        { error: "This company can't collect the booking fee yet." },
        { status: 400 },
      );
    }
    const held = await db.booking.create({
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
        ...(linkedQuoteId && { quoteId: linkedQuoteId }),
        status: "pending_payment",
      },
    });

    const origin = getAppOrigin(request);
    try {
      const session = await createBookingFeeCheckoutSession({
        bookingId: held.id,
        company,
        label: `${eventType.name} — visit fee`,
        amountCents: feeCents,
        successUrl: `${origin}/book/${companySlug}?booked=1`,
        cancelUrl: `${origin}/book/${companySlug}?payment_cancelled=1`,
      });
      return NextResponse.json({
        requiresPayment: true,
        checkoutUrl: session.url,
        feeCents,
      });
    } catch (err) {
      // Couldn't start payment — release the hold so the slot frees immediately.
      await db.booking.delete({ where: { id: held.id } }).catch(() => {});
      console.error("[booking] fee checkout failed:", err?.message);
      return NextResponse.json(
        { error: "Couldn't start the payment. Please try again." },
        { status: 502 },
      );
    }
  }

  // FREE: create the appointment + confirmed booking now.
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
      ...(linkedQuoteId && { quoteId: linkedQuoteId }),
      appointmentId: appointment.id,
    },
  });

  // The confirmation email, consent record and reminder — shared with the paid
  // path so the two can't drift. Best-effort: the booking already exists.
  await finalizeBooking({ company, eventType, booking, clientId: client.id });

  return NextResponse.json(booking, { status: 201 });
}
