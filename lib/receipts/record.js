// lib/receipts/record.js
//
// A confirmed receipt becomes the books: one Expense row per part of the
// split, each carrying its share of the tax, the vendor, the payment method,
// the original file and which printed lines it holds.
//
// ══ Where each row lands ═══════════════════════════════════════════════════
//
//   job       Expense.projectId — job costing sums Expense by projectId, so
//             the job's margin moves the moment this commits.
//   overhead  Expense.isOverhead — the P&L's overhead line and the overhead
//             views read it. NOT `recurring`: a receipt is one purchase, and
//             lib/analytics/burnRate.js would otherwise multiply it into a
//             monthly commitment nobody made.
//   general   neither — the P&L's general expenses.
//
// ══ Once ═══════════════════════════════════════════════════════════════════
//
// A receipt is confirmed by a compare-and-set on its status, inside the same
// transaction as the Expense rows: two taps on a bad connection produce one
// set of rows, and the second answers "already confirmed". A missing cost is
// invisible and a doubled one is at least visible — but neither is acceptable
// when the guard is this cheap.
import { db } from "@/lib/db";
import { centsToAmount, toCents } from "./money";
import { paymentLabel } from "./fields";
import { tokens } from "./classify";
import { recordMaterialPrice } from "@/lib/jobs/sourcingList";

/** The statuses a receipt may be confirmed from. `unreadable` is one: a
 *  photo the model could not read is still a purchase, and the person can
 *  type its total — the photo stays attached as the record either way. */
export const CONFIRMABLE = Object.freeze(["needs_review", "unreadable"]);

/** The Expense.date for a receipt: the printed day, else when it was captured. */
export function expenseDate(receipt) {
  if (receipt?.purchasedAt) return new Date(receipt.purchasedAt);
  if (receipt?.purchasedDate) return new Date(`${receipt.purchasedDate}T12:00:00.000Z`);
  return receipt?.createdAt ? new Date(receipt.createdAt) : new Date();
}

/**
 * The Expense rows to write — pure, so the check script can inspect them.
 *
 * @param receipt  the Receipt row
 * @param rows     allocate()'s rows
 * @param edits    { vendorName?, date? } the person's corrections on screen
 */
export function expenseRowsFor(receipt, rows, edits = {}) {
  const files = Array.isArray(receipt?.files) ? receipt.files : [];
  const vendor = (typeof edits.vendorName === "string" && edits.vendorName.trim()) || receipt.vendorName || null;
  const date = edits.date ? new Date(edits.date) : expenseDate(receipt);
  return rows.map((row) => ({
    companyId: receipt.companyId,
    // The person who PAID — the capturer — so the crew member who snapped it
    // still sees it under "their own" expenses when the office confirms it.
    createdById: receipt.createdById || null,
    category: row.target.category || (row.target.kind === "job" ? "Materials" : "Other"),
    amount: centsToAmount(row.amountCents),
    date: Number.isFinite(date.getTime()) ? date : expenseDate(receipt),
    notes: null,
    projectId: row.target.kind === "job" ? row.target.jobId : null,
    isOverhead: row.target.kind === "overhead",
    recurring: false,
    frequency: "one_time",
    receiptId: receipt.id,
    receiptUrl: files[0]?.url || null,
    receiptCapturedAt: receipt.createdAt ? new Date(receipt.createdAt) : new Date(),
    receiptExtract: receipt.extract || null,
    vendorName: vendor,
    taxAmount: row.taxCents === null || row.taxCents === undefined ? null : centsToAmount(row.taxCents),
    taxBreakdown: Array.isArray(row.taxBreakdown)
      ? row.taxBreakdown.map((b) => ({ label: b.label, amount: centsToAmount(b.cents) }))
      : null,
    paymentMethod: paymentLabel(receipt.paymentMethod, receipt.cardLast4),
    receiptLines: Array.isArray(row.lineIndexes) ? row.lineIndexes : null,
  }));
}

