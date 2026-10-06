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
// ══ The first pass measures (2026-10-05) ════════════════════════════════════
//
// Beside each measurable sheet's ordinary pass (an elevation, a plan, a
// section, or a sheet whose titles say nothing — lib/planRead/sheetKinds.js)
// runs a MEASUREMENT pass on the best model (lib/planRead/measurePrompts.js):
// where each face, room and height is on the sheet. Code scales them
// (lib/planRead/takeoff.js) and the synthesis cites them, so the first read
// returns quantities instead of zeros. If it still lists none for a side the
// quote is for, code drafts that side from the measurements
// (lib/planRead/backfill.js) and adds the access the heights need. A read
// made before this has no measurement passes: it is offered them (only the
// measurement and the synthesis are new work; the sheet passes are kept).
//
// ══ Read again (2026-10-05) ═════════════════════════════════════════════════
//
// A finished read of the same files and scope had nothing to do, so when
// FieldQuo improved the reader an estimator could only benefit by changing
// the scope or uploading the set again. Two ways back in, both deliberate:
//
//   * a sheet measured by an OLDER measurement pass (measurePrompts.js
//     MEASURE_VERSION) is measured again by any re-read — measureNeeded says
//     so, and the screen says "Measured with an older version";
//   * "Read again" — startRead({ force: true }) from a person who may edit
//     the read, after a confirm that shows the credit it holds — reads every
//     sheet, photo and measurement again, in full, and puts the project
//     together again. The run is marked in `usage.forceRun` (its hold's ref),
//     and each pass it makes is stamped with that ref, so a forced run that
//     pauses and resumes picks up where it stopped instead of starting over.
//     Never automatic: nothing but the button passes `force`.
//
// Either way, a measurement pass that fails or comes back empty never writes
// over a sheet that was measured (measureOutcome): the earlier faces and
// heights stay, marked `remeasure`, the screen says the re-measure failed and
// nothing was replaced, and the pass is not charged (billing.js waiveUsage).
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
import { sheetImageUrls, sheetOverviewUrl } from "./images";
import { sanitisePhotoRead } from "./photoScale";
import { scopeSheetDigest } from "./excel";
import { ingestKindFor, mergeParsed } from "./ingest";
import { catalogueForModel, planSubstrateKeys } from "./catalogue";
import { sanitiseSynthesis, buildDimIndex, computeProject } from "./projectModel";
import { paintedSqft } from "./pricing";
import { similarPastQuotes as realSimilar } from "./similar";
import { estimateRead, addUsage, waiveUsage, settlement, MAX_PHOTOS, READ_MODELS } from "./billing";
import { startTiming, markInvocation, markStep, markSheet, endTiming } from "./timing";
import { sheetPassDone, sheetNeedsPass, sheetRetryable } from "./sheetState";
import { MEASURE_SYSTEM, MEASURE_SCHEMA, MEASURE_VERSION, measurePrompt, measureVersionOf } from "./measurePrompts";
import { sanitiseMeasure, buildTakeoff, takeoffForPrompt } from "./takeoff";
import { sheetKind, isMeasurableKind } from "./sheetKinds";
import { backfillFromTakeoff } from "./backfill";
import { tradesFromScope, routeSheets, scopeHasPainting, scopeMultiTrades, paintingFocus, specDigest, MULTI_TRADE_KEYS } from "./tradeCatalogue";
import { aggregateSheetCounts, sanitiseTradeSynthesis, buildCountIndex, buildScheduleIndex } from "./tradeModel";
import {
  TRADE_SHEET_SYSTEM,
  TRADE_SHEET_SCHEMA,
  tradeSheetPrompt,
  TRADE_SYNTHESIS_SYSTEM,
  TRADE_SYNTHESIS_SCHEMA,
  tradeSharedContext,
  tradeSynthesisPrompt,
  paintingFocusWords,
} from "./tradePrompts";
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
    // Once a read settles: price it at the company's rates and tell the
    // owner, managers and the assignee when it misses the target margin
    // (lib/planRead/marginNotify.js). Loaded lazily — a static import would
    // be a cycle through priceRead.js. A caller that injects its own database
    // (the check) injects this too, or gets none.
    afterReady:
      deps.afterReady !== undefined
        ? deps.afterReady
        : deps.db
          ? null
          : async (args) => (await import("./marginNotify")).notifyAfterRead(args),
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

