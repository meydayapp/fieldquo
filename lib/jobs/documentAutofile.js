// lib/jobs/documentAutofile.js
//
// The documents a job is BORN with, and the ones it collects as it is billed.
//
// ══ Why ════════════════════════════════════════════════════════════════════
//
// The owner: "the job should have the original quote, the approved contract
// and invoice as part of the documents." Until this file, the only writer of
// a job's Documents was the upload form on the job page. The signed PDF was
// rendered once, on acceptance, emailed to the client and the owner, and then
// existed nowhere FieldQuo could show — an office looking for "what did they
// actually sign" had to find the email.
//
// Three moments file something, and this file is the only place that does:
//
//   acceptance     — both doors (the client's signature on /q/[token] and a
//                    staff member's "They approved" on the quote page) run
//                    onQuoteAccepted, which calls fileAcceptanceDocuments
//                    once the job exists. Two rows: the quote AS SENT (kind
//                    "quote") and the quote AS SIGNED (kind "contract").
//   invoice send   — POST /api/invoices/[id]/send calls
//                    fileSentInvoiceDocument after the send is accepted. One
//                    row per send; the next send supersedes the last.
//   backfill       — the first GET of an older job's Documents calls
//                    fileAcceptanceDocuments with source "backfill", so a
//                    job accepted before this existed catches up the first
//                    time anyone looks, and never in a mass script.
//
// ══ Contract ═══════════════════════════════════════════════════════════════
//
// NOTHING here throws into a caller. An acceptance is already committed by
// the time this runs, and a homeowner mid-signature must never see "Approve"
// fail because a PDF engine hiccuped. Every failure is a PlatformErrorLog row
// (area "job_documents") and a null in the result; the caller's own activity
// row and emails go ahead regardless.
//
// Every write is idempotent by a DATABASE key, not by a read-then-write:
// JobDocument has @@unique([sourceQuoteId, kind, documentHash]) and the same
// for sourceInvoiceId. The hash is of the document's CONTENT — hashQuote() for
// a quote, hashInvoiceDocument() below for an invoice — never of the PDF
// bytes, which differ on every render (@react-pdf stamps a creation date).
// Two concurrent acceptances both render; the second's create hits P2002 and
// is counted as "already filed", which is exactly what it is.
//
// Nothing is ever updated or deleted. A re-send is a NEW row with
// supersedesId pointing at the previous one — the revision rule the store
// already has (lib/jobs/documents.js) — so "which invoice did they get in
// March" stays answerable.
//
// ══ The seams ══════════════════════════════════════════════════════════════
//
// `deps` lets scripts/check-job-documents-autofile.mjs execute every branch
// against an in-memory client with a fake renderer and a fake uploader. The
// production defaults are the real db, the real PDF renderer
// (lib/jobs/documentRenderers.js, which imports @react-pdf lazily) and
// Cloudinary. No production caller passes deps.

import { db as realDb } from "@/lib/db";
import { createHash } from "node:crypto";
import { hashQuote } from "@/lib/documents/signatureAudit";
import { isUploadedUrl, revisionChains } from "@/lib/jobs/documents";
import { resolveInvoiceJob } from "@/lib/invoices/jobLink";
import { familyMembers } from "@/lib/invoices/family";

/** JobDocument.source values. A hand upload has null. */
export const AUTOFILE_SOURCES = Object.freeze({
  acceptance: "acceptance",
  invoiceSend: "invoice_send",
  backfill: "backfill",
  // A file somebody uploaded on the QUOTE (a drawing set, a scope sheet, a
  // permit, a site photo — QuoteDocument), carried onto the job by
  // fileQuoteDocumentsOnJob below.
  quoteUpload: "quote_upload",
});

const PDF_MIME = "application/pdf";

