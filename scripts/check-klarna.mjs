// scripts/check-klarna.mjs
//
//   npm run check:klarna
//
// Klarna beside Affirm, from what production showed on 2026-10-09: Klarna
// ALREADY appears on TrueFinish's hosted Stripe Checkout (CA$6,500 invoice:
// Card / Klarna / Apple Pay) because invoice Checkout uses Stripe's dynamic
// payment methods, while Affirm was refused by Stripe on the same account.
// So this checks what was missing, and that nothing that worked was moved:
//
//   1. the provider table — per-currency pay-over-time ranges, at, under
//      and over each bound;
//   2. the ONE offer rule — opted in AND Stripe's status `active` AND the
//      amount in range; pending / inactive / unavailable / null never offer;
//   3. Affirm's exports unchanged by the shared helper;
//   4. capability status and the request on the poll;
//   5. the hosted invoice session left exactly as it was (dynamic, no
//      provider named) — Klarna is not added to a session that shows it;
//   6. fee pass-through for a Klarna payment, at Stripe's cost, with its own
//      label on the transfer reversal and the payment row;
//   7. the portal's card-fee path keeps a pay-over-time button for Klarna,
//      for the server-stored figure;
//   8. the settings poll, EXECUTED: Stripe's answers for both providers, the
//      support message, the financing-note warning, read-only impersonation;
//   9. copy in every app and client language;
//  10. mutants of the key rules, each caught.
//
// Run with the db / member stubs: node --import ./scripts/alias-loader.mjs
// --import ./scripts/db-stub-loader.mjs --import ./scripts/member-stub-loader.mjs

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

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
const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

process.env.STRIPE_SECRET_KEY = "sk_test_check_klarna";
process.env.STRIPE_INVOICE_PMC_FINANCING_OFF = "pmc_testfinancingoff";
process.env.STRIPE_INVOICE_PMC_FINANCING_ALLOWED = "pmc_testfinancingallowed";

const fin = await import("@/lib/stripe/financingMethods.js");
const affirm = await import("@/lib/stripe/affirm.js");
const fees = await import("@/lib/stripe/processingFee.js");

// ── The suites the mutants re-run ────────────────────────────────────────────
// Each takes a module and an assert, so the same assertions run against the
// shipped file and against a broken copy of it.
const KLARNA_ACTIVE = { offerFinancing: true, stripeAffirmStatus: "inactive", stripeKlarnaStatus: "active" };

async function eligibilitySuite(m, t) {
  const el = (cents, currency) => m.financingAmountEligible("klarna", { amountCents: cents, currency });
  // CAD: Pay in 4 1–1,500 and Financing 250–17,500 → one span 1.00–17,500.00
  t("CAD: under the floor ($0.99) is no", !el(99, "cad"));
  t("CAD: at the floor ($1.00) is yes", el(100, "cad"));
  t("CAD: $1,500 (Pay in 4 ceiling) is yes", el(150_000, "cad"));
  t("CAD: $1,500.01 (only Financing covers it) is yes", el(150_001, "cad"));
  t("CAD: $6,500 (TrueFinish's INV-2026-0024) is yes", el(650_000, "cad"));
  t("CAD: at the ceiling ($17,500.00) is yes", el(1_750_000, "cad"));
  t("CAD: over the ceiling ($17,500.01) is no", !el(1_750_001, "cad"));
  // USD: Pay in 4 1–2,000 and Financing 45–10,000 → 1.00–10,000.00
  t("USD: under the floor ($0.99) is no", !el(99, "usd"));
  t("USD: at the floor ($1.00) is yes", el(100, "usd"));
  t("USD: at the ceiling ($10,000.00) is yes", el(1_000_000, "usd"));
  t("USD: over the ceiling ($10,000.01) is no", !el(1_000_001, "usd"));
  t("USD: $12,000 (in CAD range, over USD) is no", !el(1_200_000, "usd"));
  t("a currency Klarna is not set up for here (GBP, EUR, AUD) is no", !el(100_000, "gbp") && !el(100_000, "eur") && !el(100_000, "aud"));
  t("zero, negative, NaN and a string are no", !el(0, "cad") && !el(-500, "cad") && !el(NaN, "cad") && !el("abc", "cad"));
  t("currency case does not matter", el(650_000, "CAD"));

  const off = (company, cents = 650_000, currency = "cad") => m.financingOffered("klarna", { company, amountCents: cents, currency });
  t("offered: opted in + Klarna active + in range", off(KLARNA_ACTIVE));
  t("not offered: Klarna pending", !off({ ...KLARNA_ACTIVE, stripeKlarnaStatus: "pending" }));
  t("not offered: Klarna inactive", !off({ ...KLARNA_ACTIVE, stripeKlarnaStatus: "inactive" }));
  t("not offered: Klarna unavailable", !off({ ...KLARNA_ACTIVE, stripeKlarnaStatus: "unavailable" }));
  t("not offered: Klarna never requested (null)", !off({ ...KLARNA_ACTIVE, stripeKlarnaStatus: null }));
  t("not offered: financing switched off, even with Klarna active", !off({ ...KLARNA_ACTIVE, offerFinancing: false }));
  t("not offered: active but over the range", !off(KLARNA_ACTIVE, 1_750_001));
  t("not offered: Affirm's column does not open Klarna", !off({ offerFinancing: true, stripeAffirmStatus: "active", stripeKlarnaStatus: "inactive" }));
  const list = (company, cents = 650_000) => m.offeredFinancingMethods({ company, amountCents: cents, currency: "cad" });
  t("TrueFinish-like (Affirm refused, Klarna active), $6,500: [klarna]", list(KLARNA_ACTIVE).join() === "klarna");
  t("both active, $6,500: [affirm, klarna] in that order", list({ ...KLARNA_ACTIVE, stripeAffirmStatus: "active" }).join() === "affirm,klarna");
  t("both active, $25,000: Affirm only (Klarna stops at $17,500)", list({ ...KLARNA_ACTIVE, stripeAffirmStatus: "active" }, 2_500_000).join() === "affirm");
  t("both active, $20: Klarna only (Affirm starts at $50)", list({ ...KLARNA_ACTIVE, stripeAffirmStatus: "active" }, 2_000).join() === "klarna");
  t("financing off: []", list({ ...KLARNA_ACTIVE, offerFinancing: false }).length === 0);
}

