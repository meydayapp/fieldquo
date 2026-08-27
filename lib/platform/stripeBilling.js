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
// 4. Both checkout builders take an `interval` and share one line builder.
//    They each carried `recurring: { interval: "month" }` as a literal, so the
//    signup page's new "1 year commitment" option would have taken the
//    commitment and billed monthly. The same change moved the trial checkout's
//    recurring line off calculatePricing() and onto the Plan row — see the
//    comment on that line for the seat-ladder signup that was being charged
//    $270 for a card reading $129.
//
// getOrCreateStripeCustomer, cancelSubscription, and
// syncSubscriptionFromStripeEvent are unchanged from your original file.

import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { stripeCurrency } from "@/lib/currency";
import {
  chargeFor,
  DEFAULT_INTERVAL,
  isBillingInterval,
  intervalFromStripeSubscription,
} from "@/lib/billing/interval";
import { markPastDue, clearPastDue } from "@/lib/billing/access";
import { notifySubscriptionState, notifyCancellation } from "@/lib/billing/notify";
import { grantReferrerCredit, applyPendingReferralCredits } from "@/lib/referrals";
import { recordError, errorDetail } from "@/lib/platform/errorLog";

export async function getOrCreateStripeCustomer(company) {
  const existing = await db.subscription.findUnique({
    where: { companyId: company.id },
  });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  // Reuse a customer we created on an earlier, abandoned checkout.
  //
  // This used to create a fresh customer every time and persist NONE of them —
  // only the webhook ever wrote stripeCustomerId. A company that opened checkout
  // three times and paid on the third had three customers in Stripe, and if the
  // webhook never arrived it had three and no record of any. Searching by our own
  // metadata makes the function actually get-or-create rather than always-create.
  try {
    const found = await stripe.customers.search({
      query: `metadata['companyId']:'${company.id}'`,
      limit: 1,
    });
    if (found.data[0]?.id) return found.data[0].id;
  } catch {
    // Customer Search is eventually consistent and can be unavailable on a new
    // account. Falling through to create is correct — a duplicate customer is a
    // tidiness problem, a failed checkout is a revenue problem.
  }

  const customer = await stripe.customers.create({
    name: company.name,
    email: company.email || undefined,
    metadata: { companyId: company.id },
  });

  return customer.id;
}

// ── One line builder, so the two checkouts cannot disagree ────────────────
//
// Both functions below used to carry `recurring: { interval: "month" }` as a
// literal. The signup page now offers a one-year commitment, and an interval
// honoured in one of these and not the other would be worse than neither,
// because the half that works makes the other half look fixed.
//
// Throws rather than falling back. A plan with no annual price cannot be sold
// annually, and quietly billing monthly under an "annual" label is precisely
// the control-that-appears-to-work failure this is here to prevent — better a
// 500 that reaches an error log than a customer on a cadence they didn't pick.
function recurringLine({ plan, interval, currency }) {
  const charge = chargeFor(plan, interval);
  if (!charge) {
    throw new Error(
      `Plan ${plan?.id || "(none)"} cannot be billed on a "${interval}" ` +
        `interval — priceMonthly=${plan?.priceMonthly}, ` +
        `priceAnnual=${plan?.priceAnnual}. The caller must refuse before ` +
        `opening checkout.`,
    );
  }
  return {
    price_data: {
      currency,
      product_data: { name: `FieldQuo — ${plan.name}` },
      unit_amount: charge.unitAmountCents,
      recurring: { interval: charge.interval },
    },
    quantity: 1,
  };
}

