// scripts/check-test-companies.mjs
//
//   npm run check:test-companies
//
// The "Test company" switch (owner, 2026-10-03): a company a superadmin marks
// as a test is left out of every /platform number, and nothing else changes.
// Executed where it can be, scanned where it cannot:
//
//   1. lib/platform/metricsScope.js against hostile rows (missing columns
//      refused by name, never read as "counts");
//   2. the subscriber book: a marked company is bucket "test" whatever it
//      would be (paying, trialing, locked), in no tally, never priced into
//      MRR; its real standing is still printed; unmarking restores the exact
//      tally it had;
//   3. every other aggregate, executed on fixtures: the product-analytics
//      row filter, the rep sales funnel, "online now", campaign outcomes;
//   4. the switch's route against the recording stubs: superadmin only,
//      refused inside a support session, reason required, a demo refused,
//      a no-op refused, one transaction with the audit row, only FieldQuo's
//      three label columns written;
//   5. a static sweep of every metric directory: no demo exclusion survives
//      that does not also exclude test companies, except the listed,
//      reasoned ones (rows flagged per event, marketing pages with no
//      company) — so the next copy of NOT_DEMO fails here;
//   6. behaviour untouched: the crons and gates that skip demos (trial
//      reminders, signup recovery, next steps, top-up, billing sync,
//      access) do NOT mention isTestCompany — the company keeps working;
//   7. wiring: list badge + show/hide, detail switch + badge, audit words,
//      team words, schema columns.

import { register } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

register("./platform-cancel-stub-hooks.mjs", import.meta.url);