/**
 * Write the rows and mark the receipt confirmed — or nothing at all.
 *
 * @returns {{ ok: true, expenseIds }} | {{ ok: false, reason: "already_confirmed" }}
 */
export async function confirmReceipt({ receipt, rows, edits = {}, confirmedById, prisma = db }) {
  const data = expenseRowsFor(receipt, rows, edits);
  try {
    const ids = await prisma.$transaction(async (tx) => {
      const claimed = await tx.receipt.updateMany({
        where: { id: receipt.id, companyId: receipt.companyId, status: { in: CONFIRMABLE } },
        data: {
          status: "confirmed",
          confirmedAt: new Date(),
          confirmedById: confirmedById || null,
          officeDecides: false,
          ...(typeof edits.vendorName === "string" && edits.vendorName.trim()
            ? { vendorName: edits.vendorName.trim().slice(0, 200) }
            : {}),
        },
      });
      if (claimed.count !== 1) throw Object.assign(new Error("already"), { code: "ALREADY" });
      const out = [];
      for (const d of data) {
        const row = await tx.expense.create({ data: d, select: { id: true } });
        out.push(row.id);
      }
      return out;
    });
    return { ok: true, expenseIds: ids, data };
  } catch (err) {
    if (err?.code === "ALREADY") return { ok: false, reason: "already_confirmed" };
    throw err;
  }
}

/**
 * The price book half: materials lines booked to a job, matched to a line on
 * that job's material list, become MaterialPriceEntry rows through the
 * existing recordMaterialPrice (lib/jobs/sourcingList.js) — the same writer a
 * ticked material with a receipt uses.
 *
 * Only a MATCHED line is recorded. Creating a Material for every till line
 * ("BAG FEE", "2X4X8 SPF #2") would flood the price book with names nobody
 * estimates from; a line that matches the job's own list is a price for a
 * thing this company actually quotes. Never throws — the purchase is the
 * fact, the price history a by-product (recordMaterialPrice's own rule).
 */
export async function recordReceiptPrices({ receipt, rows, expenseIds, prisma = db }) {
  const items = Array.isArray(receipt?.extract?.items) ? receipt.extract.items : [];
  let recorded = 0;
  try {
    for (const [i, row] of rows.entries()) {
      if (row.target.kind !== "job" || !row.target.jobId) continue;
      const indexes = Array.isArray(row.lineIndexes) ? row.lineIndexes : items.map((_, n) => n);
      const materials = await prisma.jobMaterial.findMany({
        where: { jobId: row.target.jobId, job: { companyId: receipt.companyId } },
        select: { name: true, unit: true },
        take: 200,
      });
      if (!materials.length) continue;
      const named = materials.map((m) => ({ ...m, words: new Set(tokens(m.name)) }));
      for (const n of indexes) {
        const it = items[n];
        if (!it || it.kind !== "materials") continue;
        const cents = toCents(it.lineTotal);
        const qty = Number(String(it.quantity || "").replace(/[^\d.]/g, ""));
        if (!(cents > 0) || !(qty > 0)) continue;
        const words = tokens(it.description);
        // The material whose name shares the most words with the line; a
        // single shared word is enough only when the name IS one word.
        let best = null;
        for (const m of named) {
          const shared = words.filter((w) => m.words.has(w)).length;
          if (!shared) continue;
          if (shared < Math.min(2, m.words.size)) continue;
          if (!best || shared > best.shared) best = { m, shared };
        }
        if (!best) continue;
        const done = await recordMaterialPrice({
          companyId: receipt.companyId,
          name: best.m.name,
          unit: best.m.unit,
          qty,
          actualCost: cents / 100,
          expenseId: expenseIds[i] || null,
          supplier: receipt.vendorName || null,
        });
        if (done) recorded += 1;
      }
    }
  } catch (err) {
    console.error("[receipts] price history:", err?.message);
  }
  return recorded;
}