export async function createTrialCheckoutSession({
  company,
  // The Plan row the company is buying. The recurring line is built from ITS
  // price, not from calculatePricing() — see the note on the line item below.
  plan,
  pricing,
  // "month" | "year". The signup plan step's own choice, revalidated by
  // /api/companies against the plan's priceAnnual before it gets here.
  interval = DEFAULT_INTERVAL,
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
  // Bill in the company's own currency (derived from their country at signup),
  // not a hardcoded USD — a Canadian company was being charged in US dollars.
  // Derived once and reused across every line item: a Checkout session cannot
  // mix currencies, so both lines must agree.
  const currency = stripeCurrency(company.currency);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      // ── The up-front line, only when there IS one ─────────────────────────
      //
      // The first month is free now (lib/pricing.js), and Stripe REJECTS a
      // one-time line with unit_amount 0 — so this can't just become a $0 line,
      // it has to disappear. Left in place it would fail every checkout with an
      // error about an invalid amount, which reads like a card problem.
      //
      // Kept conditional rather than deleted because the price is config: if the
      // owner reintroduces a paid first month, this comes back on its own.
      // ── …and never on an annual plan ──────────────────────────────────
      //
      // A separate "first month" charge in front of a twelve-month prepay is
      // not the same offer and would need its own decision. On both cadences
      // the free first month IS the Stripe trial below: no charge for the trial
      // days, then the full monthly or annual amount. So an annual signup gets
      // its free month before the year begins, and nothing about the year's
      // price is discounted — the interval is the only thing that changed.
      ...(pricing.trialTotal > 0 && interval === "month"
        ? [
            {
              // One-time — charged today, not part of the trial
              price_data: {
                currency,
                product_data: { name: "FieldQuo — First Month" },
                unit_amount: Math.round(pricing.trialTotal * 100),
              },
              quantity: 1,
            },
          ]
        : []),
      // ── The recurring line, priced from the PLAN ──────────────────────────
      //
      // This was `unit_amount: pricing.perLicense * 100` with
      // `quantity: employeeCount`, from calculatePricing() — the old
      // per-headcount ladder. That was right when every plan's price WAS
      // calculatePricing(maxUsers), which is still true of the legacy rows and
      // of every bespoke Custom row, so those bill to the identical cent.
      //
      // It stopped being true for the seat ladder, where a tier is a flat price
      // and maxUsers is seats + free crew: Solo shows CA$129 for 1 seat and 5
      // crew, calculatePricing(6) says 6 x $45, and the company was being
      // charged $270 for the card that said $129. The row the visitor clicked
      // is the price they agreed to, and it is also the row Subscription.planId
      // points at, so it is the only defensible source.
      recurringLine({ plan, interval, currency }),
    ],
    subscription_data: {
      trial_period_days: Math.max(1, Math.round(trialDays)),
      metadata: {
        companyId: company.id,
        employeeCount: String(pricing.employeeCount),
        // What they actually bought. Stripe is the authority on the cadence and
        // there is no column for it on Subscription, so this is what a support
        // conversation reads to answer "did they commit to a year?".
        billingInterval: interval,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    // planId is what checkout.session.completed reads (via obj.metadata,
    // below) to create the Subscription row — must always be a real
    // Plan.id by the time this is called. See app/api/companies/route.js
    // for how it gets resolved, including find-or-create for custom
    // employee counts.
    metadata: { companyId: company.id, planId: plan.id, billingInterval: interval },
  });
}

export async function createBillingCheckoutSession({
  company,
  plan,
  // Same cadence contract as the trial checkout above. Account & Billing now
  // sends one — its "Choose plan" cards carry the monthly/yearly control and
  // preselect what the company is already on, because defaulting an annual
  // company to monthly on an upgrade quietly took their two free months away.
  // The Team page's "Add licenses" flow still sends nothing and gets monthly,
  // which is the only cadence a bespoke Custom row has.
  interval = DEFAULT_INTERVAL,
  // Optional. When a company upgrades mid-trial, the remaining free days ride
  // onto the new subscription so "free during the trial, applies after" holds
  // (see app/api/platform/billing/checkout/route.js). Omitted for an
  // already-paying company, which then bills on the normal cycle.
  trialDays,
  successUrl,
  cancelUrl,
}) {
  const customerId = await getOrCreateStripeCustomer(company);
  const currency = stripeCurrency(company.currency);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [recurringLine({ plan, interval, currency })],
    // Only set trial data when there are days to grant — Stripe rejects a
    // trial_period_days of 0, and an already-paying upgrade has none.
    ...(trialDays > 0
      ? {
          subscription_data: {
            trial_period_days: Math.max(1, Math.round(trialDays)),
          },
        }
      : {}),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { companyId: company.id, planId: plan.id, billingInterval: interval },
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
    // A credited company still being billed is exactly the kind of silent
    // money bug that has to reach a human.
    await recordError({
      area: "stripe",
      code: "trial_extend_failed",
      message: `Earned free months were recorded but Stripe was not updated: ${err?.message || "unknown"}`,
      companyId,
      detail: errorDetail(err),
    });
    return { synced: false, reason: "stripe_error", error: err?.message };
  }
}

