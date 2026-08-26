// lib/booking/reconcileBookingFee.js
//
// Ask Stripe what actually happened to a held booking, and make the row agree.
//
// ══ Why a reconciler, and not just a webhook fix ═══════════════════════════
//
// The original defect was a misrouted webhook. That has been fixed. But the
// reason it went unnoticed for five bookings is the deeper problem, and fixing
// the routing does not touch it: **the app had no way to notice a webhook that
// never arrived.** A booking sat in `pending_payment` for ever — no timeout, no
// retry, no reconciliation, invisible on every screen. The next delivery failure
// of any kind (a deploy mid-delivery, a dashboard endpoint disabled, a signing
// secret rotated) would reproduce it exactly.
//
// This is the same conclusion service plans already reached — see the comment
// on `payment_intent.succeeded` in app/api/stripe/webhook/route.js: the webhook
// is a fast path, never the only path, because whether an endpoint is subscribed
// to an event is a dashboard setting that code cannot verify.
//
// ══ What it decides ════════════════════════════════════════════════════════
//
//   Stripe says paid            → settle: appointment, fee, confirmed, email.
//   Stripe says still open, and
//     the hold has not lapsed   → leave it. They may still be typing a card in.
//   Stripe says expired/unpaid,
//     and the hold has lapsed   → cancel, with a reason, and keep the row.
//   No session found at all     → after the hold lapses, cancel the same way.
//
// The row is CANCELLED, never deleted. A booking the client believes they made
// is a fact about the world; deleting it would leave the contractor unable to
// answer "I booked you on Thursday" with anything but a shrug.

import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { settleBookingFee } from "@/lib/booking/settleBookingFee";
import { FEE_HOLD_MINUTES, feeHoldCutoff } from "@/lib/booking/fee";

// How far either side of the booking's creation to look when the session id was
// never stored. The session is created within the same request, so a couple of
// minutes is generous; the window exists only to keep the scan bounded.
const LEGACY_SCAN_WINDOW_SECONDS = 10 * 60;

/**
 * The Checkout Session for a held booking.
 *
 * Prefers the stored id. Falls back to a bounded scan around `createdAt` for the
 * rows written before feeCheckoutSessionId existed — the five that were stuck
 * when this was written have no stored id, and a reconciler that cannot settle
 * the bookings that caused it to be written is not much of a reconciler.
 */
export async function findFeeSession(booking) {
  if (booking.feeCheckoutSessionId) {
    try {
      return await stripe.checkout.sessions.retrieve(booking.feeCheckoutSessionId);
    } catch {
      // A stored id Stripe does not recognise is a data problem, not a reason to
      // give up — fall through to the scan.
    }
  }

  const created = Math.floor(new Date(booking.createdAt).getTime() / 1000);
  const page = await stripe.checkout.sessions.list({
    limit: 100,
    created: {
      gte: created - LEGACY_SCAN_WINDOW_SECONDS,
      lte: created + LEGACY_SCAN_WINDOW_SECONDS,
    },
  });
  return page.data.find((s) => s.metadata?.bookingId === booking.id) || null;
}

/**
 * Reconcile ONE held booking against Stripe.
 *
 * @param booking  a Booking row (id, status, createdAt, feeCheckoutSessionId)
 * @param opts.now                 injectable clock, for the state-machine check
 * @param opts.cancelLapsed        false to report without cancelling (dry run)
 * @returns {Promise<{action: string, [k: string]: any}>}
 */
export async function reconcileBookingFee(booking, opts = {}) {
  const now = opts.now ?? Date.now();
  const cancelLapsed = opts.cancelLapsed !== false;
  // Injection seam, same rationale as settleBookingFee: this decides whether a
  // payment becomes an appointment or a slot gets released, which is worth
  // executing in scripts/check-booking-fee.mjs rather than reading. Production
  // callers pass neither and get the real database and a real Stripe lookup.
  const prisma = opts.db || db;
  const findSession = opts.findSession || findFeeSession;
  const settle = opts.settle || settleBookingFee;

  if (booking.status !== "pending_payment") {
    return { action: "skipped", reason: `not_pending:${booking.status}`, bookingId: booking.id };
  }

  const lapsed = new Date(booking.createdAt) < feeHoldCutoff(now);

  let session = null;
  try {
    session = await findSession(booking);
  } catch (err) {
    // Stripe unreachable. Emphatically do NOT cancel on this — an outage at
    // Stripe would otherwise cancel every held booking in the system, which is
    // a far worse failure than leaving a hold in place for another hour.
    return { action: "error", reason: err?.message || "stripe_unavailable", bookingId: booking.id };
  }

  if (session && session.payment_status === "paid") {
    const result = await settle(booking.id, {
      amountCents: session.amount_total,
      currency: session.currency || null,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null,
      checkoutSessionId: session.id,
    });
    return {
      action: result.settled ? "settled" : result.alreadySettled ? "already_settled" : "settle_failed",
      bookingId: booking.id,
      amountCents: session.amount_total,
      appointmentId: result.appointmentId || null,
      ...(result.reason && { reason: result.reason }),
    };
  }

  if (!lapsed) {
    // Still inside the window we promised them. Leave it alone.
    return { action: "holding", bookingId: booking.id, minutesLeft: minutesLeft(booking, now) };
  }

  if (!cancelLapsed) {
    return { action: "would_cancel", bookingId: booking.id };
  }

  // Lapsed and unpaid. Release the slot and say why.
  const cancelled = await prisma.booking.updateMany({
    where: { id: booking.id, status: "pending_payment" },
    data: { status: "cancelled", cancelReason: "payment_incomplete" },
  });
  return {
    action: cancelled.count ? "cancelled" : "already_settled",
    bookingId: booking.id,
    reason: "payment_incomplete",
  };
}

function minutesLeft(booking, now) {
  const elapsed = (now - new Date(booking.createdAt).getTime()) / 60000;
  return Math.max(0, Math.ceil(FEE_HOLD_MINUTES - elapsed));
}

/**
 * Every held booking worth asking about, oldest first.
 *
 * Bounded deliberately: an unpaid hold from three months ago tells nobody
 * anything and re-scanning it every hour is a Stripe call per run for ever.
 */
export async function heldBookings({ limit = 200, maxAgeDays = 30 } = {}) {
  return db.booking.findMany({
    where: {
      status: "pending_payment",
      createdAt: { gte: new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}
