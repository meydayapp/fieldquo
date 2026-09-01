// lib/migrations/payment.js
//
// Paying FieldQuo's migration surcharge — Stripe BILLING, one-time, never
// Connect. Same integration as lib/platform/stripeBilling.js's checkout
// sessions, and the same warning applies: this is FieldQuo charging the
// COMPANY, not the company charging a client, so it always runs on the
// platform Stripe account with no `stripeAccount` override.
//
// `mode: "payment"`, not "subscription" — a migration is a one-off job, priced
// once. Modelled exactly like the voice/AI top-ups
// (app/api/settings/voice/topup/route.js) rather than the invoice/booking
// flows, because it shares their shape: FieldQuo (or the company, in the
// top-up case) sets an amount, Checkout takes a single card payment, and
// there's no ongoing entity Stripe needs to reconcile against beyond this one
// row.
//
// ── Settled through the shared dispatcher, not a bespoke webhook ──────────
//
// lib/stripe/settleCheckoutSession.js already fans every completed session
// out to the right settler by metadata, and both webhook endpoints (the
// Connect one and the Billing one) call it — see that file's header for why
// neither endpoint can assume which kind of session it will be handed. This
// adds one more branch there (keyed on `migrationRequestId`, the same
// convention `invoiceId`/`bookingId` use — an id, not a `kind` string, because
// unlike a top-up this DOES have an entity of its own to recognise it by) so
// a migration payment settles wherever Stripe happens to deliver the event.
//
// settleMigrationPayment() below is also called directly from the return-trip
// GET route, same "two doors, one settlement" pattern as creditVoiceTopup —
// a closed tab or a dropped connection between Stripe and the redirect must
// not leave a real charge with no paidAt.
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { stripeCurrency } from "@/lib/currency";
import { getOrCreateStripeCustomer } from "@/lib/platform/stripeBilling";
import { canPay } from "@/lib/migrations/state";

/**
 * @param request  the incoming Next.js request, only used for getAppOrigin's
 *                 header reads via the caller — this stays framework-agnostic
 *                 and takes the resolved origin string instead.
 */
export async function createMigrationCheckoutSession({
  migrationRequest,
  company,
  origin,
}) {
  if (!canPay(migrationRequest.status)) {
    const err = new Error(
      migrationRequest.status === "paid" || migrationRequest.status === "in_progress" || migrationRequest.status === "completed"
        ? "This migration has already been paid for."
        : "This migration needs to be accepted before it can be paid for.",
    );
    err.status = 409;
    throw err;
  }
  if (!Number.isFinite(migrationRequest.priceCents) || migrationRequest.priceCents <= 0) {
    // Defensive — canPay() already implies quotedAt/priceCents were set to
    // reach `accepted`, but a price is money and this is the one function
    // that turns it into a real charge, so it re-checks rather than trusting
    // the state machine alone.
    const err = new Error("This migration has no price set.");
    err.status = 409;
    throw err;
  }

  const customerId = await getOrCreateStripeCustomer(company);
  const currency = stripeCurrency(migrationRequest.currency || company.currency);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: "FieldQuo — Data migration",
            description:
              migrationRequest.quoteNote ||
              "Bringing your existing records into FieldQuo.",
          },
          unit_amount: migrationRequest.priceCents,
        },
        quantity: 1,
      },
    ],
    // migrationRequestId is what settleCheckoutSession.js dispatches on, and
    // what the return-trip GET route checks before crediting anything — see
    // both files for why an id in metadata, rather than trust in the browser,
    // is what actually moves the state machine to `paid`.
    metadata: { companyId: company.id, migrationRequestId: migrationRequest.id },
    success_url: `${origin}/app/settings/migration?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/app/settings/migration`,
  });

  return session;
}

/**
 * Marks a MigrationRequest paid from a completed Stripe Checkout Session.
 * Idempotent — safe to call from both the webhook and the return-trip
 * reconcile route, whichever gets there first.
 *
 * @returns {Promise<{settled: boolean, reason?: string, migrationRequestId?: string}>}
 */
export async function settleMigrationPayment(session) {
  const migrationRequestId = session?.metadata?.migrationRequestId;
  if (!migrationRequestId) return { settled: false, reason: "no_migration_id" };

  if (session.payment_status && session.payment_status !== "paid") {
    // A delayed-notification method (e.g. a bank redirect) completes the
    // session before the money has actually settled — same guard the
    // booking-fee and invoice-payment branches use. The async event, or a
    // later reconcile, will pick this up once it really is paid.
    return { settled: false, reason: "not_paid_yet" };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // Idempotent update: only writes when the row is still in a pre-paid state.
  // A second webhook delivery (or the return-trip door landing after the
  // webhook already did) finds zero rows matched and reports settled:false
  // rather than re-writing paidAt or double-logging anything — there is
  // nothing to log twice, since no PlatformAuditLog/MigrationWrite row is
  // created by payment itself (see lib/migrations/writes.js for where writes
  // are actually logged, which only ever happens after this).
  const result = await db.migrationRequest.updateMany({
    where: { id: migrationRequestId, status: "accepted" },
    data: {
      status: "paid",
      paidAt: new Date(),
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
    },
  });

  if (result.count === 0) {
    return { settled: false, reason: "already_settled_or_not_acceptable", migrationRequestId };
  }

  return { settled: true, migrationRequestId };
}
