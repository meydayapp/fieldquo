// lib/voice/autoTopup.js
//
// Buying voice credit without the contractor standing there.
//
// ══ Why this is the most dangerous file in the voice feature ═══════════════
//
// Everything else here spends a PREPAID balance. This spends a card. A bug in
// lib/voice/credits.js costs somebody minutes they already paid for; a bug in
// this file charges a real card, possibly repeatedly, and the person finds out
// from their bank. lib/voice/credits.js opens with a promise — "Nobody is ever
// surprised by an invoice" — and this is the one feature capable of breaking
// it. Everything below is arranged around that.
//
// ══ Which Stripe integration, and why it is not the other one ══════════════
//
// FieldQuo charging a contractor for FieldQuo's own service is BILLING, so the
// Customer is the one lib/platform/stripeBilling.js already keeps for their
// subscription — the same customer the manual top-up checkout puts on its
// session. There is no `transfer_data`, no connected account, no application
// fee. lib/stripe.js warns at the top never to mix a Connect account into a
// Billing call; lib/servicePlans/stripeMandate.js is the CONNECT version of
// this same mandate pattern, one level down (a contractor charging their own
// client), and copying its `transfer_data.destination` into here would route a
// contractor's payment to the contractor's own Stripe account. Same shape,
// opposite direction — read that file for the pattern, not for the parameters.
//
// ══ Every cap, in one place ════════════════════════════════════════════════
//
// A card charged in a loop is the worst outcome available, so the guards are
// deliberately layered and each one would hold alone:
//
//   1. ARMED. Off by default, no threshold, no amount, no card, no consent —
//      four separate nulls, and autoTopupDecision refuses on any of them.
//   2. ONE IN FLIGHT. Claimed by a compare-and-set UPDATE against the exact
//      row state we read, so two serverless invocations cannot both claim.
//   3. IDEMPOTENT AT STRIPE. The claim carries a token; the Stripe call keys
//      on it. A retry that reuses the token gets the SAME PaymentIntent back
//      rather than a second charge — which is why an attempt whose outcome we
//      never learned keeps its token instead of minting a fresh one.
//   4. A GAP. No two attempts within AUTO_TOPUP_MIN_GAP_MINUTES.
//   5. A DAILY CAP, on both the count and the total, from the terms they read.
//   6. A DECLINE STOPS EVERYTHING. Not a retry, not a backoff — off, and an
//      email. Retrying a declined card is how an account lands in a bank's
//      fraud rules, and the second attempt is the one that gets the card
//      blocked for everything else the contractor uses it for.
//   7. THREE UNREACHABLE-STRIPE FAILURES also switch it off, because a fault
//      we cannot diagnose must not be retried indefinitely against a card.
//   8. ONE LEDGER REF. Automatic and manual top-ups settle through the same
//      function in lib/voice/topup.js, keyed on the payment intent, so the two
//      cannot credit the same payment between them.
//
// The decision itself — the balance comparison and the caps — lives in
// lib/voice/credits.js as a pure function, because every judgement about a
// balance lives there or in spendGate.js and check:voice-spend fails the build
// if a third opinion appears. It is also the only way the caps get exercised:
// nobody runs a runaway by hand.
//
// ══ Cards only ═════════════════════════════════════════════════════════════
//
// lib/servicePlans/stripeMandate.js also authorises Canadian pre-authorized
// debit. This does not, and that is a product decision rather than an
// omission: a PAD debit settles in about five business days. A top-up that
// lands next week is not a top-up — it is a phone that stopped answering on
// Tuesday. The whole point of the feature is that the balance never reaches
// zero, and only a card can do that.

import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/platform/stripeBilling";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { buildPlatformNotice } from "@/lib/email/billingEmail";
import { ownerEmailFor } from "@/lib/email/companySender";
import { recordError } from "@/lib/platform/errorLog";
import { recordActivity } from "@/lib/activity/log";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import {
  balanceFor,
  autoTopupDecision,
  utcDayKey,
  normaliseAutoTopupThreshold,
  normaliseAutoTopupAmount,
  AUTO_TOPUP_MAX_PER_DAY,
  AUTO_TOPUP_STALE_CLAIM_MINUTES,
} from "@/lib/voice/credits";
import { creditVoiceAutoTopup } from "@/lib/voice/topup";
import { buildAutoTopupTerms } from "@/lib/voice/autoTopupConsent";