async function statusSuite(m, t) {
  const st = (caps, country = "CA") => m.financingStatusFor("klarna", { country, capabilities: caps });
  t("klarna_payments active / pending / inactive read straight off the account", st({ klarna_payments: "active" }) === "active" && st({ klarna_payments: "pending" }) === "pending" && st({ klarna_payments: "inactive" }) === "inactive");
  t("a capability object's \"disabled\" reads as inactive", st({ klarna_payments: "disabled" }) === "inactive");
  t("not requested on a CA/US account is null, not inactive", st({}) === null && st({}, "US") === null);
  t("a country not served here is unavailable", st({ klarna_payments: "active" }, "GB") === "unavailable");
  t("null account → null, never a throw", m.financingStatusFor("klarna", null) === null);
  t("Klarna's status never reads Affirm's capability", st({ affirm_payments: "active" }) === null);
  const cols = m.financingStatusColumns({ country: "CA", capabilities: { affirm_payments: "inactive", klarna_payments: "active" } });
  t("financingStatusColumns writes BOTH columns, each from its own capability", cols.stripeAffirmStatus === "inactive" && cols.stripeKlarnaStatus === "active");
}

async function noteSuite(m, t) {
  const named = (note, url = null, enabled = true) => m.financingNoteNamedProviders({ enabled, note, url });
  const warn = (note, company, url = null) => m.financingNoteProviderWarnings({ financing: { enabled: true, note, url }, company }).map((p) => p.key).join();
  const TF_NOTE = "We offer financing through Affirm and Klarna";
  t("TrueFinish's note names Affirm and Klarna", named(TF_NOTE).map((p) => p.key).join() === "affirm,klarna");
  t("  ^ with Affirm refused and Klarna active, only Affirm is flagged", warn(TF_NOTE, KLARNA_ACTIVE) === "affirm");
  t("  ^ with financing off, both are flagged", warn(TF_NOTE, { ...KLARNA_ACTIVE, offerFinancing: false }) === "affirm,klarna");
  t("  ^ with both active, nothing is flagged", warn(TF_NOTE, { ...KLARNA_ACTIVE, stripeAffirmStatus: "active" }) === "");
  t("Afterpay (not integrated) is always flagged", warn("Pay later with Afterpay", { ...KLARNA_ACTIVE, stripeAffirmStatus: "active" }) === "afterpay");
  t("a hand-off link to the provider's own site is the contractor's arrangement — not flagged", warn("Apply with Klarna", { offerFinancing: false }, "https://www.klarna.com/ca/apply") === "");
  t("whole words only: 'reaffirm' is not Affirm", named("We reaffirm our warranty").length === 0);
  t("case does not matter", named("KLARNA available").map((p) => p.key).join() === "klarna");
  t("financing switched off on the quote → nothing named", named(TF_NOTE, null, false).length === 0);
  t("a malformed url is ignored, not a throw", named("Klarna", "not a url").map((p) => p.key).join() === "klarna");
}

const quiet = async (suite, mod) => {
  let failures = 0;
  await suite(mod, (_n, cond) => { if (!cond) failures++; });
  return failures;
};

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 1–2. Klarna's ranges and the one offer rule ──────────────────────\n");
await eligibilitySuite(fin, ok);
{
  const k = fin.FINANCING_PROVIDERS.klarna;
  ok("Klarna's Connect capability is klarna_payments, its column stripeKlarnaStatus", k.capability === "klarna_payments" && k.statusColumn === "stripeKlarnaStatus");
  ok("bounds: CAD 1.00–17,500.00, USD 1.00–10,000.00",
    JSON.stringify(fin.financingBounds("klarna", "cad")) === JSON.stringify({ minCents: 100, maxCents: 1_750_000 }) &&
      JSON.stringify(fin.financingBounds("klarna", "usd")) === JSON.stringify({ minCents: 100, maxCents: 1_000_000 }));
  ok("Klarna's own options are the documented ones: CAD Financing 250–17,500, USD Financing 45–10,000",
    fin.financingRanges("klarna", "cad").find((r) => r.option === "financing").minCents === 25_000 &&
      fin.financingRanges("klarna", "usd").find((r) => r.option === "financing").minCents === 4_500);
  ok("isFinancingMethod: affirm and klarna yes; card, bank, '' no", fin.isFinancingMethod("affirm") && fin.isFinancingMethod("klarna") && !fin.isFinancingMethod("card") && !fin.isFinancingMethod("acss_debit") && !fin.isFinancingMethod(""));
}

console.log("\n── 3. Affirm, through the shared helper, unchanged ───────────────────\n");
ok("AFFIRM_CAPABILITY / bounds / statuses as before", affirm.AFFIRM_CAPABILITY === "affirm_payments" && affirm.AFFIRM_MIN_CENTS === 5_000 && affirm.AFFIRM_MAX_CENTS === 3_000_000 && affirm.AFFIRM_STATUSES.join() === "active,pending,inactive,unavailable");
ok("affirmAmountEligible: $50–$30,000 inclusive, USD/CAD only",
  affirm.affirmAmountEligible({ amountCents: 5000, currency: "cad" }) && affirm.affirmAmountEligible({ amountCents: 3_000_000, currency: "usd" }) &&
    !affirm.affirmAmountEligible({ amountCents: 4999, currency: "cad" }) && !affirm.affirmAmountEligible({ amountCents: 3_000_001, currency: "usd" }) &&
    !affirm.affirmAmountEligible({ amountCents: 100_000, currency: "gbp" }));
ok("affirmOffered reads stripeAffirmStatus only — Klarna active does not offer Affirm",
  !affirm.affirmOffered({ company: KLARNA_ACTIVE, amountCents: 650_000, currency: "cad" }) &&
    affirm.affirmOffered({ company: { ...KLARNA_ACTIVE, stripeAffirmStatus: "active" }, amountCents: 650_000, currency: "cad" }));
ok("summariseAffirmCapability keeps its three keys (no new key leaks into `affirm`)",
  Object.keys(affirm.summariseAffirmCapability(null)).sort().join() === "disabledReason,pendingVerification,requirements");

