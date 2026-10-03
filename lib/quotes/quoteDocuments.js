// lib/quotes/quoteDocuments.js
//
// Filing a file on a QUOTE — or on a drawing read, before its quote exists.
// One writer for both routes (app/api/quotes/[id]/documents and
// app/api/plan-reads/[id]/documents), because two copies of "is this URL
// ours, may this member file this kind, does this revision point at the
// current one" is the copy that rots.
//
// The rules are the job store's (lib/jobs/documents.js) — the same kinds, the
// same URL check, the same "a revision supersedes, nothing is overwritten" —
// because every row here becomes a JobDocument when the quote is approved
// (lib/jobs/documentAutofile.js fileQuoteDocumentsOnJob). Two extra rules:
//
//   • The system-filed kinds (quote, contract, invoice) are refused: those are
//     rendered by FieldQuo on acceptance and on send, and a hand-uploaded
//     "contract" on a quote would sit beside the real one on the job.
//   • The URL must be in THIS company's own upload folder, not just on our
//     Cloudinary cloud — a row is a link the crew will click.

import {
  normaliseKind,
  canSeeKind,
  isUploadedUrl,
  normaliseName,
  normaliseSizeBytes,
  AUTOFILED_KINDS,
} from "@/lib/jobs/documents";

export const MAX_PAGES = 150;

/** Is this upload in the company's own folder? Pure. */
export function inCompanyFolder(url, companyId) {
  if (typeof url !== "string" || typeof companyId !== "string") return false;
  return url.includes(`/fieldquo/companies/${companyId}/`);
}

/** A drawing PDF's rendered pages, as the browser posted them. Pure. */
export function normalisePages(raw, { companyId, cloudName }) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const p of raw.slice(0, MAX_PAGES)) {
    const page = Number(p?.page);
    const width = Number(p?.width);
    const height = Number(p?.height);
    if (!Number.isInteger(page) || page < 1 || page > MAX_PAGES) continue;
    if (!isUploadedUrl(p?.url, { cloudName }) || !inCompanyFolder(p.url, companyId)) continue;
    if (!(width > 0 && width <= 20000 && height > 0 && height <= 20000)) continue;
    const pw = Number(p?.pointsWidth);
    const ph = Number(p?.pointsHeight);
    out.push({
      page,
      url: p.url,
      publicId: typeof p.publicId === "string" ? p.publicId.slice(0, 255) : null,
      width: Math.round(width),
      height: Math.round(height),
      pointsWidth: pw > 0 && pw < 100000 ? pw : null,
      pointsHeight: ph > 0 && ph < 100000 ? ph : null,
    });
  }
  return out.length ? out.sort((a, b) => a.page - b.page) : null;
}

/**
 * Validate one posted document. Pure apart from nothing — returns the data
 * to create, or the refusal to send.
 *
 * @param raw     the request body
 * @param opts    { companyId, canSeeMoney, cloudName }
 */
export function validateQuoteDocument(raw, { companyId, canSeeMoney, cloudName }) {
  let kind;
  try {
    kind = normaliseKind(raw?.kind);
  } catch (err) {
    return { ok: false, status: err.status || 400, error: err.message, code: err.code };
  }
  if (AUTOFILED_KINDS.has(kind)) {
    return { ok: false, status: 400, error: "Quotes, contracts and invoices are filed by FieldQuo itself when they're sent and signed. Upload it as another type." };
  }
  if (!canSeeKind(kind, { canSeeMoney })) {
    return { ok: false, status: 403, error: `Your access level doesn't cover ${kind} documents.` };
  }
  if (!isUploadedUrl(raw?.url, { cloudName }) || !inCompanyFolder(raw.url, companyId)) {
    return { ok: false, status: 400, error: "That file hasn't been uploaded yet. Pick the file again — files are stored through FieldQuo's own uploader." };
  }
  const mimeType = typeof raw?.mimeType === "string" ? raw.mimeType.slice(0, 120) : null;
  return {
    ok: true,
    data: {
      name: normaliseName(raw?.name, "Untitled file"),
      kind,
      url: raw.url,
      publicId: typeof raw?.publicId === "string" ? raw.publicId.slice(0, 255) : null,
      sizeBytes: normaliseSizeBytes(raw?.sizeBytes),
      mimeType,
      pages: mimeType === "application/pdf" ? normalisePages(raw?.pages, { companyId, cloudName }) : null,
    },
  };
}

/**
 * The predecessor a revision names, checked: same target, same kind, not
 * already replaced. `where` is the target ({ quoteId } or { planReadId }).
 */
export async function revisionTarget(prisma, { companyId, supersedesId, where, kind }) {
  if (!supersedesId) return { ok: true, id: null };
  const prev = await prisma.quoteDocument.findFirst({
    where: { id: String(supersedesId), companyId, ...where },
    select: { id: true, kind: true, supersededBy: { select: { id: true } } },
  });
  if (!prev) return { ok: false, status: 404, error: "That file isn't on this quote." };
  if (prev.supersededBy) return { ok: false, status: 409, error: "That version has already been replaced. Reload and revise the current one.", code: "already_superseded" };
  if (prev.kind !== kind) return { ok: false, status: 400, error: `A revision keeps the same type — that one is filed as "${prev.kind}".` };
  return { ok: true, id: prev.id };
}

export const QUOTE_DOCUMENT_SELECT = Object.freeze({
  id: true,
  name: true,
  kind: true,
  url: true,
  sizeBytes: true,
  mimeType: true,
  supersedesId: true,
  uploadedAt: true,
  planReadId: true,
  pages: true,
});
