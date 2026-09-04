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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  PLAN_MONEY_FIELDS,
  STANDARD_PLAN,
  centsFromDollars,
  dollarsFromCents,
  planDraftProblem,
  retentionDaysFrom,
  shapePlanInput,
} from "../lib/sales/commissionPlanAdmin.js";
import { resolvePlanAssignment } from "../lib/sales/commissionPlanServer.js";
import {
  MILESTONES,
  MILESTONE_LABELS,
  MILESTONE_ORDER,
  commissionRef,
  reversalRef,
  amountForMilestone,
  qualifiesForActivation,
  qualifiesForBillingCycle,
  qualifiesForRetention,
  balanceCents,
  splitPayable,
  departedRepStillEarns,
  earnMilestone,
  reverseMilestone,
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

console.log("\nMilestone 2 — the company reached its next billing cycle, free or paid");
//
// The invoice shapes below are the ones THIS account produces, not invented
// ones. Every subscription is opened by createTrialCheckoutSession /
// createBillingCheckoutSession with trial_period_days floored at 1, and
// TRIAL_PRICE is 0 so the one-time line is omitted — which is why the
// subscription_create invoice is always $0 and why the old rule (create AND
// amount_paid > 0) could never fire for anybody.

// Trial start. The invoice that LOOKS like the first one and is a full cycle
// too early — Stripe raises it with nothing billed and nothing collected.
const TRIAL_START = {
  billing_reason: "subscription_create",
  amount_paid: 0,
  amount_due: 0,
  subtotal: 0,
  total: 0,
  status: "paid",
};
// Trial ended, card charged. Solo monthly.
const PAID_CYCLE = {
  billing_reason: "subscription_cycle",
  amount_paid: 12900,
  amount_due: 12900,
  subtotal: 12900,
  total: 12900,
  starting_balance: 0,
};
// Trial ended, covered by a Stripe customer-balance credit. The company is on
// the meter and the meter rolled over; Stripe collected nothing.
const FREE_CYCLE = {
  billing_reason: "subscription_cycle",
  amount_paid: 0,
  amount_due: 0,
  subtotal: 12900,
  total: 12900,
  starting_balance: -12900,
  ending_balance: 0,
};
// A year, at the end of its trial. Same billing_reason, twelve times the money.
const ANNUAL_CYCLE = {
  billing_reason: "subscription_cycle",
  amount_paid: 129000,
  amount_due: 129000,
  subtotal: 129000,
  total: 129000,
};

ok("a paid cycle qualifies", qualifiesForBillingCycle(PAID_CYCLE));
ok(
  "a FREE cycle qualifies too — the boundary is the signal, not the money",
  qualifiesForBillingCycle(FREE_CYCLE),
);
ok("an annual subscriber's first cycle qualifies", qualifiesForBillingCycle(ANNUAL_CYCLE));
// The trap, and the reason milestone 2 had never paid anybody: this is the
// invoice the old rule named, and it is $0 on this account, always.
ok("trial start does NOT — it is the cycle opening, not turning", !qualifiesForBillingCycle(TRIAL_START));
ok(
  "and would not qualify even if that invoice somehow carried money",
  !qualifiesForBillingCycle({ ...TRIAL_START, amount_paid: 12900, subtotal: 12900 }),
);
// What replaced `amount_paid > 0`: a free cycle counts only if the cycle was
// WORTH something. An invoice that bills nothing is not a customer proving out.
ok(
  "a cycle that billed nothing at all does NOT qualify",
  !qualifiesForBillingCycle({ ...FREE_CYCLE, subtotal: 0, total: 0 }),
);
ok(
  "a 100%-off cycle DOES — the plan was priced, FieldQuo gave the money away",
  qualifiesForBillingCycle({ ...FREE_CYCLE, total: 0, starting_balance: 0 }),
);
ok(
  "money collected qualifies even if the payload carries no subtotal",
  qualifiesForBillingCycle({ billing_reason: "subscription_cycle", amount_paid: 12900 }),
);
ok(
  "a mid-cycle plan change does not — subscription_update is not a boundary",
  !qualifiesForBillingCycle({ billing_reason: "subscription_update", amount_paid: 4300, subtotal: 4300 }),
);
ok("a manual invoice does not", !qualifiesForBillingCycle({ billing_reason: "manual", amount_paid: 9900 }));
ok(
  "a non-numeric amount with no priced subtotal does not",
  !qualifiesForBillingCycle({ billing_reason: "subscription_cycle", amount_paid: "lots" }),
);
ok(
  "a non-numeric subtotal is not a price",
  !qualifiesForBillingCycle({ billing_reason: "subscription_cycle", amount_paid: 0, subtotal: "lots" }),
);
ok("nothing at all does not", !qualifiesForBillingCycle(null));
// A retry of a failed cycle charge is the SAME invoice arriving again. The
// predicate says yes to both, deliberately — paying once is the ledger's job,
// asserted against a real unique constraint further down.
ok("a retried cycle invoice still qualifies", qualifiesForBillingCycle({ ...PAID_CYCLE, attempt_count: 2 }));
ok("a redelivered trial-start invoice still does not", !qualifiesForBillingCycle({ ...TRIAL_START }));

console.log("\nThe label follows the rule");
ok(
  "milestone 2 is no longer labelled as a payment",
  !/payment/i.test(MILESTONE_LABELS[MILESTONES.FIRST_PAYMENT]),
  MILESTONE_LABELS[MILESTONES.FIRST_PAYMENT],
);
// Renaming the stored value would rewrite live rows and the refs that have
// already paid people. The label is what a human reads; the value is a key.
ok("but the stored value is unchanged", MILESTONES.FIRST_PAYMENT === "first_payment");

console.log("\nMilestone 3 — still paying after the window");
// The clock starts at SUBSCRIPTION START — trial included, per the owner's own
// wording: "$65 after the company still is subscribed after 60 days (including
// trial)". The first payment lands a month later because the first month is
// free, and anchoring on it would pay roughly a trial-length late.
const subStart = new Date("2026-06-01T00:00:00Z");
const day60 = new Date("2026-07-31T00:00:00Z");
const day59 = new Date("2026-07-29T00:00:00Z");
const ACTIVE = { status: "active", canceledAt: null, refundedAmountCents: 0, refundedAt: null, disputeStatus: null };

ok(
  "60 days on an active subscription qualifies",
  qualifiesForRetention({ subscriptionStartedAt: subStart, subscription: ACTIVE, now: day60 }).qualifies,
);
ok(
  "59 days does not",
  !qualifiesForRetention({ subscriptionStartedAt: subStart, subscription: ACTIVE, now: day59 }).qualifies,
);
// The condition that is GONE. It required a recorded first payment and
// justified itself with "a company sixty days in has necessarily been charged"
// — untrue once referral months push trial_end forward, and untrue in general
// while milestone 2 could not fire. A company that has never been charged but
// is active at day sixty earns this.
ok(
  "a company with no payment on record still qualifies if it is active at day 60",
  qualifiesForRetention({ subscriptionStartedAt: subStart, subscription: ACTIVE, now: day60 }).qualifies,
);
ok(
  "and the old refusal reason is gone entirely, not merely unused",
  qualifiesForRetention({ subscriptionStartedAt: subStart, subscription: ACTIVE, now: day60 }).reason !==
    "no_first_payment",
);
// What carries the weight instead: Stripe's own live status. A company sixty
// days into a referral-extended free run is HELD here, and the nightly sweep
// re-derives, so it earns the day it converts.
ok(
  "a company still on a free extended trial at day 60 is held on its status",
  qualifiesForRetention({
    subscriptionStartedAt: subStart,
    subscription: { ...ACTIVE, status: "trialing" },
    now: day60,
  }).reason === "status_trialing",
);
ok(
  "a cancelled subscription does not qualify",
  !qualifiesForRetention({
    subscriptionStartedAt: subStart,
    subscription: { ...ACTIVE, canceledAt: new Date("2026-07-01") },
    now: day60,
  }).qualifies,
);
ok(
  "past_due is not 'still paying' — their card is declining right now",
  !qualifiesForRetention({
    subscriptionStartedAt: subStart,
    subscription: { ...ACTIVE, status: "past_due" },
    now: day60,
  }).qualifies,
);
ok(
  "trialing is not 'still paying' either",
  !qualifiesForRetention({
    subscriptionStartedAt: subStart,
    subscription: { ...ACTIVE, status: "trialing" },
    now: day60,
  }).qualifies,
);
// The gap that made this milestone unevaluable until this session.
ok(
  "a refunded subscription does not qualify",
  qualifiesForRetention({
    subscriptionStartedAt: subStart,
    subscription: { ...ACTIVE, refundedAmountCents: 9900, refundedAt: new Date("2026-07-02") },
    now: day60,
  }).reason === "refunded",
);
ok(
  "a LOST chargeback does not qualify",
  qualifiesForRetention({
    subscriptionStartedAt: subStart,
    subscription: { ...ACTIVE, disputeStatus: "lost" },
    now: day60,
  }).reason === "chargeback",
);
// An open dispute may still be won. Denying it would be as wrong as paying it.
const open = qualifiesForRetention({
  subscriptionStartedAt: subStart,
  subscription: { ...ACTIVE, disputeStatus: "warning_needs_response" },
  now: day60,
});
ok("an OPEN dispute is held, not denied", !open.qualifies && open.holdUntilResolved === true);
ok(
  "a dispute WON does not block the milestone",
  qualifiesForRetention({
    subscriptionStartedAt: subStart,
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
    subscription: { ...ACTIVE, billingInterval: "year" },
    now: day60,
  }).qualifies,
);
// The whole annual path, end to end, at the day the sweep would look: their
// trial ended into ONE subscription_cycle invoice covering twelve months, which
// is what earns milestone 2 — and milestone 3 is measured from subscription
// start regardless, so day 60 finds them active with no second invoice due for
// another ten months.
ok(
  "an annual subscriber at day 60: cycle invoice earned M2, and M3 is due",
  qualifiesForBillingCycle(ANNUAL_CYCLE) &&
    qualifiesForRetention({
      subscriptionStartedAt: subStart,
      subscription: { ...ACTIVE, billingInterval: "year" },
      now: day60,
    }).qualifies,
);
ok(
  "a configurable window is honoured, not hard-coded to 60",
  !qualifiesForRetention({
    subscriptionStartedAt: subStart,
    subscription: ACTIVE,
    retentionDays: 90,
    now: day60,
  }).qualifies,
);

// The bug this catches: anchoring on the first payment instead of subscription
// start pays roughly a trial-length late. Sixty days after the FIRST CHARGE is
// day 90 from signup, and the milestone the owner defined at day 60 would sit
// unpaid for a month. The clock must not move when the charge date moves, so
// the assertion holds the charge date at arm's length and varies only `now`.
const day90 = new Date("2026-08-30T00:00:00Z");
ok(
  "the clock runs from SUBSCRIPTION START — day 60 pays, not day 90",
  qualifiesForRetention({ subscriptionStartedAt: subStart, subscription: ACTIVE, now: day60 }).qualifies &&
    !qualifiesForRetention({
      // A first-payment anchor would be this date: trial ends, card charged.
      subscriptionStartedAt: new Date("2026-07-01T00:00:00Z"),
      subscription: ACTIVE,
      now: day60,
    }).qualifies &&
    qualifiesForRetention({
      subscriptionStartedAt: new Date("2026-07-01T00:00:00Z"),
      subscription: ACTIVE,
      now: day90,
    }).qualifies,
);
ok(
  "no subscription start means no clock at all",
  qualifiesForRetention({
    subscriptionStartedAt: null,
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
// The ref is one per company per MILESTONE and carries nothing about the event
// that triggered it. That is what makes "every cycle invoice qualifies" safe.
ok(
  "the ref says nothing about which invoice or event earned it",
  commissionRef("c1", MILESTONES.FIRST_PAYMENT) === "commission:c1:first_payment",
);

// ── The ledger, executed against a real unique constraint ─────────────────
//
// Everything above is a predicate. The rule that stops a cycle paying twice
// lives in the DATABASE, so this stands a fake Postgres up — one that enforces
// unique (companyId, ref) and throws Prisma's P2002 — and drives earnMilestone
// through the sequences Stripe actually delivers. A mutation that lets the same
// cycle pay twice (keying the ref on the invoice or the event, say) passes
// every predicate assertion in this file and fails here.
console.log("\nPaying twice is impossible, against a fake unique index");

function fakeLedger({ plan = PLAN, attributed = true } = {}) {
  const rows = [];
  return {
    rows,
    salesAttribution: {
      findUnique: async () => (attributed ? { salesRepId: "rep1" } : null),
    },
    salesRep: {
      findUnique: async () => ({ id: "rep1", commissionPlan: plan }),
    },
    salesCommissionEntry: {
      create: async ({ data }) => {
        if (rows.some((r) => r.companyId === data.companyId && r.ref === data.ref)) {
          const err = new Error("Unique constraint failed on the fields: (companyId, ref)");
          err.code = "P2002";
          throw err;
        }
        const row = { id: `row${rows.length + 1}`, ...data };
        rows.push(row);
        return row;
      },
      findFirst: async ({ where }) =>
        rows.find((r) => r.companyId === where.companyId && r.ref === where.ref) || null,
    },
  };
}

// A cycle charge that failed and was retried: the SAME invoice succeeding on a
// second attempt, delivered as a second event with a different event id.
{
  const ledger = fakeLedger();
  const earn = (stripeEventId) =>
    earnMilestone({
      companyId: "c1",
      milestone: MILESTONES.FIRST_PAYMENT,
      stripeEventId,
      occurredAt: new Date("2026-07-01T00:00:00Z"),
      prisma: ledger,
    });
  const first = await earn("evt_1");
  const retry = await earn("evt_2");
  ok("a retried cycle writes ONE row", ledger.rows.length === 1, `rows=${ledger.rows.length}`);
  ok("and the second delivery returns the first row rather than throwing", retry?.id === first.id);
  ok("so the rep is paid $40 once, not twice", balanceCents(ledger.rows) === 4000, String(balanceCents(ledger.rows)));
}

// Next month's cycle invoice is a DIFFERENT invoice that also satisfies the
// predicate. Milestone 2 is once per company, ever — this is the case that the
// old `subscription_create` filter used to handle by accident and that the ref
// now has to handle on purpose.
{
  const ledger = fakeLedger();
  for (const month of ["2026-07-01", "2026-08-01", "2026-09-01"]) {
    ok(`month ${month.slice(0, 7)} is a qualifying cycle invoice`, qualifiesForBillingCycle(PAID_CYCLE));
    await earnMilestone({
      companyId: "c1",
      milestone: MILESTONES.FIRST_PAYMENT,
      occurredAt: new Date(`${month}T00:00:00Z`),
      prisma: ledger,
    });
  }
  ok("three cycles, one row", ledger.rows.length === 1, `rows=${ledger.rows.length}`);
  ok("and it keeps the FIRST cycle's date", ledger.rows[0].occurredAt.toISOString().startsWith("2026-07-01"));
}

// A milestone earned on a FREE cycle reverses exactly like one earned on a paid
// one: the reversal reads the amount off the original row and knows nothing
// about what triggered it. The pair is the history, so both rows survive.
{
  const ledger = fakeLedger();
  ok("the free cycle qualifies", qualifiesForBillingCycle(FREE_CYCLE));
  await earnMilestone({
    companyId: "c1",
    milestone: MILESTONES.FIRST_PAYMENT,
    occurredAt: new Date("2026-07-01T00:00:00Z"),
    prisma: ledger,
  });
  const undo = await reverseMilestone({
    companyId: "c1",
    milestone: MILESTONES.FIRST_PAYMENT,
    reason: "refund",
    occurredAt: new Date("2026-07-10T00:00:00Z"),
    prisma: ledger,
  });
  ok("a free-cycle earning reverses for its full amount", undo?.amountCents === -4000, String(undo?.amountCents));
  ok("the earning is NOT edited — both rows stand", ledger.rows.length === 2);
  ok("the original keeps its status and amount", ledger.rows[0].status === "earned" && ledger.rows[0].amountCents === 4000);
  ok("and the pair nets to zero", balanceCents(ledger.rows) === 0);
  const again = await reverseMilestone({
    companyId: "c1",
    milestone: MILESTONES.FIRST_PAYMENT,
    reason: "refund",
    prisma: ledger,
  });
  ok("a reversal delivered twice does not double-negate", ledger.rows.length === 2 && again.id === undo.id);
}

// Nothing is written for a company no rep brought in — the normal, permanent
// state for every company that predates the sales portal.
{
  const ledger = fakeLedger({ attributed: false });
  const entry = await earnMilestone({
    companyId: "c1",
    milestone: MILESTONES.FIRST_PAYMENT,
    prisma: ledger,
  });
  ok("an unattributed company earns nobody anything", entry === null && ledger.rows.length === 0);
}

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
  "milestone 2 calls qualifiesForBillingCycle rather than re-deriving it",
  billing?.includes("qualifiesForBillingCycle(obj)"),
);
// The whole point of the shared rule: a hand-rolled condition here could
// satisfy billing_reason and miss what replaced the amount check.
ok(
  "and does NOT hand-roll billing_reason for the milestone",
  !/earnMilestone[\s\S]{0,400}billing_reason/.test(billing || ""),
);
// The old rule named the invoice that OPENS the subscription. That invoice is
// $0 on this account, always, so a milestone waiting for it waits forever.
// Asserted on the rule's own body (the doc comment above it discusses the old
// filter at length, and a needle that matches prose proves nothing).
const cycleRule = fnBody("lib/sales/commission.js", "qualifiesForBillingCycle");
ok("the rule exists to check", cycleRule !== null);
ok("it tests for a cycle boundary", cycleRule?.includes('"subscription_cycle"'));
ok(
  "and never accepts the trial-start invoice",
  cycleRule !== null && !cycleRule.includes("subscription_create"),
);
// Stripe's clock, never ours — a replay months later must not move the row.
ok(
  "the earning is dated from Stripe and never from new Date()",
  /occurredAt:[\s\S]{0,400}obj\.created/.test(billing || "") &&
    !/occurredAt:[\s\S]{0,200}new Date\(\)/.test(billing || ""),
);
ok(
  "an out-of-order invoice is LOGGED, not silently dropped",
  /found no subscription row/.test(billing || ""),
);
// Matched to the closing of the CALL rather than within a character window: a
// window is a number that has to be raised every time the comment above the
// call grows, and raising it is indistinguishable from loosening the check.
ok(
  "the milestone cannot break the webhook that syncs billing state",
  /earnMilestone\(\{[\s\S]*?\}\)\.catch\(/.test(billing || ""),
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
  orderedIn(cronSrc, "requireCronSecret(request)", "salesAttribution.findMany"),
);
ok(
  "it uses the shared rule rather than its own date maths",
  cronSrc.includes("qualifiesForRetention("),
);
// The dependency that made milestone 3 unreachable: the sweep read milestone
// 2's ledger rows as its input set, so a company that never produced one was
// invisible no matter how long it stayed. It reads attributions now.
ok(
  "its input set is attributions, not milestone-2 ledger rows",
  cronSrc.includes("db.salesAttribution.findMany") &&
    !/findMany\(\{[\s\S]{0,200}MILESTONES\.FIRST_PAYMENT/.test(cronSrc),
);
ok(
  "and it no longer passes a first payment into the rule",
  !cronSrc.includes("firstPaymentAt"),
);
// Not moved. The owner's wording is "still subscribed after 60 days (including
// trial)", and Subscription.createdAt is the row written at trial start.
ok(
  "the clock is still Subscription.createdAt",
  /subscriptionStartedAt: subscription\?\.createdAt/.test(cronSrc),
);
// A reversed retention entry must not be re-earned by tomorrow's sweep.
ok(
  "a company with ANY retention entry is excluded, reversed ones included",
  /none: \{ milestone: MILESTONES\.RETENTION \}/.test(cronSrc),
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

// ── The plan itself: can one be MADE? ─────────────────────────────────────
//
// Everything above this line proved the commission rules correct. None of it
// proved a plan could exist, and on 2026-09-04 none could:
// `salesCommissionPlan.create` appeared nowhere in the repository — no route,
// no screen, no seed — while amountForMilestone() returns null without a plan
// and earnMilestone() refuses a null amount. Every milestone earned $0 for
// every rep, silently, and the live database held zero plans and zero reps.
//
// So these assertions are about REACHABILITY, in the manner of
// check-route-callers.mjs and check-designer-reach.mjs: not "is the create
// correct" but "is there a path a human can walk to it". A hundred and one
// assertions of correctness could not see this, and that is the lesson worth
// encoding rather than the feature.
console.log("\nA commission plan can actually be created");

const PLANS_ROUTE = "app/api/platform/sales/plans/route.js";
const PLAN_ID_ROUTE = "app/api/platform/sales/plans/[id]/route.js";
const PLANS_PAGE = "app/platform/sales/plans/page.js";
const REPS_PAGE = "app/platform/sales/reps/page.js";
const SIDEBAR = "app/components/platform/PlatformSidebar.js";

const readIfPresent = (f) => (existsSync(f) ? readFileSync(f, "utf8") : null);

// Comment lines dropped before anything is searched, and for the reason
// check-route-callers.mjs learned the hard way: a file whose header EXPLAINS
// which route it calls is not a file calling it. This whole section would pass
// on prose otherwise — every one of these files discusses the route at length.
const stripComments = (src) =>
  (src || "")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join("\n");

const plansRoute = stripComments(readIfPresent(PLANS_ROUTE));
ok("the create route exists", plansRoute !== null && plansRoute !== "");
ok("it exports POST", /export async function POST\(/.test(plansRoute));
// Scoped to POST's own body, not to the file. Mutation testing caught the
// file-wide version passing with the gate deleted from POST entirely — GET's
// call to superadminOrRefusal sat above the create and satisfied the ordering.
// That is the same false pass this file's `fnBody` comment already records
// having been bitten by once.
const plansPost = stripComments(fnBody(PLANS_ROUTE, "POST") || "");
ok(
  "and POST actually writes a plan row",
  /salesCommissionPlan\.create\(/.test(plansPost),
);
ok(
  "the write is superadmin-gated BEFORE it happens",
  orderedIn(plansPost, "superadminOrRefusal(request)", "salesCommissionPlan.create("),
);
const planIdPatch = stripComments(fnBody(PLAN_ID_ROUTE, "PATCH") || "");
ok(
  "editing a plan is gated the same way, before the update",
  orderedIn(planIdPatch, "superadminOrRefusal(request)", "salesCommissionPlan.update("),
);
ok(
  "there is no DELETE on a plan — deactivating is the whole of removal",
  !/export async function DELETE\(/.test(plansRoute) &&
    !/export async function DELETE\(/.test(stripComments(readIfPresent(PLAN_ID_ROUTE))),
);

// ── Does anything CALL it ─────────────────────────────────────────────────
//
// The assertion this codebase was missing. Its shape is check-route-callers':
// the route's URL appearing in a .js outside app/api, with comments removed.
// Deliberately a whole-tree search rather than a look at one file, so moving
// the screen does not break it and deleting the screen does.
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

const outsideApi = walk("app")
  .concat(walk("lib"))
  .filter((f) => !f.startsWith(join("app", "api") + "/"));
const callerSrc = outsideApi.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");

ok(
  "something outside app/api calls /api/platform/sales/plans",
  callerSrc.includes("/api/platform/sales/plans"),
);
const plansPage = stripComments(readIfPresent(PLANS_PAGE));
ok("the screen exists", plansPage !== null && plansPage !== "");
ok(
  "and it POSTs to the create route",
  /fetchJson\("\/api\/platform\/sales\/plans",\s*\{[\s\S]{0,120}method: "POST"/.test(plansPage),
);
ok(
  "the screen is reachable from the console's own nav",
  stripComments(readIfPresent(SIDEBAR)).includes('href: "/platform/sales/plans"'),
);
// Reaching the create form must not depend on being able to guess a URL, and
// a control that renders for somebody the route will refuse is the dead button
// AGENTS.md forbids. The shared gate is used rather than a sixth hand-rolled
// copy — see app/components/platform/PlatformWriteGate.js's header.
ok(
  "the screen gates its controls with the SHARED write gate",
  plansPage.includes("usePlatformAdmin()") && plansPage.includes("<PlatformWriteGate"),
);
ok(
  "and it never hand-rolls /api/platform/me",
  !plansPage.includes('"/api/platform/me"'),
);

// ── And can a plan be ASSIGNED ────────────────────────────────────────────
//
// A plan nobody is on pays nothing, so "created" is only half the path. The
// reps route READ commissionPlan.name to display it and had no writer at all,
// which is the same defect one layer down.
console.log("\nA plan can actually be assigned to a rep");
const repsPage = stripComments(readIfPresent(REPS_PAGE));
const repsRoute = stripComments(readIfPresent("app/api/platform/sales/reps/route.js"));
const repRoute = stripComments(readIfPresent("app/api/platform/sales/reps/[id]/route.js"));
ok("the reps screen sends a commissionPlanId", repsPage.includes("commissionPlanId"));
ok(
  "the reps screen offers the plans the route returns",
  repsPage.includes("data.plans") && repsPage.includes("planOptionLabel"),
);
ok(
  "creating a rep stores the plan chosen",
  /commissionPlanId: assignment\.commissionPlanId/.test(repsRoute),
);
ok(
  "editing a rep can change it",
  repRoute.includes("resolvePlanAssignment(") &&
    /commissionPlanId: assignment\.commissionPlanId/.test(repRoute),
);
// `null` is "no plan", which is a real and expensive state. A truthiness test
// would collapse "leave it alone" and "clear it" into one request — the same
// mistake the workEmail handler avoids two fields up, for the same reason.
ok(
  "clearing a plan is distinguished from not mentioning it",
  repRoute.includes('"commissionPlanId" in body'),
);
ok(
  "the list route returns the id, not only the name a picker cannot use",
  /commissionPlanId: r\.commissionPlanId/.test(repsRoute),
);

// ── Dollars in the box, cents in the column ───────────────────────────────
//
// Executed, not read. Every refusal below is a way a wrong number could reach
// an Int column looking like a decision, and the first one is the bug
// lib/platform/numericField.js exists for: Number("") is 0, and 0 is finite.
console.log("\nThe dollars → cents boundary, executed");
ok("a plain figure converts", centsFromDollars("20").cents === 2000);
ok("cents survive", centsFromDollars("20.50").cents === 2050);
ok("one cent is one cent", centsFromDollars("0.01").cents === 1);
// 20.10 * 100 is 2010.0000000000002 in IEEE 754. A strict integer test here
// would refuse a perfectly ordinary amount.
ok("floating point does not refuse a real amount", centsFromDollars("20.10").cents === 2010);
ok("a number, not only a string, converts", centsFromDollars(65).cents === 6500);
ok("a cleared box is refused, never read as zero", Boolean(centsFromDollars("").error));
ok("whitespace is refused too", Boolean(centsFromDollars("   ").error));
ok("null is refused", Boolean(centsFromDollars(null).error));
// Number([]) and Number(false) are both 0. numberOrNull is narrower than
// Number() precisely so none of them can arrive looking like a figure.
ok("an empty array is refused", Boolean(centsFromDollars([]).error));
ok("false is refused", Boolean(centsFromDollars(false).error));
ok(
  "the refusal for a blank field says blank is not zero",
  /empty box is not the same as 0/.test(centsFromDollars("").error),
);
ok("zero is refused", Boolean(centsFromDollars("0").error));
ok(
  "and the refusal explains that $0 writes no ledger row at all",
  /writes no ledger row/.test(centsFromDollars("0").error),
);
ok("a negative amount is refused", Boolean(centsFromDollars("-5").error));
ok("exponent notation is refused", Boolean(centsFromDollars("1e3").error));
ok("a third of a cent is refused rather than rounded", Boolean(centsFromDollars("20.005").error));
ok("nonsense is refused", Boolean(centsFromDollars("twenty").error));
ok("an absurd figure is refused", Boolean(centsFromDollars("100001").error));
ok("the bound itself is allowed", centsFromDollars("100000").cents === 10000000);

ok("a retention window converts", retentionDaysFrom("60").days === 60);
ok("a blank window is refused", Boolean(retentionDaysFrom("").error));
ok("a zero window is refused", Boolean(retentionDaysFrom("0").error));
ok("half a day is refused", Boolean(retentionDaysFrom("1.5").error));
ok("a negative window is refused", Boolean(retentionDaysFrom("-60").error));
ok("a century is refused", Boolean(retentionDaysFrom("40000").error));

// The whole body, the way the route receives it.
{
  const shaped = shapePlanInput({
    name: "  Standard closer plan  ",
    activation: "20",
    firstPayment: "40",
    retention: "65",
    retentionDays: "60",
  });
  ok("a complete body shapes into the four columns", !shaped.error, shaped.error);
  ok("the name is trimmed", shaped.value?.name === "Standard closer plan");
  ok(
    "and every amount lands in the column that pays its milestone",
    shaped.value?.activationCents === 2000 &&
      shaped.value?.firstPaymentCents === 4000 &&
      shaped.value?.retentionCents === 6500 &&
      shaped.value?.retentionDays === 60,
  );
}
ok(
  "a missing amount refuses the whole save",
  Boolean(shapePlanInput({ name: "x", activation: "20", retention: "65", retentionDays: "60" }).error),
);
ok("a nameless plan is refused", Boolean(shapePlanInput({ name: "  " }).error));
// PATCH: only what was sent is converted, so renaming a plan cannot rewrite
// three amounts with a stale copy of the form.
{
  const partial = shapePlanInput({ name: "Renamed" }, { partial: true });
  ok("a partial edit converts only what it was given", !partial.error);
  ok("and touches nothing else", Object.keys(partial.value).join(",") === "name");
}
ok(
  "an empty edit is refused rather than written as a no-op",
  shapePlanInput({}, { partial: true }).error === "Nothing to change.",
);
ok(
  "a partial edit still refuses a cleared amount",
  Boolean(shapePlanInput({ activation: "" }, { partial: true }).error),
);
// The screen must refuse in the server's own words. Two wordings for one rule
// is two rules pretending to be one — lib/sales/repAdmin.js's discipline.
ok(
  "the screen's refusal is literally the server's refusal",
  planDraftProblem({ name: "x", activation: "", firstPayment: "40", retention: "65", retentionDays: "60" }) ===
    shapePlanInput({ name: "x", activation: "", firstPayment: "40", retention: "65", retentionDays: "60" }).error,
);
ok(
  "a valid draft has no problem to report",
  planDraftProblem({ ...STANDARD_PLAN }) === null,
);

// The mapping that is invisible on screen and only shows up in somebody's
// payout: the box labelled "activation" must write the column amountForMilestone
// reads for the activation milestone.
for (const field of PLAN_MONEY_FIELDS) {
  ok(
    `the ${field.dollarKey} box feeds the ${field.milestone} milestone`,
    amountForMilestone({ [field.key]: 1234 }, field.milestone) === 1234,
  );
}
ok(
  "the money fields cover every milestone, and no more",
  PLAN_MONEY_FIELDS.map((f) => f.milestone).join(",") === MILESTONE_ORDER.join(","),
);

// The owner's stated terms, offered by the screen as a one-click prefill.
{
  const shaped = shapePlanInput({ ...STANDARD_PLAN });
  ok(
    "the standard prefill is $20 / $40 / $65 at 60 days",
    shaped.value?.activationCents === 2000 &&
      shaped.value?.firstPaymentCents === 4000 &&
      shaped.value?.retentionCents === 6500 &&
      shaped.value?.retentionDays === 60,
  );
  ok(
    "which is the $125 the three stages are supposed to total",
    shaped.value.activationCents + shaped.value.firstPaymentCents + shaped.value.retentionCents === 12500,
  );
}
// The inverse, used to fill the edit form. A screen dividing by 100 itself is
// the second opinion that ends up disagreeing about a factor of a hundred.
ok("cents come back as dollars for the form", dollarsFromCents(6500) === "65.00");
ok("and a round trip is lossless", centsFromDollars(dollarsFromCents(2050)).cents === 2050);

// ── Editing a plan cannot change what was already earned ─────────────────
//
// "Edit the plan, and last month's payouts change" only surfaces on a payout
// run, so it is asserted rather than trusted. It holds because the AMOUNT
// lives on the entry: earnMilestone writes amountCents at earn time and every
// total downstream is a sum of rows.
console.log("\nEditing a plan does not rewrite history");
{
  const plan = { ...PLAN };
  const ledger = fakeLedger({ plan });
  await earnMilestone({
    companyId: "c1",
    milestone: MILESTONES.ACTIVATION,
    occurredAt: new Date("2026-07-01T00:00:00Z"),
    prisma: ledger,
  });
  ok("the milestone was earned at the plan's figure", ledger.rows[0].amountCents === 2000);

  // The superadmin doubles activation. Same plan row, same rep, same company.
  plan.activationCents = 4000;

  ok(
    "the entry keeps the amount it was written with",
    ledger.rows[0].amountCents === 2000,
    String(ledger.rows[0].amountCents),
  );
  ok("so the balance does not move", balanceCents(ledger.rows) === 2000);
  ok("and what is payable does not move", splitPayable(ledger.rows).payableCents === 2000);

  // The NEXT milestone pays the new figure — that is the point of editing.
  await earnMilestone({
    companyId: "c2",
    milestone: MILESTONES.ACTIVATION,
    occurredAt: new Date("2026-08-01T00:00:00Z"),
    prisma: ledger,
  });
  ok("while the next company earns the new one", ledger.rows[1].amountCents === 4000);

  // A reversal reads the ORIGINAL row, never today's plan. Otherwise an edit
  // between an earning and its refund would net to something other than zero.
  const undo = await reverseMilestone({
    companyId: "c1",
    milestone: MILESTONES.ACTIVATION,
    reason: "refund",
    prisma: ledger,
  });
  ok("a reversal undoes what was earned, not what the plan says now", undo.amountCents === -2000);
}
const planIdRoute = stripComments(readIfPresent(PLAN_ID_ROUTE));
ok(
  "the edit route never touches the commission ledger",
  planIdRoute !== null && !planIdRoute.includes("salesCommissionEntry"),
);
ok(
  "nor does the create route",
  !plansRoute.includes("salesCommissionEntry"),
);
// The reporting side must not re-derive an amount from the plan either — that
// is the other way "last month changed" could happen.
ok(
  "performance sums ledger rows rather than re-reading the plan",
  !stripComments(readFileSync("lib/sales/performance.js", "utf8")).includes("amountForMilestone"),
);
// Deactivating a plan must not move anybody off it: what a rep was promised
// does not change when FieldQuo stops offering it to new hires.
{
  const fakeDb = {
    salesCommissionPlan: {
      findUnique: async ({ where }) =>
        where.id === "retired"
          ? { id: "retired", name: "Old plan", active: false }
          : where.id === "live"
            ? { id: "live", name: "Standard", active: true }
            : null,
    },
  };
  const clear = await resolvePlanAssignment({ db: fakeDb, planId: null });
  ok("a rep can be left with no plan on purpose", clear.commissionPlanId === null);
  const live = await resolvePlanAssignment({ db: fakeDb, planId: "live" });
  ok("an offered plan can be assigned", live.commissionPlanId === "live");
  const gone = await resolvePlanAssignment({ db: fakeDb, planId: "nope" });
  ok("a plan that does not exist is refused", Boolean(gone.error));
  const retiredNew = await resolvePlanAssignment({ db: fakeDb, planId: "retired" });
  ok("a deactivated plan cannot be given to somebody new", Boolean(retiredNew.error));
  const retiredOwn = await resolvePlanAssignment({
    db: fakeDb,
    planId: "retired",
    currentPlanId: "retired",
  });
  ok(
    "but a rep already on it keeps it — deactivating is not taking it away",
    retiredOwn.commissionPlanId === "retired",
  );
}

console.log("");
if (failures.length) {
  console.error(`FAILED — ${failures.length} of ${passed + failures.length}`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} assertions`);
