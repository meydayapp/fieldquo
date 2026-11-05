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

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync } from "node:fs";
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

// ── 4. A lead that names its campaign and carries no id ────────────────────
//
// TrueFinish buys its Meta ads through an agency whose ad drives to the
// AGENCY's landing page. Meta never sees the submission, so the agency POSTs
// the lead with only the campaign name it typed into Ads Manager. Resolved
// onto the id through lib/analytics/campaignAliases.js, and ONLY when a spend
// row of this company and this period proves the pairing.
console.log("\n4. A lead that names its campaign and carries no id\n");
{
  // Two more campaigns in the period: "D" with a name no lead will claim, and
  // "E" + "F" sharing ONE name — the ambiguous case.
  const AGENCY_SPEND = [
    ...SPEND,
    { campaignId: "D", campaignName: "Agency package 1", objective: "OUTCOME_LEADS", amount: "200.00", currency: null, date: "2026-09-03T00:00:00Z", impressions: 2000, reach: null, clicks: 60, linkClicks: 40, conversions: null, messagingConversations: null, videoViews: null, postEngagements: null },
    { campaignId: "E", campaignName: "Spring promo", objective: "OUTCOME_LEADS", amount: "10.00", currency: null, date: "2026-09-04T00:00:00Z", impressions: 10, reach: null, clicks: 1, linkClicks: null, conversions: null, messagingConversations: null, videoViews: null, postEngagements: null },
    { campaignId: "F", campaignName: "spring promo", objective: "OUTCOME_LEADS", amount: "11.00", currency: null, date: "2026-09-04T00:00:00Z", impressions: 11, reach: null, clicks: 1, linkClicks: null, conversions: null, messagingConversations: null, videoViews: null, postEngagements: null },
  ];
  const NAMED_LEADS = [
    // Padded and re-cased on purpose: the fold is trim + lower-case, the same
    // fold campaignKeyOf has always used, so this IS campaign A.
    { id: "N1", metaCampaignId: null, adCampaignName: "  Roof Leads  ", quoteId: null },
    // Both an id and a name, and they point at DIFFERENT campaigns: the id
    // wins and the lead is counted once.
    { id: "N2", metaCampaignId: "A", adCampaignName: "Message us", quoteId: null },
    // One name, two campaign ids in the period: ambiguous, so neither.
    { id: "N3", metaCampaignId: null, adCampaignName: "Spring promo", quoteId: "QN3" },
    // A name the company's own ad account never spent under.
    { id: "N4", metaCampaignId: null, adCampaignName: "Whatever the agency called it", quoteId: "QN4" },
  ];
  const base = buildCampaignRollup({ spendRows: AGENCY_SPEND, leads: LEADS, jobs: JOBS, invoices: INVOICES, companyCurrency: "CAD", asOf: FRESH });
  const r = buildCampaignRollup({ spendRows: AGENCY_SPEND, leads: [...LEADS, ...NAMED_LEADS], jobs: JOBS, invoices: INVOICES, companyCurrency: "CAD", asOf: FRESH });
  const by = (id) => r.campaigns.find((c) => c.campaignId === id);
  const A = by("A");
  const B = by("B");

  // If this fails, an agency-posted lead falls out of the join exactly as it
  // did before this change and its campaign shows 0 leads beside real spend.
  ok("a lead with only a campaign NAME joins the campaign the spend rows say owns that name", A.leads === 4, { leads: A.leads, nameMatched: A.nameMatchedLeads });
  // If this fails the screen cannot tell the owner which of a row's leads rest
  // on the agency's word rather than on Meta resolving the ad itself.
  ok("…and the row says how many got there by name (1 of A's 4; the three id-carrying leads are not counted as name matches)", A.nameMatchedLeads === 1, A.nameMatchedLeads);
  // If this fails one lead is counted on two campaigns and cost per lead is
  // wrong on both of them.
  ok("a lead carrying BOTH an id and a different name counts once, in the ID's campaign", B.leads === 0 && A.leads === 4, { a: A.leads, b: B.leads });
  ok("…and is not reported as a name match (its id was the evidence)", A.nameMatchedLeads === 1);
  // If this fails a name two campaigns share is silently credited to one of
  // them, and whichever came first in the rows wins a lead it may not own.
  ok("one name claimed by TWO campaign ids resolves to nothing — E and F both stay at 0 leads", by("E").leads === 0 && by("F").leads === 0, [by("E").leads, by("F").leads]);
  // If this fails the file invents a campaign out of a lead's own words, which
  // is AGENTS.md failure class 5: absence of a spend row is not a campaign.
  ok("a name no spend row claims leaves its lead unattributed, and invents no campaign", !r.campaigns.some((c) => /whatever/i.test(c.campaignName || "")) && r.campaigns.length === base.campaigns.length, r.campaigns.map((c) => c.campaignId));
  ok("D keeps its spend and no leads — a campaign nobody named is not given any", by("D").spend === 200 && by("D").leads === 0 && by("D").nameMatchedLeads === 0, by("D"));
  // If this fails, landing this change moved a number on a campaign that was
  // already counting correctly — the one thing it must not do.
  ok("every campaign counts the same as before the name-only leads existed, except A", (() => {
    const strip = (c) => JSON.stringify({ ...c, leads: null, nameMatchedLeads: null, costPerLead: null, quotes: null, jobs: null, revenue: null, paid: null, inferredQuotes: null });
    return base.campaigns.every((b) => {
      const after = by(b.campaignId);
      if (!after) return false;
      if (b.campaignId === "A") return strip(b) === strip(after);
      return JSON.stringify(b) === JSON.stringify(after);
    });
  })(), r.campaigns.map((c) => c.campaignId));
  ok("A's money and Meta counts are untouched: only its lead-derived columns moved", A.spend === 100 && A.impressions === 2500 && A.costPerLead === 25, [A.spend, A.costPerLead]);
  ok("the totals carry the name-matched count, and it is a number on every row", r.totals.nameMatchedLeads === 1 && r.campaigns.every((c) => Number.isInteger(c.nameMatchedLeads)), r.totals.nameMatchedLeads);
  ok("no name-only lead is in the join at all when there are no spend rows to prove a pairing", (() => {
    const none = buildCampaignRollup({ spendRows: [], leads: NAMED_LEADS, jobs: [], invoices: [], companyCurrency: "CAD", asOf: FRESH });
    // N2 still has its own Meta campaign id, so it alone gets a row.
    return none.campaigns.length === 1 && none.campaigns[0].campaignId === "A" && none.totals.nameMatchedLeads === 0;
  })());
  // A refused currency takes the campaign's money away, not its identity: the
  // pairing a spend row proves stands whether or not the row can be priced.
  ok("a campaign whose currency the pinned rate refuses still resolves its name-matched leads", (() => {
    const usd = AGENCY_SPEND.map((s) => (s.campaignId === "A" ? { ...s, currency: "USD" } : s));
    const stale = buildCampaignRollup({ spendRows: usd, leads: [...LEADS, ...NAMED_LEADS], jobs: JOBS, invoices: INVOICES, companyCurrency: "CAD", asOf: STALE });
    const sA = stale.campaigns.find((c) => c.campaignId === "A");
    return sA.spend === null && sA.leads === 4 && sA.nameMatchedLeads === 1;
  })());

  // ── The screen, not only the comment ──────────────────────────────────────
  // A count nothing renders is AGENTS.md failure class 1. Both campaign tables
  // must show it, or the owner reads a name match as Meta's own id match.
  const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");
  const spendPage = read("app/app/marketing/spend/page.js");
  const resultsPage = read("app/app/marketing/results/page.js");
  ok("the Spend page's campaign row renders nameMatchedLeads", /c\.nameMatchedLeads > 0/.test(spendPage) && /campaigns\.nameMatchedRow/.test(spendPage));
  ok("…and the page says what a name match is when it applies", /totals\?\.nameMatchedLeads > 0/.test(spendPage) && /campaigns\.nameMatchedNote/.test(spendPage));
  ok("the Marketing results page shows it too (same resolver, same wording)", /c\.nameMatchedLeads > 0/.test(resultsPage) && /campaigns\.nameMatchedRow/.test(resultsPage));
  ok("the file header no longer claims the join is on the Meta id alone", /by name/.test(read("lib/analytics/campaignRollup.js")));
}

