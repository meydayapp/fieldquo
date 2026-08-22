// scripts/check-revenue-outlook.mjs
//
//   npm run check:revenue-outlook
//
// The revenue outlook, executed against the exact shape of production today.
//
// The failure being guarded against is a confident wrong number. FieldQuo's
// dashboard reported $1,335 MRR while not one subscription could raise a
// charge, and reported "$473,558 invoiced" which was its customers' money.
// Every assertion below is a way that could happen again.
import { buildRevenueOutlook, isCollectable } from "../lib/platform/revenueOutlook.js";

let pass = 0;
const failures = [];
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}`); }
};

const NOW = new Date("2026-08-21T12:00:00Z");
const plan = (price, priceId = null, name = "Plan") => ({ name, priceMonthly: price, stripePriceId: priceId });
const sub = (o) => ({ stripeSubscriptionId: "sub_x", company: { name: "Co" }, ...o });

// Production today: five active, five trialing, every plan missing its price.
const PROD = [
  sub({ status: "active", plan: plan(45), company: { name: "Sunset Inc" } }),
  sub({ status: "active", plan: plan(400), company: { name: "Teacup Poodle" } }),
  sub({ status: "active", plan: plan(90), company: { name: "Black roofs" } }),
  sub({ status: "active", plan: plan(400), company: { name: "BRavo Test Inc" } }),
  sub({ status: "active", plan: plan(400), company: { name: "ttony inc" } }),
  sub({ status: "trialing", plan: plan(700), trialEndsAt: "2026-08-28" }),
  sub({ status: "trialing", plan: plan(400), trialEndsAt: "2026-09-10" }),
  sub({ status: "trialing", plan: plan(400), trialEndsAt: "2026-09-20" }),
  sub({ status: "trialing", plan: plan(90),  trialEndsAt: "2026-10-05" }),
  sub({ status: "trialing", plan: plan(45),  trialEndsAt: "2026-08-15" }),
];

console.log("\nProduction as it stands — the number that must not lie\n");
const o = buildRevenueOutlook(PROD, NOW);
check("nominal MRR is the $1,335 the dashboard shows", o.nominalMrr === 1335);
check("collectable MRR is zero", o.collectableMrr === 0);
check("annual run rate is zero, not $16,020", o.annualRunRate === 0);
check("all five active subs are named as blocked", o.blocked.length === 5);
check("the reason is the missing plan price, not a missing Stripe sub",
  o.blocked.every((b) => b.reason === "the plan has no Stripe price"));
check("blocked MRR equals nominal MRR", o.blockedMrr === 1335);
check("the 'nothing collectable' flag is raised", o.nothingCollectable === true);
check("this month expects nothing", o.thisMonth.expected === 0);
check("next month expects nothing", o.nextMonth.expected === 0);
check("but the nominal outlook is still reported alongside", o.thisMonth.nominal > 0);
check("the lapsed trial is counted", o.trials.lapsed === 1);

console.log("\nOnce the Stripe prices are added\n");
const FIXED = PROD.map((s) => ({ ...s, plan: { ...s.plan, stripePriceId: "price_123" } }));
const f = buildRevenueOutlook(FIXED, NOW);
check("collectable MRR becomes $1,335", f.collectableMrr === 1335);
check("annual run rate becomes $16,020", f.annualRunRate === 16020);
check("nothing is blocked", f.blocked.length === 0);
check("the flag clears", f.nothingCollectable === false);
// Trials ending 28 Aug and 15 Aug are inside this month → +700 +45.
check("this month adds the trials converting inside it", f.thisMonth.expected === 1335 + 745);
// September trials: 10th and 20th → +400 +400. October is beyond next month.
check("next month adds September's conversions", f.nextMonth.expected === 1335 + 745 + 800);
check("October's trial is not counted yet", f.nextMonth.expected !== 1335 + 745 + 800 + 90);
check("trial pipeline is now collectable", f.trials.collectableValue === 1635);

console.log("\nThe billability test both halves\n");
check("no Stripe sub → not collectable", !isCollectable(sub({ stripeSubscriptionId: null, plan: plan(45, "price_1") })));
check("no plan price → not collectable", !isCollectable(sub({ plan: plan(45, null) })));
check("both present → collectable", isCollectable(sub({ plan: plan(45, "price_1") })));
check("a zero-priced plan is not revenue", !isCollectable(sub({ plan: plan(0, "price_1") })));
check("a non-numeric price is not revenue", !isCollectable(sub({ plan: plan("abc", "price_1") })));
check("null subscription doesn't throw", isCollectable(null) === false);

console.log("\nHostile and empty input\n");
check("no subscriptions → all zeroes", buildRevenueOutlook([], NOW).collectableMrr === 0);
check("no subscriptions → flag NOT raised (nothing to be wrong about)",
  buildRevenueOutlook([], NOW).nothingCollectable === false);
check("null input doesn't throw", buildRevenueOutlook(null, NOW).nominalMrr === 0);
check("a trial with no end date is not counted as converting",
  buildRevenueOutlook([sub({ status: "trialing", plan: plan(400, "price_1") })], NOW).thisMonth.expected === 0);
check("a cancelled subscription is neither MRR nor pipeline",
  buildRevenueOutlook([sub({ status: "canceled", plan: plan(400, "price_1") })], NOW).nominalMrr === 0);
check("past_due is not counted as collectable",
  buildRevenueOutlook([sub({ status: "past_due", plan: plan(400, "price_1") })], NOW).collectableMrr === 0);

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
