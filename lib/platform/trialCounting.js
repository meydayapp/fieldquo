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
// ── One declaration, two consumers ─────────────────────────────────────────
//
// The Prisma `where` fragments and the in-memory predicate below are written
// against each other on purpose: the route counts with the fragments, and
// scripts/check-platform-console.mjs exercises the predicate against fixtures.
// A second copy of this rule inside the route is what let the original one rot
// unnoticed, so the route imports from here and inlines nothing.
//
// `isDemo` is NOT part of these fragments. The route composes them with its own
// NOT_DEMO clause, which every other count on that dashboard also spreads —
// baking the demo filter in here would leave two places that both think they
// own it. `isOnTrial` does apply it, because a predicate handed a whole company
// object has no second clause to compose with.

/** Branch 1: Stripe says this company is inside a trial. */
export function trialingSubscriptionWhere() {
  return { subscription: { status: "trialing" } };
}

/**
 * Branch 2: signed up, never reached checkout, trial window still open.
 *
 * `now` is a parameter rather than a `new Date()` inside, so the route pins one
 * instant across every count it issues in the same Promise.all — otherwise two
 * counts straddling midnight can disagree and the breakdown stops summing.
 */
export function awaitingCheckoutWhere(now) {
  return { subscription: { is: null }, trialEndsAt: { gte: now } };
}

/**
 * Both, as one clause. Disjoint — the first branch requires a subscription and
 * the second requires the absence of one — so the two counts always sum to
 * this one, and the route takes advantage of that to spend two queries instead
 * of three.
 */
export function trialCompanyWhere(now) {
  return { OR: [trialingSubscriptionWhere(), awaitingCheckoutWhere(now)] };
}

/**
 * The same rule against a loaded company row: { isDemo, trialEndsAt,
 * subscription: { status } | null }.
 *
 * Returns the branch name rather than a boolean so a caller can say WHICH kind
 * of trial it found — the dashboard prints the split, because a number nobody
 * can take apart is how the old one survived being wrong.
 *
 * @returns {"trialing_subscription"|"awaiting_checkout"|null}
 */
export function classifyTrial(company, now = new Date()) {
  if (!company || company.isDemo) return null;

  // Undefined is not null: a query that forgot to select the relation must not
  // be read as "this company has no subscription" and fall through to the
  // trialEndsAt branch, which would count paying customers as trials.
  const sub = company.subscription;
  if (sub === undefined) {
    throw new Error(
      "classifyTrial: company.subscription was not selected — cannot tell " +
        "'no subscription' from 'not loaded'",
    );
  }

  if (sub !== null) return sub.status === "trialing" ? "trialing_subscription" : null;

  if (!company.trialEndsAt) return null;
  const ends = new Date(company.trialEndsAt);
  if (Number.isNaN(ends.getTime())) return null;
  return ends >= now ? "awaiting_checkout" : null;
}

/** Boolean form of the above. */
export function isOnTrial(company, now = new Date()) {
  return classifyTrial(company, now) !== null;
}
