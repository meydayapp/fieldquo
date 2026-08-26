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

import { settleBookingFee } from "@/lib/booking/settleBookingFee";
import { recordStripePayment } from "@/lib/invoices/recordStripePayment";
import { recordAuthorisationFromSession } from "@/lib/servicePlans/authorisation";
import { creditVoiceTopup } from "@/lib/voice/topup";
import { recordAutoTopupMandate } from "@/lib/voice/autoTopup";
import { db } from "@/lib/db";

/**
 * @param session  a Stripe Checkout Session object
 * @returns {Promise<{handled: boolean, kind: string, result?: object}>}
 *          handled:false means "not one of ours" — the caller decides what next.
 */
export async function settleCheckoutSession(session) {
  const { invoiceId, bookingId, servicePlanId, kind } = session?.metadata || {};

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
    const result = await settleBookingFee(bookingId, {
      amountCents: session.amount_total,
      currency: session.currency || null,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null,
      checkoutSessionId: session.id,
    });
    return { handled: true, kind: "booking_fee", result };
  }

  // ── An invoice payment ────────────────────────────────────────────────────
  //
  // Synchronous methods (card) are already `paid` at completion. An asynchronous
  // one settles later via async_payment_succeeded — recording it now would mark
  // an unsettled invoice paid.
  if (invoiceId) {
    if (session.payment_status !== "paid") {
      return { handled: true, kind: "invoice_payment", result: { recorded: false, reason: "not_paid_yet" } };
    }
    const result = await recordStripePayment(db, {
      invoiceId,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null,
      amountCents: session.amount_total || 0,
    });
    return { handled: true, kind: "invoice_payment", result };
  }

  return { handled: false, kind: "unknown" };
}
