// scripts/check-kpis.mjs
//
// The KPI dashboard's one rule, executed rather than read: a card with no
// evidence prints null and a reason, NEVER a zero standing in for "unknown".
//
// ══ How this runs ═══════════════════════════════════════════════════════════
//
// lib/analytics/kpis.js is pure, so every branch is driven by scripted rows
// rather than a database — the same discipline scripts/check-win-loss.mjs and
// scripts/check-estimate-accuracy.mjs already keep, and for the same reason:
// a check that reads the source passes just as happily against a guard someone
// disabled with `false &&`.
//
// Section 1 builds hostile fixtures (nothing, one job, missing rates, a null
// overhead, a materials-buy-list trap) and asserts specific reason codes.
// Section 2 is a GENERIC invariant, walked over every KPI envelope in every
// fixture's output: `value === null` exactly when `reason` is set, and any
// `value === 0` with no reason must be on a short, named whitelist of the
// figures that can be honestly zero (a backlog with nothing booked, an AR
// balance with nothing outstanding). A new KPI that starts returning a bare
// zero instead of null fails this check the moment it's added, without this
// file needing to know its name.
// Section 3 checks the REASONS dictionary is the actual closed vocabulary —
// every code any fixture produced is a real key, and every key (bar one
// documented exception) was produced by at least one fixture.
// Section 4 mutates lib/analytics/kpis.js on disk, one bug at a time, and
// re-runs this file as a subprocess to confirm each bug makes an assertion
// above fail — the same technique scripts/check-statements.mjs uses. A
// mutation that DOESN'T get caught means the assertions guarding that line
// have no teeth, and is reported by name rather than silently passing.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-kpis.mjs

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildKpis,
  buildLeadToQuoteConversion,
  buildBacklogWeeks,
  detectMaterialsBuyListTrap,
  buildMarginRollup,
  buildOnTimeCompletion,
  buildUtilisationRate,
  buildBlendedCostPerLead,
  buildReworkCallbackRate,
  buildChangeOrderRate,
  mergeCallbackReasons,
  REASONS,
  NOT_TRACKED,
  RATE_FLOOR,
  COUNT_FLOOR,
} from "@/lib/analytics/kpis";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const CAD = "CAD";
const FROM = "2026-04-01";
const TO = "2026-06-30";
const ASOF = new Date("2026-07-01T00:00:00.000Z");
const d = (s) => new Date(`${s}T12:00:00.000Z`);

// ── A minimal, valid buildKpis() call — every section overridable ──────────
function kpisCall(overrides = {}) {
  return buildKpis({
    from: FROM,
    to: TO,
    currency: CAD,
    weeksInPeriod: 13,
    sales: { quotes: [], undatedCount: 0, leads: [], openJobs: [], completedJobsForThroughput: [] },
    profit: {
      completedJobsWithCost: [],
      overheadPerJob: null,
      materialsTrap: detectMaterialsBuyListTrap({ buyListTotal: 0, expenseTotal: 0 }),
      periodRevenue: 0,
      activeWorkerCount: 0,
    },
    execution: {
      estimateAccuracyJobs: [],
      onTimeJobs: [],
      utilisation: { workers: [], jobHoursById: {} },
    },
    quality: { reworkJobs: [], changeOrderJobs: [] },
    cash: { invoices: [], payments: [], asOf: ASOF },
    ...overrides,
  });
}

let seq = 0;
function quote(over) {
  seq += 1;
  return {
    id: `q${seq}`,
    quoteNumber: `Q-${1000 + seq}`,
    status: "sent",
    total: 1000,
    acceptedTotal: null,
    sentAt: null,
    acceptedAt: null,
    declinedAt: null,
    declineReason: null,
    tierGroupId: null,
    createdById: null,
    client: { name: "Client" },
    createdBy: null,
    ...over,
  };
}

