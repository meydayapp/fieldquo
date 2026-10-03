// lib/planRead/run.js
//
// The paid read of a drawing set, as a resumable background job.
//
// ══ Shape ══════════════════════════════════════════════════════════════════
//
//   startRead()    the button: estimate, hold the credit, mark "reading".
//   advanceRead()  the work, run under next/server after() by the routes:
//                  sheet passes (four at a time) → photo pass → synthesis →
//                  settle. It takes a LEASE on the row, works until its time
//                  budget is nearly spent, saves after every batch, and stops.
//                  The next poll of GET /api/plan-reads/[id] (or another
//                  POST /run) finds the lease expired and starts it again where
//                  it stopped — every finished sheet is on the row, so nothing
//                  is read or paid for twice. A Vercel function's 300-second
//                  ceiling is why: a 40-sheet set plus a synthesis on the
//                  strongest model does not fit in one invocation, and the
//                  sales pipeline's lease pattern (lib/sales/pipeline/runner.js)
//                  is how this repo already survives that.
//
// ══ Money ══════════════════════════════════════════════════════════════════
//
// Held at start (lib/planRead/billing.js), settled at the end to what the
// calls cost, refunded IN FULL if the read fails — the photo deep read's rule.
// Every call is also an AiUsage row (feature "plan_read", paidFromWallet), so
// the usage screens and /platform see it, and it stays out of the monthly
// allowance it was not paid from.
//
// `deps` replaces the database, the model and the ledger in
// scripts/check-plan-deep-read.mjs.

import { randomUUID } from "node:crypto";
import { db as realDb } from "@/lib/db";
import { complete as realComplete } from "@/lib/ai/provider";
import { recordAiUsage as realRecordUsage } from "@/lib/ai/usage";
import { featureAllowsSpend as realFeatureAllows } from "@/lib/features/gate";
import { aiBalanceFor as realBalance, debitCredit as realDebit } from "@/lib/voice/credits";
import { refundReservation as realRefund } from "@/lib/voice/spendGate";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import { revisionChains } from "@/lib/jobs/documents";
import { findDimensions, dimensionKind } from "./dimensions";
import { sheetImageUrls } from "./images";
import { sanitisePhotoRead } from "./photoScale";
import { scopeSheetDigest } from "./excel";
import { ingestKindFor, mergeParsed } from "./ingest";
import { catalogueForModel, planSubstrateKeys } from "./catalogue";
import { sanitiseSynthesis, buildDimIndex, computeProject } from "./projectModel";
import { paintedSqft } from "./pricing";
import { similarPastQuotes as realSimilar } from "./similar";
import { estimateRead, addUsage, settlement, MAX_PHOTOS, READ_MODELS } from "./billing";
import {
  SHEET_SYSTEM,
  SHEET_SCHEMA,
  sheetPrompt,
  PHOTO_SYSTEM,
  PHOTO_SCHEMA,
  SYNTHESIS_SYSTEM,
  SYNTHESIS_SCHEMA,
  projectContext,
} from "./prompts";

export const SHEET_CONCURRENCY = 4;
export const LEASE_SLACK_MS = 60_000;
/** Time a synthesis needs to itself — started in a fresh invocation if less is left. */
const SYNTHESIS_NEEDS_MS = 170_000;
const PHOTOS_NEED_MS = 110_000;
const SHEET_BATCH_NEEDS_MS = 75_000;

