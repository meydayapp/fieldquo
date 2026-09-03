// lib/receipts/reconcile.js
//
// Do the line items add up to the printed total?
//
// ══ The discrepancy is INFORMATION, not an error ═══════════════════════════
//
// This is the one decision that separates this from the project it was ported
// from. When the items do not sum to the printed total, the honest answers are
// all of the form "here is what each of them says" — and NONE of them is
// "quietly use whichever number looks better".
//
// The reasons a real till receipt fails to add up are ordinary and each one
// matters to a contractor:
//
//   - a deposit or a core charge printed as a line with no price
//   - a discount applied at the till and not itemised
//   - a bag fee, an environmental levy, a delivery charge
//   - a line the camera never got — the fold in the paper
//   - tax printed per line AND as a total, so items already include it
//
// Every one of those is something a person should look at. Papering over it by
// rewriting the total, or by dropping the items, destroys the only signal that
// there was anything to look at.
//
// ══ What is computed, and by whom ══════════════════════════════════════════
//
// The model transcribes strings. THIS FILE does every sum. Nothing below asks
// a model anything, and nothing below rewrites a printed figure — the printed
// total that comes out is byte-identical to the one that went in.
//
// Pure. scripts/check-purchasing.mjs executes it.
import { toCents, centsToAmount } from "./money";

/**
 * One extracted line, with its printed strings kept alongside the cents.
 *
 * `lineTotalCents` is null when the printed text could not be read — the line
 * still exists, because a line item nobody could price is still evidence that
 * something was bought.
 */
function readLine(item, index) {
  const lineTotalCents = toCents(item?.lineTotal);
  return {
    index,
    description: String(item?.description || "").trim(),
    quantityText: String(item?.quantity || "").trim(),
    unitPriceText: String(item?.unitPrice || "").trim(),
    lineTotalText: String(item?.lineTotal || "").trim(),
    lineTotalCents,
    readable: lineTotalCents !== null,
  };
}

/**
 * Reconcile an extracted receipt against itself.
 *
 * ── What the items are compared AGAINST ──────────────────────────────────
 *
 * The SUBTOTAL when one is printed, and the total only when one is not.
 *
 * This is not a detail. On almost every till receipt the line items sum to the
 * pre-tax subtotal, and comparing them to the total would report a mismatch of
 * exactly the tax on every receipt in the country — which is the fastest way
 * to turn a real signal into a banner everybody learns to ignore. The tax line
 * gets its own, separate check: subtotal + tax against the printed total.
 *
 * This was found by running the check script against the canned demo receipt,
 * not by reading the code.
 *
 * @param extracted  the schema-validated object from lib/receipts/extract.js
 *
 * `agrees` and `printedTotalsAgree` are both THREE-VALUED:
 *   true   the two sides match exactly
 *   false  they do not — the gap is in discrepancyCents
 *   null   one side could not be read, so there is nothing to compare and
 *          claiming a mismatch would be inventing one
 */
export function reconcileReceipt(extracted) {
  const items = Array.isArray(extracted?.items) ? extracted.items : [];
  const lines = items.map(readLine);

  const unreadableLines = lines.filter((l) => !l.readable).length;

  // Summed in integer cents, one addition at a time. No floats anywhere on
  // this path — see lib/receipts/money.js.
  let itemsTotalCents = 0;
  for (const line of lines) {
    if (!line.readable) {
      itemsTotalCents = null;
      break;
    }
    itemsTotalCents += line.lineTotalCents;
  }
  if (!lines.length) itemsTotalCents = null;

  const printedTotalCents = toCents(extracted?.printedTotal);
  const printedSubtotalCents = toCents(extracted?.printedSubtotal);
  const printedTaxCents = toCents(extracted?.printedTax);

  // The subtotal when the paper prints one; the total otherwise. Named in the
  // result so the screen can say which figure it compared against rather than
  // leaving a person to guess why the numbers on it differ.
  const comparedTo = printedSubtotalCents !== null ? "subtotal" : "total";
  const comparedToCents = printedSubtotalCents !== null ? printedSubtotalCents : printedTotalCents;

  let agrees = null;
  let discrepancyCents = null;
  if (itemsTotalCents !== null && comparedToCents !== null) {
    discrepancyCents = itemsTotalCents - comparedToCents;
    agrees = discrepancyCents === 0;
  }

  // The second, independent question: does the paper agree with itself?
  // Subtotal plus tax should be the total. When it does not, that is worth
  // saying — and it is a different fact from the items not summing, so it gets
  // its own field rather than being folded into one "something is wrong".
  let printedTotalsAgree = null;
  if (printedSubtotalCents !== null && printedTaxCents !== null && printedTotalCents !== null) {
    printedTotalsAgree = printedSubtotalCents + printedTaxCents === printedTotalCents;
  }

  return {
    lines,
    unreadableLines,
    itemsTotalCents,
    itemsTotal: centsToAmount(itemsTotalCents),
    // Untouched. Whatever the paper said is what comes out.
    printedTotalCents,
    printedTotal: centsToAmount(printedTotalCents),
    printedSubtotalCents,
    printedSubtotal: centsToAmount(printedSubtotalCents),
    printedTaxCents,
    printedTax: centsToAmount(printedTaxCents),
    comparedTo,
    comparedToCents,
    discrepancyCents,
    discrepancy: centsToAmount(discrepancyCents),
    agrees,
    printedTotalsAgree,
    verdict: verdictFor({
      agrees,
      itemsTotalCents,
      comparedToCents,
      printedTotalCents,
      unreadableLines,
      lineCount: lines.length,
    }),
  };
}

/**
 * The sentence shown beside the numbers.
 *
 * A key rather than a sentence, because the screen is translated (en + fr) and
 * this module has no `t`. Same split lib/loadState.js already uses.
 */
export function verdictFor({
  agrees,
  itemsTotalCents,
  comparedToCents,
  printedTotalCents,
  unreadableLines,
  lineCount,
}) {
  if (printedTotalCents === null) return "noPrintedTotal";
  if (!lineCount) return "noItems";
  if (unreadableLines > 0) return "someLinesUnreadable";
  if (itemsTotalCents === null) return "someLinesUnreadable";
  if (comparedToCents === null) return "noPrintedTotal";
  if (agrees === true) return "agrees";
  return "mismatch";
}

/**
 * WHICH figure should be offered as the cost, when one is offered at all.
 *
 * The printed total, always — never the computed sum. The paper is the record
 * of what was paid; the sum of the lines is our reading of it, and where the
 * two disagree the paper wins and the person is told they disagree.
 *
 * Returns null on a mismatch, deliberately. A figure nobody can reconcile is
 * exactly the figure that should not be poured into a job's costing with one
 * tap — the person has the numbers in front of them and can type the right one.
 */
export function suggestedCostCents(reconciled) {
  if (!reconciled) return null;
  if (reconciled.agrees === false) return null;
  // The paper disagreeing with ITSELF — subtotal plus tax not equalling the
  // printed total — is the same kind of unresolved question, and for the same
  // reason it does not get a one-tap answer.
  if (reconciled.printedTotalsAgree === false) return null;
  return reconciled.printedTotalCents;
}
