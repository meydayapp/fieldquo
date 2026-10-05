// scripts/check-plan-read-first-pass.mjs
//
//   npm run check:plan-read-first-pass
//
// The complete first pass (the owner, 2026-10-05: "all of that information
// should be done in the first pass … the estimator reviews the findings and
// confirms"), executed against the real modules on the St Paul's set — the
// sheets as pdf.js reads them (scripts/fixtures/stPaulsSheets.mjs), a
// SCRIPTED model that answers like the live one did (never the live API), an
// in-memory database and ledger, the real paint engine:
//
//   1. every sheet is classified by kind from its own titles
//   2. the measurement pass's schema is strict and money-free
//   3. the takeoff in code: printed figures win, the scale is checked
//   4. the live failure reproduced — a synthesis with no quantity sources —
//      and every scoped surface still non-zero, with its source
//   5. height bands and their multipliers (the book's, verified), the 9 ft
//      basis, situation rates not double-counted
//   6. the painting PRESET: one copy for the builder and the read; md5 of the
//      takeoff before and after on fixtures — ≤8 ft and the den unchanged
//   7. prep by substrate and condition, as the line's own prep hours
//   8. access priced from the reference table, the company's own rates, the
//      FX rule; confirm takes the server's figure
//   9. crew-days arithmetic and the 2/3/4 options
//  10. what the first pass costs: tokens and credits before and after
//  11. past jobs: this company's only, by trade, with the gap's reason
//  12. one set → two scoped drafts, no re-read
//  13. "priced on" assumptions re-price with no model call
//  14. Equipment & access: your rates, labelled defaults, the fallback audit,
//      the setup step
//  15. "Access in this price": statuses, one-tap reasons, the one sentence
//  16. "What this price includes / Check before sending", ticks recorded
//  17. materials at quote time; masonry primer follows primer
//  18. wiring: the screen, the routes, the strings, check:all
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