function marginJob({ id, revenue, materials, hours, rate }) {
  return {
    id,
    revenue,
    expenses: materials ? [{ category: "materials", amount: materials }] : [],
    timeEntries: hours
      ? [
          {
            hours,
            status: "approved",
            workerId: `w-${id}`,
            worker: { id: `w-${id}`, name: `Worker ${id}`, hourlyRate: rate },
          },
        ]
      : [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Section 1 — hostile input: nothing at all
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n1. Nothing at all — every KPI is absent, none is zero (but one)\n");

const EMPTY = kpisCall();

ok("winRate: no quotes sent → null / no_quotes_sent",
  EMPTY.sales.winRate.value === null && EMPTY.sales.winRate.reason === "no_quotes_sent");
ok("…and a real sentence rides along, not just the bare code",
  EMPTY.sales.winRate.reasonText === REASONS.no_quotes_sent && EMPTY.sales.winRate.reasonText.length > 10);
ok("…and it carries RATE_FLOOR as data, so the page can say how many are needed",
  EMPTY.sales.winRate.floor === RATE_FLOOR, EMPTY.sales.winRate.floor);
// avgJobValue's "nothing to average" collapses to "no_won_quotes" whether
// zero quotes exist or quotes exist but none are won yet — both need the SAME
// next step (win COUNT_FLOOR of them), unlike winRate above which needs
// DECIDED quotes (RATE_FLOOR) and so keeps its own "no_quotes_sent" split.
ok("avgJobValue: no quotes sent → null / no_won_quotes (same next step as 'none won yet')",
  EMPTY.sales.avgJobValue.value === null && EMPTY.sales.avgJobValue.reason === "no_won_quotes");
ok("…and its floor is COUNT_FLOOR, not RATE_FLOOR — it's about WON quotes, not decided ones",
  EMPTY.sales.avgJobValue.floor === COUNT_FLOOR, EMPTY.sales.avgJobValue.floor);
ok("leadToQuoteConversion: no leads → null / no_leads_in_period",
  EMPTY.sales.leadToQuoteConversion.value === null &&
    EMPTY.sales.leadToQuoteConversion.reason === "no_leads_in_period");
ok("backlogWeeks: nothing booked → a REAL zero, not an absence",
  EMPTY.sales.backlogWeeks.value === 0 && EMPTY.sales.backlogWeeks.reason === null,
  EMPTY.sales.backlogWeeks);
ok("grossMarginPct: no completed jobs → null / no_completed_jobs",
  EMPTY.profit.grossMarginPct.value === null && EMPTY.profit.grossMarginPct.reason === "no_completed_jobs");
ok("netMarginPct: no completed jobs → null / no_completed_jobs",
  EMPTY.profit.netMarginPct.value === null && EMPTY.profit.netMarginPct.reason === "no_completed_jobs");
ok("labourCostPctOfRevenue: no completed jobs → null / no_completed_jobs",
  EMPTY.profit.labourCostPctOfRevenue.value === null &&
    EMPTY.profit.labourCostPctOfRevenue.reason === "no_completed_jobs");
ok("revenuePerEmployee: no active workers → null / no_active_workers",
  EMPTY.profit.revenuePerEmployee.value === null &&
    EMPTY.profit.revenuePerEmployee.reason === "no_active_workers");
ok("estimateAccuracy: nothing finished → empty:true, not a 0% claim",
  EMPTY.execution.estimateAccuracy.empty === true);
ok("onTimeCompletion: no scheduled jobs → null / no_scheduled_jobs",
  EMPTY.execution.onTimeCompletion.value === null &&
    EMPTY.execution.onTimeCompletion.reason === "no_scheduled_jobs");
ok("utilisation: no workers → null / no_scheduled_hours",
  EMPTY.execution.utilisation.value === null &&
    EMPTY.execution.utilisation.reason === "no_scheduled_hours");
ok("arAging: no invoices ever → null / no_invoices, not $0.00",
  EMPTY.cash.arAging.value === null && EMPTY.cash.arAging.reason === "no_invoices");
ok("revenueTrend: no payments ever → unavailable, not a flat line at zero",
  EMPTY.cash.revenueTrend.available === false);
ok("reworkCallbackRate: no completed jobs → null / no_completed_jobs",
  EMPTY.quality.reworkCallbackRate.value === null &&
    EMPTY.quality.reworkCallbackRate.reason === "no_completed_jobs");
ok("changeOrderRate: no completed jobs → null / no_completed_jobs",
  EMPTY.quality.changeOrderRate.value === null &&
    EMPTY.quality.changeOrderRate.reason === "no_completed_jobs");
ok("NOT_TRACKED lists exactly the four metrics this file refuses to invent (rework/callback and change-order rate moved off this list)",
  NOT_TRACKED.length === 4 && NOT_TRACKED.every((m) => typeof m.reason === "string" && m.reason.length > 20));
ok("…and neither moved-off metric is still named on it",
  !NOT_TRACKED.some((m) => m.key === "reworkCallbackRate" || m.key === "changeOrderRate"));

// ═══════════════════════════════════════════════════════════════════════════
// Section 2 — one job, missing rates, null overhead
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n2. One job, missing rates, a null overhead\n");

const oneJobBelowFloor = buildMarginRollup({
  jobs: [marginJob({ id: "j1", revenue: 5000, materials: 500, hours: 20, rate: 25 })],
  overheadPerJob: 400,
  materialsTrap: detectMaterialsBuyListTrap({ buyListTotal: 0, expenseTotal: 0 }),
});
ok("one job is below COUNT_FLOOR → gross margin null, not the job's own number",
  oneJobBelowFloor.grossMarginPct.value === null &&
    oneJobBelowFloor.grossMarginPct.reason === "below_floor" &&
    oneJobBelowFloor.grossMarginPct.sampleSize === 1);
ok("…net margin too, same reason, overhead was known",
  oneJobBelowFloor.netMarginPct.value === null && oneJobBelowFloor.netMarginPct.reason === "below_floor");

const fiveJobsNullOverhead = buildMarginRollup({
  jobs: [1, 2, 3, 4, 5].map((n) =>
    marginJob({ id: `n${n}`, revenue: 4000, materials: 300, hours: 10, rate: 30 }),
  ),
  overheadPerJob: null,
  materialsTrap: detectMaterialsBuyListTrap({ buyListTotal: 0, expenseTotal: 0 }),
});
ok("null overhead → net margin null / overhead_unknown, EVEN THOUGH the sample clears the floor",
  fiveJobsNullOverhead.netMarginPct.value === null &&
    fiveJobsNullOverhead.netMarginPct.reason === "overhead_unknown");
ok("…and gross margin is unaffected — it never needed overhead",
  fiveJobsNullOverhead.grossMarginPct.value !== null && fiveJobsNullOverhead.grossMarginPct.reason === null);
ok("…never a silent fall-back to the gross number",
  fiveJobsNullOverhead.netMarginPct.value !== fiveJobsNullOverhead.grossMarginPct.value ||
    fiveJobsNullOverhead.netMarginPct.reason === "overhead_unknown");

// ═══════════════════════════════════════════════════════════════════════════
// Section 3 — exact arithmetic, so a wrong formula has somewhere to hide
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n3. Known numbers in, known numbers out\n");

const FIVE_JOBS = [
  marginJob({ id: "a", revenue: 10000, materials: 2000, hours: 40, rate: 25 }), // gross 70.0, net 65.0
  marginJob({ id: "b", revenue: 8000, materials: 1500, hours: 30, rate: 25 }), // gross 71.9, net 65.6
  marginJob({ id: "c", revenue: 5000, materials: 1000, hours: 20, rate: 25 }), // gross 70.0, net 60.0
  marginJob({ id: "d", revenue: 12000, materials: 3000, hours: 60, rate: 25 }), // gross 62.5, net 58.3
  marginJob({ id: "e", revenue: 6000, materials: 800, hours: 16, rate: 25 }), // gross 80.0, net 71.7
];
const knownMargins = buildMarginRollup({
  jobs: FIVE_JOBS,
  overheadPerJob: 500,
  materialsTrap: detectMaterialsBuyListTrap({ buyListTotal: 0, expenseTotal: 0 }),
});
ok("gross margin median across five known jobs is exactly 70",
  knownMargins.grossMarginPct.value === 70, knownMargins.grossMarginPct.value);
ok("net margin median (same jobs, $500 overhead each) is exactly 65",
  knownMargins.netMarginPct.value === 65, knownMargins.netMarginPct.value);
ok("labour cost is exactly 10.1% of revenue (sum(labour) / sum(revenue))",
  knownMargins.labourCostPctOfRevenue.value === 10.1, knownMargins.labourCostPctOfRevenue.value);

const unratedAmongFive = buildMarginRollup({
  jobs: [
    ...FIVE_JOBS.slice(0, 4),
    marginJob({ id: "f", revenue: 7000, materials: 400, hours: 10, rate: null }),
  ],
  overheadPerJob: 500,
  materialsTrap: detectMaterialsBuyListTrap({ buyListTotal: 0, expenseTotal: 0 }),
});
ok("an unrated worker on ONE of five jobs flags the whole figure incomplete",
  unratedAmongFive.grossMarginPct.incomplete === true &&
    unratedAmongFive.grossMarginPct.incompleteJobs === 1);
ok("…and the number still prints — incomplete is a flag beside it, not a refusal",
  unratedAmongFive.grossMarginPct.value !== null);

const backlog = buildBacklogWeeks({
  openJobs: [
    { id: "j1", quote: { status: "accepted", acceptedTotal: 3000, total: 3200 } },
    { id: "j2", quote: { status: "accepted", acceptedTotal: null, total: 2000 } },
    { id: "j3", quote: { status: "sent", acceptedTotal: null, total: 5000 } }, // not accepted
    { id: "j4", quote: null }, // no quote at all
  ],
  completedJobs: [
    { id: "c1", quote: { acceptedTotal: 6000, total: 6000, status: "accepted" } },
    { id: "c2", quote: { acceptedTotal: 4000, total: 4000, status: "accepted" } },
  ],
  weeksInPeriod: 2,
});
ok("backlog value is $5,000 ($3,000 acceptedTotal + $2,000 total-fallback)",
  backlog.raw.backlogValue === 5000, backlog.raw);
ok("…one job excluded for no quote, one for a quote never accepted",
  backlog.raw.excludedNoQuote === 1 && backlog.raw.excludedNotAccepted === 1);
ok("throughput is $5,000/week ($10,000 finished over 2 weeks) → backlog is exactly 1 week",
  backlog.value === 1, backlog.value);

const backlogNoThroughput = buildBacklogWeeks({
  openJobs: [{ id: "j1", quote: { status: "accepted", acceptedTotal: 5000, total: 5000 } }],
  completedJobs: [],
  weeksInPeriod: 2,
});
ok("a real backlog with NOTHING finished this period prints null, not a fabricated pace",
  backlogNoThroughput.value === null && backlogNoThroughput.reason === "no_throughput_reference");
ok("…but the dollar figure survives in `raw` so the screen isn't left with nothing",
  backlogNoThroughput.raw.backlogValue === 5000);

// ── On-time completion: the <= boundary, and the exact rate ────────────────
function visitJob(id, scheduled, completed) {
  return { id, title: `Job ${id}`, completedAt: d(completed), visits: [{ scheduledAt: d(scheduled) }] };
}
const onTimeJobs = [
  ...Array.from({ length: 7 }, (_, i) => visitJob(`ot${i}`, "2026-05-10", "2026-05-09")), // early
  visitJob("ot-exact", "2026-05-10", "2026-05-10"), // exactly on the scheduled day
  ...Array.from({ length: 4 }, (_, i) => visitJob(`late${i}`, "2026-05-10", "2026-05-12")), // late
  { id: "novisit1", title: "No visit", completedAt: d("2026-05-09"), visits: [] },
  { id: "novisit2", title: "No visit", completedAt: d("2026-05-09"), visits: [] },
  { id: "novisit3", title: "No visit", completedAt: d("2026-05-09"), visits: [] },
];
const onTime = buildOnTimeCompletion({ jobs: onTimeJobs });
ok("12 decided jobs (8 on time, 4 late), 3 excluded for no schedule",
  onTime.sampleSize === 12 && onTime.raw.excludedNoSchedule === 3, onTime.raw);
ok("finishing EXACTLY on the scheduled day counts as on time",
  onTime.raw.onTime === 8, onTime.raw);
ok("on-time rate is exactly 66.7% (8 of 12)",
  onTime.value === 66.7, onTime.value);
ok("the Gantt breakdown carries one row per decided job, capped at 20",
  onTime.jobs.length === 12);

const utilisation = buildUtilisationRate({
  workers: [
    { id: "w1", name: "A", workType: "field", scheduledHoursPerWeek: 40, hourlyRate: 25 },
    { id: "w2", name: "B", workType: "field", scheduledHoursPerWeek: 20, hourlyRate: null },
    { id: "w3", name: "Office", workType: "office", scheduledHoursPerWeek: 40, hourlyRate: 20 },
  ],
  jobHoursById: { w1: 30, w2: 15, w3: 40 },
  weeksInPeriod: 1,
});
ok("utilisation is exactly 75% (45 job hours of 60 scheduled) — office worker excluded entirely",
  utilisation.value === 75, utilisation.value);
ok("an unrated worker among the field crew flags the figure incomplete",
  utilisation.incomplete === true);

// ── buildBlendedCostPerLead — docs/META-ADS-INTEGRATION.md Part 2, Level 1 ──
//
// The one new KPI this file gained for the Meta-ads build: total marketing
// spend over REAL LeadRequest counts, manual/imported sources excluded from
// the denominator and reported as `excludedCount` rather than dropped
// silently. No database of its own — see the function's own header —so
// these fixtures are hand-built groupBy-shaped objects, exactly what
// lib/analytics/marketingRollup.js's getLeadCountsBySource actually returns.
const blendedNoLeadsAtAll = buildBlendedCostPerLead({ totalSpend: 500, leadCountsBySource: {} });
ok("no leads in the period at all -> null, not a fabricated $500/0",
  blendedNoLeadsAtAll.value === null && blendedNoLeadsAtAll.reason === "no_leads_in_period",
  blendedNoLeadsAtAll);

const blendedOnlyManual = buildBlendedCostPerLead({
  totalSpend: 500,
  leadCountsBySource: { manual: 3, imported: 5 },
});
ok("manual + imported leads alone still refuse — they don't count toward what spend produced",
  blendedOnlyManual.value === null && blendedOnlyManual.excludedCount === 8,
  blendedOnlyManual);

const blendedReal = buildBlendedCostPerLead({
  totalSpend: 1000,
  leadCountsBySource: { self_quote: 8, phone_agent: 2, manual: 3 },
});
ok("blended CPL is spend over REAL leads only — 1000/10, manual's 3 excluded and reported",
  blendedReal.value === 100 && blendedReal.sampleSize === 10 && blendedReal.excludedCount === 3,
  blendedReal);

const blendedZeroSpendRealLeads = buildBlendedCostPerLead({
  totalSpend: 0,
  leadCountsBySource: { self_quote: 10 },
});
ok("zero spend with real leads is an honest $0, not null — a referral-only month is a real zero",
  blendedZeroSpendRealLeads.value === 0 && blendedZeroSpendRealLeads.reason === null,
  blendedZeroSpendRealLeads);

// ═══════════════════════════════════════════════════════════════════════════
// Section 4 — the sample floor, at the boundary
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n4. The sample floor, right at the edge\n");

function leads(total, converted) {
  const rows = [];
  for (let i = 0; i < total; i++) rows.push({ id: `l${i}`, quoteId: i < converted ? `q${i}` : null });
  return rows;
}
ok(`${RATE_FLOOR - 1} leads is below the floor — counts survive, no rate prints`,
  buildLeadToQuoteConversion({ leads: leads(RATE_FLOOR - 1, 5) }).value === null &&
    buildLeadToQuoteConversion({ leads: leads(RATE_FLOOR - 1, 5) }).sampleSize === RATE_FLOOR - 1);
ok(`${RATE_FLOOR} leads clears the floor — the rate prints`,
  buildLeadToQuoteConversion({ leads: leads(RATE_FLOOR, 5) }).value === 50);

// ── Every empty state's own copy: what the code SAYS at 0, 1, floor-1, floor,
//    floor+1 rows, executed rather than reasoned about ─────────────────────
//
// The owner's actual ask ("state how many we need") is a copy change, and
// copy is exactly the kind of thing that reads fine in a diff and is wrong at
// the boundary. Printed here (not just asserted) so a reviewer can read the
// real sentence a contractor would see at each count, per AGENTS.md's "execute
// pure functions against hostile input" — this is that, for text.

function decidedQuotes(n, wonCount) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const won = i < wonCount;
    rows.push(
      quote({
        status: won ? "accepted" : "declined",
        sentAt: d("2026-05-01"),
        acceptedAt: won ? d("2026-05-02") : null,
        declinedAt: won ? null : d("2026-05-02"),
        total: 1000,
        acceptedTotal: won ? 1000 : null,
      }),
    );
  }
  return rows;
}
function salesAt(decided, won) {
  return kpisCall({
    sales: {
      quotes: decidedQuotes(decided, won),
      undatedCount: 0,
      leads: [],
      openJobs: [],
      completedJobsForThroughput: [],
    },
  }).sales;
}

console.log("\n  winRate — 0, 1, floor-1, floor, floor+1 decided (all lost, so decided count = n exactly)\n");
for (const n of [0, 1, RATE_FLOOR - 1, RATE_FLOOR, RATE_FLOOR + 1]) {
  const { winRate } = salesAt(n, 0);
  console.log(`    ${n} decided → ${winRate.value === null ? `null (${winRate.reason}): "${winRate.reasonText}"` : `${winRate.value}%`}`);
  if (n === 0) {
    ok(`winRate at 0 decided (0 sent): no_quotes_sent, floor ${RATE_FLOOR}`,
      winRate.reason === "no_quotes_sent" && winRate.floor === RATE_FLOOR);
  } else if (n < RATE_FLOOR) {
    ok(`winRate at ${n} of ${RATE_FLOOR} decided: below_floor, sampleSize ${n}, ${RATE_FLOOR - n} remaining`,
      winRate.reason === "below_floor" && winRate.sampleSize === n &&
        winRate.floor === RATE_FLOOR && winRate.remaining === RATE_FLOOR - n,
      winRate);
  } else {
    ok(`winRate at ${n} of ${RATE_FLOOR} decided: a real rate, no reason`,
      winRate.value !== null && winRate.reason === null, winRate);
  }
}

console.log("\n  avgJobValue — 0, 1, floor-1, floor, floor+1 WON (all decided quotes won)\n");
for (const n of [0, 1, COUNT_FLOOR - 1, COUNT_FLOOR, COUNT_FLOOR + 1]) {
  const { avgJobValue } = salesAt(n, n);
  console.log(`    ${n} won → ${avgJobValue.value === null ? `null (${avgJobValue.reason}): "${avgJobValue.reasonText}"` : `$${avgJobValue.value}`}`);
  if (n === 0) {
    ok(`avgJobValue at 0 won: no_won_quotes, floor ${COUNT_FLOOR}`,
      avgJobValue.reason === "no_won_quotes" && avgJobValue.floor === COUNT_FLOOR);
  } else if (n < COUNT_FLOOR) {
    ok(`avgJobValue at ${n} of ${COUNT_FLOOR} won: below_floor, sampleSize ${n}, ${COUNT_FLOOR - n} remaining`,
      avgJobValue.reason === "below_floor" && avgJobValue.sampleSize === n &&
        avgJobValue.floor === COUNT_FLOOR && avgJobValue.remaining === COUNT_FLOOR - n,
      avgJobValue);
  } else {
    ok(`avgJobValue at ${n} of ${COUNT_FLOOR} won: a real value, no reason`,
      avgJobValue.value !== null && avgJobValue.reason === null, avgJobValue);
  }
}

console.log("\n  leadToQuoteConversion — 0, 1, floor-1, floor, floor+1 leads\n");
for (const n of [0, 1, RATE_FLOOR - 1, RATE_FLOOR, RATE_FLOOR + 1]) {
  const conv = buildLeadToQuoteConversion({ leads: leads(n, Math.min(n, 5)) });
  console.log(`    ${n} leads → ${conv.value === null ? `null (${conv.reason}): "${conv.reasonText}"` : `${conv.value}%`}`);
  if (n === 0) {
    ok(`leadToQuoteConversion at 0 leads: no_leads_in_period, floor ${RATE_FLOOR}`,
      conv.reason === "no_leads_in_period" && conv.floor === RATE_FLOOR);
  } else if (n < RATE_FLOOR) {
    ok(`leadToQuoteConversion at ${n} of ${RATE_FLOOR} leads: below_floor, sampleSize ${n}, ${RATE_FLOOR - n} remaining`,
      conv.reason === "below_floor" && conv.sampleSize === n &&
        conv.floor === RATE_FLOOR && conv.remaining === RATE_FLOOR - n,
      conv);
  } else {
    ok(`leadToQuoteConversion at ${n} of ${RATE_FLOOR} leads: a real rate, no reason`,
      conv.value !== null && conv.reason === null, conv);
  }
}

console.log("\n  backlog — 0 vs. 1 completed, priced job this period (no floor: this one needs an action, not a count)\n");
const backlogZero = buildBacklogWeeks({
  openJobs: [{ id: "o1", quote: { status: "accepted", acceptedTotal: 4000, total: 4000 } }],
  completedJobs: [],
  weeksInPeriod: 2,
});
const backlogOne = buildBacklogWeeks({
  openJobs: [{ id: "o1", quote: { status: "accepted", acceptedTotal: 4000, total: 4000 } }],
  completedJobs: [{ id: "c1", quote: { status: "accepted", acceptedTotal: 2000, total: 2000 } }],
  weeksInPeriod: 2,
});
console.log(`    0 completed → null (${backlogZero.reason}): "${backlogZero.reasonText}"`);
console.log(`    1 completed → ${backlogOne.value} weeks`);
ok("backlog with 0 completed, priced jobs this period: no_throughput_reference, and carries no floor",
  backlogZero.reason === "no_throughput_reference" && backlogZero.floor === undefined);
ok("backlog with exactly 1 completed, priced job this period: a real pace prints",
  backlogOne.value !== null && backlogOne.reason === null, backlogOne);

// ═══════════════════════════════════════════════════════════════════════════
// Section 4b — rework/callback rate and change-order rate, at the boundary
// ═══════════════════════════════════════════════════════════════════════════
//
// Not numbered "5" onward to avoid renumbering every section below it — see
// the header note this file otherwise keeps sequential. Same discipline as
// every other section here: known numbers in, known numbers out, then the
// floor boundary, then the two hostile shapes the task called out by name —
// a callback with no matching original in this period's job list, and a
// change order on a job with no quote at all.

console.log("\n4b. Rework/callback rate and change-order rate\n");

function reworkJob(id, ...reasons) {
  return { id, callbackReasons: reasons };
}

// ── Known numbers: 10 jobs, exact counts, so the rate has somewhere to hide
//    a wrong formula ──────────────────────────────────────────────────────
const reworkKnown = buildReworkCallbackRate({
  jobs: [
    reworkJob("r1", "rework"),
    reworkJob("r2", "warranty"),
    reworkJob("r3", "rework", "warranty"), // both reasons on one job — counts once
    reworkJob("r4", "not_our_fault"), // excluded from the numerator
    reworkJob("r5"),
    reworkJob("r6"),
    reworkJob("r7"),
    reworkJob("r8"),
    reworkJob("r9"),
    reworkJob("r10"),
  ],
});
ok("10 jobs, 3 with rework/warranty, 1 not-our-fault-only → rate is exactly 30%",
  reworkKnown.value === 30 && reworkKnown.sampleSize === 10, reworkKnown);
ok("…rework and warranty counted separately in `raw`, not-our-fault-only named rather than folded in",
  reworkKnown.raw.reworkCount === 2 &&
    reworkKnown.raw.warrantyCount === 2 &&
    reworkKnown.raw.callbackJobs === 3 &&
    reworkKnown.raw.notOurFaultOnly === 1,
  reworkKnown.raw);

const changeOrderKnown = buildChangeOrderRate({
  jobs: [
    { id: "c1", changeOrders: [{ priceDelta: 500 }, { priceDelta: -100 }] },
    { id: "c2", changeOrders: [{ priceDelta: 200 }] },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `c${i + 3}`, changeOrders: [] })),
  ],
});
ok("10 jobs, 2 with a change order (one carrying two) → rate is exactly 20%",
  changeOrderKnown.value === 20 && changeOrderKnown.sampleSize === 10, changeOrderKnown);
