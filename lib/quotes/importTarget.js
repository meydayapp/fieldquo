// lib/quotes/importTarget.js
//
// "Start a new quote" on the add-this-price page (app/q/[token]/add): the
// contractor has no open quote for this job yet — often they signed up a
// minute ago for exactly this — so the price needs a quote to land on.
//
// A quote needs a client (Quote.clientId is required), and a client is not
// something to invent. So the page asks for the one thing it cannot know —
// who the contractor is quoting, and whether that is a homeowner or a
// business — and nothing is defaulted in its place: no "New client", no
// assumed homeowner. The rest of the draft is what POST /api/quotes would
// write for an empty save: the company's language, its default "what happens
// next" wording, its e-transfer/cheque offer frozen at creation, a share
// token, and createdVia "staff" (a signed-in member did this, and
// scripts/check-conversation-review.mjs reads every quote.create for it).
//
// The quote is a DRAFT. The contractor finishes it in the builder — the
// success card links there — and nothing is sent to anybody from here.

import { nextQuoteNumberForCompany } from "@/lib/quotes/quoteNumber";
import { requireCreatedVia } from "@/lib/quotes/createdVia";
import { mintShareToken } from "@/lib/quotes/shareToken";
import { offlineDiscountPctFor } from "@/lib/payments/offlineDiscount";
import { NEW_IMPORT_TARGET } from "@/lib/quotes/addToQuoteLink";

export const NEW_TARGET = NEW_IMPORT_TARGET;
const CLIENT_TYPES = new Set(["individual", "company"]);

/**
 * Validate what the page sent for a new quote's client. Pure.
 * @returns {{ data?: { name, type }, error?: string }}
 */
export function parseNewClient(input) {
  const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ").slice(0, 160) : "";
  if (!name) return { error: "Who is the quote for? Add your client's name." };
  const type = input?.type;
  if (!CLIENT_TYPES.has(type)) return { error: "Say whether your client is a homeowner or a business." };
  return { data: { name, type } };
}

/**
 * Create the client and an empty draft quote for them, in one transaction.
 * The quote number is the company's next, retried once on the unique index
 * the way two estimators saving at once would need.
 *
 * @returns the new quote, with scopeGroups (empty) — ready for performImport
 */
export async function createImportTargetQuote(db, { member, client }) {
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      defaultLanguage: true,
      defaultProcessNotes: true,
      country: true,
      province: true,
      address: true,
      paymentMethods: true,
      offlinePaymentDiscount: true,
    },
  });
  if (!company) throw Object.assign(new Error("Company not found."), { status: 404 });

  for (let attempt = 0; attempt < 2; attempt++) {
    const quoteNumber = await nextQuoteNumberForCompany(db, member.companyId);
    try {
      return await db.$transaction(async (tx) => {
        const row = await tx.client.create({
          data: { companyId: member.companyId, name: client.name, type: client.type },
          select: { id: true },
        });
        return tx.quote.create({
          data: {
            companyId: member.companyId,
            clientId: row.id,
            quoteNumber,
            createdById: member.userId,
            createdVia: requireCreatedVia("staff"),
            shareToken: mintShareToken(),
            language: company.defaultLanguage || "en",
            processNotes: company.defaultProcessNotes || null,
            offlineDiscountPct: offlineDiscountPctFor(company),
          },
          include: { scopeGroups: true },
        });
      });
    } catch (err) {
      if (err?.code === "P2002" && attempt === 0) continue;
      throw err;
    }
  }
  return null;
}
