// scripts/check-job-costing.mjs
//
// The quote side of costing was good — materials, labour hours, overhead,
// margin, all computed and all shown. Then the job happened, expenses got
// tagged to it, crews logged hours against it, and the job page had no cost
// section at all. A contractor could see what they THOUGHT a job would cost
// and never what it did.
//
// "Did this one make money" is the question the feature exists to answer.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-job-costing.mjs

import { actualJobCost, compareJobCost } from "@/lib/costing/actualJobCost";
import { equipmentCostForJob } from "@/lib/costing/equipmentUsage";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

const rated = (h, rate, status = "approved", workerId = "w1") => ({
  hours: h, status, workerId, worker: { hourlyRate: rate },
});

console.log("\nThe QA scenario, end to end");
// $125.50 materials, and the two approved entries from the QA pay run.
const a = actualJobCost(
  [{ category: "Materials", amount: 125.5 }],
  [rated(8, 25, "approved", "w1"), rated(6.5, 20, "approved", "w2")],
);
t("expenses total", a.expenses.total, 125.5);
t("approved hours", a.labour.approvedHours, 14.5);
t("labour cost = 8×25 + 6.5×20", a.labour.cost, 330);
t("two distinct workers", a.labour.workers, 2);
t("total cost", a.total, 455.5);
t("nothing missing, so not flagged incomplete", a.incomplete, false);

console.log("\nOnly approved hours are a cost");
const p = actualJobCost([], [rated(8, 25, "approved"), rated(40, 25, "pending", "w2")]);
t("pending hours excluded from cost", p.labour.cost, 200);
t("...but reported, not silently dropped", p.labour.pendingHours, 40);
t("...and the total is flagged as short", p.incomplete, true);

console.log("\nA worker with no rate is counted, not treated as free");
for (const [label, rate] of [["null", null], ["undefined", undefined], ["empty string", ""]]) {
  const r = actualJobCost([], [rated(10, rate)]);
  t(`${label} rate contributes no cost`, r.labour.cost, 0);
  t(`...but its hours are surfaced`, r.labour.unratedHours, 10);
  t(`...and the job is flagged incomplete`, r.incomplete, true);
}
// Number(null) === 0 is the trap this guards. A silently free crew is how a
// job shows a profit it didn't make.
t("a rate of 0 is a real answer and costs nothing",
  actualJobCost([], [rated(10, 0)]).labour.unratedHours, 0);

console.log("\nExpenses group by category, largest first");
const g = actualJobCost(
  [{ category: "Materials", amount: 100 }, { category: "Fuel", amount: 20 },
   { category: "Materials", amount: 50 }, { category: null, amount: 5 }],
  [],
);
t("same category summed", g.expenses.byCategory[0], { category: "Materials", amount: 150 });
t("sorted by size", g.expenses.byCategory.map((c) => c.category), ["Materials", "Fuel", "other"]);
t("a missing category becomes 'other', not undefined", g.expenses.byCategory[2].category, "other");

console.log("\nHostile and empty input");
t("no arguments at all", actualJobCost().total, 0);
t("nulls", actualJobCost(null, null).total, 0);
t("junk rows ignored", actualJobCost([null, {}, "x"], [null, {}, "x"]).total, 0);
t("a non-numeric amount is not NaN", actualJobCost([{ amount: "abc" }], []).total, 0);
t("a non-numeric rate is not NaN", actualJobCost([], [rated(5, "abc")]).labour.cost, 0);

console.log("\nComparison: unknown is never zero");
const none = compareJobCost({});
t("no estimate, no variance", none.variance, null);
t("no revenue, no profit", none.profit, null);
t("unknown is not 'over budget'", none.overBudget, false);
t("a job with nothing recorded is not on budget", none.variancePct, null);

console.log("\nComparison: the numbers");
const c = compareJobCost({ estimatedCost: 1113.11, actualCost: 455.5, revenue: 2100 });
t("variance is actual minus estimate", c.variance, -657.61);
t("under budget is not flagged", c.overBudget, false);
t("profit is revenue minus ACTUAL cost", c.profit, 1644.5);
t("margin", c.marginPct, 78.3);
const over = compareJobCost({ estimatedCost: 1000, actualCost: 1250, revenue: 2000 });
t("over budget is flagged", over.overBudget, true);
t("variance percentage", over.variancePct, 25);

console.log("\nDivision guards");
t("a zero estimate yields no percentage, not Infinity",
  compareJobCost({ estimatedCost: 0, actualCost: 500 }).variancePct, null);
t("zero revenue yields no margin, not Infinity",
  compareJobCost({ revenue: 0, actualCost: 500 }).marginPct, null);
t("a loss is reported as a loss",
  compareJobCost({ revenue: 100, actualCost: 500 }).profit, -400);

