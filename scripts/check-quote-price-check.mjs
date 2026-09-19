// scripts/check-quote-price-check.mjs
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-quote-price-check.mjs
//
// The quote review's three cost-and-price findings, executed against
// fixtures rather than read off the source.
//
// ── What the owner asked, and what is pinned ───────────────────────────────
//
// "Does the AI also review the cost and margin to help understand if
// something is underpriced?" — it did not. The review compared TOTALS to
// totals and never saw the Cost & margin block. And on that comparison: "if
// they have a bigger project it is normal to have a bigger price."
//
//   A. Margin against the company's target, off the SAME costing object the
//      block shows: 8% against 25% is high, 18% against 25% is medium; no
//      target set says "the 20% default"; nothing costed says that instead
//      of a margin; costIncomplete adds its clause; the thin lines are named
//      with their numbers.
//   B. The price check compares PER UNIT of measured work when both sides
//      carry the unit, on the total only when they don't, and says which.
//      The two thresholds. The hedge survives on the total path only.
//   C. What history says: enough closed jobs → the adjusted margin with the
//      numbers, labour-only and both-dimension variants; too few → the one
//      line; on-target → the costing holds.
//   D. Permission: a reader without job costing gets no `margin` and no
//      `actuals` — proven on the redaction function and on the route source.
//   E. The writing pass receives the cost picture as facts and its output
//      schema has no field a number could travel in.
//   F. "Apply to this quote" changes a draft's hours, price and lines,
//      refuses a sent quote; a calibration offer exists only where a saved
//      rate can take it; the calibrate route attributes the write.
//   G. Every sentence template exists in all nine catalogues, and the
//      English rendering the server stores is the catalogue's own.

import { readFileSync } from "node:fs";
import {
  priceFinding,
  marginFinding,
  actualsFinding,
  calibrationOffers,
  renderEnglish,
  MIN_SAMPLE,
} from "@/lib/quotes/reviewFindings";
import { primaryMeasure, pricePerUnit } from "@/lib/quotes/primaryMeasure";
import { redactReview, INTERNAL_REVIEW_KEYS } from "@/lib/quotes/reviewRedaction";
import { applyActualsToDraft } from "@/lib/quotes/applyActuals";
import { marginTargetPctFrom, DEFAULT_MARGIN_TARGET_PCT } from "@/lib/costing/marginTarget";
import { MARGIN_TARGET_PCT } from "@/lib/costing/quoteCosting";
import { DEFAULT_TARGET_MARGIN } from "@/lib/analytics/minimumPrice";
import { internalCostPicture } from "@/lib/ai/quoteReview";
import { buildEstimateAccuracy, MIN_SAMPLE as ACCURACY_MIN } from "@/lib/analytics/estimateAccuracy";
import { labourBasisFor } from "@/lib/costing/labourCalibration";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { resolveParams, fillTemplate } from "@/lib/quotes/reviewSentence";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)?.slice(0, 400)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ───────────────────────────────────────────────────────────────────────────
section("A. Margin against the target — off the block's own costing object");

const costing = {
  saved: true,
  marginPct: 8,
  marginTargetPct: 25,
  estimatedCost: 4140,
  price: 4500,
  labourHours: 62,
  blendedRate: 45,
  labourCost: 2790,
  materialTotal: 980,
  overhead: 370,
  unpricedMaterials: 0,
  costIncomplete: false,
  groups: [{ label: "Interior painting", categoryKey: "interior_painting", labourHours: 41, materialTotal: 620 }],
};
const groups = [{ categoryKey: "interior_painting", label: "Interior painting", subtotal: 2100 }];
const target25 = { pct: 25, isDefault: false };

const high = marginFinding({ costing, target: target25, scopeGroups: groups, currency: "CAD" });
ok(high.severity === "high" && high.verdict === "below", "8% against 25% → high", high);
ok(high.title === "Margin below your target — 8% against your 25% target", "title names both numbers", high.title);
ok(/\$4,140 of cost against a price of \$4,500/.test(high.detail), "detail carries cost and price", high.detail);
ok(/62 hours at \$45 an hour is \$2,790, materials \$980, overhead \$370/.test(high.detail), "detail says why in hours, rate, materials, overhead", high.detail);
ok(/Interior painting carries the gap: 41 hours and \$620 of materials against \$2,100 \(-17%\)/.test(high.detail), "the thin line is named with its numbers", high.detail);
ok(!/lower still/.test(high.detail), "no costIncomplete clause when the cost is complete");

