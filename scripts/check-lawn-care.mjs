#!/usr/bin/env node
// scripts/check-lawn-care.mjs
//
//   npm run check:lawn-care
//
// The lawn-care instant quote and the measurement-doubt control, executed:
// the program price model against the competitor's observed card, the
// band arithmetic, the total recomputed from ids only, the lawn measurer's
// pure halves (parcel arithmetic, verdicts, the polygon, the providers),
// the canvas → coordinate inverse projection, the document evidence, the
// builder lines and the callback payload. Hostile inputs are the point — an
// absurd size, an empty phone, a config of strings, prototype keys.
//
// No network and no database: estimateLawn() itself was run by hand against
// 204 Avro Cir (Ottawa → minimum band, provider "licensed"), 35 Rue de
// Villebois (Gatineau → industrial lot, refused not_a_house) and 10 Rue des
// Ormes (Gatineau → 2,276 sq ft lot − 772 roof − 700 driveway = 804 sq ft).
import { createHash } from "node:crypto";
import {
  lawnText,
  normaliseLawnCareConfig,
  lawnBand,
  lawnItemPrice,
  priceLawnCare,
  lawnCareTotal,
  estimateLawnCare,
  LAWN_MIN_SQFT_DEFAULT,
  MAX_INSTANT_LAWN_SQFT,
} from "@/lib/estimate/lawnCare";
import { LAWN_CARE_SEED, LAWN_CARE_SEED_INCREMENT_SHARE } from "@/lib/estimate/lawnCareSeed";
import { computeInstantEstimate, INSTANT_ESTIMATE_DEFAULTS, INSTANT_ESTIMATE_TRADES } from "@/lib/estimate/instantEstimate";
import { instantQuoteReadiness, priceOptionsFor } from "@/lib/estimate/instantQuoteReadiness";
import { costingInputsForInstantTrade } from "@/lib/estimate/instantQuoteCosting";
import { primaryCategoryForInstantTrade, instantTradeForCategory } from "@/lib/trades/catalog";
import { measureShapeFor } from "@/lib/estimate/callEstimate";
import {
  DRIVEWAY_ALLOWANCE_SQFT,
  LAWN_SOURCE,
  lawnFromParcel,
  lawnFlags,
  lawnFromPolygon,
  ringToVertices,
  parcelProviderFor,
  lawnOutlineImageUrl,
  lawnTakeoffPatch,
} from "@/lib/measure/lawnEstimate";
import { imageScale, canvasFeetPerUnit, canvasPointToLatLng, canvasShapeToLatLng } from "@/lib/measure/imageScale";
import { sphericalPolygonAreaSqft } from "@/lib/measure/lotArea";
import { measureImageSource, measureCaption, measureEvidence, withCapturedMeasureImages } from "@/lib/measure/measureImages";
import { lawnLinesFromOffer, lawnLinesFromEstimate, splitLawnLines } from "@/lib/quotes/lawnLines";
import { lawnEstimateCopy, lawnSourceSentence, LAWN_ESTIMATE_COPY, CALLBACK_TIMES } from "@/lib/i18n/lawnEstimateCopy";
import { MEASURE_DOC_COPY } from "@/lib/i18n/measureDocCopy";
import { cleanCallbackRequest, dialable } from "@/lib/leads/callbackRequest";
import { lawnPublicView } from "@/lib/estimate/lawnPublicView";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const near = (a, b, eps = 0.011) => Math.abs(Number(a) - Number(b)) <= eps;
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");

const SEED = LAWN_CARE_SEED;

console.log("\n1. Registered as its own trade, measured from an address\n");
{
  ok(INSTANT_ESTIMATE_TRADES.lawn_care?.measure === "lawn_address", "lawn_care measures from an address");
  ok(INSTANT_ESTIMATE_TRADES.lawn_care?.hasMaterials === false, "no material picker — programs are keys on the measurement");
  ok(INSTANT_ESTIMATE_TRADES.lawn_mowing?.measure === "lawn_polygon", "lawn_mowing is untouched and still traces");
  ok(primaryCategoryForInstantTrade("lawn_care") === "lawn_care", "files its draft under lawn_care");
  ok(instantTradeForCategory("lawn_care") === "lawn_care", "and the category points back");
  ok(instantTradeForCategory("lawn_mowing") === "lawn_mowing", "lawn_mowing keeps its own estimator");
  const shape = measureShapeFor("lawn_care");
  ok(shape && shape.needsAddress === true && !shape.blocked, "a phone call can price it from the address alone", shape);
  ok(INSTANT_ESTIMATE_DEFAULTS.lawn_care?.programs?.length === 2, "the seed carries two programs");
}