// Shared by the webhook (syncSubscriptionFromStripeEvent) and the reconciliation
// fallback (reconcileCheckoutSession, below) — both end up with a Stripe
// Checkout Session object and need to write the exact same Subscription row.
// Keeping this in one place means "webhook never arrived" and "webhook
// arrived twice" both converge on the same idempotent upsert.
/**
 * Marks a failure that RETRYING CANNOT FIX.
 *
 * The webhook returns 500 on error so Stripe retries, which is right for a
 * database blip. It is wrong for a session whose metadata is absent: that
 * session will never gain metadata, so every retry fails identically and
 * Stripe keeps knocking. Nine of the fourteen errors in the production queue
 * were this — the same three sessions, retried, clustering seconds apart.
 *
 * The caller checks for this flag and answers 200: the event is recorded, and
 * we are telling Stripe there is nothing more to deliver.
 */
export class PermanentWebhookFailure extends Error {
  constructor(message) {
    super(message);
    this.name = "PermanentWebhookFailure";
    this.permanent = true;
  }
}

/**
 * Recover the company a checkout session belongs to when metadata is missing.
 *
 * Three fallbacks, most reliable first. Every one of them is information
 * Stripe already holds — none of this guesses.
 *
 *   client_reference_id  what Checkout is designed for; free to set and
 *                        survives a session created before metadata existed
 *   customer             we wrote stripeCustomerId when we created them
 *   customer_email       last resort, matched against the company owner
 *
 * Returns null when none of them resolve, which is the genuinely unrecoverable
 * case and the only one that should give up.
 */
async function recoverCompanyId(session) {
  const ref = session?.client_reference_id;
  if (ref) {
    const byRef = await db.company.findUnique({
      where: { id: ref },
      select: { id: true },
    });
    if (byRef) return byRef.id;
  }

  const customer =
    typeof session?.customer === "string"
      ? session.customer
      : session?.customer?.id;
  if (customer) {
    const byCustomer = await db.company.findFirst({
      where: { stripeCustomerId: customer },
      select: { id: true },
    });
    if (byCustomer) return byCustomer.id;
  }

  return null;
}

/**
 * Recover the plan when metadata is missing, from what Stripe actually
 * charged.
 *
 * Matched on the Stripe price id, which is the only thing that ties a payment
 * to a plan without trusting our own metadata. Returns null rather than
 * guessing a plan — attaching a company to the WRONG plan is worse than
 * attaching them to none, because the wrong one bills.
 */
async function recoverPlanId(session) {
  const priceId =
    session?.line_items?.data?.[0]?.price?.id ||
    session?.metadata?.stripePriceId ||
    null;
  if (!priceId) return null;

  const plan = await db.plan.findFirst({
    where: { stripePriceId: priceId },
    select: { id: true },
  });
  return plan?.id || null;
}

