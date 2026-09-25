// lib/commissions/hook.js
//
// The one call every path that moves an invoice's money makes after its own
// write: the Stripe payment, refund and dispute recorders, a manual payment,
// a refund issued from FieldQuo, an amendment, a visit-fee credit, a
// change-order bill. See lib/commissions/sync.js for what a sync does and why
// it is safe to run as often as money moves.
//
// ── Why a separate, tiny file ─────────────────────────────────────────────
//
// These callers include the Stripe webhook. The sync itself pulls in job
// costing (and through it the trade price books) and payroll's wage rate —
// weight a webhook has no business loading for the great majority of
// companies, which have commissions switched off. So this file imports
// nothing but its argument, answers "is it on?" in one query, and loads the
// sync only when the answer is yes.
//
// ── It never throws ──────────────────────────────────────────────────────
//
// A payment is real whether or not a commission could be worked out, and a
// commission failure must not turn a Stripe webhook into a retried delivery
// or a manual payment into an error on the office's screen. A missed sync is
// healed by the next money movement on the job, by "Recalculate" on the job
// card, and by the pay-run preview (syncStaleCommissions) — before anyone is
// paid from it.

/**
 * @param db         the Prisma client — the caller's own, so a check script's
 *                   fake reaches this too. Never a transaction client: call
 *                   this AFTER the transaction that moved the money commits.
 * @param invoiceId  any version of the invoice
 */
export async function syncCommissionsForInvoice(db, invoiceId) {
  try {
    if (!invoiceId) return { skipped: "no_invoice" };
    const inv = await db.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        companyId: true,
        jobId: true,
        quoteId: true,
        parentInvoiceId: true,
        company: { select: { commissionsEnabled: true } },
      },
    });
    if (!inv || !inv.company?.commissionsEnabled) return { skipped: "off" };
    // A version row may not carry the link its root does; ask the root too.
    const root =
      inv.parentInvoiceId && !inv.jobId
        ? await db.invoice.findUnique({ where: { id: inv.parentInvoiceId }, select: { jobId: true, quoteId: true } })
        : null;
    const jobId = inv.jobId || root?.jobId || null;
    const quoteId = inv.quoteId || root?.quoteId || null;
    // The same two answers, in the same order, as lib/invoices/jobLink.js's
    // resolveInvoiceJob: the explicit link, else the oldest job on the quote.
    let job = null;
    if (jobId) {
      job = await db.job.findFirst({ where: { id: jobId, companyId: inv.companyId }, select: { id: true } });
    }
    if (!job && quoteId) {
      job = await db.job.findFirst({
        where: { quoteId, companyId: inv.companyId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
    }
    if (!job) return { skipped: "no_job" };
    const { syncJobCommissions } = await import("./sync");
    const out = await syncJobCommissions(db, { companyId: inv.companyId, jobId: job.id });
    return { written: out.written ?? 0, jobId: job.id };
  } catch (err) {
    console.error("[commissions] sync failed for invoice", invoiceId, err?.message);
    return { skipped: "error", error: err?.message };
  }
}
