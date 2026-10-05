// lib/aiEmployee/referenceRuns.js
//
// The two PAID actions on a reference-library manual, as functions the
// routes call and the checks can run with a scripted database and a scripted
// model (no live AI call in any check):
//
//   readScannedPages  "Read scanned pages with AI" — one batch of page
//                     images the browser rendered from the company's own
//                     copy, read on the standard model, metered to the
//                     company's AI credit (meterFor("reference_ocr")).
//   extractCodes      "Extract error codes" — one standard-model pass over
//                     the pages that look like a fault table, metered
//                     (meterFor("reference_code_extract")), written as
//                     UNREVIEWED ReferenceCode rows with their page.
//
// Both: the gate BEFORE the call (no credit → 402, nothing sent), the usage
// recorded AFTER on every path that spent, every read and write under the
// company. Neither sends a page to the model unless the person pressed the
// button whose price the screen showed.

import { randomUUID } from "node:crypto";
import { complete } from "@/lib/ai/provider";
import { meterFor } from "@/lib/ai/featurePayer";
import { pageHasText, unreadOf, OCR_PAGES_PER_BATCH } from "./referencePages";
import { OCR_SYSTEM, OCR_SCHEMA, validateOcrBatch, cleanOcrResult } from "./reference";
import {
  brandKey,
  codeTableCandidates,
  CODE_EXTRACT_SCHEMA,
  CODE_EXTRACT_SYSTEM,
  codeExtractPrompt,
  cleanExtractedCodes,
} from "./errorCodes";

const SOURCE_SELECT = {
  id: true, title: true, fileHash: true, pageCount: true, pagesRead: true, unreadPages: true, status: true,
  brand: true, category: true, trade: true,
};

/** The state of a manual from its stored pages. Pure. Exported for the check. */
export function restate(pages, pageCount) {
  const list = Array.isArray(pages) ? pages : [];
  const unread = list.filter((p) => !p.method && !pageHasText(p.text)).map((p) => p.page).sort((a, b) => a - b);
  const pagesRead = list.filter((p) => pageHasText(p.text)).length;
  const skipped = Math.max(0, (Number(pageCount) || list.length) - list.length);
  const status = pagesRead === 0 ? "failed" : unread.length || skipped ? "partial" : "ready";
  return {
    pagesRead,
    unreadPages: unread,
    status,
    failureReason: pagesRead === 0 ? "app.aiEmployee.source.failed.pdfScanned" : null,
  };
}

/**
 * One OCR batch.
 *
 * @returns {{ ok: true, read: number, blank: number, source } | { ok: false, status, error }}
 */
export async function readScannedPages({ prisma, companyId, userId = null, sourceId, body }, deps = {}) {
  const { complete: callModel = complete, meterFor: meter = meterFor } = deps;
  const source = await prisma.aiEmployeeSource.findFirst({ where: { id: sourceId, companyId }, select: SOURCE_SELECT });
  if (!source) return { ok: false, status: 404, error: "not_found" };
  // The person's copy must BE the stored file — the browser rendered these
  // pages from it, and a different PDF's page 12 is not this manual's.
  if (!source.fileHash || typeof body?.fileHash !== "string" || body.fileHash.toLowerCase() !== source.fileHash) {
    return { ok: false, status: 409, error: "wrong_file" };
  }
  const batch = validateOcrBatch(body, { unread: unreadOf(source) });
  if (!batch.ok) return { ok: false, status: 400, error: batch.error };

  const m = await meter("reference_ocr", { companyId, userId, prisma });
  const gate = await m.check();
  if (!gate.allowed) return { ok: false, status: 402, error: "no_credit", needCents: gate.needCents ?? null, balanceCents: gate.balanceCents ?? null };

  let usage = null;
  const pageNumbers = batch.pages.map((p) => p.page);
  const result = await callModel({
    system: OCR_SYSTEM,
    prompt: `Transcribe ${pageNumbers.length} page${pageNumbers.length === 1 ? "" : "s"} of "${String(source.title).slice(0, 200)}". In order, the images are page ${pageNumbers.join(", page ")}.`,
    imageData: batch.pages.map((p) => ({ mimeType: p.mimeType, base64: p.base64 })),
    maxImages: OCR_PAGES_PER_BATCH,
    // A manual's small print is unreadable at "low" (a fixed 512 px
    // thumbnail); the price shown was computed at "high".
    imageDetail: "high",
    maxTokens: 2_000 * pageNumbers.length,
    schema: OCR_SCHEMA,
    schemaName: "reference_ocr",
    onUsage: (u) => {
      usage = u;
    },
  });
  if (usage) {
    await m.record(usage, {
      ref: `reference_ocr:${source.id}:${pageNumbers.join("-")}:${randomUUID()}`,
      note: `Reference library — reading scanned pages ${pageNumbers.join(", ")} of ${String(source.title).slice(0, 80)}`,
    });
  }
  if (!result?.ok) return { ok: false, status: 502, error: "read_failed", charged: Boolean(usage) };

  const texts = cleanOcrResult(result.data, pageNumbers);
  let read = 0;
  let blank = 0;
  for (const page of pageNumbers) {
    const text = texts.get(page) || "";
    const has = pageHasText(text);
    if (has) read += 1;
    else blank += 1;
    // Only a page still unread is written — a page the text layer already
    // read is never overwritten by a model's transcription. A page the model
    // found blank is marked looked-at (method "ocr", text null) so it is not
    // offered — and charged — again.
    await prisma.aiEmployeeSourcePage.updateMany({
      where: { companyId, sourceId: source.id, page, method: null },
      data: { text: has ? text : null, method: "ocr" },
    });
  }

  const pages = await prisma.aiEmployeeSourcePage.findMany({
    where: { companyId, sourceId: source.id },
    select: { page: true, text: true, method: true },
  });
  const next = restate(pages, source.pageCount);
  const tokenCount = Math.ceil(pages.reduce((n, p) => n + (p.text ? p.text.length : 0), 0) / 4);
  await prisma.aiEmployeeSource.updateMany({
    where: { id: source.id, companyId },
    data: { pagesRead: next.pagesRead, unreadPages: next.unreadPages, status: next.status, failureReason: next.failureReason, tokenCount },
  });
  return { ok: true, read, blank, source: { id: source.id, ...next, pageCount: source.pageCount } };
}