// ── 4b. The loader, over an in-memory store ────────────────────────────────
//
// buildCampaignRollup can only count the leads it is handed, and until now
// lib/analytics/campaignRollupData.js handed it `metaCampaignId: { not: null }`
// — every agency-posted lead was gone before the pure function ran. Executed
// here through the real loader so the widened query and the JS narrowing are
// run, not read.
//
// One limit, stated rather than hidden: scripts/fixtures/memoryPrisma.mjs's
// `not` comparison does not model Prisma's Json null sentinels, so this proves
// the narrowing and the ordering, NOT the `attribution: { not: Prisma.DbNull }`
// filter itself. That filter is the same one app/api/leads/traffic/route.js
// has been running against Neon since it shipped.
console.log("\n4b. The loader: which leads reach the rollup\n");
{
  const { fakeDb } = await import("./fixtures/memoryPrisma.mjs");
  const { loadCampaignRollup } = await import("@/lib/analytics/campaignRollupData");
  const db = fakeDb();
  const CO = "co_rollup";
  const ID = "120249142978690135";
  const NAME = "TFC / FMM / DA / PKG 1 / LEADS / 20.10.2026";
  const day = (iso) => new Date(`${iso}T00:00:00Z`);
  await db.company.create({ data: { id: CO, name: "TrueFinish Cabinets Inc.", currency: "CAD", country: "CA" } });
  await db.company.create({ data: { id: "co_other", name: "Someone Else", currency: "CAD", country: "CA" } });
  await db.marketingSpend.create({ data: { companyId: CO, platform: "facebook", source: "meta_api", amount: 2248.36, date: day("2026-10-23"), campaignId: ID, campaignName: NAME } });
  await db.marketingSpend.create({ data: { companyId: "co_other", platform: "facebook", source: "meta_api", amount: 9999, date: day("2026-10-23"), campaignId: "120299999999999999", campaignName: NAME } });
  const mk = (over) => db.leadRequest.create({ data: { companyId: CO, name: over.name, email: over.email, temperature: "warm", createdAt: over.createdAt, updatedAt: over.createdAt, ...over } });
  // One client, reachable two ways, with a quote nobody linked to a lead.
  // lib/analytics/campaignRollupData.js's inferLeadQuotes hands each unlinked
  // lead the best UNCLAIMED quote in list order, so a lead that names no
  // campaign must not be in that list at all — it would take this quote and
  // the agency's lead would show as a lead that never became anything.
  const sharedClient = await db.client.create({ data: { companyId: CO, name: "Dana Shared", email: "dana@example.com", phone: "+16135550199", createdAt: day("2026-10-01") } });
  await db.quote.create({ data: { companyId: CO, clientId: sharedClient.id, quoteNumber: "Q-SHARED", status: "sent", total: 8800, createdAt: day("2026-10-27") } });
  // Created FIRST on purpose: in list order it would get first refusal.
  await mk({ name: "Web Walker", email: "dana@example.com", source: "self_quote", createdAt: day("2026-10-22"), attribution: { source: "direct", landedAt: "2026-10-22T09:00:00.000Z" } });
  await mk({ name: "Pat Agency", email: "pat@example.com", phone: "+16135550199", source: "agency_funnel", createdAt: day("2026-10-23"), attribution: { ad: { cn: NAME, us: "FMM" }, source: "agency_funnel", landedAt: "2026-10-23T14:02:00.000Z", utmSource: "FMM" } });
  await mk({ name: "Rae Agency", email: "rae@example.com", source: "agency_funnel", createdAt: day("2026-10-24"), attribution: { ad: { cn: NAME, us: "FMM" }, source: "agency_funnel", landedAt: "2026-10-24T09:00:00.000Z", utmSource: "FMM" } });
  // No attribution at all: dropped too, and must not throw.
  await mk({ name: "Phone Caller", email: "phone@example.com", source: "phone_agent", createdAt: day("2026-10-26") });
  // Another tenant's agency lead, same campaign name: never counted here.
  await db.leadRequest.create({ data: { companyId: "co_other", name: "Zed", email: "zed@example.com", source: "agency_funnel", temperature: "hot", createdAt: day("2026-10-23"), updatedAt: day("2026-10-23"), attribution: { ad: { cn: NAME } } } });

  const range = { gte: day("2026-10-01"), lte: day("2026-11-05") };
  const r = await loadCampaignRollup({ db, companyId: CO, range, asOf: day("2026-11-05"), rates: [] });
  const row = r.campaigns.find((c) => c.campaignId === ID);
  // If this fails, the loader is still dropping the agency's leads in SQL and
  // no amount of resolving downstream can see them.
  ok("the loader hands the rollup the agency's name-only leads", Boolean(row) && row.leads === 2 && row.nameMatchedLeads === 2, row);
  ok("…and the money is this tenant's own", row.spend === 2248.36 && row.costPerLead === 1124.18, [row.spend, row.costPerLead]);
  // If this fails the loader has started counting every attributed lead as a
  // campaign lead, and cost per lead collapses toward zero.
  ok("a lead whose attribution names no campaign is read and dropped, and one with none does not throw", r.totals.leads === 2, r.totals);
  // If this fails, widening the query let every attributed lead into the list
  // inferLeadQuotes walks, and a website lead takes the quote an agency lead
  // produced — the campaign shows the lead and none of its work.
  ok("…and is not in the list that claims unlinked quotes: the agency's lead keeps the quote it matches", row.quotes === 1 && row.inferredQuotes === 1, { quotes: row.quotes, inferred: row.inferredQuotes });
  ok("the other tenant's identical campaign name buys it nothing here", r.campaigns.length === 1, r.campaigns.map((c) => c.campaignId));

  // The ordering contract: inferLeadQuotes hands each unlinked lead the best
  // unclaimed quote in list order, so an id-carrying lead must be offered one
  // before a name-matched lead — otherwise landing this change could move a
  // quote off a campaign that was already counting correctly.
  const src = readFileSync(fileURLToPath(new URL("../lib/analytics/campaignRollupData.js", import.meta.url)), "utf8");
  ok("the loader puts id-carrying leads ahead of name-matched ones before following them to money", /const leads = \[\.\.\.byId, \.\.\.byName\];/.test(src));
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);

