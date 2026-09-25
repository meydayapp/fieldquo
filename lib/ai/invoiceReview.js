// lib/ai/invoiceReview.js
//
// Reviews an invoice before it goes out — lib/ai/quoteReview.js's twin, for
// the document that bills.
//
// ── The same split, and why ─────────────────────────────────────────────────
//
// Computed in code   what is missing (lib/invoices/completeness.js): the due
//                    date, the tax, the $0 lines, the total against the
//                    accepted quote. Zero tokens. Always runs.
// Asked of a model   the writing only: a line a client would not recognise
//                    on their bill, rewritten in plain words. One call,
//                    strict JSON back, no number of any kind in the schema.
//
// If the model call fails or AI is switched off, the review still returns
// everything computed in code. There is no price comparison here — the price
// on an invoice was agreed on the quote, and it is not this pass's job to
// second-guess an agreement — and no add-ons: a bill offers nothing extra.
//
// ── Photographs ─────────────────────────────────────────────────────────────
//
// Text only, as the quote's free review is (2026-09-15 rule). The invoice's
// photos are COUNTED so the panel can point at the paid deep read
// (app/api/invoices/[id]/deep-read/route.js), never read here.

import { db } from "@/lib/db";
import { complete, isAiConfigured } from "./provider";
import { photosFromQuote } from "./quoteReview";
import { invoiceCompletenessChecks, invoiceReadinessScore } from "@/lib/invoices/completeness";

const num = (v) => Number(v ?? 0);

/**
 * Strict output: rewrites only. No money, no counts — the model is shown
 * the lines so it can write about clarity, not so it can do arithmetic
 * about them.
 */
const WRITING_SCHEMA = {
  type: "object",
  properties: {
    rewrites: {
      type: "array",
      description: "Only for lines a client would not recognise on their bill. Empty is common.",
      items: {
        type: "object",
        properties: {
          from: { type: "string", description: "The exact original text." },
          to: { type: "string", description: "The plain-language rewrite." },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
  },
  required: ["rewrites"],
  additionalProperties: false,
};

const WRITING_SYSTEM = `You are reading a contractor's INVOICE before it is emailed to the client — the
bill for work that was quoted, accepted and done.

You will be given the invoice's lines (name and, where there is one, the
detail printed under it), the notes printed on the document, and — when the
invoice was raised from a quote — the quote's services with the scope
paragraph the client already read and agreed to.

Return a JSON object with one key, "rewrites": a list of { from, to }.

Rules:
- Rewrite ONLY a line a homeowner genuinely would not recognise as the work
  they agreed to: an internal code, a bare "Labour", a supplier's part name.
  A line that repeats the quote's own wording is fine as it is.
- Keep every rewrite short and factual. Never add a promise, a warranty, a
  timeline or a price the line did not carry.
- Never invent a quantity, a measurement or a material.
- An empty list is a real and useful answer.
- Plain trade English, in the language of the lines you were given.`;

/**
 * Everything the review needs, in one round trip. Exported so the paid deep
 * read loads the exact same row (app/api/invoices/[id]/deep-read/route.js).
 */
export async function loadInvoice(invoiceId, companyId) {
  return db.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: {
      client: { select: { name: true, email: true, phone: true } },
      company: { select: { currency: true } },
      // The accepted figure and the services' own scope, for the checks and
      // for the writing pass — an invoice raised from a quote is judged
      // against the words the client already agreed to.
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          total: true,
          acceptedTotal: true,
          scopeGroups: {
            select: { label: true, lineItems: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
}

/** The lines as prose context — the shape lib/ai/visionPass.js reads for a quote's services. */
export function invoiceServicesContext(invoice) {
  const lines = Array.isArray(invoice?.lineItems) ? invoice.lineItems : [];
  return lines
    .filter((li) => li && typeof li === "object" && String(li.description || li.name || "").trim())
    .map((li) => ({
      name: String(li.description || li.name),
      scope: li.detail ? String(li.detail) : null,
      included: [],
      process: [],
    }));
}

async function writingPass({ invoice, items, onUsage }) {
  if (!isAiConfigured()) return {};
  const payload = {
    lineItems: items
      .filter((li) => li?.description || li?.name)
      .map((li) => ({
        name: String(li.description || li.name),
        ...(li.detail ? { detail: String(li.detail) } : {}),
      })),
    ...(invoice.notes?.trim() ? { documentNotes: invoice.notes.trim() } : {}),
    ...(invoice.quote
      ? {
          quote: {
            number: invoice.quote.quoteNumber || null,
            services: (invoice.quote.scopeGroups || []).map((g) => ({
              name: g.label || null,
              lines: (Array.isArray(g.lineItems) ? g.lineItems : [])
                .map((l) => l?.description)
                .filter(Boolean),
            })),
          },
        }
      : {}),
    language: invoice.language || "en",
  };
  const result = await complete({
    system: WRITING_SYSTEM,
    prompt: JSON.stringify(payload),
    onUsage,
    schema: WRITING_SCHEMA,
    schemaName: "invoice_review_writing",
  });
  if (!result.ok) return {};
  return { rewrites: Array.isArray(result.data.rewrites) ? result.data.rewrites : [] };
}

/**
 * @param onUsage  passed straight through to the provider so the route can
 *                 meter it (recordAiUsage) — this module never touches
 *                 AiUsage itself, the same separation as quoteReview.js.
 * @returns the review object, or null if the invoice isn't this company's.
 */
export async function reviewInvoice({ companyId, invoiceId, onUsage }) {
  const invoice = await loadInvoice(invoiceId, companyId);
  if (!invoice) return null;

  const items = (Array.isArray(invoice.lineItems) ? invoice.lineItems : []).filter(
    (li) => li && typeof li === "object",
  );
  // Computed first and independently, so a model failure cannot take it out.
  const checks = invoiceCompletenessChecks(invoice, items);
  const writing = await writingPass({ invoice, items, onUsage });

  return {
    generatedAt: new Date().toISOString(),
    invoiceTotal: num(invoice.total),
    currency: invoice.company?.currency || null,
    checks,
    rewrites: writing.rewrites || [],
    // Counted, never read — the deep read is what reads them.
    photosAttached: photosFromQuote(invoice).length,
    readiness: invoiceReadinessScore(checks),
  };
}
