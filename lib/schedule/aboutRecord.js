// lib/schedule/aboutRecord.js
//
// Loading the record a hand-booked appointment is about, scoped to the
// caller's company. The judgements about it (which to suggest, whether its
// client matches) are in lib/schedule/appointmentAbout.js, which has no
// database; this is the one place the rows come from, shared by POST and
// PATCH /api/appointments and by the dialog's lookup route, so the three
// cannot select three different shapes of the same job.

import { OPEN_JOB_STATUSES, OPEN_QUOTE_STATUSES, UNPAID_INVOICE_STATUSES } from "./appointmentAbout";

/** What every caller needs of a linked record: its client (for the mismatch
 *  sentence), its number or title (for the label), its site (for the location
 *  prefill), and — on a quote — its language (for the client's letters). */
export const ABOUT_SELECT = Object.freeze({
  quote: {
    id: true,
    quoteNumber: true,
    status: true,
    clientId: true,
    language: true,
    updatedAt: true,
    client: { select: { id: true, name: true, address: true } },
  },
  job: {
    id: true,
    title: true,
    status: true,
    clientId: true,
    siteAddress: true,
    updatedAt: true,
    client: { select: { id: true, name: true, address: true } },
    // A job has no language of its own; the quote it came from fixed one.
    quote: { select: { id: true, language: true } },
  },
  invoice: {
    id: true,
    invoiceNumber: true,
    status: true,
    clientId: true,
    language: true,
    updatedAt: true,
    client: { select: { id: true, name: true, address: true } },
    job: { select: { id: true, siteAddress: true } },
  },
});

/**
 * The one record `about` names, or null when it is not on this company —
 * an id from another tenant misses here exactly the way it would miss on the
 * record's own page. Never throws on a bad kind; that is refused earlier by
 * pickAbout().
 */
export async function loadAboutRecord(db, companyId, about) {
  if (!about || !ABOUT_SELECT[about.kind]) return null;
  const where = { id: about.id, companyId };
  const select = ABOUT_SELECT[about.kind];
  if (about.kind === "quote") return db.quote.findFirst({ where, select });
  if (about.kind === "job") return db.job.findFirst({ where, select });
  return db.invoice.findFirst({ where, select });
}

/**
 * A client's open records, for the dialog: unaccepted quotes, jobs still on,
 * unpaid invoices. Each list newest first; the suggestion is made from them
 * by suggestAbout(). `jobWhere` is the caller's assigned-jobs scope
 * (lib/permissions/enforce.js assignedJobWhere) so a crew member limited to
 * their own jobs is not handed the rest of the company's through this door.
 */
export async function loadOpenRecords(db, companyId, clientId, { jobWhere = {} } = {}) {
  const [quotes, jobs, invoices] = await Promise.all([
    db.quote.findMany({
      where: { companyId, clientId, status: { in: [...OPEN_QUOTE_STATUSES] } },
      select: ABOUT_SELECT.quote,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    db.job.findMany({
      where: { companyId, clientId, status: { in: [...OPEN_JOB_STATUSES] }, ...jobWhere },
      select: ABOUT_SELECT.job,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    db.invoice.findMany({
      where: { companyId, clientId, status: { in: [...UNPAID_INVOICE_STATUSES] } },
      select: ABOUT_SELECT.invoice,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);
  return { quotes, jobs, invoices };
}

/**
 * Any record in the company matching a typed search — number, title or
 * client name — open or not. The wider box under the suggestion: the office
 * booking a call about a paid invoice from March is allowed to say so.
 */
export async function searchRecords(db, companyId, q, { jobWhere = {} } = {}) {
  const term = String(q || "").trim().slice(0, 80);
  if (!term) return { quotes: [], jobs: [], invoices: [] };
  const byClient = { client: { name: { contains: term, mode: "insensitive" } } };
  const [quotes, jobs, invoices] = await Promise.all([
    db.quote.findMany({
      where: { companyId, OR: [{ quoteNumber: { contains: term, mode: "insensitive" } }, byClient] },
      select: ABOUT_SELECT.quote,
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    db.job.findMany({
      where: {
        companyId,
        ...jobWhere,
        OR: [{ title: { contains: term, mode: "insensitive" } }, byClient],
      },
      select: ABOUT_SELECT.job,
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    db.invoice.findMany({
      where: { companyId, OR: [{ invoiceNumber: { contains: term, mode: "insensitive" } }, byClient] },
      select: ABOUT_SELECT.invoice,
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);
  return { quotes, jobs, invoices };
}
