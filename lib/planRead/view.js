// lib/planRead/view.js
//
// What GET /api/plan-reads/[id] answers: the files, the reading's progress,
// the project overview with every quantity computed NOW (never stored, so it
// cannot go stale against the model), the draft priced NOW from the
// company's current rates, the company's own similar jobs, the chat, and
// what the next read or message will cost.
//
// Money is left out entirely for a member whose access hides pricing — the
// same showPricing axis the quote page redacts on. The overview and the
// quantities stay: knowing there are 4,200 sq ft of walls is not a price.

import { revisionChains, formatBytes } from "@/lib/jobs/documents";
import { estimateChargeCents } from "@/lib/ai/walletMeter";
import { priceProject, paintedSqft } from "./pricing";
import { readEstimate, hasWorkToRead, loadPaintBooks, measureNeeded, measureStale, measurePlanned, canReadAgain } from "./run";
import { computeRead } from "./computeRead";
import { firstPassOptions } from "./firstPass";
import { priceSlices, guessedShare } from "./slices";
import { ASSUMED, ASSUMED_KEYS } from "./firstPassRules";
import { SOURCES } from "./referenceTables";
import { buildReview } from "./review";
import { ACCESS_REASONS } from "./accessReasons";
import { feetPerPixelFromScale } from "./dimensions";
import { timingSummary } from "./timing";
import { sheetPassDone } from "./sheetState";
import { TRADE_LABELS } from "./tradeCatalogue";
import { readPricing } from "./readPricing";
import { sheetDirectory, sheetDisplayName } from "./sheetNames";

function docStatus(doc, read) {
  const mime = String(doc.mimeType || "");
  if (mime === "application/pdf") {
    const sheets = (read.sheets || []).filter((s) => s.docId === doc.id);
    return { type: "drawing", sheets: sheets.length, sheetsRead: sheets.filter(sheetPassDone).length, pagesRendered: Array.isArray(doc.pages) ? doc.pages.length : 0 };
  }
  if (mime.includes("spreadsheet") || mime === "text/csv") {
    const parsed = read.excelRows?.byDoc?.[doc.id];
    return { type: "spreadsheet", rows: parsed?.rowCount || 0, unreadable: Boolean(read.excelRows?.failed?.[doc.id]) };
  }
  if (mime.startsWith("image/")) return { type: "photo", read: Boolean(read.photoRead?.photos?.some((p) => p.docId === doc.id)) };
  return { type: "other" };
}

/**
 * What reusing an earlier read's sheet passes would save, in the same credits
 * the read's own estimate is stated in. Pure.
 */
export function reuseSavings(read, offer) {
  if (!offer?.sheets?.length || !hasWorkToRead(read)) return null;
  const keys = new Set(offer.sheets.map((s) => s.key));
  const now = readEstimate(read);
  // As if those sheets were already read — what the estimate would then say.
  const after = readEstimate({ ...read, sheets: (read.sheets || []).map((s) => (keys.has(s.key) ? { ...s, read: s.read || { reused: true } } : s)) });
  return { savesCents: Math.max(0, now.cents - after.cents), afterCents: after.cents };
}

/**
 * @param read      the PlanRead with documents and messages
 * @param opts      { canSeeMoney, balanceCents, sheetKey } — sheetKey asks for
 *                  one sheet's dimensions and scale (the measure tool);
 *                  authors (userId → name) for the history; reuseOffer, the
 *                  best of lib/planRead/sheetCache.js's offers, if any
 */
