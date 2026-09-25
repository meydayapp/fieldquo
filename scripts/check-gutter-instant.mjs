#!/usr/bin/env node
// scripts/check-gutter-instant.mjs
//
//   npm run check:gutter-instant
//
// The gutter instant estimate, executed: the pricing model against the
// competitor's four published points, the seeded card through the settings
// screen's field list, the measurement's verdict gating the price, the copy
// in the three languages, and the costing takeoff the draft stores. Hostile
// inputs are the point — 0 ft, 7 ft, 2,000 ft, no imagery, a card with the
// columns swapped.
import { readFileSync } from "node:fs";
import {
  computeInstantEstimate,
  estimateGutters,
  INSTANT_ESTIMATE_DEFAULTS,
  INSTANT_ESTIMATE_TRADES,
} from "@/lib/estimate/instantEstimate";
import { instantQuoteReadiness, priceOptionsFor } from "@/lib/estimate/instantQuoteReadiness";
import { instantRateFields, readRate, rateFieldPatch } from "@/lib/estimate/instantRateFields";
import { costingInputsForInstantTrade } from "@/lib/estimate/instantQuoteCosting";
import { gutterEstimateCopy, GUTTER_ESTIMATE_COPY } from "@/lib/i18n/gutterEstimateCopy";
import { measureErrorMessage } from "@/lib/estimate/measureErrorMessage";
import { primaryCategoryForInstantTrade, instantTradeForCategory } from "@/lib/trades/catalog";
import { measureShapeFor } from "@/lib/estimate/callEstimate";
import { gutterLines } from "@/lib/pricing/tradeScope";
import { TRADE_PRICE_BOOKS } from "@/app/data/tradePriceBooks";
import { completenessChecks } from "@/lib/quotes/completeness";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const within = (a, b, pct) => Math.abs(a - b) <= Math.abs(b) * pct;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const SEED = INSTANT_ESTIMATE_DEFAULTS.gutters;
const m = (gutterFt, downspouts, extra = {}) => ({
  gutterFt,
  downspouts,
  trustworthy: true,
  imagery: { date: "2024-07-29", year: 2024, quality: "HIGH" },
  basis: "eave",
  ...extra,
});

console.log("\n1. Registered, measured from an address, filed under gutter_services\n");
{
  ok(INSTANT_ESTIMATE_TRADES.gutters?.measure === "gutter_address", "gutters measure from an address");
  ok(INSTANT_ESTIMATE_TRADES.gutters?.hasMaterials === false, "no material picker — one profile");
  ok(primaryCategoryForInstantTrade("gutters") === "gutter_services", "files its draft under gutter_services", primaryCategoryForInstantTrade("gutters"));
  ok(instantTradeForCategory("gutter_services") === "gutters", "and the category points back");
  const shape = measureShapeFor("gutters");
  ok(shape && shape.needsAddress === true && !shape.blocked && shape.reads.length === 0, "a phone call needs only the address", shape);
}

console.log("\n2. The seeded card against the competitor's four points\n");
{
  const pts = [
    [184, 6, 4161, 5629],
    [144, 5, 3909, 5289],
    [79, 18, 8173, 13622],
  ];
  for (const [ft, ds, lo, hi] of pts) {
    const e = estimateGutters(m(ft, ds), SEED);
    ok(e.ok && within(e.low, lo, 0.12) && within(e.high, hi, 0.12), `${ft} ft / ${ds} ds: within 12% of ${lo}–${hi}`, e.ok && [e.low, e.high]);
  }
  // Their 7 ft point is the minimum; ours never prices 7 ft at all (below).
  ok(SEED.minCharge.low === 1000 && SEED.minCharge.high === 1250, "minimum seeded at 1,000 – 1,250");
  ok(SEED.perFt.low > 0 && SEED.perFt.high >= SEED.perFt.low, "per-foot low ≤ high");
  ok(SEED.perDownspout.high > SEED.perDownspout.low, "per-downspout high (two storeys) > low");
}