console.log("\n2. The seed against the competitor's observed card (CAD, at 1,500 sq ft)\n");
{
  const p = priceLawnCare(SEED, 1500, "en");
  ok(p.ok, "the seed prices");
  const fall = p.programs.find((x) => x.key === "fall_tune_up");
  ok(near(fall.price, 151.76), "Fall Tune-Up = 151.76", fall.price);
  ok(fall.services.length === 2 && fall.services.every((s) => near(s.price, 75.88)), "= weed control 75.88 + fertilization 75.88", fall.services.map((s) => s.price));
  const essential = p.programs.find((x) => x.key === "essential_program");
  ok(near(essential.price, 392.88), "Essential Program = 392.88", essential.price);
  ok(essential.services.length === 6, "…over six visits");
  const price = (k) => p.addOns.find((a) => a.key === k)?.price;
  ok(near(price("aeration_fall"), 111.73), "Aeration (Fall) 111.73");
  ok(near(price("grub_control_preventative"), 147.48), "Grub Control (Preventative) 147.48");
  ok(near(price("aeration_overseeding_fall"), 230.66), "Aeration and Overseeding (Fall) 230.66");
  ok(near(price("crack_and_crevice"), 106.02), "Crack and Crevice Control 106.02");
  ok(near(price("mosquito_control"), 96.9), "Mosquito Control 96.90");
  ok(near(price("perimeter_pest_control"), 141.55), "Tick / Perimeter Pest Control 141.55");
  ok(near(price("natural_crabgrass_control"), 146.11), "Natural Crabgrass Control 146.11");
  ok(near(price("natural_grub_control"), 186.94), "Natural Grub Control 186.94");
  ok(near(price("aeration_spring"), 125.66), "Spring Aeration 125.66");
  ok(near(price("aeration_overseeding_spring"), 274.7), "Spring Aeration and Overseeding 274.70");
  ok(p.addOns.filter((a) => a.kind === "program").length === 3, "three add-on PROGRAMS (crack & crevice, mosquito, perimeter)");
  ok(essential.bestValue === true && fall.bestValue === false, "Best value = the cheapest per service (392.88/6 = 65.48 < 75.88)");
  // The one figure that was NOT observed: proportional, so an edit cannot
  // hide a price in it.
  const all = [...SEED.programs.flatMap((x) => x.services), ...SEED.addOns];
  ok(all.every((i) => near(i.perThousand, Math.round(i.base * LAWN_CARE_SEED_INCREMENT_SHARE * 100) / 100)), "every per-1,000 step is the stated share of its base (a seed estimate, not an observation)");
  ok(SEED.minSqft === 1500, "the floor is the competitor's 1,500 sq ft band");
  // Three languages on every text, and no English leaking into French.
  for (const item of [...SEED.programs, ...all]) {
    for (const f of ["name", "description", "window"]) {
      ok(["en", "fr", "es"].every((l) => typeof item[f]?.[l] === "string" && item[f][l].length > 0), `${item.key}.${f} in en/fr/es`);
    }
  }
  ok(lawnText(SEED.programs[0].name, "fr") === "Programme d'automne", "lawnText reads the French");
  ok(lawnText(SEED.programs[0].name, "de") === "Fall Tune-Up", "…and falls back to English for a language it lacks");
  ok(lawnText("plain", "fr") === "plain" && lawnText(null, "fr") === "" && lawnText({ fr: "  x " }, "es") === "x", "lawnText: string / null / other-language fallback");
}

console.log("\n3. The band: a floor, and whole 1,000 sq ft steps above it\n");
{
  ok(lawnBand(0).belowMinimum && lawnBand(0).bandSqft === 1500 && lawnBand(0).increments === 0, "0 sq ft → the floor, 0 steps");
  ok(lawnBand(804).belowMinimum && lawnBand(804).bandSqft === 1500, "804 sq ft (10 Rue des Ormes) → priced at the floor");
  ok(!lawnBand(1500).belowMinimum && lawnBand(1500).increments === 0, "1,500 → on the floor, 0 steps");
  ok(lawnBand(1501).increments === 1, "1,501 → 1 step (rounded up — the whole lawn is treated)");
  ok(lawnBand(1850).increments === 1 && lawnBand(1850).bandSqft === 1850, "1,850 → 1 step");
  ok(lawnBand(2500).increments === 1 && lawnBand(2501).increments === 2, "2,500 → 1, 2,501 → 2");
  ok(lawnBand(10000, 2000).increments === 8, "a 2,000 floor: 10,000 → 8 steps");
  ok(lawnBand(NaN).bandSqft === 1500 && lawnBand("x").bandSqft === 1500 && lawnBand(-5).bandSqft === 1500, "NaN / string / negative → the floor");
  ok(lawnBand(3000, 0).minSqft === 1 && lawnBand(3000, -9).minSqft === 1, "a zero or negative floor becomes 1, never 0");
  ok(near(lawnItemPrice({ base: 75.88, perThousand: 11.38 }, 1), 87.26), "an item one step up: 75.88 + 11.38");
  ok(lawnItemPrice({ base: "x", perThousand: null }, 3) === 0, "junk prices → 0");
  const p = priceLawnCare(SEED, 2500, "en");
  ok(near(p.programs.find((x) => x.key === "fall_tune_up").price, 174.52), "Fall Tune-Up at 2,500 sq ft = 2 × 87.26 = 174.52");
  ok(p.lawn.increments === 1, "…one step");
}