export async function planReadView(read, { companyId, canSeeMoney, balanceCents = null, sheetKey = null, prisma, authors = {}, reuseOffer = null, scopeOptions = [], pricingCtx = null, chatChargedCents = null, fpCtx = null } = {}) {
  const { books, own } = await loadPaintBooks(companyId, prisma ? { prisma } : {});
  // Every quantity computed now from the same sheets — the first pass's
  // takeoff, the painting model and the trades (lib/planRead/computeRead.js).
  const { inputs, takeoff, computed, trades } = computeRead(read, { books });
  // The first pass's height, prep, crew and access (lib/planRead/firstPass.js),
  // with the company's crew and currency (lib/planRead/firstPassContext.js).
  const firstPass = firstPassOptions({ model: read.model, books, ctx: fpCtx || {} });
  const priced = computed ? priceProject(computed, books, { firstPass }) : null;
  // The whole read priced by the ladder and recommended at the company's
  // target (lib/planRead/readPricing.js) — only with the company's pricing
  // context, which the route loads for a member who may see prices.
  let pricing = null;
  if (computed && pricingCtx && canSeeMoney) {
    try {
      pricing = readPricing({ computed: { ...computed, trades }, pricedPaint: priced, model: read.model, ctx: pricingCtx });
    } catch (err) {
      console.error("[planRead] pricing:", err?.message);
      pricing = { error: true };
    }
  }
  const sqft = computed ? paintedSqft(computed) : 0;
  // Names for who left an access line out and who ticked a check — this
  // company's members only (authors, lib/planRead/history.js).
  const named = (id) => (id && authors[id]) || (id ? "your team" : null);
  const modelForReview = read.model
    ? {
        ...read.model,
        access: (read.model.access || []).map((a) => ({ ...a, zeroBy: a.zeroBy ? named(a.zeroBy) : null })),
      }
    : null;
  // One drawing set → several quotes: each scoped draft priced on its own
  // (lib/planRead/slices.js). Shown when there is more than one.
  let slices = [];
  if (computed) {
    try {
      slices = priceSlices({ read, computed: { ...computed, trades }, books, firstPass, pctx: canSeeMoney ? pricingCtx : null, similar: read.similar || null });
    } catch (err) {
      console.error("[planRead] slices:", err?.message);
    }
  }

  const chains = revisionChains(read.documents || []).map((c) => ({
    ...c,
    current: { ...c.current, size: formatBytes(c.current.sizeBytes), status: docStatus(c.current, read) },
  }));

  // A sheet number only when no other sheet shares it: a set read before the
  // title-block fix stored its paper size, "A-3", on every sheet
  // (lib/planRead/sheetNames.js) — the same names the chat is given.
  const directory = new Map(sheetDirectory(inputs.sheets).map((d) => [d.key, d]));
  const sheets = inputs.sheets.map((s) => {
    const doc = inputs.docs.find((d) => d.id === s.docId);
    const image = (Array.isArray(doc?.pages) ? doc.pages : []).find((p) => p.page === s.docPage) || null;
    return {
      key: s.key,
      name: sheetDisplayName(directory.get(s.key)) || s.sheetNumber || `Page ${s.page}`,
      title: s.title,
      vector: s.vector,
      scale: s.scale,
      dims: (s.dims || []).length + (s.scanDims || []).length,
      read: s.read ? { relevant: s.read.relevant, summary: s.read.summary, failed: Boolean(s.read.failed) } : null,
      image,
      // Feet per pixel from the title-block scale, when the page and the image
      // say how big they are. The measure tool starts from it and lets the
      // estimator calibrate over it.
      feetPerPixel:
        image && s.scale?.ratio ? feetPerPixelFromScale({ ratio: s.scale.ratio, pointsWidth: s.pointsWidth, pixelWidth: image.width }) : null,
      ...(sheetKey === s.key ? { dimList: [...(s.dims || []), ...(s.scanDims || [])] } : {}),
      // What the first pass made of the sheet: its kind and what it measured.
      kind: takeoff.kinds.get(s.key) || null,
      measured: s.measure ? (s.measure.failed ? "failed" : [...takeoff.faces.values()].filter((f) => f.sheetKey === s.key && f.measured).length) : null,
      // Whether this read sends the sheet, and for which trades — "not for
      // this quote" is a reason the screen states, never a silent skip.
      route: inputs.routes.get(s.key) || null,
    };
  });

  const estimate = hasWorkToRead(read) ? readEstimate(read) : null;
  // "Read again": the whole read, priced as a forced run would hold it —
  // shown in the confirm before anything is held (lib/planRead/run.js).
  const readAgain = canReadAgain(read) ? readEstimate(read, { force: true }) : null;
  // Sheets the current measurement pass would measure differently: measured
  // by an older version of it (measurePrompts.js MEASURE_VERSION).
  const staleMeasures = (inputs.routed || []).filter((s) => measureStale(s, read, inputs.routes.get(s.key))).length;
  // Measuring that went wrong, said as such — never "made before FieldQuo
  // measured" (lib/planRead/run.js measureOutcome):
  //   measureFailed    the last pass failed and there was nothing to keep —
  //                    those sheets have no measurements at all;
  //   remeasureFailed  a pass failed or came back empty over a measured
  //                    sheet, and the earlier measurement was KEPT.
  const planned = (inputs.routed || []).filter((s) => measurePlanned(s, read, inputs.routes.get(s.key)));
  const measureFailed = planned.filter((s) => s.measure?.failed && !s.measure.permanent).length;
  const remeasureFailed = planned.filter((s) => s.measure?.remeasure?.failed && !s.measure.failed).length;
  // How much of the price is a guess (slices.js guessedShare) — the screen
  // says so plainly when it is most of it.
  const guessed = priced ? guessedShare(priced) : null;
  const timing = timingSummary(read.usage?.timing);
  const savings = read.status === "reading" ? null : reuseSavings(read, reuseOffer);
  const money = (v) => (canSeeMoney ? v : undefined);
  return {
    id: read.id,
    title: read.title,
    clientRequest: read.clientRequest || "",
    trade: read.trade,
    status: read.status,
    stage: read.stage,
    progress: read.progress || null,
    error: read.error || null,
    leadId: read.leadId,
    clientId: read.clientId,
    quoteId: read.quoteId,
    readAt: read.readAt,
    stale: read.status === "reading" && (!read.leaseUntil || new Date(read.leaseUntil).getTime() < Date.now()),
    documents: chains,
    sheets,
    excel: inputs.excel ? { rows: inputs.excel.rowCount, sheets: inputs.excel.sheets.map((x) => x.name) } : null,
    photoRead: read.photoRead
      ? { photos: read.photoRead.photos, failed: Boolean(read.photoRead.failed), references: (read.photoRead.references || []).length }
      : null,
    project: computed ? { ...computed, trades, painting: read.model?.painting !== false } : null,
    // What the read is for: the quote's services (PlanRead.scope) and the
    // trades they map to; the company's own switched-on services to choose
    // from when the read was started with none.
    scope: {
      categories: Array.isArray(read.scope?.categories) ? read.scope.categories : [],
      from: read.scope?.from || null,
      stated: inputs.scope.stated,
      trades: inputs.scope.trades.map((t) => ({ tradeKey: t.tradeKey, label: TRADE_LABELS[t.tradeKey] || t.tradeKey, focus: t.focus })),
      unmapped: inputs.scope.unmapped,
      sent: inputs.routed.length,
      total: inputs.sheets.length,
    },
    scopeOptions,
    pricing,
    draft: priced
      ? {
          lines: priced.lines.map((l) => ({ ...l, hours: l.hours, labour: money(l.labour), material: money(l.material), amount: money(l.amount) })),
          // The rental working (rates, the why with its dollar figures) is money too.
          access: priced.access.map((a) => (canSeeMoney ? a : { ...a, price: undefined, rental: undefined, why: undefined })),
          subtotal: money(priced.subtotal),
          paintTotal: money(priced.paintTotal),
          accessTotal: money(priced.accessTotal),
          unpricedAccess: priced.unpricedAccess,
          // The crew plan: days on site, the 2/3/4-painter options. Hours and
          // days are not money; the options' costs are.
          plan: priced.plan ? { ...priced.plan, options: priced.plan.options.map((o) => ({ ...o, equipmentCost: money(o.equipmentCost) })) } : null,
          // The material list (quantities are not money; prices are).
          materials: priced.materials ? { ...priced.materials, total: money(priced.materials.total), sundries: money(priced.materials.sundries), editDelta: money(priced.materials.editDelta), items: priced.materials.items.map((i) => ({ ...i, unitPrice: money(i.unitPrice), total: money(i.total) })) } : null,
          unpricedCount: priced.unpricedCount,
          skipped: priced.skipped,
          sqft,
          perSqft: canSeeMoney && sqft > 0 ? Math.round((priced.paintTotal / sqft) * 100) / 100 : undefined,
          ownRates: own,
        }
      : null,
    similar: canSeeMoney ? read.similar || null : read.similar ? { ...read.similar, matches: [], range: null, byCategory: {}, hidden: true } : null,
    // The first pass: what it measured, what it priced on (with the one-tap
    // choices), what it could not measure, and the scoped drafts.
    firstPass: computed
      ? {
          faces: [...takeoff.faces.values()].map((f) => ({ id: f.id, sheet: f.sheet, view: f.view, name: f.name, side: f.side, room: f.room, measured: f.measured, confidence: f.confidence, sentence: f.sentence, check: f.check, netSqft: f.netSqft ?? null, floorSqft: f.floorSqft ?? null, perimeterFt: f.perimeterFt ?? null, topFt: f.topFt ?? null })),
          heights: [...takeoff.heights.values()].map((h) => ({ id: h.id, label: h.label, heightFt: h.heightFt ?? null, confidence: h.confidence, sentence: h.sentence })),
          assumed: ASSUMED_KEYS.map((k) => ({ key: k, label: ASSUMED[k].label, options: ASSUMED[k].options, value: read.model?.assumed?.[k]?.value ?? null, basis: read.model?.assumed?.[k]?.basis || null, source: read.model?.assumed?.[k]?.source || null })),
          unmeasured: computed.unmeasured || [],
          bandsSource: firstPass.figures.bandsSource,
          sources: SOURCES,
          // Never measured at all — a sheet measured by an older version is
          // the stale notice below, not "made before FieldQuo measured".
          measureMissing: (inputs.routed || []).some((s) => measureNeeded(s, read, inputs.routes.get(s.key), null) && !measureStale(s, read, inputs.routes.get(s.key))),
          measureFailed,
          remeasureFailed,
          guessed,
          // "What this price includes / Check before sending" — office-only.
          review: (() => {
            try {
              const one = slices.length === 1 ? slices[0] : null;
              const rv = buildReview({ computed: { ...computed, trades }, priced, pricing: canSeeMoney ? pricing : null, model: modelForReview, firstPass, ownRates: own, compare: canSeeMoney ? one?.compare || null : null, currency: canSeeMoney ? fpCtx?.currency || null : null, parts: slices.map((sl) => ({ key: sl.key, label: sl.label, plan: sl.priced?.plan || null })) });
              const scrub = (x) => (canSeeMoney ? x : { ...x, text: x.text.replace(/\(([^)]*\d[^)]*)\)/g, "") });
              return {
                ...rv,
                included: rv.included.map(scrub),
                checks: rv.checks.map((c) => ({ ...scrub(c), tick: c.tick ? { ...c.tick, by: named(c.tick.by) } : null })),
                more: (rv.more || []).map((c) => ({ ...scrub(c), tick: null })),
                reasons: ACCESS_REASONS,
              };
            } catch (err) {
              console.error("[planRead] review:", err?.message);
              return null;
            }
          })(),
          slices: slices.map((sl) => ({
            key: sl.key,
            kind: sl.kind,
            label: sl.label,
            side: sl.side || null,
            categoryKey: sl.categoryKey || null,
            tradeKey: sl.tradeKey || null,
            sqft: sl.metrics?.sqft ?? null,
            surfaces: (sl.computed?.surfaces || []).filter((s) => s.active).length,
            unmeasured: (sl.computed?.unmeasured || []).length,
            hours: sl.priced?.plan?.hours ?? sl.pricing?.recommendation?.hours ?? null,
            days: sl.priced?.plan?.days ?? null,
            wholeDays: sl.priced?.plan?.wholeDays ?? null,
            access: (sl.priced?.access || []).map((a) => ({ id: a.id, label: a.label, price: money(a.price), priceSource: a.priceSource || null })),
            subtotal: money(sl.priced?.subtotal ?? null),
            recommended: money(sl.pricing?.recommendation?.recommended ?? null),
            targetPct: sl.pricing?.recommendation?.targetPct ?? null,
            meetsTarget: sl.pricing?.recommendation?.meetsTarget ?? null,
            perSqft: money(sl.metrics?.perSqft ?? null),
            guessed: sl.priced ? guessedShare(sl.priced) : null,
            compare: canSeeMoney ? sl.compare : null,
          })),
        }
      : null,
    // One history: the chat's turns and the estimator's own edits (role
    // "edit"), each with who and when (lib/planRead/history.js).
    messages: (read.messages || []).map((m) => ({ id: m.id, role: m.role, text: m.text, changes: m.changes || [], createdAt: m.createdAt, chargedCents: m.chargedCents ?? null, author: (m.userId && authors[m.userId]) || null })),
    // How long the last read took, end to end — the estimator's "took 3m 40s".
    // The stage-by-stage split is on /platform (AI usage → Drawing reads).
    timing: timing ? { totalMs: timing.totalMs, outcome: timing.outcome } : null,
    reuse:
      reuseOffer && savings
        ? { fromId: reuseOffer.fromId, title: reuseOffer.title, readAt: reuseOffer.readAt, sheets: reuseOffer.sheets.length, sameRequest: reuseOffer.sameRequest, savesCents: savings.savesCents }
        : null,
    usage: read.usage ? { promptTokens: read.usage.promptTokens || 0, cachedTokens: read.usage.cachedTokens || 0, completionTokens: read.usage.completionTokens || 0, calls: read.usage.calls || 0 } : null,
    credits: {
      readCents: estimate?.cents ?? null,
      readExpectedCents: estimate?.expectedCents ?? null,
      chatCents: estimateChargeCents("plan_read_chat"),
      balanceCents,
      // Everything this read has cost: the read itself (settled onto the
      // row) and its chat (debited per turn — lib/planRead/billing.js
      // chatSpendCents). Null chat when the ledger could not be asked: the
      // screen then names the read's charge alone rather than claim a total.
      chargedCents: (read.chargedCents || 0) + (Number.isFinite(chatChargedCents) ? chatChargedCents : 0),
      readChargedCents: read.chargedCents || 0,
      chatChargedCents: Number.isFinite(chatChargedCents) ? chatChargedCents : null,
      heldCents: read.reservedCents || 0,
      readAgainCents: readAgain?.cents ?? null,
      readAgainExpectedCents: readAgain?.expectedCents ?? null,
    },
    canRead: hasWorkToRead(read),
    canReadAgain: Boolean(readAgain),
    // How many of the sheets this read uses were measured by an older
    // version of the measurement pass — "Measured with an older version".
    staleMeasures,
    canSeeMoney,
  };
}
