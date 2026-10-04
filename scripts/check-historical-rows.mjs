// scripts/check-historical-rows.mjs
//
//   npm run check:historical-rows
//
// Past jobs typed in through the Past jobs screen (POST /api/jobs/import, and
// the TrueFinish import) are real records of real work — and they are created
// TODAY, carrying dates from last year. Every figure that windows by
// createdAt, or forgets Quote/Job.historicalImportedAt, reads them as this
// month's activity: "Quotes sent this month: 18" for a company that sent two.
//
// EXECUTED, not grepped: each fixed function is run against an in-memory
// database (scripts/fixtures/countingFakeDb.mjs, which actually evaluates the
// where clause) holding live rows plus historical rows created this month but
// dated earlier. Two claims per surface:
//
//   1. with the imports present, the figure is the live figure;
//   2. the SAME call with the imports deleted from the fixture returns an
//      identical result (md5 of the JSON) — so a company with no historical
//      rows sees exactly what it saw, and the import moves nothing.
import { register } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { countingFakeDb } from "./fixtures/countingFakeDb.mjs";

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});

let pass = 0;
const failures = [];
function ok(label, cond, detail) {
  if (cond) pass += 1;
  else failures.push(`${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
}
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");

// `@/lib/db` → whatever fake the current section installed.
globalThis.__FQ_DB = null;
// The job costing route (section 4) also needs its session, gate and the
// three loaders that are not under test answered; everything that decides
// the payload — actualJobCost, compareJobCost, contractValue, the costing
// route itself — is the shipped file.
globalThis.__FQ_ROUTE = { member: null, full: null, overhead: null, subcontracts: [] };
const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "next/server": "fq-stub:next",
  "@/lib/apiMember": "fq-stub:member",
  "@/lib/permissions/apiGate": "fq-stub:gate",
  "@/lib/analytics/minimumPrice": "fq-stub:min-price",
  "@/lib/costing/quoteCostEstimate": "fq-stub:quoted-cost",
  "@/lib/costing/unattributedHours": "fq-stub:unattributed",
  "@/lib/costing/jobCostInputs": "fq-stub:subs",
};
const SOURCES = {
  "fq-stub:db": "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });",
  "fq-stub:next": "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };",
  "fq-stub:member": "export async function memberOrRefusal() { return { member: globalThis.__FQ_ROUTE.member }; }",
  "fq-stub:gate": "export async function levelOrRefusal() { return { full: globalThis.__FQ_ROUTE.full }; }",
  "fq-stub:min-price": "export async function calculateMinimumPrice() { return globalThis.__FQ_ROUTE.overhead == null ? null : { costPerJob: globalThis.__FQ_ROUTE.overhead }; }",
  "fq-stub:quoted-cost": "export async function quotedCostFor() { return null; }",
  "fq-stub:unattributed": "export async function unattributedLabourForJob() { return null; }",
  "fq-stub:subs": "export async function loadJobSubcontracts() { return globalThis.__FQ_ROUTE.subcontracts; }",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (SOURCES[url]) return { format: "module", shortCircuit: true, source: SOURCES[url] };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

/** Run `fn` against a fake seeded with `seed`; returns { result, calls, writes }. */
async function withDb(seed, fn, opts) {
  const fake = countingFakeDb(seed, opts);
  globalThis.__FQ_DB = fake.db;
  const result = await fn(fake.db);
  return { result, calls: fake.calls, writes: fake.writes };
}
/** The seed with every historical row removed — "a company that never imported". */
function withoutHistory(seed) {
  const out = {};
  for (const [k, rows] of Object.entries(seed)) out[k] = rows.filter((r) => !r.historicalImportedAt);
  return out;
}

// Sunday 4 October 2026, mid-afternoon in Toronto. The imports were typed in
// yesterday; the work they record happened in 2025 and earlier this year.
const NOW = new Date("2026-10-04T18:00:00Z");
const IMPORTED = new Date("2026-10-03T14:00:00Z");
const d = (iso) => new Date(iso);

const COMPANY = { id: "c1", timezone: "America/Toronto", createdAt: d("2025-01-01T00:00:00Z"), revenueGoalAnnual: null, currency: "CAD" };

/** Sixteen past jobs' quotes, created by the import yesterday, accepted on their real dates. */
function importedQuotes(companyId = "c1") {
  const out = [];
  for (let i = 0; i < 16; i += 1) {
    // One of them is dated THIS month (a job finished on the 1st and typed in
    // on the 3rd) — still an import, still never sent from FieldQuo.
    const acceptedAt = i === 0 ? d("2026-10-01T16:00:00Z") : d(`2025-${String((i % 12) + 1).padStart(2, "0")}-15T16:00:00Z`);
    out.push({
      id: `hq${i}`, companyId, status: "accepted", total: 1000 + i * 100, acceptedTotal: 1000 + i * 100,
      createdAt: IMPORTED, sentAt: null, acceptedAt, declinedAt: null, archivedAt: null,
      historicalImportedAt: IMPORTED,
    });
  }
  return out;
}

const LIVE_QUOTES = [
  // Two sent this month, one of them accepted.
  { id: "q1", companyId: "c1", status: "accepted", total: 2400, acceptedTotal: 2400, createdAt: d("2026-10-01T15:00:00Z"), sentAt: d("2026-10-02T15:00:00Z"), acceptedAt: d("2026-10-03T15:00:00Z"), declinedAt: null, archivedAt: null, historicalImportedAt: null },
  { id: "q2", companyId: "c1", status: "sent", total: 1800, createdAt: d("2026-10-02T15:00:00Z"), sentAt: d("2026-10-03T15:00:00Z"), acceptedAt: null, declinedAt: null, archivedAt: null, historicalImportedAt: null },
  // Sent at 10 pm on 30 September in Toronto — 02:00 on 1 October in UTC.
  // The company's September, whatever the server's clock says.
  { id: "q3", companyId: "c1", status: "sent", total: 900, createdAt: d("2026-09-30T20:00:00Z"), sentAt: d("2026-10-01T02:00:00Z"), acceptedAt: null, declinedAt: null, archivedAt: null, historicalImportedAt: null },
  // Last month: sent and declined.
  { id: "q4", companyId: "c1", status: "declined", total: 3100, createdAt: d("2026-09-10T15:00:00Z"), sentAt: d("2026-09-10T16:00:00Z"), acceptedAt: null, declinedAt: d("2026-09-20T15:00:00Z"), archivedAt: null, historicalImportedAt: null },
  // A draft this month: created, never sent.
  { id: "q5", companyId: "c1", status: "draft", total: 500, createdAt: d("2026-10-04T12:00:00Z"), sentAt: null, acceptedAt: null, declinedAt: null, archivedAt: null, historicalImportedAt: null },
  // Another tenant's quote, sent this month — never counted.
  { id: "x1", companyId: "c2", status: "sent", total: 9999, createdAt: d("2026-10-02T15:00:00Z"), sentAt: d("2026-10-02T15:00:00Z"), acceptedAt: null, declinedAt: null, archivedAt: null, historicalImportedAt: null },
];

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. lib/analytics/overview.js — the dashboard tiles, the monthly summary, the AI digest\n");
{
  const { getAnalyticsOverview } = await import("@/lib/analytics/overview");
  const seed = {
    company: [COMPANY],
    quote: [...LIVE_QUOTES, ...importedQuotes()],
    invoice: [],
    expense: [],
  };
  const run = (s) => withDb(s, () => getAnalyticsOverview({ companyId: "c1", now: NOW }));
  const { result: o, writes } = await run(seed);
  ok("quotes sent this month counts the two that were sent, not the sixteen imports", o.quotesSent === 2, o.quotesSent);
  ok("...dated by sentAt in the company's month: 10 pm on 30 Sept in Toronto is September", o.priorQuotesSent === 2, o.priorQuotesSent);
  ok("quotes accepted this month is the one live acceptance, not the import dated the 1st", o.quotesAccepted === 1, o.quotesAccepted);
  ok("conversion is 1 of 2, not 1 of 18", o.conversionRate === 0.5, o.conversionRate);
  ok("quotes created this month excludes imports (q1, q2 and the draft)", o.quotesCreated === 3, o.quotesCreated);
  ok("last month's conversion: 0 of 2", o.priorConversionRate === 0, o.priorConversionRate);
  ok("the overview writes nothing", writes.length === 0);
  const { result: bare } = await run(withoutHistory(seed));
  ok("a company with no historical rows sees an identical overview (md5)", md5(o) === md5(bare), [md5(o), md5(bare)]);

  // The monthly summary email asks about the month it reports by handing
  // overview the 15th at noon UTC (lib/analytics/monthlySummaryData.js) —
  // inside that month in every zone a company can pick, so the company-zone
  // windows still land on the month being reported.
  const { result: sept } = await withDb(seed, () => getAnalyticsOverview({ companyId: "c1", now: d("2026-09-15T12:00:00Z") }));
  ok("the summary's September: two sent (incl. 10 pm on the 30th), none accepted, no imports", sept.quotesSent === 2 && sept.quotesAccepted === 0, [sept.quotesSent, sept.quotesAccepted]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. lib/dashboard/homeData.js — \"Your focus\": won this month over sent this month\n");
{
  const { loadHomeData } = await import("@/lib/dashboard/homeData");
  const seed = { company: [COMPANY], quote: [...LIVE_QUOTES, ...importedQuotes()] };
  const ownerFull = { id: "m1", userId: "u1", role: "owner", permissions: null, companyId: "c1" };
  const run = (s) =>
    withDb(s, (db) => loadHomeData(db, { member: { companyId: "c1", userId: "u1", role: "owner" }, full: ownerFull, now: NOW }));
  const { result: h, writes } = await run(seed);
  ok("sent this month: the two live sends", h.facts.quotesSentThisMonth === 2, h.facts.quotesSentThisMonth);
  ok("won this month: the one live acceptance — not the import dated the 1st", h.facts.quotesAcceptedThisMonth === 1, h.facts.quotesAcceptedThisMonth);
  ok("...so won can never exceed sent on imports alone", h.facts.quotesAcceptedThisMonth <= h.facts.quotesSentThisMonth);
  ok("the home loader writes nothing", writes.length === 0);
  const { result: bare } = await run(withoutHistory(seed));
  ok("a company with no historical rows sees identical focus facts (md5)", md5(h.facts) === md5(bare.facts), [h.facts, bare.facts]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. app/app/page.js — the \"Recent quotes\" card\n");
{
  // The card is a client component; what it does with the list is one
  // expression, lifted from the shipped source and executed — not re-typed.
  const page = readFileSync(new URL("../app/app/page.js", import.meta.url), "utf8");
  const m = page.match(/setRecentQuotes\((result\.data[^;]*?\.slice\(0, 5\))\);/);
  ok("the card's list expression is found in app/app/page.js", Boolean(m));
  const cardList = m ? new Function("result", `return ${m[1]};`) : () => [];
  // GET /api/quotes: newest CREATED first, every row through redactQuotes.
  const { redactQuotes } = await import("@/lib/permissions/enforce");
  const { PERMISSION_PRESETS } = await import("@/lib/permissions");
  const estimator = { id: "m3", role: "employee", companyId: "c1", permissions: { ...PERMISSION_PRESETS.estimator.values, showPricing: false } };
  const apiList = (quotes) =>
    redactQuotes(estimator, [...quotes].filter((q) => q.companyId === "c1").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  const all = apiList([...LIVE_QUOTES, ...importedQuotes()]);
  ok("historicalImportedAt survives the API's redaction (so the filter is not vacuous)", all.some((q) => q.historicalImportedAt));
  ok("...and a bare slice(0, 5) would be four imports and one draft (the bug)", all.slice(0, 5).filter((q) => q.historicalImportedAt).length === 4);
  const shown = cardList({ data: all });
  ok("the card shows the live quotes, newest first", JSON.stringify(shown.map((q) => q.id)) === JSON.stringify(["q5", "q2", "q1", "q3", "q4"]), shown.map((q) => q.id));
  ok("...and no import", shown.every((q) => !q.historicalImportedAt));
  const bare = apiList(LIVE_QUOTES);
  ok("a company with no historical rows sees the same five it always did (md5 vs slice(0, 5))", md5(cardList({ data: bare })) === md5(bare.slice(0, 5)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4a. lib/analytics/kpis.js — margin and labour-% leave out past jobs with no costs\n");
{
  const { buildMarginRollup } = await import("@/lib/analytics/kpis");
  // Five live jobs, costed. Gross margins 60/50/40/30/20 → median 40.
  const live = [0.4, 0.5, 0.6, 0.7, 0.8].map((costShare, i) => ({
    id: `j${i}`,
    revenue: 1000,
    expenses: [{ amount: costShare * 1000 - 100, category: "materials" }],
    timeEntries: [{ hours: 2, status: "approved", worker: { hourlyRate: 50 } }],
    historical: false,
  }));
  // Six past jobs typed in: paid, nothing recorded against them.
  const past = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, revenue: 3200, expenses: [], timeEntries: [], historical: true }));
  // One past job whose costs WERE entered afterwards — measured like any job.
  const pastCosted = { id: "pc", revenue: 2000, expenses: [{ amount: 1500, category: "materials" }], timeEntries: [], historical: true };

  const r = buildMarginRollup({ jobs: [...live, ...past], overheadPerJob: null, materialsTrap: { triggered: false } });
  const bare = buildMarginRollup({ jobs: live, overheadPerJob: null, materialsTrap: { triggered: false } });
  ok("gross margin is the live jobs' median, not dragged toward 100%", r.grossMarginPct.value === bare.grossMarginPct.value && bare.grossMarginPct.value === 40, [r.grossMarginPct.value, bare.grossMarginPct.value]);
  ok("labour-% is the live jobs' figure", r.labourCostPctOfRevenue.value === bare.labourCostPctOfRevenue.value, [r.labourCostPctOfRevenue.value, bare.labourCostPctOfRevenue.value]);
  ok("...on a sample of five", r.grossMarginPct.sampleSize === 5 && r.labourCostPctOfRevenue.sampleSize === 5);
  ok("the six are counted, not dropped silently", r.labourCostPctOfRevenue.raw.excludedCostsNotRecorded === 6 && r.grossMarginPct.raw.excludedCostsNotRecorded === 6, r.labourCostPctOfRevenue.raw);
  ok("...and do not count as 'no revenue'", r.grossMarginPct.raw.excludedNoRevenue === 0);
  ok("a company with no historical rows gets an identical roll-up (md5, no new key)", !("excludedCostsNotRecorded" in bare.grossMarginPct.raw) && md5(bare) === md5(buildMarginRollup({ jobs: live.map(({ historical, ...j }) => j), overheadPerJob: null, materialsTrap: { triggered: false } })));
  const withCosted = buildMarginRollup({ jobs: [...live, ...past, pastCosted], overheadPerJob: null, materialsTrap: { triggered: false } });
  ok("a past job with costs recorded IS measured", withCosted.grossMarginPct.sampleSize === 6, withCosted.grossMarginPct.sampleSize);
  const onlyPast = buildMarginRollup({ jobs: past, overheadPerJob: null, materialsTrap: { triggered: false } });
  ok("only uncosted past jobs: no margin at all (not 100%), and the count says why", onlyPast.grossMarginPct.value === null && onlyPast.grossMarginPct.reason === "no_priced_jobs" && onlyPast.labourCostPctOfRevenue.raw.excludedCostsNotRecorded === 6);
  const trapped = buildMarginRollup({ jobs: [...live, ...past], overheadPerJob: null, materialsTrap: { triggered: true, buyListTotal: 5000, expenseTotal: 0 } });
  ok("...the count survives the materials-trap branch too", trapped.labourCostPctOfRevenue.raw.excludedCostsNotRecorded === 6);

  // The route hands `historical` over, and selects the column it is read from.
  const route = readFileSync(new URL("../app/api/analytics/kpis/route.js", import.meta.url), "utf8");
  const completedSel = route.slice(route.indexOf("const completedJobs = await db.job.findMany"), route.indexOf("const completedJobs = await db.job.findMany") + 1200);
  ok("the KPI route selects historicalImportedAt on the completed jobs", /historicalImportedAt: true/.test(completedSel));
  const marginJobs = route.slice(route.indexOf("const marginJobs"), route.indexOf("const marginJobs") + 400);
  ok("...and passes it to the margin roll-up as `historical`", /historical: Boolean\(job\.historicalImportedAt\)/.test(marginJobs));
  const page = readFileSync(new URL("../app/app/analytics/kpis/page.js", import.meta.url), "utf8");
  ok("the KPI page says how many were left out", /excludedCostsNotRecorded > 0/.test(page) && /"app\.kpis\.costsNotRecorded"/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4b. GET /api/jobs/[id]/costing — a past job with no costs shows no margin\n");
{
  const { GET } = await import("@/app/api/jobs/[id]/costing/route.js");
  globalThis.__FQ_ROUTE.member = { id: "m1", userId: "u1", companyId: "c1", role: "owner" };
  globalThis.__FQ_ROUTE.full = { id: "m1", userId: "u1", companyId: "c1", role: "owner", permissions: null };
  globalThis.__FQ_ROUTE.overhead = 150;
  const job = (patch) => ({
    id: "job1", companyId: "c1", status: "completed",
    quote: { id: "qq", total: 3200 }, changeOrders: [],
    costRevisionDecision: null, costRevisionDecidedAt: null,
    company: { currency: "CAD", costRevisionThresholdPct: null },
    historicalImportedAt: null,
    ...patch,
  });
  const call = async (seed, subs = []) => {
    globalThis.__FQ_ROUTE.subcontracts = subs;
    const { result, writes } = await withDb(seed, () => GET(new Request("http://x/api/jobs/job1/costing"), { params: Promise.resolve({ id: "job1" }) }), {
      relations: { timeEntry: { worker: ["worker", "workerId"] } },
    });
    return { ...result, writes };
  };
  const empty = { expense: [], timeEntry: [], assetUseLog: [], worker: [] };

  const pastBare = await call({ ...empty, job: [job({ historicalImportedAt: IMPORTED })] });
  ok("a past job with nothing recorded is flagged costsNotRecorded", pastBare.status === 200 && pastBare.body.costsNotRecorded === true, pastBare.body);
  ok("...even though overhead alone puts a figure on it (overhead is not a recorded cost)", pastBare.body.actual.total === 150);
  ok("the route writes nothing", pastBare.writes.length === 0);

  const liveBare = await call({ ...empty, job: [job({})] });
  ok("a LIVE job with nothing recorded is not flagged (it is just early)", !("costsNotRecorded" in liveBare.body));

  const costed = {
    ...empty,
    expense: [{ id: "e1", companyId: "c1", projectId: "job1", category: "materials", amount: 900 }],
  };
  const pastCosted = await call({ ...costed, job: [job({ historicalImportedAt: IMPORTED })] });
  const liveCosted = await call({ ...costed, job: [job({})] });
  ok("a past job with a receipt recorded gets its margin back", !("costsNotRecorded" in pastCosted.body) && pastCosted.body.comparison.marginPct !== null);
  ok("...identical (md5) to the same job never imported", md5(pastCosted.body) === md5(liveCosted.body));
  const pastWithSub = await call({ ...empty, job: [job({ historicalImportedAt: IMPORTED })] }, [{ id: "s1", agreedAmount: 800, status: "agreed" }]);
  ok("...and so does one with a subcontractor on it", !("costsNotRecorded" in pastWithSub.body));

  const panel = readFileSync(new URL("../app/components/jobs/JobCosting.js", import.meta.url), "utf8");
  ok("the job panel prints the sentence when flagged", /data\.costsNotRecorded && \(/.test(panel) && /"app\.jobCosting\.costsNotRecorded"/.test(panel));
  ok("...and draws no margin block when flagged", /comparison\.profit !== null && !data\.costsNotRecorded/.test(panel));
  const review = readFileSync(new URL("../app/components/jobs/CostReview.js", import.meta.url), "utf8");
  ok("the close-out modal's verdict says the same instead of 'Margin 100%'", /data\?\.costsNotRecorded\s*\?\s*t\("app\.jobCosting\.costsNotRecorded"/.test(review));

  const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
  for (const key of ["app.jobCosting.costsNotRecorded", "app.kpis.costsNotRecorded"]) {
    const missing = Object.entries(APP_MESSAGES).filter(([, m]) => typeof m[key] !== "string" || !m[key].trim()).map(([l]) => l);
    ok(`${key} exists in every language`, missing.length === 0, missing);
  }
  const noCount = Object.entries(APP_MESSAGES).filter(([, m]) => !String(m["app.kpis.costsNotRecorded"]).includes("{count}")).map(([l]) => l);
  ok("...and the KPI sentence keeps its {count} in every language", noCount.length === 0, noCount);
}

// ═══════════════════════════════════════════════════════════════════════════
if (failures.length) {
  console.error(`\n✗ ${failures.length} failed, ${pass} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\n✓ check:historical-rows — ${pass} passed\n`);