// ═══════════════════════════════════════════════════════════════════════════
// PURE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The digest that makes one SEND of an invoice one document.
 *
 * Deliberately includes `sentAt`. Two sends of a byte-identical invoice are
 * two events — the client got it twice, on two dates — and the store's
 * revision rule says the second supersedes the first. What the hash must
 * refuse is the same send filed twice: a retried request, a double-clicked
 * button, the send route re-run against a row whose sentAt has not moved.
 * Those share a sentAt and collapse onto one key.
 */
export function hashInvoiceDocument(invoice) {
  const i = invoice || {};
  const str = (v) => (v == null ? null : String(v));
  const sentAt =
    i.sentAt instanceof Date ? i.sentAt.toISOString() : str(i.sentAt);
  return createHash("sha256")
    .update(
      JSON.stringify([
        ["invoiceNumber", i.invoiceNumber ?? null],
        ["version", i.version ?? null],
        ["subtotal", str(i.subtotal)],
        ["tax", str(i.tax)],
        ["total", str(i.total)],
        ["amountPaid", str(i.amountPaid)],
        ["lineItems", i.lineItems ?? null],
        ["sentAt", sentAt],
      ]),
    )
    .digest("hex");
}

/** The two quote-born documents and their content keys. Pure. */
export function acceptanceDocumentPlan(quote) {
  const contentHash = hashQuote(quote);
  const signed = Boolean(quote?.signature && typeof quote.signature === "object");
  return {
    quote: { kind: "quote", documentHash: contentHash },
    contract: {
      kind: "contract",
      // The signature record already names the exact content that was signed
      // (buildSignatureRecord → hashQuote of the priced snapshot). Reusing it
      // lines the filed contract up with the evidence trail: the same hash on
      // Quote.signature.documentHash and on the JobDocument row.
      documentHash: (signed && quote.signature.documentHash) || contentHash,
      signed,
    },
  };
}

/**
 * Which of the two quote documents are still to be filed.
 *
 * `existing` is the job's rows for this quote (kind + documentHash). For a
 * BACKFILL, `anyOfKind` is the set of kinds the job already holds from ANY
 * source: an office that uploaded the signed contract by hand last month has
 * a contract, and filing a second one because the first lacks our stamp is
 * the duplicate the owner would notice first.
 */
