#!/usr/bin/env node
//
// scripts/check-sales-commission.mjs
//
// The rules that decide whether FieldQuo pays a sales rep, executed rather than
// read. AGENTS.md is explicit that most of the real bugs in this repo were
// found this way, and these functions decide who gets money.
//
// The cases below are not invented. Each one is a specific way this could pay
// wrongly, and several are traps found while reading the existing Stripe
// integration rather than imagined afterwards.
import { readFileSync } from "node:fs";
import {
  MILESTONES,
  commissionRef,
  reversalRef,
  amountForMilestone,
  qualifiesForActivation,
  qualifiesForFirstPayment,
  qualifiesForRetention,
  balanceCents,
  splitPayable,
  departedRepStillEarns,
} from "../lib/sales/commission.js";

let passed = 0;
const failures = [];
function ok(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log("  ✓ " + name);
  } else {
    failures.push(name + (detail ? ` — ${detail}` : ""));
    console.log("  ✗ " + name + (detail ? ` — ${detail}` : ""));
  }
}

const PLAN = {
  activationCents: 2000,
  firstPaymentCents: 4000,
  retentionCents: 6500,
  retentionDays: 60,
};


/**
 * "A appears before B", where a MISSING A is a failure rather than a pass.
 *
 * The naive form is `src.indexOf(a) < src.indexOf(b)`, and it has a false pass
 * that mutation testing found in three checks at once: indexOf returns -1 when
 * the needle is absent, and -1 is less than every real index. So deleting the
 * guard entirely satisfies the assertion that the guard comes first.
 *
 * Both needles must be present AND ordered.
 *
 * The needle also has to be the CALL and not the identifier. `requireCronSecret`
 * appears in the import line too, which sits above everything — so searching for
 * the bare name finds the import, reports it as "before the query", and passes
 * on a route whose guard has been deleted. Search for `requireCronSecret(` .
 */
function orderedIn(src, a, b) {
  const ia = src.indexOf(a);
  const ib = src.indexOf(b);
  return ia >= 0 && ib >= 0 && ia < ib;
}

console.log("\nMilestone 1 — the company can actually take money");
ok("a Connect-enabled company qualifies", qualifiesForActivation({ stripeChargesEnabled: true }));
ok("one that cannot take charges does not", !qualifiesForActivation({ stripeChargesEnabled: false }));
ok("null is not a yes", !qualifiesForActivation({ stripeChargesEnabled: null }));
ok("a missing company is not a yes", !qualifiesForActivation(null));
// The whole reason this milestone is Connect-only. A solo shop can never
// complete onboarding (the team step is seatsUsed > 1), so anything that folded
// completeness in here would pay nothing on an entire class of real sale.
ok(
  "onboarding completeness is NOT consulted — a solo shop still qualifies",
  qualifiesForActivation({ stripeChargesEnabled: true, onboardingCompletedAt: null }),
);

console.log("\nMilestone 2 — money actually collected, once");
ok(
  "a real first payment qualifies",
  qualifiesForFirstPayment({ billing_reason: "subscription_create", amount_paid: 9900 }),
);
// The trap. checkout.session.completed fires at trial start with nothing
// collected, creates the Subscription row and flips onboardingStatus to active.
ok(
  "a $0 invoice does NOT — the first month is free and referrals grant more",
  !qualifiesForFirstPayment({ billing_reason: "subscription_create", amount_paid: 0 }),
);
ok(
  "a renewal does not (that is not the FIRST payment)",
  !qualifiesForFirstPayment({ billing_reason: "subscription_cycle", amount_paid: 9900 }),
);
ok("a manual invoice does not", !qualifiesForFirstPayment({ billing_reason: "manual", amount_paid: 9900 }));
ok("a missing amount does not", !qualifiesForFirstPayment({ billing_reason: "subscription_create" }));
ok(
  "a non-numeric amount does not",
  !qualifiesForFirstPayment({ billing_reason: "subscription_create", amount_paid: "lots" }),
);
ok("nothing at all does not", !qualifiesForFirstPayment(null));