const medium = marginFinding({ costing: { ...costing, marginPct: 18 }, target: target25, scopeGroups: groups, currency: "CAD" });
ok(medium.severity === "medium", "18% against 25% → medium", medium.severity);
ok(marginFinding({ costing: { ...costing, marginPct: 12.4 }, target: target25, scopeGroups: [], currency: "CAD" }).severity === "high", "just under half the target → high");
ok(marginFinding({ costing: { ...costing, marginPct: 12.6 }, target: target25, scopeGroups: [], currency: "CAD" }).severity === "medium", "just over half the target → medium");
ok(marginFinding({ costing: { ...costing, marginPct: -3 }, target: { pct: 4, isDefault: false }, scopeGroups: [], currency: "CAD" }).severity === "high", "negative margin → high even against a tiny target");

const dflt = marginFinding({ costing: { ...costing, marginPct: 18 }, target: { pct: 20, isDefault: true }, scopeGroups: [], currency: "CAD" });
ok(dflt.title === "Margin below your target — 18% against the 20% default", "no target set → 'against the 20% default'", dflt.title);
ok(/Set your own target in Settings → Overhead\.$/.test(dflt.detail), "…and says where to set one", dflt.detail);

const notCosted = marginFinding({ costing: { saved: false, marginPct: 31, marginTargetPct: 20 }, target: target25, scopeGroups: [], currency: "CAD" });
ok(notCosted.verdict === "not_costed" && !/31/.test(notCosted.detail), "nothing costed at save → says so, prints no margin", notCosted);
ok(/Nothing was costed when this quote was saved/.test(notCosted.detail), "the not-costed sentence", notCosted.detail);
ok(marginFinding({ costing: { saved: true, costBasisMissing: true, marginPct: null }, target: target25, currency: "CAD" }).verdict === "not_costed", "cost basis missing → not costed");

const incomplete = marginFinding({ costing: { ...costing, costIncomplete: true, unpricedMaterials: 2 }, target: target25, scopeGroups: groups, currency: "CAD" });
ok(/And some work has no cost against it, so the real margin is lower still\./.test(incomplete.detail), "costIncomplete adds the clause", incomplete.detail);
ok(/2 material lines have no supplier price yet/.test(incomplete.detail), "unpriced materials are counted", incomplete.detail);

const onTarget = marginFinding({ costing: { ...costing, marginPct: 27 }, target: target25, scopeGroups: groups, currency: "CAD" });
ok(onTarget.verdict === "on_target" && onTarget.severity === null, "27% against 25% → on target, not a thing to fix", onTarget);
ok(onTarget.title === "Margin on target — 27% against your 25% target", "on-target title", onTarget.title);
ok(marginFinding({ costing: null, target: target25 }) === null, "no costing object → no finding");

section("A2. The target itself — one definition, the company's own");
ok(DEFAULT_MARGIN_TARGET_PCT === 20 && MARGIN_TARGET_PCT === 20 && DEFAULT_TARGET_MARGIN === 0.2, "the builder, the saved row and the price floor share the 20% default");
ok(JSON.stringify(marginTargetPctFrom(null)) === JSON.stringify({ pct: 20, isDefault: true }), "null → default, flagged");
ok(JSON.stringify(marginTargetPctFrom("0.25")) === JSON.stringify({ pct: 25, isDefault: false }), "0.25 → 25, not default");
ok(marginTargetPctFrom(0).pct === 0 && !marginTargetPctFrom(0).isDefault, "0 is a target, not an absence");
ok(marginTargetPctFrom(3).pct === 95, "clamped like the floor");
{
  const write = read("app/api/quotes/costingWrite.js");
  const derive = read("lib/costing/quoteCostEstimate.js");
  const builder = read("app/components/quotes/builder/QuoteBuilder.js");
  ok(/companyMarginTarget\(companyId\)/.test(write) && /marginTargetPct: target\.pct/.test(write), "the saved row freezes the company's target");
  ok(/companyMarginTarget\(companyId\)/.test(derive) && /marginTargetPct: target\.pct/.test(derive), "the derived fallback measures against it too");
  ok(/fetch\("\/api\/settings\/forecast"\)/.test(builder) && /boot\.marginTargetPct \?\? MARGIN_TARGET_PCT/.test(builder), "the builder's live badge reads it");
  ok(!/marginTargetPct: MARGIN_TARGET_PCT/.test(write), "no hard-coded target left on the write path");
}

// ───────────────────────────────────────────────────────────────────────────
section("B. Price — per unit when both sides carry the unit, on the total otherwise");

