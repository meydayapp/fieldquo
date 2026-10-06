// scripts/check-sub-change-orders.mjs
//
//   npm run check:sub-change-orders
//
// A subcontractor's quote that arrives AFTER the client approved, choosing
// between subs, change orders reachable from the approved quote, and "Pay $X
// now" after the client signs. The owner, 2026-10-05:
//
//   "If the subcontractor sends a quote, the contractor should be able to
//    select the one they want to work with, add it to their quote, and it
//    would be pending until their client approves it." … "[then] the option
//    to pay."
//
// ══ What is EXECUTED ═══════════════════════════════════════════════════════
//
// The shipped modules, against hostile input and an in-memory database whose
// $transaction really rolls back:
//
//   1. lib/quotes/importOptions.js — placement, the comparison, the paperwork,
//      the change order a sub's price becomes, the client's addendum, the pay
//      offer, the change order's own invoice.
//   2. An import into an ACCEPTED quote: a pending change order, the quote's
//      row, lines and signature hash untouched; the price derived on the
//      server whatever else is passed.
//   3. Choosing between subs: options reach no client document; "Use this
//      one" swaps the trade's line; options survive an editor save and are
//      never booked to a job.
//   4. Approval books the sub's cost once; a decline takes it back and leaves
//      the import as an unused option; nothing is billed for a declined one.
//   5. Pay after approval: only an approved change order, one invoice, once.
//   6. White-label: no client-facing payload carries the sub's name.
//
// What cannot be executed here (a route's wiring) is matched against source
// scoped to ONE brace-matched function, comments stripped.
//
// Then every key guarantee is broken on purpose (the mutation pass) and the
// run must fail for each. Backups are copies (cpSync), never `git checkout`.

import { readFileSync, writeFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import {
  importPlacement,
  comparisonKey,
  credentialSummary,
  compareImportOptions,
  changeOrderDraftFromImport,
  quoteChangeOrderAddendum,
  payNowState,
  changeOrderInvoiceDraft,
  isOwnChangeOrderInvoice,
  scrubCompanyName,
  takesOnlinePayments,
  NO_LINE,
} from "@/lib/quotes/importOptions";
import { deriveImportCommitStatus, clientPrice } from "@/lib/quotes/importedStatus";
import {
  performImport,
  placeImportOption,
  updateImportMarkup,
  removeImport,
  reconcileImportsForQuote,
  materializeImportedCosts,
} from "@/lib/quotes/importQuote";
import { syncChangeOrderImport, adoptImportsOnJob } from "@/lib/subcontractors/sourceLink";
import { billChangeOrderForPayment } from "@/lib/jobs/changeOrderPayment";
import { addendumMoney, quoteTaxRate } from "@/lib/jobs/changeOrderAddendum";
import { isBillableChangeOrder, changeOrderSummary } from "@/lib/jobs/changeOrderValue";
import { hashQuote } from "@/lib/documents/signatureAudit";
import { shareTokenFromLink } from "@/lib/quotes/addToQuoteLink";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const fails = [];
function ok(name, condition, got) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fails.push(name);
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
  return Boolean(condition);
}
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), got);
async function rejects(name, fn, pattern) {
  try {
    await fn();
    return ok(name, false, "did not throw");
  } catch (err) {
    return ok(name, pattern ? pattern.test(String(err?.message)) : true, err?.message);
  }
}

const SUB_NAME = "Sparky Electric";
const SUB2_NAME = "Volt Brothers";
const containsSub = (v) => /sparky|volt brothers/i.test(JSON.stringify(v));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. Pure — lib/quotes/importOptions.js against hostile input\n");
// ═══════════════════════════════════════════════════════════════════════════

