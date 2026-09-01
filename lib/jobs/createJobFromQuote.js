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

import { db } from "@/lib/db";
import { materializeImportedCosts } from "@/lib/quotes/importQuote";

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

  const { job, created } = await prisma.$transaction(async (tx) => {
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
        client: { select: { name: true } },
      },
    });
    // Only accepted quotes become jobs. Guard here too, not just at the call
    // site, so this stays correct if it's ever called from somewhere new.
    if (!quote || quote.status !== "accepted") return { job: null, created: false };

    const type = quote.quoteType ? `${humanise(quote.quoteType)} — ` : "";
    const title = `${type}${quote.client?.name || "Job"} (${quote.quoteNumber})`;

    const newJob = await tx.job.create({
      data: {
        companyId: quote.companyId,
        clientId: quote.clientId,
        quoteId: quote.id,
        title,
        status: "unscheduled",
      },
      select: { id: true, title: true, status: true, companyId: true },
    });

    return { job: newJob, created: true };
  });

  // Now the project is real, turn any imported subcontractor costs into job
  // expenses so they land in job costing / margin. Best-effort by the same
  // contract as this whole function — a costing hiccup must not undo the job
  // — and run OUTSIDE the transaction above: it must never be able to roll
  // the job creation back over a costing failure.
  if (created && job) {
    try {
      await materializeImportedCosts(prisma, {
        quoteId,
        jobId: job.id,
        companyId: job.companyId,
      });
    } catch (err) {
      console.error("[createJobFromQuote] materialise imported costs:", err?.message);
    }
  }

  return job;
}