/**
 * Extract a manual's error codes.
 *
 * @returns {{ ok: true, created, found } | { ok: false, status, error }}
 */
export async function extractCodes({ prisma, companyId, userId = null, sourceId }, deps = {}) {
  const { complete: callModel = complete, meterFor: meter = meterFor } = deps;
  const source = await prisma.aiEmployeeSource.findFirst({ where: { id: sourceId, companyId }, select: SOURCE_SELECT });
  if (!source) return { ok: false, status: 404, error: "not_found" };
  // Every row is filed under a brand — a code without one is unusable by the
  // lookup, which never guesses a brand.
  if (!brandKey(source.brand)) return { ok: false, status: 400, error: "need_brand" };
  const pages = await prisma.aiEmployeeSourcePage.findMany({
    where: { companyId, sourceId: source.id, text: { not: null } },
    select: { page: true, text: true },
    orderBy: { page: "asc" },
  });
  const candidates = codeTableCandidates(pages);
  if (!candidates.length) return { ok: true, created: 0, found: 0, reason: "no_candidates" };

  const m = await meter("reference_code_extract", { companyId, userId, prisma });
  const gate = await m.check();
  if (!gate.allowed) return { ok: false, status: 402, error: "no_credit", needCents: gate.needCents ?? null, balanceCents: gate.balanceCents ?? null };

  let usage = null;
  const result = await callModel({
    system: CODE_EXTRACT_SYSTEM,
    prompt: codeExtractPrompt({ title: source.title, brand: source.brand, pages: candidates }),
    maxTokens: 8_000,
    schema: CODE_EXTRACT_SCHEMA,
    schemaName: "reference_codes",
    onUsage: (u) => {
      usage = u;
    },
  });
  if (usage) {
    await m.record(usage, {
      ref: `reference_codes:${source.id}:${randomUUID()}`,
      note: `Reference library — extracting error codes from ${String(source.title).slice(0, 80)}`,
    });
  }
  if (!result?.ok) return { ok: false, status: 502, error: "extract_failed", charged: Boolean(usage) };

  const rows = cleanExtractedCodes(result.data, {
    companyId,
    sourceId: source.id,
    brand: source.brand,
    category: source.category,
    trade: source.trade,
    pagesSent: candidates.map((p) => p.page),
  });
  // A second run adds only what the first did not find: an existing row for
  // the same code keys on the same page — reviewed, rejected or not — is
  // left exactly as the owner left it.
  const existing = await prisma.referenceCode.findMany({
    where: { companyId, sourceId: source.id },
    select: { codeKeys: true, page: true },
  });
  const have = new Set(existing.map((r) => `${[...(r.codeKeys || [])].join("|")}:${r.page ?? ""}`));
  const fresh = rows.filter((r) => !have.has(`${r.codeKeys.join("|")}:${r.page ?? ""}`));
  if (fresh.length) await prisma.referenceCode.createMany({ data: fresh });
  return { ok: true, created: fresh.length, found: rows.length };
}

/** A company code row, edited or decided by its owner. Pure validation. */
export function codeEdit(body = {}) {
  const action = ["review", "reject", "restore"].includes(body?.action) ? body.action : null;
  const text = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : undefined);
  const list = (v) => (Array.isArray(v) ? v.map((s) => text(s, 300)).filter(Boolean).slice(0, 4) : undefined);
  const data = {};
  const meaning = text(body?.meaning, 600);
  if (meaning) data.meaning = meaning;
  const safeSteps = list(body?.safeSteps);
  if (safeSteps) data.safeSteps = safeSteps.slice(0, 3);
  const stopSigns = list(body?.stopSigns);
  if (stopSigns) data.stopSigns = stopSigns;
  if (["emergency", "urgent", "routine"].includes(body?.urgency)) data.urgency = body.urgency;
  return { action, data };
}