/**
 * How many times Stripe can be unreachable before we stop trying.
 *
 * Three, and they are three attempts fifteen minutes apart at the closest — see
 * the gap in autoTopupDecision. A single blip must not switch a contractor's
 * feature off; a fault that persists across three attempts is not a blip, and
 * continuing to fire a card at an integration we cannot reason about is worse
 * than stopping and saying so.
 *
 * A DECLINE never reaches this counter. A decline is definite, and definite
 * means stop now.
 */
export const AUTO_TOPUP_MAX_CONSECUTIVE_FAILURES = 3;

/**
 * The daily ceiling on MONEY, derived from the amount they chose. Stated in the
 * terms, frozen at consent, re-checked before every charge.
 *
 * Today it equals amount × the count cap, so it can look redundant. It is not:
 * the count cap is computed live from the current row, and this one is frozen
 * at the moment somebody read a sentence naming a figure. If the amount is ever
 * changed by a path that skips re-consent, the count cap moves with it and this
 * does not — a charge above what was actually agreed is refused by
 * autoTopupDecision rather than taken.
 */
export function dailyCeilingFor(amountCents) {
  return Math.round(Number(amountCents) || 0) * AUTO_TOPUP_MAX_PER_DAY;
}

/** The row, or null. Null means never set up — not "off", which is a row. */
export function autoTopupFor(companyId, prisma = db) {
  if (!companyId) return Promise.resolve(null);
  return prisma.voiceAutoTopup.findUnique({ where: { companyId } });
}

/**
 * Is there a usable card and consent on file?
 *
 * Separate from `enabled` on purpose: a contractor who switches the feature off
 * still has their card saved, and switching it back on must not send them
 * through Stripe again. The settings screen needs to tell those two states
 * apart to know which button to show.
 */
export function hasMandate(config) {
  return Boolean(
    config?.stripeCustomerId &&
      config?.stripePaymentMethodId &&
      config?.paymentMethodType &&
      config?.acceptedAt &&
      config?.termsText,
  );
}

/**
 * Do the settings on the row match what the recorded terms actually said?
 *
 * The terms name the threshold and the amount. Editing either without ticking
 * the box again would leave a signed statement describing a different
 * arrangement from the live one — so this is what the settings route uses to
 * decide whether a change needs re-consent, and what the screen uses to explain
 * why it is asking again.
 */
export function consentMatchesSettings(config) {
  if (!hasMandate(config)) return false;
  const authorised = Math.round(Number(config.authorisedAmountCents) || 0);
  const amount = Math.round(Number(config.amountCents) || 0);
  return authorised > 0 && authorised === amount;
}

/**
 * What the settings screen is allowed to see.
 *
 * No customer id, no payment method id, no setup intent — a browser has no use
 * for any of them, and they are the identifiers a leaked bundle would be most
 * worth having. The brand and last four are what a person needs to recognise
 * their own card.
 *
 * Lives here rather than in the route because a Next route file may only export
 * HTTP methods, and because the platform console reads the same shape.
 */
