// lib/billing/resume.js
//
// "Resume" — one button that puts a cancelled or ending subscription back,
// without a Stripe Checkout when Stripe already has everything it needs.
//
// ══ Why this exists ═════════════════════════════════════════════════════════
//
// 2026-09-14, 07:15 and 07:17 UTC: the owner, on his own cancelled $1 live-test
// plan, pressed the banner's "Start again" twice. It was a link to the page he
// was already on. "No window, no pop up." Asked what he wanted, he said:
// "resume current (remaining balance on the month)" — not a new checkout, not
// a new trial, the plan he had, with the time he had paid for.
//
// ══ The four outcomes, decided once ═════════════════════════════════════════
//
// `resumeDecision` is pure and is the whole rule; the route and the two
// screens (the banner, Account & Billing) all ask it, so the sentence on the
// button and the thing that happens cannot disagree. scripts/check-billing-
// resume.mjs executes it over every state rather than grepping this file.
//
//   uncancel     the subscription is live with a cancellation booked for the
//                period end (cancel/route.js does this for a PAYING plan).
//                Stripe: update({ cancel_at_period_end: false }). Nothing is
//                charged, nothing changes; the plan simply continues.
//
//   credited     the subscription is `canceled` at Stripe and the period the
//                company PAID for has not ended. Stripe cannot un-cancel a
//                cancelled subscription — "A canceled subscription can only
//                update its cancellation_details and metadata" — so a NEW one
//                is created on the same price, for the same customer, with
//                `trial_end` = the old period end. The paid weeks are honoured
//                and nothing is charged until the date they had already paid
//                to. (This is Stripe's "trial" mechanism carrying a credit,
//                the same device lib/referrals/extendAccess.js uses for a
//                referral month; it is not a free trial in the owner's sense
//                and lib/billing/trialOnce.js is not consulted.)
//
//   charge_now   the subscription is `canceled` and there is no paid time left:
//                it was cancelled DURING the trial (Test Inc., 2026-09-13), or
//                the paid period has since run out. The owner's rule: one free
//                trial, ever — so the new subscription has NO trial and the
//                first invoice is charged today, with `error_if_incomplete` so
//                a declined card fails the call rather than minting an unpaid
//                subscription. The button says the amount before it is pressed.
//
//   checkout     everything else: no card on file at Stripe, no subscription
//                to resume, a price that has changed since, or a Stripe refusal
//                (tax location, decline). The existing Checkout is opened for
//                the same plan and cadence — with trialDaysAllowed() deciding
//                the trial, which is 0 for a company that has had one.
//
//   retired      the plan has been retired (Plan.retiredAt — the owner's own
//                "Live test — $1", 2026-09-14) and the subscription is NOT
//                live. Credited, charge_now and checkout all CREATE a new
//                Stripe subscription on that plan, which is selling it again;
//                none of them is offered, and the route answers 409 with the
//                same sentence every sell path uses. Uncancel is unaffected:
//                an ending subscription on a retired plan is an existing one
//                continuing, which is exactly what retirement keeps.
//
// Nothing here deletes anything, and the old cancelled subscription is left
// exactly as Stripe holds it — it is the record of what was paid.
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { writeSubscriptionFromStripe } from "@/lib/platform/stripeSync";
import { createBillingCheckoutSession } from "@/lib/platform/stripeBilling";
import { isCanceledSubscriptionError, subscriptionFieldsFromStripe } from "@/lib/billing/subscriptionFields";
import { chargeFor, isBillingInterval, DEFAULT_INTERVAL } from "@/lib/billing/interval";
import { stripeCurrency } from "@/lib/currency";
import { trialDaysAllowed } from "@/lib/billing/trialOnce";
import { recordError } from "@/lib/platform/errorLog";
import { isRetired, RETIRED_PLAN_ERROR } from "@/lib/platform/sellablePlans";

const LIVE = new Set(["active", "trialing", "past_due"]);

/**
 * A `trial_end` closer than this to "now" is treated as already elapsed.
 * Stripe refuses a trial_end in the past, and a request that takes a few
 * seconds to reach it must not fail on the minute the period ends.
 */
export const CREDIT_MIN_MS = 60 * 60 * 1000;

const at = (v) => (v instanceof Date ? v : v ? new Date(v) : null);

/** The one decision a retired plan gets for anything but un-cancel. */
const RETIRED = Object.freeze({ mode: "retired", reason: "plan_retired" });

