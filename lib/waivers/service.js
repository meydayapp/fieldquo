// lib/waivers/service.js
//
// Waivers in motion: attach one to a quote, a job or an invoice; sign it
// from the client's page; file the signed copy on the job; send the link.
//
// ── Attach = a pending DocumentSignature row ────────────────────────────────
//
// Attaching creates the row the client will sign, with its own public token
// (/w/[token]). One row per (document, target): attaching the same waiver
// to the same quote twice returns the existing row rather than a second
// thing to sign. A quote-attached waiver is shown INSIDE the quote's
// proposal page and blocks the quote's Accept until it is signed
// (app/api/public/quotes/[token] POST); a job- or invoice-attached waiver is
// sent as its own link.
//
// ── Sign = the server decides ───────────────────────────────────────────────
//
// `signWaiver` runs lib/waivers/signing.js buildWaiverSignature over what
// the browser posted; null there is a refusal here. Then, best-effort and in
// this order: render the PDF, file it on the job (when one exists yet),
// email the client a copy, notify the office. The signature is committed
// BEFORE any of those, so a mail failure can never make the client think
// their signature did not register — the same rule the quote acceptance
// route follows.
//
// ── Cost ────────────────────────────────────────────────────────────────────
//
// Sending a waiver link and the signed copy are Resend emails — the same
// class of send as the quote email, one each, nothing recurring. Both are
// through the company's own sender (white-label).

import { db as realDb } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";
import { buildWaiverSignature, newWaiverToken } from "@/lib/waivers/signing";
import { waiverIsSignable } from "@/lib/company/documents";
import { isUploadedUrl } from "@/lib/jobs/documents";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { recordActivity } from "@/lib/activity/log";

const PDF_MIME = "application/pdf";

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Attach a waiver to exactly one of a quote, a job or an invoice.
 * Returns the DocumentSignature row (existing or new).
 */
export async function attachWaiver({ companyId, documentId, quoteId = null, jobId = null, invoiceId = null, clientId = null, db = realDb }) {
  const targets = [quoteId, jobId, invoiceId].filter(Boolean);
  if (targets.length !== 1) {
    const err = new Error("Attach a waiver to one quote, job or invoice.");
    err.status = 400;
    throw err;
  }
  const doc = await db.companyDocument.findFirst({
    where: { id: documentId, companyId, archivedAt: null, type: "waiver" },
    select: { id: true, body: true },
  });
  if (!doc) {
    const err = new Error("That waiver isn't in this company's library.");
    err.status = 404;
    throw err;
  }
  if (!waiverIsSignable(doc.body)) {
    const err = new Error("This waiver has no acknowledgement lines yet — add at least one before attaching it.");
    err.status = 409;
    throw err;
  }
  const existing = await db.documentSignature.findFirst({
    where: { companyId, documentId, ...(quoteId ? { quoteId } : jobId ? { jobId } : { invoiceId }) },
  });
  if (existing) return existing;

  // The client behind the target, so the portal can list the signed copy.
  let resolvedClient = clientId;
  if (!resolvedClient) {
    if (quoteId) resolvedClient = (await db.quote.findFirst({ where: { id: quoteId, companyId }, select: { clientId: true } }))?.clientId || null;
    else if (jobId) resolvedClient = (await db.job.findFirst({ where: { id: jobId, companyId }, select: { clientId: true } }))?.clientId || null;
    else if (invoiceId) resolvedClient = (await db.invoice.findFirst({ where: { id: invoiceId, companyId }, select: { clientId: true } }))?.clientId || null;
  }

  return db.documentSignature.create({
    data: {
      companyId,
      documentId,
      token: newWaiverToken(),
      quoteId,
      jobId,
      invoiceId,
      clientId: resolvedClient,
      status: "pending",
    },
  });
}

/**
 * Attach every waiver the company marked "attach to quotes" to a new quote.
 * Called where a quote is created; idempotent through attachWaiver.
 */
