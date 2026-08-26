// app/api/bookings/awaiting-payment/route.js
//
// The bookings a contractor cannot otherwise see.
//
// Every screen in the app reads Appointments and JobVisits, and a booking held
// for an unpaid visit fee has neither — by design, because an unpaid visit must
// not appear on the crew's calendar. The consequence went unnoticed: a homeowner
// who filled the form in, chose a time and was sent to Stripe existed on no
// screen at all. When one of them said "I booked you for Thursday", the
// contractor had nothing to look at.
//
// So this is deliberately not a calendar. It is a short list of "someone tried
// to book you and the money hasn't landed", which is a different question from
// "what am I doing on Thursday" and belongs on a different surface.
//
// Read by app/components/dashboard/AwaitingPayment.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import { effectiveBookingFeeCents, FEE_HOLD_MINUTES } from "@/lib/booking/fee";
import { reconcileBookingFee } from "@/lib/booking/reconcileBookingFee";

// A week back, so a hold that lapsed on Friday is still answerable on Monday,
// and forward without limit — a held booking three months out still matters.
const LOOKBACK_DAYS = 7;

function shape(booking, company) {
  const { feeCents } = effectiveBookingFeeCents(company, booking.eventType);
  return {
    id: booking.id,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    clientPhone: booking.clientPhone,
    startTime: booking.startTime,
    mode: booking.mode,
    address: booking.address,
    status: booking.status,
    cancelReason: booking.cancelReason,
    eventTypeName: booking.eventType?.name || null,
    createdAt: booking.createdAt,
    // What was asked for, and separately what was actually taken. They are not
    // the same fact and the panel shows the second one only when it exists.
    feeCents,
    feePaidCents: booking.feePaidCents,
    feeCurrency: booking.feeCurrency,
    holdMinutes: FEE_HOLD_MINUTES,
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { id: true, currency: true, stripeChargesEnabled: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const bookings = await db.booking.findMany({
    where: {
      eventType: { companyId: company.id },
      OR: [
        // Still waiting on money.
        { status: "pending_payment" },
        // And the recent near-misses: a hold the reconciler closed out because
        // the checkout was abandoned. Shown for a week because the homeowner
        // may well ring up about it, and "we never got your payment" is only a
        // usable answer if the contractor can see that it happened.
        { status: "cancelled", cancelReason: "payment_incomplete", createdAt: { gte: since } },
      ],
      createdAt: { gte: since },
    },
    orderBy: { startTime: "asc" },
    include: { eventType: true },
    take: 50,
  });

  return NextResponse.json({
    bookings: bookings.map((b) => shape(b, company)),
    currency: company.currency,
    // Told by the server rather than worked out in the browser, so the button
    // is only rendered for someone POST will actually accept. A visible control
    // that 403s is the same lie as a control that does nothing.
    canCheck: can(member.role, "user:manage"),
  });
}

// "Check with Stripe" — settle one held booking by hand.
//
// The hourly cron does this on its own; this is the button for the contractor
// standing in front of a customer who says they paid. It confirms nothing on its
// own authority: it asks Stripe and writes down the answer, so pressing it when
// no payment exists changes nothing at all.
//
// Gated on user:manage — owner, admin or supervisor. Creating an appointment
// out of a payment is a money decision, and an employee is not the person to
// make it.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!can(member.role, "user:manage")) {
    return NextResponse.json(
      { error: "Only a supervisor, admin or owner can check a booking payment." },
      { status: 403 },
    );
  }

  const { bookingId } = await request.json().catch(() => ({}));
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  // Scoped to this company's own event types, so one tenant cannot reconcile
  // another's booking.
  const booking = await db.booking.findFirst({
    where: { id: bookingId, eventType: { companyId: member.companyId } },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // cancelLapsed:false — this button is "did they pay?", not "give up on them".
  // Cancelling a hold is the reconciler's job on its own schedule; doing it as a
  // side effect of someone pressing Check would be a destructive operation
  // labelled as a cosmetic one.
  const result = await reconcileBookingFee(booking, { cancelLapsed: false });

  return NextResponse.json({ result });
}
