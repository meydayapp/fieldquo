// scripts/check-processing-fee.mjs
//
//   npm run check:processing-fee
//
// The processing fee a contractor pays on each client payment, passed through
// as the application fee on every destination charge (owner, 2026-09-12:
// "we are not going to pay out of pocket … this fee will need to be
// pass-through to the company"), and everything that hangs off it: the
// settlement record, the export, refunds, disputes and instant payouts.
//
// Money-affecting, so every number here is EXECUTED — the rate table, the
// four charge creators (against a scripted Stripe), the settlement reader,
// the dispute recovery and the instant-payout gate — and nothing is asserted
// by reading a comment.

import { readFileSync } from "node:fs";

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
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// A fake key BEFORE lib/stripe.js is imported: the lazy client constructs
// `new Stripe(key)` on first property access, and we patch the resources it
// exposes so no request ever leaves this process.
process.env.STRIPE_SECRET_KEY = "sk_test_check_processing_fee";

const fees = await import("@/lib/stripe/processingFee.js");
const {
  processingFeeCents,
  platformShareCents,
  feeBreakdown,
  publishedRates,
  PROCESSING_RATES,
  STRIPE_CARD_RATE_BPS,
  FIELDQUO_CARD_RATE_BPS,
  FIELDQUO_CARD_MARGIN_BPS,
  INSTANT_PAYOUT_RATE,
  CARD_SURCHARGES,
  publishedSurcharges,
  trueUpCents,
} = fees;

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 1. The rate table, in numbers ───────────────────────────────────\n");

const cad = (amountCents, method) => processingFeeCents({ amountCents, currency: "cad", method });
const usd = (amountCents, method) => processingFeeCents({ amountCents, currency: "usd", method });

ok("Stripe's card rate is 2.9% (290 bp) and the contractor's is 3.0% (300 bp)",
  STRIPE_CARD_RATE_BPS === 290 && FIELDQUO_CARD_RATE_BPS === 300);
ok("the platform margin is the difference — 10 bp, visible as a constant", FIELDQUO_CARD_MARGIN_BPS === 10);
ok("$2,260 by card → $68.10 fee", cad(226_000, "card") === 6810, cad(226_000, "card"));
ok("  ^ of which $2.26 stays with FieldQuo", platformShareCents({ amountCents: 226_000, currency: "cad", method: "card" }) === 226);
ok("  ^ and $65.84 is Stripe's", 6810 - platformShareCents({ amountCents: 226_000, currency: "cad", method: "card" }) === 6584);
ok("  ^ same in USD", usd(226_000, "card") === 6810);
ok("$5,000 by Canadian pre-authorized debit → $5.00 (the cap)", cad(500_000, "acss_debit") === 500);
ok("  ^ no platform share on bank debit", platformShareCents({ amountCents: 500_000, currency: "cad", method: "acss_debit" }) === 0);
ok("$100 by PAD → 1% + 40¢ = $1.40", cad(10_000, "acss_debit") === 140);
ok("PAD cap boundary: $459.49 → $4.99, $459.50 → $5.00 (half-up), $460 → $5.00, $10,000 → $5.00",
  cad(45_949, "acss_debit") === 499 && cad(45_950, "acss_debit") === 500 && cad(46_000, "acss_debit") === 500 && cad(1_000_000, "acss_debit") === 500,
  [cad(45_949, "acss_debit"), cad(45_950, "acss_debit")]);
ok("US ACH: $100 → 80¢; $625 → $5.00 exactly; $1,000 → $5.00 (cap)",
  usd(10_000, "us_bank_account") === 80 && usd(62_500, "us_bank_account") === 500 && usd(100_000, "us_bank_account") === 500);
ok("rounding is half-up to the cent: $10.50 card → 31.5¢ → 32¢ + 30¢ = 62¢",
  cad(1_050, "card") === 62, cad(1_050, "card"));
ok("  ^ $10.16 card → 30.48¢ → 30¢ + 30¢ = 60¢", cad(1_016, "card") === 60, cad(1_016, "card"));
ok("$0.01 by card → 1¢ — never above the amount", cad(1, "card") === 1);
ok("$0.30 by card → 30¢ — never above the amount", cad(30, "card") === 30);
ok("$0 → 0, negative → 0, NaN → 0 — never negative",
  cad(0, "card") === 0 && cad(-500, "card") === 0 && cad(NaN, "card") === 0 && cad("abc", "card") === 0);
ok("a fractional cent is truncated before pricing", cad(226_000.7, "card") === 6810);
let threw = null;
try { cad(10_000, "us_bank_account"); } catch (e) { threw = e; }
ok("PAD/ACH in the wrong currency THROWS — an unknown fee never silently becomes zero", Boolean(threw));
threw = null;
try { usd(10_000, "acss_debit"); } catch (e) { threw = e; }
ok("  ^ acss_debit in USD too", Boolean(threw));
threw = null;
try { cad(10_000, "paypal"); } catch (e) { threw = e; }
ok("  ^ and an unpriced method", Boolean(threw));
{
  const b = feeBreakdown({ amountCents: 226_000, currency: "usd", method: "card" });
  ok("feeBreakdown: fee 6810, net 219190, rateLabel 'card', formula '3% + $0.30'",
    b.feeCents === 6810 && b.netCents === 219_190 && b.rateLabel === "card" && b.formula === "3% + $0.30", b);
}
ok("published rates for CAD: card then PAD; for USD: card then ACH — never PAD in USD",
  publishedRates("cad").map((r) => r.method).join() === "card,acss_debit" &&
    publishedRates("USD").map((r) => r.method).join() === "card,us_bank_account");
ok("every customer-facing formula says 3% + $0.30 for cards, never 2.9",
  PROCESSING_RATES.card.formula === "3% + $0.30" && !Object.values(PROCESSING_RATES).some((r) => /2\.9/.test(r.formula)));
ok("instant payouts are priced at 1% (Stripe's charge) with a 50¢ minimum",
  INSTANT_PAYOUT_RATE.basisPoints === 100 && INSTANT_PAYOUT_RATE.minimumCents === 50 && INSTANT_PAYOUT_RATE.formula === "1%");
ok("the rate module is pure — it imports nothing", !/^\s*import /m.test(read("lib/stripe/processingFee.js")));

console.log("\n── 1b. Surcharges and the true-up rule, in numbers ──────────────────\n");

ok("Stripe Canada surcharges: +0.8% international, +2% conversion; US: +1.5% / +1%",
  CARD_SURCHARGES.ca.international.basisPoints === 80 && CARD_SURCHARGES.ca.conversion.basisPoints === 200 &&
    CARD_SURCHARGES.us.international.basisPoints === 150 && CARD_SURCHARGES.us.conversion.basisPoints === 100);
