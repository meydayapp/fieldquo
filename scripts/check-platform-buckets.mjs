// scripts/check-platform-buckets.mjs
//
//   npm run check:platform-buckets
//
// Every company number on /platform is a bucket from ONE classifier
// (lib/platform/trialCounting.js subscriberBucket; the names in
// lib/platform/subscriberBuckets.js). This file makes that impossible to
// quietly undo.
//
// ── Why it exists ─────────────────────────────────────────────────────────
//
// 2026-09-25: the owner read "Trialing subscriptions: 2" on /platform and
// said "I think we have 4". Five companies were trialing. The tile counted
// Stripe's trialing Subscription rows; since 38d3308d a new company trials
// with no card and NO Subscription row. The banner under the tile said 5,
// the subscriptions page said 5 on "All" and 0 on "Active", the companies
// list's "Trial / pending" chip said 3, the growth forecast started from 2,
// and the plans page said every plan had 0 companies. Each was right about
// its own query.
//
// ── What is executed and what is only read ─────────────────────────────────
//
// EXECUTED: the classifier against a fixture for every bucket plus the
// hostile shapes (a relation not selected, an unparseable date, a status the
// enum does not have, a terms lock on a cancelled row, the grace boundary);
// the tally's arithmetic; the revenue feed's exclusion of card-free trials
// from money; the loader against a fake client (it must SELECT the relation
// and the trial date, or every paying company would read as a trial); and
// the real live-database shapes of 2026-09-25, by name.
//
// READ (structural, and says so): that every screen and route that prints a
// company count gets it from the book — the tile's source, not the tile's
// pixels. A pass means the known failure shape is absent: a route that
// counts with its own where-clause again, a page that re-derives trialing
// from a status.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SUBSCRIBER_BOOK_SELECT,
  classifyTrial,
  loadSubscriberBook,
  outlookSubscriptions,
  subscriberBucket,
  tallySubscribers,
} from "@/lib/platform/trialCounting";
import {
  BILLED_BUCKETS,
  BUCKETS,
  BUCKET_GROUPS,
  BUCKET_ORDER,
  NOT_A_CUSTOMER_BUCKETS,
  ON_PLAN_BUCKETS,
  TRIALING_BUCKETS,
} from "@/lib/platform/subscriberBuckets";
import { buildRevenueOutlook } from "@/lib/platform/revenueOutlook";
import { companyStanding } from "@/lib/platform/companyStanding";
import { tallyCompanies } from "@/lib/platform/taxRegistrations";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
/** Comments out, strings kept — a comment quoting the old code is not the code. */
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

