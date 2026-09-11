// scripts/check-campaign-rollup.mjs
//
//   npm run check:campaign-rollup
//
// lib/analytics/campaignRollup.js is the first place a dollar of spend is
// joined to a specific lead, and the join runs four tables deep: spend row →
// lead (by Meta campaign id) → quote → job → invoice family. Every link is a
// place to count wrong quietly, and every rate is a place to print 0 where
// the honest answer is "—". Executed here against fixtures, then mutated on
// disk to prove each assertion is load-bearing.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-campaign-rollup.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildCampaignRollup, objectiveLabelKey, OBJECTIVE_LABEL_KEYS } from "@/lib/analytics/campaignRollup";
import { RATES, RATE_STALE_AFTER_DAYS } from "@/lib/marketing/fx";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

const USD_CAD = RATES.find((r) => r.base === "USD" && r.quote === "CAD");
const dayAfter = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const FRESH = dayAfter(USD_CAD.rateDate, 14);
const STALE = dayAfter(USD_CAD.rateDate, RATE_STALE_AFTER_DAYS + 1);

// ── Fixtures: the owner's shape, in the company's own currency ─────────────
//
// Campaign A: a lead-form campaign, two days, produced two leads → one quote
//             → one job → two invoice versions (only the latest counts) plus a
//             deposit invoice linked by quote only.
// Campaign B: a click-to-message campaign, no lead forms, conversations only.
// Campaign C: an old campaign with no spend rows in the period but one lead
//             that arrived in it — must still appear, with null money.
const SPEND = [
  { campaignId: "A", campaignName: "Roof leads", objective: "OUTCOME_LEADS", amount: "40.00", currency: null, date: "2026-09-01T00:00:00Z",
    impressions: 1000, reach: 800, clicks: 50, linkClicks: 30, conversions: 2, messagingConversations: null, videoViews: null, postEngagements: 10 },
  { campaignId: "A", campaignName: "Roof leads (renamed)", objective: "OUTCOME_LEADS", amount: "60.00", currency: null, date: "2026-09-02T00:00:00Z",
    impressions: 1500, reach: 900, clicks: 75, linkClicks: 45, conversions: 1, messagingConversations: null, videoViews: null, postEngagements: null },
  { campaignId: "B", campaignName: "Message us", objective: "OUTCOME_ENGAGEMENT", amount: "25.00", currency: null, date: "2026-09-01T00:00:00Z",
    impressions: 400, reach: null, clicks: 10, linkClicks: null, conversions: 0, messagingConversations: 5, videoViews: 120, postEngagements: 40 },
];
const LEADS = [
  { id: "L1", metaCampaignId: "A", metaCampaignName: "Roof leads", quoteId: "Q1" },
  { id: "L2", metaCampaignId: "A", metaCampaignName: "Roof leads", quoteId: null },
  { id: "L3", metaCampaignId: "C", metaCampaignName: "Spring special", quoteId: "Q3" },
];
const JOBS = [
  { id: "J1", quoteId: "Q1", createdAt: "2026-09-03T00:00:00Z" },
  // A second job on the same quote (a re-visit). Counted as a job; the
  // quote-only invoice below attaches to J1, the OLDEST, as jobLink.js does.
  { id: "J1b", quoteId: "Q1", createdAt: "2026-09-10T00:00:00Z" },
];
const INVOICES = [
  { id: "I1", parentInvoiceId: null, version: 1, total: "1000.00", jobId: "J1", quoteId: "Q1" },
  { id: "I1v2", parentInvoiceId: "I1", version: 2, total: "1200.00", jobId: "J1", quoteId: "Q1" },
  { id: "I2", parentInvoiceId: null, version: 1, total: "300.00", jobId: null, quoteId: "Q1" },
];

