// lib/stripe/processingFee.js
//
// The card-processing fee a contractor pays on each payment their client makes
// through FieldQuo — PURE. No Stripe client, no database, no env. The one
// place the rates live; every charge creator and every settlement reads them
// from here (scripts/check-processing-fee.mjs asserts that by execution).
//
// ── Why this exists ───────────────────────────────────────────────────────
//
// Every homeowner payment is a DESTINATION CHARGE created on FieldQuo's
// platform account and transferred to the contractor's Express account. In
// that shape Stripe's own docs are explicit about who pays: "Your account
// balance is debited for the cost of the Stripe fees, refunds, and
// chargebacks" — the PLATFORM's balance. With `application_fee_amount: 0`
// FieldQuo was paying ~2.9% + 30¢ on every dollar a contractor collected, and
// losing money on the payments it exists to make happen.
//
// The owner's ruling (2026-09-12): "we are not going to pay out of pocket …
// this fee will need to be pass-through to the company." Jobber and Housecall
// Pro bill the contractor 2.9% + 30¢ on cards and ~1% on bank debit; that is
// the model. The fee is taken as the application fee on the charge — Stripe
// deducts it from the transfer before the money reaches the contractor — so it
// is never a separate bill and never a browser-supplied number
// (non-negotiable #5).
//
// Cards carry a 0.1% platform margin on top of Stripe's rate — the owner's
// final decision, 2026-09-12: the contractor is charged 3.0% + 30¢ ("pretty
// much Housecall Pro's 2.99%"), Stripe costs the platform 2.9% + 30¢, and
// FieldQuo keeps the 0.1%. Bank debit, instant payouts and the dispute fee
// are passed through at Stripe's cost with no margin. The two card constants
// below are named so the margin is visible in code and executed in the
// check (scripts/check-processing-fee.mjs: $2,260 → $68.10, of which $2.26 is
// FieldQuo's), and the contractor sees ONE number (3% + 30¢) on every
// screen, the payment record and the export — never "2.9% to Stripe + 0.1%
// to us".
//
// ── The rates, and where each comes from ──────────────────────────────────
//
// Published rates are the ESTIMATE a charge is created with. Stripe's
// actual fee differs for a cross-border card (+0.8%), a currency conversion
// (+2%) or an Affirm payment, and the owner's rule is that every fee passes
// through: at settlement lib/stripe/paymentIntentFee.js reads the charge's
// real fee and trues the application fee up to it (never down — a domestic
// card pays the published rate). CARD_SURCHARGES below is what the
// settings page tells the contractor to expect.
//
// Percentages are basis points and fixed parts are cents so the arithmetic
// is integer arithmetic: 3% of $2,260 is 67.80, not 67.79999999.

// What Stripe charges the platform per successful card charge — Stripe US
// pricing (stripe.com/pricing) 2.9% + 30¢; Stripe Canada
// (stripe.com/en-ca/pricing) 2.9% + C$0.30. Basis points.
export const STRIPE_CARD_RATE_BPS = 290;
export const STRIPE_CARD_FIXED_CENTS = 30;
// What the contractor is charged: Stripe's rate plus the platform's 0.1%
// processing margin (owner, 2026-09-12). FieldQuo's share of a card fee is
// exactly FIELDQUO_CARD_RATE_BPS − STRIPE_CARD_RATE_BPS of the amount.
export const FIELDQUO_CARD_RATE_BPS = 300;
export const FIELDQUO_CARD_MARGIN_BPS = FIELDQUO_CARD_RATE_BPS - STRIPE_CARD_RATE_BPS;

