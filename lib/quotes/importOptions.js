// lib/quotes/importOptions.js
//
// A subcontractor's quote brought into the GC's quote, AFTER the decisions the
// owner described on 2026-10-05:
//
//   "If the subcontractor sends a quote, the contractor should be able to
//    select the one they want to work with, add it to their quote, and it
//    would be pending until their client approves it."
//
// Three things that sentence needs, all decided here and nowhere else:
//
//   1. WHERE an imported price stands — on the quote as a line, held as an
//      option to compare, or carried by a change order to a client who has
//      already signed (importPlacement). "On a change order" is derived from
//      the change order, never stored on the import, so a client declining it
//      turns the import back into an unused option on its own.
//
//   2. THE COMPARISON — several subs quoting the same trade, side by side:
//      who, their price, the GC's markup, the client price, and whether the
//      sub's insurance and WSIB/WCB clearance are current
//      (compareImportOptions). Only the one the GC uses reaches the client.
//
//   3. WHAT THE CLIENT SEES — a change order whose price is the snapshot ×
//      (1 + markup), worked out here from stored rows, never a figure a
//      browser sent (changeOrderDraftFromImport, AGENTS.md #5); the quote's
//      addendum of approved and pending changes (quoteChangeOrderAddendum);
//      and whether "Pay $X now" can honestly be offered after approval
//      (payNowState, changeOrderInvoiceDraft).
//
// White-label, one layer up: the homeowner never learns there is a sub. No
// function here that builds something a client reads takes the sub's name
// as anything but a word to REMOVE (scrubCompanyName).
//
// Pure — no database, no request — so scripts/check-sub-change-orders.mjs runs
// every branch against hostile input.

import { clientPrice } from "@/lib/quotes/importedStatus";
import {
  changeOrderStatus,
  changeOrderSummary,
  isBillableChangeOrder,
  changeOrderInvoiceLine,
} from "@/lib/jobs/changeOrderValue";
import {
  changeOrderLabel,
  quoteTaxRate,
  sanitiseChangeOrderBody,
} from "@/lib/jobs/changeOrderAddendum";
import { subcontractorExpiries } from "@/lib/subcontractors/expiry";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;

/** The two values QuoteImport.placement holds. See the schema comment. */
export const IMPORT_PLACEMENTS = Object.freeze(["line", "option"]);

/**
 * QuoteImport.targetLineId for a row that has no line. The column is NOT NULL
 * and predates options; every reader asks `placement` first.
 */
export const NO_LINE = "";

/** The label performImport falls back to — also the comparison key for "no label". */
export const DEFAULT_IMPORT_LABEL = "Subcontracted work";

// A change order that still stands: out for signature, not yet sent, or
// agreed. A rejected (declined / withdrawn) one carries nothing any more, and
// an unrecognised status carries nothing either — the money-safe reading
// changeOrderValue.js already gives it.
const LIVE = new Set(["pending", "waiting_client", "approved"]);

export function isLiveChangeOrder(co) {
  return Boolean(co && typeof co === "object") && LIVE.has(changeOrderStatus(co));
}

/** The live change order carrying this import, newest first, or null. */
export function carryingChangeOrder(imp, changeOrders = []) {
  const id = imp?.id;
  if (!id) return null;
  const rows = (Array.isArray(changeOrders) ? changeOrders : []).filter(
    (co) => co && typeof co === "object" && co.quoteImportId === id && isLiveChangeOrder(co),
  );
  rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return rows[0] || null;
}

/**
 * Where an import stands.
 *
 *   line          a scope group on the quote — on the client's document.
 *   change_order  carried by a live change order (pending, out for
 *                 signature, or approved).
 *   option        on no client document.
 *
 * An ABSENT placement is "line": that is what every row written before the
 * column existed was, and the column's default says the same. A PRESENT but
 * unrecognised value is an option — the reading that puts nothing in front of
 * a client and moves no money.
 */
export function importPlacement(imp, changeOrders = []) {
  if (!imp || typeof imp !== "object") return { kind: "option", changeOrder: null };
  const raw = imp.placement;
  const stored = raw === undefined || raw === null || raw === "" ? "line" : raw;
  if (stored === "line") return { kind: "line", changeOrder: null };
  const co = carryingChangeOrder(imp, changeOrders);
  if (co) return { kind: "change_order", changeOrder: co };
  return { kind: "option", changeOrder: null };
}

/**
 * Which imports compete with each other: the same trade label, compared
 * without case or stray spaces. No label is the default label, so two
 * unlabelled bids are compared with each other rather than with nothing.
 */