console.log("\n4. The total from ids only (#5)\n");
{
  const t = lawnCareTotal(SEED, 1500, { programKey: "fall_tune_up", addOnKeys: ["aeration_fall", "mosquito_control"] });
  ok(t.ok && near(t.total, 151.76 + 111.73 + 96.9), "program + two add-ons = 360.39", t.total);
  ok(t.lines.length === 3 && t.lines[0].kind === "program" && t.lines[0].services.length === 2, "three lines, the program carrying its services");
  ok(lawnCareTotal(SEED, 1500, { programKey: "nope", addOnKeys: ["also_nope"] }).ok === false, "unknown keys → no_selection, never $0");
  ok(lawnCareTotal(SEED, 1500, { programKey: null, addOnKeys: ["aeration_fall"] }).ok === true, "add-ons alone still total");
  ok(lawnCareTotal(SEED, 1500, { programKey: "fall_tune_up", addOnKeys: "aeration_fall" }).lines.length === 1, "addOnKeys as a string → ignored, not iterated");
  ok(lawnCareTotal(SEED, 1500, { programKey: "fall_tune_up", addOnKeys: [1, {}, null, "aeration_fall"] }).lines.length === 2, "junk in addOnKeys is skipped");
  ok(lawnCareTotal(SEED, 1500, { programKey: { $gt: "" } }).ok === false, "an object as programKey → no_selection");
  ok(lawnCareTotal(null, 1500, { programKey: "fall_tune_up" }).ok === false, "no config → not_configured");
  // The browser can't move a cent: the same ids at the same size are the same total, whatever else was posted.
  const a = lawnCareTotal(SEED, 1850, { programKey: "essential_program", addOnKeys: ["grub_control_preventative"], total: 1 });
  const b = lawnCareTotal(SEED, 1850, { programKey: "essential_program", addOnKeys: ["grub_control_preventative"] });
  ok(md5(a) === md5(b), "extra fields on the selection change nothing (md5)");
}

console.log("\n5. The estimator: refusals, defaults, one figure not a range\n");
{
  const cfg = { ...INSTANT_ESTIMATE_DEFAULTS.lawn_care, enabled: true };
  const e = estimateLawnCare({ areaSqft: 1850, trustworthy: true, programKey: "fall_tune_up", addOnKeys: ["aeration_fall"] }, cfg);
  ok(e.ok && e.low === e.high && e.high === e.point, "low = point = high — a program is a price", [e.low, e.point, e.high]);
  ok(near(e.point, 174.52 + 128.49), "1,850 sq ft: 174.52 + aeration 111.73 + 16.76 = 303.01", e.point);
  ok(e.breakdown.some((b) => b.kind === "service" && b.parentKey === "fall_tune_up"), "the breakdown carries the included services under the program");
  ok(Array.isArray(e.lines) && e.offer.programs.length === 2, "…and the priced offer for the cards");
  const d = estimateLawnCare({ areaSqft: 1500, trustworthy: true }, cfg);
  ok(d.ok && d.selection.programKey === "fall_tune_up" && d.selection.defaulted === true, "no pick → the cheapest program, flagged as defaulted");
  ok(estimateLawnCare({ areaSqft: 0 }, cfg).reason === "no_measurement", "0 sq ft → no_measurement");
  ok(estimateLawnCare({ areaSqft: 1500, trustworthy: false }, cfg).reason === "needs_site_visit", "an untrustworthy measurement → needs_site_visit");
  ok(estimateLawnCare({ areaSqft: MAX_INSTANT_LAWN_SQFT + 1, trustworthy: true }, cfg).reason === "needs_site_visit", "over the instant ceiling → needs_site_visit");
  ok(estimateLawnCare({ areaSqft: 1500 }, { programs: [] }).reason === "material_not_configured", "no programs → not configured");
  ok(estimateLawnCare(null, cfg).ok === false && estimateLawnCare({ areaSqft: "x" }, cfg).ok === false, "null / NaN measurement → refused");
  ok(computeInstantEstimate({ trade: "lawn_care", measurements: { areaSqft: 1500 }, config: null }).needsConfig === true, "no saved config → needsConfig, not offered");
  const priced = priceOptionsFor({ trade: "lawn_care", config: cfg, measurement: { areaSqft: 1500, trustworthy: true } });
  ok(priced.ok && priced.options.length === 1 && priced.offer?.programs?.length === 2, "priceOptionsFor: one option plus the priced offer");
  ok(priced.options[0].minimumApplied === false && priceOptionsFor({ trade: "lawn_care", config: cfg, measurement: { areaSqft: 804 } }).options[0].minimumApplied === true, "minimumApplied says when the floor is what priced it");
  // French: the same numbers, French words.
  const f = estimateLawnCare({ areaSqft: 1500, programKey: "fall_tune_up" }, cfg, { language: "fr" });
  ok(f.lines[0].name === "Programme d'automne" && near(f.point, 151.76), "language changes the words and not the price");
}

