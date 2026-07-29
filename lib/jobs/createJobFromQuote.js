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
// Best-effort by contract: the caller runs it AFTER the acceptance has
// committed and must not let a job-creation hiccup fail the client's approval.

import { db } from "@/lib/db";

function humanise(key) {
  return String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Ensure an accepted quote has a job. Returns the job (existing or new), or
 * null if the quote isn't in a state that should have one.
 */
export async function ensureJobForAcceptedQuote(quoteId) {
  if (!quoteId) return null;

  const existing = await db.job.findFirst({
    where: { quoteId },
    select: { id: true, status: true },
  });
  if (existing) return existing;

  const quote = await db.quote.findUnique({
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
  if (!quote || quote.status !== "accepted") return null;

  const type = quote.quoteType ? `${humanise(quote.quoteType)} — ` : "";
  const title = `${type}${quote.client?.name || "Job"} (${quote.quoteNumber})`;

  return db.job.create({
    data: {
      companyId: quote.companyId,
      clientId: quote.clientId,
      quoteId: quote.id,
      title,
      status: "unscheduled",
    },
    select: { id: true, title: true, status: true },
  });
}