/**
 * What pressing Resume will do for this subscription, said before it is
 * pressed. Pure.
 *
 * @param {object} s
 * @param {string|null} s.status              our enum (active | trialing |
 *                                            past_due | canceled) or null
 * @param {boolean}     s.cancelAtPeriodEnd
 * @param {Date|null}   s.currentPeriodEnd    the period the company paid to
 * @param {Date|null}   s.trialEnd            Stripe's trial_end, if any
 * @param {Date|null}   s.canceledAt
 * @param {boolean}     s.hasPaymentMethod    a card Stripe can charge without
 *                                            asking — the customer's or the
 *                                            old subscription's default
 * @param {boolean}     s.planRetired         Plan.retiredAt is set: nothing
 *                                            new may be created on it
 * @param {Date}        [s.now]
 * @returns {{ mode: "uncancel"|"credited"|"charge_now"|"checkout"|"retired"|"none",
 *             until?: Date, reason?: string }}
 */
export function resumeDecision({
  status = null,
  cancelAtPeriodEnd = false,
  currentPeriodEnd = null,
  trialEnd = null,
  canceledAt = null,
  hasPaymentMethod = false,
  planRetired = false,
  now = new Date(),
} = {}) {
  if (status && LIVE.has(status)) {
    return cancelAtPeriodEnd ? { mode: "uncancel" } : { mode: "none", reason: "not_cancelled" };
  }
  // Below this line every outcome creates a NEW subscription on the plan.
  // A retired plan gets none of them — decided here, once, so the button,
  // the preview and the POST cannot disagree about it.
  if (planRetired) return RETIRED;
  if (status !== "canceled") return { mode: "checkout", reason: "no_subscription" };

  // Cancelled during the trial: Stripe leaves trial_end on the object, and it
  // sits AFTER canceled_at. That company paid nothing, so there is nothing to
  // credit — and no second trial.
  const end = at(currentPeriodEnd);
  const tEnd = at(trialEnd);
  const cAt = at(canceledAt) || now;
  const wasTrialing = Boolean(tEnd && tEnd.getTime() > cAt.getTime());
  const paidTimeLeft = !wasTrialing && end && end.getTime() - now.getTime() > CREDIT_MIN_MS;

  if (paidTimeLeft) {
    return hasPaymentMethod
      ? { mode: "credited", until: end }
      : { mode: "checkout", reason: "no_payment_method", until: end };
  }
  return hasPaymentMethod
    ? { mode: "charge_now", reason: wasTrialing ? "trial_used" : "period_elapsed" }
    : { mode: "checkout", reason: "no_payment_method" };
}

/**
 * Does the price on the old subscription still say what the Plan row says?
 *
 * The new subscription reuses the old item's Price — same plan, same cadence,
 * same currency, same amount — which is exactly "resume current". A Plan row
 * whose price has been edited since is a different offer, and a company must
 * not be silently re-signed at a number it never saw; that case goes to
 * Checkout, which shows the price. Pure.
 */
export function priceStillMatches(price, plan, interval, currency) {
  if (!price || typeof price !== "object" || price.active === false) return false;
  const charge = chargeFor(plan, interval);
  if (!charge) return false;
  return (
    price.recurring?.interval === interval &&
    (price.recurring?.interval_count ?? 1) === 1 &&
    String(price.currency || "").toLowerCase() === String(currency || "").toLowerCase() &&
    Number(price.unit_amount) === charge.unitAmountCents
  );
}

/** The card Stripe would charge without asking, from the objects in hand. */
function paymentMethodIdOf(sub, customer) {
  const own = sub?.default_payment_method;
  if (own) return typeof own === "string" ? own : own.id || null;
  const cust = customer?.invoice_settings?.default_payment_method;
  if (cust) return typeof cust === "string" ? cust : cust.id || null;
  return null;
}

/**
 * Everything the route and the preview need about the company's subscription,
 * read LIVE from Stripe and written onto the row on the way through.
 *
 * @returns {Promise<{ row, company, live, customer, decision, priceId, paymentMethodId }>}
 */
