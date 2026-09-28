// app/(marketing)/industries/[slug]/showcase/roofingRun.js
//
// What POST /api/instant-quote/[slug]/request would produce for the showcase
// house — the homeowner's reply, the lead, the draft quote and the review
// card — computed in the browser from the body the real form builds.
//
// ══ Imported, never restated: every number ═════════════════════════════════
//
// The route prices with priceOneMaterial(), which loads the saved row and then
// calls computeInstantEstimate() over it; the saved row here is the fixture's
// (./buildRoofingShowcase.js), so this calls computeInstantEstimate() with it
// directly. The "every tier" table is priceOptionsFor(), the exact function
// the public /measure route runs. The lead is scored by scoreLead(), its
// intake built by buildLeadIntake(), the budget band read by bandForIndex(),
// the draft's lines by lineItemsFromBreakdown() and its money by quoteTotals()
// — each the function the route or createEstimateDraft() calls. What is
// restated is only the PLUMBING between them, which lives in files that read
// the database: the tear-off clamp of measureForTrade(), the route's
// enteredDetails() and sanitiseMeasurement() (the roofing fields of it), and
// the order the route calls things in. scripts/check-roofing-example.mjs
// pins each restatement against the source it came from.
//
// Pure: no React, no fetch, no storage. The check executes it.

import { computeInstantEstimate } from "@/lib/estimate/instantEstimate";
import { priceOptionsFor } from "@/lib/estimate/instantQuoteReadiness";
import { publicEstimate, effectiveVisibility, visibilityFor, gatedMessage } from "@/lib/estimate/visibility";
import { bandForIndex, estimateExceedsBudget, scoreKeyForBandIndex } from "@/lib/estimate/budgetBands";
import { financingOffer } from "@/lib/estimate/financing";
import { cleanTradeAnswers, tradeAnswerLines } from "@/lib/leads/tradeQuestions";
import { buildLeadIntake } from "@/lib/leads/intakeShape";
import { scoreLead } from "@/lib/leads/score";
import { cleanBudgetBand, cleanTimeline } from "@/lib/leads/qualifiers";
import { lineItemsFromBreakdown, breakdownForRecord } from "@/lib/estimate/estimateLines";
import { quoteTotals } from "@/lib/quotes/totals";
import { resolutionForDocument } from "@/lib/tax/taxResolution";
import { appliedTaxRate, documentLinesTotal } from "@/lib/estimate/approveEstimate";
import { materialLabelFromConfig } from "@/lib/estimate/materialLabel";
import { instantQuoteCopy, instantQuoteLanguage, instantTradeLabel } from "@/lib/i18n/instantQuoteCopy";
import { contactSatisfied } from "@/lib/estimate/formFields";

/**
 * The saved row with its option names in `language` — what priceOneMaterial()
 * gets from withMaterialPhrases(): keys and rates untouched, labels swapped
 * for the drafted translation (here, the showcase's own, per form language).
 */
export function configFor(fixture, language = "en") {
  const names = fixture.materialLabels?.[language] || null;
  if (!names) return fixture.config;
  return {
    ...fixture.config,
    materials: (fixture.config.materials || []).map((m) => (names[m.key] ? { ...m, label: names[m.key] } : m)),
  };
}

/** measureForTrade()'s roof branch: "Tear-off layers come from the homeowner, not the satellite." */
export function tearOffLayersFrom(intake) {
  return Math.max(0, Math.floor(Number(intake?.tearOffLayers) || 0));
}

/** The measurement as priced: the fixture's roof plus the homeowner's layers. */
export function measurementFor(fixture, intake) {
  return { ...fixture.measurement, tearOffLayers: tearOffLayersFrom(intake) };
}

/** priceOneMaterial()'s figure for one option — the draft is written from this. */
export function estimateFor(fixture, { materialKey, intake, language = "en" }) {
  return computeInstantEstimate({
    trade: fixture.trade,
    measurements: measurementFor(fixture, intake),
    materialKey,
    config: configFor(fixture, language),
    language,
  });
}