import { ST_PAULS_SHEETS } from "./fixtures/stPaulsSheets.mjs";
import { presetFixtures, SAME, MOVES } from "./fixtures/paintPresetFixtures.mjs";
import { sheetKind, isMeasurableKind } from "@/lib/planRead/sheetKinds";
import { MEASURE_SCHEMA, MEASURE_SYSTEM, measurePrompt } from "@/lib/planRead/measurePrompts";
import { SYNTHESIS_SCHEMA, SYNTHESIS_SYSTEM, projectContext } from "@/lib/planRead/prompts";
import { sanitiseMeasure, buildTakeoff, takeoffForPrompt, printedAreasIn, faceQuantity, cleanBox } from "@/lib/planRead/takeoff";
import { buildDimIndex, computeProject, applyOps, sanitiseSynthesis } from "@/lib/planRead/projectModel";
import { startRead, advanceRead, readEstimate, measureNeeded, hasWorkToRead } from "@/lib/planRead/run";
import { estimateRead, READ_TOKENS } from "@/lib/planRead/billing";
import { priceProject } from "@/lib/planRead/pricing";
import { firstPassOptions, crewSettings, daysFor, priceAccessLine, surfacePrep, usdFx, heightRow, figuresBook } from "@/lib/planRead/firstPass";
import { readSlices, sliceComputed, priceSlices } from "@/lib/planRead/slices";
import { summariseSimilar, compareToPast, categoryRanges } from "@/lib/planRead/similar";
import { readPricing } from "@/lib/planRead/readPricing";
import { planSubstrateKeys } from "@/lib/planRead/catalogue";
import { ASSUMED, ASSUMED_KEYS, cleanAssumed } from "@/lib/planRead/firstPassRules";
import { computeRead } from "@/lib/planRead/computeRead";
import { assertStrictSchema } from "@/lib/ai/jsonSchema";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import { paintTakeoff, PAINT_TAKEOFF_DEFAULTS, sanitisePaintTakeoffOverrides } from "@/lib/pricing/paintTakeoff";
import {
  HEIGHT_BANDS,
  HEIGHT_FACTOR_PRESET,
  bandShares,
  heightFactorFor,
  heightFactorFromShares,
  prepForCondition,
  PREP_ALLOWANCE_PRESET,
  cheapestRental,
  referenceRowFor,
  priceRental,
  ACCESS_REFERENCE,
  SOURCES,
  sanitiseHeightPrepOverrides,
  ownAccessRate,
  prepMaterialPrice,
  prepMaterialsFor,
  PREP_MATERIALS,
  CONDITION_MATERIALS,
  PREP_MATERIAL_PRICE_PRESET,
} from "@/lib/pricing/paintHeightPrep";
import { buildReview, accessStatus, accessSentence, MAX_CHECKS } from "@/lib/planRead/review";
import { ACCESS_REASONS } from "@/lib/planRead/accessReasons";
import { FALLBACKS } from "@/lib/planRead/fallbacks";
import { stepsFor, accessRatesSet } from "@/lib/setupSteps";
import { tradeMaterialsFor } from "@/lib/costing/tradeMaterials";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let passed = 0;
let failed = 0;
const ok = (label, cond, detail) => {
  if (cond) passed++;
  else failed++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${cond || detail === undefined ? "" : `  — ${JSON.stringify(detail).slice(0, 600)}`}`);
};
const section = (t) => console.log(`\n${t}\n`);
const md5 = (v) => createHash("md5").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");
const near = (a, b, tol = 0.01) => Math.abs(Number(a) - Number(b)) <= tol;
const code = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const books = {
  interior_painting: getPriceBook("interior_painting", null).takeoff,
  exterior_painting: getPriceBook("exterior_painting", null).takeoff,
};
const itemKeys = new Set(planSubstrateKeys(books.interior_painting));
const productKeys = new Set(Object.keys(books.interior_painting.products));
const sheetsBase = ST_PAULS_SHEETS.map((s) => ({ ...JSON.parse(JSON.stringify(s)), docId: "dset", read: null, scanDims: [] }));

// ═══════════════════════════════════════════════════════════════════════════
section("1. Every sheet's kind, from its own titles");
// ═══════════════════════════════════════════════════════════════════════════
const kinds = Object.fromEntries(sheetsBase.map((s) => [s.sheetNumber, sheetKind(s)]));
ok("elevations: P-47, P-48, P-49", ["P-47", "P-48", "P-49"].every((n) => kinds[n] === "elevation"), kinds);
ok("plans: P-43 floor plan, P-44 roof plan, P-45 whole church, E-01 existing", ["P-43", "P-44", "P-45", "E-01"].every((n) => kinds[n] === "plan"), kinds);
ok("section: P-51 cross section", kinds["P-51"] === "section");
ok("site: P-52, E-02, E-03 (location, block and site plans)", ["P-52", "E-02", "E-03"].every((n) => kinds[n] === "site"), kinds);
ok("photo: P-46 3D views", kinds["P-46"] === "photo");
ok("P-50 'Nave rooflights addition' says nothing a rule can read: unknown, so measured anyway", kinds["P-50"] === "unknown" && isMeasurableKind("unknown"));
ok("a set stored before the title-block fix (every sheet 'A-3', no titles) is unknown → measured, never skipped", sheetKind({ sheetNumber: "A-3", title: null, titles: [] }) === "unknown");
const measurable = sheetsBase.filter((s) => isMeasurableKind(sheetKind(s))).map((s) => s.sheetNumber);
ok(`9 of 13 sheets get the measurement pass: ${measurable.join(", ")}`, measurable.length === 9, measurable);

// ═══════════════════════════════════════════════════════════════════════════
section("2. The measurement pass: strict, and no field a price fits in");
// ═══════════════════════════════════════════════════════════════════════════
const MONEY = /price|rate|cost|amount|total|dollar|cents|\$|fee|charge|sell/i;
const propNames = (schema, out = []) => {
  if (!schema || typeof schema !== "object") return out;
  if (schema.properties) for (const [k, v] of Object.entries(schema.properties)) {
    out.push(k);
    propNames(v, out);
  }
  if (schema.items) propNames(schema.items, out);
  return out;
};
let strictErr = null;
try {
  assertStrictSchema(MEASURE_SCHEMA, "plan_read_measure");
  assertStrictSchema(SYNTHESIS_SCHEMA, "plan_read_synthesis");
} catch (e) {
  strictErr = e.message;
}
ok("MEASURE_SCHEMA and the extended SYNTHESIS_SCHEMA pass the vendor's strict-mode lint (depth ≤ 5, every key required)", !strictErr, strictErr);
ok("no money-shaped property in either", !propNames(MEASURE_SCHEMA).some((k) => MONEY.test(k)) && !propNames(SYNTHESIS_SCHEMA).some((k) => MONEY.test(k)), [...propNames(MEASURE_SCHEMA), ...propNames(SYNTHESIS_SCHEMA)].filter((k) => MONEY.test(k)));
ok("the system prompts say the model points and code measures, and never a price", /You\s+point; FieldQuo measures/.test(MEASURE_SYSTEM) && /Never state a price/.test(MEASURE_SYSTEM) && /FIRST PASS/.test(SYNTHESIS_SYSTEM) && /Never\s+turn one of these/.test(SYNTHESIS_SYSTEM));
const mp = JSON.parse(measurePrompt(sheetsBase[4], { clientRequest: "Repaint the church inside and out" }));
ok("the prompt carries the paper size from the PDF (A3 = 420 × 297 mm) and the printed scale", mp.sheet.paperMm[0] === 420 && mp.sheet.paperMm[1] === 297 && mp.sheet.scale === "1:100", mp.sheet);
ok("…and the printed height on P-47 by its id", mp.sheet.dims.some((d) => d.id === "p5.d1" && d.text === "6.8 metres"));
ok("cleanBox orders and clamps a box; refuses junk", JSON.stringify(cleanBox([0.7, 0.9, 0.3, -0.2])) === "[0.3,0,0.7,0.9]" && cleanBox([1, 2]) === null && cleanBox(["a", 0, 0, 0]) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("3. The takeoff in code: scaled, printed-first, calibrated");
// ═══════════════════════════════════════════════════════════════════════════
// What the measurement pass returns for the church — boxes as fractions of
// the WHOLE A3 sheet image, printed ids where the sheet prints a figure.
const MEASURES = {
  p5: { sheetType: "elevation", sheetTypeReason: "West elevation", views: [{ id: "v1", title: "West Elevation facing Thorpe Road", viewType: "elevation", side: "exterior", scaleText: null, box: [0.05, 0.05, 0.95, 0.8], groundY: 0.72 }], faces: [
    { id: "f1", viewId: "v1", name: "West wall of the nave", kind: "wall_face", side: "exterior", box: [0.3, 0.495, 0.62, 0.72], shape: "rectangle", lengthDimRef: null, heightDimRef: "p5.d1", lengthText: null, heightText: null, printedAreaText: null, openingsShare: 0.15, openingsBasis: "west door and window", material: "stone", note: null },
    { id: "f2", viewId: "v1", name: "West gable", kind: "gable", side: "exterior", box: [0.3, 0.3, 0.62, 0.495], shape: "triangle", lengthDimRef: null, heightDimRef: null, lengthText: null, heightText: null, printedAreaText: null, openingsShare: null, openingsBasis: null, material: "stone", note: null },
    { id: "f3", viewId: "v1", name: "Tower", kind: "tower", side: "exterior", box: [0.68, 0.1, 0.78, 0.72], shape: "rectangle", lengthDimRef: null, heightDimRef: null, lengthText: null, heightText: null, printedAreaText: null, openingsShare: 0.05, openingsBasis: "belfry louvres", material: "brick", note: null },
  ], heights: [] },
  p6: { sheetType: "elevation", sheetTypeReason: "North elevation", views: [{ id: "v1", title: "North Elevation facing St. Paul's Road", viewType: "elevation", side: "exterior", scaleText: null, box: [0.05, 0.05, 0.95, 0.8], groundY: 0.72 }], faces: [
    { id: "f1", viewId: "v1", name: "North wall of the nave", kind: "wall_face", side: "exterior", box: [0.1, 0.5, 0.85, 0.72], shape: "rectangle", lengthDimRef: null, heightDimRef: "p6.d1", lengthText: null, heightText: null, printedAreaText: null, openingsShare: 0.2, openingsBasis: "nave windows", material: "stone", note: null },
  ], heights: [] },
  p9: { sheetType: "section", sheetTypeReason: "Cross section", views: [{ id: "v1", title: "Cross Section - looking south", viewType: "section", side: "interior", scaleText: null, box: [0.05, 0.05, 0.95, 0.8], groundY: 0.72 }], faces: [], heights: [
    { id: "h1", viewId: "v1", label: "Nave wall plate", kind: "wall_plate", box: [0.4, 0.45, 0.42, 0.72], dimRef: null, text: null },
    { id: "h2", viewId: "v1", label: "Nave ridge", kind: "ridge", box: [0.4, 0.2, 0.42, 0.72], dimRef: null, text: null },
  ] },
  p11: { sheetType: "plan", sheetTypeReason: "Existing plan", views: [{ id: "v1", title: "Plan - as existing", viewType: "plan", side: "interior", scaleText: null, box: [0.05, 0.05, 0.95, 0.9], groundY: null }], faces: [
    { id: "f1", viewId: "v1", name: "Nave", kind: "room", side: "interior", box: [0.25, 0.3, 0.7, 0.55], shape: "rectangle", lengthDimRef: null, heightDimRef: null, lengthText: null, heightText: null, printedAreaText: null, openingsShare: 0.1, openingsBasis: null, material: "plaster", note: null },
    { id: "f2", viewId: "v1", name: "North transept", kind: "room", side: "interior", box: [0.45, 0.12, 0.6, 0.3], shape: "rectangle", lengthDimRef: null, heightDimRef: null, lengthText: null, heightText: null, printedAreaText: null, openingsShare: null, openingsBasis: null, material: "plaster", note: null },
  ], heights: [] },
  p1: { sheetType: "plan", sheetTypeReason: "Extension plan", views: [{ id: "v1", title: "Extension Floor Plan", viewType: "plan", side: "interior", scaleText: null, box: [0.05, 0.05, 0.95, 0.9], groundY: null }], faces: [
    { id: "f1", viewId: "v1", name: "Meeting room", kind: "room", side: "interior", box: [0.6, 0.3, 0.68, 0.38], shape: "rectangle", lengthDimRef: "p1.d6", heightDimRef: "p1.d5", lengthText: null, heightText: null, printedAreaText: null, openingsShare: null, openingsBasis: null, material: "drywall", note: null },
    { id: "f2", viewId: "v1", name: "Extension (whole)", kind: "room", side: "interior", box: [0.5, 0.1, 0.8, 0.3], shape: "rectangle", lengthDimRef: null, heightDimRef: null, lengthText: null, heightText: null, printedAreaText: "135.22 sq.m.", openingsShare: null, openingsBasis: null, material: null, note: null },
  ], heights: [] },
};
const measured = sheetsBase.map((s) => (MEASURES[s.key] ? { ...s, measure: sanitiseMeasure(MEASURES[s.key], s) } : s));
const dims = buildDimIndex(measured);
const take = buildTakeoff(measured, dims);
const f = (id) => take.faces.get(id);
const westWall = f("p5.f1");
ok("P-47's west wall: height PRINTED (6.8 m), length scaled at 1:100 off the A3's 420 mm and calibrated against the 6.8 m", westWall.measured && /printed “6\.8 metres”/.test(westWall.sentence) && /scaled at 1:100: 32% of the A3 sheet's 420 mm width/.test(westWall.sentence) && /calibrated ×1\.01[78]/.test(westWall.sentence), westWall.sentence);
ok("…length 0.32 × 420 mm × 100 × 1.017 = 13.68 m (44.9 ft); height 6.8 m (22.3 ft)", near(westWall.lengthFt, 13.68 * 3.2808, 0.2) && near(westWall.heightFt, 22.31, 0.05), [westWall.lengthFt, westWall.heightFt]);
ok("…net of 15% openings, and marked medium (one figure scaled): " + westWall.netSqft + " sq ft", westWall.confidence === "medium" && near(westWall.netSqft, westWall.grossSqft * 0.85, 1) && westWall.netSqft > 800, westWall);
ok("…with the sentence a person checks: the scaled length", /length on P-47/.test(westWall.check || ""), westWall.check);
const gable = f("p5.f2");
ok("the gable is a triangle (× ½) starting above the wall: bottom ≈ 22.3 ft above the ground line", gable.shape === "triangle" && near(gable.grossSqft, (gable.lengthFt * gable.heightFt) / 2, 2) && near(gable.bottomFt, 22.3, 0.6), gable);
const tower = f("p5.f3");
ok(`the tower: ${tower.heightFt} ft tall scaled — the 30–45 ft masonry the live read priced at ground level`, tower.heightFt > 55 && tower.topFt > 55, tower);
const north = f("p6.f1");
ok("P-48's north wall: 31.5 m scaled length, 6.8 m printed, calibrated on its own sheet", near(north.lengthFt / 3.2808, 31.5 * north.heightFt / 3.2808 / ((0.22 * 297 * 100) / 1000), 1.2), north);
const nave = f("p11.f1");
ok(`E-01's nave: a room — ${nave.floorSqft} sq ft floor, ${nave.perimeterFt} ft perimeter, scaled (no calibration on the view: medium)`, nave.room && nave.floorSqft > 1400 && nave.perimeterFt > 160 && nave.confidence === "medium", nave);
const meeting = f("p1.f1");
ok("P-43's meeting room: both sides PRINTED (6.8 × 3.1, metres assumed on a metric plan) — low, because the unit was assumed", meeting.room && near(meeting.floorSqft, 6.8 * 3.1 * 10.7639, 1) && meeting.confidence === "low", meeting);
const ext = f("p1.f2");
ok("a PRINTED area wins over the scaled box: '135.22 sq.m.' → 1,455 sq ft, high", near(ext.floorSqft, 1455, 1) && /printed “135\.22 sq\.m\.”/.test(ext.sentence) && ext.confidence === "high", ext);
ok("printed areas are read from text in m² and sq ft", printedAreasIn("135.22 sq.m. / 1,454 sq.ft. nett")[0].m2 === 135.22 && near(printedAreasIn("1,454 sq.ft.")[0].m2, 135.08, 0.01));
const plate = take.heights.get("p9.h1");
ok(`P-51's nave wall plate: ${plate.heightFt} ft scaled off the section`, plate.measured && near(plate.heightFt, 0.27 * 297 * 100 / 1000 * 3.2808, 0.1), plate);
const wrongScale = sanitiseMeasure({ ...MEASURES.p6, faces: [{ ...MEASURES.p6.faces[0], box: [0.1, 0.3, 0.85, 0.72] }] }, sheetsBase[5]);
const bad = buildTakeoff([{ ...sheetsBase[5], measure: wrongScale }], buildDimIndex([sheetsBase[5]])).faces.get("p6.f1");
ok("a box that disagrees with the printed figure by >20% calibrates nothing and drops to LOW, saying so", bad.confidence === "low" && /disagrees with the scale/.test(bad.sentence), bad.sentence);
const nts = buildTakeoff([{ ...sheetsBase[5], scale: { text: "NTS", ratio: null, nts: true }, measure: sanitiseMeasure({ ...MEASURES.p6, faces: [{ ...MEASURES.p6.faces[0], heightDimRef: null }] }, sheetsBase[5]) }], new Map()).faces.get("p6.f1");
ok("on a sheet NOT TO SCALE with nothing printed, nothing is measured — and it says so", nts.measured === false && /measure it on the sheet/.test(nts.sentence), nts);
const tp = takeoffForPrompt(take);
ok("the synthesis is shown the measured faces and heights as compact rows, by id", tp.faces.rows.some((r) => r[0] === "p5.f1") && tp.heights.rows.some((r) => r[0] === "p9.h1"));
ok("a read with no measurements sends the synthesis exactly the bytes it always did", !("takeoff" in JSON.parse(projectContext({ catalogue: {}, sheets: [], excelDigest: null, photoRead: null, trade: "painting", clientRequest: null, takeoff: takeoffForPrompt(buildTakeoff([], new Map())) }))));

// ═══════════════════════════════════════════════════════════════════════════
section("4. The live failure, reproduced: a synthesis with no quantity sources");
// ═══════════════════════════════════════════════════════════════════════════
// The owner's read: areas, exclusions, access with heights — and every
// quantity 0 sq ft, inside and out. The same answer, through the real run.
const zeroSynthesis = {
  summary: "Victorian church: nave, transepts, tower; new extension and glazed lobbies.",
  buildingType: "church",
  commercial: true,
  areas: [
    { id: "a1", name: "Exterior elevations", level: null, side: "exterior", include: true },
    { id: "a2", name: "Nave interior", level: null, side: "interior", include: true },
  ],
  surfaces: [
    { id: "s1", areaId: "a1", label: "Exterior masonry walls", itemKey: "siding_trim", coats: 2, productKey: null, lengthRefs: [], widthRefs: [], multiplier: null, count: null, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: null, estimateBasis: null, sheet: "P-47", note: null, faceRefs: [], faceMeasure: null, heightRef: null },
    { id: "s2", areaId: "a2", label: "Nave walls", itemKey: "walls", coats: 2, productKey: null, lengthRefs: [], widthRefs: [], multiplier: null, count: null, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: null, estimateBasis: null, sheet: "E-01", note: null, faceRefs: [], faceMeasure: null, heightRef: null },
  ],
  access: [{ areaId: "a1", equipment: "boom_lift", workingHeightFt: 45, heightRef: null, reason: "Tower and gable masonry 30–45 ft" }],
  complexity: { level: "high", factors: ["height", "heritage"] },
  assumptions: [],
  exclusions: ["Glazed lobbies (new work)"],
  assumed: {
    exteriorSurface: { value: "bare_masonry", basis: "Stone and brick, no paint shown on the elevations" },
    interiorSurface: { value: "painted_plaster", basis: "Plastered nave, previously painted" },
    colours: { value: "2", basis: "Walls and trim" },
    heritage: { value: "listed", basis: "Victorian church in a conservation setting" },
    siteHours: { value: "restricted", basis: "Services on Sundays and weekday mornings" },
    occupied: { value: "yes", basis: "The church stays in use" },
  },
  questions: [],
};
const memDb = (seed) => {
  const t = JSON.parse(JSON.stringify(seed));
  const match = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "OR") return v.some((w) => match(row, w));
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if ("in" in v) return v.in.includes(row[k]);
        if ("lt" in v) return row[k] !== null && new Date(row[k]) < new Date(v.lt);
        return true;
      }
      return row[k] === v;
    });
  const table = (name) => ({
    findFirst: async ({ where, include } = {}) => {
      const r = (t[name] || []).find((x) => match(x, where));
      if (!r) return null;
      return include?.documents ? { ...r, documents: (t.quoteDocument || []).filter((d) => d.planReadId === r.id) } : { ...r };
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const r of t[name] || []) if (match(r, where)) {
        Object.assign(r, JSON.parse(JSON.stringify(data)));
        count++;
      }
      return { count };
    },
  });
  return { t, planRead: table("planRead"), companyServiceCategory: { findMany: async () => [] } };
};
const docs = (id) => [{
  id: "dset", companyId: "co1", planReadId: id, kind: "plan", mimeType: "application/pdf", supersedesId: null, url: "https://res.cloudinary.com/x/raw/upload/set.pdf",
  uploadedAt: new Date(Date.now() - 60_000).toISOString(),
  pages: sheetsBase.map((s) => ({ page: s.docPage, url: `https://res.cloudinary.com/x/image/upload/v1/fieldquo/companies/co1/plans/p${s.docPage}.jpg`, width: 3508, height: 2480 })),
}];
const scopeBoth = { categories: [{ key: "exterior_painting", label: "Exterior painting" }, { key: "interior_painting", label: "Interior painting" }], from: "quote" };
const churchRead = (id, scope = scopeBoth) => ({ id, companyId: "co1", title: "St Paul's", trade: "painting", clientRequest: "Repaint the church inside and out", status: "draft", scope, sheets: sheetsBase, excelRows: null, photoRead: null, progress: null, usage: null, reservedCents: 0, reservationRef: null, chargedCents: 0, leaseUntil: null, model: null });
const ledger = [];
const deps = {
  featureAllowsSpend: async () => true,
  aiBalanceFor: async () => 100_000,
  debitCredit: async (e) => (ledger.push({ ...e, cents: -e.cents }), { id: "e" }),
  refundReservation: async (e) => (ledger.push({ ...e, refund: true }), { id: "r" }),
  recordAiUsage: async () => null,
  similarPastQuotes: async () => ({ family: "church", matches: [], range: null, byCategory: {} }),
  afterReady: null,
};
const calls = [];
const usages = [];
const provider = (synth) => async (args) => {
  calls.push(args);
  // Token counts as the live calls would report them, per kind of call.
  const u =
    args.schemaName === "plan_read_measure"
      ? { model: "gpt-5.5", promptTokens: 6200, completionTokens: 6500, cachedTokens: 0, imageCount: 1 }
      : args.schemaName === "plan_read_sheet"
        ? { model: "gpt-5-mini", promptTokens: 26000, completionTokens: 3000, cachedTokens: 0, imageCount: 5 }
        : { model: "gpt-5.5", promptTokens: 21000, completionTokens: 12000, cachedTokens: 0, imageCount: 0 };
  usages.push([args.schemaName, u]);
  await args.onUsage?.(u);
  if (args.schemaName === "plan_read_sheet") return { ok: true, data: { relevant: true, summary: "x", areas: [], heights: [], finishes: [], access: [], readDims: [] } };
  if (args.schemaName === "plan_read_measure") {
    const key = JSON.parse(args.prompt).sheet.dims[0]?.id.split(".")[0] || null;
    const page = Number(String(args.images[0]).match(/\/p(\d+)\.jpg/)?.[1]);
    const k = key || `p${page}`;
    return { ok: true, data: MEASURES[k] || { sheetType: "other", sheetTypeReason: "x", views: [], faces: [], heights: [] } };
  }
  if (args.schemaName === "plan_read_synthesis") return { ok: true, data: synth };
  return { ok: false, reason: "unexpected" };
};
const mem = memDb({ planRead: [churchRead("pc1")], quoteDocument: docs("pc1") });
const before = readEstimate({ ...mem.t.planRead[0], documents: docs("pc1") });
await startRead({ planReadId: "pc1", companyId: "co1" }, { ...deps, db: mem });
const run = await advanceRead("pc1", { companyId: "co1", budgetMs: 10_000_000 }, { ...deps, db: mem, complete: provider(zeroSynthesis) });
const row = mem.t.planRead[0];
ok("the read finishes", run.state === "ready" && row.status === "ready", run);
const measureCalls = calls.filter((c) => c.schemaName === "plan_read_measure");
ok(`a measurement pass ran on each routed measurable sheet (${measureCalls.length}), on the best tier, the whole sheet once, high detail`, measureCalls.length >= 7 && measureCalls.every((c) => c.tier === "best" && c.images.length === 1 && c.imageDetail === "high" && /c_limit,w_2400/.test(c.images[0])), measureCalls.length);
ok("…beside the sheet passes (each sheet's two passes in flight together) and recorded as their own step", row.usage.byStep.measure.calls === measureCalls.length && row.usage.byStep.sheets.calls >= 7);
ok("the synthesis was SHOWN the takeoff", JSON.parse(calls.find((c) => c.schemaName === "plan_read_synthesis").prompt).takeoff?.faces?.rows?.length >= 5);
const view1 = computeRead({ ...row, documents: docs("pc1") }, { books });
const comp = view1.computed;
const active = comp.surfaces.filter((s) => s.active);
const extQ = active.filter((s) => s.itemKey === "siding_trim").reduce((n, s) => n + s.quantity.value, 0);
const intQ = active.filter((s) => s.itemKey === "walls" || s.itemKey === "ceiling").reduce((n, s) => n + s.quantity.value, 0);
ok(`the live failure no longer leaves 0: outside ${extQ} sq ft, inside ${intQ} sq ft — drafted from the measured faces`, extQ > 3000 && intQ > 3000, { extQ, intQ });
ok("every scoped surface with area is non-zero, OR named as unmeasured — never silently 0", active.every((s) => s.quantity.value > 0 || comp.unmeasured.some((u) => u.id === s.id)) && comp.unmeasured.every((u) => ["s1", "s2"].includes(u.id)), comp.unmeasured);
ok("each drafted surface carries its source sheet(s), the dimensions or scale used, and a confidence", active.filter((s) => s.addedBy === "fieldquo").every((s) => s.quantity.source === "face" && /P-4[78]|E-01|P-43/.test(s.quantity.sourceText) && /scaled at 1:100|printed/.test(s.quantity.sourceText) && ["high", "medium", "low"].includes(s.quantity.confidence)), active.map((s) => [s.label, s.quantity.source, s.quantity.confidence]));
ok("…and the model says it, as an assumption the estimator reads", row.model.assumptions.some((a) => /FieldQuo's own measurements of the elevations/.test(a)) && row.model.assumptions.some((a) => /measurements of the plans/.test(a)));
ok("the interior walls rise to the section's measured wall plate, not an invented height", active.filter((s) => s.addedBy === "fieldquo" && s.itemKey === "walls").every((s) => s.heightRef === "p9.h1" && /Nave wall plate/.test(s.heightBasis)));
ok("the access the read listed stays; high work with no access gets a line, marked as FieldQuo's", row.model.access.some((a) => a.equipment === "boom_lift") && row.model.access.filter((a) => a.auto).every((a) => /Added by FieldQuo/.test(a.reason)));
ok("the assumptions it priced on are stored, not asked", row.model.assumed.exteriorSurface.value === "bare_masonry" && row.model.assumed.occupied.value === "yes" && row.model.questions.length === 0);
// The model cites the takeoff itself: no backfill needed.
const citing = { ...zeroSynthesis, surfaces: [
  { ...zeroSynthesis.surfaces[0], faceRefs: ["p5.f1", "p5.f2", "p5.f3", "p6.f1"], faceMeasure: "net_area" },
  { ...zeroSynthesis.surfaces[1], faceRefs: ["p11.f1", "p11.f2"], faceMeasure: "walls", heightRef: "p9.h1" },
  { ...zeroSynthesis.surfaces[1], id: "s3", label: "Nave ceiling", itemKey: "ceiling", faceRefs: ["p11.f1"], faceMeasure: "ceiling", heightRef: "p9.h2" },
] };
const mem2 = memDb({ planRead: [churchRead("pc2")], quoteDocument: docs("pc2") });
await startRead({ planReadId: "pc2", companyId: "co1" }, { ...deps, db: mem2 });
await advanceRead("pc2", { companyId: "co1", budgetMs: 10_000_000 }, { ...deps, db: mem2, complete: provider(citing) });
const row2 = mem2.t.planRead[0];
const comp2 = computeRead({ ...row2, documents: docs("pc2") }, { books }).computed;
ok("a synthesis that cites the takeoff keeps its own surfaces — no backfill", comp2.surfaces.length === 3 && !comp2.surfaces.some((s) => s.addedBy) && comp2.surfaces.every((s) => s.quantity.value > 0 && s.quantity.source === "face"), comp2.surfaces.map((s) => [s.label, s.quantity.value, s.quantity.source]));
const s1 = comp2.surfaces[0];
ok(`the outside: ${s1.quantity.value} sq ft over four faces, its sentence naming P-47 and P-48`, /P-47/.test(s1.quantity.sourceText) && /P-48/.test(s1.quantity.sourceText) && s1.faceRefs.length === 4);

// ═══════════════════════════════════════════════════════════════════════════
section("5. Height: the book's bands, applied to the share of area in each");
// ═══════════════════════════════════════════════════════════════════════════
ok("the preset bands and factors are the book's p. 139: ≤8 ×1.0, 8–13 ×1.3, 13–17 ×1.6, 17–19 ×1.9, 19–21 ×2.2 — and >21 ×2.2 labelled an extrapolation", JSON.stringify(HEIGHT_BANDS.map((b) => [b.from, b.upTo, HEIGHT_FACTOR_PRESET[b.key]])) === JSON.stringify([[0, 8, 1], [8, 13, 1.3], [13, 17, 1.6], [17, 19, 1.9], [19, 21, 2.2], [21, null, 2.2]]) && HEIGHT_BANDS[5].extrapolated === true);
ok("…their provenance says READ in the 2014 preview, p. 139", SOURCES.htdf.tag === "READ" && /2014 preview, p\. 139/.test(SOURCES.htdf.checked) && /2014_NPC_book_preview/.test(SOURCES.htdf.url));
const sh20 = bandShares(0, 20);
ok("a 20 ft wall: 8 ft at ×1.0, 5 at ×1.3, 4 at ×1.6, 2 at ×1.9, 1 at ×2.2 (the clip, banded)", [8, 5, 4, 2, 1, 0].every((ft, i) => near(sh20[i], ft / 20, 1e-9)), sh20);
const tri = bandShares(0, 16, "triangle");
ok("a gable (triangle) carries more of its area low down", tri[0] > 0.7 && near(tri.reduce((a, b) => a + b, 0), 1, 1e-9), tri);
ok("a ceiling is worked AT its height: 15 ft → all of it in 13–17", bandShares(15, 15)[2] === 1);
const w16 = heightFactorFor("walls", 16, books.interior_painting);
ok("builder: 16 ft walls ×1.167 — (8 + 5×1.3 + 3×1.6)/16 = 1.206, ÷ 1.033 (the rates were measured on a 9 ft room)", near(w16.factor, 1.1673, 0.0005) && near(w16.raw, 1.2063, 0.0005) && near(w16.basis, 1.0333, 0.0005), w16);
ok("…a ceiling at 15 ft ×1.231 — 1.6 ÷ 1.3 (a 9 ft ceiling is already in 8–13)", near(heightFactorFor("ceiling", 15, books.interior_painting).factor, 1.2308, 0.0005));
ok("…8 ft, and the 9 ft den the rates came from, take no factor at all", heightFactorFor("walls", 8, books.interior_painting) === null && heightFactorFor("walls", 9, books.interior_painting) === null && heightFactorFor("ceiling", 9, books.interior_painting) === null);
ok("…a company that says its rates are for 8 ft rooms prices exactly as the book: 16 ft walls ×1.206", near(heightFactorFor("walls", 16, { ...books.interior_painting, heightBasisFt: 8 }).factor, 1.2063, 0.0005));
ok("…never BELOW 1: an 8 ft ceiling, under the 9 ft basis, is not priced cheaper than the rate", heightFactorFromShares(bandShares(8, 8), "ceiling", books.interior_painting).factor === 1 && heightFactorFromShares(bandShares(0, 7), "wall", books.interior_painting).factor === 1);
ok("…a baseboard or a door never takes a height", heightFactorFor("baseboard", 16, books.interior_painting) === null && heightFactorFor("door", 16, books.interior_painting) === null);
const church30 = heightFactorFromShares(bandShares(0, 30), "wall", books.interior_painting);
ok(`the read: a 30 ft masonry face ×${church30.factor} on its hours (the live read priced it ×1.0)`, church30.factor > 1.5 && church30.bands.some((b) => b.key === "b6"), church30);
const towerSurface = comp2.surfaces[0];
const hr = heightRow({ key: "siding_trim", label: "x", quantity: towerSurface.quantity.value, rateKey: "siding_trim", rate: null, prepHours: 0 }, { shares: towerSurface.bands, itemKey: "siding_trim", book: books.exterior_painting, estimateType: "commercial", unit: "sqft" });
ok(`the outside surface: band-weighted ×${hr.height.factor}, written INLINE as the company's own rate ÷ the factor`, hr.height.factor > 1.05 && hr.row.rateKey === null && hr.row.rate.basis === "production" && near(hr.row.rate.productionRate * hr.height.factor, 100, 0.05) && /×[\d.]+ for height/.test(hr.row.rate.label), hr);
ok("…the why names the bands, the shares, the basis and the source", /8–13 ft ×1\.3 on \d+%/.test(hr.height.why) && /measured at 9 ft/.test(hr.height.why) && /High Time Difficulty Factors/.test(hr.height.why), hr.height.why);
const fx = { rate: 1.4246, text: "at 1 USD = 1.4246 CAD (Bank of Canada, 2026-10-02)" };
const fpOpts = firstPassOptions({ model: row2.model, books, ctx: { currency: "CAD", fx, fieldCrew: 3 } });
const priced2 = priceProject(comp2, books, { firstPass: fpOpts });
const outsideLine = priced2.lines.find((l) => l.surfaceId === "s1");
ok("the read's draft line carries the height factor and its basis — no line at ground-level rates any more", outsideLine.height.factor > 1.05 && outsideLine.hours > outsideLine.quantity / 100 * 1.05, outsideLine);
ok("a situation rate already for height ('16 ft walls') and the two-storey substrate are never charged twice (builder)", paintTakeoff({ model: "area_substrate", estimateType: "interior", areas: [{ areaType: "den", label: "x", surface: "interior", measurement: "area", lengthFt: 12, widthFt: 14, heightFt: 16, substrates: [{ key: "walls", rateKey: "walls_16ft", quantity: null, driver: "wallSqft", coats: 2, prepHours: 0 }] }] }, books.interior_painting).areas[0].lines.every((l) => !l.height));

// ═══════════════════════════════════════════════════════════════════════════
section("6. The painting PRESET — one copy; typed quotes priced the same unless above 8 ft");
// ═══════════════════════════════════════════════════════════════════════════
const B = PAINT_TAKEOFF_DEFAULTS;
ok("the book a company starts from carries the height factors, the 9 ft basis, prep allowances, setup, crew plan, access rates", JSON.stringify(B.heightFactors) === JSON.stringify(HEIGHT_FACTOR_PRESET) && B.heightBasisFt === 9 && JSON.stringify(B.prepAllowances) === JSON.stringify(PREP_ALLOWANCE_PRESET) && B.dailySetupMinutes === 50 && B.crewPlan.hoursPerDay === 7.5 && B.deliveryPerTrip === null && B.frameScaffoldPer100Sqft === null);
ok("the base production rates did not move (walls 100, siding 100, ceiling 110, walls_16ft 80, two-storey 70)", B.substrates.walls.productionRate === 100 && B.substrates.siding_trim.productionRate === 100 && B.substrates.ceiling.productionRate === 110 && B.rateSets.interior.rates.walls_16ft.productionRate === 80 && B.substrates.wall_two_storey.productionRate === 70);
// md5 of the engine's output on the fixtures, taken through origin/main's
// engine (e78e7cea) before this change — the proof the owner asked for.
const BEFORE = {
  room_8ft: "2ac93b35e0ec3a791eb37115fdabb745",
  room_7ft: "90458583e900dc3a0e24657424e3cc40",
  den_9ft: "6b7b29f595d3d2a7f5f3c55becbb7d5d",
  living_9ft: "939d6b6bf32575d1d9645a86fed3e961",
  walls_16ft_situation: "abe116dc877cf123ac70c1abda829282",
  two_storey_18ft: "c525c410d48f8233807ec9ed7d406b88",
  exterior_surface_measured: "2e463b3d8ab72ed9375255f0ae5e2db7",
  baseboard_doors_10ft: "81dc7cbe921b53ad73c943114e14a531",
  walls_16ft_default: "99a43d5b78b4cf2223c658e91d804fc9",
  ceiling_15ft: "c089297196449dae1cbc64cf68f149b7",
  row_height_14ft: "b8ffd3ec3b4c79b81e9d5978625b9ba6",
  condition_painted_plaster: "bf58080e953dcad916cbd0c9a69a28fe",
  exterior_24ft: "88a578e049fbb3d6de4527f82572ddcf",
};
const AFTER_MOVES = {
  walls_16ft_default: { md5: "a441bd012dfa6abc9ebee3cd1cf49934", before: 953.8, after: 1072.11 },
  ceiling_15ft: { md5: "7b469e8fac5b26a18486dd11def0844c", before: 159.21, after: 189.17 },
  row_height_14ft: { md5: "08d19e6b22c7222503c50ea6ff884fa5", before: 343.92, after: 372.71 },
  condition_painted_plaster: { md5: "7175ec9d35aafc1a84300a939c56d6ab", before: 476.9, after: 869.25 },
  exterior_24ft: { md5: "f5453ad7e7046f0ea9ea8a64f8941587", before: 3721.87, after: 4903.25 },
};
const fx6 = presetFixtures();
for (const name of SAME) ok(`byte-identical to before: ${name}`, md5(paintTakeoff(fx6[name], B)) === BEFORE[name], md5(paintTakeoff(fx6[name], B)));
for (const name of MOVES) {
  const out = paintTakeoff(fx6[name], B);
  ok(`moves, as asked: ${name} ${AFTER_MOVES[name].before} → ${out.total}`, md5(out) === AFTER_MOVES[name].md5 && md5(out) !== BEFORE[name] && out.total === AFTER_MOVES[name].after, [md5(out), out.total]);
}
const den = paintTakeoff(fx6.den_9ft, B);
ok("the owner's den reproduces to the cent: $844.67 (check:paint-takeoff holds every line)", den.total === 844.67);
ok("a line with a height carries why: its bands, its factor, the source", (() => { const l = paintTakeoff(fx6.walls_16ft_default, B).areas[0].lines[0]; return l.height.factor === 1.1673 && /13–17 ft ×1\.6/.test(l.height.why); })());
const ov = sanitisePaintTakeoffOverrides({ heightFactors: { b2: 1.4, b3: 0.5, zz: 9 }, heightBasisFt: 8, prepAllowances: { wash: 1.2, bogus: 3 }, dailySetupMinutes: 30, accessRates: { scaffold: { day: 150, week: 0 }, rocket: { day: 1 } }, deliveryPerTrip: 95, crewPlan: { hoursPerDay: 7, crewSize: 3.5 } });
ok("Settings → Services overrides are sanitised: a factor below 1 refused, unknown keys dropped, 0 a rate (owned), a fractional crew refused", ov.heightFactors.b2 === 1.4 && !("b3" in ov.heightFactors) && !("zz" in ov.heightFactors) && ov.heightBasisFt === 8 && ov.prepAllowances.wash === 1.2 && !("bogus" in ov.prepAllowances) && ov.accessRates.scaffold.week === 0 && !("rocket" in ov.accessRates) && ov.deliveryPerTrip === 95 && ov.crewPlan.hoursPerDay === 7 && !("crewSize" in ov.crewPlan), ov);
const companyBook = getPriceBook("interior_painting", { takeoff: ov }).takeoff;
ok("…and the company's figures win in the merged book, key by key, the preset filling the rest", companyBook.heightFactors.b2 === 1.4 && companyBook.heightFactors.b3 === 1.6 && companyBook.prepAllowances.seal_coarse === PREP_ALLOWANCE_PRESET.seal_coarse && companyBook.accessRates.scaffold.day === 150);
ok("the builder's painting card and the read call the SAME functions (no second copy)", /heightFactorFor/.test(code("lib/pricing/paintTakeoff.js")) && /heightFactorFromShares/.test(code("lib/planRead/firstPass.js")) && /priceRental/.test(code("lib/planRead/firstPass.js")) && /api\/quotes\/access-rental/.test(code("app/components/quotes/builder/PaintAreas.js")) && /priceRental/.test(code("app/api/quotes/access-rental/route.js")) && !/1\.3,\s*1\.6,\s*1\.9/.test(code("lib/planRead/referenceTables.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("7. Prep by substrate and condition — its own hours, cited");
// ═══════════════════════════════════════════════════════════════════════════
ok("Resene's factors, per 100 sq ft: wash 0.929, smooth seal 0.743, render primer 0.929, masonry primer 1.208", PREP_ALLOWANCE_PRESET.wash === 0.929 && PREP_ALLOWANCE_PRESET.seal_smooth === 0.7432 && PREP_ALLOWANCE_PRESET.seal_coarse === 1.2077, PREP_ALLOWANCE_PRESET);
const pm = prepForCondition("bare_masonry", 1000, B);
ok("bare masonry: wash + masonry primer — 1,000 sq ft → 9.29 + 12.08 = 21.37 h", near(pm.hours, 21.37, 0.01) && pm.lines.length === 2 && /Resene/.test(pm.lines[1].line), pm);
const cond = paintTakeoff(fx6.condition_painted_plaster, B).areas[0].lines[0];
ok("builder: a condition fills the row's prep hours, never the rate; typed prep hours win", cond.prepAuto && near(cond.prepHours, 3.86, 0.01) && cond.rate === 100 && paintTakeoff({ ...fx6.condition_painted_plaster, areas: [{ ...fx6.condition_painted_plaster.areas[0], substrates: [{ ...fx6.condition_painted_plaster.areas[0].substrates[0], prepHours: 1 }] }] }, B).areas[0].lines[0].prepHours === 1);
const ext2 = comp2.surfaces[0];
const prepOut = surfacePrep(ext2, { side: "exterior", assumed: row2.model.assumed, figures: fpOpts.figures });
ok("the read: bare masonry outside → wash + coarse primer on the line's prep; 2 colours → cutting-in on half", prepOut.auto.lines.map((l) => l.key).join() === "wash,seal_coarse,colours" && prepOut.hours > 0 && /Resene/.test(prepOut.auto.lines[1].why), prepOut.auto.lines);
ok("…on the draft line as Prep hours, beside the paint — the same field set_prep_hours uses", near(outsideLine.prepHours, prepOut.hours, 0.02) && outsideLine.prep.auto.lines.length === 3);
ok("a person's or the chat's prep hours replace the allowance, and the why says so", /replaces the/.test(surfacePrep({ ...ext2, prepHours: 5, prepSource: "ai" }, { side: "exterior", assumed: row2.model.assumed, figures: fpOpts.figures }).why));
ok("occupied / heritage: daily setup and clean-up (SURRPTUCU, 25 + 25 min a painter a day) as its own area", priced2.lines.some((l) => l.setup && /SURRPTUCU/.test(l.why)) && priced2.plan.setupHours > 0);

// ═══════════════════════════════════════════════════════════════════════════
section("8. Access priced: the reference table, your rates, the exchange rate");
// ═══════════════════════════════════════════════════════════════════════════
ok("Figure 15 as printed: rolling scaffold 27–30 ft $180 / $362 / $725; scissor 30 ft $119 / $354 / $1,060; 40 ft $205 / $616 / $1,840", (() => {
  const s = ACCESS_REFERENCE.scaffold.rows.at(-1);
  const a = ACCESS_REFERENCE.scissor_lift.rows[0];
  const b = ACCESS_REFERENCE.scissor_lift.rows[1];
  return s.day === 180 && s.week === 362 && s.month === 725 && a.day === 119 && a.week === 354 && a.month === 1060 && b.day === 205 && b.week === 616 && b.month === 1840;
})());
ok("the smallest row that reaches: 28 ft → the 27–30 ft tower; a 34 ft working height → a 30 ft scissor (platform + 6); 45 ft → no tower reaches", referenceRowFor("scaffold", 28).row.size === 30 && referenceRowFor("scissor_lift", 34).row.size === 30 && referenceRowFor("scaffold", 45).row === null);
ok("cheapest periods: 4 days of a 27–30 ft tower is a week ($362), not 4 × $180", cheapestRental(4, { day: 180, week: 362, month: 725 }).cost === 362 && cheapestRental(4, { day: 180, week: 362, month: 725 }).text === "1 week");
ok("…23 working days is a month and 3 days, or two… whichever is cheaper", cheapestRental(23, { day: 180, week: 362, month: 725 }).cost === Math.min(725 + 3 * 180, 725 + 362, 2 * 725, 5 * 362));
const refLine = priceAccessLine({ id: "x1", equipment: "boom_lift", heightFt: 45, price: null }, { days: 12, currency: "CAD", fx, figures: fpOpts.figures });
ok(`a 45 ft boom lift for 12 days, in CAD: ${refLine.price} — estimated from reference, with the row, the periods and the conversion said`, refLine.priceSource === "reference" && refLine.price > 0 && /31'–40' boom lift for a working height of 45 ft/.test(refLine.why) && /converted at 1 USD = 1\.4246 CAD/.test(refLine.why) && /not adjusted for inflation/.test(refLine.why), refLine);
ok("…its price is the cheapest periods at the converted rates (45 ft working = a 39 ft platform: the 31'–40' row)", refLine.price === cheapestRental(12, { day: Math.round(394 * 1.4246 * 100) / 100, week: Math.round(1180 * 1.4246 * 100) / 100, month: Math.round(3540 * 1.4246 * 100) / 100 }).cost);
const ownBook = { ...B, accessRates: { boom_lift: { day: 300, week: 900 } } };
const ownLine = priceAccessLine({ id: "x1", equipment: "boom_lift", heightFt: 45, price: null }, { days: 12, currency: "CAD", fx, figures: { ...fpOpts.figures, book: ownBook } });
ok("the company's own rental rate always wins over the reference", ownLine.priceSource === "company" && ownLine.price === cheapestRental(12, { day: 300, week: 900 }).cost && /your own rental rates/.test(ownLine.why));
ok("GBP with no dated rate: not priced from reference, and the line says why — never $0", priceAccessLine({ id: "x", equipment: "scaffold", heightFt: 20, price: null }, { days: 5, currency: "GBP", fx: null, figures: fpOpts.figures }).price === null && usdFx("GBP", undefined, new Date("2026-10-05")) === null);
ok("CAD converts at fx.js's dated, sourced Bank of Canada rate", usdFx("CAD", undefined, new Date("2026-10-05")).rate === 1.4246);
ok("a typed 0 is still a price: owned equipment, no charge", priceAccessLine({ id: "x", equipment: "scaffold", heightFt: 20, price: 0 }, { days: 5 }).price === 0);
ok("a crane: no cited figure — unpriced with the reason", priceRental({ kind: "crane", days: 3, currency: "USD" }).unpricedReason === "no_reference");
const accessDraft = priced2.access.find((a) => a.equipment === "boom_lift");
ok(`on the read: the boom lift priced for the days its area takes (${accessDraft.days} working days), not $0`, accessDraft.price > 0 && accessDraft.priceSource === "reference" && accessDraft.days >= 1, accessDraft);
const confirmed = applyOps(row2.model, [{ op: "confirm_access", accessId: accessDraft.id, price: accessDraft.price, why: accessDraft.why }], { dimIds: new Set(), itemKeys, productKeys, photoIds: new Set(), excel: null }, { actor: "person" }).model.access.find((a) => a.id === accessDraft.id);
ok("Confirm makes the server's figure the estimator's own (the route computes it; the browser sends the line only)", confirmed.price === accessDraft.price && confirmed.priceSource === "person" && confirmed.confirmed === true && /const now = await priceReadNow/.test(code("app/api/plan-reads/[id]/route.js")));
ok("…and the model can never confirm one", applyOps(row2.model, [{ op: "confirm_access", accessId: accessDraft.id, price: 1 }], { dimIds: new Set(), itemKeys, productKeys, photoIds: new Set(), excel: null }, { actor: "model" }).dropped.length === 1);
ok("delivery and pickup: no cited figure, so not invented — said, until the company sets its own", priced2.plan.deliveryNote && /no cited figure/.test(priced2.plan.deliveryNote));

// ═══════════════════════════════════════════════════════════════════════════
section("9. Crew plan: days = hours ÷ (crew × productive hours)");
// ═══════════════════════════════════════════════════════════════════════════
const d = daysFor(150, 3, 7.5);
ok("150 h, 3 painters, 7.5 h a day → 6.67 days (7 on site)", d.days === 6.67 && d.wholeDays === 7);
const dSetup = daysFor(150, 3, 7.5, 50 / 60);
ok("…with 50 min a day setup and clean-up: 7.5 days, and 18.75 h of it setup", dSetup.days === 7.5 && dSetup.setupHours === 18.75, dSetup);
ok("crew size from the Team page's field crew; restricted site hours → 6 h days", fpOpts.crew.size === 3 && /3 active field workers/.test(fpOpts.crew.sizeWhy) && fpOpts.crew.hoursPerDay === 6);
ok("…a person's crew plan on the read wins", crewSettings({ model: { plan: { crewSize: 4, hoursPerDay: 8 } }, ctx: { fieldCrew: 3 }, figures: fpOpts.figures }).size === 4);
ok("the plan: 2/3/4-painter options, the same hours, the days and the equipment moving with them", priced2.plan.options.length === 3 && priced2.plan.options[0].days > priced2.plan.options[2].days && priced2.plan.options[0].hours === priced2.plan.options[2].hours && priced2.plan.options[0].equipmentCost >= priced2.plan.options[2].equipmentCost, priced2.plan.options);
const set = applyOps(row2.model, [{ op: "set_crew", crewSize: 2, hoursPerDay: 7.5 }], { dimIds: new Set(), itemKeys, productKeys, photoIds: new Set(), excel: null }, { actor: "person" });
ok("set_crew is a person's, stored on the read, and moves the days", set.model.plan.crewSize === 2 && priceProject(comp2, books, { firstPass: firstPassOptions({ model: set.model, books, ctx: { currency: "CAD", fx, fieldCrew: 3 } }) }).plan.days > priced2.plan.days);

// ═══════════════════════════════════════════════════════════════════════════
section("10. What the first pass costs — tokens and credits, before and after");
// ═══════════════════════════════════════════════════════════════════════════
const legacy = { ...churchRead("pt0", null), documents: docs("pt0") };
const beforeEst = estimateRead({ sheets: 13, photos: 0, excelChars: 0 });
const afterEst = readEstimate(legacy);
const scopedEst = before;
ok(`no scope: 13 sheets were ${beforeEst.cents} credits up to; with the measurement passes ${afterEst.cents} (${afterEst.breakdown.measureSheets} measured sheets)`, afterEst.breakdown.measureSheets === 9 && afterEst.cents > beforeEst.cents, [beforeEst, afterEst.breakdown]);
const promptChars = sheetsBase.filter((s) => isMeasurableKind(sheetKind(s))).map((s) => measurePrompt(s, {}).length + MEASURE_SYSTEM.length);
const avgText = Math.round(promptChars.reduce((a, b) => a + b, 0) / promptChars.length / 4);
ok(`the measurement prompt on the real sheets is ~${avgText} text tokens (READ_TOKENS.measure.text ${READ_TOKENS.measure.text} holds it)`, avgText <= READ_TOKENS.measure.text, avgText);
const runVendor = row.usage.run.vendorMicros;
const runMeasure = row.usage.byStep.measure.vendorMicros;
console.log(`      measured on the scripted church read (live-shaped token counts): ${row.usage.promptTokens} prompt + ${row.usage.completionTokens} completion tokens; measurement passes ${row.usage.byStep.measure.calls} × ≈${Math.round(runMeasure / row.usage.byStep.measure.calls / 1000) / 1000} US$ = ${Math.round(runMeasure / 10000) / 100} US$ of ${Math.round(runVendor / 10000) / 100} US$ vendor cost; charged ${row.chargedCents} credits (× 2), held ${scopedEst.cents}`);
ok("the charge settles from the metered calls (vendor cost × 2), never above the hold", row.chargedCents > 0 && row.chargedCents <= scopedEst.cents && row.chargedCents === Math.min(scopedEst.cents, Math.ceil((runVendor * 2) / 10_000)));
ok("prompt caching kept: the synthesis carries the read's cache key", calls.find((c) => c.schemaName === "plan_read_synthesis").promptCacheKey === "plan_read:pc1");
ok("a read made before the first pass offers ONLY the new work — it measures and synthesises, keeping its sheet passes", (() => {
  const old = { ...churchRead("pold"), status: "ready", sheets: sheetsBase.map((s) => ({ ...s, read: { relevant: true, summary: "x", areas: [], heights: [], finishes: [], access: [], readDims: [] } })), progress: { inputsKey: "dset|scope:painting:exterior+interior" }, documents: docs("pold") };
  const e = readEstimate(old);
  return hasWorkToRead(old) && e.breakdown.sheetsToRead === 0 && e.breakdown.measureSheets >= 7;
})());

// ═══════════════════════════════════════════════════════════════════════════
section("11. Past jobs: the company's own, by trade, in $ and hours, with the gap's reason");
// ═══════════════════════════════════════════════════════════════════════════
const g = (key, sqft, subtotal, extra = {}) => ({ label: "Painting", subtotal, intakeValues: {}, category: { key }, takeoff: { model: "area_substrate", estimateType: key === "exterior_painting" ? "exterior" : "interior", areas: [{ areaType: key === "exterior_painting" ? "exterior" : "den", label: "x", surface: key === "exterior_painting" ? "exterior" : "interior", measurement: "surface", surfaceSqft: sqft, heightFt: 0, substrates: [{ key: key === "exterior_painting" ? "siding_trim" : "walls", quantity: sqft, driver: "wallSqft", coats: 2, prepHours: 0 }] }] }, ...extra });
const rows = [
  { id: "q1", companyId: "co1", quoteNumber: "Q-1", status: "accepted", createdAt: new Date("2026-05-01"), notes: "St Mark's church exterior", scopeGroups: [g("exterior_painting", 3000, 9000)], jobs: [{ status: "completed", timeEntries: [{ hours: 40 }] }] },
  { id: "q2", companyId: "co1", quoteNumber: "Q-2", status: "accepted", createdAt: new Date("2026-06-01"), notes: "Chapel repaint", scopeGroups: [g("exterior_painting", 2000, 7000), g("interior_painting", 1000, 3000)], jobs: [] },
  { id: "qx", companyId: "co2", quoteNumber: "THEIRS", status: "accepted", createdAt: new Date("2026-06-01"), notes: "church", scopeGroups: [g("exterior_painting", 3000, 3000)], jobs: [] },
];
const sim = summariseSimilar(rows, { companyId: "co1", family: "church", sqft: 4500, books });
ok("another company's row never counts — dropped in code, beside the query's companyId", !sim.matches.some((m) => m.quoteNumber === "THEIRS") && /where: \{ companyId, status: "completed" \}/.test(code("lib/planRead/similar.js")) && /companyId,\n\s+status: \{ in:/.test(code("lib/planRead/similar.js")));
ok("by trade: exterior $3.00–$3.50 / sq ft over two church jobs; interior its own", sim.byCategory.exterior_painting.range.low === 3 && sim.byCategory.exterior_painting.range.high === 3.5 && sim.byCategory.interior_painting.count === 1, sim.byCategory);
ok("hours per sq ft from the jobs' own takeoffs, and the hours CLOCKED where the job is completed", sim.byCategory.exterior_painting.hoursRange && sim.byCategory.exterior_painting.hoursRange.actual === true && near(sim.matches.find((m) => m.quoteId === "q1").byCategory.exterior_painting.actualHoursPerSqft, 40 / 3000, 1e-4));
const cmp = compareToPast(sim.byCategory.exterior_painting, { perSqft: 5.2, hoursPerSqft: 0.02, highShare: 0.55, accessShare: 0.12, prepShare: 0.2, commercial: true, sqft: 4500, pastSqft: 2500 });
ok("a draft 49% above the range is flagged with its likely reasons — the height, the access, the prep", cmp.flagged && cmp.position === "above" && cmp.reasons.some((r) => /above 8 ft/.test(r)) && cmp.reasons.some((r) => /access equipment/.test(r)), cmp);
ok("inside the range: placed, not flagged", compareToPast(sim.byCategory.exterior_painting, { perSqft: 3.2 }).position === "within" && !compareToPast(sim.byCategory.exterior_painting, { perSqft: 3.2 }).flagged);
ok("no past jobs of the trade: says so (no range is ever invented)", compareToPast(null, { perSqft: 3 }) === null && categoryRanges([], null).interior_painting === undefined);

// ═══════════════════════════════════════════════════════════════════════════
section("12. One set → two quotes, in the same read");
// ═══════════════════════════════════════════════════════════════════════════
const ctxPrice = {
  currency: "CAD", labour: { rate: 35, source: "fallback", workers: 0 }, target: { pct: 20, isDefault: true },
  overhead: { rates: null, fallbackPct: 10, minimumPrice: null, hourlyFloor: null, minimumPerHour: null, needsCapacity: false },
  books: {}, services: [], enabledKeys: ["interior_painting", "exterior_painting"],
};
const slices = priceSlices({ read: { ...row2 }, computed: { ...comp2, trades: [] }, books, firstPass: fpOpts, pctx: ctxPrice, similar: sim });
ok("exterior + interior painting on the quote → two scoped drafts", slices.map((s) => s.key).join() === "exterior_painting,interior_painting", slices.map((s) => s.key));
const [sx, si] = slices;
const liftId = row2.model.access.find((a) => a.areaId === "a1" && a.equipment === "boom_lift").id;
ok("each with its own surfaces, access and price — the outside's lift goes with the outside", sx.computed.surfaces.every((s) => s.itemKey === "siding_trim") && si.computed.surfaces.every((s) => s.itemKey !== "siding_trim") && sx.priced.access.some((a) => a.id === liftId) && !si.priced.access.some((a) => a.id === liftId), [sx.priced.access.map((a) => a.id), si.priced.access.map((a) => a.id)]);
ok("each recommended at the target on its own, and compared with its OWN trade's past jobs", sx.pricing.recommendation.recommended > 0 && si.pricing.recommendation.recommended > 0 && sx.compare && sx.compare.range.low === 3, [sx.compare, si.compare]);
ok("the parts add up to the whole read's paint", near(sx.priced.paintTotal + si.priced.paintTotal, priced2.paintTotal, 0.05 * priced2.paintTotal), [sx.priced.paintTotal, si.priced.paintTotal, priced2.paintTotal]);
ok("'Create quote' per part: the builder passes planScope; the draft route filters by it — no re-read", /planScope/.test(code("app/components/quotes/builder/QuoteBuilder.js")) && /searchParams\.get\("scope"\)/.test(code("app/api/plan-reads/[id]/draft-quote/route.js")) && /planScope=\$\{encodeURIComponent\(key\)\}/.test(code("app/components/planRead/PlanReadWorkspace.js")));
ok("a single-service read stays one draft", readSlices({ scope: { categories: [{ key: "exterior_painting" }] } }, comp2).length === 1);

// ═══════════════════════════════════════════════════════════════════════════
section("13. 'Priced on' — one tap re-prices, no model call");
// ═══════════════════════════════════════════════════════════════════════════
ok("six assumptions, every option with an effect", ASSUMED_KEYS.join() === "exteriorSurface,interiorSurface,colours,heritage,siteHours,occupied" && ASSUMED.siteHours.options.includes("restricted"));
const painted = applyOps(row2.model, [{ op: "set_assumption", key: "exteriorSurface", value: "painted_masonry" }], { dimIds: new Set(), itemKeys, productKeys, photoIds: new Set(), excel: null }, { actor: "person" }).model;
const p2 = priceProject(comp2, books, { firstPass: firstPassOptions({ model: painted, books, ctx: { currency: "CAD", fx, fieldCrew: 3 } }) });
ok("bare → previously painted masonry: the primer comes off the outside's prep, the price falls — computed, not asked", p2.lines.find((l) => l.surfaceId === "s1").prepHours < outsideLine.prepHours && p2.paintTotal < priced2.paintTotal);
ok("…stored as the team's choice", painted.assumed.exteriorSurface.source === "person");
ok("an option that doesn't exist is refused; the model cannot set one", applyOps(row2.model, [{ op: "set_assumption", key: "colours", value: "9" }], { dimIds: new Set(), itemKeys, productKeys, photoIds: new Set(), excel: null }, { actor: "person" }).dropped.length === 1 && applyOps(row2.model, [{ op: "set_assumption", key: "colours", value: "1" }], { dimIds: new Set(), itemKeys, productKeys, photoIds: new Set(), excel: null }, { actor: "model" }).dropped.length === 1);
ok("cleanAssumed copies only known keys and options", JSON.stringify(cleanAssumed({ heritage: { value: "listed", basis: "x" }, colours: { value: "12" }, junk: { value: "x" } })) === JSON.stringify({ heritage: { value: "listed", basis: "x", source: "ai" } }));

// ═══════════════════════════════════════════════════════════════════════════
section("14. Equipment & access: your rates, labelled defaults, never a silent $0");
// ═══════════════════════════════════════════════════════════════════════════
const SET_ACCESS = "/app/settings/services#equipment-access";
const statusDefault = accessStatus(priced2.access, row2.model, { currency: "CAD" });
ok("a reference-priced line says \"FieldQuo default, not your rate … set yours\" and links to Equipment & access", statusDefault.some((l) => l.status === "default" && /FieldQuo default, not your rate/.test(l.text) && /set yours/.test(l.text) && l.href === SET_ACCESS), statusDefault);
const yourBook = { ...books.exterior_painting, accessRates: { boom_lift: { day: 300, week: 900, month: 2500 } } };
const pricedYours = priceProject(comp2, { ...books, exterior_painting: yourBook }, { firstPass: firstPassOptions({ model: row2.model, books: { ...books, exterior_painting: yourBook }, ctx: { currency: "CAD", fx, fieldCrew: 3 } }) });
const yoursLine = pricedYours.access.find((a) => a.equipment === "boom_lift");
ok("a company rate overrides the default, and the line says \"priced at your rate\"", yoursLine.priceSource === "company" && accessStatus(pricedYours.access, row2.model).some((l) => l.id === yoursLine.id && l.status === "yours" && /priced at your rate/.test(l.text)), yoursLine);
ok("…an exterior-only company's rates (interior row never saved) are the ones used — the read and the builder pick the book carrying them", figuresBook({ interior_painting: books.interior_painting, exterior_painting: yourBook }) === yourBook && figuresBook({ interior_painting: books.interior_painting, exterior_painting: books.exterior_painting }) === books.interior_painting && /figuresBook\(books\)/.test(code("app/api/quotes/access-rental/route.js")));
const ownedRental = priceRental({ kind: "boom_lift", workingHeightFt: 45, days: 12, currency: "CAD", fx, book: { accessRates: { boom_lift: { owned: true } } } });
ok("\"We own this (no rental)\": priced at $0 and saying so — a price, not a missing one", ownedRental.price === 0 && ownedRental.owned === true && /you own this, no rental/.test(ownedRental.why));
ok("…a size's own rate beats the kind's: a 30 ft scissor at the company's 30 ft row", ownAccessRate({ accessRates: { scissor_lift: { day: 50, sizes: { 30: { day: 99 } } } } }, "scissor_lift", 30).day === 99 && ownAccessRate({ accessRates: { scissor_lift: { day: 50 } } }, "scissor_lift", 30).day === 50);
// Every kind, height and currency the reference can meet: priced, owned, or
// "NOT priced:" with the reason — never a bare null, never a silent 0.
const silent = [];
for (const kind of Object.keys(ACCESS_REFERENCE)) for (const h of [null, 6, 12, 20, 30, 45, 60, 90, 150]) for (const [cur, rate] of [["USD", null], ["CAD", fx], ["GBP", null], ["AUD", null]]) {
  const p = priceRental({ kind, workingHeightFt: h, days: 7, currency: cur, fx: rate, book: books.exterior_painting });
  if (!((p.price > 0 && /FieldQuo default, not your rate/.test(p.why)) || (p.price === null && /^NOT priced: /.test(p.why) && /Settings → Services → Equipment & access/.test(p.why)))) silent.push([kind, h, cur, p]);
}
ok(`no access line, of any kind × height × currency (${Object.keys(ACCESS_REFERENCE).length * 9 * 4}), is unpriced without a visible reason or priced as a default without the label`, silent.length === 0, silent.slice(0, 3));
ok("…and on the church read every access line is priced, owned or says NOT priced", priced2.access.every((a) => a.price > 0 || a.price === 0 || (a.price === null && /NOT priced/.test(a.why))));
const fallbackGaps = FALLBACKS.filter((x) => !code(x.file).includes(x.shownAs) || (x.link !== null && !/^\/app\/settings\//.test(x.link)));
ok(`the fallback audit (${FALLBACKS.length} inputs) is pinned: each stated default's words are in the file that says them, each link is a settings page`, FALLBACKS.length >= 16 && fallbackGaps.length === 0, fallbackGaps);
ok("…it covers the inputs the owner listed: rental, production rates, labour, overhead/billable hours, paint price, material costs, target margin", ["Access rental rates", "Painting production rates", "Labour cost rate", "Overhead and billable hours", "Paint price", "Prep material prices", "Target margin"].every((k) => FALLBACKS.some((x) => x.input === k)));
const stepFor = (snap) => stepsFor(snap).find((s) => s.key === "access_rates");
ok("setup checklist: \"Set your equipment and access rental rates\" — only for a company quoting painting", stepFor({ enabledCategoryKeys: ["interior_painting"] }).applies === true && stepFor({ enabledCategoryKeys: ["roofing_service"] }).applies === false && /#equipment-access/.test(stepFor({}).href));
ok("…done once a rate is saved, a kind marked owned, or the defaults confirmed — not before", !accessRatesSet([{ rates: { takeoff: { heightFactors: { b2: 1.4 } } } }]) && accessRatesSet([{ rates: { takeoff: { accessRates: { scaffold: { day: 120 } } } } }]) && accessRatesSet([{ rates: { takeoff: { accessRates: { scaffold: { owned: true } } } } }]) && accessRatesSet([{ rates: { takeoff: { accessDefaultsConfirmed: true } } }]) && stepFor({ enabledCategoryKeys: ["exterior_painting"], accessRatesSet: true }).done === true);
const ovAccess = sanitisePaintTakeoffOverrides({ accessRates: { scaffold: { owned: true }, scissor_lift: { sizes: { 30: { day: 99, week: -1 } } } }, accessDefaultsConfirmed: true, frameScaffoldPer100Sqft: 85 });
ok("Settings saves owned, per-size day/week/month, the defaults' yes and the frame-scaffold rate — and refuses a negative", ovAccess.accessRates.scaffold.owned === true && ovAccess.accessRates.scissor_lift.sizes["30"].day === 99 && !("week" in ovAccess.accessRates.scissor_lift.sizes["30"]) && ovAccess.accessDefaultsConfirmed === true && ovAccess.frameScaffoldPer100Sqft === 85, ovAccess);

// ═══════════════════════════════════════════════════════════════════════════
section("15. \"Access in this price\" — every line's status, the reason, the one sentence");
// ═══════════════════════════════════════════════════════════════════════════
const lift = priced2.access.find((a) => a.equipment === "boom_lift");
const reasonOp = (model, op, actor = "person") => applyOps(model, [op], { dimIds: new Set(), itemKeys, productKeys, photoIds: new Set(), excel: null }, { actor });
const leftOut = reasonOp(row2.model, { op: "remove_access", accessId: lift.id }).model;
const leftStatus = accessStatus([], leftOut);
ok("a removed line shows as left out, asking for its reason until one is given", leftStatus.some((l) => l.status === "left_out" && l.needsReason === true && /left out: no reason given/.test(l.text)), leftStatus);
const reasoned = reasonOp(leftOut, { op: "set_access_reason", accessId: lift.id, reason: "client_provides", userId: "Dana", at: "2026-10-05T09:00:00.000Z" }).model;
ok("one tap records the reason with who and when, and the line says it: \"left out: the client provides it (Dana, 2026-10-05)\"", accessStatus([], reasoned).some((l) => l.status === "left_out" && /left out: the client provides it \(Dana, 2026-10-05\)/.test(l.text) && !l.needsReason), accessStatus([], reasoned));
const ownedModel = reasonOp(row2.model, { op: "set_access_reason", accessId: lift.id, reason: "owned", userId: "Dana", at: "2026-10-05T09:00:00.000Z" }).model;
const pricedOwned = priceProject(computeRead({ ...row2, model: ownedModel, documents: docs("pc2") }, { books }).computed, books, { firstPass: firstPassOptions({ model: ownedModel, books, ctx: { currency: "CAD", fx, fieldCrew: 3 } }) });
ok("\"We own it\" on a priced line makes it $0, and the status says why", pricedOwned.access.find((a) => a.id === lift.id).price === 0 && accessStatus(pricedOwned.access, ownedModel).some((l) => l.id === lift.id && l.status === "owned" && /we own it/.test(l.text)), [pricedOwned.access.find((a) => a.id === lift.id), accessStatus(pricedOwned.access, ownedModel)]);
ok("a reason that isn't one of the four is refused; the model can't give one", reasonOp(row2.model, { op: "set_access_reason", accessId: lift.id, reason: "cheaper" }).dropped.length === 1 && reasonOp(row2.model, { op: "set_access_reason", accessId: lift.id, reason: "owned" }, "model").dropped.length === 1 && ACCESS_REASONS.join() === "owned,client_provides,not_needed,included_elsewhere");
ok("the route stamps who and when — never the browser", /set_access_reason/.test(code("app/api/plan-reads/[id]/route.js")) && /userId/.test(code("app/api/plan-reads/[id]/route.js")));
ok("one sentence on the first pass: \"Priced with boom lift at FieldQuo defaults — no rental if you own them\"", /^Priced with .*boom lift.* at FieldQuo defaults — no rental if you own them/.test(accessSentence(priced2.access)), accessSentence(priced2.access));
ok("…none priced, with high work on the drawings: it says so and asks how it is reached", /No access equipment priced — but the drawings show work up to about 30 ft/.test(accessSentence([], { highestFt: 30 })) && /nothing above ladder height/.test(accessSentence([], { highestFt: 8 })));
const cmp2 = code("app/components/quotes/builder/CostMarginPanel.js");
ok("the builder's Cost & margin panel shows the block: default with \"Set yours\", your rate, owned, the reason picker on a $0 line, the high-work note", ["app.cost.accessTitle", "app.cost.accessDefault", "app.cost.accessYours", "app.cost.accessOwned", "app.cost.accessNoneHigh", "#equipment-access", "ACCESS_REASONS", "onAccessReason"].every((w) => cmp2.includes(w)) && /onAccessReason=\{/.test(code("app/components/quotes/builder/QuoteBuilder.js")));
ok("office-only: the block lives in the cost panel and the review, never in a client document", readdirSync(new URL("../lib/documentSections/", import.meta.url)).filter((n) => n.endsWith(".js")).every((n) => !/zeroReason|accessEstimate|meta\??\.access\b|Access in this price/.test(code(`lib/documentSections/${n}`))));

// ═══════════════════════════════════════════════════════════════════════════
section("16. \"What this price includes / Check before sending\"");
// ═══════════════════════════════════════════════════════════════════════════
const rvArgs = (part, model = row2.model) => ({ computed: part.computed, priced: part.priced, pricing: part.pricing, model, firstPass: fpOpts, ownRates: {}, compare: part.compare, currency: "CAD" });
const rvx = buildReview(rvArgs(sx));
const inc = rvx.included.map((i) => i.key.split(":")[0]);
ok(`taken into account: ${[...new Set(inc)].join(", ")}`, ["qty", "coats", "height", "prep", "access", "crew", "overhead", "target", "past", "assumed", "materials"].every((k) => inc.includes(k)), rvx.included);
ok("…the quantities name their sheets", rvx.included.some((i) => i.key.startsWith("qty:") && /P-4[78]/.test(i.text)));
const ck = rvx.checks.map((c) => c.key);
ok(`check before sending (${ck.length}, cap ${MAX_CHECKS}): ${ck.join(", ")}`, ck.length > 0 && ck.length <= MAX_CHECKS && rvx.unreviewed === ck.length);
ok("…deterministic: FieldQuo's default rates, the default rental, heritage consent, lead paint, the lift on the road — on a listed church with a boom", ["default:rates", `default:access:${lift.id}`].every((k) => ck.includes(k)) && rvx.checks.every((c) => c.text && c.why !== undefined && c.check));
const rvAll = buildReview({ ...rvArgs(sx), model: { ...row2.model } });
ok("…ranked by price impact: the default production rates (the whole paint price) come first", rvAll.checks[0].key === "default:rates", rvAll.checks.map((c) => c.key));
const rvi = buildReview(rvArgs(si, { ...row2.model, assumed: { ...row2.model.assumed, heritage: { value: "none" } } }));
ok("only what applies: the inside part has no weather, no lift-on-road; a non-heritage building no consent check", !rvi.checks.some((c) => ["weather", "lift:road", "heritage:consent"].includes(c.key)), rvi.checks.map((c) => c.key));
const rvOwnRates = buildReview({ ...rvArgs(sx), ownRates: { exterior_painting: true } });
ok("…your own painting rates: no \"default rates\" check", !rvOwnRates.checks.some((c) => c.key === "default:rates"));
const firstKey = rvx.checks[0].key;
const ticked = reasonOp(row2.model, { op: "review_check", key: firstKey, verdict: "ok", text: rvx.checks[0].text, userId: "Dana", at: "2026-10-05T10:00:00.000Z" }).model;
const rvTicked = buildReview(rvArgs(sx, ticked));
ok("\"Looks right\" is recorded with who and when, and the count of unreviewed drops by one", ticked.review[firstKey].by === "Dana" && ticked.review[firstKey].at === "2026-10-05T10:00:00.000Z" && rvTicked.checks.find((c) => c.key === firstKey).tick.verdict === "ok" && rvTicked.unreviewed === rvx.unreviewed - 1);
ok("…only Looks right / Change, only a person", reasonOp(row2.model, { op: "review_check", key: firstKey, verdict: "maybe" }).dropped.length === 1 && reasonOp(row2.model, { op: "review_check", key: firstKey, verdict: "ok" }, "model").dropped.length === 1);
const draftRoute = code("app/api/plan-reads/[id]/draft-quote/route.js");
ok("the ticks ride into the quote's office notes, and the builder warns (not blocks) on the unreviewed count before Send", /Check before sending:/.test(draftRoute) && /unreviewed: review \? review\.unreviewed : 0/.test(draftRoute) && /planReadUnreviewed > 0/.test(code("app/components/quotes/builder/QuoteBuilder.js")) && /app\.planRead\.builderUnreviewed/.test(code("app/components/quotes/builder/QuoteBuilder.js")));
ok("open questions and assumptions merge into the checks, not shown twice", buildReview({ ...rvArgs(sx), computed: { ...sx.computed, questions: [{ id: "q1", text: "Is the tower in scope?", resolved: false }] } }).checks.some((c) => c.key === "q:q1" && c.source === "model") && /rv\.|review/.test(code("app/components/planRead/PlanReadWorkspace.js")));
const rvQ = buildReview({ ...rvArgs(sx), computed: { ...sx.computed, questions: Array.from({ length: 3 }, (_, i) => ({ id: `q${i}`, text: `Question ${i}`, resolved: false })) } });
const rvNoQ = buildReview({ ...rvArgs(sx), computed: { ...sx.computed, questions: [] } });
ok("…the read's open questions are never cut by the cap, and what falls past it is kept as \"more\", not dropped", ["q:q0", "q:q1", "q:q2"].every((k) => rvQ.checks.some((c) => c.key === k)) && rvQ.checks.length === MAX_CHECKS && rvQ.more.length > 0 && rvQ.checks.length + rvQ.more.length === rvNoQ.checks.length + rvNoQ.more.length + 3, [rvQ.checks.map((c) => c.key), rvQ.more.map((c) => c.key)]);
ok("office-only: a member who can't see prices gets the review with the money scrubbed", /canSeeMoney/.test(code("lib/planRead/view.js")) && /review/.test(code("lib/planRead/view.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("17. Materials at quote time: paint, primer, prep, sundries — priced, labelled");
// ═══════════════════════════════════════════════════════════════════════════
const mats = priced2.materials;
const paintItems = mats.items.filter((i) => i.key.startsWith("paint:"));
ok(`the church read's list: ${mats.items.length} items, ${mats.total} CAD`, mats.items.length >= 4 && mats.total > 0 && paintItems.length >= 1);
ok("paint: area × coats ÷ coverage, rounded UP to whole gallons per product", paintItems.every((i) => Number.isInteger(i.computedQty) && /sq ft of coating ÷ \d+ sq ft\/gal/.test(i.basis)) && (priced2.paintBuy || []).every((p) => p.gallons === Math.ceil(p.coatingSqft / p.coverageSqftPerGal - 1e-9)), (priced2.paintBuy || []).slice(0, 3));
const keysOf = (m) => m.items.map((i) => i.key);
ok("primer only where the condition calls for it: bare masonry outside → masonry primer; painted plaster inside → none", keysOf(mats).includes("prep:primer_masonry") && !keysOf(mats).includes("prep:primer_smooth"), keysOf(mats));
ok("…previously-painted masonry: the primer comes off the list", !keysOf(p2.materials).some((k) => /primer/.test(k)), keysOf(p2.materials));
const pm1 = prepMaterialsFor("painted_plaster", 1000, B);
const pm2 = prepMaterialsFor("painted_plaster", 2000, B);
ok("prep allowances scale with area: 2,000 sq ft takes twice the filler, tape and drop sheets of 1,000", pm1.items.every((it, i) => near(pm2.items[i].qty, it.qty * 2, 1e-3)) && pm1.items.map((i) => i.key).join() === CONDITION_MATERIALS.painted_plaster.join());
ok("no condition, no prep materials — a typed ≤8 ft room's bill is what it was", prepMaterialsFor(null, 1000, B) === null && !paintTakeoff(fx6.room_8ft, B).prepPurchase);
ok("sundries: 5% of the paint, labelled a FieldQuo default", mats.items.some((i) => i.key === "sundries" && i.priceSource === "default" && /5% of the paint \(FieldQuo default/.test(i.basis)));
ok("a missing price falls back to a labelled default — \"FieldQuo default — … set yours\" — never $0", ["primer", "filler", "abrasives", "tape", "drop_sheets", "caulk"].every((k) => { const p = prepMaterialPrice(k, B); return p.price > 0 && p.source === "default" && /^FieldQuo default — .*set yours$/.test(p.label); }));
ok("…primer has a default price too ($23.98, US shelf, dated)", prepMaterialPrice("primer", B).price === PREP_MATERIAL_PRICE_PRESET.primer && PREP_MATERIAL_PRICE_PRESET.primer > 0);
ok("your price wins — even one equal to the shelf price reads \"your price\"", prepMaterialPrice("filler", { ...B, prepMaterialPrices: { filler: 11.48 } }).source === "yours" && prepMaterialPrice("filler", { ...B, prepMaterialPrices: { filler: 15 } }).price === 15);
ok("…a stored null is \"not set\", never a free tub", prepMaterialPrice("filler", { ...B, prepMaterialPrices: { filler: null } }).source === "default");
ok("…the paint card's primer price is the primer's when no prep price is set", prepMaterialPrice("primer", { ...B, products: { ...B.products, primer: { ...B.products.primer, costPerGal: 31 } } }).price === 31);
ok("the estimator's quantity wins on the read's list, and moves the material cost", (() => {
  const m = reasonOp(row2.model, { op: "set_material_qty", key: "prep:tape", qty: 40 }).model;
  const pp = priceProject(comp2, books, { firstPass: firstPassOptions({ model: m, books, ctx: { currency: "CAD", fx, fieldCrew: 3 } }) });
  const tape = pp.materials.items.find((i) => i.key === "prep:tape");
  return tape.qty === 40 && tape.edited && near(pp.materials.editDelta, (40 - tape.computedQty) * tape.unitPrice, 0.01);
})());
ok("the material list feeds the price: the read's materialCost includes the prep materials and sundries", sx.pricing && Number(sx.pricing.painting?.materialCost ?? sx.pricing.materialCost ?? 0) > 0);
const seeded = tradeMaterialsFor("interior_painting", fx6.condition_painted_plaster, null);
ok("the job's sourcing list is seeded from the quote's takeoff: a chosen condition's prep materials are on it (prep:*), priced", seeded.materials.some((m) => m.materialKey === "prep:filler" && m.unitCost > 0) && !tradeMaterialsFor("interior_painting", fx6.room_8ft, null).materials.some((m) => String(m.materialKey).startsWith("prep:")));
ok("…the read's drafted rows carry the condition, so a quote created from it seeds the same list", (priced2.groups || []).some((g) => (g.takeoff?.areas || []).some((a) => (a.substrates || []).some((s) => s.prepCondition === "bare_masonry"))));

// ── G. Masonry primer follows primer ──
ok("masonry primer: same price as primer until set — and SAYS so: \"same as primer — set your own\"", (() => { const p = prepMaterialPrice("masonry_primer", B); return p.price === prepMaterialPrice("primer", B).price && p.label === "same as primer — set your own" && p.follows === "primer"; })());
ok("…stored as \"follows primer\", not a copied number: change the primer and masonry moves with it", prepMaterialPrice("masonry_primer", { ...B, prepMaterialPrices: { primer: 30 } }).price === 30 && prepMaterialPrice("masonry_primer", { ...B, products: { ...B.products, primer: { ...B.products.primer, costPerGal: 28 } } }).price === 28 && !("masonry_primer" in (B.prepMaterialPrices || {})));
ok("…its own price, once set, wins and is labelled yours", (() => { const p = prepMaterialPrice("masonry_primer", { ...B, prepMaterialPrices: { primer: 30, masonry_primer: 41 } }); return p.price === 41 && p.source === "yours"; })());
ok("…its coverage stays its own: 350 / 375 sq ft a gallon from NPC 2014 p. 140, not the smooth primer's", PREP_MATERIALS.primer_masonry.sqftPerUnit === 350 && PREP_MATERIALS.primer_render.sqftPerUnit === 375 && /NPC 2014 p\. 140/.test(PREP_MATERIALS.primer_masonry.source) && PREP_MATERIALS.primer_masonry.priceKey === "masonry_primer");
ok("…Settings saves it separately; blank keeps \"follows primer\"", sanitisePaintTakeoffOverrides({ prepMaterialPrices: { masonry_primer: 41 } }).prepMaterialPrices.masonry_primer === 41 && !sanitisePaintTakeoffOverrides({ prepMaterialPrices: { masonry_primer: "" } })?.prepMaterialPrices && /same as primer/.test(code("app/app/settings/services/PaintHeightPrepSettings.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("18. Wiring");
// ═══════════════════════════════════════════════════════════════════════════
const pkg = JSON.parse(code("package.json"));
ok("check:plan-read-first-pass is in check:all", /check:plan-read-first-pass/.test(pkg.scripts["check:all"]));
ok("the screen renders the first pass: measured, priced-on, crew plan, the parts, confirm on access", ["MeasuredCard", "AssumptionsCard", "CrewPlanCard", "SlicesCard", "confirm_access", "UnmeasuredBanner"].every((w) => code("app/components/planRead/PlanReadWorkspace.js").includes(w)));
ok("Settings → Services edits the preset's height, prep, crew and access figures", /PaintHeightPrepSettings/.test(code("app/app/settings/services/ServicesEditor.js")) && /takeoff\.heightFactors/.test(code("app/app/settings/services/PaintHeightPrepSettings.js")));
ok("Settings → Services → Equipment & access: its own section, the owned toggle, the defaults shown, in the sidebar and the settings search", /id="equipment-access"/.test(code("app/app/settings/services/PaintHeightPrepSettings.js")) && /We own this \(no rental\)/.test(code("app/app/settings/services/PaintHeightPrepSettings.js")) && /app\.settings\.equipmentAccess/.test(code("app/components/layout/SettingsSidebar.js")) && /#equipment-access/.test(code("app/components/layout/SettingsSidebar.js")));
ok("the help article exists in en, fr and es, and in the help tree", ["en", "fr", "es"].every((l) => /"settings-equipment-access": \{/.test(code(`content/help/${l}/settings-2.js`))) && /"settings-equipment-access"/.test(code("lib/help/tree.js")) && ["en", "fr", "es"].every((l) => /first-pass/.test(code(`content/help/${l}/leads-and-quotes-3.js`))));
const scanned = ["app/components/planRead/FirstPassCards.js", "app/components/planRead/ReviewPanel.js", "app/app/settings/services/PaintHeightPrepSettings.js", "app/components/quotes/builder/CostMarginPanel.js", "app/components/quotes/builder/PaintAreas.js", "app/components/layout/SettingsSidebar.js"];
const dynamicKeys = [...ACCESS_REASONS.map((r) => `app.planRead.accessReason.${r}`), ...["qty", "coats", "height", "prep", "access", "crew", "overhead", "target", "past", "assumed", "materials"].map((k) => `app.planRead.review.label.${k}`), ...Object.keys(PREP_MATERIAL_PRICE_PRESET).map((k) => `app.paintPreset.material.${k}`), "app.setup.step.access_rates", "app.planRead.builderUnreviewed", "app.planRead.builderUnreviewedLink"];
const keysUsed = new Set(scanned.flatMap((p) => [...code(p).matchAll(/\bt\("(app\.(?:planRead|paintPreset|cost\.access|settings\.equipmentAccess)[a-zA-Z0-9_.]*)"/g)].map((m) => m[1])).concat(dynamicKeys));
const langs = Object.keys(APP_MESSAGES);
const missing = [...keysUsed].filter((k) => !langs.every((l) => typeof APP_MESSAGES[l][k] === "string"));
ok(`every first-pass string exists in all ${langs.length} languages (${keysUsed.size} keys)`, langs.length === 9 && missing.length === 0, missing.slice(0, 20));

console.log(`\ncheck-plan-read-first-pass: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
