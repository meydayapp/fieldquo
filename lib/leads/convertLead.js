// lib/leads/convertLead.js
//
// Convert a lead into a DRAFT quote — the real version of the "Start quote"
// button that used to just link to a blank new-quote page and drop the lead's
// name, category, photos and answers on the floor. This carries all of it onto
// the quote and links the two, so the lead reads "quoted" and the quote traces
// back to who asked. It deliberately does NOT advance the lead's status — see
// the note at the update below. Idempotent: a lead already linked to a quote
// returns that quote instead of spawning a second.
//
// The quote lands in `draft` with a zero total — nobody has priced it yet, and a
// number the homeowner could see that the contractor never agreed to is exactly
// what the "lead not quote" rule exists to prevent. The estimator opens it with
// the client, category and the homeowner's own words already filled in.

import { db } from "@/lib/db";
import { nextQuoteNumberForCompany } from "@/lib/quotes/quoteNumber";
import { BUDGET_LABELS_EN, TIMELINE_LABELS_EN } from "@/lib/leads/qualifiers";
import { normaliseCountry } from "@/lib/tax/jurisdictions";

function buildQuoteNotes(lead) {
  const lines = [];
  if (lead.budgetBand && lead.budgetBand !== "unsure" && BUDGET_LABELS_EN[lead.budgetBand])
    lines.push(`Budget: ${BUDGET_LABELS_EN[lead.budgetBand]}`);
  if (lead.timeline && TIMELINE_LABELS_EN[lead.timeline])
    lines.push(`Timeline: ${TIMELINE_LABELS_EN[lead.timeline]}`);
  if (lead.message) lines.push(lead.message);
  return lines.length ? lines.join("\n") : null;
}

// Match an existing client (email first, then phone) before creating one, so
// converting a repeat enquirer doesn't spawn a duplicate client record.
async function findOrCreateClient(companyId, lead) {
  const email = lead.email ? String(lead.email).trim().toLowerCase() : null;
  const phone = lead.phone ? String(lead.phone).trim() : null;
  if (email) {
    const hit = await db.client.findFirst({ where: { companyId, email }, select: { id: true } });
    if (hit) return hit.id;
  }
  if (phone) {
    const hit = await db.client.findFirst({ where: { companyId, phone }, select: { id: true } });
    if (hit) return hit.id;
  }
  // The intake blob carries the address the public form captured, and — since
  // the self-quote form stopped discarding them — the city, province and
  // country Google Places returned alongside it. Reading only `address` here
  // meant a lead with a perfectly structured Ontario address converted into a
  // client the tax resolver could say nothing about, which is most of how
  // production ended up with 55 clients and zero countries.
  const intake =
    lead.intake && typeof lead.intake === "object" ? lead.intake : {};
  const created = await db.client.create({
    data: {
      companyId,
      name: lead.name || "Website enquiry",
      email: lead.email || null,
      phone: lead.phone || null,
      address: intake.address || null,
      city: intake.city || null,
      province: intake.province || null,
      // Normalised rather than trusted: `intake` is a Json column ultimately
      // fed by a public form, and a country that isn't ISO alpha-2 is worse
      // than none — it would sit in the column looking authoritative while
      // every lookup missed it.
      country: normaliseCountry(intake.country),
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * @param {object} p
 * @param {object} p.lead     LeadRequest row (needs id, companyId, name, email,
 *                            phone, categoryId, message, budgetBand, timeline,
 *                            clientPhotos, intake, language, quoteId)
 * @param {{userId:string}} p.member
 * @param {{id:string, defaultLanguage?:string}} p.company
 * @returns {{ quote:{id:string,quoteNumber:string}, created:boolean }}
 */
export async function convertLeadToQuote({ lead, member, company }) {
  if (lead.quoteId) {
    const existing = await db.quote.findUnique({
      where: { id: lead.quoteId },
      select: { id: true, quoteNumber: true },
    });
    if (existing) return { quote: existing, created: false };
  }

  const clientId = await findOrCreateClient(company.id, lead);
  const quoteNumber = await nextQuoteNumberForCompany(db, company.id);
  const photos = Array.isArray(lead.clientPhotos) ? lead.clientPhotos : [];

  const quote = await db.quote.create({
    data: {
      companyId: company.id,
      quoteNumber,
      clientId,
      createdById: member.userId,
      // The homeowner's own choice wins over the company default. They picked
      // a language on the public form and everything they have been sent since
      // has been in it; converting their enquiry into a quote written in the
      // contractor's language would silently switch it back at the exact
      // moment the document starts to matter. Null (never asked) falls back.
      language: lead.language || company.defaultLanguage || "en",
      subtotal: 0,
      total: 0,
      notes: buildQuoteNotes(lead),
      ...(photos.length ? { clientPhotos: photos } : {}),
      ...(lead.categoryId
        ? {
            scopeGroups: {
              create: [
                {
                  categoryId: lead.categoryId,
                  label: null,
                  lineItems: null,
                  subtotal: 0,
                  sortOrder: 0,
                },
              ],
            },
          }
        : {}),
    },
    select: { id: true, quoteNumber: true },
  });

  // Link the two, but do NOT declare the lead won here.
  //
  // This used to set status "converted", which the leads board renders as
  // "Won" (app/app/leads/page.js). Drafting a quote is not winning the work:
  // the quote is unpriced, unsent, and the homeowner has not seen it. Every
  // converted lead jumped straight to the Won column and could never pass
  // through "Contacted", so the board stopped describing the pipeline and the
  // win figures counted quotes nobody had answered.
  //
  // The lead now follows the quote's actual fate instead, in
  // lib/quotes/quoteLifecycle.js: sent → contacted, accepted → converted/Won,
  // declined → lost. `quoteId` is what marks a lead as already quoted, and it
  // is set here where it belongs.
  await db.leadRequest.update({
    where: { id: lead.id },
    data: { quoteId: quote.id },
  });

  return { quote, created: true };
}
