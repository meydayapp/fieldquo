// app/api/visit/[token]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { stripe } from "@/lib/stripe";
import {
  loadVisitByToken,
  visitView,
  visitWhere,
  planCancel,
  reasonMessage,
} from "@/lib/booking/manageVisit";
import { sendVisitCancelledEmails } from "@/app/admin/lib/email/templates";

// Public, token-only — the homeowner's own copy of the visit they booked.
//
// There is no account behind a booking, so this link IS the authentication: 32
// random bytes minted at confirmation (lib/booking/finalizeBooking.js) and
// mailed to them. That makes two things load-bearing.
//
//   1. The response is built by naming fields (lib/booking/manageVisit.js), not
//      by handing back a Prisma row with the secrets deleted.
//   2. Every decision is re-taken HERE, from the row, at the moment of the
//      request. The page hiding a button is not access control, and this link
//      is forwardable — "I sent it to my husband" is the normal case, not the
//      attack.
//
// Rate limited because it is public and because POST moves money. Two separate
// buckets: a page that reloads must not use up the allowance for the one action
// that matters.

const READ_LIMIT = { limit: 60, windowMs: 10 * 60 * 1000 };
const CANCEL_LIMIT = {
  limit: 6,
  windowMs: 10 * 60 * 1000,
  message: "Too many attempts. Please wait a few minutes, or call us.",
};

export async function GET(request, { params }) {
  const limited = rateLimit(request, "visit-manage-read", READ_LIMIT);
  if (limited) return limited;

  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { token } = await params;

  const visit = await loadVisitByToken(token);
  if (!visit) {
    return NextResponse.json(
      { error: reasonMessage("not_found"), reason: "not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json(visitView(visit));
}

export async function POST(request, { params }) {
  const limited = rateLimit(request, "visit-manage-cancel", CANCEL_LIMIT);
  if (limited) return limited;

  const { token } = await params;
  const body = await request.json().catch(() => ({}));

  if (body?.action !== "cancel") {
    // Reschedule is its own route — see the header of ./reschedule/route.js.
    return NextResponse.json(
      { error: "Unsupported action.", reason: "bad_action" },
      { status: 400 },
    );
  }

  const visit = await loadVisitByToken(token);
  if (!visit) {
    return NextResponse.json(
      { error: reasonMessage("not_found"), reason: "not_found" },
      { status: 404 },
    );
  }

  const { booking, eventType, company } = visit;
  const now = new Date();

  // The verdict is taken again here, from the row, against a server clock. The
  // GET that rendered the page may have happened at 09:00 for a visit at 10:00
  // with an hour's notice required; by the time the button is pressed it can be
  // 09:30, and the answer has changed.
  const plan = planCancel(booking, company, now);

  if (!plan.ok) {
    return NextResponse.json(
      { error: reasonMessage(plan.reason), reason: plan.reason },
      { status: plan.httpStatus },
    );
  }

  // Already cancelled — a retry, a double tap, or the second person holding the
  // link. Answer with the state, refund nothing, send nothing.
  if (plan.alreadyCancelled) {
    return NextResponse.json({
      ...visitView(visit, now),
      cancelled: true,
      alreadyCancelled: true,
      refunded: Boolean(booking.feeRefundedAt),
      refundReason: plan.refundReason,
    });
  }

  // ── Money first, then the row ────────────────────────────────────────────
  //
  // feeRefundedAt is written only after Stripe confirms, for the same reason
  // sentAt is written only after Resend accepts: it records that money moved,
  // not that somebody asked for it to.
  //
  // If Stripe fails, NOTHING is written — the booking stays confirmed and the
  // client is told to try again, rather than ending up with a cancelled visit
  // and a fee that quietly never came back. If Stripe succeeds and the write
  // then fails (Neon idles out, say), the retry re-runs this call with the SAME
  // idempotency key and Stripe returns the original refund instead of making a
  // second one, so the two rows converge. That key is derived from the booking
  // id on purpose — a random one would be a double refund waiting for a flaky
  // connection. (Stripe expires idempotency keys after 24h; a retry a day later
  // is protected by feeRefundedAt, which the policy reads as already_refunded.)
  let refundedCents = null;
  let refundedAt = null;

  if (plan.refundNow) {
    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: booking.feeStripePaymentIntentId,
          amount: plan.amountCents,
          // Destination charge: the fee was transferred to the contractor's
          // connected account, so the reversal has to come back out of it.
          // Without this FieldQuo pays the homeowner out of its own balance.
          reverse_transfer: true,
          metadata: { bookingId: booking.id, companyId: company.id },
        },
        { idempotencyKey: `visit-cancel-refund-${booking.id}` },
      );

      // Stripe reports a refused refund in the object, not by throwing.
      if (refund.status === "failed" || refund.status === "canceled") {
        throw new Error(`refund ${refund.status}`);
      }

      refundedCents = plan.amountCents;
      refundedAt = new Date();
    } catch (err) {
      console.error("[visit] refund failed:", err?.message);
      return NextResponse.json(
        {
          error:
            "We couldn't return the visit fee just now, so nothing has been cancelled. Please try again in a moment, or call us.",
          reason: "refund_failed",
        },
        { status: 502 },
      );
    }
  }

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: "cancelled",
      ...(refundedAt && { feeRefundedAt: refundedAt, feeRefundedCents: refundedCents }),
    },
  });

  // Free the slot on the crew's calendar. Cancelled appointments are excluded
  // from computeAvailability's busy ranges, so this is what actually re-opens
  // the time — the booking status alone would leave the appointment sitting
  // there. Best-effort and logged: the client's cancellation has already been
  // honoured, and failing it here would tell them otherwise.
  if (booking.appointmentId) {
    await db.appointment
      .update({ where: { id: booking.appointmentId }, data: { status: "cancelled" } })
      .catch((err) => console.error("[visit] freeing appointment failed:", err?.message));
  }

  const after = {
    ...visit,
    booking: {
      ...booking,
      status: "cancelled",
      ...(refundedAt && { feeRefundedAt: refundedAt, feeRefundedCents: refundedCents }),
    },
  };

  // Both sides get told. Best-effort by contract — a Resend hiccup must never
  // surface as "we couldn't cancel that", because we did.
  await sendVisitCancelledEmails({
    company,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    eventTypeName: eventType.name,
    startTime: booking.startTime,
    location: visitWhere(visit),
    timezone: company.timezone,
    quoteNumber: booking.quote?.quoteNumber || null,
    refund: {
      refunded: Boolean(refundedAt),
      amountCents: plan.amountCents,
      currency: booking.feeCurrency || company.currency,
      reason: plan.refundReason,
    },
  }).catch((err) => console.error("[visit] cancellation emails failed:", err?.message));

  return NextResponse.json({
    ...visitView(after, now),
    cancelled: true,
    alreadyCancelled: false,
    refunded: Boolean(refundedAt),
    refundReason: plan.refundReason,
  });
}