/**
 * The painting half of a model whose quote has no painting service: empty,
 * so every painting reader (computeProject, priceProject, the draft) has
 * nothing to show rather than an error — and `painting: false` beside it says
 * why. The overview's words come from the first trade.
 */
export function emptyPaintingModel(firstTrade = null) {
  return {
    version: 1,
    summary: firstTrade?.summary || "",
    buildingType: firstTrade?.buildingType || "",
    commercial: firstTrade?.commercial === true,
    areas: [],
    surfaces: [],
    access: [],
    complexity: { level: "medium", factors: [] },
    assumptions: [],
    exclusions: [],
    questions: [],
  };
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
  // The read's trades come from the services on its quote or request
  // (PlanRead.scope — the owner, 2026-10-04: no separate trade picker). They
  // decide which sheets are SENT to the model: a drywall quote never pays to
  // read the electrical sheets. No scope stated → every sheet, as before.
  const scoped = tradesFromScope(read.scope);
  const routes = routeSheets(sheets, scoped.trades);
  const routed = sheets.filter((s) => routes.get(s.key)?.send);
  return { docs, sheets, photos, excel, excelChars, scope: scoped, routes, routed };
}

/**
 * The ceiling shown before the read, for what is on it now. `force`: the
 * whole read again ("Read again") — every routed sheet, the photos and every
 * planned measurement, nothing counted as already done.
 */
export function readEstimate(read, { force = false } = {}) {
  const { routed, routes, photos, excelChars, scope } = readInputs(read);
  const photoIds = photos.map((p) => p.id).join(",");
  return estimateRead({
    sheets: routed.length,
    photos: photos.length,
    excelChars,
    // A failed pass is read again (lib/planRead/sheetState.js), so it is
    // estimated again.
    sheetsAlreadyRead: force ? 0 : routed.filter(sheetPassDone).length,
    photosAlreadyRead: force ? false : Boolean(read.photoRead && read.photoRead.docIds === photoIds),
    measureSheets: routed.filter((s) => (force ? measurePlanned(s, read, routes.get(s.key)) : measureNeeded(s, read, routes.get(s.key), null))).length,
    paintingSynthesis: scopeHasPainting(read.scope),
    tradeSyntheses: scope.trades.filter((t) => t.tradeKey !== "painting").length,
  });
}

/** Which files a read was made from — stored when it finishes, so a file
 *  added afterwards (a scope sheet, a revised drawing) is new work. A stated
 *  scope is part of it: switching the quote's services is new work too. */
export function inputsKey(read) {
  const files = currentDocuments(read.documents)
    .map((d) => d.id)
    .sort()
    .join(",");
  const { trades, stated } = tradesFromScope(read.scope);
  if (!stated) return files;
  return `${files}|scope:${trades.map((t) => `${t.tradeKey}:${t.focus.slice().sort().join("+")}`).join(",")}`;
}

/** Is there anything new for a (re)read to do? */
export function hasWorkToRead(read) {
  const { sheets, routed, routes, photos, excelChars } = readInputs(read);
  if (!sheets.length && !photos.length && !excelChars) return false;
  if (read.status !== "ready") return true;
  // A finished read with a sheet the model could not read still has work:
  // that sheet, read again (lib/planRead/sheetState.js).
  if (routed.some(sheetRetryable)) return true;
  // A read made before the first pass measured, or measured by an older
  // version of the measurement pass: those sheets.
  if (routed.some((s) => measureNeeded(s, read, routes.get(s.key), null))) return true;
  return inputsKey(read) !== (read.progress?.inputsKey || null);
}

// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Whether a POST to /api/plan-reads/[id]/run asks for "Read again": the
 * body's own `force: true` (never a truthy string, never a default) AND a
 * caller who may edit the read. Pure. Both, every time — the route's own
 * gate is the same level today, and this keeps a later loosening of that
 * gate (letting a viewer resume a read, say) from loosening this with it.
 */
export function readAgainFlag(body, { canEdit = false } = {}) {
  return Boolean(canEdit === true && body && typeof body === "object" && body.force === true);
}

/**
 * Does this read have files a forced re-read could read? Pure. The same
 * floor hasWorkToRead starts from — "Read again" on nothing is still nothing.
 */
export function canReadAgain(read) {
  if (read?.status !== "ready") return false;
  const { sheets, photos, excelChars } = readInputs(read);
  return Boolean(sheets.length || photos.length || excelChars);
}

