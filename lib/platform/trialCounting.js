// lib/platform/trialCounting.js
//
// What "on trial" means, in one place, because the platform dashboard was
// printing two different answers to it on the same screen.
//
// ── The bug ────────────────────────────────────────────────────────────────
//
// The overview route counted trials as:
//
//     { onboardingStatus: "pending", trialEndsAt: { gte: now } }
//
// Against the live database that returns 1, while 6 companies have a
// trialEndsAt in the future and 4 subscriptions are `trialing` in Stripe. The
// banner said "1 companies on trial — these are the ones worth calling", four
// inches under a tile reading "In trial: 4". Both numbers were on screen at
// once and neither could be reconstructed from its label.
//
// `onboardingStatus` was the wrong axis entirely. It flips to "active" at
// `checkout.session.completed` (lib/platform/stripeBilling.js), and that event
// fires at TRIAL START with nothing collected — the same trap
// lib/sales/commission.js documents for the commission milestones. So a
// company that finished signing up is "active" while still inside its free
// month, and the query excluded exactly the population it was written to find.
// What it actually counted was the leftovers: of the 10 `pending` companies
// only one still had an unexpired trial, because the rest started a signup,
// never reached checkout, and lapsed.
//
// ── What it means now, and why ─────────────────────────────────────────────
//
// A company is on trial when it is inside a free month it has not yet paid
// for. Two populations, and they are disjoint by construction:
//
//   1. `subscription.status === "trialing"`. This column is Stripe's own
//      status, written verbatim from customer.subscription.created/updated
//      (stripeBilling.js), and Stripe is the party that decides when the free
//      month ends and a card is charged. Nothing we hold outranks it.
//
//   2. No Subscription row at all, and Company.trialEndsAt is still in the
//      future. Signup (app/api/companies/route.js) creates the company with
//      trialEndsAt = +30d and creates NO subscription — that only appears once
//      the company reaches Stripe Checkout. Without this branch every company
//      in its first month before checkout would be invisible, which is the
//      half of the funnel a call is most likely to rescue.
//
// A company with a subscription that is NOT trialing is not on trial, whatever
// Company.trialEndsAt still says: that column is a signup-time estimate and
// nothing clears it when Stripe starts charging. Reading it in preference to
// Stripe is how a paying customer gets phoned about their free trial.
//
// ── 2026-09-25: one book, every number ─────────────────────────────────────
//
// The owner read "Trialing subscriptions: 2" on /platform and said "I think
// we have 4". The tile counted Stripe's trialing Subscription rows, which
// since 38d3308d can never see a new signup: a company now trials with no
// card and NO Subscription row until it picks a plan. The banner under the
// tile said 5, the subscriptions page said 5 on "All" and 0 on "Active", and
// the companies list's "Trial / pending" chip counted onboardingStatus (3).
// Four answers, each defensible against its own query, none against the
// question.
//
// So this file no longer hands out Prisma fragments for a route to count
// with. It classifies every company into exactly ONE bucket
// (lib/platform/subscriberBuckets.js names them) and every /platform number
// is the length of one of those lists — the home tiles, the subscriptions
// summary, the companies filters and per-country tally, the tax tally, the
// growth forecast's starting stock, the plans page's subscriber counts. A
// tile and the list behind it are the same array, so they cannot disagree,
// and the home page prints the names under the numbers so nobody has to take
// one on trust again.
//
// Loaded in memory rather than counted in SQL on purpose: the classification
// reads lib/billing/access.js (the grace windows the company's own banner
// uses), which no `where` can express without a second copy of the rule —
// and a second copy is how every one of the four answers above drifted. The
// select is a dozen scalar columns per company; at a few thousand companies
// it is still one small query.
//
// `isDemo` IS applied here — a demo is its own bucket and every tally leaves
// it out — so a caller has no NOT_DEMO clause to remember.

import { accessFor, trialAccessFor } from "@/lib/billing/access";
import { hasFinishedSignup } from "@/lib/signup/abandoned";
import {
  BUCKET_ORDER,
  BILLED_BUCKETS,
  ON_PLAN_BUCKETS,
  TRIALING_BUCKETS,
  isCustomerBucket,
} from "@/lib/platform/subscriberBuckets";

/**
 * Which ONE bucket a company is in.
 *
 * @param company { isDemo, trialEndsAt, subscription: null | { status,
 *                  accessLockedAt, pastDueSince, canceledAt, ... } }
 *                `subscription` and `trialEndsAt` must be SELECTED — an
 *                unloaded relation read as "no subscription" would file every
 *                paying customer under a trial (hasFinishedSignup throws).
 * @returns one of BUCKET_ORDER, or null for no company at all
 */
export function subscriberBucket(company, now = new Date()) {
  if (!company) return null;
  if (company.isDemo) return "demo";
  if (!hasFinishedSignup(company)) return "incomplete";

  const sub = company.subscription;
  if (sub === null) {
    // The card-free trial. Its windows are the ones the company's own banner
    // counts down (trialAccessFor), so the console and the customer agree on
    // the day it ends.
    const t = trialAccessFor(company, now);
    if (t?.level === "full") return "trial_no_plan";
    if (t?.level === "readonly") return "trial_ended";
    return "locked";
  }

  // Locked by FieldQuo for a terms breach reads before the status: that route
  // cancels the Stripe subscription first, and the company did not CHOOSE to
  // leave, so "Cancelled" would be the wrong word (accessFor makes the same
  // call in the same order).
  if (sub.accessLockedAt) return "locked";
  if (sub.status === "canceled") return "cancelled";
  // Stripe's own status, written verbatim by the webhook and the six-hourly
  // billing-sync. A trial Stripe still calls trialing is one, whatever our
  // copy of its end date says — nothing we hold outranks Stripe here.
  if (sub.status === "trialing") return "trial_with_plan";
  if (sub.status === "active") return "paying";
  if (sub.status === "past_due") {
    return accessFor(sub, now).level === "locked" ? "locked" : "past_due";
  }
  return "unknown";
}