ok("the settings card lists both, as Stripe publishes them", publishedSurcharges().map((x) => x.formula).join() === "+0.8%,+2%");
{
  const est = 6810; const share = 226; // $2,260 card: estimate and FieldQuo's 0.1%
  const domestic = trueUpCents({ estimatedFeeCents: est, platformShareCents: share, actualStripeFeeCents: 6584 });
  ok("$2,260 DOMESTIC card: Stripe's actual $65.84 = the estimate's Stripe share → true-up $0, fee stays $68.10", domestic === 0);
  const intl = trueUpCents({ estimatedFeeCents: est, platformShareCents: share, actualStripeFeeCents: 8392 });
  ok("$2,260 INTERNATIONAL card (CA platform, +0.8%): Stripe's actual $83.92 → true-up $18.08 → fee $86.18",
    intl === 1808 && est + intl === 8618, intl);
  const fx = trueUpCents({ estimatedFeeCents: est, platformShareCents: share, actualStripeFeeCents: 12912 });
  ok("$2,260 in USD from a US card on a CA contractor (+0.8% intl, +2% conversion): actual $129.12 → true-up $63.28 → fee $131.38",
    fx === 6328 && est + fx === 13138, fx);
  ok("  ^ in every case the contractor bears Stripe's actual cost + FieldQuo's $2.26, never less",
    est + domestic - 6584 === 226 && est + intl - 8392 === 226 && est + fx - 12912 === 226);
  ok("a cheaper-than-estimated card (actual $60.00) is NOT charged less — the published rate is the promise",
    trueUpCents({ estimatedFeeCents: est, platformShareCents: share, actualStripeFeeCents: 6000 }) === 0);
  ok("no actual fee known → no true-up", trueUpCents({ estimatedFeeCents: est, platformShareCents: share, actualStripeFeeCents: null }) === 0);
  ok("PAD (no platform share): actual above the estimate is trued up in full",
    trueUpCents({ estimatedFeeCents: 500, platformShareCents: 0, actualStripeFeeCents: 540 }) === 40);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 2. Every charge creator carries the fee, the destination and on_behalf_of ──\n");

const stripeLib = await import("@/lib/stripe.js");
const { stripe, destinationChargeParams, ensureChargeCapabilities, CHARGE_CAPABILITIES } = stripeLib;
const COMPANY = { id: "co1", stripeAccountId: "acct_contractor", currency: "CAD", offerFinancing: false };

{
  const p = destinationChargeParams({ company: COMPANY, amountCents: 226_000, currency: "cad", method: "card" });
  ok("destinationChargeParams: application_fee_amount is the ONE function's answer",
    p.application_fee_amount === processingFeeCents({ amountCents: 226_000, currency: "cad", method: "card" }));
  ok("  ^ transfer_data.destination is the contractor's account", p.transfer_data?.destination === "acct_contractor");
  ok("  ^ on_behalf_of is the same account — the contractor is the settlement merchant", p.on_behalf_of === "acct_contractor");
  let t = null;
  try { destinationChargeParams({ company: { id: "x" }, amountCents: 100, currency: "cad", method: "card" }); } catch (e) { t = e; }
  ok("  ^ throws without a connected account rather than creating a charge to nowhere", Boolean(t));
  ok("  ^ metadata splits the fee for settlement: estimate 6810, recovery 0, companyId — as strings",
    p.metadata.fq_fee_estimate_cents === "6810" && p.metadata.fq_recovery_cents === "0" && p.metadata.companyId === "co1");
  const withRec = destinationChargeParams({ company: COMPANY, amountCents: 226_000, currency: "cad", method: "card", recoveryCents: 225, metadata: { invoiceId: "inv1" } });
  ok("  ^ outstanding account fees ride on the application fee (6810 + 225) and are named in metadata, beside the caller's own",
    withRec.application_fee_amount === 7035 && withRec.metadata.fq_recovery_cents === "225" && withRec.metadata.invoiceId === "inv1");
  const capped = await stripeLib.destinationChargeParamsWithRecovery(
    { company: COMPANY, amountCents: 1000, currency: "cad", method: "card" },
    { ledger: async () => 5_000 },
  );
  ok("destinationChargeParamsWithRecovery caps the whole fee at the charge: $10 charge, $50 owed → fee = 60 + 940 = 1000, never more",
    capped.application_fee_amount === 1000 && capped.metadata.fq_recovery_cents === "940", capped);
}

// Scripted Stripe: capture what each creator sends.
const captured = [];
stripe.checkout.sessions.create = async (params, opts) => {
  captured.push({ op: "checkout.sessions.create", params, opts });
  if (params.payment_method_types?.includes("affirm") && globalThis.__affirmRejects) {
    throw new Error("affirm not activated");
  }
  return { id: `cs_${captured.length}`, url: "https://checkout.stripe.com/x", ...params };
};
stripe.paymentIntents.create = async (params, opts) => {
  captured.push({ op: "paymentIntents.create", params, opts });
  return { id: `pi_${captured.length}`, status: "succeeded", amount: params.amount, amount_received: params.amount, ...params };
};
stripe.accounts.create = async (params) => {
  captured.push({ op: "accounts.create", params });
  return { id: "acct_new", ...params };
};
stripe.accountLinks.create = async () => ({ url: "https://connect.stripe.com/setup" });
stripe.accounts.update = async (id, params) => {
  captured.push({ op: "accounts.update", id, params });
  return { id, ...params };
};

const invoice = { id: "inv1", invoiceNumber: "INV-100", total: 2260, amountPaid: 0 };
// The ledger seam: nothing outstanding unless a case says so.
const NO_LEDGER = { ledger: async () => 0 };

{
  captured.length = 0;
  await stripeLib.createInvoiceCheckoutSession({ invoice, company: COMPANY, successUrl: "s", cancelUrl: "c" }, NO_LEDGER);
  const c = captured.find((x) => x.op === "checkout.sessions.create");
  const pid = c.params.payment_intent_data;
  ok("invoice pay link: card only, $68.10 application fee, destination + on_behalf_of",
    c.params.payment_method_types.join() === "card" && pid.application_fee_amount === 6810 &&
      pid.transfer_data.destination === "acct_contractor" && pid.on_behalf_of === "acct_contractor", pid);
  ok("  ^ created on the platform (no stripeAccount header)", c.opts?.stripeAccount === undefined);
}
{
  captured.length = 0;
  await stripeLib.createInvoiceCheckoutSession({ invoice: { ...invoice, total: 2260, amountPaid: 1260 }, company: COMPANY, successUrl: "s", cancelUrl: "c" }, NO_LEDGER);
  const c = captured.find((x) => x.op === "checkout.sessions.create");
  ok("a $1,000 balance is priced on the balance, not the total: $30.30",
    c.params.line_items[0].price_data.unit_amount === 100_000 && c.params.payment_intent_data.application_fee_amount === 3030);
}
{
  captured.length = 0;
  await stripeLib.createInvoiceCheckoutSession({ invoice, company: { ...COMPANY, offerFinancing: true }, successUrl: "s", cancelUrl: "c" }, NO_LEDGER);
  const c = captured.find((x) => x.op === "checkout.sessions.create");
  ok("Affirm-eligible link (card + affirm in ONE session) keeps the CARD fee — the lower — at creation",
    c.params.payment_method_types.join() === "card,affirm" && c.params.payment_intent_data.application_fee_amount === 6810);
  ok("  ^ on_behalf_of still set", c.params.payment_intent_data.on_behalf_of === "acct_contractor");
}
{
  captured.length = 0;
  globalThis.__affirmRejects = true;
  await stripeLib.createInvoiceCheckoutSession({ invoice, company: { ...COMPANY, offerFinancing: true }, successUrl: "s", cancelUrl: "c" }, NO_LEDGER);
  globalThis.__affirmRejects = false;
  const last = captured[captured.length - 1];
  ok("  ^ and the card-only fallback carries the same fee", last.params.payment_method_types.join() === "card" && last.params.payment_intent_data.application_fee_amount === 6810);
}
{
  captured.length = 0;
  await stripeLib.createBookingFeeCheckoutSession({ bookingId: "bk1", company: { ...COMPANY, currency: "USD" }, label: "Visit", amountCents: 5000, successUrl: "s", cancelUrl: "c" }, NO_LEDGER);
  const c = captured[0];
  ok("booking fee: $50 → $1.80 fee, USD, destination + on_behalf_of",
    c.params.line_items[0].price_data.currency === "usd" && c.params.payment_intent_data.application_fee_amount === 180 &&
      c.params.payment_intent_data.on_behalf_of === "acct_contractor");
}
{
  const mandate = await import("@/lib/servicePlans/stripeMandate.js");
  captured.length = 0;
  const r = await mandate.chargeOccurrenceOffSession({
    company: COMPANY,
    authorisation: { stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1", paymentMethodType: "acss_debit", stripeMandateId: "mandate_1" },
    amountCents: 500_000,
    description: "Plan",
    idempotencyKey: "k1",
  }, NO_LEDGER);
  const c = captured[0];
  ok("service-plan PAD charge: $5,000 → $5.00 fee (PAD rate, not the card rate)",
    r.outcome === "succeeded" && c.params.application_fee_amount === 500 && c.params.payment_method_types.join() === "acss_debit");
  ok("  ^ destination, on_behalf_of, mandate, off_session, idempotency key all present",
    c.params.transfer_data.destination === "acct_contractor" && c.params.on_behalf_of === "acct_contractor" &&
      c.params.mandate === "mandate_1" && c.params.off_session === true && c.opts?.idempotencyKey === "k1");
  captured.length = 0;
  const card = await mandate.chargeOccurrenceOffSession({
    company: COMPANY,
    authorisation: { stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_2", paymentMethodType: "card" },
    amountCents: 226_000,
    description: "Plan",
  }, NO_LEDGER);
  ok("service-plan card charge: $2,260 → $68.10", card.outcome === "succeeded" && captured[0].params.application_fee_amount === 6810);
  captured.length = 0;
  const bad = await mandate.chargeOccurrenceOffSession({
    company: { ...COMPANY, currency: "USD" },
    authorisation: { stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_3", paymentMethodType: "acss_debit" },
    amountCents: 1000,
    description: "Plan",
  }, NO_LEDGER);
  ok("an unpriceable method/currency pair is a FAILED outcome, and no PaymentIntent is created",
    bad.outcome === "failed" && captured.length === 0, bad);
}

// Source scan: nothing spells its own transfer_data.
{
  const libFiles = ["lib/stripe.js", "lib/servicePlans/stripeMandate.js"];
  const stripeSrc = stripComments(read("lib/stripe.js"));
  const literalTransfers = (stripeSrc.match(/transfer_data:/g) || []).length;
  ok("lib/stripe.js spells transfer_data exactly once — inside destinationChargeParams", literalTransfers === 1);
  ok("  ^ and application_fee_amount exactly once — the processingFeeCents estimate plus any account-fee recovery",
    (stripeSrc.match(/application_fee_amount:/g) || []).length === 1 && /application_fee_amount:\s*estimate \+ recovery/.test(stripeSrc) && /const estimate = processingFeeCents\(/.test(stripeSrc));
  ok("  ^ no `application_fee_amount: 0` survives anywhere in lib/ or app/",
    !libFiles.some((f) => /application_fee_amount:\s*0\b/.test(stripComments(read(f)))));
  const mandateSrc = stripComments(read("lib/servicePlans/stripeMandate.js"));
  ok("the mandate charge uses destinationChargeParamsWithRecovery rather than its own keys",
    /destinationChargeParamsWithRecovery\(/.test(mandateSrc) && /\.\.\.route,/.test(mandateSrc) && !/transfer_data:/.test(mandateSrc) && !/on_behalf_of:/.test(mandateSrc));
  const money = ["createInvoiceCheckoutSession", "createBookingFeeCheckoutSession"];
  for (const fn of money) {
    const body = stripeSrc.slice(stripeSrc.indexOf(`export async function ${fn}`));
    const end = body.indexOf("\nexport ");
    ok(`${fn} builds payment_intent_data through destinationChargeParamsWithRecovery`,
      /payment_intent_data:\s*await destinationChargeParamsWithRecovery\(/.test(body.slice(0, end > 0 ? end : undefined)));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 3. Capabilities: new accounts request card_payments + transfers; old ones are repaired ──\n");

{
  captured.length = 0;
  await stripeLib.createConnectOnboardingLink({ companyId: "co1", stripeAccountId: null, returnUrl: "r", refreshUrl: "f" });
  const c = captured.find((x) => x.op === "accounts.create");
  ok("accounts.create is Express and requests card_payments and transfers",
    c.params.type === "express" && c.params.capabilities?.card_payments?.requested === true && c.params.capabilities?.transfers?.requested === true);
  ok("CHARGE_CAPABILITIES is exactly those two", Object.keys(CHARGE_CAPABILITIES).sort().join() === "card_payments,transfers");

  const calls = [];
  const fake = { accounts: { update: async (id, p) => { calls.push({ id, p }); return {}; } } };
  const did = await ensureChargeCapabilities({ id: "acct_old", capabilities: { transfers: "active" } }, { stripe: fake });
  ok("an existing account missing card_payments gets it requested (and only it)",
    did === true && calls.length === 1 && Object.keys(calls[0].p.capabilities).join() === "card_payments");
  calls.length = 0;
  const none = await ensureChargeCapabilities({ id: "acct_ok", capabilities: { card_payments: "pending", transfers: "active" } }, { stripe: fake });
  ok("an account with both (in any status) is left alone", none === false && calls.length === 0);
  const nul = await ensureChargeCapabilities(null, { stripe: fake });
  ok("a null account is a no-op, not a throw", nul === false);
  ok("the status poll calls ensureChargeCapabilities", /ensureChargeCapabilities\(account\)/.test(read("app/api/stripe/connect/status/route.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 4. Refunds: reverse the transfer, keep the fee ──────────────────\n");

{
  const src = stripComments(read("app/api/visit/[token]/route.js"));
  const refunds = src.match(/refunds\.create\(\s*\{[\s\S]*?\}\s*,/g) || [];
  ok("the visit-fee refund is the only refunds.create in app/ + lib/ and it reverses the transfer",
    refunds.length === 1 && /reverse_transfer:\s*true/.test(refunds[0]));
  ok("  ^ and does NOT refund the application fee — the contractor bears the fee on a refund", /refund_application_fee:\s*false/.test(refunds[0]));
  const others = ["lib", "app"].flatMap(() => []);
  ok("no other refunds.create exists (grep guard)", others.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 5. Settlement reads the fee off the intent and writes it on the row ──\n");

const { settledFeeFor, settledFeeOrNull } = await import("@/lib/stripe/paymentIntentFee.js");
function fakeStripeForIntents(intents, log = []) {
  return {
    _log: log,
    paymentIntents: { retrieve: async (id, opts) => { log.push({ op: "pi.retrieve", id, opts }); const i = intents[id]; if (!i) throw new Error("no such intent"); return i; } },
    transfers: {
      createReversal: async (tr, params, opts) => { log.push({ op: "reversal", tr, params, opts }); if (globalThis.__reversalFails) throw new Error("insufficient"); return { id: "trr_1", amount: params.amount }; },
      create: async (params, opts) => { log.push({ op: "transfer", params, opts }); return { id: "tr_back", amount: params.amount }; },
    },
    charges: { retrieve: async (id, opts) => { log.push({ op: "charge.retrieve", id, opts }); return globalThis.__charges?.[id]; } },
  };
}
{
  const log = [];
  const client = fakeStripeForIntents({
    pi_card: { id: "pi_card", amount: 226_000, amount_received: 226_000, application_fee_amount: 6810, latest_charge: { id: "ch_1", payment_method_details: { type: "card" }, balance_transaction: { fee: 6584 }, transfer: "tr_1" } },
  }, log);
  const fee = await settledFeeFor("pi_card", { stripe: client });
  ok("a DOMESTIC card intent (actual 6584 ≤ estimate's Stripe share): fee 6810, net 219190, label 'card', estimate + actual recorded",
    fee.processingFeeCents === 6810 && fee.netCents === 219_190 && fee.feeRateLabel === "card" && fee.estimatedFeeCents === 6810 && fee.stripeFeeCents === 6584, fee);
  ok("  ^ retrieved once with latest_charge.balance_transaction expanded",
    log.length === 1 && log[0].opts.expand.includes("latest_charge.balance_transaction"));
  ok("  ^ no reversal — a domestic card is charged the published rate, not less and not more",
    !log.some((l) => l.op === "reversal"));
}
{
  const log = [];
  const client = fakeStripeForIntents({
    pi_intl: { id: "pi_intl", currency: "cad", amount: 226_000, amount_received: 226_000, application_fee_amount: 6810, metadata: { fq_fee_estimate_cents: "6810", fq_recovery_cents: "0", companyId: "co1" }, latest_charge: { id: "ch_i", payment_method_details: { type: "card" }, balance_transaction: { fee: 8392 }, transfer: "tr_i" } },
  }, log);
  const fee = await settledFeeFor("pi_intl", { stripe: client });
  const rev = log.find((l) => l.op === "reversal");
  ok("an INTERNATIONAL card (actual 8392): the 1808 above the estimate's Stripe share is reversed from the transfer",
    rev && rev.tr === "tr_i" && rev.params.amount === 1808, rev?.params);
  ok("  ^ idempotent per intent", rev?.opts?.idempotencyKey === "fq-fee-trueup-pi_intl");
  ok("  ^ the row records the trued-up fee 8618, net 217382, estimate 6810, Stripe's actual 8392",
    fee.processingFeeCents === 8618 && fee.netCents === 217_382 && fee.estimatedFeeCents === 6810 && fee.stripeFeeCents === 8392, fee);
}
{
  const log = [];
  const client = fakeStripeForIntents({
    pi_fx: { id: "pi_fx", currency: "usd", amount: 226_000, amount_received: 226_000, application_fee_amount: 6810, metadata: { fq_fee_estimate_cents: "6810", fq_recovery_cents: "0", companyId: "co1" }, latest_charge: { id: "ch_f", payment_method_details: { type: "card" }, balance_transaction: { fee: 12912 }, transfer: "tr_f" } },
  }, log);
  const fee = await settledFeeFor("pi_fx", { stripe: client });
  const rev = log.find((l) => l.op === "reversal");
  ok("USD from a US card on a CA contractor (intl + conversion, actual 12912): 6328 reversed, fee 13138",
    rev?.params.amount === 6328 && fee.processingFeeCents === 13_138 && fee.netCents === 212_862, fee);
}
{
  const log = [];
  const client = fakeStripeForIntents({
    pi_cheap: { id: "pi_cheap", currency: "cad", amount: 226_000, amount_received: 226_000, application_fee_amount: 6810, latest_charge: { id: "ch_c", payment_method_details: { type: "card" }, balance_transaction: { fee: 6000 }, transfer: "tr_c" } },
  }, log);
  const fee = await settledFeeFor("pi_cheap", { stripe: client });
  ok("a card Stripe charged LESS for than estimated: no reversal, fee stays the published 6810",
    !log.some((l) => l.op === "reversal") && fee.processingFeeCents === 6810);
}
{
  // Account-fee recovery riding on the charge, marked recovered at settlement.
  const log = [];
  const client = fakeStripeForIntents({
    pi_rec: { id: "pi_rec", currency: "cad", amount: 226_000, amount_received: 226_000, application_fee_amount: 7035, metadata: { fq_fee_estimate_cents: "6810", fq_recovery_cents: "225", companyId: "co1" }, latest_charge: { id: "ch_r", payment_method_details: { type: "card" }, balance_transaction: { fee: 6584 }, transfer: "tr_r" } },
  }, log);
  const ledgerRows = new Map([["r1", { id: "r1", companyId: "co1", currency: "cad", feeCents: 200, recoveredCents: 0, period: "2026-08", createdAt: new Date(1) }], ["r2", { id: "r2", companyId: "co1", currency: "cad", feeCents: 100, recoveredCents: 0, period: "2026-09", createdAt: new Date(2) }]]);
  const db = {
    connectFeeRecovery: {
      findMany: async ({ where, orderBy }) => [...ledgerRows.values()].filter((r) => (where.recoveredOnPaymentIntent ? r.recoveredOnPaymentIntent === where.recoveredOnPaymentIntent : r.companyId === where.companyId && r.currency === where.currency)).sort((a, b) => a.period.localeCompare(b.period)),
      update: async ({ where, data }) => { const r = ledgerRows.get(where.id); r.recoveredCents += data.recoveredCents.increment; r.recoveredOnPaymentIntent = data.recoveredOnPaymentIntent; r.recoveredAt = data.recoveredAt; return r; },
    },
  };
  const fee = await settledFeeFor("pi_rec", { stripe: client, db });
  ok("a charge carrying 225 of account-fee recovery: processing fee 6810 (unchanged), account fee 225 its own figure, net 218965, period = the oldest month recovered",
    fee.processingFeeCents === 6810 && fee.accountFeeRecoveredCents === 225 && fee.netCents === 218_965 && fee.accountFeePeriod === "2026-08", fee);
  ok("  ^ the ledger rows are marked recovered oldest-first: 200 of Aug, 25 of Sept, stamped with the intent",
    ledgerRows.get("r1").recoveredCents === 200 && ledgerRows.get("r2").recoveredCents === 25 && ledgerRows.get("r1").recoveredOnPaymentIntent === "pi_rec");
  const again = await settledFeeFor("pi_rec", { stripe: client, db });
  ok("  ^ a redelivered settlement allocates nothing more", again.accountFeeRecoveredCents === 225 && ledgerRows.get("r2").recoveredCents === 25);
}
{
  const log = [];
  const client = fakeStripeForIntents({
    pi_affirm: { id: "pi_affirm", currency: "cad", amount: 226_000, amount_received: 226_000, application_fee_amount: 6810, latest_charge: { id: "ch_2", payment_method_details: { type: "affirm" }, balance_transaction: { fee: 13_590 }, transfer: "tr_2" } },
  }, log);
  const fee = await settledFeeFor("pi_affirm", { stripe: client });
  const rev = log.find((l) => l.op === "reversal");
  ok("an Affirm intent: the difference to Stripe's ACTUAL Affirm fee is reversed from the transfer (13590 − (6810 − 226) = 7006)",
    rev && rev.tr === "tr_2" && rev.params.amount === 7006, rev?.params);
  ok("  ^ idempotent per intent, the same key every true-up uses", rev?.opts?.idempotencyKey === "fq-fee-trueup-pi_affirm");
  ok("  ^ and the row records Affirm's actual fee + the margin: 13816, net 212184, label 'affirm'",
    fee.processingFeeCents === 13_816 && fee.netCents === 212_184 && fee.feeRateLabel === "affirm", fee);
}
{
  const log = [];
  globalThis.__reversalFails = true;
  const client = fakeStripeForIntents({
    pi_affirm2: { id: "pi_affirm2", currency: "cad", amount: 10_000, amount_received: 10_000, application_fee_amount: 330, latest_charge: { id: "ch_3", payment_method_details: { type: "affirm" }, balance_transaction: { fee: 630 }, transfer: "tr_3" } },
  }, log);
  const fee = await settledFeeFor("pi_affirm2", { stripe: client });
  globalThis.__reversalFails = false;
  ok("a failed true-up still records the payment, with the fee that WAS collected (never overcharges)",
    fee.processingFeeCents === 330 && fee.netCents === 9670);
}
{
  const client = fakeStripeForIntents({
    pi_old: { id: "pi_old", amount: 10_000, amount_received: 10_000, application_fee_amount: null, latest_charge: { id: "ch_4", payment_method_details: { type: "card" } } },
  });
  ok("an intent with no application fee (created before this shipped) → null, not zero", (await settledFeeFor("pi_old", { stripe: client })) === null);
  ok("a failing lookup → null through settledFeeOrNull, never a throw", (await settledFeeOrNull("pi_missing", { stripe: client })) === null);
  ok("no id → null", (await settledFeeFor(null, { stripe: client })) === null);
}
{
  // An intent object with an expanded charge is used as-is — no retrieve.
  const log = [];
  const client = fakeStripeForIntents({}, log);
  const fee = await settledFeeFor({ id: "pi_obj", amount_received: 5000, application_fee_amount: 180, latest_charge: { payment_method_details: { type: "card" } } }, { stripe: client });
  ok("an already-expanded intent object is read without a second retrieve", fee.processingFeeCents === 180 && log.length === 0);
  ok("the settlement writes estimate / actual / account-fee columns on Payment and Booking",
    /estimatedFeeCents:/.test(read("lib/invoices/recordStripePayment.js")) && /accountFeeRecoveredCents:/.test(read("lib/invoices/recordStripePayment.js")) &&
      /feeEstimatedCents:/.test(read("lib/booking/settleBookingFee.js")) && /feeAccountRecoveredCents:/.test(read("lib/booking/settleBookingFee.js")));
}

// recordStripePayment writes the three columns.
{
  const { recordStripePayment } = await import("@/lib/invoices/recordStripePayment.js");
  const rows = [];
  const inv = { id: "inv1", parentInvoiceId: null, version: 1, total: 5000, amountPaid: 0, status: "sent", companyId: "co1", client: { name: "H" } };
  const db = {
    payment: {
      findFirst: async () => null,
      create: async ({ data }) => { rows.push(data); return { id: "pay1", ...data }; },
      findMany: async () => rows.map((r, i) => ({ id: `pay${i + 1}`, ...r, refundedAmount: 0, disputeStatus: null })),
    },
    invoice: {
      findUnique: async () => ({ ...inv }),
      findMany: async () => [{ id: "inv1", version: 1, parentInvoiceId: null }],
      update: async ({ data }) => ({ ...inv, ...data }),
    },
  };
  const r = await recordStripePayment(db, { invoiceId: "inv1", paymentIntentId: "pi_x", amountCents: 226_000, fee: { processingFeeCents: 6810, netCents: 219_190, feeRateLabel: "card" } }, { notify: async () => {}, notifyEvent: async () => {} });
  ok("recordStripePayment writes processingFeeCents / netCents / feeRateLabel on the Payment row",
    r.recorded && rows[0].processingFeeCents === 6810 && rows[0].netCents === 219_190 && rows[0].feeRateLabel === "card", rows[0]);
  ok("  ^ and `amount` stays GROSS", rows[0].amount === 2260);
  rows.length = 0;
  await recordStripePayment(db, { invoiceId: "inv1", paymentIntentId: "pi_y", amountCents: 1000, fee: null }, { notify: async () => {}, notifyEvent: async () => {} });
  ok("  ^ a null fee leaves the columns absent — not written as 0", !("processingFeeCents" in rows[0]) && !("netCents" in rows[0]));
}

// settleBookingFee writes the booking's three columns.
{
  const { settleBookingFee, bookingPaymentFromSession } = await import("@/lib/booking/settleBookingFee.js");
  const bookings = new Map([["bk1", { id: "bk1", status: "pending_payment", clientEmail: "h@x", clientName: "H", startTime: new Date(), eventType: { id: "et1", userId: "u1", company: { id: "co1" } } }]]);
  const db = {
    booking: {
      findUnique: async ({ where }) => bookings.get(where.id) || null,
      updateMany: async ({ where, data }) => { const b = bookings.get(where.id); if (!b || b.status !== where.status) return { count: 0 }; bookings.set(where.id, { ...b, ...data }); return { count: 1 }; },
    },
    client: { findFirst: async () => ({ id: "cl1" }), create: async () => ({ id: "cl1" }) },
    appointment: { create: async ({ data }) => ({ id: "ap1", ...data }), delete: async () => ({}) },
  };
  const payment = await bookingPaymentFromSession(
    { id: "cs_b", amount_total: 5000, currency: "usd", payment_intent: "pi_b" },
    { readFee: async (id) => (id === "pi_b" ? { processingFeeCents: 180, netCents: 4820, feeRateLabel: "card" } : null) },
  );
  ok("bookingPaymentFromSession carries the fee alongside the intent id", payment.paymentIntentId === "pi_b" && payment.fee.processingFeeCents === 180);
  const r = await settleBookingFee("bk1", payment, { db, finalize: async () => {} });
  const after = bookings.get("bk1");
  ok("settleBookingFee writes feeProcessingCents / feeNetCents / feeRateLabel; feePaidCents stays gross",
    r.settled && after.feeProcessingCents === 180 && after.feeNetCents === 4820 && after.feeRateLabel === "card" && after.feePaidCents === 5000, after);
  ok("the three booking-settle callers all build the payment through bookingPaymentFromSession",
    ["lib/stripe/settleCheckoutSession.js", "app/api/booking/[companySlug]/settle/route.js", "lib/booking/reconcileBookingFee.js"]
      .every((f) => /bookingPaymentFromSession\(/.test(read(f))));
  ok("settleCheckoutSession passes the fee into recordStripePayment for an invoice", /recordStripePayment\(db,\s*\{[\s\S]*?fee,/.test(read("lib/stripe/settleCheckoutSession.js")));
  ok("both service-plan settlement paths read the fee", (read("lib/servicePlans/run.js").match(/fee:\s*await settledFeeOrNull\(/g) || []).length === 2);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 6. Disputes: hold + $15 fee recovered from the contractor; returned when won ──\n");

const { disputeRecoveryPlan, recoverDispute, returnWonDispute, DISPUTE_FEE_CENTS } = await import("@/lib/stripe/disputeRecovery.js");
ok("the dispute fee is $15 (1500¢)", DISPUTE_FEE_CENTS === 1500);
{
  const p = disputeRecoveryPlan({ disputedCents: 50_000, transferCents: 219_190, alreadyReversedCents: 0 });
  ok("a $500 dispute on a $2,260 transfer: $500 held + $15 fee, no shortfall", p.holdCents === 50_000 && p.feeCents === 1500 && p.shortfallCents === 0, p);
  const full = disputeRecoveryPlan({ disputedCents: 226_000, transferCents: 219_190 });
  ok("a FULL dispute: the transfer ($2,191.90) is all that can come back — hold capped, fee 0, shortfall = fee + processing fee ($83.10)",
    full.holdCents === 219_190 && full.feeCents === 0 && full.shortfallCents === 8310, full);
  const partly = disputeRecoveryPlan({ disputedCents: 218_000, transferCents: 219_190 });
  ok("a dispute $11.90 under the transfer: full hold, fee capped at what remains ($11.90), shortfall $3.10",
    partly.holdCents === 218_000 && partly.feeCents === 1190 && partly.shortfallCents === 310, partly);
  const reversed = disputeRecoveryPlan({ disputedCents: 10_000, transferCents: 100_000, alreadyReversedCents: 95_000 });
  ok("an earlier reversal (Affirm true-up) reduces what is left to give back", reversed.holdCents === 5000 && reversed.feeCents === 0);
}
{
  const log = [];
  const client = fakeStripeForIntents({}, log);
  globalThis.__charges = { ch_d: { id: "ch_d", currency: "cad", transfer: { id: "tr_d", amount: 219_190, amount_reversed: 0, destination: "acct_contractor" } } };
  const writes = [];
  const db = { payment: { update: async ({ where, data }) => { writes.push({ where, data }); return {}; } } };
  const payment = { id: "pay_d", disputeHeldCents: null, disputeFeeCents: null, disputeReturnedCents: null };
  const dispute = { id: "dp_1", charge: "ch_d", amount: 50_000, currency: "cad", status: "needs_response" };
  const r = await recoverDispute({ payment, dispute }, { stripe: client, db });
  const revs = log.filter((l) => l.op === "reversal");
  ok("charge.dispute.created → TWO reversals on the charge's transfer: $500 hold, then $15 fee",
    r.recovered && revs.length === 2 && revs[0].params.amount === 50_000 && revs[1].params.amount === 1500 && revs.every((x) => x.tr === "tr_d"), revs.map((x) => x.params));
  ok("  ^ each idempotent on the dispute id", revs[0].opts.idempotencyKey === "fq-dispute_hold-dp_1" && revs[1].opts.idempotencyKey === "fq-dispute_fee-dp_1");
  ok("  ^ the Payment row records $500 held and $15 fee", writes[0].data.disputeHeldCents === 50_000 && writes[0].data.disputeFeeCents === 1500);
  const again = await recoverDispute({ payment: { ...payment, disputeHeldCents: 50_000 }, dispute }, { stripe: client, db });
  ok("  ^ a redelivered event recovers nothing twice", again.recovered === false && again.reason === "already_recovered");

  log.length = 0; writes.length = 0;
  const won = await returnWonDispute({ payment: { ...payment, disputeHeldCents: 50_000, disputeFeeCents: 1500 }, dispute: { ...dispute, status: "won" } }, { stripe: client, db });
  const tr = log.find((l) => l.op === "transfer");
  ok("charge.dispute.closed (won) → the $500 hold is transferred back to the contractor; the fee is not",
    won.returned && tr && tr.params.amount === 50_000 && tr.params.destination === "acct_contractor" && tr.params.currency === "cad", tr?.params);
  ok("  ^ idempotent on the dispute id", tr?.opts?.idempotencyKey === "fq-dispute-won-dp_1");
  ok("  ^ recorded as disputeReturnedCents", writes[0].data.disputeReturnedCents === 50_000);
  const lost = await returnWonDispute({ payment: { ...payment, disputeHeldCents: 50_000 }, dispute: { ...dispute, status: "lost" } }, { stripe: client, db });
  ok("a LOST dispute returns nothing", lost.returned === false && lost.reason === "not_won");
  const twice = await returnWonDispute({ payment: { ...payment, disputeHeldCents: 50_000, disputeReturnedCents: 50_000 }, dispute: { ...dispute, status: "won" } }, { stripe: client, db });
  ok("a second closed(won) delivery pays nothing twice", twice.returned === false && twice.reason === "already_returned");
}
{
  // Through settleChargeEvent, end to end, with a fake prisma.
  const { settleChargeEvent } = await import("@/lib/stripe/settleChargeEvent.js");
  const log = [];
  const client = fakeStripeForIntents({}, log);
  globalThis.__charges = { ch_e: { id: "ch_e", currency: "usd", transfer: { id: "tr_e", amount: 4820, amount_reversed: 0, destination: "acct_contractor" } } };
  const payments = new Map([["pay_e", { id: "pay_e", invoiceId: "inv_e", amount: 50, refundedAmount: 0, disputeStatus: null, disputedAt: null, disputeHeldCents: null, disputeFeeCents: null, disputeReturnedCents: null, stripePaymentIntentId: "pi_e" }]]);
  const inv = { id: "inv_e", parentInvoiceId: null, version: 1, total: 50, status: "paid", companyId: "co1", disputedAt: null, refundedAt: null };
  const prisma = {
    payment: {
      findFirst: async ({ where }) => [...payments.values()].find((p) => p.stripePaymentIntentId === where.stripePaymentIntentId) || null,
      update: async ({ where, data }) => { payments.set(where.id, { ...payments.get(where.id), ...data }); return payments.get(where.id); },
      findMany: async () => [...payments.values()],
    },
    invoice: { findUnique: async () => ({ ...inv }), findMany: async () => [{ id: "inv_e", version: 1, parentInvoiceId: null }], update: async () => ({}) },
  };
  const res = await settleChargeEvent(
    { type: "charge.dispute.created", data: { object: { id: "dp_e", charge: "ch_e", payment_intent: "pi_e", amount: 5000, currency: "usd", status: "needs_response" } } },
    { prisma, deps: { stripe: client } },
  );
  const p = payments.get("pay_e");
  ok("settleChargeEvent runs the recovery after recording the dispute: status + held + fee on one row",
    res.handled && res.result?.recovery?.recovered && p.disputeStatus === "needs_response" && p.disputeHeldCents === 4820 && p.disputeFeeCents === 0, p);
  ok("  ^ ($50 booking-sized charge: the $48.20 transfer is all that can come back; the fee shortfall is logged, not hidden)", res.result.recovery.shortfallCents === 1680);
  const closed = await settleChargeEvent(
    { type: "charge.dispute.closed", data: { object: { id: "dp_e", charge: "ch_e", payment_intent: "pi_e", amount: 5000, currency: "usd", status: "won" } } },
    { prisma, deps: { stripe: client } },
  );
  ok("  ^ and closed(won) sends the held amount back", closed.result?.recovery?.returned && payments.get("pay_e").disputeReturnedCents === 4820);
  ok("the recovery is awaited and may throw — a failed reversal makes Stripe redeliver", /recovery = await recoverDispute\(/.test(read("lib/stripe/settleChargeEvent.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 6b. Connect account fees: the ledger, the cap, the carry-forward ──\n");

{
  const ledger = await import("@/lib/stripe/connectFeeLedger.js");
  const { recoveryOnCharge, allocateRecovery, applyRecovery, outstandingRecoveryCents, connectFeeTotals } = ledger;
  const r1 = recoveryOnCharge({ outstandingCents: 225, processingFeeCents: 6810, amountCents: 226_000 });
  ok("$2.25 owed on a $2,260 charge: all of it rides, nothing carries forward", r1.recoverCents === 225 && r1.carryForwardCents === 0);
  const r2 = recoveryOnCharge({ outstandingCents: 5_000, processingFeeCents: 60, amountCents: 1000 });
  ok("$50 owed on a $10 charge: $9.40 rides (fee ≤ amount), $40.60 carries forward", r2.recoverCents === 940 && r2.carryForwardCents === 4060, r2);
  const r3 = recoveryOnCharge({ outstandingCents: 0, processingFeeCents: 60, amountCents: 1000 });
  ok("nothing owed → nothing rides", r3.recoverCents === 0);
  const r4 = recoveryOnCharge({ outstandingCents: 300, processingFeeCents: 1000, amountCents: 1000 });
  ok("a charge whose processing fee already equals the amount carries none of it", r4.recoverCents === 0 && r4.carryForwardCents === 300);
  const alloc = allocateRecovery([{ id: "a", feeCents: 200, recoveredCents: 150, period: "2026-07" }, { id: "b", feeCents: 25, recoveredCents: 0, period: "2026-08" }, { id: "c", feeCents: 100, recoveredCents: 0, period: "2026-09" }], 90);
  ok("allocation is oldest-first and never exceeds what a row still owes: 50 + 25 + 15",
    alloc.updates.map((u) => `${u.id}:${u.addCents}`).join() === "a:50,b:25,c:15" && alloc.unallocatedCents === 0, alloc);

  const rows = new Map([["x", { id: "x", companyId: "co1", currency: "cad", feeCents: 225, recoveredCents: 0, period: "2026-09", createdAt: new Date(1) }], ["y", { id: "y", companyId: "co1", currency: "usd", feeCents: 100, recoveredCents: 0, period: "2026-09", createdAt: new Date(2) }]]);
  const db = {
    connectFeeRecovery: {
      findMany: async ({ where = {} }) => [...rows.values()].filter((r) => (where.recoveredOnPaymentIntent ? r.recoveredOnPaymentIntent === where.recoveredOnPaymentIntent : (!where.companyId || r.companyId === where.companyId) && (!where.currency || r.currency === where.currency))),
      update: async ({ where, data }) => { const r = rows.get(where.id); r.recoveredCents += data.recoveredCents.increment; r.recoveredOnPaymentIntent = data.recoveredOnPaymentIntent; r.recoveredAt = data.recoveredAt; return r; },
    },
  };
  ok("outstanding is per currency: 225 in CAD, 100 in USD — a CAD fee never rides on a USD charge",
    (await outstandingRecoveryCents({ companyId: "co1", currency: "cad" }, { db })) === 225 && (await outstandingRecoveryCents({ companyId: "co1", currency: "usd" }, { db })) === 100);
  const applied = await applyRecovery({ companyId: "co1", currency: "cad", cents: 225, paymentIntentId: "pi_1" }, { db });
  ok("applyRecovery marks the CAD row recovered on the intent", applied.appliedCents === 225 && rows.get("x").recoveredCents === 225 && rows.get("x").recoveredOnPaymentIntent === "pi_1");
  ok("  ^ and a second call on the same intent applies nothing", (await applyRecovery({ companyId: "co1", currency: "cad", cents: 225, paymentIntentId: "pi_1" }, { db })).appliedCents === 0);
  ok("  ^ a company that never pays again simply stays outstanding — the USD row is untouched, never written off",
    (await outstandingRecoveryCents({ companyId: "co1", currency: "usd" }, { db })) === 100);
  const totals = await connectFeeTotals({ month: "2026-09" }, { db });
  ok("platform totals per currency: CAD recovered 225 / outstanding 0; USD recovered 0 / outstanding 100",
    totals.cad.recoveredThisMonthCents === 225 && totals.cad.outstandingCents === 0 && totals.usd.outstandingCents === 100 && totals.usd.billedThisMonthCents === 100, totals);

  const feesLib = await import("@/lib/stripe/connectFees.js");
  const { classifyFeeTransaction, collectConnectFees } = feesLib;
  const active = classifyFeeTransaction({ id: "txn_a", type: "stripe_fee", amount: -200, currency: "cad", created: 1_788_000_000, description: "Connect: monthly active account fee for acct_contractor" });
  ok("a stripe_fee naming an account and 'active' → active_account, 200¢, period from created", active && active.kind === "active_account" && active.feeCents === 200 && active.stripeAccountId === "acct_contractor" && /^\d{4}-\d{2}$/.test(active.period), active);
  const payout = classifyFeeTransaction({ id: "txn_p", type: "stripe_fee", amount: -25, currency: "cad", created: 1_788_000_000, description: "Payout fee (acct_contractor)" });
  ok("  ^ 'payout' → payout", payout?.kind === "payout" && payout.feeCents === 25);
  ok("a stripe_fee with no account in its description is not a company's (Radar, Identity) → null",
    classifyFeeTransaction({ id: "txn_r", type: "stripe_fee", amount: -5, currency: "cad", description: "Radar for Fraud Teams" }) === null);
  ok("a connect_collection_transfer or a payout type is never read as a fee",
    classifyFeeTransaction({ id: "t", type: "connect_collection_transfer", amount: 200, description: "acct_x" }) === null && classifyFeeTransaction({ id: "t", type: "payout", amount: -1000, description: "acct_x" }) === null);
  ok("a positive stripe_fee (a refunded fee) is not a charge to recover", classifyFeeTransaction({ id: "t", type: "stripe_fee", amount: 200, description: "acct_x refund" }) === null);

  // The cron, end to end, with a scripted Stripe and a fake ledger.
  const written = [];
  const listCalls = [];
  const client = { balanceTransactions: { list: async (params) => { listCalls.push(params); return { data: [
    { id: "txn_a", type: "stripe_fee", amount: -200, currency: "cad", created: 1_788_000_000, description: "Connect: monthly active account fee for acct_contractor" },
    { id: "txn_p", type: "stripe_fee", amount: -25, currency: "cad", created: 1_788_000_000, description: "Payout fee (acct_contractor)" },
    { id: "txn_u", type: "stripe_fee", amount: -25, currency: "cad", created: 1_788_000_000, description: "Payout fee (acct_unknown)" },
    { id: "txn_r", type: "stripe_fee", amount: -5, currency: "cad", created: 1_788_000_000, description: "Radar" },
  ], has_more: false }; } } };
  const cronDb = {
    company: { findMany: async () => [{ id: "co1", stripeAccountId: "acct_contractor" }] },
    connectFeeRecovery: {
      findUnique: async ({ where }) => written.find((w) => w.stripeBalanceTransactionId === where.stripeBalanceTransactionId) || null,
      create: async ({ data }) => { written.push(data); return data; },
    },
  };
  const stats = await collectConnectFees({ days: 3 }, { stripe: client, db: cronDb });
  ok("the cron lists platform stripe_fee transactions for the window and writes one row per company fee",
    listCalls[0].type === "stripe_fee" && stats.written === 2 && written.every((w) => w.companyId === "co1"), stats);
  ok("  ^ skips fees naming no account (1) and accounts that are nobody's (1), and says so", stats.skippedNoAccount === 1 && stats.skippedUnknownCompany === 1);
  const again = await collectConnectFees({ days: 3 }, { stripe: client, db: cronDb });
  ok("  ^ a second run writes nothing (keyed on the balance transaction id)", again.written === 0 && written.length === 2);
  ok("the cron is scheduled in vercel.json and authenticated", /\/api\/cron\/connect-fees/.test(read("vercel.json")) && /requireCronSecret/.test(read("app/api/cron/connect-fees/route.js")));
  ok("the platform card reads the ledger totals through its own gated route",
    /getCurrentPlatformAdmin/.test(read("app/api/platform/billing/connect-fees/route.js")) && /\/api\/platform\/billing\/connect-fees/.test(read("app/platform/billing/plans/ProcessingRatesCard.js")));
  ok("the invoice screen prints the account fee as its own line", /app\.invoiceDetail\.accountFeeLine/.test(read("app/app/invoices/[id]/page.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 7. Instant payouts: the gate, the numbers, the button ─────────────\n");

const rules = await import("@/lib/stripe/instantPayoutRules.js");
const { instantPayoutEligibility, reportedFeePercent, INSTANT_PAYOUT_MIN_ACCOUNT_AGE_DAYS, INSTANT_PAYOUTS_ENABLED } = rules;
ok("the platform switch ships ON (owner, 2026-09-12: offered with the fee stated plainly)", INSTANT_PAYOUTS_ENABLED === true);
const NOW = Date.parse("2026-09-12T12:00:00Z");
const daysAgo = (d) => Math.floor((NOW - d * 86_400_000) / 1000);
const card = { id: "card_1", object: "card", last4: "4242", currency: "cad", available_payout_methods: ["standard", "instant"] };
const bank = { id: "ba_1", object: "bank_account", last4: "0001", currency: "cad", available_payout_methods: ["standard"] };
const account = (over = {}) => ({ id: "acct_contractor", charges_enabled: true, payouts_enabled: true, created: daysAgo(45), external_accounts: { data: [card] }, ...over });
const balance = { instant_available: [{ amount: 100_000, currency: "cad", net_available: [{ amount: 99_000, destination: "card_1" }] }] };
const company = { id: "co1", stripeAccountId: "acct_contractor", stripeChargesEnabled: true };

ok("the gate is 30 days", INSTANT_PAYOUT_MIN_ACCOUNT_AGE_DAYS === 30);
{
  const e = instantPayoutEligibility({ company, account: account(), balance, now: NOW });
  ok("eligible: gross $1,000, net $990, fee $10 (1%), to the debit card",
    e.eligible && e.grossCents === 100_000 && e.netCents === 99_000 && e.feeCents === 1000 && e.destination.id === "card_1" && e.currency === "cad", e);
  ok("  ^ reported fee percent is derived from gross and net — never hardcoded", reportedFeePercent(e) === "1");
  ok("  ^ a dashboard set to 1.5% would show 1.5, not 1", reportedFeePercent({ grossCents: 100_000, netCents: 98_500 }) === "1.50");
}
ok("refused: not connected", instantPayoutEligibility({ company: { id: "co1" }, account: null, balance, now: NOW }).reason === "not_connected");
ok("refused: charges disabled in our column", instantPayoutEligibility({ company: { ...company, stripeChargesEnabled: false }, account: account(), balance, now: NOW }).reason === "charges_disabled");
ok("refused: charges disabled at Stripe", instantPayoutEligibility({ company, account: account({ charges_enabled: false }), balance, now: NOW }).reason === "charges_disabled");
ok("refused: payouts disabled", instantPayoutEligibility({ company, account: account({ payouts_enabled: false }), balance, now: NOW }).reason === "payouts_disabled");
{
  const young = instantPayoutEligibility({ company, account: account({ created: daysAgo(29) }), balance, now: NOW });
  ok("refused: account 29 days old (below the 30-day gate), and the age is reported", young.reason === "account_too_new" && young.accountAgeDays === 29);
  ok("  ^ exactly 30 days is allowed", instantPayoutEligibility({ company, account: account({ created: daysAgo(30) }), balance, now: NOW }).eligible === true);
  ok("  ^ a missing created timestamp is refused, not assumed old", instantPayoutEligibility({ company, account: account({ created: undefined }), balance, now: NOW }).reason === "account_too_new");
}
ok("refused: no external account at all", instantPayoutEligibility({ company, account: account({ external_accounts: { data: [] } }), balance, now: NOW }).reason === "no_external_account");
ok("refused: only a bank account (Canada: standard payouts only) — says a debit card is needed",
  instantPayoutEligibility({ company, account: account({ external_accounts: { data: [bank] } }), balance, now: NOW }).reason === "no_instant_destination");
ok("refused: nothing available", instantPayoutEligibility({ company, account: account(), balance: { instant_available: [{ amount: 0, currency: "cad", net_available: [{ amount: 0, destination: "card_1" }] }] }, now: NOW }).reason === "nothing_available");
ok("refused: no balance object", instantPayoutEligibility({ company, account: account(), balance: null, now: NOW }).reason === "nothing_available");

{
  const { createInstantPayout } = await import("@/lib/stripe/instantPayout.js");
  const log = [];
  const rows = [];
  let gate;
  const client = {
    accounts: { retrieve: async (id, opts) => { log.push({ op: "acct", id, opts }); return account(); } },
    balance: { retrieve: async (params, opts) => { log.push({ op: "bal", params, opts }); return balance; } },
    payouts: { create: async (params, opts) => { log.push({ op: "payout", params, opts }); if (gate) await gate; return { id: "po_1", arrival_date: 1, ...params }; } },
  };
  const db = { instantPayout: { create: async ({ data }) => { rows.push(data); return { id: "ip1", ...data }; } } };
  const r = await createInstantPayout({ company, userId: "u1", requestId: "req-1" }, { stripe: client, db, now: NOW });
  const po = log.find((l) => l.op === "payout");
  ok("createInstantPayout pays out Stripe's NET figure, method instant, to the card, ON the connected account",
    r.ok && po.params.amount === 99_000 && po.params.currency === "cad" && po.params.method === "instant" && po.params.destination === "card_1" && po.opts.stripeAccount === "acct_contractor", po);
  ok("  ^ idempotency key per request", po.opts.idempotencyKey === "fq-instant-payout-co1-req-1");
  ok("  ^ balance read with instant_available.net_available expanded, on the connected account",
    log.find((l) => l.op === "bal").params.expand.includes("instant_available.net_available") && log.find((l) => l.op === "bal").opts.stripeAccount === "acct_contractor");
  ok("  ^ recorded: company-scoped InstantPayout with gross, net, payout id, who clicked",
    rows[0].companyId === "co1" && rows[0].grossCents === 100_000 && rows[0].netCents === 99_000 && rows[0].stripePayoutId === "po_1" && rows[0].createdById === "u1", rows[0]);

  // Two clicks, one in flight.
  let release;
  gate = new Promise((res) => { release = res; });
  const first = createInstantPayout({ company, userId: "u1", requestId: "req-2" }, { stripe: client, db, now: NOW });
  await new Promise((res) => setTimeout(res, 5));
  const second = await createInstantPayout({ company, userId: "u1", requestId: "req-3" }, { stripe: client, db, now: NOW });
  release();
  await first;
  ok("a second click while one is in flight is refused with 409, and creates no payout", second.ok === false && second.reason === "in_flight" && second.status === 409 && log.filter((l) => l.op === "payout").length === 2);

  const young = await createInstantPayout({ company, userId: "u1", requestId: "req-4" }, { stripe: { ...client, accounts: { retrieve: async () => account({ created: daysAgo(3) }) } }, db, now: NOW });
  ok("below the gate: refused before any payout is attempted", young.ok === false && young.reason === "account_too_new" && log.filter((l) => l.op === "payout").length === 2);
  const off = await createInstantPayout({ company, userId: "u1", requestId: "req-5" }, { stripe: client, db, now: NOW, enabled: false });
  ok("with the switch off: refused as 404 'disabled' before Stripe is read", off.ok === false && off.reason === "disabled" && off.status === 404 && log.filter((l) => l.op === "payout").length === 2);
}
{
  const card = read("app/app/settings/payments/InstantPayoutCard.js");
  const route = read("app/api/stripe/connect/instant-payout/route.js");
  ok("the route answers 404 for GET and POST when the switch is off", (route.match(/if \(!INSTANT_PAYOUTS_ENABLED\) return OFF\(\);/g) || []).length === 2);
  ok("the card renders nothing when the switch is off", /if \(!INSTANT_PAYOUTS_ENABLED \|\| !connected\) return null;/.test(card));
  ok("the fee disclaimer is on the card BEFORE the button and again on the confirm step",
    /data-instant-disclaimer="card"/.test(card) && /data-instant-disclaimer="confirm"/.test(card) && card.indexOf('data-instant-disclaimer="card"') < card.indexOf("instantButton"));
  ok("the confirm step shows Stripe's exact gross · fee · net and only the confirm sends",
    /instantConfirmLine/.test(card) && /gross: money\(state\.grossCents/.test(card) && /onClick=\{handlePayout\}/.test(card) && /onClick=\{\(\) => setConfirming\(true\)\}/.test(card));
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");
  const en = APP_MESSAGES.en["app.setPayments.instantDisclaimer"];
  ok("the English disclaimer says 1%, at cost, FieldQuo keeps none, standard payouts free (~2 business days), ~30 minutes, bank may delay",
    /\{rate\}/.test(en) && /at cost/.test(en) && /keeps none/.test(en) && /free/.test(en) && /2 business days/.test(en) && /30 minutes/.test(en) && /delayed by your bank/.test(en));
  ok("  ^ and exists, translated, in all 9 languages",
    Object.keys(APP_MESSAGES).every((l) => typeof APP_MESSAGES[l]["app.setPayments.instantDisclaimer"] === "string" && APP_MESSAGES[l]["app.setPayments.instantConfirmLine"]) &&
      Object.keys(APP_MESSAGES).filter((l) => l !== "en").every((l) => APP_MESSAGES[l]["app.setPayments.instantDisclaimer"] !== en));
}
{
  const route = read("app/api/stripe/connect/instant-payout/route.js");
  const post = route.slice(route.indexOf("export async function POST"));
  ok("the POST refuses under impersonation (403) before touching Stripe",
    /if \(member\.impersonation\)/.test(post) && post.indexOf("member.impersonation") < post.indexOf("createInstantPayout("));
  ok("  ^ and requires a billing admin", /isBillingAdmin\(member\.role\)/.test(post));
  ok("  ^ reads no amount from the request body", !/request\.json\(\)|await request\.text|formData/.test(post));
  ok("the response never carries the platform's share of the instant fee as a rate — gross, net, reported fee only",
    !/margin|platformShare|basisPoints/.test(route));
  ok("the settings card calls the route and the page mounts both cards",
    /\/api\/stripe\/connect\/instant-payout/.test(read("app/app/settings/payments/InstantPayoutCard.js")) &&
      /<InstantPayoutCard/.test(read("app/app/settings/payments/page.js")) && /<ProcessingFeesCard/.test(read("app/app/settings/payments/page.js")));
  ok("the card links to the Express dashboard through the login-link route, never a stripe.com URL",
    /onOpenDashboard/.test(read("app/app/settings/payments/InstantPayoutCard.js")) && !/stripe\.com/.test(read("app/app/settings/payments/InstantPayoutCard.js")));
  ok("the fees card renders the rate table from publishedRates and runs feeBreakdown for its example",
    /publishedRates\(/.test(read("app/app/settings/payments/ProcessingFeesCard.js")) && /feeBreakdown\(/.test(read("app/app/settings/payments/ProcessingFeesCard.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 8. Export, invoice screen, i18n ──────────────────────────────────\n");

{
  const { buildAccountingExport } = await import("@/lib/export/accountingExport.js");
  const out = buildAccountingExport({
    from: "2026-09-01", to: "2026-09-30", currency: "CAD",
    invoices: [{ id: "i1", invoiceNumber: "INV-1", total: 2260, tax: 0, amountPaid: 2260, status: "paid", createdAt: new Date("2026-09-10"), client: { name: "H" } }],
    payments: [
      { id: "p1", invoiceId: "i1", amount: 2260, method: "stripe", date: new Date("2026-09-11"), stripePaymentIntentId: "pi_1", processingFeeCents: 6810, netCents: 219_190, feeRateLabel: "card", invoice: { invoiceNumber: "INV-1", client: { name: "H" } } },
      { id: "p2", invoiceId: "i1", amount: 100, method: "cash", date: new Date("2026-09-12"), invoice: { invoiceNumber: "INV-1", client: { name: "H" } } },
    ],
  });
  const pay = out.files.find((f) => f.kind === "payments").csv.split("\n");
  ok("the payments file carries Processing fee / Net deposited / Fee rate / Stripe account fees columns", /Processing fee,Net deposited,Fee rate,Stripe account fees/.test(pay[0]));
  {
    const withAcct = buildAccountingExport({
      from: "2026-09-01", to: "2026-09-30", currency: "CAD",
      invoices: [{ id: "i1", invoiceNumber: "INV-1", total: 2260, tax: 0, amountPaid: 2260, status: "paid", createdAt: new Date("2026-09-10"), client: { name: "H" } }],
      payments: [{ id: "p1", invoiceId: "i1", amount: 2260, method: "stripe", date: new Date("2026-09-11"), stripePaymentIntentId: "pi_1", processingFeeCents: 6810, netCents: 218_965, feeRateLabel: "card", accountFeeRecoveredCents: 225, accountFeePeriod: "2026-08", invoice: { invoiceNumber: "INV-1", client: { name: "H" } } }],
    });
    const line = withAcct.files.find((f) => f.kind === "payments").csv.split("\n")[1];
    ok("  ^ a payment carrying account-fee recovery prints it in its own column (2.25), beside — not inside — the processing fee", /68\.10,2189\.65,card,2\.25/.test(line), line);
    ok("  ^ and the summary totals it separately", /Stripe account fees/.test(withAcct.files.find((f) => f.kind === "summary").csv) && withAcct.totals.CAD.accountFees === 2.25);
  }
  ok("  ^ the Stripe payment shows 2260.00 gross, 68.10 fee, 2191.90 net, 'card'", /2260\.00,68\.10,2191\.90,card/.test(pay[1]), pay[1]);
  ok("  ^ the cash payment leaves the fee cells BLANK, not 0.00", /100\.00,,,,/.test(pay[2]), pay[2]);
  ok("  ^ payments received stays gross", out.totals.CAD.paid === 2360);
  const summary = out.files.find((f) => f.kind === "summary").csv;
  ok("the summary has a Processing fees column with 68.10", /Processing fees/.test(summary) && /68\.10/.test(summary));
  ok("  ^ and says which payments carry no fee", /leave the fee columns blank/.test(summary));
}
{
  const page = read("app/app/invoices/[id]/page.js");
  ok("the invoice screen prints '{method} processing {fee} · deposited {net}' only when the row carries a fee",
    /app\.invoiceDetail\.feeLine/.test(page) && /p\.processingFeeCents != null && p\.netCents != null/.test(page));
  ok("  ^ and the dispute line only once the recovery has run", /p\.disputeStatus && p\.disputeHeldCents != null/.test(page));
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");
  const keys = ["app.setPayments.feesTitle", "app.setPayments.feesIntro", "app.setPayments.feeMethod.card", "app.setPayments.feeMethod.acss_debit", "app.setPayments.feesExample", "app.setPayments.instantTitle", "app.setPayments.instantIntro", "app.setPayments.instantButton", "app.setPayments.instantReason.account_too_new", "app.setPayments.instantReason.no_instant_destination", "app.invoiceDetail.feeLine", "app.invoiceDetail.disputeLine", "app.invoiceDetail.disputeWonLine", "app.feeRate.card", "app.feeRate.affirm", "app.feeRate.other"];
  const langs = Object.keys(APP_MESSAGES);
  ok("every new key exists in all 9 languages", langs.length === 9 && keys.every((k) => langs.every((l) => typeof APP_MESSAGES[l][k] === "string" && APP_MESSAGES[l][k].length > 0)));
  ok("  ^ and no non-English language is left with the English sentence",
    keys.filter((k) => APP_MESSAGES.en[k].length > 30).every((k) => langs.filter((l) => l !== "en").every((l) => APP_MESSAGES[l][k] !== APP_MESSAGES.en[k])));
  ok("the English dispute-won line says the fee is not refunded", /not refund/.test(APP_MESSAGES.en["app.invoiceDetail.disputeWonLine"]));
  ok("no customer-facing app string quotes 2.9% for cards", !langs.some((l) => Object.entries(APP_MESSAGES[l]).some(([k, v]) => k.startsWith("app.setPayments.fee") && /2\.9/.test(String(v)))));
}
{
  const schema = read("prisma/schema.prisma");
  const paymentModel = schema.slice(schema.indexOf("model Payment {"), schema.indexOf("model Payment {") + schema.slice(schema.indexOf("model Payment {")).indexOf("\n}\n"));
  ok("Payment has processingFeeCents / netCents / feeRateLabel, estimate / actual, account-fee and the three dispute columns, all nullable",
    ["processingFeeCents Int?", "netCents           Int?", "feeRateLabel       String?", "estimatedFeeCents  Int?", "stripeFeeCents     Int?", "accountFeeRecoveredCents Int?", "accountFeePeriod         String?", "disputeHeldCents     Int?", "disputeFeeCents      Int?", "disputeReturnedCents Int?"].every((c) => paymentModel.includes(c)));
  ok("ConnectFeeRecovery is company-scoped and keyed on the balance transaction",
    /model ConnectFeeRecovery \{[\s\S]*companyId String[\s\S]*stripeBalanceTransactionId String @unique[\s\S]*recoveredCents\s+Int\s+@default\(0\)/.test(schema));
  ok("Booking has feeProcessingCents / feeNetCents / feeRateLabel", /feeProcessingCents\s+Int\?/.test(schema) && /feeNetCents\s+Int\?/.test(schema));
  ok("InstantPayout is company-scoped with gross, net and payout id", /model InstantPayout \{[\s\S]*companyId String[\s\S]*stripePayoutId String @unique[\s\S]*grossCents\s+Int[\s\S]*netCents\s+Int/.test(schema));
}

console.log(`\n${fail === 0 ? "PASSED" : "FAILED"} — ${pass}/${pass + fail} assertions\n`);
process.exit(fail === 0 ? 0 : 1);