console.log("\n1. The join: spend → leads → quotes → jobs → invoiced revenue\n");
{
  const r = buildCampaignRollup({ spendRows: SPEND, leads: LEADS, jobs: JOBS, invoices: INVOICES, companyCurrency: "CAD", asOf: FRESH });
  const A = r.campaigns.find((c) => c.campaignId === "A");
  const B = r.campaigns.find((c) => c.campaignId === "B");
  const C = r.campaigns.find((c) => c.campaignId === "C");
  ok("three campaigns: two with spend, one with a lead and no spend in the period", r.campaigns.length === 3 && A && B && C, r.campaigns.map((c) => c.campaignId));
  ok("most money first", r.campaigns[0].campaignId === "A" && r.campaigns[1].campaignId === "B");
  ok("A's name is the NEWEST row's name (campaigns get renamed)", A.campaignName === "Roof leads (renamed)", A.campaignName);
  ok("A's objective is Meta's value, with a label key beside it", A.objective === "OUTCOME_LEADS" && A.objectiveLabelKey === "leads", A);
  ok("A's spend is the sum of its days", A.spend === 100 && A.days === 2 && A.firstDate === "2026-09-01" && A.lastDate === "2026-09-02", A);
  ok("A's counts sum across days", A.impressions === 2500 && A.clicks === 125 && A.linkClicks === 75 && A.reach === 1700, A);
  ok("…and reach is flagged as a daily sum, not people", A.reachIsDailySum === true);
  ok("A's post engagements sum the non-null day only (10), not 10 + 0", A.postEngagements === 10, A.postEngagements);
  ok("A's conversations are null — Meta reported none on any day — never 0", A.messagingConversations === null && A.costPerConversation === null, A);
  ok("A's CTR is clicks over impressions, four places", A.ctr === 0.05, A.ctr);
  ok("A's CPC is spend over clicks", A.cpc === 0.8, A.cpc);
  ok("A's link CTR and cost per link click", A.linkCtr === 0.03 && A.costPerLinkClick === 1.33, [A.linkCtr, A.costPerLinkClick]);
  ok("A's Meta lead actions (3) are kept apart from leads FieldQuo received (2)", A.metaLeadActions === 3 && A.leads === 2, [A.metaLeadActions, A.leads]);
  ok("A's cost per lead is spend over RECEIVED leads: 100 / 2", A.costPerLead === 50, A.costPerLead);
  ok("A has one quote (one lead converted, one did not)", A.quotes === 1, A.quotes);
  ok("A has two jobs (the quote's job and its re-visit)", A.jobs === 2, A.jobs);
  ok("A's revenue is the LATEST invoice version (1200, not 1000 + 1200) plus the quote-linked deposit (300)", A.revenue === 1500, A.revenue);

  ok("B has no lead forms: leads 0, cost per lead null (not 0, not Infinity)", B.leads === 0 && B.costPerLead === null, B);
  ok("B's conversations and cost per conversation: 5, and 25 / 5", B.messagingConversations === 5 && B.costPerConversation === 5, B);
  ok("B's reach is null (Meta sent none), flagged accordingly", B.reach === null && B.reachIsDailySum === false, B);
  ok("B's link clicks are null so link CTR is null, never 0", B.linkClicks === null && B.linkCtr === null && B.costPerLinkClick === null, B);
  ok("B's video views and engagements come through", B.videoViews === 120 && B.postEngagements === 40, B);
  ok("B's revenue is null — nothing invoiced — not 0", B.revenue === null && B.quotes === 0 && B.jobs === 0, B);
  ok("B's objective label key is engagement", B.objectiveLabelKey === "engagement");

  ok("C appears with its lead's name and NULL money, not $0", C.campaignName === "Spring special" && C.spend === null && C.costPerLead === null && C.leads === 1, C);
  ok("C's quote is counted even with no job yet", C.quotes === 1 && C.jobs === 0 && C.revenue === null, C);
  ok("C's every Meta count is null, every rate is null", C.impressions === null && C.ctr === null && C.cpc === null && C.objective === null && C.objectiveLabelKey === null, C);

  ok("totals: spend 125, leads 3, quotes 2, jobs 2, revenue 1500", r.totals.spend === 125 && r.totals.leads === 3 && r.totals.quotes === 2 && r.totals.jobs === 2 && r.totals.revenue === 1500, r.totals);
  ok("totals are not approximate — nothing was converted", r.totals.approximate === false && r.totals.excluded.length === 0);
}