ok("…3 total change orders counted, net price effect is exactly $600",
  changeOrderKnown.raw.totalChangeOrders === 3 && changeOrderKnown.raw.totalPriceDelta === 600,
  changeOrderKnown.raw);

// ── The floor, at 0 / 1 / floor-1 / floor / floor+1 callback jobs ──────────
console.log("\n  reworkCallbackRate — 0, 1, floor-1, floor, floor+1 jobs, ALL with a rework callback\n");
for (const n of [0, 1, RATE_FLOOR - 1, RATE_FLOOR, RATE_FLOOR + 1]) {
  const jobs = Array.from({ length: n }, (_, i) => reworkJob(`f${i}`, "rework"));
  const r = buildReworkCallbackRate({ jobs });
  console.log(`    ${n} jobs → ${r.value === null ? `null (${r.reason})` : `${r.value}%`}`);
  if (n === 0) {
    ok(`reworkCallbackRate at 0 completed jobs: no_completed_jobs`, r.reason === "no_completed_jobs");
  } else if (n < RATE_FLOOR) {
    ok(`reworkCallbackRate at ${n} of ${RATE_FLOOR}: below_floor, sampleSize ${n}, ${RATE_FLOOR - n} remaining`,
      r.reason === "below_floor" && r.sampleSize === n && r.remaining === RATE_FLOOR - n, r);
  } else {
    // Every job in this fixture has a callback, so the rate is a real 100%.
    ok(`reworkCallbackRate at ${n} of ${RATE_FLOOR}: a real rate (100%, every job here had one)`,
      r.value === 100 && r.reason === null, r);
  }
}