export function publicAutoTopup(config) {
  if (!config) return null;
  return {
    enabled: Boolean(config.enabled),
    hasCard: hasMandate(config),
    // Whether the terms on file still describe the settings on file. False
    // means the amount was changed and the box has to be ticked again — which
    // the screen has to be able to say, or the refusal reads as a bug.
    consentCurrent: consentMatchesSettings(config),
    thresholdCents: config.thresholdCents ?? null,
    amountCents: config.amountCents ?? null,
    cardBrand: config.paymentMethodBrand || null,
    cardLast4: config.paymentMethodLast4 || null,
    acceptedAt: config.acceptedAt || null,
    acceptedByName: config.acceptedByName || null,
    // Why it is off, when WE switched it off. Null when the contractor did it
    // themselves — the two read identically in `enabled` and must not read
    // identically on screen.
    disabledReason: config.enabled ? null : config.disabledReason || null,
    lastFailureMessage: config.enabled ? null : config.lastFailureMessage || null,
    // The cap the screen actually states. `authorisedDailyCents` and
    // `lastChargeAt` are deliberately NOT sent: nothing renders them, and a
    // field written into a payload that no screen reads is the first failure
    // class in AGENTS.md. The daily money ceiling is enforced server-side and
    // stated in the terms; "when did it last top up" is already answerable from
    // the statement, per row, with its amount.
    maxPerDay: AUTO_TOPUP_MAX_PER_DAY,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Consent, then the card
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Record the agreement, BEFORE Stripe is opened.
 *
 * The ordering is the same one lib/servicePlans/authorisation.js explains and
 * it matters for the same reason: somebody who ticks the box and then abandons
 * the card form leaves a row that says "agreed, never finished", which is the
 * truth, and which autoTopupDecision refuses to charge. Doing it the other way
 * round would leave a saved card with no record of what it was saved for.
 *
 * `enabled` is NOT set here. Consent plus a card is what makes the feature
 * chargeable; nothing is armed until the setup session actually completes.
 */
export async function recordAutoTopupConsent({
  companyId,
  company,
  thresholdCents,
  amountCents,
  member,
  ip,
  userAgent,
  prisma = db,
}) {
  const threshold = normaliseAutoTopupThreshold(thresholdCents);
  const amount = normaliseAutoTopupAmount(amountCents);
  if (threshold === null || amount === null) {
    return { ok: false, reason: "bad_choice" };
  }

  const dailyCents = dailyCeilingFor(amount);
  const terms = buildAutoTopupTerms({
    thresholdCents: threshold,
    amountCents: amount,
    maxPerDay: AUTO_TOPUP_MAX_PER_DAY,
    dailyCents,
    currency: CREDIT_CURRENCY,
    companyName: company?.name || "",
    language: company?.defaultLanguage || "en",
  });

  const consent = {
    thresholdCents: threshold,
    amountCents: amount,
    acceptedAt: new Date(),
    acceptedIp: ip || null,
    acceptedAgent: userAgent ? String(userAgent).slice(0, 300) : null,
    acceptedByMemberId: member?.id || null,
    acceptedByName: member?.name || member?.user?.name || null,
    termsText: terms.text,
    termsLanguage: terms.language,
    authorisedAmountCents: amount,
    authorisedDailyCents: dailyCents,
    // A fresh agreement clears the old failures. Someone who has just re-read
    // the terms and re-entered a card is not three failures deep — carrying the
    // counter over would switch them off again on the first blip.
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastFailureCode: null,
    lastFailureMessage: null,
    disabledAt: null,
    disabledReason: null,
    notifiedAt: null,
  };

  const row = await prisma.voiceAutoTopup.upsert({
    where: { companyId },
    create: { companyId, ...consent },
    update: consent,
  });

  return { ok: true, config: row, terms };
}

/**
 * A Stripe-hosted setup flow that saves the card with a proper mandate.
 * `mode: "setup"` — no money moves here.
 *
 * The four consent statements Stripe requires are NOT rendered by this page.
 * They were shown on our own settings screen and the owner ticked them before
 * this session was ever created — see lib/voice/autoTopupConsent.js and the
 * acceptedAt column above.
 */
export async function createAutoTopupSetupSession({ company, successUrl, cancelUrl }) {
  const customerId = await getOrCreateStripeCustomer(company);

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    // Cards only — see the header. Naming it explicitly rather than letting
    // Stripe pick from the account's enabled methods, because the account also
    // has pre-authorized debit on for the service-plan flow and a five-day
    // settlement is not a top-up.
    payment_method_types: ["card"],
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Read back by the return redirect and by the webhook, either of which may
    // arrive first. Both converge on the same upsert.
    metadata: { companyId: company.id, kind: "voice_auto_topup" },
    setup_intent_data: {
      metadata: { companyId: company.id, kind: "voice_auto_topup" },
      // The whole point of this session. Spelled out rather than left to the
      // default, because a future edit narrowing it to on_session would break
      // every charge silently — which is exactly how the service-plan file
      // words it, and for the same reason.
      usage: "off_session",
    },
  });

  return { sessionId: session.id, url: session.url, customerId };
}

