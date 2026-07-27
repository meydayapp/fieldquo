// lib/platform/stripeBilling.js
//
// Changes vs. your original file:
//
// 1. createTrialCheckoutSession() now accepts and sets `planId` in the
//    checkout session's metadata. This was the bug behind "Account &
//    Billing shows no active plan" — the signup flow's checkout session
//    never included planId, so when the checkout.session.completed webhook
//    (syncSubscriptionFromStripeEvent, below) tried to create the
//    Subscription row, `obj.metadata.planId` was undefined — and
//    Subscription.planId is a required field, so that write never produced
//    a row. See app/api/companies/route.js for the other half of this fix.
//
// 2. createBillingCheckoutSession() no longer requires plan.stripePriceId.
//    It now builds price_data inline from plan.priceMonthly, the same way
//    createTrialCheckoutSession already does from calculatePricing(). Your
//    seed-plans.js never sets stripePriceId, and any "Custom (N employees)"
//    Plan row created at signup for a non-named tier never gets one either
//    — so requiring it meant "Choose Plan" was 500ing for every plan, for
//    every company, permanently for custom-tier companies. This removes
//    that dependency entirely instead of patching it with a Stripe catalog
//    you'd have to keep in sync by hand.
//
// 3. createBillingPortalSession() — new, added for the Account & Billing
//    page's "Manage billing" button.
//
// getOrCreateStripeCustomer, cancelSubscription, and
// syncSubscriptionFromStripeEvent are unchanged from your original file.

import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export async function getOrCreateStripeCustomer(company) {
  const existing = await db.subscription.findUnique({
    where: { companyId: company.id },
  });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await stripe.customers.create({
    name: company.name,
    email: company.email || undefined,
    metadata: { companyId: company.id },
  });

  return customer.id;
}

export async function createTrialCheckoutSession({
  company,
  pricing,
  planId,
  successUrl,
  cancelUrl,
}) {
  const customerId = await getOrCreateStripeCustomer(company);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        // One-time — charged today, not part of the trial
        price_data: {
          currency: "usd",
          product_data: { name: "FieldQuo — First Month" },
          unit_amount: Math.round(pricing.trialTotal * 100),
        },
        quantity: 1,
      },
      {
        // Recurring — sits in trial for 30 days, then bills automatically
        price_data: {
          currency: "usd",
          product_data: {
            name: `FieldQuo — ${pricing.employeeCount} employee license${pricing.employeeCount > 1 ? "s" : ""}`,
          },
          unit_amount: Math.round(pricing.perLicense * 100),
          recurring: { interval: "month" },
        },
        quantity: pricing.employeeCount,
      },
    ],
    subscription_data: {
      trial_period_days: 30,
      metadata: {
        companyId: company.id,
        employeeCount: String(pricing.employeeCount),
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    // planId is what checkout.session.completed reads (via obj.metadata,
    // below) to create the Subscription row — must always be a real
    // Plan.id by the time this is called. See app/api/companies/route.js
    // for how it gets resolved, including find-or-create for custom
    // employee counts.
    metadata: { companyId: company.id, planId },
  });
}

export async function createBillingCheckoutSession({
  company,
  plan,
  successUrl,
  cancelUrl,
}) {
  const customerId = await getOrCreateStripeCustomer(company);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `FieldQuo — ${plan.name}` },
          unit_amount: Math.round(Number(plan.priceMonthly) * 100),
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { companyId: company.id, planId: plan.id },
  });
}

export async function cancelSubscription(stripeSubscriptionId) {
  return stripe.subscriptions.cancel(stripeSubscriptionId);
}

// Shared by the webhook (syncSubscriptionFromStripeEvent) and the reconciliation
// fallback (reconcileCheckoutSession, below) — both end up with a Stripe
// Checkout Session object and need to write the exact same Subscription row.
// Keeping this in one place means "webhook never arrived" and "webhook
// arrived twice" both converge on the same idempotent upsert.
async function upsertSubscriptionFromCheckoutSession(session) {
  const { companyId, planId } = session.metadata || {};
  if (!companyId || !planId) {
    throw new Error(
      "Checkout session is missing companyId/planId metadata — cannot create Subscription",
    );
  }

  const subscription = await db.subscription.upsert({
    where: { companyId },
    update: {
      planId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      status: "active",
    },
    create: {
      companyId,
      planId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      status: "active",
    },
  });

  await db.company.update({
    where: { id: companyId },
    data: { onboardingStatus: "active" },
  });

  return subscription;
}

// Called from app/api/platform/billing/webhook/route.js — keeps the Subscription
// table in sync with what Stripe actually thinks is true.
export async function syncSubscriptionFromStripeEvent(event) {
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      await upsertSubscriptionFromCheckoutSession(obj);
      break;
    }
    case "customer.subscription.updated": {
      await db.subscription.updateMany({
        where: { stripeSubscriptionId: obj.id },
        data: {
          status: obj.status,
          currentPeriodEnd: new Date(obj.current_period_end * 1000),
        },
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = await db.subscription.findFirst({
        where: { stripeSubscriptionId: obj.id },
      });
      await db.subscription.updateMany({
        where: { stripeSubscriptionId: obj.id },
        data: { status: "canceled" },
      });
      if (sub) {
        await db.company.update({
          where: { id: sub.companyId },
          data: { onboardingStatus: "churned" },
        });
      }
      break;
    }
  }
}

// New — Stripe's own hosted billing portal, for the company to update their
// card, view invoices, and change/cancel their subscription without you
// building any of that UI. Requires a stripeCustomerId to already exist
// (i.e., they've been through checkout at least once).
export async function createBillingPortalSession({
  stripeCustomerId,
  returnUrl,
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return session.url;
}

// Safety net for when checkout.session.completed never reaches the billing
// webhook — misconfigured local `stripe listen` forwarding, a dropped event,
// endpoint downtime, whatever. The Stripe Checkout success redirect includes
// the session id (see successUrl in app/api/companies/route.js), and the /app
// page calls this via /api/platform/billing/reconcile-session on landing so
// the Subscription row exists immediately, without waiting on (or requiring)
// the webhook. Idempotent — reuses the same upsert the webhook itself runs,
// so it's harmless if the webhook also fires for the same session.
//
// companyId is passed in from the authenticated member's own session (never
// trusted from the client) and checked against the session's own metadata,
// so one company can't use this to pull another company's Stripe session.
export async function reconcileCheckoutSession(sessionId, companyId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.metadata?.companyId !== companyId) {
    throw new Error("This checkout session does not belong to your company");
  }

  if (session.status !== "complete" || session.payment_status === "unpaid") {
    // Not actually finished yet (e.g. still processing) — nothing to write.
    // The webhook (or a later reconcile call) will pick it up once it is.
    return null;
  }

  return upsertSubscriptionFromCheckoutSession(session);
}
