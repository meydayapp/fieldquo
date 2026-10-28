// lib/receipts/reconcileJobPurchases.js
//
// Make a job's bought material lines true in its costs, every time the costs
// are read — not only at the instant somebody ticked a box.
//
// ── Why this exists ──────────────────────────────────────────────────────
//
// syncPurchaseExpense() books the expense when a line is ticked bought. That
// is the right moment to write, and it is not a sufficient one:
//
//   - A line ticked BEFORE the writer shipped has no expense and never will.
//     That is not hypothetical — it is how the owner's own primer, $316.38
//     from Canadian Tire, sat on a job reading "Expenses $0.00" while the
//     line beside it was struck through as bought.
//   - syncPurchaseExpense deliberately never throws, so a write that fails
//     leaves a ticked line and no cost, and the only repair was a script run
//     by hand against the live database.
//
// A one-shot side effect cannot be the only path to a number the contractor
// is reading off the screen to decide whether a job made money. So the read
// repairs itself. Idempotent, and a no-op on every job whose lines already
// carry their expense — which is almost all of them, almost always.
//
// ── Why the amount match, and why one-for-one ───────────────────────────
//
// Expense rows written before Expense.jobMaterialId existed carry no link to
// their line, and the demo seed wrote them that way too. Booking a fresh
// expense for such a line would DOUBLE that job's material cost — measured,
// not feared: 136 of the 138 jobs holding bought-and-priced lines carry
// exactly one unlinked Materials expense per line, same amount. So an
// unlinked Materials row of the same amount is taken as that line's cost,
// already counted, and claimed once: a second line of the same amount does
// not get to reuse it. Conservative in the direction that matters — a cost
// counted once rather than twice.

import { PURCHASE_CATEGORY, syncPurchaseExpense } from "@/lib/receipts/toExpense";
import { STOCK_USE_PREFIX } from "@/lib/purchasing/useFromStock";
import { db } from "@/lib/db";

/** Cents, so 316.38 compares equal to a Decimal that round-trips as 316.38. */
const cents = (v) => Math.round(Number(v) * 100);

/**
 * Bring every bought, priced material line on this job into the job's costs.
 *
 * Never throws: the costing panel must still draw if the repair fails. The
 * outcome is RETURNED rather than only logged, so a caller can say so — a
 * swallow with no caller is exactly the silence this file exists to end.
 *
 * @returns {{ healed: number, alreadyCosted: number, failed: number }}
 */
export async function reconcileJobPurchases({ companyId, jobId, prisma = db }) {
  const out = { healed: 0, alreadyCosted: 0, failed: 0 };
  if (!companyId || !jobId) return out;

  try {
    const lines = await prisma.jobMaterial.findMany({
      where: { jobId, purchasedAt: { not: null }, actualCost: { gt: 0 } },
      select: { id: true, name: true, actualCost: true, supplier: true, purchasedAt: true },
    });
    if (!lines.length) return out;

    const expenses = await prisma.expense.findMany({
      where: { companyId, projectId: jobId, category: PURCHASE_CATEGORY },
      select: { id: true, amount: true, jobMaterialId: true, externalId: true },
    });

    const linked = new Set(expenses.filter((e) => e.jobMaterialId).map((e) => e.jobMaterialId));
    // Unlinked rows are a pool to be claimed by amount, one line each.
    // ── A stock withdrawal is not a line waiting to be costed ─────────────
    //
    // Taking a material off the shelf for this job books a Materials expense
    // too (lib/purchasing/useFromStock.js), and it carries no jobMaterialId —
    // so it would land in `unclaimed` and, if its amount happened to equal a
    // ticked line's, be mistaken for that line's cost. The line would then be
    // read as already paid for and never booked: an UNDERcount, the opposite
    // of the double this file exists to prevent, and just as wrong. Its
    // externalId says plainly what it is.
    const unclaimed = expenses
      .filter((e) => !e.jobMaterialId && !String(e.externalId || "").startsWith(STOCK_USE_PREFIX))
      .map((e) => cents(e.amount));

    for (const line of lines) {
      if (linked.has(line.id)) {
        out.alreadyCosted += 1;
        continue;
      }
      const at = unclaimed.indexOf(cents(line.actualCost));
      if (at !== -1) {
        // An older, unlinked row is already carrying this cost. Leave both
        // alone: linking it would be an edit to a row we did not write, and
        // writing a new one would count the money twice.
        unclaimed.splice(at, 1);
        out.alreadyCosted += 1;
        continue;
      }
      const booked = await syncPurchaseExpense({ companyId, jobId, line, prisma });
      if (booked.changed) out.healed += 1;
      else out.failed += 1;
    }
  } catch (err) {
    console.error("[receipts/reconcileJobPurchases]", jobId, err?.message);
    out.failed += 1;
  }

  return out;
}