/**
 * Pull the payment method off a completed setup session and arm the feature.
 *
 * Two callers reach this: the return redirect and the `checkout.session.
 * completed` webhook. Either can be first, both write the same row, and the
 * second is a no-op. Same arrangement as lib/servicePlans/authorisation.js —
 * and the same reason: a redirect is not a receipt.
 *
 * @returns { ok, reason?, config? }
 */
export async function recordAutoTopupMandate(companyId, sessionId, { prisma = db } = {}) {
  const pending = await prisma.voiceAutoTopup.findUnique({ where: { companyId } });
  // No consent row means nobody ticked the box. A saved card with no record of
  // what it was saved for is not a mandate, and writing one here would create
  // authority out of a query string.
  if (!pending?.acceptedAt || !pending?.termsText) {
    return { ok: false, reason: "no_consent_recorded" };
  }
  if (pending.stripePaymentMethodId && pending.enabled) {
    return { ok: true, reason: "already_recorded", config: pending };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["setup_intent"],
  });
  if (session.status !== "complete") return { ok: false, reason: "setup_incomplete" };

  // The session must be THIS company's. Both callers hold a session id supplied
  // from outside — the webhook from Stripe with a verified signature, the
  // return leg from a query string with nothing at all. Without this, anyone
  // could post a session id and attach a stranger's card to their account.
  if (session.metadata?.companyId !== companyId) {
    return { ok: false, reason: "session_mismatch" };
  }

  const setupIntent =
    typeof session.setup_intent === "string"
      ? await stripe.setupIntents.retrieve(session.setup_intent)
      : session.setup_intent;
  if (!setupIntent || setupIntent.status !== "succeeded") {
    return { ok: false, reason: "setup_incomplete" };
  }

  const pmId =
    typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id || null;
  if (!pmId) return { ok: false, reason: "no_payment_method" };

  const paymentMethod = await stripe.paymentMethods.retrieve(pmId);

  const config = await prisma.voiceAutoTopup.update({
    where: { companyId },
    data: {
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : session.customer?.id,
      stripeSetupIntentId: setupIntent.id,
      stripePaymentMethodId: pmId,
      // Multi-use mandate. Cards usually don't produce one and null is correct
      // there rather than missing — the PaymentIntent simply omits the field.
      stripeMandateId:
        typeof setupIntent.mandate === "string"
          ? setupIntent.mandate
          : setupIntent.mandate?.id || null,
      paymentMethodType: paymentMethod.type,
      paymentMethodBrand: paymentMethod.card?.brand || null,
      paymentMethodLast4: paymentMethod.card?.last4 || null,
      // Armed. This is the ONE place `enabled` becomes true off the back of a
      // card being saved, and it is downstream of a consent row that already
      // existed — so there is no path from "saved a card" to "chargeable"
      // that skips the terms.
      enabled: true,
      disabledAt: null,
      disabledReason: null,
    },
  });

  return { ok: true, config };
}

// ═══════════════════════════════════════════════════════════════════════════
// The charge
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Charge the saved card, if every guard says so.
 *
 * @returns { charged, reason, cents?, balance?, paymentIntentId? }
 *          `charged: false` with a reason is the ordinary outcome — most calls
 *          to this function do nothing, which is the design.
 *
 * Never throws. Every caller is on a path that has already done the thing the
 * user asked for (a call was billed, a cron tick), and a Stripe problem must not
 * fail it.
 */
