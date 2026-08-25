// app/api/stripe/webhook/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { finalizeBooking } from "@/lib/booking/finalizeBooking";
import { recordStripePayment } from "@/lib/invoices/recordStripePayment";
import { settleOccurrenceFromIntent } from "@/lib/servicePlans/run";
import { recordAuthorisationFromSession } from "@/lib/servicePlans/authorisation";

// Record an invoice payment from a completed/settled checkout session.
//
// The write itself — and the balance recompute, and the idempotency guarantee —
// now live in lib/invoices/recordStripePayment.js, because service plans pay the
// same invoices through a different Stripe object (an off-session PaymentIntent
// with no Checkout Session at all). Two copies of "how an invoice becomes paid"
// is how the two come to disagree about the balance.
async function recordInvoicePayment(session) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;
  await recordStripePayment(db, {
    invoiceId,
    paymentIntentId: session.payment_intent,
    amountCents: session.amount_total || 0,
  });
}

// Handles Connect events (company payment setup + invoice payments) — a SEPARATE
// webhook endpoint/secret from the Billing webhook. Never combine these two.
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object;
      await db.company.updateMany({
        where: { stripeAccountId: account.id },
        data: {
          stripeOnboarded: account.details_submitted,
          stripeChargesEnabled: account.charges_enabled,
        },
      });
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object;
      const { invoiceId, bookingId, servicePlanId } = session.metadata || {};

      // ── A service plan authorisation ─────────────────────────────────────
      //
      // Setup mode: NO money moved. The client has just saved a payment method
      // with a mandate. There is no separate "setup completed" event type —
      // Checkout reports every finished session here, and `mode` is what tells
      // them apart, so this branch must come before anything that assumes a
      // payment.
      //
      // The return redirect calls the same helper, so whichever gets there
      // first wins and the other is a no-op (the row is keyed on planId).
      if (session.mode === "setup" && servicePlanId) {
        await recordAuthorisationFromSession(servicePlanId, session.id);
        break;
      }

      // A paid booking VISIT FEE cleared: turn the held slot into a real
      // appointment, record the fee, confirm, and finalise (email/consent/
      // reminder). Idempotent — a re-delivered event finds the booking already
      // confirmed and does nothing.
      if (bookingId) {
        const held = await db.booking.findUnique({
          where: { id: bookingId },
          include: { eventType: { include: { company: true } } },
        });
        if (held && held.status === "pending_payment" && held.eventType) {
          const company = held.eventType.company;
          const eventType = held.eventType;

          let client = await db.client.findFirst({
            where: { companyId: company.id, email: held.clientEmail },
          });
          if (!client) {
            client = await db.client.create({
              data: {
                companyId: company.id,
                name: held.clientName,
                email: held.clientEmail,
                phone: held.clientPhone || null,
              },
            });
          }

          const appointment = await db.appointment.create({
            data: {
              companyId: company.id,
              clientId: client.id,
              scheduledAt: held.startTime,
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

          const confirmed = await db.booking.update({
            where: { id: held.id },
            data: {
              status: "confirmed",
              appointmentId: appointment.id,
              feePaidCents: session.amount_total || 0,
              feeCurrency: session.currency || null,
              feeStripePaymentIntentId: session.payment_intent || null,
            },
          });

          await finalizeBooking({
            company,
            eventType,
            booking: confirmed,
            clientId: client.id,
          });
        }
        break;
      }

      // Only record a payment here for SYNCHRONOUS methods (card), which are
      // already `paid` at completion. An asynchronous method (Affirm, and other
      // delayed-notification methods) completes the session as `unpaid`/
      // `processing` and only settles later via async_payment_succeeded —
      // recording it now would mark an unsettled invoice paid.
      if (invoiceId && session.payment_status === "paid") {
        await recordInvoicePayment(session);
      }
      break;
    }

    // Affirm and other delayed-notification methods settle here, minutes after
    // the client returned to the portal. This is the event that actually marks
    // the invoice paid for those methods — its absence was why an Affirm payment
    // that succeeded in Stripe left the invoice showing a full balance owing.
    case "checkout.session.async_payment_succeeded": {
      await recordInvoicePayment(event.data.object);
      break;
    }

    // The delayed payment failed (e.g. Affirm declined after redirect). Nothing
    // to record — the invoice stays unpaid, which is already its state.
    case "checkout.session.async_payment_failed": {
      break;
    }

    // ── Service plan occurrences settling ─────────────────────────────────
    //
    // Pre-authorized debit is a delayed-notification method: the off-session
    // PaymentIntent sits in `processing` for days, so the run engine cannot know
    // the outcome when it creates it. These two events are the fast path.
    //
    // They are deliberately NOT the only path. Whether an endpoint is subscribed
    // to payment_intent.* is a Stripe dashboard setting we cannot verify from
    // code, and an invoice that stays unpaid because a checkbox was never ticked
    // is the silent-money-bug this codebase keeps being swept for. The cron
    // reconciles every `charging` occurrence against Stripe on each run
    // (settlePendingCharges), so this only makes it faster.
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      if (intent.metadata?.servicePlanOccurrenceId) {
        await settleOccurrenceFromIntent(intent);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