console.log("\nMilestone 3 — still paying after the window");
// The clock starts at SUBSCRIPTION START — trial included, per the owner's own
// wording: "$65 after the company still is subscribed after 60 days (including
// trial)". The first payment lands a month later because the first month is
// free, and anchoring on it would pay roughly a trial-length late.
const subStart = new Date("2026-06-01T00:00:00Z");
const firstPaid = new Date("2026-07-01T00:00:00Z");
const day60 = new Date("2026-07-31T00:00:00Z");
const day59 = new Date("2026-07-29T00:00:00Z");
const ACTIVE = { status: "active", canceledAt: null, refundedAmountCents: 0, refundedAt: null, disputeStatus: null };

ok(
  "60 days on an active subscription qualifies",
  qualifiesForRetention({ subscriptionStartedAt: subStart, firstPaymentAt: firstPaid, subscription: ACTIVE, now: day60 }).qualifies,
);
ok(
  "59 days does not",
  !qualifiesForRetention({ subscriptionStartedAt: subStart, firstPaymentAt: firstPaid, subscription: ACTIVE, now: day59 }).qualifies,
);
ok(
  "no first payment means there is nothing to count from",
  qualifiesForRetention({ subscriptionStartedAt: subStart, firstPaymentAt: null, subscription: ACTIVE, now: day60 }).reason ===
    "no_first_payment",
);
ok(
  "a cancelled subscription does not qualify",
  !qualifiesForRetention({
    subscriptionStartedAt: subStart,
    firstPaymentAt: firstPaid,
    subscription: { ...ACTIVE, canceledAt: new Date("2026-07-01") },
    now: day60,
  }).qualifies,
);
ok(
  "past_due is not 'still paying' — their card is declining right now",
  !qualifiesForRetention({
    subscriptionStartedAt: subStart,
    firstPaymentAt: firstPaid,
    subscription: { ...ACTIVE, status: "past_due" },
    now: day60,
  }).qualifies,
);
ok(
  "trialing is not 'still paying' either",
  !qualifiesForRetention({
    subscriptionStartedAt: subStart,
    firstPaymentAt: firstPaid,
    subscription: { ...ACTIVE, status: "trialing" },
    now: day60,
  }).qualifies,
);
// The gap that made this milestone unevaluable until this session.
ok(
  "a refunded subscription does not qualify",
  qualifiesForRetention({
    subscriptionStartedAt: subStart,
    firstPaymentAt: firstPaid,
    subscription: { ...ACTIVE, refundedAmountCents: 9900, refundedAt: new Date("2026-07-02") },
    now: day60,
  }).reason === "refunded",
);
ok(
  "a LOST chargeback does not qualify",
  qualifiesForRetention({
    subscriptionStartedAt: subStart,
    firstPaymentAt: firstPaid,
    subscription: { ...ACTIVE, disputeStatus: "lost" },
    now: day60,
  }).reason === "chargeback",
);
// An open dispute may still be won. Denying it would be as wrong as paying it.
const open = qualifiesForRetention({
  subscriptionStartedAt: subStart,
  firstPaymentAt: firstPaid,
  subscription: { ...ACTIVE, disputeStatus: "warning_needs_response" },
  now: day60,
});
ok("an OPEN dispute is held, not denied", !open.qualifies && open.holdUntilResolved === true);
ok(
  "a dispute WON does not block the milestone",
  qualifiesForRetention({
    subscriptionStartedAt: subStart,
    firstPaymentAt: firstPaid,
    subscription: { ...ACTIVE, disputeStatus: "won" },
    now: day60,
  }).qualifies,
);
// Annual billing is live, and an annual subscriber has made NO second payment
// at day 60. A "have they paid again" test would deny every annual sale.
ok(
  "an annual subscriber qualifies at 60 days despite no second payment",
  qualifiesForRetention({
    subscriptionStartedAt: subStart,
    firstPaymentAt: firstPaid,
    subscription: { ...ACTIVE, billingInterval: "year" },
    now: day60,
  }).qualifies,
);
ok(
  "a configurable window is honoured, not hard-coded to 60",
  !qualifiesForRetention({
    subscriptionStartedAt: subStart,
    firstPaymentAt: firstPaid,
    subscription: ACTIVE,
    retentionDays: 90,
    now: day60,
  }).qualifies,
);

