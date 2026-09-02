// lib/jobs/changeOrderValue.js
//
// What a job's change orders do to the money. The ONE place that answers it.
//
// ── The bug this exists to close ───────────────────────────────────────────
//
// ChangeOrder shipped as an honest internal log: a model, a route, a form on
// the job page, a KPI. Then `priceDelta` went nowhere. Job costing computed
// `revenue: job.quote?.total` and nothing else, so the margin on every job was
// wrong by the value of every agreed change. Nothing under lib/invoices/ or
// app/api/invoices/ mentioned changeOrder at all, so agreed extra work was
// never billed — the contractor ate it. And the only consumer of the summed
// figure (buildChangeOrderRate's raw.totalPriceDelta) was read by one test
// script and nothing else.
//
// That is AGENTS.md's most emphasised failure with money attached: a control
// that appears to work, and a number that goes nowhere. Every surface that now
// touches change-order money comes through this file, so the job panel, the
// invoice and the KPI cannot arrive at three different answers.
//
// ── Absent is not zero, twice over ─────────────────────────────────────────
//
// 1. A job with NO quote has an unknown contract value, not a zero one. Adding
//    $500 of agreed changes to an unknown base gives an unknown total, so
//    `currentContractValue` stays null and the changes are reported on their
//    own. Returning 500 would state a contract value nobody ever agreed, and
//    would put a margin percentage on the job page computed against it.
//
// 2. A status this file does not recognise is NOT approved. `status` gained a
//    default only when change orders started moving money; rows written before
//    that carry no status at all, and their documented meaning (see the
//    ChangeOrder model header and docs/CALLBACKS-AND-CHANGE-ORDERS.md) was
//    "logged means already agreed with the client" — so an ABSENT status reads
//    as approved. A status that is present but unrecognised is a different
//    thing entirely: something wrote a value this code has never heard of, and
//    the money-safe reading of that is "affects nothing".

/** The closed set. Anything else present in the column affects no total. */
export const CHANGE_ORDER_STATUSES = ["pending", "approved", "rejected"];

/** What the form offers. `rejected` is only ever reached by a later decision. */
export const CHANGE_ORDER_CREATE_STATUSES = ["approved", "pending"];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * One row's status, with the legacy rule applied.
 *
 * Returns "unrecognised" for a present-but-unknown value rather than throwing
 * or coercing: the callers below all treat it as not-approved, and a summary
 * that silently dropped such a row would hide the fact that one exists.
 */
export function changeOrderStatus(co) {
  const raw = co?.status;
  if (raw === undefined || raw === null || raw === "") return "approved";
  return CHANGE_ORDER_STATUSES.includes(raw) ? raw : "unrecognised";
}

/** Only an approved change order is money. Everything else affects nothing. */
export function isApprovedChangeOrder(co) {
  return changeOrderStatus(co) === "approved";
}

/** Approved AND not yet on an invoice — the work the contractor is still owed for. */
export function isBillableChangeOrder(co) {
  return isApprovedChangeOrder(co) && !co?.invoiceId;
}

/**
 * Every figure any surface needs, from one pass over the rows.
 *
 * @param {Array} changeOrders rows shaped { priceDelta, status?, invoiceId? }
 */
export function changeOrderSummary(changeOrders = []) {
  const rows = Array.isArray(changeOrders) ? changeOrders : [];
  const counts = { approved: 0, pending: 0, rejected: 0, unrecognised: 0 };
  let approvedTotal = 0;
  let pendingTotal = 0;
  let rejectedTotal = 0;
  let billedTotal = 0;
  let unbilledTotal = 0;
  let unbilledCount = 0;

  for (const co of rows) {
    // A null or non-object entry is not a change order. Counting it would put
    // a phantom row in the "1 change order" sentence on the job page.
    if (!co || typeof co !== "object") continue;
    const status = changeOrderStatus(co);
    const delta = num(co.priceDelta);
    counts[status] += 1;
    if (status === "approved") {
      approvedTotal += delta;
      if (co.invoiceId) billedTotal += delta;
      else {
        unbilledTotal += delta;
        unbilledCount += 1;
      }
    } else if (status === "pending") pendingTotal += delta;
    else if (status === "rejected") rejectedTotal += delta;
  }

  return {
    counts,
    total: counts.approved + counts.pending + counts.rejected + counts.unrecognised,
    approvedTotal: round2(approvedTotal),
    pendingTotal: round2(pendingTotal),
    rejectedTotal: round2(rejectedTotal),
    billedTotal: round2(billedTotal),
    unbilledTotal: round2(unbilledTotal),
    unbilledCount,
  };
}

/**
 * The three numbers the job page must show SEPARATELY.
 *
 * A single blended "revenue" figure hides that the job grew — which is exactly
 * the fact a contractor looking at a margin needs. So this returns the quote,
 * the changes and the sum, and the panel renders all three.
 *
 * @param {number|string|null} quotedTotal Quote.total, or null when the job
 *   has no quote behind it at all.
 * @param {Array} changeOrders
 */
