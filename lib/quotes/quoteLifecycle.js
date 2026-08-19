// lib/quotes/quoteLifecycle.js
//
// One place where "the quote changed hands" turns into everything downstream.
//
// This exists because the same business event had two implementations. A client
// approving through the public link created a Job, a draft Invoice and a
// "schedule it" Task; a staff member recording that same approval in the back
// office — PATCH /api/quotes/[id] { status: "accepted" }, which is what the
// "Get this approved → They approved" screen posts — created none of them. So an
// acceptance taken over the phone left an accepted quote with nothing to
// schedule and nothing to bill, while the identical acceptance clicked by the
// homeowner produced both. Which door the acceptance came through is not a
// business distinction, so it must not be a code one (AGENTS.md failure class
// #4: the copy is the one that rots).
//
// Contract: callers run these AFTER the status change has committed, and must
// not let a failure here fail the transition. Every step is idempotent — a
// double-click, a retried webhook, or a manual "Convert to invoice" after the
// automatic path already ran must not produce a second job or a second invoice.

import { db } from "@/lib/db";
import { ensureJobForAcceptedQuote } from "@/lib/jobs/createJobFromQuote";
import { ensureInvoiceForQuote } from "@/lib/invoices/createInvoiceFromQuote";
import { taskForAcceptedQuote } from "@/lib/tasks/autoCreate";

// Quote status → the originating lead's status.
//
// "converted" is the enum member the leads board renders as "Won"
// (app/app/leads/page.js: `app.leads.won`). There is no separate `won` value and
// adding one would split a single meaning across two, leaving every existing row
// on the wrong side of it.
//
// Only a quote CONVERTED FROM a lead has one to move: the link is
// LeadRequest.quoteId, set by lib/leads/convertLead.js. Quotes typed from
// scratch — and instant estimates, which build a Client and a Quote directly
// without ever creating a LeadRequest — have no lead, and this is a no-op.
const LEAD_STATUS_FOR_QUOTE = {
  sent: "contacted",
  accepted: "converted",
  declined: "lost",
};

/**
 * Move the lead behind a quote to match the quote's fate.
 *
 * `sent → contacted` only advances a lead still sitting in `new`. Re-sending a
 * copy of a quote, or emailing a follow-up, must not drag a lead that is
 * already won or lost back to "contacted" — the outcome is the more specific
 * fact and it wins. `accepted` and `declined` are outcomes rather than
 * progress, so they always apply.
 */
export async function syncLeadForQuoteStatus(quoteId, status) {
  const next = LEAD_STATUS_FOR_QUOTE[status];
  if (!quoteId || !next) return null;

  try {
    const lead = await db.leadRequest.findFirst({
      where: { quoteId },
      select: { id: true, status: true },
    });
    if (!lead) return null;
    if (lead.status === next) return lead;
    if (next === "contacted" && lead.status !== "new") return lead;

    return await db.leadRequest.update({
      where: { id: lead.id },
      data: { status: next },
      select: { id: true, status: true },
    });
  } catch (err) {
    console.error("[quoteLifecycle] lead sync:", err?.message);
    return null;
  }
}

/**
 * Everything an accepted quote sets in motion, minus the emails (those differ
 * by door: the public link sends the client a signed PDF, the back office does
 * not — a staff member recording a decision made on the phone has already
 * spoken to them).
 *
 * @returns {{ job: object|null, invoice: object|null }} for the caller's
 *   activity log, so the entry can name what was actually created.
 */
export async function onQuoteAccepted(quoteId, { createdById = null } = {}) {
  let job = null;
  let invoice = null;

  try {
    job = await ensureJobForAcceptedQuote(quoteId);
  } catch (err) {
    console.error("[quoteLifecycle] job:", err?.message);
  }

  try {
    ({ invoice } = await ensureInvoiceForQuote(quoteId, { createdById }));
  } catch (err) {
    console.error("[quoteLifecycle] invoice:", err?.message);
  }

  // A note for whoever has to put it in the diary. The job above lands
  // `unscheduled`, which is easy to miss on a list ordered by when work is
  // happening. Swallows its own errors.
  await taskForAcceptedQuote(quoteId);

  await syncLeadForQuoteStatus(quoteId, "accepted");

  return { job, invoice };
}

/** A declined quote creates nothing; it only closes the lead behind it. */
export async function onQuoteDeclined(quoteId) {
  await syncLeadForQuoteStatus(quoteId, "declined");
}

/** A sent quote means somebody has now reached the homeowner. */
export async function onQuoteSent(quoteId) {
  await syncLeadForQuoteStatus(quoteId, "sent");
}
