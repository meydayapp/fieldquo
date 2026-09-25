// scripts/check-bank-debit-cap.mjs
//
//   npm run check:bank-debit-cap
//
// Stripe caps one Canadian pre-authorized debit at $3,000.00 CAD. On
// 2026-09-19 (req_0ymITOokGO1xzZ) a homeowner tapped "Pay $4,150 from bank
// account" on a client portal and got a 500: the portal rendered the button
// for any amount, the pay route asked Stripe, Stripe answered
// `amount_too_large`, and nothing caught it. This check EXECUTES every layer
// of the fix against a scripted database and a scripted Stripe:
//
//   1. the pure cap — lib/stripe/bankDebit.js;
//   2. GET /api/portal/[token] — the offer per invoice and per stage, and the
//      reason the button is absent;
//   3. POST /api/portal/[token]/pay — refuses over the cap before Stripe is
//      asked, and turns a Stripe throw into JSON the page renders, recorded
//      for /platform/errors, never a 500;
//   4. lib/stripe.js — the session builder refuses over the cap on its own.
//
// The scripted db is local to this file rather than scripts/fixtures/dbStub
// because the portal reads Invoice, Payment and JobPaymentStage — models the
// shared stub does not carry — and a route-level check wants every query it
// makes to be visible here beside the assertions on it.

import { register } from "node:module";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};

// A fake key BEFORE lib/stripe.js is imported: the lazy client constructs
// `new Stripe(key)` on first property access; the resources it exposes are
// patched below so no request ever leaves this process.
process.env.STRIPE_SECRET_KEY = "sk_test_check_bank_debit_cap";
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
// Invoice Checkout names a server-side Payment Method Configuration since
// 2026-09-23 (lib/stripe/invoicePaymentConfiguration.js) and refuses to start
// without one, by design. Test ids, as check-processing-fee.mjs sets them;
// Stripe itself is stubbed below, so they never leave this process.
process.env.STRIPE_INVOICE_PMC_FINANCING_OFF = "pmc_testfinancingoff";
process.env.STRIPE_INVOICE_PMC_FINANCING_ALLOWED = "pmc_testfinancingallowed";

// ── The scripted database ───────────────────────────────────────────────────
//
// Loud, never quiet: a model or method this file did not script throws by
// name, so the check cannot pass because a query it failed to model answered
// "nothing".
const rows = { client: [], invoice: [], payment: [], company: [], jobPaymentStage: [], customField: [], customFieldValue: [], platformErrorLog: [], connectFeeRecovery: [] };
const writes = [];
const matchIn = (v, cond) => {
  if (cond && typeof cond === "object" && !Array.isArray(cond)) {
    if ("in" in cond) return cond.in.includes(v);
    if ("not" in cond) return cond.not === null ? v != null : v !== cond.not;
    return false;
  }
  if (cond === null) return v == null;
  return v === cond;
};
const matches = (row, where = {}) =>
  Object.entries(where).every(([k, v]) => {
    if (k === "OR") return v.some((b) => matches(row, b));
    if (k === "AND") return v.every((b) => matches(row, b));
    return matchIn(row[k], v);
  });
const model = (name) => ({
  findUnique: async ({ where }) => rows[name].find((r) => matches(r, where)) || null,
  findFirst: async ({ where }) => rows[name].find((r) => matches(r, where)) || null,
  findMany: async ({ where } = {}) => rows[name].filter((r) => matches(r, where || {})),
  update: async ({ where, data }) => {
    const row = rows[name].find((r) => matches(r, where));
    if (!row) throw new Error(`stub ${name}.update: no row`);
    Object.assign(row, data);
    writes.push({ model: name, action: "update", data });
    return row;
  },
  create: async ({ data }) => {
    writes.push({ model: name, action: "create", data });
    const row = { id: `${name}_${rows[name].length + 1}`, ...data };
    rows[name].push(row);
    return row;
  },
});
globalThis.__FQ_DB = new Proxy(Object.fromEntries(Object.keys(rows).map((n) => [n, model(n)])), {
  get(target, prop) {
    if (prop in target) return target[prop];
    throw new Error(`dbStub: db.${String(prop)} is not scripted in this check`);
  },
});