export async function runAutoTopup(companyId, { now = new Date(), deps = {} } = {}) {
  const prisma = deps.db || db;
  const stripeClient = deps.stripe || stripe;
  const readBalance = deps.balanceFor || balanceFor;
  const settle = deps.creditVoiceAutoTopup || creditVoiceAutoTopup;
  const notify = deps.notifyAutoTopupStopped || notifyAutoTopupStopped;
  const logActivity = deps.recordActivity || recordActivity;
  const logError = deps.recordError || recordError;

  try {
    const config = await prisma.voiceAutoTopup.findUnique({ where: { companyId } });
    if (!config) return { charged: false, reason: "not_configured" };

    const decision = autoTopupDecision({
      config,
      balanceCents: await readBalance(companyId),
      now,
    });
    if (!decision.charge) return { charged: false, reason: decision.reason };

    // ── Claim it, by compare-and-set ──────────────────────────────────────
    //
    // The `where` names the exact value we read, so a second invocation that
    // read the same row and got here first has already changed it and this
    // update matches nothing. A read-then-write would let both through, which
    // on this feature means two charges.
    //
    // The token survives an attempt whose outcome we never learned — see
    // releaseClaim. Reusing it means the Stripe idempotency key is the same
    // key, so a retry after a dropped connection returns the ORIGINAL
    // PaymentIntent instead of taking a second payment. Minting a fresh token
    // there is the single change that would turn this file into a
    // double-charge.
    const token = config.chargeAttemptToken || randomUUID();
    const claim = await prisma.voiceAutoTopup.updateMany({
      where: { companyId, chargeInFlightAt: config.chargeInFlightAt ?? null },
      data: { chargeInFlightAt: now, chargeAttemptToken: token },
    });
    if (claim.count !== 1) return { charged: false, reason: "in_flight" };

    const cents = decision.cents;
    let intent;
    try {
      intent = await stripeClient.paymentIntents.create(
        {
          amount: cents,
          // The ledger is USD and both providers bill FieldQuo in USD, so the
          // manual checkout hardcodes it too. Deliberately NOT
          // stripeCurrency(company.currency) — see lib/voice/creditCurrency.js
          // for why that is a pricing decision rather than a bug.
          currency: CREDIT_CURRENCY.toLowerCase(),
          customer: config.stripeCustomerId,
          payment_method: config.stripePaymentMethodId,
          // Pinned to the method actually authorised. Leaving this to automatic
          // payment methods would let an off-session confirm pick something the
          // terms do not cover.
          payment_method_types: [config.paymentMethodType],
          ...(config.stripeMandateId ? { mandate: config.stripeMandateId } : {}),
          off_session: true,
          confirm: true,
          description: `FieldQuo phone credit — automatic top-up`,
          // `kind: "voice_topup"` is what lib/stripe/settleCheckoutSession.js
          // and the billing webhook recognise. `auto` distinguishes the two for
          // the statement line without making them different money.
          metadata: {
            companyId,
            kind: "voice_topup",
            auto: "true",
            cents: String(cents),
          },
        },
        { idempotencyKey: `voice_auto_topup:${companyId}:${token}` },
      );
    } catch (err) {
      const verdict = classifyChargeFailure(err);
      await recordFailure({
        companyId,
        config,
        token,
        verdict,
        now,
        prisma,
        notify,
        logActivity,
        logError,
      });
      return { charged: false, reason: verdict.definite ? "declined" : "stripe_unreachable" };
    }

    if (intent.status !== "succeeded") {
      // `requires_action` is the important one: the bank wants the cardholder
      // to authenticate and there is nobody here to do it. That is not a retry
      // — it is a payment that can only be finished on-session, which is what
      // the manual top-up buttons already are.
      const verdict = {
        definite: true,
        code: intent.status,
        message:
          intent.last_payment_error?.message ||
          (intent.status === "requires_action"
            ? "Your bank asked for confirmation, and there was nobody there to give it."
            : `The payment ended as ${intent.status}.`),
      };
      await recordFailure({
        companyId,
        config,
        token,
        verdict,
        now,
        prisma,
        notify,
        logActivity,
        logError,
      });
      return { charged: false, reason: "declined" };
    }

    // ── Settled through the SAME function a manual top-up uses ─────────────
    //
    // Keyed on the payment intent, so this and a manual top-up cannot credit
    // one payment between them however the events arrive.
    const result = await settle(intent);

    const today = utcDayKey(now);
    const priorCount = config.dayKey === today ? Math.max(0, Number(config.chargesToday) || 0) : 0;
    const priorSpend =
      config.dayKey === today ? Math.max(0, Number(config.spentTodayCents) || 0) : 0;

    await prisma.voiceAutoTopup.update({
      where: { companyId },
      data: {
        chargeInFlightAt: null,
        // A definite outcome, so the token is spent. The next attempt mints a
        // new one, which is what makes it a new payment rather than a replay.
        chargeAttemptToken: null,
        lastChargeAt: now,
        dayKey: today,
        chargesToday: priorCount + 1,
        spentTodayCents: priorSpend + cents,
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureCode: null,
        lastFailureMessage: null,
      },
    });

    await logActivity(
      { companyId },
      {
        action: "voice.auto_topup.charged",
        entityType: "settings",
        actorName: "Automatic top-up",
        summary: `Charged the card on file $${(cents / 100).toFixed(2)} for phone credit`,
        metadata: { cents, paymentIntentId: intent.id },
      },
    ).catch(() => {});

    return {
      charged: true,
      reason: "ok",
      cents,
      paymentIntentId: intent.id,
      balance: result?.balance ?? null,
      alreadyCredited: Boolean(result?.alreadyCredited),
    };
  } catch (err) {
    // The claim may be held. It expires on its own after
    // AUTO_TOPUP_STALE_CLAIM_MINUTES and the reclaim reuses the token, so the
    // worst case of failing here is a quarter of an hour of not topping up —
    // never a double charge.
    await logError({
      area: "voice-auto-topup",
      message: `Automatic top-up failed: ${err?.message}`,
      companyId,
      detail: { staleClaimClearsAfterMinutes: AUTO_TOPUP_STALE_CLAIM_MINUTES },
    }).catch(() => {});
    return { charged: false, reason: "error" };
  }
}

