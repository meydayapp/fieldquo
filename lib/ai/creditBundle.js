// lib/ai/creditBundle.js
//
// A monthly AI credit allowance — the recurring half of buying AI credit.
// lib/ai/topup.js is the one-off half; both land in the same "ai" wallet
// (lib/voice/credits.js's poolForKind), priced from the one list in
// lib/ai/imageEconomics.js.
//
// ══ Stripe Billing, not Connect ═════════════════════════════════════════════
//
// Same customer as VoiceAutoTopup and the company's own plan
// (lib/platform/stripeBilling.js) — FieldQuo charging a contractor for
// FieldQuo's own service. No transfer_data, no connected account. See
// lib/stripe.js's warning at the top for the trap this avoids.
//
// ══ Plan credit resets monthly; top-ups don't expire (owner, 2026-10-04) ═══
//
// Each month's grant is written with `expiresAt` = the end of the period the
// invoice paid for, and whatever is left of it at that moment is taken off
// as one "ai_plan_expiry" row — lib/ai/planCreditReset.js, which also holds
// the draw-order rule (plan credit is spent before top-ups) and the worked
// examples. Restated here because it has to reach the settings screen in
// plain words BEFORE anyone pays, per AGENTS.md ("silence here is the bug"):
// BUNDLE_RESET_NOTICE is the English of that sentence, and the page prints
// the translated "app.setAiCredit.resetNotice", which check:ai-credit keeps
// saying the same thing.
//
// ══ Any company, in US dollars (owner, 2026-10-04) ══════════════════════════
//
// The plan is a USD subscription for every company — OpenAI charges FieldQuo
// in US dollars. Stripe holds one currency per customer, so a company whose
// FieldQuo plan bills in CAD, AUD, GBP or EUR subscribes on its separate USD
// add-on customer (getOrCreateUsdAddOnCustomer, the video pack's mechanism);
// a USD company uses its one customer as before. Before this, a non-USD
// company was refused with a sentence (bundleAvailability).
//
// ══ The grant is idempotent on the ledger, not on this table ══════════════
//
// grantAiBundlePeriod() is called from both doors — the browser's return
// redirect (via settleAiBundleCheckoutSession) and the
// invoice.payment_succeeded webhook — exactly the two-doors-one-settlement
// shape lib/voice/topup.js uses for a one-off payment. The difference here is
// what the ref is keyed on: a top-up has one payment intent per purchase, but
// a subscription reuses the SAME subscription id every month, so the ref adds
// the billing PERIOD — aiBundleRef(subscriptionId, periodStart) — the same
// move lib/voice/spendGate.js's rentRef() makes for monthly number rental. A
// re-delivered webhook for March's invoice and a re-delivered webhook for
// April's invoice are different refs; two deliveries of March's are the same
// ref, and the unique (companyId, ref) index is what makes the second one a
// no-op rather than a second grant.
//
// ══ Why the collision with the company's OWN subscription matters ═════════
//
// This subscription lives on the SAME Stripe customer as the company's
// platform plan. lib/platform/stripeBilling.js's invoice.payment_succeeded /
// invoice.payment_failed handlers look the company up by
// `stripeCustomerId: obj.customer` — by CUSTOMER, not by subscription id —
// because that code was written when a customer only ever had one
// subscription. A bundle invoice on that same customer would otherwise be
// misread as the company's plan renewing: wrong amount fed into the referral
// credit calculation, a real payment failure treated as the plan going
// past-due. The billing webhook route intercepts every invoice and
// subscription event for a bundle's OWN subscription id here, BEFORE
// syncSubscriptionFromStripeEvent ever sees it — see
// app/api/platform/billing/webhook/route.js.
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { getOrCreateStripeCustomer, getOrCreateUsdAddOnCustomer } from "@/lib/platform/stripeBilling";
import { addCredit, balanceFor, POOLS } from "@/lib/voice/credits";
import { BUNDLES } from "@/lib/ai/imageEconomics";
import { recordActivity } from "@/lib/activity/log";
import { recordError } from "@/lib/platform/errorLog";
import { invoiceSubscriptionId } from "@/lib/billing/subscriptionChargeEvent";
import { expireDuePlanCredit } from "@/lib/ai/planCreditReset";

