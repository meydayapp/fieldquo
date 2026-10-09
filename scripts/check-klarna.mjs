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
//   6. the pay-over-time fee: the company pays max(6.5% + 30¢, Stripe's actual), with its own
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
ok("summariseAffirmCapability and Klarna's summary have the SAME shape (requirements, verification, code, words, contact Stripe)",
  Object.keys(affirm.summariseAffirmCapability(null)).sort().join() === "contactStripe,disabledReason,disabledReasonCode,pendingVerification,requirements" &&
    Object.keys((await import("@/lib/stripe/financingReasons.js")).summariseProviderCapability("klarna", null)).sort().join() ===
      Object.keys(affirm.summariseAffirmCapability(null)).sort().join());

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

console.log("\n── 6. Pay over time: the company pays max(6.5% + 30¢, Stripe's actual) ──\n");
const { settledFeeFor, trueUpDescription } = await import("@/lib/stripe/paymentIntentFee.js");
const { feeRateKey } = await import("@/lib/stripe/feeRateKey.js");
// Stripe's fee at a rate, the way Stripe rounds a percentage (half-up) + 30¢.
const stripeAt = (amount, bps) => Math.floor((amount * bps + 5000) / 10000) + 30;
async function settle(feeMod, { amount, stripeFee, type = "klarna", currency = "cad" }) {
  const est = fees.processingFeeCents({ amountCents: amount, currency, method: "card" });
  const log = [];
  const intent = {
    id: `pi_${type}_${amount}_${stripeFee}`, currency, amount, amount_received: amount, application_fee_amount: est,
    metadata: { fq_fee_estimate_cents: String(est), fq_recovery_cents: "0", companyId: "co_tf" },
    latest_charge: { id: "ch", payment_method_details: { type }, balance_transaction: stripeFee == null ? null : { fee: stripeFee }, transfer: "tr_1" },
  };
  const client = {
    paymentIntents: { retrieve: async () => intent },
    transfers: { createReversal: async (tr, params, opts) => { log.push({ tr, params, opts }); return { id: "trr" }; } },
  };
  return { est, fee: await feeMod.settledFeeFor(intent, { stripe: client }), log };
}

