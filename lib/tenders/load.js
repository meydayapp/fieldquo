// lib/tenders/load.js
//
// Reading tenders with what they point at — the buyer, our bid quote, the
// job — for the list and the detail page. Tender has no @relation to those
// rows (prisma/schema.prisma's Tender header says why), so they are fetched
// here in one query each, ALWAYS with companyId in the where: an id stored on
// a tender is not proof of anything at read time, only at write time.
//
// A row that has gone (a client deleted, a quote removed) comes back as
// `{ id, missing: true }` rather than null, so the screen can say "this
// client was removed" instead of quietly showing no buyer.
import { redactTender } from "./access";

export const TENDER_SELECT = Object.freeze({
  id: true,
  companyId: true,
  clientId: true,
  quoteId: true,
  jobId: true,
  solicitationNumber: true,
  title: true,
  buyerBranch: true,
  source: true,
  sourceUrl: true,
  questionsChannel: true,
  contractingAuthorityName: true,
  contractingAuthorityEmail: true,
  contractingAuthorityPhone: true,
  technicalAuthorityName: true,
  technicalAuthorityEmail: true,
  technicalAuthorityPhone: true,
  timeZone: true,
  publishedDate: true,
  questionsDeadlineDate: true,
  questionsDeadlineTime: true,
  questionsDeadlineAt: true,
  siteVisitDate: true,
  siteVisitTime: true,
  siteVisitMandatory: true,
  siteVisitLocation: true,
  siteVisitAt: true,
  closingDate: true,
  closingTime: true,
  closingAt: true,
  bidValidityDays: true,
  expectedAwardDate: true,
  estimatedValue: true,
  bidSecurityRequired: true,
  bidSecurityAmount: true,
  securityClearance: true,
  notes: true,
  status: true,
  decisionReason: true,
  decidedAt: true,
  submittedAt: true,
  confirmationNumber: true,
  contractNumber: true,
  awardedValue: true,
  awardedAt: true,
  winningPrice: true,
  winnerName: true,
  debriefNotes: true,
  closedReason: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
});

const DECIMALS = ["estimatedValue", "bidSecurityAmount", "awardedValue", "winningPrice"];

function plainMoney(row) {
  const out = { ...row };
  for (const f of DECIMALS) if (out[f] != null) out[f] = String(out[f]);
  return out;
}

/**
 * Attach client / quote / job to each tender, then redact for `member`.
 *
 * @param {object} db
 * @param {string} companyId
 * @param {Array} rows   Tender rows (TENDER_SELECT)
 * @param {object} member loadEnforceableMember's shape
 */
export async function hydrateTenders(db, companyId, rows, member) {
  const list = Array.isArray(rows) ? rows : [];
  const ids = (key) => [...new Set(list.map((r) => r[key]).filter(Boolean))];
  const clientIds = ids("clientId");
  const quoteIds = ids("quoteId");
  const jobIds = ids("jobId");

  const [clients, quotes, jobs] = await Promise.all([
    clientIds.length
      ? db.client.findMany({ where: { id: { in: clientIds }, companyId }, select: { id: true, name: true, type: true } })
      : [],
    quoteIds.length
      ? db.quote.findMany({
          where: { id: { in: quoteIds }, companyId },
          select: { id: true, quoteNumber: true, status: true, total: true, jobs: { select: { id: true }, take: 1 } },
        })
      : [],
    jobIds.length
      ? db.job.findMany({ where: { id: { in: jobIds }, companyId }, select: { id: true, title: true, status: true } })
      : [],
  ]);
  const byId = (rowsIn) => new Map((rowsIn || []).map((r) => [r.id, r]));
  const clientMap = byId(clients);
  const quoteMap = byId(quotes);
  const jobMap = byId(jobs);

  return list.map((row) => {
    const quote = row.quoteId ? quoteMap.get(row.quoteId) : null;
    const shaped = {
      ...plainMoney(row),
      client: row.clientId ? clientMap.get(row.clientId) || { id: row.clientId, missing: true } : null,
      quote: row.quoteId
        ? quote
          ? {
              id: quote.id,
              quoteNumber: quote.quoteNumber,
              status: quote.status,
              total: quote.total != null ? String(quote.total) : null,
              jobId: quote.jobs?.[0]?.id || null,
            }
          : { id: row.quoteId, missing: true }
        : null,
      job: row.jobId ? jobMap.get(row.jobId) || { id: row.jobId, missing: true } : null,
    };
    return redactTender(shaped, member);
  });
}