export async function attachDefaultWaivers({ companyId, quoteId = null, jobId = null, invoiceId = null, db = realDb }) {
  const field = quoteId ? "attachToQuotes" : jobId ? "attachToJobs" : "attachToInvoices";
  const docs = await db.companyDocument.findMany({
    where: { companyId, archivedAt: null, type: "waiver", [field]: true },
    select: { id: true },
  });
  const rows = [];
  for (const d of docs) {
    try {
      rows.push(await attachWaiver({ companyId, documentId: d.id, quoteId, jobId, invoiceId, db }));
    } catch (err) {
      // An unsignable default (no acknowledgement lines) is skipped, not fatal:
      // a quote must not fail to save because a waiver draft is unfinished.
      console.warn("[waivers] default attach skipped:", err?.message);
    }
  }
  return rows;
}

/** The row a public token names, with what the page needs, or null. */
export async function loadWaiverByToken(token, { db = realDb } = {}) {
  if (!token) return null;
  return db.documentSignature.findUnique({
    where: { token },
    include: {
      document: { select: { id: true, title: true, body: true, archivedAt: true } },
      company: {
        select: {
          id: true, name: true, logoUrl: true, brandColor: true, phone: true, email: true,
          currency: true, defaultLanguage: true,
          emailDomain: true, emailDomainStatus: true, emailFromLocal: true,
        },
      },
    },
  });
}

/** "Q-2026-0142" / "INV-…" / the job's title — what the waiver is attached to. */
async function attachedToLabel(row, db) {
  if (row.quoteId) return (await db.quote.findUnique({ where: { id: row.quoteId }, select: { quoteNumber: true } }))?.quoteNumber || "";
  if (row.invoiceId) return (await db.invoice.findUnique({ where: { id: row.invoiceId }, select: { invoiceNumber: true } }))?.invoiceNumber || "";
  if (row.jobId) return (await db.job.findUnique({ where: { id: row.jobId }, select: { title: true } }))?.title || "";
  return "";
}

/** The client the waiver is for: name, email, language. */
async function clientOf(row, db) {
  if (!row.clientId) return null;
  return db.client.findUnique({ where: { id: row.clientId }, select: { name: true, email: true, language: true } });
}

/**
 * Sign. Returns { ok: true, row } or { ok: false, status, error, needsAll }.
 */
export async function signWaiver({ token, ticked, name, signatureDataUrl, consent, ip, userAgent, db = realDb }) {
  const row = await loadWaiverByToken(token, { db });
  if (!row || row.document?.archivedAt) return { ok: false, status: 404, error: "This link isn't valid. Ask for a new one." };
  if (row.status === "signed") return { ok: false, status: 409, error: "This waiver has already been signed.", signed: true };

  const record = buildWaiverSignature({
    document: row.document,
    ticked,
    name,
    signatureDataUrl,
    consent,
    ip,
    userAgent,
  });
  if (!record) {
    return {
      ok: false,
      status: 400,
      error: "Tick every acknowledgement, add your name, sign in the box and tick the agreement.",
      needsAll: true,
    };
  }

  const updated = await db.documentSignature.update({
    where: { id: row.id },
    data: {
      status: "signed",
      acknowledgements: record.acknowledgements,
      signature: record.signature,
      signedAt: new Date(record.signedAt),
      documentHash: record.documentHash,
    },
  });

  // Everything after this line is best-effort.
  try {
    await afterSigned({ row: { ...row, ...updated }, record, db });
  } catch (err) {
    console.error("[waivers] post-signature steps failed:", err?.message);
  }
  return { ok: true, row: updated };
}

/**
 * Render, file, email, log. Split out so a waiver signed on a quote before
 * its job existed can be filed later (fileSignedWaiversForJob).
 */