{
  const live = (status, extra = {}) => ({ id: `co-${status}`, quoteImportId: "imp1", status, createdAt: new Date(2026, 9, 1), ...extra });
  eq("absent placement is a line (every row before the column)", importPlacement({ id: "imp1" }).kind, "line");
  eq("null placement is a line", importPlacement({ id: "imp1", placement: null }).kind, "line");
  eq("empty placement is a line", importPlacement({ id: "imp1", placement: "" }).kind, "line");
  eq("an option with no change order is an option", importPlacement({ id: "imp1", placement: "option" }, []).kind, "option");
  eq("an option carried by a pending change order", importPlacement({ id: "imp1", placement: "option" }, [live("pending")]).kind, "change_order");
  eq("…by one out for signature", importPlacement({ id: "imp1", placement: "option" }, [live("waiting_client")]).kind, "change_order");
  eq("…by an approved one", importPlacement({ id: "imp1", placement: "option" }, [live("approved")]).kind, "change_order");
  eq("a DECLINED change order leaves an unused option", importPlacement({ id: "imp1", placement: "option" }, [live("rejected")]).kind, "option");
  eq("an unrecognised change-order status carries nothing", importPlacement({ id: "imp1", placement: "option" }, [live("teleported")]).kind, "option");
  eq("another import's change order is not this one's", importPlacement({ id: "imp1", placement: "option" }, [{ ...live("approved"), quoteImportId: "imp2" }]).kind, "option");
  eq("an unrecognised placement is an option (on no document)", importPlacement({ id: "imp1", placement: "billboard" }).kind, "option");
  eq("a non-object is an option", importPlacement(null).kind, "option");
  eq("a line stays a line whatever change orders say", importPlacement({ id: "imp1", placement: "line" }, [live("approved")]).kind, "line");
  const newest = importPlacement({ id: "imp1", placement: "option" }, [
    live("rejected", { id: "old", createdAt: new Date(2026, 8, 1) }),
    live("pending", { id: "new", createdAt: new Date(2026, 9, 2) }),
  ]);
  eq("the live change order is the one reported, not the declined one", newest.changeOrder?.id, "new");

  eq("comparison ignores case and stray spaces", comparisonKey("  Electrical  Rough-in "), comparisonKey("electrical rough-in"));
  eq("no label compares with the default label", comparisonKey(null), comparisonKey("Subcontracted work"));
  ok("different trades do not compare", comparisonKey("Electrical") !== comparisonKey("Plumbing"));

  const asOf = new Date(2026, 9, 5);
  eq("no roster row: not recorded, never expired", credentialSummary(null, { asOf }), {
    onRoster: false,
    subcontractorId: null,
    insurance: { state: "unknown", endsAt: null },
    clearance: { state: "unknown", endsAt: null },
  });
  const cred = credentialSummary({ id: "s1", insuranceExpiresAt: new Date(2026, 8, 1), clearanceExpiresAt: new Date(2027, 5, 1) }, { asOf });
  eq("a lapsed COI reads expired", cred.insurance.state, "expired");
  eq("a clearance a year out reads ok", cred.clearance.state, "ok");
  eq("a blank clearance date reads unknown", credentialSummary({ id: "s1", insuranceExpiresAt: new Date(2026, 9, 20) }, { asOf }).clearance.state, "unknown");
  eq("a COI two weeks out reads due soon", credentialSummary({ id: "s1", insuranceExpiresAt: new Date(2026, 9, 20) }, { asOf }).insurance.state, "due_soon");
  eq("a hostile date string reads unknown", credentialSummary({ id: "s1", insuranceExpiresAt: "not a date" }, { asOf }).insurance.state, "unknown");

  const groups = compareImportOptions({
    imports: [
      { id: "a", label: "Electrical", snapshotAmount: 3200, markupPercent: 20, placement: "option", sourceCompanyId: "SUB", sourceCompany: { name: SUB_NAME } },
      { id: "b", label: "electrical ", snapshotAmount: 2900, markupPercent: 20, placement: "line", sourceCompanyId: "SUB2", sourceCompany: { name: SUB2_NAME } },
      { id: "c", label: "Plumbing", snapshotAmount: 1000, markupPercent: "abc", placement: "option", sourceCompanyId: "SUB3" },
      null,
      { label: "no id" },
    ],
    changeOrders: [],
    subsByCompanyId: { SUB: { id: "s1", insuranceExpiresAt: new Date(2026, 8, 1) } },
    asOf,
  });
  eq("two trades, the same trade compared regardless of case", groups.map((g) => g.options.length), [2, 1]);
  eq("cheapest cost first within a trade", groups[0].options.map((o) => o.id), ["b", "a"]);
  eq("the trade's chosen one is the line", groups[0].chosenId, "b");
  eq("a held-only trade has no chosen one", groups[1].chosenId, null);
  eq("client price is snapshot × (1 + markup)", groups[0].options[1].clientPrice, 3840);
  eq("a NaN markup passes the cost through", groups[1].options[0].clientPrice, 1000);
  eq("paperwork comes from the GC's roster row", groups[0].options[1].credentials.insurance.state, "expired");
  eq("a sub not on the roster says so", groups[0].options[0].credentials.onRoster, false);

  // The change order a sub's price becomes.
  const imp = { id: "imp1", label: "Electrical", snapshotAmount: 3000, markupPercent: 20, display: "blended", sourceCompany: { name: SUB_NAME } };
  const draft = changeOrderDraftFromImport({ imp });
  eq("price = snapshot × (1 + markup), from the row", draft.priceDelta, 3600);
  eq("the description is the trade label", draft.description, "Electrical");
  eq("blended: no body", draft.bodyHtml, null);
  eq("carries its import", draft.quoteImportId, "imp1");
  const injected = changeOrderDraftFromImport({ imp: { ...imp, priceDelta: 1, clientPrice: 1 }, priceDelta: 1 });
  eq("a priceDelta smuggled onto the row or the call is ignored", injected.priceDelta, 3600);
  for (const [m, want] of [[NaN, 3000], [-50, 3000], ["abc", 3000], [Infinity, 3000], ["20", 3600], [null, 3000]]) {
    eq(`markup ${String(m)} → ${want}`, changeOrderDraftFromImport({ imp: { ...imp, markupPercent: m } }).priceDelta, want);
  }
  for (const s of [0, -100, NaN, "x", null, undefined]) {
    eq(`snapshot ${String(s)} → no change order`, changeOrderDraftFromImport({ imp: { ...imp, snapshotAmount: s } }), null);
  }
  eq("no import → nothing", changeOrderDraftFromImport({}), null);
  const named = changeOrderDraftFromImport({ imp: { ...imp, label: `${SUB_NAME} — Electrical` } });
  eq("a label naming the sub is scrubbed", named.description, "Electrical");
  eq("a label that is ONLY the sub's name falls back to neutral words", changeOrderDraftFromImport({ imp: { ...imp, label: SUB_NAME } }).description, "Subcontracted work");
  const itemised = changeOrderDraftFromImport({
    imp: { ...imp, display: "itemized" },
    sourceQuote: {
      scopeGroups: [
        { lineItems: [{ description: `${SUB_NAME} panel upgrade`, amount: 2000 }, { description: "<script>alert(1)</script>Rough-in", amount: 1000 }, null, { description: "" }] },
      ],
    },
  });
  ok("itemised: the sub's work items listed", /<li>/.test(itemised.bodyHtml || ""), itemised.bodyHtml);
  ok("itemised: the sub's name is not in the body", !containsSub(itemised), itemised.bodyHtml);
  ok("itemised: markup in a description is text, never a tag", !/<script/i.test(itemised.bodyHtml || ""), itemised.bodyHtml);
  ok("itemised: no sub prices in the body", !/2000|1000/.test(itemised.bodyHtml || ""), itemised.bodyHtml);

  eq("scrub: case-insensitive", scrubCompanyName("SPARKY ELECTRIC wiring", SUB_NAME), "wiring");
  eq("scrub: regex characters in a name are literal", scrubCompanyName("A+B (Ltd) roof", "A+B (Ltd)"), "roof");
  eq("scrub: a two-letter name is not scrubbed out of words", scrubCompanyName("Labour", "AB"), "Labour");
  eq("scrub: no name, text unchanged", scrubCompanyName(" Drywall ", null), "Drywall");

  // The addendum the client reads beside their signed quote.
  const quote = { acceptedTotal: 11300, total: 11300, acceptedSubtotal: 10000, subtotal: 10000, acceptedTax: 1300, tax: 1300, discount: 0 };
  const cos = [
    { id: "c1", seq: 1, createdAt: new Date(2026, 9, 1), description: "Electrical", priceDelta: 3600, status: "approved", decidedAt: new Date(2026, 9, 2), quoteImportId: "imp1", invoiceId: "inv1", createdBy: { name: "Estimator Ed" } },
    { id: "c2", seq: 2, createdAt: new Date(2026, 9, 3), description: "Second coat", priceDelta: 500, status: "waiting_client", shareToken: "tok_c2", quoteImportId: null },
    { id: "c3", seq: 3, createdAt: new Date(2026, 9, 3), description: "Office draft", priceDelta: 900, status: "pending" },
    { id: "c4", seq: 4, createdAt: new Date(2026, 9, 3), description: "Declined", priceDelta: 700, status: "rejected" },
    { id: "c5", seq: 5, createdAt: new Date(2026, 9, 3), description: "Weird", priceDelta: 800, status: "teleported" },
    null,
  ];
  const add = quoteChangeOrderAddendum({ quote, changeOrders: cos });
  eq("only approved and out-for-signature changes are shown", add.rows.map((r) => r.label), ["CO-1", "CO-2"]);
  eq("…marked approved / pending in so many words", add.rows.map((r) => r.status), ["approved", "pending"]);
  eq("an allow-list: exactly these keys reach the client", Object.keys(add.rows[0]).sort(), ["decidedAt", "description", "label", "priceDelta", "reviewToken", "status"]);
  ok("no import, invoice or staff name in the client payload", !/imp1|inv1|Estimator/.test(JSON.stringify(add)), add);
  eq("the review link only on the change waiting for the client", add.rows.map((r) => r.reviewToken), [null, "tok_c2"]);
  eq("approved total excludes pending, rejected and unknown", add.approvedTotal, 3600);
  eq("pending total is the out-for-signature one only", add.pendingTotal, 500);
  const money = addendumMoney({ quoteTotal: 11300, priorApproved: 3600, delta: 0, taxRate: quoteTaxRate(quote) });
  eq("new total = quote + approved at the quote's rate — the /co page's own arithmetic", add.newTotal, money.newTotal);
  eq("…which is 11300 + 3600 × 1.13", add.newTotal, 15368);
  eq("nothing to show → null", quoteChangeOrderAddendum({ quote, changeOrders: [cos[2], cos[3]] }), null);
  const noRate = quoteChangeOrderAddendum({ quote: { total: 100, subtotal: 0, tax: 13, discount: 0 }, changeOrders: [cos[0]] });
  eq("rate unreadable → before tax, and said", [noRate.taxKnown, noRate.newTotal], [false, 3700]);
  eq("no quote → no total invented", quoteChangeOrderAddendum({ quote: null, changeOrders: [cos[0]] }).newTotal, null);

  // Pay after approving.
  const stripe = { stripeAccountId: "acct_1", stripeChargesEnabled: true };
  const m = addendumMoney({ quoteTotal: 11300, priorApproved: 0, delta: 3600, taxRate: 0.13 });
  eq("approved, unbilled, online payments → offer the change with tax", payNowState({ changeOrder: { id: "c", status: "approved" }, company: stripe, money: m }), { offer: true, amount: 4068, invoiceNumber: null });
  for (const s of ["pending", "waiting_client", "rejected", "teleported"]) {
    eq(`a ${s} change order is never offered`, payNowState({ changeOrder: { id: "c", status: s }, company: stripe, money: m }).offer, false);
  }
  eq("no Stripe account → no offer", payNowState({ changeOrder: { id: "c", status: "approved" }, company: { stripeAccountId: "acct_1" }, money: m }).reason, "no_online_payments");
  eq("a demo company walks the pay step", takesOnlinePayments({ isDemo: true }), true);
  eq("a credit is never paid now", payNowState({ changeOrder: { id: "c", status: "approved" }, company: stripe, money: addendumMoney({ quoteTotal: 100, delta: -50, taxRate: 0.13 }) }).reason, "nothing_to_pay");
  eq("tax unreadable → not offered", payNowState({ changeOrder: { id: "c", status: "approved" }, company: stripe, money: addendumMoney({ quoteTotal: 100, delta: 50, taxRate: null }) }).reason, "tax_unknown");
  const own = { id: "inv9", invoiceNumber: "INV-9", status: "sent", sentAt: new Date(), total: 4068, amountPaid: 0, lineItems: [{ changeOrderId: "c" }] };
  eq("billed on its own invoice → that invoice's balance", payNowState({ changeOrder: { id: "c", status: "approved", invoiceId: "inv9" }, company: stripe, invoice: own }), { offer: true, amount: 4068, invoiceNumber: "INV-9" });
  eq("…paid → no offer, says paid", payNowState({ changeOrder: { id: "c", status: "approved", invoiceId: "inv9" }, company: stripe, invoice: { ...own, amountPaid: 4068 } }).reason, "paid");
  eq("billed onto the job's shared invoice → named, no amount of ours", payNowState({ changeOrder: { id: "c", status: "approved", invoiceId: "inv9" }, company: stripe, invoice: { ...own, lineItems: [{ changeOrderId: "c" }, { description: "Quote" }] } }).reason, "on_invoice");
  eq("billed onto a DRAFT → not offered", payNowState({ changeOrder: { id: "c", status: "approved", invoiceId: "inv9" }, company: stripe, invoice: { ...own, status: "draft", sentAt: null } }).reason, "invoice_not_issued");
  eq("an invoice that is not the linked one is not trusted", payNowState({ changeOrder: { id: "c", status: "approved", invoiceId: "inv9" }, company: stripe, invoice: { ...own, id: "other" } }).reason, "billed");
  eq("own-invoice test: empty lines are not 'own'", isOwnChangeOrderInvoice({ lineItems: [] }, "c"), false);

  // The change order's own invoice equals what the client signed.
  for (const [rate, q] of [
    [0.13, quote],
    [0, { ...quote, acceptedTax: 0, tax: 0 }],
    [0.14975, { acceptedSubtotal: 1000, acceptedTax: 149.75, acceptedTotal: 1149.75, discount: 0 }],
    [0.05, { subtotal: 333.33, tax: 16.67, total: 350, discount: 0 }],
  ]) {
    for (const delta of [3600, 0.01, 1234.565, 99.99]) {
      const d = changeOrderInvoiceDraft({ changeOrder: { id: "c", seq: 1, status: "approved", priceDelta: delta, description: "x" }, quote: q });
      const want = addendumMoney({ quoteTotal: 0, delta, taxRate: quoteTaxRate(q) }).changeWithTax;
      ok(`invoice total = the signed "this change incl. tax" (rate ${rate}, ${delta})`, d.ok && d.total === want, [d.total, want]);
    }
  }
  const okDraft = changeOrderInvoiceDraft({ changeOrder: { id: "c", seq: 2, status: "approved", priceDelta: 3600, description: "Electrical" }, quote });
  eq("one line, labelled as the change order, carrying its id", [okDraft.lineItems.length, okDraft.lineItems[0].changeOrderId, okDraft.lineItems[0].description], [1, "c", "Change order CO-2 · Electrical"]);
  for (const [why, co, q, reason] of [
    ["pending", { id: "c", status: "pending", priceDelta: 10 }, quote, "not_approved"],
    ["declined", { id: "c", status: "rejected", priceDelta: 10 }, quote, "not_approved"],
    ["already billed", { id: "c", status: "approved", priceDelta: 10, invoiceId: "i" }, quote, "already_billed"],
    ["a credit", { id: "c", status: "approved", priceDelta: -10 }, quote, "nothing_to_pay"],
    ["no quote", { id: "c", status: "approved", priceDelta: 10 }, null, "no_quote"],
    ["an unreadable rate", { id: "c", status: "approved", priceDelta: 10 }, { subtotal: 0, tax: 5, discount: 0 }, "tax_rate_underivable"],
  ]) {
    eq(`own invoice refused: ${why}`, changeOrderInvoiceDraft({ changeOrder: co, quote: q }).reason, reason);
  }

  // What the sub is told.
  eq("an option on an ACCEPTED quote is never 'confirmed' to the sub", deriveImportCommitStatus({ placement: "option", targetQuoteStatus: "accepted", hasJob: true }), "pending");
  eq("an option on a declined quote: cancelled", deriveImportCommitStatus({ placement: "option", targetQuoteStatus: "declined" }), "cancelled");
  eq("a change-order price, pending → pending", deriveImportCommitStatus({ placement: "change_order", changeOrderStatus: "waiting_client", targetQuoteStatus: "accepted", hasJob: true }), "pending");
  eq("a change-order price, approved → confirmed", deriveImportCommitStatus({ placement: "change_order", changeOrderStatus: "approved", targetQuoteStatus: "accepted" }), "confirmed");
  eq("a line: unchanged rule", deriveImportCommitStatus({ placement: "line", targetQuoteStatus: "accepted" }), "confirmed");

  // The pasted link on the quote page.
  const tok = "a".repeat(43);
  for (const input of [tok, `https://app.fieldquo.com/q/${tok}`, `https://x.test/q/${tok}/add`, `/q/${tok}?utm=1`, `  https://app.fieldquo.com/q/${tok}/  `]) {
    eq(`link parsed: ${input.trim().slice(0, 40)}`, shareTokenFromLink(input), tok);
  }
  for (const input of ["", null, "javascript:alert(1)", "https://evil.test/x", `https://x.test/q/short`, `https://x.test/q/${tok}/delete`, `https://x.test/i/${tok}`, `${tok}<script>`]) {
    eq(`link refused: ${String(input).slice(0, 40)}`, shareTokenFromLink(input), null);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// The in-memory database. Equality, { in }, { not }, { notIn }, OR; select and
// include with the relations these modules read; and a $transaction that
// ROLLS BACK when its function throws — a fake that let a half-written import
// survive would prove nothing about atomicity.
// ═══════════════════════════════════════════════════════════════════════════

function makeDb() {
  let T = {
    company: [], quote: [], quoteScopeGroup: [], serviceCategory: [], quoteImport: [], job: [],
    changeOrder: [], invoice: [], expense: [], subcontractor: [], jobSubcontractor: [], subcontractorBill: [],
  };
  let seq = 0;
  const id = (p) => `${p}_${++seq}`;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "OR") return v.some((w) => matches(row, w));
      if (k === "NOT") return !matches(row, v);
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        if ("in" in v) return v.in.includes(row[k]);
        if ("notIn" in v) return !v.notIn.includes(row[k]);
        if ("not" in v) return (row[k] ?? null) !== (v.not ?? null);
        throw new Error(`fake db: unsupported filter on ${k}`);
      }
      return (row[k] ?? null) === (v ?? null);
    });
  const REL = {
    quoteImport: {
      sourceCompany: (r) => T.company.find((c) => c.id === r.sourceCompanyId) || null,
      targetCompany: (r) => T.company.find((c) => c.id === r.targetCompanyId) || null,
      targetQuote: (r) => T.quote.find((q) => q.id === r.targetQuoteId) || null,
      sourceQuote: (r) => T.quote.find((q) => q.id === r.sourceQuoteId) || null,
    },
    quote: {
      jobs: (r) => T.job.filter((j) => j.quoteId === r.id).sort((a, b) => a.createdAt - b.createdAt),
      scopeGroups: (r) => T.quoteScopeGroup.filter((g) => g.quoteId === r.id),
      company: (r) => T.company.find((c) => c.id === r.companyId) || null,
    },
    changeOrder: {
      job: (r) => T.job.find((j) => j.id === r.jobId) || null,
      decidedBy: () => null,
      invoice: (r) => T.invoice.find((i) => i.id === r.invoiceId) || null,
    },
    job: {
      quote: (r) => T.quote.find((q) => q.id === r.quoteId) || null,
      company: (r) => T.company.find((c) => c.id === r.companyId) || null,
    },
    invoice: { versions: (r) => T.invoice.filter((i) => i.parentInvoiceId === r.id) },
  };
  const modelOf = { sourceCompany: "company", targetCompany: "company", targetQuote: "quote", sourceQuote: "quote", jobs: "job", scopeGroups: "quoteScopeGroup", company: "company", job: "job", quote: "quote", decidedBy: "user", invoice: "invoice", versions: "invoice" };
  const shape = (model, row, { select, include } = {}) => {
    if (!row) return null;
    const out = select ? {} : { ...row };
    const spec = { ...(select || {}), ...(include || {}) };
    for (const [k, v] of Object.entries(spec)) {
      if (!v) continue;
      const rel = REL[model]?.[k];
      if (!rel) {
        if (v === true) out[k] = row[k];
        continue;
      }
      const got = rel(row);
      const sub = v === true ? {} : v;
      if (Array.isArray(got)) {
        let list = got;
        if (sub.where) list = list.filter((x) => matches(x, sub.where));
        if (sub.take) list = list.slice(0, sub.take);
        out[k] = list.map((x) => shape(modelOf[k], x, sub));
      } else out[k] = shape(modelOf[k], got, sub);
    }
    return out;
  };
  const model = (name) => ({
    findMany: async ({ where = {}, select, include, orderBy } = {}) => {
      let rows = T[name].filter((r) => matches(r, where));
      if (orderBy?.createdAt) rows = [...rows].sort((a, b) => (orderBy.createdAt === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));
      return rows.map((r) => shape(name, r, { select, include }));
    },
    findFirst: async ({ where = {}, select, include } = {}) => shape(name, T[name].find((r) => matches(r, where)), { select, include }),
    findUnique: async ({ where = {}, select, include } = {}) => shape(name, T[name].find((r) => matches(r, where)), { select, include }),
    count: async ({ where = {} } = {}) => T[name].filter((r) => matches(r, where)).length,
    create: async ({ data, select, include }) => {
      if (name === "quoteImport" && T.quoteImport.some((r) => r.targetQuoteId === data.targetQuoteId && r.sourceQuoteId === data.sourceQuoteId))
        throw Object.assign(new Error("unique"), { code: "P2002" });
      const row = { id: id(name), createdAt: new Date(2026, 9, 5, 0, 0, ++seq), ...data };
      if (name === "quoteImport" && row.placement === undefined) row.placement = "line"; // the column default
      if (name === "changeOrder" && row.status === undefined) row.status = "approved"; // the column default
      T[name].push(row);
      return shape(name, row, { select, include });
    },
    update: async ({ where, data, select }) => {
      const row = T[name].find((r) => matches(r, where));
      if (!row) throw new Error(`${name}.update: no row`);
      Object.assign(row, data);
      return shape(name, row, { select });
    },
    updateMany: async ({ where, data }) => {
      const rows = T[name].filter((r) => matches(r, where));
      for (const r of rows) Object.assign(r, data);
      return { count: rows.length };
    },
    delete: async ({ where }) => {
      const i = T[name].findIndex((r) => matches(r, where));
      if (i < 0) throw new Error(`${name}.delete: no row`);
      return T[name].splice(i, 1)[0];
    },
    deleteMany: async ({ where }) => {
      const before = T[name].length;
      T[name] = T[name].filter((r) => !matches(r, where));
      return { count: before - T[name].length };
    },
    upsert: async ({ where, create, update }) => {
      const key = Object.values(where)[0];
      const row = T[name].find((r) => (typeof key === "object" ? matches(r, key) : r.key === key));
      if (row) {
        Object.assign(row, update);
        return row;
      }
      const made = { id: id(name), ...create };
      T[name].push(made);
      return made;
    },
  });
  const db = {};
  for (const n of Object.keys(T)) db[n] = model(n);
  db.$queryRaw = async () => [];
  db.$executeRaw = async () => 0;
  let depth = 0;
  db.$transaction = async (fn) => {
    // Nested calls share the outer transaction, as Prisma's interactive
    // transaction does for one client.
    if (depth > 0) return fn(db);
    const snapshot = structuredClone(T);
    depth++;
    try {
      return await fn(db);
    } catch (err) {
      T = snapshot;
      for (const n of Object.keys(T)) db[n] = model(n);
      throw err;
    } finally {
      depth--;
    }
  };
  return { db, get T() { return T; } };
}

