// lib/costing/jobRevenue.js
//
// "What is this job worth to us?" — the ONE answer, for every surface.
//
// ══ The two faults this closes ═════════════════════════════════════════════
//
// A contractor looked at a job whose quote said $5,717.13 and whose invoice —
// the one he actually sent — said $4,972.50, and the job's cost panel kept
// quoting him the first number. Two separate bugs were behind that single
// symptom.
//
// 1. THE JOB'S REVENUE NEVER LOOKED AT THE INVOICE. The costing route built
//    revenue from `Quote.total` plus approved change orders and nothing else.
//    The invoice is the document that says what was actually billed; amend it
//    — drop a line, waive the tax, discount it after a complaint — and the job
//    page went on reporting the quote. Meanwhile the dashboard's margin roll-up
//    had ALWAYS read invoices. Two modules, one question, two rules: the same
//    drift that once had the marketing dashboard counting a visit the lead page
//    said never happened. This file is the single rule both now call.
//
// 2. SALES TAX WAS BEING COUNTED AS REVENUE. `Quote.total` and `Invoice.total`
//    are both `subtotal − discount + tax`. GST/QST/VAT is collected FOR a
//    government and remitted to it; it never belonged to the contractor, and
//    counting it inflated the profit on this screen by the whole tax line —
//    $744.63 on that one job, and proportionally on every taxed job in the
//    product. So revenue here is NET: `subtotal − discount`.
//
//    Net is not a new convention invented here. billChangeOrders() already
//    treats `subtotal − discount` as the base and `priceDelta` as a pre-tax
//    amount; this file uses the same basis so a change order and the document
//    it is added to are measured in the same units.
//
// On that job the two corrections meet: the quote's NET (5850 − 877.50) and
// the amended invoice's TOTAL are both $4,972.50. Either way round the answer
// is the figure he sent. That coincidence is the worked example in
// scripts/check-job-revenue.mjs.
//
// ══ Absence stays absence ══════════════════════════════════════════════════
//
// No quote and no issued invoice means the revenue is UNKNOWN, and `revenue`
// is null — never 0. contractValue()'s header already argues this ("unknown
// plus $500 is still unknown") and the reasoning carries over unchanged: a
// zero here would draw a margin percentage against a figure nobody agreed. A
// quote that genuinely totals zero is a statement, and stays a real zero.
//
// ══ What this is NOT ═══════════════════════════════════════════════════════
//
// Not cash. "Revenue this month" on the dashboard is money RECEIVED (paid
// invoices, summed on `total`) and legitimately includes the tax that was
// collected with it — a bank deposit is a bank deposit. That is a different
// question and it is deliberately left alone.

import { latestPerFamily } from "@/lib/invoices/family";
import { changeOrderSummary, isApprovedChangeOrder } from "@/lib/jobs/changeOrderValue";

/**
 * Statuses that are not revenue.
 *
 * `draft` only — and that is the whole list on purpose. InvoiceStatus is
 * draft · sent · paid · overdue · refunded · partially_refunded · disputed;
 * everything but the first is a document that left the building, so it states
 * what was billed even when the money is late, disputed or came back. The
 * same predicate app/api/analytics/kpis/route.js already queried with, named
 * here so the two cannot drift apart again.
 */
export const NON_REVENUE_INVOICE_STATUSES = ["draft"];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * A document's value to the contractor: `subtotal − discount`, never `total`.
 *
 * Null — not zero — when there is no readable subtotal, because "there is no
 * document" and "the document is worth nothing" are different facts and a
 * zero would let the caller draw a margin against the wrong one. `discount`
 * is NOT NULL with a default in the schema, so a missing one really is no
 * discount rather than an absent statement.
 */
export function documentNet(doc) {
  if (!doc || typeof doc !== "object") return null;
  const sub = doc.subtotal;
  if (sub === null || sub === undefined || sub === "" || !Number.isFinite(Number(sub))) return null;
  return round2(Number(sub) - num(doc.discount));
}

/**
 * What the document SAYS it is worth: `total`, i.e. net plus tax.
 *
 * Read only so the panel can name the gap it is leaving out — "$744.63 of
 * that is sales tax" is a sentence a contractor can check against his own
 * invoice, where "figures exclude tax" is a claim he has to take on faith.
 * Never used as revenue. Null when the row carries no readable total, for the
 * same reason documentNet is.
 */
export function documentGross(doc) {
  if (!doc || typeof doc !== "object") return null;
  const t = doc.total;
  if (t === null || t === undefined || t === "" || !Number.isFinite(Number(t))) return null;
  return round2(Number(t));
}