/** The one wallet-honest sentence — see the module header. English; the
 *  settings page prints the translated "app.setAiCredit.resetNotice", and
 *  check:ai-credit keeps the two saying the same thing. */
export const BUNDLE_RESET_NOTICE =
  "Plan credit resets every month: whatever you don't use by your renewal date is gone, and the next month's credit lands. Run out before then and you can top up — top-ups don't expire. Cancelling stops next month's charge; this month's plan credit stays until the month ends.";

/** BUNDLES[key], or null for an id nobody offers. Never guess a price. */
export function bundleByKey(key) {
  return BUNDLES.find((b) => b.key === String(key || "")) || null;
}

/** Day resolution, UTC — same rule as spendGate.js's rentRef, so a period
 *  key is stable regardless of which region's clock is running the webhook. */
function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/** One calendar month on, clamped to the month's last day (31 Jan → 28/29 Feb). */
export function oneMonthAfter(date) {
  const d = new Date(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return target;
}

/** The ledger ref one bundle-subscription's one billing period grants under.
 *  Unique per (companyId, ref) — see the module header. */
export function aiBundleRef(subscriptionId, periodStart) {
  return `ai_bundle:${subscriptionId}:${dayKey(periodStart)}`;
}

/** This company's bundle row, or null — never subscribed, or the row was
 *  removed. Null is not "no allowance": it is "no subscription at all". */
export function aiCreditBundleFor(companyId, prisma = db) {
  if (!companyId) return Promise.resolve(null);
  return prisma.aiCreditBundle.findUnique({ where: { companyId } });
}

/**
 * What the settings screen may see. No Stripe ids — same discipline as
 * publicAutoTopup in lib/voice/autoTopup.js.
 */
export function publicAiBundle(row) {
  if (!row) return null;
  const bundle = bundleByKey(row.key);
  return {
    key: row.key,
    label: bundle?.key || row.key,
    priceCents: bundle?.priceCents ?? null,
    credits: bundle?.credits ?? null,
    status: row.status,
    active: row.status === "active",
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    currentPeriodEnd: row.currentPeriodEnd || null,
    lastGrantedPeriodStart: row.lastGrantedPeriodStart || null,
  };
}

/**
 * A Stripe-hosted subscription checkout for one bundle.
 *
 * `mode: "subscription"` — a recurring charge, unlike the one-off
 * `mode: "payment"` lib/ai/topup.js's sibling route uses. The price is built
 * inline from BUNDLES rather than a stored Stripe Price id, the same way
 * lib/platform/stripeBilling.js's recurringLine() builds the company's own
 * plan price — one fewer catalog to keep in sync with imageEconomics.js.
 */
/**
 * Whether this company can start a plan, and what the screen must say.
 *
 * Every company can (owner, 2026-10-04), in US dollars. `usdNote` is true
 * when the company's own billing currency is not USD — the page then shows
 * "Billed in US dollars" and why (app/components/billing/UsdBillingNote.js).
 * Kept as a function with the old { ok, reason } shape so the page's and
 * the advisor's "is the button live" reads did not have to change.
 */
export function bundleAvailability(companyCurrency) {
  const currency = String(companyCurrency || "USD").toUpperCase();
  return { ok: true, reason: null, currency: "USD", usdNote: currency !== "USD" };
}

/**
 * Which Stripe customer a plan subscribes on: the company's one customer when
 * it bills in USD, its separate USD add-on customer for any other currency —
 * a USD subscription on the plan's CAD/AUD/GBP/EUR customer is refused by
 * Stripe (the video pack's packCustomerKind, the same rule).
 */
export function bundleCustomerKind(companyCurrency) {
  return String(companyCurrency || "USD").toUpperCase() === "USD" ? "plan" : "usd_add_ons";
}

export async function createAiBundleCheckoutSession({ company, bundleKey, successUrl, cancelUrl, deps = {} }) {
  const bundle = bundleByKey(bundleKey);
  if (!bundle) return { ok: false, reason: "unknown_bundle" };

  const stripeClient = deps.stripe || stripe;
  const customerFor =
    bundleCustomerKind(company?.currency) === "usd_add_ons"
      ? deps.getOrCreateUsdAddOnCustomer || getOrCreateUsdAddOnCustomer
      : deps.getOrCreateStripeCustomer || getOrCreateStripeCustomer;
  const customerId = await customerFor(company);

  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `FieldQuo — AI credit, ${bundle.credits.toLocaleString()}/month`,
          },
          unit_amount: bundle.priceCents,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    // On BOTH the session and the subscription: the checkout.session.completed
    // event carries the session's own metadata, but the invoice and
    // subscription-lifecycle events this file cares about most only ever see
    // the SUBSCRIPTION object, so subscription_data.metadata is what
    // grantAiBundlePeriod and upsertAiCreditBundleFromSubscription actually
    // read.
    metadata: { companyId: company.id, kind: "ai_bundle_subscription", bundleKey: bundle.key },
    subscription_data: {
      metadata: { companyId: company.id, kind: "ai_bundle_subscription", bundleKey: bundle.key },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return { ok: true, checkoutUrl: session.url };
}

/**
 * Create or refresh the row from a Stripe Subscription object — the shape
 * both customer.subscription.* events and the browser-return confirm hand in.
 *
 * Reads metadata rather than trusting a row already exists, because the very
 * first event for a brand-new subscription IS the thing that creates it —
 * same reasoning as recordAutoTopupMandate reading the session rather than
 * assuming a row is already there.
 */
export async function upsertAiCreditBundleFromSubscription(subscription, { prisma = db } = {}) {
  const companyId = subscription?.metadata?.companyId || null;
  const bundleKey = subscription?.metadata?.bundleKey || null;
  if (!companyId || !bundleKey || !bundleByKey(bundleKey)) return null;

  const status =
    subscription.status === "canceled" || subscription.status === "incomplete_expired"
      ? "canceled"
      : subscription.status || "active";

  const data = {
    key: bundleKey,
    stripeCustomerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    stripeSubscriptionId: subscription.id,
    status,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    // Newer Stripe API versions moved current_period_end onto the
    // subscription item (lib/marketing/videoPack.js reads both the same way);
    // reading only the old field left "Renews …" blank on those.
    currentPeriodEnd: (() => {
      const end = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
      return end ? new Date(end * 1000) : null;
    })(),
  };

  return prisma.aiCreditBundle.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });
}

