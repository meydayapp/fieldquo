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
import { appSentence } from "@/lib/notify/push";

// ── The words are the office's, in the office's language ───────────────────
//
// A task title is STORED, so it is written once in one language and read by
// everyone in the company. That language is the company default
// (Company.defaultLanguage) — the interface language of everyone who never
// chose their own, and the only language a machine-made task can know, since
// the quote-approval path has no user behind it at all. "Follow up payment
// for INV-0007" was English in a French office; it now comes from the app
// catalogue (app.autoTask.*) through the same reader lib/notify/push.js uses
// for a notification row, so the to-do list and the feed agree.
async function companyLanguage(companyId) {
  const row = await db.company
    .findUnique({ where: { id: companyId }, select: { defaultLanguage: true } })
    .catch(() => null);
  return row?.defaultLanguage || "en";
}

// Keys are passed written out in full, never built from a prefix:
// check:translations cannot see a key that only exists at runtime.
async function words(language, titleKey, descKey, params) {
  return {
    title: await appSentence(language, titleKey, params),
    description: await appSentence(language, descKey, params),
  };
}

/** "the client" in the company's language, for a row with no name on it. */
async function theClient(language) {
  return (await appSentence(language, "app.autoTask.theClient")) || "the client";
}

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
        historicalImportedAt: true,
        client: { select: { name: true } },
      },
    });
    if (!quote || quote.status !== "accepted") return null;
    // A past job entered after the fact — see Quote.historicalImportedAt.
    // Its job was done years ago; nobody has to put it in the diary.
    if (quote.historicalImportedAt) return null;

    const language = await companyLanguage(quote.companyId);
    const clientName = quote.client?.name || (await theClient(language));
    const { title, description } = await words(language, "app.autoTask.scheduleJob.title", "app.autoTask.scheduleJob.desc", {
      client: clientName,
      number: quote.quoteNumber,
    });

    return await createOnce({
      companyId: quote.companyId,
      sourceKey: `quote_accepted:${quote.id}`,
      title,
      description,
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
 * The work the task asked for happened → close the task.
 *
 * "Schedule the job for ZZ Client — the job is waiting in Jobs with no date on
 * it yet" stayed open and kept saying that after the job was scheduled, a
 * visit assigned and the status moved to `scheduled`. The to-do list
 * accumulated work that was already done and contradicted the job record;
 * people stop reading a list that argues with them.
 *
 * Closed as `done`, not deleted — it WAS done, and the trail of what the
 * automation asked for is worth keeping.
 *
 * Only an `open` task is touched. Somebody who already cancelled this task
 * decided it did not apply, and reopening-then-closing it would overwrite that
 * judgement with a machine's.
 *
 * Never throws: this runs after a scheduling write that has already committed,
 * and a bookkeeping failure must not fail the thing the user actually did.
 */
/**
 * A job's materials need buying → ONE line on the to-do list.
 *
 * One, not one per material. A 24-square roof derives ten lines and a paved
 * driveway seven; raising a task for each would put seventeen rows on
 * /app/tasks for one job and bury the four things actually waiting on a person.
 * The task is the reminder; the list itself lives on the job, where the ticks
 * and the receipts go.
 *
 * The title carries the count, so the to-do list is worth reading at a glance:
 * "Buy materials — 204 Avro Cir · 3 of 10 bought".
 */
export async function taskForJobMaterials(jobId) {
  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        companyId: true,
        title: true,
        clientId: true,
        quoteId: true,
        materials: { select: { purchasedAt: true } },
      },
    });
    if (!job || job.materials.length === 0) return null;

    const bought = job.materials.filter((m) => m.purchasedAt).length;
    const total = job.materials.length;
    const sourceKey = `job_materials:${job.id}`;

    // Everything bought → the reminder has done its job. Resolved rather than
    // left open with "10 of 10", which is a to-do list arguing with itself.
    if (bought >= total) return await resolveTaskBySource(sourceKey);

    const title = `Buy materials — ${job.title} · ${bought} of ${total} bought`;

    // The count changes every tick, so unlike every other task here this one is
    // UPDATED in place when it already exists. createOnce would silently do
    // nothing on the second call and the title would freeze at "0 of 10".
    const existing = await db.task.findUnique({
      where: { sourceKey },
      select: { id: true, status: true },
    });
    if (existing) {
      await db.task.update({
        where: { id: existing.id },
        // Reopened if it had been closed and something was added since: the
        // list is no longer complete, so neither is the task.
        data: { title, status: "open" },
      });
      return { id: existing.id, title };
    }

    return await createOnce({
      companyId: job.companyId,
      sourceKey,
      title,
      description:
        "The materials this job needs, derived from the quote. Tick them off on the job as they are bought — a receipt entered there also builds your own price history.",
      priority: "high",
      links: { jobId: job.id, clientId: job.clientId, quoteId: job.quoteId },
    });
  } catch (err) {
    console.error("[tasks/autoCreate] job_materials:", err?.message);
    return null;
  }
}

