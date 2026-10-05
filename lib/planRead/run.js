// lib/planRead/run.js
//
// The paid read of a drawing set, as a resumable background job.
//
// ══ Shape ══════════════════════════════════════════════════════════════════
//
//   startRead()    the button: estimate, hold the credit, mark "reading".
//   advanceRead()  the work, run under next/server after() by the routes:
//                  sheet passes (up to SHEET_CONCURRENCY at once) beside the
//                  photo pass → synthesis → settle. It takes a LEASE on the
//                  row, works until its time budget is nearly spent, saves as
//                  each sheet lands, and stops. The next poll of
//                  GET /api/plan-reads/[id] (or another POST /run, or the
//                  backstop cron — lib/planRead/backstop.js) finds the lease
//                  expired and starts it again where it stopped — every
//                  finished sheet is on the row, so nothing is read or paid
//                  for twice. A Vercel function's 300-second ceiling is why: a
//                  40-sheet set plus a synthesis on the strongest model does
//                  not fit in one invocation, and the sales pipeline's lease
//                  pattern (lib/sales/pipeline/runner.js) is how this repo
//                  already survives that.
//
// ══ Speed (P0 of the multi-trade deep-read plan) ═══════════════════════════
//
// Sheets used to go four at a time and the photo pass waited for the last of
// them: on a 13-sheet set, four waves of sheet calls and then a photo call
// before the synthesis could start. Now every sheet that needs reading is in
// flight at once (bounded by SHEET_CONCURRENCY) and the photo pass — which
// needs nothing from the sheets; only the synthesis reads both — runs beside
// them. The synthesis still waits for both. What each pass is SENT is
// unchanged and every answer is written into its own sheet's slot, so the
// synthesis prompt is byte-identical to the sequential order's for the same
// answers (scripts/check-plan-deep-read.mjs proves it by md5). Every stage's
// start and end is recorded (lib/planRead/timing.js), so the saving is
// measured on real reads rather than asserted.
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
import { startTiming, markInvocation, markStep, markSheet, endTiming } from "./timing";
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

/**
 * Sheet passes in flight at once. 13 so the reference 13-sheet set goes in
 * ONE wave. Each call is ~26k prompt tokens on the standard model (5 images
 * at high detail + the sheet's text — billing.js READ_TOKENS), so a full wave
 * is ~340k tokens inside a minute, with the photo pass on the other model
 * beside it. Whether that sits under the account's per-minute token limit
 * depends on its usage tier, which this code cannot see — the first real
 * reads will say (retried sheets show on /platform/ai-usage). A 429 that gets
 * through the SDK's own retries is retried here with a backoff (retryPlan),
 * and a sheet that runs out of time is left unread for the next invocation,
 * never marked failed. If 429s show up, this number is the lever.
 */
export const SHEET_CONCURRENCY = 13;
export const LEASE_SLACK_MS = 60_000;
/** Time a synthesis needs to itself — started in a fresh invocation if less is left. */
const SYNTHESIS_NEEDS_MS = 170_000;
const PHOTOS_NEED_MS = 110_000;
/** Time one sheet call needs — a sheet is not STARTED with less left. */
const SHEET_NEEDS_MS = 75_000;
/**
 * A read still "reading" this long after its click is given up and refunded
 * in full, by whichever worker next takes its lease. Without it a read whose
 * every invocation is killed at the platform ceiling would be resumed for
 * ever — re-spending FieldQuo's vendor cost each time and holding the
 * company's credit with nothing to show for it.
 */
export const MAX_READ_MS = 45 * 60_000;
/** How long the start's claim keeps workers off the row while the hold is
 *  written — see startRead. */
const HOLD_WINDOW_MS = 30_000;

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
    sleep: deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))),
    // The check runs the old order (one at a time, photos after) against
    // this one, to prove the project model does not depend on the order.
    sheetConcurrency: Math.max(1, Math.floor(Number(deps.sheetConcurrency) || SHEET_CONCURRENCY)),
    photosAlongside: deps.photosAlongside !== false,
  };
}

/**
 * Whether to retry a failed sheet call, and after how long. Pure.
 *
 * A vendor error billed nothing (provider.js: no usage block), so retrying it
 * is free; a 429 that survived the SDK's own retries means sustained
 * pressure, so it backs off longer and gets one more attempt. Anything else —
 * truncated, refused, unparseable — WAS billed, and keeps the single
 * immediate retry it always had.
 *
 * @returns {{ retry: boolean, waitMs: number }}
 */