// The bug this catches: anchoring on first payment instead of subscription
// start pays roughly a trial-length late. At day 60 from signup the customer
// has paid once, thirty days ago — a first-payment anchor would say "too
// early" and hold the milestone for another month.
ok(
  "the clock runs from SUBSCRIPTION START, not first payment",
  qualifiesForRetention({
    subscriptionStartedAt: subStart,
    firstPaymentAt: firstPaid,
    subscription: ACTIVE,
    now: day60,
  }).qualifies,
);
ok(
  "no subscription start means no clock at all",
  qualifiesForRetention({
    subscriptionStartedAt: null,
    firstPaymentAt: firstPaid,
    subscription: ACTIVE,
    now: day60,
  }).reason === "no_subscription_start",
);
// A trial is INCLUDED in the sixty days, so a customer 45 days past signup and
// 15 days past their first charge has not reached it.
ok(
  "the trial counts toward the sixty days",
  !qualifiesForRetention({
    subscriptionStartedAt: subStart,
    firstPaymentAt: firstPaid,
    subscription: ACTIVE,
    now: new Date("2026-07-16T00:00:00Z"),
  }).qualifies,
);

console.log("\nCommission amounts are flat — $20 / $40 / $65, total $125");
ok("activation is $20", amountForMilestone(PLAN, MILESTONES.ACTIVATION) === 2000);
ok("first payment is $40", amountForMilestone(PLAN, MILESTONES.FIRST_PAYMENT) === 4000);
ok("retention is $65", amountForMilestone(PLAN, MILESTONES.RETENTION) === 6500);
// One payment for one acquisition, staged. Not three separate jobs.
ok(
  "the three stages total $125",
  amountForMilestone(PLAN, MILESTONES.ACTIVATION) +
    amountForMilestone(PLAN, MILESTONES.FIRST_PAYMENT) +
    amountForMilestone(PLAN, MILESTONES.RETENTION) ===
    12500,
);
ok("a departed rep still earns a milestone their company reaches", departedRepStillEarns());

console.log("\nIdempotency keys");
ok(
  "one key per company per milestone",
  commissionRef("c1", MILESTONES.ACTIVATION) === "commission:c1:activation",
);
ok(
  "two milestones on one company do not collide",
  commissionRef("c1", MILESTONES.ACTIVATION) !== commissionRef("c1", MILESTONES.FIRST_PAYMENT),
);
ok(
  "two companies on one milestone do not collide",
  commissionRef("c1", MILESTONES.ACTIVATION) !== commissionRef("c2", MILESTONES.ACTIVATION),
);
// The pair IS the history: both rows must be able to exist.
ok(
  "a reversal has its own namespace, so it can coexist with what it reverses",
  reversalRef("c1", MILESTONES.ACTIVATION) !== commissionRef("c1", MILESTONES.ACTIVATION),
);

console.log("\nAmounts");
ok("activation reads from the plan", amountForMilestone(PLAN, MILESTONES.ACTIVATION) === 2000);
ok("first payment reads from the plan", amountForMilestone(PLAN, MILESTONES.FIRST_PAYMENT) === 4000);
ok("retention reads from the plan", amountForMilestone(PLAN, MILESTONES.RETENTION) === 6500);
ok("an unknown milestone has no amount", amountForMilestone(PLAN, "bonus") === null);
// A guessed default would pay an invented figure, which is worse than paying
// late — the console shows the missing plan and a human sets it.
ok("no plan means no amount, never a default", amountForMilestone(null, MILESTONES.ACTIVATION) === null);

console.log("\nBalance is summed, never stored");
ok("an empty ledger is zero", balanceCents([]) === 0);
ok("nonsense input is zero", balanceCents(null) === 0);
ok(
  "a reversal falls out of the same sum with no special case",
  balanceCents([{ amountCents: 2000 }, { amountCents: -2000 }]) === 0,
);
ok(
  "earnings add",
  balanceCents([{ amountCents: 2000 }, { amountCents: 4000 }, { amountCents: 6500 }]) === 12500,
);
ok("a malformed row does not poison the sum", balanceCents([{ amountCents: 2000 }, {}]) === 2000);

