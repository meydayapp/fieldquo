// scripts/check-client-card-surcharge.mjs
//
// The client credit-card fee (Company.clientCardSurcharge), executed against
// hostile input — the rules, the arithmetic, the charge flow with a scripted
// Stripe, the refund shares — then held in place by source guards, and the
// key assertions MUTATION-TESTED: each rule is broken on purpose in a copy of
// the module and the suite must notice.
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//        scripts/check-client-card-surcharge.mjs
//
// Sections:
//   1. the rules (lib/stripe/clientCardSurcharge.js)
//   2. the arithmetic (lib/stripe/clientCardSurchargeMath.js)
//   3. the charge flow (lib/stripe/clientCardCharge.js) with a scripted Stripe
//   4. refunds, the export, the settings route
//   5. source guards — every card charge creator is classified, only the
//      portal card form can add the fee, and it decides through the one
//      function
//   6. mutation tests

import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, resolve as resolvePath } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

process.env.STRIPE_SECRET_KEY = "sk_test_check_client_card_surcharge";
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_checkClientCardSurcharge";

const ROOT = resolvePath(dirname(new URL(import.meta.url).pathname), "..");
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
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const rules = await import("@/lib/stripe/clientCardSurcharge.js");
const math = await import("@/lib/stripe/clientCardSurchargeMath.js");
const { processingFeeCents, CLIENT_CARD_SURCHARGE_MAX_BPS } = await import("@/lib/stripe/processingFee.js");

// ── Fixtures ────────────────────────────────────────────────────────────────

const ON_CO = Object.freeze({
  id: "co_on",
  name: "Northline Painting",
  country: "CA",
  province: "ON",
  address: "1 King St W, Toronto, ON M5H 1A1, Canada",
  currency: "CAD",
  stripeAccountId: "acct_on",
  stripeChargesEnabled: true,
  isDemo: false,
  clientCardSurcharge: true,
  clientCardSurchargeNoticeConfirmedAt: new Date("2026-09-01T12:00:00Z"),
  clientCardSurchargeNoticeConfirmedById: "user_owner",
});
const QC_CO = { ...ON_CO, province: "QC", address: "755 Rue Saint-Louis, Gatineau, QC J8T 1A1, Canada" };
const QC_ADDR_ONLY_CO = { ...ON_CO, province: null, address: "755 Rue Saint-Louis, Gatineau, QC J8T 1A1, Canada" };
const UNKNOWN_CO = { ...ON_CO, province: null, address: null };
const US_CO = { ...ON_CO, country: "US", province: "TX", address: "1555 Barton Springs Rd, Austin, TX 78704, USA", currency: "USD" };
const OFF_CO = { ...ON_CO, clientCardSurcharge: false };
const NO_NOTICE_CO = { ...ON_CO, clientCardSurchargeNoticeConfirmedAt: null };
const NO_BY_CO = { ...ON_CO, clientCardSurchargeNoticeConfirmedById: null };
const BAD_DATE_CO = { ...ON_CO, clientCardSurchargeNoticeConfirmedAt: "not a date" };
const STRING_TRUE_CO = { ...ON_CO, clientCardSurcharge: "true" };

const ON_CLIENT = { province: "ON", country: "CA" };
const ON_ADDR_CLIENT = { address: "55 Elgin St, Ottawa, ON K1P 5K9, Canada" };
const QC_CLIENT = { province: "QC", country: "CA" };
const QC_NAME_CLIENT = { province: "Québec", country: "CA" };
const QC_ADDR_CLIENT = { address: "1200 Rue Sainte-Catherine O, Montréal, QC H3B 1K9, Canada" };
const UNKNOWN_CLIENT = {};
const CITY_ONLY_CLIENT = { address: "12 Main St, Ottawa" };
const US_CLIENT = { province: "NY", country: "US" };

// ════════════════════════════════════════════════════════════════════════════
// The two suites the mutation tests re-run against broken copies. Each takes
// an assertion function so a mutant run can count failures quietly.
// ════════════════════════════════════════════════════════════════════════════

function rulesSuite(R, t) {
  const dec = (o = {}) =>
    R.clientCardSurchargeDecision({
      company: ON_CO,
      client: ON_CLIENT,
      method: "card",
      funding: "credit",
      amountCents: 100_000,
      currency: "cad",
      ...o,
    });

  const base = dec();
  t("Ontario company, Ontario client, Visa CREDIT, $1,000 → fee $24.00, total $1,024.00",
    base.applies && base.surchargeCents === 2400 && base.totalCents === 102_400 && base.rateBps === 240, base);
  t("  ^ the client's province read from the address line works too", dec({ client: ON_ADDR_CLIENT }).surchargeCents === 2400);

  // Rule 1 — Canada, never Quebec, never unknown
  t("Quebec COMPANY → no fee (company_quebec)", dec({ company: QC_CO }).reason === "company_quebec" && dec({ company: QC_CO }).surchargeCents === 0);
  t("Quebec company known only from its address line → still no fee", dec({ company: QC_ADDR_ONLY_CO }).reason === "company_quebec");
  t("company whose province is unknown → no fee", dec({ company: UNKNOWN_CO }).reason === "company_region_unknown");
  t("US company → no fee (company_not_canada)", dec({ company: US_CO }).reason === "company_not_canada");
  t("Quebec CLIENT of an Ontario company → no fee (client_quebec)", dec({ client: QC_CLIENT }).reason === "client_quebec");
  t("  ^ 'Québec' spelled out → no fee", dec({ client: QC_NAME_CLIENT }).reason === "client_quebec");
  t("  ^ a Montréal address line with no province column → no fee", dec({ client: QC_ADDR_CLIENT }).reason === "client_quebec");
  t("client with NO address on file → no fee (absence is not permission)", dec({ client: UNKNOWN_CLIENT }).reason === "client_region_unknown");
  t("client with a city but no province → no fee", dec({ client: CITY_ONLY_CLIENT }).reason === "client_region_unknown");
  t("client = null → no fee", dec({ client: null }).reason === "client_region_unknown");
  t("US client of an Ontario company → no fee (client_outside_canada)", dec({ client: US_CLIENT }).reason === "client_outside_canada");
  t("Ontario client, job SITE in Gatineau QC → no fee (site_quebec)",
    dec({ siteAddress: "40 Rue Laurier, Gatineau, QC J8X 4H6, Canada" }).reason === "site_quebec");
  t("  ^ a site line that names no province is not a second opinion — fee stands", dec({ siteAddress: "back lot" }).applies === true);

  // Rule 2 — credit only
  for (const funding of ["debit", "prepaid", "unknown", null, undefined, "", " credit", "credit_card"]) {
    const d = dec({ funding });
    t(`funding ${JSON.stringify(funding)} → no fee (not_credit)`, d.applies === false && d.reason === "not_credit" && d.surchargeCents === 0, d);
  }
  for (const method of ["acss_debit", "us_bank_account", "affirm", "interac_present", "link", undefined, "CARD"]) {
    const d = dec({ method });
    t(`method ${JSON.stringify(method)} → no fee (not_card)`, d.applies === false && d.reason === "not_card", d);
  }

  // The setting and the notice
  t("setting OFF → no fee (off)", dec({ company: OFF_CO }).reason === "off");
  t("setting on but notice NOT confirmed → no fee", dec({ company: NO_NOTICE_CO }).reason === "notice_not_confirmed");
  t("  ^ confirmed with no person recorded → no fee", dec({ company: NO_BY_CO }).reason === "notice_not_confirmed");
  t("  ^ confirmation date that is not a date → no fee", dec({ company: BAD_DATE_CO }).applies === false);
  t("  ^ the flag as the STRING 'true' → no fee (only the boolean)", dec({ company: STRING_TRUE_CO }).applies === false);
  t("clientCardSurchargeShown: a US company gets no switch at all", R.clientCardSurchargeShown(US_CO) === false);
  t("  ^ an Ontario company does", R.clientCardSurchargeShown(ON_CO) === true);
  t("  ^ a Quebec company is SHOWN (to be told why) but not allowed",
    R.clientCardSurchargeShown(QC_CO) === true && R.companySurchargeStanding(QC_CO).allowed === false);

  // The amounts
  t("$0.01 → no fee (rounds to zero)", dec({ amountCents: 1 }).reason === "rounds_to_zero");
  t("$0.41 → no fee (0.98¢ rounds DOWN)", dec({ amountCents: 41 }).surchargeCents === 0);
  t("$0.42 → 1¢ (2.38%, under the cap)", dec({ amountCents: 42 }).surchargeCents === 1);
  t("$10.00 → 24¢", dec({ amountCents: 1000 }).surchargeCents === 24);
  t("$2,260.00 → $54.24", dec({ amountCents: 226_000 }).surchargeCents === 5424);
  t("$1,234.57 → $29.62 (floor of 29.629)", dec({ amountCents: 123_457 }).surchargeCents === 2962);
  for (const amountCents of [0, -500, NaN, Infinity, 1000.5, "abc", null, undefined, 2 ** 60]) {
    const d = dec({ amountCents });
    t(`amount ${String(amountCents)} → no fee, nothing charged on top`, d.applies === false && d.surchargeCents === 0, d);
  }
  t("Stripe's max charge: $999,999.99 → no fee (the total would exceed what Stripe can charge)",
    dec({ amountCents: 99_999_999 }).applies === false && dec({ amountCents: 99_999_999 }).reason === "amount");
  {
    // The largest amount whose total still fits.
    let lo = 1, hi = 99_999_999;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (mid + Math.floor((mid * 240) / 10000) <= 99_999_999) lo = mid; else hi = mid - 1;
    }
    const d = dec({ amountCents: lo });
    t(`  ^ ${lo}¢ is the largest amount that still carries the fee, total ≤ 99,999,999`,
      d.applies && d.totalCents <= 99_999_999 && dec({ amountCents: lo + 1 }).applies === false, { lo, d });
  }
  {
    let bad = null;
    for (let i = 0; i < 5000 && !bad; i++) {
      const a = 1 + Math.floor(Math.random() * 50_000_000);
      const d = dec({ amountCents: a });
      const cost = processingFeeCents({ amountCents: a, currency: "cad", method: "card" });
      if (d.surchargeCents * 10000 > a * 240 || d.surchargeCents > cost || d.surchargeCents < 0 || !Number.isInteger(d.surchargeCents)) bad = { a, d, cost };
      if (d.totalCents !== a + d.surchargeCents) bad = { a, d };
    }
    t("5,000 random amounts: fee ≤ 2.4%, ≤ the contractor's own card cost, whole cents, total = amount + fee", bad === null, bad);
  }

  // Rule 4 — equal across brands: the decision never sees the brand.
  t("the decision takes no brand at all — Visa, Mastercard and Amex credit cards are one case",
    !/brand/i.test(R.clientCardSurchargeDecision.toString()));
}