/** /measure's list: every option priced for this roof, before the visibility gate. */
export function optionsFor(fixture, { intake, language = "en" }) {
  return priceOptionsFor({ trade: fixture.trade, config: configFor(fixture, language), measurement: measurementFor(fixture, intake), language });
}

/** The route's enteredDetails(): the scalar intake, trimmed, plus the option picked. */
function enteredDetails(intake, materialKey) {
  const out = {};
  if (intake && typeof intake === "object" && !Array.isArray(intake)) {
    for (const [k, v] of Object.entries(intake).slice(0, 40)) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) continue;
      if (k === "items") continue;
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      else if (typeof v === "boolean") out[k] = v;
      else if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 200);
    }
  }
  if (typeof materialKey === "string" && materialKey.trim()) out.material = materialKey.trim().slice(0, 60);
  return out;
}

/** The route's sanitiseMeasurement(), for the fields a roof carries. */
function storedMeasurement(m) {
  return {
    areaSqft: m.areaSqft ?? null,
    squares: m.squares ?? null,
    predominantPitch: m.predominantPitch ?? null,
    steepness: m.steepness ?? null,
    footprintSqft: m.footprintSqft ?? null,
    tearOffLayers: m.tearOffLayers ?? null,
    satelliteImageUrl: m.satelliteImageUrl ?? null,
    formattedAddress: m.formattedAddress ?? null,
    imageryDate: m.imageryDate ?? null,
    source: m.source ?? null,
  };
}

/**
 * loadMaterialLabels()'s entry for one option: the saved row's label, by the
 * same pure materialLabelFromConfig() it runs, with the drafted names in the
 * other languages — here the showcase's own (fixture.materialLabels, its
 * stand-in for namespace materialLabel), minus the company's language, which
 * loadPhraseTranslations() never returns a translation for. Null for a key
 * nobody can name, as the route leaves it.
 */
function materialLabelFor(fixture, key) {
  const label = materialLabelFromConfig(fixture.config, key);
  if (!label) return null;
  const translations = {};
  for (const [code, names] of Object.entries(fixture.materialLabels || {})) {
    if (code !== fixture.company.defaultLanguage && typeof names?.[key] === "string" && names[key].trim()) translations[code] = names[key];
  }
  return { label, translations };
}

/**
 * The whole request, as the route runs it.
 *
 * @param fixture  buildRoofingShowcase()'s result
 * @param body     the object InstantQuoteFlow's submit() builds (never money)
 * @param opts.now the moment the request is stamped with
 * @returns {{ reply, lead, draft, review, estimate, options, measurement }}
 * @throws Error with the route's own sentence when the body could not be priced
 */
