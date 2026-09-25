// lib/receipts/validate.js
//
// Does this receipt agree with itself — and if not, exactly where not?
//
// ══ Flags, never fixes ═════════════════════════════════════════════════════
//
// lib/receipts/reconcile.js already answers the two core questions — do the
// lines add up to the subtotal, does subtotal + tax make the total — and it is
// exercised by 160-odd assertions in check-purchasing. This file does not
// re-derive either. It adds the questions a BOOKKEEPING record raises that a
// material prefill never had to:
//
//   * GST + PST printed separately: do they add up to the tax line, when the
//     receipt prints both?
//   * Which single figure is "the tax" for the books?
//   * Is a gap of a cent or two rounding (per-line tax rounded at the till) or
//     a real miss (a line the camera never got)?
//
// Every answer is a FLAG shown beside the numbers. Nothing here rewrites a
// printed figure, and the person confirming can always type the right one.
//
// Pure. scripts/check-receipt-books.mjs executes it against hostile input.
import { toCents, centsToAmount } from "./money";
import { reconcileReceipt } from "./reconcile";

/**
 * How far apart two printed figures may be and still be called rounding.
 *
 * Two cents. A till that rounds tax per line and prints the sum can land a
 * cent off the tax on the subtotal, and two taxes doing it can land two. A
 * third cent is not rounding — it is a line.
 */
export const ROUNDING_CENTS = 2;

/**
 * The tax lines, summed — only when every one of them could be read.
 * Null when there are none, or when any is unreadable (a partial sum of
 * GST-without-PST is a number nobody should book).
 */
export function taxLinesCents(extracted) {
  const lines = Array.isArray(extracted?.taxLines) ? extracted.taxLines : [];
  if (!lines.length) return null;
  let sum = 0;
  for (const line of lines) {
    const c = toCents(line?.amount);
    if (c === null) return null;
    sum += c;
  }
  return sum;
}

/**
 * The tax to book, in cents, and where it came from.
 *
 *   printed  — a single tax figure was printed; it wins, because it is what
 *              the till says was charged.
 *   lines    — no single figure, but every separate tax line was readable.
 *   null     — no tax could be read. NOT zero: a receipt with no readable tax
 *              is not a tax-free purchase, and booking it as one would under-
 *              claim input tax with nothing on screen saying so.
 */
export function bookableTax(extracted) {
  const printed = toCents(extracted?.printedTax);
  if (printed !== null) return { cents: printed, source: "printed" };
  const lines = taxLinesCents(extracted);
  if (lines !== null) return { cents: lines, source: "lines" };
  return { cents: null, source: null };
}

/**
 * Every check, with the reconcile result it was built on.
 *
 * @returns {{
 *   reconciliation, flags: string[], withinRounding: boolean|null,
 *   totalCents, subtotalCents, taxCents, taxSource,
 *   taxBreakdown: [{label, cents}]|null, canSplitByLines: boolean
 * }}
 *
 * Flags (stable codes, translated on screen):
 *   no_total              the total could not be read
 *   no_items              no priced line was read
 *   unreadable_lines      at least one line's amount could not be read
 *   items_mismatch        the lines do not add up to the subtotal (or total)
 *   items_rounding        ...they are off by ROUNDING_CENTS or less
 *   totals_mismatch       subtotal + tax does not make the printed total
 *   tax_lines_mismatch    GST + PST printed separately do not make the tax line
 *   tax_line_unreadable   a separate tax line was printed but not readable
 *   no_tax                no tax figure at all could be read
 */
export function validateReceipt(extracted) {
  const reconciliation = reconcileReceipt(extracted);
  const flags = [];

  const totalCents = reconciliation.printedTotalCents;
  const subtotalCents = reconciliation.printedSubtotalCents;

  if (totalCents === null) flags.push("no_total");
  if (!reconciliation.lines.length) flags.push("no_items");
  if (reconciliation.unreadableLines > 0) flags.push("unreadable_lines");

  let withinRounding = null;
  if (reconciliation.agrees === false) {
    const gap = Math.abs(reconciliation.discrepancyCents);
    withinRounding = gap <= ROUNDING_CENTS;
    flags.push(withinRounding ? "items_rounding" : "items_mismatch");
  } else if (reconciliation.agrees === true) {
    withinRounding = true;
  }

  const tax = bookableTax(extracted);
  if (tax.cents === null) flags.push("no_tax");

  const lines = Array.isArray(extracted?.taxLines) ? extracted.taxLines : [];
  const linesSum = taxLinesCents(extracted);
  if (lines.length && linesSum === null) flags.push("tax_line_unreadable");
  const printedTax = toCents(extracted?.printedTax);
  if (printedTax !== null && linesSum !== null && Math.abs(printedTax - linesSum) > ROUNDING_CENTS) {
    flags.push("tax_lines_mismatch");
  }

  // Subtotal + the bookable tax against the total — reconcile.js only checks
  // this when a SINGLE tax figure is printed, and a GST+PST receipt with no
  // combined line is exactly the one that needs it.
  if (subtotalCents !== null && tax.cents !== null && totalCents !== null) {
    if (Math.abs(subtotalCents + tax.cents - totalCents) > ROUNDING_CENTS) flags.push("totals_mismatch");
  }

  const taxBreakdown = lines.length && linesSum !== null
    ? lines.map((l) => ({ label: l.label || "", cents: toCents(l.amount) }))
    : null;

  return {
    reconciliation,
    flags,
    withinRounding,
    totalCents,
    total: centsToAmount(totalCents),
    subtotalCents,
    taxCents: tax.cents,
    tax: centsToAmount(tax.cents),
    taxSource: tax.source,
    taxBreakdown,
    // Splitting by LINES is only honest when the lines are the purchase: all
    // readable, and adding up (to the cent, or within rounding). Otherwise a
    // split has to be by amounts the person types.
    canSplitByLines:
      reconciliation.lines.length > 1 &&
      reconciliation.unreadableLines === 0 &&
      withinRounding === true &&
      totalCents !== null,
  };
}
