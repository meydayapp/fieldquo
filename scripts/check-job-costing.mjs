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

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — a job can say what it cost\n");
process.exit(fail ? 1 : 0);