export function runRequest(fixture, body, { now = new Date(fixture.createdAt) } = {}) {
  const language = instantQuoteLanguage(body?.language) || "en";
  const t = instantQuoteCopy(language);
  const trade = body?.trade;
  if (trade !== fixture.trade) throw new Error(t.missingService);
  const name = String(body?.name || "").trim();
  if (!name) throw new Error(t.missingContact);
  const fields = fixture.payloads?.[language]?.trades?.[0]?.fields || {};
  const email = fields.email === "hidden" ? null : String(body?.email || "").trim() || null;
  const phone = fields.phone === "hidden" ? null : String(body?.phone || "").trim() || null;
  if (!contactSatisfied(fields, { phone, email })) throw new Error(t.missingContact);

  const homeowner = cleanTradeAnswers(trade, { whenNeeded: body?.whenNeeded, answers: body?.answers, notes: body?.notes });
  if (!homeowner.whenNeeded) throw new Error(t.missingWhen);

  const measurement = measurementFor(fixture, body?.intake);
  const estimate = estimateFor(fixture, { materialKey: body?.materialKey, intake: body?.intake, language });
  if (!estimate.ok) throw new Error(t.optionUnavailable);

  const band = bandForIndex(fixture.config.budgetThresholds, body?.budgetBandIndex);
  if (!band) throw new Error(t.missingBudget);
  const budget = { min: band.min, max: band.max, label: band.label, exceeded: estimateExceedsBudget(band, estimate) };

  // ── The draft (createEstimateDraft) ────────────────────────────────────
  const categoryLabel = instantTradeLabel(trade, fixture.company.defaultLanguage);
  const lineItems = lineItemsFromBreakdown(estimate.breakdown, { label: categoryLabel });
  const totals = quoteTotals({ subtotal: estimate.point || 0, discount: 0, taxRate: fixture.tax.rate, taxEnabled: true });
  const homeownerLines = tradeAnswerLines(trade, homeowner, fixture.company.defaultLanguage);
  const stored = storedMeasurement(measurement);
  const createdAt = now.toISOString();
  const quoteId = "sample-quote";
  const draft = {
    id: quoteId,
    quoteNumber: fixture.quoteNumber,
    status: "draft",
    needsReview: true,
    autoEstimated: true,
    language,
    currency: fixture.company.currency,
    lineItems,
    subtotal: estimate.point || 0,
    tax: totals.tax,
    taxRate: fixture.tax.rate,
    // createEstimateDraft's Quote.taxResolution, by its own call.
    taxResolution: resolutionForDocument({
      resolution: fixture.tax.resolution || null,
      tax: totals.tax,
      taxableBase: totals.taxableBase,
      taxEnabled: true,
    }),
    total: totals.total,
    reviewNotes: homeownerLines.join("\n") || null,
    estimateData: {
      trade,
      materialKey: body?.materialKey || null,
      measurement: stored,
      range: { low: estimate.low, point: estimate.point, high: estimate.high },
      unit: estimate.unit || null,
      breakdown: breakdownForRecord(estimate.breakdown),
      assumptions: estimate.assumptions || [],
      budget,
      homeowner: { whenNeeded: homeowner.whenNeeded || null, answers: homeowner.answers || {}, notes: homeowner.notes || null, lines: homeownerLines },
    },
    createdAt,
  };

  // ── The lead (createScoredLead) ────────────────────────────────────────
  const address = body?.address || fixture.address;
  const budgetBand = cleanBudgetBand(scoreKeyForBandIndex(band.index));
  const timeline = cleanTimeline(homeowner.timeline);
  const message = [address, `Instant estimate — ${trade}`].filter(Boolean).join("\n\n");
  const intake = buildLeadIntake({
    address,
    details: { ...enteredDetails(body?.intake, body?.materialKey), whenNeeded: homeowner.whenNeeded, ...homeowner.answers, ...(homeowner.notes && { notes: homeowner.notes }) },
  });
  const scored = scoreLead({ budgetBand, timeline, phone, email, clientPhotos: [], message, intake }, { unasked: [] });
  const lead = {
    id: "sample-lead",
    name,
    email,
    phone,
    status: "new",
    source: "instant_quote",
    message,
    budgetBand,
    timeline,
    language,
    score: scored.score,
    temperature: scored.temperature,
    scoreReasons: scored.reasons,
    intake,
    category: { label: categoryLabel },
    clientPhotos: [],
    notes: [],
    assignedTo: null,
    attribution: null,
    callbackRequestedAt: null,
    doNotCall: false,
    quoteId,
    quote: { id: quoteId, quoteNumber: fixture.quoteNumber, status: "draft" },
    // What GET /api/leads/[id] adds, so the drawer names the option the way
    // it does for a real lead ("Architectural shingles", not asphalt_arch).
    materialLabel: materialLabelFor(fixture, body?.materialKey),
    createdAt,
  };

  // ── The review queue's row (GET /api/quotes/estimate-reviews) ──────────
  const review = {
    id: quoteId,
    quoteNumber: fixture.quoteNumber,
    total: totals.total,
    // The rest of the money the route selects, and the two figures it adds
    // beside it — appliedTaxRate / documentLinesTotal, called as the route
    // calls them — so "Approve at (total incl. tax)" carries its
    // "= X before tax + Y tax" caption here as it does in the app. The
    // draft's one scope group mirrors its lineItems (createEstimateDraft),
    // so the flat list totals the same as the group would.
    subtotal: draft.subtotal,
    discount: 0,
    tax: draft.tax,
    taxEnabled: true,
    taxRate: appliedTaxRate({ subtotal: draft.subtotal, discount: 0, tax: draft.tax, taxEnabled: true, taxResolution: draft.taxResolution }),
    linesTotal: documentLinesTotal({ lineItems: draft.lineItems }),
    materialLabel: materialLabelFor(fixture, body?.materialKey),
    estimateSource: fixture.measurement.source,
    reviewNotes: draft.reviewNotes,
    createdAt,
    photoCheck: null,
    reportUrl: null,
    recordingHref: null,
    client: { name, email, phone, address },
    assignedTo: null,
    estimateData: draft.estimateData,
  };

  // ── The reply the form reveals (after_submit resolves to "range" here) ──
  const mode = effectiveVisibility(visibilityFor(fixture.config), "confirmed");
  const pub = publicEstimate(estimate, mode);
  const shown = pub.show ? { low: pub.low, high: pub.high, unit: estimate.unit || null, assumptions: estimate.assumptions || [] } : null;
  const reply = {
    ok: true,
    reference: fixture.quoteNumber,
    quoteId,
    reportUrl: null,
    estimate: shown,
    measurement: stored,
    financing: financingOffer(fixture.company.financing || null, { language }),
    message: shown ? null : gatedMessage(language, "confirmed"),
    tracking: { eventId: null, params: {} },
  };

  return { reply, lead, draft, review, estimate, measurement, options: optionsFor(fixture, { intake: body?.intake, language }) };
}

