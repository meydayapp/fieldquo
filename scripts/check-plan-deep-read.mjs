// scripts/check-plan-deep-read.mjs
//
//   npm run check:plan-deep-read
//
// "Start from drawings" (owner, 2026-10-03): a drawing set, a scope
// spreadsheet, site photos and what the client wants → one project overview
// and a draft quote priced from the company's own rates, with a chat under
// it, paid from the AI credit. Every claim below is EXECUTED against the real
// modules — a PDF written byte by byte and read back by pdf.js, an .xlsx
// zipped here and read by read-excel-file, an in-memory database, a scripted
// model — not read off the source:
//
//   1. Vector PDF → dimension strings and scale parse to the right lengths
//      and areas, imperial and metric, odd formats included; typos refused.
//   2. Scope spreadsheets (.xlsx and .csv) parse in code, rows citable.
//   3. The model never sets a price: no money-shaped field in any schema;
//      volunteered prices land nowhere; only a person may price equipment;
//      the draft's total IS the company's paint engine's total.
//   4. Every quantity carries a source; estimates are labelled.
//   5. Scanned sheets are marked estimated, all the way to the quantity.
//   6. Photos: reference-object arithmetic, labels, one surface seen in two
//      photos counted once, split/merge, drawings win, conflicts asked.
//   7. Chat turns reuse a byte-identical cached prefix, report cached tokens,
//      persist both messages and the model in one transaction.
//   8. Credit: held before, settled to actual (never above the hold),
//      refunded in full on failure, refused with numbers when short.
//   9. No cross-tenant past quotes.
//  10. Quote files carry to the job's Documents: kinds, chains, idempotent.
//  11. Upload scope "plans": PDF/xlsx/csv to 100 MB, old .xls refused with a
//      way out, every other scope unchanged.
//  12. The cost envelope the owner approved holds.
//
// P0 of the multi-trade plan (speed, measurement, reliability), against a
// scripted provider with real millisecond delays — never the live API:
//  14. Every sheet in one wave (bounded), photos beside them; the synthesis
//      prompt, the model and every stored pass are md5-identical to the old
//      one-at-a-time order for the same answers.
//  15. Each stage's clock is on the read; the estimator sees the total,
//      /platform the stages.
//  16. Rate limits back off and retry; a failing sheet is written off after
//      its attempts, never the read.
//  17. The backstop cron: two ticks at once resume a stalled read once; a
//      held lease is left alone; a late worker cannot settle twice; the
//      ledger refunds once; a read stuck past MAX_READ_MS is refunded in full.
//  18. The estimator's edits are logged in the same history as the chat's,
//      with who and when, and never sent to the model as conversation.
//  19. The same PDF bytes are offered for reuse within the company only —
//      another company's read of the identical file never is.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { zipSync, strToU8 } from "fflate";

import { churchSet, ukChurchSet, buildPlanPdf } from "./fixtures/planPdf.mjs";
import { findDimensions, parseScale, feetPerPixelFromScale, formatFeet } from "@/lib/planRead/dimensions";
import { sheetFacts, isScaleBarLine } from "@/lib/planRead/sheetFacts";
import { pdfSheets, spreadsheetRows } from "@/lib/planRead/ingest";
import { fetchTenantFile } from "@/lib/media/fileOpen";
import { splitPdfBytes, partName, pagesPerPart, PdfSplitError } from "@/lib/planRead/pdfSplit";
import { sheetNeedsPass, sheetPassDone } from "@/lib/planRead/sheetState";
import {
  MULTI_TRADE_KEYS,
  tradeCatalogueForModel,
  tradesFromScope,
  paintingFocus,
  scopeHasPainting,
  sanitiseScope,
  isSpecPage,
  specDigest,
  routeSheets,
  unregisteredItemKeys,
} from "@/lib/planRead/tradeCatalogue";
import { aggregateSheetCounts, buildCountIndex, buildScheduleIndex, sanitiseTradeSynthesis, computeTrade, computeTrades, applyTradeOps } from "@/lib/planRead/tradeModel";
import { TRADE_SHEET_SCHEMA, TRADE_SYNTHESIS_SCHEMA } from "@/lib/planRead/tradePrompts";
import { PRICING_CHAT_SCHEMA, verifyProposals, findPricingInputs, mergeAssumptions, pricingDiff } from "@/lib/planRead/pricingChat";
import { priceTrade, assumptionsIndex, engineBooks } from "@/lib/planRead/tradePricing";
import { recommendPrice } from "@/lib/planRead/recommendation";
import { readPricing } from "@/lib/planRead/readPricing";
import { applyPricingOps } from "@/lib/planRead/pricingOps";
import { notifyBelowTarget } from "@/lib/planRead/marginNotify";
import { overheadRates, overheadForJob } from "@/lib/costing/overheadShare";
import { buildTradeLineItems } from "@/lib/pricing/tradeScope";
import { NOTIFICATION_TYPES } from "@/lib/notifications/catalog";
import { hrefFor } from "@/lib/notifications/render";
import { MEASUREMENT_KEYS, TRADE_MEASUREMENTS, DRAWING_READ_TRADE_KEYS, measurementKeysForTrade, isMeasurementKey } from "@/lib/services/measurementKeys";
import { parseScopeSheets, scopeSheetDigest } from "@/lib/planRead/excel";
import {
  sanitiseSynthesis,
  computeProject,
  buildDimIndex,
  applyOps,
  cellNumber,
  CHAT_OPS,
} from "@/lib/planRead/projectModel";
import { priceProject, paintedSqft } from "@/lib/planRead/pricing";
import { planSubstrateKeys } from "@/lib/planRead/catalogue";
import {
  scaleFromReference,
  photoSurfaceQuantity,
  sanitisePhotoRead,
  splitPhotoSurface,
  mergePhotoSurfaces,
  groupingSentence,
  PHOTO_ESTIMATE_LABEL,
  REFERENCE_OBJECTS,
} from "@/lib/planRead/photoScale";
import {
  SHEET_SCHEMA,
  PHOTO_SCHEMA,
  SYNTHESIS_SCHEMA,
  CHAT_SCHEMA,
  chatPrompt,
  projectContext,
  CHAT_DYNAMIC_MARK,
} from "@/lib/planRead/prompts";
import { estimateRead, settlement, addUsage } from "@/lib/planRead/billing";
import { startRead, advanceRead, scanDimsFrom, retryPlan, SHEET_CONCURRENCY, MAX_READ_MS, readEstimate, hasWorkToRead, readInputs, inputsKey } from "@/lib/planRead/run";
import { startTiming, timingSummary, timingMedians, formatDuration } from "@/lib/planRead/timing";
import { resumeStalledReads, stalledWhere } from "@/lib/planRead/backstop";
import { editLogEntry, chatHistory, withAuthors } from "@/lib/planRead/history";
import { contentHashOf, reusableSheets, applySheetReuse, findSheetCache, remapSheetPass } from "@/lib/planRead/sheetCache";
import { planReadView, reuseSavings } from "@/lib/planRead/view";
import { chatTurn, chatContext } from "@/lib/planRead/chat";
import { summariseSimilar, similarPastQuotes } from "@/lib/planRead/similar";
import { fileQuoteDocumentsOnJob, quoteDocumentsInChainOrder, quoteUploadHash } from "@/lib/jobs/documentAutofile";
import { validateQuoteDocument } from "@/lib/quotes/quoteDocuments";
import { assertStrictSchema } from "@/lib/ai/jsonSchema";
import { estimateCostMicros } from "@/lib/ai/usage";
import { estimateChargeCents, WALLET_ESTIMATES } from "@/lib/ai/walletMeter";
import { payerFeature } from "@/lib/ai/featurePayer";
import { poolForKind, POOLS } from "@/lib/voice/credits";
import { SPEND_KINDS } from "@/lib/voice/spendGate";
import { classifyMedia } from "@/lib/media/validate";
import { uploadScope, planUpload, isOwnPublicId } from "@/lib/media/directUpload";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import { paintTakeoff } from "@/lib/pricing/paintTakeoff";

let passed = 0;
let failed = 0;
const ok = (label, cond, detail) => {
  if (cond) passed++;
  else failed++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${cond || detail === undefined ? "" : `  — ${JSON.stringify(detail)}`}`);
};
const section = (t) => console.log(`\n${t}\n`);
const code = (p) =>
  readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

const books = {
  interior_painting: getPriceBook("interior_painting", null).takeoff,
  exterior_painting: getPriceBook("exterior_painting", null).takeoff,
};
const itemKeys = new Set(planSubstrateKeys(books.interior_painting));
const productKeys = new Set(Object.keys(books.interior_painting.products));

// ═══════════════════════════════════════════════════════════════════════════
section("1. A vector PDF read back by pdf.js: dimensions, scale, areas");
// ═══════════════════════════════════════════════════════════════════════════

const pdfRead = await pdfSheets(churchSet(), { firstIndex: 1 });
ok("the fixture PDF is read", pdfRead.ok && pdfRead.sheets.length === 3, pdfRead);
const [elev, plan, scan] = pdfRead.sheets;
ok("sheet number from the title block", elev.sheetNumber === "A-201" && plan.sheetNumber === "A-101", [elev.sheetNumber, plan.sheetNumber]);
ok("sheet title", elev.title === "NORTH ELEVATION" && plan.title === "GROUND FLOOR PLAN", [elev.title, plan.title]);
ok("imperial scale 1/4\" = 1'-0\" → 48", elev.scale?.ratio === 48, elev.scale);
ok("metric scale 1:100 → 100", plan.scale?.ratio === 100 && plan.scale?.system === "metric", plan.scale);
const elevDim = (raw) => elev.dims.find((d) => d.raw === raw);
ok("42'-6\" → 42.5 ft", elevDim("42'-6\"")?.feet === 42.5, elevDim("42'-6\""));
ok("12'-6 1/2\" → 12.5417 ft", near(elevDim("12'-6 1/2\"")?.feet, 12 + 6.5 / 12, 0.0001), elevDim("12'-6 1/2\""));
ok("an elevation mark is kind elevation", elevDim("24'-6\"")?.kind === "elevation");
ok("12'-14\" (a typo) is refused, not read as 14 inches", !elev.dims.some((d) => /14/.test(d.raw)), elev.dims.map((d) => d.raw));
ok("18'-0\" x 12'-6 1/2\" is recorded as a pair", elev.pairs.length === 1);
ok("room labels found", elev.labels.includes("BELL TOWER") && elev.labels.includes("SANCTUARY") && plan.labels.includes("FELLOWSHIP HALL"), elev.labels);
ok("paint code PT-1 found", elev.finishCodes.some((c) => c.code === "PT-1"));
const planDim = (raw) => plan.dims.find((d) => d.raw === raw);
ok("3,800 mm → 3.8 m", planDim("3,800 mm")?.metres === 3.8 && !planDim("3,800 mm").unitAssumed);
ok("bare 12500 on a metric sheet → 12.5 m, flagged unit assumed", planDim("12500")?.metres === 12.5 && planDim("12500").unitAssumed === true, planDim("12500"));
ok("a room number (101) on a metric sheet is not a dimension", !planDim("101"));
ok("CLG HT 3.6 m → a height of 3.6 m", planDim("3.6 m")?.kind === "height");
ok("the sheet with no text layer is scanned", scan.vector === false && scan.dims.length === 0);
ok("both drawn sheets are vector", elev.vector && plan.vector);

for (const [s, feet] of [
  [`12' 6"`, 12.5], [`12'6"`, 12.5], [`12 ft 6 in`, 12.5], [`12'-6½"`, 12 + 6.5 / 12], [`6"`, 0.5], [`3/4"`, 0.0625],
  [`12.5'`, 12.5], [`12′-6″`, 12.5], [`10'-6 3/8"`, 10 + 6.375 / 12], [`3.8 m`, 3.8 * 3.280839895], [`380 cm`, 3.8 * 3.280839895],
]) ok(`"${s}" → ${feet.toFixed(4)} ft`, near(findDimensions(s)[0]?.feet, feet, 0.0002), findDimensions(s));
ok("\"ROOM 101\" holds no dimension", findDimensions("ROOM 101").length === 0);
ok("a bare number on an imperial sheet is never a dimension", findDimensions("3800").length === 0);
for (const [t, r] of [[`1/8"=1'-0"`, 96], [`3/32" = 1'-0"`, 128], [`1 1/2" = 1'-0"`, 8], [`1" = 20'`, 240], [`SCALE 1 : 50`, 50]]) {
  ok(`scale "${t}" → ${r}`, parseScale(t)?.ratio === r, parseScale(t));
}
ok("N.T.S. is a statement, with no ratio", parseScale("N.T.S.")?.nts === true && parseScale("N.T.S.").ratio === null);
ok("feet per pixel from the scale: 36 in sheet at 3,200 px, 1/4\" scale → 0.045", near(feetPerPixelFromScale({ ratio: 48, pointsWidth: 2592, pixelWidth: 3200 }), 0.045, 1e-9));
ok("no scale → no feet per pixel (never a default)", feetPerPixelFromScale({ ratio: null, pointsWidth: 2592, pixelWidth: 3200 }) === null);
ok("formatFeet rounds 12.9999 to 13'-0\"", formatFeet(12.9999) === "13'-0\"");

// Areas from refs — computed in code.
const sheets = [
  { ...elev, docId: "doc-pdf", docPage: 1 },
  { ...plan, docId: "doc-pdf", docPage: 2 },
  { ...scan, docId: "doc-pdf", docPage: 3 },
];
const dims = buildDimIndex(sheets);
const ctx = { dimIds: new Set(dims.keys()), itemKeys, productKeys, photoIds: new Set(), excel: null };
const id = (sheet, raw) => sheet.dims.find((d) => d.raw === raw).id;
const rawSynthesis = {
  summary: "Church repaint",
  buildingType: "church",
  commercial: true,
  areas: [
    { id: "a1", name: "North elevation", level: null, side: "exterior", include: true },
    { id: "a2", name: "Sanctuary", level: null, side: "interior", include: true },
    { id: "a3", name: "Fellowship hall", level: null, side: "interior", include: true },
  ],
  surfaces: [
    { id: "s1", areaId: "a1", label: "North wall", itemKey: "siding_trim", coats: 2, productKey: null, lengthRefs: [id(elev, "42'-6\"")], widthRefs: [id(elev, "24'-6\"")], multiplier: 1, count: null, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: null, estimateBasis: null, sheet: "A-201", note: null },
    { id: "s2", areaId: "a2", label: "Sanctuary ceiling", itemKey: "ceiling", coats: null, productKey: null, lengthRefs: [id(elev, "18'-0\"")], widthRefs: [id(elev, "12'-6 1/2\"")], multiplier: 1, count: null, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: null, estimateBasis: null, sheet: "A-201", note: null, price: 9999, rate: 4.5, amount: 123 },
    { id: "s3", areaId: "a3", label: "Hall walls", itemKey: "walls", coats: null, productKey: null, lengthRefs: [id(plan, "12500"), id(plan, "3,800 mm")], widthRefs: [id(plan, "3.6 m")], multiplier: 2, count: null, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: null, estimateBasis: null, sheet: "A-101", note: null },
    { id: "s4", areaId: "a2", label: "Doors", itemKey: "door", coats: null, productKey: null, lengthRefs: [], widthRefs: [], multiplier: null, count: 12, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: null, estimateBasis: null, sheet: "A-101", note: null },
    { id: "s5", areaId: "a2", label: "Invented", itemKey: "gold_leaf", coats: null, productKey: null, lengthRefs: ["p9.d1"], widthRefs: [], multiplier: null, count: null, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: null, estimateBasis: null, sheet: null, note: null },
    { id: "s6", areaId: "a2", label: "Trim", itemKey: "baseboard", coats: null, productKey: "trim_enamel_premium", lengthRefs: ["p9.d99"], widthRefs: [], multiplier: null, count: null, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: 300, estimateBasis: "perimeter of the sanctuary by eye", sheet: null, note: null },
  ],
  access: [{ areaId: "a1", equipment: "boom_lift", workingHeightFt: null, heightRef: id(elev, "68'-0\""), reason: "bell tower", price: 5000 }],
  complexity: { level: "high", factors: ["height"] },
  assumptions: ["Occupied building"],
  exclusions: [],
  questions: ["Colour schedule?"],
};
const model = sanitiseSynthesis(rawSynthesis, ctx);
const computed = computeProject(model, { dims, book: books.interior_painting, excel: null, photoRead: null });
const q = (sid) => computed.surfaces.find((s) => s.id === sid)?.quantity;
ok("wall area = 42'-6\" × 24'-6\" = 1,041 sqft, from the drawing, not estimated", q("s1")?.value === 1041 && q("s1").source === "drawing" && q("s1").estimated === false, q("s1"));
ok("ceiling = 18'-0\" × 12'-6 1/2\" = 226 sqft", q("s2")?.value === 226, q("s2"));
ok("metric hall walls = (12.5 m + 3.8 m) × 3.6 m × 2 ≈ 1,263 sqft", near(q("s3")?.value, Math.round((41.0105 + 12.4672) * 11.811 * 2), 1), q("s3"));
ok("…and marked estimated because 12500 was an assumed mm", q("s3")?.estimated === true && /mm assumed/.test(q("s3").sourceText), q("s3"));
ok("an item not in the company's catalogue is dropped", !model.surfaces.some((s) => s.itemKey === "gold_leaf"));
ok("a dimension id that does not exist is dropped", !model.surfaces.find((s) => s.id === "s6").lengthRefs.length);
ok("access height from the printed 68'-0\"", computed.access[0].heightFt === 68 && /A-201/.test(computed.access[0].heightSource));

// ═══════════════════════════════════════════════════════════════════════════
section("2. The scope spreadsheet: .xlsx and .csv, parsed in code");
// ═══════════════════════════════════════════════════════════════════════════

function xlsx(rowsIn) {
  const strings = [];
  const si = (s) => {
    const i = strings.indexOf(s);
    if (i >= 0) return i;
    strings.push(s);
    return strings.length - 1;
  };
  const col = (i) => String.fromCharCode(65 + i);
  const sheetRows = rowsIn
    .map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => (v === null ? "" : typeof v === "number" ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="s"><v>${si(v)}</v></c>`)).join("")}</row>`)
    .join("");
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Paint Scope" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  files["xl/sharedStrings.xml"] = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</t></si>`).join("")}</sst>`;
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
}

const book = xlsx([
  ["St. Mark's — Paint Scope", null, null, null, null],
  ["Area", "Description", "Qty", "Unit", "Finish"],
  ["Sanctuary", "Walls", 2400, "SF", "PT-1 eggshell"],
  [null, null, null, null, null],
  ["Narthex", "Ceiling", "1,150 SF", "SF", "PT-2 flat"],
]);
const xl = await spreadsheetRows(Buffer.from(book), "xlsx");
ok(".xlsx parsed", xl.ok && xl.parsed.sheets.length === 1, xl);
const xs = xl.parsed.sheets[0];
ok("the title row above the header is skipped; the header is found", xs.header.join("|") === "Area|Description|Qty|Unit|Finish", xs.header);
ok("columns get roles from their own words", xs.roles.A === "area" && xs.roles.C === "quantity" && xs.roles.D === "unit" && xs.roles.E === "finish", xs.roles);
ok("rows keep their spreadsheet row numbers; the empty row is skipped", xs.rows.map((r) => r.r).join(",") === "3,5", xs.rows);
ok("\"1,150 SF\" reads as 1150", cellNumber(xs.rows[1].cells.C) === 1150);
ok("the digest cites row numbers", /row 3: A:Sanctuary/.test(scopeSheetDigest(xl.parsed)));
const csv = await spreadsheetRows(Buffer.from("Room,Scope,Quantity\nGym,Walls,3200\n"), "csv");
ok(".csv parsed with roles", csv.ok && csv.parsed.sheets[0].roles.A === "area" && csv.parsed.sheets[0].rows[0].cells.C === "3200", csv);
const junk = await spreadsheetRows(Buffer.from("not a zip"), "xlsx");
ok("a corrupt .xlsx is refused, not half-read", junk.ok === false);
const exModel = sanitiseSynthesis(
  {
    ...rawSynthesis,
    surfaces: [{ ...rawSynthesis.surfaces[2], id: "e1", lengthRefs: [], widthRefs: [], excelSheet: "Paint Scope", excelRow: 3, excelCol: "C" },
      { ...rawSynthesis.surfaces[2], id: "e2", lengthRefs: [], widthRefs: [], excelSheet: null, excelRow: 99, excelCol: "C" }],
  },
  { ...ctx, excel: xl.parsed },
);
const exComputed = computeProject(exModel, { dims, book: books.interior_painting, excel: xl.parsed });
ok("a cited spreadsheet cell gives the quantity, with the row in the source", exComputed.surfaces[0].quantity.value === 2400 && /row 3/.test(exComputed.surfaces[0].quantity.sourceText), exComputed.surfaces[0].quantity);
ok("a row that doesn't exist is not cited", exModel.surfaces[1].excelRow === null);

// ═══════════════════════════════════════════════════════════════════════════
section("3. The model never sets a price");
// ═══════════════════════════════════════════════════════════════════════════