export const PROCESSING_RATES = Object.freeze({
  // 3.0% + 30¢ to the contractor — STRIPE_CARD_RATE_BPS + the platform's
  // margin, see above. Same figures in both currencies FieldQuo bills in, so
  // one entry.
  card: Object.freeze({
    method: "card",
    basisPoints: FIELDQUO_CARD_RATE_BPS,
    fixedCents: STRIPE_CARD_FIXED_CENTS,
    capCents: null,
    currencies: Object.freeze(["cad", "usd"]),
    formula: "3% + $0.30",
  }),
  // Canadian pre-authorized debit — Stripe Canada pricing: 1% + C$0.40 per
  // successful transaction, capped at C$5.00, passed through at cost (no
  // platform margin on bank debit). CAD only, because Stripe
  // requires the debit currency to match the client's Canadian bank account
  // (lib/servicePlans/stripeMandate.js authorisableMethods).
  acss_debit: Object.freeze({
    method: "acss_debit",
    basisPoints: 100,
    fixedCents: 40,
    capCents: 500,
    currencies: Object.freeze(["cad"]),
    formula: "1% + $0.40, max $5.00",
  }),
  // US ACH Direct Debit — Stripe US pricing: 0.8%, capped at $5.00, at cost. Not
  // offered anywhere in the product today (authorisableMethods returns card
  // and acss_debit only); it is here so the day a US bank-debit option is
  // added, its fee exists before its checkout does.
  us_bank_account: Object.freeze({
    method: "us_bank_account",
    basisPoints: 80,
    fixedCents: 0,
    capCents: 500,
    currencies: Object.freeze(["usd"]),
    formula: "0.8%, max $5.00",
  }),
});

// ── Pay-over-time providers: Stripe's published rate, passed through at cost ─
//
// NOT in PROCESSING_RATES, on purpose. No session is CREATED at these
// rates: a client reaches Affirm or Klarna on the invoice's hosted Checkout
// page, which uses Stripe's dynamic payment methods
// (lib/stripe/invoicePaymentConfiguration.js), so the method is unknown
// when the session is created and the application fee is estimated at the
// card rate above. What the contractor pays is decided at settlement:
// lib/stripe/paymentIntentFee.js reads Stripe's ACTUAL fee off the charge's
// balance transaction and reverses the difference out of the transfer, with
// a platform share of zero for these methods (platformShareCents below
// prices no margin on anything but a card). Executed for a CA$6,500 Klarna
// payment in scripts/check-klarna.mjs: card estimate $195.30, Stripe's
// Klarna fee $389.65, $194.35 reversed, the contractor bears exactly
// $389.65 and FieldQuo keeps nothing — Stripe's cost, at cost (owner,
// 2026-09-12: every fee passes through).
//
// These figures are what the settings card TELLS the contractor to expect;
// Stripe's actual fee is what they pay. Source: Stripe's local payment
// methods pricing — stripe.com/pricing/local-payment-methods (Canada,
// checked 2026-10-09): "Klarna — United States, Canada 5.99% + CA$0.30";
// "Affirm — Standard 6% + CA$0.30" (Enhanced 7.99% + CA$0.30 where Stripe
// has put the account on it). Stripe also lists +1.5% for international
// transactions and +2% for currency conversion, which the true-up passes
// through the same way when they apply.
export const FINANCING_RATES = Object.freeze({
  affirm: Object.freeze({
    method: "affirm",
    basisPoints: 600,
    fixedCents: 30,
    currencies: Object.freeze(["cad", "usd"]),
    formula: "6% + $0.30",
  }),
  klarna: Object.freeze({
    method: "klarna",
    basisPoints: 599,
    fixedCents: 30,
    currencies: Object.freeze(["cad", "usd"]),
    formula: "5.99% + $0.30",
  }),
});

/**
 * Stripe's published fee for one pay-over-time payment, in cents — the
 * figure the settings card quotes and the check holds settlement to. Never
 * an application fee at creation (see FINANCING_RATES). Null for a method
 * or currency Stripe does not price this way.
 */
export function publishedFinancingFeeCents({ amountCents, currency, method }) {
  const rate = FINANCING_RATES[String(method || "").toLowerCase()];
  if (!rate || !rate.currencies.includes(String(currency || "").toLowerCase())) return null;
  const amount = Math.trunc(Number(amountCents));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(amount, Math.floor((amount * rate.basisPoints + 5000) / 10000) + rate.fixedCents);
}

/**
 * The published rate for a method in a currency, or null when Stripe does not
 * offer that pairing (PAD in USD, ACH in CAD).
 */
export function processingRateFor({ currency, method }) {
  const rate = PROCESSING_RATES[String(method || "").toLowerCase()];
  if (!rate) return null;
  const cur = String(currency || "").toLowerCase();
  return rate.currencies.includes(cur) ? rate : null;
}

/**
 * The fee in cents on one payment.
 *
 * Rounded half-up to the cent; never negative; never above the amount. Throws
 * on a method/currency Stripe does not price, because an UNKNOWN fee silently
 * becoming zero is the exact bug this file replaces — a charge creator that
 * cannot price its method must not create the charge.
 */