console.log("\n2. Money in another currency: approximate, or excluded and named\n");
{
  const usd = SPEND.map((s) => ({ ...s, currency: "USD" }));
  const r = buildCampaignRollup({ spendRows: usd, leads: LEADS, jobs: JOBS, invoices: INVOICES, companyCurrency: "CAD", asOf: FRESH });
  const A = r.campaigns.find((c) => c.campaignId === "A");
  ok("a USD campaign on a CAD company converts at the pinned rate", A.spend === Math.round(100 * USD_CAD.rate * 100) / 100, A.spend);
  ok("…and is flagged approximate with the original amount", A.approximate === true && A.convertedFrom[0].currency === "USD" && A.convertedFrom[0].amount === 100, A.convertedFrom);
  ok("…and cost per lead is off the CONVERTED spend", A.costPerLead === Math.round((100 * USD_CAD.rate) / 2 * 100) / 100, A.costPerLead);
  ok("the totals say what was converted, with the rate's age", r.totals.approximate === true && r.totals.currencyConversions[0].rateAgeDays === 14, r.totals.currencyConversions);
  const stale = buildCampaignRollup({ spendRows: usd, leads: LEADS, jobs: JOBS, invoices: INVOICES, companyCurrency: "CAD", asOf: STALE });
  const sA = stale.campaigns.find((c) => c.campaignId === "A");
  ok("with a stale rate the campaign STAYS on the list", Boolean(sA));
  ok("…its money is null, not 0", sA.spend === null && sA.cpc === null && sA.costPerLead === null, sA);
  ok("…its counts and leads are still there", sA.impressions === 2500 && sA.leads === 2 && sA.revenue === 1500, sA);
  ok("…and it says why, with the amount and a code", sA.spendExcluded && sA.spendExcluded.reasonCode === "stale_rate" && sA.spendExcluded.currency === "USD" && sA.spendExcluded.amount === 125, sA.spendExcluded);
  ok("…and the totals carry the exclusion", stale.totals.excluded.length === 1 && stale.totals.spend === 0 && stale.totals.approximate === false, stale.totals);
}

console.log("\n3. Objective labels and hostile input\n");
ok("every OUTCOME_* objective Meta documents has a label key", ["OUTCOME_LEADS", "OUTCOME_ENGAGEMENT", "OUTCOME_TRAFFIC", "OUTCOME_SALES", "OUTCOME_AWARENESS", "OUTCOME_APP_PROMOTION"].every((o) => objectiveLabelKey(o)));
ok("an objective Meta ships next year falls back to null (the screen prints the raw value)", objectiveLabelKey("OUTCOME_SOMETHING_NEW") === null && objectiveLabelKey(null) === null);
ok("label keys are short identifiers, not sentences", Object.values(OBJECTIVE_LABEL_KEYS).every((k) => /^[a-z][A-Za-z]+$/.test(k)));
ok("empty input is an empty, honest rollup", (() => { const r = buildCampaignRollup({ spendRows: [], leads: [], jobs: [], invoices: [], companyCurrency: "CAD", asOf: FRESH }); return r.campaigns.length === 0 && r.totals.spend === 0 && r.totals.revenue === null; })());
ok("null input does not throw", buildCampaignRollup({ spendRows: null, leads: null, jobs: null, invoices: null, companyCurrency: "CAD", asOf: FRESH }).campaigns.length === 0);
ok("a spend row with no campaignId is ignored (manual rows never reach the campaign list)",
  buildCampaignRollup({ spendRows: [{ campaignId: null, amount: 10 }], leads: [], jobs: [], invoices: [], companyCurrency: "CAD", asOf: FRESH }).campaigns.length === 0);
ok("the clock is required", (() => { try { buildCampaignRollup({ spendRows: SPEND, leads: [], jobs: [], invoices: [], companyCurrency: "CAD" }); return false; } catch { return true; } })());
ok("a lead whose quote has no job contributes no revenue and no job", (() => {
  const r = buildCampaignRollup({ spendRows: SPEND, leads: [{ id: "L9", metaCampaignId: "A", quoteId: "Q9" }], jobs: [], invoices: [{ id: "I9", parentInvoiceId: null, version: 1, total: 500, jobId: null, quoteId: "Q9" }], companyCurrency: "CAD", asOf: FRESH });
  const A = r.campaigns.find((c) => c.campaignId === "A");
  return A.jobs === 0 && A.revenue === null && A.quotes === 1;
})());
ok("an invoice for a job outside the campaign's leads is not counted", (() => {
  const r = buildCampaignRollup({ spendRows: SPEND, leads: LEADS, jobs: JOBS, invoices: [...INVOICES, { id: "IX", parentInvoiceId: null, version: 1, total: 9999, jobId: "JX", quoteId: "QX" }], companyCurrency: "CAD", asOf: FRESH });
  return r.campaigns.find((c) => c.campaignId === "A").revenue === 1500;
})());
ok("zero clicks is a null CPC, not Infinity", (() => {
  const r = buildCampaignRollup({ spendRows: [{ ...SPEND[0], clicks: 0, impressions: 0 }], leads: [], jobs: [], invoices: [], companyCurrency: "CAD", asOf: FRESH });
  const A = r.campaigns[0];
  return A.cpc === null && A.ctr === null && A.clicks === 0;
})());

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);