/**
 * What this job is worth, and which document said so.
 *
 * @param {object|null} quote  the job's quote: `{ subtotal, discount }`. Null
 *   when the job has none.
 * @param {Array} invoices  EVERY invoice row billing this job, all versions —
 *   `{ id, parentInvoiceId, version, status, subtotal, discount }`. Versions
 *   are collapsed here (see below); handing in only the roots, or only the
 *   latest, would work but hides the collapsing from the one place that can
 *   check it.
 * @param {Array} changeOrders  `{ priceDelta, status?, invoiceId? }`.
 *
 * @returns {{
 *   basis: "invoiced"|"quoted"|null,
 *   revenue: number|null,
 *   base: number|null,
 *   basisGross: number|null,
 *   taxExcluded: number|null,
 *   invoicedNet: number|null,
 *   quotedNet: number|null,
 *   invoiceCount: number,
 *   unbilledChanges: number,
 *   invoiceIds: string[],
 *   summary: object,
 * }}
 */
export function jobRevenue({ quote = null, invoices = [], changeOrders = [] } = {}) {
  // ── Why drafts are dropped BEFORE versions are collapsed ────────────────
  //
  // An invoice amended but not re-sent is v1 sent + v2 draft. Collapsing
  // first would pick v2, find it a draft, and report the job as never billed
  // — losing the document the client is holding. Filtering first keeps v1,
  // which is exactly what was billed. The ordinary pipeline also mints a
  // DRAFT invoice the moment a quote is accepted, so "draft only" has to mean
  // "nothing billed yet" and fall through to the quote below; a draft that
  // counted would make every accepted job read as invoiced.
  const issued = (Array.isArray(invoices) ? invoices : []).filter(
    (r) =>
      r &&
      typeof r === "object" &&
      !NON_REVENUE_INVOICE_STATUSES.includes(r.status) &&
      documentNet(r) !== null,
  );

  // The LATEST version of each family, never the sum of all versions. v1 and
  // v2 are one document seen twice; adding them bills the client's single
  // invoice to ourselves twice, and that trap is live on real data — the job
  // that prompted this file has exactly a v1 and a v2.
  const counted = latestPerFamily(issued);
  const invoicedNet = counted.length
    ? round2(counted.reduce((s, r) => s + documentNet(r), 0))
    : null;

  const quotedNet = documentNet(quote);

  // Invoiced beats quoted whenever anything was issued: the invoice is the
  // later statement and the one the client was actually asked to pay.
  const basis = invoicedNet !== null ? "invoiced" : quotedNet !== null ? "quoted" : null;
  const base = basis === "invoiced" ? invoicedNet : basis === "quoted" ? quotedNet : null;

  const coRows = (Array.isArray(changeOrders) ? changeOrders : []).filter(
    (c) => c && typeof c === "object",
  );

  // ── Which approved changes are NOT already inside `base` ────────────────
  //
  // A change order billed onto one of the invoices above is inside that
  // invoice's subtotal (billChangeOrders adds the line AND raises subtotal),
  // so adding it again double-counts. One the client paid on approval gets an
  // invoice of its own carrying neither jobId nor quoteId
  // (lib/invoices/jobLink.js), which the job's invoice set will not contain —
  // so it is added, because nothing in `base` knows about it.
  //
  // ChangeOrder.invoiceId is ALWAYS the family root (see the column's own
  // comment: pointing at a version would dangle at the next amendment), which
  // is why this compares against root ids and not against the ids of the rows
  // that happened to be counted.
  //
  // On the quoted basis the set is empty, so every approved change is added —
  // correct, because a quote never contained any of them.
  const countedRootIds = new Set(counted.map((r) => String(r.parentInvoiceId || r.id)));
  let unbilled = 0;
  for (const co of coRows) {
    // isApprovedChangeOrder, not a status test written out again: it carries
    // the legacy "absent status means agreed" rule and the "present but
    // unrecognised affects nothing" rule, and a second copy of either here
    // would be the copy that rots.
    if (!isApprovedChangeOrder(co)) continue;
    if (co.invoiceId && countedRootIds.has(String(co.invoiceId))) continue;
    unbilled += num(co.priceDelta);
  }
  const unbilledChanges = round2(unbilled);

  // How much tax the net rule left out of `base`. Null — not zero — when any
  // of the basis documents carries no readable total: "no tax" and "we cannot
  // say" are different, and a zero would have the panel assert the first.
  const basisDocs = basis === "invoiced" ? counted : basis === "quoted" ? [quote] : [];
  const grosses = basisDocs.map(documentGross);
  const basisGross =
    basis === null || grosses.some((g) => g === null)
      ? null
      : round2(grosses.reduce((s2, g) => s2 + g, 0));

  return {
    basis,
    // Unknown plus agreed changes is still unknown — see the file header.
    revenue: base === null ? null : round2(base + unbilledChanges),
    base,
    basisGross,
    taxExcluded: basisGross === null || base === null ? null : round2(basisGross - base),
    invoicedNet,
    quotedNet,
    unbilledChanges,
    invoiceCount: counted.length,
    invoiceIds: counted.map((r) => r.id).filter(Boolean),
    summary: changeOrderSummary(coRows),
  };
}
