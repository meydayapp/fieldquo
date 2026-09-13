// lib/stripe/settleCheckoutSession.js
//
// What a completed Stripe Checkout Session PAYS FOR, and what to do about it.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// FieldQuo has two Stripe webhook routes and, for a long time, an assumption
// about them that was simply false:
//
//   /api/stripe/webhook          — "Connect: companies getting paid by clients"
//   /api/platform/billing/webhook — "Billing: FieldQuo charging companies"
//
// The comment on the first one said the two must never be combined. The problem
// is that the split it describes is a split by *business meaning*, and Stripe
// does not deliver events by business meaning. It delivers them by which ACCOUNT
// the object was created on:
//
//   • a Connect webhook endpoint receives events from CONNECTED ACCOUNTS,
//   • a normal endpoint receives events from the PLATFORM account.
//
// Every client-facing payment FieldQuo takes — a booking visit fee, an invoice
// payment, a voice top-up — is a DESTINATION CHARGE. Look at lib/stripe.js:
// `{ stripeAccount: undefined }`, with `transfer_data.destination` pointing at
// the company. The charge is created on the PLATFORM and the money is
// transferred onward. Which means the `checkout.session.completed` event is a
// PLATFORM event, and a Connect endpoint never sees it.
//
// So the booking-fee handler sat on the one endpoint that could not, by
// construction, ever be handed a booking fee. The event went to the Billing
// endpoint instead, which tried to read it as a subscription, found no planId,
// logged "a payment may have succeeded with no Subscription row" and returned
// 200. Five bookings held slots for money the app had no record of.
//
// The env var name is part of how this happened: STRIPE_CONNECT_WEBHOOK_SECRET
// is named for FieldQuo's Connect *integration*, not for connected-account
// *events*. Reading it as the latter is what makes a dashboard endpoint get
// registered as a Connect endpoint.
//
// ══ The fix ════════════════════════════════════════════════════════════════
//
// Stop depending on which endpoint an event lands at. Both routes hand every
// completed session to this dispatcher first; it routes on metadata, which is
// written at creation and travels with the session no matter what. Only a
// session this cannot place falls through to the subscription handler.
//
// That is deliberately belt-and-braces. Whether an endpoint is registered as
// Connect or platform is a Stripe dashboard setting we cannot read from code,
// and a payment that goes unrecorded because of a checkbox is the exact
// silent-money-bug this codebase keeps being swept for. Handling it wherever it
// arrives costs one metadata lookup.
//
// Every branch is idempotent, because with two endpoints live the same session
// can legitimately be dispatched twice.

import { settleBookingFee, bookingPaymentFromSession } from "@/lib/booking/settleBookingFee";
import { recordStripePayment } from "@/lib/invoices/recordStripePayment";
import { recordAuthorisationFromSession } from "@/lib/servicePlans/authorisation";
import { creditVoiceTopup } from "@/lib/voice/topup";
import { recordAutoTopupMandate } from "@/lib/voice/autoTopup";
import { creditAiTopup } from "@/lib/ai/topup";
import { settleAiBundleCheckoutSession } from "@/lib/ai/creditBundle";
import { settleMigrationPayment } from "@/lib/migrations/payment";
import { settledFeeOrNull } from "@/lib/stripe/paymentIntentFee";
import { latestInFamily } from "@/lib/invoices/family";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

// The PaymentIntent a paid session settled through — Stripe sends it as an id
// unless the caller expanded it.
function intentOf(session) {
  return typeof session?.payment_intent === "string"
    ? session.payment_intent
    : session?.payment_intent?.id || null;
}

/**
 * @param session  a Stripe Checkout Session object
 * @returns {Promise<{handled: boolean, kind: string, result?: object}>}
 *          handled:false means "not one of ours" — the caller decides what next.
 */