console.log("\n  changeOrderRate — 0, 1, floor-1, floor, floor+1 jobs, ALL with a change order\n");
for (const n of [0, 1, RATE_FLOOR - 1, RATE_FLOOR, RATE_FLOOR + 1]) {
  const jobs = Array.from({ length: n }, (_, i) => ({ id: `g${i}`, changeOrders: [{ priceDelta: 50 }] }));
  const r = buildChangeOrderRate({ jobs });
  console.log(`    ${n} jobs → ${r.value === null ? `null (${r.reason})` : `${r.value}%`}`);
  if (n === 0) {
    ok(`changeOrderRate at 0 completed jobs: no_completed_jobs`, r.reason === "no_completed_jobs");
  } else if (n < RATE_FLOOR) {
    ok(`changeOrderRate at ${n} of ${RATE_FLOOR}: below_floor, sampleSize ${n}, ${RATE_FLOOR - n} remaining`,
      r.reason === "below_floor" && r.sampleSize === n && r.remaining === RATE_FLOOR - n, r);
  } else {
    ok(`changeOrderRate at ${n} of ${RATE_FLOOR}: a real rate (100%, every job here had one)`,
      r.value === 100 && r.reason === null, r);
  }
}

// ── A job with a callback and no original — the merge function's own hard
//    case, per the task's own wording ──────────────────────────────────────
const orphanMerge = mergeCallbackReasons({
  visitReturns: [{ jobId: "in-period-1", returnReason: "rework" }],
  // "job-from-last-quarter" never appears in the caller's own completed-jobs
  // list below — its original finished outside this period (or hasn't
  // finished at all). The merge must not throw, and must not invent an entry
  // for a job the caller never asks about.
  callbackJobs: [{ originalJobId: "job-from-last-quarter", callbackReason: "warranty" }],
});
ok("mergeCallbackReasons: an in-period visit return is in the map",
  [...(orphanMerge.get("in-period-1") || [])].includes("rework"));
