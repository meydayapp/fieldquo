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
import { grantReferrerCredit } from "@/lib/referrals";

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
  // How many free days Stripe should grant before the first real charge.
  // Was hardcoded to 30 below, which meant a company arriving with referral
  // months already earned still only got 30 free days in Stripe — the extra
  // months lived in a DB column Stripe never read. The caller now computes
  // this from the company's post-referral trialEndsAt.
  trialDays = 30,
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
      trial_period_days: Math.max(1, Math.round(trialDays)),
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

// The bridge that was missing: push Company.trialEndsAt — the source of truth
// for "how long is this company free", the column referral grants bump — onto
// the Stripe subscription's trial_end, so Stripe actually stops billing until
// then. Without this, earned free months lived only in the database and Stripe
// charged the card in full when its own fixed 30-day trial lapsed.
//
// Works on a trialing OR an already-paying subscription: setting trial_end to a
// future date puts an active subscription back into trial (Stripe's supported
// way to comp time), so a referrer who's already paying still gets their months.
//
// Best-effort by contract. It's called from the billing webhook after a grant
// that's already committed to the DB — a Stripe hiccup here must not throw (that
// would make Stripe retry the whole event) and must not lose the grant. On
// failure it logs and returns a reason; the DB record stands and can be
// reconciled. proration_behavior:"none" so comping time never generates a
// charge or credit.
export async function syncStripeTrialEnd(companyId) {
  try {
    const [company, sub] = await Promise.all([
      db.company.findUnique({ where: { id: companyId }, select: { trialEndsAt: true } }),
      db.subscription.findUnique({
        where: { companyId },
        select: { stripeSubscriptionId: true, status: true },
      }),
    ]);

    if (!sub?.stripeSubscriptionId) return { synced: false, reason: "no_subscription" };
    if (sub.status === "canceled") return { synced: false, reason: "canceled" };

    const end = company?.trialEndsAt;
    if (!end || end.getTime() <= Date.now()) {
      return { synced: false, reason: "no_future_trial" };
    }

    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      trial_end: Math.floor(end.getTime() / 1000),
      proration_behavior: "none",
    });
    return { synced: true, trialEnd: end };
  } catch (err) {
    console.error(`[billing] syncStripeTrialEnd failed for ${companyId}:`, err?.message);
    return { synced: false, reason: "stripe_error", error: err?.message };
  }
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
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await db.subscription.updateMany({
        where: { stripeSubscriptionId: obj.id },
        data: {
          status: obj.status,
          currentPeriodEnd: obj.current_period_end
            ? new Date(obj.current_period_end * 1000)
            : undefined,
          // Fixes the dead-column bug: the trial countdown UI reads
          // Subscription.trialEndsAt, which nothing ever wrote. Stripe's
          // trial_end is authoritative — and after syncStripeTrialEnd pushes
          // referral months onto it, this is where the extended date lands so
          // the company actually sees the free months they earned. null once
          // the trial is over and they're paying.
          trialEndsAt: obj.trial_end ? new Date(obj.trial_end * 1000) : null,
        },
      });
      break;
    }
    // The referrer's three months are paid HERE, not at the referred
    // company's signup. This is the first event that proves real money
    // changed hands — granting on signup would make the programme a fraud
    // target, since twenty throwaway addresses would earn five free years.
    //
    // `billing_reason` distinguishes the first invoice from every monthly
    // renewal after it. grantReferrerCredit is idempotent regardless (unique
    // on companyId+role+counterparty), so a Stripe retry is a no-op.
    case "invoice.payment_succeeded": {
      if (
        obj.billing_reason === "subscription_create" ||
        obj.billing_reason === "subscription_cycle"
      ) {
        const subscription = await db.subscription.findFirst({
          where: { stripeCustomerId: obj.customer },
          select: { companyId: true },
        });
        if (subscription?.companyId) {
          const granted = await grantReferrerCredit({
            paidCompanyId: subscription.companyId,
          });
          if (granted) {
            console.log(
              `[referrals] granted 3 months to ${granted.referrerId} for ${granted.referredName}`,
            );
            // The grant bumped the referrer's Company.trialEndsAt in the DB.
            // Push it to their Stripe subscription so they are ACTUALLY not
            // charged for those months — without this the reward is cosmetic.
            const sync = await syncStripeTrialEnd(granted.referrerId);
            if (!sync.synced) {
              console.warn(
                `[referrals] referrer ${granted.referrerId} credited in DB but Stripe trial not extended: ${sync.reason}`,
              );
            }
          }
        }
      }
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