function mathSuite(M, t) {
  t("clientCardSurchargeCents($1,000) = $24.00", M.clientCardSurchargeCents(100_000) === 2400);
  t("  ^ in USD too (the same card cost)", M.clientCardSurchargeCents(100_000, { currency: "usd" }) === 2400);
  t("  ^ a currency with no known card cost → 0, never a guessed 2.4%", M.clientCardSurchargeCents(100_000, { currency: "eur" }) === 0);
  t("  ^ $0.41 → 0 (rounded DOWN, never over 2.4%)", M.clientCardSurchargeCents(41) === 0);
  t("  ^ $999,999.99 → 0 (total past Stripe's max)", M.clientCardSurchargeCents(99_999_999) === 0);
  t("surchargeRatePercent(240) = '2.4'", M.surchargeRatePercent(240) === "2.4");

  // Refunds — Stripe's own worked example: $100 order, $1.50 fee, $60 back → 90¢.
  t("refund $60 of $100 with a $1.50 fee → 90¢ of fee back (Stripe's example)",
    M.surchargeRefundCents({ paymentBaseCents: 10_000, surchargeCents: 150, refundBaseCents: 6000 }) === 90);
  t("full refund → the whole fee", M.surchargeRefundCents({ paymentBaseCents: 10_000, surchargeCents: 150, refundBaseCents: 10_000 }) === 150);
  t("refund of more than is left → only the fee that is left",
    M.surchargeRefundCents({ paymentBaseCents: 10_000, surchargeCents: 150, alreadyRefundedBaseCents: 6000, refundBaseCents: 999_999 }) === 60);
  t("after a full refund → nothing more",
    M.surchargeRefundCents({ paymentBaseCents: 10_000, surchargeCents: 150, alreadyRefundedBaseCents: 10_000, refundBaseCents: 100 }) === 0);
  t("three thirds of $100.00 → 50¢ + 50¢ + 50¢ = the whole $1.50",
    [0, 3333, 6666].map((before, i) => M.surchargeRefundCents({ paymentBaseCents: 10_000, surchargeCents: 150, alreadyRefundedBaseCents: before, refundBaseCents: [3333, 3333, 3334][i] })).reduce((a, b) => a + b, 0) === 150);
  {
    let bad = null;
    for (let trial = 0; trial < 2000 && !bad; trial++) {
      const base = 1 + Math.floor(Math.random() * 5_000_000);
      const fee = M.clientCardSurchargeCents(base);
      let before = 0, back = 0;
      while (before < base) {
        const step = Math.min(base - before, 1 + Math.floor(Math.random() * base));
        const s = M.surchargeRefundCents({ paymentBaseCents: base, surchargeCents: fee, alreadyRefundedBaseCents: before, refundBaseCents: step });
        if (s < 0) bad = { base, fee, before, step, s };
        back += s;
        before += step;
      }
      if (back !== fee) bad = { base, fee, back };
    }
    t("2,000 random partial-refund sequences: shares never negative and add up to EXACTLY the fee", bad === null, bad);
  }
  t("Stripe-dashboard refund of the whole charge → the whole invoice part",
    M.invoicePortionOfRefundCents({ paymentBaseCents: 100_000, surchargeCents: 2400, refundedCents: 102_400 }) === 100_000);
  t("  ^ half the charge → half the invoice part ($500.00)",
    M.invoicePortionOfRefundCents({ paymentBaseCents: 100_000, surchargeCents: 2400, refundedCents: 51_200 }) === 50_000);
  t("  ^ no fee on the payment → the refund is all invoice money",
    M.invoicePortionOfRefundCents({ paymentBaseCents: 100_000, surchargeCents: 0, refundedCents: 40_000 }) === 40_000);
}

// ════════════════════════════════════════════════════════════════════════════
console.log("\n── 1. The rules ────────────────────────────────────────────────────\n");
rulesSuite(rules, ok);
ok("the cap constant lives beside the other rates: CLIENT_CARD_SURCHARGE_MAX_BPS = 240 (2.4%)", CLIENT_CARD_SURCHARGE_MAX_BPS === 240);
ok("  ^ and it is below the contractor's own card rate (300 bp + 30¢), so 'the lesser of' is 2.4%",
  CLIENT_CARD_SURCHARGE_MAX_BPS < 300);
