// lib/waivers/present.js
//
// The client-facing projection of one waiver signature row: what
// /w/[token] and the quote's proposal page render. Field by field — a
// spread of the row would leak the company id, the document id and, once
// signed, the stored IP and user agent to anyone with the link.

import { db as realDb } from "@/lib/db";
import { sanitiseWaiverBody } from "@/lib/company/documents";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";

export async function presentWaiver(row, { db = realDb } = {}) {
  const body = sanitiseWaiverBody(row.document?.body);
  const client = row.clientId
    ? await db.client.findUnique({ where: { id: row.clientId }, select: { name: true, language: true, address: true } })
    : null;
  let attachedTo = "";
  if (row.quoteId) attachedTo = (await db.quote.findUnique({ where: { id: row.quoteId }, select: { quoteNumber: true } }))?.quoteNumber || "";
  else if (row.invoiceId) attachedTo = (await db.invoice.findUnique({ where: { id: row.invoiceId }, select: { invoiceNumber: true } }))?.invoiceNumber || "";
  else if (row.jobId) attachedTo = (await db.job.findUnique({ where: { id: row.jobId }, select: { title: true } }))?.title || "";
  const c = row.company || {};
  return {
    title: row.document?.title || "",
    sections: body?.sections || [],
    acknowledgements: body?.acknowledgements || [],
    status: row.status === "signed" ? "signed" : "pending",
    signedAt: row.signedAt || null,
    signedName: row.status === "signed" ? row.signature?.name || "" : "",
    attachedTo,
    // The waiver text is shown as written; the chrome around it follows the
    // client's language, then the company default (non-negotiable #6).
    language: resolveClientLanguage({ document: {}, client: client || {}, company: c }),
    client: { name: client?.name || "", address: client?.address || "" },
    company: { name: c.name || "", logoUrl: c.logoUrl || null, brandColor: c.brandColor || null, phone: c.phone || null },
  };
}

/** The staff view of one attached waiver — no token, no PNG, no IP. */
export function presentSignature(w) {
  return {
    id: w.id,
    documentId: w.documentId,
    title: w.document?.title || "",
    status: w.status,
    signedAt: w.signedAt,
    sentAt: w.sentAt,
    signedName: w.status === "signed" ? w.signature?.name || "" : "",
    acknowledged: Array.isArray(w.acknowledgements) ? w.acknowledgements.length : 0,
    jobDocumentId: w.jobDocumentId,
    quoteId: w.quoteId,
    jobId: w.jobId,
    invoiceId: w.invoiceId,
  };
}