let checks = 0;
let failures = 0;
function ok(label, condition, detail = "") {
  checks++;
  if (!condition) failures++;
  console.log(`  ${condition ? "ok  " : "FAIL"} ${label}${!condition && detail !== "" ? `  ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
}

const NOW = new Date("2026-09-25T20:00:00Z");
const day = (n) => new Date(NOW.getTime() + n * 86400000);
const plan = (priceMonthly, name = "Solo") => ({ id: `plan_${name}`, name, currency: "CAD", priceMonthly, priceAnnual: null, stripePriceId: null });
const sub = (over) => ({
  id: `sub_${Math.random().toString(36).slice(2, 8)}`,
  status: "active",
  planId: "plan_Solo",
  stripeSubscriptionId: "sub_live",
  trialEndsAt: null,
  currentPeriodEnd: day(20),
  billingStartedAt: day(-10),
  billingInterval: "month",
  canceledAt: null,
  cancelAtPeriodEnd: false,
  cancelAt: null,
  pastDueSince: null,
  accessLockedAt: null,
  createdAt: day(-40),
  plan: plan(99),
  ...over,
});
const co = (name, over) => ({
  id: `co_${name.replace(/\W+/g, "_")}`,
  name,
  isDemo: false,
  country: "CA",
  createdAt: day(-5),
  trialEndsAt: null,
  onboardingStatus: "active",
  ...over,
});

// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 1. Every bucket, from a fixture (executed) ─────────────────────\n");

const FIXTURES = [
  { expect: "paying", c: co("Paying Co", { subscription: sub({}) }) },
  { expect: "paying", c: co("Cancelling Co", { subscription: sub({ cancelAtPeriodEnd: true, cancelAt: day(19), canceledAt: day(-11) }) }) },
  { expect: "past_due", c: co("Past Due In Grace", { subscription: sub({ status: "past_due", pastDueSince: day(-2) }) }) },
  { expect: "locked", c: co("Past Due Grace Over", { subscription: sub({ status: "past_due", pastDueSince: day(-30) }) }) },
  { expect: "trial_with_plan", c: co("Stripe Trial", { trialEndsAt: day(19), subscription: sub({ status: "trialing", trialEndsAt: day(19), billingStartedAt: null }) }) },
  // Stripe still says trialing after our copy of the end date passed —
  // Stripe decides, and the dashboard warns that nothing transitioned it.
  { expect: "trial_with_plan", c: co("Stripe Trial Lapsed", { trialEndsAt: day(-3), subscription: sub({ status: "trialing", trialEndsAt: day(-3), billingStartedAt: null }) }) },
  { expect: "trial_no_plan", c: co("Card Free Day One", { onboardingStatus: "pending", trialEndsAt: day(30), subscription: null }) },
  { expect: "trial_no_plan", c: co("Card Free Last Hour", { onboardingStatus: "pending", trialEndsAt: new Date(NOW.getTime() + 3600000), subscription: null }) },
  { expect: "trial_ended", c: co("Card Free Ended", { onboardingStatus: "pending", trialEndsAt: day(-2), subscription: null }) },
  { expect: "locked", c: co("Card Free Locked", { onboardingStatus: "pending", trialEndsAt: day(-20), subscription: null }) },
  { expect: "locked", c: co("Terms Lock", { subscription: sub({ status: "canceled", canceledAt: day(-1), accessLockedAt: day(-1) }) }) },
  { expect: "cancelled", c: co("Cancelled Co", { onboardingStatus: "churned", subscription: sub({ status: "canceled", canceledAt: day(-3) }) }) },
  { expect: "incomplete", c: co("Never Finished", { onboardingStatus: "pending", trialEndsAt: null, subscription: null }) },
  { expect: "unknown", c: co("Odd Status", { subscription: sub({ status: "paused" }) }) },
  { expect: "demo", c: co("Demo With Sub", { isDemo: true, subscription: sub({ status: "trialing" }) }) },
  { expect: "demo", c: co("Demo Bare", { isDemo: true, subscription: null }) },
];

for (const f of FIXTURES) {
  const got = subscriberBucket(f.c, NOW);
  ok(`${f.c.name} → ${f.expect}`, got === f.expect, `got ${got}`);
}

const reached = new Set(FIXTURES.map((f) => subscriberBucket(f.c, NOW)));
ok("every bucket the screens name is reachable by some company",
  BUCKET_ORDER.every((b) => reached.has(b)), BUCKET_ORDER.filter((b) => !reached.has(b)));
ok("the classifier never returns a bucket the screens cannot name",
  [...reached].every((b) => Boolean(BUCKETS[b])), [...reached]);
ok("BUCKET_ORDER and BUCKETS name the same set",
  BUCKET_ORDER.length === Object.keys(BUCKETS).length && BUCKET_ORDER.every((b) => BUCKETS[b]));
ok("every group names only real buckets",
  [TRIALING_BUCKETS, BILLED_BUCKETS, ON_PLAN_BUCKETS, NOT_A_CUSTOMER_BUCKETS, ...Object.values(BUCKET_GROUPS)]
    .every((g) => g.every((b) => BUCKETS[b])));
ok("the trialing group is exactly the two trial buckets",
  JSON.stringify(TRIALING_BUCKETS) === JSON.stringify(["trial_with_plan", "trial_no_plan"]) &&
    JSON.stringify(BUCKET_GROUPS.trialing) === JSON.stringify(TRIALING_BUCKETS));

console.log("\n── 2. Hostile shapes (executed) ──────────────────────────────────\n");

const throwsNamed = (fn, re) => {
  try {
    fn();
    return false;
  } catch (err) {
    return !(err instanceof TypeError) && re.test(String(err?.message));
  }
};
ok("an unselected subscription relation is refused by name, never read as 'no subscription'",
  throwsNamed(() => subscriberBucket({ isDemo: false, trialEndsAt: day(10) }, NOW), /subscription was not selected/));
ok("an unselected trialEndsAt is refused by name, never read as 'no trial'",
  throwsNamed(() => subscriberBucket({ isDemo: false, subscription: null }, NOW), /trialEndsAt was not selected/));
ok("an unparseable trial date is not a trial (never finished signup)",
  subscriberBucket(co("Bad Date", { trialEndsAt: "not a date", subscription: null }), NOW) === "incomplete");
ok("no company is no bucket", subscriberBucket(null, NOW) === null);
ok("a terms lock outranks 'cancelled' — the company did not choose to leave",
  subscriberBucket(co("L", { subscription: sub({ status: "canceled", accessLockedAt: day(-1) }) }), NOW) === "locked");
ok("a terms lock on an ACTIVE subscription is locked, not paying",
  subscriberBucket(co("L2", { subscription: sub({ accessLockedAt: day(-1) }) }), NOW) === "locked");
// Grace boundary: GRACE_DAYS is 7 in lib/billing/access.js.
ok("past due 6 days ago is still in grace",
  subscriberBucket(co("G6", { subscription: sub({ status: "past_due", pastDueSince: day(-6) }) }), NOW) === "past_due");
ok("past due 7 days ago is locked",
  subscriberBucket(co("G7", { subscription: sub({ status: "past_due", pastDueSince: day(-7) }) }), NOW) === "locked");
ok("a paying company whose Company.trialEndsAt was never cleared is still paying",
  subscriberBucket(co("Stale Trial Date", { trialEndsAt: day(10), subscription: sub({}) }), NOW) === "paying");
ok("onboardingStatus decides nothing: 'pending' with a live Stripe subscription is paying",
  subscriberBucket(co("Pending Payer", { onboardingStatus: "pending", subscription: sub({}) }), NOW) === "paying");
ok("classifyTrial is derived from the bucket (both trial kinds, nothing else)",
  FIXTURES.every((f) => {
    const b = subscriberBucket(f.c, NOW);
    const t = classifyTrial(f.c, NOW);
    return (b === "trial_with_plan") === (t === "trialing_subscription") && (b === "trial_no_plan") === (t === "awaiting_checkout");
  }));

console.log("\n── 3. The tally a tile prints (executed) ─────────────────────────\n");

const tally = tallySubscribers(FIXTURES.map((f) => f.c), NOW);
const expectCount = (b) => FIXTURES.filter((f) => f.expect === b).length;
ok("every bucket's count is its fixtures' count",
  BUCKET_ORDER.every((b) => tally.counts[b] === expectCount(b)), tally.counts);
ok("the counts sum to every company, each counted once",
  Object.values(tally.counts).reduce((a, b) => a + b, 0) === FIXTURES.length);
ok("trialing = with a plan + no plan yet",
  tally.trialing.total === tally.trialing.withPlan + tally.trialing.noPlan &&
    tally.trialing.withPlan === 2 && tally.trialing.noPlan === 2, tally.trialing);
ok("'companies' leaves out demos and never-finished signups, and nothing else",
  tally.customers === FIXTURES.length - expectCount("demo") - expectCount("incomplete"), tally.customers);
ok("billed = paying + past due", tally.billed === expectCount("paying") + expectCount("past_due"));
ok("the members list names the companies a number counts",
  tally.members.trial_no_plan.map((m) => m.name).join() === "Card Free Day One,Card Free Last Hour");
ok("demos are listed as their own bucket and counted in no customer number",
  tally.counts.demo === 2 && !tally.members.paying.some((m) => /Demo/.test(m.name)) &&
    !tally.members.trial_with_plan.some((m) => /Demo/.test(m.name)));

console.log("\n── 4. Money: a card-free trial never reaches MRR (executed) ───────\n");

const classified = FIXTURES.map((f) => ({ ...f.c, bucket: subscriberBucket(f.c, NOW) }));
const priced = outlookSubscriptions(classified);
ok("the revenue feed is the Paying and Trialing-with-a-plan buckets only",
  priced.length === expectCount("paying") + expectCount("trial_with_plan"));
ok("no card-free trial, locked, cancelled or demo row is priced",
  !priced.some((s) => ["Card Free Day One", "Terms Lock", "Cancelled Co", "Demo With Sub", "Past Due Grace Over"].includes(s.company?.name)));
const outlook = buildRevenueOutlook(priced, NOW);
ok("nominal MRR is the paying companies' plans alone (2 × $99)", outlook.nominalMrr === 198, outlook.nominalMrr);
ok("the outlook's trial count is the Stripe trials — the with-a-plan half", outlook.trials.count === tally.trialing.withPlan);

console.log("\n── 5. The loader selects what the rule reads (executed) ───────────\n");

let seenArgs = null;
const fakeClient = {
  company: {
    findMany: async (args) => {
      seenArgs = args;
      return FIXTURES.map((f) => f.c);
    },
  },
};
const book = await loadSubscriberBook(fakeClient, { now: NOW });
ok("the loader selects the subscription relation and the trial date",
  seenArgs?.select === SUBSCRIBER_BOOK_SELECT && SUBSCRIBER_BOOK_SELECT.trialEndsAt === true &&
    Boolean(SUBSCRIBER_BOOK_SELECT.subscription?.select?.status) &&
    Boolean(SUBSCRIBER_BOOK_SELECT.subscription?.select?.accessLockedAt) &&
    Boolean(SUBSCRIBER_BOOK_SELECT.subscription?.select?.pastDueSince) &&
    Boolean(SUBSCRIBER_BOOK_SELECT.subscription?.select?.planId));
// A select naming a column the schema does not have is a runtime error on
// every /platform page at once, and nothing short of a live query finds it —
// so the names are held to prisma/schema.prisma here.
const schema = read("prisma/schema.prisma");
const fieldsOf = (model) => {
  const m = schema.match(new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m"));
  return new Set((m?.[1] || "").split("\n").map((l) => l.trim().split(/\s+/)[0]).filter((w) => /^[a-zA-Z]\w*$/.test(w)));
};
const missingFields = [
  ...Object.keys(SUBSCRIBER_BOOK_SELECT).filter((k) => !fieldsOf("Company").has(k)).map((k) => `Company.${k}`),
  ...Object.keys(SUBSCRIBER_BOOK_SELECT.subscription.select).filter((k) => !fieldsOf("Subscription").has(k)).map((k) => `Subscription.${k}`),
  ...Object.keys(SUBSCRIBER_BOOK_SELECT.subscription.select.plan.select).filter((k) => !fieldsOf("Plan").has(k)).map((k) => `Plan.${k}`),
];
ok("every column the book selects exists in prisma/schema.prisma", missingFields.length === 0, missingFields);
ok("the loader applies no where-clause of its own (demos are a bucket, not a filter)",
  seenArgs && seenArgs.where === undefined);
ok("the loader's tally is the same tally", JSON.stringify(book.tally.counts) === JSON.stringify(tally.counts));
ok("every loaded row carries its bucket", book.companies.every((c) => BUCKETS[c.bucket]));

console.log("\n── 6. The live book of 2026-09-25, by name (executed) ─────────────\n");

// The shapes read from production (read-only) on 2026-09-25 — the owner's
// "I think we have 4". Names as stored.
const LIVE = [
  co("Test Inc. ", { trialEndsAt: new Date("2026-10-13T04:00:00Z"), subscription: sub({ status: "active", canceledAt: new Date("2026-09-14T00:06:24Z"), cancelAtPeriodEnd: true, cancelAt: new Date("2026-10-14T16:26:43Z"), billingStartedAt: null, plan: plan(1, "Live test — $1") }) }),
  co("TrueFinish Cabinets Inc. ", { trialEndsAt: new Date("2026-10-14T04:00:00Z"), subscription: sub({ status: "trialing", trialEndsAt: new Date("2026-10-15T00:56:24Z"), billingStartedAt: null }) }),
  co("Sunset Space", { trialEndsAt: new Date("2027-01-14T05:00:00Z"), subscription: sub({ status: "trialing", trialEndsAt: new Date("2027-01-15T04:01:20Z"), billingStartedAt: null }) }),
  co("Luma Painting ", { country: "US", onboardingStatus: "pending", trialEndsAt: new Date("2026-10-24T04:00:00Z"), subscription: null }),
  co("jaspedo", { country: "US", onboardingStatus: "pending", trialEndsAt: new Date("2026-10-24T04:00:00Z"), subscription: null }),
  co("Emilio The Painter", { country: "US", onboardingStatus: "pending", trialEndsAt: new Date("2026-10-25T04:00:00Z"), subscription: null }),
];
const live = tallySubscribers(LIVE, NOW);
ok("live: 5 trialing — 2 with a plan chosen, 3 no plan yet",
  live.trialing.total === 5 && live.trialing.withPlan === 2 && live.trialing.noPlan === 3, live.trialing);
ok("live: 1 paying (Test Inc., cancelling at period end)", live.counts.paying === 1 && live.members.paying[0].name === "Test Inc. ");
ok("live: 6 companies", live.customers === 6);
ok("live: the old tile's answer (Stripe trialing rows) was 2",
  LIVE.filter((c) => c.subscription?.status === "trialing").length === 2);
ok("live: the old 'Trial / pending' chip's answer (onboardingStatus) was 3",
  LIVE.filter((c) => c.onboardingStatus === "pending").length === 3);
ok("live: TrueFinish's row says it is trialing, not onboardingStatus's 'active'",
  /^Trialing · Solo · \d+ days left$/.test(companyStanding(LIVE[1], NOW).label), companyStanding(LIVE[1], NOW).label);
ok("live: Test Inc.'s row says paying and cancelling",
  /^Paying · Live test — \$1 · cancels /.test(companyStanding(LIVE[0], NOW).label), companyStanding(LIVE[0], NOW).label);

console.log("\n── 7. The per-country tax tally counts the same buckets (executed) ─\n");

const taxTally = tallyCompanies(LIVE.map((c) => ({ ...c, bucket: subscriberBucket(c, NOW) })), NOW);
ok("tax tally: CA 1 paying, 2 trialling; US 3 trialling",
  taxTally.regions.CA?.paying === 1 && taxTally.regions.CA?.trialling === 2 && taxTally.regions.US?.trialling === 3,
  taxTally);

// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 8. Every screen counts from the book (read) ────────────────────\n");

const overview = code("app/api/platform/analytics/overview/route.js");
ok("overview: loads the book", overview.includes("loadSubscriberBook(db, { now })"));
ok("overview: no company or subscription COUNT query of its own",
  !/db\.company\.count\(/.test(overview) && !/db\.subscription\.(count|findMany)\(/.test(overview));
ok("overview: companies / incomplete / paying / trialing are tally fields",
  /totalCompanies: tally\.customers,/.test(overview) &&
    /incompleteSignups: tally\.counts\.incomplete,/.test(overview) &&
    /payingCompanies: tally\.counts\.paying,/.test(overview) &&
    /trialCompanies: tally\.trialing\.total,/.test(overview));
ok("overview: MRR and the outlook are priced from outlookSubscriptions (no card-free trial)",
  /const priced = outlookSubscriptions\(book\.companies\);/.test(overview) &&
    /buildRevenueOutlook\(priced, now\)/.test(overview));
ok("overview: churn is the Cancelled bucket by canceledAt, not onboardingStatus + updatedAt",
  /inBucket\("cancelled"\)/.test(overview) && !/onboardingStatus: "churned"/.test(overview));
ok("overview: the growth series count finished signups from the book",
  /const customers = book\.companies\.filter\(\(c\) => isCustomerBucket\(c\.bucket\)\);/.test(overview));
ok("overview: plan usage is keyed by plan id",
  /const id = c\.subscription\?\.planId;/.test(overview) && /planUsage,/.test(overview));
ok("overview: ships the names behind the numbers and the mirror's freshness",
  /book: \{ at: tally\.at, counts: tally\.counts, members: tally\.members \}/.test(overview) && /stripeMirror,/.test(overview));

const home = code("app/platform/page.js");
ok("home: the Trialing tile is the companies-in-a-free-month count, split",
  /label="Trialing"\s*\n\s*value=\{count\(data\.trialCompanies\)\}/.test(home) &&
    /data\.trialBreakdown\?\.withPlan/.test(home) && /data\.trialBreakdown\?\.noPlan/.test(home));
ok("home: no tile reads Stripe's trialing-row count as 'Trialing'",
  !/value=\{count\(data\.outlook\?\.trials\?\.count/.test(home));
ok("home: the Paying tile is the Paying bucket", /label="Paying companies"\s*\n\s*value=\{count\(data\.payingCompanies\)\}/.test(home));
ok("home: the names behind the numbers are rendered", /<BookLedger book=\{data\.book\} stripeMirror=\{data\.stripeMirror\} \/>/.test(home));
ok("home: the banner reads the same split as the tile",
  (home.match(/data\.trialBreakdown\?\.withPlan/g) || []).length >= 2);

const subsRoute = code("app/api/platform/billing/subscriptions/route.js");
ok("subscriptions: loads the book", subsRoute.includes("loadSubscriberBook(db, { now: nowDate })"));
ok("subscriptions: tiles are the book's, not the open tab's rows",
  /trialing: tally\.trialing\.total,/.test(subsRoute) && /active: tally\.counts\.paying,/.test(subsRoute) &&
    !/trialing: rows\.filter/.test(subsRoute) && !/active: rows\.filter/.test(subsRoute));
ok("subscriptions: MRR is the home page's collectable MRR",
  /mrr: outlook\.collectableMrr,/.test(subsRoute) && /buildRevenueOutlook\(outlookSubscriptions\(book\.companies\), nowDate\)/.test(subsRoute));
ok("subscriptions: demo companies' rows are left out",
  /const customers = book\.companies\.filter\(\(c\) => c\.bucket !== "demo"\);/.test(subsRoute));
const subsPage = code("app/platform/billing/subscriptions/page.js");
ok("subscriptions page: the Trialing tile prints the split",
  /data\.summary\.trialingWithPlan/.test(subsPage) && /data\.summary\.trialingNoPlan/.test(subsPage));
ok("subscriptions page: prints how fresh the Stripe mirror is", /data\.stripeMirror/.test(subsPage) && /data\.countedAt/.test(subsPage));

const companiesRoute = code("app/api/platform/companies/route.js");
ok("companies: every row is classified by the shared classifier", /bucket: subscriberBucket\(c, now\)/.test(companiesRoute));
ok("companies: no onboardingStatus filter survives", !/onboardingStatus: status/.test(companiesRoute));
ok("companies: an unknown filter is refused, not answered with everything", /Unknown filter/.test(companiesRoute));
const companiesPage = code("app/platform/companies/page.js");
ok("companies page: the per-country tally reads the bucket, not the status",
  /isBilledBucket\(c\.bucket\)/.test(companiesPage) && /isTrialingBucket\(c\.bucket\)/.test(companiesPage) &&
    !/status === "trialing"/.test(companiesPage));
ok("companies page: no chip filters by onboardingStatus",
  !/value: "active"|value: "pending"|value: "churned"/.test(companiesPage));

ok("company rows and headers say the bucket's words (companyStanding reads subscriberBucket)",
  /const bucket = subscriberBucket\(company, now\);/.test(code("lib/platform/companyStanding.js")));

const taxRoute = code("app/api/platform/billing/tax-registrations/route.js");
ok("tax: the route classifies with the book", /loadSubscriberBook\(db, \{ now \}\)/.test(taxRoute));
const taxLib = code("lib/platform/taxRegistrations.js");
ok("tax: the tally reads the bucket, not the status",
  /isBilledBucket\(c\.bucket\)/.test(taxLib) && !/status === "trialing"/.test(taxLib));

const growth = code("lib/platform/growthMeasured.js");
ok("growth: the forecast's starting stock is the book's",
  /payingNow = book\.tally\.billed/.test(growth) && /trialingNow = book\.tally\.trialing\.total/.test(growth));

const plansPage = code("app/platform/billing/plans/page.js");
ok("plans: subscriber counts are looked up by plan id, from planUsage",
  /overview\.planUsage/.test(plansPage) && /usage\[p\.id\]/.test(plansPage) && !/usage\[p\.name\]/.test(plansPage));

const queries = code("lib/analytics/product/queries.js");
ok("analytics: 'Completed' signups and the company denominator use the finished-signup rule",
  (queries.match(/completedSignupWhere\(\)/g) || []).length >= 2 && !/db\.subscription\.count/.test(queries));

const reports = code("app/api/platform/reports/route.js");
ok("reports: the companies export carries the bucket", /BUCKETS\[subscriberBucket\(c, standingAt\)\]/.test(reports));

// ── No platform file re-derives "trialing" from a status on its own ────────
//
// The allowed readers of the raw enum: the classifier, the revenue outlook
// (which is handed the classified feed), Stripe's own sync, and the billing
// ACTION routes that decide whether an operation is allowed on one row.
const ALLOWED = new Set([
  "lib/platform/trialCounting.js",
  "lib/platform/revenueOutlook.js",
  "lib/platform/stripeBilling.js",
  "lib/platform/subscriptionStatus.js",
  "app/api/platform/companies/[id]/end-trial/route.js",
  "app/api/platform/billing/cancel/route.js",
  "app/api/platform/billing/checkout/route.js",
  // Builds the no-plan table rows with the status the table filters on.
  "app/api/platform/billing/subscriptions/route.js",
]);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (/\.m?js$/.test(e.name)) out.push(rel);
  }
  return out;
}
const offenders = [...walk("app/platform"), ...walk("app/api/platform"), ...walk("lib/platform")]
  .filter((f) => !ALLOWED.has(f))
  .filter((f) => /(?:status\s*===?\s*|status:\s*)"trialing"/.test(code(f)));
ok("no other /platform file counts trialing off the raw status", offenders.length === 0, offenders);

// ── The one cached input says how old it is ───────────────────────────────
const cron = code("app/api/cron/billing-sync/route.js");
ok("the billing-sync stamps when it last finished", /await stampBillingSync\(summary\);/.test(cron));
ok("…after the loop, so a run that died half-way does not claim it",
  cron.indexOf("await stampBillingSync(summary);") > cron.indexOf("for (const row of rows)"));

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