function world() {
  const w = makeDb();
  const { T } = w;
  T.company.push(
    { id: "SUB", name: SUB_NAME, email: "office@sparky.test", phone: "555-0199" },
    { id: "SUB2", name: SUB2_NAME, email: "hi@volt.test" },
    { id: "GC", name: "Build Right" },
  );
  // The subs' quotes to the GC, sent.
  T.quote.push({ id: "SQ1", companyId: "SUB", status: "sent", total: 3000, acceptedTotal: null, quoteNumber: "Q-S-1", scopeGroups: undefined, lineItems: [{ description: `${SUB_NAME} rough-in`, amount: 3000 }] });
  T.quote.push({ id: "SQ2", companyId: "SUB2", status: "sent", total: 2800, acceptedTotal: null, quoteNumber: "Q-V-1", lineItems: [{ description: "Rough-in", amount: 2800 }] });
  // The GC's quote to the homeowner — ACCEPTED, signed, with its job.
  T.quote.push({
    id: "GQA", companyId: "GC", status: "accepted", quoteNumber: "Q-G-7", taxEnabled: true,
    subtotal: 10000, tax: 1300, total: 11300, discount: 0, acceptedSubtotal: 10000, acceptedTax: 1300, acceptedTotal: 11300,
    lineItems: null, signature: { name: "Homeowner", documentHash: "will-be-set" },
  });
  T.quoteScopeGroup.push({ id: "g-paint", quoteId: "GQA", subtotal: 10000, label: "Painting", lineItems: [{ description: "Walls", amount: 10000 }] });
  T.job.push({ id: "JA", companyId: "GC", quoteId: "GQA", clientId: "CL", clientPoNumber: null, createdAt: new Date(2026, 9, 1) });
  // An OPEN quote of the GC's, to compare subs on.
  T.quote.push({ id: "GQO", companyId: "GC", status: "draft", quoteNumber: "Q-G-8", taxEnabled: false, subtotal: 5000, tax: 0, total: 5000, discount: 0 });
  T.quoteScopeGroup.push({ id: "g-floor", quoteId: "GQO", subtotal: 5000, label: "Flooring", lineItems: [{ description: "Floor", amount: 5000 }] });
  // The GC's roster knows Sparky; its COI has lapsed.
  T.subcontractor.push({ id: "R1", companyId: "GC", linkedCompanyId: "SUB", name: SUB_NAME, insuranceExpiresAt: new Date(2026, 8, 1), clearanceExpiresAt: null, createdAt: new Date(2026, 1, 1) });
  return w;
}
const member = { companyId: "GC", userId: "u_gc" };
const loadQuote = (T, qid) => ({
  ...T.quote.find((q) => q.id === qid),
  company: T.company.find((c) => c.id === T.quote.find((q) => q.id === qid).companyId),
  scopeGroups: T.quoteScopeGroup.filter((g) => g.quoteId === qid),
  jobs: T.job.filter((j) => j.quoteId === qid).map((j) => ({ id: j.id })),
});
const quoteFingerprint = (T, qid) => {
  const q = T.quote.find((x) => x.id === qid);
  const groups = T.quoteScopeGroup.filter((g) => g.quoteId === qid);
  return { row: JSON.stringify(q), groups: JSON.stringify(groups), hash: hashQuote({ ...q, scopeGroups: groups }) };
};

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. A sub's quote into an ACCEPTED quote → a pending change order, the signed quote untouched\n");
// ═══════════════════════════════════════════════════════════════════════════