const hist = (n, per, { unit = "sqft", takeoff = (q) => ({ sqft: q }) } = {}) =>
  Array.from({ length: n }, (_, i) => {
    const qty = 800 + i * 50;
    const subtotal = Math.round(qty * per * (1 + ((i % 3) - 1) / 40));
    return { status: "accepted", total: subtotal, scopeGroups: [{ categoryKey: "siding", takeoff: takeoff(qty), subtotal }] };
  });
const quoteAt = (per, qty = 1000) => ({
  total: per * qty,
  scopeGroups: [{ categoryKey: "siding", categoryLabel: "Siding", takeoff: { sqft: qty }, subtotal: per * qty }],
});

const inRange = priceFinding({ quote: quoteAt(3.1), history: hist(12, 2.95), currency: "CAD" });
ok(inRange.basis === "per_unit" && inRange.verdict === "in_range", "both sides measured in sq ft → per-unit path, in range", inRange);
ok(/^\$3\.10 per sq ft of Siding — in line with what you usually win at \(\$2\.9\d across 12 accepted jobs\)\.$/.test(inRange.detail), "the in-range sentence", inRange.detail);

const low = priceFinding({ quote: quoteAt(1.9), history: hist(12, 2.95), currency: "CAD" });
ok(low.verdict === "low", "$1.90 against $2.95 → low (ratio 0.64 < 0.7)", low);
ok(/^\$1\.90 per sq ft of Siding — 3\d% below your usual \$2\.9\d \(12 accepted jobs\)\. A bigger job is not why: this is the rate, not the total\. Worth checking the hours\.$/.test(low.detail), "the low sentence — rate, not total", low.detail);
ok(!/bigger job is a bigger number/.test(low.detail), "the total-path hedge is NOT on the per-unit path");

const highP = priceFinding({ quote: quoteAt(3.9), history: hist(12, 2.95), currency: "CAD" });
ok(highP.verdict === "high" && /above your usual/.test(highP.detail), "$3.90 against $2.95 → high (ratio 1.32 > 1.25)", highP);
ok(priceFinding({ quote: quoteAt(3.6), history: hist(12, 2.95), currency: "CAD" }).verdict === "in_range", "ratio 1.22 stays in range (threshold 1.25)");
ok(priceFinding({ quote: quoteAt(2.1), history: hist(12, 2.95), currency: "CAD" }).verdict === "in_range", "ratio 0.71 stays in range (threshold 0.7)");

// A bigger job at the same rate is in range — the whole point.
const bigJob = priceFinding({ quote: quoteAt(2.95, 4000), history: hist(12, 2.95), currency: "CAD" });
ok(bigJob.verdict === "in_range", "a 4,000 sq ft job at the usual rate is in range although its total is 4× the median", bigJob);

// Fallbacks — and each says which comparison ran.
const noMeasure = priceFinding({
  quote: { total: 3100, scopeGroups: [{ categoryKey: "snow_removal", takeoff: { plan: "seasonal" }, subtotal: 3100 }] },
  history: hist(12, 2.95),
  currency: "CAD",
});
ok(noMeasure.basis === "total", "quote with no measure → total path");
ok(/^Compared on the total, because this quote has no measured area or count: /.test(noMeasure.detail), "…and says so", noMeasure.detail);
const fewMeasured = priceFinding({
  quote: quoteAt(3.1),
  history: hist(12, 2.95).map((h) => ({ ...h, scopeGroups: [{ categoryKey: "siding", takeoff: null, subtotal: h.total }] })),
  currency: "CAD",
});
ok(fewMeasured.basis === "total" && /^Compared on the total, because none of your accepted Siding quotes carries a measured sq ft: /.test(fewMeasured.detail), "quote measured, history not → total path, says why", fewMeasured.detail);
const three = priceFinding({
  quote: quoteAt(3.1),
  history: hist(12, 2.95).map((h, i) => (i < 3 ? h : { ...h, scopeGroups: [{ categoryKey: "siding", takeoff: null, subtotal: h.total }] })),
  currency: "CAD",
});
ok(/because only 3 of your accepted Siding quotes carry a measured sq ft:/.test(three.detail), "fewer than MIN_SAMPLE measured → counted in the sentence", three.detail);
const unitMismatch = priceFinding({
  quote: quoteAt(3.1),
  history: hist(12, 2.95).map((h) => ({ ...h, scopeGroups: [{ categoryKey: "stairs", takeoff: { sections: [{ treads: 14 }] }, subtotal: h.total }, { categoryKey: "siding", takeoff: null, subtotal: 0 }] })),
  currency: "CAD",
});
ok(unitMismatch.basis === "total", "a history measured in a different unit never becomes a rate comparison");