console.log("\n── 4. Capability status, and the request on the poll ────────────────\n");
await statusSuite(fin, ok);
const stripeLib = await import("@/lib/stripe.js");
{
  const calls = [];
  const fake = { accounts: { update: async (id, p) => { calls.push({ id, p }); return { id, ...p }; } } };
  const READY = { card_payments: "active", transfers: "active", acss_debit_payments: "active" };
  await stripeLib.ensureChargeCapabilities({ id: "acct_ca", country: "CA", capabilities: READY }, { stripe: fake, company: { offerFinancing: true } });
  ok("financing ON, nothing requested yet: affirm_payments AND klarna_payments requested, in one update",
    calls.length === 1 && Object.keys(calls[0].p.capabilities).sort().join() === "affirm_payments,klarna_payments");
  calls.length = 0;
  await stripeLib.ensureChargeCapabilities({ id: "acct_tf", country: "CA", capabilities: { ...READY, affirm_payments: "inactive", klarna_payments: "active" } }, { stripe: fake, company: { offerFinancing: true } });
  ok("TrueFinish-like (both already on the account): NOTHING requested — Stripe's answers are left alone", calls.length === 0);
  await stripeLib.ensureChargeCapabilities({ id: "acct_off", country: "CA", capabilities: READY }, { stripe: fake, company: { offerFinancing: false } });
  ok("financing OFF: nothing requested", calls.length === 0);
  await stripeLib.ensureChargeCapabilities({ id: "acct_gb", country: "GB", capabilities: { card_payments: "active", transfers: "active" } }, { stripe: fake, company: { offerFinancing: true } });
  ok("a UK account: not requested (Stripe would reject it)", calls.length === 0);
}

console.log("\n── 5. The hosted invoice session is left exactly as it was ──────────\n");
{
  const captured = [];
  stripeLib.stripe.checkout.sessions.create = async (params, opts) => { captured.push({ params, opts }); return { id: "cs_1", url: "https://checkout.stripe.com/x" }; };
  const company = { id: "co_tf", stripeAccountId: "acct_tf", currency: "CAD", isDemo: false, ...KLARNA_ACTIVE };
  await stripeLib.createInvoiceCheckoutSession({ invoice: { id: "inv24", invoiceNumber: "INV-2026-0024", total: 6500, amountPaid: 0 }, company, successUrl: "s", cancelUrl: "c" }, { ledger: async () => 0 });
  const p = captured[0].params;
  ok("CA$6,500, financing on: dynamic payment methods through the ALLOWED configuration — how Klarna shows there today",
    p.payment_method_configuration === "pmc_testfinancingallowed" && !("payment_method_types" in p));
  ok("  ^ no provider is named in the session (Klarna is not added to a session that already shows it)", !/klarna|affirm/i.test(JSON.stringify(p)));
  ok("  ^ priced at the card estimate, contractor as destination and on_behalf_of",
    p.payment_intent_data.application_fee_amount === fees.processingFeeCents({ amountCents: 650_000, currency: "cad", method: "card" }) &&
      p.payment_intent_data.transfer_data.destination === "acct_tf" && p.payment_intent_data.on_behalf_of === "acct_tf");
  let refused = null;
  try { await stripeLib.createInvoiceCheckoutSession({ invoice: { id: "i", invoiceNumber: "X", total: 6500, amountPaid: 0 }, company, successUrl: "s", cancelUrl: "c", method: "klarna" }, { ledger: async () => 0 }); } catch (e) { refused = e; }
  ok("no new Klarna-only session type exists: method 'klarna' is still refused as unknown", refused?.status === 400 && /Unsupported payment method/.test(refused.message));
}

