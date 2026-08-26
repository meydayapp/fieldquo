// app/api/booking/[companySlug]/settle/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { settleBookingFee } from "@/lib/booking/settleBookingFee";

// Public — the client's own return from Stripe Checkout, and the second of the
// three ways a paid booking gets confirmed.
//
// ══ What this replaces ═════════════════════════════════════════════════════
//
// The success URL used to be `/book/<slug>?booked=1`, and the booking page
// turned that flag straight into "You're booked — Payment received, your visit
// is confirmed." It checked nothing. It could not: a query parameter is not
// evidence. That screen showed the same words whether the webhook had confirmed
// the booking, had not arrived yet, or — as actually happened — had been routed
// to an endpoint that dropped it. The homeowner was told their visit was
// confirmed by a page that had no idea whether it was. That is precisely the
// control that appears to work and doesn't.
//
// Now the client returns with Stripe's own session id, and the server asks
// Stripe. If the money is there the booking is settled on the spot — which also
// makes the common case faster than waiting for a webhook. If it isn't, the
// client is told the truth.
//
// ══ Why the session id is safe to accept ═══════════════════════════════════
//
// It is not a secret and it is not a capability. Stripe puts it in the client's
// own address bar by design. What matters is that it is not TRUSTED: the session
// is fetched from Stripe rather than believed, its metadata must name a booking,
// and that booking's event type must belong to the company in the URL. So a
// session id from another tenant confirms nothing here. The amount and the
// payment status come from Stripe and never from the browser — the same rule as
// every other pricing surface.
export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const { companySlug } = await params;
  const { sessionId } = await request.json().catch(() => ({}));

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const company = await findBookingCompany(companySlug);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    // An id Stripe doesn't know. Say nothing about why — this is a public
    // endpoint and "no such session" is all anyone needs.
    return NextResponse.json({ error: "That payment could not be found." }, { status: 404 });
  }

  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    return NextResponse.json({ error: "That payment isn't for a booking." }, { status: 400 });
  }

  // Tenant check: the booking named by this session must belong to the company
  // whose page is asking.
  const booking = await db.booking.findFirst({
    where: { id: bookingId, eventType: { companyId: company.id } },
    select: { id: true, status: true, startTime: true, appointmentId: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "That payment could not be found." }, { status: 404 });
  }

  if (session.payment_status !== "paid") {
    // Honest, and specific about what to do. A delayed-notification method can
    // still land later, which is why this does not say "it failed".
    return NextResponse.json({
      status: booking.status,
      paid: false,
      startTime: booking.startTime,
    });
  }

  const result = await settleBookingFee(booking.id, {
    amountCents: session.amount_total,
    currency: session.currency || null,
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null,
    checkoutSessionId: session.id,
  });

  const fresh = await db.booking.findUnique({
    where: { id: booking.id },
    select: { status: true, startTime: true, appointmentId: true },
  });

  return NextResponse.json({
    status: fresh?.status || booking.status,
    // Paid is what Stripe says, independent of whether WE managed to confirm.
    // Conflating the two is how "we have your money" became "you have a visit".
    paid: true,
    confirmed: fresh?.status === "confirmed" && Boolean(fresh?.appointmentId),
    startTime: fresh?.startTime || booking.startTime,
    ...(result.reason && { reason: result.reason }),
  });
}