let fail = 0;
let count = 0;
const ok = (cond, msg) => {
  count++;
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fail++;
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

process.env.IMPERSONATION_JWT_SECRET = "check-test-companies-secret-0123456789abcdef";

const stubs = await import("./fixtures/platformCancelStubs.mjs");
const { METRICS_COMPANY_WHERE, METRICS_COMPANY_SELECT, countsInMetrics, isMetricsBucket, METRICS_EXCLUDED_BUCKETS } = await import("@/lib/platform/metricsScope");
const { subscriberBucket, tallySubscribers, outlookSubscriptions, SUBSCRIBER_BOOK_SELECT } = await import("@/lib/platform/trialCounting");
const { BUCKETS, BUCKET_ORDER, NOT_A_CUSTOMER_BUCKETS } = await import("@/lib/platform/subscriberBuckets");
const { companyStanding } = await import("@/lib/platform/companyStanding");
const { excludeTestCompanies } = await import("@/lib/analytics/product/aggregate");
const { stageCounts } = await import("@/lib/sales/funnelStages");
const { countOnline } = await import("@/lib/platform/companyPresence");
const { leadOutcome } = await import("@/lib/analytics/product/campaigns");
const { SUPERADMIN_ONLY_PERMISSIONS, canPlatform } = await import("@/lib/platform/permissions");
const { SignJWT } = await import("jose");
const { NextRequest } = await import("next/server.js");

const NOW = new Date("2026-10-03T12:00:00Z");
const DAY = 86400000;
const day = (d) => new Date(NOW.getTime() + d * DAY);

// ══ 1. The scope ══════════════════════════════════════════════════════════
console.log("\n1. lib/platform/metricsScope.js\n");
ok(JSON.stringify(METRICS_COMPANY_WHERE) === '{"isDemo":false,"isTestCompany":false}', "the where fragment is exactly isDemo false + isTestCompany false (no OR, no NULL branch)");
ok(Object.isFrozen(METRICS_COMPANY_WHERE) && Object.isFrozen(METRICS_COMPANY_SELECT), "frozen — a caller cannot widen it for everyone");
ok(countsInMetrics({ isDemo: false, isTestCompany: false }) === true, "a real company counts");
ok(countsInMetrics({ isDemo: true, isTestCompany: false }) === false, "a demo does not");
ok(countsInMetrics({ isDemo: false, isTestCompany: true }) === false, "a test company does not");
ok(countsInMetrics(null) === false, "no company does not");
let threw = false;
try {
  countsInMetrics({ isDemo: false });
} catch (e) {
  threw = /isTestCompany/.test(e.message);
}
ok(threw, "a row without isTestCompany selected is refused by name, never read as 'counts'");
ok(JSON.stringify(METRICS_EXCLUDED_BUCKETS) === '["demo","test"]' && !isMetricsBucket("test") && !isMetricsBucket("demo") && isMetricsBucket("paying") && !isMetricsBucket(null),
  "isMetricsBucket: demo and test out, every other bucket in");

// ══ 2. The book ═══════════════════════════════════════════════════════════
console.log("\n2. The subscriber book\n");
const plan = { id: "p", name: "Solo", currency: "USD", priceMonthly: 99, priceAnnual: null, stripePriceId: "price_1" };
const sub = (over = {}) => ({ id: "s", status: "active", planId: "p", stripeSubscriptionId: "sub_x", trialEndsAt: null, currentPeriodEnd: day(20), billingStartedAt: day(-40), billingInterval: "month", canceledAt: null, cancelAtPeriodEnd: false, cancelAt: null, pastDueSince: null, accessLockedAt: null, createdAt: day(-40), plan, ...over });
const co = (name, over = {}) => ({ id: `co_${name.replace(/\W+/g, "_")}`, name, email: null, isDemo: false, isTestCompany: false, country: "CA", createdAt: day(-5), trialEndsAt: null, onboardingStatus: "active", stripeChargesEnabled: true, platformEndsAt: null, platformEndMode: null, platformEndReason: null, ...over });
const realOnes = [
  co("Paying A", { subscription: sub() }),
  co("Paying B", { subscription: sub() }),
  co("Card Free", { trialEndsAt: day(10), subscription: null }),
  co("Stripe Trial", { subscription: sub({ status: "trialing", trialEndsAt: day(9), billingStartedAt: null }) }),
];
const asTest = [
  co("Owner Test Paying", { isTestCompany: true, subscription: sub() }),
  co("Owner Test Trial", { isTestCompany: true, trialEndsAt: day(10), subscription: null }),
  co("Owner Test Locked", { isTestCompany: true, subscription: sub({ status: "past_due", pastDueSince: day(-30) }) }),
];
for (const c of asTest) ok(subscriberBucket(c, NOW) === "test", `${c.name} → bucket "test" (would be ${subscriberBucket({ ...c, isTestCompany: false }, NOW)})`);
ok(subscriberBucket(co("Demo And Test", { isDemo: true, isTestCompany: true, subscription: null }), NOW) === "demo", "a demo stays 'demo' even if also flagged — one rule decides");
ok(BUCKET_ORDER.includes("test") && Boolean(BUCKETS.test) && NOT_A_CUSTOMER_BUCKETS.includes("test"), "the test bucket is named, ordered, and not a customer");
ok(SUBSCRIBER_BOOK_SELECT.isTestCompany === true, "the book's select reads isTestCompany (an unselected column would read as 'not a test')");

const without = tallySubscribers(realOnes, NOW);
const withTests = tallySubscribers([...realOnes, ...asTest], NOW);
const strip = (t) => ({ ...t, at: null, counts: { ...t.counts, test: 0 }, members: { ...t.members, test: [] } });
ok(JSON.stringify(strip(withTests)) === JSON.stringify(strip(without)), "every tally (paying, past due, trialing, billed, on plan, customers, members) is identical with and without the test companies");
ok(withTests.counts.test === 3 && withTests.members.test.length === 3, "…and they are listed in their own bucket");
const classify = (list) => list.map((c) => ({ ...c, bucket: subscriberBucket(c, NOW) }));
const mrr = (list) => outlookSubscriptions(classify(list)).filter((s) => s.status === "active").reduce((n, s) => n + Number(s.plan.priceMonthly), 0);
ok(mrr([...realOnes, ...asTest]) === mrr(realOnes) && mrr(realOnes) === 198, `MRR with the test companies = without (${mrr(realOnes)}): a test paying card is never revenue`);
const unmarked = asTest.map((c) => ({ ...c, isTestCompany: false }));
const back = tallySubscribers([...realOnes, ...unmarked], NOW);
ok(back.counts.paying === without.counts.paying + 1 && back.trialing.total === without.trialing.total + 1 && back.counts.locked === (without.counts.locked || 0) + 1 && !back.counts.test,
  "unmarked, each goes back to the bucket it really is in");

const st = companyStanding(asTest[0], NOW);
ok(st.key === "test" && st.bucket === "test" && /^Test company · Paying/.test(st.label) && st.realBucket === "paying", `standing keeps the real state in words: "${st.label}"`);

// ══ 3. The other aggregates, executed ═════════════════════════════════════
console.log("\n3. Every other aggregate\n");
const tests = new Set(["co_t"]);
const rows = [
  { surface: "app", companyId: "co_real", count: 5 },
  { surface: "app", companyId: "co_t", count: 7 },
  { surface: "marketing", companyId: null, count: 3 },
];
const kept = excludeTestCompanies(rows, tests);
ok(kept.length === 2 && !kept.some((r) => r.companyId === "co_t") && kept.some((r) => r.surface === "marketing"), "product analytics: the test company's rows go, rows with no company stay");
ok(excludeTestCompanies(rows, new Set()) === rows, "…no test companies → the same array, untouched");

const funnel = (companies) =>
  stageCounts({
    attributions: [
      { companyId: "co_real", capturedAt: new Date("2026-10-02T00:00:00Z") },
      { companyId: "co_t", capturedAt: new Date("2026-10-02T00:00:00Z") },
    ],
    companies,
    subscriptions: [{ companyId: "co_real", billingStartedAt: null }, { companyId: "co_t", billingStartedAt: null }],
    monthKey: "2026-10",
  });
const f1 = funnel([{ id: "co_real", stripeChargesEnabled: false, isDemo: false, isTestCompany: false, trialEndsAt: null }, { id: "co_t", stripeChargesEnabled: false, isDemo: false, isTestCompany: true, trialEndsAt: null }]);
const f0 = funnel([{ id: "co_real", stripeChargesEnabled: false, isDemo: false, isTestCompany: false, trialEndsAt: null }, { id: "co_t", stripeChargesEnabled: false, isDemo: true, isTestCompany: false, trialEndsAt: null }]);
ok(JSON.stringify(f1) === JSON.stringify(f0), "rep sales funnel: a test company is left out exactly as a demo is");
ok(/isTestCompany: true/.test(read("lib/sales/funnelData.js")), "…and the loader selects the column");

const online = { lastActiveAt: new Date(Date.now() - 60000).toISOString(), signedInAt: new Date(Date.now() - 60000).toISOString(), memberCount: 1, companyCreatedAt: new Date(Date.now() - 86400000 * 30).toISOString() };
const presence = [{ id: "a", isDemo: false, isTestCompany: false, ...online }, { id: "b", isDemo: false, isTestCompany: true, ...online }];
ok(countOnline(presence, new Date()) === countOnline([presence[0]], new Date()), "'N companies online now' leaves the test company out");
ok(/isTestCompany: Boolean\(c\.isTestCompany\)/.test(read("lib/company/memberActivity.js")), "…and the presence rows carry the column");

const lead = (isTestCompany) => ({ completedCompanyId: "x", skipReason: null, stepReached: "done", completedCompany: { isDemo: false, isTestCompany, createdAt: day(-2), trialEndsAt: day(10), subscription: sub() } });
ok(leadOutcome(lead(false), NOW).paying === true && leadOutcome(lead(true), NOW).trial === false && leadOutcome(lead(true), NOW).paying === false, "campaign outcomes: a test company is never a trial or a paying signup");
ok(/allLeads\.filter\(\(l\) => l\.completedCompany\?\.isTestCompany !== true\)/.test(read("lib/analytics/product/campaigns.js")), "…and its lead is dropped before the campaign table counts it");

// ══ 4. The switch's route ═════════════════════════════════════════════════
console.log("\n4. POST /api/platform/companies/[id]/test-company\n");
const route = await import("@/app/api/platform/companies/[id]/test-company/route.js");
const post = async (id, body, cookie) => {
  const res = await route.POST(new NextRequest(`http://x/api/platform/companies/${id}/test-company`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
  return { status: res.status, json: await res.json() };
};
ok(SUPERADMIN_ONLY_PERMISSIONS.includes("company:mark_test") && !canPlatform("admin", "company:mark_test") && !canPlatform("support", "company:mark_test") && canPlatform("superadmin", "company:mark_test"),
  "company:mark_test is superadmin-only, declared");
const realCo = { id: "co_r", name: "Real Co", isDemo: false, isTestCompany: false, testMarkedAt: null, testMarkedBy: null };

stubs.resetStubs();
stubs.state.company = { ...realCo };
let r = await post("co_r", { isTest: true, reason: "Owner's live payment test" });
let tx = stubs.calls.find((c) => c.kind === "transaction");
ok(r.status === 200 && JSON.stringify(tx?.ops.map((o) => o.__op)) === '["company.update","platformAuditLog.create"]', "mark → 200, one transaction: company.update + audit row");
const upd = tx.ops[0].args;
ok(JSON.stringify(Object.keys(upd.data).sort()) === '["isTestCompany","testMarkedAt","testMarkedBy"]' && upd.data.isTestCompany === true && upd.data.testMarkedBy === "adm_super" && upd.where.id === "co_r",
  "…writes ONLY FieldQuo's three label columns, with who and when, scoped to that company");
const audit = tx.ops[1].args.data;
ok(audit.action === "test_company_marked" && audit.platformAdminId === "adm_super" && audit.targetCompanyId === "co_r" && audit.details.reason === "Owner's live payment test" && audit.details.previous.isTestCompany === false,
  "…the audit row: who, which company, why, and what it was");

stubs.resetStubs();
stubs.state.company = { ...realCo, isTestCompany: true, testMarkedAt: day(-1), testMarkedBy: "adm_super" };
r = await post("co_r", { isTest: false, reason: "Became a real customer" });
tx = stubs.calls.find((c) => c.kind === "transaction");
ok(r.status === 200 && tx.ops[0].args.data.isTestCompany === false && tx.ops[0].args.data.testMarkedAt === null && tx.ops[0].args.data.testMarkedBy === null && tx.ops[1].args.data.action === "test_company_unmarked",
  "unmark → clears the three columns, audit row test_company_unmarked (the history stays in the log)");

const refusals = [
  ["admin", { role: "admin" }, { isTest: true, reason: "because" }, 403],
  ["support", { role: "support" }, { isTest: true, reason: "because" }, 403],
  ["no reason", null, { isTest: true, reason: " " }, 400],
  ["no isTest", null, { reason: "because" }, 400],
  ["isTest as a string", null, { isTest: "true", reason: "because" }, 400],
];
for (const [label, admin, body, status] of refusals) {
  stubs.resetStubs();
  stubs.state.company = { ...realCo };
  if (admin) stubs.state.admin = { id: `adm_${admin.role}`, ...admin };
  r = await post("co_r", body);
  ok(r.status === status && stubs.calls.length === 0, `${label} → ${status}, nothing written`);
}
stubs.resetStubs();
stubs.state.company = { ...realCo, isDemo: true };
r = await post("co_r", { isTest: true, reason: "because" });
ok(r.status === 409 && stubs.calls.length === 0, "a demo → 409 (already out of every number), nothing written");
stubs.resetStubs();
stubs.state.company = { ...realCo, isTestCompany: true };
r = await post("co_r", { isTest: true, reason: "because" });
ok(r.status === 409 && stubs.calls.length === 0, "already marked → 409, nothing written (no duplicate audit row)");
const token = await new SignJWT({ impersonation: true, mode: "read_only", companyId: "co_r", platformAdminId: "adm_super" })
  .setProtectedHeader({ alg: "HS256" }).setExpirationTime("30m").sign(new TextEncoder().encode(process.env.IMPERSONATION_JWT_SECRET));
stubs.resetStubs();
stubs.state.company = { ...realCo };
r = await post("co_r", { isTest: true, reason: "because" }, `impersonation-token=${token}`);
ok(r.status === 403 && stubs.calls.length === 0, "inside a View as company session → 403, nothing written");

// ══ 5. The sweep ══════════════════════════════════════════════════════════
console.log("\n5. No demo-only exclusion left in a metric\n");
const METRIC_ROOTS = ["lib/platform", "app/api/platform", "app/platform", "lib/analytics", "lib/sales/funnelData.js", "lib/sales/funnelStages.js", "lib/pricing/benchmarkData.js", "app/api/sales/product-usage", "lib/company/memberActivity.js"];
const walk = (p) => {
  const abs = new URL(`../${p}`, import.meta.url).pathname;
  if (statSync(abs).isFile()) return [p];
  return readdirSync(abs).flatMap((n) => walk(join(p, n)));
};
const files = METRIC_ROOTS.flatMap(walk).filter((f) => f.endsWith(".js"));
// Each surviving demo-only line, and why it is not a metric hole.
const REASONED = [
  // Product-analytics events carry isDemo per row at write time; test
  // companies are removed from the same rows by excludeTestCompanies.
  ["lib/analytics/product/aggregate.js", /rows\.filter\(\(r\) => !r\.isDemo\)/],
  ["lib/analytics/product/aggregate.js", /!r\.isDemo\);/],
  ["app/api/platform/analytics/product/route.js", /if \(!includeDemo && r\.isDemo\) continue;/],
  ["app/api/platform/analytics/product/route.js", /\.filter\(\(c\) => includeDemo \|\| !c\.isDemo\)/],
  // Marketing / signup page views: anonymous visitors, no company. The
  // signup funnel drops test companies' browsers via testVisitorIds.
  ["lib/analytics/product/campaigns.js", /surface = 'marketing' AND "isDemo" = false/],
  ["lib/analytics/product/queries.js", /"visitorId" IS NOT NULL AND "isDemo" = false/],
  // The companies list: demos have their own chip; tests are `visible`.
  ["app/api/platform/companies/route.js", /c\.bucket !== "demo" && visible\(c\)/],
  ["app/api/platform/companies/route.js", /status === "demo" \? \{ isDemo: true \} : \{ isDemo: false \}/],
  // Behaviour, not a number: which demo the next-steps sample is drawn
  // from; what the impersonation token mints; whether to badge a demo.
  ["app/api/platform/onboarding-email/route.js", /\{ isDemo: true \}/],
  ["lib/platform/companyStanding.js", /bucket !== "demo"/],
  ["app/platform/companies/page.js", /!c\.isDemo/],
  ["lib/platform/metricsScope.js", /isDemo: false, isTestCompany: false/],
  ["lib/analytics/product/server.js", /select: \{ isDemo: true \}/],
];
// (?<!!) — "!!r.isDemo" passes the flag through; it excludes nothing.
const PATTERN = /isDemo: false|"isDemo" = false|bucket !== "demo"|(?<!!)!r\.isDemo|(?<!!)!c\.isDemo|\?\.isDemo\) continue|r\.isDemo\) continue|\{ isDemo: true \}/;
const holes = [];
for (const f of files) {
  const lines = decomment(read(f)).split("\n");
  lines.forEach((line, i) => {
    if (!PATTERN.test(line)) return;
    if (/isTestCompany/.test(line)) return;
    if (REASONED.some(([file, re]) => file === f && re.test(line))) return;
    holes.push(`${f}:${i + 1} ${line.trim().slice(0, 120)}`);
  });
}
ok(holes.length === 0, `every demo exclusion in a metric also leaves test companies out, or is listed with its reason (${files.length} files)${holes.length ? `\n     ${holes.join("\n     ")}` : ""}`);
const notDemoDefs = files.filter((f) => /const NOT_DEMO = \{/.test(read(f)));
ok(notDemoDefs.length === 0, `no file declares its own NOT_DEMO literal any more ${notDemoDefs.join(", ")}`);
const growth = read("lib/platform/growthMeasured.js");
ok(/\{ OR: \[\{ isDemo: true \}, \{ isTestCompany: true \}\] \}/.test(growth) && /c\."isTestCompany" = false/.test(growth), "measured growth (cohorts, retention, conversion): both the id list and the raw SQL leave test companies out");
ok(/"companyId" NOT IN \(SELECT "id" FROM "Company" WHERE "isTestCompany" = true\)/.test(read("lib/analytics/product/queries.js")), "range-wide page uniques: raw SQL leaves test companies' events out");
ok(/company: METRICS_COMPANY_WHERE/.test(read("lib/platform/costs/summary.js")), "cost per signup: the denominator leaves test companies out (the costs stay whole)");
ok(/company: NOT_DEMO \} \}\),\s*\n\s*db\.job\.count\(\{ where: \{ createdAt: \{ gte: startOfMonth \}, company: NOT_DEMO/.test(read("app/api/platform/analytics/overview/route.js")), "overview: quotes/jobs this month are scoped too");

// ══ 6. Behaviour untouched ════════════════════════════════════════════════
console.log("\n6. The company keeps working\n");
for (const f of [
  "app/api/cron/trial-reminders/route.js",
  "app/api/cron/signup-recovery/route.js",
  "app/api/cron/onboarding-next-steps/route.js",
  "app/api/cron/voice-auto-topup/route.js",
  "app/api/cron/billing-sync/route.js",
  "lib/billing/access.js",
  "lib/billing/trialReminder.js",
  "lib/currentMember.js",
  "middleware.js",
]) {
  ok(!/isTestCompany/.test(read(f)), `${f} never reads isTestCompany`);
}

// ══ 7. Wiring ═════════════════════════════════════════════════════════════
console.log("\n7. Wiring\n");
const schema = read("prisma/schema.prisma");
const companyModel = schema.match(/^model Company \{([\s\S]*?)^\}/m)?.[1] || "";
ok(/^\s+isTestCompany\s+Boolean\s+@default\(false\)/m.test(companyModel) && /^\s+testMarkedAt\s+DateTime\?/m.test(companyModel) && /^\s+testMarkedBy\s+String\?/m.test(companyModel),
  "Company has isTestCompany (non-null, default false), testMarkedAt, testMarkedBy");
const listRoute = read("app/api/platform/companies/route.js");
ok(/searchParams\.get\("tests"\) === "1"/.test(listRoute) && /realBucket/.test(listRoute), "companies API: ?tests=1 shows them, under their real bucket");
const listPage = read("app/platform/companies/page.js");
ok(/params\.set\("tests", "1"\)/.test(listPage) && /data-filter-tests/.test(listPage) && /data-test-company/.test(listPage), "companies page: show/hide toggle and the Test badge");
const detail = read("app/platform/companies/[id]/CompanyDetail.js");
ok(/<CompanyTestFlag/.test(detail) && /data-test-company/.test(detail), "company page: the switch and the header badge");
const flag = read("app/platform/companies/[id]/CompanyTestFlag.js");
ok(flag.includes("/api/platform/companies/${companyId}/test-company") && flag.includes('can("company:mark_test")'), "the switch posts to the route and is gated on company:mark_test");
ok(/isTestCompany: Boolean\(names\.get\(id\)\?\.isTestCompany\)/.test(read("app/api/platform/analytics/product/route.js")) && /\(test — in no total\)/.test(read("app/platform/analytics/page.js")), "analytics picker: labelled, in no total");
const auditActions = read("lib/platform/auditActions.js");
ok(/test_company_marked:/.test(auditActions) && /test_company_unmarked:/.test(auditActions), "the audit catalogue has words for both");
ok(/"company:mark_test":/.test(read("app/platform/team/page.js")), "/platform/team describes company:mark_test");

console.log(`\n${count - fail}/${count} passed`);
if (fail) process.exit(1);