ok("mergeCallbackReasons: a callback pointing outside this period still lands in the map (harmless — see below)",
  [...(orphanMerge.get("job-from-last-quarter") || [])].includes("warranty"));
const reworkWithOrphan = buildReworkCallbackRate({
  jobs: [
    { id: "in-period-1", callbackReasons: [...(orphanMerge.get("in-period-1") || [])] },
    // Nine more, uncalled-back, so this fixture clears RATE_FLOOR and prints
    // a real rate rather than "below_floor" — the orphan's absence has to be
    // visible in an actual percentage, not just hidden by a floor refusal.
    ...Array.from({ length: 9 }, (_, i) => ({ id: `clean${i}`, callbackReasons: [] })),
  ],
});
ok("…but the orphaned reason never reaches the rate — only the job actually in the caller's list counts (1 of 10 = 10%)",
  reworkWithOrphan.value === 10 && reworkWithOrphan.raw.callbackJobs === 1, reworkWithOrphan);
ok("mergeCallbackReasons: no jobId/reason on a row is silently skipped, not a crash",
  mergeCallbackReasons({ visitReturns: [{ jobId: null, returnReason: "rework" }], callbackJobs: [] }).size === 0);

// ── A change order on a job whose quote was never sent ──────────────────────
//
// buildChangeOrderRate takes jobs, not quotes, and never reads job.quote —
// this fixture proves it: a job with NO quote link at all still counts a
// change order exactly the same as one that came off an accepted quote,
// because "the client agreed to a change mid-job" doesn't require the
// original scope to have gone through a Quote row (a manual job can still
// have change orders).
const changeOrderNoQuote = buildChangeOrderRate({
  jobs: [
    { id: "manual-job", changeOrders: [{ priceDelta: 250 }] }, // no `quote` key present at all
    ...Array.from({ length: 9 }, (_, i) => ({ id: `plain${i}`, changeOrders: [] })),
  ],
});
ok("a change order on a job with no quote at all still counts (1 of 10 = 10%, $250)",
  changeOrderNoQuote.value === 10 && changeOrderNoQuote.raw.totalPriceDelta === 250, changeOrderNoQuote);

