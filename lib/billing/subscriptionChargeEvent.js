// lib/billing/subscriptionChargeEvent.js
//
// The OTHER half of charge.refunded and charge.dispute.* — the half where the
// money was FieldQuo's own.
//
// ══ The gap this closes ════════════════════════════════════════════════════
//
// lib/stripe/settleChargeEvent.js has always received all four events and
// handed them to recordStripeRefund / recordStripeDispute, which only
// recognise a refund landing on an Invoice `Payment` row — a CONNECT-side
// charge, a homeowner paying a contractor. A FieldQuo SUBSCRIPTION invoice has
// no Payment row at all, so every refund and every chargeback on a
// contractor's own subscription took the "not one of ours" branch and did
// nothing. A customer could charge back their subscription and the product
// would never know.
//
// This is a SECOND recognition, not a reroute. The Connect path runs first and
// unchanged; this one only ever sees charges it already declined, and the "not
// one of ours" contract still holds for charges that are genuinely neither.
//
// ══ How a charge is recognised, and why it is not "match the customer" ═════
//
// Matching on `charge.customer` alone would be wrong, and expensively so. Every
// one of these puts the SAME Stripe customer on a charge, because they all go
// through getOrCreateStripeCustomer():
//
//   - the company's plan subscription      (what this file is for)
//   - a voice top-up                       (lib/voice/topup.js)
//   - an unattended auto top-up            (lib/voice/autoTopup.js)
//   - an AI credit top-up                  (lib/ai/topup.js)
//   - a paid data migration                (lib/migrations/payment.js)
//   - an AI credit BUNDLE subscription     (lib/ai/creditBundle.js)
//
// The first five are separated by one fact: only an invoice-generated charge
// carries `charge.invoice`. Every top-up and the migration are `mode:
// "payment"` one-offs, so their charges carry no invoice and are declined here.
//
// The sixth is not, and it is the trap. An AI credit bundle is a real
// `mode: "subscription"` on the same customer, so its renewal charge carries an
// invoice too. app/api/platform/billing/webhook/route.js already documents this
// exact collision for invoice.payment_succeeded — a bundle invoice read as the
// plan renewing fed a $30 card into the referral-credit calculation. The same
// collision exists here, so the same answer applies: check the bundle table
// FIRST, and never write a bundle's chargeback onto the plan's row.
//
// Resolving which subscription an invoice belongs to costs one Stripe read
// (a Charge carries an invoice id, never a subscription id), so it is only
// performed when the company actually HAS a bundle. For the overwhelming
// majority of companies, which have none, the customer match is unambiguous
// and this file makes no network call at all.
//
// ══ Absolute values, and Stripe's own clock ════════════════════════════════
//
// `charge.amount_refunded` is already the CUMULATIVE total refunded on that
// charge, so writing it as an absolute value — never an increment — is what
// makes a replayed webhook a genuine no-op instead of a double deduction. That
// is recordStripeRefund.js's reasoning and it is unchanged here.
//
// Every timestamp comes from Stripe's own object: the refund's `created`, the
// dispute's `created`, the event's `created` as the last resort. Never
// `new Date()` — lib/platform/stripeBilling.js's canceledAt handling makes the
// same choice deliberately, so a redelivery months later cannot move when
// something happened. A charge event carrying no usable Stripe timestamp is
// REFUSED rather than stamped with now.
//
// ══ What Subscription.refundedAmountCents actually means ═══════════════════
//
// It is the refunded total of the most recently refunded subscription charge,
// not a lifetime total across every charge this company ever made. That
// follows directly from writing Stripe's cumulative per-charge figure
// absolutely, which is the property worth having. A lifetime total would need
// a per-charge ledger row, which does not exist; inventing one by incrementing
// would trade a correct number for a number that drifts on every redelivery.
// `refundedAt` says which charge the figure belongs to.

import { recordError } from "@/lib/platform/errorLog";
import { stripe as platformStripe } from "@/lib/stripe";

export const DISPUTE_EVENT_TYPES = new Set([
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
]);