export async function settleCheckoutSession(session) {
  const { invoiceId, bookingId, servicePlanId, kind, migrationRequestId } =
    session?.metadata || {};

  // ── A service plan authorisation ──────────────────────────────────────────
  //
  // Setup mode: NO money moved, the client has saved a payment method with a
  // mandate. Checkout reports every finished session as completed and `mode` is
  // the only thing that tells them apart, so this must be tested before
  // anything that assumes a payment. Keyed on planId, so the return redirect
  // and the webhook race harmlessly.
  if (session?.mode === "setup" && servicePlanId) {
    await recordAuthorisationFromSession(servicePlanId, session.id);
    return { handled: true, kind: "service_plan_authorisation" };
  }

  // ── A card saved for automatic voice top-ups ──────────────────────────────
  //
  // Also setup mode, also no money moved, and keyed on its own `kind` because
  // it carries no entity id to recognise it by. The other door is the return
  // redirect at /api/settings/voice/auto-topup; both call the same recorder and
  // whichever is second is a no-op.
  //
  // This one matters more than most: the redirect is what a contractor's
  // browser does after Stripe, and a phone that lost signal in a driveway
  // between the two leaves a card saved at Stripe that FieldQuo has no record
  // of — so the feature reads as "didn't work" and the same card gets saved
  // again. That is the same lesson the voice top-up branch below is written
  // from.
  if (session?.mode === "setup" && kind === "voice_auto_topup") {
    const companyId = session?.metadata?.companyId || null;
    const result = companyId
      ? await recordAutoTopupMandate(companyId, session.id)
      : { ok: false, reason: "no_company" };
    return { handled: true, kind: "voice_auto_topup", result };
  }

  // ── Voice credit ──────────────────────────────────────────────────────────
  //
  // Placed on an explicit `kind` rather than inferred from the absence of the
  // other ids, because a top-up carries no entity of its own to recognise it by.
  //
  // This branch is the whole reason a contractor topping up on their phone and
  // closing the tab now gets their minutes. Until it existed the redirect back
  // to the settings page was the ONLY thing that credited a top-up, and a
  // redirect that never happens leaves a real charge with no ledger row and
  // nothing that ever looks again. Idempotency lives in lib/voice/topup.js — it
  // has to, because this and the redirect both run, seconds apart, in whichever
  // order the network decides.
  if (kind === "voice_topup") {
    const result = await creditVoiceTopup(session);
    return { handled: true, kind: "voice_topup", result };
  }

  // ── AI credit, one-off ──────────────────────────────────────────────────
  //
  // Same shape as voice_topup immediately above, and the same reason it
  // exists: without it, the ONLY door that could ever credit an AI top-up is
  // the browser coming back to the settings page, and a closed tab or a lost
  // connection leaves a real charge with a balance that never moves.
  if (kind === "ai_topup") {
    const result = await creditAiTopup(session);
    return { handled: true, kind: "ai_topup", result };
  }

  // ── An AI credit BUNDLE, subscribed to ────────────────────────────────────
  //
  // `mode: "subscription"`, not "payment" — this is the setup moment for a
  // RECURRING allowance, not itself a purchase. Must be intercepted here and
  // answered `handled: true` regardless of `session` metadata's shape,
  // because leaving it unhandled sends it to
  // syncSubscriptionFromStripeEvent()'s checkout.session.completed branch,
  // which reads `session.metadata.planId` — a bundle session has no planId,
  // it has a bundleKey — and throws PermanentWebhookFailure for every single
  // AI bundle subscribed to, logging a false "payment may have succeeded
  // with no Subscription row" into /platform/errors for money that in fact
  // settled exactly where it should have.
  //
  // The actual credit GRANT happens off invoice.payment_succeeded (see
  // app/api/platform/billing/webhook/route.js), not here — Checkout's
  // completion and the first invoice being paid are usually the same instant
  // for a card, but "usually" is not "always", so settleAiBundleCheckoutSession
  // only grants when the subscription's latest invoice is already paid, and
  // is a safe no-op otherwise: the invoice webhook grants it moments later,
  // keyed on the identical ref, so neither door can grant twice or grant zero.
  if (session?.mode === "subscription" && kind === "ai_bundle_subscription") {
    const result = await settleAiBundleCheckoutSession(session);
    return { handled: true, kind: "ai_bundle_subscription", result };
  }

  // ── A booking visit fee ───────────────────────────────────────────────────
  if (bookingId) {
    // Only settle what Stripe says is actually paid. A delayed-notification
    // method completes the session `unpaid` and settles minutes later; treating
    // that as paid would put an unpaid visit on the crew's calendar.
    //
    // `payment_status` is the ONLY question. Whether the connected account can
    // PAY OUT is a different one and must never reach this branch: an account
    // in verification still takes cards perfectly well — Stripe holds the money
    // until the review clears. Gating settlement on payouts_enabled would mean
    // a client is charged, gets no receipt, and the visit never lands on the
    // calendar, because of a document the CONTRACTOR owes Stripe. The client
    // paid; they are owed the receipt and the booking either way.
    if (session.payment_status && session.payment_status !== "paid") {
      return { handled: true, kind: "booking_fee", result: { settled: false, reason: "not_paid_yet" } };
    }
    // bookingPaymentFromSession reads the fee off the intent — one retrieve;
    // null when it cannot be read, and the booking still settles with the
    // fee columns empty rather than zero.
    const result = await settleBookingFee(bookingId, await bookingPaymentFromSession(session));
    return { handled: true, kind: "booking_fee", result };
  }

  // ── A data-migration surcharge ────────────────────────────────────────────
  //
  // Keyed on migrationRequestId — an id, not a `kind`, because unlike a
  // top-up this DOES have an entity of its own to recognise it by (same
  // convention invoiceId/bookingId use immediately below). This is the event
  // that opens the sanctioned write path: lib/migrations/payment.js only
  // flips MigrationRequest.status to `paid` once Stripe confirms the money
  // moved, never on the browser reaching a success_url — see that file's
  // header for why crediting on a redirect alone was the bug voice top-ups
  // used to have.
  if (migrationRequestId) {
    const result = await settleMigrationPayment(session);
    return { handled: true, kind: "migration_payment", result };
  }

  // ── An invoice payment ────────────────────────────────────────────────────
  //
  // Synchronous methods (card) are already `paid` at completion. An asynchronous
  // one settles later via async_payment_succeeded — recording it now would mark
  // an unsettled invoice paid.
  if (invoiceId) {
    if (session.payment_status !== "paid") {
      // A bank debit (pre-authorized debit, ACH) completes Checkout UNPAID
      // and clears days later. Say so on the invoice now — "Bank payment
      // pending" — rather than leaving a balance owing that reads as if the
      // client never paid. Idempotent: the same intent id is written on a
      // redelivery. `mode: "payment"` only; a setup session never reaches
      // here, but the guard costs nothing.
      const paymentIntentId = intentOf(session);
      if (session.mode === "payment" && paymentIntentId) {
        await markPendingPayment(db, { invoiceId, session, paymentIntentId });
      }
      return { handled: true, kind: "invoice_payment", result: { recorded: false, reason: "not_paid_yet", pending: Boolean(paymentIntentId) } };
    }
    // The fee is read before the row is written so the Payment carries it
    // from the first delivery; the Affirm true-up (see paymentIntentFee.js)
    // is idempotent per intent, so the second endpoint's delivery of the
    // same session cannot pull the difference twice.
    const paymentIntentId = intentOf(session);
    const fee = paymentIntentId ? await settledFeeOrNull(paymentIntentId) : null;
    const result = await recordStripePayment(db, {
      invoiceId,
      paymentIntentId,
      amountCents: session.amount_total || 0,
      fee,
    });
    // The bank payment that was pending is now the payment above; the
    // pending columns come off so the banner does. Written against the
    // family's latest version, where the pending mark was put.
    await clearPendingPayment(db, { invoiceId, paymentIntentId });
    return { handled: true, kind: "invoice_payment", result };
  }

  return { handled: false, kind: "unknown" };
}