// ═══════════════════════════════════════════════════════════════════════════
// Section 5 — the materials buy-list trap
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n5. The materials buy-list trap\n");

ok("no buy-list spend at all doesn't trip it",
  detectMaterialsBuyListTrap({ buyListTotal: 0, expenseTotal: 0 }).triggered === false);
ok("a small buy-list total ($150) is noise, not a pattern",
  detectMaterialsBuyListTrap({ buyListTotal: 150, expenseTotal: 0 }).triggered === false);
ok("$1,000 bought, only $50 expensed (5%) — triggered",
  detectMaterialsBuyListTrap({ buyListTotal: 1000, expenseTotal: 50 }).triggered === true);
ok("$1,000 bought, exactly $100 expensed (10%, the boundary) — still triggered",
  detectMaterialsBuyListTrap({ buyListTotal: 1000, expenseTotal: 100 }).triggered === true);
ok("$1,000 bought, $101 expensed (just over 10%) — not triggered",
  detectMaterialsBuyListTrap({ buyListTotal: 1000, expenseTotal: 101 }).triggered === false);
ok("$1,000 bought, $500 expensed (50%) — comfortably not triggered",
  detectMaterialsBuyListTrap({ buyListTotal: 1000, expenseTotal: 500 }).triggered === false);

const trapped = buildMarginRollup({
  jobs: FIVE_JOBS,
  overheadPerJob: 500,
  materialsTrap: detectMaterialsBuyListTrap({ buyListTotal: 5000, expenseTotal: 100 }),
});
ok("a triggered trap refuses BOTH margin figures — a wrong margin is worse than none",
  trapped.grossMarginPct.value === null &&
    trapped.grossMarginPct.reason === "materials_tracked_outside_job_costing" &&
    trapped.netMarginPct.value === null &&
    trapped.netMarginPct.reason === "materials_tracked_outside_job_costing");
ok("…but labour cost % is untouched — the trap is about materials, not wages",
  trapped.labourCostPctOfRevenue.value !== null);

const jobsButNoRevenue = buildMarginRollup({
  jobs: [
    marginJob({ id: "x", revenue: null, materials: 200, hours: 5, rate: 25 }),
    marginJob({ id: "y", revenue: 0, materials: 100, hours: 2, rate: 25 }),
  ],
  overheadPerJob: 500,
  materialsTrap: detectMaterialsBuyListTrap({ buyListTotal: 0, expenseTotal: 0 }),
});
ok("jobs exist but none ever had an invoice raised → no_priced_jobs, not no_completed_jobs",
  jobsButNoRevenue.grossMarginPct.value === null &&
    jobsButNoRevenue.grossMarginPct.reason === "no_priced_jobs",
  jobsButNoRevenue.grossMarginPct);

// ═══════════════════════════════════════════════════════════════════════════
// Section 6 — win rate: "nothing decided" vs "nothing sent" are different nulls
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n6. Two different nulls for two different situations\n");

const allOutstanding = kpisCall({
  sales: {
    quotes: [
      quote({ status: "sent", sentAt: d("2026-05-01"), total: 4000 }),
      quote({ status: "sent", sentAt: d("2026-05-02"), total: 3000 }),
      quote({ status: "sent", sentAt: d("2026-05-03"), total: 5000 }),
    ],
    undatedCount: 0,
    leads: [],
    openJobs: [],
    completedJobsForThroughput: [],
  },
});
ok("three quotes sent, none decided → 'none_decided_yet', NOT the same null as no activity",
  allOutstanding.sales.winRate.value === null && allOutstanding.sales.winRate.reason === "none_decided_yet");
ok("…and average job value has nothing WON to average — its own reason",
  allOutstanding.sales.avgJobValue.value === null && allOutstanding.sales.avgJobValue.reason === "no_won_quotes");

// Six won quotes, one of them junk data with no readable total at all — it
// must not silently drag the average down to $0, and it must not silently
// disappear either: it is counted, named, and flags the figure incomplete.
const wonWithJunk = kpisCall({
  sales: {
    quotes: [
      quote({ status: "accepted", sentAt: d("2026-05-01"), acceptedAt: d("2026-05-02"), total: 4000, acceptedTotal: 4000 }),
      quote({ status: "accepted", sentAt: d("2026-05-02"), acceptedAt: d("2026-05-03"), total: 3000, acceptedTotal: 3000 }),
      quote({ status: "accepted", sentAt: d("2026-05-03"), acceptedAt: d("2026-05-04"), total: 5000, acceptedTotal: 5000 }),
      quote({ status: "accepted", sentAt: d("2026-05-04"), acceptedAt: d("2026-05-05"), total: 2000, acceptedTotal: 2000 }),
      quote({ status: "accepted", sentAt: d("2026-05-05"), acceptedAt: d("2026-05-06"), total: 6000, acceptedTotal: 6000 }),
      // No usable total anywhere on this one — junk data, never a real deal.
      quote({ status: "accepted", sentAt: d("2026-05-06"), acceptedAt: d("2026-05-07"), total: null, acceptedTotal: null }),
    ],
    undatedCount: 0,
    leads: [],
    openJobs: [],
    completedJobsForThroughput: [],
  },
});
ok("five priced deals average $4,000 — the unpriced sixth is excluded from the sum",
  wonWithJunk.sales.avgJobValue.value === 4000, wonWithJunk.sales.avgJobValue);
ok("…and flagged incomplete rather than silently dropped",
  wonWithJunk.sales.avgJobValue.incomplete === true && wonWithJunk.sales.avgJobValue.unpricedExcluded === 1);

// ═══════════════════════════════════════════════════════════════════════════
// Section 7 — range and currency, refused rather than guessed
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n7. A backwards range and a missing currency both refuse\n");

function throws(fn) {
  try {
    fn();
    return null;
  } catch (err) {
    return err;
  }
}
const backwards = throws(() => buildKpis({ from: "2026-06-30", to: "2026-04-01", currency: CAD }));
ok("a backwards range throws 400, not an empty report that looks like a quiet quarter",
  backwards?.status === 400, backwards?.message);
const badDate = throws(() => buildKpis({ from: "not-a-date", to: TO, currency: CAD }));
ok("an unparseable date throws 400",
  badDate?.status === 400);
const noCurrency = throws(() => buildKpis({ from: FROM, to: TO, currency: null }));
ok("no billing currency throws 409 with code no_currency — never assumed",
  noCurrency?.status === 409 && noCurrency?.code === "no_currency");

