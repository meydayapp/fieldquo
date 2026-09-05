// app/api/booking/[companySlug]/confirm/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { geocodeAddress } from "@/lib/measure/roofMeasurement";
import { finalizeBooking } from "@/lib/booking/finalizeBooking";
import { effectiveBookingFeeCents, feeHoldCutoff } from "@/lib/booking/fee";
import { createBookingFeeCheckoutSession } from "@/lib/stripe";
import { getAppOrigin } from "@/lib/appUrl";
import { normaliseCountry } from "@/lib/tax/jurisdictions";

// Public — confirms a booking, re-validates the slot is still free (race condition guard)
export async function POST(request, { params }) {
  // Next 16: params is a Promise. Reading it synchronously yields undefined,
  // which made the company lookup below silently 404 every booking.
  const { companySlug } = await params;
  // A dropped mobile connection can truncate the body; an unguarded parse
  // throws a bodyless 500 and the booking the visitor just confirmed is lost
  // with no way to tell what happened. Clean 400 they can retry instead.
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "We couldn't read that request. Please try again." },
      { status: 400 },
    );
  }
  const {
    eventTypeSlug, startTime, clientName, clientEmail, clientPhone, mode,
    address, quoteId,
    // The structured halves of `address`, present only when the visitor picked
    // a Places suggestion. See the client create below for why they are kept
    // and why they are normalised rather than trusted.
    // ── What the work IS ────────────────────────────────────────────────
    //
    // The form asked for a name, an email, a phone and an address, and nothing
    // about the job — so a contractor opened their calendar to a name and a
    // time and had to ring the person to find out what they had booked.
    //
    // Cleaned, not trusted: both come from a public form anybody on the
    // internet can post to.
    notes,
    serviceKey,
    city, province, country,
  } =
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

  // Capped and trimmed. `notes` is prose a stranger typed; the length is what
  // stops a booking row becoming a place to store a novel.
  const cleanNotes =
    typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 2000) : null;
  // Only a key this company actually offers. An arbitrary string here would put
  // a service they do not sell onto their own calendar.
  const cleanServiceKey =
    typeof serviceKey === "string" && serviceKey.trim()
      ? (
          await db.companyServiceCategory.findFirst({
            where: { companyId: company.id, enabled: true, category: { key: serviceKey.trim() } },
            select: { id: true },
          })
        )
        ? serviceKey.trim()
        : null
      : null;

  const start = new Date(startTime);
  const end = new Date(start.getTime() + eventType.durationMinutes * 60000);

  // Re-check for a conflict right before booking (another visitor may have taken
  // it). Includes recent pending_payment holds so two people can't both be sent
  // to pay for the same slot; a hold older than FEE_HOLD_MINUTES is treated as
  // abandoned and no longer blocks.
  //
  // The window is shared with the sentence the booking page shows the client
  // ("your time is held for 30 minutes") and with the reconciler that cancels a
  // lapsed hold — see lib/booking/fee.js. Note the lapsed hold stops BLOCKING
  // here but is not cleared here; the hourly reconciler is what actually decides
  // whether it was paid and closes the row out either way.
  const holdSince = feeHoldCutoff();
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

  // Hoisted above the client create, which now seeds the client's address
  // from it. A failed geocode further down still stores this typed string with
  // null coordinates — see the note there.
  const visitAddress =
    typeof address === "string" && address.trim() ? address.trim() : null;

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
        // ── Why the address lands here at all ────────────────────────────
        //
        // This route created a client with a name, an email and a phone
        // number and put the site address only on the appointment. So the
        // first quote for a booked visit was written against a client with no
        // jurisdiction, and charged no tax without saying so.
        //
        // Only for a site visit, and only when the visitor PICKED the
        // address — `city`/`province`/`country` are absent when they typed
        // it, and absent stays null rather than becoming a guess. The country
        // is normalised rather than trusted: this is a public endpoint.
        //
        // Unlike lat/lng (deliberately re-geocoded below, because coordinates
        // from a browser would let anyone place an appointment anywhere),
        // these decide nothing the visitor could exploit — they set a tax
        // region the office sees on the client record and can correct.
        ...(visitAddress
          ? {
              address: visitAddress,
              city: typeof city === "string" && city ? city : null,
              province:
                typeof province === "string" && province ? province : null,
              country: normaliseCountry(country),
            }
          : {}),
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
    // appear on the crew's calendar.
    //
    // The appointment is created by lib/booking/settleBookingFee.js once the
    // money lands, and THREE things can trigger that: the Stripe webhook, the
    // client's own return from Checkout, and the hourly reconciler. It used to
    // be the webhook alone, which is how five bookings came to hold slots for
    // payments the app had no record of — a system that depends on a webhook and
    // cannot detect its absence has no way to tell "not paid" from "not told".
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
        notes: cleanNotes,
        serviceKey: cleanServiceKey,
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
        // {CHECKOUT_SESSION_ID} is substituted by Stripe on the redirect. It
        // used to be a bare `?booked=1`, which the page turned straight into
        // "Payment received — your visit is confirmed" having verified nothing
        // at all: the same screen appeared whether the webhook had confirmed the
        // booking, had never arrived, or had never been routed to us. The client
        // now returns with something the server can check.
        successUrl: `${origin}/book/${companySlug}?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/book/${companySlug}?payment_cancelled=1`,
      });

      // Stored so reconciliation can run FROM our side. Stripe already knew
      // which booking the session was for; we did not know which session the
      // booking was waiting on, which is why a webhook that never arrived left
      // no thread to pull. Best-effort — the checkout is already live, and the
      // reconciler falls back to scanning by metadata if this write is lost.
      await db.booking
        .update({ where: { id: held.id }, data: { feeCheckoutSessionId: session.id } })
        .catch((err) =>
          console.error("[booking] couldn't store checkout session id:", err?.message),
        );

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
      // ── Onto the row the crew actually reads ──────────────────────────
      //
      // Appointment.notes is what /app/appointments and the team schedule
      // render. A note reachable only through the Booking row is a note nobody
      // working that day will ever see, which is the same shape as the website
      // credentials that were captured and never shown.
      notes: cleanNotes,
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
      notes: cleanNotes,
      serviceKey: cleanServiceKey,
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
