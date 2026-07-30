// app/api/platform/billing/webhook/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { syncSubscriptionFromStripeEvent } from "@/lib/platform/stripeBilling";
import { recordError } from "@/lib/platform/errorLog";

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

  // syncSubscriptionFromStripeEvent throws when a checkout session arrives with
  // no companyId/planId metadata. Unhandled, that became a 500 with no log
  // anywhere — Stripe retried, kept failing, and the company simply never got a
  // Subscription row. The symptom they report is "it says I have no plan"; this
  // is where the cause was invisible.
  //
  // Still returns 500 on failure so Stripe RETRIES (a transient database blip
  // should be retried), but the reason is now in /platform/errors.
  try {
    await syncSubscriptionFromStripeEvent(event);
  } catch (err) {
    await recordError({
      area: "billing-webhook",
      code: event?.type || null,
      message: `Stripe webhook ${event?.type} failed: ${err?.message}`,
      companyId: event?.data?.object?.metadata?.companyId || null,
      detail: { eventId: event?.id, type: event?.type },
    });
    return NextResponse.json(
      { error: "Handler failed", type: event?.type },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