/**
 * Hold the credit and mark the read running. Returns the refusal the screen
 * shows — with the numbers — when it cannot start.
 *
 * `force`: "Read again" — the whole read, even when nothing is new. Only on
 * a FINISHED read (a draft or a failed read already has work, and a running
 * one is picked up as it is). The route passes it only for a person who may
 * edit the read, and only when the body says `force: true` (readAgainFlag).
 */
export async function startRead({ planReadId, companyId, userId = null, force = false }, deps = {}) {
  const d = resolve(deps);
  const read = await d.db.planRead.findFirst({ where: { id: planReadId, companyId }, include: { documents: true } });
  if (!read) return { ok: false, status: 404, error: "not_found" };
  if (read.status === "reading") return { ok: true, resumed: true };
  force = force === true;
  if (force && read.status !== "ready") return { ok: false, status: 409, error: "not_finished" };
  if (force ? !canReadAgain(read) : !hasWorkToRead(read)) {
    // Files WERE added, but none could be read in code (a PDF the server
    // could not fetch or open, a spreadsheet that would not parse): say
    // that, by name — "add a drawing set" to someone who just did is wrong.
    const failed = read.excelRows?.failed && typeof read.excelRows.failed === "object" ? read.excelRows.failed : {};
    const unreadable = currentDocuments(read.documents).filter((doc) => Object.hasOwn(failed, doc.id));
    if (unreadable.length) {
      return { ok: false, status: 400, error: "files_unreadable", names: unreadable.map((doc) => doc.name || "a file").slice(0, 5), reasons: unreadable.map((doc) => failed[doc.id]).slice(0, 5) };
    }
    return { ok: false, status: 400, error: "nothing_to_read" };
  }
  // Sheets there are, but none is for the quote's trades (a roofing quote on
  // a set of electrical sheets) — and nothing else to read. Said, not paid.
  const inputs = readInputs(read);
  if (inputs.scope.stated && inputs.sheets.length && !inputs.routed.length && !inputs.photos.length && !inputs.excelChars) {
    return { ok: false, status: 400, error: "nothing_for_scope", trades: inputs.scope.trades.map((t) => t.tradeKey) };
  }

  const estimate = readEstimate(read, { force });
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
  // An earlier forced run's marker is dropped: `forceRun` names THIS run's
  // hold or nothing, so a later ordinary run is never taken for a forced one.
  const { forceRun: _earlier, ...kept } = read.usage && typeof read.usage === "object" ? read.usage : {};
  const usage = { ...kept, run: {}, timing, ...(force ? { forceRun: ref } : {}) };
  await d.db.planRead.updateMany({
    where: { id: planReadId, companyId },
    data: { reservedCents: estimate.cents, reservationRef: ref, estimateCents: estimate.cents, usage, leaseUntil: null },
  });
  return { ok: true, heldCents: estimate.cents, userId, forced: force };
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

/**
 * Which prompt a sheet is read with. A sheet routed to any trade beyond
 * painting gets the trade sheet pass (lib/planRead/tradePrompts.js — the
 * painting fields plus symbol counts and trade notes); a sheet routed only
 * to painting gets the painting pass, with the quote's side as its focus
 * when the scope names one. No scope stated → the painting pass, byte for
 * byte as before.
 */
export function sheetPassPlan(sheet, read, route) {
  const scoped = tradesFromScope(read.scope);
  const trades = scoped.trades.filter((t) => (route?.trades || []).includes(t.tradeKey));
  if (trades.some((t) => t.tradeKey !== "painting")) {
    return {
      kind: "trade",
      system: TRADE_SHEET_SYSTEM,
      prompt: tradeSheetPrompt(sheet, { clientRequest: read.clientRequest, trades }),
      schema: TRADE_SHEET_SCHEMA,
      schemaName: "plan_read_trade_sheet",
      trades,
      // What the pass was asked for — a pass is reusable by another read
      // only when that read would ask the same (lib/planRead/sheetCache.js).
      scopeKey: trades.map((t) => `${t.tradeKey}:${t.focus.slice().sort().join("+")}`).sort().join(","),
    };
  }
  const side = scoped.stated ? paintingFocus(read.scope) : null;
  return {
    kind: "painting",
    system: SHEET_SYSTEM,
    prompt: sheetPrompt(sheet, { clientRequest: read.clientRequest, trade: read.trade, focus: paintingFocusWords(side) }),
    schema: SHEET_SCHEMA,
    schemaName: "plan_read_sheet",
    trades,
    scopeKey: scoped.stated ? `painting:${side || "both"}` : null,
  };
}

/**
 * Does this sheet get a measurement pass on this read? Only for a painting
 * scope (or none stated), only a sheet the read sends to painting, only a
 * kind worth measuring. Pure.
 */
export function measurePlanned(sheet, read, route) {
  if (!scopeHasPainting(read?.scope)) return false;
  if (!route?.send) return false;
  const scoped = tradesFromScope(read?.scope);
  if (scoped.stated && route.reason !== "unknown" && !(route.trades || []).includes("painting")) return false;
  const kind = sheetKind(sheet);
  // A photo / 3D-view sheet is measured for ONE thing: the inside wall
  // height, estimated against a door, a person or a pew — when the read
  // prices inside walls. The church's interior photos were the only
  // evidence of how high its nave walls rise.
  if (kind === "photo") return paintingFocus(read?.scope) !== "exterior";
  return isMeasurableKind(kind);
}

/**
 * Measured, but by an older version of the measurement pass than this one
 * (measurePrompts.js MEASURE_VERSION): its faces and heights are what the
 * old pass made of the sheet. Only a measurement that SUCCEEDED — a failed
 * one is retried by its own rule, and a permanent failure (no picture of the
 * page) is not helped by a newer prompt. Pure.
 */
export function measureStale(sheet, read, route) {
  if (!measurePlanned(sheet, read, route)) return false;
  const m = sheet?.measure;
  if (!m || m.failed) return false;
  return measureVersionOf(m) < MEASURE_VERSION;
}

/** Still to measure: planned, and never measured — or failed in an EARLIER
 *  run (the sheet passes' rule, lib/planRead/sheetState.js) — or measured by
 *  an older version of the pass (measureStale). Pure. */
export function measureNeeded(sheet, read, route, runRef = null) {
  if (!measurePlanned(sheet, read, route)) return false;
  const m = sheet?.measure;
  if (!m) return true;
  // Re-measured in THIS run and it came back empty: the earlier measurement
  // was kept (measureOutcome) and this run does not ask again. The next run
  // does — it is still out of date.
  if (remeasureTriedIn(m, runRef)) return false;
  if (!m.failed) return measureVersionOf(m) < MEASURE_VERSION;
  if (m.permanent) return false;
  return !runRef || m.failedRun !== runRef;
}

/** A measurement with something in it — a face or a height. Pure. */
export function hasMeasurements(m) {
  return Boolean(m && !m.failed && ((Array.isArray(m.faces) && m.faces.length) || (Array.isArray(m.heights) && m.heights.length)));
}

/** Did run `runRef` already try to re-measure this sheet and keep the old one? Pure. */
export function remeasureTriedIn(m, runRef) {
  return Boolean(runRef && m?.remeasure && m.remeasure.run === runRef);
}

/**
 * What a sheet keeps after a measurement pass. Pure.
 *
 * A pass that FAILED never replaces one that answered; a pass that answered
 * with no face and no height never replaces a measurement that had some.
 * The church's "Read again" (2026-10-06) is why:
 * every pass failed — the schema was refused before any call — and each
 * failure was written over the sheet's measured faces, so 64 faces and 13
 * heights became an empty takeoff and the price became round-number guesses,
 * with nothing on the screen to say so. Now the earlier measurement stays and
 * carries `remeasure` — when, which run, why — which the read screen shows
 * ("measuring again failed … nothing was replaced"), and which clears itself
 * the next time a pass succeeds (the new measurement replaces the whole
 * object).
 *
 * `waive`: the pass's calls are not charged (billing.js waiveUsage). A pass
 * that failed produced nothing to charge for; one that answered empty over a
 * measured sheet is a failed re-measure — its answer is not used. A pass
 * that answered empty on a sheet that had nothing measured IS the answer (a
 * schedule, a detail) and is charged as before.
 *
 * @returns {{ measure: object, kept: boolean, waive: boolean }}
 */
export function measureOutcome(prior, next, { runRef = null } = {}) {
  // A failure never replaces a pass that answered, even one that found
  // nothing to measure (a site plan): "nothing here" is still an answer, and
  // "failed" over it would offer a paid re-measure for a sheet already done.
  const keep = next?.failed ? Boolean(prior && !prior.failed) : !hasMeasurements(next) && hasMeasurements(prior);
  if (keep) {
    return {
      // `failure`, not `reason`: a measurement's `reason` is why the sheet
      // is the kind it is (takeoff.js sanitiseMeasure).
      measure: { ...prior, remeasure: { failed: true, failure: next?.failed ? String(next.failure || "failed") : "empty", run: runRef, at: next?.at || null } },
      kept: true,
      waive: true,
    };
  }
  return { measure: next, kept: false, waive: Boolean(next?.failed) };
}

async function measureOneSheet(sheet, { docs, read, d, record, onFailure }) {
  const image = pageImageFor(sheet, docs);
  const overview = image ? sheetOverviewUrl(image) : null;
  if (!overview) return { sheetType: "other", reason: "", views: [], faces: [], heights: [], failed: true, permanent: true, at: new Date(d.now()).toISOString() };
  const side = tradesFromScope(read.scope).stated ? paintingFocus(read.scope) : null;
  let usage = null;
  const result = await d.complete({
    system: MEASURE_SYSTEM,
    prompt: measurePrompt(sheet, { clientRequest: read.clientRequest, focus: paintingFocusWords(side) }),
    images: [overview],
    maxImages: 1,
    imageDetail: "high",
    tier: "best",
    // Medium: the boxes ARE the quantities, and the owner chose accuracy
    // over cost (2026-10-05). Measured per read on /platform/ai-usage.
    reasoningEffort: "medium",
    maxTokens: 12000,
    schema: MEASURE_SCHEMA,
    schemaName: "plan_read_measure",
    onUsage: (u) => {
      usage = u;
    },
  });
  if (usage) await record(usage, "measure");
  if (!result?.ok) {
    onFailure?.(result || null);
    return null;
  }
  // Stamped with the pass's version, so a later version knows to measure the
  // sheet again (measureStale).
  return { ...sanitiseMeasure(result.data, sheet, { now: new Date(d.now()).toISOString() }), version: MEASURE_VERSION };
}

async function readOneSheet(sheet, { docs, read, d, record, onFailure, route }) {
  const image = pageImageFor(sheet, docs);
  const images = image ? sheetImageUrls(image) : [];
  if (!images.length && !sheet.vector) {
    return { relevant: false, summary: "No picture of this page was saved, and it has no text to read.", areas: [], heights: [], finishes: [], access: [], at: new Date(d.now()).toISOString(), failed: true, permanent: true };
  }
  const plan = sheetPassPlan(sheet, read, route);
  let usage = null;
  const result = await d.complete({
    system: plan.system,
    prompt: plan.prompt,
    images,
    maxImages: images.length,
    imageDetail: "high",
    tier: "standard",
    maxTokens: 8000,
    schema: plan.schema,
    schemaName: plan.schemaName,
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
    ...(plan.scopeKey ? { scopeKey: plan.scopeKey } : {}),
    // The trade pass's own fields — only on a sheet read for a trade beyond
    // painting, so a painting pass stores exactly what it always did.
    ...(plan.kind === "trade"
      ? {
          counts: aggregateSheetCounts(data.counts, sheet.key, { tradeKeys: plan.trades.map((t) => t.tradeKey).filter((k) => MULTI_TRADE_KEYS.includes(k)) }),
          notes: (data.notes || [])
            .filter((n) => n && plan.trades.some((t) => t.tradeKey === n.tradeKey))
            .slice(0, 40)
            .map((n) => ({ tradeKey: n.tradeKey, text: clip(n.text, 240) }))
            .filter((n) => n.text),
          trades: plan.trades.map((t) => t.tradeKey),
        }
      : {}),
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

    // The sheets this read SENDS: every one when no scope is stated, else
    // those routed to the quote's trades (tradeCatalogue.js routeSheets).
    const { docs, routed: activeSheets, routes, photos, excel } = readInputs(read);
    const allSheets = Array.isArray(read.sheets) ? read.sheets.slice() : [];
    const activeKeys = new Set(activeSheets.map((s) => s.key));
    let photoRead = read.photoRead || null;
    const photoIds = photos.map((p) => p.id).join(",");
    // "Read again" (startRead force): every pass this run makes carries the
    // run's ref, and only a pass carrying it counts as done — what an earlier
    // run read is read again, and a forced run that pauses resumes where it
    // was rather than starting over.
    const runRef = read.reservationRef ?? null;
    const forced = Boolean(runRef && usage?.forceRun === runRef);
    const thisRun = (x) => !forced || x?.run === runRef;
    const stamp = (x) => (forced ? { ...x, run: runRef } : x);
    const photosDone = () => Boolean(photos.length && photoRead?.docIds === photoIds && thisRun(photoRead));
    const photosNeeded = () => photos.length > 0 && !photosDone();
    const progress = () => ({
      sheetsTotal: activeSheets.length,
      sheetsDone: allSheets.filter((s) => activeKeys.has(s.key) && s.read && thisRun(s.read)).length,
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
      photoRead = stamp({
        docIds: photoIds,
        photos: photos.map((p, i) => ({ n: i + 1, docId: p.id, url: p.url, name: p.name })),
        ...clean,
        failed: !res?.ok,
      });
      clock((t) => markStep(t, "photos", "end", d.now()));
      await flush();
    };

    // ── 1. Sheets, with the photo pass beside them ────────────────────────
    const needsMeasure = (s) =>
      forced
        ? measurePlanned(s, read, routes.get(s.key)) && !thisRun(s.measure) && !remeasureTriedIn(s.measure, runRef)
        : measureNeeded(s, read, routes.get(s.key), runRef);
    const needsPass = (s) => (forced ? !thisRun(s.read) : sheetNeedsPass(s, runRef));
    const pending = allSheets.filter((s) => activeKeys.has(s.key) && (needsPass(s) || needsMeasure(s)));
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
          route: routes.get(sheet.key),
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
        // Written off for THIS run only (failedRun): the next run reads it
        // again rather than synthesising over a blank (sheetState.js).
        result: { relevant: false, summary: "This sheet couldn't be read.", areas: [], heights: [], finishes: [], access: [], failed: true, failedRun: read.reservationRef ?? null, at: new Date(d.now()).toISOString() },
        start,
        attempts,
      };
    };

    // Every call a sheet's measurement made, so a pass that ends with nothing
    // usable can be left off the bill (measureOutcome → waiveUsage).
    const measureSheet = async (sheet) => {
      let attempts = 0;
      let failure = null;
      const spent = [];
      const recordMeasure = async (u, step) => {
        spent.push(u);
        await record(u, step);
      };
      for (;;) {
        failure = null;
        attempts += 1;
        const result = await measureOneSheet(sheet, {
          docs,
          read,
          d,
          record: recordMeasure,
          onFailure: (f) => {
            failure = f;
          },
        });
        if (result) return { result, spent };
        const plan = retryPlan(failure, attempts);
        if (!plan.retry) break;
        if (left() < SHEET_NEEDS_MS) return null;
        if (plan.waitMs) await d.sleep(plan.waitMs);
      }
      // Loud: a measurement that fails on every sheet (a schema the vendor
      // refuses, say) used to leave no trace but an empty takeoff.
      console.error(`[planRead] measurement failed on ${sheet.key} (${planReadId}): ${failure?.reason || "failed"}${failure?.message ? ` — ${String(failure.message).slice(0, 300)}` : ""}`);
      // Written off for THIS run only, as a failed sheet pass is: the next
      // run measures it again. The sheet's other pass still counts.
      return {
        result: { sheetType: "other", reason: "", views: [], faces: [], heights: [], failed: true, failedRun: runRef, failure: String(failure?.reason || "failed").slice(0, 40), at: new Date(d.now()).toISOString() },
        spent,
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
        const wantSheet = needsPass(s);
        const wantMeasure = needsMeasure(s);
        clock((t) => markStep(t, "sheets", "start", d.now()));
        if (wantMeasure) clock((t) => markStep(t, "measure", "start", d.now()));
        // The sheet's two passes side by side: neither needs the other.
        const [done, measured] = await Promise.all([wantSheet ? readSheet(s) : Promise.resolve(false), wantMeasure ? measureSheet(s) : Promise.resolve(false)]);
        // Into the sheet's own slot, so the order the answers arrived in
        // never reaches the synthesis. What finished is kept even when the
        // other ran out of time — that one is read next invocation.
        const at = allSheets.findIndex((x) => x.key === s.key);
        if (done) {
          const { scanDims, ...rest } = done.result;
          allSheets[at] = { ...allSheets[at], read: stamp(rest), scanDims: scanDims || [] };
        }
        if (measured) {
          // Never an empty or failed pass over faces the sheet already had.
          const out = measureOutcome(allSheets[at].measure, measured.result, { runRef });
          // A kept measurement keeps its own stamp; `remeasure.run` is what
          // tells this run it has tried (remeasureTriedIn).
          allSheets[at] = { ...allSheets[at], measure: out.kept ? out.measure : stamp(out.measure) };
          if (out.waive) for (const u of measured.spent) usage = waiveUsage(usage, u);
        }
        const end = d.now();
        if (done) clock((t) => markStep(markSheet(t, s.key, { start: done.start, end, attempts: done.attempts }), "sheets", "end", end));
        if (measured) clock((t) => markStep(t, "measure", "end", end));
        await flush();
        if (done === null || measured === null) {
          outOfTime = true;
          return;
        }
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
    // A drawing set none of whose sheets could be read is not something to
    // synthesise a project from: it would charge for an overview built on
    // blank notes. Fail the run (refunded in full); the failed sheets are
    // pending again for the next one (sheetState.js).
    if (activeSheets.length && !allSheets.some((s) => activeKeys.has(s.key) && sheetPassDone(s))) {
      throw Object.assign(new Error("no sheet of the drawing set could be read"), {
        userMessage: "None of the drawing sheets could be read this time, so nothing was put together and nothing was charged. Try again — every sheet will be read again.",
      });
    }
    if (left() < SYNTHESIS_NEEDS_MS) return await pause();
    stage = "synthesis";
    await flush();

    const { books } = await loadPaintBooks(companyId, { prisma: d.db });
    const interiorBook = books.interior_painting;
    const usedSheets = allSheets.filter((s) => activeKeys.has(s.key));
    // Which syntheses this read runs: painting when the quote's services
    // include it (or no scope is stated — exactly as before), and one per
    // other trade, all at once.
    const scoped = tradesFromScope(read.scope);
    const doPainting = scopeHasPainting(read.scope);
    const otherTrades = scopeMultiTrades(read.scope);
    const routedTo = (tradeKey) => (s) => {
      const r = routes.get(s.key);
      return !scoped.stated || r?.reason === "unknown" || (r?.trades || []).includes(tradeKey);
    };
    const paintingSheets = scoped.stated ? usedSheets.filter(routedTo("painting")) : usedSheets;
    const photoIdSet = new Set((photoRead?.surfaces || []).map((s) => s.id));
    clock((t) => markStep(t, "synthesis", "start", d.now()));

    const paintingTakeoff = buildTakeoff(paintingSheets, buildDimIndex(paintingSheets));
    const paintingCall = async () => {
      const context = projectContext({
        catalogue: catalogueForModel(interiorBook),
        sheets: paintingSheets,
        excelDigest: scopeSheetDigest(excel, { maxChars: 12000 }),
        photoRead,
        trade: read.trade,
        clientRequest: read.clientRequest,
        takeoff: takeoffForPrompt(paintingTakeoff),
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
      const dims = buildDimIndex(paintingSheets);
      const itemKeys = new Set(planSubstrateKeys(interiorBook));
      const clean = sanitiseSynthesis(synth.data, {
        dimIds: new Set(dims.keys()),
        itemKeys,
        productKeys: new Set(Object.keys(interiorBook?.products || {})),
        photoIds: photoIdSet,
        excel,
        faceIds: new Set(paintingTakeoff.faces.keys()),
        heightIds: new Set(paintingTakeoff.heights.keys()),
      });
      // Never a side of the quote at 0 when its faces were measured, and
      // never high work without access (lib/planRead/backfill.js).
      const side = scoped.stated ? paintingFocus(read.scope) : null;
      const metric = paintingSheets.some((s) => s.scale?.system === "metric");
      return backfillFromTakeoff(clean, paintingTakeoff, {
        sides: side ? [side] : ["interior", "exterior"],
        itemKeys,
        computedOf: (m) => computeProject(m, { dims, book: interiorBook, excel, photoRead, takeoff: paintingTakeoff, metric }),
      }).model;
    };

    // The trades' shared context: every routed sheet any of them reads, the
    // spec digest (free — spec pages are never sent as images), the scope
    // sheet, the photos. The same bytes for every trade; each trade's call
    // then appends its own guidance and catalogue.
    const tradeSheets = usedSheets.filter((s) => otherTrades.some((t) => routedTo(t.tradeKey)(s)));
    const specs = specDigest(allSheets.filter((s) => routes.get(s.key)?.reason === "spec"));
    const tradeCtx = (() => {
      if (!otherTrades.length) return null;
      const dims = buildDimIndex(tradeSheets);
      return {
        shared: tradeSharedContext({ sheets: tradeSheets, excelDigest: scopeSheetDigest(excel, { maxChars: 12000 }), photoRead, clientRequest: read.clientRequest, specs }),
        ids: {
          dimIds: new Set(dims.keys()),
          countIds: new Set(buildCountIndex(tradeSheets).keys()),
          scheduleIds: new Set(buildScheduleIndex(tradeSheets).keys()),
          specIds: new Set(specs.map((x) => x.id)),
          photoIds: photoIdSet,
          excel,
        },
      };
    })();
    const tradeCall = async (t) => {
      let tu = null;
      const res = await d.complete({
        system: TRADE_SYNTHESIS_SYSTEM,
        prompt: tradeSynthesisPrompt(tradeCtx.shared, { tradeKey: t.tradeKey, focus: t.focus }),
        tier: "best",
        // Low until real reads are measured (the plan's S6); painting keeps
        // medium.
        reasoningEffort: "low",
        maxTokens: 16000,
        schema: TRADE_SYNTHESIS_SCHEMA,
        schemaName: "plan_read_trade",
        promptCacheKey: `plan_read:${planReadId}:trades`,
        onUsage: (x) => {
          tu = x;
        },
      });
      if (tu) await record(tu, "trade_synthesis");
      if (!res?.ok) throw new Error(`${t.tradeKey} synthesis: ${res?.reason || "failed"}`);
      return sanitiseTradeSynthesis(res.data, t.tradeKey, tradeCtx.ids);
    };

    const [paintingModel, ...tradeModels] = await Promise.all([doPainting ? paintingCall() : Promise.resolve(null), ...otherTrades.map(tradeCall)]);
    clock((t) => markStep(t, "synthesis", "end", d.now()));

    // A read with no scope stated keeps exactly the model it always had (no
    // new keys). A scoped read says which parts it holds.
    const model = scoped.stated
      ? {
          ...(paintingModel || emptyPaintingModel(tradeModels[0])),
          painting: doPainting,
          trades: tradeModels,
        }
      : paintingModel;
    let similar = null;
    if (doPainting) {
      const computed = computeProject(model, { dims: buildDimIndex(paintingSheets), book: interiorBook, excel, photoRead, takeoff: paintingTakeoff, metric: paintingSheets.some((s) => s.scale?.system === "metric") });
      try {
        similar = await d.similarPastQuotes({ companyId, buildingType: model.buildingType, clientRequest: read.clientRequest, sqft: paintedSqft(computed), books });
      } catch (err) {
        console.error("[planRead] similar quotes:", err?.message);
      }
    }

    // ── 4. Settle ─────────────────────────────────────────────────────────
    // The refund goes under the hold's own refund ref (refundReservation →
    // "refund:<ref>"), which the ledger holds unique per company: however
    // many workers reach this line, the hold is given back once.
    const s = settlement({ reservedCents: read.reservedCents, runVendorMicros: usage?.run?.vendorMicros, waivedMicros: usage?.run?.waivedMicros });
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
    if (d.afterReady) {
      try {
        await d.afterReady({ read: { ...read, model, status: "ready", readAt: new Date(d.now()) }, companyId });
      } catch (err) {
        // The read is settled and paid; a pricing or notice failure is
        // logged, never a failed read.
        console.error("[planRead] after the read:", err?.message);
      }
    }
    return { state: "ready", chargedCents: s.chargedCents, refundCents: s.refundCents };
  } catch (err) {
    console.error("[planRead] read failed:", err?.message);
    if (read.reservationRef && read.reservedCents > 0) {
      await d
        .refundReservation({ companyId, ref: read.reservationRef, cents: read.reservedCents, forKind: "plan_read", note: "Refund — the drawing read couldn't finish" })
        .catch(() => {});
    }
    clock((t) => endTiming(t, d.now(), "failed"));
    await save({ status: "failed", stage: null, error: err?.userMessage || "The read couldn't finish. Nothing was charged — try again.", leaseUntil: null, reservedCents: 0, reservationRef: null });
    return { state: "failed" };
  }
}

export { READ_MODELS };