// ═══════════════════════════════════════════════════════════════════════════
// Section 8 — the global invariant, walked over every fixture above
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n8. Global invariant: value is null exactly when reason is set\n");

// Every KPI figure this file has ever returned to a test above, plus the ones
// exercised via buildKpis() directly, so the walk covers real payload shapes
// and not just the pieces tested in isolation.
const FULL_PAYLOADS = [
  EMPTY,
  allOutstanding,
  kpisCall({
    profit: {
      completedJobsWithCost: FIVE_JOBS,
      overheadPerJob: 500,
      materialsTrap: detectMaterialsBuyListTrap({ buyListTotal: 0, expenseTotal: 0 }),
      periodRevenue: 41000,
      activeWorkerCount: 4,
    },
  }),
  // Exercises quality.reworkCallbackRate/changeOrderRate through the FULL
  // envelope, not just the standalone builder calls above — the same reason
  // FIVE_JOBS gets its own kpisCall rather than only being asserted via
  // buildMarginRollup directly.
  kpisCall({
    quality: {
      reworkJobs: [reworkJob("qr1", "rework"), reworkJob("qr2")],
      changeOrderJobs: [{ id: "qc1", changeOrders: [{ priceDelta: 75 }] }, { id: "qc2", changeOrders: [] }],
    },
  }),
];

// Zeros this file KNOWS are honest, named so a NEW zero-with-no-reason has to
// be added here deliberately rather than slip through unnoticed.
const ZERO_WHITELIST = new Set(["sales.backlogWeeks", "cash.arAging"]);

const seenReasons = new Set();
let envelopesChecked = 0;
function isEnvelope(node) {
  return (
    node &&
    typeof node === "object" &&
    !Array.isArray(node) &&
    "value" in node &&
    "reason" in node &&
    "sampleSize" in node
  );
}
function walk(node, path) {
  if (!node || typeof node !== "object") return;
  if (isEnvelope(node)) {
    envelopesChecked += 1;
    if (node.reason) seenReasons.add(node.reason);
    const consistent = (node.value === null) === Boolean(node.reason);
    ok(`${path}: value is null iff reason is set`, consistent, node);
    if (node.value === 0 && !node.reason) {
      ok(`${path}: a bare zero is on the whitelist of honest zeros`, ZERO_WHITELIST.has(path), path);
    }
  }
  for (const [key, child] of Object.entries(node)) {
    if (key === "raw") continue; // detail blobs, not KPI envelopes themselves
    walk(child, path ? `${path}.${key}` : key);
  }
}
for (const payload of FULL_PAYLOADS) walk(payload, "");
ok(`the walk actually visited KPI envelopes (${envelopesChecked} checked)`, envelopesChecked >= 20);

// Also walk the standalone results built outside buildKpis().
for (const [label, result] of [
  ["oneJobBelowFloor.gross", oneJobBelowFloor.grossMarginPct],
  ["oneJobBelowFloor.net", oneJobBelowFloor.netMarginPct],
  ["fiveJobsNullOverhead.net", fiveJobsNullOverhead.netMarginPct],
  ["knownMargins.gross", knownMargins.grossMarginPct],
  ["trapped.gross", trapped.grossMarginPct],
  ["jobsButNoRevenue.gross", jobsButNoRevenue.grossMarginPct],
  ["backlog", backlog],
  ["backlogNoThroughput", backlogNoThroughput],
  ["onTime", onTime],
  ["utilisation", utilisation],
  ["blendedNoLeadsAtAll", blendedNoLeadsAtAll],
  ["blendedOnlyManual", blendedOnlyManual],
  ["blendedReal", blendedReal],
  ["blendedZeroSpendRealLeads", blendedZeroSpendRealLeads],
  ["reworkKnown", reworkKnown],
  ["changeOrderKnown", changeOrderKnown],
  ["reworkWithOrphan", reworkWithOrphan],
  ["changeOrderNoQuote", changeOrderNoQuote],
]) {
  if (result.reason) seenReasons.add(result.reason);
  ok(`${label}: value is null iff reason is set`, (result.value === null) === Boolean(result.reason), result);
}

// ═══════════════════════════════════════════════════════════════════════════
// Section 9 — REASONS is the real closed vocabulary
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n9. REASONS is the whole vocabulary, and every code in it is real\n");

for (const code of seenReasons) {
  ok(`reason code "${code}" is a real REASONS entry`, code in REASONS, code);
}
// no_revenue_in_period lives in buildLabourCostPct as defence-in-depth: every
// row that reaches it was already required to have revenue > 0 by
// buildMarginRollup's own filter, so a sum of positive revenues can never be
// ≤ 0 through the public buildMarginRollup/buildKpis surface. It is the same
// kind of unreachable-by-construction guard estimateAccuracy.js keeps three
// layers of on its own division (see that file's header comment) — kept for
// the day a refactor removes the filter above it, not exercised here.
const EXEMPT_REASONS = new Set(["no_revenue_in_period"]);
const missingReasons = Object.keys(REASONS).filter((k) => !seenReasons.has(k) && !EXEMPT_REASONS.has(k));
ok("every REASONS entry (bar the one documented exception) was exercised by a fixture",
  missingReasons.length === 0, missingReasons);

// ═══════════════════════════════════════════════════════════════════════════
// Section 10 — a reason string never hardcodes the floor as a literal
// ═══════════════════════════════════════════════════════════════════════════
//
// The whole point of app/app/analytics/kpis/page.js's REASON_I18N_KEYS is that
// the count comes from the `kpi()` envelope (`floor`/`sampleSize`/`remaining`)
// and gets substituted at render time — never typed as a digit into the
// sentence. This is the assertion with the longest life: it survives
// RATE_FLOOR or COUNT_FLOOR changing value, survives new floor-bearing reasons
// being added, and would catch a future edit that "simplifies" a sentence back
// to `` `Send ${RATE_FLOOR} quotes...` `` — a JS template literal reads as
// clean code and is exactly the drift AGENTS.md failure class 4 warns about:
// the floor changes in one place and five sentences silently go stale.
console.log("\n10. No REASONS text hardcodes a count — every number is a placeholder\n");

const BARE_DIGIT = /\d/;
for (const [code, text] of Object.entries(REASONS)) {
  ok(`REASONS.${code} contains no bare digit`, !BARE_DIGIT.test(text), text);
}
// And the five that DO promise a number promise it as a named placeholder —
// asserted by name so a typo in the token (`{Floor}`, `{flor}`) fails loudly
// rather than silently rendering the literal braces on screen.
const FLOOR_PLACEHOLDER_REASONS = {
  no_quotes_sent: ["floor"],
  no_won_quotes: ["floor"],
  no_leads_in_period: ["floor"],
  none_decided_yet: ["floor"],
  below_floor: ["sampleSize", "floor", "remaining"],
};
for (const [code, tokens] of Object.entries(FLOOR_PLACEHOLDER_REASONS)) {
  for (const token of tokens) {
    ok(`REASONS.${code} names {${token}} as a placeholder`, REASONS[code].includes(`{${token}}`), REASONS[code]);
  }
}
// no_throughput_reference is the one deliberately-uncounted reason (backlog
// needs an action, not a floor to clear) — confirmed absent rather than just
// un-asserted, so a future "helpfully" adding a number to it is a red flag,
// not a silent pass.
ok("no_throughput_reference names no placeholder at all — it's an action, not a count",
  !/\{[a-zA-Z]+\}/.test(REASONS.no_throughput_reference), REASONS.no_throughput_reference);

