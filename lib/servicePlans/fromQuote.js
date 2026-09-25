// lib/servicePlans/fromQuote.js
//
// An approved quote with a maintenance plan on it becomes a running
// ServicePlan for that client — the one /app/plans lists, the client portal
// shows, and lib/servicePlans/run.js bills visit by visit.
//
// Called from onQuoteAccepted (lib/quotes/quoteLifecycle.js), the one path both
// acceptance doors take: the client signing on /q/[token] and a staff member
// recording a phone approval. Which plans it creates:
//
//   included  always — approving the quote approved the plan, and the page
//             said so above the signature.
//   optional  only when the client ticked it (QuotePlanOffer.selected, written
//             by the public approval route from ids alone). A phone approval
//             cannot tick for them; staff attach the plan as included instead.
//
// ── Once, whatever calls it ─────────────────────────────────────────────────
//
// Each offer is realised inside ONE transaction: create the plan, then claim
// the offer with `updateMany where servicePlanId IS NULL`. Postgres re-checks
// that predicate after taking the row lock, so of two concurrent approvals
// exactly one claims the row; the other's count is 0, it throws, and its plan
// is rolled back with it. QuotePlanOffer.servicePlanId is also UNIQUE — two
// guards, and the second one is the database's.
//
// ── What it bills, stated ──────────────────────────────────────────────────
//
// Collection is `invoice`: on each visit date the plan engine raises an invoice
// for the per-visit price less the plan discount (plus the stated tax) and
// emails the client the existing pay link. No card is stored and nothing is
// charged. Automatic charging stays what it already is — the client's own
// written authorisation on /plan/<token>, which staff request from the plan
// page. This file invents no payment flow.
//
// Never throws. An approval is already committed when this runs; a plan that
// could not be created is logged and left for the quote page to show as
// "not created", never allowed to make the approval look failed.

import { db as defaultDb } from "@/lib/db";
import { planInputFromOffer } from "@/lib/servicePlans/templates";

class Claimed extends Error {}

/**
 * @returns {{ created: Array<{ offerId, planId }>, skipped: Array<{ offerId, reason }> }}
 */
export async function ensureServicePlansForQuote(quoteId, { createdById = null, now = new Date(), db = defaultDb } = {}) {
  const created = [];
  const skipped = [];
  if (!quoteId) return { created, skipped };

  let quote;
  try {
    quote = await db.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        companyId: true,
        clientId: true,
        status: true,
        acceptedAt: true,
        planOffers: { orderBy: { sortOrder: "asc" } },
      },
    });
  } catch (err) {
    console.error("[servicePlans/fromQuote] load:", err?.message);
    return { created, skipped };
  }
  if (!quote || quote.status !== "accepted") return { created, skipped };

  // The day the client said yes, not the day this ran — a retry tomorrow must
  // not move the first visit.
  const acceptedAt = quote.acceptedAt ? new Date(quote.acceptedAt) : now;

  for (const offer of quote.planOffers || []) {
    if (offer.servicePlanId) {
      skipped.push({ offerId: offer.id, reason: "already_created" });
      continue;
    }
    // Belt and braces on the tenant: an offer is only ever written under its
    // quote's company, and a plan is only ever created under it too.
    if (offer.companyId !== quote.companyId) {
      skipped.push({ offerId: offer.id, reason: "wrong_company" });
      continue;
    }
    const taken = offer.mode === "included" || (offer.mode === "optional" && offer.selected === true);
    if (!taken) {
      skipped.push({ offerId: offer.id, reason: "not_chosen" });
      continue;
    }

    const input = planInputFromOffer(offer, { clientId: quote.clientId, acceptedAt });
    if (!input.ok) {
      console.error(`[servicePlans/fromQuote] offer ${offer.id} invalid:`, input.error);
      skipped.push({ offerId: offer.id, reason: "invalid" });
      continue;
    }

    try {
      const planId = await db.$transaction(async (tx) => {
        const plan = await tx.servicePlan.create({
          data: {
            ...input.plan,
            companyId: quote.companyId,
            createdById: createdById || null,
          },
          select: { id: true },
        });
        const claim = await tx.quotePlanOffer.updateMany({
          where: { id: offer.id, servicePlanId: null },
          data: { servicePlanId: plan.id },
        });
        if (claim.count !== 1) throw new Claimed();
        return plan.id;
      });
      created.push({ offerId: offer.id, planId });
    } catch (err) {
      if (err instanceof Claimed || err?.code === "P2002") {
        skipped.push({ offerId: offer.id, reason: "claimed_elsewhere" });
        continue;
      }
      console.error(`[servicePlans/fromQuote] offer ${offer.id}:`, err?.message);
      skipped.push({ offerId: offer.id, reason: "error" });
    }
  }

  return { created, skipped };
}