const HOOKS = `
const STUBS = { "@/lib/db": "fq-stub:db", "next/server": "fq-stub:next" };
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true, source: \`
export class NextResponse {
  constructor(body, init) { this.body = body; this.status = init?.status ?? 200; }
  static json(body, init) { const r = new NextResponse(body, init); r.json = async () => body; return r; }
}\` };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const bank = await import("@/lib/stripe/bankDebit.js");
const stripeLib = await import("@/lib/stripe.js");
const { GET } = await import("@/app/api/portal/[token]/route.js");
const { POST } = await import("@/app/api/portal/[token]/pay/route.js");

// ── The scripted Stripe ─────────────────────────────────────────────────────
const captured = [];
// Set per case: a function that throws the way the Stripe SDK does, or null.
let stripeThrows = null;
stripeLib.stripe.checkout.sessions.create = async (params, opts) => {
  captured.push({ op: "checkout.sessions.create", params, opts });
  if (stripeThrows) throw stripeThrows();
  return { id: `cs_${captured.length}`, url: "https://checkout.stripe.com/x", ...params };
};
// What the SDK actually threw on 2026-09-19, minus the stack.
const amountTooLarge = () =>
  Object.assign(new Error("The Checkout Session's total amount due must be no more than $3,000.00 CAD for the provided payment method types."), {
    type: "StripeInvalidRequestError",
    code: "amount_too_large",
    requestId: "req_0ymITOokGO1xzZ",
    statusCode: 400,
    rawType: "invalid_request_error",
  });

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 1. The cap, in numbers ─────────────────────────────────────────\n");

ok("PAD is capped at exactly 300,000 cents; ACH carries NO measured cap (null, not a number)",
  bank.BANK_DEBIT_MAX_CENTS.acss_debit === 300_000 && bank.BANK_DEBIT_MAX_CENTS.us_bank_account === null);
ok("acss_debit: 299,999 eligible", bank.bankDebitAmountEligible({ method: "acss_debit", amountCents: 299_999 }) === true);
ok("acss_debit: 300,000 eligible (Stripe accepted it in test mode)", bank.bankDebitAmountEligible({ method: "acss_debit", amountCents: 300_000 }) === true);
ok("acss_debit: 300,001 NOT eligible (Stripe refused it)", bank.bankDebitAmountEligible({ method: "acss_debit", amountCents: 300_001 }) === false);
ok("us_bank_account: no cap — 300,001 and 5,000,000 both eligible",
  bank.bankDebitAmountEligible({ method: "us_bank_account", amountCents: 300_001 }) && bank.bankDebitAmountEligible({ method: "us_bank_account", amountCents: 5_000_000 }));
ok("an unknown method is never eligible", bank.bankDebitAmountEligible({ method: "paypal", amountCents: 1 }) === false && bank.bankDebitAmountEligible({}) === false);
const CA = { stripeBankDebitEnabled: true, currency: "CAD" };
ok("bankDebitOffer: CA company at $4,150 → acss_debit, eligible false, maxCents 300000",
  JSON.stringify(bank.bankDebitOffer({ company: CA, amountCents: 415_000 })) === JSON.stringify({ method: "acss_debit", eligible: false, maxCents: 300_000 }));
ok("  ^ at $3,000 → eligible true", bank.bankDebitOffer({ company: CA, amountCents: 300_000 }).eligible === true);
ok("  ^ a company without the capability → null (no offer, no reason)", bank.bankDebitOffer({ company: { stripeBankDebitEnabled: false, currency: "CAD" }, amountCents: 100 }) === null);
ok("  ^ a US company at $50,000 → us_bank_account, eligible, maxCents null",
  JSON.stringify(bank.bankDebitOffer({ company: { stripeBankDebitEnabled: true, currency: "USD" }, amountCents: 5_000_000 })) === JSON.stringify({ method: "us_bank_account", eligible: true, maxCents: null }));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 2. GET /api/portal/[token]: the offer per invoice and per stage ──\n");

const COMPANY = {
  id: "co1", name: "TrueFinish Cabinets Inc.", currency: "CAD", country: "CA", province: "ON",
  stripeAccountId: "acct_contractor", stripeChargesEnabled: true, stripeBankDebitEnabled: true,
  offerFinancing: true, stripeAffirmStatus: null, defaultLanguage: "en", paymentMethods: null,
  taxRate: null, autoApplyLocalTax: false, vatRegistered: false, usTaxOverrides: null,
};
const invoiceRow = (id, number, total, extra = {}) => ({
  id, invoiceNumber: number, total, amountPaid: 0, status: "sent", sentAt: new Date("2026-09-01"),
  version: 1, parentInvoiceId: null, dueDate: null, lineItems: [], notes: null, subtotal: total, discount: 0,
  tax: 0, taxEnabled: false, taxResolution: null, createdAt: new Date("2026-09-01"), jobPaymentStages: [],
  pendingPaymentAt: null, pendingPaymentFailedAt: null, pendingPaymentMethod: null, pendingPaymentFailure: null,
  clientId: "cl1", companyId: "co1", language: "en", ...extra,
});
const reset = () => {
  rows.company = [{ ...COMPANY }];
  rows.client = [{
    id: "cl1", portalToken: "tok", name: "Homeowner", language: "fr", country: "CA", province: "ON", companyId: "co1", type: "residential",
    company: { ...COMPANY }, quotes: [], invoices: [],
  }];
  rows.invoice = [];
  rows.payment = [];
  rows.jobPaymentStage = [];
  rows.platformErrorLog = [];
  writes.length = 0;
  captured.length = 0;
  stripeThrows = null;
};

reset();
// $4,150 over the cap; $2,500 under it; $12,000 with a $3,000 deposit stage.
const big = invoiceRow("inv_big", "INV-401", 4150);
const small = invoiceRow("inv_small", "INV-402", 2500);
const staged = invoiceRow("inv_staged", "INV-403", 12000, { jobPaymentStages: [{ id: "st1", label: "Deposit", amountCents: 300_000 }] });
rows.client[0].invoices = [big, small, staged];
rows.invoice = [big, small, staged].map((i) => ({ ...i }));
const req = { headers: { get: () => null } };
const getRes = await GET(req, { params: Promise.resolve({ token: "tok" }) });
const body = getRes.body;
ok("the portal GET answers 200 against the fixture", getRes.status === 200, body);
ok("there is no company-level `bankDebit` any more — the answer depends on the amount", !("bankDebit" in body));
const byNo = Object.fromEntries((body.invoices || []).map((i) => [i.invoiceNumber, i]));
ok("$4,150: the offer is present but NOT eligible, with the cap — the page can say why",
  byNo["INV-401"]?.bankDebit?.method === "acss_debit" && byNo["INV-401"].bankDebit.eligible === false && byNo["INV-401"].bankDebit.maxCents === 300_000, byNo["INV-401"]?.bankDebit);
ok("$2,500: eligible", byNo["INV-402"]?.bankDebit?.eligible === true, byNo["INV-402"]?.bankDebit);
ok("$12,000 balance: not eligible — but its $3,000 deposit stage IS",
  byNo["INV-403"]?.bankDebit?.eligible === false && byNo["INV-403"].jobPaymentStages[0].bankDebit.eligible === true, byNo["INV-403"]);
ok("no fee, no Stripe id in the payload", !/application_fee|processingFee|acct_contractor/.test(JSON.stringify(body)));
{
  reset();
  rows.company[0].stripeBankDebitEnabled = false;
  rows.client[0].company.stripeBankDebitEnabled = false;
  rows.client[0].invoices = [invoiceRow("inv_x", "INV-500", 100)];
  rows.invoice = [invoiceRow("inv_x", "INV-500", 100)];
  const r = await GET(req, { params: Promise.resolve({ token: "tok" }) });
  ok("a company without the capability: bankDebit null on the invoice (no button, no sentence)", r.body.invoices[0].bankDebit === null, r.body.invoices[0].bankDebit);
}

// The two portal pages read the offer, not a company flag.
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
for (const f of ["app/portal/[token]/ClientPortal.js", "app/portal/[token]/invoices/[id]/PortalInvoice.js"]) {
  const src = read(f);
  ok(`${f.split("/").pop()}: the bank button renders only when the offer is eligible, and the over-cap sentence otherwise`,
    /bankOffer\?\.eligible \? bankOffer\.method : null/.test(src) && /bankOffer && !bankOffer\.eligible/.test(src) && /copy\.bankOverCap\(money\(bankOffer\.maxCents \/ 100\), money\(due\)\)/.test(src) && !/data\.bankDebit/.test(src));
}
ok("PortalInvoice.js measures a stage's own share against the cap, not the balance", /stage \? stage\.bankDebit : invoice\.bankDebit/.test(read("app/portal/[token]/invoices/[id]/PortalInvoice.js")));
const { CLIENT_DOC_COPY } = await import("@/lib/i18n/clientDocCopy.js");
const { documentFormatters } = await import("@/lib/i18n/documentLabels.js");
const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "it"];
ok("bankOverCap and paymentNotStarted exist in all 8 portal languages, and each differs from English",
  LANGS.every((l) => typeof CLIENT_DOC_COPY[l]?.bankOverCap === "function" && typeof CLIENT_DOC_COPY[l]?.paymentNotStarted === "function") &&
    LANGS.filter((l) => l !== "en").every((l) => CLIENT_DOC_COPY[l].bankOverCap("A", "B") !== CLIENT_DOC_COPY.en.bankOverCap("A", "B") && CLIENT_DOC_COPY[l].paymentNotStarted("X") !== CLIENT_DOC_COPY.en.paymentNotStarted("X")));
ok("  ^ every language prints both figures and the company name",
  LANGS.every((l) => { const s = CLIENT_DOC_COPY[l].bankOverCap("$3,000.00", "$4,150.00"); return s.includes("$3,000.00") && s.includes("$4,150.00"); }) &&
    LANGS.every((l) => CLIENT_DOC_COPY[l].paymentNotStarted("TrueFinish").includes("TrueFinish")));
ok("  ^ the English sentence is the one specified",
  CLIENT_DOC_COPY.en.bankOverCap("$3,000.00", "$4,150.00") === "Bank debit is available up to $3,000.00 per payment — this invoice is $4,150.00, so it's card only." &&
    CLIENT_DOC_COPY.en.paymentNotStarted("TrueFinish") === "This payment couldn't be started — please try by card, or contact TrueFinish.");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 3. POST /api/portal/[token]/pay: refused in words, never a 500 ────\n");

const post = (bodyObj) => POST(
  { headers: { get: () => null }, json: async () => bodyObj },
  { params: Promise.resolve({ token: "tok" }) },
);

{
  reset();
  rows.invoice = [{ ...invoiceRow("inv_big", "INV-401", 4150), client: rows.client[0] }];
  const r = await post({ invoiceId: "inv_big", method: "bank" });
  ok("$4,150 by bank: 400 BEFORE Stripe is asked (no session created)", r.status === 400 && captured.length === 0, { status: r.status, captured: captured.length });
  // Formatted the way the page formats it — fr-CA prints "3 000,00 $" with
  // Intl's own spacing, which is not the space bar's.
  const { money: frMoney } = documentFormatters("fr", "CAD");
  ok("  ^ in the client's language (fr), with both figures — the same sentence the page shows",
    r.body.error === CLIENT_DOC_COPY.fr.bankOverCap(frMoney(3000), frMoney(4150)) && /3.000,00.\$/.test(r.body.error), r.body);
}
{
  reset();
  rows.invoice = [{ ...invoiceRow("inv_small", "INV-402", 2500), client: rows.client[0] }];
  const r = await post({ invoiceId: "inv_small", method: "bank" });
  ok("$2,500 by bank: a PAD session, as before", r.status === 200 && r.body.checkoutUrl && captured[0].params.payment_method_types.join() === "acss_debit", { status: r.status, body: r.body });
}
{
  reset();
  rows.invoice = [{ ...invoiceRow("inv_staged", "INV-403", 12000), client: rows.client[0] }];
  rows.jobPaymentStage = [{ id: "st1", companyId: "co1", invoiceId: "inv_staged", status: "requested", amountCents: 300_000 }];
  const r = await post({ invoiceId: "inv_staged", stageId: "st1", method: "bank" });
  ok("the $3,000 deposit stage of a $12,000 invoice by bank: allowed — the cap is measured against the stage's share",
    r.status === 200 && captured[0].params.line_items[0].price_data.unit_amount === 300_000, { status: r.status, body: r.body });
  captured.length = 0;
  const r2 = await post({ invoiceId: "inv_staged", method: "bank" });
  ok("  ^ the same invoice's full balance by bank: refused", r2.status === 400 && captured.length === 0, r2.body);
}
{
  reset();
  rows.invoice = [{ ...invoiceRow("inv_big", "INV-401", 4150), client: rows.client[0] }];
  const r = await post({ invoiceId: "inv_big", method: "card" });
  // Since 2026-09-23 a non-bank invoice session is Dynamic Payment Methods:
  // no method list, the server-chosen Payment Method Configuration instead
  // (lib/stripe/invoicePaymentConfiguration.js). The cap must leave it alone.
  const p = captured[0]?.params;
  ok("$4,150 by card: unaffected — the normal dynamic-methods session, not a bank debit",
    r.status === 200 && /^pmc_/.test(p?.payment_method_configuration || "") && p?.payment_method_types === undefined,
    { status: r.status, pmc: p?.payment_method_configuration, types: p?.payment_method_types });
}
{
  // Stripe throws anyway — the guard was bypassed, or a cap moved. The
  // homeowner gets a sentence and the office gets the row.
  reset();
  rows.invoice = [{ ...invoiceRow("inv_small", "INV-402", 2500), client: rows.client[0] }];
  stripeThrows = amountTooLarge;
  let r; let threw = null;
  try { r = await post({ invoiceId: "inv_small", method: "bank" }); } catch (e) { threw = e; }
  ok("a Stripe `amount_too_large` (StripeInvalidRequestError) never throws out of the route", threw === null, threw?.message);
  ok("  ^ answers 400 JSON with the plain sentence, in the client's language, naming the company",
    r?.status === 400 && r.body.error === CLIENT_DOC_COPY.fr.paymentNotStarted("TrueFinish Cabinets Inc."), r?.body);
  ok("  ^ Stripe's own wording never reaches the homeowner", !/payment method types|amount_too_large|Checkout Session/.test(r?.body?.error || ""));
  const logged = writes.find((w) => w.model === "platformErrorLog");
  ok("  ^ recorded for /platform/errors: area stripe_checkout, code amount_too_large, invoice, method, amount, Stripe request id, company",
    logged?.data.area === "stripe_checkout" && logged.data.code === "amount_too_large" && logged.data.companyId === "co1" &&
      logged.data.detail.invoiceId === "inv_small" && logged.data.detail.method === "acss_debit" && logged.data.detail.amountCents === 250_000 && logged.data.detail.requestId === "req_0ymITOokGO1xzZ", logged);
}
{
  reset();
  rows.invoice = [{ ...invoiceRow("inv_small", "INV-402", 2500), client: rows.client[0] }];
  stripeThrows = () => Object.assign(new Error("An error occurred with our connection to Stripe."), { type: "StripeConnectionError", code: undefined, requestId: undefined });
  const r = await post({ invoiceId: "inv_small", method: "card" });
  ok("a Stripe connection failure: 502 JSON with the same sentence, recorded under its type", r.status === 502 && r.body.error === CLIENT_DOC_COPY.fr.paymentNotStarted("TrueFinish Cabinets Inc.") && writes.some((w) => w.model === "platformErrorLog" && w.data.code === "StripeConnectionError"), r.body);
}
{
  reset();
  rows.invoice = [{ ...invoiceRow("inv_paid", "INV-404", 100, { amountPaid: 100 }), client: rows.client[0] }];
  rows.payment = [{ id: "p1", invoiceId: "inv_paid", amount: 100, refundedAmount: 0, disputeStatus: null, status: "succeeded" }];
  const r = await post({ invoiceId: "inv_paid", method: "card" });
  ok("our own refusal from the session builder (already paid) passes through as its own 400, not the Stripe sentence, and is not logged",
    r.status === 400 && /already paid/.test(r.body.error) && !writes.some((w) => w.model === "platformErrorLog"), r.body);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 4. lib/stripe.js: the session builder refuses over the cap on its own ─\n");

{
  captured.length = 0;
  let err = null;
  try {
    await stripeLib.createInvoiceCheckoutSession({ invoice: { id: "i", invoiceNumber: "X", total: 3000.01, amountPaid: 0, client: { type: "residential" } }, company: COMPANY, successUrl: "s", cancelUrl: "c", method: "acss_debit" }, { ledger: async () => 0 });
  } catch (e) { err = e; }
  ok("$3,000.01 by acss_debit throws status 400, code bank_debit_over_cap, without calling Stripe",
    err?.status === 400 && err.code === "bank_debit_over_cap" && err.maxCents === 300_000 && err.amountCents === 300_001 && captured.length === 0, { message: err?.message, captured: captured.length });
  ok("  ^ the message is a sentence with both figures, not Stripe's", /\$3,000\.00/.test(err?.message) && /\$3,000\.01/.test(err?.message) && !/payment method types/.test(err?.message), err?.message);
  captured.length = 0; err = null;
  try {
    await stripeLib.createInvoiceCheckoutSession({ invoice: { id: "i", invoiceNumber: "X", total: 3000, amountPaid: 0, client: { type: "residential" } }, company: COMPANY, successUrl: "s", cancelUrl: "c", method: "acss_debit" }, { ledger: async () => 0 });
  } catch (e) { err = e; }
  ok("$3,000.00 by acss_debit creates the session", err === null && captured.length === 1 && captured[0].params.line_items[0].price_data.unit_amount === 300_000, err?.message);
  captured.length = 0; err = null;
  try {
    await stripeLib.createInvoiceCheckoutSession({ invoice: { id: "i", invoiceNumber: "X", total: 50000, amountPaid: 0, client: { type: "residential" } }, company: { ...COMPANY, currency: "USD" }, successUrl: "s", cancelUrl: "c", method: "us_bank_account" }, { ledger: async () => 0 });
  } catch (e) { err = e; }
  ok("$50,000 by us_bank_account: no cap here, the session is created", err === null && captured.length === 1, err?.message);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
