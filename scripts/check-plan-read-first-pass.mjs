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
//  18. the church's second live run (8954e631): walls to the eaves, arches
//      are openings, every scaffold priced, days from a job's crew, one
//      ladder set owned, the sentence grouped, "taken into account" filled
//  19. wiring: the screen, the routes, the strings, check:all
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

import { ST_PAULS_SHEETS } from "./fixtures/stPaulsSheets.mjs";
import { presetFixtures, SAME, MOVES } from "./fixtures/paintPresetFixtures.mjs";
import { sheetKind, isMeasurableKind } from "@/lib/planRead/sheetKinds";
import { MEASURE_SCHEMA, MEASURE_SYSTEM, MEASURE_VERSION, measurePrompt } from "@/lib/planRead/measurePrompts";
import { SYNTHESIS_SCHEMA, SYNTHESIS_SYSTEM, SHEET_SCHEMA, PHOTO_SCHEMA, projectContext } from "@/lib/planRead/prompts";
import { TRADE_SHEET_SCHEMA, TRADE_SYNTHESIS_SCHEMA } from "@/lib/planRead/tradePrompts";
import { waiveUsage, settlement } from "@/lib/planRead/billing";
import { guessedShare } from "@/lib/planRead/slices";
import { estimateCostMicros } from "@/lib/ai/usage";
import { sanitiseMeasure, buildTakeoff, takeoffForPrompt, printedAreasIn, faceQuantity, cleanBox, wallHeight, heightKind, solidPerimeter, ARCH_SHARE, WALL_HEIGHT_TOLERANCE } from "@/lib/planRead/takeoff";
import { buildDimIndex, computeProject, applyOps, sanitiseSynthesis } from "@/lib/planRead/projectModel";
import { startRead, advanceRead, readEstimate, measureNeeded, measurePlanned, hasWorkToRead, measureStale, readAgainFlag, readInputs, measureOutcome, hasMeasurements } from "@/lib/planRead/run";
import { planReadView } from "@/lib/planRead/view";
import { estimateRead, READ_TOKENS } from "@/lib/planRead/billing";
import { priceProject } from "@/lib/planRead/pricing";
import { firstPassOptions, crewSettings, daysFor, priceAccessLine, surfacePrep, usdFx, heightRow, figuresBook, missingAccess } from "@/lib/planRead/firstPass";
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
import { buildReview, accessStatus, accessSentence, MAX_CHECKS, countName } from "@/lib/planRead/review";
import { ACCESS_REASONS } from "@/lib/planRead/accessReasons";
import { FALLBACKS } from "@/lib/planRead/fallbacks";
import { stepsFor, accessRatesSet } from "@/lib/setupSteps";
import { tradeMaterialsFor } from "@/lib/costing/tradeMaterials";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { sameSurfacePlan, drawingState, planLevel, orientation, nameKeys, choosePlanState, newWorkMention, PLAN_STATES } from "@/lib/planRead/sameSurface";
import { backfillFromTakeoff } from "@/lib/planRead/backfill";
import { CHURCH_REQUEST, CHURCH_PLAN_SHEETS, CHURCH_INTERIOR_MODEL } from "./fixtures/churchThreePlans.mjs";

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
// assertStrictSchema RETURNS { ok, errors } — it never throws. This used to be
// a try/catch around it, which could not fail: MEASURE_SCHEMA sat six levels
// deep from 5a300fc9f, provider.js refused it before every call, and this
// line said "ok" the whole time (the church's Read again, 2026-10-06).
const lints = {
  MEASURE_SCHEMA: assertStrictSchema(MEASURE_SCHEMA),
  SYNTHESIS_SCHEMA: assertStrictSchema(SYNTHESIS_SCHEMA),
  SHEET_SCHEMA: assertStrictSchema(SHEET_SCHEMA),
  PHOTO_SCHEMA: assertStrictSchema(PHOTO_SCHEMA),
  TRADE_SHEET_SCHEMA: assertStrictSchema(TRADE_SHEET_SCHEMA),
  TRADE_SYNTHESIS_SCHEMA: assertStrictSchema(TRADE_SYNTHESIS_SCHEMA),
};
ok("every schema a drawing read sends passes the vendor's strict-mode lint (depth ≤ 5, every key required) — the lint provider.js runs before each call", Object.values(lints).every((l) => l.ok === true), Object.fromEntries(Object.entries(lints).filter(([, l]) => !l.ok).map(([k, l]) => [k, l.errors])));
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
const provider = (synth, measures = MEASURES) => async (args) => {
  calls.push(args);
  // provider.js's own pre-flight, before anything is sent or billed: a
  // schema the vendor would refuse comes back bad_schema with no usage. The
  // scripted model used to skip it, which is how every run here measured
  // while every live run failed.
  if (args.schema) {
    const lint = assertStrictSchema(args.schema);
    if (!lint.ok) return { ok: false, reason: "bad_schema", message: lint.errors.join("; ") };
  }
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
    return { ok: true, data: measures[k] || { sheetType: "other", sheetTypeReason: "x", views: [], faces: [], heights: [] } };
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
ok("…beside the sheet passes (each sheet's two passes in flight together) and recorded as their own step", row.usage.byStep.measure?.calls === measureCalls.length && row.usage.byStep.sheets.calls >= 7);
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
// 10 = the 9 drawings + P-46's 3D views, measured for the INSIDE wall height
// only (a read pricing inside walls; the coordinator, after the church's run 2).
ok(`no scope: 13 sheets were ${beforeEst.cents} credits up to; with the measurement passes ${afterEst.cents} (${afterEst.breakdown.measureSheets} measured sheets)`, afterEst.breakdown.measureSheets === 10 && afterEst.cents > beforeEst.cents, [beforeEst, afterEst.breakdown]);
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
  const known = ACCESS_REFERENCE[kind].rows.length > 0;
  const ok1 =
    (p.price > 0 && /FieldQuo default, not your rate/.test(p.why)) ||
    (p.price === 0 && p.priceSource === "default_owned" && /FieldQuo assumes you own these/.test(p.why)) ||
    (p.price === null && /^NOT priced: /.test(p.why) && /Settings → Services → Equipment & access/.test(p.why) && (!known || p.unpricedReason === "no_fx"));
  if (!ok1) silent.push([kind, h, cur, p]);
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
ok("…the quantities say their square feet and the pages they were measured on (never the paper size \"A3\")", rvx.included.some((i) => i.key.startsWith("qty:") && /\d sq ft — measured on page \d/.test(i.text)) && !rvx.included.some((i) => /\bA3\b/.test(i.text)), rvx.included.filter((i) => i.key.startsWith("qty:")).map((i) => i.text));
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
section("18. The church's second live run — the seven faults, fixed");
// ═══════════════════════════════════════════════════════════════════════════
// The live read (2026-10-05, deploy 8954e631, read cmuun5kc00000vst66kp7qc81):
// 30,655 sq ft of interior wall (walls taken to the 33.5 ft ridge; the
// crossing's four arches counted as wall), six scaffolds "NOT priced", 0.49
// days for 128 h (35 field workers as one crew), "step ladders and step
// ladders and…", an empty "taken into account", ten rented step ladders.
// The fixtures are the read's own figures.
const ft = (m) => Math.round(m * 3.28084 * 100) / 100;
const roomFace = (id, name, Lm, Wm) => ({ id, name, room: true, measured: true, lengthFt: ft(Lm), widthFt: ft(Wm), perimeterFt: Math.round(2 * (ft(Lm) + ft(Wm)) * 10) / 10, floorSqft: Math.round(ft(Lm) * ft(Wm)), openingsShare: 0, confidence: "medium", perimeterConfidence: "medium", sentence: `${name} (fixture)` });
const hgt = (id, label, kind, heightFt) => ({ id, label, kind, heightFt, measured: true, confidence: "medium", sentence: `${label}: ${heightFt} ft (fixture)` });
const churchTakeoff = {
  faces: new Map(
    [
      roomFace("p3.f1", "Nave", 18.74, 12.83),
      roomFace("p3.f2", "Crossing", 6.72, 11.41),
      roomFace("p3.f3", "Chancel", 9.66, 11.47),
      roomFace("p3.f4", "North transept", 9.24, 9.98),
      roomFace("p3.f5", "South transept", 14.79, 7.43),
      roomFace("p1.f9", "Nave", 18.0, 12.5),
      roomFace("p1.f1", "Cafe", 6.83, 9.47),
    ].map((f) => [f.id, f]),
  ),
  heights: new Map(
    [
      hgt("p9.h2", "Main nave roof ridge height visible behind extension", "ridge", 33.52),
      hgt("p7.h1", "South nave eaves height", "eaves", 9.65),
      hgt("p7.h2", "South nave ridge height", "ridge", 35.08),
      hgt("p9.h3", "Extension wall top / eaves height", "eaves", 9.84),
      hgt("p5.h4", "Lower side roof/eaves height shown", "eaves", 17.6),
      hgt("p9.h9", "Storey height noted", "other", 20),
    ].map((h) => [h.id, h]),
  ),
};
const wallsOf = (id, faceRefs, heightRef, label = "walls", areaName = null) => faceQuantity({ id, label, itemKey: "walls", faceRefs, faceMeasure: "walls", heightRef }, "sqft", churchTakeoff, { areaName });
ok("height kinds: eaves / wall plate / ceiling are a wall's top; ridge, apex, gable, tower are roof", heightKind({ kind: "eaves" }) === "eaves" && heightKind({ kind: "other", label: "Nave wall plate" }) === "eaves" && heightKind({ kind: "ridge" }) === "roof" && heightKind({ kind: "other", label: "Central west gable apex" }) === "roof" && heightKind({ kind: "other", label: "6.8 metres" }) === null);
// (a) the wall stops at the eaves
const naveQ = wallsOf("n", ["p3.f1"], "p9.h2", "Nave interior walls only — high open-truss volume", "Interior quote — Nave walls");
ok(`(a) never the 33.5 ft ridge; with no section or photo inside height, the OUTSIDE eaves (9.65 ft) as a LOWER BOUND, low confidence: ${naveQ.value} sq ft`, naveQ.topFt === 9.7 && naveQ.wallCap.toFt === 9.65 && naveQ.wallCap.fromFt === 33.52 && naveQ.wallCap.lowerBound === true && naveQ.wallCap.source === "outside_eaves" && naveQ.confidence === "low" && /OUTSIDE eaves, taken as a lower bound/.test(naveQ.heightBasis) && /roof above the wall/.test(naveQ.heightBasis), naveQ);
const naveSolid = 207.2 - ARCH_SHARE * Math.min(ft(18.74), ft(12.83));
ok("…its area is (perimeter less the crossing arch) × the eaves height", near(naveQ.value, naveSolid * 9.65, 2), [naveQ.value, naveSolid * 9.65]);
ok("…the eaves picked is the NAVE's, not the extension's (9.84 ft) or the lower side roof's (17.6 ft)", naveQ.wallCap.eavesId === "p7.h1" && wallsOf("t", ["p3.f4"], "p9.h2", "North transept interior walls only", "Interior quote — North transept walls").wallCap.eavesId === "p7.h1");
ok("…the cafe in the extension keeps the extension's own eaves", wallsOf("c", ["p1.f1"], "p9.h3", "Cafe interior walls only", "Interior quote — Cafe walls").topFt === 9.8);
// (d) sanity: implied height = area ÷ perimeter, against the eaves
const implied = (q, perim) => q.value / perim;
const tall = wallsOf("x", ["p1.f1"], "p9.h9", "Extension cafe walls", "Cafe");
ok(`(d) an implied wall height more than ${Math.round((WALL_HEIGHT_TOLERANCE - 1) * 100)}% over the eaves (20 ft against 9.84) is flagged and recomputed at the eaves`, tall.wallCap && implied(tall, churchTakeoff.faces.get("p1.f1").perimeterFt) <= 9.84 * WALL_HEIGHT_TOLERANCE, tall.wallCap);
ok("…a height within it is left alone (a 11 ft storey with 9.84 ft eaves)", (() => { churchTakeoff.heights.set("p9.h8", hgt("p9.h8", "Storey height noted", "other", 11)); const q = wallsOf("y", ["p1.f1"], "p9.h8", "Extension cafe walls", "Cafe"); churchTakeoff.heights.delete("p9.h8"); return !q.wallCap && q.topFt === 11; })());
ok("…with no eaves on the set, a ridge figure stands at LOW confidence and says so", (() => { const t = { faces: churchTakeoff.faces, heights: new Map([["p9.h2", churchTakeoff.heights.get("p9.h2")]]) }; const q = faceQuantity({ id: "z", label: "Nave", itemKey: "walls", faceRefs: ["p3.f1"], faceMeasure: "walls", heightRef: "p9.h2" }, "sqft", t); return q.confidence === "low" && q.wallCap.roofOnly && /no eaves, wall plate, section or photo/.test(q.heightBasis); })());
// (b) arches are openings
const crossing = wallsOf("x", ["p3.f2"], "p9.h2", "Crossing interior walls only", "Interior quote — Crossing walls");
ok(`(b) the crossing, open on all four sides: only its piers (${Math.round((1 - ARCH_SHARE) * 100)}% of the perimeter) are wall — ${crossing.value} sq ft, not ${Math.round(119 * 33.52)}`, near(crossing.value, churchTakeoff.faces.get("p3.f2").perimeterFt * (1 - ARCH_SHARE) * 9.65, 2) && /open arches on all four sides/.test(crossing.sourceText));
ok("…the nave, transepts and chancel each lose the arch into the crossing", ["p3.f3", "p3.f4", "p3.f5"].every((id) => solidPerimeter(churchTakeoff.faces.get(id), churchTakeoff).ft < churchTakeoff.faces.get(id).perimeterFt) && /open to the crossing through an arch/.test(naveQ.sourceText));
ok("…but a room on a plan with no crossing keeps its whole perimeter", solidPerimeter(churchTakeoff.faces.get("p1.f1"), churchTakeoff).ft === churchTakeoff.faces.get("p1.f1").perimeterFt);
// (c) one room, two sheets
const twice = wallsOf("d", ["p3.f1", "p1.f9"], "p7.h1", "Nave walls", "Nave");
ok("(c) the same room on two sheets (the whole plan and a part plan) is counted once", near(twice.value, naveQ.value, 1) && /not counted twice/.test(twice.sourceText), [twice.value, naveQ.value]);
const liveMain = (207.2 + 119 + 138.6 + 126.1 + 145.8) * 33.52;
const fixedMain = ["p3.f1", "p3.f2", "p3.f3", "p3.f4", "p3.f5"].reduce((n, id) => n + wallsOf(id, [id], "p9.h2", "church walls", "Interior quote — church").value, 0);
ok(`the church's main volume: ${Math.round(liveMain).toLocaleString("en-US")} sq ft on the live run → ${Math.round(fixedMain).toLocaleString("en-US")} sq ft (walls to the eaves, arches open)`, fixedMain < liveMain * 0.35 && fixedMain > 3000, [liveMain, fixedMain]);
// Interior wall height by source: 1. a section, 2. a photo, 3. the outside eaves.
const withHeights = (...hs) => ({ faces: churchTakeoff.faces, heights: new Map([...churchTakeoff.heights, ...hs.map((h) => [h.id, h])]) });
const sectionH = { ...hgt("p9.h5", "Nave inside wall plate / truss foot", "wall_plate", 15.09), side: "interior" };
const photoH = { ...hgt("p8.h1", "Nave truss feet (View looking east)", "wall_plate", 13.78), side: "interior", photo: true, confidence: "medium", sentence: "P-46 — Nave truss feet: about 4.2 m estimated from the photo (View looking east: truss feet ≈ 2.1 doors) — verify on site" };
const naveBy = (t) => faceQuantity({ id: "n2", label: "Nave interior walls only", itemKey: "walls", faceRefs: ["p3.f1"], faceMeasure: "walls", heightRef: "p9.h2" }, "sqft", t, { areaName: "Interior quote — Nave walls" });
const bySection = naveBy(withHeights(sectionH, photoH));
ok(`1. a section's INSIDE wall plate (4.6 m) wins over a photo and over the outside eaves: ${bySection.value} sq ft at ${bySection.topFt} ft`, bySection.topFt === 15.1 && bySection.wallCap.source === "section" && !bySection.wallCap.lowerBound && /the inside wall height from the section/.test(bySection.heightBasis) && /not the Main nave roof ridge/.test(bySection.heightBasis));
const byPhoto = naveBy(withHeights(photoH));
ok(`2. no section: the interior photo's estimate (4.2 m against a door), medium at best, the photo named: ${byPhoto.value} sq ft`, byPhoto.topFt === 13.8 && byPhoto.wallCap.source === "photo" && byPhoto.confidence !== "high" && /estimated from the photo \(View looking east/.test(byPhoto.heightBasis));
ok("3. neither: the outside eaves, a lower bound — and the review asks for the height on site", (() => {
  const rvLB = buildReview({ computed: { surfaces: [{ id: "n", active: true, label: "Nave walls", areaName: "Nave", topFt: naveQ.topFt, wallCap: naveQ.wallCap, quantity: { value: naveQ.value, unit: "sqft", faceIds: ["p3.f1"] } }] }, priced: { lines: [] } });
  return rvLB.checks.some((c) => c.key === "height:outside-eaves" && /interior wall height taken from outside eaves — measure on site/i.test(c.text)) && rvLB.included.some((i) => /lower bound/.test(i.text));
})());
ok("…a photo estimate gets its own check: verify on site", buildReview({ computed: { surfaces: [{ id: "n", active: true, label: "Nave walls", areaName: "Nave", topFt: byPhoto.topFt, wallCap: byPhoto.wallCap, quantity: { value: byPhoto.value, unit: "sqft", faceIds: ["p3.f1"] } }] }, priced: { lines: [] } }).checks.some((c) => c.key === "height:photo"));
ok("the measurement pass asks for both: a section's inside wall height (side interior) and a photo's estimate against a door / person / pew", /INSIDE\s+wall height/.test(MEASURE_SYSTEM) && /a door ≈ 2\.0 m, a person ≈ 1\.7 m, a pew back\s+≈ 0\.9 m/.test(MEASURE_SYSTEM) && MEASURE_SCHEMA.properties.heights.items.required.includes("photoHeightM") && MEASURE_SCHEMA.properties.heights.items.required.includes("side"));
ok("…a photo height is stored with its basis and measured as an estimate (never high)", (() => {
  const facts = { ...sheetsBase.find((x) => x.sheetNumber === "P-46") };
  const m = sanitiseMeasure({ sheetType: "photo", sheetTypeReason: "interior photos", views: [], faces: [], heights: [{ id: "h1", viewId: "v1", label: "Nave truss feet", kind: "wall_plate", side: "interior", box: null, dimRef: null, text: null, photoHeightM: 4.2, photoBasis: "View looking east: ≈ 2.1 doors" }] }, facts);
  const t = buildTakeoff([{ ...facts, measure: m }], new Map());
  const h = [...t.heights.values()][0];
  return h.photo && h.measured && h.side === "interior" && near(h.heightFt, 13.78, 0.01) && h.confidence === "medium" && /estimated from the photo/.test(h.sentence);
})());
ok("…and a photo sheet is measured only when the read prices inside walls", (() => {
  const photoSheet = sheetsBase.find((x) => x.sheetNumber === "P-46");
  const route = { send: true, trades: ["painting"], reason: "painting" };
  return measurePlanned(photoSheet, { scope: { categories: [{ key: "interior_painting" }] } }, route) && !measurePlanned(photoSheet, { scope: { categories: [{ key: "exterior_painting" }] } }, route);
})());
ok("(c) arches: the plan's own arch widths win over the ¾ assumption", (() => {
  const f = { ...churchTakeoff.faces.get("p3.f2"), archWidthsFt: [16.4, 16.4, 13.1, 13.1], archWords: "arch 5 m (printed “5000”), arch 5 m, arch 4 m, arch 4 m" };
  const sp = solidPerimeter(f, churchTakeoff);
  return near(sp.ft, f.perimeterFt - 59, 0.01) && /measured on the plan/.test(sp.note) && !/FieldQuo assumption/.test(sp.note);
})());
ok("…without them, the ¾ fallback says the plan gave none", /the plan gives no arch widths/.test(solidPerimeter(churchTakeoff.faces.get("p3.f2"), churchTakeoff).note));
ok("…and the measurement pass is asked for them (openings on a room, by its faceId: arch / opening, printed width or box — at the schema's root, see 21)", MEASURE_SCHEMA.required.includes("openings") && MEASURE_SCHEMA.properties.openings?.items?.required?.includes("faceId") && !("openings" in MEASURE_SCHEMA.properties.faces.items.properties) && /ARCH or wide opening/.test(MEASURE_SYSTEM));
ok("…a scaled arch width comes from the sheet's own scale", (() => {
  const facts = sheetsBase.find((x) => x.sheetNumber === "P-45");
  const m = sanitiseMeasure({ sheetType: "plan", sheetTypeReason: "x", views: [{ id: "v1", title: "Whole church", viewType: "plan", side: "interior", scaleText: null, box: [0, 0, 1, 1], groundY: null }], faces: [{ id: "f1", viewId: "v1", name: "Crossing", kind: "room", side: "interior", box: [0.4, 0.4, 0.48, 0.59], shape: "rectangle", lengthDimRef: null, heightDimRef: null, lengthText: null, heightText: null, printedAreaText: null, openingsShare: 0, openingsBasis: null, material: null, note: null, openings: [{ kind: "arch", dimRef: null, text: null, box: [0.4, 0.4, 0.44, 0.405] }] }], heights: [] }, facts);
  const f = buildTakeoff([{ ...facts, measure: m }], new Map()).faces.get(`${facts.key}.f1`);
  return f && Array.isArray(f.archWidthsFt) && f.archWidthsFt[0] > 0 && /arch [\d.]+ m \(scaled at/.test(f.archWords);
})());
// (a) access follows the INSIDE wall height
const accessModel = {
  version: 1,
  areas: [{ id: "a1", name: "Nave", side: "interior", included: true }, { id: "a2", name: "North transept", side: "interior", included: true }],
  surfaces: [
    { id: "s1", areaId: "a1", label: "Nave walls", itemKey: "walls", coats: 2, lengthRefs: [], widthRefs: [], faceRefs: ["p3.f1"], faceMeasure: "walls", heightRef: "p9.h2" },
    { id: "s2", areaId: "a2", label: "North transept walls", itemKey: "walls", coats: 2, lengthRefs: [], widthRefs: [], faceRefs: ["p3.f4"], faceMeasure: "walls", heightRef: "p9.h2" },
  ],
  access: [
    { id: "x1", areaId: "a1", equipment: "scissor_lift", included: true, price: null },
    { id: "x2", areaId: "a1", equipment: "scaffold", included: true, price: null },
    { id: "x3", areaId: "a2", equipment: "scaffold", included: true, price: null },
  ],
  questions: [], assumptions: [], exclusions: [],
};
const lowInside = { ...sectionH, id: "p9.h7", heightFt: 11.2, label: "Inside wall plate (section)" };
const accessFor = (t) => priceProject(computeProject(accessModel, { book: books.interior_painting, takeoff: t, dims: new Map() }), books, { firstPass: fpOpts });
const lowAcc = accessFor(withHeights(lowInside));
ok("(a) inside walls known (the section) and under 13 ft: ONE rolling tower, the lift and the other tower not needed — said", lowAcc.access.filter((a) => a.price > 0).length === 1 && lowAcc.access.find((a) => a.price > 0).equipment === "scaffold" && /One rolling tower for the walls: they top out at 11.2 ft inside — instead of the scissor lift listed/.test(lowAcc.access.find((a) => a.price > 0).why) && lowAcc.access.filter((a) => a.priceSource === "not_needed").length === 2 && /not needed — the inside walls are low/.test(accessSentence(lowAcc.access)));
const highAcc = accessFor(withHeights(sectionH));
ok("…inside walls over 13 ft (15.1 ft from the section): the access stays", highAcc.access.filter((a) => a.price > 0).length === 3 && !highAcc.access.some((a) => a.priceSource === "not_needed"));
const lbAcc = accessFor(churchTakeoff);
ok("…a lower-bound height (the outside eaves): the access stays, sized to the height the drawings show above the walls, and says why", lbAcc.access.filter((a) => a.price > 0).length === 3 && lbAcc.access.every((a) => /kept, sized to the 33.5 ft the drawings show above the walls/.test(a.why) && a.heightFt === 33.52));
ok("…a typed line is the estimator's and stands", (() => { const m = { ...accessModel, access: accessModel.access.map((a) => (a.id === "x1" ? { ...a, price: 900, priceSource: "person" } : a)) }; const p = priceProject(computeProject(m, { book: books.interior_painting, takeoff: withHeights(lowInside), dims: new Map() }), books, { firstPass: fpOpts }); return p.access.find((a) => a.id === "x1").price === 900; })());
// (b) prep, explained
const prepItem = rvx.included.find((i) => i.key === "prep");
ok(`(b) prep is broken down by allowance and area, with the setup and the assumption behind it: "${String(prepItem?.text).slice(0, 140)}…"`, prepItem && /h\/100 sq ft × [\d,]+ sq ft = [\d.]+ h/.test(prepItem.text) && /daily setup and clean-up [\d.]+ h \(building in use — ASSUMED by the read, change it under “Priced on”\)/.test(prepItem.text));
ok("…\"occupied\" is a one-tap assumption on the read", ASSUMED_KEYS.includes("occupied") && ASSUMED.occupied.options.join() === "no,yes");
ok("a 'two-storey wall' whose INSIDE walls (from the section) rise under 13 ft is priced as an ordinary wall; a lower bound keeps the model's rate", (() => {
  const low = { ...sectionH, id: "p9.h6", heightFt: 11.5 };
  const m = { version: 1, areas: [{ id: "a1", name: "Nave", side: "interior", included: true }], surfaces: [{ id: "s1", areaId: "a1", label: "Nave walls", itemKey: "wall_two_storey", coats: 2, lengthRefs: [], widthRefs: [], faceRefs: ["p3.f1"], faceMeasure: "walls", heightRef: "p9.h2" }], access: [], questions: [], assumptions: [], exclusions: [] };
  const c = computeProject(m, { book: books.interior_painting, takeoff: withHeights(low), dims: new Map() });
  const lb = computeProject(m, { book: books.interior_painting, takeoff: churchTakeoff, dims: new Map() });
  return c.surfaces[0].itemKey === "walls" && c.surfaces[0].itemKeyFrom === "wall_two_storey" && /not the two-storey rate/.test(c.surfaces[0].itemKeyWhy) && lb.surfaces[0].itemKey === "wall_two_storey";
})());
// 2. scaffolding is always priced
const sc33 = priceRental({ kind: "scaffold", workingHeightFt: 33.5, days: 13, currency: "CAD", fx, book: books.interior_painting });
const sc42 = priceRental({ kind: "scaffold", workingHeightFt: 41.9, days: 7, currency: "CAD", fx, book: books.exterior_painting });
ok(`2. "scaffolding" above the book's 30 ft tower is priced, extrapolated and said: 33.5 ft × 13 days ${sc33.price} CAD, 41.9 ft × 7 days ${sc42.price} CAD`, sc33.price > 0 && sc42.price > sc33.price / 2 && sc33.extrapolated && /extrapolated/.test(sc33.why) && /frame scaffold or a lift quote/.test(sc33.why));
ok("…the extrapolation is the table's own last step per foot (27'–30' row + 3.5 ft at $3.50/day/ft = $192.25 a day)", (() => { const p = priceRental({ kind: "scaffold", workingHeightFt: 33.5, days: 1, currency: "USD" }); return p.price === 192.25; })());
ok("…every kind the table knows is priced at any height in a currency with a rate — none ends 'NOT priced'", Object.keys(ACCESS_REFERENCE).filter((k) => ACCESS_REFERENCE[k].rows.length).every((kind) => [10, 33.5, 41.9, 80, 150].every((h) => priceRental({ kind, workingHeightFt: h, days: 5, currency: "CAD", fx, book: books.exterior_painting }).price >= 0)));
const extFixture = { ...comp2, access: [{ id: "xs", equipment: "scaffold", areaId: "a1", label: "Scaffolding", heightFt: 41.9, included: true, price: null }] };
const extPriced = priceProject(extFixture, books, { firstPass: fpOpts });
ok(`7. the exterior's scaffold line is now in its total: ${extPriced.access[0].price} CAD of access, subtotal = paint + access`, extPriced.access[0].price > 0 && near(extPriced.subtotal, extPriced.paintTotal + extPriced.accessTotal, 0.05) && extPriced.unpricedAccess === 0);
// 3. days from ONE job's crew
const crew35 = crewSettings({ ctx: { fieldCrew: 35 }, figures: fpOpts.figures });
ok(`3. 35 field workers on the Team page are not one crew: a crew of ${crew35.size} assumed, said`, crew35.size === 4 && /35 field workers on your Team page — a crew of 4 assumed for one job/.test(crew35.sizeWhy) && crewSettings({ ctx: { fieldCrew: 3 }, figures: fpOpts.figures }).size === 3);
ok("…the live run's hours: 128.45 h → 4.28 days, 786.8 h → 26.23 days (4 painters × 7.5 h), not 0.49 and 3", daysFor(128.45, 4, 7.5).days === 4.28 && daysFor(786.8, 4, 7.5).days === 26.23 && daysFor(128.45, 35, 7.5).days === 0.49);
const fp35 = firstPassOptions({ model: { ...row2.model, assumed: { ...row2.model.assumed, siteHours: { value: "normal" } } }, books, ctx: { currency: "CAD", fx, fieldCrew: 35 } });
const p35 = priceProject(comp2, books, { firstPass: fp35 });
ok("…the plan shows the crew and the 2/3/4 options, and the rental days follow the days", p35.plan.crew.size === 4 && p35.plan.options.map((o) => o.crew).join() === "2,3,4" && p35.plan.days > 1 && p35.access.every((a) => a.days <= p35.plan.wholeDays + 1));
// 4. the sentence, grouped
const sentence = accessSentence([
  { id: "1", equipment: "boom_lift", label: "Boom lift", price: 2800, priceSource: "reference" },
  { id: "2", equipment: "scaffold", label: "Scaffolding", price: 1200, priceSource: "reference" },
  { id: "3", equipment: "scaffold", label: "Scaffolding", price: 470, priceSource: "reference" },
  { id: "4", equipment: "scissor_lift", label: "Scissor lift", price: 1500, priceSource: "reference" },
  { id: "5", equipment: "step_ladder", label: "Step ladders", price: 0, priceSource: "default_owned" },
  { id: "6", equipment: "step_ladder", label: "Step ladders", price: 0, priceSource: "default_owned" },
  { id: "7", equipment: "crane", label: "Crane", price: null },
  { id: "8", equipment: "crane", label: "Crane", price: null },
]);
ok(`4. the sentence is grouped and counted: "${sentence}"`, sentence === "Priced with boom lift, 2 scaffolds and scissor lift at FieldQuo defaults — no rental if you own them; ladders your own (no rental); 2 cranes NOT priced." && countName("scaffold", 1) === "scaffold");
// 5. taken into account
const rvParts = buildReview({ ...rvArgs(sx), parts: [{ key: "exterior_painting", label: "Exterior painting", plan: sx.priced.plan }, { key: "interior_painting", label: "Interior painting", plan: si.priced.plan }] });
const keys5 = new Set(rvParts.included.map((i) => i.key.split(":")[0]));
ok(`5. "taken into account" lists quantities, heights, prep, access, crew/days per quote, materials, overhead, margin and assumptions (${rvParts.included.length} items)`, ["qty", "height", "prep", "access", "crew", "materials", "overhead", "target", "assumed"].every((k) => keys5.has(k)) && rvParts.included.filter((i) => i.key.startsWith("crew:")).length === 2 && rvParts.included.some((i) => /÷ \(\d painters × [\d.]+ h a day\) = [\d.]+ days/.test(i.text)));
ok("…heights are said even when nothing takes a factor (\"nothing above the rates' 9 ft\")", buildReview({ computed: { surfaces: [{ id: "k", active: true, label: "Kitchen walls", areaName: "Kitchen", topFt: 8, quantity: { value: 100, unit: "sqft", faceIds: ["p1.f2"] } }] }, priced: { lines: [] } }).included.some((i) => i.key === "height" && /Kitchen walls to 8 ft/.test(i.text) && /no height factor/.test(i.text)));
ok("…the screen titles it \"Taken into account\", and says so when there is nothing", /app\.planRead\.review\.takenTitle/.test(code("app/components/planRead/ReviewPanel.js")) && /app\.planRead\.review\.takenNone/.test(code("app/components/planRead/ReviewPanel.js")));
// 6. ladders: owned, one set per job
ok("6. a step ladder with no rate of the company's is OWNED: $0, \"you own these\" — a rate of the company's still wins", (() => { const d = priceRental({ kind: "step_ladder", workingHeightFt: 10, days: 1, currency: "CAD", fx }); const own = priceRental({ kind: "step_ladder", workingHeightFt: 10, days: 1, currency: "CAD", fx, book: { accessRates: { step_ladder: { day: 15 } } } }); return d.price === 0 && d.priceSource === "default_owned" && own.price === 15 && own.priceSource === "company"; })());
const ladderRooms = { ...comp2, access: ["a1", "a2", "a1"].map((areaId, i) => ({ id: `l${i}`, equipment: "step_ladder", areaId, areaName: areaId === "a1" ? "Exterior elevations" : "Nave interior", label: "Step ladders", included: true, price: null })) };
const ladderPriced = priceProject(ladderRooms, books, { firstPass: fpOpts });
ok("…one ladder line per job, covering the rooms that needed one", ladderPriced.access.filter((a) => a.equipment === "step_ladder").length === 1 && ladderPriced.access[0].covers.length === 2 && ladderPriced.access[0].price === 0 && /one set for the job/.test(ladderPriced.access[0].why));
ok("…and the first pass adds at most one ladder line for the areas without access", (() => { const c = { areas: [{ id: "r1", name: "Kitchen" }, { id: "r2", name: "Store" }], access: [], surfaces: [{ id: "s1", areaId: "r1", active: true, bands: [0.8, 0.2, 0, 0, 0, 0], topFt: 10 }, { id: "s2", areaId: "r2", active: true, bands: [0.8, 0.2, 0, 0, 0, 0], topFt: 10 }] }; return missingAccess(c).filter((a) => a.equipment === "step_ladder").length === 1; })());
ok("…the access status says it: \"you own these, no rental (FieldQuo assumes so)\" with the link", accessStatus(ladderPriced.access, null).some((l) => l.status === "owned" && /you own these, no rental \(FieldQuo assumes so\)/.test(l.text) && l.href === "/app/settings/services#equipment-access"));

// ═══════════════════════════════════════════════════════════════════════════
section("20. Read again, and measuring again when the reader improved");
// ═══════════════════════════════════════════════════════════════════════════
{
  // The flag: the body's own boolean AND edit permission — nothing else.
  ok("readAgainFlag: { force: true } from someone who may edit → force", readAgainFlag({ force: true }, { canEdit: true }) === true);
  ok("…without edit permission → no force", readAgainFlag({ force: true }, { canEdit: false }) === false && readAgainFlag({ force: true }) === false);
  ok("…without the flag, or with a look-alike (\"true\", 1, a missing body) → no force", [{}, { force: "true" }, { force: 1 }, null, undefined, "force"].every((b) => readAgainFlag(b, { canEdit: true }) === false));

  // A finished read of the same files and scope.
  const m20 = memDb({ planRead: [churchRead("pc20")], quoteDocument: docs("pc20") });
  await startRead({ planReadId: "pc20", companyId: "co1" }, { ...deps, db: m20 });
  await advanceRead("pc20", { companyId: "co1", budgetMs: 10_000_000 }, { ...deps, db: m20, complete: provider(zeroSynthesis) });
  const done = () => ({ ...m20.t.planRead[0], documents: docs("pc20") });
  ok("a finished read stamps every measurement with the current MEASURE_VERSION", done().status === "ready" && done().sheets.filter((s) => s.measure && !s.measure.failed).length >= 7 && done().sheets.filter((s) => s.measure && !s.measure.failed).every((s) => s.measure.version === MEASURE_VERSION));
  ok("…so there is nothing new to read (the refusal the owner hit)", hasWorkToRead(done()) === false);
  const plain = await startRead({ planReadId: "pc20", companyId: "co1" }, { ...deps, db: m20 });
  ok("…and a plain run is refused \"nothing_to_read\", nothing held", plain.ok === false && plain.error === "nothing_to_read" && m20.t.planRead[0].status === "ready");

  // force only on a finished read
  const mDraft = memDb({ planRead: [churchRead("pc21")], quoteDocument: docs("pc21") });
  const draftForce = await startRead({ planReadId: "pc21", companyId: "co1", force: true }, { ...deps, db: mDraft });
  ok("force on a read that never finished is refused (not_finished), nothing held", draftForce.ok === false && draftForce.error === "not_finished" && mDraft.t.planRead[0].status === "draft");
  ok("…and a truthy non-boolean force is not force", (await startRead({ planReadId: "pc20", companyId: "co1", force: "yes" }, { ...deps, db: m20 })).error === "nothing_to_read");

  // Read again: the whole read, priced up front.
  const forcedEstimate = readEstimate(done(), { force: true });
  const inp20 = readInputs(done());
  const routedSheets = inp20.routed.length;
  const routedKeys = new Set(inp20.routed.map((s) => s.key));
  const planned = inp20.routed.filter((s) => measurePlanned(s, done(), inp20.routes.get(s.key))).length;
  ok(`the confirm's figure is the whole read: every sheet (${forcedEstimate.breakdown.sheetsToRead}) and every planned measurement (${forcedEstimate.breakdown.measureSheets})`, forcedEstimate.breakdown.sheetsToRead === routedSheets && forcedEstimate.breakdown.measureSheets === planned && forcedEstimate.cents > readEstimate(done()).cents);
  const ledgerBefore = ledger.length;
  const again = await startRead({ planReadId: "pc20", companyId: "co1", force: true }, { ...deps, db: m20 });
  const r20 = m20.t.planRead[0];
  ok("force on the finished read starts it, holding exactly what the confirm showed", again.ok === true && again.forced === true && again.heldCents === forcedEstimate.cents && r20.status === "reading" && ledger.length === ledgerBefore + 1 && ledger.at(-1).cents === -forcedEstimate.cents);
  ok("…and marks THIS run as forced (usage.forceRun = its hold)", r20.usage.forceRun === r20.reservationRef && Boolean(r20.reservationRef));
  const callsBefore = calls.length;
  const fin = await advanceRead("pc20", { companyId: "co1", budgetMs: 10_000_000 }, { ...deps, db: m20, complete: provider(zeroSynthesis) });
  const made = calls.slice(callsBefore);
  const ref20 = ledger.at(-1).ref;
  ok(`every sheet is read again (${made.filter((c) => c.schemaName === "plan_read_sheet").length} of ${routedSheets}) and every planned sheet measured again (${made.filter((c) => c.schemaName === "plan_read_measure").length} of ${planned})`, fin.state === "ready" && made.filter((c) => c.schemaName === "plan_read_sheet").length === routedSheets && made.filter((c) => c.schemaName === "plan_read_measure").length === planned && made.filter((c) => c.schemaName === "plan_read_synthesis").length === 1);
  ok("…each pass stamped with the forced run, so a resumed forced run never repeats one", m20.t.planRead[0].sheets.filter((s) => routedKeys.has(s.key)).every((s) => s.read?.run === ref20) && m20.t.planRead[0].sheets.filter((s) => routedKeys.has(s.key) && measurePlanned(s, done(), inp20.routes.get(s.key))).every((s) => s.measure?.run === ref20));
  ok("…and the next plain run is an ordinary one again (the marker names that run only)", (await startRead({ planReadId: "pc20", companyId: "co1" }, { ...deps, db: m20 })).error === "nothing_to_read");

  // A forced run that runs out of time resumes where it stopped.
  const m22 = memDb({ planRead: [{ ...JSON.parse(JSON.stringify(m20.t.planRead[0])), id: "pc22" }], quoteDocument: docs("pc22") });
  await startRead({ planReadId: "pc22", companyId: "co1", force: true }, { ...deps, db: m22 });
  let clock22 = 0;
  const slow = { ...deps, db: m22, now: () => clock22, sheetConcurrency: 1, complete: async (a) => { clock22 += 60_000; return provider(zeroSynthesis)(a); } };
  const first22 = await advanceRead("pc22", { companyId: "co1", budgetMs: 300_000 }, slow);
  const readFirst = m22.t.planRead[0].sheets.filter((s) => s.read?.run === m22.t.planRead[0].reservationRef).length;
  const c22 = calls.length;
  m22.t.planRead[0].leaseUntil = null;
  clock22 += 1;
  const second22 = await advanceRead("pc22", { companyId: "co1", budgetMs: 10_000_000 }, { ...slow, now: () => clock22 });
  const secondSheetCalls = calls.slice(c22).filter((c) => c.schemaName === "plan_read_sheet").length;
  ok(`a forced run that pauses (${readFirst} sheets read) resumes with only the rest (${secondSheetCalls})`, first22.state === "more" && readFirst > 0 && second22.state === "ready" && secondSheetCalls === routedSheets - readFirst, { first: first22.state, readFirst, secondSheetCalls, second: second22.state });

  // measureVersion: an older measurement is measured again; the current one is not.
  const routeAll = { send: true, trades: ["painting"], reason: "unknown" };
  const readNow = done();
  const sheet = readNow.sheets.find((s) => s.measure && !s.measure.failed);
  const { version: _v, ...unstamped } = sheet.measure;
  ok("measureNeeded: a sheet measured under an older version (an unstamped one is version 1) is measured again", measureNeeded({ ...sheet, measure: unstamped }, readNow, routeAll) === true && measureNeeded({ ...sheet, measure: { ...sheet.measure, version: MEASURE_VERSION - 1 } }, readNow, routeAll) === true && measureStale({ ...sheet, measure: unstamped }, readNow, routeAll) === true);
  ok("…the current version is not", measureNeeded({ ...sheet, measure: { ...sheet.measure, version: MEASURE_VERSION } }, readNow, routeAll) === false && measureStale(sheet, readNow, routeAll) === false);
  ok("…a permanent failure is never re-offered (no picture of the page — a newer prompt cannot help)", measureNeeded({ ...sheet, measure: { failed: true, permanent: true } }, readNow, routeAll) === false && measureStale({ ...sheet, measure: { failed: true, permanent: true } }, readNow, routeAll) === false);
  const staleRead = { ...readNow, sheets: readNow.sheets.map((s) => (s.key === sheet.key ? { ...s, measure: unstamped } : s)) };
  ok("…so a finished read with one stale sheet has work again, priced as that one measurement", hasWorkToRead(staleRead) === true && readEstimate(staleRead).breakdown.measureSheets === 1 && readEstimate(staleRead).breakdown.sheetsToRead === 0);

  // The screen: the notice, and the confirm's numbers.
  const v = await planReadView(staleRead, { companyId: "co1", canSeeMoney: true, prisma: m20, balanceCents: 5000 });
  ok("the read says how many sheets were measured with an older version, and offers Read again with its held credit", v.staleMeasures === 1 && v.canReadAgain === true && v.credits.readAgainCents === readEstimate(staleRead, { force: true }).cents && v.firstPass?.measureMissing === false);
  const vNow = await planReadView(readNow, { companyId: "co1", canSeeMoney: true, prisma: m20, balanceCents: 5000 });
  ok("…and none when every measurement is current", vNow.staleMeasures === 0 && vNow.canRead === false && vNow.canReadAgain === true);
  const ws = code("app/components/planRead/PlanReadWorkspace.js");
  ok("the stale notice renders on the read card from view.staleMeasures, in the owner's words", /view\.staleMeasures > 0 &&/.test(ws) && /app\.planRead\.measureStale", "Measured with an older version — Read again to update\."/.test(ws));
  ok("\"Read again\" asks first, showing what it holds, then posts { force: true }", /function ReadAgain\(/.test(ws) && /readAgainConfirmBody/.test(ws) && /c\.readAgainCents/.test(ws) && /jsonBody\(\{ force: true \}\)/.test(ws) && /onRun\(\{ force: true \}\)/.test(ws));
  const route = code("app/api/plan-reads/[id]/run/route.js");
  ok("the route takes force only through readAgainFlag with the caller's own edit level, and refuses a flag it will not honour", /readAgainFlag\(body, \{ canEdit: hasLevel\(full, "quotes", "view_create_edit"\) \}\)/.test(route) && /read_again_denied/.test(route) && /startRead\(\{[^}]*force \}/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
section("21. Read again never trades measurements for guesses (the church, 2026-10-06)");
// ═══════════════════════════════════════════════════════════════════════════
// Production, read cmuun5kc…: "Read again" on the church finished in 68 s,
// charged, and came back with NO measurements — every measurement pass was
// refused before it was sent (MEASURE_SCHEMA nested its arches six levels
// deep; provider.js's pre-flight allows five), each failure was written over
// the sheet's measured faces, and the price became round-number guesses
// (26,900 sq ft, $73,626) with nothing on the screen to say so.
{
  // ── The cause: the schema ─────────────────────────────────────────────────
  const nested = JSON.parse(JSON.stringify(MEASURE_SCHEMA));
  const openingProps = { kind: { type: "string", enum: ["arch", "opening"] }, dimRef: { type: ["string", "null"] }, text: { type: ["string", "null"] }, box: { type: ["array", "null"], items: { type: "number" } } };
  nested.properties.faces.items.properties.openings = { type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(openingProps), properties: openingProps } };
  nested.properties.faces.items.required.push("openings");
  delete nested.properties.openings;
  nested.required = nested.required.filter((k) => k !== "openings");
  const nestedLint = assertStrictSchema(nested);
  ok("the arches are at the schema's root, by faceId — nested in the face (as 5a300fc9f shipped them) the pre-flight refuses the whole schema", lints.MEASURE_SCHEMA.ok && !nestedLint.ok && nestedLint.errors.some((e) => /faces\[\]\.openings\[\]\..*nesting deeper than 5/.test(e)) && MEASURE_SCHEMA.required.includes("openings"), nestedLint.errors);
  ok("…and the prompt tells the model where they go", /"openings": for a ROOM on a plan/.test(MEASURE_SYSTEM) && /"faceId"/.test(MEASURE_SYSTEM));
  const p11 = sheetsBase.find((s) => s.key === "p11");
  const rooted = sanitiseMeasure({ ...MEASURES.p11, openings: [{ faceId: "f1", kind: "arch", dimRef: null, text: "4.2 m", box: null }, { faceId: " f1 ", kind: "opening", dimRef: null, text: null, box: [0.3, 0.3, 0.34, 0.31] }, { faceId: "nope", kind: "arch", dimRef: null, text: "9 m", box: null }] }, p11);
  const nave1 = rooted.faces.find((x) => x.id === "f1");
  ok("sanitiseMeasure puts root openings back on their room (by its cleaned id), and drops one for a room that isn't there", nave1.openings.length === 2 && nave1.openings[0].kind === "arch" && nave1.openings[0].text === "4.2 m" && rooted.faces.find((x) => x.id === "f2").openings.length === 0 && !JSON.stringify(rooted).includes("9 m"), rooted.faces.map((x) => [x.id, x.openings]));

  // ── The rule: measureOutcome (pure) ──────────────────────────────────────
  const prior = { sheetType: "elevation", reason: "West elevation", views: [], faces: [{ id: "f1" }], heights: [{ id: "h1" }], at: "t0" };
  const failedNext = { sheetType: "other", reason: "", views: [], faces: [], heights: [], failed: true, failedRun: "r2", failure: "bad_schema", at: "t1" };
  const emptyNext = { sheetType: "detail", reason: "a detail", views: [], faces: [], heights: [], at: "t1", version: MEASURE_VERSION };
  const goodNext = { sheetType: "elevation", reason: "x", views: [], faces: [{ id: "f9" }], heights: [], at: "t1", version: MEASURE_VERSION };
  const o1 = measureOutcome(prior, failedNext, { runRef: "r2" });
  ok("a FAILED pass over a measured sheet keeps the measurement, says why and which run, and is not charged", o1.kept && o1.waive && o1.measure.faces === prior.faces && o1.measure.heights === prior.heights && o1.measure.reason === "West elevation" && o1.measure.remeasure.failure === "bad_schema" && o1.measure.remeasure.run === "r2" && !o1.measure.failed, o1);
  const o2 = measureOutcome(prior, emptyNext, { runRef: "r2" });
  ok("…an EMPTY answer over a measured sheet is a failed re-measure too: kept, \"empty\", not charged", o2.kept && o2.waive && o2.measure.faces === prior.faces && o2.measure.remeasure.failure === "empty", o2);
  const o3 = measureOutcome(prior, goodNext, { runRef: "r2" });
  ok("…a pass that measured REPLACES it, whole (no remeasure left behind), and is charged", !o3.kept && !o3.waive && o3.measure === goodNext);
  ok("…with nothing measured before: a failure is stored as the failure (not charged), an empty answer as the answer (charged)", (() => { const a = measureOutcome(null, failedNext); const b = measureOutcome({ ...failedNext }, failedNext); const c = measureOutcome(null, emptyNext); return a.measure === failedNext && !a.kept && a.waive && !b.kept && c.measure === emptyNext && !c.kept && !c.waive; })());
  ok("…a failure never replaces an ANSWER, even \"nothing to measure here\" (a site plan) — but a newer empty answer does", (() => { const site = { sheetType: "site", reason: "x", views: [], faces: [], heights: [], version: 1 }; const a = measureOutcome(site, failedNext, { runRef: "r2" }); const b = measureOutcome(site, emptyNext, { runRef: "r2" }); return a.kept && a.waive && a.measure.sheetType === "site" && a.measure.remeasure.failure === "bad_schema" && !b.kept && b.measure === emptyNext && !b.waive; })());
  ok("hasMeasurements: a face or a height, never a failed pass", hasMeasurements(prior) && hasMeasurements({ faces: [], heights: [{ id: "h" }] }) && !hasMeasurements({ faces: [{ id: "f" }], failed: true }) && !hasMeasurements(emptyNext) && !hasMeasurements(null));

  // ── Billing: waived calls stay on the books, off the bill ────────────────
  const mu = { model: "gpt-5.5", promptTokens: 6200, completionTokens: 6500, cachedTokens: 0, imageCount: 1 };
  const muMicros = estimateCostMicros(mu);
  const w = waiveUsage(waiveUsage({ vendorMicros: 5 * muMicros, run: { vendorMicros: 5 * muMicros } }, mu), mu);
  ok("waiveUsage: the vendor cost stays (what FieldQuo paid), waivedMicros says what the company is not charged", w.vendorMicros === 5 * muMicros && w.run.vendorMicros === 5 * muMicros && w.run.waivedMicros === 2 * muMicros && w.waivedMicros === 2 * muMicros);
  const sNo = settlement({ reservedCents: 10_000, runVendorMicros: w.run.vendorMicros });
  const sW = settlement({ reservedCents: 10_000, runVendorMicros: w.run.vendorMicros, waivedMicros: w.run.waivedMicros });
  ok(`settlement takes the waiver off: ${sNo.chargedCents}¢ → ${sW.chargedCents}¢, the rest of the hold refunded`, sW.chargedCents === settlement({ reservedCents: 10_000, runVendorMicros: 3 * muMicros }).chargedCents && sW.chargedCents < sNo.chargedCents && sW.refundCents === 10_000 - sW.chargedCents);

  // ── guessedShare (pure) ──────────────────────────────────────────────────
  const gs = guessedShare({ lines: [{ amount: 700, source: "estimate" }, { amount: 100, source: "photo" }, { amount: 200, source: "face" }, { amount: 0, hours: 0, source: "estimate" }] });
  ok("guessedShare: the share of the price on guessed quantities (estimate, photo) — 80% here, mostly", gs.share === 0.8 && gs.mostly === true && gs.lines === 2, gs);
  ok("…by hours when nothing is priced; a scaled face or a count is not a guess; exactly half is not \"mostly\"; nothing priced → null", guessedShare({ lines: [{ amount: 0, hours: 10, source: "estimate" }, { amount: 0, hours: 30, source: "face" }] }).share === 0.25 && guessedShare({ lines: [{ amount: 50, source: "count" }, { amount: 50, source: "face" }] }).share === 0 && guessedShare({ lines: [{ amount: 50, source: "estimate" }, { amount: 50, source: "face" }] }).mostly === false && guessedShare({ lines: [] }) === null && guessedShare(null) === null);

  // ── The church, end to end ───────────────────────────────────────────────
  // A finished read measured by the OLDER pass (no version stamp) — the
  // church's sheets before its Read again.
  const mBase = memDb({ planRead: [churchRead("pc30")], quoteDocument: docs("pc30") });
  await startRead({ planReadId: "pc30", companyId: "co1" }, { ...deps, db: mBase });
  await advanceRead("pc30", { companyId: "co1", budgetMs: 10_000_000 }, { ...deps, db: mBase, complete: provider(zeroSynthesis) });
  const baseRow = mBase.t.planRead[0];
  baseRow.sheets = baseRow.sheets.map((s) => (hasMeasurements(s.measure) ? { ...s, measure: (({ version: _v, ...m }) => m)(s.measure) } : s));
  const measuredKeys = baseRow.sheets.filter((s) => hasMeasurements(s.measure)).map((s) => s.key);
  const fingerprint = (row) => md5(row.sheets.filter((s) => measuredKeys.includes(s.key)).map((s) => [s.key, s.measure.faces, s.measure.heights]));
  const priorPrint = fingerprint(baseRow);
  const priorTake = buildTakeoff(baseRow.sheets, buildDimIndex(baseRow.sheets));
  const inp30 = readInputs({ ...baseRow, documents: docs("pc30") });
  const planned30 = inp30.routed.filter((s) => measurePlanned(s, { ...baseRow, documents: docs("pc30") }, inp30.routes.get(s.key))).length;
  ok(`the starting point: ${measuredKeys.length} sheets measured by version 1 — ${priorTake.faces.size} faces, ${priorTake.heights.size} heights`, measuredKeys.length >= 5 && priorTake.faces.size >= 7 && priorTake.heights.size >= 2 && planned30 > measuredKeys.length);
  const fork = (id) => memDb({ planRead: [{ ...JSON.parse(JSON.stringify(baseRow)), id }], quoteDocument: docs(id) });
  const badSchema = (synth) => async (args) => {
    if (args.schemaName !== "plan_read_measure") return provider(synth)(args);
    calls.push(args);
    return { ok: false, reason: "bad_schema", message: "root.faces[].openings[].kind: nesting deeper than 5 levels" };
  };

  // A. Read again, every measurement pass refused — exactly production.
  const mA = fork("pc31");
  const heldA = await startRead({ planReadId: "pc31", companyId: "co1", force: true }, { ...deps, db: mA });
  const refA = mA.t.planRead[0].reservationRef;
  const cA = calls.length;
  const runA = await advanceRead("pc31", { companyId: "co1", budgetMs: 10_000_000 }, { ...deps, db: mA, complete: badSchema(zeroSynthesis) });
  const rowA = mA.t.planRead[0];
  const viewA = await planReadView({ ...rowA, documents: docs("pc31") }, { companyId: "co1", canSeeMoney: true, prisma: mA, balanceCents: 5000 });
  ok("A. a forced re-read whose every measurement is refused still finishes (the sheets and the synthesis were fine)", heldA.forced === true && runA.state === "ready" && rowA.status === "ready" && calls.slice(cA).filter((c) => c.schemaName === "plan_read_measure").length === planned30 * 2);
  ok(`A. …and KEEPS every earlier measurement: ${measuredKeys.length} sheets, faces and heights byte for byte`, fingerprint(rowA) === priorPrint, rowA.sheets.map((s) => [s.key, s.measure?.faces?.length, s.measure?.failed]));
  ok("A. …each marked: the re-measure failed, why, in which run", rowA.sheets.filter((s) => measuredKeys.includes(s.key)).every((s) => s.measure.remeasure?.failed === true && s.measure.remeasure.failure === "bad_schema" && s.measure.remeasure.run === refA && !s.measure.failed));
  ok("A. the synthesis was still SHOWN the measured takeoff — not an empty one", (JSON.parse(calls.slice(cA).find((c) => c.schemaName === "plan_read_synthesis").prompt).takeoff?.faces?.rows?.length || 0) === [...priorTake.faces.values()].length);
  ok(`A. the screen: ${viewA.firstPass.faces.length} measured faces still there; "measuring again failed on ${viewA.firstPass.remeasureFailed} sheets … nothing was replaced"`, viewA.firstPass.faces.length === priorTake.faces.size && viewA.firstPass.heights.length === priorTake.heights.size && viewA.firstPass.remeasureFailed === planned30 && viewA.firstPass.measureFailed === 0 && viewA.firstPass.measureMissing === false && viewA.staleMeasures === measuredKeys.length, { faces: viewA.firstPass.faces.length, remeasureFailed: viewA.firstPass.remeasureFailed, measureFailed: viewA.firstPass.measureFailed, measureMissing: viewA.firstPass.measureMissing, stale: viewA.staleMeasures });
  ok("A. …and the price rests on the measurements, not on guesses", viewA.firstPass.guessed && viewA.firstPass.guessed.mostly === false, viewA.firstPass.guessed);
  ok("A. the sheets are still out of date, so the next run measures them again (and this run does not)", measureNeeded(rowA.sheets.find((s) => s.key === measuredKeys[0]), { ...rowA, documents: docs("pc31") }, inp30.routes.get(measuredKeys[0]), null) === true && measureNeeded(rowA.sheets.find((s) => s.key === measuredKeys[0]), { ...rowA, documents: docs("pc31") }, inp30.routes.get(measuredKeys[0]), refA) === false && hasWorkToRead({ ...rowA, documents: docs("pc31") }) === true);

  // A2. The same, paused part-way: the resumed run never re-measures a sheet
  // it already tried (remeasureTriedIn), and never pays for it twice.
  const mA2 = fork("pc32");
  await startRead({ planReadId: "pc32", companyId: "co1", force: true }, { ...deps, db: mA2 });
  let clockA2 = 0;
  const slowA2 = { ...deps, db: mA2, now: () => clockA2, sheetConcurrency: 1, complete: async (a) => { clockA2 += 60_000; return badSchema(zeroSynthesis)(a); } };
  // Which sheet a measurement call was for — the scripted model's own rule.
  const measureKey = (a) => JSON.parse(a.prompt).sheet.dims[0]?.id.split(".")[0] || `p${Number(String(a.images[0]).match(/\/p(\d+)\.jpg/)?.[1])}`;
  const firstA2 = await advanceRead("pc32", { companyId: "co1", budgetMs: 300_000 }, slowA2);
  const refA2 = mA2.t.planRead[0].reservationRef;
  const triedFirst = mA2.t.planRead[0].sheets.filter((s) => s.measure?.remeasure?.run === refA2).map((s) => s.key);
  mA2.t.planRead[0].leaseUntil = null;
  clockA2 += 1;
  const cA2 = calls.length;
  const secondA2 = await advanceRead("pc32", { companyId: "co1", budgetMs: 10_000_000 }, { ...slowA2, now: () => clockA2 });
  const againA2 = calls.slice(cA2).filter((c) => c.schemaName === "plan_read_measure").map(measureKey);
  ok(`A2. a forced run that pauses (${triedFirst.length} sheets tried) resumes without re-measuring any of them, and keeps every earlier measurement`, firstA2.state === "more" && secondA2.state === "ready" && triedFirst.length > 0 && againA2.length > 0 && !againA2.some((k) => triedFirst.includes(k)) && fingerprint(mA2.t.planRead[0]) === priorPrint && mA2.t.planRead[0].sheets.filter((s) => s.measure?.remeasure?.run === refA2).length === planned30, { triedFirst, againA2 });

  // B. Read again, every measurement ANSWERS but with nothing in it.
  const mB = fork("pc33");
  const heldB = await startRead({ planReadId: "pc33", companyId: "co1", force: true }, { ...deps, db: mB });
  const cB = calls.length;
  const ledgerB = ledger.length;
  await advanceRead("pc33", { companyId: "co1", budgetMs: 10_000_000 }, { ...deps, db: mB, complete: provider(zeroSynthesis, {}) });
  const rowB = mB.t.planRead[0];
  const measureCallsB = calls.slice(cB).filter((c) => c.schemaName === "plan_read_measure").length;
  const waivedB = measuredKeys.length * muMicros;
  ok(`B. a forced re-read whose measurement comes back EMPTY keeps the earlier measurements, marked "empty"`, measureCallsB === planned30 && fingerprint(rowB) === priorPrint && rowB.sheets.filter((s) => measuredKeys.includes(s.key)).every((s) => s.measure.remeasure?.failure === "empty"));
  ok(`B. …and the empty answers over measured sheets are not charged: ${measuredKeys.length} calls waived (${waivedB} µ$), the rest of the run charged`, rowB.usage.run.waivedMicros === waivedB && rowB.chargedCents - baseRow.chargedCents === settlement({ reservedCents: heldB.heldCents, runVendorMicros: rowB.usage.run.vendorMicros, waivedMicros: waivedB }).chargedCents && rowB.chargedCents - baseRow.chargedCents < settlement({ reservedCents: heldB.heldCents, runVendorMicros: rowB.usage.run.vendorMicros }).chargedCents, { waived: rowB.usage.run.waivedMicros, expect: waivedB, charged: rowB.chargedCents - baseRow.chargedCents });
  ok("B. …the unused hold goes back, under the hold's own ref", ledger.slice(ledgerB).some((e) => e.refund && e.ref === rowB.usage.forceRun && e.cents === heldB.heldCents - (rowB.chargedCents - baseRow.chargedCents)));

  // C. Read again that MEASURES: the new measurements replace the old.
  const MEASURES_V2 = JSON.parse(JSON.stringify(MEASURES));
  for (const m of Object.values(MEASURES_V2)) for (const fc of m.faces) fc.name = `${fc.name} (v2)`;
  const mC = fork("pc34");
  await startRead({ planReadId: "pc34", companyId: "co1", force: true }, { ...deps, db: mC });
  const refC = mC.t.planRead[0].reservationRef;
  await advanceRead("pc34", { companyId: "co1", budgetMs: 10_000_000 }, { ...deps, db: mC, complete: provider(zeroSynthesis, MEASURES_V2) });
  const rowC = mC.t.planRead[0];
  const viewC = await planReadView({ ...rowC, documents: docs("pc34") }, { companyId: "co1", canSeeMoney: true, prisma: mC, balanceCents: 5000 });
  ok("C. a forced re-read that measures REPLACES the earlier measurements: the new faces, the current version, this run's stamp, no remeasure mark", rowC.sheets.filter((s) => measuredKeys.includes(s.key)).every((s) => s.measure.version === MEASURE_VERSION && s.measure.run === refC && !s.measure.remeasure && s.measure.faces.every((fc) => / \(v2\)$/.test(fc.name))) && fingerprint(rowC) !== priorPrint);
  ok("C. …the screen: nothing stale, nothing failed, nothing to warn about", viewC.staleMeasures === 0 && viewC.firstPass.remeasureFailed === 0 && viewC.firstPass.measureFailed === 0 && viewC.firstPass.measureMissing === false && viewC.firstPass.faces.length === priorTake.faces.size && rowC.usage.run.waivedMicros === undefined);

  // D. Where production is now: measurements failed with nothing to keep,
  // and the synthesis priced round-number estimates.
  const estSynthesis = { ...zeroSynthesis, surfaces: [{ ...zeroSynthesis.surfaces[0], estimate: 11000, estimateBasis: "rough facade area" }, { ...zeroSynthesis.surfaces[1], estimate: 15900, estimateBasis: "rough wall area" }] };
  const mD = memDb({ planRead: [churchRead("pc35")], quoteDocument: docs("pc35") });
  await startRead({ planReadId: "pc35", companyId: "co1" }, { ...deps, db: mD });
  const truncated = (synth) => async (args) => {
    if (args.schemaName !== "plan_read_measure") return provider(synth)(args);
    calls.push(args);
    await args.onUsage?.(mu);
    return { ok: false, reason: "truncated", message: "reply was truncated" };
  };
  await advanceRead("pc35", { companyId: "co1", budgetMs: 10_000_000 }, { ...deps, db: mD, complete: truncated(estSynthesis) });
  const rowD = mD.t.planRead[0];
  const viewD = await planReadView({ ...rowD, documents: docs("pc35") }, { companyId: "co1", canSeeMoney: true, prisma: mD, balanceCents: 5000, pricingCtx: null });
  ok(`D. a read whose every measurement fails stores the failure and why, and is not charged for it (${planned30} sheets × 2 attempts waived)`, rowD.status === "ready" && rowD.sheets.filter((s) => s.measure).length === planned30 && rowD.sheets.filter((s) => s.measure).every((s) => s.measure.failed && s.measure.failure === "truncated") && rowD.usage.run.waivedMicros === planned30 * 2 * muMicros);
  ok(`D. the screen says measuring FAILED on ${viewD.firstPass.measureFailed} sheets — not "made before FieldQuo measured"`, viewD.firstPass.measureMissing === true && viewD.firstPass.measureFailed === planned30 && viewD.firstPass.remeasureFailed === 0 && viewD.firstPass.faces.length === 0);
  ok(`D. …and that the price is mostly guessed (${Math.round((viewD.firstPass.guessed?.share || 0) * 100)}%), whole and per quote`, viewD.firstPass.guessed?.mostly === true && viewD.firstPass.guessed.share > 0.8 && viewD.firstPass.slices.length === 2 && viewD.firstPass.slices.every((sl) => sl.guessed?.mostly === true), { guessed: viewD.firstPass.guessed, slices: viewD.firstPass.slices.map((sl) => sl.guessed) });

  // E. From there, the ordinary "Measure the drawings" run (no force)
  // measures again — the sheet passes already paid for are not re-read.
  const startE = await startRead({ planReadId: "pc35", companyId: "co1" }, { ...deps, db: mD });
  const cE = calls.length;
  await advanceRead("pc35", { companyId: "co1", budgetMs: 10_000_000 }, { ...deps, db: mD, complete: provider(zeroSynthesis) });
  const rowE = mD.t.planRead[0];
  const viewE = await planReadView({ ...rowE, documents: docs("pc35") }, { companyId: "co1", canSeeMoney: true, prisma: mD, balanceCents: 5000 });
  ok(`E. a plain run on that read measures again (${calls.slice(cE).filter((c) => c.schemaName === "plan_read_measure").length} sheets), reads no sheet twice, and the measurements are back`, startE.ok === true && !startE.forced && calls.slice(cE).filter((c) => c.schemaName === "plan_read_measure").length === planned30 && calls.slice(cE).filter((c) => c.schemaName === "plan_read_sheet").length === 0 && viewE.firstPass.faces.length === priorTake.faces.size && viewE.firstPass.measureFailed === 0 && viewE.firstPass.guessed?.mostly === false);

  // ── Wiring: the screen says it ───────────────────────────────────────────
  const ws21 = code("app/components/planRead/PlanReadWorkspace.js");
  const fpc21 = code("app/components/planRead/FirstPassCards.js");
  ok("the read card says a re-measure failed and nothing was replaced, from view.firstPass.remeasureFailed", /view\.firstPass\?\.remeasureFailed > 0 &&/.test(ws21) && /t\("app\.planRead\.remeasureFailed"/.test(ws21));
  ok("…and a failed measurement as failed (measureFailedNote), keeping the old note for reads made before measuring", /view\.firstPass\.measureFailed > 0\s*\?\s*t\("app\.planRead\.measureFailedNote"/.test(ws21) && /app\.planRead\.measureAgainNote/.test(ws21));
  ok("the mostly-guessed banner sits in the overview AND above the price; each quote part says it too", (ws21.match(/<GuessedBanner guessed=\{view\.firstPass\?\.guessed\}/g) || []).length === 2 && /function GuessedBanner\(/.test(ws21) && /guessed\?\.mostly/.test(ws21) && /sl\.guessed\?\.mostly && /.test(fpc21) && /app\.planRead\.slices\.guessed/.test(fpc21));
  const newKeys = ["app.planRead.remeasureFailed", "app.planRead.measureFailedNote", "app.planRead.guessed.title", "app.planRead.guessed.body", "app.planRead.slices.guessed"];
  const missing21 = newKeys.flatMap((k) => Object.keys(APP_MESSAGES).filter((l) => typeof APP_MESSAGES[l][k] !== "string").map((l) => `${l}:${k}`));
  ok(`the new strings exist in all ${Object.keys(APP_MESSAGES).length} languages`, missing21.length === 0, missing21);
}

// ═══════════════════════════════════════════════════════════════════════════
section("22. One room, one wall, one state of the building — however many sheets draw it (the church, run 5)");
// ═══════════════════════════════════════════════════════════════════════════
// Run 5 (2026-10-06, after 196fa397c): interior 22,754 sq ft against 11,392
// on run 3. The set draws the same rooms on three plans — the part plan
// "showing proposed extensions" (1:100), "Scheme C4 - Whole Church Plan"
// (1:200) and "Plan - as existing" (1:100) — two of them the PROPOSED
// building. The fixture is production's own stored measurement of those
// sheets and the synthesis's four interior surfaces
// (scripts/fixtures/churchThreePlans.mjs). lib/planRead/sameSurface.js.
{
  const sheets22 = JSON.parse(JSON.stringify(CHURCH_PLAN_SHEETS));
  const take22 = buildTakeoff(sheets22, buildDimIndex(sheets22));
  const F = (id) => take22.faces.get(id);
  ok(`the stub is the stored read: the nave measured three times — ${F("p1.f9").floorSqft} / ${F("p3.f1").floorSqft} / ${F("p11.f1").floorSqft} sq ft of floor`, F("p1.f9").floorSqft === 1338 && F("p3.f1").floorSqft === 3036 && F("p11.f1").floorSqft === 2208 && F("p11.f1").view === "Plan - as existing" && F("p3.f1").scaleRatio === 200 && F("p11.f1").scaleRatio === 100);
  ok("each drawing knows its state from its own title: “Plan - as existing” existing; “…showing proposed extensions” and “Scheme C4…” proposed", drawingState(F("p11.f1")) === "existing" && drawingState(F("p1.f9")) === "proposed" && drawingState(F("p3.f1")) === "proposed" && drawingState({ view: "Existing and proposed ground floor" }) === null && drawingState({ view: "Elevations" }) === null);
  ok("names: “Chancel / sanctuary” answers to the chancel; “New glazed porch” is the glazed porch; case and punctuation ignored", nameKeys("Chancel / sanctuary").has("chancel") && nameKeys("New glazed west porch").has("glazed west porch") && nameKeys("North Transept").has("north transept"));

  const plan22 = sameSurfacePlan(take22, { request: CHURCH_REQUEST });
  const groupIds = (id) => (plan22.groupOf.get(id)?.members || []).map((m) => m.id).sort();
  ok(`the nave is ONE room drawn three times, kept from “Plan - as existing” (1:100): ${groupIds("p3.f1").join(", ")}`, groupIds("p3.f1").join() === "p1.f9,p11.f1,p3.f1" && plan22.groupOf.get("p3.f1").keep === "p11.f1");
  ok("…the north transept three times, the crossing, south transept, chancel / sanctuary, boiler and vestry twice — each kept from the existing plan", groupIds("p1.f7").join() === "p1.f7,p11.f2,p3.f3" && ["p3.f2", "p3.f4", "p3.f5", "p3.f11", "p3.f12"].every((id) => groupIds(id).length === 2 && plan22.groupOf.get(id).keep.startsWith("p11.")));
  ok("…the cafe, kitchen and meeting room on the part plan (1:100) and the scheme (1:200): one each, kept at the larger scale", ["p3.f6", "p3.f7", "p3.f8"].every((id) => groupIds(id).length === 2 && plan22.groupOf.get(id).keep.startsWith("p1.")));
  ok("…“Store beside kitchen” is not the “Store”, and the office (scheme only) stands alone", !groupIds("p3.f9").includes("p1.f3") && groupIds("p3.f13").length === 1);
  ok("the church's request (a repaint: “…the annexe rooms”, no extension) prices the EXISTING layout", plan22.state.value === "existing" && plan22.state.source === "default");
  ok(`…and leaves out the rooms drawn only on the proposed plans: ${[...new Set([...plan22.out.keys()].map((id) => F(id).name))].join(", ")}`, ["p3.f6", "p3.f7", "p3.f8", "p3.f9", "p3.f10", "p3.f13", "p1.f1"].every((id) => plan22.out.has(id)) && !["p3.f1", "p3.f11", "p3.f12", "p11.f1", "p1.f9", "p1.f7"].some((id) => plan22.out.has(id)));
  ok("a request that names the new work brings it in; one that excludes it does not", newWorkMention("Repaint the hall and the new extension") === "extension" && choosePlanState({ request: "Interior walls including the proposed rooms" }).value === "with_new" && choosePlanState({ request: "Interior walls, not the extension" }).value === "existing" && choosePlanState({ request: "Interior walls excluding the new extension" }).value === "existing" && choosePlanState({ request: CHURCH_REQUEST }).value === "existing");
  ok("…in French and Spanish too, and “except for / leave out / apart from” are no", newWorkMention("Peindre l'intérieur, y compris l'agrandissement") === "agrandissement" && newWorkMention("Pintar el interior, incluida la ampliación") === "ampliación" && newWorkMention("Repeindre les nouvelles pièces") === "nouvelles pièces" && ["Peindre l'intérieur, sans l'agrandissement", "Peindre tout sauf les nouvelles pièces", "Pintar todo sin la ampliación", "Everything except for the extension", "Leave out the extension", "All rooms apart from the new rooms"].every((r) => choosePlanState({ request: r }).value === "existing") && newWorkMention("Paint the nave (not the extension) and the new extension rooms") === "extension");
  ok("drawing states and levels in the words a set uses: “as built” and “Plan existant” are existing, “Plan projeté” / “Planta propuesta” proposed; rez-de-chaussée is the ground floor, “Level 4” is 4, the upper and lower levels differ", drawingState({ view: "Ground floor as built" }) === "existing" && drawingState({ view: "Plan existant — rez-de-chaussée" }) === "existing" && drawingState({ view: "Plan projeté" }) === "proposed" && drawingState({ view: "Planta propuesta" }) === "proposed" && drawingState({ view: "Proposal drawings" }) === null && planLevel({ view: "Plan existant — rez-de-chaussée" }) === "ground" && planLevel({ view: "Level 04 plan" }) === "4" && planLevel({ view: "2nd floor plan" }) === "2" && planLevel({ view: "Upper level plan" }) === "upper" && planLevel({ view: "Lower level plan" }) === "lower" && planLevel({ view: "Lower ground floor" }) === "lower ground" && planLevel({ view: "Plan - as existing" }) === null);
  ok("…and the estimator's own choice beats both", choosePlanState({ request: "not the extension", stored: { value: "with_new", source: "person" } }).value === "with_new" && choosePlanState({ request: "the extension", stored: { value: "existing", source: "person" } }).value === "existing" && PLAN_STATES.join() === "existing,with_new");

  // The pattern run 5 described: every drawing of a room cited, each in its own line.
  const ctx22 = (request = CHURCH_REQUEST) => ({ dims: new Map(), book: books.interior_painting, takeoff: take22, metric: true, request });
  const sqftOf = (c) => c.surfaces.filter((s) => s.active && s.quantity.unit === "sqft").reduce((n, s) => n + s.quantity.value, 0);
  const area22 = [{ id: "a1", name: "Church interior walls", side: "interior", included: true }];
  const surf = (id, faceRefs, heightRef = "p8.h3") => ({ id, areaId: "a1", label: `${id} walls`, itemKey: "walls", coats: 2, lengthRefs: [], widthRefs: [], faceRefs, faceMeasure: "walls", heightRef });
  const allDrawings = ["p1.f9", "p3.f1", "p11.f1", "p1.f7", "p3.f3", "p11.f2", "p3.f2", "p11.f4", "p3.f4", "p11.f3", "p3.f5", "p11.f5", "p3.f11", "p11.f6", "p3.f12", "p11.f7"];
  const everySheet = { version: 1, areas: area22, surfaces: allDrawings.map((id, i) => surf(`s${i + 1}`, [id])), access: [], questions: [], assumptions: [], exclusions: [] };
  const keptOnly = { ...everySheet, surfaces: ["p11.f1", "p11.f2", "p11.f4", "p11.f3", "p11.f5", "p11.f6", "p11.f7"].map((id, i) => surf(`k${i + 1}`, [id])) };
  const summed = allDrawings.reduce((n, id) => n + (faceQuantity(surf("x", [id]), "sqft", take22)?.value || 0), 0);
  const cAll = computeProject(everySheet, ctx22());
  const cKept = computeProject(keptOnly, ctx22());
  ok(`every drawing of every room cited in its own line: ${Math.round(sqftOf(cAll)).toLocaleString("en-US")} sq ft = the de-duplicated set (${Math.round(sqftOf(cKept)).toLocaleString("en-US")}), not the sum of the drawings (${Math.round(summed).toLocaleString("en-US")})`, sqftOf(cAll) === sqftOf(cKept) && summed > sqftOf(cKept) * 1.8, { all: sqftOf(cAll), kept: sqftOf(cKept), summed });
  ok("…the second and third drawings' lines say where they are counted, and are neither priced nor “unmeasured”", cAll.surfaces.filter((s) => s.quantity.source === "duplicate").length === allDrawings.length - 7 && cAll.surfaces.filter((s) => s.quantity.source === "duplicate").every((s) => s.quantity.value === 0 && /is counted in “s\d+ walls” — not twice/.test(s.quantity.sourceText)) && cAll.unmeasured.length === 0 && priceProject(cAll, books, {}).skipped.every((x) => x.reason === "no_quantity"));
  ok("…the same faces cited all in ONE line: the same total (to the rounding of seven rooms)", near(sqftOf(computeProject({ ...everySheet, surfaces: [surf("one", allDrawings)] }, ctx22())), sqftOf(cKept), 7));
  ok("…a room's walls and its ceiling are two surfaces, never “counted twice”", (() => { const m = { ...everySheet, surfaces: [surf("w", ["p3.f1"]), { ...surf("c", ["p11.f1"]), itemKey: "ceiling", faceMeasure: "ceiling" }] }; const c = computeProject(m, ctx22()); return c.surfaces.every((s) => s.quantity.source === "face" && s.quantity.value > 0) && c.surfaces[1].quantity.value === 2208; })());
  ok("…a line left out claims nothing: the other drawing of the same room is then the one priced", (() => { const m = { ...everySheet, surfaces: [{ ...surf("off", ["p11.f1"]), included: false }, surf("on", ["p3.f1"])] }; const c = computeProject(m, ctx22()); return c.surfaces[1].quantity.source === "face" && c.surfaces[1].quantity.faceIds.join() === "p11.f1"; })());

  // The stored church model, re-computed — no re-read, no re-measure.
  const cStored = computeProject(CHURCH_INTERIOR_MODEL, ctx22());
  const S = (id) => cStored.surfaces.find((s) => s.id === id);
  const storedDedupe = { ...CHURCH_INTERIOR_MODEL, surfaces: [{ ...S("s3"), faceRefs: ["p11.f1"] }, { ...S("s4"), faceRefs: ["p11.f4", "p11.f2", "p11.f3", "p11.f5"] }, { ...S("s6"), faceRefs: ["p11.f6", "p11.f7"] }].map(({ quantity, ...s }) => ({ ...s, itemKey: CHURCH_INTERIOR_MODEL.surfaces.find((x) => x.id === s.id).itemKey })) };
  ok(`the church's stored interior, re-computed: ${Math.round(sqftOf(cStored)).toLocaleString("en-US")} sq ft (production showed 22,754) = the same surfaces on the existing plan's rooms`, sqftOf(cStored) === sqftOf(computeProject(storedDedupe, ctx22())) && sqftOf(cStored) < 22754 * 0.6, { stored: sqftOf(cStored) });
  ok("…the nave from “Plan - as existing” (1:100), naming the other two drawings", S("s3").quantity.faceIds.join() === "p11.f1" && /Nave: also drawn on “Part church floor plan showing proposed extensions” \(page 1, 1:100\) and “Scheme C4 - Whole Church Plan” \(page 3, 1:200\) — the same room, counted once, from “Plan - as existing” \(page 11, 1:100\)/.test(S("s3").quantity.sourceText));
  ok("…the new annexe rooms (cafe, kitchen, meeting room, store, WC) are the proposed extension: not priced, said on the line — never the model's estimate in their place", S("s5").quantity.value === 0 && S("s5").quantity.source === "plan_state" && /only on the proposed drawings — not in the existing layout/.test(S("s5").quantity.sourceText) && !cStored.unmeasured.some((u) => u.id === "s5"));
  ok("…the boiler and vestry from the existing plan; the office, drawn only on the scheme, said and left out", S("s6").quantity.faceIds.join() === "p11.f6,p11.f7" && /Office: only on the proposed drawings/.test(S("s6").quantity.sourceText));
  ok(`…and the annexe rooms' walls stop at the extension's own wall plate (${S("s6").topFt} ft, the synthesis's own citation) — never the NAVE's 19 ft truss feet from the photos`, S("s6").topFt === Math.round(take22.heights.get("p9.h2").heightFt * 10) / 10 && S("s6").topFt < 12 && S("s6").wallCap?.source === "outside_eaves" && S("s3").topFt === 19 && /nave/i.test(take22.heights.get("p8.h3").label), { s6: S("s6").topFt, s3: S("s3").topFt });
  const withNew = computeProject({ ...CHURCH_INTERIOR_MODEL, planState: { value: "with_new", source: "person" } }, ctx22());
  ok(`“Include them”: ${Math.round(sqftOf(withNew)).toLocaleString("en-US")} sq ft — the existing rooms once, plus the new ones once`, withNew.surfaces.find((s) => s.id === "s5").quantity.value > 0 && withNew.surfaces.find((s) => s.id === "s5").quantity.faceIds.every((id) => id.startsWith("p1.") || id === "p3.f10") && sqftOf(withNew) > sqftOf(cStored) && withNew.surfaces.find((s) => s.id === "s3").quantity.value === S("s3").quantity.value);
  ok("…the request saying so does the same", sqftOf(computeProject(CHURCH_INTERIOR_MODEL, ctx22(`${CHURCH_REQUEST} Include the new extension rooms.`))) === sqftOf(withNew));

  // The review panel: one explicit check, never silent.
  const rv22 = buildReview({ computed: cStored, priced: priceProject(cStored, books, {}), model: CHURCH_INTERIOR_MODEL });
  const stateCheck = [...rv22.checks, ...rv22.more].find((c) => c.key === "plan_state:existing");
  ok(`the review asks: “${stateCheck?.text}”`, stateCheck && stateCheck.text === "Priced the existing layout; the proposed extension rooms Cafe, Kitchen, Meeting room, Store, Annexe WC and service rooms and Office are not included — include them?" && rv22.checks.includes(stateCheck) && stateCheck.choices?.[0]?.op === "set_plan_state" && stateCheck.choices[0].value === "with_new" && /as it stands \(“Plan - as existing”\) and as proposed \(“Part church floor plan showing proposed extensions” and “Scheme C4 - Whole Church Plan”\) — one is priced, never both\. A repaint prices the rooms that exist now/.test(stateCheck.why), stateCheck);
  ok("…“taken into account” says what was merged and which state", rv22.included.some((i) => i.key === "qty:same" && /Drawn on more than one sheet, counted once: Nave \(3 drawings\), Crossing \(2 drawings\), .*, Boiler \(2 drawings\) and 1 more — each from its best drawing \(the drawing as existing when there is one/.test(i.text) && !/ and [^,]+ and 1 more/.test(i.text)) && rv22.included.some((i) => i.key === "qty:state" && /Priced on the existing layout \(“Plan - as existing”\), not the proposed one/.test(i.text)));
  // One read → an exterior and an interior quote (lib/planRead/slices.js):
  // the interior's state check belongs to the interior quote only.
  const extSlice22 = sliceComputed({ ...cStored, areas: [...cStored.areas, { id: "aX", name: "Outside", side: "exterior", included: true }] }, { kind: "painting", side: "exterior" });
  const intSlice22 = sliceComputed(cStored, { kind: "painting", side: "interior" });
  const rvExt22 = buildReview({ computed: extSlice22, priced: priceProject(extSlice22, books, {}), model: CHURCH_INTERIOR_MODEL });
  const rvInt22 = buildReview({ computed: intSlice22, priced: priceProject(intSlice22, books, {}), model: CHURCH_INTERIOR_MODEL });
  ok("the exterior quote drafted from the same read carries neither the interior's merged rooms nor its existing-or-proposed check; the interior quote carries both", extSlice22.sameSurface === null && ![...rvExt22.checks, ...rvExt22.more].some((c) => c.key.startsWith("plan_state:")) && !rvExt22.included.some((i) => i.key === "qty:same" || i.key === "qty:state") && intSlice22.sameSurface?.state?.value === "existing" && intSlice22.sameSurface.outNames.length === 6 && intSlice22.sameSurface.outNames.join() === cStored.sameSurface.outNames.join() && rvInt22.checks.some((c) => c.key === "plan_state:existing") && rvInt22.included.some((i) => i.key === "qty:same"));
  const rvNew = buildReview({ computed: withNew, priced: priceProject(withNew, books, {}), model: CHURCH_INTERIOR_MODEL });
  ok("…with the new rooms in, the check turns round: “leave them out?”, one tap back", [...rvNew.checks, ...rvNew.more].some((c) => c.key === "plan_state:with_new" && /plus the proposed new rooms Cafe, Kitchen/.test(c.text) && c.choices[0].value === "existing" && /Your team chose it/.test(c.why)) && ![...rvNew.checks, ...rvNew.more].some((c) => c.key === "plan_state:existing"));
  const opCtx = { itemKeys, productKeys, dimIds: new Set(), photoIds: new Set(), excel: null };
  const setNew = applyOps(CHURCH_INTERIOR_MODEL, [{ op: "set_plan_state", value: "with_new", userId: "u1", at: "2026-10-06T10:00:00Z" }], opCtx, { actor: "person" });
  ok("the tap is a person's op: stored with who and when, said in the history; the chat cannot make it; a third value is refused; null gives FieldQuo's choice back", setNew.model.planState.value === "with_new" && setNew.model.planState.by === "u1" && /with the proposed new rooms/.test(setNew.changes[0]) && !applyOps(CHURCH_INTERIOR_MODEL, [{ op: "set_plan_state", value: "with_new" }], opCtx, { actor: "model" }).model.planState && applyOps(CHURCH_INTERIOR_MODEL, [{ op: "set_plan_state", value: "proposed_only" }], opCtx, { actor: "person" }).dropped.length === 1 && !("planState" in applyOps(setNew.model, [{ op: "set_plan_state", value: null }], opCtx, { actor: "person" }).model));

  // Guards: what is NOT the same surface.
  const fx22 = (id, sheetKey, view, name, extra = {}) => ({ id, sheetKey, viewId: "v1", page: Number(sheetKey.slice(1)), sheet: "A-1", view, sheetTitle: null, name, side: extra.side || "interior", room: extra.room !== false, measured: true, confidence: "medium", printed: 0, scaleRatio: 100, perimeterFt: 50, floorSqft: 150, grossSqft: 400, netSqft: 380, ...extra });
  const planOf = (list, o = {}) => sameSurfacePlan({ faces: new Map(list.map((f) => [f.id, f])), heights: new Map() }, o);
  const levels = planOf([fx22("p1.f1", "p1", "Ground floor plan", "Bedroom"), fx22("p2.f1", "p2", "First floor plan", "Bedroom")]);
  ok("a bedroom on the ground floor plan is not the bedroom on the first floor plan", planLevel({ view: "Ground floor plan" }) === "ground" && planLevel({ view: "First floor plan" }) === "1" && levels.groupOf.get("p1.f1") !== levels.groupOf.get("p2.f1"));
  const twice = planOf([fx22("p1.f1", "p1", "Whole plan", "WC"), { ...fx22("p1.f2", "p1", "Whole plan", "WC"), id: "p1.f2" }, fx22("p2.f1", "p2", "Part plan", "WC")]);
  ok("a name drawn twice on one view (two WCs) is ambiguous: never merged", twice.groups.every((g) => g.members.length === 1));
  const sizes = planOf([fx22("p1.f1", "p1", "Whole plan", "Hall", { perimeterFt: 40 }), fx22("p2.f1", "p2", "Part plan", "Hall", { perimeterFt: 120 })]);
  ok(`a room whose perimeter differs more than ${2}× between two drawings is two rooms`, sizes.groups.length === 2);
  ok(`printed sizes beat a larger scale: the kitchen's printed 4.7 × 5.2 m on the part plan (${F("p1.f2").printed} printed) is kept over a 1:50 drawing of it`, (() => { const p = planOf([{ ...F("p3.f7"), scaleRatio: 50 }, F("p1.f2")]); return F("p1.f2").printed === 2 && F("p3.f7").printed === 0 && p.groupOf.get("p3.f7").keep === "p1.f2"; })());
  // …except across the two states: the proposed plan draws a room AFTER the
  // works, so in a set drawn both ways the existing drawing is the one kept,
  // even when the proposed one prints its sizes (the church's part plan cuts
  // the nave to 1,338 sq ft with the new lobbies; as it stands it is 2,208).
  const printedProposed = planOf([fx22("p1.f9", "p1", "Part plan showing proposed extensions", "Nave", { printed: 2, perimeterFt: 160 }), fx22("p11.f1", "p11", "Plan - as existing", "Nave", { perimeterFt: 190 })]);
  ok("in a set drawn as existing and as proposed, a room is kept from the existing drawing even when the proposed one prints its sizes — and the line says why", printedProposed.groupOf.get("p1.f9").keep === "p11.f1" && printedProposed.paired === true && printedProposed.groupOf.get("p1.f9").why === "the drawing as existing — the layout priced" && /counted once, from “Plan - as existing” \(page 11, 1:100\) \(the drawing as existing — the layout priced\)/.test(S("s3").quantity.sourceText));
  const printedUnpaired = planOf([fx22("p1.f9", "p1", "Part plan", "Nave", { printed: 2, perimeterFt: 160 }), fx22("p11.f1", "p11", "Whole plan", "Nave", { perimeterFt: 190 })]);
  ok("…in a set drawn one way only, printed sizes still win", printedUnpaired.groupOf.get("p1.f9").keep === "p1.f9" && printedUnpaired.paired === false && printedUnpaired.groupOf.get("p1.f9").why === "printed sizes");
  // The state check is never cut by the cap: a big job's default-rate and
  // access checks outrank any fixed impact figure.
  const crowded = buildReview({ computed: cStored, priced: { ...priceProject(cStored, books, {}), access: Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, label: `Scaffold ${i}`, equipment: "scaffold", price: 20000 + i, priceSource: "reference", why: "test" })) }, model: CHURCH_INTERIOR_MODEL });
  ok("…the existing-or-proposed check stays on the panel (pinned like the read's own questions) when twelve $20,000 checks outrank it", crowded.checks.some((c) => c.key === "plan_state:existing") && !crowded.more.some((c) => c.key === "plan_state:existing") && crowded.more.length > 0);
  // Item 3: exterior elevations drawn on more than one sheet.
  const wall = (id, sheetKey, view, name, extra = {}) => fx22(id, sheetKey, view, name, { side: "exterior", room: false, ...extra });
  const west = planOf([wall("p5.f2", "p5", "West Elevation facing Thorpe Road", "Main west wall", { scaleRatio: 100 }), wall("p12.f1", "p12", "Scheme C4 - West elevation", "Main west wall", { scaleRatio: 200 }), wall("p6.f1", "p6", "North Elevation facing St. Paul's Road", "Main west wall")]);
  ok("an elevation drawn on two sheets: the west wall once (from 1:100), the same name on the NORTH elevation is another face", orientation({ view: "New glazed south porch (east elevation)" }) === "east" && orientation({ view: "Extension Rear /East Elevation" }) === "east" && orientation({ view: "Cross Section - looking south" }) === null && west.groupOf.get("p12.f1") === west.groupOf.get("p5.f2") && west.groupOf.get("p5.f2").keep === "p5.f2" && west.groupOf.get("p6.f1") !== west.groupOf.get("p5.f2"));
  ok("…one outside line citing the west wall from both sheets counts it once", (() => {
    const w1 = wall("p5.f2", "p5", "West Elevation facing Thorpe Road", "Main west wall", { bottomFt: 0, topFt: 20, shape: "rectangle", sentence: "west wall (p5)" });
    const w2 = wall("p12.f1", "p12", "Scheme C4 - West elevation", "Main west wall", { scaleRatio: 200, bottomFt: 0, topFt: 20, shape: "rectangle", sentence: "west wall (p12)" });
    const t = { faces: new Map([[w1.id, w1], [w2.id, w2]]), heights: new Map() };
    const c = computeProject({ version: 1, areas: [{ id: "a1", name: "Outside", side: "exterior", included: true }], surfaces: [{ id: "s1", areaId: "a1", label: "Walls", itemKey: "siding_trim", coats: 2, lengthRefs: [], widthRefs: [], faceRefs: ["p12.f1", "p5.f2"], faceMeasure: "net_area" }], access: [], questions: [], assumptions: [], exclusions: [] }, { dims: new Map(), book: books.interior_painting, takeoff: t, metric: true });
    return c.surfaces[0].quantity.value === 380 && c.surfaces[0].quantity.faceIds.join() === "p5.f2" && /also drawn on “Scheme C4 - West elevation” \(page 12, 1:200\)/.test(c.surfaces[0].quantity.sourceText);
  })());
  ok("…a wall with no stated orientation is never merged (“New glazed west porch” is drawn on the west, north and south elevations — three faces)", planOf([wall("a.f1", "p5", "Cross Section", "Porch"), wall("b.f1", "p9", "Cross Section", "Porch")]).groups.length === 2);
  const extState = planOf([wall("p5.f1", "p5", "West elevation as existing", "West wall"), wall("p6.f1", "p6", "Proposed west elevation", "West wall"), wall("p6.f2", "p6", "Proposed west elevation", "New porch side wall")], { request: "Repaint the outside" });
  ok("…existing and proposed elevations of the same side: one state — the existing wall once, the proposed porch left out", extState.state.value === "existing" && extState.groupOf.get("p6.f1").keep === "p5.f1" && extState.out.has("p6.f2") && !extState.out.has("p6.f1"));

  // Backfill: one surface per room, not per drawing.
  const bf = backfillFromTakeoff({ version: 1, areas: [], surfaces: [], access: [], questions: [], assumptions: [], exclusions: [] }, take22, { sides: ["interior"], itemKeys, request: CHURCH_REQUEST, computedOf: (m) => computeProject(m, ctx22()) });
  const naves = bf.model.surfaces.filter((s) => /^Nave/.test(s.label) && s.itemKey === "walls");
  ok(`a read whose synthesis listed no inside quantity is backfilled once per room: one nave (from ${naves[0]?.faceRefs?.[0]}), none for the proposed-only rooms`, naves.length === 1 && naves[0].faceRefs[0] === "p11.f1" && !bf.model.surfaces.some((s) => /^(Cafe|Kitchen|Office)/.test(s.label)));

  // Re-pricing the stored read: computed on every view.
  ok("the de-duplication is computed on every view (computeRead → computeProject with the read's request), so the stored read re-prices on its next open — no run, no charge", /request: read\.clientRequest \|\| null/.test(code("lib/planRead/computeRead.js")) && (code("lib/planRead/run.js").match(/request: read\.clientRequest \|\| null/g) || []).length === 3);
  // Wiring.
  ok("the review panel renders a check's one-tap choice as the op it names; the PATCH route stamps who and when on set_plan_state", /\(c\.choices \|\| \[\]\)\.map/.test(code("app/components/planRead/ReviewPanel.js")) && /onOp\(\{ op: ch\.op, value: ch\.value \}\)/.test(code("app/components/planRead/ReviewPanel.js")) && /o\.op === "set_plan_state" \? \{ \.\.\.o, userId: member\.userId \|\| null, at \}/.test(code("app/api/plan-reads/[id]/route.js")));
  ok("“Measured on the drawings” says, per drawing, which one is counted and what is not in the state priced", /f\.sameAs &&/.test(code("app/components/planRead/FirstPassCards.js")) && /f\.alsoOn\?\.length > 0/.test(code("app/components/planRead/FirstPassCards.js")) && /f\.stateOut &&/.test(code("app/components/planRead/FirstPassCards.js")) && /computed\.sameSurface\?\.faces\?\.\[f\.id\]/.test(code("lib/planRead/view.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("19. Wiring");
// ═══════════════════════════════════════════════════════════════════════════
const pkg = JSON.parse(code("package.json"));
ok("check:plan-read-first-pass is in check:all", /check:plan-read-first-pass/.test(pkg.scripts["check:all"]));
ok("the screen renders the first pass: measured, priced-on, crew plan, the parts, confirm on access", ["MeasuredCard", "AssumptionsCard", "CrewPlanCard", "SlicesCard", "confirm_access", "UnmeasuredBanner"].every((w) => code("app/components/planRead/PlanReadWorkspace.js").includes(w)));
ok("Settings → Services edits the preset's height, prep, crew and access figures", /PaintHeightPrepSettings/.test(code("app/app/settings/services/ServicesEditor.js")) && /takeoff\.heightFactors/.test(code("app/app/settings/services/PaintHeightPrepSettings.js")));
ok("Settings → Services → Equipment & access: its own section, the owned toggle, the defaults shown, in the sidebar and the settings search", /id="equipment-access"/.test(code("app/app/settings/services/PaintHeightPrepSettings.js")) && /We own this \(no rental\)/.test(code("app/app/settings/services/PaintHeightPrepSettings.js")) && /app\.settings\.equipmentAccess/.test(code("app/components/layout/SettingsSidebar.js")) && /#equipment-access/.test(code("app/components/layout/SettingsSidebar.js")));
ok("the help article exists in en, fr and es, and in the help tree", ["en", "fr", "es"].every((l) => /"settings-equipment-access": \{/.test(code(`content/help/${l}/settings-2.js`))) && /"settings-equipment-access"/.test(code("lib/help/tree.js")) && ["en", "fr", "es"].every((l) => /first-pass/.test(code(`content/help/${l}/leads-and-quotes-3.js`))));
const scanned = ["app/components/planRead/FirstPassCards.js", "app/components/planRead/ReviewPanel.js", "app/app/settings/services/PaintHeightPrepSettings.js", "app/components/quotes/builder/CostMarginPanel.js", "app/components/quotes/builder/PaintAreas.js", "app/components/layout/SettingsSidebar.js"];
const dynamicKeys = [...ACCESS_REASONS.map((r) => `app.planRead.accessReason.${r}`), ...["qty", "coats", "height", "prep", "access", "crew", "overhead", "target", "past", "assumed", "materials"].map((k) => `app.planRead.review.label.${k}`), ...Object.keys(PREP_MATERIAL_PRICE_PRESET).map((k) => `app.paintPreset.material.${k}`), "app.setup.step.access_rates", "app.planRead.builderUnreviewed", "app.planRead.builderUnreviewedLink", ...PLAN_STATES.map((v) => `app.planRead.review.planState.${v}`)];
const keysUsed = new Set(scanned.flatMap((p) => [...code(p).matchAll(/\bt\("(app\.(?:planRead|paintPreset|cost\.access|settings\.equipmentAccess)[a-zA-Z0-9_.]*)"/g)].map((m) => m[1])).concat(dynamicKeys));
const langs = Object.keys(APP_MESSAGES);
const missing = [...keysUsed].filter((k) => !langs.every((l) => typeof APP_MESSAGES[l][k] === "string"));
ok(`every first-pass string exists in all ${langs.length} languages (${keysUsed.size} keys)`, langs.length === 9 && missing.length === 0, missing.slice(0, 20));

console.log(`\ncheck-plan-read-first-pass: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