async function afterSigned({ row, record, db }) {
  const client = await clientOf(row, db);
  const language = resolveClientLanguage({ document: {}, client: client || {}, company: row.company || {} });
  const attachedTo = await attachedToLabel(row, db);

  let pdf = null;
  try {
    const { renderWaiverPdf } = await import("@/lib/waivers/pdf");
    pdf = await renderWaiverPdf({ company: row.company || {}, document: row.document, record, language, attachedTo });
  } catch (err) {
    console.error("[waivers] PDF render failed:", err?.message);
  }

  const jobId = await jobFor(row, db);
  if (jobId && pdf?.length) {
    await fileOnJob({ row, jobId, pdf, db });
  }

  // The client's copy — through the company's sender, white-label.
  const to = str(client?.email);
  if (to && pdf?.length) {
    try {
      const { sendEmail } = await import("@/lib/email/resend");
      const { resolveSender } = await import("@/lib/email/companySender");
      const { clientDocCopy } = await import("@/lib/i18n/clientDocCopy");
      const { emailCopy } = await import("@/lib/i18n/emailCopy");
      const { from, replyTo } = await resolveSender(row.company || {}, row.companyId);
      const dc = clientDocCopy(language);
      const ec = emailCopy(language);
      const first = str(client?.name).split(" ")[0] || "";
      const text = [ec.greeting(first), "", dc.waiverCopyIntro(row.company?.name || ""), "", ec.questions(row.company?.phone), row.company?.name || ""].join("\n");
      await sendEmail({
        companyId: row.companyId,
        from,
        replyTo,
        to,
        subject: `${dc.waiverSignedTitle} — ${row.document?.title || ""}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#2d2520"><p>${esc(ec.greeting(first))}</p><p>${esc(dc.waiverCopyIntro(row.company?.name || ""))}</p><p style="color:#6b675f;font-size:13px">${esc(ec.questions(row.company?.phone))}</p><p><strong>${esc(row.company?.name || "")}</strong></p></div>`,
        text,
        attachments: [{ filename: `${safeName(row.document?.title)}.pdf`, content: pdf }],
      });
    } catch (err) {
      console.error("[waivers] client copy failed:", err?.message);
    }
  }

  await recordActivity(
    { companyId: row.companyId },
    {
      action: "waiver.signed",
      entityType: row.quoteId ? "quote" : row.invoiceId ? "invoice" : "job",
      entityId: row.quoteId || row.invoiceId || row.jobId || row.id,
      actorName: "Client (waiver link)",
      summary: `Waiver "${row.document?.title || ""}" signed by ${record.signature?.name || "the client"}${attachedTo ? ` — ${attachedTo}` : ""}`,
      metadata: { signatureId: row.id, acknowledgements: record.acknowledgements.length },
    },
  ).catch(() => {});
}

/** The job a signed waiver belongs on, if any exists yet. */
async function jobFor(row, db) {
  if (row.jobId) return row.jobId;
  if (row.quoteId) return (await db.job.findFirst({ where: { quoteId: row.quoteId, companyId: row.companyId }, select: { id: true } }))?.id || null;
  if (row.invoiceId) return (await db.invoice.findFirst({ where: { id: row.invoiceId, companyId: row.companyId }, select: { jobId: true } }))?.jobId || null;
  return null;
}

async function fileOnJob({ row, jobId, pdf, db }) {
  try {
    const { uploadBuffer } = await import("@/lib/cloudinary");
    const uploaded = await uploadBuffer(pdf, {
      folder: `fieldquo/companies/${row.companyId}/jobs/${jobId}`,
      publicId: `waiver-${row.id}.pdf`,
      resourceType: "raw",
    });
    const url = uploaded?.secure_url || null;
    if (!isUploadedUrl(url, { cloudName: process.env.CLOUDINARY_CLOUD_NAME })) throw new Error("uploader answered with a URL that is not on this deployment's own cloud");
    const doc = await db.jobDocument.create({
      data: {
        companyId: row.companyId,
        jobId,
        name: `${row.document?.title || "Waiver"} — signed`,
        kind: "waiver",
        url,
        sizeBytes: Number.isInteger(uploaded?.bytes) && uploaded.bytes > 0 ? uploaded.bytes : pdf.length,
        mimeType: PDF_MIME,
        source: "waiver_signed",
        sourceQuoteId: row.quoteId || null,
        sourceInvoiceId: row.invoiceId || null,
        documentHash: row.documentHash || null,
      },
      select: { id: true },
    });
    await db.documentSignature.update({ where: { id: row.id }, data: { jobDocumentId: doc.id } });
    return doc.id;
  } catch (err) {
    if (err?.code === "P2002") return null;
    console.error("[waivers] filing on the job failed:", err?.message);
    return null;
  }
}

/**
 * A quote's waivers were signed before the job existed (acceptance creates
 * the job). Called from the acceptance path with the new job's id.
 */