// ═══════════════════════════════════════════════════════════════════════════
// Equipment depreciation → job cost, and the double count it must not create
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner's ask: "a $9,000 spray rig depreciating over 5 years is a real
// cost of every job it runs on, and none of it lands there." True — and also,
// lib/analytics/minimumPrice.js's costPerJob (piped in here as
// `overheadPerJob`) ALREADY spreads every asset's depreciation evenly across
// every job whenever a company has filled in Settings → Overhead. Adding a
// SECOND, asset-specific charge on top of that figure would double-count the
// exact same rig on every job that happens to log it. See the comment on
// actualJobCost() for the full argument; this proves it against real numbers.
//
// $9,000 over 60 months, no salvage: $150/mo ÷ 30.4375 avg days/mo ≈
// $4.93/day for one full day logged.
const SPRAY_RIG = {
  id: "spray-rig",
  cost: 9000,
  salvageValue: 0,
  inServiceDate: new Date("2024-08-28T00:00:00Z"),
  usefulLifeMonths: 60,
  disposedOn: null,
  active: true,
};
const ASOF = new Date("2026-08-28T12:00:00Z");
const oneDayOfRig = equipmentCostForJob({
  useLogs: [{ hours: null, asset: SPRAY_RIG }],
  asOf: ASOF,
});
console.log(`\n(equipmentCostForJob for one logged day of the spray rig: $${oneDayOfRig.total})`);

console.log("\nA job with NO assets logged costs exactly what it cost before this feature existed");
{
  const withoutFeature = actualJobCost(
    [{ category: "Materials", amount: 100 }],
    [rated(8, 25)],
    { overheadPerJob: 200, overheadBasis: "per_job" }, // no `equipment` key at all
  );
  const withFeatureButNoLog = actualJobCost(
    [{ category: "Materials", amount: 100 }],
    [rated(8, 25)],
    { overheadPerJob: 200, overheadBasis: "per_job", equipment: null },
  );
  t("total is unaffected by the feature existing", withoutFeature.total, 300 + 200);
  t("...and identical whether `equipment` is omitted or explicitly null",
    withFeatureButNoLog.total, withoutFeature.total);
  t("equipment section is null, not a $0 that reads as \"we checked\"",
    withFeatureButNoLog.equipment, null);

  // Same again with NO overhead set — the other place a silent change could
  // sneak in.
  const noOverheadEither = actualJobCost(
    [{ category: "Materials", amount: 100 }],
    [rated(8, 25)],
    {},
  );
  t("no overhead and no equipment: total is exactly materials + labour", noOverheadEither.total, 300);
}

console.log("\nOverhead KNOWN: equipment is reported but NOT added — that's the double count avoided");
{
  const withOverhead = actualJobCost(
    [{ category: "Materials", amount: 100 }],
    [rated(8, 25)],
    { overheadPerJob: 200, overheadBasis: "per_job", equipment: oneDayOfRig },
  );
  t("total = materials + labour + overhead, equipment NOT folded in",
    withOverhead.total, 100 + 200 + 200);
  t("the rig's cost is still reported...", withOverhead.equipment.total, oneDayOfRig.total);
  t("...flagged as already inside the overhead share", withOverhead.equipment.includedInOverhead, true);
  t("...and explicitly marked as not added to the total", withOverhead.equipment.addedToTotal, false);
}

console.log("\nOverhead UNKNOWN: nothing else here captures depreciation, so equipment IS added");
{
  const noOverhead = actualJobCost(
    [{ category: "Materials", amount: 100 }],
    [rated(8, 25)],
    { equipment: oneDayOfRig }, // no overheadPerJob at all
  );
  t("total = materials + labour + the logged equipment charge",
    noOverhead.total, Math.round((100 + 200 + oneDayOfRig.total) * 100) / 100);
  t("flagged as NOT already covered by an overhead this company hasn't set",
    noOverhead.equipment.includedInOverhead, false);
  t("...and as actually added this time", noOverhead.equipment.addedToTotal, true);
}

console.log("\nThe same physical asset logged on two different jobs the same day");
{
  // Neither actualJobCost nor equipmentCostForJob knows about the OTHER job —
  // each is computed independently from that job's own rows, so a company
  // with one spray rig that (impossibly) got logged on two roofs the same day
  // has both jobs charged in full, independently. Named here rather than
  // silently "handled" — see docs/SAFETY-AND-EQUIPMENT.md and the matching
  // note in scripts/check-depreciation.mjs.
  const jobA = actualJobCost([], [], { equipment: oneDayOfRig });
  const jobB = actualJobCost([], [], {
    equipment: equipmentCostForJob({ useLogs: [{ hours: null, asset: SPRAY_RIG }], asOf: ASOF }),
  });
  t("job A is charged the full day", jobA.equipment.total, oneDayOfRig.total);
  t("job B, logged independently, is ALSO charged the full day — a named gap",
    jobB.equipment.total, oneDayOfRig.total);
}

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — a job can say what it cost\n");
process.exit(fail ? 1 : 0);
