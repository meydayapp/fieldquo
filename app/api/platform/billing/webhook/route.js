// app/api/platform/billing/webhook/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { syncSubscriptionFromStripeEvent } from "@/lib/platform/stripeBilling";
import { settleCheckoutSession } from "@/lib/stripe/settleCheckoutSession";
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

  // ── Not every completed session here is a subscription ────────────────────
  //
  // This is the PLATFORM endpoint, and every payment FieldQuo takes on a
  // contractor's behalf is a destination charge created on the platform account
  // (lib/stripe.js, `{ stripeAccount: undefined }`). So booking visit fees and
  // invoice payments land HERE, not on the Connect endpoint that was written to
  // handle them — and this handler used to read every one of them as a failed
  // subscription sync. A real $50 visit fee was taken, logged as
  // "a payment may have succeeded with no Subscription row", answered 200, and
  // the booking held a slot for ever with no record of the money.
  //
  // So: place the session first, and only fall through to the subscription
  // handler when it is genuinely not one of the client-facing payments. This
  // does NOT merge the two webhooks — separate endpoints, separate secrets, as
  // before. It stops each one assuming which kind of session Stripe will hand
  // it, because that assumption is not ours to make.
  if (event.type === "checkout.session.completed") {
    try {
      const { handled, kind } = await settleCheckoutSession(event.data.object);
      if (handled) {
        return NextResponse.json({ received: true, settled: kind });
      }
    } catch (err) {
      // A settlement that failed IS worth retrying — the money is real and the
      // booking or invoice is still waiting on it. 500 asks Stripe to redeliver;
      // the hourly reconciler is the backstop if it never does.
      await recordError({
        area: "billing-webhook",
        code: "settle_checkout_session",
        message: `Settling checkout session failed: ${err?.message}`,
        companyId: event?.data?.object?.metadata?.companyId || null,
        detail: {
          eventId: event?.id,
          sessionId: event?.data?.object?.id || null,
          metadata: event?.data?.object?.metadata || null,
          needsManualReconciliation: true,
        },
      });
      return NextResponse.json({ error: "Settlement failed" }, { status: 500 });
    }
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
    // A session whose company cannot be recovered will never become
    // recoverable, so a 500 just asks Stripe to fail again on a schedule.
    // Nine of the fourteen errors in the production queue were three sessions
    // being retried, clustering seconds apart and burying the four genuinely
    // distinct failures underneath them.
    //
    // Permanent → record it once and answer 200: we are telling Stripe there
    // is nothing left to deliver, not that everything is fine. The row in
    // /platform/errors is the thing that says otherwise, and it says a payment
    // may need reconciling by hand.
    const permanent = err?.permanent === true;

    await recordError({
      area: "billing-webhook",
      code: event?.type || null,
      message: `Stripe webhook ${event?.type} failed: ${err?.message}`,
      companyId: event?.data?.object?.metadata?.companyId || null,
      detail: {
        eventId: event?.id,
        type: event?.type,
        permanent,
        // Kept so whoever works the queue can find the payment in Stripe
        // without going back through the event log.
        stripeCustomer:
          typeof event?.data?.object?.customer === "string"
            ? event.data.object.customer
            : null,
        clientReferenceId: event?.data?.object?.client_reference_id || null,
        needsManualReconciliation: permanent,
      },
    });

    if (permanent) {
      return NextResponse.json(
        { received: true, unrecoverable: true, type: event?.type },
        { status: 200 },
      );
    }

    // Transient — a database blip, a timeout. Stripe should try again.
    return NextResponse.json(
      { error: "Handler failed", type: event?.type },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