export function processingFeeCents({ amountCents, currency, method }) {
  const rate = processingRateFor({ currency, method });
  if (!rate) {
    throw new Error(
      `No published processing rate for ${method || "?"} in ${currency || "?"}`,
    );
  }
  const amount = Math.trunc(Number(amountCents));
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  // Integer half-up: (amount × bp + 5000) ÷ 10000, floored. 5000 is half of the
  // 10000 that turns basis points of cents back into cents.
  const percentPart = Math.floor((amount * rate.basisPoints + 5000) / 10000);
  let fee = percentPart + rate.fixedCents;
  if (rate.capCents != null) fee = Math.min(fee, rate.capCents);
  return Math.max(0, Math.min(fee, amount));
}

/**
 * FieldQuo's share of a fee — the platform margin on a card payment, zero on
 * everything else. Executed in the check so the 0.1% is a number somebody can
 * point at, and NEVER sent to a browser: the contractor sees one fee.
 */
export function platformShareCents({ amountCents, currency, method }) {
  const rate = processingRateFor({ currency, method });
  if (!rate || rate.method !== "card") return 0;
  const amount = Math.trunc(Number(amountCents));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const total = processingFeeCents({ amountCents, currency, method });
  const stripes = Math.min(
    amount,
    Math.floor((amount * STRIPE_CARD_RATE_BPS + 5000) / 10000) + STRIPE_CARD_FIXED_CENTS,
  );
  return Math.max(0, total - stripes);
}

/**
 * For display and for the Payment row: what was taken, what lands, and the
 * rate it was taken at. `rateLabel` is the method key ("card", "acss_debit"),
 * not prose — the screens translate it; the export writes it verbatim.
 */
export function feeBreakdown({ amountCents, currency, method }) {
  const feeCents = processingFeeCents({ amountCents, currency, method });
  const amount = Math.max(0, Math.trunc(Number(amountCents)) || 0);
  return {
    feeCents,
    netCents: amount - feeCents,
    rateLabel: PROCESSING_RATES[method].method,
    formula: PROCESSING_RATES[method].formula,
  };
}

/**
 * The rate lines a settings page shows BEFORE a contractor connects — every
 * method Stripe would price in their currency. Card first, always.
 */
export function publishedRates(currency) {
  const cur = String(currency || "cad").toLowerCase();
  return Object.values(PROCESSING_RATES)
    .filter((r) => r.currencies.includes(cur))
    .map((r) => ({ method: r.method, formula: r.formula }));
}

/**
 * Format cents as "$65.84" for the few places that print a fee outside the
 * app's money formatter (the export, a server log). Currency symbol is the
 * dollar for both CAD and USD; the export carries the currency column.
 */
export function formatFeeCents(cents) {
  const n = Math.max(0, Math.trunc(Number(cents)) || 0);
  return `$${(n / 100).toFixed(2)}`;
}

// ── Instant payouts ─────────────────────────────────────────────────────────
//
// Stripe's Instant Payouts fee for Connect platforms in the US and Canada:
// 1% of the payout amount (minimum 50¢) — stripe.com/pricing, "Instant
// Payouts", and the Connect pricing page. Passed through at cost, like the
// processing fee above: the owner sets the platform's instant-payout fee to
// this same 1% in Stripe's dashboard (Connect → Platform pricing → Instant
// payouts), so what Stripe reports as `net_available` is gross − 1%. The
// screen shows THAT reported net, not this constant — this is the rate the
// contractor is told to expect; Stripe's answer is what they get.
export const INSTANT_PAYOUT_RATE = Object.freeze({
  basisPoints: 100,
  minimumCents: 50,
  formula: "1%",
});