ok("Stripe's surcharge fields are sent on the documented preview version", rules.STRIPE_SURCHARGE_API_VERSION === "2026-03-25.preview");

console.log("\n── 2. The arithmetic ───────────────────────────────────────────────\n");
mathSuite(math, ok);

// ════════════════════════════════════════════════════════════════════════════
console.log("\n── 3. The charge flow, with a scripted Stripe ──────────────────────\n");

const charge = await import("@/lib/stripe/clientCardCharge.js");

function scriptedStripe({ funding = "credit", brand = "visa", token = {}, createThrows = [], intent = null, confirmResult = "succeeded", confirmThrows = null } = {}) {
  const calls = [];
  let state = intent ? { ...intent } : null;
  const throws = [...createThrows];
  const s = {
    calls,
    confirmationTokens: {
      retrieve: async (id) => {
        calls.push(["ct.retrieve", id]);
        return {
          id,
          payment_intent: null,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          payment_method_preview: { type: "card", card: { funding, brand, last4: "4242" } },
          ...token,
        };
      },
    },
    paymentIntents: {
      create: async (params, opts) => {
        calls.push(["pi.create", params, opts]);
        const e = throws.shift();
        if (e) throw e;
        state = { id: "pi_test_1", status: "requires_payment_method", client_secret: "pi_test_1_secret_x", ...params };
        return state;
      },
      retrieve: async (id, opts) => {
        calls.push(["pi.retrieve", id, opts]);
        if (opts?.expand && state?.status === "succeeded") {
          return {
            ...state,
            amount_received: state.amount,
            latest_charge: { id: "ch_1", transfer: "tr_1", balance_transaction: { fee: 3000 } },
            payment_method: { type: "card", card: { funding, brand } },
          };
        }
        return state;
      },
      confirm: async (id, params, opts) => {
        calls.push(["pi.confirm", id, params, opts]);
        if (confirmThrows) throw confirmThrows;
        state = { ...state, status: confirmResult };
        return state;
      },
      cancel: async (id) => {
        calls.push(["pi.cancel", id]);
        state = { ...state, status: "canceled" };
        return state;
      },
    },
    transfers: { createReversal: async () => ({ id: "trr_1" }) },
  };
  return s;
}

function scriptedDb({ client = ON_CLIENT, siteAddress = null } = {}) {
  return {
    client: { findUnique: async () => ({ ...client }) },
    invoice: { findUnique: async () => ({ job: siteAddress ? { siteAddress } : null, quote: null }) },
  };
}

const RESOLVED = Object.freeze({
  ok: true,
  company: ON_CO,
  client: { id: "cl_1" },
  current: { id: "inv_1", invoiceNumber: "INV-1" },
  chargeCents: 100_000,
  stageAmountCents: undefined,
});
const baseDeps = (sc, extra = {}) => ({ stripe: sc, ledger: async () => 0, recordError: async () => {}, ...extra });

{
  const sc = scriptedStripe();
  const r = await charge.reviewCardPayment(scriptedDb(), { resolved: RESOLVED, confirmationTokenId: "ctoken_abc" }, baseDeps(sc));
  const [, params, opts] = sc.calls.find((c) => c[0] === "pi.create");
  const expectedFee = processingFeeCents({ amountCents: 102_400, currency: "cad", method: "card" });
  ok("review, CREDIT card: the intent is created for $1,024.00 — invoice + fee", params.amount === 102_400 && r.review.totalCents === 102_400, params.amount);
  ok("  ^ FieldQuo's 3% + 30¢ is on the WHOLE charge, fee included ($31.02)", params.application_fee_amount === expectedFee && expectedFee === 3102, params.application_fee_amount);
  ok("  ^ the fee goes to Stripe as amount_details.surcharge with validation on",
    params.amount_details?.surcharge?.amount === 2400 && params.amount_details.surcharge.enforce_validation === "enabled", params.amount_details);
  ok("  ^ on the preview API version, for this request only", opts?.apiVersion === "2026-03-25.preview", opts);
  ok("  ^ card only, destination charge on the contractor's account, on_behalf_of the contractor",
    JSON.stringify(params.payment_method_types) === '["card"]' && params.transfer_data?.destination === "acct_on" && params.on_behalf_of === "acct_on");
  ok("  ^ metadata carries the split for settlement (base, fee, rate, token) and the flow",
    params.metadata.fq_flow === "portal_card" && params.metadata.fq_base_cents === "100000" && params.metadata.fq_card_surcharge_cents === "2400" && params.metadata.fq_card_surcharge_bps === "240" && params.metadata.fq_confirmation_token === "ctoken_abc" && params.metadata.invoiceId === "inv_1");
  ok("  ^ keyed so a retried review returns the same intent", /ctoken_abc/.test(opts?.idempotencyKey || ""), opts);
  ok("  ^ the review the client sees: the three lines and the card", r.review.baseCents === 100_000 && r.review.surchargeCents === 2400 && r.review.funding === "credit" && r.review.last4 === "4242");
}
for (const funding of ["debit", "prepaid", "unknown"]) {
  const sc = scriptedStripe({ funding });
  const r = await charge.reviewCardPayment(scriptedDb(), { resolved: RESOLVED, confirmationTokenId: "ctoken_abc" }, baseDeps(sc));
  const [, params, opts] = sc.calls.find((c) => c[0] === "pi.create");
  ok(`review, ${funding.toUpperCase()} card: $1,000.00, no surcharge fields, the account's own API version`,
    params.amount === 100_000 && !params.amount_details && !opts?.apiVersion && r.review.surchargeCents === 0, { amount: params.amount, opts });
}
{
  const amex = scriptedStripe({ brand: "amex" });
  const mc = scriptedStripe({ brand: "mastercard" });
  const a = await charge.reviewCardPayment(scriptedDb(), { resolved: RESOLVED, confirmationTokenId: "ctoken_abc" }, baseDeps(amex));
  const m = await charge.reviewCardPayment(scriptedDb(), { resolved: RESOLVED, confirmationTokenId: "ctoken_abc" }, baseDeps(mc));
  ok("Amex and Mastercard credit cards get exactly the Visa fee", a.review.surchargeCents === 2400 && m.review.surchargeCents === 2400);
}
{
  const sc = scriptedStripe();
  const r = await charge.reviewCardPayment(scriptedDb({ client: QC_CLIENT }), { resolved: RESOLVED, confirmationTokenId: "ctoken_abc" }, baseDeps(sc));
  ok("review, Quebec client of an Ontario company, credit card → no fee", r.review.surchargeCents === 0 && sc.calls.find((c) => c[0] === "pi.create")[1].amount === 100_000);
  const sc2 = scriptedStripe();
  const r2 = await charge.reviewCardPayment(scriptedDb({ siteAddress: "40 Rue Laurier, Gatineau, QC J8X 4H6, Canada" }), { resolved: RESOLVED, confirmationTokenId: "ctoken_abc" }, baseDeps(sc2));
  ok("review, Ontario client, site in Gatineau QC → no fee", r2.review.surchargeCents === 0);
  const sc3 = scriptedStripe();
  const r3 = await charge.reviewCardPayment(scriptedDb(), { resolved: { ...RESOLVED, company: US_CO }, confirmationTokenId: "ctoken_abc" }, baseDeps(sc3));
  ok("review, US company → no fee", r3.review.surchargeCents === 0);
}
for (const [label, id, token, code] of [
  ["a PaymentMethod id, not a token", "pm_123", {}, "token_missing"],
  ["an injected id", "ctoken_abc'; drop", {}, "token_missing"],
  ["a token already used", "ctoken_used", { payment_intent: "pi_old" }, "token_used"],
  ["an expired token", "ctoken_old", { expires_at: 1 }, "token_expired"],
  ["a token that is not a card", "ctoken_bank", { payment_method_preview: { type: "acss_debit" } }, "not_card"],
]) {
  const sc = scriptedStripe({ token });
  const r = await charge.reviewCardPayment(scriptedDb(), { resolved: RESOLVED, confirmationTokenId: id }, baseDeps(sc));
  ok(`review refuses ${label} (${code}) and creates nothing`, r.ok === false && r.code === code && !sc.calls.some((c) => c[0] === "pi.create"), r);
}
{
  const refused = Object.assign(new Error("Received unknown parameter: amount_details[surcharge]"), { type: "StripeInvalidRequestError", param: "amount_details[surcharge]" });
  const sc = scriptedStripe({ createThrows: [refused] });
  let logged = 0;
  const r = await charge.reviewCardPayment(scriptedDb(), { resolved: RESOLVED, confirmationTokenId: "ctoken_abc" }, baseDeps(sc, { recordError: async () => { logged++; } }));
  const creates = sc.calls.filter((c) => c[0] === "pi.create");
  ok("Stripe refuses the surcharge fields → the intent is made WITHOUT the fee and the client is shown none",
    creates.length === 2 && creates[1][1].amount === 100_000 && !creates[1][1].amount_details && r.review.surchargeCents === 0 && r.review.totalCents === 100_000);
  ok("  ^ and the refusal is written to /platform/errors", logged === 1);
}
{
  const other = Object.assign(new Error("Amount must be at least 50 cents"), { type: "StripeInvalidRequestError", param: "amount" });
  const sc = scriptedStripe({ createThrows: [other] });
  let threw = false;
  try { await charge.reviewCardPayment(scriptedDb(), { resolved: RESOLVED, confirmationTokenId: "ctoken_abc" }, baseDeps(sc)); } catch { threw = true; }
  ok("any OTHER Stripe refusal is not quietly retried without the fee — it surfaces", threw && sc.calls.filter((c) => c[0] === "pi.create").length === 1);
}
ok("isSurchargeRefusal: only an invalid request that names the surcharge fields",
  charge.isSurchargeRefusal({ type: "StripeInvalidRequestError", param: "amount_details[surcharge][amount]" }) &&
  !charge.isSurchargeRefusal({ type: "StripeCardError", message: "surcharge" }) &&
  !charge.isSurchargeRefusal({ type: "StripeInvalidRequestError", param: "amount" }) &&
  !charge.isSurchargeRefusal(null));