export function contractValue({ quotedTotal = null, changeOrders = [] } = {}) {
  const summary = changeOrderSummary(changeOrders);
  // `null` and `undefined` mean "no quote". A quote genuinely totalling zero
  // is a real statement and stays one — Number("") would turn an empty string
  // into that same zero, which is why the test is on the value, not on num().
  const known =
    quotedTotal !== null &&
    quotedTotal !== undefined &&
    quotedTotal !== "" &&
    Number.isFinite(Number(quotedTotal));
  const quoted = known ? round2(Number(quotedTotal)) : null;

  return {
    quotedTotal: quoted,
    quotedTotalKnown: known,
    approvedChanges: summary.approvedTotal,
    // Unknown plus something is still unknown. See the file header.
    currentContractValue: known ? round2(quoted + summary.approvedTotal) : null,
    summary,
  };
}

/**
 * How far a job's frozen payment schedule now falls short of its contract.
 *
 * JobPaymentStage.amountCents is deliberately NOT recomputed here — see the
 * column's own comment and docs/CALLBACKS-AND-CHANGE-ORDERS.md. The stages are
 * percentages of the total the client accepted, some of them already emailed
 * as pay links; re-deriving them against a bigger base would change a deposit
 * the client has already been asked for, and would leave the set no longer
 * summing to anything (a `requested` stage frozen at the old base beside
 * `pending` ones at the new one). So the schedule keeps its numbers and the
 * change orders are collected on the invoice balance instead — and this
 * function exists so the screen can SAY that rather than leave a contractor to
 * notice the stages no longer add up to what they are owed.
 *
 * Returns cents, matching JobPaymentStage.amountCents.
 */
export function paymentScheduleShortfall({ stages = [], changeOrders = [] } = {}) {
  const rows = Array.isArray(stages) ? stages : [];
  const stagedCents = rows.reduce(
    (sum, s) => sum + Math.round(num(s?.amountCents)),
    0,
  );
  const approvedChangeCents = Math.round(
    changeOrderSummary(changeOrders).approvedTotal * 100,
  );
  return {
    stagedCents,
    approvedChangeCents,
    // Only a real statement when there IS a schedule. A job with no stages has
    // no shortfall to report, and saying "the schedule is short" about a
    // schedule that does not exist is noise.
    applies: rows.length > 0 && approvedChangeCents !== 0,
  };
}

/**
 * The invoice line items for a set of change orders, and the money they add.
 *
 * Pure so it can be executed against hostile input; the route does the writing.
 * Each line carries `changeOrderId` so the invoice can say where the line came
 * from and so a second click cannot bill the same change order twice.
 *
 * ── Tax is read OFF the invoice, never re-resolved ───────────────────────
 *
 * Invoice has no rate column — `tax` is an absolute amount. The rate this
 * document already charged is therefore `tax / (subtotal - discount)`, and
 * applying that same rate to the added work is the only answer that does not
 * invent a jurisdiction: the effective rate on the invoice is identical before
 * and after. Re-resolving through lib/tax/documentTax.js would risk charging a
 * DIFFERENT rate from the one on the client's own document, on the same page.
 *
 * Refuses when the rate cannot be read: tax is owed but there is no positive
 * base to have charged it on. That is a degenerate invoice, and guessing a
 * rate for it would move real money on a guess.
 *
 * @returns {{ ok: boolean, reason?: string, lineItems: Array,
 *   subtotal: number, tax: number, total: number, added: number,
 *   effectiveTaxRate: number|null }}
 */
export function billChangeOrders({ invoice, changeOrders = [] } = {}) {
  const refuse = (reason) => ({ ok: false, reason, lineItems: [], added: 0 });

  if (!invoice || typeof invoice !== "object") return refuse("no_invoice");

  const billable = (Array.isArray(changeOrders) ? changeOrders : []).filter(
    (co) => co && typeof co === "object" && isBillableChangeOrder(co),
  );
  if (billable.length === 0) return refuse("nothing_to_bill");

  const subtotal = num(invoice.subtotal);
  const discount = num(invoice.discount);
  const tax = num(invoice.tax);
  const base = round2(subtotal - discount);
  const taxEnabled = invoice.taxEnabled !== false;

  let rate = 0;
  if (taxEnabled && tax !== 0) {
    if (base <= 0) return refuse("tax_rate_underivable");
    rate = tax / base;
  }

  const existing = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  // Belt and braces against a double click racing itself: a change order
  // already named on the document is not added again even if its invoiceId
  // link is somehow missing.
  const alreadyOn = new Set(
    existing
      .filter((li) => li && typeof li === "object" && li.changeOrderId)
      .map((li) => String(li.changeOrderId)),
  );
  const toBill = billable.filter((co) => !alreadyOn.has(String(co.id)));
  if (toBill.length === 0) return refuse("already_on_invoice");

  const lineItems = toBill.map((co) => ({
    description: String(co.description ?? "").trim() || "Change order",
    quantity: 1,
    amount: round2(num(co.priceDelta)),
    // Provenance, and the double-add guard above. Extra keys survive
    // lib/invoices/documentGroups.js's spread, and these lines carry no scope
    // group prefix so they land in the ungrouped bucket — correct, because
    // they were never part of the quote's scope.
    changeOrderId: co.id,
  }));

  const added = round2(lineItems.reduce((s, li) => s + li.amount, 0));
  const newSubtotal = round2(subtotal + added);
  const newTax = round2(rate * round2(newSubtotal - discount));

  return {
    ok: true,
    lineItems: [...existing, ...lineItems],
    newLineItems: lineItems,
    changeOrderIds: toBill.map((co) => co.id),
    subtotal: newSubtotal,
    tax: newTax,
    total: round2(newSubtotal - discount + newTax),
    added,
    effectiveTaxRate: taxEnabled && tax !== 0 ? rate : 0,
  };
}