// Stripe's own terminal dispute outcomes. Kept as a set of Stripe's strings
// rather than a boolean: "warning_needs_response" and "lost" are different
// facts, and only these two mean the card network has finished deciding.
export const TERMINAL_DISPUTE_STATUSES = new Set(["won", "lost"]);

/** Stripe hands back either an id or an expanded object. */
export function idOf(value) {
  if (typeof value === "string") return value || null;
  return value?.id || null;
}

/**
 * The subscription an invoice belongs to, across both shapes of the Invoice
 * object. `invoice.subscription` is what the pinned API version (2025-01-27)
 * returns and what lib/ai/creditBundle.js already reads; the nested form is
 * where Stripe moved it later, and reading both means a version bump does not
 * silently turn every bundle chargeback into a plan chargeback.
 */
export function invoiceSubscriptionId(invoice) {
  return (
    idOf(invoice?.subscription) ||
    idOf(invoice?.parent?.subscription_details?.subscription) ||
    null
  );
}

/**
 * The moment Stripe says the money went back out.
 *
 * The LATEST refund on the charge, because `amount_refunded` is cumulative
 * across all of them — pairing the cumulative figure with the first refund's
 * date would date a $200 total to the day $50 of it was returned.
 *
 * @returns {Date|null} null when Stripe gave us nothing usable, which is a
 *   refusal to write rather than a licence to use `new Date()`.
 */
export function refundedAtFrom(charge, eventCreatedUnix) {
  const refunds = Array.isArray(charge?.refunds?.data) ? charge.refunds.data : [];
  const stamps = refunds
    .map((r) => Number(r?.created))
    .filter((n) => Number.isFinite(n) && n > 0);
  const unix = stamps.length ? Math.max(...stamps) : Number(eventCreatedUnix);
  if (!Number.isFinite(unix) || unix <= 0) return null;
  return new Date(unix * 1000);
}

/** The moment the dispute was opened, from the Dispute object's own clock. */
export function disputeOpenedAtFrom(dispute, eventCreatedUnix) {
  const created = Number(dispute?.created);
  const unix = Number.isFinite(created) && created > 0 ? created : Number(eventCreatedUnix);
  if (!Number.isFinite(unix) || unix <= 0) return null;
  return new Date(unix * 1000);
}

/**
 * PURE. Is this charge FieldQuo's own subscription billing?
 *
 * Takes facts already looked up rather than a database, so the decision can be
 * executed against hostile input — see scripts/check-subscription-refunds.mjs.
 *
 * @param {object} f
 * @param {string|null} f.paymentIntentId
 * @param {string|null} f.customerId
 * @param {string|null} f.invoiceId          `charge.invoice`
 * @param {boolean} f.hasConnectPayment      an Invoice Payment row matched this
 *                                           payment intent — the Connect path
 *                                           owns it and must not be second-guessed
 * @param {string|null} f.bundleSubscriptionId  this company's AI credit bundle
 *                                           subscription, when it has one
 * @param {string|null} f.chargeSubscriptionId  the subscription the charge's
 *                                           invoice belongs to, when resolved
 * @returns {{kind: string, reason: string}}  kind is one of
 *   "connect" | "not_invoice_charge" | "ai_bundle" | "subscription" | "unknown"
 */
export function classifySubscriptionCharge({
  paymentIntentId = null,
  customerId = null,
  invoiceId = null,
  hasConnectPayment = false,
  bundleSubscriptionId = null,
  chargeSubscriptionId = null,
} = {}) {
  // Deliberately first. The Connect path is correct and this one is additive;
  // a charge it recognises is never reconsidered here.
  if (hasConnectPayment) return { kind: "connect", reason: "invoice_payment_row" };

  if (!paymentIntentId) return { kind: "unknown", reason: "no_payment_intent" };

  // No invoice means a one-off `mode: "payment"` charge: a voice or AI top-up,
  // an auto top-up, a paid migration, a booking fee. Each has its own
  // settlement and none of them is subscription billing.
  if (!invoiceId) return { kind: "not_invoice_charge", reason: "no_invoice" };

  if (!customerId) return { kind: "unknown", reason: "no_customer" };

  // The bundle collision. Only decidable when the charge's own subscription was
  // resolved; when it was not, there is no bundle to confuse it with anyway,
  // because bundleSubscriptionId is null for a company that has none.
  if (bundleSubscriptionId && chargeSubscriptionId === bundleSubscriptionId) {
    return { kind: "ai_bundle", reason: "ai_credit_bundle_subscription" };
  }

  return {
    kind: "subscription",
    reason: chargeSubscriptionId ? "matched_by_subscription" : "matched_by_customer",
  };
}

