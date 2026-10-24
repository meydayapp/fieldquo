// lib/receipts/toExpense.js
//
// The step that makes a bought material change a job's margin.
//
// ══ Why this file exists at all ═══════════════════════════════════════════
//
// Ticking a line bought on the job's sourcing list writes
// `JobMaterial.actualCost`, because that model's own comment asks for it:
// "actualCost is what the receipt said". That comment is true about intent
// and silent about consequence — **job costing does not read JobMaterial**.
// It sums `Expense` by `projectId`, plus `TimeEntry` by `jobId` and
// `AssetUseLog`. `JobMaterial` is the sourcing list, written only by
// lib/jobs/sourcingList.js.
//
// So without this, a contractor ticks a $316.38 tin of primer bought from
// Canadian Tire, watches the number appear on the material row, and the job's
// actual cost never moves — "What this job has cost → Expenses $0.00" on a
// job with a bought material list. That is the third instance of one failure
// — a number reaching a screen and reaching no total — after
// ChangeOrder.priceDelta reached no invoice and phone-punched hours reached
// no job. See docs/INTERCONNECTIONS.md, which exists because of those three.
//
// ══ Why an Expense rather than teaching costing about JobMaterial ═════════
//
// Because a purchase is a purchase, and `Expense` is already what this
// product means by "money the company spent on a job". Teaching the costing
// route a second source would give it two places to look for the same dollar
// and a new way to count it twice. One writer, one reader.
//
// ══ Why the link column, and why untick removes the row ═══════════════════
//
// `Expense.jobMaterialId` is what makes this reversible without guessing. A
// repeat tick finds its own row instead of writing a second one; an edited
// cost updates that row rather than stacking; and an untick removes THAT row
// and only that row. A hand-typed expense and a confirmed-receipt expense
// both carry a null jobMaterialId, so neither can be touched from here.
//
// Untick removes rather than keeps because the route it is called from
// already nulls `actualCost` on untick — the product's existing position is
// that unticking retracts the recorded cost. Leaving the Expense behind would
// put a cost on the job whose source line shows nothing, which is the same
// class of bug this file exists to fix, pointing the other way. The removal
// is logged as an activity by the caller, the way the expenses screen's own
// delete is.
import { db } from "@/lib/db";

/** The category job costing buckets a job's materials under — the same string
 *  lib/receipts/record.js books a receipt's job lines with, so one job's
 *  materials do not split into two rows of the panel's breakdown. */
export const PURCHASE_CATEGORY = "Materials";

/**
 * What should this bought line say, as an expense?
 *
 * Pure — takes a loaded JobMaterial row, returns a decision. Executed against
 * hostile input in scripts/check-receipt-expense.mjs rather than only read.
 *
 * @param {{ id?, name?, actualCost?, supplier?, purchasedAt? }} line
 * @param {{ jobId?: string, receiptUrl?: string|null }} ctx
 * @returns {{ action: "write"|"remove"|"skip", reason: string, data?: object }}
 */
export function expenseFromPurchase(line, ctx = {}) {
  const jobId = ctx.jobId || null;
  if (!jobId || !line?.id) {
    // A line with no job cannot move a job's cost. Not an error — a
    // company-level purchase is legitimate — it simply is not this.
    return { action: "skip", reason: "no_job" };
  }

  if (!line.purchasedAt) {
    // Unticked. Whatever this line wrote before must come back off the job.
    return { action: "remove", reason: "not_purchased" };
  }

  const amount = Number(line.actualCost);
  if (!Number.isFinite(amount) || amount <= 0) {
    // Null is not zero. A line ticked bought with no price recorded is an
    // unknown cost, and writing a $0 expense would tell the margin that a
    // real thing was free. If a price was there and has been cleared, the
    // row it wrote goes with it.
    return { action: "remove", reason: "no_confirmed_cost" };
  }

  return {
    action: "write",
    reason: "ok",
    data: {
      category: PURCHASE_CATEGORY,
      amount,
      date: new Date(line.purchasedAt),
      projectId: jobId,
      jobMaterialId: line.id,
      // Never overhead: this is a cost of one job, and marking it overhead
      // would spread one tin of primer across every job in the period.
      isOverhead: false,
      recurring: false,
      // The store as the person typed it on the line. Free text, like every
      // other vendor on an expense — a supplier ENTITY is Supplier.
      vendorName: line.supplier || null,
      notes: line.name ? `Bought on the job: ${String(line.name).slice(0, 160)}` : null,
      ...(ctx.receiptUrl ? { receiptUrl: ctx.receiptUrl, receiptCapturedAt: new Date() } : {}),
    },
  };
}

/**
 * Bring this line's expense into line with the line — write it, update it, or
 * take it off the job. Idempotent: called on every tick, and a second
 * identical tick changes nothing.
 *
 * Never throws. The purchase is the fact the contractor recorded; its
 * accounting shadow failing must not refuse the tick itself and lose the
 * purchase with it.
 *
 * @returns {{ changed: boolean, action: string, reason: string, id?: string, amount?: number }}
 */
export async function syncPurchaseExpense({
  companyId,
  jobId,
  line,
  createdById = null,
  receiptUrl = null,
  prisma = db,
}) {
  if (!companyId) return { changed: false, action: "skip", reason: "no_company" };

  const decision = expenseFromPurchase(line, { jobId, receiptUrl });
  if (decision.action === "skip") return { changed: false, action: "skip", reason: decision.reason };

  try {
    // Scoped by company as well as by line: the id alone is enough to find
    // the row, and the tenant check is the discipline every other query on
    // this path keeps.
    const existing = await prisma.expense.findFirst({
      where: { companyId, jobMaterialId: line.id },
      select: { id: true, amount: true },
    });

    if (decision.action === "remove") {
      if (!existing) return { changed: false, action: "remove", reason: decision.reason };
      await prisma.expense.delete({ where: { id: existing.id } });
      return {
        changed: true,
        action: "removed",
        reason: decision.reason,
        id: existing.id,
        amount: Number(existing.amount) || 0,
      };
    }

    if (existing) {
      await prisma.expense.update({ where: { id: existing.id }, data: decision.data });
      return { changed: true, action: "updated", reason: "ok", id: existing.id, amount: decision.data.amount };
    }

    const row = await prisma.expense.create({
      data: { ...decision.data, companyId, createdById },
      select: { id: true },
    });
    return { changed: true, action: "created", reason: "ok", id: row.id, amount: decision.data.amount };
  } catch (err) {
    console.error("[receipts/toExpense] syncPurchaseExpense", line?.id, err?.message);
    return { changed: false, action: "error", reason: err?.message || "error" };
  }
}