/**
 * Resolve a Stripe subscription id to its AiCreditBundle row, WITHOUT
 * assuming the id belongs to a bundle at all.
 *
 * Shared by grantAiBundlePeriod (invoice.payment_succeeded) and the webhook
 * route's invoice.payment_failed guard, because both have to ask the exact
 * same question first: "is this subscription id ours, or is it the
 * company's own plan?" Getting that wrong in either direction is a real bug —
 * treating a plan renewal as a bundle grant hands out free AI credit, and
 * treating a bundle invoice as a plan renewal feeds its amount into the
 * referral-credit calculation in lib/platform/stripeBilling.js.
 *
 * @returns the row (creating it from Stripe if this is the FIRST event a
 *          bundle subscription has ever produced), or null when the id
 *          genuinely belongs to something else.
 */
export async function resolveAiBundleSubscription(subscriptionId, { prisma = db, deps = {} } = {}) {
  const stripeClient = deps.stripe || stripe;
  const upsert = deps.upsertAiCreditBundleFromSubscription || upsertAiCreditBundleFromSubscription;
  if (!subscriptionId) return null;

  const existing = await prisma.aiCreditBundle.findUnique({ where: { stripeSubscriptionId: subscriptionId } });
  if (existing) return existing;

  // Not on our table yet. Could be a bundle subscription whose row-creating
  // event (checkout.session.completed / customer.subscription.created)
  // hasn't landed — the network gives no ordering guarantee — or could be an
  // ordinary company-plan subscription, which is the overwhelmingly common
  // case on this account. Ask Stripe what it actually is rather than guessing
  // either way.
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId).catch(() => null);
  if (subscription?.metadata?.kind !== "ai_bundle_subscription") return null;

  return upsert(subscription, { prisma });
}

