// lib/servicePlans/summary.js
//
// One shape for a plan, wherever it is shown.
//
// Two jobs, and they are both structural rather than cosmetic:
//
//   1. STRIP. A ServicePlanAuthorisation holds a Stripe customer id, a payment
//      method id and a mandate id. None of that may reach a browser. The row is
//      a separate table precisely so it cannot ride along by accident (see the
//      model's own comment), and this is the second half of that promise: what
//      leaves the server is a brand and a last-4, never an identifier anything
//      could be charged with.
//
//   2. NAME THE STATE. "Will this plan actually take money" is one question with
//      several different answers — not requested, no consent yet, waiting on the
//      client to finish, revoked, cancelled, finished. Computing it here once
//      means no screen re-derives it from nullable columns and gets it subtly
//      wrong, and it means an absent mandate is always SAID rather than shown as
//      a blank.

import {
  planBlockedReason,
  plannedOccurrenceCount,
  nextDueDate,
} from "@/lib/servicePlans/schedule";
import { occurrenceAmounts, termTotals } from "@/lib/servicePlans/pricing";
import { automaticBlockedReason } from "@/lib/servicePlans/authorisation";
import { redactClient, canSeeMoney } from "@/lib/permissions/enforce";

/**
 * @param {object} plan
 * @param {object} [opts]
 * @param {Date}   [opts.now]
 * @param {object} [opts.member] the enforceable member (role + permissions).
 *   Omitted means "no grid to apply" and the full shape is returned — which is
 *   what every caller did before this existed, and is why it is passed rather
 *   than defaulted to something restrictive: a plan summary that silently lost
 *   its money because a route forgot an argument would be the worse bug.
 *   The route-level check script asserts every call site supplies it.
 */
export function summarisePlan(plan, { now = new Date(), member = null } = {}) {
  const occurrences = Array.isArray(plan.occurrences) ? plan.occurrences : [];
  const seqs = occurrences.map((o) => o.seq);
  const amounts = occurrenceAmounts(plan);
  const planned = plannedOccurrenceCount(plan);
  const auth = plan.authorisation || null;

  const shaped = {
    id: plan.id,
    name: plan.name,
    serviceName: plan.serviceName,
    status: plan.status,
    frequency: plan.frequency,
    startDate: plan.startDate,
    endMode: plan.endMode,
    occurrenceCount: plan.occurrenceCount,
    endDate: plan.endDate,
    language: plan.language,
    collectionMode: plan.collectionMode,
    createdAt: plan.createdAt,
    cancelledAt: plan.cancelledAt,
    completedAt: plan.completedAt,
    // The same redactor GET /api/clients uses. A recurring plan is one of the
    // few places a client's email is assembled outside the client routes, and
    // it was handing it to a member restricted to name and address.
    client: plan.client
      ? redactClient(member, {
          id: plan.client.id,
          name: plan.client.name,
          email: plan.client.email,
        })
      : null,

    // Money, per occurrence and over the term. `term` is null for an open-ended
    // plan and the UI must print the cadence instead — see termTotals.
    amountPerOccurrence: Number(plan.amountPerOccurrence),
    discountPct: Number(plan.discountPct),
    taxRatePct: plan.taxRatePct === null ? null : Number(plan.taxRatePct),
    perOccurrence: amounts,
    plannedOccurrences: planned,
    term: termTotals(plan, planned),

    // Why it will or won't bill, in words. Both are null when everything is fine.
    blockedReason: planBlockedReason(plan, { now }),
    nextDueDate: nextDueDate(plan, { now, existingSeqs: seqs }),

    // ── The payment method, said out loud ────────────────────────────────
    //
    // `automaticBlockedReason` is null only when a live, unrevoked mandate
    // exists. Anything else names which of the several "no" cases it is, so a
    // screen can never render a plan as set up for automatic payment when it
    // is waiting on the client.
    automatic: {
      requested: plan.collectionMode === "automatic",
      blockedReason: automaticBlockedReason(plan, auth),
      acceptedAt: auth?.acceptedAt || null,
      revokedAt: auth?.revokedAt || null,
      // Display only. Never an id.
      method: auth?.stripePaymentMethodId
        ? {
            type: auth.paymentMethodType,
            brand: auth.paymentMethodBrand,
            last4: auth.paymentMethodLast4,
          }
        : null,
    },

    occurrences: occurrences.map((o) => ({
      id: o.id,
      seq: o.seq,
      dueDate: o.dueDate,
      status: o.status,
      total: Number(o.total),
      invoiceId: o.invoiceId,
      chargeFailureMessage: o.chargeFailureMessage,
    })),
  };

  // ── Money, on the same toggle as every other document ───────────────────
  //
  // A service plan is a recurring invoice; the routes gate CREATING one on
  // showPricing (via the invoices level) and gated reading it on nothing. The
  // dates, the cadence and whether it will actually bill are all legitimately
  // readable at invoices/view_only — a crew member seeing that the Tremblay
  // maintenance plan runs monthly and is blocked on a mandate is the point of
  // the screen. What it charges is not.
  if (canSeeMoney(member)) return shaped;

  const { amountPerOccurrence, discountPct, taxRatePct, perOccurrence, term, ...rest } =
    shaped;
  return {
    ...rest,
    occurrences: shaped.occurrences.map(({ total, ...o }) => o),
    pricingHidden: true,
  };
}
