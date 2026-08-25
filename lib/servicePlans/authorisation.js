// lib/servicePlans/authorisation.js
//
// Turning a completed Stripe setup session into the row that says "this client
// agreed, here is what they agreed to, and here is the instrument".
//
// Two callers reach this: the webhook (checkout.session.completed, mode setup)
// and the client's return redirect. Either can arrive first, and both write the
// same row — keyed on planId, which is unique — so a doubled delivery is a
// no-op rather than a second mandate.

import { db } from "@/lib/db";
import { readCompletedSetup, detachPaymentMethod } from "@/lib/servicePlans/stripeMandate";

/**
 * Write the authorisation for a plan from a finished Checkout setup session.
 *
 * The consent half — acceptedAt, the terms snapshot, the client's IP — was
 * written BEFORE the client was sent to Stripe (see the accept route). This
 * only fills in the instrument. That ordering is deliberate: a client who ticked
 * the box and then abandoned the card form leaves a row that says "agreed, never
 * finished", which is the truth, and which `isChargeable` correctly refuses.
 *
 * @returns { ok, reason?, authorisation? }
 */
export async function recordAuthorisationFromSession(planId, sessionId) {
  const pending = await db.servicePlanAuthorisation.findUnique({
    where: { planId },
  });
  if (!pending) return { ok: false, reason: "no_consent_recorded" };
  // Already complete, from the other caller. Not an error.
  if (pending.stripePaymentMethodId) {
    return { ok: true, reason: "already_recorded", authorisation: pending };
  }
  if (pending.revokedAt) return { ok: false, reason: "revoked" };

  const setup = await readCompletedSetup(sessionId);
  // Not finished — a bank account still awaiting micro-deposit verification, or
  // a session the client closed. Returning rather than writing is the point: a
  // payment method that cannot yet be debited is not a mandate.
  if (!setup) return { ok: false, reason: "setup_incomplete" };

  // The session must be THIS plan's. Both callers reach here holding a session
  // id supplied from outside — the webhook from Stripe (trustworthy) and the
  // client's return leg from a query string (not). Without this check, anyone
  // holding a plan's link could post someone else's setup session id and attach
  // a stranger's card to a plan the contractor can then charge. Stripe's own
  // metadata is the only thing that ties the two together, so it is checked
  // rather than assumed.
  if (setup.session?.metadata?.servicePlanId !== planId) {
    return { ok: false, reason: "session_mismatch" };
  }

  const authorisation = await db.servicePlanAuthorisation.update({
    where: { planId },
    data: {
      stripeCustomerId: setup.stripeCustomerId,
      stripeSetupIntentId: setup.stripeSetupIntentId,
      stripePaymentMethodId: setup.stripePaymentMethodId,
      stripeMandateId: setup.stripeMandateId,
      paymentMethodType: setup.paymentMethodType,
      paymentMethodBrand: setup.paymentMethodBrand,
      paymentMethodLast4: setup.paymentMethodLast4,
    },
  });

  return { ok: true, authorisation };
}

/**
 * Can this authorisation be charged right now?
 *
 * One function, so "do we have a mandate" has one answer everywhere — the run
 * engine, the plan screen and the check script all ask this rather than each
 * testing a different combination of nullable columns.
 */
export function isChargeable(authorisation) {
  if (!authorisation) return false;
  if (authorisation.revokedAt) return false;
  if (!authorisation.acceptedAt) return false;
  if (!authorisation.stripeCustomerId) return false;
  if (!authorisation.stripePaymentMethodId) return false;
  if (!authorisation.paymentMethodType) return false;
  return true;
}

/**
 * Why this plan will NOT charge automatically — or null when it will.
 *
 * A reason string rather than a boolean because every surface that shows it has
 * to say which. "Waiting for the client to save a card" and "the client removed
 * their card" are different sentences, and a contractor who is shown neither
 * assumes the money is coming.
 *
 * Returns: "not_requested" | "no_consent" | "awaiting_payment_method"
 *        | "revoked" | null
 */
export function automaticBlockedReason(plan, authorisation) {
  if (plan?.collectionMode !== "automatic") return "not_requested";
  if (!authorisation) return "no_consent";
  if (authorisation.revokedAt) return "revoked";
  if (!authorisation.stripePaymentMethodId) return "awaiting_payment_method";
  return isChargeable(authorisation) ? null : "awaiting_payment_method";
}

/**
 * Withdraw an authorisation and detach the instrument at Stripe.
 *
 * Two stops, deliberately, in this order: the database first (so a Stripe
 * failure cannot leave us believing we may still charge), Stripe second (so it
 * is not merely that our code won't — it can't).
 */
export async function revokeAuthorisation(planId, reason) {
  const existing = await db.servicePlanAuthorisation.findUnique({ where: { planId } });
  if (!existing) return { revoked: false, reason: "none" };
  if (existing.revokedAt) return { revoked: true, reason: "already_revoked" };

  await db.servicePlanAuthorisation.update({
    where: { planId },
    data: { revokedAt: new Date(), revokedReason: reason || null },
  });

  const detach = await detachPaymentMethod(existing.stripePaymentMethodId);
  return { revoked: true, detached: detach.detached, detachReason: detach.reason };
}