export function comparisonKey(label) {
  const s = String(label ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return s || DEFAULT_IMPORT_LABEL.toLowerCase();
}

/**
 * The sub's paperwork for the comparison. `sub` is the GC's own roster row
 * linked to the sub's company, or null when the GC has never put them on the
 * roster — which is "not recorded", never "expired" (lib/subcontractors/
 * expiry.js's one rule).
 */
export function credentialSummary(sub, { asOf } = {}) {
  if (!sub || typeof sub !== "object") {
    return {
      onRoster: false,
      subcontractorId: null,
      insurance: { state: "unknown", endsAt: null },
      clearance: { state: "unknown", endsAt: null },
    };
  }
  const byKind = Object.fromEntries(
    subcontractorExpiries(sub, { asOf }).map((e) => [e.kind, { state: e.state, endsAt: e.endsAt ?? null }]),
  );
  return {
    onRoster: true,
    subcontractorId: sub.id ?? null,
    insurance: byKind.insurance || { state: "unknown", endsAt: null },
    clearance: byKind.clearance || { state: "unknown", endsAt: null },
  };
}

/**
 * The GC's side-by-side view: imports grouped by trade, each with the sub,
 * the cost, the markup, the client price, where it stands and the sub's
 * paperwork. Cheapest cost first within a trade.
 *
 * This is the IMPORTER's view (cost and markup included) — never serialised
 * toward a client or toward the sub. The route decides who may read it.
 *
 * @param imports        QuoteImport rows with sourceCompany { name }
 * @param changeOrders   the job's change orders (id, seq, createdAt, status,
 *                       quoteImportId) — empty for a quote with no job
 * @param subsByCompanyId the GC's roster rows keyed by linkedCompanyId
 * @param subsById       the GC's roster rows keyed by id — for an import that
 *                       names its roster row (QuoteImport.subcontractorId, a
 *                       price that came through a price request). That row
 *                       wins: a no-account reply has no company to match on,
 *                       and a linked sub's request names exactly who was asked.
 */
export function compareImportOptions({ imports = [], changeOrders = [], subsByCompanyId = {}, subsById = {}, asOf } = {}) {
  const groups = new Map();
  for (const imp of Array.isArray(imports) ? imports : []) {
    if (!imp || typeof imp !== "object" || !imp.id) continue;
    const key = comparisonKey(imp.label);
    const where = importPlacement(imp, changeOrders);
    const co = where.changeOrder;
    const named = imp.subcontractorId ? subsById?.[imp.subcontractorId] || null : null;
    const rosterRow = named || (imp.sourceCompanyId ? subsByCompanyId?.[imp.sourceCompanyId] || null : null);
    const option = {
      id: imp.id,
      label: imp.label ?? null,
      // The GC's own screen: the sub's company name, else (a no-account
      // reply) the name the GC gave them on the roster.
      sourceCompanyName: imp.sourceCompany?.name ?? named?.name ?? null,
      // How the price arrived: their FieldQuo quote, a figure they typed
      // into a price request's reply form, or a PDF or photo the GC uploaded
      // and confirmed (uploadedSource — lib/quotes/subQuoteUpload.js). The
      // last two have no source quote behind them; each says which.
      viaReply: !imp.sourceQuoteId && !imp.uploadedSource,
      viaUpload: !imp.sourceQuoteId && Boolean(imp.uploadedSource),
      costAmount: round2(imp.snapshotAmount),
      markupPercent: num(imp.markupPercent),
      clientPrice: clientPrice(imp.snapshotAmount, imp.markupPercent),
      placement: where.kind,
      changeOrder: co
        ? { id: co.id, label: changeOrderLabel(co, changeOrders), status: changeOrderStatus(co) }
        : null,
      credentials: credentialSummary(rosterRow, { asOf }),
      createdAt: imp.createdAt ?? null,
    };
    if (!groups.has(key)) groups.set(key, { key, label: imp.label || DEFAULT_IMPORT_LABEL, options: [] });
    groups.get(key).options.push(option);
  }
  return [...groups.values()].map((g) => {
    g.options.sort((a, b) => a.costAmount - b.costAmount || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const chosen = g.options.find((o) => o.placement !== "option") || null;
    return { ...g, chosenId: chosen ? chosen.id : null, competing: g.options.length > 1 };
  });
}

// ── What the client reads ───────────────────────────────────────────────────

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove the sub's company name from text a client will read. A sub's own
 * line descriptions sometimes carry it ("Sparky Electric — panel upgrade"),
 * and an itemised import copies those descriptions onto the GC's document.
 * Names shorter than three characters are left alone: removing "AB" from
 * every word containing it would mangle the sentence more than it protects.
 */
export function scrubCompanyName(text, name) {
  const s = String(text ?? "");
  const n = String(name ?? "").trim();
  if (n.length < 3) return s.trim();
  return s
    .replace(new RegExp(escapeRegExp(n), "gi"), "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–—:·,|]+|[\s\-–—:·,|]+$/g, "")
    .trim();
}

/** The sub's line descriptions, from their quote's scope groups or flat lines. */
export function sourceLineDescriptions(sourceQuote) {
  const groups = Array.isArray(sourceQuote?.scopeGroups) ? sourceQuote.scopeGroups : [];
  let lines = [];
  for (const g of groups) if (Array.isArray(g?.lineItems)) lines.push(...g.lineItems);
  if (!lines.length && Array.isArray(sourceQuote?.lineItems)) lines = sourceQuote.lineItems;
  return lines
    .filter((li) => li && typeof li === "object")
    .map((li) => String(li.description ?? "").trim())
    .filter(Boolean);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The change order a sub's import becomes when the client has already
 * signed the quote. Everything a client will read, and the price:
 *
 *   priceDelta   snapshot × (1 + markup), from the STORED import row. The
 *                only inputs are the row's own columns — no parameter here
 *                can carry a browser's figure.
 *   description  the trade label (the same words the quote line would have
 *                carried), with the sub's name scrubbed out.
 *   bodyHtml     for an "itemised" import, the sub's work items as a list —
 *                descriptions only, never their prices — through the same
 *                sanitiser every change-order body goes through. Null for a
 *                blended one.
 *
 * Returns null for an import with nothing to charge.
 */
export function changeOrderDraftFromImport({ imp, sourceQuote = null, sourceCompanyName = null } = {}) {
  if (!imp || typeof imp !== "object") return null;
  const priceDelta = clientPrice(imp.snapshotAmount, imp.markupPercent);
  if (!(priceDelta > 0)) return null;
  const name = sourceCompanyName ?? imp.sourceCompany?.name ?? null;
  const label = scrubCompanyName(imp.label, name) || DEFAULT_IMPORT_LABEL;
  let bodyHtml = null;
  if (imp.display === "itemized" && sourceQuote) {
    const items = sourceLineDescriptions(sourceQuote)
      .map((d) => scrubCompanyName(d, name))
      .filter(Boolean)
      .slice(0, 60);
    if (items.length) {
      bodyHtml = sanitiseChangeOrderBody(`<ul>${items.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`) || null;
    }
  }
  return {
    description: label.slice(0, 300),
    priceDelta,
    bodyHtml,
    quoteImportId: imp.id ?? null,
  };
}

/**
 * The change orders a client sees beside the quote they signed — on the
 * quote page and the PDF. An allow-list: label, title, price, and whether it
 * is approved or waiting for them. Never the import, the invoice, the staff
 * member or the body.
 *
 *   approved        part of the contract; counted in `newTotal`.
 *   waiting_client  sent to them and unsigned — shown, marked pending, with
 *                   its own review link; NOT in `newTotal`.
 *   pending (unsent), rejected, unrecognised — not shown. An unsent change
 *                   order is the office's draft, and a declined one changes
 *                   nothing on the client's job.
 *
 * `newTotal` is the quote as approved plus the approved changes with tax at
 * the quote's own rate — the same arithmetic the /co addendum prints
 * (addendumMoney), so the two pages agree to the cent. When the rate cannot
 * be read off the quote, changes are added before tax and `taxKnown` says so.
 *
 * Returns null when there is nothing to show.
 */
export function quoteChangeOrderAddendum({ quote = null, changeOrders = [] } = {}) {
  const all = (Array.isArray(changeOrders) ? changeOrders : []).filter((co) => co && typeof co === "object");
  const shown = all
    .filter((co) => {
      const s = changeOrderStatus(co);
      return s === "approved" || s === "waiting_client";
    })
    .sort((a, b) => {
      const sa = Number.isInteger(a.seq) ? a.seq : Infinity;
      const sb = Number.isInteger(b.seq) ? b.seq : Infinity;
      return sa - sb || new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });
  if (!shown.length) return null;

  const rows = shown.map((co) => {
    const approved = changeOrderStatus(co) === "approved";
    return {
      label: changeOrderLabel(co, all),
      description: String(co.description ?? ""),
      priceDelta: round2(co.priceDelta),
      status: approved ? "approved" : "pending",
      decidedAt: approved ? co.decidedAt || co.signature?.signedAt || null : null,
      // Only an out-for-signature change carries its link — it is the
      // client's own credential for that addendum, already in their texts.
      reviewToken: !approved && typeof co.shareToken === "string" && co.shareToken ? co.shareToken : null,
    };
  });

  const approvedTotal = changeOrderSummary(all).approvedTotal;
  const pendingTotal = round2(rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.priceDelta, 0));
  const rate = quote ? quoteTaxRate(quote) : null;
  const quoteTotal = quote ? round2(quote.acceptedTotal ?? quote.total) : null;
  const newTotal = quoteTotal === null ? null : round2(quoteTotal + approvedTotal * (1 + (rate || 0)));
  return {
    rows,
    quoteTotal,
    approvedTotal,
    pendingTotal,
    newTotal,
    taxKnown: rate !== null,
  };
}

// ── Pay after approving ─────────────────────────────────────────────────────

/** Every line on the invoice belongs to this one change order. */
export function isOwnChangeOrderInvoice(invoice, changeOrderId) {
  const lines = Array.isArray(invoice?.lineItems) ? invoice.lineItems : [];
  return Boolean(changeOrderId) && lines.length > 0 && lines.every((li) => li && li.changeOrderId === changeOrderId);
}

/** The company can take a card online — the portal's own rule (app/api/portal/[token]). */
export function takesOnlinePayments(company) {
  if (!company || typeof company !== "object") return false;
  return Boolean(company.isDemo) || Boolean(company.stripeAccountId && company.stripeChargesEnabled);
}

/**
 * Whether the approval page may offer "Pay $X now", and for how much.
 *
 *   approved, unbilled            → offer the change with tax (the addendum's
 *                                    own `changeWithTax`, so the button and
 *                                    the signed page say the same number).
 *   billed on its OWN invoice     → offer that invoice's balance; nothing
 *                                    when it is paid.
 *   billed onto a shared invoice  → no amount of ours to state: the page
 *                                    names the invoice instead (`on_invoice`).
 *   anything else                 → no offer, with the reason.
 *
 * A credit (negative change) is never "paid now". A change whose tax cannot
 * be read off the quote is not offered either — charging it would mean
 * guessing a rate.
 *
 * @param money   addendumMoney() output for this change order, or null
 * @param invoice the invoice it was billed on (id, invoiceNumber, status,
 *                sentAt, total, amountPaid, lineItems), when billed
 */
export function payNowState({ changeOrder, company, invoice = null, money = null } = {}) {
  if (!changeOrder || typeof changeOrder !== "object") return { offer: false, reason: "not_found" };
  if (changeOrderStatus(changeOrder) !== "approved") return { offer: false, reason: "not_approved" };
  if (!takesOnlinePayments(company)) return { offer: false, reason: "no_online_payments" };

  if (changeOrder.invoiceId) {
    if (!invoice || invoice.id !== changeOrder.invoiceId) return { offer: false, reason: "billed" };
    const issued = Boolean(invoice.sentAt) || (invoice.status && invoice.status !== "draft");
    if (!issued) return { offer: false, reason: "invoice_not_issued" };
    const balance = round2(Math.max(0, num(invoice.total) - num(invoice.amountPaid)));
    const ref = { invoiceNumber: invoice.invoiceNumber ?? null };
    if (balance <= 0) return { offer: false, reason: "paid", ...ref };
    if (!isOwnChangeOrderInvoice(invoice, changeOrder.id)) return { offer: false, reason: "on_invoice", ...ref };
    return { offer: true, amount: balance, ...ref };
  }

  if (!money || typeof money !== "object") return { offer: false, reason: "no_quote" };
  if (money.taxKnown === false) return { offer: false, reason: "tax_unknown" };
  const amount = round2(money.changeWithTax);
  if (!(amount > 0)) return { offer: false, reason: "nothing_to_pay" };
  return { offer: true, amount, invoiceNumber: null };
}

/**
 * The invoice a change order gets when the client pays it on approval: one
 * line (the same builder the job's invoice uses — changeOrderInvoiceLine),
 * tax at the SIGNED QUOTE's rate, read off the quote the way the addendum
 * reads it (quoteTaxRate). Same rounding as addendumMoney, so the total here
 * equals the "This change … including tax" the client just signed.
 *
 * Refuses rather than guesses: not approved, already billed, a credit, or a
 * quote whose rate cannot be read.
 */
export function changeOrderInvoiceDraft({ changeOrder, all = [], quote = null, wording = null } = {}) {
  if (!changeOrder || typeof changeOrder !== "object") return { ok: false, reason: "not_found" };
  if (changeOrder.invoiceId) return { ok: false, reason: "already_billed" };
  if (!isBillableChangeOrder(changeOrder)) return { ok: false, reason: "not_approved" };
  const subtotal = round2(changeOrder.priceDelta);
  if (!(subtotal > 0)) return { ok: false, reason: "nothing_to_pay" };
  if (!quote || typeof quote !== "object") return { ok: false, reason: "no_quote" };
  const rate = quoteTaxRate(quote);
  if (rate === null) return { ok: false, reason: "tax_rate_underivable" };
  const tax = round2(subtotal * rate);
  return {
    ok: true,
    lineItems: [changeOrderInvoiceLine(changeOrder, all, wording)],
    subtotal,
    discount: 0,
    tax,
    total: round2(subtotal + tax),
    // Carried, like the job's own invoice: an invoice says what the quote
    // said about tax, it does not re-decide it.
    taxEnabled: quote.taxEnabled !== false,
  };
}