/**
 * Was that a "no" from the bank, or a "we never got through"?
 *
 * The distinction decides whether the feature stops immediately or tolerates a
 * blip, and getting it backwards is expensive in both directions: treating a
 * decline as transient retries a card the bank has already refused, and
 * treating a network fault as a decline switches a paying customer off because
 * Stripe had a bad minute.
 *
 * Definite means the card was reached and the answer was no. Everything else —
 * a connection error, a rate limit, a 500 — is unknown, and unknown is not a
 * decline. Unknown also means the money MAY have moved, which is why the
 * attempt token is kept: the retry replays the same idempotency key rather
 * than starting a second payment.
 */
export function classifyChargeFailure(err) {
  const type = err?.type || "";
  const code = err?.code || err?.decline_code || type || "stripe_error";
  const definite =
    type === "StripeCardError" ||
    type === "StripeInvalidRequestError" ||
    err?.statusCode === 402 ||
    [
      "card_declined",
      "expired_card",
      "incorrect_cvc",
      "insufficient_funds",
      "authentication_required",
      "payment_method_not_available",
      "resource_missing",
    ].includes(err?.code);

  return {
    definite,
    code,
    message: err?.message || "The payment could not be taken.",
  };
}

/**
 * Write down what went wrong, and stop if we have to.
 *
 * A definite failure switches auto top-up off on the spot. A transient one
 * counts, and the third one switches it off too — a fault we cannot diagnose
 * must not keep firing a card indefinitely.
 *
 * In both cases the claim is released and, when the outcome is UNKNOWN, the
 * token is kept so the next attempt replays rather than re-charges.
 */
async function recordFailure({
  companyId,
  config,
  token,
  verdict,
  now,
  prisma,
  notify,
  logActivity,
  logError,
}) {
  // Counted either way, so the row records what happened. Only the STOPPING
  // rule differs: a definite failure stops on the first one regardless of the
  // count, and the count is what stops the transient ones.
  const failures = Math.max(0, Number(config.consecutiveFailures) || 0) + 1;
  const stop = verdict.definite || failures >= AUTO_TOPUP_MAX_CONSECUTIVE_FAILURES;

  await prisma.voiceAutoTopup.update({
    where: { companyId },
    data: {
      chargeInFlightAt: null,
      // Definite: the payment is settled as "no", so the token is spent.
      // Unknown: keep it, because the money may have moved and the next attempt
      // must be the same payment rather than a second one.
      // `token`, NOT config.chargeAttemptToken: `config` was read before the
      // claim was made, so on a first attempt its token is still null. Writing
      // that back would throw away the key the retry has to replay, and the
      // retry would then mint a fresh one — which is the exact edit that turns
      // an unknown outcome into a second charge.
      chargeAttemptToken: verdict.definite ? null : token || null,
      consecutiveFailures: failures,
      lastFailureAt: now,
      lastFailureCode: String(verdict.code).slice(0, 80),
      lastFailureMessage: String(verdict.message).slice(0, 400),
      ...(stop
        ? {
            enabled: false,
            disabledAt: now,
            disabledReason: verdict.definite ? "declined" : "stripe_unreachable",
          }
        : {}),
    },
  });

  await logError({
    area: "voice-auto-topup",
    message: `Automatic top-up ${verdict.definite ? "declined" : "could not be attempted"}: ${verdict.message}`,
    companyId,
    detail: { code: verdict.code, consecutiveFailures: failures, switchedOff: stop },
  }).catch(() => {});

  if (!stop) return;

  await logActivity(
    { companyId },
    {
      action: "voice.auto_topup.disabled",
      entityType: "settings",
      actorName: "FieldQuo",
      summary: verdict.definite
        ? "Switched automatic top-up off — the card was declined"
        : "Switched automatic top-up off — we couldn't reach the payment provider",
      metadata: { code: verdict.code },
    },
  ).catch(() => {});

  await notify(companyId, verdict).catch(() => {});
}