// Confirm
const REVIEWED = Object.freeze({
  id: "pi_test_1",
  status: "requires_payment_method",
  amount: 102_400,
  currency: "cad",
  client_secret: "pi_test_1_secret_x",
  application_fee_amount: 3102,
  metadata: {
    fq_flow: "portal_card",
    companyId: "co_on",
    invoiceId: "inv_1",
    fq_base_cents: "100000",
    fq_card_surcharge_cents: "2400",
    fq_card_surcharge_bps: "240",
    fq_confirmation_token: "ctoken_abc",
    fq_fee_estimate_cents: "3102",
    fq_recovery_cents: "0",
  },
});
{
  const sc = scriptedStripe({ intent: REVIEWED });
  const recorded = [];
  const r = await charge.confirmCardPayment(scriptedDb(), { resolved: RESOLVED, intentId: "pi_test_1", returnUrl: "https://x.test/portal/t?paid=true" },
    baseDeps(sc, { record: async (_db, args) => (recorded.push(args), { recorded: true }) }));
  const conf = sc.calls.find((c) => c[0] === "pi.confirm");
  ok("confirm charges the reviewed intent with the reviewed token", r.ok && r.status === "succeeded" && conf?.[2]?.confirmation_token === "ctoken_abc", r);
  ok("  ^ on the preview version, idempotently", conf?.[3]?.apiVersion === "2026-03-25.preview" && /pi_test_1/.test(conf?.[3]?.idempotencyKey || ""));
  ok("  ^ settled at once: the Payment's amount is the INVOICE money ($1,000.00), the fee its own field",
    recorded.length === 1 && recorded[0].amountCents === 100_000 && recorded[0].clientCardSurcharge?.cents === 2400 && recorded[0].clientCardSurcharge?.rateBps === 240 && recorded[0].invoiceId === "inv_1", recorded[0]);
  ok("  ^ with the processing fee read back from the charge (on the whole $1,024.00)", recorded[0]?.fee?.processingFeeCents === 3102 && recorded[0]?.fee?.netCents === 102_400 - 3102, recorded[0]?.fee);
}
{
  const sc = scriptedStripe({ intent: REVIEWED });
  const r = await charge.confirmCardPayment(scriptedDb(), { resolved: { ...RESOLVED, chargeCents: 50_000 }, intentId: "pi_test_1" }, baseDeps(sc));
  ok("the balance moved since the review (paid elsewhere) → refused, intent cancelled, nothing confirmed",
    r.ok === false && r.code === "changed" && sc.calls.some((c) => c[0] === "pi.cancel") && !sc.calls.some((c) => c[0] === "pi.confirm"), r);
}
{
  const sc = scriptedStripe({ intent: REVIEWED });
  const r = await charge.confirmCardPayment(scriptedDb(), { resolved: { ...RESOLVED, company: OFF_CO }, intentId: "pi_test_1" }, baseDeps(sc));
  ok("the setting was switched OFF since the review → refused and cancelled; the fee is never charged",
    r.ok === false && r.code === "changed" && sc.calls.some((c) => c[0] === "pi.cancel") && !sc.calls.some((c) => c[0] === "pi.confirm"));
}
{
  const sc = scriptedStripe({ intent: REVIEWED });
  const r = await charge.confirmCardPayment(scriptedDb({ client: QC_CLIENT }), { resolved: RESOLVED, intentId: "pi_test_1" }, baseDeps(sc));
  ok("the client's address was changed to Quebec since the review → refused and cancelled",
    r.ok === false && r.code === "changed" && !sc.calls.some((c) => c[0] === "pi.confirm"));
}
{
  const sc = scriptedStripe({ intent: REVIEWED });
  const r = await charge.confirmCardPayment(scriptedDb(), { resolved: { ...RESOLVED, current: { id: "inv_2" } }, intentId: "pi_test_1" }, baseDeps(sc));
  ok("the invoice was amended since the review → refused", r.ok === false && r.code === "changed");
}
{
  const sc = scriptedStripe({ intent: { ...REVIEWED, metadata: { ...REVIEWED.metadata, companyId: "co_other" } } });
  const r = await charge.confirmCardPayment(scriptedDb(), { resolved: RESOLVED, intentId: "pi_test_1" }, baseDeps(sc));
  ok("another company's intent id → 404, not cancelled, not confirmed",
    r.ok === false && r.status === 404 && !sc.calls.some((c) => c[0] === "pi.cancel" || c[0] === "pi.confirm"));
}
{
  const sc = scriptedStripe({ intent: { ...REVIEWED, amount: 100_000 } });
  const r = await charge.confirmCardPayment(scriptedDb(), { resolved: RESOLVED, intentId: "pi_test_1" }, baseDeps(sc));
  ok("an intent whose amount no longer equals base + fee → refused", r.ok === false && r.code === "changed");
}
{
  const sc = scriptedStripe({ intent: REVIEWED, confirmResult: "requires_action" });
  const r = await charge.confirmCardPayment(scriptedDb(), { resolved: RESOLVED, intentId: "pi_test_1" }, baseDeps(sc));
  ok("3-D Secure → the client secret goes back for stripe.handleNextAction, nothing recorded yet",
    r.ok && r.status === "requires_action" && r.clientSecret === "pi_test_1_secret_x");
}
{
  const declined = Object.assign(new Error("Your card was declined."), { type: "StripeCardError", code: "card_declined", decline_code: "insufficient_funds" });
  const sc = scriptedStripe({ intent: REVIEWED, confirmThrows: declined });
  const r = await charge.confirmCardPayment(scriptedDb(), { resolved: RESOLVED, intentId: "pi_test_1" }, baseDeps(sc));
  ok("a decline → 402 'declined' (the client's language is the route's job), never a 500", r.ok === false && r.status === 402 && r.code === "declined");
}
{
  const sc = scriptedStripe({ intent: { ...REVIEWED, status: "succeeded" } });
  const recorded = [];
  const r = await charge.confirmCardPayment(scriptedDb(), { resolved: RESOLVED, intentId: "pi_test_1" },
    baseDeps(sc, { record: async (_db, args) => (recorded.push(args), { recorded: false, alreadyRecorded: true }) }));
  ok("a double tap after success → settles (idempotently), confirms nothing twice", r.status === "succeeded" && !sc.calls.some((c) => c[0] === "pi.confirm") && recorded.length === 1);
}
for (const id of ["", "ch_123", "pi_x'; drop", null]) {
  const sc = scriptedStripe({ intent: REVIEWED });
  const r = await charge.confirmCardPayment(scriptedDb(), { resolved: RESOLVED, intentId: id }, baseDeps(sc));
  ok(`confirm refuses intent id ${JSON.stringify(id)} without asking Stripe`, r.ok === false && sc.calls.length === 0);
}
ok("splitReceived: $1,024.00 received with a $24.00 fee → $1,000.00 to the invoice",
  JSON.stringify(charge.splitReceived({ amount_received: 102_400, metadata: { fq_card_surcharge_cents: "2400", fq_card_surcharge_bps: "240" } })) ===
  JSON.stringify({ receivedCents: 102_400, baseCents: 100_000, surchargeCents: 2400, rateBps: 240 }));
