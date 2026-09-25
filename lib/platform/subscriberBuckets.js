// lib/platform/subscriberBuckets.js
//
// The NAMES of the buckets every /platform number counts companies into, and
// nothing else — no database, no imports — so a client page can import the
// labels and the groups without dragging Prisma into the browser bundle.
//
// The rule that puts a company INTO a bucket lives in
// lib/platform/trialCounting.js (subscriberBucket), server-side, because it
// reads lib/billing/access.js. Keep the two files together: a bucket named
// here that the classifier never returns is a filter chip that is always
// empty, and scripts/check-platform-buckets.mjs asserts both directions.
//
// ══ Why buckets, and why one list ══════════════════════════════════════════
//
// On 2026-09-25 the owner read "Trialing subscriptions: 2" on /platform and
// said "I think we have 4". He was right that the number was wrong for the
// question he was asking: since 38d3308d a new company trials with NO card
// and NO Subscription row, so a tile counting Stripe's trialing rows can
// never see it. Three screens had three answers — the home tile (2), the
// banner under it (5), the subscriptions page (5 on "All", 0 on "Active") —
// and the companies list's "Trial / pending" filter counted a fourth thing
// again (onboardingStatus, 3). Every one of those now counts these buckets.
//
// Every company is in exactly one. The order below is the order screens
// print them in.

export const BUCKET_ORDER = Object.freeze([
  "paying",
  "past_due",
  "trial_with_plan",
  "trial_no_plan",
  "trial_ended",
  "locked",
  "cancelled",
  "incomplete",
  "unknown",
  "demo",
]);

/**
 * label — the words on a chip or a list heading.
 * note  — one line saying what decides membership, printed where the list is.
 */
export const BUCKETS = Object.freeze({
  paying: {
    label: "Paying",
    note: "Subscription active in Stripe.",
  },
  past_due: {
    label: "Past due",
    note: "A payment failed; inside the 7-day read-only grace window.",
  },
  trial_with_plan: {
    label: "Trialing · plan chosen",
    note: "A Stripe subscription in its trial — a plan and a card are on file.",
  },
  trial_no_plan: {
    label: "Trialing · no plan yet",
    note: "The card-free free month: no Subscription row, trial date still ahead.",
  },
  trial_ended: {
    label: "Trial ended · no plan · read-only",
    note: "The free month ran out with no plan chosen; read-only for 7 days.",
  },
  locked: {
    label: "Locked",
    note: "Read-only window over (trial with no plan, or a failed payment), or locked by FieldQuo.",
  },
  cancelled: {
    label: "Cancelled",
    note: "The Stripe subscription is cancelled.",
  },
  incomplete: {
    label: "Never finished signup",
    note: "No Subscription row and no trial date — never counted as a company.",
  },
  unknown: {
    label: "Unrecognised subscription status",
    note: "A status this file cannot name — a bug here, shown rather than dropped.",
  },
  demo: {
    label: "Demo",
    note: "FieldQuo's own sales fixtures (Company.isDemo). Excluded from every count.",
  },
});

/** Inside a free month, with or without a plan. The "Trialing" number. */
export const TRIALING_BUCKETS = Object.freeze(["trial_with_plan", "trial_no_plan"]);

/** Billed by Stripe right now: the "paying" side of a per-country tally. */
export const BILLED_BUCKETS = Object.freeze(["paying", "past_due"]);

/** Holding a live subscription on a plan — who a plan price change touches. */
export const ON_PLAN_BUCKETS = Object.freeze(["paying", "past_due", "trial_with_plan"]);

/**
 * Not a company on FieldQuo for any count: FieldQuo's own demos, and people
 * who never finished signing up. Everything else "finished signup" — the
 * denominator the console calls "companies".
 */
export const NOT_A_CUSTOMER_BUCKETS = Object.freeze(["demo", "incomplete"]);

/**
 * The filter values the companies list offers that are GROUPS of buckets
 * rather than one — "Trialing" is the number the owner asks about, so it is
 * a chip of its own beside its two halves.
 */
export const BUCKET_GROUPS = Object.freeze({
  trialing: TRIALING_BUCKETS,
});

export const isTrialingBucket = (b) => TRIALING_BUCKETS.includes(b);
export const isBilledBucket = (b) => BILLED_BUCKETS.includes(b);
export const isCustomerBucket = (b) => Boolean(b) && !NOT_A_CUSTOMER_BUCKETS.includes(b);