const W = world();
{
  const { db } = W;
  const before = quoteFingerprint(W.T, "GQA");
  const res = await performImport({
    db, member, sourceQuote: loadQuote(W.T, "SQ1"), targetQuote: loadQuote(W.T, "GQA"), targetCompany: { taxRate: 13 },
    markupPercent: 20, display: "blended", label: "Electrical",
    // A browser's figures, smuggled into the call. performImport has no
    // parameter that reads them.
    clientPrice: 1, priceDelta: 1, total: 1,
  });
  const after = quoteFingerprint(W.T, "GQA");
  eq("the signed quote's row is byte-identical", after.row, before.row);
  eq("its lines are byte-identical", after.groups, before.groups);
  eq("its signature hash is unchanged", after.hash, before.hash);
  eq("no total reported as moved", res.targetTotal, null);
  eq("placement: on a change order", res.placement, "change_order");
  const co = W.T.changeOrder.find((c) => c.id === res.changeOrder?.id);
  ok("a change order exists on the quote's job", co && co.jobId === "JA", co);
  eq("it is PENDING — nothing agreed yet", co?.status, "pending");
  eq("its price is snapshot × (1 + markup), derived on the server", Number(co?.priceDelta), 3600);
  eq("it is CO-1 on the job", co?.seq, 1);
  eq("it carries the import", co?.quoteImportId, res.import.id);
  const imp = W.T.quoteImport.find((i) => i.id === res.import.id);
  eq("the import is held, not a line", [imp.placement, imp.targetLineId], ["option", NO_LINE]);
  eq("the import books the sub's cost at the snapshot", Number(imp.snapshotAmount), 3000);
  ok("the change order names no sub", !containsSub({ d: co.description, b: co.bodyHtml }), co);
  eq("no expense yet — nothing approved", W.T.expense.length, 0);
  eq("no sub on the job yet", W.T.jobSubcontractor.length, 0);
  eq("the client's addendum shows nothing yet (pending is the office's draft)", quoteChangeOrderAddendum({ quote: W.T.quote.find((q) => q.id === "GQA"), changeOrders: W.T.changeOrder }), null);

  // A second electrician for the same trade, offered straight away: refused,
  // and the refusal leaves nothing behind (the transaction rolled back).
  const importsBefore = W.T.quoteImport.length;
  await rejects(
    "a second live change order for the same trade is refused",
    () => performImport({ db, member, sourceQuote: loadQuote(W.T, "SQ2"), targetQuote: loadQuote(W.T, "GQA"), targetCompany: { taxRate: 13 }, markupPercent: 20, display: "blended", label: "electrical" }),
    /already carries a price/,
  );
  eq("…and the refused import was rolled back", W.T.quoteImport.length, importsBefore);
  // Held as an option instead: allowed, and reaches no client document.
  const opt = await performImport({ db, member, sourceQuote: loadQuote(W.T, "SQ2"), targetQuote: loadQuote(W.T, "GQA"), targetCompany: { taxRate: 13 }, markupPercent: 25, display: "blended", label: "Electrical", asOption: true });
  eq("as an option: no change order", opt.changeOrder, null);
  eq("…placement option", opt.placement, "option");
  eq("…still only one change order on the job", W.T.changeOrder.length, 1);
  eq("…the signed quote still untouched", quoteFingerprint(W.T, "GQA").hash, before.hash);

  await rejects("into an approved quote with no job: refused", () =>
    performImport({ db, member, sourceQuote: loadQuote(W.T, "SQ1"), targetQuote: { ...loadQuote(W.T, "GQA"), id: "GQX", jobs: [] }, targetCompany: { taxRate: 13 }, markupPercent: 0, display: "blended" }), /no job/);
  await rejects("into a declined quote: refused", () =>
    performImport({ db, member, sourceQuote: loadQuote(W.T, "SQ1"), targetQuote: { ...loadQuote(W.T, "GQA"), id: "GQD", status: "declined" }, targetCompany: { taxRate: 13 }, markupPercent: 0, display: "blended" }), /already decided/);
  await rejects("into another company's quote: refused", () =>
    performImport({ db, member, sourceQuote: loadQuote(W.T, "SQ1"), targetQuote: { ...loadQuote(W.T, "GQA"), companyId: "SUB2" }, targetCompany: { taxRate: 13 }, markupPercent: 0, display: "blended" }), /your own quotes/);

  // A change order's price is the client's: markup and removal refused.
  await rejects("markup on a change-order price: refused", () => updateImportMarkup({ db, member, quoteId: "GQA", importId: res.import.id, markupPercent: 50, targetCompany: { taxRate: 13 } }), /change order/);
  await rejects("removing a change-order price: refused", () => removeImport({ db, member, quoteId: "GQA", importId: res.import.id, targetCompany: { taxRate: 13 } }), /change order/);
  // An option's markup moves freely (it is on no document).
  const mk = await updateImportMarkup({ db, member, quoteId: "GQA", importId: opt.import.id, markupPercent: 10, targetCompany: { taxRate: 13 } });
  eq("an option's markup changes, its price follows, no total moves", [mk.clientPrice, mk.targetTotal], [3080, null]);
  eq("…and the signed quote is still untouched", quoteFingerprint(W.T, "GQA").hash, before.hash);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. Choosing between subs on an OPEN quote — only the chosen one reaches the client\n");
// ═══════════════════════════════════════════════════════════════════════════

{
  const w = world();
  const { db } = w;
  const a = await performImport({ db, member, sourceQuote: loadQuote(w.T, "SQ1"), targetQuote: loadQuote(w.T, "GQO"), targetCompany: { taxRate: 0 }, markupPercent: 20, display: "itemized", label: "Electrical", asOption: true });
  const b = await performImport({ db, member, sourceQuote: loadQuote(w.T, "SQ2"), targetQuote: loadQuote(w.T, "GQO"), targetCompany: { taxRate: 0 }, markupPercent: 20, display: "blended", label: "Electrical", asOption: true });
  const q = () => w.T.quote.find((x) => x.id === "GQO");
  eq("two options held: the quote's total has not moved", q().total, 5000);
  eq("…no scope group was added for either", w.T.quoteScopeGroup.filter((g) => g.quoteId === "GQO").length, 1);
  ok("…nothing on the client's quote names a sub", !containsSub(w.T.quoteScopeGroup.filter((g) => g.quoteId === "GQO")));

  // An editor save must not wipe the options (they have no group to lose).
  await reconcileImportsForQuote(db, "GQO");
  eq("an editor save keeps both options", w.T.quoteImport.filter((i) => i.targetQuoteId === "GQO").length, 2);

  const first = await placeImportOption({ db, member, quoteId: "GQO", importId: a.import.id, targetCompany: { taxRate: 0 } });
  eq("'Use this one': it becomes the trade's line", first.placement, "line");
  eq("…the total is the quote plus ONE marked-up price", [first.targetTotal, q().total], [8600, 8600]);
  const lineGroup = w.T.quoteScopeGroup.find((g) => g.id === w.T.quoteImport.find((i) => i.id === a.import.id).targetLineId);
  ok("…its itemised lines carry no sub name", lineGroup && !containsSub(lineGroup), lineGroup);
  eq("…its lines total the client price to the cent", Math.round(lineGroup.lineItems.reduce((s, l) => s + l.amount, 0) * 100) / 100, 3600);

  const second = await placeImportOption({ db, member, quoteId: "GQO", importId: b.import.id, targetCompany: { taxRate: 0 } });
  eq("'Use this one instead': the other steps back", second.swappedOut, [a.import.id]);
  eq("…ONE price for the trade on the quote", [second.targetTotal, q().total], [8360, 8360]);
  eq("…the swapped-out one is an option again with no line", [w.T.quoteImport.find((i) => i.id === a.import.id).placement, w.T.quoteImport.find((i) => i.id === a.import.id).targetLineId], ["option", NO_LINE]);
  eq("…and its group is gone from the client's quote", w.T.quoteScopeGroup.filter((g) => g.quoteId === "GQO").length, 2);
  await rejects("choosing a price already on the quote: refused", () => placeImportOption({ db, member, quoteId: "GQO", importId: b.import.id, targetCompany: { taxRate: 0 } }), /already on your quote/);

  // The quote is accepted and becomes a job: only the CHOSEN price is booked.
  q().status = "accepted";
  w.T.job.push({ id: "JO", companyId: "GC", quoteId: "GQO", clientId: "CL", createdAt: new Date() });
  const made = await materializeImportedCosts(db, { quoteId: "GQO", jobId: "JO", companyId: "GC" });
  eq("acceptance books only the line, never the losing option", [made, w.T.expense.map((e) => Number(e.amount))], [1, [2800]]);
  await adoptImportsOnJob(db, { quoteId: "GQO", jobId: "JO", companyId: "GC" });
  eq("…and only the chosen sub joins the job", w.T.jobSubcontractor.map((r) => r.quoteImportId), [b.import.id]);
  const removed = await removeImport({ db, member, quoteId: "GQO", importId: a.import.id, targetCompany: { taxRate: 0 } });
  eq("a losing option can be dropped from an accepted quote", [removed.targetTotal, w.T.quoteImport.some((i) => i.id === a.import.id)], [null, false]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. Approval books the sub's cost once; a decline takes it back and leaves an unused option\n");
// ═══════════════════════════════════════════════════════════════════════════

{
  const { db } = W;
  const co = W.T.changeOrder[0];
  const impId = co.quoteImportId;
  // The client signs (the public route moves the status, then the shared
  // decision path runs this).
  co.status = "approved";
  co.signature = { name: "Homeowner" };
  co.decidedAt = new Date();
  const r1 = await syncChangeOrderImport(db, { changeOrderId: co.id });
  eq("approval materialises the cost and adopts the sub", [r1.materialised, r1.adopted], [true, true]);
  eq("the expense is the sub's snapshot, on the job", W.T.expense.map((e) => [Number(e.amount), e.projectId, e.category]), [[3000, "JA", "Subcontractor"]]);
  eq("the sub is on the job, agreed, adopting the import", W.T.jobSubcontractor.map((r) => [r.jobId, r.status, r.quoteImportId, Number(r.agreedAmount)]), [["JA", "agreed", impId, 3000]]);
  eq("the existing roster entry was used, not duplicated", W.T.subcontractor.length, 1);
  const r2 = await syncChangeOrderImport(db, { changeOrderId: co.id });
  eq("a second run books nothing more", [r2.materialised, r2.adopted, W.T.expense.length, W.T.jobSubcontractor.length], [false, false, 1, 1]);
  eq("the contract value grows by the approved change only", changeOrderSummary(W.T.changeOrder).approvedTotal, 3600);
  eq("the sub now reads confirmed", deriveImportCommitStatus({ placement: importPlacement(W.T.quoteImport.find((i) => i.id === impId), W.T.changeOrder).kind, changeOrderStatus: "approved" }), "confirmed");
  ok("the client's addendum shows it approved — and no sub", (() => {
    const add = quoteChangeOrderAddendum({ quote: W.T.quote.find((q) => q.id === "GQA"), changeOrders: W.T.changeOrder });
    return add && add.rows.length === 1 && add.rows[0].status === "approved" && !containsSub(add);
  })());

  // Staff take the decision back (PATCH → rejected).
  co.status = "rejected";
  const r3 = await syncChangeOrderImport(db, { changeOrderId: co.id });
  eq("a decline releases the booking", r3.released, true);
  eq("…the sub's row goes back to quoted (a price, not a liability)", W.T.jobSubcontractor.map((r) => r.status), ["quoted"]);
  eq("…the materialised expense is gone", W.T.expense.length, 0);
  const imp = W.T.quoteImport.find((i) => i.id === impId);
  eq("…the import stays, as an unused option", [Boolean(imp), importPlacement(imp, W.T.changeOrder).kind, imp.expenseId ?? null], [true, "option", null]);
  const declined = await billChangeOrderForPayment(db, { changeOrderId: co.id });
  eq("nothing is billed for a declined change order", [declined.ok, declined.reason, W.T.invoice.length], [false, "not_approved", 0]);

  // Approved again (rejected → approved is a staff path): booked again, once.
  co.status = "approved";
  await syncChangeOrderImport(db, { changeOrderId: co.id });
  eq("re-approval books it again: one expense, the row agreed", [W.T.expense.length, W.T.jobSubcontractor.map((r) => r.status)], [1, ["agreed"]]);

  // Another tenant's change order pointing at this import books nothing here.
  W.T.job.push({ id: "J-OTHER", companyId: "SUB2", quoteId: null, createdAt: new Date() });
  W.T.changeOrder.push({ id: "co-foreign", jobId: "J-OTHER", status: "approved", quoteImportId: impId, priceDelta: 1, createdAt: new Date() });
  const foreign = await syncChangeOrderImport(db, { changeOrderId: "co-foreign" });
  eq("a change order in another company never books this import", [foreign.materialised, foreign.adopted, W.T.expense.length], [false, false, 1]);
  W.T.changeOrder.pop();
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. Pay after approval — only approved, one invoice, once\n");
// ═══════════════════════════════════════════════════════════════════════════

{
  const { db } = W;
  const co = W.T.changeOrder[0];
  // A pending one first: refused, nothing written.
  W.T.changeOrder.push({ id: "co-pending", jobId: "JA", seq: 2, status: "waiting_client", priceDelta: 500, description: "Second coat", createdAt: new Date() });
  const pend = await billChangeOrderForPayment(db, { changeOrderId: "co-pending" });
  eq("a change order awaiting signature is never billed", [pend.ok, W.T.invoice.length], [false, 0]);

  const first = await billChangeOrderForPayment(db, { changeOrderId: co.id, now: new Date(2026, 9, 5) });
  const inv = W.T.invoice.find((i) => i.id === first.invoiceId);
  eq("approved → billed onto its own invoice", [first.ok, first.created, W.T.invoice.length], [true, true, 1]);
  const signed = addendumMoney({ quoteTotal: 11300, priorApproved: 0, delta: 3600, taxRate: quoteTaxRate(W.T.quote.find((q) => q.id === "GQA")) });
  eq("the invoice total is what the client signed incl. tax", Number(inv.total), signed.changeWithTax);
  eq("…issued, so the portal pay page will take it", [inv.status, Boolean(inv.sentAt), Number(inv.amountDue)], ["sent", true, signed.changeWithTax]);
  eq("…NOT linked as the job's invoice (no jobId / quoteId)", [inv.jobId ?? null, inv.quoteId ?? null], [null, null]);
  eq("…for the job's client", inv.clientId, "CL");
  eq("…one line, this change order", [inv.lineItems.length, inv.lineItems[0].changeOrderId], [1, co.id]);
  ok("…the invoice names no sub", !containsSub(inv), inv.lineItems);
  eq("the change order is now billed on it", co.invoiceId, inv.id);
  ok("…so the staff bill button can't add it to the job's invoice too", !isBillableChangeOrder(co));
  const again = await billChangeOrderForPayment(db, { changeOrderId: co.id });
  eq("a second tap: the same invoice, nothing new", [again.ok, again.created, again.invoiceId, W.T.invoice.length], [true, false, inv.id, 1]);
  const stripe = { stripeAccountId: "acct_1", stripeChargesEnabled: true };
  eq("the page now offers that invoice's balance", payNowState({ changeOrder: co, company: stripe, invoice: inv }).amount, signed.changeWithTax);
  W.T.changeOrder.pop();
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. Wiring — what the routes and the shared decision path must do\n");
// ═══════════════════════════════════════════════════════════════════════════

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}
function fnBody(file, name) {
  const src = stripComments(readFileSync(join(ROOT, file), "utf8"));
  const start = src.search(new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\s*\\(`));
  if (start < 0) return null;
  const open = src.indexOf("{", src.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return null;
}
{
  const decision = fnBody("lib/jobs/changeOrderDecision.js", "applyChangeOrderDecision");
  ok("every decision door books/releases a sub's price (applyChangeOrderDecision → syncChangeOrderImport)", decision && /syncChangeOrderImport\(/.test(decision));
  const pay = fnBody("app/api/public/change-orders/[token]/pay/route.js", "POST");
  ok("the pay route reads no request body — no amount can arrive", pay && !/request\.json\(|request\.formData\(/.test(pay));
  ok("…bills through the shared, idempotent biller", pay && /billChangeOrderForPayment\(/.test(pay));
  ok("…and hands over the portal invoice page, never a checkout of its own", pay && /portalInvoiceUrl\(/.test(pay) && !/createInvoiceCheckoutSession|checkout\.sessions/.test(pay));
  const present = fnBody("app/api/public/change-orders/[token]/route.js", "present");
  ok("the client's change-order payload never carries the import or a sub", present && !/quoteImportId|sourceCompany/.test(present));
  ok("…and offers pay from the server's own decision", present && /payNowState\(/.test(present));
  const mat = fnBody("lib/quotes/importQuote.js", "materializeImportedCosts");
  ok("acceptance materialises lines only", mat && /placement:\s*"line"/.test(mat));
  const adopt = fnBody("lib/subcontractors/sourceLink.js", "adoptImportsOnJob");
  ok("acceptance adopts lines only", adopt && /placement:\s*"line"/.test(adopt));
  const recv = fnBody("app/api/quotes/received/[token]/route.js", "GET");
  ok("the import panel lists approved quotes WITH a job", recv && /status:\s*"accepted",\s*jobs:\s*\{\s*some/.test(recv));
  ok("…only to someone who may raise a change order", recv && /hasLevel\(full,\s*"jobs",\s*"view_create_edit"\)\s*&&\s*hasToggle\(full,\s*"showPricing"\)/.test(recv));
  const sel = fnBody("app/api/quotes/[id]/imports/[importId]/select/route.js", "POST");
  ok("'Use this one' reads no request body", sel && !/request\.json\(/.test(sel));
  ok("…and asks the jobs level before raising a change order", sel && /requireLevel\(full,\s*"jobs",\s*"view_create_edit"/.test(sel));
  const pq = fnBody("app/api/public/quotes/[token]/route.js", "GET");
  ok("the client's quote page gets the addendum from the allow-list builder", pq && /quoteChangeOrderAddendum\(/.test(pq));
  const pdf = fnBody("app/api/quotes/[id]/pdf/route.js", "POST");
  ok("the PDF prints the addendum without touching the signed quote's hash", pdf && /quoteChangeOrderAddendum\(/.test(pdf) && /hashQuote\(quote\)/.test(pdf));
  const page = readFileSync(join(ROOT, "app/app/quotes/[id]/page.js"), "utf8");
  ok("the approved quote's page mounts the change orders card", /quote\.status === "accepted"[\s\S]{0,80}<QuoteChangeOrders/.test(page));
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  ok("this check runs in check:all", /check:sub-change-orders/.test(pkg.scripts["check:all"] || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Mutation pass — every guarantee above must be load-bearing
// ═══════════════════════════════════════════════════════════════════════════

const MUTATING = !process.argv.includes("--no-mutate");
if (!MUTATING) {
  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
  process.exit(fails.length ? 1 : 0);
}

console.log("\n7. Mutation pass — break each guarantee, confirm it is caught\n");

const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));

const MUTATIONS = [
  ["lib/quotes/importOptions.js", "every import reads as a line (options reach the client)", (s) => s.replace('if (stored === "line") return { kind: "line", changeOrder: null };', 'return { kind: "line", changeOrder: null };')],
  ["lib/quotes/importOptions.js", "a declined change order still carries the import", (s) => s.replace('const LIVE = new Set(["pending", "waiting_client", "approved"]);', 'const LIVE = new Set(["pending", "waiting_client", "approved", "rejected"]);')],
  ["lib/quotes/importOptions.js", "the change order is priced at the sub's cost, markup dropped", (s) => s.replace("const priceDelta = clientPrice(imp.snapshotAmount, imp.markupPercent);\n  if (!(priceDelta > 0)) return null;\n  const name", "const priceDelta = Number(imp.snapshotAmount) || 0;\n  if (!(priceDelta > 0)) return null;\n  const name")],
  ["lib/quotes/importOptions.js", "the sub's name is no longer scrubbed", (s) => s.replace('.replace(new RegExp(escapeRegExp(n), "gi"), "")', "")],
  ["lib/quotes/importOptions.js", "the addendum shows the office's unsent drafts", (s) => s.replace('return s === "approved" || s === "waiting_client";', 'return s === "approved" || s === "waiting_client" || s === "pending";')],
  ["lib/quotes/importOptions.js", "the addendum leaks the import id to the client", (s) => s.replace("      status: approved ? \"approved\" : \"pending\",\n", "      status: approved ? \"approved\" : \"pending\",\n      quoteImportId: co.quoteImportId ?? null,\n")],
  ["lib/quotes/importOptions.js", "pay is offered before the client approved", (s) => s.replace('if (changeOrderStatus(changeOrder) !== "approved") return { offer: false, reason: "not_approved" };', "")],
  ["lib/quotes/importOptions.js", "the change order's invoice skips the quote's tax", (s) => s.replace("const tax = round2(subtotal * rate);", "const tax = 0;")],
  ["lib/quotes/importedStatus.js", "an option on an accepted quote tells the sub 'confirmed'", (s) => s.replace('if (placement === "option") return targetQuoteStatus === "declined" ? "cancelled" : "pending";', "")],
  ["lib/quotes/importQuote.js", "an import into an accepted quote edits the signed quote", (s) => s.replace("if (accepted || asOption === true) {", "if (asOption === true) {")],
  ["lib/quotes/importQuote.js", "acceptance books every bid, options included", (s) => s.replace('      expenseId: null,\n      placement: "line",', "      expenseId: null,")],
  ["lib/quotes/importQuote.js", "an editor save wipes the options", (s) => s.replace('where: { targetQuoteId: quoteId, placement: "line" },', "where: { targetQuoteId: quoteId },")],
  ["lib/quotes/importQuote.js", "'Use this one' leaves the trade's old line on the quote", (s) => s.replace("if (other.id === imp.id || comparisonKey(other.label) !== key) continue;", "continue;")],
  ["lib/subcontractors/sourceLink.js", "a sub's cost is booked before the client approves", (s) => s.replace("if (isApprovedChangeOrder(co)) {", "if (true) {")],
  ["lib/subcontractors/sourceLink.js", "a decline leaves the sub's cost on the job", (s) => s.replace('await db.jobSubcontractor.update({ where: { id: row.id }, data: { status: "quoted" } });', "")],
  ["lib/jobs/changeOrderPayment.js", "pay-on-approval bills twice", (s) => s.replace("if (co.invoiceId) return { ok: true, invoiceId: co.invoiceId, created: false };", "")],
];

const backupDir = mkdtempSync(join(tmpdir(), "check-sub-co-"));
const files = [...new Set(MUTATIONS.map(([f]) => f))];
const ORIGINALS = {};
for (const f of files) {
  ORIGINALS[f] = readFileSync(join(ROOT, f), "utf8");
  cpSync(join(ROOT, f), join(backupDir, f.replace(/\//g, "__")));
}
const restore = (f) => cpSync(join(backupDir, f.replace(/\//g, "__")), join(ROOT, f));

let caught = 0;
const escaped = [];
try {
  for (const [file, label, mutate] of MUTATIONS) {
    const mutated = mutate(ORIGINALS[file]);
    if (mutated === ORIGINALS[file]) {
      escaped.push(`${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    writeFileSync(join(ROOT, file), mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, SELF, "--no-mutate"], { stdio: ["ignore", "pipe", "pipe"] });
      survived = true;
    } catch {
      /* non-zero exit = the mutant was caught, which is the point */
    }
    restore(file);
    if (survived) escaped.push(`${label} — NOT caught`);
    else {
      caught++;
      console.log(`  ✓ caught: ${label}`);
    }
  }
} finally {
  for (const f of files) restore(f);
  rmSync(backupDir, { recursive: true, force: true });
}
for (const f of files) ok(`${f} restored byte-for-byte`, readFileSync(join(ROOT, f), "utf8") === ORIGINALS[f]);
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions — a sub's late price reaches the client as a change order, and only the chosen one`,
);
process.exit(fails.length ? 1 : 0);