ok("  ^ hostile metadata (fee larger than the charge) can never make the invoice part negative",
  charge.splitReceived({ amount_received: 1000, metadata: { fq_card_surcharge_cents: "99999999" } }).baseCents === 0);
ok("  ^ a negative fee in metadata is read as no fee",
  charge.splitReceived({ amount_received: 1000, metadata: { fq_card_surcharge_cents: "-500" } }).surchargeCents === 0);
{
  const sc = scriptedStripe({ intent: { ...REVIEWED, status: "succeeded", metadata: { ...REVIEWED.metadata, fq_flow: "other" } } });
  const r = await charge.settleCardPayment("pi_test_1", { stripe: sc, record: async () => ({ recorded: true }) });
  ok("settleCardPayment ignores an intent this flow did not create", r.handled === false);
}
ok("stripePublishableKey: only a pk_live_/pk_test_ key; a secret key is never handed to a browser",
  (() => {
    const keep = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const results = [];
    for (const v of ["sk_live_abc", "rk_live_abc", "", "pk_live_abc123", " pk_test_X1 "]) {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = v;
      results.push(charge.stripePublishableKey());
    }
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = keep;
    return JSON.stringify(results) === JSON.stringify([null, null, null, "pk_live_abc123", "pk_test_X1"]);
  })());
{
  const keep = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "";
  const none = charge.portalCardOffer({ company: ON_CO, client: ON_CLIENT, onlinePayments: true });
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = keep;
  const some = charge.portalCardOffer({ company: ON_CO, client: ON_CLIENT, onlinePayments: true });
  ok("portalCardOffer: no publishable key → no card form, no fee anywhere (the hosted button stays)", none === null);
  ok("  ^ with the key, an eligible client gets { rateBps: 240 }", some?.rateBps === 240);
  ok("  ^ a demo company never", charge.portalCardOffer({ company: { ...ON_CO, isDemo: true }, client: ON_CLIENT, onlinePayments: true }) === null);
  ok("  ^ no online payments → never", charge.portalCardOffer({ company: ON_CO, client: ON_CLIENT, onlinePayments: false }) === null);
}

// ════════════════════════════════════════════════════════════════════════════
console.log("\n── 4. Refunds, the export, the settings route ──────────────────────\n");

