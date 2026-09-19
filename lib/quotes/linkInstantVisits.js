// lib/quotes/linkInstantVisits.js
//
// Attaching a homeowner-booked visit to the instant-estimate draft it was
// booked for, after the fact.
//
// ── Why a repair exists at all ─────────────────────────────────────────────
//
// The public instant estimator ends with "book a visit". The booking route
// verified the draft's id, wrote it onto the Booking row — and never onto the
// Appointment row it created beside it, which is the row the quote page's
// site-visit panel reads (app/api/quotes/[id] includes `appointments`, i.e.
// Appointment.quoteId). So every visit booked off an instant estimate sat on
// the calendar while the quote said "No visit scheduled yet". Both creators
// now write the id (app/api/booking/[companySlug]/confirm, lib/booking/
// settleBookingFee.js); this closes the rows written before they did.
//
// ── Two pieces of evidence, in order of strength ───────────────────────────
//
//   1. The Booking beside the appointment carries this quote's id. That is
//      the link the confirm route verified (same company, same client email)
//      — it is a fact, not an inference, and it is applied without a time
//      window.
//   2. An appointment for the SAME client, in the same company, with no quote
//      at all, created within 24 hours after the draft. A homeowner who books
//      a measure the same afternoon their estimate arrived was booking about
//      that estimate; nothing else about that client exists yet to book about.
//      Never an appointment that already names another quote, job or invoice
//      — a link is only ever written into an empty column.
//
// Runs on the quote page's read, for auto-estimated drafts only, and is
// idempotent: once the column is filled the where-clause no longer matches.
// It is the one write on that GET, and it writes nothing a human did not
// already do — the visit exists, the quote exists, the client booked one
// about the other.
//
// The where-clauses are built by pure functions so scripts/check-site-visit.mjs
// can execute them against the scripted db rather than read them.

export const INSTANT_VISIT_LINK_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The 24-hour rule as a Prisma where-clause.
 *
 * @param {{ id: string, companyId: string, clientId: string, createdAt: Date|string }} quote
 */
export function orphanVisitWhere(quote) {
  const from = new Date(quote.createdAt);
  return {
    companyId: quote.companyId,
    clientId: quote.clientId,
    quoteId: null,
    jobId: null,
    invoiceId: null,
    createdAt: { gte: from, lte: new Date(from.getTime() + INSTANT_VISIT_LINK_WINDOW_MS) },
  };
}

/**
 * The verified-booking rule as a Prisma where-clause.
 */
export function bookedVisitWhere(quote) {
  return {
    companyId: quote.companyId,
    quoteId: null,
    booking: { is: { quoteId: quote.id } },
  };
}

/**
 * Link the visits that belong to this draft. Returns how many rows changed.
 *
 * @param {object} prisma  the db (or the check's stub)
 * @param {{ id, companyId, clientId, createdAt, autoEstimated }} quote
 */
export async function linkInstantVisits(prisma, quote) {
  if (!quote?.autoEstimated || !quote.id || !quote.clientId || !quote.createdAt) return 0;
  const data = { quoteId: quote.id };
  const booked = await prisma.appointment.updateMany({ where: bookedVisitWhere(quote), data });
  const orphaned = await prisma.appointment.updateMany({ where: orphanVisitWhere(quote), data });
  return (booked?.count || 0) + (orphaned?.count || 0);
}
