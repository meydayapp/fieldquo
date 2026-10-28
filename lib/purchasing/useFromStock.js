// lib/purchasing/useFromStock.js
//
// What a job pays for what it took off the shelf.
//
// ══ One writer, two doors ═════════════════════════════════════════════════
//
// Stock reaches a job two ways now: the Stock tab's movement form ("Used on a
// job"), and the tick on the job's own materials list ("Take from stock" —
// the owner, 2026-10-28: "if there are items in the inventory i should be
// able to pick from those instead of asking me how many did i buy"). Both
// must price it the same, or the same tape costs two different amounts
// depending on which screen somebody was standing on.
//
// ══ Why this cannot double-count ══════════════════════════════════════════
//
// Every path that puts stock ON the shelf books no expense — the purchase
// form, a PO receipt, a supply-request restock. The paths that book one are
// the two above, when the material is CONSUMED. The two halves are disjoint,
// so the cost lands exactly once.
//
// The job-materials door adds a third thing to keep disjoint: that line may
// also carry an `actualCost` somebody typed, and lib/receipts/reconcileJobPurchases.js
// books an expense from THAT. So taking from stock sets `purchasedAt` and
// leaves `actualCost` null — the line is satisfied, and the money came from
// here. A line with both would be the same material paid for twice.
//
// ══ Valued at the running average, or not at all ══════════════════════════
//
// Material.currentAvgCost is recomputed from every price entry rather than
// nudged, so one mistyped receipt is diluted rather than baked in. With no
// price history there is no honest figure: the movement still happens and the
// shelf is still right, but no expense is invented. A zero on a job's costs is
// a claim, and "we never recorded what this cost" is not that claim.
import { PURCHASE_CATEGORY } from "@/lib/receipts/toExpense";

/** The prefix every stock-use expense carries in `externalId`. Read by
 *  reconcileJobPurchases, which must not mistake one of these for the expense
 *  a ticked line is still owed. */
export const STOCK_USE_PREFIX = "stock_use:";

/**
 * What this consumption is worth. Pure, so the check script can attack it.
 *
 * @returns {{ok: true, amount: number}} or {{ok: false, reason: "no_unit_cost"}}
 */
export function stockUseAmount({ unitCost, quantity }) {
  const rate = Number(unitCost);
  const used = Math.abs(Number(quantity));
  if (!Number.isFinite(rate) || rate <= 0) return { ok: false, reason: "no_unit_cost" };
  if (!Number.isFinite(used) || used <= 0) return { ok: false, reason: "no_quantity" };
  const amount = Math.round(used * rate * 100) / 100;
  if (!(amount > 0)) return { ok: false, reason: "no_unit_cost" };
  return { ok: true, amount };
}

/**
 * Book it against the job. Returns what the screen should say, never throws a
 * silent null: a consumption that could not be priced says so.
 *
 * `externalId` carries the movement id under @@unique([companyId, externalId]),
 * so a retried request cannot book the cost twice and the row stays findable
 * if the movement is ever reversed.
 *
 * @param prisma  the client or an open transaction — the caller decides, so
 *   the job-materials door can write the movement, the expense and the tick
 *   together or not at all.
 */
export async function bookStockUse({ prisma, companyId, material, jobId, movementId, quantity, userId = null }) {
  const used = Math.abs(Number(quantity));
  const priced = stockUseAmount({ unitCost: material?.currentAvgCost, quantity: used });
  if (!priced.ok) return { expenseId: null, amount: null, reason: priced.reason };
  const expense = await prisma.expense.create({
    data: {
      companyId,
      projectId: jobId,
      materialId: material.id,
      category: PURCHASE_CATEGORY,
      amount: priced.amount,
      isOverhead: false,
      notes: `${used}${material.unit ? ` ${material.unit}` : ""} of ${material.name} from stock`,
      externalId: `${STOCK_USE_PREFIX}${movementId}`,
      createdById: userId,
    },
    select: { id: true, amount: true },
  });
  return { expenseId: expense.id, amount: Number(expense.amount), reason: null };
}
