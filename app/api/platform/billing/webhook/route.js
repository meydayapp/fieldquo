// app/api/platform/billing/webhook/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { syncSubscriptionFromStripeEvent } from "@/lib/platform/stripeBilling";

// Raw body required for Stripe signature verification — Next.js needs the request
// body untouched by JSON parsing before this point.
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_BILLING_WEBHOOK_SECRET,
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 },
    );
  }

  await syncSubscriptionFromStripeEvent(event);

  return NextResponse.json({ received: true });
}
