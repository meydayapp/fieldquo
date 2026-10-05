// lib/planRead/sheetCache.js
//
// "This drawing set was already read." A revision chain, a second estimator,
// a read started over from a fresh project — the same PDF, byte for byte,
// uploaded again and paid for again, sheet by sheet. Each drawing PDF now
// carries the SHA-256 of its bytes (QuoteDocument.contentHash, computed by
// the server from the file it fetched — lib/planRead/documents.js — never
// taken from the browser), and a read with unread sheets is OFFERED the
// sheet passes of an earlier read of the same file. Reusing them is free and
// a person's choice: the button says where they came from, and the cost
// shown before "Read the project" drops by what they save.
//
// ══ Company-scoped, and only that ══════════════════════════════════════════
//
// A sheet pass is the company's own data (its client's building, its own
// estimator's job). Two contractors bidding the same public tender upload
// the same PDF; the second must never get the first's reading of it, or even
// learn that one exists. So: the database queries are keyed by companyId,
// and the pure matcher drops any row whose companyId is not the read's —
// twice, deliberately, so a future edit to one does not open the other.
//
// ══ When an earlier sheet pass stands in for a new one ═════════════════════
//
// A sheet pass sees the page image, the page's own extracted text (both fixed
// by the bytes), the trade, and what the client wants
// (prompts.js sheetPrompt). So a match needs: the same bytes, the same trade,
// the same page, the same sheet number and the same count of extracted
// dimensions (the extraction is code — if the code changed between the two
// uploads, the ids would not line up, so the sheet is read fresh). What the
// client wants may differ: it steers which sheets the model thinks matter,
// and the offer says so when it differs, rather than refusing.

import { createHash } from "node:crypto";
import { db as realDb } from "@/lib/db";
import { currentDocuments } from "./run";

export const MAX_SOURCES = 10;

/** SHA-256 of a file's bytes, hex. */
export function contentHashOf(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const PREFIX = /^p\d+\./;
const remapId = (id, toKey) => (typeof id === "string" ? id.replace(PREFIX, `${toKey}.`) : id);

/**
 * An earlier sheet's pass, renumbered for the sheet it now stands in for:
 * dimension ids carry the sheet's key ("p3.d12"), and the same page is p3 in
 * one read and p41 in another. Pure.
 */
export function remapSheetPass(sheet, toKey) {
  const r = sheet?.read;
  if (!r) return null;
  return {
    read: {
      ...r,
      areas: (r.areas || []).map((a) => ({ ...a, dimRefs: (a.dimRefs || []).map((id) => remapId(id, toKey)) })),
      heights: (r.heights || []).map((h) => ({ ...h, dimRef: h.dimRef ? remapId(h.dimRef, toKey) : h.dimRef })),
    },
    scanDims: (sheet.scanDims || []).map((d) => ({ ...d, id: remapId(d.id, toKey) })),
  };
}

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Which of this read's unread sheets an earlier read of the same file could
 * fill, grouped by the read they would come from, best first. Pure.
 *
 * @param read     this read: { id, companyId, trade, clientRequest, sheets, documents }
 * @param sources  earlier reads: { id, companyId, title, trade, clientRequest,
 *                 readAt, sheets, documents: [{ id, companyId, contentHash }] }
 */
export function reusableSheets({ read, companyId, sources }) {
  if (!read || !companyId || read.companyId !== companyId) return [];
  const docs = currentDocuments(read.documents || []).filter((d) => d.mimeType === "application/pdf" && d.contentHash && d.companyId === companyId);
  const byDoc = new Map(docs.map((d) => [d.id, d.contentHash]));
  const unread = (Array.isArray(read.sheets) ? read.sheets : []).filter((s) => byDoc.has(s.docId) && !s.read);
  if (!unread.length) return [];

  const offers = [];
  for (const src of Array.isArray(sources) ? sources : []) {
    // The tenant line, in code as well as in the query.
    if (!src || src.companyId !== companyId || src.id === read.id) continue;
    if (norm(src.trade) !== norm(read.trade)) continue;
    const srcDocs = (src.documents || []).filter((d) => d.companyId === companyId && d.contentHash);
    const srcSheets = Array.isArray(src.sheets) ? src.sheets : [];
    const sheets = [];
    for (const s of unread) {
      const hash = byDoc.get(s.docId);
      const docIds = new Set(srcDocs.filter((d) => d.contentHash === hash).map((d) => d.id));
      const match = srcSheets.find(
        (x) =>
          docIds.has(x.docId) &&
          x.docPage === s.docPage &&
          x.read &&
          !x.read.failed &&
          (x.sheetNumber || null) === (s.sheetNumber || null) &&
          (x.dims || []).length === (s.dims || []).length,
      );
      if (match) sheets.push({ key: s.key, fromKey: match.key });
    }
    if (!sheets.length) continue;
    offers.push({
      fromId: src.id,
      title: src.title || null,
      readAt: src.readAt || null,
      sameRequest: norm(src.clientRequest) === norm(read.clientRequest),
      sheets,
    });
  }
  return offers.sort((a, b) => b.sheets.length - a.sheets.length || new Date(b.readAt || 0) - new Date(a.readAt || 0));
}

/** This read's sheets with an offer's passes copied in. Only unread sheets are
 *  touched — a sheet read since the offer was made keeps its own. Pure. */
export function applySheetReuse(sheets, offer, source) {
  const fromByKey = new Map((source?.sheets || []).map((s) => [s.key, s]));
  const wanted = new Map((offer?.sheets || []).map((x) => [x.key, x.fromKey]));
  let reused = 0;
  const next = (Array.isArray(sheets) ? sheets : []).map((s) => {
    if (s.read || !wanted.has(s.key)) return s;
    const pass = remapSheetPass(fromByKey.get(wanted.get(s.key)), s.key);
    if (!pass) return s;
    reused += 1;
    return { ...s, read: pass.read, scanDims: pass.scanDims, reusedFrom: { planReadId: source.id, sheetKey: wanted.get(s.key) } };
  });
  return { sheets: next, reused };
}

/**
 * The offers for one read, from the database. Two queries, both keyed by the
 * company; nothing at all when no unread sheet has a hash.
 */
export async function findSheetCache(read, { companyId, prisma = realDb } = {}) {
  if (!read || read.status === "reading" || read.companyId !== companyId) return { offers: [], sources: [] };
  const docs = currentDocuments(read.documents || []).filter((d) => d.mimeType === "application/pdf" && d.contentHash);
  const hashedDocIds = new Set(docs.map((d) => d.id));
  const anyUnread = (Array.isArray(read.sheets) ? read.sheets : []).some((s) => hashedDocIds.has(s.docId) && !s.read);
  if (!anyUnread) return { offers: [], sources: [] };

  const twins = await prisma.quoteDocument.findMany({
    where: { companyId, contentHash: { in: [...new Set(docs.map((d) => d.contentHash))] }, planReadId: { not: null } },
    select: { id: true, companyId: true, contentHash: true, planReadId: true },
    take: 200,
  });
  const ids = [...new Set(twins.map((t) => t.planReadId).filter((id) => id && id !== read.id))];
  if (!ids.length) return { offers: [], sources: [] };
  const rows = await prisma.planRead.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, companyId: true, title: true, trade: true, clientRequest: true, readAt: true, sheets: true },
    orderBy: { updatedAt: "desc" },
    take: MAX_SOURCES,
  });
  const sources = rows.map((r) => ({ ...r, documents: twins.filter((t) => t.planReadId === r.id) }));
  return { offers: reusableSheets({ read, companyId, sources }), sources };
}
