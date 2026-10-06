// lib/stripe/clientCardCharge.js
//
// The portal's own card form — the ONE card flow that can add the client
// credit-card fee (Company.clientCardSurcharge; the rules are in
// lib/stripe/clientCardSurcharge.js). Server side: review, confirm, settle,
// reconcile.
//
// ── Why a second card flow at all ─────────────────────────────────────────
//
// Every other homeowner card charge is a HOSTED Stripe page (Checkout:
// invoices, booking fees, service-plan sign-up) or an off-session charge.
// On a hosted page the client picks the card AFTER we have fixed the amount,
// so the fee could be neither disclosed nor charged — the law asks for both
// BEFORE payment, on the actual card's funding type. So when a client may be
// charged the fee, the portal renders Stripe's Payment Element instead and
// finalizes on the server, in Stripe's documented order
// (docs.stripe.com/payments/finalize-payments-on-the-server, confirmation
// tokens):
//
//   1. the browser collects the card in Stripe's iframe and creates a
//      ConfirmationToken — no money, no amount from us;
//   2. REVIEW: the server reads the token's payment_method_preview.card
//      .funding from Stripe, decides the fee from its own rows
//      (clientCardSurchargeDecision), and creates the PaymentIntent for the
//      exact total, unconfirmed. The browser is shown the lines — invoice,
//      "Credit card fee 2.4%", total — and may go back and use another card;
//   3. CONFIRM: the server re-checks everything fresh (the balance, the
//      setting, the token) and confirms THAT intent with THAT token. 3-D
//      Secure, when the bank asks, is handled in the browser by
//      stripe.handleNextAction and the server is asked to finalize;
//   4. SETTLE: the Payment row is written by whichever arrives first — the
//      confirm/finalize response itself, the payment_intent.succeeded
//      webhook on either endpoint, or the hourly reconciler. All idempotent
//      on the intent id (Payment.stripePaymentIntentId is unique).
//
// The browser never sends an amount (non-negotiable #5): it sends an invoice
// id, a stage id (a hint, re-derived), a token id and an intent id.
//
// ── Stripe's surcharge fields ─────────────────────────────────────────────
//
// A surcharged intent carries amount_details.surcharge.amount, which is how
// the fee reaches the card network as a surcharge (Visa's 2023 rules make
// that field the network notification), and enforce_validation "enabled",
// so Stripe itself refuses a fee on a card it says may not carry one. Those
// fields are a public preview on API version 2026-03-25.preview, sent per
// request on the surcharged intent only. If Stripe refuses them (the preview
// not open to the account, say), the intent is created WITHOUT the fee, the
// client is shown no fee and pays the invoice amount, and the refusal is
// recorded on /platform/errors — a client charged less than the screen said
// is never possible, and a contractor whose setting silently stopped working
// shows up in the error log rather than nowhere.

import { db } from "@/lib/db";
import { stripe, destinationChargeParamsWithRecovery } from "@/lib/stripe";
import { invoicePaymentCurrency } from "@/lib/stripe/paymentCurrency";
import { settledFeeOrNull } from "@/lib/stripe/paymentIntentFee";
import { actualPaymentMethod } from "@/lib/stripe/actualPaymentMethod";
import { recordStripePayment } from "@/lib/invoices/recordStripePayment";
import { recordError } from "@/lib/platform/errorLog";
import { refuseDemoCharge } from "@/lib/demo/simulatedSpend";
import {
  clientCardSurchargeDecision,
  STRIPE_SURCHARGE_API_VERSION,
} from "@/lib/stripe/clientCardSurcharge";
import { clientJurisdictionRow, invoiceSiteAddress } from "@/lib/stripe/clientCardOffer";

// The light half (offer, publishable key, the two narrow reads) lives in
// lib/stripe/clientCardOffer.js so the portal's GET route does not import
// this module's Stripe and settlement chain; re-exported for callers here.
export {
  stripePublishableKey,
  portalCardOffer,
  invoiceSiteAddress,
  clientJurisdictionRow,
} from "@/lib/stripe/clientCardOffer";

/** metadata.fq_flow on every intent this module creates. */
export const PORTAL_CARD_FLOW = "portal_card";