// ── Bank-debit lifecycle on the invoice ─────────────────────────────────────
//
// Three writers, one place. The columns are on the family's LATEST version
// (see lib/invoices/family.js — a session can be minted against v1 and
// resolve after the office amended it to v2), and every write is idempotent
// on the PaymentIntent id, because both webhook endpoints deliver the same
// event.

function methodOfSession(session) {
  const types = Array.isArray(session?.payment_method_types) ? session.payment_method_types : [];
  return types.length === 1 ? types[0] : types[0] || null;
}

async function targetInvoice(prisma, invoiceId) {
  return latestInFamily(prisma, invoiceId, {
    select: { id: true, pendingPaymentIntentId: true },
  });
}

export async function markPendingPayment(prisma, { invoiceId, session, paymentIntentId }) {
  const inv = await targetInvoice(prisma, invoiceId);
  if (!inv) return { marked: false, reason: "invoice_missing" };
  await prisma.invoice.update({
    where: { id: inv.id },
    data: {
      pendingPaymentMethod: methodOfSession(session),
      pendingPaymentIntentId: paymentIntentId,
      pendingPaymentAt: new Date(),
      // A new attempt replaces the record of the last failure.
      pendingPaymentFailedAt: null,
      pendingPaymentFailure: null,
    },
  });
  return { marked: true };
}

