// lib/quotes/siteVisitActivity.js
//
// The writes behind lib/quotes/siteVisit.js: the activity rows a quote's
// on-site measure leaves on the quote and on the job. Kept apart from the
// pure builders so a check script can execute those without a database.
//
// Both functions are best-effort by the same contract recordActivity makes —
// the appointment or the job has already been written by the time either
// runs, and a missed history row must never surface as "couldn't schedule
// that", because it did.

import { db } from "@/lib/db";
import { recordActivity } from "@/lib/activity/log";
import { siteVisitEvent, siteVisitCarryEvents } from "@/lib/quotes/siteVisit";

/**
 * One verb on one quote-linked appointment, written against the quote and —
 * when the quote has already become a job — against that job as well.
 *
 * The job lookup is by quoteId rather than trusted from the caller because
 * the appointment routes don't load jobs, and a job created between the
 * appointment's read and this write (an approval landing mid-request) is
 * exactly the row the history must not miss.
 *
 * @param {object} member  the actor, from memberOrRefusal
 * @param {"scheduled"|"completed"|"cancelled"} verb
 * @param {object} p
 * @param {object} p.appointment  { id, scheduledAt, assignedToId, assignedTo?, cancelReason? }
 * @param {object} p.quote        { id, quoteNumber }
 * @param {string} [p.timeZone]   the company's zone
 */
export async function recordSiteVisit(member, verb, { appointment, quote, timeZone }) {
  if (!member?.companyId || !quote?.id || !appointment?.id) return;
  try {
    const events = [
      siteVisitEvent(verb, {
        entityType: "quote",
        entityId: quote.id,
        appointment,
        quoteNumber: quote.quoteNumber,
        timeZone,
      }),
    ];

    const jobs = await db.job.findMany({
      where: { quoteId: quote.id, companyId: member.companyId },
      select: { id: true },
    });
    for (const job of jobs) {
      events.push(
        siteVisitEvent(verb, {
          entityType: "job",
          entityId: job.id,
          appointment,
          quoteNumber: quote.quoteNumber,
          timeZone,
        }),
      );
    }

    for (const event of events.filter(Boolean)) {
      await recordActivity(member, event);
    }
  } catch (err) {
    console.error("[siteVisit] activity not recorded:", err?.message);
  }
}

/**
 * When a quote becomes a job, every measure already on the quote is written
 * into the job's history — scheduled, and completed or cancelled where the
 * row got that far — so the crew reading the job sees the estimator was
 * there before them.
 *
 * The "scheduled" rows are attributed to whoever booked the visit
 * (Appointment.createdById), which recordActivity resolves to a name at
 * write time. A completion or cancellation carried this way names nobody:
 * the Appointment row does not record who completed it, and inventing an
 * actor for a history row is worse than the "Someone" the log prints for a
 * missing one.
 *
 * `prisma` is the injection seam ensureJobForAcceptedQuote already takes; a
 * stub without an `appointment` delegate simply carries nothing.
 *
 * @returns {Promise<number>} rows written (0 when the quote had no measures)
 */
export async function carrySiteVisitsIntoJob(prisma, { quoteId, job, quoteNumber }) {
  if (!quoteId || !job?.id || !job?.companyId) return 0;
  try {
    const rows = await prisma.appointment.findMany({
      where: { quoteId, companyId: job.companyId },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        cancelReason: true,
        assignedToId: true,
        createdById: true,
        assignedTo: { select: { name: true } },
      },
    });
    if (!rows.length) return 0;

    const company = await prisma.company.findUnique({
      where: { id: job.companyId },
      select: { timezone: true },
    });

    const events = siteVisitCarryEvents(rows, {
      jobId: job.id,
      quoteNumber,
      timeZone: company?.timezone || null,
    });

    let written = 0;
    for (const event of events) {
      const row = rows.find((r) => r.id === event.metadata?.appointmentId);
      const actor =
        event.action.endsWith(".scheduled") && row?.createdById
          ? { companyId: job.companyId, userId: row.createdById }
          : { companyId: job.companyId };
      await recordActivity(actor, {
        ...event,
        metadata: { ...event.metadata, carriedFromQuote: quoteId },
      });
      written++;
    }
    return written;
  } catch (err) {
    console.error("[siteVisit] not carried into job:", err?.message);
    return 0;
  }
}
