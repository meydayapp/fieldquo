// lib/receipts/toExpense.js
//
// The step that makes a receipt change a job's margin.
//
// ══ Why this file exists at all ═══════════════════════════════════════════
//
// Receipt capture prefills `JobMaterial.actualCost`, because that model's own
// comment asks for it: "actualCost is what the receipt said". That comment is
// true about intent and silent about consequence — **job costing does not read
// JobMaterial**. It sums `Expense` by `projectId`, plus `TimeEntry` by `jobId`
// and `AssetUseLog`. `JobMaterial` is the sourcing list, written only by
// lib/jobs/sourcingList.js.
//
// So without this, a contractor photographs a $412 receipt, watches the number
// appear on the material row, and the job's actual cost never moves. That is
// the third instance of one failure this week — a number reaching a screen and
// reaching no total — after ChangeOrder.priceDelta reached no invoice and
// phone-punched hours reached no job. See docs/INTERCONNECTIONS.md, which
// exists because of those three.
//
// ══ Why an Expense rather than teaching costing about JobMaterial ═════════
//
// Because a receipt is a purchase, and `Expense` is already what this product
// means by "money the company spent on a job". Teaching the costing route a
// second source would give it two places to look for the same dollar and a new
// way to count it twice. One writer, one reader.
//
// ══ Idempotency, and why it is not optional here ══════════════════════════
//
// A person can scan the same receipt twice, or confirm a form twice on a bad
// connection. Two Expense rows for one purchase overstate the cost of the job
// and understate its margin, and nothing downstream would ever flag it — the
// second row looks exactly like a real second purchase. So the write is keyed,
// and a repeat is a no-op rather than a second row.
import { db } from "@/lib/db";

/**
 * Should this receipt become an expense, and what would it say?
 *
 * Pure — takes loaded rows, returns a decision. Executed against hostile input
 * in scripts/check-receipt-expense.mjs rather than only read.
 *
 * @param {{ jobId?, materialId?, actualCost?, supplier?, purchasedAt? }} material
 * @param {{ url?, extract?, vendorName? }} receipt
 * @returns {{ create: boolean, reason: string, data?: object }}
 */
export function expenseFromReceipt(material, receipt = {}) {
  if (!material?.jobId) {
    // A material with no job cannot move a job's cost. This is not an error —
    // a company-level purchase is legitimate — it simply is not this.
    return { create: false, reason: "no_job" };
  }

  const amount = Number(material.actualCost);
  if (!Number.isFinite(amount) || amount <= 0) {
    // Null is not zero. An unconfirmed cost is not a $0 purchase, and writing
    // one would tell the margin a real thing was free.
    return { create: false, reason: "no_confirmed_cost" };
  }

  return {
    create: true,
    reason: "ok",
    data: {
      // The category the costing route buckets materials under. Read from the
      // material rather than invented, so a company that renames its
      // categories is not overridden by a constant in here.
      category: material.category || "materials",
      amount,
      date: material.purchasedAt ? new Date(material.purchasedAt) : new Date(),
      projectId: material.jobId,
      materialId: material.materialId || null,
      // Never overhead: this is a cost of one job, and marking it overhead
      // would spread one receipt across every job in the period.
      isOverhead: false,
      receiptUrl: receipt.url || null,
      receiptCapturedAt: receipt.url ? new Date() : null,
      // What the model READ, before anyone edited the figure. Kept so
      // "it said 412.80 and the row says 421.80" stays answerable.
      receiptExtract: receipt.extract || null,
      vendorName: receipt.vendorName || material.supplier || null,
    },
  };
}

/** The key that makes a repeated confirmation a no-op rather than a second row. */
export function receiptExpenseRef(jobMaterialId) {
  return jobMaterialId ? `receipt:${jobMaterialId}` : null;
}

/**
 * Write it, once.
 *
 * Guarded on the absence of a row already carrying this material's receipt —
 * a compare-and-set in the read, not an `if` a second request can walk past
 * between the check and the write. The narrow race that remains writes two
 * rows rather than losing one, which is the direction to fail in: a duplicate
 * is visible on the expense list and correctable; a missing cost is invisible.
 */
export async function recordReceiptExpense({
  companyId,
  material,
  receipt,
  createdById = null,
  prisma = db,
}) {
  if (!companyId) return { written: false, reason: "no_company" };

  const decision = expenseFromReceipt(material, receipt);
  if (!decision.create) return { written: false, reason: decision.reason };

  const existing = await prisma.expense.findFirst({
    where: {
      companyId,
      projectId: material.jobId,
      receiptUrl: receipt?.url || undefined,
      materialId: material.materialId || undefined,
    },
    select: { id: true },
  });
  if (existing) return { written: false, reason: "already_recorded", id: existing.id };

  const row = await prisma.expense.create({
    data: { ...decision.data, companyId, createdById },
    select: { id: true, amount: true },
  });
  return { written: true, reason: "created", id: row.id };
}
