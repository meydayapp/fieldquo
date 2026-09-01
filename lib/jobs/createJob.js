// lib/jobs/createJob.js
//
// Raise a job, with the two things that are easy to forget.
//
// Extracted from POST /api/jobs the moment a SECOND caller appeared — the
// invoice detail page, where "this invoice bills for no job yet" is a state the
// office has to be able to fix without leaving the invoice.
//
// The two things a hand-rolled `db.job.create` would miss:
//
//   * A quoteId in a request body must be proved to belong to the caller's
//     company. Without that check, attaching another tenant's quote makes
//     materializeImportedCosts inject expenses into THEIR ledger and consume
//     THEIR imports.
//   * A job created from a quote that imported subcontractor costs has to
//     materialise them, or those costs never reach job costing and the margin
//     on the job is wrong by exactly the amount that was subcontracted.
//
// Permission checks stay in the routes. They differ — creating a job from the
// jobs screen is `job:create` plus the jobs level, and the invoice route adds
// its own invoice-side gate on top — and a helper that quietly enforced one
// set would be the wrong kind of shared.

import { materializeImportedCosts } from "@/lib/quotes/importQuote";
import { assertOwnedIds } from "@/lib/tenant/ownedIds";
import { isCallbackReason } from "@/lib/jobs/callbackReasons";

/**
 * @returns {{ job: object|null, error: string|null, status: number }}
 *   `error` is a message safe to hand back to the caller; `status` is the HTTP
 *   code the route should use. Never throws for the ordinary refusals, so the
 *   two routes cannot answer the same bad input differently.
 */
export async function createJob(
  db,
  {
    companyId,
    createdByUserId,
    clientId,
    quoteId,
    title,
    recurring,
    recurrenceRule,
    // A callback big enough to need its own job — see Job.originalJobId's own
    // comment for when to use this instead of JobVisit.returnReason. Written
    // together or not at all: a reason with no original job to explain, or an
    // original with no stated reason, are both half a fact.
    originalJobId,
    callbackReason,
  },
) {
  if (!clientId || !title) {
    return {
      job: null,
      error: "clientId and title are required",
      status: 400,
    };
  }

  if ((originalJobId && !callbackReason) || (!originalJobId && callbackReason)) {
    return {
      job: null,
      error: "A callback job needs both the original job and a reason.",
      status: 400,
    };
  }
  if (callbackReason && !isCallbackReason(callbackReason)) {
    return { job: null, error: `Unknown callback reason: ${callbackReason}`, status: 400 };
  }

  // The quote check below is older than the client check beside it, and the
  // gap between them is the bug: the header above explains at length why a
  // quoteId from a request body has to be proved, three lines above a clientId
  // that never was. `include: { client: true }` on the create meant a single
  // POST returned another tenant's client row — email, phone, address, notes
  // and portalToken. Both go through one table now (lib/tenant/ownedIds.js) so
  // a third foreign key can't be added and left out. originalJobId joins them
  // for the same reason — a callback job pointing at another tenant's job
  // would put that job's id (and, via callbackJobs, a way to probe it) inside
  // this company's own records.
  const owned = await assertOwnedIds(db, companyId, { clientId, quoteId, originalJobId });
  if (!owned.ok) return { job: null, error: owned.error, status: owned.status };

  const job = await db.job.create({
    data: {
      companyId,
      clientId,
      quoteId: quoteId || null,
      title,
      recurring: !!recurring,
      recurrenceRule: recurrenceRule || null,
      originalJobId: originalJobId || null,
      callbackReason: callbackReason || null,
    },
    include: { client: true },
  });

  // Best effort and idempotent — see materializeImportedCosts. A failure here
  // must not lose the job that was just created, which is why it is caught and
  // logged rather than propagated.
  if (quoteId) {
    try {
      await materializeImportedCosts(db, {
        quoteId,
        jobId: job.id,
        companyId,
        createdById: createdByUserId,
      });
    } catch (err) {
      console.error("[jobs/createJob] materialise imported costs:", err?.message);
    }
  }

  return { job, error: null, status: 201 };
}