/**
 * PURE. What a refund event should write onto the Subscription row, if
 * anything.
 *
 * @param {object} p
 * @param {{refundedAt: Date|null, refundedAmountCents: number}|null} p.existing
 * @param {number} p.refundedAmountCents  Stripe's cumulative `amount_refunded`
 * @param {Date|null} p.refundedAt        Stripe's own timestamp
 * @returns {{write: boolean, reason: string, data?: object}}
 */
export function planSubscriptionRefund({ existing, refundedAmountCents, refundedAt } = {}) {
  if (!(refundedAt instanceof Date) || Number.isNaN(refundedAt.getTime())) {
    return { write: false, reason: "no_stripe_timestamp" };
  }
  const cents = Number(refundedAmountCents);
  if (!Number.isFinite(cents) || cents < 0) return { write: false, reason: "no_amount" };
  // A charge.refunded carrying nothing refunded is not a fact about money
  // moving. Writing a zero over a real figure would erase a refund.
  if (cents === 0) return { write: false, reason: "nothing_refunded" };

  // ── Out-of-order delivery ──────────────────────────────────────────────
  //
  // Stripe redelivers, and a partial refund followed by a second partial one
  // produces two events whose cumulative figures differ. An OLDER event
  // arriving after a newer one must not roll the total back, so the incoming
  // Stripe timestamp is compared against the stored one. An identical replay
  // has an identical timestamp, passes, and writes the identical numbers —
  // which is the no-op the absolute-value rule exists to guarantee.
  const prior = existing?.refundedAt ? new Date(existing.refundedAt) : null;
  if (prior && !Number.isNaN(prior.getTime()) && refundedAt.getTime() < prior.getTime()) {
    return { write: false, reason: "older_than_recorded" };
  }

  return {
    write: true,
    reason: "refund_recorded",
    data: { refundedAmountCents: Math.round(cents), refundedAt },
  };
}

/**
 * PURE. What a dispute event should write onto the Subscription row.
 *
 * `disputeStatus` is Stripe's own string, verbatim. Collapsing it to a boolean
 * would make "warning_needs_response" — a warning, no money moved, nothing to
 * answer yet — indistinguishable from "lost", where the money is gone and the
 * account should probably be closed.
 *
 * @param {object} p
 * @param {{disputeStatus: string|null, disputedAt: Date|null}|null} p.existing
 * @param {string|null} p.status      dispute.status
 * @param {Date|null} p.disputedAt    dispute.created
 * @returns {{write: boolean, reason: string, data?: object}}
 */
export function planSubscriptionDispute({ existing, status, disputedAt } = {}) {
  if (!status || typeof status !== "string") return { write: false, reason: "no_status" };
  if (!(disputedAt instanceof Date) || Number.isNaN(disputedAt.getTime())) {
    return { write: false, reason: "no_stripe_timestamp" };
  }

  const prior = existing?.disputeStatus || null;

  // ── Out-of-order delivery ──────────────────────────────────────────────
  //
  // charge.dispute.closed can land before a charge.dispute.updated that was
  // emitted earlier, and Stripe redelivers the created event indefinitely.
  // "won" and "lost" are the card network's final word; nothing non-terminal
  // may overwrite one. A terminal status replacing a terminal status is
  // allowed, because a redelivery of the same closure writes the same string
  // and a genuinely different outcome is worth having.
  if (prior && TERMINAL_DISPUTE_STATUSES.has(prior) && !TERMINAL_DISPUTE_STATUSES.has(status)) {
    return { write: false, reason: "already_closed" };
  }

  // `disputedAt` is stamped when a dispute OPENS, and a dispute is opening
  // whenever nothing is recorded or the last one already closed. Not "stamped
  // once for ever": a company disputing again in August, having lost one in
  // January, deserves a date that says August. Within one open dispute a
  // status transition leaves the date alone, which is recordStripeDispute.js's
  // rule and the reason it gives for it.
  const opening = !prior || TERMINAL_DISPUTE_STATUSES.has(prior);
  const stamped = existing?.disputedAt ? new Date(existing.disputedAt) : null;

  return {
    write: true,
    reason: opening ? "dispute_opened" : "dispute_updated",
    data: {
      disputeStatus: status,
      disputedAt: opening || !stamped || Number.isNaN(stamped.getTime()) ? disputedAt : stamped,
    },
  };
}

