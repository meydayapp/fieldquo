#!/usr/bin/env node
// scripts/check-instant-paving.mjs
//
//   npm run check:instant-paving
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-instant-paving.mjs
//
// The owner: "the ability to measure should also be enabled for instant
// quotes." Paving is the second instant trade a homeowner MEASURES by tracing
// on the satellite map (lawn mowing was the first), under the generic measure
// key `area_polygon`, and both traces now reach the draft and the document.
//
// Executed, not read: a four-vertex polygon around a known 100 m² rectangle
// goes through the real measureForTrade and priceAllMaterials over the db
// stub; the seed is derived from the real paving book and compared to it;
// the draft is written by the real createEstimateDraft and its scope group
// read back; the outline is projected by the same function the PDF and the
// public quote page draw with. Static checks are the last section and pin
// only what cannot be executed offline (the two public routes' response
// shapes).

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  INSTANT_ESTIMATE_TRADES,
  INSTANT_ESTIMATE_DEFAULTS,
  computeInstantEstimate,
} from "@/lib/estimate/instantEstimate";
import {
  TRADE_LABELS,
  measureForTrade,
  priceAllMaterials,
  priceOneMaterial,
  loadCompanyInstantTrades,
} from "@/lib/estimate/instantQuoteServer";
import { instantQuoteReadiness, priceOptionsFor } from "@/lib/estimate/instantQuoteReadiness";
import { instantRateFields } from "@/lib/estimate/instantRateFields";
import {
  defaultDerivedSeed,
  deriveInstantSeed,
  seedInputsFor,
  seedDrift,
  applyDerivedSeed,
  DERIVED_SEED_TRADES,
} from "@/lib/estimate/instantSeed";
import { measureTracedArea, normalisePolygon, isPolygonMeasure, POLYGON_MEASURES } from "@/lib/estimate/tracedArea";
import { costingInputsForInstantTrade } from "@/lib/estimate/instantQuoteCosting";
import { createEstimateDraft } from "@/lib/estimate/createEstimateQuote";
import { traceOutline, TRACE_OUTLINE_W, TRACE_OUTLINE_H } from "@/lib/documentSections/traceOutline";
import { measureEvidence, measureCaption } from "@/lib/measure/measureImages";
import { tradeLabourHours, buildTradeLineItems } from "@/lib/pricing/tradeScope";
import { quoteCostSummary } from "@/lib/costing/quoteCosting";
import { measureShapeFor, ESTIMATE_BLOCKED } from "@/lib/estimate/callEstimate";
import { primaryCategoryForInstantTrade, TRADE_CATALOG } from "@/lib/trades/catalog";
import { TRADE_PRICE_BOOKS, getPriceBook } from "@/app/data/tradePriceBooks";
import { rows, writes, resetDbStub } from "@/lib/db";