const totalHigh = priceFinding({ quote: { total: 9000, scopeGroups: [{ categoryKey: "snow_removal", takeoff: null, subtotal: 9000 }] }, history: hist(12, 2.95), currency: "CAD" });
ok(totalHigh.verdict === "high" && /a bigger job is a bigger number/.test(totalHigh.detail), "the total path keeps its hedge", totalHigh.detail);
const totalLow = priceFinding({ quote: { total: 1200, scopeGroups: [{ categoryKey: "snow_removal", takeoff: null, subtotal: 1200 }] }, history: hist(12, 2.95), currency: "CAD" });
ok(totalLow.verdict === "low" && /worth winning at this price/.test(totalLow.detail), "total path low", totalLow.detail);
const insufficient = priceFinding({ quote: quoteAt(3.1), history: hist(MIN_SAMPLE - 1, 2.95), currency: "CAD" });
ok(insufficient.verdict === "insufficient_data" && /Only 4 comparable accepted quotes on record/.test(insufficient.detail), "below MIN_SAMPLE on both paths → insufficient", insufficient.detail);
ok(/Only 1 comparable accepted quote on record/.test(priceFinding({ quote: quoteAt(3.1), history: hist(1, 2.95), currency: "CAD" }).detail), "singular");
ok(priceFinding({ quote: quoteAt(3.1), history: hist(12, 2.95).map((h) => ({ ...h, status: "declined" })), currency: "CAD" }).verdict === "insufficient_data", "declined quotes are never the yardstick");
ok(/^\$3\.10 per sq ft/.test(priceFinding({ quote: quoteAt(3.1), history: hist(12, 2.95), currency: "USD" }).detail), "USD prints $, not US$");

section("B2. The measure per trade — hostile shapes");
ok(JSON.stringify(primaryMeasure("interior_painting", { model: "area_substrate", areas: [{ lengthFt: 12, widthFt: 10, heightFt: 8 }, { measurement: "surface", surfaceSqft: 200 }] })) === JSON.stringify({ quantity: 552, unit: "sqft" }), "painting: walls from the area model, ceilings excluded");
ok(primaryMeasure("stairs", { sections: [{ treads: 14 }, { treads: 3 }] }).quantity === 17, "stairs: treads summed across sections");
ok(primaryMeasure("roofing_service", { areaSqft: 2300 }).unit === "square" && primaryMeasure("roofing_service", { areaSqft: 2300 }).quantity === 23, "roofing: squares");
ok(primaryMeasure("cabinet_refinishing", null, { doorCount: "32", drawerCount: 6 }).quantity === 38, "cabinets: doors + drawer fronts from the intake");
ok(primaryMeasure("gutter_services", { gutterFt: 180 }).unit === "linear_ft", "gutters: linear ft");
ok(primaryMeasure("countertop", null, {}) === null, "countertop with no area → null, never a guess");
ok(primaryMeasure("gutter_services", { gutterFt: -5 }) === null && primaryMeasure("flooring", "garbage") === null && primaryMeasure("siding", { sqft: "NaN" }) === null, "negative, string and NaN quantities → null");
ok(pricePerUnit({ categoryKey: "siding", takeoff: { sqft: 1000 }, subtotal: 0 }) === null, "a group priced at nothing has no rate");
ok(pricePerUnit({ categoryKey: "siding", takeoff: { sqft: 1000 }, subtotal: "3100" }).perUnit === 3.1, "rate = subtotal / quantity");

// ───────────────────────────────────────────────────────────────────────────
section("C. Actuals — what jobs like this really cost, applied to this quote");

// Built through the REAL roll-up, so the floor is its floor, not ours.
const est = (o = {}) => ({ labourHours: 40, labourCost: 1800, materialTotal: 600, unpricedMaterials: 0, costIncomplete: false, totalCost: 2600, at: null, ...o });
const entry = (hours, rate = 40) => ({ hours, status: "approved", workerId: "w1", worker: { name: "A", hourlyRate: rate } });
let seq = 0;
const job = ({ trade = "interior_painting", hoursFactor = 1.18, materialsFactor = 1, day = 1 } = {}) => ({
  id: `j${++seq}`,
  title: `Job ${seq}`,
  completedAt: new Date(`2026-0${1 + (day % 8)}-1${day % 9}T12:00:00Z`),
  clientId: null,
  clientName: null,
  tradeKeys: [{ key: trade, label: "Painting" }],
  estimate: est(),
  expenses: [{ category: "materials", amount: 600 * materialsFactor }],
  timeEntries: [entry(40 * hoursFactor)],
});
const roll = (jobs) => buildEstimateAccuracy({ from: "2026-01-01", to: "2026-12-31", currency: "CAD", jobs });
const costed = { ...costing, marginPct: 25, estimatedCost: 3375, labourCost: 2790, materialTotal: 980, price: 4500, marginTargetPct: 25 };

