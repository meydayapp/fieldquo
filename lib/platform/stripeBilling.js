// lib/platform/stripeBilling.js
// FieldQuo's OWN Stripe subscriptions — you charging companies. Uses the same Stripe
// secret key as lib/stripe.js (it's one Stripe account), but never touches Connect
// concepts (connected accounts, transfer_data, destination charges). Keeping this file
// separate is the guardrail against accidentally billing through a company's connected
// account instead of your own.

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

export async function createBillingCheckoutSession({
  company,
  plan,
  successUrl,
  cancelUrl,
}) {
  if (!plan.stripePriceId) {
    throw new Error(`Plan "${plan.name}" has no stripePriceId configured`);
  }

  const customerId = await getOrCreateStripeCustomer(company);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { companyId: company.id, planId: plan.id },
  });
}

export async function cancelSubscription(stripeSubscriptionId) {
  return stripe.subscriptions.cancel(stripeSubscriptionId);
}

// Called from app/api/platform/billing/webhook/route.js — keeps the Subscription
// table in sync with what Stripe actually thinks is true.
export async function syncSubscriptionFromStripeEvent(event) {
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const { companyId, planId } = obj.metadata;
      await db.subscription.upsert({
        where: { companyId },
        update: {
          planId,
          stripeCustomerId: obj.customer,
          stripeSubscriptionId: obj.subscription,
          status: "active",
        },
        create: {
          companyId,
          planId,
          stripeCustomerId: obj.customer,
          stripeSubscriptionId: obj.subscription,
          status: "active",
        },
      });
      await db.company.update({
        where: { id: companyId },
        data: { onboardingStatus: "active" },
      });
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