export async function loadResumeState(companyId, { now = new Date() } = {}) {
  const [row, company] = await Promise.all([
    db.subscription.findUnique({ where: { companyId }, include: { plan: true } }),
    db.company.findUnique({ where: { id: companyId } }),
  ]);
  // The two early exits below would otherwise answer "checkout" for a plan
  // that must not be sold again; the main path asks resumeDecision, which
  // knows, so these have to know too.
  const fallback = (reason) => (isRetired(row?.plan) ? RETIRED : { mode: "checkout", reason });
  if (!row?.stripeSubscriptionId) {
    return { row, company, live: null, customer: null, priceId: null, paymentMethodId: null, decision: fallback("no_subscription") };
  }

  let live = null;
  try {
    live = await stripe.subscriptions.retrieve(row.stripeSubscriptionId, {
      expand: ["customer", "default_payment_method"],
    });
    await writeSubscriptionFromStripe(companyId, live, { row });
  } catch (err) {
    if (!isCanceledSubscriptionError(err)) throw err;
    // Stripe has nothing under that id (a key from the other mode, or a
    // subscription deleted in the dashboard). The row's word stands, and with
    // no live object there is nothing to credit or un-cancel.
    return { row, company, live: null, customer: null, priceId: null, paymentMethodId: null, decision: fallback("stripe_missing") };
  }

  const customer = live.customer && typeof live.customer === "object" ? live.customer : null;
  const paymentMethodId = paymentMethodIdOf(live, customer);
  const interval = isBillingInterval(row.billingInterval) ? row.billingInterval : DEFAULT_INTERVAL;
  const price = live.items?.data?.[0]?.price || null;
  const currency = stripeCurrency(company?.currency);
  const priceId = price && priceStillMatches(price, row.plan, interval, currency) ? price.id : null;
  const fields = subscriptionFieldsFromStripe(live, { now: row.canceledAt || now });

  const decision = resumeDecision({
    status: fields.status || row.status,
    cancelAtPeriodEnd: fields.cancelAtPeriodEnd ?? row.cancelAtPeriodEnd,
    currentPeriodEnd: fields.currentPeriodEnd || row.currentPeriodEnd,
    trialEnd: fields.trialEndsAt ?? row.trialEndsAt,
    canceledAt: fields.canceledAt || row.canceledAt,
    // A card Stripe can charge AND a price that still means what the plan
    // says — without the second, the honest path is the Checkout that shows
    // the number.
    hasPaymentMethod: Boolean(paymentMethodId && priceId),
    planRetired: isRetired(row.plan),
    now,
  });
  return { row, company, live, customer, decision, priceId, paymentMethodId, price };
}

/**
 * What the button should say. The amount is the plan's own charge on the
 * cadence they are on — the same figure the plan card shows.
 */
export function resumePreview(state) {
  const { row, decision } = state;
  const interval = isBillingInterval(row?.billingInterval) ? row.billingInterval : DEFAULT_INTERVAL;
  const charge = row?.plan ? chargeFor(row.plan, interval) : null;
  return {
    mode: decision.mode,
    reason: decision.reason || null,
    until: decision.until || null,
    endsAt: row?.cancelAtPeriodEnd ? row.cancelAt || row.currentPeriodEnd || null : null,
    amountCents: charge?.unitAmountCents ?? null,
    currency: state.price?.currency || stripeCurrency(state.company?.currency),
    interval,
    planName: row?.plan?.name || null,
  };
}

/**
 * The Checkout fallback — the same session the plan cards open, for the
 * plan and cadence the company is already on.
 */
export async function resumeViaCheckout(state, { baseUrl }) {
  const { row, company } = state;
  if (!row?.plan || !company) return null;
  // Reached from the catch below too (a declined card falls through to
  // Checkout), so the retired test is repeated here rather than trusted to
  // the decision: a Checkout for a retired plan is a sale of it.
  if (isRetired(row.plan)) return null;
  const interval = isBillingInterval(row.billingInterval) ? row.billingInterval : DEFAULT_INTERVAL;
  if (!chargeFor(row.plan, interval)) return null;
  const session = await createBillingCheckoutSession({
    company,
    plan: row.plan,
    interval,
    // 0 for any company that has had its trial — which is every company that
    // can reach this function, after the backfill.
    trialDays: trialDaysAllowed(company),
    successUrl: `${baseUrl}/app/settings/account-billing?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/app/settings/account-billing`,
  });
  return session.url;
}

/**
 * Do it. Returns what happened, in the shape the route answers with.
 *
 * @returns {Promise<
 *   | { resumed: "uncancelled" }
 *   | { resumed: "credited", until: Date, stripeSubscriptionId: string }
 *   | { resumed: "charged", amountPaidCents: number, currency: string, nextBillingAt: Date|null, stripeSubscriptionId: string }
 *   | { resumed: false, checkoutUrl: string|null, reason: string, note?: string }
 *   | { resumed: false, alreadyLive: true }
 *   | { resumed: false, retired: true, reason: "plan_retired", note: string }
 * >}
 */
