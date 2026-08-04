// app/api/stripe/webhook/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

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
      const { invoiceId } = session.metadata || {};
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