export async function clearPendingPayment(prisma, { invoiceId, paymentIntentId }) {
  const inv = await targetInvoice(prisma, invoiceId);
  if (!inv || !inv.pendingPaymentIntentId) return { cleared: false };
  // Only the pending mark THIS intent made. A second bank attempt started
  // after the first cleared must not be wiped by the first's late webhook.
  if (paymentIntentId && inv.pendingPaymentIntentId !== paymentIntentId) return { cleared: false };
  await prisma.invoice.update({
    where: { id: inv.id },
    data: {
      pendingPaymentMethod: null,
      pendingPaymentIntentId: null,
      pendingPaymentAt: null,
      pendingPaymentFailedAt: null,
      pendingPaymentFailure: null,
    },
  });
  return { cleared: true };
}

/**
 * checkout.session.async_payment_failed — the debit bounced. Record why, in
 * Stripe's own words from the PaymentIntent's last_payment_error, so the
 * contractor's screen says "Bank payment failed: insufficient funds" and
 * not merely that a balance is owing. The reason lookup is one retrieve
 * and best-effort: a failed lookup still records the failure.
 *
 * @param deps  `{ stripe, db }` seams for scripts/check-processing-fee.mjs.
 */
export async function failCheckoutSession(session, deps = {}) {
  const prisma = deps.db || db;
  const invoiceId = session?.metadata?.invoiceId;
  const paymentIntentId = intentOf(session);
  if (!invoiceId || !paymentIntentId) return { handled: false, reason: "not_an_invoice" };

  let reason = null;
  try {
    const client = deps.stripe || stripe;
    const intent = await client.paymentIntents.retrieve(paymentIntentId);
    reason = intent?.last_payment_error?.message || intent?.last_payment_error?.code || null;
  } catch (err) {
    console.error("[stripe] failure reason lookup failed:", paymentIntentId, err?.message);
  }

  const inv = await targetInvoice(prisma, invoiceId);
  if (!inv) return { handled: true, recorded: false, reason: "invoice_missing" };
  await prisma.invoice.update({
    where: { id: inv.id },
    data: {
      pendingPaymentMethod: methodOfSession(session),
      pendingPaymentIntentId: paymentIntentId,
      pendingPaymentFailedAt: new Date(),
      pendingPaymentFailure: reason ? String(reason).slice(0, 300) : "declined",
    },
  });
  return { handled: true, recorded: true, failure: reason };
}