if (process.argv.includes("--no-mutate")) {
  process.exit(fails.length ? 1 : 0);
}

console.log("\n4. Mutation pass\n");

const LIB = fileURLToPath(new URL("../lib/analytics/campaignRollup.js", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));
const DB_STUB = fileURLToPath(new URL("./db-stub-loader.mjs", import.meta.url));
const ORIGINAL = readFileSync(LIB, "utf8");

const MUTATIONS = [
  ["sums every invoice version instead of the latest",
    (s) => s.replace("const latest = family.latest;", "const latest = family.latest; for (const m of family.members) if (m !== latest) revenueByJob.set(latest.jobId || quoteIdToJobId.get(latest.quoteId), (revenueByJob.get(latest.jobId || quoteIdToJobId.get(latest.quoteId)) || 0) + Number(m.total));")],
  ["drops the quote-only invoice branch (deposit invoices vanish from revenue)",
    (s) => s.replace("const jobId = latest.jobId || quoteIdToJobId.get(latest.quoteId) || null;", "const jobId = latest.jobId || null;")],
  ["divides spend by Meta's lead actions instead of leads FieldQuo received",
    (s) => s.replace("costPerLead: hasSpend && leadCount > 0 ? round2(spend / leadCount) : null,", "costPerLead: hasSpend && metaLeadActions > 0 ? round2(spend / metaLeadActions) : null,")],
  ["reports a null count as 0",
    (s) => s.replace("function sumOrNull(values) {\n  let total = null;", "function sumOrNull(values) {\n  let total = 0;")],
  ["prints 0 for a rate with no numerator",
    (s) => s.replace("if (numerator === null || numerator === undefined) return null;", "if (numerator === null || numerator === undefined) return 0;")],
  ["takes the OLDEST name instead of the newest",
    (s) => s.replace("sort((a, b) => b[0] - a[0])[0][1]", "sort((a, b) => a[0] - b[0])[0][1]")],
  ["drops a campaign that has leads but no spend rows in the period",
    (s) => s.replace("  for (const id of leadsByCampaign.keys()) {\n    if (!byCampaign.has(id)) {", "  for (const id of []) {\n    if (!byCampaign.has(id)) {")],
  ["reports a refused-currency campaign's spend as 0 instead of null",
    (s) => s.replace("const spend = hasSpend ? round2(c.spend) : null;", "const spend = round2(c.spend);")],
  ["forgets why a campaign's money is missing",
    (s) => s.replace("c.excluded = excludedByCurrency.get(row.currency) || null;", "c.excluded = null;")],
  ["counts a refused row's amount anyway",
    (s) => s.replace("      c.excluded = excludedByCurrency.get(row.currency) || null;\n      continue;", "      c.excluded = excludedByCurrency.get(row.currency) || null;")],
  ["stops flagging converted spend as approximate",
    (s) => s.replace("      c.approximate = true;", "")],
  ["counts revenue from a job that no lead of this campaign produced",
    (s) => s.replace("for (const jobId of jobIds) {\n      if (revenueByJob.has(jobId))", "for (const jobId of revenueByJob.keys()) {\n      if (revenueByJob.has(jobId))")],
  ["reports revenue as 0 when nothing was invoiced",
    (s) => s.replace("revenue: revenue === null ? null : round2(revenue),", "revenue: round2(revenue || 0),")],
  ["labels reach as people",
    (s) => s.replace("reachIsDailySum: reach !== null,", "reachIsDailySum: false,")],
];

let caught = 0;
const escaped = [];
try {
  for (const [label, mutate] of MUTATIONS) {
    const mutated = mutate(ORIGINAL);
    if (mutated === ORIGINAL) {
      escaped.push(`${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    writeFileSync(LIB, mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, "--import", DB_STUB, SELF, "--no-mutate"], { stdio: ["ignore", "pipe", "pipe"] });
      survived = true;
    } catch {
      /* caught */
    }
    writeFileSync(LIB, ORIGINAL);
    if (survived) escaped.push(`${label} — NOT caught`);
    else {
      caught++;
      console.log(`  ✓ caught: ${label}`);
    }
  }
} finally {
  writeFileSync(LIB, ORIGINAL);
}
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