// The owner's numbers (2026-10-09), as a suite so the mutants re-run it.
async function feeRuleSuite(pf, t) {
  const rule = (amount, actual, currency = "cad") => pf.financingSettlementFee({ amountCents: amount, currency, actualStripeFeeCents: actual });
  t("the target is ONE named constant: 6.5% + 30¢ (FINANCING_RATE_BPS 650, FINANCING_FIXED_CENTS 30)", pf.FINANCING_RATE_BPS === 650 && pf.FINANCING_FIXED_CENTS === 30 && pf.FINANCING_RATE.formula === "6.5% + $0.30");
  t("flat fee on $6,500 is $422.80", pf.financingFeeCents({ amountCents: 650_000, currency: "cad" }) === 42_280);
  let r = rule(650_000, stripeAt(650_000, 599));
  t(`$6,500 at Klarna's 5.99% + 30¢ ($389.65): company $422.80, FieldQuo $33.15 (got ${r.totalCents}/${r.platformShareCents})`, r.totalCents === 42_280 && r.platformShareCents === 3_315);
  r = rule(650_000, stripeAt(650_000, 600));
  t(`$6,500 at 6% + 30¢ (Affirm / Afterpay standard): company $422.80, FieldQuo $32.50 (got ${r.totalCents}/${r.platformShareCents})`, r.totalCents === 42_280 && r.platformShareCents === 3_250);
  r = rule(650_000, stripeAt(650_000, 749));
  t(`$6,500 international Klarna (Stripe 7.49% + 30¢ = $487.15): company pays Stripe's $487.15, FieldQuo $0 (got ${r.totalCents}/${r.platformShareCents})`, r.totalCents === 48_715 && r.platformShareCents === 0);
  r = rule(650_000, stripeAt(650_000, 290));
  t(`$6,500 at a Stripe promo 2.9% + 30¢ ($188.80): company $422.80, FieldQuo $234.00 (got ${r.totalCents}/${r.platformShareCents})`, r.totalCents === 42_280 && r.platformShareCents === 23_400);
  r = rule(650_000, stripeAt(650_000, 799));
  t(`$6,500 Affirm Enhanced (7.99% + 30¢ = $519.65): company pays Stripe's actual, FieldQuo $0 (got ${r.totalCents}/${r.platformShareCents})`, r.totalCents === 51_965 && r.platformShareCents === 0);
  r = rule(200_000, stripeAt(200_000, 600));
  t(`$2,000 Afterpay at 6% + 30¢: company $130.30, FieldQuo $10.00 (got ${r.totalCents}/${r.platformShareCents})`, r.totalCents === 13_030 && r.platformShareCents === 1_000);
  r = rule(200_000, stripeAt(200_000, 599), "usd");
  t("US$2,000 by Klarna: the same rule in USD — $130.30", r.totalCents === 13_030);
  r = rule(650_000, null);
  t("Stripe's fee not reported yet: settles at the flat $422.80, no share claimed", r.totalCents === 42_280 && r.platformShareCents === 0);
  r = rule(20, 0);
  t("never more than the payment itself (a 20¢ payment: fee 20¢, not 31¢)", r.totalCents === 20 && pf.financingFeeCents({ amountCents: 20, currency: "cad" }) === 20);
  t("the share is never negative, whatever Stripe charges", [0, 1, 18_880, 42_280, 48_715, 99_999].every((a) => rule(650_000, a).platformShareCents >= 0));
  t("a currency with no pay-over-time rate is refused, not priced at zero", (() => { try { pf.financingFeeCents({ amountCents: 1000, currency: "gbp" }); return false; } catch { return true; } })());
  t("the BNPL methods priced: klarna, affirm, afterpay_clearpay — card and bank are not",
    pf.isFinancingSettlementMethod("klarna") && pf.isFinancingSettlementMethod("affirm") && pf.isFinancingSettlementMethod("afterpay_clearpay") &&
      !pf.isFinancingSettlementMethod("card") && !pf.isFinancingSettlementMethod("acss_debit"));
  const ex = pf.financingFeeExample({ amountCents: 100_000, currency: "cad" });
  t(`fees card, $1,000: card $969.70 reaches you; pay over time $934.70 (got ${ex?.card.netCents}/${ex?.overTime.netCents})`,
    ex.card.netCents === 96_970 && ex.overTime.feeCents === 6_530 && ex.overTime.netCents === 93_470 && ex.overTime.formula === "6.5% + $0.30");
  t("  ^ names the providers Klarna / Affirm / Afterpay, no per-provider rate", ex.providers.join(" / ") === "Klarna / Affirm / Afterpay" && !("formula" in ex.card));
  t("  ^ a currency with no pay-over-time rate gives no block (null)", pf.financingFeeExample({ amountCents: 100_000, currency: "gbp" }) === null);
}

async function settlementSuite(feeMod, t) {
  // A hosted-page Klarna payment: estimated at the card rate (the client
  // chose Klarna on Stripe's page), trued up at settlement to the rule.
  const s = await settle(feeMod, { amount: 650_000, stripeFee: stripeAt(650_000, 599) });
  t("CA$6,500 Klarna: card estimate $195.30 at creation", s.est === 19_530);
  t(`  ^ settles at $422.80 to the company (got ${s.fee.processingFeeCents})`, s.fee.processingFeeCents === 42_280);
  t("  ^ $227.50 reversed out of the transfer, once (idempotent per intent)",
    s.log.length === 1 && s.log[0].params.amount === 22_750 && s.log[0].opts.idempotencyKey === "fq-fee-trueup-pi_klarna_650000_38965");
  t("  ^ net to the contractor $6,077.20; Stripe's $389.65 recorded beside it; label 'klarna'",
    s.fee.netCents === 607_720 && s.fee.stripeFeeCents === 38_965 && s.fee.feeRateLabel === "klarna");
  t("  ^ the reversal says 'Klarna processing fee', not 'Card processing surcharge'", /^Klarna processing fee/.test(s.log[0]?.params.description || ""));
  const intl = await settle(feeMod, { amount: 650_000, stripeFee: stripeAt(650_000, 749) });
  t(`international Klarna settles at Stripe's $487.15 (got ${intl.fee.processingFeeCents})`, intl.fee.processingFeeCents === 48_715);
  const affirmS = await settle(feeMod, { amount: 650_000, stripeFee: stripeAt(650_000, 600), type: "affirm" });
  t(`Affirm settles at $422.80 too — no longer the card's 0.1% (got ${affirmS.fee.processingFeeCents})`, affirmS.fee.processingFeeCents === 42_280);
  const afterpay = await settle(feeMod, { amount: 200_000, stripeFee: stripeAt(200_000, 600), type: "afterpay_clearpay" });
  t(`$2,000 Afterpay settles at $130.30 (got ${afterpay.fee.processingFeeCents})`, afterpay.fee.processingFeeCents === 13_030);
  const unknown = await settle(feeMod, { amount: 650_000, stripeFee: null });
  t(`Stripe's fee not on the charge yet: still trued up to the flat $422.80 (got ${unknown.fee.processingFeeCents})`, unknown.fee.processingFeeCents === 42_280);
  const card = await settle(feeMod, { amount: 226_000, stripeFee: 8392, type: "card" });
  t("a CARD payment is unchanged: 'Card processing surcharge', Stripe's $83.92 + FieldQuo's $2.26",
    /^Card processing surcharge/.test(card.log[0]?.params.description || "") && card.fee.processingFeeCents === 8_392 + 226);
}