const eight = roll(Array.from({ length: 8 }, (_, i) => job({ day: i })));
const lab = actualsFinding({ costing: costed, accuracy: eight, categoryKey: "interior_painting", categoryLabel: "painting", currency: "CAD" });
ok(lab.verdict === "adjusted" && lab.labour?.pct === 18 && lab.materials === null, "8 painting jobs 18% over on hours, materials on target → labour-only finding", lab);
ok(lab.detail === "Your last 8 painting jobs ran 18% over their estimated hours. At that rate this quote's margin is 14%, not 25%.", "the labour sentence, numbers included", lab.detail);
ok(lab.adjustedMarginPct === 13.8, "adjusted margin = (4500 − (3375 + 2790 × 0.18)) / 4500", lab.adjustedMarginPct);
ok(lab.severity === "medium", "pushed under the 25% target but not under half → medium", lab.severity);

const both = roll(Array.from({ length: 8 }, (_, i) => job({ day: i, materialsFactor: 1.09 })));
const bothF = actualsFinding({ costing: costed, accuracy: both, categoryKey: "interior_painting", categoryLabel: "painting", currency: "CAD" });
ok(bothF.labour?.pct === 18 && bothF.materials?.pct === 9, "both dimensions carry a signal", bothF);
ok(bothF.detail === "Your painting jobs ran 18% over on hours (8 jobs) and 9% over on materials (8 jobs). At those rates this quote's margin is 12%, not 25%.", "the both-dimension sentence", bothF.detail);

const under = roll(Array.from({ length: 6 }, (_, i) => job({ day: i, hoursFactor: 0.9 })));
const underF = actualsFinding({ costing: costed, accuracy: under, categoryKey: "interior_painting", categoryLabel: "painting", currency: "CAD" });
ok(underF.detail === "Your last 6 painting jobs ran 10% under their estimated hours. At that rate this quote's margin is 31%, not 25% — there may be room in the price." && underF.severity === null, "under-running history → better margin, nothing to fix", underF.detail);

const few = roll(Array.from({ length: ACCURACY_MIN - 2 }, (_, i) => job({ day: i })));
const fewF = actualsFinding({ costing: costed, accuracy: few, categoryKey: "interior_painting", categoryLabel: "painting", currency: "CAD" });
ok(fewF.verdict === "too_few" && fewF.detail === `Only ${ACCURACY_MIN - 2} closed painting jobs with recorded hours — ${ACCURACY_MIN} are needed before history can say anything, so this is the estimate as costed.`, "too few closed jobs → the one-line sentence, using the roll-up's own floor", fewF.detail);
ok(actualsFinding({ costing: costed, accuracy: null, categoryKey: "interior_painting", categoryLabel: "painting", currency: "CAD" }).detail === "No closed painting jobs with recorded hours yet, so this is the estimate as costed.", "no history at all → the zero sentence");
const otherTrade = actualsFinding({ costing: costed, accuracy: eight, categoryKey: "flooring", categoryLabel: "flooring", currency: "CAD" });
ok(otherTrade.verdict === "too_few" && /No closed flooring jobs/.test(otherTrade.detail), "painting history says nothing about a flooring quote");

const exact = roll(Array.from({ length: 6 }, (_, i) => job({ day: i, hoursFactor: 1.02 })));
const exactF = actualsFinding({ costing: costed, accuracy: exact, categoryKey: "interior_painting", categoryLabel: "painting", currency: "CAD" });
ok(exactF.verdict === "on_target" && exactF.detail === "Your last 6 painting jobs came in within 5% of their estimated hours and materials, so the costing holds.", "within tolerance → the costing holds", exactF.detail);

const uncosted = actualsFinding({ costing: { saved: false }, accuracy: eight, categoryKey: "interior_painting", categoryLabel: "painting", currency: "CAD" });
ok(uncosted.verdict === "history_only" && uncosted.detail === "Your last 8 painting jobs ran 18% over their estimated hours. Cost this quote to see what that does to its margin.", "history without a costed quote → says to cost it", uncosted.detail);

// Pending hours are not actuals — the roll-up's rule, inherited.
const pending = roll(Array.from({ length: 8 }, (_, i) => ({ ...job({ day: i }), timeEntries: [{ ...entry(47), status: "pending" }] })));
const pendingF = actualsFinding({ costing: costed, accuracy: pending, categoryKey: "interior_painting", categoryLabel: "painting", currency: "CAD" });
ok(pendingF.verdict === "on_target" && pendingF.detail === "Your last 8 painting jobs came in within 5% of their estimated materials, so the costing holds on materials — their hours are not recorded yet.", "hours awaiting approval are not recorded: only the materials verdict is given, and the sentence says the hours are missing", pendingF.detail);

