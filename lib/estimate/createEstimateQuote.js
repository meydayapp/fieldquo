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
import { getNextQuoteNumber } from "@/lib/quotes/quoteNumber";
import { normaliseCountry } from "@/lib/tax/jurisdictions";

// Match an existing client by email within the company before creating a new
// one — a repeat visitor shouldn't spawn a duplicate. Falls back to a fresh
// record when there's no email to match on.
async function findOrCreateClient(companyId, contact, address, language, jurisdiction) {
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
      // The structured halves of that address, when the homeowner picked a
      // Places suggestion. Without them the client resolves to no jurisdiction
      // at all and every quote off this draft charges no tax silently — see
      // lib/tax/documentTax.js. Null, never invented, when they typed it.
      city: jurisdiction?.city || null,
      province: jurisdiction?.province || null,
      country: normaliseCountry(jurisdiction?.country),
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
 * @param {string} [p.city]      structured halves of that address, from Places.
 * @param {string} [p.province]  Absent when it was typed by hand, and absent is
 * @param {string} [p.country]   the correct record of that — see findOrCreateClient.
 * @param {string} [p.language]
 * @param {string} [p.reviewNotes]  INTERNAL. What the caller asked for that
 *        this estimate does not carry. Lands in Quote.reviewNotes, which no
 *        client-facing surface reads — see the schema comment.
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
  city,
  province,
  country,
  language,
  media,
  budget,
  reviewNotes,
}) {
  const clientId = await findOrCreateClient(company.id, contact, address, language, {
    city,
    province,
    country,
  });

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
      // Null rather than "" when there is nothing to review: an empty note
      // renders an empty box, and an empty box people learn to skip.
      reviewNotes: reviewNotes || null,
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
        // What they SAID they could spend, next to what the job actually prices
        // at — the reviewer needs both in one place before picking up the phone.
        // Resolved server-side from the band index the form posted; omitted
        // entirely when unanswered, because a missing budget is not a budget of
        // zero and must not read as one on the review screen.
        ...(budget && { budget }),
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