/** The request shown before the visitor submits one: the fixture homeowner's. */
export function defaultBody(fixture, language = "en") {
  return {
    trade: fixture.trade,
    intake: { tearOffLayers: "2" },
    materialKey: "asphalt_arch",
    name: fixture.homeowner.name,
    email: fixture.homeowner.email,
    phone: fixture.homeowner.phone,
    language: instantQuoteLanguage(language) || "en",
    whenNeeded: "this_season",
    answers: { activeLeak: "no" },
    address: fixture.address,
    budgetBandIndex: 3,
  };
}

/**
 * "How this price was worked out", from the estimate's own outputs and the
 * config it priced from. Every amount is the estimator's (breakdown rows,
 * point, low/high) or quoteTotals' (tax, total). `rounding` is what the
 * estimator's lines fall short of its point by — always 0 since
 * settleBreakdown() (lib/estimate/instantEstimate.js) itemises the point
 * exactly, so the working has no "rounded" row; kept as a figure so the
 * check can prove it stays 0 rather than trusting that it does.
 */
export function priceWorkings(fixture, run) {
  const { estimate, measurement, draft } = run;
  const material = (fixture.config.materials || []).find((m) => m.key === draft.estimateData.materialKey) || null;
  const lines = estimate.breakdown.map((b) => ({ label: b.label, amount: b.amount }));
  const linesTotal = lines.reduce((s, l) => s + l.amount, 0);
  return {
    areaSqft: measurement.areaSqft,
    squares: measurement.squares,
    rise: measurement.predominantPitch?.rise ?? null,
    steepness: measurement.steepness,
    steepnessPct: Number(fixture.config.steepnessSurcharge?.[measurement.steepness] || 0),
    tearOffLayers: measurement.tearOffLayers,
    tearOffRate: Number(fixture.config.tearOffPerSquarePerLayer || 0),
    material: material ? { key: material.key, label: material.label, ratePerSquare: material.ratePerSquare } : null,
    lines,
    rounding: (estimate.point || 0) - linesTotal,
    subtotal: draft.subtotal,
    rangeBandPct: Number(fixture.config.rangeBandPct || 0),
    low: estimate.low,
    high: estimate.high,
    minimumApplied: Boolean(estimate.minimumApplied),
    taxRate: draft.taxRate,
    tax: draft.tax,
    total: draft.total,
  };
}