if (process.argv.includes("--no-mutate")) {
  process.exit(fails.length ? 1 : 0);
}

// A mutation pass over a check that ALREADY fails proves nothing: every mutant
// exits non-zero for the baseline's reason, so "all N mutants caught" is a
// vacuous pass. Found the hard way while adding the name-match assertions —
// 21 of 21 "caught" while four baseline assertions were red.
if (fails.length) {
  console.log("\nMutation pass skipped: the baseline fails, so every mutant would 'fail' for its reason.");
  process.exit(1);
}

console.log("\n5. Mutation pass\n");

const LIB = fileURLToPath(new URL("../lib/analytics/campaignRollup.js", import.meta.url));
// The shared name → id resolver is mutated too: its two refusals (an
// ambiguous name, a name no spend row claims) are the whole reason a name
// match is admissible evidence, and an assertion that only reads them is not
// an assertion.
const ALIAS_LIB = fileURLToPath(new URL("../lib/analytics/campaignAliases.js", import.meta.url));
// And the loader, because a resolver can only resolve the leads the query
// returns: the old `metaCampaignId: { not: null }` dropped every agency lead
// before any of this ran.
const DATA_LIB = fileURLToPath(new URL("../lib/analytics/campaignRollupData.js", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));
const DB_STUB = fileURLToPath(new URL("./db-stub-loader.mjs", import.meta.url));
const ORIGINAL = readFileSync(LIB, "utf8");
// cp backups beside the originals before anything is written, per AGENTS.md:
// git checkout would restore the last COMMIT, not the work in progress.
const BACKUP_DIR = fileURLToPath(new URL("../.mutation-backup-campaign-rollup/", import.meta.url));
mkdirSync(BACKUP_DIR, { recursive: true });
copyFileSync(LIB, `${BACKUP_DIR}campaignRollup.js`);
copyFileSync(ALIAS_LIB, `${BACKUP_DIR}campaignAliases.js`);
copyFileSync(DATA_LIB, `${BACKUP_DIR}campaignRollupData.js`);
/** Every file a mutation may touch → its untouched text. */
const SOURCES = new Map([
  [LIB, ORIGINAL],
  [ALIAS_LIB, readFileSync(ALIAS_LIB, "utf8")],
  [DATA_LIB, readFileSync(DATA_LIB, "utf8")],
]);