const ROOT = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got === undefined ? "" : `  got: ${JSON.stringify(got)}`}`);
  }
};
const section = (t) => console.log(`\n${t}`);
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1);

// ── A known rectangle ───────────────────────────────────────────────────────
//
// 10 m × 10 m at 45.4487°N, -75.6375°E (Ottawa). One degree of latitude is
// 111,320 m; one degree of longitude at this latitude is that × cos(lat).
// 100 m² is 1,076.39 sq ft; the spherical formula and the flat one agree to
// well under 1% on a shape this small.
const LAT = 45.4487;
const LNG = -75.6375;
const dLat = 10 / 111320;
const dLng = 10 / (111320 * Math.cos((LAT * Math.PI) / 180));
const SQUARE_100M2 = [
  { lat: LAT, lng: LNG },
  { lat: LAT + dLat, lng: LNG },
  { lat: LAT + dLat, lng: LNG + dLng },
  { lat: LAT, lng: LNG + dLng },
];
const EXPECT_SQFT = 100 * 10.7639104;
// A 1 m × 1 m trace: 10.76 sq ft, well under any floor a company would set.
const TINY = SQUARE_100M2.map((p) => ({ lat: LAT + (p.lat - LAT) / 10, lng: LNG + (p.lng - LNG) / 10 }));

/* ═══════════════════ 1. The trade is wired, generically ═══════════════════ */

section("Paving is an instant trade measured by tracing");
{
  ok("INSTANT_ESTIMATE_TRADES.paving.measure === \"area_polygon\"", INSTANT_ESTIMATE_TRADES.paving?.measure === "area_polygon", INSTANT_ESTIMATE_TRADES.paving);
  ok("…with materials (the surfaces the book prices)", INSTANT_ESTIMATE_TRADES.paving?.hasMaterials === true);
  ok("TRADE_LABELS.paving exists", TRADE_LABELS.paving === "Paving", TRADE_LABELS.paving);
  ok("lawn_mowing still traces under its own key", INSTANT_ESTIMATE_TRADES.lawn_mowing?.measure === "lawn_polygon");
  ok("both keys are polygon measures", isPolygonMeasure("lawn_polygon") && isPolygonMeasure("area_polygon") && POLYGON_MEASURES.size === 2);
  ok("…and nothing else is", !isPolygonMeasure("manual_area") && !isPolygonMeasure("lawn_address") && !isPolygonMeasure(undefined));
  ok("the catalogue bridges paving to the estimator", TRADE_CATALOG.paving?.instantTrade === "paving" && TRADE_CATALOG.paving?.primary === true);
  ok("…so a paving draft files under the paving category", primaryCategoryForInstantTrade("paving") === "paving");
  const shape = measureShapeFor("paving");
  ok("a phone call cannot price it — it needs the map, and says so", shape?.blocked === ESTIMATE_BLOCKED.NEEDS_MAP, shape);
  ok("no landscaping instant trade: there is no landscaping price book to price per area from",
    !INSTANT_ESTIMATE_TRADES.landscaping && !INSTANT_ESTIMATE_TRADES.landscaping_design && !TRADE_PRICE_BOOKS.landscaping_design,
    Object.keys(TRADE_PRICE_BOOKS).filter((k) => /landscap/.test(k)));
}

/* ═══════════════════ 2. The seed, derived from the paving book ════════════ */

section("The seed is the paving book's three surfaces at the standard tier");
{
  const book = TRADE_PRICE_BOOKS.paving;
  const seed = INSTANT_ESTIMATE_DEFAULTS.paving;
  ok("paving is a derivable trade", DERIVED_SEED_TRADES.includes("paving"));
  const derived = defaultDerivedSeed("paving");
  ok("the derivation over the code book produces materials", Array.isArray(derived?.materials) && derived.materials.length === 3, derived);
  const rate = (key) => derived.materials.find((m) => m.key === key)?.ratePerSqft;
  ok("patio = book.complexity.standard.patioPricePerSqft", rate("patio") === book.complexity.standard.patioPricePerSqft, { got: rate("patio"), book: book.complexity.standard.patioPricePerSqft });
  ok("walkway = book.complexity.standard.walkwayPricePerSqft", rate("walkway") === book.complexity.standard.walkwayPricePerSqft, rate("walkway"));
  ok("driveway = standard driveway rate + the driveway paver upcharge, as buildPaving prices it",
    rate("driveway") === book.complexity.standard.drivewayPricePerSqft + book.extras.drivewayPaverUpchargePerSqft, rate("driveway"));
  ok("assumesMinSqft is carried from the book", derived.assumesMinSqft === book.assumesMinSqft, derived.assumesMinSqft);
  ok("minCharge is NOT derived (the book states no source publishes one)", !("minCharge" in derived));
  ok("INSTANT_ESTIMATE_DEFAULTS.paving carries the derivation", JSON.stringify(seed.materials) === JSON.stringify(derived.materials) && seed.assumesMinSqft === derived.assumesMinSqft);
  ok("…plus the instant-only knobs", typeof seed.rangeBandPct === "number" && seed.minCharge === 0, { band: seed.rangeBandPct, min: seed.minCharge });
  ok("no paver-grade rows: the book prices grade as a cost allowance the public form does not ask", !seed.materials.some((m) => /budget|premium|natural/i.test(m.key)));

  // The company's own book moves the seed; a saved row that drifts is
  // reported with one button, never rewritten.
  const theirs = [{ key: "paving", rates: { complexity: { standard: { patioPricePerSqft: 25 } } } }];
  const inputs = seedInputsFor("paving", theirs);
  const own = deriveInstantSeed("paving", inputs);
  ok("the company's patio rate under Services & Pricing is what the seed shows", own.materials.find((m) => m.key === "patio").ratePerSqft === 25, own.materials);
  ok("…and the walkway falls through to the book where they said nothing", own.materials.find((m) => m.key === "walkway").ratePerSqft === book.complexity.standard.walkwayPricePerSqft);
  ok("the service OFF contributes no book", deriveInstantSeed("paving", seedInputsFor("paving", [])) === null);
  const saved = { ...seed, materials: seed.materials.map((m) => (m.key === "patio" ? { ...m, ratePerSqft: 19 } : m)) };
  const drift = seedDrift("paving", saved, own);
  ok("drift names the patio rate and nothing else", drift.length === 1 && drift[0].path === "materials.patio.ratePerSqft" && drift[0].saved === 19 && drift[0].derived === 25, drift);
  const applied = applyDerivedSeed("paving", saved, own);
  ok("one press applies it and keeps the company's other rows", applied.materials.find((m) => m.key === "patio").ratePerSqft === 25 && applied.minCharge === 0 && applied.rangeBandPct === seed.rangeBandPct, applied);
  ok("a zeroed rate is 'not sold', not free", !deriveInstantSeed("paving", seedInputsFor("paving", [{ key: "paving", rates: { complexity: { standard: { patioPricePerSqft: 0, walkwayPricePerSqft: 0, drivewayPricePerSqft: 0 } } } }])));
  ok("the settings screen grows no unit-rate boxes for paving (materials editor + shared knobs only)", instantRateFields("paving", seed).length === 0, instantRateFields("paving", seed));
  ok("getPriceBook still returns the paving book the derivation reads", getPriceBook("paving", null)?.complexity?.standard?.patioPricePerSqft === book.complexity.standard.patioPricePerSqft);
}

/* ═══════════════════ 3. Measured and priced, through the stub ═════════════ */

section("A traced 100 m² prices through measureForTrade and priceAllMaterials");
{
  const company = {
    id: "c1", slug: "acme-paving", name: "Acme Paving", logoUrl: null, brandColor: "#123456",
    defaultLanguage: "en", currency: "CAD", bookingModes: [], bookingSlug: null, eventTypes: [], financing: null, phone: null,
  };
  resetDbStub();
  rows.company = [company];
  rows.instantQuoteConfig = [{ companyId: "c1", trade: "paving", enabled: true, config: { ...INSTANT_ESTIMATE_DEFAULTS.paving, estimateVisibility: "range" } }];
  rows.serviceCategory = [{ id: "cat_paving", key: "paving" }];

  const measured = await measureForTrade("paving", { polygon: SQUARE_100M2 });
  ok("the polygon measures", measured.ok === true, measured);
  const m = measured.measurement;
  ok(`…to ~${Math.round(EXPECT_SQFT)} sq ft from the vertices, not from anything the browser said`, near(m.areaSqft, EXPECT_SQFT, 0.005), m.areaSqft);
  ok("…carrying the normalised vertices", Array.isArray(m.vertices) && m.vertices.length === 4 && m.vertices.every((p) => typeof p.lat === "number" && typeof p.lng === "number"), m.vertices);
  ok("…as a traced, not estimated, measurement", m.source === "traced" && m.basis === "traced" && m.estimated === false);
  ok("…with no polygon key to drop on the floor (vertices is the name everything downstream reads)", !("polygon" in m), Object.keys(m));

  // The still: only with a key. Set one for the shape assertion, then unset.
  const hadKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "k";
  const withKey = measureTracedArea(SQUARE_100M2, { kind: "area" }).measurement.satelliteImageUrl;
  const lawnKey = measureTracedArea(SQUARE_100M2, { kind: "lawn" }).measurement.satelliteImageUrl;
  if (hadKey === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = hadKey;
  ok("with a Maps key the measurement carries an outline still (satellite, path, closed ring)", /maptype=satellite/.test(withKey) && /path=fillcolor/.test(withKey) && (withKey.match(/%7C\d/g) || []).length >= 4, withKey);
  ok("…amber for a paved surface, green for a lawn — never grass over a driveway", /0xf59e0b/.test(withKey) && /0x22c55e/.test(lawnKey) && withKey !== lawnKey);
  ok("without a key the still is null, never a broken link", measureTracedArea(SQUARE_100M2).measurement.satelliteImageUrl === null || hadKey !== undefined);

  const priced = await priceAllMaterials({ companyId: "c1", trade: "paving", measurement: m });
  ok("priceAllMaterials prices every surface", priced.ok === true && priced.options.length === 3, priced);
  const finite = (o) => Number.isFinite(o.low) && Number.isFinite(o.high) && o.low > 0 && o.high >= o.low;
  ok("…each to a finite low–high range", priced.ok && priced.options.every(finite), priced.options);
  const patio = priced.ok && priced.options.find((o) => o.materialKey === "patio");
  const book = TRADE_PRICE_BOOKS.paving;
  ok("patio point ≈ area × the book's standard patio rate", patio && near(patio.point, Math.round(m.areaSqft * book.complexity.standard.patioPricePerSqft / 10) * 10, 0.01), { got: patio?.point, area: m.areaSqft });
  ok("the driveway costs more than the patio for the same shape", priced.ok && priced.options.find((o) => o.materialKey === "driveway").point > patio.point);
  ok("no option applied a minimum: the seed has none", priced.ok && priced.options.every((o) => o.minimumApplied === false));
  ok("no rate in the options payload", !/ratePerSqft/.test(JSON.stringify(priced.options)));

  const one = await priceOneMaterial({ companyId: "c1", trade: "paving", materialKey: "walkway", measurement: m });
  ok("priceOneMaterial prices the chosen surface", one.ok && near(one.estimate.point, Math.round(m.areaSqft * book.complexity.standard.walkwayPricePerSqft / 10) * 10, 0.01), one.estimate?.point);
  ok("…records the generic trace as its source", one.source === "area_polygon", one.source);
  ok("…and files under the paving category", one.categoryId === "cat_paving", one.categoryId);
  ok("…with the estimator naming the traced area", one.estimate.assumptions.some((a) => /traced on the map/.test(a)), one.estimate.assumptions);

  // The public payload: materials as labels only.
  const pub = await loadCompanyInstantTrades("acme-paving");
  const pav = pub.trades.find((t) => t.trade === "paving");
  ok("the public trade list offers paving with measure area_polygon", pav?.measure === "area_polygon", pav);
  ok("…the three surfaces as labels", pav?.materials.map((x) => x.key).join(",") === "patio,walkway,driveway" && pav.materials.every((x) => x.label && !("ratePerSqft" in x)), pav?.materials);
  ok("…and no rate anywhere in it", !/ratePerSqft|minCharge|rangeBandPct|assumesMinSqft/.test(JSON.stringify(pub.trades)));

  // The minimum, and the book's assumed size.
  const floor = { ...INSTANT_ESTIMATE_DEFAULTS.paving, minCharge: 1500, enabled: true };
  const tiny = await measureForTrade("paving", { polygon: TINY });
  ok("a 1 m² trace still measures", tiny.ok && tiny.measurement.areaSqft > 0 && tiny.measurement.areaSqft < 20, tiny.measurement?.areaSqft);
  const est = computeInstantEstimate({ trade: "paving", measurements: tiny.measurement, materialKey: "patio", config: floor });
  ok("a company floor applies to it, and says so", est.ok && est.minimumApplied === true && est.point === 1500, est);
  ok("…and the estimate says the book's rates assume 500 sq ft", est.assumptions.some((a) => /assume at least 500 sqft/.test(a)), est.assumptions);
  const big = computeInstantEstimate({ trade: "paving", measurements: m, materialKey: "patio", config: floor });
  ok("over the floor and the assumed size, neither sentence appears", big.ok && big.minimumApplied === false && !big.assumptions.some((a) => /assume at least/.test(a)));
  ok("priceOptionsFor carries minimumApplied for the tiny trace", priceOptionsFor({ trade: "paving", config: floor, measurement: tiny.measurement }).options.every((o) => o.minimumApplied === true));

  // Refusals.
  ok("polygon missing → ok:false, no_polygon", (await measureForTrade("paving", {})).ok === false && (await measureForTrade("paving", {})).reason === "no_polygon");
  ok("two vertices → no_polygon", (await measureForTrade("paving", { polygon: SQUARE_100M2.slice(0, 2) })).ok === false);
  ok("a degenerate ring (three identical points) → no_polygon", (await measureForTrade("paving", { polygon: [SQUARE_100M2[0], SQUARE_100M2[0], SQUARE_100M2[0]] })).ok === false);
  ok("junk vertices are dropped, not priced", normalisePolygon([{ lat: "x", lng: 1 }, null, { lat: 91, lng: 0 }, [1, 2]]).length === 0);
  ok("[lat,lng] pairs are accepted like {lat,lng}", (await measureForTrade("paving", { polygon: SQUARE_100M2.map((p) => [p.lat, p.lng]) })).measurement?.areaSqft === m.areaSqft);
  ok("lawn_polygon measures through the same path to the same area", (await measureForTrade("lawn_mowing", { polygon: SQUARE_100M2 })).measurement?.areaSqft === m.areaSqft);
  ok("…and refuses the same way", (await measureForTrade("lawn_mowing", {})).reason === "no_polygon");

  // Readiness agrees with the pricer on the seed.
  const ready = instantQuoteReadiness("paving", INSTANT_ESTIMATE_DEFAULTS.paving);
  ok("the seed is ready as-is", ready.ok === true, ready);
  const unpriced = instantQuoteReadiness("paving", { ...INSTANT_ESTIMATE_DEFAULTS.paving, materials: [{ key: "patio", label: "Patio", ratePerSqft: 0 }] });
  ok("…and a card with no priced surface is refused before a stranger sees it", unpriced.ok === false && /sqft/.test(unpriced.fix), unpriced);
  resetDbStub();
}

/* ═══════════════════ 4. The draft: outline saved, takeoff costed ══════════ */

section("The draft keeps the outline and the editor can cost it");
{
  resetDbStub();
  rows.serviceCategory = [{ id: "cat_paving", key: "paving" }];
  const company = { id: "co", taxRate: 0, autoApplyLocalTax: false, taxRates: [], country: "CA", province: "ON", defaultLanguage: "en", currency: "CAD" };
  const measured = (await measureForTrade("paving", { polygon: SQUARE_100M2 })).measurement;
  const est = computeInstantEstimate({ trade: "paving", measurements: measured, materialKey: "driveway", config: { ...INSTANT_ESTIMATE_DEFAULTS.paving, enabled: true } });

  const draft = await createEstimateDraft({
    createdVia: "instant_quote",
    company,
    trade: "paving",
    categoryId: "cat_paving",
    contact: { name: "Sam Trace", email: "sam@test.example", phone: null },
    measurement: measured,
    materialKey: "driveway",
    estimate: est,
    source: "area_polygon",
    language: "en",
  });
  ok("a draft is created", Boolean(draft?.id));
  const write = [...writes].reverse().find((w) => w.model === "quote" && w.action === "create")?.data;
  ok("estimateSource is the generic trace", write?.estimateSource === "area_polygon", write?.estimateSource);
  ok("the measurement snapshot keeps the vertices and the area", Array.isArray(write?.estimateData?.measurement?.vertices) && write.estimateData.measurement.vertices.length === 4 && write.estimateData.measurement.areaSqft === measured.areaSqft, write?.estimateData?.measurement);
  const group = write?.scopeGroups?.create?.[0];
  ok("the scope group carries a paving takeoff", group?.takeoff && typeof group.takeoff === "object", group);
  const t = group?.takeoff || {};
  ok("…with the traced area in the driveway box the paver engine reads", t.drivewaySqft === measured.areaSqft && !("patioSqft" in t) && !("walkwaySqft" in t), t);
  ok("…measuredAreaSqft written (the caption's read finally has a writer)", t.measuredAreaSqft === measured.areaSqft);
  ok("…the outline under `traced`, never `lawn`", Array.isArray(t.traced?.vertices) && t.traced.vertices.length === 4 && !("lawn" in t), t.traced);
  ok("…at the standard tier the rate was read from", t.complexityLevel === "standard");
  ok("…and the intake's own box", group?.intakeValues?.squareFootage === measured.areaSqft && Object.keys(group.intakeValues).length === 1, group?.intakeValues);

  // The editor costs it with the same engine a hand-built paving quote uses.
  const hours = tradeLabourHours("paving", t, group.intakeValues);
  ok("the paver engine finds labour hours in it", hours > 0, hours);
  const lines = buildTradeLineItems("paving", t, group.intakeValues);
  ok("…and the book builds a driveway line from it", lines.some((l) => /driveway/i.test(l.description) && l.quantity === measured.areaSqft), lines.map((l) => [l.description, l.quantity]));
  const s = quoteCostSummary({ scopeGroups: [{ categoryKey: "paving", label: "Paving", takeoff: t, intakeValues: group.intakeValues }], price: est.point, labourRate: 35, overheadPct: 10 });
  ok("…so the cost panel carries hours and materials", s.labourHours > 0 && s.materialTotal > 0, { h: s.labourHours, m: s.materialTotal });

  // The costing mapping, directly, for the unpicked and the malformed.
  const noSurface = costingInputsForInstantTrade("paving", null, measured, { categoryKey: "paving" });
  ok("no surface picked: the area is recorded, no box is guessed", noSurface.takeoff.measuredAreaSqft === measured.areaSqft && !("patioSqft" in noSurface.takeoff) && !("drivewaySqft" in noSurface.takeoff), noSurface.takeoff);
  ok("zero area → nothing", costingInputsForInstantTrade("paving", "patio", { areaSqft: 0 }).takeoff === null);
  const mow = costingInputsForInstantTrade("lawn_mowing", null, (await measureForTrade("lawn_mowing", { polygon: SQUARE_100M2 })).measurement, { categoryKey: "lawn_mowing" });
  ok("lawn mowing's trace now lands as takeoff.lawn with vertices (it was dropped before)", Array.isArray(mow.takeoff?.lawn?.vertices) && mow.takeoff.lawn.vertices.length === 4 && mow.takeoff.lawn.basis === "traced", mow.takeoff);
  ok("…and the mowing form's own lotSize box", mow.intakeValues?.lotSize === measured.areaSqft, mow.intakeValues);
  resetDbStub();
}

/* ═══════════════════ 5. The document: caption + outline, both renderers ═══ */

section("The document prints the trace: caption and a drawn outline");
{
  const measured = (await measureForTrade("paving", { polygon: SQUARE_100M2 })).measurement;
  const { takeoff } = costingInputsForInstantTrade("paving", "patio", measured, { categoryKey: "paving" });
  ok("the paving caption reads the area", measureCaption(takeoff, "paving", "en") === `Paving area measured: ${measured.areaSqft.toLocaleString("en-CA")} sq ft`, measureCaption(takeoff, "paving", "en"));
  ok("…in French and Spanish too", /Surface de pavage mesurée/.test(measureCaption(takeoff, "paving", "fr")) && /Superficie de pavimento medida/.test(measureCaption(takeoff, "paving", "es")));
  const ev = measureEvidence(takeoff, "paving", "en");
  ok("measureEvidence carries the caption with no captured still", ev && ev.caption && ev.imageUrl === null, ev);

  const outline = traceOutline(takeoff);
  ok("the outline projects to four points in the box", outline && outline.points.length === 4 && outline.width === TRACE_OUTLINE_W && outline.height === TRACE_OUTLINE_H, outline);
  ok("…every point inside the box", outline.points.every(([x, y]) => x >= 0 && x <= TRACE_OUTLINE_W && y >= 0 && y <= TRACE_OUTLINE_H));
  const xs = outline.points.map((p) => p[0]);
  const ys = outline.points.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  ok("a 10 m × 10 m square is drawn square (longitude scaled by cos lat)", near(w, h, 0.02), { w, h });
  ok("…and fills the box's short side", near(h, TRACE_OUTLINE_H - 6, 0.02), h);
  ok("north is up: the first (southern) vertex is at the bottom", outline.points[0][1] > outline.points[1][1], outline.points);
  ok("the points attribute is what an SVG polygon takes", /^(\d+(\.\d)?,\d+(\.\d)?)( \d+(\.\d)?,\d+(\.\d)?){3}$/.test(outline.pointsAttr), outline.pointsAttr);

  const lawn = costingInputsForInstantTrade("lawn_mowing", null, (await measureForTrade("lawn_mowing", { polygon: SQUARE_100M2 })).measurement, { categoryKey: "lawn_mowing" });
  ok("a lawn takeoff projects through the same function", JSON.stringify(traceOutline(lawn.takeoff)?.points) === JSON.stringify(outline.points));
  ok("…and captions as a measured lawn", /^Lawn measured:/.test(measureCaption(lawn.takeoff, "lawn_mowing", "en")), measureCaption(lawn.takeoff, "lawn_mowing", "en"));
  ok("no vertices → no outline, never a dot", traceOutline({ measuredAreaSqft: 500 }) === null && traceOutline(null) === null && traceOutline({ lawn: { vertices: [{ lat: 1, lng: 1 }, { lat: 1, lng: 1 }, { lat: 1, lng: 1 }] } }) === null);
  ok("a collinear trace is not an area", traceOutline({ traced: { vertices: [{ lat: 1, lng: 1 }, { lat: 2, lng: 1 }, { lat: 3, lng: 1 }] } }) === null);
  ok("hostile vertices are skipped", traceOutline({ traced: { vertices: [{ lat: "a" }, ...SQUARE_100M2, null] } })?.points.length === 4);

  const pdf = stripComments(read("lib/documentSections/ScopeGroupsSection.js"));
  const page = stripComments(read("app/q/[token]/QuoteApproval.js"));
  const route = stripComments(read("app/api/public/quotes/[token]/route.js"));
  ok("the PDF section draws the outline from traceOutline", /traceOutline\(g\.takeoff\)/.test(pdf) && /<Polygon[\s\S]*points=\{outline\.pointsAttr\}/.test(pdf));
  ok("…in the measured rule colour, not the raw brand hex", /stroke=\{ruleColor\(theme\)\}/.test(pdf));
  ok("the public quote route serves the same projection", /outline: traceOutline\(g\.takeoff\)/.test(route));
  ok("…and the page draws it", /<polygon[\s\S]*points=\{g\.outline\.pointsAttr\}/.test(page) && /stroke=\{rule\}/.test(page));
}

/* ═══════════════════ 6. The two public routes (static) ════════════════════ */

section("The routes: /measure returns the polygon, /request keeps it");
{
  const measure = stripComments(read("app/api/instant-quote/[companySlug]/measure/route.js"));
  const request = stripComments(read("app/api/instant-quote/[companySlug]/request/route.js"));
  ok("/measure hands `polygon` through to measureForTrade for every trade", /measureForTrade\(trade, \{ address, polygon, intake/.test(measure));
  ok("…and returns the polygon in the measurement view for a traced trade", /isPolygonMeasure\(INSTANT_ESTIMATE_TRADES\[trade\]\?\.measure\)/.test(measure) && /polygon: Array\.isArray\(m\.vertices\) \? m\.vertices : null/.test(measure));
  ok("…beside areaSqft and satelliteImageUrl", /areaSqft: m\.areaSqft \?\? null/.test(measure) && /satelliteImageUrl: m\.satelliteImageUrl \?\? null/.test(measure));
  ok("/request re-measures from the posted polygon", /measureForTrade\(trade, \{ address, polygon, intake/.test(request));
  ok("…and its sanitised snapshot keeps the vertices, the area and the still", /vertices: Array\.isArray\(m\.vertices\) \? m\.vertices : null/.test(request) && /areaSqft: m\.areaSqft \?\? null/.test(request) && /satelliteImageUrl: m\.satelliteImageUrl \?\? null/.test(request));
  ok("the settings screen explains the trace", /area_polygon:/.test(read("app/app/settings/instant-quotes/TradeCard.js")) && /"app\.setInstantQuotes\.measure\.area_polygon"/.test(read("app/i18n/appMessages.js")));
  ok("the review screen labels the source", /area_polygon: \["app\.reviews\.source\.area"/.test(read("app/app/estimate-reviews/page.js")) && /"app\.reviews\.source\.area"/.test(read("app/i18n/appMessages.js")));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
