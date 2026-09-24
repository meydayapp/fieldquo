// scripts/check-invoice-builder.mjs
//
// One document look (2026-09-23): the invoice is drawn by the quote's
// document builder, the priced lines carry a cost, and an invoice gets the
// AI review and the deep read. This is where each of those is proved
// rather than asserted.
//
//   npm run check:invoice-builder
//
// ── 1. Payload identity ─────────────────────────────────────────────────────
//
// The two invoice forms' request literals (app/app/invoices/new/page.js and
// app/app/invoices/[id]/edit/page.js, kept verbatim behind ?layout=classic)
// left the components for lib/invoices/builderRequest.js. Section 1 runs a
// fixture state through those functions and through a TRANSCRIPT of the
// literals they replaced, and requires the md5s to match — for the POST,
// the PATCH and the offline queue's payload.
//
// ── 2. The lines' cost ──────────────────────────────────────────────────────
//
// lib/costing/lineItemCost.js executed against junk, and the estimator
// proved to add the figure to the cost and to echo it — for a quote
// (estimateQuoteCost) and an invoice (invoiceCostSummary). A catalogue line
// carries Product.costPrice as its unitCost; a product with none adds no key.
//
// ── 3. The invoice's checks ─────────────────────────────────────────────────
//
// lib/invoices/completeness.js against an invoice missing everything, one
// missing nothing, and junk.
//
// ── 4. The wiring, read from the source ─────────────────────────────────────
//
// The routes default to the document builder and keep the classic form
// reachable; the review route gates on checkAiQuota BEFORE the model and
// meters AFTER; the deep read reserves BEFORE the vendor and refunds into
// the same wallet; the two invoice save routes hand the lines to the cost
// row; the schema carries the columns.
//
// ── 5. It renders ───────────────────────────────────────────────────────────
//
// InvoiceBuilderForm in create and edit, through DocumentBuilder, over the
// same providers check-doc-builder renders the quote with: the document
// frame, the masthead word in the invoice's own language, the totals, the
// cost drawer for a member who may cost, the line table open, the dock —
// and the quote's own render still says kind="quote".
//
// Bundled through esbuild like check-doc-builder (the components are JSX).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { invoiceCreateBody, invoicePatchBody, invoiceOfflinePayload } from "../lib/invoices/builderRequest.js";
import { lineCost, lineItemCostOf, scopeGroupsLineItemCost, markupPct, priceFromMarkup } from "../lib/costing/lineItemCost.js";
import { estimateQuoteCost } from "../lib/costing/estimateJobCost.js";
import { invoiceCostSummary } from "../lib/costing/actualJobCost.js";
import { lineFromProduct } from "../lib/quotes/lineDetail.js";
import { invoiceCompletenessChecks, invoiceReadinessScore } from "../lib/invoices/completeness.js";
import { InvoiceBuilderForm, initialStateFromInvoice, invoiceLinesFromStored } from "../app/components/invoices/builder/InvoiceBuilder.js";
import { QuoteBuilderForm, initialStateFromQuote } from "../app/components/quotes/builder/QuoteBuilder.js";
import { LanguageProvider } from "../app/providers/LanguageProvider.js";
import { PermissionProvider } from "../app/providers/PermissionProvider.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let passed = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) passed++;
  else fails.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);
};
const eq = (label, got, want) => ok(label, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}`);
const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
const src = (p) => readFileSync(join(process.cwd(), p), "utf8");
const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

// ───────────────────────────────────────────────────────────────────────────
console.log("1. payload identity — builderRequest vs the two forms' literals");
// ───────────────────────────────────────────────────────────────────────────

/** app/app/invoices/new/page.js handleSave's POST literal, transcribed. Do not "improve" it. */
function legacyCreate({ selectedClient, jobId, labour, taxEnabled, taxRate, lineItems, subtotal, tax, total, notes, clientPhotos, dueDate, status, costing }) {
  return {
    clientId: selectedClient.id,
    ...(jobId ? { jobId } : {}),
    ...(labour ? { labour, taxRatePct: taxEnabled ? taxRate : 0 } : {}),
    lineItems,
    subtotal,
    tax,
    taxEnabled,
    total,
    notes,
    clientPhotos,
    dueDate: dueDate || null,
    status,
    ...(costing ? { costing } : {}),
  };
}
/** app/app/invoices/[id]/edit/page.js save's PATCH literal, transcribed. */
function legacyPatch({ lineItems, totals, discount, taxEnabled, dueDate, notes, clientPhotos, costing, isDraft, changeReason }) {
  return {
    lineItems: lineItems
      .filter((li) => String(li.description || "").trim())
      .map((li) => ({ ...li, quantity: num(li.quantity) || 1, rate: num(li.rate), amount: num(li.amount) })),
    subtotal: totals.subtotal,
    discount: num(discount),
    tax: totals.tax,
    taxEnabled,
    total: totals.total,
    dueDate: dueDate || undefined,
    notes,
    clientPhotos,
    ...(costing ? { costing } : {}),
    ...(isDraft ? {} : { changeReason: changeReason.trim() }),
  };
}
/** app/app/invoices/new/page.js queueOffline's payload literal, transcribed. */
function legacyOffline({ selectedClient, jobId, lineItems, labour, taxEnabled, notes, dueDate, language, status, clientPhotos, photoKeys }) {
  return {
    clientId: selectedClient.id,
    clientName: selectedClient.name,
    jobId: jobId || null,
    lineItems: lineItems.filter((li) => li.description.trim()),
    labour,
    taxEnabled,
    notes,
    dueDate: dueDate || null,
    language,
    send: status === "sent",
    clientPhotos: clientPhotos.filter((p) => !p.offlineKey),
    photoKeys,
  };
}

const client = { id: "cl_1", name: "Alice Fortin", email: "a@example.com" };
const lines = [
  { description: "Laundry room cabinets — 9 lin. ft", quantity: 9, unit: "flat", rate: 470, amount: 4230, unitCost: 210 },
  { description: "", quantity: 1, unit: "flat", rate: 0, amount: 0 },
  { description: "Installation", quantity: 1, unit: "flat", rate: "830", amount: "830" },
];
const costing = { crew: [{ id: "w1", name: "Ana", rate: 40, hours: 18 }], materialCost: "1840", overheadPct: 10, note: "" };
const photos = [{ url: "https://res.cloudinary.com/demo/a.jpg", kind: "photo" }, { url: "blob:x", kind: "photo", offlineKey: "k1" }];

const createCases = [
  ["POST, from a job with the labour line and a cost panel", { selectedClient: client, jobId: "j_1", labour: { timeEntryIds: ["te_1", "te_2"], rateKey: "company" }, taxEnabled: true, taxRate: 14.975, lineItems: lines, subtotal: 5060, tax: 757.74, total: 5817.74, notes: "Net 30", clientPhotos: photos.slice(0, 1), dueDate: "2026-10-14", status: "sent", costing }],
  ["POST, plain, no job, no panel", { selectedClient: client, jobId: null, labour: null, taxEnabled: false, taxRate: 0, lineItems: lines, subtotal: 5060, tax: 0, total: 5060, notes: "", clientPhotos: [], dueDate: "", status: "draft", costing: null }],
];
for (const [label, s] of createCases) {
  const legacy = legacyCreate(s);
  const now = invoiceCreateBody({ clientId: s.selectedClient.id, jobId: s.jobId, labour: s.labour, taxRate: s.taxRate, lineItems: s.lineItems, subtotal: s.subtotal, tax: s.tax, taxEnabled: s.taxEnabled, total: s.total, notes: s.notes, clientPhotos: s.clientPhotos, dueDate: s.dueDate, status: s.status, costing: s.costing, discount: 0 });
  ok(`${label}: md5 identical`, md5(legacy) === md5(now), `legacy ${md5(legacy)} now ${md5(now)}`);
  console.log(`  md5  ${label}: ${md5(now)}`);
}
eq(
  "POST key order",
  Object.keys(invoiceCreateBody({ ...createCases[0][1], clientId: "c", discount: 0 })),
  ["clientId", "jobId", "labour", "taxRatePct", "lineItems", "subtotal", "tax", "taxEnabled", "total", "notes", "clientPhotos", "dueDate", "status", "costing"],
);
// The one new key, and where it sits: after subtotal, only when above zero.
eq("POST with a discount carries it after subtotal", Object.keys(invoiceCreateBody({ ...createCases[1][1], clientId: "c", discount: 120 })).slice(0, 4), ["clientId", "lineItems", "subtotal", "discount"]);
ok("POST with an empty discount carries no discount key", !("discount" in invoiceCreateBody({ ...createCases[1][1], clientId: "c", discount: "" })));
ok("POST with a junk discount carries no discount key", !("discount" in invoiceCreateBody({ ...createCases[1][1], clientId: "c", discount: "abc" })));
ok("the labour block is ids and a key, never an amount", (() => { const b = invoiceCreateBody({ ...createCases[0][1], clientId: "c" }); return Object.keys(b.labour).sort().join() === "rateKey,timeEntryIds"; })());

const patchCases = [
  ["PATCH, a draft, edited in place", { lineItems: lines, totals: { subtotal: 5060, tax: 757.74, total: 5817.74 }, discount: "0", taxEnabled: true, dueDate: "2026-10-14", notes: "Net 30", clientPhotos: photos.slice(0, 1), costing, isDraft: true, changeReason: "" }],
  ["PATCH, a sent invoice, a new version with its reason", { lineItems: lines, totals: { subtotal: 5060, tax: 757.74, total: 5817.74 }, discount: 250, taxEnabled: true, dueDate: "", notes: "", clientPhotos: [], costing: null, isDraft: false, changeReason: "  Client added a second bathroom " }],
];
for (const [label, s] of patchCases) {
  const legacy = legacyPatch(s);
  const now = invoicePatchBody({ lineItems: s.lineItems, subtotal: s.totals.subtotal, discount: s.discount, tax: s.totals.tax, taxEnabled: s.taxEnabled, total: s.totals.total, dueDate: s.dueDate, notes: s.notes, clientPhotos: s.clientPhotos, costing: s.costing, isDraft: s.isDraft, changeReason: s.changeReason });
  ok(`${label}: md5 identical`, md5(legacy) === md5(now), `legacy ${md5(legacy)} now ${md5(now)}`);
  console.log(`  md5  ${label}: ${md5(now)}`);
}
eq(
  "PATCH key order",
  Object.keys(invoicePatchBody({ lineItems: lines, subtotal: 1, discount: 0, tax: 0, taxEnabled: true, total: 1, dueDate: "2026-10-14", notes: "", clientPhotos: [], costing, isDraft: false, changeReason: "x" })),
  ["lineItems", "subtotal", "discount", "tax", "taxEnabled", "total", "dueDate", "notes", "clientPhotos", "costing", "changeReason"],
);
{
  const b = invoicePatchBody({ lineItems: lines, subtotal: 1, discount: 0, tax: 0, taxEnabled: true, total: 1, dueDate: "", notes: "", clientPhotos: [], costing: null, isDraft: true });
  ok("PATCH drops the blank row and keeps every other key on a line (unitCost rides through)", b.lineItems.length === 2 && b.lineItems[0].unitCost === 210 && b.lineItems[1].rate === 830 && b.lineItems[1].amount === 830);
  ok("PATCH with no due date sends none (JSON drops undefined)", !("dueDate" in JSON.parse(JSON.stringify(b))));
}

const offlineState = { selectedClient: client, jobId: "j_1", lineItems: lines, labour: { timeEntryIds: ["te_1"], rateKey: "company" }, taxEnabled: true, notes: "", dueDate: "", language: "fr", status: "sent", clientPhotos: photos, photoKeys: ["k1"] };
{
  const legacy = legacyOffline(offlineState);
  const now = invoiceOfflinePayload({ clientId: client.id, clientName: client.name, jobId: offlineState.jobId, lineItems: offlineState.lineItems, labour: offlineState.labour, taxEnabled: true, notes: "", dueDate: "", language: "fr", send: true, clientPhotos: photos.filter((p) => !p.offlineKey), photoKeys: ["k1"] });
  ok("offline payload: md5 identical", md5(legacy) === md5(now), `legacy ${md5(legacy)} now ${md5(now)}`);
  console.log(`  md5  offline payload: ${md5(now)}`);
  ok("offline payload carries no money", !("subtotal" in now) && !("tax" in now) && !("total" in now));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("2. the lines' cost — executed, then through both estimators");
// ───────────────────────────────────────────────────────────────────────────
eq("a line's cost is quantity × unitCost", lineCost({ quantity: 3, unitCost: 12.5 }), 37.5);
eq("a stored line with no quantity costs as one", lineCost({ unitCost: 40 }), 40);
eq("no unitCost → 0", lineCost({ quantity: 3, rate: 100 }), 0);
eq("a negative cost is not a cost", lineCost({ quantity: 3, unitCost: -5 }), 0);
eq("junk → 0", [lineCost(null), lineCost("x"), lineCost({ unitCost: "abc", quantity: NaN }), lineCost({ unitCost: Infinity })], [0, 0, 0, 0]);
eq("a list sums and rounds to the cent", lineItemCostOf([{ quantity: 3, unitCost: 0.1 }, { quantity: 3, unitCost: 0.2 }, null, "x"]), 0.9);
eq("groups sum their own lines, junk tolerated", scopeGroupsLineItemCost([{ lineItems: [{ quantity: 2, unitCost: 100 }] }, { lineItems: "nope" }, null, { lineItems: [{ quantity: 1, unitCost: 50.005 }] }]), 250.01);
eq("markup: 120 → 168 is 40%", markupPct(120, 168), 40);
eq("markup over nothing is null, not 0", markupPct(0, 168), null);
eq("a free line over a real cost is −100%", markupPct(50, 0), -100);
eq("price from a markup", priceFromMarkup(120, 40), 168);
eq("price from a markup with no cost is null", priceFromMarkup(0, 40), null);

{
  const base = { scopeGroups: [], labourRatePerHour: 35, price: 1000, overheadPctOfPrice: 10, manualLabourHours: 4, manualMaterialCost: 100 };
  const without = estimateQuoteCost(base);
  const withCost = estimateQuoteCost({ ...base, lineItemCost: 250 });
  eq("estimateQuoteCost: no lineItemCost → the figure it always gave", [without.lineItemCost, without.estimatedCost], [0, 340]);
  eq("estimateQuoteCost: the lines' cost is added and echoed", [withCost.lineItemCost, withCost.estimatedCost, withCost.profit], [250, 590, 410]);
  ok("estimateQuoteCost: a negative or junk lineItemCost is 0", estimateQuoteCost({ ...base, lineItemCost: -9 }).estimatedCost === 340 && estimateQuoteCost({ ...base, lineItemCost: "x" }).estimatedCost === 340);
  const inv = invoiceCostSummary({ crew: [{ name: "Ana", rate: 40, hours: 10 }], materialCost: 100, overheadPct: 10, price: 2000, lineItemCost: 300 });
  eq("invoiceCostSummary: labour + materials + overhead + lines", [inv.labourCost, inv.materialTotal, inv.overhead, inv.lineItemCost, inv.estimatedCost], [400, 100, 200, 300, 1000]);
  eq("invoiceCostSummary: without the lines' cost, as before", invoiceCostSummary({ crew: [{ name: "Ana", rate: 40, hours: 10 }], materialCost: 100, overheadPct: 10, price: 2000 }).estimatedCost, 700);
}
{
  const p = { name: "Soft-Close Hinges", unitPrice: 35, costPrice: 14.5, unit: "door" };
  eq("a catalogue line opens with the product's cost", lineFromProduct(p, {}).unitCost, 14.5);
  ok("a product with no cost adds no key", !("unitCost" in lineFromProduct({ name: "Rush fee", unitPrice: 50 }, {})));
  ok("a product with a zero or junk cost adds no key", !("unitCost" in lineFromProduct({ ...p, costPrice: 0 }, {})) && !("unitCost" in lineFromProduct({ ...p, costPrice: "abc" }, {})));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("3. the invoice's own checks");
// ───────────────────────────────────────────────────────────────────────────
{
  const bare = invoiceCompletenessChecks({ client: {}, dueDate: null, subtotal: 1000, discount: 300, tax: 0, taxEnabled: true, total: 700, clientPhotos: [], quote: { quoteNumber: "Q-1", total: 1200, acceptedTotal: null } }, [
    { description: "Labour", amount: 500 },
    { description: "Doors", amount: 0 },
    { description: "Exclusions", kind: "text", amount: 0 },
  ]).map((c) => c.id);
  eq("missing everything → every finding, and the text block is never a $0 line", bare.sort(), ["deep_discount", "no_client_email", "no_due_date", "no_photos", "tax_unresolved", "total_differs", "vague_items", "zero_lines"].sort());
  const fine = invoiceCompletenessChecks({ client: { email: "a@b.c" }, dueDate: "2026-10-14", subtotal: 1200, discount: 0, tax: 156, taxEnabled: true, total: 1356, clientPhotos: [{ url: "x", kind: "photo" }], quote: { quoteNumber: "Q-1", total: 1200, acceptedTotal: 1356 } }, [
    { description: "Laundry room cabinets — 9 lin. ft, painted shaker", amount: 1200 },
  ]);
  eq("missing nothing → no finding", fine, []);
  eq("tax switched off is not unresolved", invoiceCompletenessChecks({ client: { email: "a@b.c" }, dueDate: "2026-10-14", subtotal: 100, tax: 0, taxEnabled: false, total: 100, clientPhotos: [{ url: "x", kind: "photo" }] }, [{ description: "A perfectly clear line item", amount: 100 }]), []);
  eq("no lines at all → no_items", invoiceCompletenessChecks({ client: { email: "a@b.c" }, dueDate: "2026-10-14", subtotal: 0, tax: 0, taxEnabled: true, total: 0, clientPhotos: [{ url: "x", kind: "photo" }] }, []).map((c) => c.id), ["no_items"]);
  ok("junk never throws", Array.isArray(invoiceCompletenessChecks(null, "nope")) && Array.isArray(invoiceCompletenessChecks({ clientPhotos: 42 }, [null, 7, {}])));
  eq("readiness weights: 100 − 22 − 10 − 4", invoiceReadinessScore([{ severity: "high" }, { severity: "medium" }, { severity: "low" }, {}]), 64);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("4. the wiring, read from the source");
// ───────────────────────────────────────────────────────────────────────────
{
  const newPage = src("app/app/invoices/new/page.js");
  const editPage = src("app/app/invoices/[id]/edit/page.js");
  ok("new invoice defaults to the document builder", /<InvoiceBuilder mode="create"/.test(newPage));
  ok("…and keeps the classic form on the same route behind ?layout=classic", /layout"\) === "classic"/.test(newPage) && /export function ClassicNewInvoicePage/.test(newPage));
  ok("…handing the job and the client over from useSearchParams, as the form read them", /clientId=\{searchParams\.get\("clientId"\)\} jobId=\{searchParams\.get\("jobId"\)\}/.test(newPage));
  ok("edit invoice defaults to the document builder", /<InvoiceBuilder mode="edit" invoiceId=\{id\}/.test(editPage));
  ok("…and keeps the classic form behind ?layout=classic", /=== "classic"/.test(editPage) && /export function ClassicEditInvoicePage/.test(editPage));

  const builder = src("app/components/quotes/builder/DocumentBuilder.js");
  ok("DocumentBuilder takes a kind, defaulting to quote", /export default function DocumentBuilder\(\{ b, kind = "quote" \}\)/.test(builder));
  ok("DocumentBuilder stamps the kind on the layout root", builder.includes('data-document-kind={kind}'));
  ok("the cost drawer opens by itself from lg up, decided in an effect", /window\.matchMedia\("\(min-width: 1024px\)"\)\.matches\) setCostOpen\(true\)/.test(builder));
  const invBuilder = src("app/components/invoices/builder/InvoiceBuilder.js");
  ok("InvoiceBuilder draws through DocumentBuilder as an invoice", /<DocumentBuilder\s+kind="invoice"/.test(invBuilder));
  ok("InvoiceBuilder never builds a request body inline — it calls builderRequest", /invoiceCreateBody\(/.test(invBuilder) && /invoicePatchBody\(/.test(invBuilder) && /invoiceOfflinePayload\(/.test(invBuilder) && !/clientId: selectedClient\.id,\n\s+\.\.\.\(jobId/.test(invBuilder));
  ok("InvoiceBuilder loads the cost panel at the top of the screen, not in the drawer", /useInvoiceCosting\(isEdit \? invoiceId : null, setCosting\)/.test(invBuilder));
  ok("the classic cost card uses the same hook", /useInvoiceCosting\(invoiceId, onChange\)/.test(src("app/components/invoices/InvoiceCostSection.js")));

  const review = src("app/api/invoices/[id]/review/route.js");
  ok("review route: quota checked BEFORE the model", review.indexOf("checkAiQuota(") > 0 && review.indexOf("checkAiQuota(") < review.indexOf("reviewInvoice({"));
  ok("review route: usage metered through recordAiUsage", /recordAiUsage\(\{/.test(review) && /feature: "invoice_review"/.test(review));
  ok("review route: stored, then counted", review.indexOf('recordFeatureUse("ai_review_run"') > review.indexOf("data: { aiReview: review"));
  const deep = src("app/api/invoices/[id]/deep-read/route.js");
  ok("deep read: reserved BEFORE the vendor, refunded into the same wallet", deep.indexOf("reserveSpend({") < deep.indexOf("runVisionPass({") && /forKind: "image_vision"/.test(deep));
  ok("deep read: the photo count is checked before any credit moves", deep.indexOf("photosFromQuote(invoice).length") < deep.indexOf("reserveSpend({"));
  ok("deep read: the 402 carries the top-up offer", /status: 402/.test(deep) && /publicTopupOffer\(/.test(deep));
  ok("deep read: the invoice's own lines are the context", /services: invoiceServicesContext\(invoice\)/.test(deep));
  const panel = src("app/components/invoices/InvoiceReviewPanel.js");
  ok("the panel opens the top-up dialog on a 402 with an offer", /err\.status === 402 && err\.data\?\.topup/.test(panel) && /topup\.open\(err\.data\)/.test(panel));
  ok("the panel names the deep read's price in the credit currency", /formatAppMoney\(VISION_PASS_CENTS \/ 100, CREDIT_CURRENCY, language\)/.test(panel));

  ok("POST /api/invoices hands the lines to the cost row", /lineItems,\n\s+\}\)/.test(src("app/api/invoices/route.js")));
  ok("PATCH /api/invoices/[id] hands the lines to the cost row and carries the column onto a new version", /lineItems: lineItems !== undefined \? lineItems : existing\.lineItems/.test(src("app/api/invoices/[id]/route.js")) && /lineItemCost: existing\.costing\.lineItemCost/.test(src("app/api/invoices/[id]/route.js")));
  ok("the quote's cost row sums the groups' own lines", /lineItemCost: scopeGroupsLineItemCost\(scopeGroups\)/.test(src("app/api/quotes/costingWrite.js")));
  ok("the derived fallback reads the stored lines too", /lineItems: true,/.test(src("lib/costing/quoteCostEstimate.js")) && /scopeGroupsLineItemCost\(quote\.scopeGroups\)/.test(src("lib/costing/quoteCostEstimate.js")));
  const schema = src("prisma/schema.prisma");
  ok("schema: Invoice carries aiReview, aiReviewedAt, aiVisionPasses", /model Invoice \{[\s\S]*?aiReview\s+Json\?[\s\S]*?aiReviewedAt DateTime\?[\s\S]*?aiVisionPasses Json\?[\s\S]*?\n\}/.test(schema));
  ok("schema: QuoteCosting and InvoiceCosting carry lineItemCost", (schema.match(/lineItemCost\s+Decimal @default\(0\) @db\.Decimal\(12, 2\)/g) || []).length === 2);
  const table = src("app/components/quotes/builder/LineItemsTable.js");
  ok("the line table: a % beside the price opens the popover, only for a member who may see money", /showPricing && \(\s*<button[\s\S]*?data-cost-markup-toggle/.test(table));
  ok("the popover writes only unitCost and rate, through the table's own onChange", /onChange\(index, "unitCost", next\)/.test(table) && /onChange\(index, "rate", priceFromMarkup/.test(table) && !/onChange\(index, "markup"/.test(table));
  const cmp = src("app/components/quotes/builder/CostMarginPanel.js");
  ok("the profit card is drawn from the same estimate the rows print", /<ProfitMarginCard estimate=\{estimate\} subtotal=\{subtotal\}/.test(cmp));
  ok("the lines' cost row prints only above zero", /\{estimate\.lineItemCost > 0 && \(/.test(cmp));

  // Every new string in the nine languages.
  const keys = [...new Set([...(invBuilder + panel + builder + table + cmp).matchAll(/t\(\s*"(app\.(?:invoiceBuilder|invoiceReview|cost|lineItems|access)\.[a-zA-Z0-9.]+)"/g)].map((m) => m[1]))];
  ok("the change has strings of its own to check", keys.length > 20, String(keys.length));
  for (const lang of Object.keys(APP_MESSAGES)) {
    const missing = keys.filter((k) => !(k in APP_MESSAGES[lang]));
    ok(`every key exists in ${lang}`, missing.length === 0, missing.join(", "));
  }
}

// ───────────────────────────────────────────────────────────────────────────
console.log("5. it renders — create, edit, junk, and the quote still says quote");
// ───────────────────────────────────────────────────────────────────────────
const COMPANY = { name: "Érable Design", address: "1420 boul. Curé-Labelle, Laval QC", phone: "+1 450 555 0180", email: "info@example.com", brandColor: "#1d4ed8", country: "CA", province: "QC", currency: "CAD", taxRate: 14.975 };
const BOOT = {
  clients: [{ id: "cl_1", name: "Alice Fortin", email: "a@example.com", address: "1 Main St", country: "CA", province: "QC" }],
  products: [{ id: "p1", name: "Rush fee", unitPrice: 200, costPrice: 80, unit: "flat", categories: [] }],
  company: COMPANY,
  companyCurrency: "CAD",
  companyLanguage: "en",
  taxConfig: { taxRate: 14.975, autoApplyLocalTax: true, taxRates: [], country: "CA", province: "QC", vatRegistered: null, usTaxOverrides: null },
  jobId: null,
  labourOffer: null,
};
const INVOICE = {
  id: "inv_1",
  invoiceNumber: "INV-2069",
  status: "sent",
  version: 1,
  client: BOOT.clients[0],
  lineItems: [
    { description: "Laundry room cabinets — 9 lin. ft", quantity: 9, amount: 4230 },
    { name: "Legacy row", quantity: 2, unitPrice: 50, total: 100 },
    { description: "Exclusions", detail: "No **drywall** repair.", quantity: 1, rate: 0, amount: 0, kind: "text", priceMode: "none" },
  ],
  subtotal: 4330,
  discount: 0,
  tax: 648.42,
  total: 4978.42,
  taxEnabled: true,
  dueDate: "2026-10-14T00:00:00.000Z",
  notes: "Net 30.",
  clientPhotos: [],
  language: "fr",
  amountPaid: 1000,
  createdAt: "2026-09-10T00:00:00.000Z",
  sentAt: "2026-09-10T00:00:00.000Z",
};
{
  const lines = invoiceLinesFromStored(INVOICE.lineItems);
  eq("legacy name / unitPrice / total rows read as lines, keys kept", [lines[1].description, lines[1].rate, lines[1].amount, lines[1].name], ["Legacy row", 50, 100, "Legacy row"]);
  eq("a row with amount and no rate derives the rate", lines[0].rate, 470);
  const st = initialStateFromInvoice(INVOICE);
  eq("the exact rate the invoice was written with", Math.round(st.exactTaxRate * 1000) / 1000, 14.975);
  eq("a sent invoice is not a draft, and its money paid is carried", [st.isDraft, st.amountPaid, st.dueDate], [false, 1000, "2026-10-14"]);
  ok("junk columns never throw", Boolean(initialStateFromInvoice({ id: "x", lineItems: "nope", clientPhotos: 42, subtotal: "abc" })));
}
function render(mode, initial, { role = "owner", permissions = {}, lang = "en", boot = BOOT } = {}) {
  return renderToStaticMarkup(
    <LanguageProvider initialLanguage={lang}>
      <PermissionProvider role={role} permissions={permissions}>
        <InvoiceBuilderForm mode={mode} invoiceId={mode === "edit" ? "inv_1" : null} bootstrap={boot} initial={initial} />
      </PermissionProvider>
    </LanguageProvider>,
  );
}
const CASES = [
  ["create, nothing entered", "create", initialStateFromInvoice(null)],
  ["create, from a job with the labour offer", "create", { ...initialStateFromInvoice(null), client: BOOT.clients[0] }, { ...BOOT, jobId: "j_1", labourOffer: { job: { id: "j_1", title: "Fortin laundry", clientId: "cl_1" }, hours: 6.5, entries: [{ id: "te_1" }], byWorker: [{ name: "Ana", hours: 6.5 }], rates: [{ key: "company", rate: 85, source: "company" }], skipped: { open: 0, billed: 0 } } }],
  ["edit, a sent French invoice with a legacy row and a text block", "edit", initialStateFromInvoice(INVOICE)],
  ["edit, junk in every column", "edit", initialStateFromInvoice({ id: "inv_1", lineItems: "nope", clientPhotos: 42, client: null, status: "paid" })],
];
for (const [label, mode, initial, boot] of CASES) {
  let html = "";
  try {
    html = render(mode, initial, { boot: boot || BOOT });
  } catch (err) {
    fails.push(`render (${label}): ${err.message}`);
    continue;
  }
  ok(`renders as the document (${label})`, html.includes('data-builder-layout="document"') && html.includes('data-document-kind="invoice"') && html.includes("data-doc-editor"), `${html.length} chars`);
  ok(`the masthead, the parties and the totals (${label})`, html.includes("data-doc-masthead") && html.includes("data-doc-parties") && html.includes("data-doc-totals"));
  ok(`one tab, the invoice's (${label})`, html.includes('data-doc-tab="estimate"') && !html.includes('data-doc-tab="workorder"') && !html.includes('data-doc-tab="presentation"'));
  ok(`no quote-only furniture (${label})`, !html.includes("data-doc-add-service") && !html.includes("data-doc-process") && !html.includes("data-doc-staff-strip") && !html.includes("data-estimate-type-first"));
  ok(`the cost drawer toggle is offered (${label})`, html.includes("data-cost-drawer-toggle"));
  ok(`the photos box and the review panel are on the screen (${label})`, html.includes("data-photos-box") && html.includes("data-invoice-review-panel"));
  ok(`no NaN anywhere (${label})`, !/NaN/.test(html));
  ok(`the dock prints a total (${label})`, /data-totals-figure/.test(html));
}
{
  const create = render("create", initialStateFromInvoice(null));
  ok("create: the masthead says INVOICE in the document's language", create.includes(">Invoice<") || create.includes("Invoice</div>"));
  ok("create: the client picker is open where the client will print", create.includes('data-tour="client-picker"'));
  ok("create: the line card opens on its table with the cost / markup control", create.includes("data-doc-group-editor") && create.includes("data-cost-markup-toggle"));
  ok("create: Save & review is offered on the dock", create.includes(APP_MESSAGES.en["app.quoteNew.reviewShort"]));
  const job = render("create", CASES[1][2], { boot: CASES[1][3] });
  ok("create from a job: the clocked-hours offer is above the document", job.includes("data-labour-offer") && job.includes("6.5 h"));
  const edit = render("edit", initialStateFromInvoice(INVOICE));
  ok("edit: a French invoice prints Facture", edit.includes("Facture") && edit.includes("Préparé pour"));
  // React escapes the apostrophe (&#x27;), so the label is matched either way.
  ok("edit: the number and the due date", edit.includes("INV-2069") && /Date d(&#x27;|')échéance/.test(edit));
  ok("edit: a sent invoice shows the new-version notice and asks for a reason", edit.includes("data-invoice-version-banner") && edit.includes("data-change-reason"));
  ok("edit: the legacy row prints as a line with its money", edit.includes("Legacy row") && edit.includes("$100.00"));
  ok("edit: the text block's rich body is drawn", edit.includes("<strong>drywall</strong>"));
  ok("edit: the total the dock prints is the stored one", edit.includes("$4,978.42"));
  const cannot = render("edit", initialStateFromInvoice(INVOICE), { role: "employee", permissions: { jobCosting: false } });
  ok("a member who may not cost gets no drawer toggle", !cannot.includes("data-cost-drawer-toggle"));
  ok("…but still the document", cannot.includes('data-document-kind="invoice"'));
}
// The quote is untouched: its render still says kind="quote" with its tabs.
{
  const quote = renderToStaticMarkup(
    <LanguageProvider initialLanguage="en">
      <PermissionProvider role="owner" permissions={{}}>
        <QuoteBuilderForm mode="create" quoteId={null} bootstrap={{ clients: [], categories: [{ id: "cat1", key: "stairs", label: "Stairs", enabled: true }], products: [], workers: [], members: [], recipeOverrides: {}, companyLanguage: "en", companyCurrency: "CAD", taxConfig: { taxRate: 13, taxRates: [] }, company: COMPANY, layout: "document" }} initial={initialStateFromQuote(null)} />
      </PermissionProvider>
    </LanguageProvider>,
  );
  ok("a quote still renders as kind=quote with its four tabs", quote.includes('data-document-kind="quote"') && ["estimate", "presentation", "workorder", "notes"].every((k) => quote.includes(`data-doc-tab="${k}"`)));
  ok("a quote still offers its service tiles and its staff strip", quote.includes("data-doc-add-service") && quote.includes("data-doc-staff-strip"));
}

console.log(`\n${fails.length ? "✗" : "✓"} invoice builder: ${passed} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exit(fails.length ? 1 : 0);
