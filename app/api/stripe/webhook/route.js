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
      const { invoiceId } = session.metadata;
      if (invoiceId) {
        await db.payment.create({
          data: {
            invoiceId,
            amount: session.amount_total / 100,
            method: "stripe",
            stripePaymentIntentId: session.payment_intent,
          },
        });
        await db.invoice.update({
          where: { id: invoiceId },
          data: {
            status: "paid",
            stripePaymentIntentId: session.payment_intent,
            paidVia: "stripe",
          },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