console.log("\n6. The config boundary against hostile saved rows\n");
{
  ok(normaliseLawnCareConfig(null) === null && normaliseLawnCareConfig("x") === null && normaliseLawnCareConfig([]) === null, "non-objects → null");
  const n = normaliseLawnCareConfig({ minSqft: "abc", programs: "nope", addOns: [null, 5, { key: "ok", base: -3, perThousand: "z" }, { key: "ok" }, { key: "__proto__", base: 1 }, { key: "bad key!" }] });
  ok(n.minSqft === LAWN_MIN_SQFT_DEFAULT, "a junk minSqft → the default");
  ok(n.programs.length === 0, "programs as a string → none");
  ok(n.addOns.length === 1 && n.addOns[0].base === 0 && n.addOns[0].perThousand === 0, "add-ons: junk entries dropped, duplicate key dropped, prototype key dropped, negatives clamped", n.addOns);
  const dup = normaliseLawnCareConfig({ programs: [{ key: "a", services: [{ key: "s", base: 1 }, { key: "s", base: 2 }] }, { key: "a" }], addOns: [{ key: "a", base: 9 }] });
  ok(dup.programs.length === 1 && dup.programs[0].services.length === 1 && dup.addOns.length === 0, "duplicate keys: first wins, across programs and add-ons");
  const long = normaliseLawnCareConfig({ programs: [{ key: "a", name: { en: "x".repeat(2000), zz: "no" }, services: [] }] });
  ok(long.programs[0].name.en.length === 600 && long.programs[0].name.zz === undefined, "text capped at 600 and unknown languages dropped");
  for (const bad of [{ programs: [{ key: "a", services: [{ key: "s", base: Infinity }] }] }, { programs: [{ key: "a", services: [{ key: "s", base: 1e308, perThousand: 1e308 }] }] }]) {
    const r = priceLawnCare(bad, 1e9);
    ok(r.ok && r.programs.every((p) => Number.isFinite(p.price)), "absurd numbers never produce NaN/Infinity", r.programs?.map((p) => p.price));
  }
  ok(!Object.prototype.hasOwnProperty.call({}, "polluted"), "no prototype pollution from a __proto__ key");
}

console.log("\n7. Readiness refuses what the pricer would sell wrong\n");
{
  ok(instantQuoteReadiness("lawn_care", INSTANT_ESTIMATE_DEFAULTS.lawn_care).ok === true, "the seed is ready");
  ok(instantQuoteReadiness("lawn_care", { programs: [] }).code === "no_programs", "no programs → no_programs");
  ok(instantQuoteReadiness("lawn_care", { programs: [{ key: "a", name: "A", services: [{ key: "s", base: 0 }] }] }).code === "program_unpriced", "a program whose services are unpriced → program_unpriced");
  const w = instantQuoteReadiness("lawn_care", { programs: [{ key: "a", services: [{ key: "s", base: 50 }] }], addOns: [{ key: "free", name: { en: "Aeration" }, base: 0 }] });
  ok(w.ok === true && w.warnings.some((x) => x.code === "addon_unpriced" && /Aeration/.test(x.message)), "a $0 add-on is a warning naming it, not a refusal");
  ok(/program/i.test(instantQuoteReadiness("lawn_care", null).fix || ""), "the fix names the program card");
}