const MONEY = /price|rate|cost|amount|total|dollar|cents|\$|fee|charge|sell/i;
function propNames(schema, out = []) {
  if (!schema || typeof schema !== "object") return out;
  if (schema.properties) for (const [k, v] of Object.entries(schema.properties)) {
    out.push(k);
    propNames(v, out);
  }
  if (schema.items) propNames(schema.items, out);
  return out;
}
for (const [name, schema] of Object.entries({ SHEET_SCHEMA, PHOTO_SCHEMA, SYNTHESIS_SCHEMA, CHAT_SCHEMA })) {
  const bad = propNames(schema).filter((k) => MONEY.test(k));
  // The chat's one exception (the owner's live test, 2026-10-05): an
  // equipment price the ESTIMATOR gave or accepted — kept by applyOps only
  // when the figure is in their words (scripts/check-plan-read-live-fixes.mjs).
  const allowed = name === "CHAT_SCHEMA" ? ["price"] : [];
  ok(`${name} has no money-shaped field${allowed.length ? " beyond the estimator-stated equipment price" : ""}`, bad.every((k) => allowed.includes(k)) && bad.length <= allowed.length, bad);
  const lint = assertStrictSchema(schema);
  ok(`${name} is inside the vendor's strict subset`, lint.ok, lint.errors);
}
const s2 = model.surfaces.find((s) => s.id === "s2");
ok("a price/rate/amount the model volunteers is not kept", !("price" in s2) && !("rate" in s2) && !("amount" in s2), Object.keys(s2));
ok("a price on an access line from the model is not kept", model.access[0].price === null);
const modelPriced = applyOps(model, [{ op: "set_access_price", accessId: "x1", price: 999 }, { op: "measure", surfaceId: "s1", value: 5 }], ctx, { actor: "model" });
ok("the model cannot set an equipment price or a measurement", modelPriced.model.access[0].price === null && !modelPriced.model.surfaces[0].override && modelPriced.dropped.length === 2, modelPriced);
const personPriced = applyOps(model, [{ op: "set_access_price", accessId: "x1", price: 1800 }], ctx, { actor: "person" });
ok("the estimator can", personPriced.model.access[0].price === 1800);
ok("CHAT_OPS offers one price operation — equipment, at a stated figure — and no rate", CHAT_OPS.filter((o) => MONEY.test(o)).join() === "set_access_price", CHAT_OPS);
const priced = priceProject(computed, books);
const engineTotal = priced.groups.reduce((n, g) => n + paintTakeoff(g.takeoff, books[g.categoryKey]).total, 0);
ok("the draft's painting total is exactly the company paint engine's", near(priced.paintTotal, engineTotal, 0.001), [priced.paintTotal, engineTotal]);
ok("every line priced, none at a model figure", priced.lines.every((l) => l.amount > 0 && l.amount !== 9999 && l.amount !== 123));
ok("unpriced equipment is drafted unpriced, never at $0", priced.access[0].price === null && priced.unpricedAccess === 1);
const pricedWithLift = priceProject(computeProject(personPriced.model, { dims, book: books.interior_painting }), books);
ok("a lift price the estimator typed is added", near(pricedWithLift.subtotal, priced.subtotal + 1800, 0.001));
const ownBook = getPriceBook("interior_painting", { takeoff: { rateSets: { commercial: { hourlySellRate: 120 } } } }).takeoff;
const pricedOwn = priceProject(computed, { ...books, interior_painting: ownBook });
ok("the company's OWN hourly rate moves the draft (its book, not FieldQuo's)", pricedOwn.paintTotal !== priced.paintTotal, [pricedOwn.paintTotal, priced.paintTotal]);
ok("premium trim paint is honoured as the product", priced.groups.some((g) => g.takeoff.areas.some((a) => a.substrates.some((s) => s.key === "baseboard" && s.productKey === "trim_enamel_premium"))));

// ═══════════════════════════════════════════════════════════════════════════
section("4. Every quantity carries a source");
// ═══════════════════════════════════════════════════════════════════════════