await feeRuleSuite(fees, ok);
await settlementSuite({ settledFeeFor }, ok);
ok("feeRateKey names Klarna and Afterpay on the payment row, an unknown method stays 'other'",
  feeRateKey("klarna") === "klarna" && feeRateKey("afterpay_clearpay") === "afterpay_clearpay" && feeRateKey("sofort") === "other");
ok("Affirm's reversal wording is unchanged; Afterpay's names Afterpay",
  trueUpDescription("affirm") === "Affirm processing fee (pay-over-time, chosen at checkout)" && /^Afterpay processing fee/.test(trueUpDescription("afterpay_clearpay")));
{
  const feesCard = stripComments(read("app/app/settings/payments/ProcessingFeesCard.js"));
  ok("the fees card renders ONE pay-over-time rate (FINANCING_RATE via financingFeeExample), never a per-provider split",
    /financingFeeExample\(\{\s*amountCents: FINANCING_EXAMPLE_CENTS/.test(feesCard) && /const FINANCING_EXAMPLE_CENTS = 100_000;/.test(feesCard) &&
      /financingExample\.overTime\.formula/.test(feesCard) && !/STRIPE|5\.99|0\.51|FINANCING_SETTLEMENT_METHODS|stripeFinancing/.test(feesCard));
  ok("  ^ shown whenever the currency has the rate — not only with financing on", /\{financingExample && \(/.test(feesCard) && !/offerFinancing && \(\s*<div data-financing/.test(feesCard));
  ok("  ^ and cites Klarna's rules (docs.stripe.com/payments/klarna/compliance)", /https:\/\/docs\.stripe\.com\/payments\/klarna\/compliance/.test(feesCard) && /feesFinancingNoPassOn/.test(feesCard));
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");
  ok("  ^ English: who pays, and 'more only if Stripe's own fee on a payment is higher'",
    /Paid by your company out of the payment/.test(APP_MESSAGES.en["app.setPayments.feesFinancingWho"]) &&
      /more only if Stripe's own fee on a payment is higher, e\.g\. an international card/.test(APP_MESSAGES.en["app.setPayments.feesFinancingWho"]) &&
      !/FieldQuo adds nothing/.test(JSON.stringify(APP_MESSAGES)));
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
  // Stripe's reason per capability: Affirm refused for the business type
  // (TrueFinish's real answer); Klarna's set per case below.
  let klarnaReason = null;
  stripeLib.stripe.accounts.retrieveCapability = async (id, cap) => {
    capReads.push(cap);
    const reason = cap === "affirm_payments" ? "rejected.unsupported_business" : klarnaReason;
    return { id: cap, status: "inactive", requirements: { currently_due: [], past_due: [], pending_verification: [], disabled_reason: reason } };
  };
  const run = async (member, row = TF) => {
    dbStub.rows.company = [{ ...row }];
    dbStub.writes.length = 0;
    memberStub.setCurrentMember(member);
    const res = await GET(new Request("https://app.fieldquo.com/api/stripe/connect/status"));
    return { status: res.status, body: await res.json(), writes: dbStub.writes.filter((w) => w.model === "company") };
  };
  const reasons = await import("@/lib/stripe/financingReasons.js");
  const OWNER = { id: "m1", userId: "u1", companyId: TF.id, role: "owner" };
  const r = await run(OWNER);
  ok("owner, TrueFinish-like account: 200", r.status === 200, r.body);
  ok("  ^ Klarna's status is Stripe's answer: active", r.body.klarna?.status === "active", r.body.klarna);
  ok("  ^ Affirm's is Stripe's answer: inactive", r.body.affirm?.status === "inactive");
  ok("  ^ the capability object is read for Affirm (inactive) and NOT for an active Klarna", capReads.join() === "affirm_payments", capReads);
  ok("  ^ stripeKlarnaStatus is written from that answer", r.writes.some((w) => w.data.stripeKlarnaStatus === "active"), r.writes);
  ok("  ^ Affirm's reason travels as a code + plain words + 'contact Stripe' (the merged AffirmReason table)",
    r.body.affirm.disabledReasonCode === "rejected.unsupported_business" && /declined Affirm for your type of business/.test(r.body.affirm.disabledReason) && r.body.affirm.contactStripe === true);
  ok("  ^ the account id reaches the page only through accountDetails (owner-only), for the copyable message", r.body.accountDetails?.accountId === "acct_1TrueFinish");
  ok("  ^ an active Klarna carries no reason", !r.body.klarna.disabledReasonCode && !r.body.klarna.contactStripe);
  ok("  ^ the note's providers are named (Affirm, Klarna) and only Affirm is unofferable now",
    r.body.financingNoteProviders?.map((p) => p.key).join() === "affirm,klarna" &&
      fin.unofferedNamedProviders(r.body.financingNoteProviders, { offerFinancing: true, stripeAffirmStatus: r.body.affirm.status, stripeKlarnaStatus: r.body.klarna.status }).map((p) => p.key).join() === "affirm");
  ok("  ^ the note itself is never sent (names only)", !JSON.stringify(r.body).includes("We offer financing through"));

  const pendingAcct = { ...ACCOUNT, capabilities: { ...ACCOUNT.capabilities, klarna_payments: "pending" } };
  stripeLib.stripe.accounts.retrieve = async () => pendingAcct;
  capReads.length = 0;
  klarnaReason = "requirements.fields_needed";
  const p = await run(OWNER, { ...TF, stripeKlarnaStatus: "active" });
  ok("Klarna pending at Stripe: the column follows, the capability is read, its reason is Affirm's sentence with Klarna's name",
    p.body.klarna.status === "pending" && p.writes.some((w) => w.data.stripeKlarnaStatus === "pending") && capReads.includes("klarna_payments") &&
      p.body.klarna.disabledReasonCode === "requirements.fields_needed" && /before it can turn Klarna on/.test(p.body.klarna.disabledReason) &&
      !/Affirm/.test(p.body.klarna.disabledReason) && p.body.klarna.contactStripe === false, p.body.klarna);

  const refusedAcct = { ...ACCOUNT, capabilities: { ...ACCOUNT.capabilities, klarna_payments: "inactive" } };
  stripeLib.stripe.accounts.retrieve = async () => refusedAcct;
  klarnaReason = "rejected.unsupported_business";
  const k = await run(OWNER, { ...TF, stripeKlarnaStatus: "active" });
  ok("Klarna refused for the business type: Klarna's OWN sentence (not Affirm's contractor claim), and 'contact Stripe'",
    k.body.klarna.status === "inactive" && /declined Klarna for your type of business/.test(k.body.klarna.disabledReason) &&
      /business-to-business/.test(k.body.klarna.disabledReason) && !/home-improvement/.test(k.body.klarna.disabledReason) && k.body.klarna.contactStripe === true, k.body.klarna);
  const kMsg = reasons.financingSupportMessageFor("klarna", { accountId: k.body.accountDetails.accountId, code: k.body.klarna.disabledReasonCode, businessName: "TrueFinish" });
  ok("  ^ the copyable message names the account id, klarna_payments, Klarna and the code — never Affirm",
    /acct_1TrueFinish/.test(kMsg) && /klarna_payments/.test(kMsg) && /Klarna/.test(kMsg) && /rejected\.unsupported_business/.test(kMsg) && !/affirm/i.test(kMsg), kMsg);

  stripeLib.stripe.accounts.retrieve = async () => ACCOUNT;
  klarnaReason = null;
  const admin = await run({ ...OWNER, role: "admin" });
  ok("an admin (not owner) gets the statuses but never the account id (so no id goes into a support message)",
    admin.body.klarna?.status === "active" && !JSON.stringify(admin.body).includes("acct_1TrueFinish"));

  // Every one of the 22 codes, for Klarna, in English and in every locale.
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");
  const codes = reasons.FINANCING_REASON_CODES;
  ok(`every reason code (${codes.length}): the Klarna sentence names Klarna wherever Affirm's names Affirm, and never says Affirm`,
    codes.length >= 22 &&
      codes.every((c) => !/Affirm/.test(reasons.financingReasonText("klarna", c)) && (!/Affirm/.test(affirm.affirmReasonText(c)) || /Klarna/.test(reasons.financingReasonText("klarna", c)))),
    codes.filter((c) => /Affirm/.test(reasons.financingReasonText("klarna", c))));
  const locales = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
  const { affirmReasonSlug } = affirm;
  const unswappable = [];
  for (const l of locales) for (const c of codes) {
    const own = reasons.financingReasonOwnKey("klarna", c);
    const text = own ? APP_MESSAGES[l][own] : reasons.withProvider(APP_MESSAGES[l][`app.setPayments.affirmReason.${affirmReasonSlug(c)}`], "klarna");
    if (typeof text !== "string" || /Affirm/.test(text)) unswappable.push(`${l}:${c}`);
  }
  ok("  ^ in all nine app languages, the Klarna sentence has no 'Affirm' left in it (brand names are never translated, so the swap holds)", unswappable.length === 0, unswappable.slice(0, 8));
  ok("  ^ Klarna's own unsupported-business sentence exists in all nine languages, and names Klarna",
    locales.every((l) => /Klarna/.test(APP_MESSAGES[l]["app.setPayments.klarnaReason.rejected_unsupported_business"] || "")));
  ok("  ^ Affirm's sentences are untouched by the swap (provider 'affirm' is the identity)",
    codes.every((c) => reasons.financingReasonText("affirm", c) === affirm.affirmReasonText(c)) &&
      reasons.financingSupportMessageFor("affirm", { accountId: "acct_x", code: "rejected.other" }) === affirm.affirmSupportMessage({ accountId: "acct_x", code: "rejected.other" }));
  const reasonCard = stripComments(read("app/app/settings/payments/AffirmReason.js"));
  const statusCard = stripComments(read("app/app/settings/payments/FinancingProviderStatus.js"));
  ok("the settings card shows Klarna's reason through the SAME AffirmReason component (provider=\"klarna\"), with the owner-only account id",
    /<AffirmReason provider="klarna" affirm=\{klarna\} accountId=\{accountId\} businessName=\{businessName\} t=\{t\} \/>/.test(statusCard) &&
      /financingReasonOwnKey\(provider, code\)/.test(reasonCard) && /withProvider\(t\(`app\.setPayments\.affirmReason\.\$\{affirmReasonSlug\(code\)\}`/.test(reasonCard) &&
      /accountId=\{status\?\.accountDetails\?\.accountId \|\| null\}/.test(read("app/app/settings/payments/page.js")));
  ok("  ^ no second, divergent support-message box for Affirm (the merged AffirmReason is the one)", !/financingSupport|SupportMessage|ProviderHelp/.test(statusCard));
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
    holds("app.setPayments.feesFinancingLabel", "providers") &&
      holds("app.setPayments.feesFinancingExample", "amount", "cardNet", "overTimeNet"));
  ok("  ^ the superseded keys are gone from every language (the vague one-liner, the per-provider split, the surcharge list)",
    langs.every((l) => ["feesFinancingRates", "feesFinancingSurcharges", "feesFinancingExampleProvider"].every((k) => !(`app.setPayments.${k}` in APP_MESSAGES[l]))));
  ok("  ^ the English says who pays, one rate, and that Klarna's fee can't go on the client",
    /^Paid by your company out of the payment/.test(APP_MESSAGES.en["app.setPayments.feesFinancingWho"]) &&
      /Klarna's rules don't allow passing this fee on to the client/.test(APP_MESSAGES.en["app.setPayments.feesFinancingNoPassOn"]));
  ok("  ^ placeholders survive translation ({min}/{max}, {country}, {provider}, {providers}, {items})",
    langs.every((l) => /\{min\}/.test(APP_MESSAGES[l]["app.setPayments.klarnaActive"]) && /\{max\}/.test(APP_MESSAGES[l]["app.setPayments.klarnaActive"]) &&
      /\{country\}/.test(APP_MESSAGES[l]["app.setPayments.klarnaUnavailable"]) &&
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
    // The pay-over-time fee rule (owner, 2026-10-09): break it, the owner's
    // numbers must notice.
    const PF = "lib/stripe/processingFee.js";
    const pfSrc = read(PF);
    const FEE_MUTANTS = [
      ["target 6% instead of 6.5%", "export const FINANCING_RATE_BPS = 650;", "export const FINANCING_RATE_BPS = 600;"],
      ["the 30¢ dropped", "export const FINANCING_FIXED_CENTS = 30;", "export const FINANCING_FIXED_CENTS = 0;"],
      ["Stripe's actual ignored (international Klarna under-charged)", "const total = Math.min(amount, Math.max(flat, actual));", "const total = Math.min(amount, flat);"],
      ["flat rate ignored (Stripe's cost only, no share)", "const total = Math.min(amount, Math.max(flat, actual));", "const total = Math.min(amount, actual);"],
      ["the amount cap removed (a 20¢ payment charged 31¢)", "return Math.min(amount, Math.floor((amount * FINANCING_RATE_BPS + 5000) / 10000) + FINANCING_FIXED_CENTS);", "return Math.floor((amount * FINANCING_RATE_BPS + 5000) / 10000) + FINANCING_FIXED_CENTS;"],
      ["share claimed when Stripe's fee is unknown", "return { totalCents: flat, platformShareCents: 0 };", "return { totalCents: flat, platformShareCents: flat };"],
    ];
    for (const [label, from, to] of FEE_MUTANTS) {
      if (!pfSrc.includes(from)) {
        ok(`fee mutant "${label}": the code it mutates is still there`, false, from);
        continue;
      }
      const path = join(scratch, `pf${Math.random().toString(36).slice(2)}.mjs`);
      writeFileSync(path, pfSrc.replace(from, to));
      const failures = await quiet(feeRuleSuite, await import(pathToFileURL(path).href));
      ok(`fee mutant "${label}" is caught (${failures} assertion${failures === 1 ? "" : "s"} fail)`, failures > 0);
    }
    // Settlement: the reader must route BNPL methods through the rule.
    const FEE = "lib/stripe/paymentIntentFee.js";
    const feeSrc = read(FEE);
    const SETTLE_MUTANTS = [
      ["BNPL settled like a card again (rule bypassed)", "if (isFinancingSettlementMethod(method) && FINANCING_RATE.currencies.includes(currency)) {", "if (false) {"],
      ["true-up allowed to go negative / measured from zero", "wanted = Math.max(0, totalCents - estimate);", "wanted = totalCents;"],
      ["Klarna reversal labelled as a card surcharge again", "if (isFinancingSettlementMethod(method)) {\n    return", "if (false) {\n    return"],
    ];
    for (const [label, from, to] of SETTLE_MUTANTS) {
      if (!feeSrc.includes(from)) {
        ok(`settlement mutant "${label}": the code it mutates is still there`, false, from);
        continue;
      }
      const path = join(scratch, `fee${Math.random().toString(36).slice(2)}.mjs`);
      writeFileSync(path, feeSrc.replace(from, to));
      const failures = await quiet(settlementSuite, await import(pathToFileURL(path).href));
      ok(`settlement mutant "${label}" is caught (${failures} assertion${failures === 1 ? "" : "s"} fail)`, failures > 0);
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