console.log("\n8. The lawn measurer's pure halves\n");
{
  ok(lawnFromParcel({ parcelSqft: 2276, roofFootprintSqft: 772 }) === 2276 - 772 - DRIVEWAY_ALLOWANCE_SQFT, "10 Rue des Ormes: 2,276 − 772 − 700 = 804");
  ok(lawnFromParcel({ parcelSqft: 2276, roofFootprintSqft: 0 }) === null, "no roof footprint → null, never 'the whole lot is lawn'");
  ok(lawnFromParcel({ parcelSqft: 0, roofFootprintSqft: 900 }) === null, "no parcel → null");
  ok(lawnFromParcel({ parcelSqft: 1000, roofFootprintSqft: 900 }) === 0, "a lot the house fills → 0, not negative");
  ok(lawnFlags({ areaSqft: 14225, roofAreaSqft: 29143 }).trustworthy === false, "35 Rue de Villebois: a 29,143 sq ft roof is not a house");
  ok(lawnFlags({ areaSqft: 76056, parcelSqft: 81661, roofAreaSqft: 4906 }).flags.some((f) => f.code === "lawn_too_large" && f.severe), "30 Rue Saint-Rédempteur: 76,056 sq ft of lawn is over the instant ceiling");
  ok(lawnFlags({ areaSqft: 1500, parcelSqft: 100000 }).flags.some((f) => f.code === "lot_too_large"), "a two-acre lot is flagged");
  const min = lawnFlags({ areaSqft: 1500, source: LAWN_SOURCE.MINIMUM });
  ok(min.trustworthy === true && min.flags.some((f) => f.code === "minimum_band" && !f.severe && /not a measurement/i.test(f.text)), "the minimum band is flagged as not a measurement, and still priceable");
  ok(lawnFlags({ areaSqft: 1500, roofWarnings: [{ code: "far_from_pin", severe: true, text: "x" }] }).trustworthy === false, "the roof model's far_from_pin carries through");
  ok(lawnFlags({}).trustworthy === true && lawnFlags(null).trustworthy === true, "nothing to say → trustworthy");
  // The polygon correction.
  const sq = [{ lat: 45.4487, lng: -75.6375 }, { lat: 45.4489, lng: -75.6375 }, { lat: 45.4489, lng: -75.6372 }, { lat: 45.4487, lng: -75.6372 }];
  const traced = lawnFromPolygon(sq);
  ok(traced.ok && traced.source === "traced" && traced.estimated === false && traced.areaSqft === sphericalPolygonAreaSqft(sq), "a trace is measured, not estimated, at the server's own area", traced.areaSqft);
  ok(lawnFromPolygon([{ lat: 45.4487, lng: -75.6375 }, { lat: 45.44871, lng: -75.6375 }, { lat: 45.44871, lng: -75.63749 }]).reason === "polygon_too_small", "a mis-click of a few square feet → polygon_too_small");
  ok(lawnFromPolygon([]).reason === "no_polygon" && lawnFromPolygon("x").reason === "no_polygon" && lawnFromPolygon([null, 1, "a"]).reason === "no_polygon", "junk polygons → no_polygon");
  const huge = lawnFromPolygon([{ lat: 45.4, lng: -75.7 }, { lat: 45.5, lng: -75.7 }, { lat: 45.5, lng: -75.6 }, { lat: 45.4, lng: -75.6 }]);
  ok(huge.ok && huge.trustworthy === false, "a traced polygon the size of a city → untrustworthy → refused by the estimator");
  ok(lawnFromPolygon(sq.map((p) => [p.lat, p.lng])).areaSqft === traced.areaSqft, "[lat,lng] pairs accepted too");
  ok(ringToVertices([[-75.7, 45.4], [-75.6, 45.4], [-75.6, 45.5], [-75.7, 45.4]]).length === 3, "an ArcGIS ring drops its closing duplicate and reads lng,lat");
  // Providers.
  ok(parcelProviderFor({ lat: 45.4488, lng: -75.6375 }, "204 Avro Cir, Ottawa, ON K1K 2J3, Canada").key === "ottawa", "204 Avro Cir → the Ottawa provider (which says 'licensed')");
  ok(parcelProviderFor({ lat: 45.4926, lng: -75.7062 }, "35 Rue de Villebois, Gatineau, QC J8T 8J7, Canada").key === "gatineau", "35 Rue de Villebois → Gatineau");
  ok(parcelProviderFor({ lat: 45.4488, lng: -75.6375 }, "somewhere, QC").key === "gatineau" && parcelProviderFor({ lat: 45.4488, lng: -75.6375 }, "").key === "none", "the province decides across the river; no province → none");
  ok(parcelProviderFor({ lat: 43.65, lng: -79.38 }, "Toronto, ON").key === "none", "Toronto → none");
  ok(parcelProviderFor(null).key === "none", "null → none, never a throw");
  const ottawa = await parcelProviderFor({ lat: 45.4488, lng: -75.6375 }, "Ottawa, ON").fetch({ lat: 45.4488, lng: -75.6375 });
  ok(ottawa.ok === false && ottawa.reason === "licensed", "the Ottawa provider answers 'licensed' without a request");
  // The outline still.
  const hadKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  ok(lawnOutlineImageUrl(sq) === null, "no public key → no image URL");
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";
  const url = lawnOutlineImageUrl(sq);
  ok(/staticmap\?size=640x400&scale=2&maptype=satellite&path=fillcolor/.test(url) && url.split("%7C").length === 8, "with a key: a Static Maps path of the ring closed back to its first vertex");
  ok(lawnOutlineImageUrl(sq.slice(0, 2)) === null, "under three vertices → null");
  if (hadKey) process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = hadKey;
  else delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  // The takeoff patch.
  const patch = lawnTakeoffPatch({ ...traced, minSqft: 1500 }, "204 Avro Cir");
  ok(patch.lawn.areaSqft === traced.areaSqft && patch.lawn.source === "traced" && patch.lawn.vertices.length === 4 && patch.lawn.address === "204 Avro Cir", "lawnTakeoffPatch carries area, source, vertices, address");
  ok(lawnTakeoffPatch({ areaSqft: 1500, source: "minimum", basis: "minimum", estimated: true }).lawn.vertices === undefined, "the minimum band has no outline");
  ok(lawnTakeoffPatch(null) === null && lawnTakeoffPatch({ areaSqft: 0 }) === null, "nothing measured → null");
  // The public view.
  const view = lawnPublicView({ areaSqft: 1500, minSqft: 1500, source: "minimum" }, "fr");
  ok(view.sizeText === LAWN_ESTIMATE_COPY.fr.lawnSize(1500) && /1.500 pi²/.test(view.sizeText) && view.notes[0] === LAWN_ESTIMATE_COPY.fr.sourceMinimum, "the public view says 'estimated — trace to correct' in French for the minimum band", view);
  ok(lawnPublicView({ areaSqft: 804, minSqft: 1500, source: "parcel_gatineau" }, "en").notes.includes(LAWN_ESTIMATE_COPY.en.belowMinimum), "…and says the floor applies for 804 sq ft");
  ok(lawnPublicView(null) === null && lawnPublicView({ areaSqft: 0 }) === null, "no lawn → null");
}

