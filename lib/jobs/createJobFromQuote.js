// lib/jobs/createJobFromQuote.js
//
// The connective tissue between "client approved the quote" and "company can
// schedule the work". When a quote is accepted, this creates a Job in the
// `unscheduled` state so it shows up in /app/jobs waiting for a date — closing
// the silo where an approved quote went nowhere.
//
// Idempotent: one job per quote. A client double-clicking approve, or a retried
// webhook, must not spawn duplicate jobs — so it checks for an existing job on
// the quote before creating one.
//
// ── Why a transaction + row lock, and not a @unique on Job.quoteId ─────────
//
// The obvious DB-level fix — `Job.quoteId String? @unique`, caught the same
// way Payment.stripePaymentIntentId's P2002 already is — was tried and
// rejected. app/api/quotes/[id]/imports/route.js already reads a quote's jobs
// as a LIST for the cross-company import feature (`jobs: { select: { id:
// true }, take: 1 }`, then `hasJob: quote.jobs.length > 0`), which is real,
// shipped code built on "a quote's jobs are a collection", not a single row.
// A flat unique constraint would contradict a feature that already exists —
// not just risk failing to apply over old data, but be the wrong invariant
// even on a database with none.
//
// `SELECT ... FOR UPDATE` inside a transaction gets the same race-safety
// without touching the schema: whichever of two concurrent accepts gets there
// first holds the lock on the Quote row until it commits, and the second
// cannot even run its own existence check until the first has already created
// (or decided not to create) the job — so the second always sees the first
// one's result, never a stale "nothing yet".
//
// Best-effort by contract: the caller runs it AFTER the acceptance has
// committed and must not let a job-creation hiccup fail the client's approval.

import { geocodeJob, normaliseSiteAddress } from "@/lib/geo/geocodeJob";
import { db } from "@/lib/db";
import { attachDefaultWaivers } from "@/lib/waivers/service";
import { materializeImportedCosts } from "@/lib/quotes/importQuote";
import { carrySiteVisitsIntoJob } from "@/lib/quotes/siteVisitActivity";

function humanise(key) {
  return String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Ensure an accepted quote has a job. Returns the job (existing or new), or
 * null if the quote isn't in a state that should have one.
 *
 * @param {object} [deps] injection seam for scripts/check-cancel-consequences.mjs
 *   and friends — same reason settleBookingFee.js takes one. Production
 *   callers pass nothing and get the real db.
 */
export async function ensureJobForAcceptedQuote(quoteId, deps = {}) {
  if (!quoteId) return null;
  const prisma = deps.db || db;

  const { job, created, quoteNumber } = await prisma.$transaction(async (tx) => {
    // Serialises every concurrent call for THIS quote — see the header for
    // why this replaces a @unique constraint rather than sitting alongside
    // a check-then-create the way the old version did.
    await tx.$queryRaw`SELECT id FROM "Quote" WHERE id = ${quoteId} FOR UPDATE`;

    const existing = await tx.job.findFirst({
      where: { quoteId },
      select: { id: true, status: true },
    });
    if (existing) return { job: existing, created: false };

    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        companyId: true,
        clientId: true,
        quoteNumber: true,
        quoteType: true,
        status: true,
        siteAddress: true,
        client: { select: { name: true } },
      },
    });
    // Only accepted quotes become jobs. Guard here too, not just at the call
    // site, so this stays correct if it's ever called from somewhere new.
    if (!quote || quote.status !== "accepted") return { job: null, created: false };

    const type = quote.quoteType ? `${humanise(quote.quoteType)} — ` : "";
    const title = `${type}${quote.client?.name || "Job"} (${quote.quoteNumber})`;

    // Where the work is: the quote's own job address, which the builder
    // prefilled from a homeowner's address and made the estimator type for
    // a company client. NOT the client's address as a fallback — a quote
    // written before the column existed never asked, and Job.siteAddress's
    // own contract is that null means "not asked", never "same as the
    // client". Geocoded below, outside the transaction, the way
    // lib/jobs/createJob.js does on a typed job.
    const siteAddress = normaliseSiteAddress(quote.siteAddress);

    const newJob = await tx.job.create({
      data: {
        companyId: quote.companyId,
        clientId: quote.clientId,
        quoteId: quote.id,
        title,
        status: "unscheduled",
        siteAddress,
      },
      select: { id: true, title: true, status: true, companyId: true, siteAddress: true },
    });

    // The number rides out with the job so the history rows below can name
    // the quote without a second read of a row this transaction just held.
    return { job: newJob, created: true, quoteNumber: quote.quoteNumber };
  });

  // Now the project is real, turn any imported subcontractor costs into job
  // expenses so they land in job costing / margin. Best-effort by the same
  // contract as this whole function — a costing hiccup must not undo the job
  // — and run OUTSIDE the transaction above: it must never be able to roll
  // the job creation back over a costing failure.
  if (created && job) {
    // The pin for the crew's map. Never throws; a failed lookup leaves the
    // coordinates null and the address printed as typed.
    if (job.siteAddress) {
      await geocodeJob(prisma, job);
    }

    try {
      await materializeImportedCosts(prisma, {
        quoteId,
        jobId: job.id,
        companyId: job.companyId,
      });
    } catch (err) {
      console.error("[createJobFromQuote] materialise imported costs:", err?.message);
    }

    // The estimator's measure visits were scheduled against the QUOTE, before
    // this job existed, so nothing has written them into the job's history
    // yet. Carried once, here, on the one path every conversion takes — same
    // contract as the costs above: it never rolls the job back.
    await carrySiteVisitsIntoJob(prisma, {
      quoteId,
      job,
      quoteNumber: quoteNumber || null,
    });

    // Waivers marked "attach to every job" — same contract: never rolls
    // the job back.
    await attachDefaultWaivers({ companyId: job.companyId, jobId: job.id }).catch((err) =>
      console.error("[createJobFromQuote] default waivers:", err?.message),
    );
  }

  return job;
}
