// app/api/stripe/webhook/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { finalizeBooking } from "@/lib/booking/finalizeBooking";

// Record an invoice payment from a completed/settled checkout session and
// recompute the balance from ALL payments. Shared by the synchronous (card) path
// and the asynchronous settlement path (Affirm et al.), so the two can't drift.
//
// Idempotent: Stripe can deliver the same event twice, and an async method fires
// BOTH `checkout.session.completed` (unpaid) and later
// `checkout.session.async_payment_succeeded` for one session — we must create at
// most one Payment row per payment intent.
//
// The read-then-create below is a fast path, NOT the guarantee. Two deliveries
// arriving together both pass the read and both insert, and the invoice ends up
// showing twice the money that actually arrived. The real guard is the unique
// index on Payment.stripePaymentIntentId; the P2002 catch is us losing that race
// gracefully. Don't remove one believing the other covers it.
async function recordInvoicePayment(session) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;

  const already = await db.payment.findFirst({
    where: { invoiceId, stripePaymentIntentId: session.payment_intent },
    select: { id: true },
  });
  if (already) return;

  try {
    await db.payment.create({
      data: {
        invoiceId,
        amount: (session.amount_total || 0) / 100,
        method: "stripe",
        stripePaymentIntentId: session.payment_intent,
      },
    });
  } catch (err) {
    // P2002 = unique violation: the concurrent delivery won. It is recording
    // the same payment and will recompute the same balance, so returning here
    // is correct — retrying would only re-run identical work. Anything else is
    // a real failure and must propagate, so Stripe retries the delivery.
    if (err?.code !== "P2002") throw err;
    return;
  }

  // Recompute from ALL payments — never assume this one charge paid in full. A
  // client can pay a deposit through Stripe; the balance is the source of truth.
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!inv) return;
  const totalPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
  const amountDue = Math.max(0, Number(inv.total) - totalPaid);
  const isPaid = amountDue <= 0.005;
  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: totalPaid,
      amountDue,
      status: isPaid ? "paid" : inv.status,
      paidDate: isPaid ? new Date() : inv.paidDate,
      stripePaymentIntentId: session.payment_intent,
      paidVia: "stripe",
    },
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
      const { invoiceId, bookingId } = session.metadata || {};

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
  }

  return NextResponse.json({ received: true });
}