// ── Reading what Stripe says about the card ────────────────────────────────

/**
 * PURE — the parts of a ConfirmationToken this flow uses, or a refusal.
 * A token already used for an intent, expired, or not a card is refused;
 * the funding type is passed through as Stripe gave it (the decision treats
 * anything but "credit" as no fee).
 */
export function readCardToken(token, { nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  if (!token || typeof token !== "object" || !/^ctoken_/.test(String(token.id || ""))) {
    return { ok: false, reason: "token_missing" };
  }
  if (token.payment_intent || token.setup_intent) return { ok: false, reason: "token_used" };
  if (Number.isFinite(Number(token.expires_at)) && Number(token.expires_at) <= nowSeconds) {
    return { ok: false, reason: "token_expired" };
  }
  const preview = token.payment_method_preview || null;
  if (!preview || preview.type !== "card" || !preview.card) return { ok: false, reason: "not_card" };
  return {
    ok: true,
    id: token.id,
    funding: preview.card.funding || "unknown",
    brand: preview.card.brand || null,
    last4: preview.card.last4 || null,
  };
}

/**
 * PURE — did Stripe refuse the SURCHARGE fields (as opposed to the card, the
 * amount or the account)? Only an invalid-request error that names them
 * qualifies; anything else is a real failure and is not retried without
 * the fee.
 */
export function isSurchargeRefusal(err) {
  if (!err || err.type !== "StripeInvalidRequestError") return false;
  const where = `${err.param || ""} ${err.message || ""} ${err.code || ""}`;
  return /surcharge|amount_details|api[_ ]?version|preview/i.test(where);
}

// ── Step 2: review ─────────────────────────────────────────────────────────

function intentMetadata({ current, stageId, decision, baseCents, tokenId }) {
  return {
    invoiceId: current.id,
    ...(stageId ? { stageId: String(stageId) } : {}),
    fq_flow: PORTAL_CARD_FLOW,
    fq_base_cents: String(baseCents),
    fq_card_surcharge_cents: String(decision.surchargeCents),
    fq_card_surcharge_bps: String(decision.rateBps),
    fq_confirmation_token: tokenId,
  };
}

async function createIntent({ company, current, currency, decision, baseCents, stageId, tokenId }, deps) {
  const client = deps.stripe || stripe;
  const total = baseCents + decision.surchargeCents;
  const route = await destinationChargeParamsWithRecovery(
    {
      company,
      // FieldQuo's 3% + 30¢ is on the WHOLE charge, fee included — the
      // contractor's processing fee is taken on what Stripe actually charges.
      amountCents: total,
      currency,
      method: "card",
      metadata: intentMetadata({ current, stageId, decision, baseCents, tokenId }),
    },
    deps,
  );
  const params = {
    amount: total,
    currency,
    payment_method_types: ["card"],
    description: `Invoice ${current.invoiceNumber || current.id}`,
    ...route,
  };
  const opts = { idempotencyKey: `fq-cardpay-${tokenId}-${total}` };
  if (decision.surchargeCents > 0) {
    params.amount_details = {
      surcharge: { amount: decision.surchargeCents, enforce_validation: "enabled" },
    };
    opts.apiVersion = STRIPE_SURCHARGE_API_VERSION;
  }
  return client.paymentIntents.create(params, opts);
}

/**
 * @param resolved  lib/portal/payableInvoice.js resolvePortalCharge's answer
 * @returns {{ ok: true, review } | { ok: false, status, code }}
 */
export async function reviewCardPayment(db, { resolved, stageId = null, confirmationTokenId }, deps = {}) {
  const sc = deps.stripe || stripe;
  const { company, current, chargeCents, stageAmountCents } = resolved;
  await refuseDemoCharge(company);
  if (!(chargeCents > 0)) return { ok: false, status: 400, code: "nothing_owed" };
  if (!/^ctoken_[A-Za-z0-9_]+$/.test(String(confirmationTokenId || ""))) {
    return { ok: false, status: 400, code: "token_missing" };
  }

  let token;
  try {
    token = readCardToken(await sc.confirmationTokens.retrieve(confirmationTokenId));
  } catch {
    return { ok: false, status: 400, code: "token_missing" };
  }
  if (!token.ok) return { ok: false, status: 400, code: token.reason };

  const currency = invoicePaymentCurrency(company.currency);
  const clientRow = await clientJurisdictionRow(db, resolved.client.id);
  const siteAddress = await invoiceSiteAddress(db, current.id);
  let decision = clientCardSurchargeDecision({
    company,
    client: clientRow,
    siteAddress,
    method: "card",
    funding: token.funding,
    amountCents: chargeCents,
    currency,
  });
  const stage = stageAmountCents != null ? stageId : null;

  let intent;
  try {
    intent = await createIntent(
      { company, current, currency, decision, baseCents: chargeCents, stageId: stage, tokenId: token.id },
      deps,
    );
  } catch (err) {
    if (decision.surchargeCents > 0 && isSurchargeRefusal(err)) {
      await (deps.recordError || recordError)({
        area: "client_card_surcharge",
        code: "processor_refused",
        companyId: company.id,
        message: `Stripe refused the credit-card fee fields; the payment was offered without the fee: ${err?.message}`,
        detail: { invoiceId: current.id, requestId: err?.requestId || null, param: err?.param || null },
      });
      decision = { ...decision, applies: false, reason: "processor_refused", surchargeCents: 0, rateBps: 0, totalCents: chargeCents };
      intent = await createIntent(
        { company, current, currency, decision, baseCents: chargeCents, stageId: stage, tokenId: token.id },
        deps,
      );
    } else {
      throw err;
    }
  }

  return {
    ok: true,
    review: {
      intentId: intent.id,
      currency,
      baseCents: chargeCents,
      surchargeCents: decision.surchargeCents,
      rateBps: decision.rateBps,
      totalCents: chargeCents + decision.surchargeCents,
      // "credit" | "debit" | "prepaid" | "unknown" — the page says WHY there
      // is or is not a fee on this card, so a debit card reads as a rule.
      funding: token.funding,
      brand: token.brand,
      last4: token.last4,
    },
  };
}

// ── Step 3: confirm (and finalize after 3-D Secure) ───────────────────────

/**
 * PURE — does this intent belong to this portal payment, and is it still the
 * figure the server would charge now? Every refusal is a "review again",
 * never a charge of a different amount.
 */
export function checkIntentStillValid({ intent, company, current, chargeCents }) {
  const m = intent?.metadata || {};
  if (m.fq_flow !== PORTAL_CARD_FLOW) return { ok: false, code: "not_ours" };
  if (m.companyId !== company?.id) return { ok: false, code: "not_ours" };
  if (m.invoiceId !== current?.id) return { ok: false, code: "changed" };
  const base = Number(m.fq_base_cents);
  const fee = Number(m.fq_card_surcharge_cents) || 0;
  if (!Number.isSafeInteger(base) || base <= 0) return { ok: false, code: "not_ours" };
  if (!/^ctoken_/.test(String(m.fq_confirmation_token || ""))) return { ok: false, code: "not_ours" };
  if (base !== chargeCents) return { ok: false, code: "changed" };
  if (Number(intent.amount) !== base + fee) return { ok: false, code: "changed" };
  return { ok: true, baseCents: base, surchargeCents: fee, tokenId: m.fq_confirmation_token || null };
}

async function cancelQuietly(sc, intentId) {
  try {
    await sc.paymentIntents.cancel(intentId);
  } catch (err) {
    console.error("[card-pay] could not cancel a stale intent:", intentId, err?.message);
  }
}

/**
 * @returns {{ ok: true, status, clientSecret?, settled? } | { ok: false, status, code, message? }}
 */
export async function confirmCardPayment(db, { resolved, intentId, returnUrl }, deps = {}) {
  const sc = deps.stripe || stripe;
  const { company, current, chargeCents } = resolved;
  await refuseDemoCharge(company);
  if (!/^pi_[A-Za-z0-9_]+$/.test(String(intentId || ""))) return { ok: false, status: 400, code: "not_ours" };

  const intent = await sc.paymentIntents.retrieve(intentId);
  // Already done (a double tap, a retried request): settle and say so.
  if (intent?.status === "succeeded") {
    const settled = await settleCardPayment(intent.id, deps);
    return { ok: true, status: "succeeded", settled };
  }
  if (intent?.status === "requires_action") {
    return { ok: true, status: "requires_action", clientSecret: intent.client_secret };
  }
  if (intent?.status !== "requires_payment_method" && intent?.status !== "requires_confirmation") {
    return { ok: false, status: 409, code: "changed" };
  }

  const still = checkIntentStillValid({ intent, company, current, chargeCents });
  if (!still.ok) {
    if (still.code === "changed") await cancelQuietly(sc, intent.id);
    return { ok: false, status: still.code === "not_ours" ? 404 : 409, code: still.code };
  }

  // The fee, re-decided NOW from the same card: the setting may have been
  // switched off, the client's address edited, since the review. A fee the
  // server would no longer charge is not charged — the client reviews again.
  if (still.surchargeCents > 0) {
    let token;
    try {
      token = readCardToken(await sc.confirmationTokens.retrieve(still.tokenId));
    } catch {
      token = { ok: false };
    }
    const clientRow = await clientJurisdictionRow(db, resolved.client.id);
    const siteAddress = await invoiceSiteAddress(db, current.id);
    const decision = token.ok
      ? clientCardSurchargeDecision({
          company,
          client: clientRow,
          siteAddress,
          method: "card",
          funding: token.funding,
          amountCents: chargeCents,
          currency: intent.currency,
        })
      : { surchargeCents: -1 };
    if (decision.surchargeCents !== still.surchargeCents) {
      await cancelQuietly(sc, intent.id);
      return { ok: false, status: 409, code: "changed" };
    }
  }

  let confirmed;
  try {
    confirmed = await sc.paymentIntents.confirm(
      intent.id,
      { confirmation_token: still.tokenId, return_url: returnUrl },
      {
        idempotencyKey: `fq-cardpay-confirm-${intent.id}`,
        ...(still.surchargeCents > 0 ? { apiVersion: STRIPE_SURCHARGE_API_VERSION } : {}),
      },
    );
  } catch (err) {
    // A decline is the card's answer, not a fault — the client tries another
    // card. Stripe's own wording stays out of the page (the portal speaks the
    // client's language under the contractor's logo); the code goes back.
    if (err?.type === "StripeCardError") {
      return { ok: false, status: 402, code: "declined", declineCode: err?.decline_code || err?.code || null };
    }
    throw err;
  }

  if (confirmed.status === "succeeded") {
    const settled = await settleCardPayment(confirmed.id, deps);
    return { ok: true, status: "succeeded", settled };
  }
  if (confirmed.status === "requires_action") {
    return { ok: true, status: "requires_action", clientSecret: confirmed.client_secret };
  }
  if (confirmed.status === "processing") return { ok: true, status: "processing" };
  return { ok: false, status: 402, code: "declined" };
}

/**
 * After stripe.handleNextAction in the browser: ask Stripe how it ended, and
 * settle if it succeeded. The browser's own word ("it worked") is never
 * enough to mark an invoice paid.
 */
export async function finalizeCardPayment(db, { resolved, intentId }, deps = {}) {
  const sc = deps.stripe || stripe;
  if (!/^pi_[A-Za-z0-9_]+$/.test(String(intentId || ""))) return { ok: false, status: 400, code: "not_ours" };
  const intent = await sc.paymentIntents.retrieve(intentId);
  const m = intent?.metadata || {};
  if (m.fq_flow !== PORTAL_CARD_FLOW || m.companyId !== resolved.company?.id) {
    return { ok: false, status: 404, code: "not_ours" };
  }
  if (intent.status === "succeeded") {
    const settled = await settleCardPayment(intent.id, deps);
    return { ok: true, status: "succeeded", settled };
  }
  if (intent.status === "processing") return { ok: true, status: "processing" };
  return { ok: false, status: 402, code: "declined" };
}

// ── Step 4: settle ─────────────────────────────────────────────────────────

/**
 * PURE — split what Stripe received into the invoice money and the card fee,
 * from the intent's own metadata (written by this module at creation).
 */
export function splitReceived(intent) {
  const received = Math.max(0, Math.trunc(Number(intent?.amount_received ?? 0)) || 0);
  const m = intent?.metadata || {};
  const fee = Math.min(received, Math.max(0, Math.trunc(Number(m.fq_card_surcharge_cents)) || 0));
  const rateBps = Math.max(0, Math.trunc(Number(m.fq_card_surcharge_bps)) || 0);
  return { receivedCents: received, baseCents: received - fee, surchargeCents: fee, rateBps };
}

/**
 * Record a succeeded portal card intent as a Payment. Idempotent; called
 * from the confirm/finalize responses, both webhook endpoints and the
 * reconciler. `{ handled: false }` for an intent this flow did not create.
 */
export async function settleCardPayment(intentRef, deps = {}) {
  const sc = deps.stripe || stripe;
  const prisma = deps.db || db;
  let intent = typeof intentRef === "object" ? intentRef : null;
  if (!intent || !(intent.latest_charge && typeof intent.latest_charge === "object")) {
    intent = await sc.paymentIntents.retrieve(typeof intentRef === "string" ? intentRef : intentRef?.id, {
      expand: ["latest_charge.balance_transaction", "payment_method"],
    });
  }
  const m = intent?.metadata || {};
  if (m.fq_flow !== PORTAL_CARD_FLOW || !m.invoiceId) return { handled: false };
  if (intent.status !== "succeeded") return { handled: true, recorded: false, reason: "not_succeeded" };

  const split = splitReceived(intent);
  if (split.baseCents <= 0) return { handled: true, recorded: false, reason: "nothing_received" };
  const fee = await settledFeeOrNull(intent, deps.stripe ? { stripe: deps.stripe } : {});
  // `deps.record` is the seam scripts/check-client-card-surcharge.mjs uses to
  // see exactly what is written; production passes nothing.
  const record = deps.record || recordStripePayment;
  const result = await record(prisma, {
    invoiceId: m.invoiceId,
    paymentIntentId: intent.id,
    amountCents: split.baseCents,
    fee,
    selectedPaymentMethod: actualPaymentMethod(intent) || "card",
    clientCardSurcharge: split.surchargeCents > 0 ? { cents: split.surchargeCents, rateBps: split.rateBps } : null,
  }, deps.recordDeps || {});
  return { handled: true, ...result, ...split };
}

// ── The backstop ───────────────────────────────────────────────────────────

/**
 * Hourly (app/api/cron/card-payments): every portal card intent that
 * succeeded in the last few days and has no Payment row yet is settled here.
 * The case it exists for: 3-D Secure finished in the bank's window, the
 * phone lost signal before the page could ask us to finalize, and the
 * payment_intent.succeeded webhook is not subscribed — a Stripe dashboard
 * setting this code cannot read (see the webhook route's note).
 */
export async function reconcilePortalCardPayments({ sinceSeconds = 3 * 86400 } = {}, deps = {}) {
  const sc = deps.stripe || stripe;
  const prisma = deps.db || db;
  const since = Math.floor(Date.now() / 1000) - sinceSeconds;
  const found = await sc.paymentIntents.search({
    query: `status:'succeeded' AND metadata['fq_flow']:'${PORTAL_CARD_FLOW}' AND created>${since}`,
    limit: 100,
  });
  const tally = { checked: 0, settled: 0, already: 0, errors: 0 };
  for (const intent of found?.data || []) {
    tally.checked += 1;
    const existing = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: intent.id },
      select: { id: true },
    });
    if (existing) {
      tally.already += 1;
      continue;
    }
    try {
      const r = await settleCardPayment(intent.id, { ...deps, db: prisma });
      if (r?.recorded) {
        tally.settled += 1;
        await recordError({
          area: "client_card_payments",
          code: "settled_by_reconciler",
          companyId: intent.metadata?.companyId || null,
          message: `Portal card payment ${intent.id} succeeded but was only recorded by the hourly reconciler — check the payment_intent.succeeded webhook subscription.`,
          detail: { paymentIntentId: intent.id, invoiceId: intent.metadata?.invoiceId || null },
        }).catch(() => {});
      }
    } catch (err) {
      tally.errors += 1;
      console.error("[card-payments] reconcile failed:", intent.id, err?.message);
    }
  }
  return tally;
}
