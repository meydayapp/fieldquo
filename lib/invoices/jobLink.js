// lib/invoices/jobLink.js
//
// The one place that answers "which job does this invoice bill for".
//
// There are two possible answers and they have to be tried in a fixed order:
//
//   1. Invoice.jobId — somebody linked it, or created the job from the invoice.
//   2. The job attached to the invoice's quote — the ordinary pipeline, where
//      accepting a quote mints both a job and a draft invoice and neither ever
//      points at the other.
//
// Before this existed, (2) was written out by hand inside
// app/api/invoices/costing/route.js and nowhere else. That is exactly failure
// class #4 in AGENTS.md waiting to happen: the moment a second screen needed the
// job, there would be two copies of the rule and the newer one would be the one
// nobody maintained. So the costing route now calls this too.
//
// Returns null when there is genuinely no job. The caller says so; it does not
// invent one, and it does not fall back to "the client's most recent job",
// which would attach one invoice's cost panel to a different job's timesheets.

/**
 * @param {import("@prisma/client").PrismaClient} db
 * @param {{id: string, jobId?: string|null, quoteId?: string|null}} invoice
 * @param {string} companyId  always the caller's own — never off the invoice
 * @param {object} [select]   Prisma select for the job; defaults to the id
 * @returns {Promise<object|null>}
 */
export async function resolveInvoiceJob(
  db,
  invoice,
  companyId,
  select = { id: true },
) {
  if (!invoice || !companyId) return null;

  // Scoped to the company on BOTH branches. The explicit link is a column a
  // PATCH could in principle set, so it is re-checked here rather than trusted;
  // the same discipline POST /api/jobs applies to a quoteId from a request body.
  if (invoice.jobId) {
    const linked = await db.job.findFirst({
      where: { id: invoice.jobId, companyId },
      select,
    });
    if (linked) return linked;
    // A link pointing at a job that is gone or belongs elsewhere is not a
    // reason to guess. Fall through to the quote, which is the same answer this
    // invoice had before anything was linked.
  }

  if (!invoice.quoteId) return null;

  // findFirst, not findUnique: a quote can have several jobs (a re-visit, a
  // second phase). The oldest is the one the acceptance created, which is the
  // one every other surface means by "the job for this quote".
  return db.job.findFirst({
    where: { quoteId: invoice.quoteId, companyId },
    orderBy: { createdAt: "asc" },
    select,
  });
}

/**
 * The same question from the other end: "which invoice bills for this job".
 *
 * Lives here rather than in the change-order route that needed it, for the
 * reason the header above already gives about the first direction — the moment
 * a second screen wants a job's invoice there would be two copies of the
 * ordering rule and the newer one would be the one nobody maintains.
 *
 * Mirrors resolveInvoiceJob's own order exactly:
 *
 *   1. Invoice.jobId — somebody linked it, or created it from the job.
 *   2. The invoice raised from the job's quote — the ordinary pipeline.
 *
 * Only ROOT invoices (parentInvoiceId null). Amending a sent invoice creates a
 * version row carrying the SAME quoteId (see createInvoiceFromQuote's header),
 * so without that filter this would return whichever version happened to sort
 * first and callers would write against a superseded document.
 *
 * Returns null when there is genuinely no invoice. The caller says so; it does
 * not invent one and it does not fall back to "the client's latest invoice",
 * which would bill one job's change orders to another job's homeowner.
 *
 * @param {{id: string, quoteId?: string|null}} job
 * @param {string} companyId always the caller's own — never off the job
 */
export async function resolveJobInvoice(db, job, companyId, select = { id: true }) {
  if (!job || !companyId) return null;

  const linked = await db.invoice.findFirst({
    where: { jobId: job.id, companyId, parentInvoiceId: null },
    orderBy: { createdAt: "asc" },
    select,
  });
  if (linked) return linked;

  if (!job.quoteId) return null;

  return db.invoice.findFirst({
    where: { quoteId: job.quoteId, companyId, parentInvoiceId: null },
    orderBy: { createdAt: "asc" },
    select,
  });
}