export function pendingAcceptanceDocuments(plan, existing, { source, contractRequiresSignature, anyOfKind = new Set() }) {
  const have = new Set((existing || []).map((r) => `${r.kind}:${r.documentHash}`));
  const out = [];
  for (const entry of [plan.quote, plan.contract]) {
    if (have.has(`${entry.kind}:${entry.documentHash}`)) continue;
    if (source === AUTOFILE_SOURCES.backfill && anyOfKind.has(entry.kind)) continue;
    if (entry.kind === "contract" && contractRequiresSignature && !entry.signed) continue;
    out.push(entry);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTION SEAMS
// ═══════════════════════════════════════════════════════════════════════════

async function defaultRender(kind, ctx) {
  const { renderQuoteDocumentPdf, renderInvoiceDocumentPdf } =
    await import("@/lib/jobs/documentRenderers");
  if (kind === "invoice") return renderInvoiceDocumentPdf(ctx);
  return renderQuoteDocumentPdf({ ...ctx, variant: kind === "contract" ? "signed" : "as_sent" });
}

async function defaultUpload(buffer, { folder, publicId }) {
  const { uploadBuffer } = await import("@/lib/cloudinary");
  const uploaded = await uploadBuffer(buffer, { folder, publicId, resourceType: "raw" });
  return { url: uploaded?.secure_url || null, bytes: uploaded?.bytes ?? null };
}

async function defaultRecordError(payload) {
  const { recordError, errorDetail } = await import("@/lib/platform/errorLog");
  const { err, ...rest } = payload;
  return recordError({ ...rest, detail: errorDetail(err, rest.detail || {}) });
}

async function defaultSentence(language, key, params) {
  const { appSentence } = await import("@/lib/notify/push");
  return appSentence(language, key, params);
}

function resolveDeps(deps) {
  return {
    db: deps.db || realDb,
    render: deps.render || defaultRender,
    upload: deps.upload || defaultUpload,
    recordError: deps.recordError || defaultRecordError,
    sentence: deps.sentence || defaultSentence,
    cloudName: deps.cloudName ?? process.env.CLOUDINARY_CLOUD_NAME,
  };
}

/** A stored title is written once, in the office's language — same rule as lib/tasks/autoCreate.js. */
async function titleFor(d, companyLanguage, key, params) {
  const text = await d.sentence(companyLanguage || "en", key, params).catch(() => null);
  return (text && String(text).trim()) || `${params.fallback || ""} ${params.number || ""}`.trim();
}

/**
 * Render, upload and file one row. Returns the row, or null after logging.
 *
 * P2002 is the one error that is NOT a failure: the unique key says another
 * request filed this exact document a moment ago. Counted as skipped.
 */
async function fileOne(d, { kind, name, buffer, companyId, jobId, folder, publicId, hash, source, byUserId, quoteId = null, invoiceId = null, supersedesId = null, errorContext }) {
  try {
    const uploaded = await d.upload(buffer, { folder, publicId });
    if (!isUploadedUrl(uploaded?.url, { cloudName: d.cloudName })) {
      // The same rule the upload form's POST applies: a row whose url is not
      // on this deployment's own cloud is a link filed inside the back office
      // that the office did not choose. Refused here rather than trusted
      // because the uploader was the thing that answered.
      throw Object.assign(new Error("Uploader answered with a URL that is not on this deployment's own cloud"), { code: "not_our_cloud" });
    }
    const row = await d.db.jobDocument.create({
      data: {
        companyId,
        jobId,
        name,
        kind,
        url: uploaded.url,
        sizeBytes: Number.isInteger(uploaded.bytes) && uploaded.bytes > 0 ? uploaded.bytes : buffer?.length || null,
        mimeType: PDF_MIME,
        supersedesId,
        uploadedById: byUserId || null,
        source,
        sourceQuoteId: quoteId,
        sourceInvoiceId: invoiceId,
        documentHash: hash,
      },
      select: { id: true, kind: true, name: true, url: true, supersedesId: true, documentHash: true },
    });
    return { row, skipped: false };
  } catch (err) {
    if (err?.code === "P2002") return { row: null, skipped: true };
    await d.recordError({
      area: "job_documents",
      code: `${kind}_autofile_failed`,
      message: `Could not file the ${kind} on the job: ${err?.message || "unknown"}`,
      companyId,
      detail: { jobId, quoteId, invoiceId, source, ...errorContext },
      err,
    });
    return { row: null, skipped: false, failed: true };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCEPTANCE — the quote as sent, and the quote as signed
// ═══════════════════════════════════════════════════════════════════════════

const QUOTE_SELECT = {
  id: true,
  companyId: true,
  clientId: true,
  quoteNumber: true,
  status: true,
  subtotal: true,
  tax: true,
  discount: true,
  total: true,
  acceptedSubtotal: true,
  acceptedTax: true,
  acceptedTotal: true,
  lineItems: true,
  signature: true,
  language: true,
  notes: true,
  validUntil: true,
  createdAt: true,
  sentAt: true,
  acceptedAt: true,
  client: true,
  scopeGroups: { orderBy: { sortOrder: "asc" }, include: { category: true } },
  addOns: { orderBy: { sortOrder: "asc" } },
  company: { select: { defaultLanguage: true } },
};

/**
 * File the quote (as sent) and the contract (as signed) on the job an
 * acceptance created.
 *
 * @param {object} p
 * @param {string} p.quoteId
 * @param {string} p.jobId              must be THIS quote's job in THIS tenant
 * @param {string} [p.source]           "acceptance" | "backfill"
 * @param {string|null} [p.byUserId]    the staff member, on the back-office door
 * @param {Buffer|null} [p.signedPdf]   the signed PDF the public route already
 *                                      rendered for the emails, so acceptance
 *                                      does not render it twice
 * @param {boolean} [p.contractRequiresSignature]  true for a backfill: an old
 *                                      by-hand acceptance has no signature and
 *                                      the backfill's brief is signed contracts
 * @returns {Promise<{filed: object[], skipped: string[], failed: string[], refused: string|null}>}
 */
export async function fileAcceptanceDocuments(
  { quoteId, jobId, source = AUTOFILE_SOURCES.acceptance, byUserId = null, signedPdf = null, contractRequiresSignature = false },
  deps = {},
) {
  const d = resolveDeps(deps);
  const result = { filed: [], skipped: [], failed: [], refused: null };
  if (!quoteId || !jobId) {
    result.refused = "missing_ids";
    return result;
  }

  let quote;
  let job;
  try {
    quote = await d.db.quote.findUnique({ where: { id: quoteId }, select: QUOTE_SELECT });
    if (!quote || quote.status !== "accepted") {
      result.refused = quote ? "not_accepted" : "no_quote";
      return result;
    }
    // The job must be this quote's own, in this quote's own tenant. Checked
    // by the query, not by comparing ids after the fact: a jobId from another
    // company matches nothing and nothing is rendered for it.
    job = await d.db.job.findFirst({
      where: { id: jobId, companyId: quote.companyId, quoteId: quote.id },
      select: { id: true, companyId: true },
    });
    if (!job) {
      result.refused = "job_not_for_quote";
      return result;
    }
  } catch (err) {
    await d.recordError({
      area: "job_documents",
      code: "acceptance_autofile_read_failed",
      message: `Could not read the quote or job before filing: ${err?.message || "unknown"}`,
      detail: { quoteId, jobId, source },
      err,
    });
    result.refused = "read_failed";
    return result;
  }

  const plan = acceptanceDocumentPlan(quote);

  let existing = [];
  let anyOfKind = new Set();
  try {
    existing = await d.db.jobDocument.findMany({
      where: { jobId: job.id, sourceQuoteId: quote.id },
      select: { kind: true, documentHash: true },
    });
    if (source === AUTOFILE_SOURCES.backfill) {
      const rows = await d.db.jobDocument.findMany({
        where: { jobId: job.id, kind: { in: ["quote", "contract"] } },
        select: { kind: true },
      });
      anyOfKind = new Set(rows.map((r) => r.kind));
    }
  } catch (err) {
    await d.recordError({
      area: "job_documents",
      code: "acceptance_autofile_read_failed",
      message: `Could not read the job's documents before filing: ${err?.message || "unknown"}`,
      companyId: quote.companyId,
      detail: { quoteId, jobId, source },
      err,
    });
    result.refused = "read_failed";
    return result;
  }

  const pending = pendingAcceptanceDocuments(plan, existing, { source, contractRequiresSignature, anyOfKind });
  for (const entry of [plan.quote, plan.contract]) {
    if (!pending.includes(entry)) result.skipped.push(entry.kind);
  }

  const language = quote.company?.defaultLanguage || "en";
  const folder = `fieldquo/${quote.companyId}/quotes`;

  for (const entry of pending) {
    const isContract = entry.kind === "contract";
    let buffer = null;
    try {
      buffer = isContract && signedPdf?.length ? signedPdf : await d.render(entry.kind, { db: d.db, quote });
      if (!buffer?.length) throw new Error("renderer returned an empty document");
    } catch (err) {
      await d.recordError({
        area: "job_documents",
        code: `${entry.kind}_render_failed`,
        message: `Could not render the ${entry.kind} for quote ${quote.quoteNumber}: ${err?.message || "unknown"}`,
        companyId: quote.companyId,
        detail: { quoteId, jobId, source },
        err,
      });
      result.failed.push(entry.kind);
      continue;
    }

    const name = isContract
      ? await titleFor(d, language, entry.signed ? "app.jobDocuments.autofile.signedContract" : "app.jobDocuments.autofile.approvedContract", { number: quote.quoteNumber, fallback: entry.signed ? "Signed contract —" : "Approved contract —" })
      : await titleFor(d, language, "app.jobDocuments.autofile.quote", { number: quote.quoteNumber, fallback: "Quote" });

    const { row, skipped, failed } = await fileOne(d, {
      kind: entry.kind,
      name,
      buffer,
      companyId: quote.companyId,
      jobId: job.id,
      folder,
      // The same key SHAPE the Download-PDF archive uses for the as-sent
      // quote (`${number}-${hash12}`) — one Cloudinary file when the two
      // hash the same content, and a harmless second one when they do not
      // (that route loads no add-ons). The signed copy gets its own key.
      publicId: isContract
        ? `${quote.quoteNumber}-signed-${entry.documentHash.slice(0, 12)}`
        : `${quote.quoteNumber}-${entry.documentHash.slice(0, 12)}`,
      hash: entry.documentHash,
      source,
      byUserId,
      quoteId: quote.id,
      errorContext: { quoteNumber: quote.quoteNumber },
    });
    if (row) result.filed.push(row);
    else if (skipped) result.skipped.push(entry.kind);
    else if (failed) result.failed.push(entry.kind);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// INVOICE SEND — one row per send, each superseding the last
// ═══════════════════════════════════════════════════════════════════════════

/**
 * File the invoice, as just sent, on the job it bills for.
 *
 * Only when the invoice HAS a job (Invoice.jobId, or the job its quote
 * became — lib/invoices/jobLink.js). An invoice with no job files nothing
 * and says so; it does not invent a job.
 *
 * @returns {Promise<{row: object|null, superseded: string|null, skipped: boolean, reason: string|null}>}
 */
export async function fileSentInvoiceDocument({ invoiceId, byUserId = null }, deps = {}) {
  const d = resolveDeps(deps);
  const out = { row: null, superseded: null, skipped: false, reason: null };
  if (!invoiceId) {
    out.reason = "missing_id";
    return out;
  }

  let invoice;
  let job;
  let family;
  try {
    invoice = await d.db.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true, company: { select: { defaultLanguage: true } } },
    });
    if (!invoice) {
      out.reason = "no_invoice";
      return out;
    }
    if (!invoice.sentAt) {
      // Filed AFTER the send route stamps sentAt — the hash is keyed on it.
      out.reason = "not_sent";
      return out;
    }
    job = await resolveInvoiceJob(d.db, invoice, invoice.companyId, { id: true, companyId: true });
    if (!job) {
      out.reason = "no_job";
      return out;
    }
    family = await familyMembers(d.db, invoice.id);
  } catch (err) {
    await d.recordError({
      area: "job_documents",
      code: "invoice_autofile_read_failed",
      message: `Could not read the invoice or its job before filing: ${err?.message || "unknown"}`,
      detail: { invoiceId },
      err,
    });
    out.reason = "read_failed";
    return out;
  }

  const hash = hashInvoiceDocument(invoice);
  const familyIds = (family?.length ? family : [{ id: invoice.id }]).map((m) => m.id);

  let head = null;
  try {
    const rows = await d.db.jobDocument.findMany({
      where: { jobId: job.id, kind: "invoice", sourceInvoiceId: { in: familyIds } },
      select: { id: true, kind: true, documentHash: true, supersedesId: true, sourceInvoiceId: true, uploadedAt: true },
    });
    if (rows.some((r) => r.sourceInvoiceId === invoice.id && r.documentHash === hash)) {
      out.skipped = true;
      out.reason = "already_filed";
      return out;
    }
    // The current revision across the whole family — an amended invoice (v2,
    // its own row) supersedes the document its v1 was sent as. Newest head
    // wins if a broken chain ever leaves two.
    const heads = revisionChains(rows).map((c) => c.current);
    heads.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    head = heads[0] || null;
  } catch (err) {
    await d.recordError({
      area: "job_documents",
      code: "invoice_autofile_read_failed",
      message: `Could not read the job's documents before filing: ${err?.message || "unknown"}`,
      companyId: invoice.companyId,
      detail: { invoiceId, jobId: job.id },
      err,
    });
    out.reason = "read_failed";
    return out;
  }

  let buffer;
  try {
    buffer = await d.render("invoice", { db: d.db, invoice });
    if (!buffer?.length) throw new Error("renderer returned an empty document");
  } catch (err) {
    await d.recordError({
      area: "job_documents",
      code: "invoice_render_failed",
      message: `Could not render invoice ${invoice.invoiceNumber} for the job's documents: ${err?.message || "unknown"}`,
      companyId: invoice.companyId,
      detail: { invoiceId, jobId: job.id },
      err,
    });
    out.reason = "render_failed";
    return out;
  }

  const name = await titleFor(d, invoice.company?.defaultLanguage, "app.jobDocuments.autofile.invoice", { number: invoice.invoiceNumber, fallback: "Invoice" });

  const { row, skipped } = await fileOne(d, {
    kind: "invoice",
    name,
    buffer,
    companyId: invoice.companyId,
    jobId: job.id,
    folder: `fieldquo/${invoice.companyId}/invoices`,
    publicId: `${invoice.invoiceNumber}-sent-${hash.slice(0, 12)}`,
    hash,
    source: AUTOFILE_SOURCES.invoiceSend,
    byUserId,
    invoiceId: invoice.id,
    supersedesId: head?.id || null,
    errorContext: { invoiceNumber: invoice.invoiceNumber },
  });
  if (row) {
    out.row = row;
    out.superseded = head?.id || null;
  } else if (skipped) {
    out.skipped = true;
    out.reason = "already_filed";
  } else {
    out.reason = "file_failed";
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUOTE UPLOADS — the drawings, scope sheet, permits and photos on the quote
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner (2026-10-03): the documents uploaded on a quote "carry properly
// to the JOB's Documents when the quote is approved", keeping their kind,
// name, size, type and revision chain. A QuoteDocument is the quote's own
// store (prisma/schema.prisma — why it is not a JobDocument with no job); this
// COPIES each row into the job's Documents:
//
//   • the same file: the job row points at the same uploaded URL — nothing is
//     re-uploaded, nothing is rendered;
//   • idempotent by the store's own unique key: documentHash "qd:<the quote
//     document's id>" under (sourceQuoteId, kind, documentHash), so a second
//     approval door, a retried webhook or the lazy backfill files nothing
//     twice;
//   • chains kept: a revised drawing on the quote supersedes its predecessor
//     there, and its job copy supersedes the predecessor's job copy. Copied
//     oldest first, so the predecessor's copy always exists when its
//     successor is filed.
//
// Runs on acceptance (lib/quotes/quoteLifecycle.js), when a file is added to a
// quote that already has its job, and lazily on the job's Documents GET.
// Never throws, like every function in this file.

/** documentHash for a quote upload's job copy. */
export function quoteUploadHash(quoteDocumentId) {
  return `qd:${quoteDocumentId}`;
}

/** Oldest-first along every revision chain: a row after its predecessor. Pure. */
export function quoteDocumentsInChainOrder(docs) {
  const list = (Array.isArray(docs) ? docs : []).filter((x) => x && typeof x.id === "string");
  const byId = new Map(list.map((x) => [x.id, x]));
  const out = [];
  const placed = new Set();
  const place = (doc, guard = new Set()) => {
    if (placed.has(doc.id) || guard.has(doc.id)) return;
    guard.add(doc.id);
    const prev = doc.supersedesId ? byId.get(doc.supersedesId) : null;
    if (prev) place(prev, guard);
    placed.add(doc.id);
    out.push(doc);
  };
  for (const doc of list) place(doc);
  return out;
}

export async function fileQuoteDocumentsOnJob({ quoteId, jobId }, deps = {}) {
  const d = resolveDeps(deps);
  const out = { filed: 0, present: 0, refused: null };
  if (!quoteId || !jobId) {
    out.refused = "missing_ids";
    return out;
  }
  try {
    const quote = await d.db.quote.findUnique({ where: { id: quoteId }, select: { id: true, companyId: true } });
    if (!quote) {
      out.refused = "no_quote";
      return out;
    }
    const job = await d.db.job.findFirst({
      where: { id: jobId, companyId: quote.companyId, quoteId: quote.id },
      select: { id: true },
    });
    if (!job) {
      out.refused = "job_not_for_quote";
      return out;
    }
    const docs = await d.db.quoteDocument.findMany({
      where: { companyId: quote.companyId, quoteId: quote.id },
      orderBy: { uploadedAt: "asc" },
      select: { id: true, name: true, kind: true, url: true, sizeBytes: true, mimeType: true, supersedesId: true, uploadedById: true },
    });
    if (!docs.length) return out;
    const existing = await d.db.jobDocument.findMany({
      where: { companyId: quote.companyId, jobId: job.id, sourceQuoteId: quote.id, source: AUTOFILE_SOURCES.quoteUpload },
      select: { id: true, documentHash: true },
    });
    const copyOf = new Map(existing.map((r) => [r.documentHash, r.id]));

    for (const doc of quoteDocumentsInChainOrder(docs)) {
      const hash = quoteUploadHash(doc.id);
      if (copyOf.has(hash)) {
        out.present += 1;
        continue;
      }
      // The URL rule the upload form applies (isUploadedUrl): a link to
      // anywhere else is not filed into the crew's Documents.
      if (!isUploadedUrl(doc.url, { cloudName: d.cloudName })) continue;
      const data = {
        companyId: quote.companyId,
        jobId: job.id,
        name: doc.name,
        kind: doc.kind,
        url: doc.url,
        sizeBytes: doc.sizeBytes ?? null,
        mimeType: doc.mimeType ?? null,
        supersedesId: doc.supersedesId ? copyOf.get(quoteUploadHash(doc.supersedesId)) || null : null,
        uploadedById: doc.uploadedById || null,
        source: AUTOFILE_SOURCES.quoteUpload,
        sourceQuoteId: quote.id,
        documentHash: hash,
      };
      try {
        const row = await d.db.jobDocument.create({ data, select: { id: true } });
        copyOf.set(hash, row.id);
        out.filed += 1;
      } catch (err) {
        if (err?.code !== "P2002") throw err;
        // Either another request filed this copy a moment ago (the hash key),
        // or the job copy of its predecessor was already revised by hand on
        // the job page (the supersedesId key). The first is done; the second
        // files it as its own chain rather than not at all.
        const twin = await d.db.jobDocument.findFirst({
          where: { companyId: quote.companyId, sourceQuoteId: quote.id, kind: doc.kind, documentHash: hash },
          select: { id: true },
        });
        if (twin) {
          copyOf.set(hash, twin.id);
          out.present += 1;
          continue;
        }
        const row = await d.db.jobDocument.create({ data: { ...data, supersedesId: null }, select: { id: true } });
        copyOf.set(hash, row.id);
        out.filed += 1;
      }
    }
  } catch (err) {
    await d.recordError({
      area: "job_documents",
      code: "quote_uploads_carry_failed",
      message: `Could not carry the quote's files onto the job: ${err?.message || "unknown"}`,
      detail: { quoteId, jobId },
      err,
    });
    out.refused = "failed";
  }
  return out;
}