const { refundCardFeeCents, planRefund } = await import("@/lib/invoices/refund.js");
{
  const pay = { id: "p1", amount: 1000, clientCardSurchargeCents: 2400, stripePaymentIntentId: "pi_1", method: "stripe", kind: "payment", refundedAmount: 0 };
  ok("full refund of a $1,000 card payment → the $24.00 fee goes back too", refundCardFeeCents(pay, [], 100_000) === 2400);
  ok("half refund → $12.00", refundCardFeeCents(pay, [], 50_000) === 1200);
  ok("  ^ after a $500 refund (row with -$12 fee), the second $500 returns the other $12",
    refundCardFeeCents(pay, [{ kind: "refund", refundOfPaymentId: "p1", amount: -500, clientCardSurchargeCents: -1200 }], 50_000) === 1200);
  ok("a payment without a fee → nothing extra", refundCardFeeCents({ ...pay, clientCardSurchargeCents: null }, [], 100_000) === 0);
  ok("planRefund still caps at the INVOICE money ($1,000), not the $1,024 charged",
    planRefund({ payment: pay, refundRows: [], amountCents: 102_400, method: "stripe", reason: "x" }).ok === false);
}
{
  // issueRefund with a scripted db and Stripe.
  const { issueRefund } = await import("@/lib/invoices/refund.js");
  const created = [];
  const stripeCalls = [];
  const pay = { id: "p1", invoiceId: "inv_1", amount: 1000, clientCardSurchargeCents: 2400, clientCardSurchargeRateBps: 240, stripePaymentIntentId: "pi_1", method: "stripe", kind: "payment", refundedAmount: 0 };
  const fakeDb = {
    invoice: {
      findFirst: async () => ({ id: "inv_1", companyId: "co_on" }),
      findMany: async () => [{ id: "inv_1", parentInvoiceId: null, version: 1 }],
      findUnique: async () => ({ id: "inv_1", total: 1000, status: "paid", refundedAt: null }),
      update: async () => ({}),
    },
    payment: {
      findFirst: async () => pay,
      findMany: async () => [pay, ...created],
      create: async ({ data }) => (created.push(data), data),
    },
  };
  const fakeStripe = { refunds: { create: async (p, o) => (stripeCalls.push([p, o]), { id: "re_1", status: "succeeded" }) } };
  const r = await issueRefund({ companyId: "co_on", invoiceId: "inv_1", paymentId: "p1", amountCents: 40_000, method: "stripe", reason: "partial", requestId: "req1" }, { db: fakeDb, stripe: fakeStripe });
  ok("issueRefund $400 of $1,000 → Stripe refunds $409.60 ($400 + 40% of the $24 fee)", stripeCalls[0]?.[0]?.amount === 40_960, stripeCalls[0]?.[0]);
  ok("  ^ the refund row's amount is the invoice money (-$400) and its fee line -$9.60",
    created[0]?.amount === -400 && created[0]?.clientCardSurchargeCents === -960 && created[0]?.clientCardSurchargeRateBps === 240, created[0]);
  ok("  ^ refund_application_fee stays false and reverse_transfer true (unchanged)", stripeCalls[0][0].refund_application_fee === false && stripeCalls[0][0].reverse_transfer === true);
  ok("  ^ the invoice was refunded by $400, not $409.60", r.ok && r.state.amountRefunded === 400, r.state);
}
{
  const { recordStripeRefund } = await import("@/lib/invoices/recordStripeRefund.js");
  const pay = { id: "p1", invoiceId: "inv_1", amount: 1000, refundedAmount: 0, disputeStatus: null, clientCardSurchargeCents: 2400 };
  let written = null;
  const mk = (own) => ({
    payment: {
      findFirst: async () => pay,
      findMany: async ({ where } = {}) => (where?.refundOfPaymentId ? own : [pay, ...own]),
      update: async ({ data }) => { written = data; return {}; },
    },
    invoice: {
      findMany: async () => [{ id: "inv_1", parentInvoiceId: null, version: 1 }],
      findUnique: async () => ({ id: "inv_1", total: 1000, status: "paid", refundedAt: null }),
      update: async () => ({}),
    },
  });
  await recordStripeRefund(mk([]), { payment_intent: "pi_1", amount_refunded: 102_400 });
  ok("a full refund made in the Stripe dashboard ($1,024) → the invoice is refunded $1,000, not $1,024", written?.refundedAmount === 1000, written);
  await recordStripeRefund(mk([{ kind: "refund", refundOfPaymentId: "p1", stripeRefundId: "re_1", amount: -400, clientCardSurchargeCents: -960 }]), { payment_intent: "pi_1", amount_refunded: 40_960 });
  ok("our own $400 refund ($409.60 at Stripe) echoed back by the webhook → nothing counted twice", written?.refundedAmount === 0, written);
}
{
  const { buildAccountingExport } = await import("@/lib/export/accountingExport.js");
  const out = buildAccountingExport({
    from: "2026-10-01", to: "2026-10-31", currency: "CAD",
    invoices: [{ id: "i1", invoiceNumber: "INV-1", total: 1000, tax: 0, amountPaid: 1000, status: "paid", createdAt: new Date("2026-10-02"), client: { name: "H" } }],
    payments: [{ id: "p1", invoiceId: "i1", amount: 1000, method: "stripe", date: new Date("2026-10-03"), stripePaymentIntentId: "pi_1", processingFeeCents: 3102, netCents: 99_298, feeRateLabel: "card", clientCardSurchargeCents: 2400, clientCardSurchargeRateBps: 240, invoice: { invoiceNumber: "INV-1", client: { name: "H" } } }],
  });
  const pay = out.files.find((f) => f.kind === "payments").csv.split(/\r?\n/);
  ok("export: the payments file's last column is 'Client card fee (not job revenue)'", /,Client card fee \(not job revenue\)$/.test(pay[0]), pay[0]);
  ok("  ^ the payment line: Amount 1000.00 (invoice money) … fee column 24.00", /^2026-10-03,INV-1,H,stripe,CAD,1000\.00,31\.02,992\.98,card,.*,24\.00$/.test(pay[1]), pay[1]);
  ok("  ^ payments received stays $1,000 — the fee is NOT job revenue", out.totals.CAD.paid === 1000 && out.totals.CAD.clientCardFees === 24, out.totals.CAD);
  ok("  ^ and the summary lists it on its own", /Client card fees \(not job revenue\)/.test(out.files.find((f) => f.kind === "summary").csv));
}
{
  const route = stripComments(read("app/api/settings/client-card-surcharge/route.js"));
  ok("settings PATCH: switching ON requires noticeConfirmed === true", /body\.noticeConfirmed !== true/.test(route));
  ok("  ^ records WHO (member.userId) and WHEN", /clientCardSurchargeNoticeConfirmedAt: now/.test(route) && /clientCardSurchargeNoticeConfirmedById: member\.userId/.test(route));
  ok("  ^ refuses a non-Canadian or Quebec company and a deployment with no card form, server-side",
    /!clientCardSurchargeShown\(company\)/.test(route) && /!standing\.allowed/.test(route) && /!stripePublishableKey\(\)/.test(route));
  ok("  ^ switching OFF clears the confirmation, so switching back on asks again",
    /clientCardSurcharge: false,\s*clientCardSurchargeNoticeConfirmedAt: null,\s*clientCardSurchargeNoticeConfirmedById: null/.test(route));
  ok("  ^ owners and admins only (user:manage)", /requirePermission\(member\.role, "user:manage"\)/.test(route));
  const card = stripComments(read("app/app/settings/payments/ClientCardSurchargeCard.js"));
  ok("settings card: renders NOTHING for a company the route says is not shown (US — no dead control)", /if \(!state \|\| !state\.shown\) return null;/.test(card));
  ok("  ^ the Switch on button is disabled until the notice is confirmed", /disabled=\{saving \|\| !confirmed\}/.test(card));
  ok("  ^ every flow in CLIENT_CARD_FLOWS is listed, surcharged or not", /CLIENT_CARD_FLOWS\.map/.test(card));
}

// ════════════════════════════════════════════════════════════════════════════
console.log("\n── 5. Source guards ────────────────────────────────────────────────\n");

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(js|mjs|jsx)$/.test(name)) out.push(rel);
  }
  return out;
}
const SOURCES = [...walk("app"), ...walk("lib")];

