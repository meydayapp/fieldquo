// lib/subcontractors/receivedPricesServer.js
//
// The reads behind "Quotes from my subs" (/app/subcontractors/quotes). Every
// decision is in ./receivedPrices.js; this file only fetches, and every
// query it makes is scoped to the GC's own company:
//
//   QuoteImport               targetCompanyId = GC
//   SubPriceRequestRecipient  companyId = GC (and its request's companyId)
//   Quote                     companyId = GC, ids from the two above
//   ChangeOrder               job.companyId = GC, quoteImportId from the imports
//   Subcontractor             companyId = GC
//
// The ONE thing read from outside the GC's tenant is the sub's company NAME,
// through the import's own sourceCompany relation — what the compare panel
// on the quote page already shows (app/api/quotes/[id]/imports). No Quote
// row of another company is ever queried here: a sub's quote reaches this
// page only once a QuoteImport links it.
//
// No import of @/lib/db: the caller passes `db`, so scripts/check-sub-quotes.mjs
// runs this against an in-memory database holding two GCs and a sub, and
// checks every query's scope.

import { buildReceivedPrices, requestTargets } from "@/lib/subcontractors/receivedPrices";

/** The most rows of each source the page reads. Newest first; `truncated` says so. */
export const RECEIVED_PRICES_LIMIT = 500;

const QUOTE_SELECT = Object.freeze({
  id: true,
  companyId: true,
  quoteNumber: true,
  status: true,
  historicalImportedAt: true,
  client: { select: { name: true } },
  jobs: { select: { id: true, title: true }, orderBy: { createdAt: "asc" }, take: 1 },
});

/**
 * @param companyId the GC (member.companyId — never from the request)
 * @param access    receivedPriceAccess(full member)
 * @returns { rows, requestTargets, truncated }
 */
export async function loadReceivedPrices(db, { companyId, access, asOf } = {}) {
  if (!companyId || !access?.see) return { rows: [], requestTargets: [], truncated: false };

  const [imports, recipients] = await Promise.all([
    db.quoteImport.findMany({
      where: { targetCompanyId: companyId },
      orderBy: { createdAt: "desc" },
      take: RECEIVED_PRICES_LIMIT,
      select: {
        id: true,
        targetCompanyId: true,
        targetQuoteId: true,
        sourceQuoteId: true,
        sourceCompanyId: true,
        subcontractorId: true,
        uploadedSource: true,
        snapshotAmount: true,
        markupPercent: true,
        label: true,
        placement: true,
        createdAt: true,
        sourceCompany: { select: { name: true } },
      },
    }),
    // A reply waiting for the GC (lib/subRequests/model.js
    // awaitingConfirmation, re-applied by the builder). Only for a reader
    // the price-request panel would show them to.
    access.mayReplies
      ? db.subPriceRequestRecipient.findMany({
          where: {
            companyId,
            request: { companyId },
            repliedAt: { not: null },
            quoteImportId: null,
            declinedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: RECEIVED_PRICES_LIMIT,
          select: {
            id: true,
            companyId: true,
            subcontractorId: true,
            repliedAt: true,
            replyAmount: true,
            quoteImportId: true,
            declinedAt: true,
            request: { select: { companyId: true, quoteId: true, trade: true } },
            subcontractor: { select: { id: true, name: true, trade: true } },
          },
        })
      : [],
  ]);

  const quoteIds = [...new Set([...imports.map((i) => i.targetQuoteId), ...recipients.map((r) => r.request?.quoteId)].filter(Boolean))];
  const importIds = imports.map((i) => i.id);
  const subIds = [...new Set([...imports.map((i) => i.subcontractorId), ...recipients.map((r) => r.subcontractorId)].filter(Boolean))];
  const sourceCompanyIds = [...new Set(imports.map((i) => i.sourceCompanyId).filter(Boolean))];

  const [quotes, changeOrders, roster, openQuotes] = await Promise.all([
    quoteIds.length
      ? db.quote.findMany({ where: { id: { in: quoteIds }, companyId }, select: QUOTE_SELECT })
      : [],
    importIds.length
      ? db.changeOrder.findMany({
          where: { quoteImportId: { in: importIds }, job: { companyId } },
          select: { id: true, seq: true, createdAt: true, status: true, quoteImportId: true },
        })
      : [],
    subIds.length || sourceCompanyIds.length
      ? db.subcontractor.findMany({
          where: {
            companyId,
            OR: [
              ...(subIds.length ? [{ id: { in: subIds } }] : []),
              ...(sourceCompanyIds.length ? [{ linkedCompanyId: { in: sourceCompanyIds } }] : []),
            ],
          },
          select: {
            id: true,
            companyId: true,
            name: true,
            trade: true,
            linkedCompanyId: true,
            insuranceExpiresAt: true,
            clearanceExpiresAt: true,
          },
          orderBy: { createdAt: "asc" },
        })
      : [],
    // "Request a price" from the page header: the GC's own quotes a request
    // can land on, newest first — the picker, for a member who may send one.
    access.request
      ? db.quote.findMany({
          where: { companyId, status: { in: ["draft", "sent", "accepted"] }, historicalImportedAt: null },
          orderBy: { createdAt: "desc" },
          take: 40,
          select: QUOTE_SELECT,
        })
      : [],
  ]);

  const rows = buildReceivedPrices({ companyId, imports, recipients, quotes, changeOrders, roster, access, asOf });
  return {
    rows,
    requestTargets: requestTargets(openQuotes, { companyId, access }),
    truncated: imports.length >= RECEIVED_PRICES_LIMIT || recipients.length >= RECEIVED_PRICES_LIMIT,
  };
}