// ───────────────────────────────────────────────────────────────────────────
section("D. Permission — a reader without job costing gets no cost finding");

const fullReview = { checks: [], pricing: { verdict: "in_range" }, margin: high, actuals: { ...lab, offers: [{ id: "labour:siding:labourHoursPerSqft", store: "book", to: 0.05 }] }, readiness: 78 };
const stripped = redactReview(fullReview, { mayCost: false });
ok(!("margin" in stripped) && !("actuals" in stripped), "no jobCosting → margin and actuals stripped");
ok(!JSON.stringify(stripped).includes("4,140") && !JSON.stringify(stripped).includes("marginPct"), "…and no cost figure survives anywhere in the body");
ok(stripped.pricing && stripped.readiness === 78, "the client-safe half is untouched");
ok("margin" in fullReview, "the stored object was not mutated");
const kept = redactReview(fullReview, { mayCost: true, mayWrite: { recipe: false, book: true } });
ok(kept.margin === high && kept.actuals.offers[0].mayApply === true, "with jobCosting → findings kept, offer marked applicable for a rate-card writer");
ok(redactReview(fullReview, { mayCost: true, mayWrite: { recipe: true, book: false } }).actuals.offers[0].mayApply === false, "…and not applicable for someone who may only write recipes");
ok(redactReview(null, { mayCost: false }) === null, "null review stays null");
ok(JSON.stringify(INTERNAL_REVIEW_KEYS) === JSON.stringify(["margin", "actuals"]), "the internal keys are exactly the two");
{
  const route = read("app/api/quotes/[id]/review/route.js");
  ok((route.match(/forReader\(/g) || []).length === 3, "both handlers pass the review through the reader gate (2 calls + 1 definition)");
  ok(/hasToggle\(full, "jobCosting"\)/.test(route), "the gate is the block's own jobCosting toggle");
  const review = read("lib/ai/quoteReview.js");
  ok(/readiness: readinessScore\(checks\)/.test(review) && !/readinessScore\(\[.*margin/.test(review), "readiness is computed from the client-safe checks only");
}

// ───────────────────────────────────────────────────────────────────────────
section("E. The writing pass — cost facts in, no place for them out");

const picture = internalCostPicture(high, lab);
ok(picture.marginPct === 8 && picture.targetPct === 25 && picture.belowTarget === true, "the model receives margin and target as whole percents", picture);
ok(JSON.stringify(picture.thinLines) === JSON.stringify(["Interior painting"]) && picture.marginAfterHistoryPct === 14, "…the thin lines by name and the history-adjusted margin", picture);
ok(!JSON.stringify(picture).includes("4140") && !JSON.stringify(picture).includes("2790"), "no money in the picture — percents and names only");
ok(internalCostPicture(notCosted, null) === null, "an uncosted quote sends nothing, not zeros");
{
  const src = read("lib/ai/quoteReview.js");
  const schemaSrc = src.slice(src.indexOf("const WRITING_SCHEMA"), src.indexOf("additionalProperties: false,\n};") + 32);
  ok(/rewrites|addOnReasons|processNotes/.test(schemaSrc) && !/number|integer|margin|cost|price|amount/i.test(schemaSrc.replace(/description: "[^"]*"/g, "")), "WRITING_SCHEMA declares only rewrites, addOnReasons and processNotes — no numeric field");
  ok(/additionalProperties: false,\n};/.test(schemaSrc), "…and refuses extra properties");
  ok(/internalCostPicture: costPicture/.test(src) && /INTERNAL\. Nothing about cost, margin, hours, rates or profit may appear/.test(src), "the payload carries the picture and the system prompt forbids repeating it");
}

// ───────────────────────────────────────────────────────────────────────────
section("F. Adjust — apply to the draft, update the costing");

const draft = {
  status: "draft",
  scopeGroups: [
    { categoryKey: "interior_painting", lineItems: [{ description: "Walls", quantity: 2, rate: 500, amount: 1000 }, { description: "Trim", quantity: 1, rate: 200, amount: 200 }, { description: "Included", quantity: 1, rate: 0, amount: 0 }] },
    { categoryKey: "flooring", lineItems: [{ description: "Floor", quantity: 1, rate: 900, amount: 900 }] },
  ],
  manualLabourHours: 2,
  manualMaterialCost: 0,
  estimate: { labourHours: 60, labourCost: 2700, materialTotal: 500, groups: [{ categoryKey: "interior_painting", labourHours: 40, materialTotal: 300 }, { categoryKey: "flooring", labourHours: 20, materialTotal: 200 }] },
  categoryKey: "interior_painting",
  labourPct: 18,
};
const applied = applyActualsToDraft(draft);
ok(applied.ok && applied.addedHours === 7.2 && applied.manualLabourHours === 9.2, "18% of the painting's 40 hours = 7.2 added to the estimator's hours", applied);
ok(applied.priceDelta === 324, "7.2 hours at the estimate's $45/hr = $324 onto the price", applied.priceDelta);
ok(applied.scopeGroups[0].lineItems[0].amount === 1270 && applied.scopeGroups[0].lineItems[1].amount === 254, "spread pro rata across the painting lines (1000:200)", applied.scopeGroups[0].lineItems);
ok(applied.scopeGroups[0].lineItems[2].amount === 0 && applied.scopeGroups[1].lineItems[0].amount === 900, "a zero line and the other trade are untouched");
ok(applied.scopeGroups[0].lineItems[0].rate === 635, "through applyLineItemEdit — rate and amount agree");
const mats = applyActualsToDraft({ ...draft, labourPct: null, materialsPct: 9 });
ok(mats.ok && mats.addedMaterials === 27 && mats.manualMaterialCost === 27 && mats.priceDelta === 27, "9% of the painting's $300 materials = $27 onto cost and price", mats);
ok(applyActualsToDraft({ ...draft, labourPct: -10 }).manualLabourHours === -2 && applyActualsToDraft({ ...draft, labourPct: -10 }).priceDelta === -180, "an under-run lowers hours and price symmetrically");
ok(applyActualsToDraft({ ...draft, status: "sent" }).reason === "not_draft", "refused on a sent quote");
ok(applyActualsToDraft({ ...draft, status: "accepted" }).reason === "not_draft", "refused on an accepted quote");
ok(applyActualsToDraft({ ...draft, labourPct: null }).reason === "nothing_to_apply", "nothing measured → nothing applied");
ok(applyActualsToDraft({ ...draft, scopeGroups: [{ categoryKey: "interior_painting", lineItems: [{ description: "Flat", rate: 1200, amount: 1200 }] }] }).scopeGroups[0].lineItems[0].amount === 1524, "a line with no quantity multiplies as one, not zero");
{
  const builder = read("app/components/quotes/builder/QuoteBuilder.js");
  ok(/applyActualsToDraft\(\{\s*status: start\.status/.test(builder) && /setScopeGroups\(r\.scopeGroups\)/.test(builder) && /setManualLabourHours\(r\.manualLabourHours\)/.test(builder), "the builder applies through its own setters");
  const panel = read("app/components/quotes/SuggestAddOns.js");
  ok(/quoteStatus !== "draft"/.test(panel) && /app\.quoteReview\.applyDraftOnly/.test(panel), "the panel says why on a sent quote instead of hiding the button");
  ok(/\.filter\(\(o\) => o\.mayApply\)/.test(panel), "an offer is drawn only when the server said this reader may press it");
}

// Calibration offers: exactly the close-out's rules. Siding is the one trade
// whose labour rate has a path today (lib/costing/labourCalibration.js).
const sidingBasis = labourBasisFor({ categoryKey: "siding", takeoff: { sqft: 500, materialKey: "vinyl", storeys: "one" } });
ok(sidingBasis?.path === "labourHoursPerSqft" && sidingBasis.store === "book", "siding labour has a saved rate to move");
const inputs = {
  keyToCategoryId: new Map([["siding", "cat-siding"]]),
  labourGroups: [{ categoryKey: "siding", label: "Siding", labourHours: sidingBasis.units * sidingBasis.rate * (sidingBasis.factor || 1), basis: sidingBasis }],
  groups: [],
  currentRates: { recipes: {}, books: {} },
};
const hoursForSiding = inputs.labourGroups[0].labourHours;
const offers = calibrationOffers({ labourPct: 18, materialsPct: null, inputs, estimatedHours: hoursForSiding });
ok(offers.length === 1 && offers[0].kind === "labour" && offers[0].path === "labourHoursPerSqft" && offers[0].store === "book", "18% over on siding → one offer, on the rate card's hours-per-sqft", offers);
ok(Math.abs(offers[0].to / offers[0].from - 1.18) < 0.01 && offers[0].categoryId === "cat-siding", "the suggested rate is the measured factor applied", offers[0]);
ok(calibrationOffers({ labourPct: 18, inputs, estimatedHours: hoursForSiding + 5 }).length === 0, "hand-added hours → no offer (the close-out's own refusal)");
const paintBasis = labourBasisFor({ categoryKey: "interior_painting", takeoff: { model: "area_substrate", areas: [{ measurement: "surface", surfaceSqft: 400 }] } });
const paintInputs = { keyToCategoryId: new Map(), labourGroups: [{ categoryKey: "interior_painting", label: "Painting", labourHours: 40, basis: paintBasis }], groups: [], currentRates: { recipes: {}, books: {} } };
ok(calibrationOffers({ labourPct: 18, inputs: paintInputs, estimatedHours: 40 }).length === 0, "interior painting's labour rate has nowhere to go → no button");
ok(calibrationOffers({ labourPct: null, materialsPct: null, inputs, estimatedHours: 40 }).length === 0, "no signal → no offers");
{
  const route = read("app/api/quotes/[id]/review/calibrate/route.js");
  ok(/offerId/.test(route) && !/body\?\.to\b|body\.value|body\.rate/.test(route), "the browser posts only an offer id — the rate comes off the stored review");
  ok(/recordActivity\(member, \{\s*action: "quote\.costing_calibrated"/.test(route), "the write is attributed to the member in the activity log");
  ok(/from: offer\.from \?\? null,\s*to,/.test(route), "…with the rate before and after");
  ok(/sanitiseRates\(offer\.categoryKey, withPathSet\(rates, offer\.path, to\)\)/.test(route) && /sanitiseRecipeOverrides\(\s*offer\.categoryKey,\s*withPathSet\(overrides, offer\.path, to\)/.test(route), "both stores write through the settings routes' own sanitisers");
  ok(/has changed since the review ran/.test(route), "a rate moved since the review is refused, not overwritten");
  ok(/canWriteCostBasis\(full, "materialRecipes"\)/.test(route) && /\["owner", "admin"\]\.includes\(member\.role\)/.test(route), "the store gates are the calibration route's own");
  const settings = read("app/api/settings/service-categories/route.js");
  ok(/import \{ sanitiseRates \} from "@\/lib\/pricing\/sanitiseRates"/.test(settings) && !/^function sanitiseRates/m.test(settings), "the settings route imports the shared sanitiser rather than keeping a copy");
}

// ───────────────────────────────────────────────────────────────────────────
section("G. Nine languages, one rendering");

const keys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.quoteReview.f.") || k.startsWith("app.quoteReview.unit_"));
ok(keys.length >= 40, `the findings' templates exist (${keys.length})`);
for (const lang of Object.keys(APP_MESSAGES)) {
  const missing = keys.filter((k) => !(k in APP_MESSAGES[lang]));
  const wrongType = keys.filter((k) => typeof APP_MESSAGES[lang][k] !== typeof APP_MESSAGES.en[k]);
  ok(missing.length === 0 && wrongType.length === 0, `${lang}: every template present, same shape as English`, { missing, wrongType });
}
// The stored English detail is the English catalogue rendered — not a
// second sentence hand-written in code.
{
  const values = resolveParams(lab.i18n.parts[0].params, { translate: (k) => APP_MESSAGES.en[k], money: (a) => String(a) });
  const fromCatalogue = fillTemplate(APP_MESSAGES.en[lab.i18n.parts[0].key], values);
  ok(lab.detail.startsWith(fromCatalogue), "the stored detail is the catalogue's own English rendering", { fromCatalogue, detail: lab.detail });
  ok(renderEnglish({ key: "app.quoteReview.f.margin.againstDefault", params: { pct: 20 } }) === "against the 20% default", "renderEnglish fills a template");
  // And the same i18n record renders in French through the same resolver —
  // what the panel does with t().
  const fr = (key, params) => fillTemplate(APP_MESSAGES.fr[key], resolveParams(params, { translate: (k) => APP_MESSAGES.fr[k], money: (a, d) => Number(a).toLocaleString("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: d, maximumFractionDigits: d }) }));
  const frLow = low.i18n;
  const rendered = fr(frLow.key, frLow.params);
  ok(/par pi² de Siding — 3\d % en dessous de votre habitude/.test(rendered) && /Vérifiez les heures\./.test(rendered), "the low-rate finding renders in French from the same record", rendered);
  ok(/^1,90\s\$/u.test(rendered), "money formats in the reader's locale (1,90 $)", rendered);
}
{
  const pkg = JSON.parse(read("package.json"));
  ok(/check:quote-price-check/.test(pkg.scripts["check:all"]), "this check is in check:all");
}

console.log(`\n${fail ? `FAILED — ${fail} assertion(s)` : "PASSED"}\n`);
process.exit(fail ? 1 : 0);