export async function resumeSubscription(companyId, { baseUrl, now = new Date() } = {}) {
  const state = await loadResumeState(companyId, { now });
  const { row, decision } = state;

  if (decision.mode === "none") return { resumed: false, alreadyLive: true };

  // Nothing is created, nothing is charged, no Checkout is opened. The route
  // turns this into a 409 and the plan cards on Account & Billing are the way
  // on to a current plan.
  if (decision.mode === "retired") {
    return {
      resumed: false,
      retired: true,
      reason: "plan_retired",
      note: `${RETIRED_PLAN_ERROR} Choose a current plan instead.`,
    };
  }

  if (decision.mode === "uncancel") {
    const updated = await stripe.subscriptions.update(row.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
    // Stripe's reply is the truth and it is in hand: cancelAtPeriodEnd and
    // cancelAt come off the object, through the one mapping.
    await writeSubscriptionFromStripe(companyId, updated, { row });
    return { resumed: "uncancelled" };
  }

  if (decision.mode === "credited" || decision.mode === "charge_now") {
    const { live, priceId, paymentMethodId } = state;
    const interval = isBillingInterval(row.billingInterval) ? row.billingInterval : DEFAULT_INTERVAL;
    let created;
    try {
      created = await stripe.subscriptions.create({
        customer: typeof live.customer === "object" ? live.customer.id : live.customer,
        items: [{ price: priceId, quantity: 1 }],
        default_payment_method: paymentMethodId,
        // Fail the call rather than mint a subscription nobody paid for. A
        // decline lands in the catch below and becomes a Checkout, where a
        // different card can be entered.
        payment_behavior: "error_if_incomplete",
        proration_behavior: "none",
        // The credit: the date they had already paid to. Absent on
        // charge_now — that is the whole of the one-trial rule.
        ...(decision.mode === "credited" ? { trial_end: Math.floor(decision.until.getTime() / 1000) } : {}),
        // Checkout wrote the customer's address back, so Stripe Tax can rate
        // it; a customer it cannot place fails with
        // customer_tax_location_invalid and goes to Checkout, which asks.
        automatic_tax: { enabled: true },
        // The same three keys createBillingCheckoutSession writes, so the
        // webhook, the sync, the drift cron and the plan-change reader treat
        // this subscription as first-class.
        metadata: { companyId, planId: row.planId, billingInterval: interval },
        expand: ["latest_invoice"],
      });
    } catch (err) {
      await recordError({
        area: "billing",
        code: err?.code || err?.type || "resume_create_failed",
        message: `Resume could not create a subscription (${decision.mode}): ${err?.message}`,
        companyId,
        detail: { mode: decision.mode, priceId, paymentMethodId, oldSubscriptionId: row.stripeSubscriptionId },
      }).catch(() => {});
      const checkoutUrl = await resumeViaCheckout(state, { baseUrl }).catch(() => null);
      return {
        resumed: false,
        checkoutUrl,
        reason: err?.code || "stripe_refused",
        note: err?.message || null,
      };
    }

    // The row: the NEW subscription id, Stripe's reply for everything Stripe
    // decides, and the clears a resumption implies. planId is unchanged — it
    // is the same plan. cancelReason is kept: it is history, and the one
    // thing about a cancellation worth remembering.
    await db.subscription.update({
      where: { companyId },
      data: {
        stripeSubscriptionId: created.id,
        ...subscriptionFieldsFromStripe(created),
        canceledAt: null,
        cancelAtPeriodEnd: false,
        cancelAt: null,
        pastDueSince: null,
        graceWarnedAt: null,
        graceFinalWarnedAt: null,
        // So the "you're subscribed" note goes out again (lib/billing/notify.js
        // dedupes on it), and the renewal reminder is not suppressed by the
        // old subscription's period.
        welcomeEmailSentAt: null,
        renewalRemindedPeriodEnd: null,
      },
    });
    await db.company.update({ where: { id: companyId }, data: { onboardingStatus: "active" } }).catch(() => {});

    if (decision.mode === "credited") {
      return { resumed: "credited", until: decision.until, stripeSubscriptionId: created.id };
    }
    const invoice = created.latest_invoice && typeof created.latest_invoice === "object" ? created.latest_invoice : null;
    return {
      resumed: "charged",
      amountPaidCents: Number(invoice?.amount_paid ?? 0),
      currency: String(invoice?.currency || created.currency || "").toLowerCase(),
      nextBillingAt: created.current_period_end ? new Date(created.current_period_end * 1000) : null,
      stripeSubscriptionId: created.id,
    };
  }

  // checkout
  const checkoutUrl = await resumeViaCheckout(state, { baseUrl });
  return { resumed: false, checkoutUrl, reason: decision.reason || "checkout" };
}