console.log("\n3. Hostile measurements\n");
{
  ok(estimateGutters(m(0, 0), SEED).ok === false && estimateGutters(m(0, 0), SEED).reason === "no_measurement", "0 ft → no_measurement");
  ok(estimateGutters(m(-5, 2), SEED).ok === false, "negative ft → refused");
  ok(estimateGutters(m(NaN, 2), SEED).ok === false, "NaN ft → refused");
  ok(estimateGutters(null, SEED).ok === false, "null measurement → refused");
  // 7 ft: the measurement itself says trustworthy:false (gutterFlags); the
  // estimator refuses even if a caller forgot to check.
  const seven = estimateGutters({ gutterFt: 7, downspouts: 4, trustworthy: false }, SEED);
  ok(seven.ok === false && seven.reason === "needs_site_visit", "7 ft flagged untrustworthy → needs_site_visit, no price", seven);
  const two = estimateGutters({ gutterFt: 2000, downspouts: 58, trustworthy: false }, SEED);
  ok(two.ok === false && two.reason === "needs_site_visit", "2000 ft flagged untrustworthy → needs_site_visit, no price", two);
  // A trusting caller with 7 ft: the minimum applies and says so. (The public
  // path never gets here — measureForTrade refuses first.)
  const trusting = estimateGutters(m(7, 1), SEED);
  ok(trusting.ok && trusting.low === 1000 && trusting.high === 1250 && trusting.minimumApplied === true, "7 ft priced by a trusting caller lands on the minimum and says so", trusting);
  const noImg = estimateGutters(m(184, 6, { imagery: null }), SEED);
  ok(noImg.ok && noImg.assumptions.some((a) => a === "Measured from aerial imagery of your roofline"), "missing imagery: the sentence drops the date rather than printing 'undefined'", noImg.assumptions);
  ok(!noImg.assumptions.some((a) => /undefined|null|NaN/.test(a)), "…and nothing in the copy says undefined");
  const withImg = estimateGutters(m(184, 6), SEED);
  ok(withImg.assumptions.some((a) => a.endsWith("imagery date 2024-07-29")), "imagery date appears in the copy", withImg.assumptions);
  ok(withImg.assumptions.includes(gutterEstimateCopy("en").notAContract), "the not-a-contract sentence is on every estimate");
  const flat = estimateGutters(m(150, 5, { basis: "perimeter" }), SEED);
  ok(flat.assumptions.includes(gutterEstimateCopy("en").flatRoof), "a flat roof says the outline was counted");
  ok(!withImg.assumptions.includes(gutterEstimateCopy("en").flatRoof), "a pitched roof does not");
  ok(withImg.breakdown.length === 2 && withImg.breakdown[0].amount > 0 && withImg.breakdown[1].amount > 0, "breakdown: trough and downspouts", withImg.breakdown);
  const noDs = estimateGutters(m(100, 0), SEED);
  ok(noDs.ok && noDs.breakdown.length === 1, "zero downspouts: no downspout line", noDs.breakdown);
}

console.log("\n4. Hostile rate cards\n");
{
  ok(estimateGutters(m(184, 6), {}).ok === false, "empty card → refused (no per-foot)");
  ok(estimateGutters(m(184, 6), { perFt: { low: 10 } }).ok === false, "a low with no high → refused");
  ok(estimateGutters(m(184, 6), { perFt: { low: "x", high: 11 } }).ok === false, "garbage per-foot → refused");
  const swapped = estimateGutters(m(184, 6), { perFt: { low: 11, high: 10 }, perDownspout: { low: 700, high: 410 }, minCharge: { low: 0, high: 0 } });
  ok(swapped.ok && swapped.high >= swapped.low, "columns typed the wrong way round still give low ≤ high", swapped);
  const noMin = estimateGutters(m(40, 1), { perFt: { low: 10, high: 11 }, perDownspout: { low: 410, high: 700 } });
  ok(noMin.ok && noMin.minimumApplied === false && noMin.low === 810, "no minimum: priced as measured, no floor", noMin);
  const negDs = estimateGutters(m(100, 3), { perFt: { low: 10, high: 11 }, perDownspout: { low: -50, high: -50 } });
  ok(negDs.ok && negDs.low === 1000, "a negative downspout rate is treated as zero (then the floor applies)", negDs);
}

