// lib/invoices/listSummary.js
//
// The three tiles at the top of the invoices list and the money on each row —
// computed by ONE function, because they answer the same question.
//
// ── The defect this exists to close ────────────────────────────────────────
//
// The Outstanding tile summed `amountDue` (correct, and its comment explained
// why: counting `status === "paid"` reported $600 of a $1,000 invoice as $0
// paid). Forty lines below, every row printed `inv.total`. So a half-paid
// invoice showed its full face value while the tile above counted only the
// balance, and the column of figures could never add up to the number sitting
// on top of it. Two answers to "how much is this invoice" on one screen, and
// nothing said which was which.
//
// The fix is not a third formula. It is that the row and the tile now call
// `invoiceMoney()` — the same function the invoice DETAIL page's balance and
// its lifecycle banners already use — so all three surfaces agree by
// construction rather than by luck. lib/analytics/receivables.js made the same
// choice for the dashboard and says so in its own header.
//
// ── One deliberate change of rule, named ───────────────────────────────────
//
// The tile used to fall back to `total` when `amountDue` was null; invoiceMoney
// falls back to `total − amountPaid`. On a row written before amountDue was
// seeded and since part-paid, the old fallback counted money that had already
// arrived as still owing. The new one cannot. Every other surface in the
// product already used the subtraction.
//
// ── Absence is not a zero ──────────────────────────────────────────────────
//
// `null` in, `null` out. A member without `showPricing` gets the money columns
// REMOVED from the payload, not zeroed (lib/permissions/enforce.js), and a
// failed fetch leaves the list null. Summing either would print "$0.00
// outstanding" over a book full of unpaid invoices — a far stronger and more
// wrong claim than an em dash. The counts are separate from the money for the
// same reason: how many invoices exist is knowable when what they are worth is
// not.
//
// Pure — every row and the clock are passed in, so scripts/check-invoice-list.mjs
// executes the arithmetic instead of reading it.
import {
  calendarDaysBetween,
  invoiceMoney,
  PAID_EPSILON,
} from "@/lib/invoices/lifecycle";

const asDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Everything one row needs to render, from one pass over one invoice.
 *
 * `daysLate` reproduces lib/invoices/lifecycle.js's overdue rule exactly rather
 * than approximating it, because the list and the banner on the invoice it
 * links to must not print two different numbers:
 *
 *   - a DRAFT is never late. It was never billed to anybody, so nobody is
 *     overdue; that is the office's own backlog.
 *   - an invoice with no dueDate is not overdue. It has no due date, which is a
 *     different statement, and it is the one that gets rendered (as nothing).
 *   - a settled invoice that actually received money is not late either — and
 *     `disputed` is excluded from that escape, because a chargeback leaves
 *     amountPaid untouched while the bank decides.
 */
export function invoiceRowState(invoice, now = new Date()) {
  const money = invoiceMoney(invoice);
  const dueDate = asDate(invoice?.dueDate);
  const isDraft = invoice?.status === "draft";

  // The same predicate lifecycle.js checks before it will say "paid in full".
  const paidOff =
    invoice?.status !== "disputed" &&
    money.settled &&
    money.paid > PAID_EPSILON;

  const daysLate =
    !paidOff && !isDraft && dueDate ? calendarDaysBetween(dueDate, now) : null;

  return {
    ...money,
    dueDate: invoice?.dueDate ?? null,
    paidOff,
    daysLate,
    overdue: daysLate !== null && daysLate > 0,
    // Not "the client owes nothing": a $0 invoice owes nothing and has never
    // been paid, and the row has to tell those apart.
    refunded: Number(invoice?.amountRefunded) || 0,
  };
}

/**
 * The tiles. `null` when the list is unknown; `money: null` when it is known
 * but priced out of view.
 *
 * @returns {{
 *   pricingHidden: boolean,
 *   money: {totalBilled: number, paidAmount: number, outstanding: number, overdueAmount: number}|null,
 *   counts: {total: number, outstanding: number, overdue: number, settled: number},
 * }|null}
 */
export function summariseInvoices(invoices, now = new Date()) {
  if (!Array.isArray(invoices)) return null;

  const pricingHidden = invoices.some((i) => i?.pricingHidden);
  const counts = { total: invoices.length, outstanding: 0, overdue: 0, settled: 0 };
  let totalBilled = 0;
  let paidAmount = 0;
  let outstanding = 0;
  let overdueAmount = 0;

  for (const invoice of invoices) {
    const row = invoiceRowState(invoice, now);
    if (row.paidOff) counts.settled += 1;
    if (row.due > PAID_EPSILON) {
      counts.outstanding += 1;
      outstanding += row.due;
      if (row.overdue) {
        counts.overdue += 1;
        overdueAmount += row.due;
      }
    }
    totalBilled += row.total;
    paidAmount += row.paid;
  }

  return {
    pricingHidden,
    counts,
    // Every figure above was summed from columns that are ABSENT when pricing
    // is hidden, so they all read 0. Returning that object would be the
    // padding-absent-data-with-defaults trap with a currency symbol on it.
    money: pricingHidden
      ? null
      : { totalBilled, paidAmount, outstanding, overdueAmount },
  };
}