ok("every surface has a source and a sentence", computed.surfaces.every((s) => s.quantity.source && s.quantity.sourceText), computed.surfaces.map((s) => s.quantity));
ok("drawing sources name the sheet and the printed dimensions", /A-201: 42'-6" × 24'-6"/.test(q("s1").sourceText), q("s1").sourceText);
ok("a count is labelled estimated", q("s4").source === "count" && q("s4").estimated === true && /verify/.test(q("s4").sourceText));
ok("a model estimate is labelled with its basis", q("s6").source === "estimate" && q("s6").estimated && /perimeter/.test(q("s6").sourceText), q("s6"));
ok("draft lines carry the source and the estimated flag", priced.lines.every((l) => l.sourceText && typeof l.estimated === "boolean"));
ok("the area's crew note says AI-drafted and lists sources (office-only)", priced.groups.every((g) => g.takeoff.areas.every((a) => /FieldQuo AI/.test(a.crewNote) && !a.clientNote)));
const noSource = computeProject(sanitiseSynthesis({ ...rawSynthesis, surfaces: [{ ...rawSynthesis.surfaces[0], id: "n1", lengthRefs: [], widthRefs: [] }] }, ctx), { dims, book: books.interior_painting });
ok("no source at all → quantity 0, said plainly, never invented", noSource.surfaces[0].quantity.value === 0 && noSource.surfaces[0].quantity.source === "none");
ok("…and it is not priced", priceProject(noSource, books).lines.length === 0);

// ═══════════════════════════════════════════════════════════════════════════
section("5. Scanned sheets are estimated");
// ═══════════════════════════════════════════════════════════════════════════

const scanDims = scanDimsFrom([{ text: "40'-0\"", label: "south wall length" }, { text: "20'-0\"", label: "wall height" }, { text: "no dimension here", label: "x" }], scan.key);
ok("dimensions the model read off a scanned sheet are parsed in code", scanDims.length === 2 && scanDims[0].feet === 40 && scanDims[1].kind === "height", scanDims);
const scanSheets = sheets.map((s) => (s.key === scan.key ? { ...s, scanDims } : s));
const scanIndex = buildDimIndex(scanSheets);
const scanModel = sanitiseSynthesis(
  { ...rawSynthesis, surfaces: [{ ...rawSynthesis.surfaces[0], id: "sc1", lengthRefs: [scanDims[0].id], widthRefs: [scanDims[1].id] }] },
  { ...ctx, dimIds: new Set(scanIndex.keys()) },
);
const scanQ = computeProject(scanModel, { dims: scanIndex, book: books.interior_painting }).surfaces[0].quantity;
ok("a quantity built on a scanned sheet is marked estimated — verify", scanQ.value === 800 && scanQ.estimated === true && /scanned sheet, estimated, verify/.test(scanQ.sourceText), scanQ);

// ═══════════════════════════════════════════════════════════════════════════
section("6. Photos: reference scaling, labels, de-duplication, drawings win");
// ═══════════════════════════════════════════════════════════════════════════

const door = scaleFromReference({ kind: "interior_door", widthInRefs: 6.5, heightInRefs: 1.5 });
ok("6.5 doors wide × 1.5 doors tall at 80 in → 43.33 ft × 10 ft", door.widthFt === 43.33 && door.heightFt === 10, door);
const brick = scaleFromReference({ kind: "brick_course", widthInRefs: null, heightInRefs: 36 });
ok("36 brick courses → 8 ft (3 courses = 8 in)", brick.heightFt === 8, brick);
const siding = scaleFromReference({ kind: "siding_course", widthInRefs: 120, heightInRefs: 24 });
ok("siding courses carry the 4–7 in spread as a range", siding.low.heightFt === 8 && siding.high.heightFt === 14 && siding.heightFt === 12, siding);
ok("an unknown reference gives nothing", scaleFromReference({ kind: "banana", widthInRefs: 3 }) === null);
ok("every reference object has a size and a label", Object.values(REFERENCE_OBJECTS).every((r) => r.inches > 0 && r.min <= r.inches && r.inches <= r.max && r.label));

const rawPhotos = {
  references: [
    { id: "r1", photo: 1, kind: "interior_door", note: "" },
    { id: "r2", photo: 3, kind: "outlet_plate", note: "" },
    { id: "r3", photo: 2, kind: "interior_door", note: "" },
    { id: "rX", photo: 9, kind: "interior_door", note: "photo that wasn't sent" },
  ],
  surfaces: [
    {
      id: "p1", label: "North wall", surface: "wall", side: "interior", photos: [1, 3], sameReason: "same window and radiator",
      condition: "peeling at the window", confidence: "medium",
    },
    { id: "p2", label: "Hall ceiling", surface: "ceiling", side: "interior", photos: [2], sameReason: null, condition: null, confidence: "low" },
  ],
  measurements: [
    { surfaceId: "p1", photo: 1, referenceId: "r1", widthInRefs: 3, heightInRefs: 1.5, basis: "door on the wall" },
    { surfaceId: "p1", photo: 3, referenceId: "r2", widthInRefs: 52, heightInRefs: 26, basis: "outlet plate" },
    { surfaceId: "p1", photo: 3, referenceId: "r1", widthInRefs: 50, heightInRefs: 50, basis: "door from another photo" },
    { surfaceId: "p2", photo: 2, referenceId: "r3", widthInRefs: 2, heightInRefs: 2, basis: "" },
    { surfaceId: "nope", photo: 2, referenceId: "r3", widthInRefs: 2, heightInRefs: 2, basis: "" },
  ],
};
const photoRead = sanitisePhotoRead(rawPhotos, 3);
ok("a reference in a photo that was never sent is dropped", !photoRead.references.some((r) => r.id === "rX"));
ok("a reference cannot scale a surface in another photo", photoRead.surfaces[0].measurements.length === 2, photoRead.surfaces[0].measurements);
const pq = photoSurfaceQuantity(photoRead.surfaces[0], "sqft");
ok("one wall in photos 1 and 3 is ONE quantity (3 × 1.5 doors = 20 ft × 10 ft), not two added", pq.photos.join(",") === "1,3" && pq.value === 200 && pq.widthFt === 20 && pq.heightFt === 10, pq);
ok("…from the reference that varies least (the door), the outlet plate kept as corroboration", pq.photo === 1 && /interior door/.test(pq.reference) && pq.others.length === 1 && pq.others[0].value === 190.13, pq);
ok("labelled from photo — estimated, verify, with the reference", pq.label === PHOTO_ESTIMATE_LABEL && /photo 1, scaled on standard interior door, 80 in/.test(pq.sourceText), pq.sourceText);
ok("the grouping is said in words", groupingSentence(photoRead.surfaces[0]) === "Photos 1 and 3 show the same north wall");
const split = splitPhotoSurface(photoRead, "p1");
ok("split → one surface per photo, each with only its own measurements", split.surfaces.filter((s) => s.splitFrom === "p1").length === 2 && split.surfaces.find((s) => s.id === "p1.1").measurements.every((m) => m.photo === 1));
const merged = mergePhotoSurfaces(split, ["p1.1", "p1.2"]);
ok("merge → one surface again, quantity re-chosen from both, still once", merged.surfaces.filter((s) => s.photos.join(",") === "1,3").length === 1 && photoSurfaceQuantity(merged.surfaces.find((s) => s.id === "p1.1"), "sqft").value === pq.value);

const bothCtx = { ...ctx, photoIds: new Set(photoRead.surfaces.map((s) => s.id)) };
const both = computeProject(
  sanitiseSynthesis({ ...rawSynthesis, surfaces: [{ ...rawSynthesis.surfaces[0], id: "b1", itemKey: "walls", photoSurfaceId: "p1" }] }, bothCtx),
  { dims, book: books.interior_painting, photoRead },
);
ok("drawings win over a photo for the size", both.surfaces[0].quantity.source === "drawing" && both.surfaces[0].quantity.value === 1041);
ok("…and the disagreement becomes a question", both.questions.some((x) => x.source === "conflict" && /photo 1 suggests about 200/.test(x.text)), both.questions);
const card = both.photoSurfaces.find((g) => g.id === "p1");
ok("the Photos card says the drawing matched (\"Matches drawing A-201\") and still shows the photo estimate", card.drawing === "A-201" && card.estimate.value === 200 && card.linkedTo.includes("b1"), card);
ok("a photo surface nothing in the overview uses has no drawing badge", both.photoSurfaces.find((g) => g.id === "p2").drawing === null);
const photoOnly = computeProject(
  sanitiseSynthesis({ ...rawSynthesis, surfaces: [{ ...rawSynthesis.surfaces[0], id: "b2", itemKey: "walls", lengthRefs: [], widthRefs: [], photoSurfaceId: "p1" }] }, bothCtx),
  { dims, book: books.interior_painting, photoRead },
);
ok("with no drawing, the photo gives the quantity — estimated, with its range", photoOnly.surfaces[0].quantity.source === "photo" && photoOnly.surfaces[0].quantity.estimated && photoOnly.surfaces[0].quantity.low <= photoOnly.surfaces[0].quantity.value);

// ═══════════════════════════════════════════════════════════════════════════
section("7. Chat: cached prefix, persisted turns");
// ═══════════════════════════════════════════════════════════════════════════

const readRow = {
  id: "pr1",
  title: "St. Mark's",
  trade: "painting",
  clientRequest: "Repaint interior and exterior",
  status: "ready",
  model,
  sheets: sheets.map((s) => ({ ...s, read: { relevant: true, summary: "", areas: [], heights: [], finishes: [], access: [] } })),
  excelRows: null,
  photoRead: null,
  documents: [{ id: "doc-pdf", kind: "plan", mimeType: "application/pdf", url: "https://res.cloudinary.com/x/raw/upload/fieldquo/companies/co1/plans/a.pdf", supersedesId: null, pages: [] }],
  progress: {},
};
const ctx1 = chatContext(readRow, books.interior_painting);
const ctx2 = chatContext(JSON.parse(JSON.stringify(readRow)), books.interior_painting);
ok("the fixed context is deterministic across turns", ctx1 === ctx2);
const turn1 = chatPrompt({ context: ctx1, model, history: [], message: "exclude the basement" });
const turn2 = chatPrompt({ context: ctx2, model: personPriced.model, history: [{ role: "user", text: "exclude the basement" }, { role: "assistant", text: "Done." }], message: "the bell tower needs a 60 ft lift" });
const prefix = (s) => s.slice(0, s.indexOf(CHAT_DYNAMIC_MARK));
ok("two turns share the prefix byte for byte", prefix(turn1) === prefix(turn2) && prefix(turn1).length > 1000, [prefix(turn1).length, prefix(turn2).length]);
ok("the prefix holds no project model and no messages", !prefix(turn1).includes("exclude the basement") && !prefix(turn2).includes("x1"));

const calls = [];
const scripted = (replies) => async (args) => {
  calls.push(args);
  const r = replies.shift();
  await args.onUsage?.({ model: "gpt-5.5", promptTokens: 14000, completionTokens: 900, cachedTokens: calls.length > 1 ? 12800 : 0, imageCount: (args.images || []).length });
  return r;
};
const debits = [];
const meterFor = async (feature) => ({
  check: async () => ({ allowed: true, feature }),
  record: async (u, { ref }) => {
    const cents = Math.ceil((estimateCostMicros(u) * 2) / 10000);
    debits.push({ ref, cents, cachedTokens: u.cachedTokens });
    return { chargedCents: cents };
  },
});
const turn = await chatTurn(
  { read: readRow, companyId: "co1", userId: "u1", message: "The bell tower needs a 60 ft lift", history: [] },
  {
    complete: scripted([
      { ok: true, data: { reply: "Added a 60 ft boom lift for the tower.", openSheets: [], ops: [{ op: "set_access", surfaceId: null, areaId: "a1", accessId: null, questionId: null, itemKey: null, coats: null, productKey: null, include: null, lengthRefs: [], widthRefs: [], multiplier: null, count: null, estimate: null, estimateBasis: null, label: null, side: null, equipment: "boom_lift", workingHeightFt: 60, text: "bell tower" }] } },
    ]),
    meterFor,
    books,
    turnId: "t1",
  },
);
ok("a chat turn applies its ops to the model", turn.ok && turn.model.access[0].workingHeightFt === 60 && turn.changes.length === 1, turn);
ok("the turn names the read as its prompt-cache key", calls[0].promptCacheKey === "plan_read:pr1");
ok("the turn is charged through the wallet meter, by ref", debits.length === 1 && debits[0].ref === "plan_read_chat:pr1:t1:0" && debits[0].cents > 0, debits);
calls.length = 0;
debits.length = 0;
const reopen = await chatTurn(
  { read: { ...readRow, documents: [{ ...readRow.documents[0], pages: [{ page: 1, url: "https://res.cloudinary.com/x/image/upload/v1/fieldquo/companies/co1/plans/p1.jpg", width: 3200, height: 2133 }] }] }, companyId: "co1", userId: "u1", message: "how tall is the tower on A-201?", history: [] },
  {
    complete: scripted([
      { ok: true, data: { reply: "", openSheets: ["A-201"], ops: [] } },
      { ok: true, data: { reply: "68 ft to the top.", openSheets: [], ops: [] } },
    ]),
    meterFor,
    books,
    turnId: "t2",
  },
);
ok("asking to re-open a sheet makes ONE more call with that sheet's images", calls.length === 2 && calls[0].images.length === 0 && calls[1].images.length === 5 && reopen.opened[0].includes("A-201"), calls.map((c) => c.images.length));
ok("…on the same cached prefix", prefix(calls[0].prompt) === prefix(calls[1].prompt));
ok("cached tokens are reported and priced at the cached rate", debits[1].cachedTokens === 12800 && debits[1].cents < debits[0].cents, debits);
ok("cached tokens cost a tenth: 10k cached gpt-5.5 tokens = $0.005", estimateCostMicros({ model: "gpt-5.5", promptTokens: 10000, completionTokens: 0, cachedTokens: 10000 }) === 5000);
ok("…and a call that reports none costs what it always did", estimateCostMicros({ model: "gpt-5.5", promptTokens: 10000, completionTokens: 0 }) === 50000);
debits.length = 0;
const failed1 = await chatTurn(
  { read: readRow, companyId: "co1", userId: "u1", message: "hi", history: [] },
  { complete: scripted([{ ok: false, reason: "vendor_error" }]), meterFor, books, recordAiUsage: async () => null, turnId: "t3" },
);
ok("a turn that fails is not charged", !failed1.ok && debits.length === 0);
const msgRoute = code("app/api/plan-reads/[id]/messages/route.js");
ok("both messages and the model are written in ONE transaction", /db\.\$transaction\(\[[\s\S]*planReadMessage\.create[\s\S]*planReadMessage\.create[\s\S]*planRead\.updateMany/.test(msgRoute));
const providerSrc = code("lib/ai/provider.js");
ok("provider reports cached tokens and sends the cache key only when named", /cachedTokens: res\.usage\.prompt_tokens_details\?\.cached_tokens/.test(providerSrc) && /promptCacheKey \? \{ prompt_cache_key/.test(providerSrc));

// ═══════════════════════════════════════════════════════════════════════════
section("8. Credit: held, settled, refunded");
// ═══════════════════════════════════════════════════════════════════════════

function memDb(seed) {
  const t = JSON.parse(JSON.stringify(seed));
  const match = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "OR") return v.some((w) => match(row, w));
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
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
    findMany: async ({ where } = {}) => (t[name] || []).filter((x) => match(x, where)).map((x) => ({ ...x })),
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
}
const ledger = [];
const ledgerDeps = {
  featureAllowsSpend: async () => true,
  aiBalanceFor: async () => 500,
  debitCredit: async (e) => {
    ledger.push({ ...e, cents: -e.cents });
    return { id: "e1" };
  },
  refundReservation: async (e) => {
    ledger.push({ ...e, refund: true });
    return { id: "r1" };
  },
  recordAiUsage: async () => null,
  similarPastQuotes: async () => ({ family: "church", matches: [], range: null }),
};
const baseRead = {
  id: "pr2",
  companyId: "co1",
  title: "Church",
  trade: "painting",
  clientRequest: "",
  status: "draft",
  sheets: [{ ...elev, key: "p1", docId: "d1", docPage: 1, read: null, scanDims: [] }],
  excelRows: null,
  photoRead: null,
  progress: null,
  usage: null,
  reservedCents: 0,
  reservationRef: null,
  chargedCents: 0,
  leaseUntil: null,
};
const docs = [{ id: "d1", planReadId: "pr2", kind: "plan", mimeType: "application/pdf", supersedesId: null, url: "https://res.cloudinary.com/x/raw/upload/a.pdf", pages: [{ page: 1, url: "https://res.cloudinary.com/x/image/upload/v1/fieldquo/companies/co1/plans/p.jpg", width: 3200, height: 2133 }] }];

const poor = memDb({ planRead: [baseRead], quoteDocument: docs });
const refused = await startRead({ planReadId: "pr2", companyId: "co1" }, { ...ledgerDeps, db: poor, aiBalanceFor: async () => 3 });
ok("short of credit → refused with the numbers, nothing debited", refused.status === 402 && refused.needCents > 3 && refused.shortfallCents === refused.needCents - 3 && ledger.length === 0, refused);
ok("…and the read is not marked running", poor.t.planRead[0].status === "draft");

const mem = memDb({ planRead: [baseRead], quoteDocument: docs });
const started = await startRead({ planReadId: "pr2", companyId: "co1" }, { ...ledgerDeps, db: mem });
ok("start holds the estimate under one ref, kind plan_read", started.ok && ledger[0].kind === "plan_read" && ledger[0].cents === -started.heldCents && /^plan_read:pr2:/.test(ledger[0].ref), ledger);
const again = await startRead({ planReadId: "pr2", companyId: "co1" }, { ...ledgerDeps, db: mem });
ok("a second click starts nothing and holds nothing", again.resumed && ledger.length === 1);
const goodModel = {
  ok: true,
  data: { ...rawSynthesis, surfaces: [{ ...rawSynthesis.surfaces[0], lengthRefs: ["p1.d1"], widthRefs: ["p1.d2"] }], access: [] },
};
const sheetReply = { ok: true, data: { relevant: true, summary: "North elevation", areas: [{ name: "North wall", side: "exterior", dimRefs: ["p1.d1", "p1.d2", "p9.zz"], note: null }], heights: [], finishes: [], access: [], readDims: [] } };
let clock = 0;
const runCalls = [];
const runComplete = async (args) => {
  runCalls.push(args);
  await args.onUsage?.({ model: args.tier === "best" ? "gpt-5.5" : "gpt-5-mini", promptTokens: 20000, completionTokens: 3000, cachedTokens: 0, imageCount: (args.images || []).length });
  return args.schemaName === "plan_read_sheet" ? sheetReply : goodModel;
};
const adv = await advanceRead("pr2", { companyId: "co1", budgetMs: 10_000_000 }, { ...ledgerDeps, db: mem, complete: runComplete, now: () => (clock += 1000) });
const row = mem.t.planRead[0];
ok("the read finishes", adv.state === "ready" && row.status === "ready" && row.model?.surfaces?.length === 1, adv);
ok("a sheet pass sends the sheet overview and four tiles at high detail", runCalls[0].images.length === 5 && runCalls[0].imageDetail === "high" && /c_crop/.test(runCalls[0].images[1]));
ok("…and only dimension ids that exist survive its answer", row.sheets[0].read.areas[0].dimRefs.join(",") === "p1.d1,p1.d2");
const actualCents = Math.ceil((row.usage.run.vendorMicros * 2) / 10000);
ok("settled to the actual cost × 2, the rest refunded under the hold's ref", adv.chargedCents === Math.min(started.heldCents, actualCents) && ledger.some((e) => e.refund && e.ref === ledger[0].ref && e.cents === started.heldCents - adv.chargedCents), { adv, ledger, actualCents });
ok("the charge never exceeds the hold", settlement({ reservedCents: 100, runVendorMicros: 10_000_000 }).chargedCents === 100);
ok("token totals are kept per step", row.usage.byStep.sheets.calls === 1 && row.usage.byStep.synthesis.calls === 1 && row.usage.promptTokens === 40000, row.usage);
ok("the synthesis runs on the best tier with the read's cache key", runCalls[1].tier === "best" && runCalls[1].promptCacheKey === "plan_read:pr2");

ledger.length = 0;
const memFail = memDb({ planRead: [{ ...baseRead, id: "pr3" }], quoteDocument: docs.map((d) => ({ ...d, planReadId: "pr3" })) });
await startRead({ planReadId: "pr3", companyId: "co1" }, { ...ledgerDeps, db: memFail });
const held = -ledger[0].cents;
const advFail = await advanceRead("pr3", { companyId: "co1", budgetMs: 10_000_000 }, {
  ...ledgerDeps,
  db: memFail,
  complete: async (args) => (args.schemaName === "plan_read_sheet" ? sheetReply : { ok: false, reason: "vendor_error" }),
  now: () => (clock += 1000),
});
ok("a read that fails is refunded IN FULL", advFail.state === "failed" && ledger.some((e) => e.refund && e.cents === held) && memFail.t.planRead[0].status === "failed", ledger);
ok("…and the sheets it did read are kept for the retry", memFail.t.planRead[0].sheets[0].read !== null);
ok("a retry pays only for what is left", estimateRead({ sheets: 1, sheetsAlreadyRead: 1 }).cents < estimateRead({ sheets: 1 }).cents);

const memSlow = memDb({ planRead: [{ ...baseRead, id: "pr4", status: "reading", reservedCents: 50, reservationRef: "plan_read:pr4:x" }], quoteDocument: docs.map((d) => ({ ...d, planReadId: "pr4" })) });
const paused = await advanceRead("pr4", { companyId: "co1", budgetMs: 100_000 }, { ...ledgerDeps, db: memSlow, complete: runComplete, now: () => (clock += 1000) });
ok("out of time before the synthesis → it pauses, lease released, to resume", paused.state === "more" && memSlow.t.planRead[0].status === "reading" && memSlow.t.planRead[0].leaseUntil === null && memSlow.t.planRead[0].sheets[0].read);
const busy = await advanceRead("pr4", { companyId: "co1" }, { ...ledgerDeps, db: { ...memSlow, planRead: { ...memSlow.planRead, updateMany: async () => ({ count: 0 }) } } });
ok("a second worker cannot take a held lease", busy.state === "busy");
ok("plan_read and plan_read_chat spend the AI wallet", poolForKind("plan_read") === POOLS.AI && poolForKind("plan_read_chat") === POOLS.AI);
ok("both are per-call kinds checkSpend cannot wave through", SPEND_KINDS.plan_read?.perCall && SPEND_KINDS.plan_read_chat?.perCall);
ok("the chat is a wired, wallet-paid feature", payerFeature("plan_read_chat")?.companyLedger === "wallet" && payerFeature("plan_read_chat").wired === true);
ok("the chat route goes through meterFor(\"plan_read_chat\")", /meterFor\("plan_read_chat"/.test(code("lib/planRead/chat.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("9. Past quotes: this company's only");
// ═══════════════════════════════════════════════════════════════════════════

const paintGroup = (sqft, subtotal, label = "Interior") => ({
  label,
  subtotal,
  intakeValues: {},
  category: { key: "interior_painting" },
  takeoff: { model: "area_substrate", estimateType: "interior", areas: [{ areaType: "den", label, measurement: "surface", surfaceSqft: sqft, substrates: [{ key: "walls", quantity: null, driver: "wallSqft" }] }] },
});
const history = [
  { id: "q1", companyId: "co1", quoteNumber: "Q-1", status: "accepted", createdAt: new Date("2026-05-01"), notes: "St. Paul's church repaint", siteAddress: "", client: { name: "St Paul" }, scopeGroups: [paintGroup(4000, 9200)] },
  { id: "q2", companyId: "co1", quoteNumber: "Q-2", status: "accepted", createdAt: new Date("2026-06-01"), notes: "Chapel interior", siteAddress: "", client: { name: "Grace" }, scopeGroups: [paintGroup(3000, 7500)] },
  { id: "q3", companyId: "co1", quoteNumber: "Q-3", status: "declined", createdAt: new Date("2026-07-01"), notes: "Church hall", siteAddress: "", client: { name: "X" }, scopeGroups: [paintGroup(2000, 9000)] },
  { id: "q9", companyId: "OTHER", quoteNumber: "Z-9", status: "accepted", createdAt: new Date("2026-07-01"), notes: "Cathedral", siteAddress: "", client: { name: "Rival" }, scopeGroups: [paintGroup(5000, 5000)] },
];
const sim = summariseSimilar(history, { companyId: "co1", family: "church", sqft: 3500 });
ok("another company's quote never appears", !sim.matches.some((m) => m.quoteId === "q9"));
ok("church jobs found by their own words", sim.matches.filter((m) => m.sameType).length === 3);
ok("the range is from WON jobs of the same type only: $2.30–$2.50/sq ft", sim.range?.low === 2.3 && sim.range.high === 2.5 && sim.range.count === 2, sim.range);
let capturedWhere = null;
await similarPastQuotes({ companyId: "co1", buildingType: "church", sqft: 3000 }, { prisma: { quote: { findMany: async ({ where }) => { capturedWhere = where; return history; } } } });
ok("the query itself is scoped to the company", capturedWhere?.companyId === "co1");
ok("no cross-tenant benchmark module is used", !/benchmarkData|collectPricedRows/.test(code("lib/planRead/similar.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("10. Quote files carry to the job's Documents");
// ═══════════════════════════════════════════════════════════════════════════

const cloudName = "fq";
const url = (n) => `https://res.cloudinary.com/fq/raw/upload/fieldquo/companies/co1/plans/${n}`;
function jobDb(quoteDocs) {
  const jobDocs = [];
  const uniq = (d) => jobDocs.some((x) => x.sourceQuoteId === d.sourceQuoteId && x.kind === d.kind && x.documentHash === d.documentHash) || (d.supersedesId && jobDocs.some((x) => x.supersedesId === d.supersedesId));
  return {
    jobDocs,
    quote: { findUnique: async ({ where }) => (where.id === "q1" ? { id: "q1", companyId: "co1" } : null) },
    job: { findFirst: async ({ where }) => (where.id === "j1" && where.companyId === "co1" && where.quoteId === "q1" ? { id: "j1" } : null) },
    quoteDocument: { findMany: async ({ where }) => quoteDocs.filter((d) => d.companyId === where.companyId && d.quoteId === where.quoteId) },
    jobDocument: {
      findMany: async () => jobDocs.map((d) => ({ id: d.id, documentHash: d.documentHash })),
      findFirst: async ({ where }) => jobDocs.find((d) => d.documentHash === where.documentHash) || null,
      create: async ({ data }) => {
        if (uniq(data)) throw Object.assign(new Error("dup"), { code: "P2002" });
        const row = { id: `jd${jobDocs.length + 1}`, ...data };
        jobDocs.push(row);
        return { id: row.id };
      },
    },
  };
}
const qDocs = [
  { id: "B", companyId: "co1", quoteId: "q1", name: "Drawings rev B.pdf", kind: "plan", url: url("b.pdf"), sizeBytes: 2000, mimeType: "application/pdf", supersedesId: "A", uploadedById: "u1" },
  { id: "A", companyId: "co1", quoteId: "q1", name: "Drawings.pdf", kind: "plan", url: url("a.pdf"), sizeBytes: 1000, mimeType: "application/pdf", supersedesId: null, uploadedById: "u1" },
  { id: "X", companyId: "co1", quoteId: "q1", name: "Scope.xlsx", kind: "other", url: url("s.xlsx"), sizeBytes: 300, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", supersedesId: null, uploadedById: "u1" },
  { id: "P", companyId: "co1", quoteId: "q1", name: "Permit.pdf", kind: "permit", url: url("p.pdf"), sizeBytes: 50, mimeType: "application/pdf", supersedesId: null, uploadedById: null },
  { id: "H", companyId: "co1", quoteId: "q1", name: "North wall.jpg", kind: "photo", url: "https://res.cloudinary.com/fq/image/upload/v1/fieldquo/companies/co1/plans/h", sizeBytes: 900, mimeType: "image/jpeg", supersedesId: null, uploadedById: null },
  { id: "E", companyId: "co1", quoteId: "q1", name: "Evil.pdf", kind: "plan", url: "https://evil.example/a.pdf", sizeBytes: 1, mimeType: "application/pdf", supersedesId: null, uploadedById: null },
];
ok("chain order puts a revision after what it revises", quoteDocumentsInChainOrder(qDocs).map((d) => d.id).indexOf("A") < quoteDocumentsInChainOrder(qDocs).map((d) => d.id).indexOf("B"));
const jdb = jobDb(qDocs);
const filed1 = await fileQuoteDocumentsOnJob({ quoteId: "q1", jobId: "j1" }, { db: jdb, cloudName, recordError: async () => null });
ok("every file on our cloud is filed; a foreign URL is not", filed1.filed === 5 && !jdb.jobDocs.some((d) => d.url.includes("evil")), filed1);
const jd = (name) => jdb.jobDocs.find((d) => d.name === name);
ok("kinds kept: plan, permit, photo, and the spreadsheet as other", jd("Drawings.pdf").kind === "plan" && jd("Permit.pdf").kind === "permit" && jd("North wall.jpg").kind === "photo" && jd("Scope.xlsx").kind === "other");
ok("name, size and type kept", jd("Scope.xlsx").sizeBytes === 300 && /spreadsheetml/.test(jd("Scope.xlsx").mimeType));
ok("the revision chain is kept: B's copy supersedes A's copy", jd("Drawings rev B.pdf").supersedesId === jd("Drawings.pdf").id);
ok("each copy is keyed qd:<id> under the quote, source quote_upload", jd("Drawings.pdf").documentHash === quoteUploadHash("A") && jd("Drawings.pdf").sourceQuoteId === "q1" && jd("Drawings.pdf").source === "quote_upload");
const filed2 = await fileQuoteDocumentsOnJob({ quoteId: "q1", jobId: "j1" }, { db: jdb, cloudName, recordError: async () => null });
ok("re-approval files nothing twice", filed2.filed === 0 && filed2.present === 5 && jdb.jobDocs.length === 5, filed2);
const wrongJob = await fileQuoteDocumentsOnJob({ quoteId: "q1", jobId: "other-job" }, { db: jdb, cloudName, recordError: async () => null });
ok("a job that isn't this quote's gets nothing", wrongJob.refused === "job_not_for_quote");
ok("acceptance carries them (quoteLifecycle) and the job's Documents catches up lazily", /fileQuoteDocumentsOnJob\(\{ quoteId, jobId: job\.id \}\)/.test(code("lib/quotes/quoteLifecycle.js")) && /fileQuoteDocumentsOnJob\(/.test(code("app/api/jobs/[id]/documents/route.js")));
const vBad = validateQuoteDocument({ kind: "contract", url: url("c.pdf") }, { companyId: "co1", canSeeMoney: true, cloudName });
ok("a hand-uploaded \"contract\" on a quote is refused (FieldQuo files those)", !vBad.ok && vBad.status === 400);
const vOther = validateQuoteDocument({ kind: "plan", url: "https://res.cloudinary.com/fq/raw/upload/fieldquo/companies/OTHER/plans/a.pdf" }, { companyId: "co1", canSeeMoney: true, cloudName });
ok("a file in another company's folder is refused", !vOther.ok);
const vPages = validateQuoteDocument(
  { kind: "plan", url: url("a.pdf"), mimeType: "application/pdf", pages: [{ page: 1, url: "https://res.cloudinary.com/fq/image/upload/v1/fieldquo/companies/co1/plans/p1", width: 3200, height: 2133, pointsWidth: 2592, pointsHeight: 1728 }, { page: 2, url: "https://elsewhere.example/p2.jpg", width: 3200, height: 2133 }] },
  { companyId: "co1", canSeeMoney: true, cloudName },
);
ok("page images are kept only from the company's own folder", vPages.ok && vPages.data.pages.length === 1);

// ═══════════════════════════════════════════════════════════════════════════
section("11. Upload scope \"plans\"");
// ═══════════════════════════════════════════════════════════════════════════

const plans = uploadScope("member", { companyId: "co1", purpose: "plans" });
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
ok("plans scope takes a 90 MB drawing set", planUpload({ type: "application/pdf", size: 90 * 1024 * 1024 }, plans).ok);
ok("…an .xlsx and a .csv", planUpload({ type: XLSX, size: 1000 }, plans).ok && planUpload({ type: "text/csv", size: 1000 }, plans).ok);
ok("…and photos", planUpload({ type: "image/jpeg", size: 5_000_000 }, plans).ok);
const xls = classifyMedia({ type: "application/vnd.ms-excel", size: 1000 }, { allowPlanDocuments: true });
ok("an old .xls is refused with the way out", !xls.ok && /save it as \.xlsx/.test(xls.error), xls);
ok("a 110 MB set is refused before the upload", !planUpload({ type: "application/pdf", size: 110 * 1024 * 1024 }, plans).ok);
ok("the plan's own Cloudinary limit binds when lower", planUpload({ type: "application/pdf", size: 20 * 1024 * 1024 }, plans, { planLimits: { raw_max_size_bytes: 10 * 1024 * 1024 } }).code === "too_large");
const docsScope = uploadScope("member", { companyId: "co1", purpose: "documents" });
ok("every other scope is unchanged: no spreadsheets on documents", !planUpload({ type: XLSX, size: 1000 }, docsScope).ok && !("allowPlanDocuments" in docsScope));
ok("a raw .xlsx id is ours in plans, not in documents", isOwnPublicId("fieldquo/companies/co1/plans/12345678-1234-1234-1234-123456789abc.xlsx", plans, "raw") && !isOwnPublicId("fieldquo/companies/co1/documents/12345678-1234-1234-1234-123456789abc.xlsx", docsScope, "raw"));

// ═══════════════════════════════════════════════════════════════════════════
section("12. The approved cost envelope");
// ═══════════════════════════════════════════════════════════════════════════

const big = estimateRead({ sheets: 35, photos: 8, excelChars: 8000 });
ok(`a 35-sheet set with photos and a scope sheet: vendor ≈ $${(big.vendorMicros / 1e6).toFixed(2)}, inside $1.50–2.50 or below`, big.vendorMicros / 1e6 <= 2.5, big);
ok(`…charged up to ${big.cents} credits ($${(big.cents / 100).toFixed(2)}), expected ${big.expectedCents}`, big.cents >= big.expectedCents && big.expectedCents === Math.ceil((big.vendorMicros * 2) / 10000));
const chatVendor = estimateCostMicros({ model: "gpt-5.5", promptTokens: WALLET_ESTIMATES.plan_read_chat.prompt, completionTokens: WALLET_ESTIMATES.plan_read_chat.completion }) / 1e6;
ok(`a chat turn's stated estimate is $${chatVendor.toFixed(3)} vendor, inside $0.05–0.15`, chatVendor >= 0.05 && chatVendor <= 0.15);
ok(`…shown as about ${estimateChargeCents("plan_read_chat")} credits per message`, estimateChargeCents("plan_read_chat") === Math.ceil(chatVendor * 1e6 * 2 / 10000));
const ctxTokens = Math.ceil(chatContext(readRow, books.interior_painting).length / 4);
ok(`the chat's fixed context for the fixture is ~${ctxTokens} tokens — the cached part`, ctxTokens > 1024 && ctxTokens < 12_000, ctxTokens);
const u = addUsage(addUsage(null, { model: "gpt-5-mini", promptTokens: 100, completionTokens: 10 }, "sheets"), { model: "gpt-5.5", promptTokens: 50, completionTokens: 5, cachedTokens: 20 }, "synthesis");
ok("usage totals add across steps", u.promptTokens === 150 && u.cachedTokens === 20 && u.calls === 2 && u.byStep.sheets.calls === 1);

// ═══════════════════════════════════════════════════════════════════════════
section("13. Wiring");
// ═══════════════════════════════════════════════════════════════════════════

ok("check:plan-deep-read is in check:all", /check:plan-deep-read/.test(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts["check:all"]));
for (const p of [
  "app/api/plan-reads/route.js",
  "app/api/plan-reads/[id]/route.js",
  "app/api/plan-reads/[id]/documents/route.js",
  "app/api/plan-reads/[id]/run/route.js",
  "app/api/plan-reads/[id]/messages/route.js",
  "app/api/plan-reads/[id]/draft-quote/route.js",
  "app/api/quotes/[id]/documents/route.js",
]) {
  const src = existsSync(new URL(`../${p}`, import.meta.url)) ? code(p) : "";
  ok(`${p} exists, awaits params where it has them, and scopes to the member's company`, src && (!/\{ params \}/.test(src) || /await params/.test(src)) && /member\.companyId/.test(src));
}
ok("the quote builder opens a drawing read's draft (?fromPlanRead)", /fromPlanRead/.test(code("app/components/quotes/builder/QuoteBuilder.js")) && /\/api\/plan-reads\/\$\{planReadId\}\/draft-quote/.test(code("app/components/quotes/builder/QuoteBuilder.js")));
ok("POST /api/quotes links the read and its files, scoped", /sourcePlanReadId/.test(code("app/api/quotes/route.js")) && /planReadId: planRead\.id, quoteId: null/.test(code("app/api/quotes/route.js")));
ok("the AI is called only through lib/ai/provider.js", !/new OpenAI|from "openai"/.test(["lib/planRead/run.js", "lib/planRead/chat.js", "lib/planRead/prompts.js"].map(code).join("\n")));


// ═══════════════════════════════════════════════════════════════════════════
section("14. P0 speed: every sheet at once, photos beside them — same model");
// ═══════════════════════════════════════════════════════════════════════════
//
// A scripted provider with REAL delays (milliseconds), so the order answers
// arrive in is shuffled by the clock, not by the script. The same read is
// run twice: the old order (one sheet at a time, photos after) and the new
// one. Everything the read produces must be the same bytes.

const md5 = (v) => createHash("md5").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");
const withoutAt = (v) => JSON.parse(JSON.stringify(v, (k, x) => (k === "at" ? undefined : x)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sheetN = (i) => ({
  ...elev,
  key: `p${i}`,
  page: i,
  docId: "dset",
  docPage: i,
  dims: elev.dims.map((x) => ({ ...x, id: x.id.replace(/^p\d+\./, `p${i}.`) })),
  pairs: [],
  read: null,
  scanDims: [],
});
const setDocs = (readId, n, photoCount = 0) => [
  {
    id: "dset", companyId: "co1", planReadId: readId, kind: "plan", mimeType: "application/pdf", supersedesId: null, url: "https://res.cloudinary.com/x/raw/upload/set.pdf",
    uploadedAt: new Date(Date.now() - 120_000).toISOString(),
    pages: Array.from({ length: n }, (_, k) => ({ page: k + 1, url: `https://res.cloudinary.com/x/image/upload/v1/fieldquo/companies/co1/plans/p${k + 1}.jpg`, width: 3200, height: 2133 })),
  },
  ...Array.from({ length: photoCount }, (_, k) => ({
    id: `ph${k + 1}`, companyId: "co1", planReadId: readId, kind: "photo", mimeType: "image/jpeg", supersedesId: null, name: `Photo ${k + 1}`,
    url: `https://res.cloudinary.com/x/image/upload/v1/fieldquo/companies/co1/plans/ph${k + 1}.jpg`, uploadedAt: new Date(Date.now() - 60_000).toISOString(), pages: null,
  })),
];
const setRead = (readId, n) => ({ ...baseRead, id: readId, sheets: Array.from({ length: n }, (_, k) => sheetN(k + 1)) });
const keyOf = (args) => JSON.parse(args.prompt).sheet.dims[0].id.split(".")[0];

/** The scripted provider: replies depend only on WHAT was asked, never on when. */
function scriptedProvider({ sheetDelay = (k) => 5 + ((Number(k.slice(1)) * 7) % 13) * 3, photoDelay = 60, synthDelay = 10, failures = {} } = {}) {
  const s = { calls: [], synthPrompts: [], sheetsInFlight: 0, maxSheetsInFlight: 0, overlapPhotoWithSheets: false, photoRunning: false };
  s.complete = async (args) => {
    s.calls.push(args.schemaName);
    if (args.schemaName === "plan_read_sheet") {
      const k = keyOf(args);
      s.sheetsInFlight += 1;
      s.maxSheetsInFlight = Math.max(s.maxSheetsInFlight, s.sheetsInFlight);
      if (s.photoRunning) s.overlapPhotoWithSheets = true;
      await wait(sheetDelay(k));
      s.sheetsInFlight -= 1;
      const f = failures[k];
      if (f && f.left > 0) {
        f.left -= 1;
        if (f.reason !== "vendor_error") await args.onUsage?.({ model: "gpt-5-mini", promptTokens: 20000, completionTokens: 8000, cachedTokens: 0, imageCount: 5 });
        return { ok: false, reason: f.reason, message: f.message || "" };
      }
      await args.onUsage?.({ model: "gpt-5-mini", promptTokens: 20000, completionTokens: 3000, cachedTokens: 0, imageCount: (args.images || []).length });
      return { ok: true, data: { relevant: true, summary: `Sheet ${k}`, areas: [{ name: `Wall ${k}`, side: "exterior", dimRefs: [`${k}.d1`, `${k}.d2`, "p99.zz"], note: null }], heights: [], finishes: [`PT-1 on ${k}`], access: [], readDims: [] } };
    }
    if (args.schemaName === "plan_read_photos") {
      s.photoRunning = true;
      if (s.sheetsInFlight > 0) s.overlapPhotoWithSheets = true;
      await wait(photoDelay);
      s.photoRunning = false;
      await args.onUsage?.({ model: "gpt-5.5", promptTokens: 9000, completionTokens: 4000, cachedTokens: 0, imageCount: (args.images || []).length });
      return { ok: true, data: rawPhotos };
    }
    s.synthPrompts.push(args.prompt);
    await wait(synthDelay);
    await args.onUsage?.({ model: "gpt-5.5", promptTokens: 30000, completionTokens: 9000, cachedTokens: 0, imageCount: 0 });
    return goodModel;
  };
  return s;
}

/** A fake ledger with the database's one rule that matters here:
 *  VoiceCreditEntry is @@unique([companyId, ref]), and writeEntry answers a
 *  duplicate with the row already there (lib/voice/credits.js). */
function uniqueLedger() {
  const rows = [];
  const write = (e) => rows.find((r) => r.companyId === e.companyId && r.ref === e.ref) || (rows.push(e), e);
  return {
    rows,
    debitCredit: async (e) => write({ ...e, cents: -e.cents }),
    refundReservation: async (e) => write({ companyId: e.companyId, cents: e.cents, ref: `refund:${e.ref}`, refund: true }),
  };
}
const p0Deps = (ledger) => ({ ...ledgerDeps, debitCredit: ledger.debitCredit, refundReservation: ledger.refundReservation });

async function runSet({ readId, n, photos = 0, order = {}, provider }) {
  const memX = memDb({ planRead: [setRead(readId, n)], quoteDocument: setDocs(readId, n, photos) });
  const lg = uniqueLedger();
  const st = await startRead({ planReadId: readId, companyId: "co1" }, { ...p0Deps(lg), db: memX });
  const t0 = Date.now();
  const out = await advanceRead(readId, { companyId: "co1", budgetMs: 10_000_000 }, { ...p0Deps(lg), db: memX, complete: provider.complete, ...order });
  return { mem: memX, row: memX.t.planRead[0], out, wallMs: Date.now() - t0, ledger: lg, held: st.heldCents };
}

const seqP = scriptedProvider();
const seq = await runSet({ readId: "pseq", n: 13, photos: 3, provider: seqP, order: { sheetConcurrency: 1, photosAlongside: false } });
const parP = scriptedProvider();
const par = await runSet({ readId: "ppar", n: 13, photos: 3, provider: parP });
ok("both orders finish", seq.out.state === "ready" && par.out.state === "ready", [seq.out, par.out]);
ok("old order: one sheet in flight at a time, photos only after the last sheet", seqP.maxSheetsInFlight === 1 && !seqP.overlapPhotoWithSheets, seqP.maxSheetsInFlight);
ok("new order: all 13 sheets of the reference set in ONE wave", parP.maxSheetsInFlight === 13, parP.maxSheetsInFlight);
ok("…with the photo pass running beside them", parP.overlapPhotoWithSheets);
ok("the synthesis prompt is byte-identical (md5) to the old order's", seqP.synthPrompts.length === 1 && md5(seqP.synthPrompts[0]) === md5(parP.synthPrompts[0]), [md5(seqP.synthPrompts[0] || ""), md5(parP.synthPrompts[0] || "")]);
ok("…and so is the project model", md5(seq.row.model) === md5(par.row.model) && Array.isArray(par.row.model?.surfaces));
ok("…and every sheet's stored pass, in sheet order (timestamps aside)", md5(withoutAt(seq.row.sheets)) === md5(withoutAt(par.row.sheets)) && par.row.sheets.map((s) => s.key).join() === Array.from({ length: 13 }, (_, k) => `p${k + 1}`).join());
ok("…and the photo pass", md5(seq.row.photoRead) === md5(par.row.photoRead) && par.row.photoRead?.surfaces?.length > 0);
ok("…and the progress, the token totals and the charge", md5(seq.row.progress) === md5(par.row.progress) && seq.row.usage.promptTokens === par.row.usage.promptTokens && seq.row.usage.byStep.sheets.calls === 13 && par.row.usage.byStep.sheets.calls === 13 && seq.row.chargedCents === par.row.chargedCents, [seq.row.chargedCents, par.row.chargedCents]);
ok(`and it is faster: ${par.wallMs} ms against ${seq.wallMs} ms for the same scripted calls`, par.wallMs * 2 < seq.wallMs, [par.wallMs, seq.wallMs]);

const wide = scriptedProvider({ sheetDelay: () => 5 });
await runSet({ readId: "pwide", n: 20, provider: wide });
ok(`20 sheets never put more than SHEET_CONCURRENCY (${SHEET_CONCURRENCY}) in flight`, wide.maxSheetsInFlight === SHEET_CONCURRENCY && SHEET_CONCURRENCY >= 8 && SHEET_CONCURRENCY <= 16, wide.maxSheetsInFlight);
const narrow = scriptedProvider({ sheetDelay: () => 5 });
await runSet({ readId: "pnarrow", n: 9, provider: narrow, order: { sheetConcurrency: 4 } });
ok("…and a lower limit is honoured exactly (4)", narrow.maxSheetsInFlight === 4, narrow.maxSheetsInFlight);

// ═══════════════════════════════════════════════════════════════════════════
section("15. P0 measure: each stage's clock on the read");
// ═══════════════════════════════════════════════════════════════════════════

const tPar = par.row.usage.timing;
const sPar = timingSummary(tPar);
const sSeq = timingSummary(seq.row.usage.timing);
ok("the click, the uploads and every slice are on the row", tPar?.v === 1 && tPar.startedAt > 0 && tPar.uploadDoneAt > tPar.uploadFirstAt && tPar.invocations.length === 1, tPar);
ok("every sheet's own start and end, with its attempts", Object.keys(tPar.sheets).length === 13 && Object.values(tPar.sheets).every((x) => x.end >= x.start && x.attempts === 1));
ok("photos started before the last sheet finished (side by side)", tPar.steps.photos.start < tPar.steps.sheets.end, tPar.steps);
ok("…and in the old order, only after it", seq.row.usage.timing.steps.photos.start >= seq.row.usage.timing.steps.sheets.end);
ok("the synthesis starts after both", tPar.steps.synthesis.start >= Math.max(tPar.steps.sheets.end, tPar.steps.photos.end));
ok("summary: total, sheets, photos, synthesis, outcome", sPar.outcome === "ready" && sPar.totalMs >= sPar.synthesisMs && sPar.sheetCount === 13 && sPar.photosMs > 0 && sPar.uploadSpanMs > 0 && sPar.waitBeforeReadMs >= 0, sPar);
ok(`measured on the row: ${sPar.totalMs} ms side by side against ${sSeq.totalMs} ms in order`, sPar.totalMs < sSeq.totalMs, [sPar.totalMs, sSeq.totalMs]);
ok("the compact form reads as a person would say it", formatDuration(42_400) === "42s" && formatDuration(185_000) === "3m 05s" && formatDuration(null) === null);
ok("absent stages are null, never 0", timingSummary({ v: 1, startedAt: 1, steps: {}, sheets: {}, invocations: [] }).photosMs === null && timingSummary(null) === null);
ok("medians come from finished reads only", timingMedians([sPar, sSeq, { ...sPar, outcome: "failed", totalMs: 1 }]).reads === 2);
ok("a read from before timings is not given invented ones", (await (async () => {
  const m = memDb({ planRead: [{ ...setRead("pold", 1), status: "reading", reservedCents: 50, reservationRef: "plan_read:pold:x", usage: { run: {} } }], quoteDocument: setDocs("pold", 1) });
  await advanceRead("pold", { companyId: "co1", budgetMs: 10_000_000 }, { ...p0Deps(uniqueLedger()), db: m, complete: scriptedProvider().complete });
  return m.t.planRead[0].status === "ready" && !m.t.planRead[0].usage.timing;
})()));
const viewTook = await planReadView({ ...par.row, documents: setDocs("ppar", 13, 3), messages: [] }, { companyId: "co1", canSeeMoney: true, prisma: { companyServiceCategory: { findMany: async () => [] } } });
ok("the estimator's screen gets the total (\"took …\") and nothing else of the clock", viewTook.timing?.totalMs === sPar.totalMs && viewTook.timing.outcome === "ready" && !("sheetsMs" in viewTook.timing), viewTook.timing);
const platformRoute = code("app/api/platform/plan-reads/route.js");
ok("/platform reads the stages and the per-step tokens, signed-in admins only", /getCurrentPlatformAdmin/.test(platformRoute) && /timingSummary/.test(platformRoute) && /byStep/.test(platformRoute) && !/\.(update|create|delete)(Many)?\(/.test(platformRoute));
ok("…and the AI usage page shows them", /<PlanReadTimings \/>/.test(code("app/platform/ai-usage/page.js")) && /\/api\/platform\/plan-reads/.test(code("app/components/platform/PlanReadTimings.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("16. P0 retries: a rate limit backs off; a sheet is never lost to time");
// ═══════════════════════════════════════════════════════════════════════════

ok("429 → three attempts, backing off 4 s then 8 s (+ jitter)", (() => {
  const f = { reason: "vendor_error", message: "429 Rate limit reached for gpt-5-mini" };
  const a = retryPlan(f, 1, () => 0), b = retryPlan(f, 2, () => 0), c = retryPlan(f, 3, () => 0);
  return a.retry && a.waitMs === 4000 && b.retry && b.waitMs === 8000 && !c.retry;
})());
ok("another vendor error → one retry after about a second (it billed nothing)", retryPlan({ reason: "vendor_error", message: "socket hang up" }, 1, () => 0).waitMs === 1000 && !retryPlan({ reason: "vendor_error" }, 2).retry);
ok("a billed failure (truncated) keeps its single immediate retry", retryPlan({ reason: "truncated" }, 1).waitMs === 0 && retryPlan({ reason: "truncated" }, 1).retry && !retryPlan({ reason: "truncated" }, 2).retry);
const sleeps = [];
const flaky = scriptedProvider({
  sheetDelay: () => 2,
  failures: { p2: { left: 2, reason: "vendor_error", message: "429 Rate limit reached" }, p3: { left: 5, reason: "truncated" } },
});
const fl = await runSet({ readId: "pflaky", n: 4, provider: flaky, order: { sleep: async (ms) => { sleeps.push(ms); } } });
const flSheet = (k) => fl.row.sheets.find((s) => s.key === k);
ok("a sheet rate-limited twice is read on the third attempt", !flSheet("p2").read.failed && fl.row.usage.timing.sheets.p2.attempts === 3, fl.row.usage.timing.sheets.p2);
ok("…after waiting, not hammering", sleeps.length === 2 && sleeps[0] >= 4000 && sleeps[1] >= 8000, sleeps);
ok("a sheet that keeps failing is marked unreadable after two, and the read still finishes", flSheet("p3").read.failed === true && fl.row.usage.timing.sheets.p3.attempts === 2 && fl.out.state === "ready");

// ═══════════════════════════════════════════════════════════════════════════
section("17. P0 backstop: a closed tab never stalls a paid read, and never pays twice");
// ═══════════════════════════════════════════════════════════════════════════

const bLedger = uniqueLedger();
const memB = memDb({
  planRead: [
    setRead("pstall", 3),
    { ...setRead("pheld", 2), status: "reading", reservedCents: 60, reservationRef: "plan_read:pheld:x", leaseUntil: new Date(Date.now() + 600_000).toISOString(), usage: { run: {} } },
    { ...setRead("pdone", 1), status: "ready", leaseUntil: null },
  ],
  quoteDocument: [...setDocs("pstall", 3), ...setDocs("pheld", 2).map((x) => ({ ...x, id: `${x.id}-h` })), ...setDocs("pdone", 1).map((x) => ({ ...x, id: `${x.id}-d` }))],
});
const leaseAtHold = [];
const bStart = await startRead({ planReadId: "pstall", companyId: "co1" }, {
  ...p0Deps(bLedger),
  db: memB,
  debitCredit: async (e) => {
    // The moment the hold is written: the row is "reading" — is it leased?
    leaseAtHold.push(memB.t.planRead[0].leaseUntil);
    return bLedger.debitCredit(e);
  },
});
ok("the start's claim keeps workers off the row until the hold is written", bStart.ok && leaseAtHold[0] && new Date(leaseAtHold[0]) > new Date(), leaseAtHold);
ok("…and lets go once it is", memB.t.planRead[0].leaseUntil === null && memB.t.planRead[0].reservationRef);
// The tab is closed: nobody polls. Two cron ticks land together.
const bProvider = scriptedProvider({ sheetDelay: () => 3 });
const bDeps = { db: memB, advanceDeps: { ...p0Deps(bLedger), db: memB, complete: bProvider.complete } };
const [tick1, tick2] = await Promise.all([resumeStalledReads({ now: new Date() }, bDeps), resumeStalledReads({ now: new Date() }, bDeps)]);
const states = [...tick1.results, ...tick2.results].filter((r) => r.id === "pstall").map((r) => r.state).sort();
ok("two ticks at once: one resumes the stalled read, the other finds it leased", states.join() === "busy,ready", [tick1, tick2]);
ok("a read another worker holds is left alone", ![...tick1.results, ...tick2.results].some((r) => r.id === "pheld") && memB.t.planRead[1].status === "reading");
ok("a finished read is never picked", ![...tick1.results, ...tick2.results].some((r) => r.id === "pdone"));
ok("the stalled read finished, from its sheets to its settle", memB.t.planRead[0].status === "ready" && bProvider.calls.filter((c) => c === "plan_read_synthesis").length === 1);
const bMoney = bLedger.rows.filter((r) => r.ref?.includes("pstall"));
ok("money: one hold, one refund of the unused part — the cron debited nothing", bMoney.filter((r) => r.cents < 0).length === 1 && bMoney.filter((r) => r.refund).length === 1 && -bMoney.reduce((a, r) => a + r.cents, 0) === memB.t.planRead[0].chargedCents, bMoney);
const tick3 = await resumeStalledReads({ now: new Date() }, bDeps);
ok("the next tick finds nothing to do", tick3.considered === 0, tick3);
ok("the backstop's query is advanceRead's own lease condition", JSON.stringify(stalledWhere(new Date(0))) === JSON.stringify({ status: "reading", OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date(0) } }] }));
const backstopSrc = code("lib/planRead/backstop.js");
ok("the backstop holds, debits and refunds nothing itself", !/debitCredit|refundReservation|startRead|settlement\(/.test(backstopSrc) && /advanceRead/.test(backstopSrc));
const cronSrc = code("app/api/cron/plan-reads/route.js");
ok("the cron route is behind the cron secret and scheduled", /requireCronSecret\(request\)/.test(cronSrc) && JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")).crons.some((c) => c.path === "/api/cron/plan-reads"));

// A worker that outlived its lease (an invocation the platform let run on):
// another worker settles the read meanwhile; the late one must change nothing.
const lLedger = uniqueLedger();
const memL = memDb({ planRead: [setRead("plate", 2)], quoteDocument: setDocs("plate", 2) });
await startRead({ planReadId: "plate", companyId: "co1" }, { ...p0Deps(lLedger), db: memL });
let release;
const gate = new Promise((r) => (release = r));
let inSynthesis = false;
const lateProvider = scriptedProvider({ sheetDelay: () => 2 });
const late = advanceRead("plate", { companyId: "co1", budgetMs: 10_000_000 }, {
  ...p0Deps(lLedger),
  db: memL,
  complete: async (args) => {
    if (args.schemaName === "plan_read_synthesis") {
      inSynthesis = true;
      await gate;
    }
    return lateProvider.complete(args);
  },
});
while (!inSynthesis) await wait(2);
memL.t.planRead[0].leaseUntil = new Date(Date.now() - 1000).toISOString();
const onTime = await advanceRead("plate", { companyId: "co1", budgetMs: 10_000_000 }, { ...p0Deps(lLedger), db: memL, complete: scriptedProvider().complete });
const chargedOnce = memL.t.planRead[0].chargedCents;
release();
const lateOut = await late;
ok("the worker that took over settles the read", onTime.state === "ready" && chargedOnce > 0, onTime);
ok("the late worker's settle changes nothing: the charge is not added twice", lateOut.state === "idle" && memL.t.planRead[0].chargedCents === chargedOnce && memL.t.planRead[0].status === "ready", [lateOut, memL.t.planRead[0].chargedCents, chargedOnce]);
ok("…and the hold is refunded once (the ledger's unique refund ref)", lLedger.rows.filter((r) => r.refund).length === 1 && -lLedger.rows.reduce((a, r) => a + r.cents, 0) === chargedOnce, lLedger.rows);
ok("the ledger really is unique on (companyId, ref), and a duplicate answers with the row already there", /@@unique\(\[companyId, ref\]\)/.test(readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8").match(/model VoiceCreditEntry \{[\s\S]*?\n\}/)?.[0] || "") && /P2002[\s\S]{0,120}findFirst\(\{ where: \{ companyId, ref \} \}\)/.test(code("lib/voice/credits.js")) && /ref: refundRefFor\(ref\)/.test(code("lib/voice/spendGate.js")));

const gLedger = uniqueLedger();
const memG = memDb({ planRead: [{ ...setRead("pgone", 2), status: "reading", reservedCents: 80, reservationRef: "plan_read:pgone:x", usage: { run: {}, timing: startTiming({ now: Date.now() - MAX_READ_MS - 60_000 }) } }], quoteDocument: setDocs("pgone", 2) });
const gProvider = scriptedProvider();
const gone = await advanceRead("pgone", { companyId: "co1", budgetMs: 10_000_000 }, { ...p0Deps(gLedger), db: memG, complete: gProvider.complete });
ok(`a read still running ${MAX_READ_MS / 60_000} min after its click is given up, refunded IN FULL, once`, gone.state === "failed" && memG.t.planRead[0].status === "failed" && gLedger.rows.length === 1 && gLedger.rows[0].cents === 80 && gProvider.calls.length === 0, gLedger.rows);

// ═══════════════════════════════════════════════════════════════════════════
section("18. P0 history: the estimator's own edits beside the chat's changes");
// ═══════════════════════════════════════════════════════════════════════════

ok("an edit that changed nothing logs nothing", editLogEntry({ changes: [], companyId: "co1", planReadId: "pr1", userId: "u1" }) === null && editLogEntry({ changes: ["  "], companyId: "co1", planReadId: "pr1" }) === null);
const logRow = editLogEntry({ changes: ["Measured North wall: 1,040 sq ft (traced on A-201)", "Priced Boom lift at $1,800"], companyId: "co1", planReadId: "pr1", userId: "u1" });
ok("an edit is a history row: who, what, role edit", logRow.role === "edit" && logRow.userId === "u1" && logRow.changes.length === 2 && /Measured North wall/.test(logRow.text) && logRow.companyId === "co1");
const mixed = [
  { id: "m1", role: "user", text: "exclude the basement", userId: "u1", createdAt: "2026-10-04T14:01:00Z" },
  { id: "m2", role: "assistant", text: "Done.", changes: ["Left out Basement"], userId: "u1", createdAt: "2026-10-04T14:01:05Z" },
  { id: "m3", ...logRow, createdAt: "2026-10-04T14:02:00Z" },
];
const hist = chatHistory(mixed);
ok("the chat model never sees an edit row as conversation", hist.length === 2 && !hist.some((h) => /Measured/.test(h.text)));
const promptWithEdits = chatPrompt({ context: ctx1, model, history: hist, message: "anything else?" });
ok("…so the prompt holds the conversation and not the edit", promptWithEdits.includes("exclude the basement") && !promptWithEdits.includes("Measured North wall"));
let authorWhere = null;
const authors = await withAuthors(mixed, { companyId: "co1", prisma: { member: { findMany: async ({ where }) => { authorWhere = where; return [{ userId: "u1", user: { name: "Emilio" } }]; } } } });
ok("names come from this company's members only", authorWhere?.companyId === "co1" && authors.u1 === "Emilio");
const viewHist = await planReadView({ ...readRow, messages: mixed }, { companyId: "co1", canSeeMoney: true, authors, prisma: { companyServiceCategory: { findMany: async () => [] } } });
ok("the screen gets one timeline, edits included, each with who and when", viewHist.messages.map((m) => m.role).join() === "user,assistant,edit" && viewHist.messages.every((m) => m.author === "Emilio" && m.createdAt) && viewHist.messages[2].changes.length === 2);
const patchSrc = code("app/api/plan-reads/[id]/route.js");
ok("PATCH writes the edit and its history row in ONE transaction", /db\.\$transaction\(\[[\s\S]*planRead\.updateMany[\s\S]*planReadMessage\.create\(\{ data: log \}\)/.test(patchSrc) && /editLogEntry\(\{ changes/.test(patchSrc));
ok("…renames and the client's wording are logged too", /Renamed the project/.test(patchSrc) && /Changed what the client wants/.test(patchSrc));
ok("the chat route sends chatHistory(), not the raw rows", /history: chatHistory\(read\.messages\)/.test(code("app/api/plan-reads/[id]/messages/route.js")));
ok("a chat reply records who asked", /userId: member\.userId \|\| null,\s*\}/.test(code("app/api/plan-reads/[id]/messages/route.js").replace(/\n\s*/g, " ").replace(/ +/g, " ")) || /chargedCents: turn\.chargedCents,[\s\S]{0,40}userId: member\.userId/.test(code("app/api/plan-reads/[id]/messages/route.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("19. P0 cache by file hash: the same PDF is not paid for twice — within ONE company");
// ═══════════════════════════════════════════════════════════════════════════

const bytesA = churchSet();
ok("the hash is the bytes' SHA-256", contentHashOf(bytesA) === createHash("sha256").update(bytesA).digest("hex") && contentHashOf(bytesA) !== contentHashOf(new Uint8Array([...bytesA, 32])));
const H = contentHashOf(bytesA);
const curDocs = [{ id: "dnew", companyId: "co1", planReadId: "pnew", kind: "plan", mimeType: "application/pdf", supersedesId: null, contentHash: H, pages: [] }];
const cur = { id: "pnew", companyId: "co1", trade: "painting", clientRequest: "Repaint the church", status: "draft", documents: curDocs, sheets: [1, 2].map((i) => ({ ...sheetN(i), docId: "dnew" })), photoRead: null, excelRows: null };
// The same file as the 5th and 6th sheets of an earlier read (keys renumbered).
const earlierSheets = [1, 2].map((i) => {
  const s = { ...sheetN(i + 4), docId: "dold", docPage: i };
  return { ...s, read: { relevant: true, summary: `old ${i}`, areas: [{ name: "Wall", side: "exterior", dimRefs: [`p${i + 4}.d1`, `p${i + 4}.d2`], note: null }], heights: [{ label: "eave", dimRef: `p${i + 4}.d3` }], finishes: [], access: [], at: "2026-10-01T00:00:00Z" }, scanDims: [{ id: `p${i + 4}.v1`, raw: "10'", feet: 10 }] };
});
const src = (over) => ({ id: "pold", companyId: "co1", title: "Church — first try", trade: "painting", clientRequest: "Repaint the church", readAt: "2026-10-01T00:00:00Z", sheets: earlierSheets, documents: [{ id: "dold", companyId: "co1", contentHash: H, planReadId: "pold" }], ...over });
const offers = reusableSheets({
  read: cur,
  companyId: "co1",
  sources: [
    src(),
    src({ id: "prival", companyId: "co2", title: "Rival's read of the same tender" }),
    src({ id: "pstain", trade: "staining" }),
    src({ id: "pother", documents: [{ id: "dold", companyId: "co1", contentHash: "f".repeat(64) }] }),
  ],
});
ok("an earlier read of the same bytes in the same company is offered, sheet for sheet", offers.length === 1 && offers[0].fromId === "pold" && offers[0].sheets.map((x) => `${x.key}<${x.fromKey}`).join() === "p1<p5,p2<p6" && offers[0].sameRequest, offers);
ok("ANOTHER COMPANY's read of the identical file is never offered", !offers.some((o) => o.fromId === "prival"));
ok("nor a read for another trade, nor a different file", !offers.some((o) => o.fromId === "pstain" || o.fromId === "pother"));
ok("a read in another company is offered nothing at all", reusableSheets({ read: cur, companyId: "co2", sources: [src({ companyId: "co2" })] }).length === 0);
ok("a failed or differently-extracted sheet is read fresh", reusableSheets({ read: cur, companyId: "co1", sources: [src({ sheets: [{ ...earlierSheets[0], read: { ...earlierSheets[0].read, failed: true } }, { ...earlierSheets[1], dims: earlierSheets[1].dims.slice(1) }] })] }).length === 0);
ok("a different client request is said, not hidden", reusableSheets({ read: { ...cur, clientRequest: "Exterior only" }, companyId: "co1", sources: [src()] })[0].sameRequest === false);
const applied = applySheetReuse(cur.sheets, offers[0], src());
const a1 = applied.sheets[0];
ok("reused passes are renumbered onto this read's sheets", applied.reused === 2 && a1.read.areas[0].dimRefs.join() === "p1.d1,p1.d2" && a1.read.heights[0].dimRef === "p1.d3" && a1.scanDims[0].id === "p1.v1" && a1.reusedFrom.planReadId === "pold");
ok("…and a sheet read since the offer keeps its own", applySheetReuse([{ ...cur.sheets[0], read: { summary: "mine" } }, cur.sheets[1]], offers[0], src()).sheets[0].read.summary === "mine");
const wheres = [];
const fakePrisma = {
  quoteDocument: { findMany: async ({ where }) => { wheres.push(["quoteDocument", where]); return [{ id: "dold", companyId: "co1", contentHash: H, planReadId: "pold" }, { id: "dx", companyId: "co2", contentHash: H, planReadId: "prival" }]; } },
  // A query that leaked another company's row would still be dropped.
  planRead: { findMany: async ({ where }) => { wheres.push(["planRead", where]); return [src(), src({ id: "prival", companyId: "co2" })]; } },
};
const found = await findSheetCache(cur, { companyId: "co1", prisma: fakePrisma });
ok("both lookups are keyed by the member's company", wheres.length === 2 && wheres.every(([, w]) => w.companyId === "co1"), wheres);
ok("…and a leaked row from another company is dropped in code too", found.offers.length === 1 && found.offers[0].fromId === "pold");
ok("no lookup at all when nothing unread has a hash", (await findSheetCache({ ...cur, sheets: cur.sheets.map((s) => ({ ...s, read: { x: 1 } })) }, { companyId: "co1", prisma: { quoteDocument: { findMany: async () => { throw new Error("queried"); } } } })).offers.length === 0);
const sav = reuseSavings({ ...cur, documents: curDocs }, offers[0]);
ok(`the offer states what it saves: ${sav?.savesCents} credits`, sav && sav.savesCents > 0 && sav.afterCents === estimateRead({ sheets: 2, sheetsAlreadyRead: 2 }).cents, sav);
const docSrc = code("lib/planRead/documents.js");
ok("the hash is computed by the server from the bytes it fetched, never taken from the browser", /contentHash: contentHashOf\(file\.buffer\)/.test(docSrc) && !/raw\??\.contentHash/.test(docSrc) && !("contentHash" in (validateQuoteDocument({ kind: "plan", url: url("a.pdf"), mimeType: "application/pdf", contentHash: H }, { companyId: "co1", canSeeMoney: true, cloudName }).data || {})));
const reuseSrc = code("app/api/plan-reads/[id]/reuse/route.js");
ok("reuse recomputes the offer server-side, scoped, under the row lock, and logs it", /findSheetCache\(read, \{ companyId: member\.companyId/.test(reuseSrc) && /FOR UPDATE/.test(reuseSrc) && /editLogEntry\(/.test(reuseSrc) && /await params/.test(reuseSrc));
ok("the column is additive and indexed per company", /contentHash String\?/.test(readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")) && /@@index\(\[companyId, contentHash\]\)/.test(readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")));

// ═══════════════════════════════════════════════════════════════════════════
section("20. The first live read (2026-10-04): storage, size, retries, a UK set");
// ═══════════════════════════════════════════════════════════════════════════
//
// The deep read had never run in production. The first real attempt — a
// 13-sheet UK church set — failed five ways. Each is executed here.

// ── 20a. A UK planning set, read in code ──────────────────────────────────
const uk = await pdfSheets(ukChurchSet(), { firstIndex: 1 });
const [p43, p52, e01] = uk.sheets || [];
ok("the UK fixture is read", uk.ok && uk.sheets.length === 3, uk);
ok("the sheet number is the value under \"Drawing No.\" — P43, not the paper size A3", p43?.sheetNumber === "P-43" && p52?.sheetNumber === "P-52" && e01?.sheetNumber === "E-01", [p43?.sheetNumber, p52?.sheetNumber, e01?.sheetNumber]);
ok("a Title Case drawing title is kept (the capitals-only rule dropped it)", p43?.title === "Scheme C4 - Extension Floor Plan" && e01?.title === "Plan - as existing", [p43?.title, e01?.title]);
ok("…and a Title Case heading at heading size is a title too", (p52?.titles || []).includes("Block Plan") && (p52?.titles || []).includes("Location Plan"), p52?.titles);
ok("P52 takes the title block's 1:500, not the location plan's 1:1250 printed above it", p52?.scale?.ratio === 500, p52?.scale);
ok("UK letters are STATUS, not discipline: P43 is not plumbing, E01 not electrical", p43?.discipline === null && e01?.discipline === null, [p43?.discipline, e01?.discipline]);
const ukDim = (raw) => (p43?.dims || []).find((d) => d.raw === raw);
ok("\"6.75 metres\" → 6.75 m (the spelled-out unit was read as nothing)", ukDim("6.75 metres")?.metres === 6.75 && !ukDim("6.75 metres").unitAssumed, ukDim("6.75 metres"));
ok("\"2.1 metres\" and \"4 metres\" → 2.1 m and 4 m", ukDim("2.1 metres")?.metres === 2.1 && ukDim("4 metres")?.metres === 4);
ok("a bare \"4.7\" and \"5.2\" on a metric plan → the kitchen's 4.7 × 5.2 m, unit flagged as assumed metres", ukDim("4.7")?.metres === 4.7 && ukDim("5.2")?.metres === 5.2 && ukDim("4.7").unitAssumed && ukDim("4.7").assumedUnit === "m", [ukDim("4.7"), ukDim("5.2")]);
ok("the meeting room's bare 6.8 × 3.1 m too", ukDim("6.8")?.metres === 6.8 && ukDim("3.1")?.metres === 3.1);
ok("the scale bar's ticks (0m 1m 2m … 10m) are not dimensions", !(p43?.dims || []).some((d) => /^\d+m$/.test(d.raw)) && !(e01?.dims || []).length, (p43?.dims || []).map((d) => d.raw));
ok("…nor a location plan's bars and a lone 2-pt \"5m\"", !(p52?.dims || []).length, (p52?.dims || []).map((d) => d.raw));
ok("the project number 21047 in the title block is not read as 21.047 m", !(p43?.dims || []).some((d) => d.raw === "21047"), (p43?.dims || []).map((d) => d.raw));
ok("…while a bare 12500 on a plan (outside a title block) still is 12.5 m", planDim("12500")?.metres === 12.5);
ok("\"1.01\" (a UK room number) is not a dimension; \"350 millimetres\" is 0.35 m", findDimensions("1.01", { metric: true }).length === 0 && findDimensions("350 millimetres")[0]?.metres === 0.35);
ok("a scale bar line is recognised; a dimension line is not", isScaleBarLine("0m 1m 2m 3m 4m 5m 10m") && isScaleBarLine("0 1 2 3 4 5 6 7 8 9 10 metres") && isScaleBarLine("50m 40m 30m 20m 10m 0m") && !isScaleBarLine("2.1 metres") && !isScaleBarLine("6.8 North", 18));
const kitchen = computeProject(
  sanitiseSynthesis({ summary: "", buildingType: "church", commercial: false, areas: [{ id: "a1", name: "Kitchen", level: null, side: "interior", include: true }], surfaces: [{ id: "s1", areaId: "a1", label: "Kitchen ceiling", itemKey: "ceiling", coats: null, productKey: null, lengthRefs: [ukDim("4.7")?.id], widthRefs: [ukDim("5.2")?.id], multiplier: 1, count: null, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: null, estimateBasis: null, sheet: "P-43", note: null }], access: [], complexity: { level: "low", factors: [] }, assumptions: [], exclusions: [], questions: [] }, { dimIds: new Set(buildDimIndex(uk.sheets).keys()), itemKeys, productKeys, photoIds: new Set(), excel: null }),
  { dims: buildDimIndex(uk.sheets), book: books.interior_painting },
);
ok("the kitchen ceiling = 4.7 m × 5.2 m = 24.44 m² ≈ 263 sq ft — plausible against the architect's 135.22 m² annexe", kitchen.surfaces[0].quantity.value === Math.round(4.7 * 5.2 * 10.7639104) && kitchen.surfaces[0].quantity.estimated && /m assumed from the metric scale/.test(kitchen.surfaces[0].quantity.sourceText), kitchen.surfaces[0].quantity);
const usE = sheetFacts([{ str: "ELECTRICAL POWER PLAN", x: 300, y: 1500, fontSize: 28 }, { str: "E-101", x: 2400, y: 80, fontSize: 30 }, { str: "1/4\" = 1'-0\"", x: 300, y: 1460, fontSize: 12 }], { page: 1, pageWidth: 2592, pageHeight: 1728 });
const usBareE = sheetFacts([{ str: "GROUND FLOOR PLAN", x: 300, y: 1500, fontSize: 28 }, { str: "E-1", x: 2400, y: 80, fontSize: 30 }, { str: "SOME MORE TEXT ON THE SHEET", x: 300, y: 300, fontSize: 9 }], { page: 1, pageWidth: 2592, pageHeight: 1728 });
ok("a US E-sheet titled ELECTRICAL is electrical; an E-sheet with no electrical words is unknown", usE.discipline === "electrical" && usBareE.discipline === null, [usE.discipline, usBareE.discipline]);
ok("the US fixture is unchanged: A-201 / A-101, architectural, its own titles", elev.sheetNumber === "A-201" && elev.discipline === "architectural" && elev.title === "NORTH ELEVATION");

// ── 20b. A set bigger than the storage plan's file limit is split ─────────
const sixPages = buildPlanPdf(Array.from({ length: 6 }, (_, i) => ({ texts: [{ text: `SHEET ${i + 1} FLOOR PLAN`, x: 300, y: 1500, size: 28 }, { text: `A-${101 + i}`, x: 2400, y: 80, size: 30 }, { text: "x".repeat(400), x: 100, y: 600, size: 6 }] })));
const tinyCap = Math.ceil(sixPages.length * 0.45);
const parts = await splitPdfBytes(sixPages, tinyCap);
ok(`a ${sixPages.length}-byte set under a ${tinyCap}-byte limit is split into ${parts.length} parts, every one under it`, parts.length >= 2 && parts.every((p) => p.bytes.length <= tinyCap), parts.map((p) => [p.firstPage, p.lastPage, p.bytes.length]));
ok("…covering every page exactly once, in page order", parts.map((p) => `${p.firstPage}-${p.lastPage}`).join(",") === (() => { const out = []; let n = 1; for (const p of parts) { out.push(`${n}-${p.lastPage}`); n = p.lastPage + 1; } return out.join(","); })() && parts[0].firstPage === 1 && parts[parts.length - 1].lastPage === 6);
const reread = [];
for (const p of parts) {
  const r = await pdfSheets(p.bytes, { firstIndex: reread.length + 1 });
  reread.push(...(r.sheets || []).map((s) => s.sheetNumber));
}
ok("each part is a real PDF whose text reads back — A-101 … A-106, in order", reread.join(",") === "A-101,A-102,A-103,A-104,A-105,A-106", reread);
let tooBig = null;
try {
  await splitPdfBytes(sixPages, 200);
} catch (e) {
  tooBig = e;
}
ok("one page bigger than the limit on its own is refused with its page number, never truncated", tooBig instanceof PdfSplitError && tooBig.code === "page_too_large" && tooBig.page === 1, tooBig);
ok("parts are named in order with their sheets", partName("Church set.pdf", 2, 3, 8, 13) === "Church set — part 2 of 3 (sheets 8–13).pdf" && partName("x.PDF", 1, 2, 1, 1) === "x — part 1 of 2 (sheet 1).pdf");
ok("pages per part from the average page weight", pagesPerPart({ fileBytes: 13_400_000, pageCount: 13, maxBytes: 10_485_760 }) === 9 && pagesPerPart({ fileBytes: 1, pageCount: 1, maxBytes: 5 }) === 1);
const filesCard = code("app/components/planRead/QuoteFilesCard.js");
ok("the Files card splits a too-large PDF and files each part on the read", /err\?\.code === "too_large"/.test(filesCard) && /splitPdfFile\(file, Number\(err\.maxBytes\)\)/.test(filesCard) && /supersedesId: i === 0/.test(filesCard));
ok("the documents route no longer claims a 100 MB drawing set is fetched", !/A 100 MB drawing set is fetched/.test(readFileSync(new URL("../app/api/plan-reads/[id]/documents/route.js", import.meta.url), "utf8")));

// ── 20c. The server reads its own PDF through the signed download ─────────
// ONE signer for every server-side read of a tenant's file: main's
// lib/media/signedFile.js, reached through lib/media/fileOpen.js
// fetchTenantFile. The drawing read used to carry its own copy
// (ingest.js fetchPlanFile); it was folded into this path on the merge with
// the Cloudinary PDF fix, so these tests pin the drawing PDF through it.
const planUrl = "https://res.cloudinary.com/demo/raw/upload/v17/fieldquo/companies/co1/plans/0b7f3c2e-1111-4a4a-9c9c-123456789abc.pdf";
const signCalls = [];
const fakeSign = (publicId, format, options) => {
  signCalls.push({ publicId, format, options });
  return `https://api.cloudinary.com/v1_1/demo/raw/download?public_id=${encodeURIComponent(publicId)}&type=${options.type}&signature=x`;
};
const fetched = [];
const fetchDeniesPdf = async (u) => {
  fetched.push(u);
  if (u.startsWith("https://res.cloudinary.com/")) return { ok: false, status: 401, url: u, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
  return { ok: true, status: 200, url: u, headers: { get: () => "4" }, arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer };
};
const viaSigned = await fetchTenantFile(planUrl, { companyId: "co1", sign: fakeSign, cloudName: "demo", fetchImpl: fetchDeniesPdf });
ok("an account that answers the PDF's public URL 401 is read through the signed download", viaSigned.ok && fetched.length === 1 && fetched[0].startsWith("https://api.cloudinary.com/v1_1/demo/") && signCalls[0].publicId === "fieldquo/companies/co1/plans/0b7f3c2e-1111-4a4a-9c9c-123456789abc.pdf" && signCalls[0].options.type === "upload" && signCalls[0].options.resource_type === "raw", { viaSigned, fetched, signCalls });
fetched.length = 0;
const otherCo = await fetchTenantFile(planUrl.replace("/co1/", "/co2/"), { companyId: "co1", sign: fakeSign, cloudName: "demo", fetchImpl: fetchDeniesPdf });
ok("another company's drawing is never signed or fetched (the tenant fence)", !otherCo.ok && otherCo.reason === "not_ours" && signCalls.length === 1 && fetched.length === 0, otherCo);
const overCap = await fetchTenantFile(planUrl, { companyId: "co1", sign: fakeSign, cloudName: "demo", maxBytes: 3, fetchImpl: fetchDeniesPdf });
ok("a drawing over the ingest ceiling is named too_large, never truncated", !overCap.ok && overCap.reason === "too_large");
const docLib = code("lib/planRead/documents.js");
const ingestSrc = code("lib/planRead/ingest.js");
const docRoute = code("app/api/plan-reads/[id]/documents/route.js");
ok("the documents route injects the one shared signer", /sign: cloudinarySigner\(\)/.test(docRoute) && /from "@\/lib\/media\/cloudinarySign"/.test(docRoute) && !/private_download_url/.test(docRoute));
ok("adding a drawing reads it through fetchTenantFile at the ingest ceiling, the plain URL only with no signer (local dev)", /fetchTenantFile\(document\.url, \{ companyId, cloudName, sign, maxBytes: MAX_INGEST_BYTES/.test(docLib) && /: await fetchOwnFile\(document\.url/.test(docLib));
ok("no second copy of the drawing signer survives in ingest.js", !/fetchPlanFile/.test(ingestSrc) && !/fetchPlanFile/.test(docLib));

// ── 20d. A failed sheet is read again by the next run, never synthesised blank
ok("sheet state: unread and earlier-run failures need a pass; this run's failure and a permanent one do not", sheetNeedsPass({ read: null }) && sheetNeedsPass({ read: { failed: true, failedRun: "r1" } }, "r2") && !sheetNeedsPass({ read: { failed: true, failedRun: "r2" } }, "r2") && !sheetNeedsPass({ read: { failed: true, permanent: true } }, "r2") && !sheetNeedsPass({ read: { summary: "ok" } }, "r2"));
ok("…and only a real pass counts as done", sheetPassDone({ read: { summary: "ok" } }) && !sheetPassDone({ read: { failed: true } }) && !sheetPassDone({}));
const allFail = Object.fromEntries(Array.from({ length: 4 }, (_, k) => [`p${k + 1}`, { left: 2, reason: "refused" }]));
const memR = memDb({ planRead: [setRead("pretry", 4)], quoteDocument: setDocs("pretry", 4) });
const lgR = uniqueLedger();
const st1 = await startRead({ planReadId: "pretry", companyId: "co1" }, { ...p0Deps(lgR), db: memR });
const prov1 = scriptedProvider({ sheetDelay: () => 1, failures: allFail });
const run1 = await advanceRead("pretry", { companyId: "co1", budgetMs: 10_000_000 }, { ...p0Deps(lgR), db: memR, complete: prov1.complete });
const rowR = memR.t.planRead[0];
ok("a run in which NO sheet could be read fails instead of synthesising blank notes", run1.state === "failed" && !prov1.calls.includes("plan_read_synthesis") && rowR.status === "failed" && /None of the drawing sheets could be read/.test(rowR.error), { run1, error: rowR.error, calls: prov1.calls });
ok("…and is refunded in full", lgR.rows.some((r) => r.refund && r.cents === st1.heldCents));
ok("its failed sheets carry the run that wrote them off", rowR.sheets.every((s) => s.read?.failed && s.read.failedRun && s.read.failedRun === lgR.rows[0].ref));
const est2 = readEstimate({ ...rowR, documents: memR.t.quoteDocument });
ok("the retry is estimated for all four sheets again (not as already read)", est2.breakdown.sheetsToRead === 4, est2.breakdown);
await startRead({ planReadId: "pretry", companyId: "co1" }, { ...p0Deps(lgR), db: memR });
const prov2 = scriptedProvider({ sheetDelay: () => 1 });
const run2 = await advanceRead("pretry", { companyId: "co1", budgetMs: 10_000_000 }, { ...p0Deps(lgR), db: memR, complete: prov2.complete });
ok("\"try again\" READS the sheets again (4 sheet calls), then synthesises from real notes", run2.state === "ready" && prov2.calls.filter((c) => c === "plan_read_sheet").length === 4 && memR.t.planRead[0].sheets.every(sheetPassDone), { run2, calls: prov2.calls });
const memOne = memDb({ planRead: [setRead("pone", 3)], quoteDocument: setDocs("pone", 3) });
const lgO = uniqueLedger();
await startRead({ planReadId: "pone", companyId: "co1" }, { ...p0Deps(lgO), db: memOne });
await advanceRead("pone", { companyId: "co1", budgetMs: 10_000_000 }, { ...p0Deps(lgO), db: memOne, complete: scriptedProvider({ sheetDelay: () => 1, failures: { p2: { left: 2, reason: "refused" } } }).complete });
const rowO = memOne.t.planRead[0];
ok("one bad sheet still never sinks the read (P0's rule holds)", rowO.status === "ready" && rowO.sheets[1].read.failed && sheetPassDone(rowO.sheets[0]));
ok("…and the finished read offers to read that sheet again", hasWorkToRead({ ...rowO, documents: memOne.t.quoteDocument }) && readEstimate({ ...rowO, documents: memOne.t.quoteDocument }).breakdown.sheetsToRead === 1);
await startRead({ planReadId: "pone", companyId: "co1" }, { ...p0Deps(lgO), db: memOne });
const provO = scriptedProvider({ sheetDelay: () => 1 });
await advanceRead("pone", { companyId: "co1", budgetMs: 10_000_000 }, { ...p0Deps(lgO), db: memOne, complete: provO.complete });
ok("…which reads ONLY that sheet (one call), not the two already read", provO.calls.filter((c) => c === "plan_read_sheet").length === 1 && memOne.t.planRead[0].sheets.every(sheetPassDone), provO.calls);
const permanentRead = { ...memOne.t.planRead[0], documents: memOne.t.quoteDocument, sheets: memOne.t.planRead[0].sheets.map((s, i) => (i === 1 ? { ...s, read: { failed: true, permanent: true } } : s)) };
ok("a sheet with nothing to send is permanent — never offered as a retry, so a paid synthesis is never re-run for it", permanentRead.status === "ready" && readInputs(permanentRead).sheets.length === 3 && !hasWorkToRead(permanentRead));

// ── 20e. "Couldn't read your file" is said as that ─────────────────────────
const memU = memDb({ planRead: [{ ...baseRead, id: "punread", sheets: [], excelRows: { byDoc: {}, failed: { dbad: "not_ours" } } }], quoteDocument: [{ id: "dbad", companyId: "co1", planReadId: "punread", kind: "plan", name: "Church set.pdf", mimeType: "application/pdf", supersedesId: null, url: "https://res.cloudinary.com/x/raw/upload/a.pdf", pages: [] }] });
const unread = await startRead({ planReadId: "punread", companyId: "co1" }, { ...ledgerDeps, db: memU });
ok("a set that was added but couldn't be read is named, not \"add a drawing set first\"", unread.ok === false && unread.error === "files_unreadable" && unread.names[0] === "Church set.pdf", unread);
const runRoute = code("app/api/plan-reads/[id]/run/route.js");
ok("…and the run route says why, by name, with nothing charged", /files_unreadable/.test(runRoute) && /couldn't read \$\{started\.names\.join/.test(runRoute));

// ═══════════════════════════════════════════════════════════════════════════
section("21. P1 multi-trade: the quote's service decides what is read, every quantity sourced");
// ═══════════════════════════════════════════════════════════════════════════

// The reference painting read (section 14's, no scope) as it was before the
// trades existed — any change to painting's prompt or model fails here.
const PIN_PAINT_PROMPT = "87c5b9372b6ae32645a756b63d8a11f6";
const PIN_PAINT_MODEL = "5616a7c9a0553d9ef592d23332006fce";

ok("painting with no scope is pinned by md5 — the synthesis prompt and the model of the reference read", md5(seqP.synthPrompts[0]) === PIN_PAINT_PROMPT && md5(seq.row.model) === PIN_PAINT_MODEL, [md5(seqP.synthPrompts[0]), md5(seq.row.model)]);
ok("every trade item names a REGISTERED measurement key (no second vocabulary)", unregisteredItemKeys().length === 0, unregisteredItemKeys());
ok("…and the new keys are in the registry, with the read as their source", ["panels", "plumbingFixtures", "wallFramingFt", "headers", "penetrations", "transitions", "cornerBeadFt"].every((k) => isMeasurementKey(k) && /drawing read/.test(MEASUREMENT_KEYS[k].source)) && measurementKeysForTrade("plumbing")[0] === "plumbingFixtures" && measurementKeysForTrade("carpentry")[0] === "wallFramingFt");
ok("…kept out of TRADE_MEASUREMENTS, so the quote builder's custom-item picker is unchanged (no measured unit nothing on a hand-built quote fills)", !Object.hasOwn(TRADE_MEASUREMENTS, "plumbing") && !Object.hasOwn(TRADE_MEASUREMENTS, "carpentry") && Object.values(DRAWING_READ_TRADE_KEYS).flat().every((k) => isMeasurementKey(k) && !Object.values(TRADE_MEASUREMENTS).flat().includes(k)));
ok("the catalogue the model sees carries no price, rate or cost", !JSON.stringify(MULTI_TRADE_KEYS.map((k) => tradeCatalogueForModel(k))).match(/price|rate"|cost|amount/i));

// What the read is FOR, from the quote's services.
const scopeOf = (...keys) => ({ categories: keys.map((key) => ({ key, label: key })), from: "quote" });
ok("interior painting reads the inside, exterior the outside, both → both", paintingFocus(scopeOf("interior_painting")) === "interior" && paintingFocus(scopeOf("exterior_painting")) === "exterior" && paintingFocus(scopeOf("interior_painting", "exterior_painting")) === null);
const mixedScope = tradesFromScope(scopeOf("drywall_install", "electrical", "roofing_service", "residential_cleaning"));
ok("drywall, electrical and roofing services map to their trades; cleaning is said to be unmapped", mixedScope.trades.map((t) => t.tradeKey).join() === "drywall,roofing,electrical" && mixedScope.unmapped.join() === "residential_cleaning", mixedScope);
ok("no scope stated = painting, as every read before scopes", !tradesFromScope(null).stated && scopeHasPainting(null) && !scopeHasPainting(scopeOf("electrical")));
ok("a scope from the browser keeps only the company's own switched-on services", JSON.stringify(sanitiseScope(["electrical", "made_up", "roofing_service"], { companyCategories: [{ key: "electrical", label: "Electrical" }] })) === JSON.stringify({ categories: [{ key: "electrical", label: "Electrical" }], from: "estimator" }) && sanitiseScope(["x"], { companyCategories: [] }) === null);

// A small commercial set, read in code.
const TI = (str, x, y, fontSize = 10) => ({ str, x, y, fontSize, width: str.length * fontSize * 0.55 });
const mkSheet = (page, items) => ({ ...sheetFacts(items, { page, pageWidth: 2592, pageHeight: 1728 }), docId: "dmt", docPage: page, read: null, scanDims: [] });
const sA = mkSheet(1, [TI("FIRST FLOOR PLAN", 300, 1550, 28), TI("A-101", 2400, 80, 30), TI("1/4\" = 1'-0\"", 300, 1510, 12), TI("42'-6\"", 900, 1300), TI("18'-0\"", 600, 1200), TI("CLG HT 9'-0\"", 1100, 1100), TI("DOOR SCHEDULE", 1800, 1450, 14), TI("D1 3'-0\" X 7'-0\" HM DOORS 6", 1800, 1430, 9), TI("WALL TYPES", 1800, 1300, 14), TI("W1 3-5/8\" MTL STUD @ 16\" O.C. 5/8\" TYPE X EACH SIDE", 1800, 1280, 9)]);
const sE = mkSheet(2, [TI("ELECTRICAL POWER PLAN", 300, 1550, 28), TI("E-101", 2400, 80, 30), TI("LIGHTING FIXTURE SCHEDULE", 1800, 1400, 14), TI("A1 2X4 LED TROFFER 12 277V", 1800, 1380, 9), TI("ANOTHER TABLE 99", 300, 1380, 9), TI("B2 DOWNLIGHT 8 120V", 1800, 1366, 9), TI("PANEL SCHEDULE", 1800, 1200, 14), TI("LP-1 200A 42 CIRCUITS", 1800, 1180, 9)]);
const sX = mkSheet(3, [TI("EXTERIOR ELEVATIONS", 300, 1550, 28), TI("A-201", 2400, 80, 30), TI("24'-6\"", 900, 1300)]);
const sR = mkSheet(4, [TI("ROOF PLAN", 300, 1550, 28), TI("A-301", 2400, 80, 30), TI("40'-0\"", 900, 1300), TI("30'-0\"", 600, 1200), TI("6:12 TYP.", 1200, 1000)]);
const sP = mkSheet(5, [TI("PLUMBING PLAN", 300, 1550, 28), TI("P-201", 2400, 80, 30), TI("PLUMBING FIXTURE SCHEDULE", 1800, 1400, 14), TI("WC-1 WATER CLOSET FLOOR MOUNTED 4", 1800, 1380, 9)]);
const sS = mkSheet(6, [TI("FOUNDATION PLAN", 300, 1550, 28), TI("S-101", 2400, 80, 30)]);
const sT = mkSheet(7, [TI("COVER SHEET", 300, 1550, 28), TI("T-001", 2400, 80, 30), TI("SHEET INDEX A-101 A-201", 300, 1400, 12)]);
const specLines = ["SECTION 09 29 00 - GYPSUM BOARD", "PART 3 - EXECUTION", "3.4 FINISHING: LEVEL 4 FINISH AT ALL PAINTED WALLS. LEVEL 5 AT LOBBY.", "BOARD: 5/8 IN TYPE X WHERE RATED.", ...Array.from({ length: 40 }, (_, i) => `GENERAL REQUIREMENT ${i + 1} OF THE GYPSUM BOARD ASSEMBLIES AS SPECIFIED HEREIN.`)];
const sSpec = mkSheet(8, specLines.map((l, i) => TI(l, 200, 1600 - i * 30, 10)));
const sScan = { ...mkSheet(9, []), sheetNumber: null, title: null, titles: [] };
const allMt = [sA, sE, sX, sR, sP, sS, sT, sSpec, sScan];
ok("schedules are read in code by their header, each row with an id; a table on the same baseline elsewhere is left out", sE.schedules.find((s) => s.kind === "LIGHTING FIXTURE")?.rows[0]?.text === "A1 2X4 LED TROFFER 12 277V" && !sE.schedules.some((s) => s.rows.some((r) => /ANOTHER TABLE/.test(r.text))) && sE.schedules.some((s) => s.kind === "PANEL") && sA.schedules.some((s) => s.kind === "DOOR") && sA.schedules.some((s) => s.kind === "WALL TYPE"), sE.schedules);
ok("…and the finish schedule painting reads is untouched", Array.isArray(sA.schedule) && sA.schedule.length === 0);
ok("a page of specification text is a spec page, never a drawing", isSpecPage(sSpec) && !isSpecPage(sA));
const digest = specDigest([sSpec]);
ok("the spec digest keeps the section and the lines that state a level or a board", digest[0]?.section === "09 29 00" && digest[0].lines.some((l) => /LEVEL 4/.test(l)) && digest[0].lines.some((l) => /TYPE X/.test(l)), digest);

const routeKeys = (scope) => {
  const r = routeSheets(allMt, tradesFromScope(scope).trades);
  return allMt.filter((s) => r.get(s.key)?.send).map((s) => s.sheetNumber || "scan").join(",");
};
ok("no scope: every sheet is read (as before)", allMt.every((s) => routeSheets(allMt, []).get(s.key).send), routeKeys(null));
ok("a drywall quote reads the floor plan (and the scan it cannot classify) — not the elevations, roof, E/P/S sheets or the cover", routeKeys(scopeOf("drywall_install")) === "A-101,scan", routeKeys(scopeOf("drywall_install")));
ok("a roofing quote reads the roof plan and the elevations — not the inside", routeKeys(scopeOf("roofing_service")) === "A-201,A-301,scan", routeKeys(scopeOf("roofing_service")));
ok("an electrical quote reads the E-sheet only", routeKeys(scopeOf("electrical")) === "E-101,scan", routeKeys(scopeOf("electrical")));
ok("interior painting skips the exterior elevations and the roof", routeKeys(scopeOf("interior_painting")) === "A-101,scan", routeKeys(scopeOf("interior_painting")));
ok("exterior painting reads the elevations", routeKeys(scopeOf("exterior_painting")).includes("A-201") && !routeKeys(scopeOf("exterior_painting")).includes("E-101"));
const noE = routeSheets([sA, sX, sScan], tradesFromScope(scopeOf("electrical")).trades);
ok("a set with no electrical sheets: the electrical read falls back to the floor plans", noE.get(sA.key).send && noE.get(sA.key).reason === "fallback" && !noE.get(sX.key).send);
const ukRoutes = routeSheets(uk.sheets, tradesFromScope(scopeOf("drywall_install")).trades);
ok("the UK set: a drywall quote reads P43 and E01 (status letters are not E/P disciplines) and never the location and block plan", ukRoutes.get(p43.key).send && ukRoutes.get(e01.key).send && !ukRoutes.get(p52.key).send, [...ukRoutes.entries()]);
ok("the spec page is never sent as an image on a scoped read", routeSheets(allMt, tradesFromScope(scopeOf("drywall_install")).trades).get(sSpec.key).reason === "spec");

// Symbol counts per tile → one count with a confidence.
const counts = aggregateSheetCounts(
  [
    { tradeKey: "electrical", itemKey: "receptacle", symbol: "duplex", legendText: "DUPLEX RECEPTACLE", tile: 0, count: 37 },
    ...[10, 9, 9, 9].map((n, i) => ({ tradeKey: "electrical", itemKey: "receptacle", symbol: "Duplex", legendText: "", tile: i + 1, count: n })),
    { tradeKey: "electrical", itemKey: "receptacle_gfci", symbol: "GFI", legendText: "GFCI RECEPTACLE", tile: 0, count: 6 },
    ...[2, 1, 1, 0].map((n, i) => ({ tradeKey: "electrical", itemKey: "receptacle_gfci", symbol: "GFI", legendText: "", tile: i + 1, count: n })),
    { tradeKey: "electrical", itemKey: "switch", symbol: "S3", legendText: "", tile: 0, count: 5 },
    { tradeKey: "electrical", itemKey: "switch", symbol: "S3", legendText: "", tile: 1, count: 5 },
    { tradeKey: "electrical", itemKey: "solar_panel", symbol: "X", legendText: "", tile: 0, count: 3 },
    { tradeKey: "electrical", itemKey: "conduit", symbol: "EMT", legendText: "", tile: 0, count: 3 },
    { tradeKey: "electrical", itemKey: "receptacle", symbol: "duplex", legendText: "", tile: 7, count: 3 },
    { tradeKey: "electrical", itemKey: "receptacle", symbol: "duplex", legendText: "", tile: 2, count: -1 },
    { tradeKey: "plumbing", itemKey: "water_closet", symbol: "WC", legendText: "", tile: 0, count: 2 },
  ],
  sE.key,
  { tradeKeys: ["electrical"] },
);
const cDup = counts.find((c) => c.itemKey === "receptacle");
const cGfi = counts.find((c) => c.itemKey === "receptacle_gfci");
const cSw = counts.find((c) => c.itemKey === "switch");
ok("the four quarters are summed (37) and agree with the whole sheet; the legend is kept", cDup.count === 37 && cDup.agree && cDup.legend === "DUPLEX RECEPTACLE" && cDup.id === `${sE.key}.c1`, cDup);
ok("quarters that disagree with the whole sheet are marked so (4 vs 6)", cGfi.count === 4 && !cGfi.agree, cGfi);
ok("an unknown item, a length item, a trade not on the sheet, an impossible tile or a negative count are dropped", counts.length === 3, counts.map((c) => c.itemKey));
sE.read = { relevant: true, summary: "E", areas: [], heights: [], finishes: [], access: [], counts, notes: [{ tradeKey: "electrical", text: "LP-1 200A" }] };
sA.read = { relevant: true, summary: "A", areas: [], heights: [], finishes: [], access: [], counts: [], notes: [] };
const mtSheets = [sA, sE, sR, sP];
const mtCtx = { dims: buildDimIndex(mtSheets), counts: buildCountIndex(mtSheets), schedules: buildScheduleIndex(mtSheets), excel: null, photoRead: null };
const mtIds = { dimIds: new Set(mtCtx.dims.keys()), countIds: new Set(mtCtx.counts.keys()), scheduleIds: new Set(mtCtx.schedules.keys()), specIds: new Set(digest.map((x) => x.id)), photoIds: new Set(), excel: null };
const dimOf = (s, raw) => s.dims.find((d) => d.raw === raw)?.id;
const rowOf = (s, kind) => s.schedules.find((x) => x.kind === kind)?.rows[0]?.id;
const blankItem = { areaId: null, include: true, lengthRefs: [], widthRefs: [], multiplier: null, countRefs: [], count: null, scheduleRef: null, scheduleQty: null, specRef: null, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: null, estimateBasis: null, sheet: null, note: null, attributes: {} };
const synthOf = (items, extra = {}) => ({ summary: "", buildingType: "office", commercial: true, areas: [{ id: "a1", name: "Level 1", level: "1", include: true }], items: items.map((x, i) => ({ ...blankItem, id: `i${i + 1}`, areaId: "a1", label: x.itemKey, ...x })), complexity: { level: "medium", factors: [] }, assumptions: [], exclusions: [], questions: [], ...extra });
const elec = computeTrade(
  sanitiseTradeSynthesis(
    synthOf([
      { itemKey: "receptacle", countRefs: [cDup.id], price: 99, amount: 5 },
      { itemKey: "receptacle_gfci", countRefs: [cGfi.id] },
      { itemKey: "switch", countRefs: [cSw.id] },
      { itemKey: "light_fixture", scheduleRef: rowOf(sE, "LIGHTING FIXTURE"), scheduleQty: "12", attributes: { fixtureType: "A1", pitch: 6 } },
      { itemKey: "light_fixture", label: "B2 downlights", scheduleRef: sE.schedules.find((x) => x.kind === "LIGHTING FIXTURE").rows[1].id, scheduleQty: "9", count: 8 },
      { itemKey: "panel", scheduleRef: rowOf(sE, "PANEL"), scheduleQty: "1", attributes: { amps: 200 } },
      { itemKey: "circuit", scheduleRef: rowOf(sE, "PANEL"), scheduleQty: "42" },
      { itemKey: "conduit", estimate: 300, estimateBasis: "home runs by eye" },
      { itemKey: "solar_panel", count: 9 },
      { itemKey: "data_drop", countRefs: ["p99.c1"] },
    ]),
    "electrical",
    mtIds,
  ),
  mtCtx,
);
const eq = (label) => elec.items.find((i) => i.label === label)?.quantity;
ok("electrical: 37 duplex receptacles from the summed quarters with a legend on a vector sheet — medium", eq("receptacle").value === 37 && eq("receptacle").confidence === "medium" && /DUPLEX RECEPTACLE/.test(eq("receptacle").sourceText), eq("receptacle"));
ok("…GFCI where the quarters disagree with the sheet — low, and says why", eq("receptacle_gfci").value === 4 && eq("receptacle_gfci").confidence === "low" && /disagree/.test(eq("receptacle_gfci").sourceText), eq("receptacle_gfci"));
ok("…switches with no legend — low", eq("switch").value === 5 && eq("switch").confidence === "low" && /no legend/.test(eq("switch").sourceText));
ok("…12 A1 troffers from the fixture schedule row, the printed 12 checked in that row — high", eq("light_fixture").value === 12 && eq("light_fixture").source === "schedule" && eq("light_fixture").confidence === "high", eq("light_fixture"));
ok("…a schedule quantity the row does NOT print (9 vs 8) is refused; the bare count stands, low", eq("B2 downlights").value === 8 && eq("B2 downlights").source === "count" && eq("B2 downlights").confidence === "low", eq("B2 downlights"));
ok("…the panel and its 42 circuits from the panel schedule — high", eq("panel").value === 1 && eq("circuit").value === 42 && eq("circuit").confidence === "high");
ok("…conduit by estimate is low and asked about", eq("conduit").source === "estimate" && eq("conduit").confidence === "low" && elec.questions.some((q) => /conduit/.test(q.text) && /estimated/.test(q.text)));
ok("…an item outside the trade's vocabulary is dropped; a count id that doesn't exist is not cited", !elec.items.some((i) => i.itemKey === "solar_panel") && elec.items.find((i) => i.itemKey === "data_drop").countRefs.length === 0);
ok("…a price volunteered is not kept, and an attribute the item doesn't take (pitch on a fixture) is dropped", !("price" in elec.items[0]) && !("amount" in elec.items[0]) && elec.items.find((i) => i.label === "light_fixture").attributes.fixtureType === "A1" && !("pitch" in elec.items.find((i) => i.label === "light_fixture").attributes));
ok("…every quantity carries a source sentence and a confidence", elec.items.every((i) => i.quantity.sourceText && ["high", "medium", "low"].includes(i.quantity.confidence)) && elec.confidence.high === 3 && elec.confidence.medium === 1);

const dry = computeTrade(
  sanitiseTradeSynthesis(
    synthOf([
      { itemKey: "wall_board", label: "W1 partitions, Level 4", lengthRefs: [dimOf(sA, "42'-6\""), dimOf(sA, "18'-0\"")], widthRefs: [dimOf(sA, "9'-0\"")], multiplier: 2, attributes: { finishLevel: 4, layers: 1, boardType: "type_x" }, specRef: digest[0].id },
      { itemKey: "ceiling_board", label: "Lobby ceiling, Level 5", lengthRefs: [dimOf(sA, "42'-6\"")], widthRefs: [dimOf(sA, "18'-0\"")], attributes: { finishLevel: 5 } },
      { itemKey: "wall_board", label: "Bad level", lengthRefs: [dimOf(sA, "18'-0\"")], widthRefs: [dimOf(sA, "9'-0\"")], attributes: { finishLevel: 7 } },
    ]),
    "drywall",
    mtIds,
  ),
  mtCtx,
);
const dq = (label) => dry.items.find((i) => i.label === label);
ok("drywall: walls (42'-6\" + 18'-0\") × 9'-0\" × 2 faces = 1,089 sq ft at Level 4, from the drawing — high", dq("W1 partitions, Level 4").quantity.value === 1089 && dq("W1 partitions, Level 4").quantity.confidence === "high" && dq("W1 partitions, Level 4").attributes.finishLevel === 4 && dq("W1 partitions, Level 4").specRef === digest[0].id, dq("W1 partitions, Level 4"));
ok("…the ceiling 42'-6\" × 18'-0\" = 765 sq ft at Level 5; levels kept per area", dq("Lobby ceiling, Level 5").quantity.value === 765 && dq("Lobby ceiling, Level 5").attributes.finishLevel === 5);
ok("…a finish level outside GA-214's 0–5 is dropped, never clamped", !("finishLevel" in dq("Bad level").attributes));

const fr = computeTrade(
  sanitiseTradeSynthesis(
    synthOf([
      { itemKey: "wall_framing", label: "Exterior 2x6", lengthRefs: [dimOf(sA, "42'-6\""), dimOf(sA, "18'-0\"")], multiplier: 2, attributes: { studSize: "2x6", studSpacingIn: 16, material: "wood", bearing: true, heightFt: 9 } },
      { itemKey: "header", label: "Door headers", scheduleRef: rowOf(sA, "DOOR"), scheduleQty: "6", attributes: { spanFt: 3 } },
    ]),
    "framing",
    mtIds,
  ),
  mtCtx,
);
ok("framing: 121 lin ft of wall from the plan's printed lengths, studs and spacing kept — high", fr.items[0].quantity.value === 121 && fr.items[0].quantity.unit === "lnft" && fr.items[0].quantity.confidence === "high" && fr.items[0].attributes.studSpacingIn === 16, fr.items[0]);
ok("…6 headers from the door schedule's printed 6 — high", fr.items[1].quantity.value === 6 && fr.items[1].quantity.source === "schedule", fr.items[1].quantity);

const roof = computeTrade(
  sanitiseTradeSynthesis(
    synthOf([
      { itemKey: "roof_plane", label: "Main roof 6:12", lengthRefs: [dimOf(sR, "40'-0\"")], widthRefs: [dimOf(sR, "30'-0\"")], attributes: { pitch: 6, material: "architectural asphalt shingles", layers: 1 } },
      { itemKey: "roof_plane", label: "Porch, pitch not printed", lengthRefs: [dimOf(sR, "40'-0\"")], widthRefs: [dimOf(sR, "30'-0\"")] },
      { itemKey: "ridge", lengthRefs: [dimOf(sR, "40'-0\"")] },
    ]),
    "roofing",
    mtIds,
  ),
  mtCtx,
);
ok("roofing: 40' × 30' on plan at 6:12 = 1,341.6 sq ft sloped = 13.42 squares — high", roof.items[0].quantity.value === 13.42 && roof.items[0].quantity.unit === "sq" && roof.items[0].quantity.confidence === "high" && /sloped at 6\/12/.test(roof.items[0].quantity.sourceText), roof.items[0].quantity);
ok("…with no pitch printed: 12 squares of PLAN area, low, and it says it understates", roof.items[1].quantity.value === 12 && roof.items[1].quantity.confidence === "low" && /understates/.test(roof.items[1].quantity.sourceText), roof.items[1].quantity);
ok("…the ridge 40 lin ft", roof.items[2].quantity.value === 40 && roof.items[2].quantity.unit === "lnft");

const lavCount = aggregateSheetCounts([{ tradeKey: "plumbing", itemKey: "lavatory", symbol: "L-1", legendText: "LAVATORY", tile: 0, count: 4 }, ...[1, 1, 1, 1].map((n, i) => ({ tradeKey: "plumbing", itemKey: "lavatory", symbol: "L-1", legendText: "", tile: i + 1, count: n }))], sP.key);
sP.read = { relevant: true, summary: "P", areas: [], heights: [], finishes: [], access: [], counts: lavCount, notes: [] };
const pCtx = { ...mtCtx, counts: buildCountIndex(mtSheets) };
const pIds = { ...mtIds, countIds: new Set(pCtx.counts.keys()) };
const plb = computeTrade(
  sanitiseTradeSynthesis(
    synthOf([
      { itemKey: "water_closet", scheduleRef: rowOf(sP, "PLUMBING FIXTURE"), scheduleQty: "4" },
      { itemKey: "lavatory", countRefs: [lavCount[0].id] },
      { itemKey: "drain_pipe", estimate: 120, estimateBasis: "stack to the main by eye", attributes: { pipeSize: "4 in", material: "PVC" } },
      { itemKey: "water_heater", count: 1 },
    ]),
    "plumbing",
    pIds,
  ),
  pCtx,
);
ok("plumbing: 4 water closets from the fixture schedule (high), 4 lavatories counted with a legend (medium), DWV by estimate (low + asked), 1 water heater (low)", plb.items[0].quantity.value === 4 && plb.items[0].quantity.confidence === "high" && plb.items[1].quantity.value === 4 && plb.items[1].quantity.confidence === "medium" && plb.items[2].quantity.confidence === "low" && plb.questions.some((q) => /drain_pipe/.test(q.text)) && plb.items[3].quantity.confidence === "low", plb.items.map((i) => i.quantity));

const flo = computeTrade(
  sanitiseTradeSynthesis(
    synthOf([
      { itemKey: "floor_area", label: "LVT-1 open office", lengthRefs: [dimOf(sA, "42'-6\"")], widthRefs: [dimOf(sA, "18'-0\"")], attributes: { material: "LVT-1 luxury vinyl" } },
      { itemKey: "base", lengthRefs: [dimOf(sA, "42'-6\""), dimOf(sA, "18'-0\"")], multiplier: 2 },
      { itemKey: "transition", count: 3 },
    ]),
    "flooring",
    mtIds,
  ),
  mtCtx,
);
ok("flooring: 765 sq ft of LVT-1 and 121 lin ft of base from the room's printed sides; transitions counted, low", flo.items[0].quantity.value === 765 && flo.items[1].quantity.value === 121 && flo.items[2].quantity.confidence === "low");

const conflictTrade = computeTrade(sanitiseTradeSynthesis(synthOf([{ itemKey: "light_fixture", scheduleRef: rowOf(sE, "LIGHTING FIXTURE"), scheduleQty: "12", countRefs: [cDup.id] }]), "electrical", mtIds), mtCtx);
ok("two firm sources that disagree (schedule 12, sheet count 37) → the first wins and a question is asked", conflictTrade.items[0].quantity.value === 12 && conflictTrade.questions.some((q) => q.source === "conflict" && /12/.test(q.text) && /37/.test(q.text)), conflictTrade.questions);

const opsModel = { trades: [sanitiseTradeSynthesis(synthOf([{ itemKey: "wall_board", lengthRefs: [dimOf(sA, "42'-6\"")], widthRefs: [dimOf(sA, "9'-0\"")] }]), "drywall", mtIds)] };
const byModel = applyTradeOps(opsModel, [{ op: "measure_item", tradeKey: "drywall", itemId: "i1", value: 400 }], { actor: "model" });
const byPerson = applyTradeOps(opsModel, [{ op: "measure_item", tradeKey: "drywall", itemId: "i1", value: 400, sourceText: "Measured on A-101" }, { op: "exclude_trade", tradeKey: "electrical" }, { op: "set_price", tradeKey: "drywall" }], { actor: "person" });
ok("only a person measures a trade item; an unknown op and a trade not on the read are refused by name", !byModel.model.trades[0].items[0].override && byPerson.model.trades[0].items[0].override.value === 400 && byPerson.dropped.length === 2 && computeTrade(byPerson.model.trades[0], mtCtx).items[0].quantity.source === "measured");

for (const [name, schema] of Object.entries({ TRADE_SHEET_SCHEMA, TRADE_SYNTHESIS_SCHEMA, PRICING_CHAT_SCHEMA })) {
  const bad = propNames(schema).filter((k) => MONEY.test(k));
  ok(`${name} has no money-shaped field`, bad.length === 0, bad);
  const lint = assertStrictSchema(schema);
  ok(`${name} is inside the vendor's strict subset`, lint.ok, lint.errors);
}

// End to end: a drywall + electrical quote on a set with every kind of sheet.
const mtDocs = (readId) => [
  {
    id: "dmt", companyId: "co1", planReadId: readId, kind: "plan", mimeType: "application/pdf", supersedesId: null, url: "https://res.cloudinary.com/x/raw/upload/mt.pdf",
    uploadedAt: new Date(Date.now() - 60_000).toISOString(),
    pages: allMt.map((s) => ({ page: s.docPage, url: `https://res.cloudinary.com/x/image/upload/v1/fieldquo/companies/co1/plans/mt${s.docPage}.jpg`, width: 3200, height: 2133 })),
  },
];
const freshSheets = () => allMt.filter((s) => s !== sScan).map((s) => ({ ...s, read: null, scanDims: [] }));
const mtRead = (id, scope) => ({ ...baseRead, id, scope, sheets: freshSheets() });
const tradeProvider = () => {
  const st = { calls: [], tradeSynth: 0, inFlight: 0, maxInFlight: 0, prompts: [] };
  st.complete = async (args) => {
    st.calls.push(args.schemaName);
    await args.onUsage?.({ model: args.tier === "best" ? "gpt-5.5" : "gpt-5-mini", promptTokens: 9000, completionTokens: 2000, cachedTokens: 0, imageCount: (args.images || []).length });
    if (args.schemaName === "plan_read_trade_sheet") {
      const p = JSON.parse(args.prompt);
      st.prompts.push(p);
      const isE = p.sheet.number === "E-101";
      return { ok: true, data: { relevant: true, summary: p.sheet.number, areas: [], heights: [], finishes: [], access: [], readDims: [], counts: isE ? [{ tradeKey: "electrical", itemKey: "receptacle", symbol: "duplex", legendText: "DUPLEX RECEPTACLE", tile: 0, count: 20 }, ...[5, 5, 5, 5].map((n, i) => ({ tradeKey: "electrical", itemKey: "receptacle", symbol: "duplex", legendText: "", tile: i + 1, count: n }))] : [], notes: [{ tradeKey: isE ? "electrical" : "drywall", text: isE ? "LP-1 200A" : "W1 TYPE X" }] } };
    }
    if (args.schemaName === "plan_read_trade") {
      st.inFlight += 1;
      st.maxInFlight = Math.max(st.maxInFlight, st.inFlight);
      await wait(15);
      st.inFlight -= 1;
      st.tradeSynth += 1;
      const [shared, tail] = args.prompt.split("\n=== TRADE ===\n");
      const ctxJ = JSON.parse(shared);
      const trade = JSON.parse(tail).trade;
      const dimId = (raw) => ctxJ.dimensions.rows.find((r) => r[1] === raw)?.[0];
      const countIds = ctxJ.sheets.flatMap((s) => s.counts).map((c) => c.id);
      const items = trade === "drywall"
        ? [{ ...blankItem, id: "i1", label: "Walls", itemKey: "wall_board", lengthRefs: [dimId("42'-6\"")], widthRefs: [dimId("9'-0\"")], multiplier: 2, attributes: { finishLevel: 4 } }]
        : [{ ...blankItem, id: "i1", label: "Receptacles", itemKey: "receptacle", countRefs: countIds }];
      return { ok: true, data: { summary: `${trade} scope`, buildingType: "office", commercial: true, areas: [], items, complexity: { level: "medium", factors: [] }, assumptions: [], exclusions: [], questions: [] } };
    }
    if (args.schemaName === "plan_read_synthesis") return goodModel;
    return { ok: false, reason: "unexpected" };
  };
  return st;
};
const memMt = memDb({ planRead: [mtRead("pmt", scopeOf("drywall_install", "electrical"))], quoteDocument: mtDocs("pmt") });
const lgMt = uniqueLedger();
const estMt = readEstimate({ ...memMt.t.planRead[0], documents: mtDocs("pmt") });
const estLegacy = readEstimate({ ...memMt.t.planRead[0], scope: null, documents: mtDocs("pmt") });
ok("the estimate counts only the routed sheets and one synthesis per trade — no painting synthesis", estMt.breakdown.sheetsToRead === 2 && estMt.breakdown.synthMicros === 0 && estMt.breakdown.tradeSyntheses === 2 && estLegacy.breakdown.sheetsToRead === 8, [estMt.breakdown, estLegacy.breakdown]);
const after = [];
await startRead({ planReadId: "pmt", companyId: "co1" }, { ...p0Deps(lgMt), db: memMt });
const provMt = tradeProvider();
const outMt = await advanceRead("pmt", { companyId: "co1", budgetMs: 10_000_000 }, { ...p0Deps(lgMt), db: memMt, complete: provMt.complete, afterReady: async (x) => after.push(x) });
const rowMt = memMt.t.planRead[0];
ok("the scoped read finishes", outMt.state === "ready" && rowMt.status === "ready", outMt);
ok("only the two routed sheets were paid for (A-101 for drywall, E-101 for electrical), each with the TRADE sheet pass", provMt.calls.filter((c) => c === "plan_read_trade_sheet").length === 2 && !provMt.calls.includes("plan_read_sheet") && provMt.prompts.map((p) => p.sheet.number).sort().join() === "A-101,E-101", provMt.calls);
ok("…each sheet's pass was asked only for its own trade, with that trade's catalogue", provMt.prompts.every((p) => p.job.trades.length === 1 && p.catalogues[0].trade === (p.sheet.number === "E-101" ? "electrical" : "drywall")));
ok("no painting synthesis; one per trade, in parallel", !provMt.calls.includes("plan_read_synthesis") && provMt.tradeSynth === 2 && provMt.maxInFlight === 2);
ok("the model holds both trades and says painting is not in scope", rowMt.model.painting === false && rowMt.model.trades.map((t) => t.tradeKey).join() === "drywall,electrical" && rowMt.model.surfaces.length === 0);
ok("…their quantities computed from the read: 765 sq ft of walls, 20 receptacles (medium)", (() => {
  const v = computeTrades(rowMt.model, { dims: buildDimIndex(rowMt.sheets), counts: buildCountIndex(rowMt.sheets), schedules: buildScheduleIndex(rowMt.sheets) });
  return v[0].items[0].quantity.value === 765 && v[1].items[0].quantity.value === 20 && v[1].items[0].quantity.confidence === "medium";
})());
ok("usage and the stage clock keep the trades' syntheses as their own step", rowMt.usage.byStep.trade_synthesis.calls === 2 && rowMt.usage.byStep.sheets.calls === 2);
ok("after settling, the read is priced and checked against the target once (the hook)", after.length === 1 && after[0].read.status === "ready" && after[0].read.model.trades.length === 2);
const eRow = rowMt.sheets.find((s) => s.sheetNumber === "E-101");
ok("a trade pass stores its counts, notes and what it was asked (scopeKey) — a painting pass stores none of it", Array.isArray(eRow.read.counts) && eRow.read.counts[0].count === 20 && eRow.read.scopeKey === "electrical:building" && !("counts" in (seq.row.sheets[0].read || {})));
const viewMt = await planReadView({ ...rowMt, documents: mtDocs("pmt"), messages: [] }, { companyId: "co1", canSeeMoney: true, prisma: { companyServiceCategory: { findMany: async () => [] } }, scopeOptions: [{ key: "electrical", label: "Electrical", trade: "electrical" }] });
ok("the view: trades computed, scope stated, every sheet's route said — 2 of 8 sent", viewMt.project.trades.length === 2 && viewMt.project.painting === false && viewMt.scope.stated && viewMt.scope.sent === 2 && viewMt.scope.total === 8 && viewMt.sheets.find((s) => s.name === "E-101").route.send && !viewMt.sheets.find((s) => s.name === "A-201").route.send && viewMt.scopeOptions.length === 1, viewMt.scope);
const paintOnly = memDb({ planRead: [mtRead("pint", scopeOf("interior_painting"))], quoteDocument: mtDocs("pint") });
await startRead({ planReadId: "pint", companyId: "co1" }, { ...p0Deps(uniqueLedger()), db: paintOnly });
const sheetPrompts = [];
await advanceRead("pint", { companyId: "co1", budgetMs: 10_000_000 }, { ...p0Deps(uniqueLedger()), db: paintOnly, afterReady: null, complete: async (args) => {
  if (args.schemaName === "plan_read_sheet") sheetPrompts.push(JSON.parse(args.prompt));
  await args.onUsage?.({ model: "gpt-5-mini", promptTokens: 100, completionTokens: 10, cachedTokens: 0, imageCount: 0 });
  return args.schemaName === "plan_read_sheet" ? { ok: true, data: { relevant: true, summary: "x", areas: [], heights: [], finishes: [], access: [], readDims: [] } } : goodModel;
} });
ok("an interior painting quote: the painting pass, told to read the INSIDE only — and the elevations never sent", sheetPrompts.length === 1 && sheetPrompts[0].sheet.number === "A-101" && /INSIDE/.test(sheetPrompts[0].job.focus), sheetPrompts.map((p) => [p.sheet.number, p.job.focus]));
const reuseRead = { ...rowMt, id: "pnew", companyId: "co1", status: "draft", documents: mtDocs("pnew").map((d) => ({ ...d, contentHash: "h1" })), sheets: rowMt.sheets.map((s) => ({ ...s, read: null })) };
const tradeReuseSrc = (scope) => ({ id: "pmt", companyId: "co1", title: "x", trade: "painting", clientRequest: "", readAt: null, sheets: rowMt.sheets, scope, documents: [{ id: "dmt", companyId: "co1", contentHash: "h1" }] });
ok("a trade pass is reused by a read asking the same; a read asking for painting is not offered it", reusableSheets({ read: reuseRead, companyId: "co1", sources: [tradeReuseSrc()] })[0]?.sheets.length === 2 && reusableSheets({ read: { ...reuseRead, scope: scopeOf("interior_painting") }, companyId: "co1", sources: [tradeReuseSrc()] }).length === 0);
const remapped = remapSheetPass(eRow, "p41");
ok("…and its count ids follow the sheet (p2.c1 → p41.c1)", remapped.read.counts[0].id === "p41.c1");
ok("a roofing quote on a set with no roof sheet and nothing else to read is refused with the reason, not charged", (await startRead({ planReadId: "proof", companyId: "co1" }, { ...ledgerDeps, db: memDb({ planRead: [{ ...mtRead("proof", scopeOf("roofing_service")), sheets: freshSheets().filter((s) => s.sheetNumber === "E-101") }], quoteDocument: mtDocs("proof") }) })).error === "nothing_for_scope");
const createSrc = code("app/api/plan-reads/route.js");
ok("a read inherits the quote builder's services, or the lead's category — checked against the company's own", /resolveScope\(scopeKeys/.test(createSrc) && /lead\.category\?\.key/.test(createSrc) && /categories=\$\{encodeURIComponent/.test(code("app/components/quotes/builder/QuoteBuilder.js")) && /params\.get\("categories"\)/.test(code("app/app/quotes/drawings/new/page.js")));
ok("changing the services is logged and new work; the browser's keys are looked up, never trusted", /resolveScope\(raw\.scope/.test(code("app/api/plan-reads/[id]/route.js")) && /Set what this read is for/.test(code("app/api/plan-reads/[id]/route.js")) && inputsKey({ documents: mtDocs("x"), scope: scopeOf("electrical") }) !== inputsKey({ documents: mtDocs("x"), scope: null }) && inputsKey({ documents: mtDocs("x"), scope: null }) === "dmt");

// ═══════════════════════════════════════════════════════════════════════════
section("22. P2 pricing: your rates first, overhead by crew time, the target margin, the gap");
// ═══════════════════════════════════════════════════════════════════════════

// The company: USD, field crew at $40/h cost, a 25% target, $8,000 a month of
// fixed costs, 320 billable crew-hours a month, two jobs a month.
const receptacleService = {
  id: "prod_rec",
  name: "Receptacle install",
  active: true,
  templateEnabled: true,
  categoryKeys: ["electrical"],
  production: { key: "receptaclesPractical", amount: 3, basis: "per_hour" },
  templateLines: [
    { kind: "labour", name: "Install receptacle", qty: 1, unit: "each", unitPrice: 85, unitCost: 30, taxable: true, measurementKey: "receptaclesPractical" },
    { kind: "material", name: "Device and box", qty: 1, unit: "each", unitPrice: 15, unitCost: 9.5, taxable: true, measurementKey: "receptaclesPractical" },
    { kind: "other", name: "Permit", qty: 1, unit: "flat", unitPrice: 150, unitCost: 150, taxable: false },
    { kind: "labour", name: "Panel tie-in", qty: 1, unit: "each", unitPrice: 300, unitCost: 120, taxable: true, measurementKey: "panelHours" },
  ],
};
const pctx = {
  currency: "USD",
  labour: { rate: 40, source: "crew", workers: 3 },
  target: { pct: 25, isDefault: false },
  overhead: { rates: overheadRates({ monthlyFixedCosts: 8000, billableHoursPerMonth: 320, jobsPerMonth: 2 }), fallbackPct: 10, minimumPrice: 5333.33, hourlyFloor: 25, needsCapacity: false },
  books: engineBooks({}),
  services: [receptacleService],
  enabledKeys: ["electrical", "drywall_install", "carpentry", "roofing_service", "plumbing"],
};
const tradeOf = (t) => ({ ...t, commercial: true });
const pricedE = priceTrade(tradeOf(elec), { ...pctx, commercial: true, labourRate: 40, assumptions: assumptionsIndex([]) });
const blk = (pt, label) => pt.blocks.find((b) => (b.label || "").includes(label) || b.source.includes(label));
const recBlock = pricedE.blocks.find((b) => b.rung === "service");
ok("rung 2: receptacles AND GFCIs priced by the company's OWN service, expanded once on their summed 41 (37 + 4)", recBlock && recBlock.itemIds.length === 2 && recBlock.lines.find((l) => l.description === "Install receptacle").quantity === 41 && recBlock.sell === 41 * 85 + 41 * 15 + 150, recBlock);
ok("…its line keyed to a measurement the read did not take is left out and SAID, not priced at a made-up quantity", !recBlock.lines.some((l) => l.description === "Panel tie-in") && recBlock.notes.some((n) => /need a measurement/.test(n)));
ok("…its cost is the service's own line costs; its hours come from its production rate × complexity (41 ÷ 3 × 1.15)", recBlock.lineCost === 41 * 30 + 41 * 9.5 + 150 && recBlock.hours === Math.round((41 / 3) * 1.15 * 100) / 100 && recBlock.labourCost === 0, recBlock);
const fixBlock = pricedE.blocks.find((b) => b.rung === "suggestion" && b.itemIds.includes(elec.items.find((i) => i.label === "light_fixture").id));
ok("rung 3: light fixtures — FieldQuo suggestion, NECA 45 min + 40% trim at the commercial factor 1.0 (published), × complexity", fixBlock && fixBlock.hours === Math.round(12 * (45 / 60) * 1.4 * 1.15 * 100) / 100 && fixBlock.sell === null && fixBlock.coefficients.some((c) => /NECA/.test(c.source) && c.tag === "READ") && fixBlock.coefficients.some((c) => c.name === "Productivity" && c.value === 1), fixBlock);
const resE = priceTrade({ ...elec, commercial: false }, { ...pctx, commercial: false, labourRate: 40, assumptions: assumptionsIndex([]) });
const resFix = resE.blocks.find((b) => b.rung === "suggestion" && b.itemIds.includes(elec.items.find((i) => i.label === "light_fixture").id));
ok("…a house keeps the residential factor 0.456 (cited as fitted to one real rewire)", Math.abs(resFix.hours / fixBlock.hours - 0.456) < 0.01 && resFix.coefficients.some((c) => c.value === 0.456 && c.tag === "DERIVED"));
ok("no rate anywhere (conduit, data) → \"No rate — add one\", never a $0 line", pricedE.unpriced.some((u) => u.label === "conduit") && !pricedE.blocks.some((b) => b.itemIds.includes(elec.items.find((i) => i.itemKey === "conduit").id)));
ok("…and a CAD company gets no USD device cost: labour suggested, the material said to be missing", (() => {
  const cad = priceTrade(tradeOf(elec), { ...pctx, currency: "CAD", commercial: true, labourRate: 40, assumptions: assumptionsIndex([]) });
  const b = cad.blocks.find((x) => x.rung === "suggestion" && x.itemIds.includes(elec.items.find((i) => i.label === "light_fixture").id));
  return b.materialCost === null && !b.costComplete && b.notes.some((n) => /US trade prices/.test(n));
})());

const pricedD = priceTrade(dry, { ...pctx, labourRate: 40, assumptions: assumptionsIndex([]) });
const wall = pricedD.blocks.find((b) => b.itemIds.includes(dq("W1 partitions, Level 4").id));
ok("rung 1: drywall walls priced by the drywall rate card — hang + Level 4 at the standard tier (1,089 × (1.20 + 1.45))", wall.rung === "engine" && !wall.own && Math.abs(wall.sell - 1089 * (1.2 + 1.45)) < 0.02 && /starting rates/.test(wall.source), wall);
ok("…its cost from the drywall recipe (hours and board, compound, tape, screws), with the figures cited", wall.hours > 0 && wall.materialCost > 0 && wall.costComplete && wall.coefficients.some((c) => /INTERIOR_RECIPES\.drywall_install/.test(c.source)));
const ownBookD = priceTrade(dry, { ...pctx, books: engineBooks({ drywall_install: { complexity: { standard: { hangPricePerSqft: 2 } } } }), labourRate: 40, assumptions: assumptionsIndex([]) });
ok("…the company's OWN drywall rates move the price and say \"Your drywall rate card\"", ownBookD.blocks[0].own && ownBookD.blocks[0].sell !== wall.sell && /^Your drywall rate card \(/.test(ownBookD.blocks[0].source));
const lvl5 = pricedD.blocks.find((b) => b.itemIds.includes(dq("Lobby ceiling, Level 5").id));
ok("…the Level 5 ceiling bills its level and the ceiling surcharge", lvl5.lines.some((l) => /Level 5/.test(l.description)) && lvl5.lines.some((l) => /Ceiling/.test(l.description)));
const noLevel = pricedD.blocks.find((b) => b.itemIds.includes(dq("Bad level").id));
ok("…a wall with no stated level is priced at Level 4 and SAYS it was assumed", noLevel.notes.some((n) => /Level 4/.test(n) && /not stated/.test(n)));

const pricedF = priceTrade(fr, { ...pctx, labourRate: 40, assumptions: assumptionsIndex([]) });
const fw = pricedF.blocks[0];
ok("framing: the framing book is switched on — 121 lin ft × $26 (2x6 exterior, standard), labelled FieldQuo's starting rates", fw.rung === "suggestion" && fw.sell === 121 * 26 && /framing price book/.test(fw.source) && fw.coefficients.some((c) => /structural\.js FRAMING/.test(c.source) && c.tag === "READ"), fw);
ok("…its cost from the framing recipe: 0.16 h/lin ft, studs at 16 in plus plates (stated)", fw.hours === Math.round(121 * 0.16 * 1.15 * 100) / 100 && fw.coefficients.some((c) => c.name === "Plates" && c.tag === "GUESS"));
ok("…headers from the book, their LVL costed off the printed span", pricedF.blocks[1].sell === 6 * 180 && pricedF.blocks[1].materialCost > 0);
ok("…and a currency the book does not hold (EUR) gets no framing price", priceTrade(fr, { ...pctx, currency: "EUR", labourRate: 40, assumptions: assumptionsIndex([]) }).unpriced.length === 2);

const pricedR = priceTrade(roof, { ...pctx, labourRate: 40, assumptions: assumptionsIndex([]) });
const rb = pricedR.blocks[0];
const engineDirect = buildTradeLineItems("roofing_service", rb.takeoff, null).reduce((n, l) => n + l.amount, 0);
ok("roofing: one roofing takeoff priced by the roofing rate card's own engine — the same total buildTradeLineItems gives", rb.rung === "engine" && Math.abs(rb.sell - engineDirect) < 0.01 && rb.takeoff.squares === 25.42 && rb.takeoff.pitchRise === 6 && rb.takeoff.ridgeHipFt === 40, { sell: rb.sell, engineDirect, takeoff: rb.takeoff });
ok("…timed by roofLabour, shingle cost from Home Depot, and what the cost leaves out is said", rb.hours > 0 && rb.materialCost > 0 && rb.notes.some((n) => /shingles only/.test(n)));

const pricedP = priceTrade(plb, { ...pctx, labourRate: 40, assumptions: assumptionsIndex([]) });
ok("plumbing: no repo figure for a toilet's hours → no rate; a water heater's 3 h (the benchmark's 2–4 h midpoint)", pricedP.unpriced.some((u) => u.label === "water_closet") && pricedP.blocks.some((b) => b.rung === "suggestion" && b.hours === Math.round(3 * 1.15 * 100) / 100));

// Overhead: the job's fair share of the month in crew time.
const rates = overheadRates({ monthlyFixedCosts: 8000, billableHoursPerMonth: 320, jobsPerMonth: 2 });
ok("a two-week job for two people (160 crew-h) in a 320-h month carries half the month: $4,000", overheadForJob({ rates, jobHours: 160 }).amount === 4000 && overheadForJob({ rates, jobHours: 160 }).basis === "per_hour" && overheadForJob({ rates, jobHours: 160 }).share === 0.5);
ok("a two-day job (32 crew-h) carries a tenth: $800", overheadForJob({ rates, jobHours: 32 }).amount === 800);
ok("no hours set: the month split evenly over jobs — 2 a month $4,000, capacity for 3 $2,666.67, 4 $2,000 (labelled per job)", [2, 3, 4].map((j) => overheadForJob({ rates: overheadRates({ monthlyFixedCosts: 8000, jobsPerMonth: j }), jobHours: 160 })).map((o) => `${o.basis}:${o.amount}`).join() === "per_job:4000,per_job:2666.67,per_job:2000");
ok("nothing set: 10% of the price, said as a fallback", overheadForJob({ rates: overheadRates({}), price: 10000 }).basis === "pct_of_price" && overheadForJob({ rates: overheadRates({}), price: 10000 }).amount === 1000);
ok("hostile capacity (0, -5, NaN, \"abc\", 1e9) is \"not said\", never a divisor", [0, -5, NaN, "abc", 1e9].every((v) => overheadRates({ monthlyFixedCosts: 8000, billableHoursPerMonth: v }).perHour === null));

const recoOf = (trades, extra = {}) => recommendPrice({ painting: null, trades, equipment: { total: 0, unpriced: 0 }, labour: { rate: 40, source: "crew" }, target: { pct: 25 }, overhead: pctx.overhead, ...extra });
const r1 = recoOf([pricedE, pricedD]);
const jobH = r1.hours;
ok(`the recommendation's overhead is the job's time share: ${jobH} h × $8,000 ÷ 320 = $${Math.round(8000 * jobH / 320 * 100) / 100}`, r1.overhead.basis === "per_hour" && Math.abs(r1.overhead.amountAtRecommended - (8000 * jobH) / 320) < 0.02, r1.overhead);
const marginAt = (price) => (price - r1.costBeforeOverhead - r1.overhead.amountAtRecommended) / price;
ok("the price at target holds the target exactly: margin at it = 25.00%", Math.abs(marginAt(r1.targetPrice) - 0.25) < 0.0001, { target: r1.targetPrice, m: marginAt(r1.targetPrice) });
ok("your rates' price is your blocks (engine + service), never the suggestions", r1.yourPrice === Math.round((pricedE.blocks.concat(pricedD.blocks).filter((b) => b.rung !== "suggestion").reduce((n, b) => n + b.sell, 0)) * 100) / 100 && r1.flags.includes("suggestions"));
const rPct = recommendPrice({ painting: null, trades: [pricedD], equipment: { total: 0, unpriced: 0 }, labour: { rate: 40 }, target: { pct: 25 }, overhead: { rates: overheadRates({}), fallbackPct: 10 } });
ok("with overhead as 10% of price, target = cost ÷ (1 − 25% − 10%), and its margin is 25%", Math.abs(rPct.targetPrice - rPct.costBeforeOverhead / 0.65) < 0.02 && Math.abs((rPct.targetPrice - rPct.costBeforeOverhead - rPct.targetPrice * 0.1) / rPct.targetPrice - 0.25) < 0.0001);

// The gap: rates that miss the target.
const cheapService = { ...receptacleService, templateLines: receptacleService.templateLines.map((l) => (l.name === "Install receptacle" ? { ...l, unitPrice: 31 } : l)) };
const cheap = priceTrade(tradeOf(elec), { ...pctx, services: [cheapService], commercial: true, labourRate: 40, assumptions: assumptionsIndex([]) });
const rGap = recoOf([cheap]);
ok("rates that miss the target: below target, the gap = target price − your price, the target price recommended", !rGap.meetsTarget && rGap.flags.includes("below_target") && rGap.gap === Math.round((rGap.targetPrice - rGap.withSuggestions) * 100) / 100 && rGap.recommended === rGap.targetPrice && rGap.gap > 0, rGap);
const added = applyPricingOps({ trades: [] }, [{ op: "add_margin_adjustment", amount: 1 }], { recommendation: rGap, userId: "u1" });
ok("one click adds a margin adjustment line for the SERVER's gap (a browser amount is ignored)", added.model.pricing.marginAdjustment.amount === rGap.gap && added.model.pricing.marginAdjustment.targetPct === 25 && /margin adjustment/.test(added.changes[0]));
const rMeets = recoOf([pricedE]);
ok("rates that hold the target: recommended as they are; the adjustment is refused", rMeets.meetsTarget && rMeets.recommended === rMeets.withSuggestions && applyPricingOps({}, [{ op: "add_margin_adjustment" }], { recommendation: rMeets }).dropped.length === 1, rMeets);
const onlyReceptacles = { ...elec, items: elec.items.map((i) => ({ ...i, active: ["receptacle", "receptacle_gfci"].includes(i.itemKey) })) };
const lossReco = recoOf([priceTrade(tradeOf(onlyReceptacles), { ...pctx, services: [{ ...receptacleService, templateLines: receptacleService.templateLines.map((l) => ({ ...l, unitPrice: 1 })) }], commercial: true, labourRate: 40, assumptions: assumptionsIndex([]) })], { overhead: { ...pctx.overhead, minimumPrice: 999999 } });
ok("a loss at your rates is flagged as one; below your minimum price per job too", lossReco.flags.includes("loss") && lossReco.yourMarginPct < 0 && lossReco.flags.includes("below_minimum_price"), lossReco.flags);
ok("the hourly floor is your labour cost + overhead per crew-hour ($40 + $25), and the recommended price earns at least it", r1.hourlyFloor === 65 && r1.earnedPerHour >= 65 && !r1.flags.includes("below_hourly_floor"), [r1.hourlyFloor, r1.earnedPerHour]);
const sugOn = applyPricingOps({}, [{ op: "use_suggestions", tradeKey: "electrical", on: true }], { trades: ["electrical"] });
ok("FieldQuo's suggested lines reach a quote only by a person's button, per trade", sugOn.model.pricing.useSuggestions.electrical === true && applyPricingOps({}, [{ op: "use_suggestions", tradeKey: "roofing", on: true }], { trades: ["electrical"] }).dropped.length === 1);

// The notice: owner/managers (bell + push) and the assignee.
const sent = [];
const fakeNotify = async (e) => {
  sent.push(e);
  return { created: true };
};
const notifyDb = (assigneeRole, already = null) => ({
  notificationEvent: { findFirst: async () => already },
  quote: { findFirst: async () => ({ assignedToId: "u_pm" }) },
  leadRequest: { findFirst: async () => null },
  member: { findFirst: async () => ({ role: assigneeRole }) },
});
await notifyBelowTarget({ read: { id: "prx", title: "Office TI", quoteId: "q1", readAt: new Date().toISOString() }, recommendation: rGap, companyId: "co1" }, { prisma: notifyDb("employee"), notify: fakeNotify });
ok("below target → the approvers' notice AND the quote's estimator, narrowed to that one person", sent.length === 2 && sent[0].type === "planRead.belowTarget" && sent[0].entityId === "prx" && sent[1].type === "planRead.belowTargetAssigned" && JSON.stringify(sent[1].recipientUserIds) === '["u_pm"]' && !("amount" in sent[0].params), sent);
sent.length = 0;
await notifyBelowTarget({ read: { id: "prx", title: "x", quoteId: "q1" }, recommendation: rGap, companyId: "co1" }, { prisma: notifyDb("owner"), notify: fakeNotify });
ok("…an assignee who is already an approver is not told twice", sent.length === 1);
sent.length = 0;
await notifyBelowTarget({ read: { id: "prx", title: "x" }, recommendation: rGap, companyId: "co1" }, { prisma: notifyDb("employee", { id: "ev1" }), notify: fakeNotify });
await notifyBelowTarget({ read: { id: "prx", title: "x" }, recommendation: rMeets, companyId: "co1" }, { prisma: notifyDb("employee"), notify: fakeNotify });
ok("…once per finished read, and never when the rates hold the target", sent.length === 0);
ok("the notice types are registered, link to the read and carry no money", NOTIFICATION_TYPES["planRead.belowTarget"]?.money === false && hrefFor({ entityType: "planRead", entityId: "prx" }) === "/app/quotes/drawings/prx");

// The manual trigger: figures the estimator STATED, a diff, then a person's Apply.
const chatMsgs = [
  { id: "m1", role: "user", text: "My crew hangs 600 sq ft a day on this kind of board" },
  { id: "m2", role: "assistant", text: "Noted — a typical crew does 800." },
  { id: "m3", role: "user", text: "Labour costs us $42 an hour, aim for 30% on this one" },
];
const proposals = [
  { kind: "production_rate", tradeKey: "drywall", itemKey: "wall_board", value: 600, basis: "per_day", messageId: "m1", quote: "hangs 600 sq ft a day" },
  { kind: "production_rate", tradeKey: "drywall", itemKey: "wall_board", value: 700, basis: "per_day", messageId: "m1", quote: "hangs 600 sq ft a day" },
  { kind: "production_rate", tradeKey: "drywall", itemKey: "wall_board", value: 800, basis: "per_day", messageId: "m2", quote: "a typical crew does 800" },
  { kind: "labour_rate", tradeKey: null, itemKey: null, value: 42, basis: "per_hour", messageId: "m3", quote: "Labour costs us $42 an hour" },
  { kind: "target_margin", tradeKey: null, itemKey: null, value: 30, basis: "percent", messageId: "m3", quote: "aim for 30%" },
  { kind: "material_cost", tradeKey: "drywall", itemKey: null, value: 42, basis: "per_unit", messageId: "m3", quote: "Labour costs us $42 an hour" },
  { kind: "waste", tradeKey: null, itemKey: null, value: 12, basis: "percent", messageId: "m3", quote: "allow 12% waste" },
];
const ver = verifyProposals(proposals, chatMsgs, { trades: ["drywall", "electrical"] });
ok("only figures printed in the estimator's OWN words survive: 600/day, $42/h, 30%", ver.accepted.map((a) => `${a.kind}:${a.said}`).sort().join() === "labour_rate:42,production_rate:600,target_margin:30", ver.accepted);
ok("…an invented number, the assistant's figure, an unquoted phrase and an item-less material cost are each refused with the reason", ver.rejected.map((r) => r.reason).sort().join() === "no_item,not_in_message,not_your_message,number_not_stated", ver.rejected.map((r) => r.reason));
ok("…600 sq ft a day is stored per crew-hour (÷ 8), the words kept", ver.accepted.find((a) => a.kind === "production_rate").value === 75);
const meterCalls = [];
const fakeMeter = async () => ({ check: async () => ({ allowed: true }), record: async (u, o) => (meterCalls.push(o.ref), { chargedCents: 3 }) });
const foundIn = await findPricingInputs({ read: { id: "prx", title: "x" }, companyId: "co1", userId: "u1", messages: chatMsgs, trades: ["drywall"] }, { complete: async (args) => (await args.onUsage({ model: "gpt-5-mini", promptTokens: 900, completionTokens: 200, cachedTokens: 0 }), { ok: true, data: { reply: "", proposals } }), meterFor: fakeMeter, recordAiUsage: async () => null, turnId: "t1" });
ok("the button's call is metered and verified; nothing is written by it", foundIn.ok && foundIn.proposals.length === 3 && foundIn.chargedCents === 3 && meterCalls[0] === "plan_read_pricing:prx:t1");
const failedIn = await findPricingInputs({ read: { id: "prx" }, companyId: "co1", messages: chatMsgs, trades: [] }, { complete: async (args) => (await args.onUsage({ model: "gpt-5-mini", promptTokens: 9, completionTokens: 2 }), { ok: false, reason: "vendor_error" }), meterFor: fakeMeter, recordAiUsage: async () => null });
ok("…a failed call charges nothing; no estimator message → refused before any call", !failedIn.ok && meterCalls.length === 1 && (await findPricingInputs({ read: { id: "x" }, companyId: "co1", messages: [chatMsgs[1]], trades: [] }, { meterFor: fakeMeter })).error === "no_messages");
const pricingModel = { ...rowMt.model, trades: [dry] };
const baseView = readPricing({ computed: { trades: [dry], commercial: false }, pricedPaint: null, model: pricingModel, ctx: pctx });
const tried = readPricing({ computed: { trades: [dry], commercial: false }, pricedPaint: null, model: { ...pricingModel, pricingAssumptions: mergeAssumptions([], ver.accepted) }, ctx: pctx });
const diff = pricingDiff(baseView, tried);
ok("the diff shows what the figures change before anything is applied: labour $40 → $42, the target 25% → 30%, the hours", diff.rows.find((r) => r.label === "labour")?.after === 42 && diff.rows.find((r) => r.label === "target")?.after === 30 && diff.rows.some((r) => r.label === "hours") && diff.lines.length > 0, diff);
ok("…the 600/day becomes the wall's hours (1,089 ÷ 75) and is cited on the line as the estimator's figure", tried.trades[0].blocks.find((b) => b.itemIds.includes(dq("W1 partitions, Level 4").id)).hours === Math.round((1089 / 75) * 100) / 100 && tried.trades[0].blocks[0].coefficients.some((c) => /from the conversation/.test(c.name)));
ok("…the what-if target is said to be one, beside the company's own", tried.recommendation.targetWhatIf?.companyPct === 25 && tried.recommendation.targetPct === 30);
const appliedP = applyPricingOps({}, [{ op: "set_pricing_assumptions", assumptions: [...ver.accepted, { ...ver.accepted[0], said: 9999, quote: "hangs 600 sq ft a day" }] }], { messages: chatMsgs, trades: ["drywall", "electrical"], userId: "u1" });
ok("Apply re-checks every figure against the stored messages — a tampered one is refused", appliedP.model.pricingAssumptions.length === 3 && appliedP.dropped.length === 1 && appliedP.changes.length === 3);
ok("the figures stay on the read: removable, and never written to the company's settings", applyPricingOps(appliedP.model, [{ op: "remove_pricing_assumption", id: appliedP.model.pricingAssumptions[0].id }]).model.pricingAssumptions.length === 2 && !/companyServiceCategory|product\.update|forecastSettings/.test(code("lib/planRead/pricingOps.js") + code("app/api/plan-reads/[id]/pricing-from-chat/route.js")));
const pfcSrc = code("app/api/plan-reads/[id]/pricing-from-chat/route.js");
ok("the trigger route writes nothing, is money-gated and scoped to the member's company", !/\.(create|update|updateMany|upsert)\(/.test(pfcSrc) && /showPricing/.test(pfcSrc) && /member\.companyId/.test(pfcSrc) && /await params/.test(pfcSrc));
const draftSrc = code("app/api/plan-reads/[id]/draft-quote/route.js");
ok("the draft quote: your rates' lines always; suggestions only when switched on, each flagged aiSuggested; the adjustment as its own line", /b\.rung === "engine" \|\| b\.rung === "service"/.test(draftSrc) && /useSuggestions\[pt\.tradeKey\] === true/.test(draftSrc) && /aiSuggested: \{ source: b\.source, coefficients: b\.coefficients \}/.test(draftSrc) && /description: "Margin adjustment"/.test(draftSrc));
const readRouteSrc = code("app/api/plan-reads/[id]/route.js");
ok("pricing ops are money-gated; the gap comes from the server's own pricing; messages come from the database", /PRICING_PERSON_OPS/.test(readRouteSrc) && /showPricing/.test(readRouteSrc) && /priceReadNow\(read/.test(readRouteSrc) && /planReadMessage\.findMany\(\{ where: \{ planReadId: read\.id, companyId: member\.companyId, role: "user" \}/.test(readRouteSrc));
const viewNoMoney = await planReadView({ ...rowMt, documents: mtDocs("pmt"), messages: [] }, { companyId: "co1", canSeeMoney: false, prisma: { companyServiceCategory: { findMany: async () => [] } }, pricingCtx: pctx });
const viewMoney = await planReadView({ ...rowMt, documents: mtDocs("pmt"), messages: [] }, { companyId: "co1", canSeeMoney: true, prisma: { companyServiceCategory: { findMany: async () => [] } }, pricingCtx: pctx });
ok("the screen gets the recommendation only with money access", viewNoMoney.pricing === null && viewMoney.pricing?.recommendation?.targetPct === 25 && viewMoney.pricing.trades.length === 2);
ok("the AI is called only through lib/ai/provider.js", !/new OpenAI|from "openai"/.test(["lib/planRead/run.js", "lib/planRead/pricingChat.js", "lib/planRead/tradePrompts.js", "lib/planRead/tradePricing.js"].map(code).join("\n")));
const paintPricing = readPricing({ computed: { ...computed, trades: [] }, pricedPaint: priced, model, ctx: pctx });
ok("a painting read is costed by the Cost & margin panel's own formula (quoteCostSummary) and recommended the same way", paintPricing.painting.hours > 0 && paintPricing.painting.price === priced.paintTotal && paintPricing.recommendation.yourPrice === priced.subtotal && paintPricing.recommendation.targetPrice > 0, paintPricing.painting);
ok("…its low-confidence lines are weighed for \"check before sending\"", paintPricing.painting.lowValue === Math.round(priced.lines.filter((l) => l.estimated).reduce((n, l) => n + l.amount, 0) * 100) / 100);

console.log(`\ncheck-plan-deep-read: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