function resolve(deps = {}) {
  return {
    db: deps.db || realDb,
    complete: deps.complete || realComplete,
    recordAiUsage: deps.recordAiUsage || realRecordUsage,
    featureAllowsSpend: deps.featureAllowsSpend || realFeatureAllows,
    aiBalanceFor: deps.aiBalanceFor || realBalance,
    debitCredit: deps.debitCredit || realDebit,
    refundReservation: deps.refundReservation || realRefund,
    similarPastQuotes: deps.similarPastQuotes || realSimilar,
    now: deps.now || (() => Date.now()),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// WHAT IS ON THE READ
// ═══════════════════════════════════════════════════════════════════════════

/** The company's paint books — its own rates over the trade defaults. */
export async function loadPaintBooks(companyId, { prisma = realDb } = {}) {
  const rows = await prisma.companyServiceCategory.findMany({
    where: { companyId, category: { key: { in: ["interior_painting", "exterior_painting"] } } },
    select: { rates: true, enabled: true, category: { select: { key: true } } },
  });
  const byKey = new Map(rows.map((r) => [r.category?.key, r]));
  const books = {};
  const own = {};
  for (const key of ["interior_painting", "exterior_painting"]) {
    const row = byKey.get(key);
    books[key] = getPriceBook(key, row?.rates || null)?.takeoff || null;
    // "Own" = the company saved painting rates of its own. Without them the
    // book is FieldQuo's defaults, and the screen says so.
    own[key] = Boolean(row?.rates && typeof row.rates === "object" && row.rates.takeoff);
  }
  return { books, own };
}

/** Current revisions only: a superseded drawing is history, not input. */
export function currentDocuments(documents) {
  return revisionChains(documents || []).map((c) => c.current);
}

/** The sheets, photos and spreadsheets a read would use right now. */
export function readInputs(read) {
  const docs = currentDocuments(read.documents);
  const pdfIds = new Set(docs.filter((d) => d.mimeType === "application/pdf").map((d) => d.id));
  const sheets = (Array.isArray(read.sheets) ? read.sheets : []).filter((s) => pdfIds.has(s.docId));
  const photos = docs.filter((d) => d.kind === "photo" && String(d.mimeType || "").startsWith("image/")).slice(0, MAX_PHOTOS);
  // Spreadsheets are parsed once, on upload, per document
  // (excelRows.byDoc[docId]); the read uses the CURRENT revisions' rows.
  const sheetDocs = docs.filter((d) => ingestKindFor(d.mimeType) === "xlsx" || ingestKindFor(d.mimeType) === "csv");
  const parsed = sheetDocs.map((d) => read.excelRows?.byDoc?.[d.id]).filter(Boolean);
  const excel = parsed.length ? mergeParsed(parsed) : null;
  const excelChars = scopeSheetDigest(excel).length;
  return { docs, sheets, photos, excel, excelChars };
}

/** The ceiling shown before the read, for what is on it now. */
export function readEstimate(read) {
  const { sheets, photos, excelChars } = readInputs(read);
  const photoIds = photos.map((p) => p.id).join(",");
  return estimateRead({
    sheets: sheets.length,
    photos: photos.length,
    excelChars,
    sheetsAlreadyRead: sheets.filter((s) => s.read).length,
    photosAlreadyRead: Boolean(read.photoRead && read.photoRead.docIds === photoIds),
  });
}

/** Which files a read was made from — stored when it finishes, so a file
 *  added afterwards (a scope sheet, a revised drawing) is new work. */
export function inputsKey(read) {
  return currentDocuments(read.documents)
    .map((d) => d.id)
    .sort()
    .join(",");
}

/** Is there anything new for a (re)read to do? */
export function hasWorkToRead(read) {
  const { sheets, photos, excelChars } = readInputs(read);
  if (!sheets.length && !photos.length && !excelChars) return false;
  if (read.status !== "ready") return true;
  return inputsKey(read) !== (read.progress?.inputsKey || null);
}

// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hold the credit and mark the read running. Returns the refusal the screen
 * shows — with the numbers — when it cannot start.
 */
export async function startRead({ planReadId, companyId, userId = null }, deps = {}) {
  const d = resolve(deps);
  const read = await d.db.planRead.findFirst({ where: { id: planReadId, companyId }, include: { documents: true } });
  if (!read) return { ok: false, status: 404, error: "not_found" };
  if (read.status === "reading") return { ok: true, resumed: true };
  if (!hasWorkToRead(read)) return { ok: false, status: 400, error: "nothing_to_read" };

  const estimate = readEstimate(read);
  const offered = await d.featureAllowsSpend(companyId, "ai_vision");
  if (!offered) return { ok: false, status: 403, error: "feature_unavailable" };
  const balance = await d.aiBalanceFor(companyId);
  if (balance < estimate.cents) {
    return {
      ok: false,
      status: 402,
      error: "insufficient_credit",
      needCents: estimate.cents,
      balanceCents: balance,
      shortfallCents: estimate.cents - balance,
    };
  }

  // The claim first: two clicks, or two tabs, start ONE read and hold ONE
  // amount. Only the request that moves the row out of its resting state
  // takes the money.
  const claimed = await d.db.planRead.updateMany({
    where: { id: planReadId, companyId, status: { in: ["draft", "ready", "failed"] } },
    data: { status: "reading", stage: "sheets", error: null, leaseUntil: null },
  });
  if (!claimed.count) return { ok: true, resumed: true };

  const ref = `plan_read:${planReadId}:${randomUUID()}`;
  let entry = null;
  try {
    entry = await d.debitCredit({
      companyId,
      cents: estimate.cents,
      kind: "plan_read",
      ref,
      note: `Drawing read — ${String(read.title || "").slice(0, 80)} (held, settled when it finishes)`,
    });
  } catch (err) {
    console.error("[planRead] hold failed:", err?.message);
  }
  if (!entry) {
    await d.db.planRead.updateMany({ where: { id: planReadId, companyId }, data: { status: read.status, stage: read.stage } });
    return { ok: false, status: 502, error: "hold_failed" };
  }
  const usage = read.usage && typeof read.usage === "object" ? { ...read.usage, run: {} } : { run: {} };
  await d.db.planRead.updateMany({
    where: { id: planReadId, companyId },
    data: { reservedCents: estimate.cents, reservationRef: ref, estimateCents: estimate.cents, usage },
  });
  return { ok: true, heldCents: estimate.cents, userId };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE CALLS
// ═══════════════════════════════════════════════════════════════════════════

function pageImageFor(sheet, docs) {
  const doc = docs.find((x) => x.id === sheet.docId);
  const pages = Array.isArray(doc?.pages) ? doc.pages : [];
  return pages.find((p) => p.page === sheet.docPage) || null;
}

/** Scanned-sheet dimensions the model read → the same shape as vector ones. */
export function scanDimsFrom(readDims, sheetKey) {
  const out = [];
  for (const rd of Array.isArray(readDims) ? readDims : []) {
    for (const d of findDimensions(String(rd?.text || ""), { metric: false })) {
      if (out.length >= 120) break;
      out.push({
        id: `${sheetKey}.v${out.length + 1}`,
        raw: d.raw,
        feet: d.feet,
        metres: d.metres,
        system: d.system,
        unitAssumed: d.unitAssumed,
        kind: dimensionKind(String(rd?.label || "")),
        x: null,
        y: null,
        line: String(rd?.label || "").slice(0, 120),
      });
    }
  }
  return out;
}

async function readOneSheet(sheet, { docs, read, d, record }) {
  const image = pageImageFor(sheet, docs);
  const images = image ? sheetImageUrls(image) : [];
  if (!images.length && !sheet.vector) {
    return { relevant: false, summary: "No picture of this page was saved, and it has no text to read.", areas: [], heights: [], finishes: [], access: [], at: new Date(d.now()).toISOString(), failed: true };
  }
  let usage = null;
  const result = await d.complete({
    system: SHEET_SYSTEM,
    prompt: sheetPrompt(sheet, { clientRequest: read.clientRequest, trade: read.trade }),
    images,
    maxImages: images.length,
    imageDetail: "high",
    tier: "standard",
    maxTokens: 8000,
    schema: SHEET_SCHEMA,
    schemaName: "plan_read_sheet",
    onUsage: (u) => {
      usage = u;
    },
  });
  if (usage) await record(usage, "sheets");
  if (!result?.ok) return null;
  const data = result.data;
  const scanDims = sheet.vector ? [] : scanDimsFrom(data.readDims, sheet.key);
  const ids = new Set([...(sheet.dims || []).map((x) => x.id), ...scanDims.map((x) => x.id)]);
  const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
  return {
    relevant: data.relevant !== false,
    summary: clip(data.summary, 400),
    areas: (data.areas || []).slice(0, 40).map((a) => ({
      name: clip(a.name, 80),
      side: a.side === "exterior" ? "exterior" : "interior",
      dimRefs: (a.dimRefs || []).filter((id) => ids.has(id)).slice(0, 16),
      note: a.note ? clip(a.note, 200) : null,
    })),
    heights: (data.heights || []).slice(0, 20).map((h) => ({ label: clip(h.label, 80), dimRef: h.dimRef && ids.has(h.dimRef) ? h.dimRef : null })),
    finishes: (data.finishes || []).slice(0, 20).map((x) => clip(x, 200)),
    access: (data.access || []).slice(0, 10).map((x) => clip(x, 200)),
    scanDims,
    at: new Date(d.now()).toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Do as much of a running read as fits in `budgetMs`, then stop.
 * @returns {{ state: "busy"|"more"|"ready"|"failed"|"idle" }}
 */
export async function advanceRead(planReadId, { companyId, budgetMs = 270_000, userId = null } = {}, deps = {}) {
  const d = resolve(deps);
  const started = d.now();
  const left = () => budgetMs - (d.now() - started);
  const leaseUntil = new Date(started + budgetMs + LEASE_SLACK_MS);
  const lease = await d.db.planRead.updateMany({
    where: { id: planReadId, companyId, status: "reading", OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date(started) } }] },
    data: { leaseUntil },
  });
  if (!lease.count) return { state: "busy" };

  const read = await d.db.planRead.findFirst({ where: { id: planReadId, companyId }, include: { documents: true } });
  if (!read || read.status !== "reading") return { state: "idle" };

  let usage = read.usage && typeof read.usage === "object" ? read.usage : { run: {} };
  const record = async (u, step) => {
    usage = addUsage(usage, u, step);
    await d.recordAiUsage({
      companyId,
      feature: "plan_read",
      model: u.model,
      promptTokens: u.promptTokens || 0,
      completionTokens: u.completionTokens || 0,
      cachedTokens: u.cachedTokens || 0,
      imageCount: u.imageCount || 0,
      userId,
      paidFromWallet: true,
    });
  };
  const save = (data) => d.db.planRead.updateMany({ where: { id: planReadId, companyId }, data: { ...data, usage } });
  const pause = () => save({ leaseUntil: null }).then(() => ({ state: "more" }));

  try {
    const { docs, sheets: activeSheets, photos, excel } = readInputs(read);
    const allSheets = Array.isArray(read.sheets) ? read.sheets.slice() : [];
    const activeKeys = new Set(activeSheets.map((s) => s.key));
    const progress = () => ({
      sheetsTotal: activeSheets.length,
      sheetsDone: allSheets.filter((s) => activeKeys.has(s.key) && s.read).length,
      photosTotal: photos.length,
      photosDone: read.photoRead ? photos.length : 0,
    });

    // ── 1. Sheets ─────────────────────────────────────────────────────────
    let pending = allSheets.filter((s) => activeKeys.has(s.key) && !s.read);
    while (pending.length) {
      if (left() < SHEET_BATCH_NEEDS_MS) return await pause();
      const batch = pending.slice(0, SHEET_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (s) => {
          // One retry: a vendor blip on sheet 31 must not fail a 40-sheet read.
          const r1 = await readOneSheet(s, { docs, read, d, record });
          return r1 || (await readOneSheet(s, { docs, read, d, record })) || {
            relevant: false, summary: "This sheet couldn't be read.", areas: [], heights: [], finishes: [], access: [], failed: true, at: new Date(d.now()).toISOString(),
          };
        }),
      );
      batch.forEach((s, i) => {
        const at = allSheets.findIndex((x) => x.key === s.key);
        const { scanDims, ...rest } = results[i];
        allSheets[at] = { ...allSheets[at], read: rest, scanDims: scanDims || [] };
      });
      pending = pending.slice(batch.length);
      await save({ sheets: allSheets, stage: "sheets", progress: progress() });
    }

    // ── 2. Photos ─────────────────────────────────────────────────────────
    let photoRead = read.photoRead || null;
    const photoIds = photos.map((p) => p.id).join(",");
    if (photos.length && photoRead?.docIds !== photoIds) {
      if (left() < PHOTOS_NEED_MS) return await pause();
      await save({ stage: "photos", progress: progress() });
      let u = null;
      const res = await d.complete({
        system: PHOTO_SYSTEM,
        prompt: JSON.stringify({ job: { trade: read.trade, clientWants: read.clientRequest || null }, photosAttached: photos.length, captions: photos.map((p, i) => ({ photo: i + 1, name: p.name })) }),
        images: photos.map((p) => p.url),
        maxImages: photos.length,
        imageDetail: "high",
        tier: "best",
        maxTokens: 16000,
        schema: PHOTO_SCHEMA,
        schemaName: "plan_read_photos",
        onUsage: (x) => {
          u = x;
        },
      });
      if (u) await record(u, "photos");
      const clean = res?.ok ? sanitisePhotoRead(res.data, photos.length) : { references: [], surfaces: [] };
      photoRead = {
        docIds: photoIds,
        photos: photos.map((p, i) => ({ n: i + 1, docId: p.id, url: p.url, name: p.name })),
        ...clean,
        failed: !res?.ok,
      };
      await save({ photoRead, progress: { ...progress(), photosDone: photos.length } });
    }

    // ── 3. Synthesis ──────────────────────────────────────────────────────
    if (left() < SYNTHESIS_NEEDS_MS) return await pause();
    await save({ stage: "synthesis", progress: { ...progress(), photosDone: photos.length } });

    const { books } = await loadPaintBooks(companyId, { prisma: d.db });
    const interiorBook = books.interior_painting;
    const usedSheets = allSheets.filter((s) => activeKeys.has(s.key));
    const context = projectContext({
      catalogue: catalogueForModel(interiorBook),
      sheets: usedSheets,
      excelDigest: scopeSheetDigest(excel, { maxChars: 12000 }),
      photoRead,
      trade: read.trade,
      clientRequest: read.clientRequest,
    });
    let su = null;
    const synth = await d.complete({
      system: SYNTHESIS_SYSTEM,
      prompt: context,
      tier: "best",
      reasoningEffort: "medium",
      maxTokens: 32000,
      schema: SYNTHESIS_SCHEMA,
      schemaName: "plan_read_synthesis",
      promptCacheKey: `plan_read:${planReadId}`,
      onUsage: (x) => {
        su = x;
      },
    });
    if (su) await record(su, "synthesis");
    if (!synth?.ok) throw new Error(`synthesis: ${synth?.reason || "failed"}`);

    const dims = buildDimIndex(usedSheets);
    const model = sanitiseSynthesis(synth.data, {
      dimIds: new Set(dims.keys()),
      itemKeys: new Set(planSubstrateKeys(interiorBook)),
      productKeys: new Set(Object.keys(interiorBook?.products || {})),
      photoIds: new Set((photoRead?.surfaces || []).map((s) => s.id)),
      excel,
    });
    const computed = computeProject(model, { dims, book: interiorBook, excel, photoRead });
    let similar = null;
    try {
      similar = await d.similarPastQuotes({ companyId, buildingType: model.buildingType, clientRequest: read.clientRequest, sqft: paintedSqft(computed) });
    } catch (err) {
      console.error("[planRead] similar quotes:", err?.message);
    }

    // ── 4. Settle ─────────────────────────────────────────────────────────
    const s = settlement({ reservedCents: read.reservedCents, runVendorMicros: usage?.run?.vendorMicros });
    if (s.refundCents > 0 && read.reservationRef) {
      await d.refundReservation({
        companyId,
        ref: read.reservationRef,
        cents: s.refundCents,
        forKind: "plan_read",
        note: `Drawing read — the unused part of the hold (charged ${s.chargedCents}¢ of ${read.reservedCents}¢)`,
      });
    }
    await save({
      status: "ready",
      stage: "done",
      model,
      similar,
      readAt: new Date(d.now()),
      leaseUntil: null,
      chargedCents: (read.chargedCents || 0) + s.chargedCents,
      reservedCents: 0,
      reservationRef: null,
      progress: { ...progress(), photosDone: photos.length, inputsKey: inputsKey(read) },
    });
    return { state: "ready", chargedCents: s.chargedCents, refundCents: s.refundCents };
  } catch (err) {
    console.error("[planRead] read failed:", err?.message);
    if (read.reservationRef && read.reservedCents > 0) {
      await d
        .refundReservation({ companyId, ref: read.reservationRef, cents: read.reservedCents, forKind: "plan_read", note: "Refund — the drawing read couldn't finish" })
        .catch(() => {});
    }
    await save({ status: "failed", stage: null, error: "The read couldn't finish. Nothing was charged — try again.", leaseUntil: null, reservedCents: 0, reservationRef: null });
    return { state: "failed" };
  }
}

export { READ_MODELS };
