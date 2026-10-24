// scripts/check-receipt-expense.mjs
//
// A material ticked bought has to reach the job's cost.
//
// ══ What went wrong before this existed ════════════════════════════════════
//
// Ticking "Primer (2 coats)" bought for $316.38 from Canadian Tire wrote
// `JobMaterial.actualCost` and a price-history entry, and nothing else. Job
// costing sums `Expense` by `projectId`; it does not read `JobMaterial` at
// all. So the job page said:
//
//     What this job has cost
//     Expenses   $0.00
//
// on a job whose material list said "24 lines · 1 bought". The number reached
// a screen and reached no total — the same shape as ChangeOrder.priceDelta
// reaching no invoice and phone-punched hours reaching no job.
//
// lib/receipts/toExpense.js was written to close exactly this gap, named this
// file in its own comment as the place it would be executed, and was then
// imported by NOTHING. It sat dead for the whole life of the bug, carrying a
// shape — `material.materialId`, `material.category` — that JobMaterial does
// not even have. A helper proven correct and never proven reachable is worth
// nothing, which is why the reachability assertions below are not optional.
//
// ══ What these assert ══════════════════════════════════════════════════════
//
// The decision function against hostile input, and — the half that was
// missing — that the sourcing route actually calls it, and that the costing
// route still reads the column it writes.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-receipt-expense.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { expenseFromPurchase, PURCHASE_CATEGORY } from "@/lib/receipts/toExpense";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const fails = [];
const ok = (label, condition, detail = "") => {
  if (condition) pass += 1;
  else fails.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

const JOB = "job_abc";
const bought = (over = {}) => ({
  id: "jm_1",
  name: "Primer (2 coats)",
  actualCost: 316.38,
  supplier: "Canadian tire",
  purchasedAt: "2026-10-25T00:25:00.741Z",
  ...over,
});

// ── The decision, against the shapes a real row actually takes ────────────

{
  const d = expenseFromPurchase(bought(), { jobId: JOB });
  ok("a bought line with a price writes", d.action === "write", d.reason);
  ok("…onto the job job costing sums by", d.data?.projectId === JOB);
  ok("…carrying the line it came from", d.data?.jobMaterialId === "jm_1");
  ok("…in the category the receipt path also books", d.data?.category === PURCHASE_CATEGORY);
  ok("…at the price on the line", d.data?.amount === 316.38);
  ok("…dated when it was bought, not when this ran", d.data?.date?.toISOString() === "2026-10-25T00:25:00.741Z");
  ok("…never as overhead", d.data?.isOverhead === false);
  ok("…with the store as typed", d.data?.vendorName === "Canadian tire");
}

// The whole point of the bug: a $0 must never be invented. Absence of a
// statement is not a statement.
for (const [label, cost] of [
  ["null", null],
  ["undefined", undefined],
  ["empty string", ""],
  ["zero", 0],
  ["a negative", -5],
  ["not a number", "abc"],
  ["NaN", NaN],
  ["Infinity", Infinity],
]) {
  const d = expenseFromPurchase(bought({ actualCost: cost }), { jobId: JOB });
  ok(`a line ticked bought with ${label} as its price writes no expense`, d.action === "remove", `${d.action}/${d.reason}`);
}

{
  const d = expenseFromPurchase(bought({ purchasedAt: null }), { jobId: JOB });
  ok("unticking takes the row back off the job", d.action === "remove" && d.reason === "not_purchased", d.reason);
}

for (const [label, ctx] of [
  ["no job", {}],
  ["an empty job id", { jobId: "" }],
  ["a null job id", { jobId: null }],
]) {
  const d = expenseFromPurchase(bought(), ctx);
  ok(`${label} is left alone rather than guessed at`, d.action === "skip" && d.reason === "no_job", d.reason);
}

for (const [label, line] of [
  ["null", null],
  ["undefined", undefined],
  ["an empty object", {}],
  ["a row with no id", bought({ id: null })],
]) {
  const d = expenseFromPurchase(line, { jobId: JOB });
  ok(`${label} does not throw and writes nothing`, d.action === "skip", d.action);
}

{
  // A vendor is optional; a missing one must be null, never the string
  // "undefined" or an empty string pretending to be a supplier.
  const d = expenseFromPurchase(bought({ supplier: "" }), { jobId: JOB });
  ok("a line with no store recorded says null, not an empty vendor", d.data?.vendorName === null, String(d.data?.vendorName));
}

{
  const long = "x".repeat(400);
  const d = expenseFromPurchase(bought({ name: long }), { jobId: JOB });
  ok("a long material name is bounded before it reaches notes", (d.data?.notes || "").length < 200, String((d.data?.notes || "").length));
}

// ── Reachability: the half that was missing for the whole life of the bug ──

{
  const route = read("app/api/jobs/[id]/materials/route.js");
  ok(
    "the sourcing route imports the writer",
    /from "@\/lib\/receipts\/toExpense"/.test(route),
    "nothing imported it — this is how the bug survived",
  );
  ok("…and calls it", /syncPurchaseExpense\(/.test(route));
  ok(
    "…only on a tick, so recording how many were USED does not re-price a purchase",
    /if \(isTick\) \{\s*const booked = await syncPurchaseExpense/.test(route),
  );
  ok("…passing the job the cost lands on", /jobId: id,/.test(route));
  ok("…and the row as it stands AFTER the update, not the one read before it", /line: updated,/.test(route));
  ok("…logging the money it moved", /entityType: "expense"/.test(route));
}

{
  const costing = read("app/api/jobs/[id]/costing/route.js");
  ok(
    "job costing still sums expenses by projectId — the column the writer targets",
    /db\.expense\.findMany\(\{\s*where: \{ projectId: job\.id, companyId: member\.companyId \}/.test(costing),
    "if this moved, the writer above is pointing at nothing",
  );
}

{
  const schema = read("prisma/schema.prisma");
  // Only this model's block. A naive indexOf("model ") lands inside Expense's
  // own prose — it has plenty — and would assert against the wrong model.
  const expense = (schema.match(/^model Expense \{[\s\S]*?^\}/m) || [""])[0];
  ok("Expense carries the link that makes the write reversible", /jobMaterialId\s+String\?/.test(expense));
  ok("…and it is indexed with the tenant, the way it is queried", /@@index\(\[companyId, jobMaterialId\]\)/.test(expense));
}

{
  const lib = read("lib/receipts/toExpense.js");
  ok(
    "the writer matches on the line AND the company, never the line alone",
    /where: \{ companyId, jobMaterialId: line\.id \}/.test(lib),
  );
  ok(
    "a repeat tick updates its own row rather than writing a second",
    /action === "remove"/.test(lib) && /prisma\.expense\.update\(/.test(lib),
  );
  ok(
    "a hand-typed or receipt-confirmed expense is out of reach — those carry a null link",
    !/jobMaterialId: null/.test(lib.slice(lib.indexOf("findFirst"))),
  );
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);

process.exit(fails.length ? 1 : 0);
