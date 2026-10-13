// lib/tenders/detail.js
//
// Everything the tender detail page draws, shaped for one member. Shared by
// GET/PATCH /api/tenders/[id] and every action route under it, so an action
// hands the screen back exactly what a reload would.
import { tenderCapabilities } from "./access";
import { hydrateTenders } from "./load";
import { nextStatuses } from "./status";
import { companyTimeZone } from "./time";
import { companyZone } from "./server";

const DOCUMENT_SELECT = { id: true, name: true, kind: true, url: true, mimeType: true, sizeBytes: true, uploadedAt: true };

/** Everything the detail page draws, shaped for this member. */
export async function detailPayload(db, member, full, tenderRow) {
  const capabilities = tenderCapabilities(full);
  const [[tender], documents, candidateQuotes] = await Promise.all([
    hydrateTenders(db, member.companyId, [tenderRow], full),
    db.tenderDocument.findMany({
      where: { tenderId: tenderRow.id, companyId: member.companyId },
      select: DOCUMENT_SELECT,
      orderBy: { uploadedAt: "desc" },
    }),
    // The buyer's recent quotes — what "Link a quote" offers. The client's
    // own, nobody else's: a bid for PSPC priced on a homeowner's quote is
    // the mistake this list exists to make impossible.
    db.quote.findMany({
      where: { companyId: member.companyId, clientId: tenderRow.clientId },
      select: { id: true, quoteNumber: true, status: true, total: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return {
    tender,
    documents,
    candidateQuotes: candidateQuotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      status: q.status,
      createdAt: q.createdAt,
      ...(capabilities.canSeeMoney ? { total: q.total != null ? String(q.total) : null } : {}),
    })),
    nextStatuses: nextStatuses(tenderRow.status),
    capabilities,
    companyTimeZone: companyTimeZone(await companyZone(db, member.companyId)),
  };
}