/**
 * The old two-branch answer, kept for its callers and DERIVED from the bucket
 * so it cannot drift from it.
 *
 * @returns {"trialing_subscription"|"awaiting_checkout"|null}
 */
export function classifyTrial(company, now = new Date()) {
  // Undefined is not null: refused by name before anything else reads it.
  if (company && !company.isDemo && company.subscription === undefined) {
    throw new Error(
      "classifyTrial: company.subscription was not selected — cannot tell " +
        "'no subscription' from 'not loaded'",
    );
  }
  const b = subscriberBucket(company, now);
  if (b === "trial_with_plan") return "trialing_subscription";
  if (b === "trial_no_plan") return "awaiting_checkout";
  return null;
}

/** Boolean form of the above. */
export function isOnTrial(company, now = new Date()) {
  return classifyTrial(company, now) !== null;
}

/**
 * Every column subscriberBucket, the revenue outlook, the tax tally and the
 * screens read. One select, so no reader can forget `subscription` or
 * `trialEndsAt` and quietly change what a company is.
 */
export const SUBSCRIBER_BOOK_SELECT = Object.freeze({
  id: true,
  name: true,
  email: true,
  isDemo: true,
  country: true,
  createdAt: true,
  trialEndsAt: true,
  onboardingStatus: true,
  stripeChargesEnabled: true,
  subscription: {
    select: {
      id: true,
      status: true,
      planId: true,
      stripeSubscriptionId: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      billingStartedAt: true,
      billingInterval: true,
      canceledAt: true,
      cancelAtPeriodEnd: true,
      cancelAt: true,
      pastDueSince: true,
      accessLockedAt: true,
      createdAt: true,
      plan: {
        select: {
          id: true,
          name: true,
          currency: true,
          priceMonthly: true,
          priceAnnual: true,
          stripePriceId: true,
        },
      },
    },
  },
});

/**
 * Companies (already carrying `bucket`, or classified here) into the tally
 * every screen prints.
 *
 * @returns {{
 *   at: string,
 *   counts: { [bucket]: number },
 *   members: { [bucket]: { id, name }[] },
 *   trialing: { total, withPlan, noPlan },
 *   billed: number, onPlan: number, customers: number,
 * }}
 */
export function tallySubscribers(companies, now = new Date()) {
  const members = Object.fromEntries(BUCKET_ORDER.map((b) => [b, []]));
  for (const c of Array.isArray(companies) ? companies : []) {
    const b = c?.bucket ?? subscriberBucket(c, now);
    if (!b) continue;
    (members[b] ||= []).push({ id: c.id, name: c.name });
  }
  const counts = Object.fromEntries(Object.entries(members).map(([b, list]) => [b, list.length]));
  const sum = (keys) => keys.reduce((n, k) => n + (counts[k] || 0), 0);
  return {
    at: now.toISOString(),
    counts,
    members,
    trialing: {
      total: sum(TRIALING_BUCKETS),
      withPlan: counts.trial_with_plan || 0,
      noPlan: counts.trial_no_plan || 0,
    },
    billed: sum(BILLED_BUCKETS),
    onPlan: sum(ON_PLAN_BUCKETS),
    // "Companies" on every screen: finished signing up, not a demo.
    customers: Object.keys(counts).filter(isCustomerBucket).reduce((n, k) => n + counts[k], 0),
  };
}

/**
 * The whole book, classified, straight from the database — never a cached
 * rollup, so a tile is as fresh as the request that drew it. (The
 * Subscription rows themselves mirror Stripe; lib/platform/webhookHealth.js
 * stripeMirrorFreshness says how fresh that mirror is, and the screens print
 * it.)
 *
 * @param client  the Prisma client (injected so a check can pass a stub)
 * @returns {Promise<{ companies: object[], tally: object, at: string }>}
 */
export async function loadSubscriberBook(client, { now = new Date() } = {}) {
  const rows = await client.company.findMany({
    select: SUBSCRIBER_BOOK_SELECT,
    orderBy: { createdAt: "asc" },
  });
  const companies = rows.map((c) => ({ ...c, bucket: subscriberBucket(c, now) }));
  return { companies, tally: tallySubscribers(companies, now), at: now.toISOString() };
}

/**
 * The subscriptions the revenue outlook prices, in the shape
 * buildRevenueOutlook takes. Only companies whose bucket holds a plan in good
 * standing: a card-free trial has no price and never reaches MRR, and a
 * locked or cancelled row is not revenue whatever its status column says.
 */
export function outlookSubscriptions(companies) {
  return (Array.isArray(companies) ? companies : [])
    .filter((c) => c.bucket === "paying" || c.bucket === "trial_with_plan")
    .map((c) => ({ ...c.subscription, company: { name: c.name } }));
}
