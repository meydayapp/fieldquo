// lib/company/documentLibrary.js
//
// The database side of the company document library: the select every
// staff route uses, the staff projection (row + measured expiry state +
// what the client would see of it right now), and the list. The rules
// themselves are pure, next door in documents.js.

import { db as realDb } from "@/lib/db";
import { isExpired, expiresSoon, waiverIsSignable } from "@/lib/company/documents";

const HTTP_URL = /^https?:\/\//i;
const str = (v) => (typeof v === "string" ? v.trim() : "");

export const DOCUMENT_SELECT = {
  id: true, type: true, title: true, summary: true, fileUrl: true, filePublicId: true, mimeType: true,
  expiresAt: true, showOnQuotes: true, sortOrder: true, body: true,
  attachToQuotes: true, attachToJobs: true, attachToInvoices: true, createdAt: true, updatedAt: true,
};

/** The staff view: the row plus what the client would see of it right now. */
export function presentForStaff(doc, now = new Date()) {
  return {
    ...doc,
    expired: isExpired(doc, now),
    expiresSoon: expiresSoon(doc, 30, now),
    signable: doc.type === "waiver" ? waiverIsSignable(doc.body) : null,
    // What the proposal will actually do with it — hidden when expired
    // whatever the switch says, hidden when it is a waiver (those are
    // attached and signed, not read).
    visibleToClients:
      doc.type !== "waiver" && Boolean(doc.showOnQuotes) && !isExpired(doc, now) && HTTP_URL.test(str(doc.fileUrl)),
  };
}

export async function listDocuments(companyId, { db = realDb } = {}) {
  const rows = await db.companyDocument.findMany({
    where: { companyId, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: DOCUMENT_SELECT,
  });
  return rows.map((d) => presentForStaff(d));
}