console.log("\n── 6. A Klarna payment's fee: Stripe's cost, passed through at cost ──\n");
const { settledFeeFor, trueUpDescription } = await import("@/lib/stripe/paymentIntentFee.js");
const { feeRateKey } = await import("@/lib/stripe/feeRateKey.js");
async function settle({ amount, stripeFee, type = "klarna", currency = "cad" }) {
  const est = fees.processingFeeCents({ amountCents: amount, currency, method: "card" });
  const log = [];
  const intent = {
    id: `pi_${type}_${amount}_${stripeFee}`, currency, amount, amount_received: amount, application_fee_amount: est,
    metadata: { fq_fee_estimate_cents: String(est), fq_recovery_cents: "0", companyId: "co_tf" },
    latest_charge: { id: "ch", payment_method_details: { type }, balance_transaction: { fee: stripeFee }, transfer: "tr_1" },
  };
  const client = {
    paymentIntents: { retrieve: async () => intent },
    transfers: { createReversal: async (tr, params, opts) => { log.push({ tr, params, opts }); return { id: "trr" }; } },
  };
  return { est, fee: await settledFeeFor(intent, { stripe: client }), log };
}
{
  const published = fees.publishedFinancingFeeCents({ amountCents: 650_000, currency: "cad", method: "klarna" });
  ok("Stripe's published Klarna fee on CA$6,500 is $389.65 (5.99% + $0.30)", published === 38_965, published);
  ok("FINANCING_RATES: Klarna 5.99% + $0.30, Affirm 6% + $0.30, CAD and USD",
    fees.FINANCING_RATES.klarna.basisPoints === 599 && fees.FINANCING_RATES.klarna.fixedCents === 30 && fees.FINANCING_RATES.affirm.basisPoints === 600 &&
      fees.FINANCING_RATES.klarna.currencies.join() === "cad,usd");
  ok("  ^ and they are NOT charge-creation rates — processingFeeCents still refuses 'klarna' (no session is priced at it)", (() => { try { fees.processingFeeCents({ amountCents: 1000, currency: "cad", method: "klarna" }); return false; } catch { return true; } })());
  ok("publishedFinancingFeeCents: null for an unknown method or currency, 0 for nothing",
    fees.publishedFinancingFeeCents({ amountCents: 1000, currency: "gbp", method: "klarna" }) === null &&
      fees.publishedFinancingFeeCents({ amountCents: 1000, currency: "cad", method: "card" }) === null &&
      fees.publishedFinancingFeeCents({ amountCents: 0, currency: "cad", method: "klarna" }) === 0);

  const { est, fee, log } = await settle({ amount: 650_000, stripeFee: published });
  ok("hosted-page Klarna payment, CA$6,500: card estimate $195.30 at creation", est === 19_530);
  ok("  ^ settled fee = Stripe's actual Klarna fee exactly ($389.65): the contractor pays Stripe's cost", fee.processingFeeCents === 38_965 && fee.stripeFeeCents === 38_965, fee);
  ok("  ^ FieldQuo keeps nothing on Klarna (no card margin): fee − Stripe's fee = 0", fee.processingFeeCents - fee.stripeFeeCents === 0);
  ok("  ^ the difference ($194.35) is reversed out of the transfer, once (idempotent per intent)",
    log.length === 1 && log[0].params.amount === 19_435 && log[0].opts.idempotencyKey === `fq-fee-trueup-${"pi_klarna_650000_38965"}`);
  ok("  ^ the reversal says what it is — 'Klarna processing fee', not 'Card processing surcharge'",
    /^Klarna processing fee/.test(log[0].params.description) && !/card/i.test(log[0].params.description), log[0].params.description);
  ok("  ^ net to the contractor $6,110.35; the payment row's label is 'klarna'", fee.netCents === 611_035 && fee.feeRateLabel === "klarna");
  ok("  ^ and the screens name it 'Klarna', not 'payment' (feeRateKey)", feeRateKey("klarna") === "klarna" && feeRateKey("sofort") === "other");

  const intl = await settle({ amount: 650_000, stripeFee: 38_965 + 9_750 });
  ok("an international Klarna payment (+1.5%) passes through too: the contractor bears Stripe's $487.15", intl.fee.processingFeeCents === 48_715);
  const usd = await settle({ amount: 200_000, stripeFee: fees.publishedFinancingFeeCents({ amountCents: 200_000, currency: "usd", method: "klarna" }), currency: "usd" });
  ok("US$2,000 by Klarna: $120.10 (5.99% + $0.30) at cost", usd.fee.processingFeeCents === 12_010 && usd.fee.processingFeeCents === usd.fee.stripeFeeCents);
  const card = await settle({ amount: 226_000, stripeFee: 8392, type: "card" });
  ok("a card payment's true-up is unchanged: still 'Card processing surcharge', margin kept ($2.26)",
    /^Card processing surcharge/.test(card.log[0].params.description) && card.fee.processingFeeCents - 8392 === 226);
  ok("Affirm's reversal wording is unchanged", trueUpDescription("affirm") === "Affirm processing fee (pay-over-time, chosen at checkout)");

  // The settings card's side-by-side (ProcessingFeesCard), on the owner's
  // $1,000 — computed by the real functions, and the Klarna figure held to
  // what SETTLEMENT actually leaves the contractor for that payment.
  const ex = fees.financingFeeExample({ amountCents: 100_000, currency: "cad" });
  const k = ex.providers.find((p) => p.method === "klarna");
  const a = ex.providers.find((p) => p.method === "affirm");
  ok("fees card, $1,000: by card $30.30 fee → $969.70 reaches the contractor", ex.card.feeCents === 3_030 && ex.card.netCents === 96_970, ex.card);
  ok("  ^ by Klarna $60.20 fee → $939.80", k.feeCents === 6_020 && k.netCents === 93_980, k);
  ok("  ^ by Affirm $60.30 fee → $939.70", a.feeCents === 6_030 && a.netCents === 93_970, a);
  ok("  ^ Klarna listed first, then Affirm (the card's order)", ex.providers.map((p) => p.method).join() === "klarna,affirm");
  const settled1000 = await settle({ amount: 100_000, stripeFee: k.feeCents });
  ok("  ^ and settlement of a domestic $1,000 Klarna payment leaves exactly that $939.80 (the card's example is the real outcome)",
    settled1000.fee.netCents === k.netCents && settled1000.fee.processingFeeCents === k.feeCents, settled1000.fee);
  ok("  ^ USD gives the same figures; a currency with no pay-over-time rate gives no block (null)",
    fees.financingFeeExample({ amountCents: 100_000, currency: "usd" }).providers.find((p) => p.method === "klarna").netCents === 93_980 &&
      fees.financingFeeExample({ amountCents: 100_000, currency: "gbp" }) === null);
  ok("  ^ Stripe's local-payment-method surcharges: +1.5% international, +2% conversion",
    fees.FINANCING_SURCHARGES.international.formula === "+1.5%" && fees.FINANCING_SURCHARGES.conversion.formula === "+2%");
  const feesCard = stripComments(read("app/app/settings/payments/ProcessingFeesCard.js"));
  ok("  ^ the card renders financingFeeExample on $1,000 whenever the currency has a rate — not only with financing on",
    /financingFeeExample\(\{\s*amountCents: FINANCING_EXAMPLE_CENTS/.test(feesCard) && /const FINANCING_EXAMPLE_CENTS = 100_000;/.test(feesCard) &&
      /\{financingExample && \(/.test(feesCard) && !/offerFinancing && \(\s*<p data-financing/.test(feesCard));
  ok("  ^ and cites Klarna's rules (docs.stripe.com/payments/klarna/compliance)", /https:\/\/docs\.stripe\.com\/payments\/klarna\/compliance/.test(feesCard) && /feesFinancingNoPassOn/.test(feesCard));
}

console.log("\n── 7. The portal names pay-over-time, card fee or not ──────────────\n");
{
  const portal = stripComments(read("app/api/portal/[token]/route.js"));
  const inv = stripComments(read("app/portal/[token]/invoices/[id]/PortalInvoice.js"));
  const index = stripComments(read("app/portal/[token]/ClientPortal.js"));
  ok("portal GET: financing for an amount comes from offeredFinancingMethods (the ONE rule) — online payments, not a demo, card fee or not",
    /const financingFor = \(amountCents\) =>\s*financingCurrency && onlinePayments && !demoPayments\s*\?\s*offeredFinancingMethods\(\{ company: client\.company, amountCents, currency: financingCurrency \}\)\s*:\s*\[\]/.test(portal));
  ok("  ^ for the balance, each stage's share and each request's figure — all server-derived",
    /financing: financingFor\(invoiceBalanceCents\(invoice\)\)/.test(portal) &&
      /amountCents: left, bankDebit: offerFor\(left\), financing: financingFor\(left\) \}/.test(portal) &&
      /\{ id: r\.id, amountCents: left, bankDebit: offerFor\(left\), financing: financingFor\(left\) \}/.test(portal));
  ok("  ^ the Klarna column is stripped from `company` (never reaches the browser)", /stripeKlarnaStatus: _stripeKlarnaStatus,/.test(portal));
  ok("  ^ the old company-level `affirm` flag is gone (it hid Klarna whenever Affirm was refused)", !/affirm: onlineOptions\(client\.company\)\.affirm/.test(portal));
  ok("invoice page: the button renders on financing.length alone (NOT gated on the card fee), for the figure the page asks for",
    /\{financing\.length > 0 && \(/.test(inv) && !/cardFee && financing\.length/.test(inv) && /const financingOffer = asking != null \? picked\.financing : invoice\.financing;/.test(inv));
  ok("  ^ it opens the SAME hosted Checkout (method \"card\", its own spinner) — no amount, no provider in the body",
    /data-pay-over-time=\{financing\.join\(","\)\}\s*onClick=\{\(\) => pay\("card", "overTime"\)\}/.test(inv) && /async function pay\(method = "card", busy = method\)/.test(inv));
  ok("  ^ the 'no credit card fee' sentence only where there is a card fee (otherwise it would invent one)",
    /\{cardFee && \(\s*<p[^>]*>\s*\{copy\.cardFee\.payOverTimeNote\}/.test(inv));
  ok("  ^ the main card button is unchanged (fill accent, text accentOn, pay(\"card\") or the card form)",
    /onClick=\{\(\) => \(cardFee \? setCardOpen\(true\) : pay\("card"\)\)\}/.test(inv) && /style=\{\{ backgroundColor: accent, color: accentOn \}\}/.test(inv));
  ok("portal index: the same named button for each invoice's balance, same size as Pay, ids only",
    /\{financing\.length > 0 && \(/.test(index) && /onClick=\{\(\) => pay\(inv\.id, "card", `\$\{inv\.id\}:overTime`\)\}/.test(index) &&
      /data-pay-over-time[\s\S]{0,300}px-5 py-2\.5 rounded-full text-sm font-semibold border/.test(index) &&
      /body: jsonBody\(\{ invoiceId, method \}, "payment"\)/.test(index));
  const body = inv.slice(inv.indexOf("body: jsonBody("), inv.indexOf("\"payment\"", inv.indexOf("body: jsonBody(")));
  ok("  ^ the pay request carries ids and the method only — never a money figure (non-negotiable #5)",
    /invoiceId,/.test(body) && /stageId:/.test(body) && /requestId:/.test(body) && /method,/.test(body) && !/amount|cents|total/i.test(body), body);
  ok("  ^ the button is as large as the card button (py-3 text-sm font-bold), not a footnote",
    /data-pay-over-time[\s\S]{0,400}py-3 rounded-full text-sm font-bold border/.test(inv));
  ok("the card form itself is untouched by this change (CardPayPanel keeps its own method list)", !/klarna|financing/i.test(read("app/portal/[token]/CardPayPanel.js")));

  // The figure: the pay route charges a request's figure from its ROW,
  // never from the browser — executed against a scripted db.
  const { requestShareCents } = await import("@/lib/portal/payableInvoice.js");
  const fakeDb = { invoicePaymentRequest: { findFirst: async ({ where }) => (where.id === "req1" && where.status === "open" && where.companyId === "co_tf" && where.invoiceId === "inv24" ? { amountCents: 300_000, paidCentsAtRequest: 0 } : null) } };
  const current = { id: "inv24", total: 6500, amountPaid: 0 };
  const share = await requestShareCents(fakeDb, { companyId: "co_tf", current, requestId: "req1" });
  ok("a $3,000 payment request on the $6,500 invoice: the charge is the ROW's $3,000", share === 300_000, share);
  ok("  ^ and with it Klarna is offered for $3,000 (the server's figure), the pay route re-derives the same",
    fin.offeredFinancingMethods({ company: KLARNA_ACTIVE, amountCents: share, currency: "cad" }).join() === "klarna");
  const other = await requestShareCents(fakeDb, { companyId: "co_other", current, requestId: "req1" });
  ok("  ^ another company's request id names nothing (undefined → the balance)", other === undefined);
}

console.log("\n── 8. The settings poll, executed ────────────────────────────────────\n");
{
  const dbStub = await import("@/lib/db");
  const memberStub = await import("@/lib/currentMember");
  const { GET } = await import("@/app/api/stripe/connect/status/route.js");
  const TF = {
    id: "cmu1q1h8z00090agm63aey1fl", stripeAccountId: "acct_1TrueFinish", stripeOnboarded: true, stripeChargesEnabled: false,
    stripeBankDebitEnabled: false, offerFinancing: true, stripeAffirmStatus: "inactive", stripeKlarnaStatus: null,
    financing: { enabled: true, note: "We offer financing through Affirm and Klarna", url: null },
  };
  const ACCOUNT = {
    id: "acct_1TrueFinish", country: "CA", charges_enabled: false, details_submitted: true, payouts_enabled: false,
    capabilities: { card_payments: "active", transfers: "active", acss_debit_payments: "pending", affirm_payments: "inactive", klarna_payments: "active" },
    requirements: { currently_due: [], past_due: [], pending_verification: [] },
  };
  const capReads = [];
  stripeLib.stripe.accounts.retrieve = async () => ACCOUNT;
  stripeLib.stripe.accounts.update = async () => { throw new Error("must not request anything for this account"); };
  stripeLib.stripe.accounts.retrieveCapability = async (id, cap) => {
    capReads.push(cap);
    return { id: cap, status: "inactive", requirements: { currently_due: [], past_due: [], pending_verification: [], disabled_reason: cap === "affirm_payments" ? "rejected.unsupported_business" : null } };
  };
  const run = async (member, row = TF) => {
    dbStub.rows.company = [{ ...row }];
    dbStub.writes.length = 0;
    memberStub.setCurrentMember(member);
    const res = await GET(new Request("https://app.fieldquo.com/api/stripe/connect/status"));
    return { status: res.status, body: await res.json(), writes: dbStub.writes.filter((w) => w.model === "company") };
  };
  const OWNER = { id: "m1", userId: "u1", companyId: TF.id, role: "owner" };
  const r = await run(OWNER);
  ok("owner, TrueFinish-like account: 200", r.status === 200, r.body);
  ok("  ^ Klarna's status is Stripe's answer: active", r.body.klarna?.status === "active", r.body.klarna);
  ok("  ^ Affirm's is Stripe's answer: inactive", r.body.affirm?.status === "inactive");
  ok("  ^ the capability object is read for Affirm (inactive) and NOT for an active Klarna", capReads.join() === "affirm_payments", capReads);
  ok("  ^ stripeKlarnaStatus is written from that answer", r.writes.some((w) => w.data.stripeKlarnaStatus === "active"), r.writes);
  ok("  ^ the support message for Affirm names the account id, the capability and Stripe's reason code",
    /acct_1TrueFinish/.test(r.body.financingSupport?.affirm || "") && /affirm_payments/.test(r.body.financingSupport.affirm) && /rejected\.unsupported_business/.test(r.body.financingSupport.affirm));
  ok("  ^ no support message for Klarna (active — nothing to ask)", r.body.financingSupport?.klarna === null);
  ok("  ^ the note's providers are named (Affirm, Klarna) and only Affirm is unofferable now",
    r.body.financingNoteProviders?.map((p) => p.key).join() === "affirm,klarna" &&
      fin.unofferedNamedProviders(r.body.financingNoteProviders, { offerFinancing: true, stripeAffirmStatus: r.body.affirm.status, stripeKlarnaStatus: r.body.klarna.status }).map((p) => p.key).join() === "affirm");
  ok("  ^ the note itself is never sent (names only)", !JSON.stringify(r.body).includes("We offer financing through"));

  const pendingAcct = { ...ACCOUNT, capabilities: { ...ACCOUNT.capabilities, klarna_payments: "pending" } };
  stripeLib.stripe.accounts.retrieve = async () => pendingAcct;
  capReads.length = 0;
  const p = await run(OWNER, { ...TF, stripeKlarnaStatus: "active" });
  ok("Klarna pending at Stripe: the card says pending, the column follows, the capability is read, a support message exists",
    p.body.klarna.status === "pending" && p.writes.some((w) => w.data.stripeKlarnaStatus === "pending") && capReads.includes("klarna_payments") && /klarna_payments/.test(p.body.financingSupport.klarna || ""));

  stripeLib.stripe.accounts.retrieve = async () => ACCOUNT;
  const admin = await run({ ...OWNER, role: "admin" });
  ok("an admin (not owner) gets the statuses but NO support message — it carries the account id, which is owner-only",
    admin.body.klarna?.status === "active" && admin.body.financingSupport?.affirm === null && !JSON.stringify(admin.body).includes("acct_1TrueFinish"));
  const imp = await run({ ...OWNER, impersonation: true, impersonationMode: "read_only" });
  ok("read-only impersonation: Stripe's answer is shown and NOTHING is written", imp.status === 200 && imp.body.klarna?.status === "active" && imp.writes.length === 0);
}

console.log("\n── 9. Copy, in every language ───────────────────────────────────────\n");
{
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");
  const langs = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
  const src = read("app/app/settings/payments/FinancingProviderStatus.js") + read("app/app/settings/payments/page.js") + read("app/app/settings/payments/ProcessingFeesCard.js") + read("app/app/settings/payments/ClientCardSurchargeCard.js");
  const used = [...new Set([...src.matchAll(/t\("(app\.setPayments\.(?:klarna|financing(?:Support|Note|Declined|Pending|TitleProviders)|feesFinancing|clientCardFee\.flow\.klarna)[^"]*)"/g)].map((m) => m[1]))];
  const missing = [];
  for (const k of [...used, "app.feeRate.klarna"]) for (const l of langs) if (typeof APP_MESSAGES[l]?.[k] !== "string") missing.push(`${l}:${k}`);
  ok(`every new settings string (${used.length}) exists in all ${langs.length} app languages`, used.length >= 18 && missing.length === 0, missing.slice(0, 10));
  const english = [];
  for (const k of used) for (const l of langs.slice(1)) if (APP_MESSAGES[l][k] === APP_MESSAGES.en[k]) english.push(`${l}:${k}`);
  ok("  ^ none left in English", english.length === 0, english);
  const holds = (key, ...names) => langs.every((l) => names.every((n) => APP_MESSAGES[l][key]?.includes(`{${n}}`)));
  ok("  ^ the fee block's placeholders survive translation",
    holds("app.setPayments.feesFinancingWho", "providers") && holds("app.setPayments.feesFinancingSurcharges", "international", "conversion") &&
      holds("app.setPayments.feesFinancingExample", "amount", "cardNet", "providers") && holds("app.setPayments.feesFinancingExampleProvider", "provider", "net"));
  ok("  ^ the old vague one-liner is gone from every language", langs.every((l) => !("app.setPayments.feesFinancingRates" in APP_MESSAGES[l])));
  ok("  ^ the English says who pays and that FieldQuo adds nothing",
    /your company pays Stripe's fee/.test(APP_MESSAGES.en["app.setPayments.feesFinancingWho"]) && /FieldQuo adds nothing/.test(APP_MESSAGES.en["app.setPayments.feesFinancingWho"]) &&
      /Klarna's rules don't allow passing this fee on to the client/.test(APP_MESSAGES.en["app.setPayments.feesFinancingNoPassOn"]));
  ok("  ^ placeholders survive translation ({min}/{max}, {country}, {provider}, {providers}, {items})",
    langs.every((l) => /\{min\}/.test(APP_MESSAGES[l]["app.setPayments.klarnaActive"]) && /\{max\}/.test(APP_MESSAGES[l]["app.setPayments.klarnaActive"]) &&
      /\{country\}/.test(APP_MESSAGES[l]["app.setPayments.klarnaUnavailable"]) && /\{provider\}/.test(APP_MESSAGES[l]["app.setPayments.financingSupportLabel"]) &&
      /\{providers\}/.test(APP_MESSAGES[l]["app.setPayments.financingNoteWarning"]) &&
      /\{items\}/.test(APP_MESSAGES[l]["app.setPayments.klarnaAsking"])));
  ok("the card's title lists both providers", APP_MESSAGES.en["app.setPayments.financingTitleProviders"] === "Offer pay-over-time (Affirm, Klarna)");

  const { CLIENT_DOC_COPY } = await import("@/lib/i18n/clientDocCopy.js");
  const docLangs = ["en", "fr", "es", "uk", "pa", "tl", "de", "it"];
  ok("client copy: payOverTimeWith + payOverTimeNote in all 8 client languages",
    docLangs.every((l) => typeof CLIENT_DOC_COPY[l]?.cardFee?.payOverTimeWith === "function" && typeof CLIENT_DOC_COPY[l].cardFee.payOverTimeNote === "string"));
  ok("  ^ English labels: 'Pay over time (Klarna)' / 'Pay over time (Affirm or Klarna)'",
    CLIENT_DOC_COPY.en.cardFee.payOverTimeWith(["Klarna"]) === "Pay over time (Klarna)" &&
      CLIENT_DOC_COPY.en.cardFee.payOverTimeWith(["Affirm", "Klarna"]) === "Pay over time (Affirm or Klarna)");
  ok("  ^ brand names untouched in every language, and none left in English",
    docLangs.every((l) => CLIENT_DOC_COPY[l].cardFee.payOverTimeWith(["Klarna"]).includes("Klarna")) &&
      docLangs.slice(1).every((l) => CLIENT_DOC_COPY[l].cardFee.payOverTimeNote !== CLIENT_DOC_COPY.en.cardFee.payOverTimeNote && CLIENT_DOC_COPY[l].cardFee.payOverTimeWith(["Klarna"]) !== "Pay over time (Klarna)"));
  ok("white-label: no client sentence mentions FieldQuo or Stripe", docLangs.every((l) => !/fieldquo|stripe/i.test(CLIENT_DOC_COPY[l].cardFee.payOverTimeWith(["Klarna"]) + CLIENT_DOC_COPY[l].cardFee.payOverTimeNote)));
  const flows = (await import("@/lib/stripe/clientCardSurcharge.js")).CLIENT_CARD_FLOWS;
  ok("the card-fee settings list names Klarna as a no-fee flow (Klarna's rules forbid a fee)", flows.some((f) => f.key === "klarna" && f.surcharged === false));
}

console.log("\n── 10. Mutants — break each rule, the suite must notice ─────────────\n");
ok("the shipped module passes every suite quietly", (await quiet(eligibilitySuite, fin)) + (await quiet(statusSuite, fin)) + (await quiet(noteSuite, fin)) === 0);
await noteSuite(fin, ok);
{
  const scratch = mkdtempSync(join(tmpdir(), "fq-klarna-mutants-"));
  const FILE = "lib/stripe/financingMethods.js";
  const original = read(FILE);
  const MUTANTS = [
    ["eligibility", "status gate removed (pending/inactive would offer)", '    company?.[p.statusColumn] === "active" &&\n', ""],
    ["eligibility", "opt-in removed (financing off would still offer)", "    Boolean(company?.offerFinancing) &&\n    company?.[p.statusColumn]", "    company?.[p.statusColumn]"],
    ["eligibility", "upper bound made exclusive", "cents >= r.minCents && cents <= r.maxCents", "cents >= r.minCents && cents < r.maxCents"],
    ["eligibility", "lower bound made exclusive", "cents >= r.minCents && cents <= r.maxCents", "cents > r.minCents && cents <= r.maxCents"],
    ["eligibility", "Klarna CAD financing ceiling misread as US$10,000", "Object.freeze({ option: \"financing\", minCents: 25_000, maxCents: 1_750_000 })", "Object.freeze({ option: \"financing\", minCents: 25_000, maxCents: 1_000_000 })"],
    ["eligibility", "currency not checked (any currency uses CAD ranges)", "return providerOf(provider).options[String(currency || \"\").toLowerCase()] || [];", "return providerOf(provider).options.cad;"],
    ["status", "disabled not mapped to inactive", 'if (raw === "disabled") return "inactive";', ""],
    ["status", "Klarna reads Affirm's capability", "const raw = account.capabilities?.[p.capability];", "const raw = account.capabilities?.affirm_payments;"],
    ["note", "url exemption removed", "p.pattern.test(note) && !p.pattern.test(host)", "p.pattern.test(note)"],
    ["note", "active providers still flagged", "(p) => !isFinancingMethod(p.key) || !financingEnabled(p.key, company),", "() => true,"],
  ];
  const SUITES = { eligibility: eligibilitySuite, status: statusSuite, note: noteSuite };
  try {
    for (const [kind, label, from, to] of MUTANTS) {
      if (!original.includes(from)) {
        ok(`mutant "${label}": the code it mutates is still there`, false, from);
        continue;
      }
      // The copy imports "@/lib/stripe/connectAccount" — resolved by the
      // alias loader exactly as the shipped file's import is.
      const path = join(scratch, `m${Math.random().toString(36).slice(2)}.mjs`);
      writeFileSync(path, original.replace(from, to));
      const mod = await import(pathToFileURL(path).href);
      const failures = await quiet(SUITES[kind], mod);
      ok(`mutant "${label}" is caught (${failures} assertion${failures === 1 ? "" : "s"} fail)`, failures > 0);
    }
    // The fee rule: a Klarna payment priced as a card at settlement would
    // hand FieldQuo a margin on a pass-through. Mutate the reader and settle.
    const FEE = "lib/stripe/paymentIntentFee.js";
    const feeSrc = read(FEE);
    const from = 'return method === "affirm" ? "card" : method;';
    if (!feeSrc.includes(from)) ok("fee mutant: the code it mutates is still there", false);
    else {
      const path = join(scratch, `fee${Math.random().toString(36).slice(2)}.mjs`);
      writeFileSync(path, feeSrc.replace(from, 'return method === "affirm" || method === "klarna" ? "card" : method;'));
      const mod = await import(pathToFileURL(path).href);
      const est = 19_530;
      const intent = { id: "pi_m", currency: "cad", amount: 650_000, amount_received: 650_000, application_fee_amount: est, metadata: { fq_fee_estimate_cents: String(est), fq_recovery_cents: "0" }, latest_charge: { id: "ch", payment_method_details: { type: "klarna" }, balance_transaction: { fee: 38_965 }, transfer: "tr" } };
      const fee = await mod.settledFeeFor(intent, { stripe: { paymentIntents: { retrieve: async () => intent }, transfers: { createReversal: async () => ({}) } } });
      ok(`mutant "Klarna priced with the card margin at settlement" is caught (contractor would pay ${fee.processingFeeCents} ≠ Stripe's 38965)`, fee.processingFeeCents !== 38_965);
      const path2 = join(scratch, `fee${Math.random().toString(36).slice(2)}.mjs`);
      writeFileSync(path2, feeSrc.replace("if (isFinancingMethod(method)) {", "if (false) {"));
      const mod2 = await import(pathToFileURL(path2).href);
      ok("mutant \"Klarna reversal labelled as a card surcharge again\" is caught", /^Card processing surcharge/.test(mod2.trueUpDescription("klarna")) && /^Klarna/.test(trueUpDescription("klarna")));
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

console.log("\n── 11. Outlined pay buttons: contrast measured, hostile brands ──────\n");
{
  const { contrastRatio } = await import("@/lib/brand/colour.js");
  const theme = await import("@/lib/documents/theme.js");
  // The colours contractors actually pick that break naive text-on-light:
  // yellow, white, black, mid-grey — plus a darker grey and lime.
  const HOSTILE = ["#facc15", "#ffffff", "#000000", "#808080", "#777777", "#84cc16"];
  const SURFACES = [theme.PORTAL_PAY_SURFACE, "#ffffff"];
  async function contrastSuite(m, t) {
    for (const brand of HOSTILE) {
      const th = theme.documentTheme({ brandColor: brand });
      for (const surface of SURFACES) {
        const p = m.outlinePair(th, surface);
        t(`${brand} on ${surface}: the pair is drawn on that surface`, p.bg === surface);
        t(`${brand} on ${surface}: button text ≥ 4.5:1 (${contrastRatio(p.fg, surface).toFixed(2)})`, contrastRatio(p.fg, surface) >= 4.5);
        t(`${brand} on ${surface}: border ≥ 3:1 (${contrastRatio(p.border, surface).toFixed(2)})`, contrastRatio(p.border, surface) >= 3);
        t(`${brand} on ${surface}: small print ≥ 4.5:1 (${contrastRatio(p.muted, surface).toFixed(2)})`, contrastRatio(p.muted, surface) >= 4.5);
      }
    }
  }
  await contrastSuite(theme, ok);
  ok("the problem was real: the raw brand hex as text on #faf8f4 — yellow 1.44, white 1.06, mid-grey 3.72 — all under 4.5",
    contrastRatio("#facc15", theme.PORTAL_PAY_SURFACE) < 4.5 && contrastRatio("#ffffff", theme.PORTAL_PAY_SURFACE) < 4.5 && contrastRatio("#808080", theme.PORTAL_PAY_SURFACE) < 4.5);
  ok("  ^ and accentText alone (measured vs paper) is not enough on #faf8f4: white 4.47, mid-grey 4.28",
    contrastRatio(theme.documentTheme({ brandColor: "#ffffff" }).accentText, theme.PORTAL_PAY_SURFACE) < 4.5 &&
      contrastRatio(theme.documentTheme({ brandColor: "#808080" }).accentText, theme.PORTAL_PAY_SURFACE) < 4.5);
  ok("  ^ the old small print (#2d2520 at 60%) composites under 4.5 on both surfaces (4.05 / 4.12)",
    contrastRatio("#7f7a76", theme.PORTAL_PAY_SURFACE) < 4.5 && contrastRatio("#817c79", "#ffffff") < 4.5);
  ok("  ^ the familiar brand is untouched (FieldQuo navy keeps its own hex)",
    theme.outlinePair(theme.documentTheme({ brandColor: "#06356b" }), theme.PORTAL_PAY_SURFACE).fg === "#06356b");

  const inv = stripComments(read("app/portal/[token]/invoices/[id]/PortalInvoice.js"));
  const index = stripComments(read("app/portal/[token]/ClientPortal.js"));
  ok("no portal pay button draws the raw brand hex as text any more", !/borderColor: accent, color: accent/.test(inv + index));
  ok("invoice page: the panel takes its surface from outlinePair(theme, PORTAL_PAY_SURFACE); bank + pay-over-time use it",
    /const payPanel = outlinePair\(theme, PORTAL_PAY_SURFACE\);/.test(inv) && /style=\{\{ backgroundColor: payPanel\.bg \}\}/.test(inv) &&
      (inv.match(/style=\{\{ borderColor: payPanel\.border, color: payPanel\.fg \}\}/g) || []).length === 2);
  ok("  ^ and the small print under them is payPanel.muted (bank note, over-cap, card-fee notice, no-fee note)",
    (inv.match(/style=\{\{ color: payPanel\.muted \}\}/g) || []).length >= 4 && !/text-xs text-\[#2d2520\]\/60">\{copy\.(bankNote|cardFee\.payOverTimeNote)\}/.test(inv));
  ok("portal index: bank + pay-over-time buttons and their notes measured against the white card",
    /const payOutline = outlinePair\(documentTheme\(c\), "#ffffff"\);/.test(index) &&
      (index.match(/style=\{\{ borderColor: payOutline\.border, color: payOutline\.fg \}\}/g) || []).length === 2 &&
      (index.match(/style=\{\{ color: payOutline\.muted \}\}/g) || []).length >= 2);

  const THEME_FILE = "lib/documents/theme.js";
  const themeSrc = read(THEME_FILE);
  const CONTRAST_MUTANTS = [
    ["raw brand hex as the button text", "const fg = ensureContrast(theme.accentText, bg, 4.5);", "const fg = theme.accent;"],
    ["accentText trusted (measured vs paper, not the surface)", "const fg = ensureContrast(theme.accentText, bg, 4.5);", "const fg = theme.accentText;"],
    ["surface ignored (always measured against paper)", "const bg = norm(surface, theme.paper);", "const bg = theme.paper;"],
    ["border left as the raw brand hex", "return { bg, fg, border: fg, muted:", "return { bg, fg, border: theme.accent, muted:"],
    ["small print back to #2d2520 at 60%", "muted: ensureContrast(theme.inkMuted, bg, 4.5) };", "muted: \"#817c79\" };"],
  ];
  const scratch = mkdtempSync(join(tmpdir(), "fq-klarna-contrast-"));
  try {
    for (const [label, from, to] of CONTRAST_MUTANTS) {
      if (!themeSrc.includes(from)) {
        ok(`contrast mutant "${label}": the code it mutates is still there`, false, from);
        continue;
      }
      const path = join(scratch, `t${Math.random().toString(36).slice(2)}.mjs`);
      writeFileSync(path, themeSrc.replace(from, to));
      const failures = await quiet(contrastSuite, await import(pathToFileURL(path).href));
      ok(`contrast mutant "${label}" is caught (${failures} assertion${failures === 1 ? "" : "s"} fail)`, failures > 0);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