export function retryPlan(failure, attempt, rand = Math.random) {
  const reason = failure?.reason || null;
  const rateLimited = reason === "vendor_error" && /\b429\b|rate.?limit/i.test(String(failure?.message || ""));
  const maxAttempts = rateLimited ? 3 : 2;
  if (attempt >= maxAttempts) return { retry: false, waitMs: 0 };
  if (rateLimited) return { retry: true, waitMs: 4000 * attempt + Math.floor(rand() * 1000) };
  if (reason === "vendor_error") return { retry: true, waitMs: 1000 + Math.floor(rand() * 500) };
  return { retry: true, waitMs: 0 };
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
  //
  // The claim also takes a short lease. Between the claim and the hold being
  // written below, the row says "reading" with no hold on it — and a poll of
  // GET /api/plan-reads/[id] or the backstop cron landing in that window
  // would otherwise start a worker that settles against no reservation. The
  // lease is released when the hold is recorded.
  const claimed = await d.db.planRead.updateMany({
    where: { id: planReadId, companyId, status: { in: ["draft", "ready", "failed"] } },
    data: { status: "reading", stage: "sheets", error: null, leaseUntil: new Date(d.now() + HOLD_WINDOW_MS) },
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
  // This run's spend and this run's clock start here; the totals across runs
  // (usage.byStep) carry on.
  const timing = startTiming({ now: d.now(), documents: currentDocuments(read.documents) });
  const usage = read.usage && typeof read.usage === "object" ? { ...read.usage, run: {}, timing } : { run: {}, timing };
  await d.db.planRead.updateMany({
    where: { id: planReadId, companyId },
    data: { reservedCents: estimate.cents, reservationRef: ref, estimateCents: estimate.cents, usage, leaseUntil: null },
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

async function readOneSheet(sheet, { docs, read, d, record, onFailure }) {
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
  if (!result?.ok) {
    onFailure?.(result || null);
    return null;
  }
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
  // A read started before timings existed has none, and none is invented for
  // it: every mark below is a no-op without a record to mark.
  const clock = (fn) => {
    if (usage?.timing) usage = { ...usage, timing: fn(usage.timing) };
  };
  clock((t) => markInvocation(t, started));
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
  // Every write is conditional on the row still being THIS run — reading,
  // under the hold this worker read. The lease already keeps two workers
  // apart; this is what makes a worker that somehow outlived its lease
  // harmless: it cannot settle a read twice, fail a read another worker
  // finished, or write over a run started since.
  const mine = { id: planReadId, companyId, status: "reading", reservationRef: read.reservationRef ?? null };
  const save = (data) => d.db.planRead.updateMany({ where: mine, data: { ...data, usage } });
  const pause = () => save({ leaseUntil: null }).then(() => ({ state: "more" }));

  try {
    if (usage?.timing?.startedAt && d.now() - usage.timing.startedAt > MAX_READ_MS) {
      throw new Error(`still reading ${Math.round((d.now() - usage.timing.startedAt) / 60_000)} min after it started — given up`);
    }

    const { docs, sheets: activeSheets, photos, excel } = readInputs(read);
    const allSheets = Array.isArray(read.sheets) ? read.sheets.slice() : [];
    const activeKeys = new Set(activeSheets.map((s) => s.key));
    let photoRead = read.photoRead || null;
    const photoIds = photos.map((p) => p.id).join(",");
    const photosDone = () => Boolean(photos.length && photoRead?.docIds === photoIds);
    const photosNeeded = () => photos.length > 0 && !photosDone();
    const progress = () => ({
      sheetsTotal: activeSheets.length,
      sheetsDone: allSheets.filter((s) => activeKeys.has(s.key) && s.read).length,
      photosTotal: photos.length,
      photosDone: photosDone() ? photos.length : 0,
    });

    // One writer for a running read's state, however many calls finish at
    // once. A write not yet started carries every change made before it
    // starts, so thirteen sheets landing together are a handful of writes,
    // not thirteen — and because the writes are chained, an older snapshot
    // can never land after a newer one.
    let stage = read.stage || "sheets";
    let chain = Promise.resolve();
    let queued = null;
    const flush = () => {
      if (queued) return queued;
      queued = chain.then(() => {
        queued = null;
        return save({ sheets: allSheets, ...(photoRead ? { photoRead } : {}), stage, progress: progress() });
      });
      chain = queued.catch(() => {});
      return queued;
    };

    const readPhotos = async () => {
      clock((t) => markStep(t, "photos", "start", d.now()));
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
      clock((t) => markStep(t, "photos", "end", d.now()));
      await flush();
    };

    // ── 1. Sheets, with the photo pass beside them ────────────────────────
    const pending = allSheets.filter((s) => activeKeys.has(s.key) && !s.read);
    // The photo pass needs nothing from the sheets. It starts now when it
    // fits in this invocation; otherwise it waits for the sequential path
    // below, exactly as before.
    let photoTask = null;
    if (d.photosAlongside && photosNeeded() && left() >= PHOTOS_NEED_MS) {
      photoTask = readPhotos().then(
        () => null,
        (err) => err,
      );
    }

    const readSheet = async (sheet) => {
      const start = d.now();
      let attempts = 0;
      for (;;) {
        let failure = null;
        attempts += 1;
        const result = await readOneSheet(sheet, {
          docs,
          read,
          d,
          record,
          onFailure: (f) => {
            failure = f;
          },
        });
        if (result) return { result, start, attempts };
        const plan = retryPlan(failure, attempts);
        if (!plan.retry) break;
        // Out of time for another attempt: leave the sheet UNREAD so the next
        // invocation reads it, rather than writing it off as unreadable.
        if (left() < SHEET_NEEDS_MS) return null;
        if (plan.waitMs) await d.sleep(plan.waitMs);
      }
      // A vendor blip on sheet 31 must not fail a 40-sheet read.
      return {
        result: { relevant: false, summary: "This sheet couldn't be read.", areas: [], heights: [], finishes: [], access: [], failed: true, at: new Date(d.now()).toISOString() },
        start,
        attempts,
      };
    };

    let next = 0;
    let outOfTime = false;
    const worker = async () => {
      while (next < pending.length) {
        if (left() < SHEET_NEEDS_MS) {
          outOfTime = true;
          return;
        }
        const s = pending[next++];
        clock((t) => markStep(t, "sheets", "start", d.now()));
        const done = await readSheet(s);
        if (!done) {
          outOfTime = true;
          return;
        }
        // Into the sheet's own slot, so the order the answers arrived in
        // never reaches the synthesis.
        const at = allSheets.findIndex((x) => x.key === s.key);
        const { scanDims, ...rest } = done.result;
        allSheets[at] = { ...allSheets[at], read: rest, scanDims: scanDims || [] };
        const end = d.now();
        clock((t) => markStep(markSheet(t, s.key, { start: done.start, end, attempts: done.attempts }), "sheets", "end", end));
        await flush();
      }
    };
    if (pending.length) stage = "sheets";
    await Promise.all(Array.from({ length: Math.min(d.sheetConcurrency, pending.length) }, worker));

    if (photoTask) {
      if (photosNeeded()) {
        stage = "photos";
        await flush();
      }
      // Never release the lease with a call still in flight: the next worker
      // would start the same photo pass again and pay for it twice.
      const err = await photoTask;
      if (err) throw err;
    }
    if (outOfTime) return await pause();

    // ── 2. Photos, when they did not fit beside the sheets ────────────────
    if (photosNeeded()) {
      if (left() < PHOTOS_NEED_MS) return await pause();
      stage = "photos";
      await flush();
      await readPhotos();
    }

    // ── 3. Synthesis ──────────────────────────────────────────────────────
    if (left() < SYNTHESIS_NEEDS_MS) return await pause();
    stage = "synthesis";
    await flush();

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
    clock((t) => markStep(t, "synthesis", "start", d.now()));
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
    clock((t) => markStep(t, "synthesis", "end", d.now()));
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
    // The refund goes under the hold's own refund ref (refundReservation →
    // "refund:<ref>"), which the ledger holds unique per company: however
    // many workers reach this line, the hold is given back once.
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
    clock((t) => endTiming(t, d.now(), "ready"));
    const settled = await save({
      status: "ready",
      stage: "done",
      model,
      // Only when there is one: a bare null on a Json column is refused by
      // Prisma (it wants DbNull), and that refusal would have left a paid,
      // finished read stuck "reading" because a side lookup failed.
      ...(similar ? { similar } : {}),
      readAt: new Date(d.now()),
      leaseUntil: null,
      chargedCents: (read.chargedCents || 0) + s.chargedCents,
      reservedCents: 0,
      reservationRef: null,
      progress: { ...progress(), photosDone: photos.length, inputsKey: inputsKey(read) },
    });
    // Another worker settled it first: its charge stands, and this one adds
    // nothing to chargedCents.
    if (!settled?.count) return { state: "idle" };
    return { state: "ready", chargedCents: s.chargedCents, refundCents: s.refundCents };
  } catch (err) {
    console.error("[planRead] read failed:", err?.message);
    if (read.reservationRef && read.reservedCents > 0) {
      await d
        .refundReservation({ companyId, ref: read.reservationRef, cents: read.reservedCents, forKind: "plan_read", note: "Refund — the drawing read couldn't finish" })
        .catch(() => {});
    }
    clock((t) => endTiming(t, d.now(), "failed"));
    await save({ status: "failed", stage: null, error: "The read couldn't finish. Nothing was charged — try again.", leaseUntil: null, reservedCents: 0, reservationRef: null });
    return { state: "failed" };
  }
}

export { READ_MODELS };