// ── Card surcharges Stripe adds on top of the base rate ──────────────────
//
// Stripe Canada (stripe.com/en-ca/pricing): +0.8% for international cards,
// +2% when currency conversion is required. Stripe US (stripe.com/pricing):
// +1.5% international, +1% conversion. These are NOT estimated at creation —
// the card is unknown until it is charged — so the estimate is the flat
// published rate above and the actual Stripe fee, read from the charge's
// balance transaction at settlement, is trued up by reversing the difference
// out of the contractor's transfer (lib/stripe/paymentIntentFee.js). The
// contractor bears Stripe's real cost plus the platform margin, never less
// — and never more than the published rate on a domestic card, because a
// real fee BELOW the estimate is left alone. Keyed by the platform's
// country (Stripe bills the platform, and the platform is Canadian).
export const CARD_SURCHARGES = Object.freeze({
  ca: Object.freeze({
    international: Object.freeze({ basisPoints: 80, formula: "+0.8%" }),
    conversion: Object.freeze({ basisPoints: 200, formula: "+2%" }),
  }),
  us: Object.freeze({
    international: Object.freeze({ basisPoints: 150, formula: "+1.5%" }),
    conversion: Object.freeze({ basisPoints: 100, formula: "+1%" }),
  }),
});

// FieldQuo's Stripe platform account is Canadian; Stripe bills it at the
// Canadian surcharge rates whatever currency the charge is in.
export const PLATFORM_COUNTRY = "ca";

/**
 * The surcharge lines a settings page prints under the card rate — "when
 * they apply", because neither is known until the card is charged.
 */
export function publishedSurcharges(country = PLATFORM_COUNTRY) {
  const set = CARD_SURCHARGES[String(country || "").toLowerCase()] || CARD_SURCHARGES.ca;
  return [
    { kind: "international", formula: set.international.formula },
    { kind: "conversion", formula: set.conversion.formula },
  ];
}

/**
 * PURE — the true-up rule. Given what was collected as the application fee
 * (the published-rate estimate), the platform's own share of that estimate,
 * and Stripe's ACTUAL fee from the balance transaction, how much more must
 * come back out of the transfer so the contractor bears Stripe's real cost.
 * Zero when the real cost is at or below the estimate's Stripe share: the
 * published rate is the promise on a domestic card, and a cheaper card is
 * not charged less. Executed in scripts/check-processing-fee.mjs.
 */
export function trueUpCents({ estimatedFeeCents, platformShareCents, actualStripeFeeCents }) {
  const est = Math.max(0, Math.trunc(Number(estimatedFeeCents)) || 0);
  const share = Math.max(0, Math.trunc(Number(platformShareCents)) || 0);
  const actual = Math.trunc(Number(actualStripeFeeCents));
  if (!Number.isFinite(actual) || actual <= 0) return 0;
  return Math.max(0, actual - (est - share));
}

// ── The CLIENT card fee: the most a Canadian company may add for a credit card ──
//
// Not to be confused with CARD_SURCHARGES above, which are STRIPE's extra
// charges to the platform (international card, conversion). This is the
// opposite direction: what a contractor may pass on to its OWN client as a
// "credit card fee" line when the client pays by credit card — the
// Company.clientCardSurcharge setting, decided in
// lib/stripe/clientCardSurcharge.js.
//
// The rule is "the lesser of the merchant's actual cost of acceptance and
// 2.4%":
//   - 2.4% is the network cap in Canada since the Visa/Mastercard class-action
//     settlement took effect on 6 October 2022 — CFIB's merchant guide
//     (cfib-fcei.ca/surcharging: "capped at 2.4% or the amount it costs you to
//     accept those credit cards, whichever is less") and Visa's April 2023
//     rules update ("The maximum amount for a credit card surcharge in Canada
//     is 2.4%"). Stripe's own surcharging docs list Canada as "Credit cards
//     only — 2.4%" (docs.stripe.com/payments/cards/surcharge, checked
//     2026-10-05).
//   - the contractor's cost of acceptance is the card fee above — 3% + 30¢ —
//     which is MORE than 2.4% on every amount, so the 2.4% cap is always the
//     lesser. lib/stripe/clientCardSurcharge.js still takes the minimum of
//     the two, executed, so a future rate cut below 2.4% lowers the client
//     fee with it instead of leaving a surcharge above cost.
// Rounded DOWN to the cent, never half-up: rounding up a 0.5¢ remainder on a
// small amount would put the surcharge over 2.4%.
export const CLIENT_CARD_SURCHARGE_MAX_BPS = 240;

// Stripe's dispute fee in the two currencies FieldQuo bills in — US$15 and
// C$15 (stripe.com/pricing and stripe.com/en-ca/pricing, "Disputes").
// Recovered from the contractor by lib/stripe/disputeRecovery.js; here so a
// client component can print it without pulling a Stripe client in.
export const DISPUTE_FEE_CENTS = 1500;
