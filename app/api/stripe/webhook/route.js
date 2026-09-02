// app/api/stripe/webhook/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { earnMilestone, MILESTONES } from "@/lib/sales/commission";
import { recordStripePayment } from "@/lib/invoices/recordStripePayment";
import { settleOccurrenceFromIntent } from "@/lib/servicePlans/run";
import { settleCheckoutSession } from "@/lib/stripe/settleCheckoutSession";
import { settleChargeEvent } from "@/lib/stripe/settleChargeEvent";

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

// FieldQuo's Connect-integration webhook: its own endpoint and its own signing
// secret, distinct from the Billing webhook.
//
// The name is a trap, and it cost five bookings. STRIPE_CONNECT_WEBHOOK_SECRET
// is named for the Connect *integration*, not for connected-account *events* —
// but if this endpoint is registered in the Stripe dashboard as a "Connect"
// endpoint, it receives events from connected accounts ONLY. Every payment
// FieldQuo takes on a client's behalf is a DESTINATION charge created on the
// PLATFORM account (lib/stripe.js, `{ stripeAccount: undefined }`), so those
// events are platform events and never reach a Connect endpoint at all.
//
// The two routes are still separate endpoints with separate secrets — that part
// was always right. What changed is that neither of them assumes which kind of
// session it will be handed: both dispatch through settleCheckoutSession, which
// routes on metadata. See lib/stripe/settleCheckoutSession.js for the full
// story.
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

      // ── Sales milestone 1 ───────────────────────────────────────────────
      //
      // This is the moment a contractor becomes able to take a homeowner's
      // money, and it is the ONLY condition on the activation milestone. Not
      // "onboarding complete": lib/onboarding.js's team step is seatsUsed > 1
      // and complete requires every step, so before Company.worksAloneAt
      // existed a one-person shop could never satisfy it — and a van-run solo
      // operator is a core FieldQuo customer, so that gate would have paid
      // nothing on an entire class of legitimate sale.
      //
      // Read AFTER the update above rather than from account.charges_enabled
      // directly, so the milestone and the column can never disagree: one
      // read of one row is the single source of truth for both.
      //
      // earnMilestone is a no-op for a company no rep brought in, which is
      // every company that existed before the sales portal. That is a
      // permanent, correct state, not a gap.
      if (account.charges_enabled) {
        const company = await db.company.findFirst({
          where: { stripeAccountId: account.id },
          select: { id: true, stripeChargesEnabled: true },
        });
        if (company?.stripeChargesEnabled) {
          await earnMilestone({
            companyId: company.id,
            milestone: MILESTONES.ACTIVATION,
            stripeEventId: event.id,
            // Stripe's own second-precision timestamp, never new Date(), so a
            // replay months later cannot move when this happened — the same
            // discipline canceledAt already follows.
            occurredAt: event.created ? new Date(event.created * 1000) : null,
          }).catch((err) => {
            // A commission must never break the webhook that keeps
            // stripeChargesEnabled in sync. Losing that column is a broken
            // product; losing a commission row is a reconcilable bookkeeping
            // miss, and the nightly sweep re-checks anyway.
            console.error("[sales] activation milestone failed:", err?.message);
          });
        }
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object;

      // Booking fee, invoice payment or service-plan authorisation — whichever
      // it is, one shared settler decides, and every branch is idempotent.
      const { handled } = await settleCheckoutSession(session);
      if (!handled) {
        // A subscription checkout reaching the Connect endpoint would mean the
        // dashboard routing is inverted. Say so rather than dropping it: silence
        // here is what made the original bug invisible for five bookings.
        console.warn(
          "[stripe] unrecognised checkout session on the Connect endpoint:",
          session.id,
          JSON.stringify(session.metadata || {}),
        );
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

    // A refund or a chargeback — see lib/stripe/settleChargeEvent.js's header
    // for why this dispatches the same way checkout.session.completed does
    // above rather than assuming which endpoint Stripe delivers it to.
    case "charge.refunded":
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed": {
      await settleChargeEvent(event);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
