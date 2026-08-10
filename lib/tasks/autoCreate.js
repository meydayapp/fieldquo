// lib/tasks/autoCreate.js
//
// Lifecycle events → the office to-do list.
//
// Three moments in the pipeline reliably leave a human owing somebody an
// action, and until now the software knew about all three and mentioned none
// of them: a client approves a quote and nobody books it in; an invoice goes
// out and nobody chases it; a job finishes and nobody asks for the review that
// wins the next one.
//
// ── The three contracts every helper here keeps ────────────────────────────
//
// 1. IDEMPOTENT. Each task carries a `sourceKey` — "quote_accepted:<id>" — and
//    the column is UNIQUE. The guard is the database constraint, not a
//    findFirst before the insert: the events these hook into are a public
//    endpoint a client can double-click, a Send button, and a status dropdown,
//    all of which can fire twice concurrently. A read-then-write check loses
//    that race; the constraint doesn't. P2002 is swallowed as success.
//
// 2. BEST EFFORT. A task is a note to self. Nothing here may fail the thing
//    that triggered it — an approval that appears to break because a reminder
//    couldn't be written is a far worse bug than a missing reminder. Every
//    entry point returns null on failure and logs.
//
// 3. COMPANY-SCOPED. companyId comes off the parent record, never off the
//    caller's session — the quote-approval path has no session at all.
//
// ── Why tasks and not FollowUpRule ─────────────────────────────────────────
//
// FollowUpRule emails the CLIENT on a schedule the company configured. These
// are internal, unconditional, and nobody outside the office ever sees them.
// Putting "ask them for a review" through the rules engine would mean a
// company that hasn't written a rule gets no prompt at all.

import { db } from "@/lib/db";

/**
 * The user a machine-made task is attributed to.
 *
 * Task.createdById is required and there is no system user to point it at, so
 * this borrows the company's owner. Deliberately the owner rather than
 * "whoever triggered it": the quote-approval path is a stranger with a link
 * and no user at all, and an owner is the one member every company has.
 *
 * Returns null when a company somehow has no active owner — the caller then
 * skips rather than inventing an attribution.
 */
async function fallbackAuthorId(companyId) {
  const owner = await db.member.findFirst({
    where: { companyId, active: true, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (owner) return owner.userId;

  // An admin will do if the owner seat was deactivated. Still scoped to the
  // company, so this can never attribute a task to somebody else's user.
  const admin = await db.member.findFirst({
    where: { companyId, active: true, role: "admin" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return admin?.userId || null;
}

const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  // Start of day: a due date is a day, not a moment. Leaving the creation
  // time on it makes "due today" flip to overdue mid-afternoon.
  date.setHours(9, 0, 0, 0);
  return date;
};

/**
 * Create one task for one lifecycle event, or quietly do nothing.
 *
 * Every helper below funnels through here so the three contracts are kept in
 * exactly one place.
 */
async function createOnce({
  companyId,
  sourceKey,
  title,
  description = null,
  dueDate = null,
  priority = "normal",
  links = {},
}) {
  if (!companyId || !sourceKey || !title) return null;

  try {
    const createdById = await fallbackAuthorId(companyId);
    if (!createdById) {
      console.error(
        `[tasks/autoCreate] ${sourceKey}: company ${companyId} has no active owner or admin to attribute the task to`,
      );
      return null;
    }

    return await db.task.create({
      data: {
        companyId,
        title,
        description,
        dueDate,
        priority,
        createdById,
        sourceKey,
        clientId: links.clientId || null,
        quoteId: links.quoteId || null,
        invoiceId: links.invoiceId || null,
        jobId: links.jobId || null,
      },
      select: { id: true, title: true },
    });
  } catch (err) {
    // P2002 = the unique index on sourceKey rejected a second copy, which is
    // the guard working, not a failure. Everything else is worth seeing.
    if (err?.code === "P2002") return null;
    console.error(`[tasks/autoCreate] ${sourceKey} failed:`, err?.message);
    return null;
  }
}

/**
 * Quote accepted → someone has to put it in the diary.
 *
 * The accepted quote already spawns a Job (unscheduled) and a draft invoice.
 * Neither has a date on it, and an unscheduled job is easy to miss on a list
 * sorted by when work is happening — which is precisely the pile this reminder
 * exists to stop growing.
 */
export async function taskForAcceptedQuote(quoteId) {
  if (!quoteId) return null;

  try {
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        companyId: true,
        clientId: true,
        quoteNumber: true,
        status: true,
        client: { select: { name: true } },
      },
    });
    if (!quote || quote.status !== "accepted") return null;

    const clientName = quote.client?.name || "the client";

    return await createOnce({
      companyId: quote.companyId,
      sourceKey: `quote_accepted:${quote.id}`,
      title: `Schedule the job for ${clientName}`,
      description: `${clientName} approved quote ${quote.quoteNumber}. The job is waiting in Jobs with no date on it yet.`,
      // No due date invented. The company's own turnaround is a thing we don't
      // know, and a made-up deadline would mark itself overdue and teach people
      // to ignore the red badge. High priority is the honest signal instead —
      // won work with nobody booked to do it.
      priority: "high",
      links: { clientId: quote.clientId, quoteId: quote.id },
    });
  } catch (err) {
    console.error("[tasks/autoCreate] accepted quote:", err?.message);
    return null;
  }
}

/**
 * Invoice sent → chase it in a week if it's still open.
 *
 * Seven days is the reminder, not the payment term — the term is the
 * company's and lives on the invoice. This is "have a look at this one", and
 * a week is long enough that a client who pays promptly has already paid.
 */
export async function taskForSentInvoice(invoiceId) {
  if (!invoiceId) return null;

  try {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        companyId: true,
        clientId: true,
        invoiceNumber: true,
        client: { select: { name: true } },
      },
    });
    if (!invoice) return null;

    const clientName = invoice.client?.name || "the client";

    return await createOnce({
      companyId: invoice.companyId,
      sourceKey: `invoice_sent:${invoice.id}`,
      title: `Follow up payment for ${invoice.invoiceNumber}`,
      description: `Sent to ${clientName}. Check it's been paid before chasing — the client portal shows the current balance.`,
      dueDate: daysFromNow(7),
      links: { clientId: invoice.clientId, invoiceId: invoice.id },
    });
  } catch (err) {
    console.error("[tasks/autoCreate] sent invoice:", err?.message);
    return null;
  }
}

/**
 * Job completed → ask for the review.
 *
 * Keyed on the job, so a job that gets reopened and completed again doesn't
 * produce a second ask. Job.reviewRequestedAt guards the automated review
 * EMAIL for the same reason; this is the manual counterpart for companies that
 * would rather ask in person than send one.
 */
export async function taskForCompletedJob(jobId) {
  if (!jobId) return null;

  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        companyId: true,
        clientId: true,
        title: true,
        client: { select: { name: true } },
      },
    });
    if (!job) return null;

    const clientName = job.client?.name || "the client";

    return await createOnce({
      companyId: job.companyId,
      sourceKey: `job_completed:${job.id}`,
      title: `Ask ${clientName} for a review`,
      description: `${job.title} is finished. A review asked for within a couple of days lands far better than one asked for next month.`,
      dueDate: daysFromNow(2),
      links: { clientId: job.clientId, jobId: job.id },
    });
  } catch (err) {
    console.error("[tasks/autoCreate] completed job:", err?.message);
    return null;
  }
}