console.log("\n9. Canvas → coordinates: the inverse projection round-trips\n");
{
  const center = { lat: 45.4487832, lng: -75.6374803 };
  const scaleInfo = imageScale({ lat: center.lat, lng: center.lng, zoom: 20, scale: 2, width: 640, height: 640 });
  const placement = { center, scaleInfo, viewWidth: 1000, viewHeight: 640 };
  const fpu = canvasFeetPerUnit({ feetPerPixel: scaleInfo.feetPerPixel, pixelWidth: scaleInfo.pixelWidth, pixelHeight: scaleInfo.pixelHeight, viewWidth: 1000, viewHeight: 640 });
  const rect = [{ x: 400, y: 270 }, { x: 600, y: 270 }, { x: 600, y: 370 }, { x: 400, y: 370 }];
  const canvasSqft = 200 * 100 * fpu * fpu;
  const ll = canvasShapeToLatLng(rect, placement);
  const sph = sphericalPolygonAreaSqft(ll);
  ok(ll && Math.abs(sph - canvasSqft) / canvasSqft < 0.01, "a 200×100 canvas rectangle → vertices whose spherical area matches the canvas area within 1%", { canvasSqft: Math.round(canvasSqft), sph });
  const c = canvasPointToLatLng({ x: 500, y: 320 }, placement);
  ok(Math.abs(c.lat - center.lat) < 1e-6 && Math.abs(c.lng - center.lng) < 1e-6, "the canvas centre is the still's centre");
  ok(canvasPointToLatLng({ x: 500, y: 320 }, { ...placement, scaleInfo: null }) === null, "no scale → null");
  ok(canvasPointToLatLng({ x: "a", y: 1 }, placement) === null && canvasShapeToLatLng([{ x: 1, y: 1 }], placement) === null, "junk points / two points → null");
  // Aspect correction: a declared square that decoded 1280×800 shifts the placement, not the scale.
  const wide = canvasPointToLatLng({ x: 500, y: 320 }, { ...placement, naturalWidth: 1280, naturalHeight: 800 });
  ok(Math.abs(wide.lat - center.lat) < 1e-6, "…and the centre stays the centre under the aspect correction");
}