/**
 * Tell them, plainly, in the one email family that is NOT white-labelled.
 *
 * FieldQuo is the vendor here and the contractor is the customer, so this looks
 * like FieldQuo — the same reasoning as the rental warnings it shares a builder
 * with. It has to say three things and it says them in this order: it is off,
 * why, and what happens to their phone if they do nothing.
 */
export async function notifyAutoTopupStopped(companyId, verdict, { origin } = {}) {
  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true },
    });
    const to = company?.email || (await ownerEmailFor(companyId));
    if (!to) {
      await recordError({
        area: "voice-auto-topup",
        message: "No address to tell about automatic top-up being switched off",
        companyId,
      });
      return false;
    }

    const base = origin || "https://www.fieldquo.com";
    const declined = verdict?.definite;

    const { subject, html } = buildPlatformNotice({
      heading: declined
        ? "Automatic top-up is off — your card was declined"
        : "Automatic top-up is off — we couldn't take the payment",
      sub: company?.name || "",
      subject: `Automatic phone credit top-up is off — ${company?.name || "FieldQuo"}`,
      paragraphs: [
        declined
          ? "We tried to top up your phone credit automatically and your bank declined the card. We have switched automatic top-up off and we are <strong>not</strong> going to try again — repeatedly retrying a declined card is how a card ends up blocked for everything else."
          : `We tried to top up your phone credit automatically and could not reach our payment provider — ${AUTO_TOPUP_MAX_CONSECUTIVE_FAILURES} times in a row. We have switched automatic top-up off rather than keep trying against a fault we can't see.`,
        "<strong>Nothing has been charged.</strong> Your existing credit is untouched and every call you have already paid for still works.",
        "When your balance runs out the receptionist stops answering that number. Add credit by hand on the settings page, and switch automatic top-up back on there once your card is sorted out.",
      ],
      facts: [
        ["What happened", declined ? "The card was declined" : "We couldn't reach the payment provider"],
        ...(verdict?.message ? [["Reason given", String(verdict.message).slice(0, 200)]] : []),
        ["Automatic top-up", "Off"],
      ],
      cta: { url: `${base}/app/settings/voice#credit`, label: "Open phone settings" },
    });

    const result = await sendEmail({ from: await getPlatformFrom(), to, subject, html });
    await db.voiceAutoTopup
      .update({ where: { companyId }, data: { notifiedAt: new Date() } })
      .catch(() => {});
    return !result?.error && !result?.skipped;
  } catch (err) {
    await recordError({
      area: "voice-auto-topup",
      message: `Couldn't send the automatic top-up notice: ${err?.message}`,
      companyId,
    });
    return false;
  }
}

/**
 * The hot-path wrapper: try, and never let it matter if it fails.
 *
 * Called straight after a call is billed, BEFORE the balance is re-checked and
 * the agent possibly detached — which is the whole point. Topping up an hour
 * later on a cron would still leave the phone silent for the hour, and the hour
 * a contractor's phone is silent is the hour the feature was bought to prevent.
 */
export async function maybeAutoTopup(companyId, opts = {}) {
  return runAutoTopup(companyId, opts).catch(() => ({ charged: false, reason: "error" }));
}
