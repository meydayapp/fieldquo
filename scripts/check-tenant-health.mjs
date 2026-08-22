// scripts/check-tenant-health.mjs
//
//   npm run check:tenant-health
//
// The tenant analytics engine, executed.
//
// Most of these assertions are about a dashboard's characteristic lie: a
// confident percentage computed from two records. A "100% win rate" from one
// quote is worse than no number, because somebody will act on it.
import {
  formatRate,
  buildFunnel,
  buildTradeBreakdown,
  buildCompanyHealth,
  buildAdoption,
  MIN_SAMPLE,
} from "../lib/analytics/tenantHealth.js";

let pass = 0;
const failures = [];
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}`); }
};

const q = (status, o = {}) => ({ status, sentAt: status === "draft" ? null : "2026-08-01", ...o });

console.log("\nThe funnel measures each step against the one before it\n");
{
  const quotes = [
    ...Array(4).fill(0).map(() => q("draft")),
    ...Array(10).fill(0).map(() => q("sent")),
    ...Array(6).fill(0).map(() => q("accepted")),
    ...Array(2).fill(0).map(() => q("declined")),
  ];
  const jobs = [...Array(5).fill(0).map(() => ({ status: "completed" })), { status: "scheduled" }];
  const invoices = [...Array(4).fill(0).map(() => ({ status: "paid" })), { status: "sent" }];
  const f = buildFunnel(quotes, jobs, invoices);

  const stage = (k) => f.stages.find((s) => s.key === k);
  check("created counts everything", stage("created").count === 22);
  check("drafts are excluded from sent", stage("sent").count === 18);
  check("accepted is measured against SENT, not created", stage("accepted").rate === 33.3);
  check("job rate is measured against accepted", stage("job").rate === 100);
  check("win rate excludes drafts — an unsent quote was never lost", f.winRate === 33.3);
  check("decided win rate ignores the unanswered", f.decidedWinRate === 75);
  check("unanswered quotes are counted, not hidden", f.unanswered === 10);
}

console.log("\nA rate needs a denominator worth dividing by\n");
{
  const f = buildFunnel([q("accepted")], [], []);
  check("one accepted quote does NOT report a 100% win rate", f.winRate === null);
  check("the count is still reported", f.stages.find((s) => s.key === "accepted").count === 1);
  // A blank read as broken software. The ratio is shown instead — honest, and
  // it carries its own sample size.
  check("it shows the raw ratio rather than a blank", f.winRateLabel === "1 of 1");
}
{
  const quotes = Array(MIN_SAMPLE).fill(0).map(() => q("accepted"));
  check(`exactly ${MIN_SAMPLE} sent is enough to report`, buildFunnel(quotes, [], []).winRate === 100);
}
check("no quotes at all → nulls, not NaN", buildFunnel([], [], []).winRate === null);
check("null input doesn't throw", buildFunnel(null, null, null).stages.length === 7);

console.log("\nA thin rate reads as a fraction, never as a blank\n");
check("1 of 2 rather than —", formatRate(1, 2) === "1 of 2");
check("0 of 3 rather than 0%", formatRate(0, 3) === "0 of 3");
check("above the floor it is a percentage", formatRate(3, 5) === "60%");
check("no denominator at all is the only case that shows —", formatRate(0, 0) === "—");

console.log("\nTrade breakdown attributes value by scope, not by quote total\n");
{
  // One kitchen quote, three trades. The $30k total must NOT credit $30k to
  // flooring.
  const rows = [
    { companyId: "c1", categoryKey: "cabinet_refacing", categoryLabel: "Cabinet Refacing", status: "accepted", sentAt: "x", scopeSubtotal: 18000, quoteTotal: 30000 },
    { companyId: "c1", categoryKey: "countertop", categoryLabel: "Countertops", status: "accepted", sentAt: "x", scopeSubtotal: 8000, quoteTotal: 30000 },
    { companyId: "c1", categoryKey: "flooring", categoryLabel: "Flooring", status: "accepted", sentAt: "x", scopeSubtotal: 4000, quoteTotal: 30000 },
  ];
  const t = buildTradeBreakdown(rows);
  check("three trades from one quote", t.length === 3);
  check("flooring is credited $4,000, not $30,000",
    t.find((x) => x.categoryKey === "flooring").pipelineValue === 4000);
  check("cabinets get their own share",
    t.find((x) => x.categoryKey === "cabinet_refacing").pipelineValue === 18000);
}

console.log("\nThin trades report counts and no percentage\n");
{
  const rows = Array(3).fill(0).map((_, i) => ({
    companyId: `c${i}`, categoryKey: "roofing_service", categoryLabel: "Roofing",
    status: "accepted", sentAt: "x", scopeSubtotal: 12000,
  }));
  const t = buildTradeBreakdown(rows)[0];
  check("3 quotes → win rate is null", t.winRate === null);
  check("but the label still tells you 3 of 3", t.winRateLabel === "3 of 3");
  check("but it is flagged thin so the UI can say why", t.thin === true);
  check("the counts are still there", t.quotes === 3 && t.accepted === 3);
  check("the median is still useful", t.medianQuote === 12000);
}
{
  const rows = Array(8).fill(0).map((_, i) => ({
    companyId: `c${i}`, categoryKey: "roofing_service", categoryLabel: "Roofing",
    status: i < 6 ? "accepted" : "declined", sentAt: "x", scopeSubtotal: 10000 + i * 1000,
  }));
  const t = buildTradeBreakdown(rows)[0];
  check("8 quotes → a real win rate", t.winRate === 75);
  check("not flagged thin", t.thin === false);
  check("median resists the spread", t.medianQuote === 13500);
  check("won value counts only what was accepted", t.wonValue < t.pipelineValue);
}
check("no scope rows → empty, not a crash", buildTradeBreakdown([]).length === 0);
check("a row with no category is dropped", buildTradeBreakdown([{ companyId: "c", status: "sent" }]).length === 0);

console.log("\nCompany health — activity, not motive\n");
{
  const NOW = new Date("2026-08-22T12:00:00Z");
  const companies = [
    { id: "a", name: "Active Co", createdAt: "2026-06-01", firstQuoteAt: "2026-06-03", lastQuoteAt: "2026-08-20", quoteCount: 12 },
    { id: "b", name: "Quiet Co", createdAt: "2026-05-01", firstQuoteAt: "2026-05-02", lastQuoteAt: "2026-06-10", quoteCount: 4 },
    { id: "c", name: "Never Co", createdAt: "2026-07-01", firstQuoteAt: null, lastQuoteAt: null, quoteCount: 0 },
    { id: "d", name: "Same Day Co", createdAt: "2026-08-01", firstQuoteAt: "2026-08-01", lastQuoteAt: "2026-08-21", quoteCount: 7 },
  ];
  const h = buildCompanyHealth(companies, NOW);
  check("active and dormant are separated", h.counts.active === 2 && h.counts.dormant === 1);
  check("never-quoted is its own state, not dormant", h.counts.neverQuoted === 1);
  check("days since last quote is computed", h.companies.find((c) => c.id === "b").daysSinceLastQuote > 60);
  check("same-day activation is counted, not dropped as falsy", h.activation.sameDay === 1);
  check("dormant companies are named, not just counted", h.needsAttention[0].name === "Quiet Co");
  check("busiest company sorts first", h.companies[0].id === "a");
}
check("no companies → zeroes, not NaN", buildCompanyHealth([]).counts.total === 0);
check("null input doesn't throw", buildCompanyHealth(null).counts.total === 0);

console.log("\nAdoption is per company, not per record\n");
{
  const companies = [
    { usesInstantQuotes: true, usesChecklists: true },
    { usesInstantQuotes: true },
    ...Array(4).fill(0).map(() => ({})),
  ];
  const a = buildAdoption(companies, { totalQuotes: 100, instantQuotes: 40 });
  check("2 of 6 companies use instant quotes", a.instantQuotes.companies === 2);
  check("the rate is per company", a.instantQuotes.rate === 33.3);
  check("one enthusiastic tenant can't inflate it", a.instantQuotes.companies !== 40);
  check("quote mix IS measured per record — that's the question there",
    a.quoteMix.instantShare === 40 && a.quoteMix.manual === 60);
}
check("no companies → adoption is empty, not divided by zero",
  buildAdoption([], {}).instantQuotes.rate === null);

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