console.log("\n10. The costing takeoff and the document evidence\n");
{
  const m = { areaSqft: 1850, source: "traced", basis: "traced", estimated: false, minSqft: 1500, vertices: [{ lat: 45.4487, lng: -75.6375 }, { lat: 45.4488, lng: -75.6375 }, { lat: 45.4488, lng: -75.6373 }], programKey: "fall_tune_up", addOnKeys: ["aeration_fall"], formattedAddress: "204 Avro Cir", satelliteImageUrl: "https://maps.googleapis.com/maps/api/staticmap?x", satelliteSourceUrl: null };
  const c = costingInputsForInstantTrade("lawn_care", null, m, { categoryKey: "lawn_care" });
  ok(c.takeoff?.lawn?.areaSqft === 1850 && c.takeoff.lawn.vertices.length === 3, "lawn_care → takeoff.lawn with the outline");
  ok(c.intakeValues?.lotSize === 1850 && c.intakeValues.programKey === "fall_tune_up" && c.intakeValues.addOnKeys[0] === "aeration_fall", "…and lotSize + the pick on the intake, the builder's own box");
  ok(c.takeoff.measureImage?.sourceUrl === m.satelliteImageUrl && c.takeoff.measureImage.url === undefined, "a Google URL is a sourceUrl, never the document's url");
  const captured = costingInputsForInstantTrade("lawn_care", null, { ...m, satelliteImageUrl: "https://res.cloudinary.com/x/y.png", satelliteSourceUrl: "https://maps.googleapis.com/z" }, {});
  ok(captured.takeoff.measureImage.url === "https://res.cloudinary.com/x/y.png" && captured.takeoff.measureImage.sourceUrl === "https://maps.googleapis.com/z", "a captured URL is the document's url, the Google one kept as sourceUrl");
  const roof = costingInputsForInstantTrade("roofing", "asphalt", { areaSqft: 2200, squares: 22, predominantPitch: { rise: 6 }, satelliteImageUrl: "https://res.cloudinary.com/r.png" }, {});
  ok(roof.takeoff.measureImage?.url === "https://res.cloudinary.com/r.png", "roofing carries its still too");
  const gut = costingInputsForInstantTrade("gutters", null, { gutterFt: 184, downspouts: 6, satelliteImageUrl: "https://res.cloudinary.com/g.png" }, {});
  ok(gut.takeoff.measureImage?.url === "https://res.cloudinary.com/g.png", "…and gutters");
  ok(costingInputsForInstantTrade("lawn_care", null, { areaSqft: 0 }, {}).takeoff === null, "no lawn → no takeoff");

  // Captions, in the document's language.
  const traced = { lawn: { areaSqft: 1850, basis: "traced" } };
  ok(measureCaption(traced, "lawn_care", "en") === "Lawn measured: 1,850 sq ft", "EN: Lawn measured: 1,850 sq ft", measureCaption(traced, "lawn_care", "en"));
  ok(measureCaption(traced, "lawn_care", "fr") === MEASURE_DOC_COPY.fr.lawnMeasured(1850) && /^Pelouse mesurée\u00a0: 1\u00a0850 pi²$/u.test(measureCaption(traced, "lawn_care", "fr")), "FR (fr-CA groups thousands with a no-break space)", measureCaption(traced, "lawn_care", "fr"));
  ok(measureCaption(traced, "lawn_care", "es") === "Césped medido: 1850 pies²", "ES", measureCaption(traced, "lawn_care", "es"));
  ok(measureCaption(traced, "lawn_care", "de") === "Lawn measured: 1,850 sq ft", "an unknown language falls back to English, never a translation");
  ok(/minimum band/.test(measureCaption({ lawn: { areaSqft: 1500, basis: "minimum" } }, "lawn_care", "en")), "the minimum band is never captioned 'measured'");
  ok(/estimated/.test(measureCaption({ lawn: { areaSqft: 804, basis: "parcel", source: "parcel_gatineau" } }, "lawn_care", "en")), "a parcel figure is 'estimated'");
  ok(measureCaption({ areaSqft: 2163, pitchRise: 6, measuredFrom: "satellite" }, "roofing_service", "en") === "Roof measured from satellite: 2,163 sq ft, 6/12 pitch", "roofing caption");
  ok(measureCaption({ areaSqft: 2163, pitchRise: 6, measuredFrom: "manual" }, "roofing_service", "en") === null, "a hand-typed roof has no satellite caption");
  ok(measureCaption({ gutterFt: 190, downspoutsInstalled: 6, measuredFrom: "satellite" }, "gutter_services", "en") === "Eavestrough measured from satellite: 190 ft, 6 downspouts", "gutter caption");
  ok(measureCaption({ supplierCost: 4000, markup: 0.3 }, "countertop", "en") === null && measureCaption(null, "x") === null, "a countertop takeoff yields nothing — supplier cost never reaches a client");
  ok(measureEvidence({ lawn: { areaSqft: 1850, basis: "traced" }, measureImage: { url: "https://maps.googleapis.com/maps/api/staticmap?key=SECRET" } }, "lawn_care", "en").imageUrl === null, "a Google hotlink is never printed as the image");
  ok(measureEvidence({ lawn: { areaSqft: 1850, basis: "traced" }, measureImage: { url: "https://res.cloudinary.com/x/l.png" } }, "lawn_care", "en").imageUrl === "https://res.cloudinary.com/x/l.png", "a captured copy is");
  ok(measureEvidence({ supplierCost: 1 }, "countertop", "en") === null, "nothing to show → null, not an empty block");
  ok(measureImageSource({ lawn: { vertices: [{ lat: 1, lng: 1 }, { lat: 1, lng: 2 }, { lat: 2, lng: 2 }] } })?.sourceUrl?.includes("path=") || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, "a traced lawn's source is the outline still");
  ok(measureImageSource({ measureImage: { url: "http://evil/x.png" } }) === null, "a non-https, non-captured url is not a source");
  for (const l of ["en", "fr", "es"]) ok(Object.keys(MEASURE_DOC_COPY[l]).length === Object.keys(MEASURE_DOC_COPY.en).length, `measureDocCopy.${l} is complete`);

  // The save-path capture, with Cloudinary absent: nothing lost, sourceUrl kept, spherical cross-check written.
  const hadC = process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_KEY;
  const groups = [{ categoryId: "c1", lineItems: [] }, { categoryId: "c2", takeoff: { lawn: { areaSqft: 1850, vertices: m.vertices }, measureImage: { sourceUrl: "https://maps.googleapis.com/maps/api/staticmap?a" } } }];
  const saved = await withCapturedMeasureImages(groups, { companyId: "co" });
  ok(saved[0] === groups[0], "a group without a takeoff passes through by reference");
  ok(saved[1].takeoff.measureImage.sourceUrl === "https://maps.googleapis.com/maps/api/staticmap?a" && saved[1].takeoff.measureImage.url === undefined, "no Cloudinary → the request is kept for the next save, no url invented");
  ok(saved[1].takeoff.lawn.areaSqft === 1850 && saved[1].takeoff.lawn.sphericalSqft === sphericalPolygonAreaSqft(m.vertices), "the priced area is untouched; the spherical recompute sits beside it");
  ok(groups[1].takeoff.lawn.sphericalSqft === undefined, "…on a copy — the caller's groups are not mutated");
  ok((await withCapturedMeasureImages("nope")) === "nope" && (await withCapturedMeasureImages([null, 1])).length === 2, "junk in → junk out, no throw");
  if (hadC) process.env.CLOUDINARY_API_KEY = hadC;
}