export async function fileSignedWaiversForJob({ quoteId, jobId, db = realDb }) {
  if (!quoteId || !jobId) return 0;
  const rows = await db.documentSignature.findMany({
    where: { quoteId, status: "signed", jobDocumentId: null },
    include: {
      document: { select: { id: true, title: true, body: true } },
      company: { select: { id: true, name: true, logoUrl: true, brandColor: true, phone: true, currency: true, defaultLanguage: true } },
    },
  });
  let filed = 0;
  for (const row of rows) {
    try {
      const client = await clientOf(row, db);
      const language = resolveClientLanguage({ document: {}, client: client || {}, company: row.company || {} });
      const { renderWaiverPdf } = await import("@/lib/waivers/pdf");
      const record = { acknowledgements: row.acknowledgements, signature: row.signature, signedAt: row.signedAt, documentHash: row.documentHash };
      const pdf = await renderWaiverPdf({ company: row.company, document: row.document, record, language, attachedTo: await attachedToLabel(row, db) });
      if (await fileOnJob({ row, jobId, pdf, db })) filed += 1;
    } catch (err) {
      console.error("[waivers] late filing failed:", err?.message);
    }
  }
  return filed;
}

/** Unsigned waivers attached to a quote — the ones that block Accept. */
export async function pendingWaiversForQuote({ quoteId, companyId, db = realDb }) {
  return db.documentSignature.findMany({
    where: { quoteId, companyId, status: "pending", document: { archivedAt: null } },
    select: { id: true, token: true, document: { select: { title: true } } },
  });
}

/**
 * Email the client the /w/[token] link. Returns { sent, to } or throws with
 * a status. One Resend send, through the company's sender.
 */
export async function sendWaiverLink({ signatureId, companyId, db = realDb }) {
  const row = await db.documentSignature.findFirst({
    where: { id: signatureId, companyId },
    include: {
      document: { select: { title: true } },
      company: { select: { name: true, email: true, emailDomain: true, emailDomainStatus: true, emailFromLocal: true, phone: true, defaultLanguage: true } },
    },
  });
  if (!row) {
    const err = new Error("That waiver isn't attached here.");
    err.status = 404;
    throw err;
  }
  if (row.status === "signed") {
    const err = new Error("This waiver is already signed.");
    err.status = 409;
    throw err;
  }
  const client = await clientOf(row, db);
  const to = str(client?.email);
  if (!to) {
    const err = new Error("This client has no email address on file — add one to send the waiver.");
    err.status = 409;
    throw err;
  }
  const language = resolveClientLanguage({ document: {}, client, company: row.company || {} });
  const { sendEmail } = await import("@/lib/email/resend");
  const { resolveSender } = await import("@/lib/email/companySender");
  const { clientDocCopy } = await import("@/lib/i18n/clientDocCopy");
  const { emailCopy } = await import("@/lib/i18n/emailCopy");
  const { from, replyTo } = await resolveSender(row.company || {}, companyId);
  const dc = clientDocCopy(language);
  const ec = emailCopy(language);
  const first = str(client?.name).split(" ")[0] || "";
  const url = `${getAppOrigin()}/w/${row.token}`;
  const intro = dc.waiverLinkIntro(row.company?.name || "", row.document?.title || "");
  const result = await sendEmail({
    companyId,
    from,
    replyTo,
    to,
    subject: `${row.document?.title || dc.waiverKicker} — ${row.company?.name || ""}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#2d2520"><p>${esc(ec.greeting(first))}</p><p>${esc(intro)}</p><p><a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#20242b;color:#fff;text-decoration:none;font-weight:600">${esc(dc.waiverOpen)}</a></p><p style="color:#6b675f;font-size:13px">${esc(ec.questions(row.company?.phone))}</p><p><strong>${esc(row.company?.name || "")}</strong></p></div>`,
    text: [ec.greeting(first), "", intro, url, "", ec.questions(row.company?.phone), row.company?.name || ""].join("\n"),
  });
  if (result?.skipped) {
    const err = new Error("Email isn't configured on this deployment, so the waiver link could not be sent.");
    err.status = 503;
    throw err;
  }
  await db.documentSignature.update({ where: { id: row.id }, data: { sentAt: new Date() } });
  return { sent: true, to };
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeName(title) {
  return (str(title) || "waiver").replace(/[^a-zA-Z0-9\- ]+/g, "").trim().slice(0, 60) || "waiver";
}