// ═══════════════════════════════════════════════════════════════════════════
// Section 11 — mutation pass: every guarantee above must be load-bearing
// ═══════════════════════════════════════════════════════════════════════════

const MUTATING = !process.argv.includes("--no-mutate");
if (!MUTATING) {
  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
  process.exit(fails.length ? 1 : 0);
}

console.log("\n11. Mutation pass — every guarantee above must actually be load-bearing\n");

const LIB = fileURLToPath(new URL("../lib/analytics/kpis.js", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));

const backupDir = mkdtempSync(join(tmpdir(), "kpis-"));
const ORIGINAL = readFileSync(LIB, "utf8");
writeFileSync(join(backupDir, "kpis.js.bak"), ORIGINAL);

const MUTATIONS = [
  [
    "prints a rate below the sample floor",
    (s) =>
      s.replace(
        '  if (denominator < RATE_FLOOR) {\n    return kpi({\n      sampleSize: denominator,\n      reason: belowFloorReason,\n      floor: RATE_FLOOR,\n      remaining: RATE_FLOOR - denominator,\n    });\n  }\n',
        "",
      ),
  ],
  [
    "drops the floor off a below-the-floor rate, so the page can't say how many more are needed",
    (s) => s.replace("floor: RATE_FLOOR,\n      remaining: RATE_FLOOR - denominator,", "floor: null,"),
  ],
  [
    "hardcodes the win-rate floor into the sentence instead of naming it as data",
    (s) =>
      s.replace(
        'no_quotes_sent:\n    "Send quotes and get {floor} of them decided — won or lost — and your win rate shows here.",',
        'no_quotes_sent: "Send quotes and get 10 of them decided — won or lost — and your win rate shows here.",',
      ),
  ],
  [
    "treats a null overhead as free, silently matching gross margin",
    (s) => s.replace("  if (overheadPerJob === null || overheadPerJob === undefined) {", "  if (false) {"),
  ],
  [
    "ignores the materials buy-list trap entirely",
    (s) => s.replace("  if (materialsTrap?.triggered) {", "  if (false) {"),
  ],
  [
    "counts a job late that finished exactly on the scheduled day",
    (s) => s.replace("const wasOnTime = completedDay <= lastScheduled;", "const wasOnTime = completedDay < lastScheduled;"),
  ],
  [
    "drops the sample floor on the margin roll-up",
    (s) => s.replace("sample < COUNT_FLOOR", "false"),
  ],
  [
    "trips the materials trap on any mismatch at all, however small",
    (s) => s.replace("const MATERIALS_TRAP_MIN_BUYLIST = 200;", "const MATERIALS_TRAP_MIN_BUYLIST = 0;"),
  ],
  [
    "counts a zero-revenue job as priced instead of excluding it",
    (s) =>
      s.replace(
        "if (revenue === null || revenue === undefined || revenue <= 0) {",
        "if (revenue === null || revenue === undefined) {",
      ),
  ],
  [
    "prints a backlog pace with no completed work to measure it from",
    (s) =>
      s.replace(
        '  if (throughputWeekly === null || throughputWeekly <= 0) {\n    return kpi({ sampleSize: backlogJobCount, reason: "no_throughput_reference", raw });\n  }\n',
        "",
      ),
  ],
  [
    "hides that an average job value is missing unpriced deals",
    (s) => s.replace("incomplete: report.value.won.unpriced > 0,", "incomplete: false,"),
  ],
  [
    "divides revenue by zero active workers instead of refusing",
    (s) => s.replace("  if (activeWorkerCount <= 0) {", "  if (false) {"),
  ],
  [
    "drops the human sentence off every reason code",
    (s) => s.replace("reasonText: reason ? REASONS[reason] || reason : null,", "reasonText: null,"),
  ],
  [
    "counts manual/imported leads toward the blended cost-per-lead denominator",
    (s) => s.replace('BLENDED_CPL_EXCLUDED_SOURCES.has(source)', "false"),
  ],
  [
    "prints a blended cost-per-lead with zero real leads instead of refusing",
    (s) => s.replace("if (counted <= 0) {", "if (false) {"),
  ],
  [
    "counts a not-our-fault-only job toward the rework/callback rate numerator",
    (s) => s.replace("if (hasRework || hasWarranty) {", 'if (hasRework || hasWarranty || reasons.has("not_our_fault")) {'),
  ],
  [
    "drops the second reason on a job carrying both rework and warranty",
    (s) => s.replace("if (hasWarranty) warrantyCount += 1;", "// dropped"),
  ],
  [
    "counts a job with zero change orders as having one",
    (s) => s.replace("if (orders.length > 0) jobsWithChangeOrder += 1;", "jobsWithChangeOrder += 1;"),
  ],
  [
    "mergeCallbackReasons attaches a reason with no jobId instead of skipping it",
    (s) => s.replace("if (!jobId || !reason) return;", "if (!reason) return;"),
  ],
];

// ── Two mutations that were tried and are NOT in the list above ────────────
//
// Removing kpis.js's OWN `if (from > to)` and `if (!currency)` guards does not
// change buildKpis()'s observable behaviour: buildSalesFromWinLoss calls
// lib/analytics/winLoss.js's buildWinLoss(), which throws the IDENTICAL
// {status:400, message:"The period runs backwards…"} on the same bad range,
// and buildEstimateAccuracy() throws the identical {status:409, code:
// "no_currency"} a few lines later. Both mutations were run through the exact
// harness below and neither is caught, for a real reason rather than a gap in
// the fixtures: this file's own copies of those two checks are genuinely
// redundant with checks the functions it already calls perform, discovered by
// mutation-testing them and confirmed by hand. They are kept anyway — failing
// fast before ANY sub-builder runs is still worth one `if`, and a future
// refactor that reorders the calls inside buildKpis would make them load-
// bearing again — but they are not asserted here, because a check that can
// never fail teaches a future reader the opposite of what mutation testing is
// for.

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
      execFileSync(process.execPath, ["--import", LOADER, SELF, "--no-mutate"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      survived = true;
    } catch {
      /* non-zero exit = the mutant was caught, which is the point */
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
  rmSync(backupDir, { recursive: true, force: true });
}
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