/**
 * The one grant. Called from both settlement doors — see the module header.
 *
 * @param invoice  a Stripe Invoice object naming its subscription (either
 *                 API shape — see lib/stripe/invoiceSubscription.js)
 * @returns {{handled: boolean, granted?: boolean, reason?: string,
 *            cents?: number, companyId?: string}}
 *          `handled: false` means this invoice does not belong to an AI
 *          bundle subscription at all — the caller (the webhook route) must
 *          fall through to the company's own plan handling rather than
 *          swallow the event, because most invoices on this Stripe account
 *          are exactly that.
 */
export async function grantAiBundlePeriod(invoice, { deps = {} } = {}) {
  const prisma = deps.db || db;
  const credit = deps.addCredit || addCredit;
  const logActivity = deps.recordActivity || recordActivity;

  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return { handled: false, reason: "no_subscription" };

  const row = await resolveAiBundleSubscription(subscriptionId, { prisma, deps });
  if (!row) {
    // Not ours. The caller must fall through to the platform's own
    // subscription handling — this is the branch that keeps a company's real
    // plan renewal working exactly as it did before this file existed.
    return { handled: false, reason: "not_a_bundle" };
  }

  const bundle = bundleByKey(row.key);
  if (!bundle) {
    // A key that no longer exists in BUNDLES — a tier retired after somebody
    // subscribed. Refusing rather than inventing a price for it: an unknown
    // amount granted here is worse than none, and it never happens silently —
    // recordError makes it a page in /platform/errors, not a swallowed branch.
    await recordError({
      area: "ai-credit-bundle",
      message: `Subscription ${subscriptionId} is on unknown bundle key "${row.key}"`,
      companyId: row.companyId,
    }).catch(() => {});
    return { handled: true, granted: false, reason: "unknown_bundle_key" };
  }

  // The period this invoice actually covers, from the invoice's own line
  // item — the same reason rentDecision() prices rent from the number's own
  // stored figure rather than today's price list: an invoice is a fact about
  // what was charged, and the period it names is part of that fact.
  const periodStartUnix = invoice?.lines?.data?.[0]?.period?.start;
  const periodStart = periodStartUnix ? new Date(periodStartUnix * 1000) : new Date();
  // The end of the month this invoice paid for — when this grant's unused
  // part resets (lib/ai/planCreditReset.js). From the invoice's own line, the
  // same fact-about-the-charge reasoning as periodStart. A line with no end
  // (never seen from Stripe) falls back to one calendar month on, rather than
  // to a grant that never resets, which would quietly restore rollover.
  const periodEndUnix = invoice?.lines?.data?.[0]?.period?.end;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : oneMonthAfter(periodStart);

  // Last month's unused plan credit goes BEFORE this month's lands — the
  // reset the owner decided (2026-10-04). Idempotent on its own ledger ref,
  // and a no-op when the month was fully spent or there was no last month.
  // A failure here is logged, never a reason to withhold the month just paid
  // for: the daily sweep (/api/cron/ai-plan-reset) retries the reset.
  const expire = deps.expireDuePlanCredit || expireDuePlanCredit;
  await expire({ companyId: row.companyId, prisma }).catch((err) =>
    recordError({
      area: "ai-credit-bundle",
      message: `Plan credit reset failed before granting ${subscriptionId}: ${String(err?.message || err).slice(0, 200)}`,
      companyId: row.companyId,
    }).catch(() => {}),
  );

  const ref = aiBundleRef(subscriptionId, periodStart);
  const amount = `$${(bundle.priceCents / 100).toFixed(2)}`;

  const entry = await credit({
    companyId: row.companyId,
    cents: bundle.credits,
    kind: "ai_bundle",
    stripeRef: invoice.id,
    ref,
    expiresAt: periodEnd,
    note: `AI credit plan — US${amount}/mo, ${bundle.credits.toLocaleString()} credits for ${dayKey(periodStart)} to ${dayKey(periodEnd)} (unused plan credit resets ${dayKey(periodEnd)})`,
    prisma,
  });

  // Whether this call created the row or found it already there (a retried
  // webhook), the "last granted" display should read the newest period this
  // subscription has ever been billed for.
  const alreadyNewer =
    row.lastGrantedPeriodStart && new Date(row.lastGrantedPeriodStart) >= periodStart;
  if (!alreadyNewer) {
    await prisma.aiCreditBundle.update({
      where: { companyId: row.companyId },
      data: { lastGrantedPeriodStart: periodStart, status: "active" },
    });
  }

  await logActivity(
    { companyId: row.companyId },
    {
      action: "ai.bundle_granted",
      entityType: "settings",
      actorName: "Stripe (subscription renewed)",
      summary: `Granted ${bundle.credits.toLocaleString()} AI credits — ${bundle.key} plan`,
      metadata: { bundleKey: bundle.key, credits: bundle.credits, subscriptionId, ref },
    },
  ).catch(() => {});

  return { handled: true, granted: true, cents: bundle.credits, companyId: row.companyId, entry };
}