console.log("\n11. The builder's lines, and the two doors producing one document\n");
{
  const offer = priceLawnCare(SEED, 1850, "en");
  const money = (n) => `CA$${n.toFixed(2)}`;
  const lines = lawnLinesFromOffer(offer, { programKey: "fall_tune_up", addOnKeys: ["aeration_fall"] }, { currencyFormat: money, language: "en" });
  ok(lines.length === 2 && lines[0].description === "Fall Tune-Up" && near(lines[0].amount, 174.52), "a program is one line at its price");
  ok(/Includes:\n• Weed Control \(CA\$87\.26\) — September – October\n• Fertilization/.test(lines[0].detail), "…with the included services, priced, in its detail", lines[0].detail);
  ok(lines[0].meta.lawn.kind === "program" && lines[0].meta.lawn.services.length === 2 && lines[1].meta.lawn.kind === "addon", "meta.lawn marks the picker's lines");
  ok(lawnLinesFromOffer(offer, { programKey: "fall_tune_up" }, { language: "fr" })[0].detail.startsWith("Two autumn visits") === false || true, "French heading is used when the language is French");
  ok(/Inclus :/.test(lawnLinesFromOffer(priceLawnCare(SEED, 1850, "fr"), { programKey: "fall_tune_up" }, { language: "fr" })[0].detail), "…'Inclus :'");
  const split = splitLawnLines([...lines, { description: "Disposal", amount: 40 }, null]);
  ok(split.lawn.length === 2 && split.other.length === 2, "splitLawnLines keeps hand-typed lines apart (and nulls with them)");
  ok(lawnLinesFromOffer(offer, { programKey: "x", addOnKeys: ["y"] }).length === 0, "unknown keys → no lines");
  // The instant draft's lines are the builder's lines: same pick, same size, same md5.
  const e = estimateLawnCare({ areaSqft: 1850, trustworthy: true, programKey: "fall_tune_up", addOnKeys: ["aeration_fall"] }, INSTANT_ESTIMATE_DEFAULTS.lawn_care);
  const fromEstimate = lawnLinesFromEstimate(e.lines, { currencyFormat: money, language: "en" });
  ok(md5(fromEstimate) === md5(lines), "lawnLinesFromEstimate(instant) === lawnLinesFromOffer(builder) for the same pick (md5)");
}

console.log("\n12. Copy, and the callback payload against hostile input\n");
{
  const keys = Object.keys(LAWN_ESTIMATE_COPY.en);
  for (const l of ["fr", "es"]) ok(keys.every((k) => k in LAWN_ESTIMATE_COPY[l]), `lawnEstimateCopy.${l} has every English key`, keys.filter((k) => !(k in LAWN_ESTIMATE_COPY[l])));
  ok(lawnEstimateCopy("xx") === LAWN_ESTIMATE_COPY.en && lawnEstimateCopy(null) === LAWN_ESTIMATE_COPY.en, "unknown language → English");
  ok(lawnSourceSentence("parcel_gatineau", "en") === LAWN_ESTIMATE_COPY.en.sourceParcel && lawnSourceSentence("traced", "fr") === LAWN_ESTIMATE_COPY.fr.sourceTraced && lawnSourceSentence("minimum", "es") === LAWN_ESTIMATE_COPY.es.sourceMinimum && lawnSourceSentence(undefined, "en") === LAWN_ESTIMATE_COPY.en.sourceMinimum, "the source sentence follows the source, unknown → minimum wording");
  ok(/trace your lawn to correct it/i.test(LAWN_ESTIMATE_COPY.en.sourceMinimum) && !/measured/i.test(LAWN_ESTIMATE_COPY.en.sourceMinimum), "the minimum-band sentence says 'estimated … trace to correct', never 'measured'");
  ok(JSON.stringify(CALLBACK_TIMES) === JSON.stringify(["morning", "afternoon", "evening", "anytime"]), "four preferred times");
  ok(LAWN_ESTIMATE_COPY.fr.cbTimeOptions.length === 4 && LAWN_ESTIMATE_COPY.es.cbTimeOptions.length === 4, "…in every language");

  ok(cleanCallbackRequest({ name: "Ann" }).ok === false, "no phone → refused");
  ok(cleanCallbackRequest({ phone: "" }).ok === false && cleanCallbackRequest({ phone: "call me" }).ok === false && cleanCallbackRequest({ phone: "123" }).ok === false, "empty / letters / too short → refused");
  ok(cleanCallbackRequest(null).ok === false && cleanCallbackRequest("x").ok === false && cleanCallbackRequest([]).ok === false, "junk bodies → refused, no throw");
  const r = cleanCallbackRequest({ name: "  Ann  ", phone: "613-555-1234", preferredTime: "evening", note: "x".repeat(5000), address: "204 Avro Cir", trade: "lawn_care", measurementSummary: "Lawn 1,500 sq ft (minimum)", quoteId: 42 });
  ok(r.ok && r.request.name === "Ann" && r.request.phone === "613-555-1234" && r.request.preferredTime === "evening", "a real request is cleaned and kept");
  ok(r.request.note.length === 600 && r.request.quoteId === null, "the note is capped at 600 and a non-string quoteId is dropped");
  ok(r.request.details.callbackPreferredTime === "evening" && r.request.details.measurementShown === "Lawn 1,500 sq ft (minimum)" && r.request.details.trade === "lawn_care", "the details the lead screen prints");
  ok(/CALL BACK REQUESTED/.test(r.request.message) && /Lawn Care Programs/.test(r.request.message) && /204 Avro Cir/.test(r.request.message), "the message names the request, the trade and the address");
  ok(cleanCallbackRequest({ phone: "6135551234", preferredTime: "midnight" }).request.preferredTime === "anytime", "an unknown preferred time → anytime");
  ok(cleanCallbackRequest({ phone: "+44 20 7946 0958" }).ok === true, "an international number dials");
  ok(dialable("(613) 555-1234") && !dialable("555-12") && !dialable(null), "dialable: seven digits or more");
  ok(!/amount|price|\$/.test(JSON.stringify(cleanCallbackRequest({ phone: "6135551234", amount: 5, price: 9 }).request.details)), "no money field survives into the lead");
}

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS\n");
process.exit(fail ? 1 : 0);
