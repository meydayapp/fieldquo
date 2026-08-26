// lib/booking/settleBookingFee.js
//
// Turn a PAID visit fee into a real, confirmed booking: an Appointment the crew
// can see, the fee recorded, the status flipped, and the confirmation letter
// sent.
//
// Lifted out of app/api/stripe/webhook/route.js because the webhook must not be
// the only way this can happen. It now has three callers, and every one of them
// is a real production path:
//
//   1. the Stripe webhook (either endpoint — see lib/stripe/settleCheckoutSession.js),
//   2. the client's return from Checkout (app/api/booking/[companySlug]/settle),
//   3. the hourly reconciler (lib/booking/reconcileBookingFee.js).
//
// Three callers is exactly why this is one function. A booking that was paid for
// and never confirmed is money taken for a visit nobody is going to attend, and
// the version of this logic that rots is the copy nobody looks at.
//
// ── Idempotency ────────────────────────────────────────────────────────────
//
// All three callers can fire for the same booking, concurrently. The guarantee
// is the conditional update at the end: `updateMany` restricted to
// `status: pending_payment`. Whoever gets there second updates zero rows, and
// deletes the Appointment it optimistically created. The appointment is created
// first because it needs an id to write into the same update — creating it
// after would leave a window where the booking is confirmed and points at
// nothing, which is the exact shape of the bug this file exists to prevent.

import { db } from "@/lib/db";
import { finalizeBooking } from "@/lib/booking/finalizeBooking";

/**
 * @param {object} payment  What Stripe says was actually taken:
 *   { amountCents, currency, paymentIntentId, checkoutSessionId }
 * @param {object} deps     Injection seam, for scripts/check-booking-fee.mjs.
 *   Same reason recordStripePayment takes its client as an argument: a state
 *   machine that decides whether money became an appointment is worth executing
 *   in a check rather than reading, and a check that needs a live database and
 *   a Stripe secret is a check that stops being run. Production callers pass
 *   nothing and get the real db.
 * @returns {Promise<{settled: boolean, reason?: string, bookingId?: string,
 *                    appointmentId?: string, alreadySettled?: boolean}>}
 */
export async function settleBookingFee(bookingId, payment = {}, deps = {}) {
  const prisma = deps.db || db;
  const finalize = deps.finalize || finalizeBooking;

  if (!bookingId) return { settled: false, reason: "missing_booking_id" };

  const held = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { eventType: { include: { company: true } } },
  });

  if (!held) return { settled: false, reason: "booking_not_found" };
  if (!held.eventType) return { settled: false, reason: "event_type_missing" };

  // Already done — by the webhook, the return redirect, or a previous run. Not
  // an error: this is the common case once more than one path is live.
  if (held.status === "confirmed" && held.appointmentId) {
    return { settled: false, alreadySettled: true, bookingId, appointmentId: held.appointmentId };
  }

  // A hold the reconciler already gave up on. Money arriving after that is a
  // real situation (a slow bank method settling late), and silently re-confirming
  // a slot the contractor was told had lapsed would be worse than saying so —
  // so it is refused here and surfaced for a human instead.
  if (held.status !== "pending_payment") {
    return { settled: false, reason: `not_pending:${held.status}` };
  }

  const company = held.eventType.company;
  const eventType = held.eventType;

  // Find-or-create the client, same contract as the free booking path. A paid
  // booking that produced no Client row would leave the contractor with an
  // appointment attached to nobody.
  let client = await prisma.client.findFirst({
    where: { companyId: company.id, email: held.clientEmail },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: held.clientName,
        email: held.clientEmail,
        phone: held.clientPhone || null,
      },
    });
  }

  const appointment = await prisma.appointment.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      scheduledAt: held.startTime,
      // The CLIENT's address, not eventType.location — that's a label
      // ("On-site visit"), not a destination.
      location: held.address || eventType.location || null,
      ...(held.latitude != null &&
        held.longitude != null && {
          latitude: held.latitude,
          longitude: held.longitude,
        }),
      status: "scheduled",
      createdById: eventType.userId,
      assignedToId: eventType.userId,
    },
  });

  // The race guard. Only a row still sitting in pending_payment is flipped, so
  // a duplicate webhook delivery arriving alongside the return redirect cannot
  // produce two appointments for one visit.
  const claimed = await prisma.booking.updateMany({
    where: { id: held.id, status: "pending_payment" },
    data: {
      status: "confirmed",
      appointmentId: appointment.id,
      // What Stripe ACTUALLY took, never what we asked for. `?? null` rather
      // than `|| 0`: a settlement that arrives without an amount should read as
      // "unknown", not as a fee of zero — absence is not zero.
      feePaidCents: payment.amountCents ?? null,
      feeCurrency: payment.currency || null,
      feeStripePaymentIntentId: payment.paymentIntentId || null,
      ...(payment.checkoutSessionId && {
        feeCheckoutSessionId: payment.checkoutSessionId,
      }),
    },
  });

  if (claimed.count === 0) {
    // Someone else won. Undo the appointment we speculatively created — leaving
    // it would put a second, unlinked visit on the crew's calendar at the same
    // time, which reads to them as a double booking.
    await prisma.appointment.delete({ where: { id: appointment.id } }).catch(() => {});
    const winner = await prisma.booking.findUnique({
      where: { id: held.id },
      select: { appointmentId: true },
    });
    return {
      settled: false,
      alreadySettled: true,
      bookingId,
      appointmentId: winner?.appointmentId || null,
    };
  }

  const confirmed = await prisma.booking.findUnique({ where: { id: held.id } });

  // Email, consent record and reminder — shared with the free path so a paid
  // booking is confirmed to the homeowner exactly like a free one. Best-effort
  // by contract: the money is banked and the slot is real whatever Resend does.
  await finalize({ company, eventType, booking: confirmed, clientId: client.id });

  return { settled: true, bookingId, appointmentId: appointment.id };
}
