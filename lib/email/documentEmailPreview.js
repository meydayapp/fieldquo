// lib/email/documentEmailPreview.js
//
// The preview on Settings → Email templates → Document emails: the real
// builder, run against a real document of the company's, with the company's
// real brand — and the wording the company is looking at, saved or not.
//
// ── Why the real builder and a real document ────────────────────────────────
//
// A preview drawn by a second renderer against sample data is a picture of a
// different email. The owner's complaint was that these emails could not be
// SEEN; showing a lookalike would not fix that, it would add a thing to be
// wrong. So this loads the most recent quote (or invoice) the company has,
// exactly as the send route loads it, and calls buildQuoteEmail /
// buildInvoiceEmail with the same arguments — the only difference is the
// link, which points nowhere a client could act on.
//
// A company with no document yet gets a plausible sample one, said out loud
// (`sample: true`) so the page can label it.
//
// Reads only. Nothing here mints a share token, records a send or writes a
// row — a preview that left a footprint would be a send.

import { buildQuoteEmail } from "@/lib/email/quoteEmail";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { attachServiceSettings } from "@/lib/documents/loadServiceSettings";
import { loadDocumentCustomFields } from "@/lib/customFields/values";
import { QuoteEmailSectionsIncomplete } from "@/lib/quotes/emailSections";
import { documentEmailKind, chooseWording } from "@/lib/email/documentEmailWording";
import { getAppOrigin } from "@/lib/appUrl";

const SAMPLE_CLIENT = { name: "Jane Doe", email: "jane@example.com", phone: "(416) 555-0142", address: "123 Maple Street, Toronto, ON" };

function sampleQuote() {
  return {
    id: "sample",
    quoteNumber: "Q-1042",
    total: 4250,
    subtotal: 3900,
    tax: 350,
    validUntil: new Date(Date.now() + 30 * 86400000),
    createdAt: new Date(),
    lineItems: [
      { name: "Cabinet doors & drawer fronts — spray refinish", quantity: 24, unitPrice: 125, total: 3000 },
      { name: "Cabinet boxes — on-site refinish", quantity: 1, unitPrice: 750, total: 750 },
      { name: "Premium hardware replacement", quantity: 24, unitPrice: 6.25, total: 150 },
    ],
    processNotes: null,
    emailReferences: null,
    emailBeforeAfter: null,
    emailIncludeReferences: null,
    emailIncludeBeforeAfter: null,
    customFields: [],
    client: SAMPLE_CLIENT,
  };
}

function sampleInvoice(kind) {
  const total = 4250;
  const paid = kind === "receipt" ? total : kind === "deposit" ? 0 : 1275;
  return {
    id: "sample",
    invoiceNumber: "INV-1042",
    total,
    amountPaid: paid,
    dueDate: new Date(Date.now() + 14 * 86400000),
    createdAt: new Date(),
    lineItems: sampleQuote().lineItems,
    customFields: [],
    client: SAMPLE_CLIENT,
  };
}

/**
 * The wording object the builders take, from what the page is showing: a
 * copy being edited (saved or not), or the original.
 */
function wordingFor(copy) {
  if (!copy) return chooseWording({ copy: null });
  return chooseWording({
    copy: {
      isDefault: true,
      sections: [{ id: "wording", type: "documentWording", ...(copy.slots || {}) }],
      sentMode: copy.sentMode,
      canvas: copy.canvas || null,
    },
  });
}

/**
 * @param copy  { slots, sentMode, canvas } to preview, or null for the original
 * @returns {{ subject, html, text, document: { number, sample }, language }}
 */
export async function renderDocumentEmailPreview(db, { companyId, kind, language = "en", copy = null, request = null }) {
  const meta = documentEmailKind(kind);
  if (!meta) throw new Error(`Unknown document email: ${kind}`);
  // The whole row, not a select: buildQuoteEmail's assertSectionFieldsLoaded
  // refuses a company row missing the section columns, and the footer reads
  // contact, tax id, website and payment methods.
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Company not found");
  const wording = wordingFor(copy);
  let origin = "https://example.com";
  try {
    origin = getAppOrigin(request);
  } catch {
    // No configured origin (a check script): the link is a placeholder anyway.
  }

  if (meta.builder === "quote") {
    const recent = await db.quote.findFirst({
      where: { companyId, historicalImportedAt: null },
      orderBy: { createdAt: "desc" },
      include: { client: true },
    });
    const sample = !recent;
    const quote = recent || sampleQuote();
    const scopeGroups = recent
      ? await attachServiceSettings(
          db,
          companyId,
          await db.quoteScopeGroup.findMany({
            where: { quoteId: quote.id },
            include: { category: true },
            orderBy: { sortOrder: "asc" },
          }),
        )
      : [];
    const customFields = recent ? await loadDocumentCustomFields(db, companyId, "quote", quote.id) : [];
    const args = {
      quote: { ...quote, customFields },
      client: quote.client,
      company,
      url: `${origin}/q/preview`,
      scopeGroups,
      kind: "quote",
      language,
      wording,
    };
    let built;
    try {
      built = buildQuoteEmail(args);
    } catch (err) {
      // An optional section switched on with nothing in it blocks a SEND
      // (the route answers 409 and names it). A preview of the wording
      // should still render, so the sections are shown off for the preview
      // only, and the page says which ones.
      if (!(err instanceof QuoteEmailSectionsIncomplete)) throw err;
      built = buildQuoteEmail({
        ...args,
        quote: { ...args.quote, emailIncludeReferences: false, emailIncludeBeforeAfter: false },
      });
      built.sectionsOmitted = true;
    }
    return { ...built, language, document: { number: quote.quoteNumber, sample } };
  }

  const recent = await db.invoice.findFirst({
    where: { companyId, historicalImportedAt: null, status: { not: "draft" } },
    orderBy: { createdAt: "desc" },
    include: { client: true },
  });
  const sample = !recent;
  const invoice = recent || sampleInvoice(kind);
  const customFields = recent ? await loadDocumentCustomFields(db, companyId, "invoice", invoice.id) : [];
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.amountPaid || 0);
  // A receipt previews as paid in full, a deposit request as asking for a
  // stage's share — the figures the wording would sit beside for real.
  const shaped =
    kind === "receipt"
      ? { ...invoice, amountPaid: total }
      : invoice;
  const built = buildInvoiceEmail({
    invoice: { ...shaped, customFields },
    client: invoice.client || SAMPLE_CLIENT,
    company,
    url: `${origin}/portal/preview`,
    canTakeCard: Boolean(company.stripeAccountId && company.stripeChargesEnabled),
    kind: meta.builderKind,
    language,
    wording,
    ...(kind === "deposit" && { requestAmount: Math.max(1, Math.round(Math.max(0, total - paid) * 0.5)), note: "Deposit" }),
  });
  return { ...built, language, document: { number: invoice.invoiceNumber, sample } };
}