console.log("\n5. Readiness, and what the settings screen shows\n");
{
  const ready = instantQuoteReadiness("gutters", { ...SEED, enabled: true });
  ok(ready.ok === true, "the seeded card is ready", ready);
  const blank = instantQuoteReadiness("gutters", { perFt: { low: 0, high: 0 }, minCharge: SEED.minCharge, enabled: true });
  ok(blank.ok === false && blank.code === "no_per_ft" && /low and a high/.test(blank.fix), "a blank per-foot is refused even though the minimum would price it", blank);
  const fields = instantRateFields("gutters", SEED);
  ok(fields.length === 6, "six rate fields on the settings screen", fields.map((f) => f.path));
  ok(fields.every((f) => readRate(SEED, f.path) !== undefined), "every field reads a seeded value");
  ok(fields.every((f) => !/^\$/.test(f.suffix || "")), "no '$' in a suffix — the input carries the currency prefix");
  const patch = rateFieldPatch(SEED, "perDownspout.high", 750);
  ok(patch.perDownspout.high === 750 && patch.perDownspout.low === SEED.perDownspout.low, "editing one nested rate keeps its sibling", patch);
  ok(!/CAD|USD|\$/.test(JSON.stringify(SEED)), "the seed carries no currency");
}

console.log("\n6. Public shape: never a rate, and the refusal is a sentence\n");
{
  const priced = priceOptionsFor({ trade: "gutters", config: SEED, measurement: m(184, 6), language: "fr" });
  ok(priced.ok && priced.options.length === 1 && priced.options[0].materialKey === null, "one option, no material", priced);
  const opt = priced.options[0];
  ok(!("perFt" in opt) && !("perDownspout" in opt) && !("breakdown" in opt), "the option carries low/high, not the card");
  const est = computeInstantEstimate({ trade: "gutters", measurements: m(184, 6), config: SEED, language: "fr" });
  ok(est.assumptions.includes(gutterEstimateCopy("fr").notAContract), "assumptions come out in French when asked", est.assumptions);
  const es = computeInstantEstimate({ trade: "gutters", measurements: m(184, 6), config: SEED, language: "es" });
  ok(es.assumptions.includes(gutterEstimateCopy("es").notAContract), "…and Spanish");
  ok(gutterEstimateCopy("xx") === gutterEstimateCopy("en") && gutterEstimateCopy(null) === gutterEstimateCopy("en"), "unknown language falls back to English");
  ok(gutterEstimateCopy("fr-CA") === gutterEstimateCopy("fr"), "fr-CA is French");
  for (const lang of ["en", "fr", "es"]) {
    const c = GUTTER_ESTIMATE_COPY[lang];
    ok(
      typeof c.measuredFrom === "function" && typeof c.gutterLine === "function" && c.flatRoof && c.storeysUnknown && c.notAContract && c.needsSiteVisit,
      `${lang}: every sentence present`,
    );
    ok(/2024-07-29/.test(c.measuredFrom("2024-07-29")) && !/undefined/.test(c.measuredFrom(null)), `${lang}: the date interpolates and its absence is silent`);
    ok(/184/.test(c.gutterLine(184, 6)) && /6/.test(c.gutterLine(184, 6)), `${lang}: the run and count interpolate`);
  }
  const server = read("lib/estimate/instantQuoteServer.js");
  ok(/trustworthy === false[\s\S]{0,200}needs_site_visit/.test(server), "measureForTrade refuses an untrustworthy gutter measurement before pricing");
  const route = read("app/api/instant-quote/[companySlug]/measure/route.js");
  ok(/satelliteImageUrl: measured\.partial\.satelliteImageUrl/.test(route) && !/partial: measured\.partial \|\| null/.test(route), "the public /measure strips a refused measurement's flags to the image and the address");
  // The refusal sentence moved into lib/estimate/measureErrorMessage.js
  // (e9376b9b) so /measure and /request cannot explain the same failure two
  // ways. Executed, not grepped: needs_site_visit on the gutter trade is the
  // gutter table's own sentence in every language, and both routes answer a
  // failed measurement through that one function with the form's language
  // and the trade.
  ok(
    Object.keys(GUTTER_ESTIMATE_COPY).every(
      (lang) => measureErrorMessage("needs_site_visit", lang, "gutters") === GUTTER_ESTIMATE_COPY[lang].needsSiteVisit,
    ),
    "needs_site_visit on gutters is the gutter table's sentence, in every language",
  );
  const refusesThroughHelper = (src) =>
    /import \{ measureErrorMessage \} from "@\/lib\/estimate\/measureErrorMessage"/.test(src) &&
    /error: measureErrorMessage\(measured\.reason, language, trade\)/.test(src);
  ok(refusesThroughHelper(route) && /notes:\s*\[\s*gutterEstimateCopy\(language\)/.test(route), "the public /measure carries the language-aware sentences");
  const req = read("app/api/instant-quote/[companySlug]/request/route.js");
  ok(refusesThroughHelper(req), "the public /request refuses with the same sentence");
  // The draft is built from a SANITISED measurement — an allowlist. A gutter
  // field missing from it would build a draft with no takeoff and no flags,
  // silently, which is how the first version of this shipped for an hour.
  const san = req.slice(req.indexOf("function sanitiseMeasurement"));
  for (const k of ["gutterFt", "downspouts", "basis", "imagery", "flags"]) {
    ok(new RegExp(`\\b${k}: `).test(san), `sanitiseMeasurement keeps ${k} for the draft`);
  }
  const flow = read("app/instant-quote/[companySlug]/InstantQuoteFlow.js");
  ok(/byAddress\(/.test(flow) && /gutter_address/.test(flow) && /preview\?\.refused/.test(flow), "the form asks for an address and shows the refusal");
}

console.log("\n7. The draft's takeoff, priced by the builder's own gutter lines\n");
{
  const measurement = m(184, 6, { formattedAddress: "204 Avro Cir, Ottawa, ON K1K 2J3, Canada", flags: [] });
  const { takeoff, intakeValues } = costingInputsForInstantTrade("gutters", null, measurement, { categoryKey: "gutter_services" });
  ok(takeoff && intakeValues === null, "gutters write a structured takeoff");
  ok(takeoff.workType === "replacement" && takeoff.gutterFt === 184 && takeoff.downspoutsInstalled === 6, "replacement, 184 ft, 6 downspouts installed", takeoff);
  ok(takeoff.measuredFrom === "satellite" && takeoff.measuredImagery.date === "2024-07-29" && Array.isArray(takeoff.measuredFlags), "provenance travels", takeoff);
  const lines = gutterLines({ ...takeoff, storeys: "one" }, TRADE_PRICE_BOOKS.gutter_services);
  ok(lines.some((l) => /supplied and installed/.test(l.description) && l.quantity === 184), "the builder prices the 184 ft run", lines.map((l) => l.description));
  ok(lines.some((l) => /Downspout/.test(l.description) && l.quantity === 6), "…and the 6 downspouts");
  ok(costingInputsForInstantTrade("gutters", null, { gutterFt: 0 }).takeoff === null, "0 ft → no takeoff");
  ok(costingInputsForInstantTrade("gutters", null, { gutterFt: "x" }).takeoff === null, "garbage → no takeoff");

  // The stored flags reach the quote review.
  const flagged = costingInputsForInstantTrade("gutters", null, m(45, 2, { flags: [{ code: "stale_imagery", severe: false, text: "The imagery is from 2018-06-02 (medium quality). That is 8 years old." }] }), {});
  const quote = { validUntil: "2099-01-01", client: { email: "a@b.c" }, processNotes: "x", clientPhotos: [], scopeGroups: [{ categoryKey: "gutter_services", takeoff: flagged.takeoff, lineItems: [] }] };
  const checks = completenessChecks(quote, []);
  const c = checks.find((x) => x.id === "gutter_measure_flagged");
  ok(c && c.severity === "medium" && /2018/.test(c.detail), "the review carries the stored flag", c);
  const seven = { ...quote, scopeGroups: [{ categoryKey: "gutter_services", takeoff: { measuredFrom: "satellite", gutterFt: 7, downspoutsInstalled: 4, measuredFlags: [] }, lineItems: [] }] };
  const c2 = completenessChecks(seven, []).find((x) => x.id === "gutter_measure_flagged");
  ok(c2 && c2.severity === "high" && /7 ft of gutter is not a house/.test(c2.detail), "…and judges the numbers afresh: 7 ft typed in is high", c2);
  const manual = { ...quote, scopeGroups: [{ categoryKey: "gutter_services", takeoff: { measuredFrom: "manual", gutterFt: 7 }, lineItems: [] }] };
  ok(!completenessChecks(manual, []).some((x) => x.id === "gutter_measure_flagged"), "a hand-typed run is not second-guessed");
}

console.log(fail ? `\n${fail} FAILED\n` : "\nall passed\n");
process.exit(fail ? 1 : 0);