/**
 * The browser-return door: confirm the subscription checkout actually
 * completed, upsert the row, and grant the first period if Stripe has
 * already generated and paid the first invoice (Checkout usually has, for a
 * card, by the time the browser is back).
 *
 * Converges on the exact same grantAiBundlePeriod() the webhook calls, keyed
 * on the exact same ref — so whichever door gets there first grants once, and
 * the second is a confirmed no-op rather than a second $0.05 or a doubled
 * allowance.
 */
export async function settleAiBundleCheckoutSession(session, { deps = {} } = {}) {
  const stripeClient = deps.stripe || stripe;
  const upsert = deps.upsertAiCreditBundleFromSubscription || upsertAiCreditBundleFromSubscription;
  const grant = deps.grantAiBundlePeriod || grantAiBundlePeriod;
  const prisma = deps.db || db;

  if (session?.mode !== "subscription" || session?.metadata?.kind !== "ai_bundle_subscription") {
    return { ok: false, reason: "not_a_bundle_session" };
  }
  if (session.status !== "complete") return { ok: false, reason: "checkout_incomplete" };

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;
  if (!subscriptionId) return { ok: false, reason: "no_subscription" };

  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  });
  if (subscription?.metadata?.companyId !== session.metadata?.companyId) {
    // Same guard recordAutoTopupMandate applies to its session: a session id
    // is handed in from a browser, and without this a stranger who saw one
    // could confirm someone else's subscription.
    return { ok: false, reason: "session_mismatch" };
  }

  const row = await upsert(subscription, { prisma });
  if (!row) return { ok: false, reason: "not_a_bundle" };

  const invoice = subscription.latest_invoice;
  const granted =
    invoice && typeof invoice === "object" && invoice.status === "paid"
      ? await grant(invoice, { deps })
      : { handled: true, granted: false, reason: "invoice_not_paid_yet" };

  return { ok: true, config: row, granted };
}

/**
 * Cancel the subscription — the ONLY thing that actually stops future
 * grants, per the model header. Stripe first, and the caller must treat a
 * Stripe failure as the cancellation NOT having happened: unlike removing an
 * auto-topup card (where our own `enabled` flag is the thing that stops the
 * NEXT charge, so writing it first is safe), nothing in this codebase decides
 * whether to invoice a subscription except Stripe itself. Marking the row
 * cancelled while the subscription is still live would tell the contractor
 * they are not being charged while they still are.
 */
export async function cancelAiBundle(companyId, { prisma = db, deps = {} } = {}) {
  const stripeClient = deps.stripe || stripe;
  const row = await prisma.aiCreditBundle.findUnique({ where: { companyId } });
  if (!row) return { ok: true, reason: "not_subscribed" };
  if (row.status === "canceled") return { ok: true, reason: "already_canceled", config: row };

  try {
    await stripeClient.subscriptions.cancel(row.stripeSubscriptionId);
  } catch (err) {
    // `resource_missing` means Stripe already has no such subscription — as
    // good as cancelled, and treated as success rather than surfaced as a
    // failure the contractor can do nothing about.
    if (err?.code !== "resource_missing") {
      return { ok: false, reason: "stripe_unavailable" };
    }
  }

  const updated = await prisma.aiCreditBundle.update({
    where: { companyId },
    data: { status: "canceled", cancelAtPeriodEnd: false },
  });

  await recordActivity(
    { companyId },
    {
      action: "ai.bundle_cancelled",
      entityType: "settings",
      summary: `Cancelled the ${row.key} AI credit plan`,
      metadata: { bundleKey: row.key },
    },
  ).catch(() => {});

  return { ok: true, config: updated };
}