/**
 * The charge behind an event.
 *
 * charge.refunded carries the Charge itself. A Dispute carries neither the
 * customer nor the invoice — only `charge` and `payment_intent` — so the
 * charge has to be fetched, which is the same call lib/ai/creditBundle.js's
 * resolveAiBundleSubscription already makes from inside webhook handling for
 * the same reason: the event does not carry the fact the decision needs.
 *
 * Throws on a Stripe failure rather than guessing. The webhook route turns a
 * throw into a 500, which asks Stripe to redeliver — the right outcome for a
 * chargeback we could not classify.
 */
export async function chargeForEvent(event, { deps = {} } = {}) {
  const stripeClient = deps.stripe || platformStripe;
  const obj = event?.data?.object || null;
  if (event?.type === "charge.refunded") return obj;

  const chargeId = idOf(obj?.charge);
  if (!chargeId) return null;
  return stripeClient.charges.retrieve(chargeId);
}

/**
 * Recognise and record a refund or chargeback on a company's own FieldQuo
 * subscription.
 *
 * Called by lib/stripe/settleChargeEvent.js only after the Connect path has
 * declined the same event.
 *
 * @param prisma  the Prisma client (or a transaction client)
 * @param event   a Stripe Event — charge.refunded or charge.dispute.*
 * @param deps    seams for scripts/check-subscription-refunds.mjs. Production
 *                callers pass nothing.
 * @returns {Promise<{recorded: boolean, kind?: string, reason: string,
 *                    companyId?: string, data?: object}>}
 */