// Every place in the product that can create a Stripe charge, classified.
// A NEW one fails this check until someone decides — here, in writing —
// whether it can carry the client card fee.
const CREATORS = {
  "lib/stripe/clientCardCharge.js": "portal card form — THE one flow that adds the fee, through clientCardSurchargeDecision",
  "lib/stripe.js": "hosted Checkout (invoice pay link, office checkout link, booking visit fee) — no fee: the card is unknown when the amount is fixed",
  "lib/servicePlans/stripeMandate.js": "service plans (mandate set-up and off-session charges) — no fee: agreed price, client absent",
  "lib/platform/stripeBilling.js": "FieldQuo billing the COMPANY — not a client card payment",
  "lib/billing/resume.js": "FieldQuo billing the COMPANY — not a client card payment",
  "lib/voice/autoTopup.js": "FieldQuo billing the COMPANY — not a client card payment",
  "lib/ai/creditBundle.js": "FieldQuo billing the COMPANY — not a client card payment",
  "lib/ai/topupIntent.js": "FieldQuo billing the COMPANY — not a client card payment",
  "lib/marketing/videoPack.js": "FieldQuo billing the COMPANY — not a client card payment",
  "lib/migrations/payment.js": "FieldQuo billing the COMPANY (data migration) — not a client card payment",
  "app/api/settings/voice/topup/route.js": "FieldQuo billing the COMPANY — not a client card payment",
};
const creatorFiles = SOURCES.filter((f) =>
  /\b(paymentIntents|checkout\.sessions|subscriptions)\.create\(/.test(stripComments(read(f))),
);
const unclassified = creatorFiles.filter((f) => !CREATORS[f]);
ok("every Stripe charge creator in app/ and lib/ is classified (a new one must decide about the card fee)", unclassified.length === 0, unclassified);
ok("  ^ and every classified creator still exists", Object.keys(CREATORS).every((f) => creatorFiles.includes(f)), Object.keys(CREATORS).filter((f) => !creatorFiles.includes(f)));

const sendsSurcharge = SOURCES.filter((f) => /amount_details|STRIPE_SURCHARGE_API_VERSION/.test(stripComments(read(f))) && f !== "lib/stripe/clientCardSurcharge.js");
ok("ONLY lib/stripe/clientCardCharge.js sends surcharge fields to Stripe", JSON.stringify(sendsSurcharge) === JSON.stringify(["lib/stripe/clientCardCharge.js"]), sendsSurcharge);
const decides = SOURCES.filter((f) => /clientCardSurchargeDecision\(/.test(stripComments(read(f))) && f !== "lib/stripe/clientCardSurcharge.js");
ok("  ^ and it is the only caller of clientCardSurchargeDecision (the one surcharge function)", JSON.stringify(decides) === JSON.stringify(["lib/stripe/clientCardCharge.js"]), decides);
{
  const src = stripComments(read("lib/stripe/clientCardCharge.js"));
  const review = src.slice(src.indexOf("export async function reviewCardPayment"), src.indexOf("export function checkIntentStillValid"));
  ok("  ^ review decides BEFORE it creates the intent", review.indexOf("clientCardSurchargeDecision(") > -1 && review.indexOf("clientCardSurchargeDecision(") < review.indexOf("createIntent("));
  const confirm = src.slice(src.indexOf("export async function confirmCardPayment"), src.indexOf("export async function finalizeCardPayment"));
  ok("  ^ confirm re-decides from the same card and re-checks the balance BEFORE confirming",
    confirm.indexOf("clientCardSurchargeDecision(") > -1 && confirm.indexOf("checkIntentStillValid(") < confirm.indexOf("paymentIntents.confirm(") && confirm.indexOf("clientCardSurchargeDecision(") < confirm.indexOf("paymentIntents.confirm("));
  ok("  ^ the application fee is computed on the TOTAL (fee included)", /amountCents: total,/.test(src));
  ok("  ^ funding comes from Stripe's ConfirmationToken, never from the request", /confirmationTokens\.retrieve\(/.test(src) && !/body\./.test(src));
}
{
  const route = stripComments(read("app/api/portal/[token]/card-pay/route.js"));
  ok("card-pay route reads no money from the body (amount/total/fee/surcharge)", !/body\.(amount|total|fee|surcharge|price|cents)/i.test(route));
  ok("  ^ resolves the invoice and figure through resolvePortalCharge", /resolvePortalCharge\(db,/.test(route));
  const hosted = stripComments(read("lib/stripe.js"));
  ok("hosted Checkout never adds the fee (lib/stripe.js does not reference it)", !/clientCardSurcharge|amount_details/.test(hosted));
}
{
  const lib = stripComments(read("lib/portal/payableInvoice.js"));
  const pay = stripComments(read("app/api/portal/[token]/pay/route.js"));
  for (const [label, re] of [
    ["only ISSUED invoices", /OR: \[\{ sentAt: \{ not: null \} \}, \{ status: \{ not: "draft" \} \}\]/],
    ["the ledger refreshed before an amount", /refreshFamilyLedger\(db, invoice\.id\)/],
    ["the family's latest version", /latestInFamily\(db, invoice\.id, \{ include: \{ client: true \} \}\)/],
    ["a stage scoped to the company", /companyId: client\.companyId,/],
    ["a stage of THIS invoice", /invoiceId: current\.id,/],
    ["a stage still requested", /status: "requested",/],
    ["the stage capped at the balance", /Math\.max\(0, Math\.min\((stageAmountCents|amountCents), balanceCents\)\)/],
  ]) {
    ok(`payableInvoice.js and the pay route agree: ${label}`, re.test(lib) && re.test(pay));
  }
}
{
  const portal = stripComments(read("app/api/portal/[token]/route.js"));
  ok("portal GET strips the setting and who confirmed it from `company`",
    /clientCardSurcharge: _clientCardSurcharge,\s*clientCardSurchargeNoticeConfirmedAt: _clientCardSurchargeAt,\s*clientCardSurchargeNoticeConfirmedById: _clientCardSurchargeBy,\s*isDemo,\s*\.\.\.companyView/.test(portal));
  ok("  ^ each invoice carries the rate that applies to THIS client (cardFee), decided server-side", /cardFee: cardFeeFor\(invoice\.id\)/.test(portal));
  ok("  ^ the existing 'no fee in the portal payload' rule still holds (no processing fee names)", !/processingFee|feeCents|application_fee/.test(portal));
}
{
  const rec = stripComments(read("lib/invoices/recordStripePayment.js"));
  ok("recordStripePayment: `amount` is still amountCents alone; the fee has its own columns",
    /amount: \(Number\(amountCents\) \|\| 0\) \/ 100,/.test(rec) && /clientCardSurchargeCents: Math\.trunc\(Number\(clientCardSurcharge\.cents\)\)/.test(rec));
  const settle = stripComments(read("lib/stripe/clientCardCharge.js"));
  ok("  ^ the portal settler passes the INVOICE part as amountCents", /amountCents: split\.baseCents,/.test(settle));
  const refund = stripComments(read("lib/invoices/refund.js"));
  ok("refund: Stripe gets invoice money + the fee share; the row's amount is the invoice money only",
    /amount: plan\.amountCents \+ cardFeeBack,/.test(refund) && /amount: -plan\.amountCents \/ 100,/.test(refund));
  ok("dashboard refunds split pro-rata (recordStripeRefund uses invoicePortionOfRefundCents)", /invoicePortionOfRefundCents\(/.test(stripComments(read("lib/invoices/recordStripeRefund.js"))));
}
{
  // GST/HST: the fee is never added to a document, so it can never reach a
  // taxable subtotal. Nothing that builds a quote or invoice total reads it.
  const totalsFiles = SOURCES.filter((f) => /^lib\/(quotes|tax|documentSections|documents)\//.test(f) || f === "lib/invoices/computeInvoiceState.js");
  const leaks = totalsFiles.filter((f) => /clientCardSurcharge/.test(read(f)));
  ok("no tax, totals or document-section code reads the card fee (no GST/HST, never in a subtotal)", leaks.length === 0, leaks);
}
{
  const connect = stripComments(read("app/api/stripe/webhook/route.js"));
  const billing = stripComments(read("app/api/platform/billing/webhook/route.js"));
  ok("payment_intent.succeeded for the portal card form is settled on BOTH webhook endpoints",
    /fq_flow === PORTAL_CARD_FLOW/.test(connect) && /settleCardPayment\(intent\.id\)/.test(connect) && /fq_flow === PORTAL_CARD_FLOW/.test(billing) && /settleCardPayment\(event\.data\.object\.id\)/.test(billing));
  const vercel = JSON.parse(read("vercel.json"));
  ok("  ^ and the hourly reconciler is scheduled", vercel.crons.some((c) => c.path === "/api/cron/card-payments"));
  ok("  ^ which calls reconcilePortalCardPayments behind CRON_SECRET",
    /requireCronSecret\(request\)/.test(read("app/api/cron/card-payments/route.js")) && /reconcilePortalCardPayments\(\)/.test(read("app/api/cron/card-payments/route.js")));
}
{
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");
  const card = read("app/app/settings/payments/ClientCardSurchargeCard.js") + read("app/app/invoices/[id]/page.js") + read("app/app/invoices/[id]/RefundDialog.js");
  const used = [...new Set([...card.matchAll(/t\("(app\.(?:setPayments\.clientCardFee|invoiceDetail\.(?:clientCardFee|refundCardFee))[^"]*)"/g)].map((m) => m[1]))];
  const langs = ["en", "fr", "es", "it", "de", "uk", "pa", "tl", "zh"];
  const missing = [];
  for (const k of used) for (const l of langs) if (typeof APP_MESSAGES[l]?.[k] !== "string") missing.push(`${l}:${k}`);
  ok(`every app string the feature uses (${used.length}) exists in all ${langs.length} app languages`, used.length >= 30 && missing.length === 0, missing.slice(0, 10));
  const sameAsEnglish = [];
  for (const k of used) for (const l of langs.filter((x) => x !== "en")) {
    const v = APP_MESSAGES[l][k];
    if (v === APP_MESSAGES.en[k] && !/^(Stripe|CFIB)/.test(v)) sameAsEnglish.push(`${l}:${k}`);
  }
  ok("  ^ and none of them is English left in another language", sameAsEnglish.length === 0, sameAsEnglish.slice(0, 10));
  const { CLIENT_DOC_COPY } = await import("@/lib/i18n/clientDocCopy.js");
  const keysEn = Object.keys(CLIENT_DOC_COPY.en.cardFee).sort().join();
  const docLangs = ["en", "fr", "es", "it", "de", "uk", "pa", "tl"];
  ok("client copy: the portal's card-fee sentences exist in all 8 document languages, same keys",
    docLangs.every((l) => CLIENT_DOC_COPY[l]?.cardFee && Object.keys(CLIENT_DOC_COPY[l].cardFee).sort().join() === keysEn));
  ok("  ^ none left in English", docLangs.filter((l) => l !== "en").every((l) => CLIENT_DOC_COPY[l].cardFee.continue !== "Continue" && CLIENT_DOC_COPY[l].cardFee.notice("2.4") !== CLIENT_DOC_COPY.en.cardFee.notice("2.4")));
  ok("  ^ French writes the rate with a comma ('2,4 %')", /2,4 %/.test(CLIENT_DOC_COPY.fr.cardFee.notice("2.4")));
}
{
  const panel = stripComments(read("app/portal/[token]/CardPayPanel.js"));
  ok("card form: Stripe.js loaded from js.stripe.com (never bundled)", /https:\/\/js\.stripe\.com\//.test(panel) && !/from "@stripe\//.test(panel));
  ok("  ^ the fee is disclosed BEFORE the card is entered and as its own line in the review",
    /data-card-fee-notice/.test(panel) && /data-card-fee-line/.test(panel) && panel.indexOf("data-card-fee-notice") < panel.indexOf("ref={mountRef}"));
  ok("  ^ the browser posts ids only (no amount) to card-pay", !/amount:|total:|surcharge:/.test(panel.slice(panel.indexOf("async function post"), panel.indexOf("export default"))) && !/step: "(review|confirm|finalize)",[^}]*Cents/.test(panel));
  ok("  ^ wallets that show their own amount sheet are off on this form", /applePay: "never", googlePay: "never"/.test(panel));
}

// ════════════════════════════════════════════════════════════════════════════
console.log("\n── 6. Mutation tests — break each rule, the suite must notice ──────\n");

const quietCount = async (suite, mod) => {
  let failures = 0;
  const t = (_n, cond) => { if (!cond) failures++; };
  await suite(mod, t);
  return failures;
};
ok("the unbroken modules pass the suites quietly too", (await quietCount(rulesSuite, rules)) === 0 && (await quietCount(mathSuite, math)) === 0);

const scratch = mkdtempSync(join(tmpdir(), "fq-surcharge-mutants-"));
async function mutant(file, from, to) {
  const src = read(file);
  if (!src.includes(from)) return { missing: true };
  const body = src.replace(from, to);
  const path = join(scratch, `m${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(path, body);
  return import(pathToFileURL(path).href);
}
const RULES_FILE = "lib/stripe/clientCardSurcharge.js";
const MATH_FILE = "lib/stripe/clientCardSurchargeMath.js";
const MUTANTS = [
  ["rules", "credit-only becomes not-debit (prepaid/unknown pass)", RULES_FILE, 'if (String(funding || "").toLowerCase() !== "credit")', 'if (String(funding || "").toLowerCase() === "debit")'],
  ["rules", "Quebec CLIENT check removed", RULES_FILE, 'if (r.region === "QC") return { allowed: false, reason: SURCHARGE_REASONS.CLIENT_QUEBEC };', ""],
  ["rules", "Quebec COMPANY check removed", RULES_FILE, 'if (region === "QC") return { allowed: false, reason: SURCHARGE_REASONS.COMPANY_QUEBEC };', ""],
  ["rules", "unknown client province treated as permission", RULES_FILE, 'if (!r.country || (r.country === "CA" && !r.region)) {', "if (false) {"],
  ["rules", "client outside Canada allowed", RULES_FILE, 'if (r.country !== "CA") return { allowed: false, reason: SURCHARGE_REASONS.CLIENT_OUTSIDE_CANADA };', ""],
  ["rules", "Quebec job site ignored", RULES_FILE, 'if (site.country === "CA" && site.region === "QC") {', "if (false) {"],
  ["rules", "notice confirmation not required", RULES_FILE, "if (!at || !by) return false;", "if (false) return false;"],
  ["rules", "setting flag not required", RULES_FILE, "if (company?.clientCardSurcharge !== true) return false;", ""],
  ["rules", "method no longer checked (bank debit surcharged)", RULES_FILE, 'if (String(method || "") !== "card") return none(SURCHARGE_REASONS.NOT_CARD);', ""],
  ["rules", "US company allowed", RULES_FILE, 'if (country !== "CA") return { allowed: false, reason: SURCHARGE_REASONS.COMPANY_NOT_CANADA };', ""],
  ["math", "rounded half-up instead of down (can exceed 2.4%)", MATH_FILE, "const capped = Math.floor((amount * CLIENT_CARD_SURCHARGE_MAX_BPS) / 10000);", "const capped = Math.round((amount * CLIENT_CARD_SURCHARGE_MAX_BPS) / 10000);"],
  ["math", "unknown cost of acceptance charged at 2.4% anyway", MATH_FILE, "    return 0;\n  }\n  const fee", "    cost = capped;\n  }\n  const fee"],
  ["math", "Stripe's max-charge guard removed", MATH_FILE, "if (amount + fee > STRIPE_MAX_CHARGE_CENTS) return 0;", ""],
  ["math", "refund share not cumulative (partials stop adding up)", MATH_FILE, "return Math.max(0, shareOf(fee, base, after) - shareOf(fee, base, before));", "return Math.round((fee * now) / base);"],
  ["math", "dashboard refund not split (fee counted as invoice money)", MATH_FILE, "return Math.min(base, Math.round((back * base) / (base + fee)));", "return Math.min(base, back);"],
];
try {
  for (const [kind, label, file, from, to] of MUTANTS) {
    const mod = await mutant(file, from, to);
    if (mod.missing) {
      ok(`mutant "${label}": the code it mutates is still there`, false, from);
      continue;
    }
    const failures = await quietCount(kind === "rules" ? rulesSuite : mathSuite, mod);
    ok(`mutant "${label}" is caught (${failures} assertion${failures === 1 ? "" : "s"} fail)`, failures > 0);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