export async function resolveTaskBySource(sourceKey) {
  try {
    if (!sourceKey) return null;
    const result = await db.task.updateMany({
      where: { sourceKey, status: "open" },
      // Status only. Task has no completedAt column — `updatedAt` is the
      // record of when, and inventing a field here would have failed at
      // runtime on a path that deliberately swallows its own errors, so it
      // would have failed SILENTLY and the tasks would still be stale.
      data: { status: "done" },
    });
    return result.count;
  } catch (err) {
    console.error("[tasks/autoCreate] resolve:", err?.message);
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
        historicalImportedAt: true,
        client: { select: { name: true } },
      },
    });
    if (!invoice) return null;
    // A past job's invoice was paid before it was typed in; there is nothing
    // to chase. The send route refuses these anyway — this is the second lock.
    if (invoice.historicalImportedAt) return null;

    const language = await companyLanguage(invoice.companyId);
    const clientName = invoice.client?.name || (await theClient(language));
    const { title, description } = await words(language, "app.autoTask.followUpPayment.title", "app.autoTask.followUpPayment.desc", {
      number: invoice.invoiceNumber,
      client: clientName,
    });

    return await createOnce({
      companyId: invoice.companyId,
      sourceKey: invoiceChaseKey(invoice.id),
      title,
      description,
      dueDate: daysFromNow(7),
      links: { clientId: invoice.clientId, invoiceId: invoice.id },
    });
  } catch (err) {
    console.error("[tasks/autoCreate] sent invoice:", err?.message);
    return null;
  }
}

/**
 * The sourceKey of an invoice's chase task.
 *
 * One exported function rather than the string `invoice_sent:${id}` written out
 * at four call sites — the send route creates it, the payment paths close it,
 * and the invoice page reads it to show whether a chase is outstanding. A key
 * spelled slightly differently in one of those places fails silently: the task
 * is simply never found, and a paid invoice keeps a "follow up payment" item on
 * the to-do list forever.
 */
export const invoiceChaseKey = (invoiceId) => `invoice_sent:${invoiceId}`;

/**
 * The money arrived → close the chase.
 *
 * "Follow up payment for INV-2026-0007" stayed open and kept saying that after
 * the client paid, because nothing on any of the three paths that mark an
 * invoice paid — a manual payment, a Stripe settlement, a visit-fee credit that
 * clears the balance — knew the task existed. Same failure the accepted-quote
 * task had before resolveTaskBySource was wired into scheduling: a to-do list
 * that argues with the record stops being read.
 *
 * Caller decides WHEN — it must only be called once the balance is actually
 * settled, because a deposit is not a reason to stop chasing the rest.
 *
 * Never throws: this runs after a payment write that has already committed, and
 * bookkeeping must not fail the thing the user actually did.
 */
export async function resolveInvoiceChaseTask(invoiceId) {
  if (!invoiceId) return null;
  return resolveTaskBySource(invoiceChaseKey(invoiceId));
}

/**
 * Job completed → ask for the review.
 *
 * Keyed on the job, so a job that gets reopened and completed again doesn't
 * produce a second ask. Job.reviewRequestedAt guards the automated review
 * EMAIL for the same reason; this is the manual counterpart for companies that
 * would rather ask in person than send one.
 */
export const jobCostReviewKey = (jobId) => `job_cost_review:${jobId}`;

/**
 * "Review what this job actually cost" — raised when a job is completed.
 *
 * The estimate-versus-actual comparison has existed since the job costing
 * panel shipped; what did not exist was any moment that asked somebody to
 * make the ACTUAL side complete. Hours sat pending, receipts sat untagged,
 * and the comparison quietly measured an estimate against half a job. The
 * task is the prompt; the review endpoint (app/api/jobs/[id]/costing/review)
 * resolves it and stamps Job.costReviewedAt.
 */
export async function taskForJobCostReview(jobId) {
  if (!jobId) return null;
  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      select: { id: true, companyId: true, clientId: true, title: true, historicalImportedAt: true },
    });
    if (!job) return null;
    // A past job's cost was entered by the person who typed it in and is
    // stamped reviewed on creation (lib/jobs/importPastJob.js). Asking
    // them to review it again would be a to-do that argues with the record.
    if (job.historicalImportedAt) return null;
    const { title, description } = await words(await companyLanguage(job.companyId), "app.autoTask.reviewCost.title", "app.autoTask.reviewCost.desc", {
      title: job.title,
    });
    return await createOnce({
      companyId: job.companyId,
      sourceKey: jobCostReviewKey(job.id),
      title,
      description,
      dueDate: daysFromNow(3),
      links: { clientId: job.clientId, jobId: job.id },
    });
  } catch (err) {
    console.error("[tasks/autoCreate] job cost review:", err?.message);
    return null;
  }
}

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
        historicalImportedAt: true,
        client: { select: { name: true } },
      },
    });
    if (!job) return null;
    // A past job entered after the fact: the client was not just served,
    // they were served in 2024, and "ask them for a review" two years on is
    // the ask this whole feature exists to not make.
    if (job.historicalImportedAt) return null;

    const language = await companyLanguage(job.companyId);
    const clientName = job.client?.name || (await theClient(language));
    const { title, description } = await words(language, "app.autoTask.askReview.title", "app.autoTask.askReview.desc", {
      client: clientName,
      title: job.title,
    });

    return await createOnce({
      companyId: job.companyId,
      sourceKey: `job_completed:${job.id}`,
      title,
      description,
      dueDate: daysFromNow(2),
      links: { clientId: job.clientId, jobId: job.id },
    });
  } catch (err) {
    console.error("[tasks/autoCreate] completed job:", err?.message);
    return null;
  }
}