export async function upsertSubscriptionFromCheckoutSession(session) {
  let { companyId, planId } = session.metadata || {};

  // ── Recovery before refusal ──────────────────────────────────────────────
  //
  // This used to throw the moment metadata was absent. In production that
  // meant a customer's card was charged, Stripe held the money, and FieldQuo
  // had no record — the worst-feeling failure in the product — while the
  // information needed to fix it was sitting on the session the whole time.
  if (!companyId) companyId = await recoverCompanyId(session);
  if (!planId) planId = await recoverPlanId(session);

  if (!companyId || !planId) {
    throw new PermanentWebhookFailure(
      "Checkout session is missing companyId/planId metadata and could not be " +
        "recovered from client_reference_id, the Stripe customer or the price. " +
        "A payment may have succeeded with no Subscription row — reconcile " +
        "against Stripe.",
    );
  }

  // The cadence they just bought. It was already on the session — we put it
  // there — and it was read by nothing, so a one-year commitment was recorded
  // only inside Stripe and every screen here assumed monthly.
  //
  // Omitted rather than defaulted when the metadata is absent or malformed: an
  // older session has no such key, and writing "month" over a real yearly
  // subscription would take two paid-for months away. The
  // customer.subscription.updated event that follows carries the live price and
  // corrects it either way.
  const boughtInterval = isBillingInterval(session.metadata?.billingInterval)
    ? session.metadata.billingInterval
    : undefined;

  const subscription = await db.subscription.upsert({
    where: { companyId },
    update: {
      planId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      status: "active",
      ...(boughtInterval ? { billingInterval: boughtInterval } : {}),
    },
    create: {
      companyId,
      planId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      status: "active",
      ...(boughtInterval ? { billingInterval: boughtInterval } : {}),
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
      const sub = await upsertSubscriptionFromCheckoutSession(obj);
      // Idempotent — see lib/billing/notify.js. Both this and the on-return
      // reconcile call it, and whichever gets there first sends.
      await notifySubscriptionState(sub.companyId);
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
          // The cadence Stripe is actually charging on. This is the authority
          // rather than the checkout metadata, because a customer can switch
          // cadence in the Stripe portal without the change passing through
          // this app at all. Undefined when the object doesn't say — leaving
          // what we hold beats guessing "month" at somebody on the year.
          ...(intervalFromStripeSubscription(obj)
            ? { billingInterval: intervalFromStripeSubscription(obj) }
            : {}),
        },
      });

      // ── The 7-day grace clock ──────────────────────────────────────────
      //
      // Stripe flips a subscription to past_due when a renewal fails, and back
      // to active when it's fixed. That status alone isn't enough: the grace
      // period needs to know WHEN it went wrong, and `updatedAt` can't answer
      // that — any unrelated write touches it, so a grace period measured from
      // it would restart on every webhook and the account would never lock.
      //
      // markPastDue is idempotent on pastDueSince for the same reason: Stripe
      // sends subscription.updated repeatedly while an account is overdue.
      {
        const row = await db.subscription.findFirst({
          where: { stripeSubscriptionId: obj.id },
          select: { companyId: true },
        });
        if (row?.companyId) {
          if (obj.status === "past_due" || obj.status === "unpaid") {
            await markPastDue(row.companyId);
          } else if (obj.status === "active" || obj.status === "trialing") {
            // Paid. Clear the clock so a LATER failure gets a fresh 7 days
            // rather than inheriting an old one and locking immediately.
            await clearPastDue(row.companyId);
          }
        }
      }
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
    // Arrives BEFORE the subscription status flips to past_due, sometimes by
    // hours. Starting the clock here means the warning banner and the countdown
    // are honest from the moment the charge actually failed.
    case "invoice.payment_failed": {
      const row = await db.subscription.findFirst({
        where: { stripeCustomerId: obj.customer },
        select: { companyId: true },
      });
      if (row?.companyId) await markPastDue(row.companyId);
      break;
    }

    case "invoice.payment_succeeded": {
      {
        // Cleared here as well as on subscription.updated: a customer paying a
        // failed invoice by hand from the billing portal doesn't always produce
        // a status change event, and an account that stays read-only after
        // paying is the worst possible outcome of this whole feature.
        const paid = await db.subscription.findFirst({
          where: { stripeCustomerId: obj.customer },
          select: { companyId: true },
        });
        if (paid?.companyId) await clearPastDue(paid.companyId);
      }

      if (
        obj.billing_reason === "subscription_create" ||
        obj.billing_reason === "subscription_cycle"
      ) {
        const subscription = await db.subscription.findFirst({
          where: { stripeCustomerId: obj.customer },
          select: { companyId: true },
        });
        if (subscription?.companyId) {
          // Reward the referrer with a dollar account credit = one month of the
          // referred company's plan (= this invoice's amount). Applied straight
          // to the referrer's Stripe balance inside grantReferrerCredit; no trial
          // extension is involved anymore.
          const granted = await grantReferrerCredit({
            paidCompanyId: subscription.companyId,
            paidAmountCents: obj.amount_paid,
            currency: obj.currency,
          });
          if (granted) {
            console.log(
              `[referrals] credited referrer ${granted.referrerId} ${(granted.creditCents / 100).toFixed(2)} ${obj.currency} for ${granted.referredName}`,
            );
          }
          // The paying company may itself be a referrer that earned credit before
          // it had a Stripe customer — apply any pending credits now that it does.
          await applyPendingReferralCredits(subscription.companyId);
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
        data: {
          status: "canceled",
          // Starts the 30-day read-only window (lib/billing/access.js). Stamped
          // from STRIPE's own timestamp where it has one, not from now: this
          // webhook can arrive late or be replayed, and a replay months later
          // would otherwise restart the window and hand a churned account
          // another month of access.
          canceledAt: obj.canceled_at ? new Date(obj.canceled_at * 1000) : new Date(),
          // The failed-payment clock is a different situation and must not
          // survive into a cancellation — leaving it set would make the two
          // windows fight over which message the company sees.
          pastDueSince: null,
        },
      });
      if (sub) {
        await db.company.update({
          where: { id: sub.companyId },
          data: { onboardingStatus: "churned" },
        });
        // Stripe is the authority on cancellation whether it came from our own
        // Cancel button, the customer portal, or a failed-payment lifecycle —
        // all three land here, which is why the confirmation goes out from here
        // rather than from the cancel route.
        await notifyCancellation(sub.companyId, null, {
          periodEnd: obj.current_period_end
            ? new Date(obj.current_period_end * 1000)
            : null,
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