export async function recordSubscriptionChargeEvent(prisma, event, { deps = {} } = {}) {
  const log = deps.recordError || recordError;
  const type = event?.type;
  const isRefund = type === "charge.refunded";
  const isDispute = DISPUTE_EVENT_TYPES.has(type);
  if (!isRefund && !isDispute) return { recorded: false, reason: "not_a_charge_event" };

  const disputeObject = isDispute ? event?.data?.object || null : null;
  const charge = await chargeForEvent(event, { deps });
  if (!charge) return { recorded: false, reason: "no_charge" };

  const paymentIntentId = idOf(charge.payment_intent);
  const customerId = idOf(charge.customer);
  const invoiceId = idOf(charge.invoice);

  // The Connect path already declined this event before we were called, but it
  // declined on its own terms and this file must not assume why. Asking again
  // is one indexed lookup and it is what keeps "do not touch a Connect charge"
  // true by construction rather than by call order.
  const hasConnectPayment = paymentIntentId
    ? Boolean(
        await prisma.payment.findFirst({
          where: { stripePaymentIntentId: paymentIntentId },
          select: { id: true },
        }),
      )
    : false;

  // Cheap classification first — no customer lookup, no Stripe call — so a
  // top-up refund costs one query and leaves.
  const first = classifySubscriptionCharge({ paymentIntentId, customerId, invoiceId, hasConnectPayment });
  if (first.kind !== "subscription") return { recorded: false, kind: first.kind, reason: first.reason };

  const row = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: {
      id: true,
      companyId: true,
      refundedAt: true,
      refundedAmountCents: true,
      disputeStatus: true,
      disputedAt: true,
    },
  });

  if (!row) {
    // ── Never a silent miss ────────────────────────────────────────────────
    //
    // The subscription row can genuinely be absent: checkout.session.completed
    // and this event race, and the network gives no ordering guarantee. But an
    // unrecorded chargeback is money FieldQuo has lost and cannot see, so the
    // miss is logged where support looks (/platform/errors). The referral
    // credit path in lib/platform/stripeBilling.js does the same lookup and
    // simply returns when it finds nothing — a known live bug, and the reason
    // this branch exists at all.
    await log({
      area: "billing-webhook",
      code: "subscription_charge_unmatched",
      message: `${type} on Stripe customer ${customerId} matched no Subscription row — a refund or chargeback on FieldQuo's own billing went unrecorded`,
      detail: {
        eventId: event?.id || null,
        type,
        chargeId: charge?.id || null,
        customerId,
        invoiceId,
        paymentIntentId,
        needsManualReconciliation: true,
      },
    });
    return { recorded: false, kind: "subscription", reason: "no_subscription_row" };
  }

  // The bundle collision, resolved only for a company that actually has a
  // bundle. `companyId` is @unique on AiCreditBundle, so this is one lookup and
  // for nearly every company it answers "none" and costs nothing further.
  const bundle = await prisma.aiCreditBundle.findUnique({
    where: { companyId: row.companyId },
    select: { stripeSubscriptionId: true },
  });
  let chargeSubscriptionId = null;
  if (bundle?.stripeSubscriptionId) {
    const stripeClient = deps.stripe || platformStripe;
    const invoice = await stripeClient.invoices.retrieve(invoiceId);
    chargeSubscriptionId = invoiceSubscriptionId(invoice);
  }

  const verdict = classifySubscriptionCharge({
    paymentIntentId,
    customerId,
    invoiceId,
    hasConnectPayment,
    bundleSubscriptionId: bundle?.stripeSubscriptionId || null,
    chargeSubscriptionId,
  });

  if (verdict.kind === "ai_bundle") {
    // There is no column for a bundle's refund or chargeback, and writing it
    // onto the plan's row would say something false about the plan. Logged
    // instead of invented — a chargeback FieldQuo cannot record is exactly what
    // support needs to see rather than a number nobody can trace.
    await log({
      area: "billing-webhook",
      code: "ai_bundle_charge_event",
      message: `${type} belongs to the AI credit bundle subscription, not the company's plan — recorded nowhere`,
      companyId: row.companyId,
      detail: {
        eventId: event?.id || null,
        type,
        chargeId: charge?.id || null,
        bundleSubscriptionId: bundle.stripeSubscriptionId,
        needsManualReconciliation: true,
      },
    });
    return { recorded: false, kind: "ai_bundle", reason: verdict.reason, companyId: row.companyId };
  }

  const plan = isRefund
    ? planSubscriptionRefund({
        existing: row,
        refundedAmountCents: Number(charge.amount_refunded),
        refundedAt: refundedAtFrom(charge, event?.created),
      })
    : planSubscriptionDispute({
        existing: row,
        status: disputeObject?.status || null,
        disputedAt: disputeOpenedAtFrom(disputeObject, event?.created),
      });

  if (!plan.write) {
    if (plan.reason === "no_stripe_timestamp") {
      // Refusing to stamp `now` is the correct behaviour, and it is also the
      // kind of silence that hides a live problem. Say so out loud.
      await log({
        area: "billing-webhook",
        code: "subscription_charge_no_timestamp",
        message: `${type} carried no Stripe timestamp — refused rather than stamped with the current time`,
        companyId: row.companyId,
        detail: { eventId: event?.id || null, type, chargeId: charge?.id || null },
      });
    }
    return { recorded: false, kind: "subscription", reason: plan.reason, companyId: row.companyId };
  }

  await prisma.subscription.update({ where: { id: row.id }, data: plan.data });

  return {
    recorded: true,
    kind: "subscription",
    reason: plan.reason,
    companyId: row.companyId,
    data: plan.data,
  };
}
