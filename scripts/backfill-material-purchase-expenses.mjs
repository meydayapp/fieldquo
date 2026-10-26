// scripts/backfill-material-purchase-expenses.mjs
//
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-material-purchase-expenses.mjs [--apply]
//
// Write the missing Expense for every material already ticked bought with a
// price on it — the purchases that happened before lib/receipts/toExpense.js
// existed, plus any the live write failed on and swallowed.
//
// ── Why this is needed at all ────────────────────────────────────────────
//
// Job costing sums Expense by projectId and reads JobMaterial not at all.
// d896afe1e taught the TICK to write that Expense, which fixes every
// purchase made from then on and fixes nothing that was already ticked. The
// owner's own job is the proof: Primer (2 coats), $316.38 from Canadian
// Tire, ticked and sitting above "What this job has cost → Expenses $0.00".
// A fix with no backfill leaves every contractor who used the feature early
// with a margin that flatters the job forever, and silently.
//
// ── The double-count guard, which is the whole difficulty ────────────────
//
// The demo seed writes BOTH a ticked JobMaterial and its own Expense
// (externalId `demo:...`). Before this script existed, 408 of the 410 ticked
// lines in the database were exactly that — already paid for, by a row this
// script would not recognise as theirs because it carries no jobMaterialId.
// Backfilling them would have doubled the material cost on 408 jobs: a
// silent corruption, in the direction that makes jobs look worse, on data
// the owner demos to customers.
//
// So a line is skipped when the job already carries a Materials expense this
// script cannot prove it did not write — a demo-seeded one, or one for the
// same amount. Skipping a genuine missing cost is a visible, fixable
// nothing; writing a duplicate is an invisible wrong number. The seed itself
// now sets jobMaterialId (lib/demo/seedContent.js), so freshly seeded
// companies are matched by the link and need no guesswork at all.
//
// ── One rule, not two ────────────────────────────────────────────────────
//
// The row is built by expenseFromPurchase — the same pure function the live
// tick uses — so the backfilled rows and the ones written from now on cannot
// disagree about what a bought material costs a job. Re-running is safe: the
// link column makes a second pass find its own rows and do nothing.
//
// Dry by default. Nothing is ever updated or deleted; this only creates.

import { db } from "@/lib/db";
import { expenseFromPurchase, PURCHASE_CATEGORY } from "@/lib/receipts/toExpense";

const apply = process.argv.includes("--apply");

const lines = await db.jobMaterial.findMany({
  where: { purchasedAt: { not: null }, actualCost: { gt: 0 } },
  select: {
    id: true,
    jobId: true,
    name: true,
    actualCost: true,
    supplier: true,
    purchasedAt: true,
    purchasedById: true,
    job: { select: { id: true, companyId: true, title: true } },
  },
  orderBy: { purchasedAt: "asc" },
});

console.log(`${lines.length} ticked, priced material lines (${apply ? "APPLY" : "dry run"})\n`);

let linked = 0;
let skipped = 0;
let written = 0;

for (const line of lines) {
  if (!line.job) continue;

  const already = await db.expense.findFirst({
    where: { companyId: line.job.companyId, jobMaterialId: line.id },
    select: { id: true },
  });
  if (already) {
    linked += 1;
    continue;
  }

  // The guard. Anything on this job that could already be this purchase.
  const ambiguous = await db.expense.findFirst({
    where: {
      companyId: line.job.companyId,
      projectId: line.jobId,
      category: PURCHASE_CATEGORY,
      OR: [{ importSource: "demo" }, { amount: line.actualCost }],
    },
    select: { id: true, amount: true, importSource: true, externalId: true },
  });
  if (ambiguous) {
    skipped += 1;
    console.log(
      `  skip  $${line.actualCost} ${line.name} — "${line.job.title}" already has ` +
        `${ambiguous.importSource === "demo" ? "a demo-seeded" : "a same-amount"} Materials expense ${ambiguous.id}`,
    );
    continue;
  }

  const decision = expenseFromPurchase(line, { jobId: line.jobId });
  if (decision.action !== "write") {
    skipped += 1;
    console.log(`  skip  ${line.name} — ${decision.action} (${decision.reason})`);
    continue;
  }

  console.log(
    `  write $${decision.data.amount} ${line.name} — "${line.job.title}" ` +
      `(${line.supplier || "no supplier"}, ${new Date(line.purchasedAt).toISOString().slice(0, 10)})`,
  );
  if (apply) {
    await db.expense.create({
      data: {
        ...decision.data,
        companyId: line.job.companyId,
        createdById: line.purchasedById || null,
      },
    });
  }
  written += 1;
}

console.log(
  `\nalready linked ${linked} · skipped ${skipped} · ${apply ? "written" : "would write"} ${written}`,
);
await db.$disconnect();
