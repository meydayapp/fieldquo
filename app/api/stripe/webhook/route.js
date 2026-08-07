// app/api/stripe/webhook/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { finalizeBooking } from "@/lib/booking/finalizeBooking";

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

      if (invoiceId) {
        await db.payment.create({
          data: {
            invoiceId,
            amount: (session.amount_total || 0) / 100,
            method: "stripe",
            stripePaymentIntentId: session.payment_intent,
          },
        });

        // Recompute the balance from ALL payments — the same way the manual
        // path (app/api/payments) does — instead of assuming this one charge
        // paid the invoice in full. A client can pay a DEPOSIT through Stripe:
        // the old code left amountPaid stale (so a "paid" invoice still showed
        // its full balance owing) and marked a partial payment as paid in full.
        const inv = await db.invoice.findUnique({
          where: { id: invoiceId },
          include: { payments: true },
        });
        if (inv) {
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
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
