// lib/estimate/createEstimateQuote.js
//
// Turn a computed instant estimate into a reviewable draft Quote. The homeowner
// saw a RANGE; this records it as a draft the company must approve before it
// can be sent. Everything client-facing about the number was already computed
// server-side from the company's saved config — this only persists it.
//
// The draft lands in `draft` status with needsReview=true, which is the ONLY
// way an auto-estimated quote enters the review queue. Nothing here sends
// anything or tells the homeowner a binding price.

import { db } from "@/lib/db";
import { normaliseMediaList } from "@/lib/media/validate";

// Server owns the sequence — never generate a quote number client-side.
function getNextQuoteNumber(lastNumber) {
  const year = new Date().getFullYear();
  if (!lastNumber) return `Q-${year}-0001`;
  const match = String(lastNumber).match(/(\d+)$/);
  const nextSeq = match ? String(Number(match[1]) + 1).padStart(4, "0") : "0001";
  return `Q-${year}-${nextSeq}`;
}

// Match an existing client by email within the company before creating a new
// one — a repeat visitor shouldn't spawn a duplicate. Falls back to a fresh
// record when there's no email to match on.
async function findOrCreateClient(companyId, contact, address, language) {
  const email = contact.email ? String(contact.email).trim().toLowerCase() : null;
  if (email) {
    const existing = await db.client.findFirst({
      where: { companyId, email },
      select: { id: true },
    });
    if (existing) return existing.id;
  }
  const client = await db.client.create({
    data: {
      companyId,
      name: contact.name || "Website enquiry",
      email: contact.email || null,
      phone: contact.phone || null,
      address: address || null,
      language: language || null,
    },
    select: { id: true },
  });
  return client.id;
}

/**
 * @param {object} p
 * @param {{id:string}} p.company
 * @param {string} p.trade            estimator trade key
 * @param {string} p.categoryId       ServiceCategory id to file the scope under
 * @param {object} p.contact          { name, email, phone }
 * @param {object} p.measurement      snapshot shown to the homeowner
 * @param {string} p.materialKey
 * @param {object} p.estimate         { low, point, high, breakdown, ... }
 * @param {string} p.source           "google_solar" | "lawn_polygon" | "manual"
 * @param {string} [p.address]
 * @param {string} [p.language]
 */
export async function createEstimateDraft({
  company,
  trade,
  categoryId,
  contact,
  measurement,
  materialKey,
  estimate,
  source,
  address,
  language,
  media,
}) {
  const clientId = await findOrCreateClient(company.id, contact, address, language);

  // The homeowner's attached photos/videos. Re-normalised here (not trusted from
  // the browser) so clientPhotos only ever holds https media URLs the reviewer
  // and the AI review can safely open.
  const clientMedia = normaliseMediaList(media);

  const lastQuote = await db.quote.findFirst({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
    select: { quoteNumber: true },
  });
  const quoteNumber = getNextQuoteNumber(lastQuote?.quoteNumber);

  // Line items from the estimate breakdown so the draft renders like any other
  // quote; the authoritative range/measurements live in estimateData.
  const lineItems = (estimate.breakdown || []).map((b) => ({
    description: b.label,
    quantity: 1,
    rate: b.amount,
    amount: b.amount,
  }));

  const quote = await db.quote.create({
    data: {
      companyId: company.id,
      quoteNumber,
      clientId,
      quoteType: trade,
      language: language || "en",
      // The midpoint is the working figure; the reviewer confirms or edits it.
      // low/high are preserved in estimateData so "what the homeowner saw" is
      // never lost to a later edit of total.
      subtotal: estimate.point || 0,
      total: estimate.point || 0,
      lineItems,
      autoEstimated: true,
      needsReview: true,
      estimateSource: source,
      ...(clientMedia.length && { clientPhotos: clientMedia }),
      estimateData: {
        trade,
        materialKey,
        measurement,
        range: { low: estimate.low, point: estimate.point, high: estimate.high },
        unit: estimate.unit || null,
        breakdown: estimate.breakdown || [],
        assumptions: estimate.assumptions || [],
        capturedAt: new Date().toISOString(),
      },
      ...(categoryId && {
        scopeGroups: {
          create: [
            {
              categoryId,
              label: null,
              lineItems,
              subtotal: estimate.point || 0,
              sortOrder: 0,
            },
          ],
        },
      }),
    },
    select: { id: true, quoteNumber: true },
  });

  return quote;
}