const split = splitPayable([
  { amountCents: 2000, payoutBatchId: null },
  { amountCents: 4000, payoutBatchId: null },
  { amountCents: 6500, payoutBatchId: "batch1" },
]);
ok("what is payable excludes what is already batched", split.payableCents === 6000, String(split.payableCents));
ok("and reports the batched total separately", split.batchedCents === 6500);
// A reversal landing after a batch closed must reduce what is payable NEXT,
// rather than silently reopening a closed batch.
const afterReversal = splitPayable([
  { amountCents: 6500, payoutBatchId: "batch1" },
  { amountCents: -6500, payoutBatchId: null },
]);
ok(
  "a reversal after a batch closed reduces the NEXT payout",
  afterReversal.payableCents === -6500,
  String(afterReversal.payableCents),
);

// ── The wiring ────────────────────────────────────────────────────────────
//
// The rules above are worthless if a webhook re-implements them by hand. These
// assertions are about WHERE they are called from, and each is scoped to one
// named function, because a guard string matching elsewhere in the same file
// is a false pass — that happened earlier in this work and a check that cannot
// fail reads as proof.
function fnBody(file, name) {
  const src = readFileSync(file, "utf8");
  const m = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b`).exec(src);
  if (!m) return null;
  const next = src.indexOf("\nexport ", m.index + m[0].length);
  return src.slice(m.index, next === -1 ? src.length : next);
}

console.log("\nWhere the rules are called from");

const billing = fnBody("lib/platform/stripeBilling.js", "syncSubscriptionFromStripeEvent");
ok("the billing webhook exists to check", billing !== null);
ok(
  "milestone 2 calls qualifiesForFirstPayment rather than re-deriving it",
  billing?.includes("qualifiesForFirstPayment(obj)"),
);
// The whole point of the shared rule: a hand-rolled condition here could
// satisfy billing_reason and forget amount_paid, paying on a free month.
ok(
  "and does NOT hand-roll billing_reason for the milestone",
  !/earnMilestone[\s\S]{0,400}billing_reason/.test(billing || ""),
);
ok(
  "an out-of-order invoice is LOGGED, not silently dropped",
  /found no subscription row/.test(billing || ""),
);
ok(
  "the milestone cannot break the webhook that syncs billing state",
  /earnMilestone\([\s\S]{0,600}\.catch\(/.test(billing || ""),
);

const connect = fnBody("app/api/stripe/webhook/route.js", "POST");
ok("the Connect webhook exists to check", connect !== null);
ok(
  "milestone 1 is recorded from account.updated",
  connect?.includes("MILESTONES.ACTIVATION"),
);
// Read back from the row, so the column and the milestone cannot disagree.
ok(
  "and reads the stored column rather than trusting the event body alone",
  /company\?\.stripeChargesEnabled/.test(connect || ""),
);
ok(
  "milestone 1 never consults onboarding completeness",
  !/onboardingCompletedAt/.test(connect || ""),
);

const cronSrc = readFileSync("app/api/cron/sales-retention/route.js", "utf8");
ok("the retention sweep demands the cron secret", cronSrc.includes("requireCronSecret(request)"));
ok(
  "it refuses before doing any work",
  orderedIn(cronSrc, "requireCronSecret(request)", "salesCommissionEntry.findMany"),
);
ok(
  "it uses the shared rule rather than its own date maths",
  cronSrc.includes("qualifiesForRetention("),
);
ok(
  "it honours the plan's own window instead of hard-coding 60",
  cronSrc.includes("commissionPlan?.retentionDays"),
);
ok(
  "a held dispute is counted apart from a skip",
  cronSrc.includes("verdict.holdUntilResolved"),
);

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
ok(
  "the sweep is actually scheduled — an unscheduled cron never runs",
  (vercel.crons || []).some((c) => c.path === "/api/cron/sales-retention"),
);

console.log("");
if (failures.length) {
  console.error(`FAILED — ${failures.length} of ${passed + failures.length}`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} assertions`);