// [label, mutate, file] — `file` defaults to campaignRollup.js.
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
    // Indented two spaces since the chain moved into outcomesForLeads (2026-10-04).
    (s) => s.replace("for (const jobId of jobIds) {\n    if (revenueByJob.has(jobId))", "for (const jobId of revenueByJob.keys()) {\n    if (revenueByJob.has(jobId))")],
  ["reports revenue as 0 when nothing was invoiced",
    (s) => s.replace("revenue: revenue === null ? null : round2(revenue),", "revenue: round2(revenue || 0),")],
  ["labels reach as people",
    (s) => s.replace("reachIsDailySum: reach !== null,", "reachIsDailySum: false,")],
  // ── The name → id join ───────────────────────────────────────────────────
  ["joins leads on the Meta campaign id alone (the agency's leads vanish again)",
    (s) => s.replace("const aliases = buildCampaignAliases(rows);", "const aliases = null;")],
  ["folds a name-matched lead into `leads` without saying it was matched by name",
    (s) => s.replace("nameMatchedLeads: nameMatchedByCampaign.get(c.campaignId) || 0,", "nameMatchedLeads: 0,")],
  ["builds the alias map from the leads instead of the spend rows",
    (s) => s.replace("const aliases = buildCampaignAliases(rows);", "const aliases = buildCampaignAliases((Array.isArray(leads) ? leads : []).map((l) => ({ campaignId: l && l.id, campaignName: l && l.adCampaignName })));")],
  ["lets a lead's NAME override its own campaign id (one lead, two campaigns)",
    (s) => s.replace("if (attr.campaignId) return { campaignId: String(attr.campaignId), matchedBy: \"id\" };", ""), ALIAS_LIB],
  ["credits an ambiguous name to whichever campaign id came first",
    (s) => s.replace("if (ids.size === 1) byName.set(folded, [...ids][0]);", "byName.set(folded, [...ids][0]);"), ALIAS_LIB],
  ["invents a campaign from a name no spend row ever claimed",
    (s) => s.replace("return resolved ? { campaignId: String(resolved), matchedBy: \"name\" } : { campaignId: null, matchedBy: null };", "return { campaignId: String(resolved || folded), matchedBy: \"name\" };"), ALIAS_LIB],
  ["stops trimming a campaign name before folding it",
    (s) => s.replace("return typeof name === \"string\" ? name.trim().toLowerCase() : \"\";", "return typeof name === \"string\" ? name.toLowerCase() : \"\";"), ALIAS_LIB],
  ["narrows the lead query back to leads Meta resolved itself",
    (s) => s.replace("OR: [{ metaCampaignId: { not: null } }, { attribution: { not: Prisma.DbNull } }],", "metaCampaignId: { not: null },"), DATA_LIB],
  ["treats every attributed lead as a campaign lead, campaign name or not",
    (s) => s.replace("if (adCampaignName) byName.push(Object.assign(l, { adCampaignName }));", "byName.push(Object.assign(l, { adCampaignName }));"), DATA_LIB],
  ["offers an inferred quote to a name-matched lead before an id-matched one",
    (s) => s.replace("const leads = [...byId, ...byName];", "const leads = [...byName, ...byId];"), DATA_LIB],
];

let caught = 0;
const escaped = [];
try {
  for (const [label, mutate, file = LIB] of MUTATIONS) {
    const original = SOURCES.get(file);
    const mutated = mutate(original);
    if (mutated === original) {
      escaped.push(`${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    writeFileSync(file, mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, "--import", DB_STUB, SELF, "--no-mutate"], { stdio: ["ignore", "pipe", "pipe"] });
      survived = true;
    } catch {
      /* caught */
    }
    writeFileSync(file, original);
    if (survived) escaped.push(`${label} — NOT caught`);
    else {
      caught++;
      console.log(`  ✓ caught: ${label}`);
    }
  }
} finally {
  for (const [file, original] of SOURCES) writeFileSync(file, original);
  rmSync(BACKUP_DIR, { recursive: true, force: true });
}
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
