// scripts/check-service-template-lines.mjs
//
//   npm run check:service-template-lines
//
// A service's estimate template, expanded onto a quote — lib/quotes/
// serviceTemplateLines.js — executed against hostile input rather than read.
//
//   A. The plain "Add from Products & Services" line is what it was: a
//      templated product added by the row click is ONE line, no template key.
//   B. Measurements the quote's groups hold: the painting room geometry, the
//      optional room left out, the satellite roof (ridge/hip only from a
//      satellite), gutters, stairs, intake counts; zero is absent on a form;
//      the group the template goes into wins over another group's walls.
//   C. Expansion: filled lines say where from; a missing figure opens at
//      quantity 0 (never the template's fallback 1) and names the calculator;
//      an unknown key in a stored template is a plain line; zero / negative
//      qty; no template → nothing.
//   D. Language: the document's language, then English, then the company's
//      own words — flagged, never translated.
//   E. Currency: a row in another currency with no rate converts to nothing
//      and is flagged unpriced, never the foreign figure.
//   F. Duplicate adds are two runs; refilling one leaves the other alone and
//      never overwrites a typed quantity.
//   G. Where it is offered (the owner's quote-type rule), invoices included.
//   H. The completeness check names unfinished template lines until filled.
//   I. ventCount / returnCount are registered and survive the seed loader.

import {
  measurementsFromGroups,
  groupMeasurements,
  expandServiceTemplate,
  refillTemplateRun,
  refillableCount,
  templateOffered,
  calculatorFor,
  unfinishedTemplateLines,
  serviceTextIn,
} from "@/lib/quotes/serviceTemplateLines";
import { lineFromProduct } from "@/lib/quotes/lineDetail";
import { applyLineItemEdit, scopeGroupPayload } from "@/lib/quotes/builderPayload";
import { completenessChecks } from "@/lib/quotes/completeness";
import { isTextLine, lineShowsAmount } from "@/lib/quotes/textBlocks";
import { isMeasurementKey, TRADE_MEASUREMENTS } from "@/lib/services/measurementKeys";
import { seedTemplateFor } from "@/lib/services/seeds";
import { SERVICE_SEEDS } from "@/app/data/serviceSeeds";
import { MEASUREMENT_KEYS as SEED_KEYS } from "@/app/data/serviceSeeds/_templateLines";
import { MEASUREMENT_KEY_LIST } from "@/lib/services/measurementKeys";

let passed = 0;
let fail = 0;
const ok = (cond, label, detail) => {
  if (cond) passed += 1;
  else {
    fail += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
};
const section = (t) => console.log(`\n${t}`);

const product = {
  id: "p_walls",
  name: "Interior repaint",
  description: "Walls and ceilings, two coats.",
  unitPrice: "1800.00",
  costPrice: "900.00",
  unit: "flat",
  translations: { fr: { name: "Peinture intérieure", description: "Murs et plafonds, deux couches." }, en: { name: "Interior repaint EN", description: "EN" } },
  templateEnabled: true,
  estimateTypes: [],
  categories: [{ id: "cat_ip", label: "Interior painting" }],
  templateLines: [
    { kind: "labour", name: "Walls — two coats", description: "Cut in and roll.", qty: 1, unit: "sqft", unitPrice: 1.2, unitCost: 0.6, taxable: true, measurementKey: "wallSqft", translations: { fr: { name: "Murs — deux couches", description: "Découpe et rouleau." } } },
    { kind: "material", name: "Wall paint", description: "Premium eggshell.", qty: 1, unit: "gallon", unitPrice: 70, unitCost: 52, taxable: true, measurementKey: "wallSqft", wastePct: 10, coverage: { per: 350, unit: "sqft" } },
    { kind: "labour", name: "Ceiling", description: "", qty: 1, unit: "sqft", unitPrice: 0.9, unitCost: 0.45, taxable: true, measurementKey: "ceilingSqft" },
    { kind: "labour", name: "Baseboard", description: "", qty: 1, unit: "linear_ft", unitPrice: 1.5, unitCost: 0.75, taxable: true, measurementKey: "linearFt" },
    { kind: "other", name: "Site protection", description: "Floors covered.", qty: 1, unit: "flat", unitPrice: 150, unitCost: 60, taxable: true },
  ],
};

const paintGroup = (tempId, areas, extra = {}) => ({
  tempId,
  label: extra.label || "Interior Painting",
  categoryId: "cat_ip",
  categoryKey: "interior_painting",
  persisted: false,
  takeoff: { model: "area_substrate", estimateType: "interior", areas },
  lineItems: [],
  ...extra,
});
const den = { label: "Den", lengthFt: 10, widthFt: 13, heightFt: 8 };

section("A — the plain add path is unchanged");
{
  const line = lineFromProduct(product, { language: "en", defaultLanguage: "en" });
  ok(JSON.stringify(line) === JSON.stringify({ description: "Interior repaint", quantity: 1, unit: "flat", rate: 1800, amount: 1800, detail: "Walls and ceilings, two coats.", unitCost: 900 }), "a templated product added by the row click is the one line it always was", line);
  ok(!("meta" in line), "no template key on a plain line");
}

section("B — the measurements a quote already holds");
{
  const g = groupMeasurements(paintGroup("a", [den]));
  ok(g.wallSqft.value === 368 && g.ceilingSqft.value === 130 && g.floorSqft.value === 130 && g.linearFt.value === 46 && g.wallSqft.calc === "paint", "a 10 × 13 × 8 den: 368 walls, 130 ceiling, 130 floor, 46 ft perimeter", g);
  const opt = groupMeasurements(paintGroup("a", [den, { ...den, label: "Optional hall", optional: true }]));
  ok(opt.wallSqft.value === 368, "an optional room is an offer, not the job — left out", opt.wallSqft);
  const empty = groupMeasurements(paintGroup("a", [{ label: "Room 1", lengthFt: 0, widthFt: 0, heightFt: 0 }]));
  ok(Object.keys(empty).length === 0, "a room of zeroes is no measurement", empty);
  const hostile = groupMeasurements(paintGroup("a", [null, "x", { lengthFt: -10, widthFt: "abc", heightFt: Infinity }]));
  ok(Object.keys(hostile).length === 0, "negative, NaN, infinite dimensions and junk areas → nothing", hostile);

  const satRoof = { tempId: "r", label: "Roof", categoryKey: "roofing_service", takeoff: { areaSqft: 2140, measuredFrom: "satellite", valleyFt: 0, dripEdgeFt: 180, ridgeVentFt: 44, ridgeHipFt: 60 } };
  const r = groupMeasurements(satRoof);
  ok(r.areaSqft.value === 2140 && r.squares.value === 21.4 && r.valleyFt.value === 0 && r.perimeterFt.value === 180 && r.ridgeFt.value === 44 && r.hipFt.value === 16 && r.squares.calc === "roofSatellite", "satellite roof: squares, a measured zero valley, perimeter, ridge and hip", r);
  const manualRoof = groupMeasurements({ ...satRoof, takeoff: { ...satRoof.takeoff, measuredFrom: "manual" } });
  ok(!("ridgeFt" in manualRoof) && !("hipFt" in manualRoof) && !("valleyFt" in manualRoof) && manualRoof.squares.calc === "roof", "typed roof: a ridge vent is not a ridge length, and zero valleys is not a statement", manualRoof);
  ok(Object.keys(groupMeasurements({ categoryKey: "roofing_service", takeoff: { areaSqft: 0, valleyFt: 0, measuredFrom: "satellite" } })).length === 0, "a satellite roof with no area measured nothing");

  const gut = groupMeasurements({ categoryKey: "gutter_services", takeoff: { gutterFt: 142, downspoutsInstalled: 0, downspoutsFlushed: 4 } });
  ok(gut.gutterFt.value === 142 && gut.downspouts.value === 4, "gutters: run and downspouts", gut);
  const st = groupMeasurements({ categoryKey: "stairs", takeoff: { sections: [{ treads: 13, risers: 14, balusters: 26, posts: 2, handrailFt: 12 }, { treads: 3, risers: 4 }] } });
  ok(st.treads.value === 16 && st.risers.value === 18 && st.balusters.value === 26, "stairs: summed over the staircases", st);
  const cab = groupMeasurements({ categoryKey: "cabinet_refinishing", intakeValues: { doorCount: "24", drawerCount: 8, softCloseHinges: true, constructor: 5, __proto__: { doorCount: 99 } } });
  ok(cab.doorCount.value === 24 && cab.drawerCount.value === 8 && cab.doorCount.calc === "cabinet" && !Object.hasOwn(cab, "constructor"), "intake counts by the registry's names; unknown keys and prototype junk ignored", cab);

  const interior = paintGroup("in", [den], { label: "Interior" });
  const exterior = { ...paintGroup("ex", [{ label: "Front", measurement: "wall", linearFt: 100, heightFt: 12 }], { label: "Exterior" }), categoryKey: "exterior_painting" };
  const intoEx = measurementsFromGroups([interior, exterior], { targetTempId: "ex" });
  const intoIn = measurementsFromGroups([interior, exterior], { targetTempId: "in" });
  ok(intoEx.values.wallSqft === 1200 && intoEx.sources.wallSqft.groupLabel === "Exterior", "the group the template goes into wins", intoEx.sources.wallSqft);
  ok(intoIn.values.wallSqft === 368 && intoIn.sources.wallSqft.groupLabel === "Interior", "…and never a sum of two groups' walls", intoIn.values);
  const other = measurementsFromGroups([interior, { tempId: "e", label: "Electrical", categoryKey: "electrical", lineItems: [] }], { targetTempId: "e" });
  ok(other.values.wallSqft === 368 && other.sources.wallSqft.groupTempId === "in", "a group with no figure borrows another group's, and says which");
  ok(JSON.stringify(measurementsFromGroups(null)) === JSON.stringify({ values: {}, sources: {} }) && JSON.stringify(measurementsFromGroups([null, 7, "x"])) === JSON.stringify({ values: {}, sources: {} }), "hostile group lists → no figures");
}

section("C — expansion: filled, awaiting, unknown key, zero / negative qty");
{
  const m = measurementsFromGroups([paintGroup("a", [den])], { targetTempId: "a" });
  const { lines, summary } = expandServiceTemplate(product, { measurements: m, language: "en", companyLanguage: "en", currency: "CAD", runId: "r1" });
  ok(lines.length === 6 && isTextLine(lines[0]) && !lineShowsAmount(lines[0]) && lines[0].description === "Interior repaint" && lines[0].meta.template.heading, "a quote gets an unpriced heading line carrying the service's name", lines[0]);
  const walls = lines[1];
  ok(walls.quantity === 368 && walls.rate === 1.2 && walls.amount === 441.6 && walls.unitCost === 0.6 && walls.unit === "sqft" && walls.detail === "Cut in and roll.", "walls: 368 sq ft × $1.20, cost carried", walls);
  ok(walls.meta.template.filled.value === 368 && walls.meta.template.filled.calc === "paint" && walls.meta.template.measurementKey === "wallSqft" && !walls.meta.template.awaiting, "…and says where the 368 came from", walls.meta.template);
  ok(lines[2].quantity === 2 && lines[2].amount === 140, "paint: ceil(368 × 1.10 ÷ 350) = 2 gallons", lines[2]);
  ok(lines[4].quantity === 46 && lines[5].quantity === 1 && lines[5].amount === 150 && !lines[5].meta.template.measurementKey, "baseboard from the perimeter; the flat line as typed", [lines[4].quantity, lines[5]]);
  ok(summary.measured === 4 && summary.filled === 4 && summary.awaiting === 0 && summary.lines === 5, "summary: 4 measured, 4 filled, 5 lines (heading not counted)", summary);
  ok(!("taxable" in walls) && !("kind" in walls), "no `taxable` or template `kind` on a quote line — nothing reads them there", Object.keys(walls));

  const none = expandServiceTemplate(product, { measurements: null, currency: "CAD", runId: "r2" });
  const awaitingWalls = none.lines[1];
  ok(awaitingWalls.quantity === 0 && awaitingWalls.amount === 0 && awaitingWalls.rate === 1.2 && awaitingWalls.meta.template.awaiting === true, "no figure: quantity 0 and $0 — never the template's fallback of 1 sq ft", awaitingWalls);
  ok(none.summary.awaiting === 4 && none.lines[5].amount === 150, "every measured line waits; the flat line still prices", none.summary);
  ok(JSON.stringify(calculatorFor("wallSqft", [paintGroup("a", [])])) === JSON.stringify({ calc: "paint", groupTempId: "a", groupLabel: "Interior Painting" }), "a missing wall figure points at the painting group on the quote");
  ok(JSON.stringify(calculatorFor("squares", [])) === JSON.stringify({ calc: "roof", groupTempId: null, groupLabel: null }), "…at the roof takeoff by name when the quote has none — no link to nowhere");
  ok(calculatorFor("each", []) === null && calculatorFor("ventCount", []) === null && calculatorFor("eaveFt", []) === null && calculatorFor("constructor", []) === null, "typed keys, eaves (not kept on the takeoff) and junk name no calculator");
  ok(calculatorFor("wallSqft", [{ ...paintGroup("a", []), persisted: true }]).groupTempId === null, "a saved group's frozen takeoff is not offered as the place to measure");

  const junk = expandServiceTemplate({ id: "j", name: "Junk", templateLines: [
    { kind: "material", name: "Step flashing", qty: 1, unit: "linear_ft", unitPrice: 9, unitCost: 5, measurementKey: "stepFlashingFt" },
    { kind: "labour", name: "Zero", qty: 0, unit: "flat", unitPrice: 50, unitCost: 10 },
    { kind: "labour", name: "Negative", qty: -3, unit: "flat", unitPrice: 50, unitCost: 10 },
    { kind: "labour", name: "", qty: 1, unit: "flat", unitPrice: 50 },
    null,
    "x",
  ] }, { measurements: m, currency: "CAD", runId: "j1", heading: false });
  ok(junk.lines.length === 3, "nameless, null and string lines dropped", junk.lines.map((l) => l.description));
  ok(junk.lines[0].quantity === 1 && junk.lines[0].amount === 9 && !junk.lines[0].meta.template.measurementKey && !junk.lines[0].meta.template.awaiting, "an unknown measurement key in a stored template is a plain line, not a line waiting forever", junk.lines[0]);
  ok(junk.lines[1].quantity === 0 && junk.lines[1].amount === 0 && junk.lines[2].quantity >= 0 && junk.lines[2].amount >= 0, "zero qty stays zero; a negative qty never reaches the quote negative", junk.lines.slice(1));
  ok(JSON.stringify(expandServiceTemplate(null)) === JSON.stringify({ lines: [], summary: { lines: 0, measured: 0, filled: 0, awaiting: 0, unpriced: 0 } }) && expandServiceTemplate({ templateLines: "x" }).lines.length === 0 && expandServiceTemplate({ templateLines: [] }).lines.length === 0, "no template → nothing, not a heading over nothing");

  const hostileM = expandServiceTemplate(product, { measurements: { values: { wallSqft: "abc", ceilingSqft: -5, linearFt: Infinity }, sources: {} }, currency: "CAD", runId: "h", heading: false });
  ok(hostileM.lines.filter((l) => l.meta.template.measurementKey).every((l) => l.meta.template.awaiting && l.quantity === 0), "non-numeric, negative, infinite figures ask rather than fill", hostileM.lines.map((l) => l.quantity));
}

section("D — language: the document's, then English, then the company's words");
{
  const fr = expandServiceTemplate(product, { language: "fr", companyLanguage: "en", currency: "CAD", runId: "f" });
  ok(fr.lines[0].description === "Peinture intérieure" && fr.lines[1].description === "Murs — deux couches" && fr.lines[1].detail === "Découpe et rouleau." && !fr.lines[1].meta.template.untranslated, "French quote: the service and its line in French", [fr.lines[0].description, fr.lines[1].description]);
  ok(fr.lines[2].description === "Wall paint" && fr.lines[2].meta.template.untranslated === true, "a line with no French keeps the source words and is flagged — never machine-translated", fr.lines[2]);
  const frCompany = {
    ...product,
    name: "Peinture intérieure",
    translations: { en: { name: "Interior repaint", description: "Walls" } },
    templateLines: [{ kind: "labour", name: "Murs", description: "Deux couches", qty: 1, unit: "flat", unitPrice: 10, unitCost: 5, translations: { en: { name: "Walls", description: "Two coats" } } }],
  };
  const de = expandServiceTemplate(frCompany, { language: "de", companyLanguage: "fr", currency: "CAD", runId: "d" });
  ok(de.lines[0].description === "Interior repaint" && de.lines[1].description === "Walls" && de.lines[1].detail === "Two coats" && de.lines[1].meta.template.untranslated, "a French company's German quote with no German: English, not French", de.lines.map((l) => l.description));
  const en = expandServiceTemplate(frCompany, { language: "en", companyLanguage: "fr", currency: "CAD", runId: "e" });
  ok(en.lines[1].description === "Walls" && !en.lines[1].meta.template.untranslated, "a French company's English quote: the stored English");
  ok(serviceTextIn({ name: "X", translations: "junk" }, "fr", "en").name === "X" && serviceTextIn(null, "fr", "en").name === "", "hostile translations → the company's own words");
}

section("E — currency");
{
  const usdRow = { id: "u", name: "Row", templateLines: [{ kind: "labour", name: "Labour", qty: 2, unit: "hour", unitPrice: 100, unitCost: 50 }] };
  const mismatch = expandServiceTemplate(usdRow, { currency: "CAD", fromCurrency: "USD", runId: "c1", heading: false });
  ok(mismatch.lines[0].rate === 0 && mismatch.lines[0].amount === 0 && mismatch.lines[0].meta.template.unpriced && !("unitCost" in mismatch.lines[0]) && mismatch.summary.unpriced === 1, "a row in USD on a CAD quote with no rate: $0 and flagged, never the US figure", mismatch.lines[0]);
  const converted = expandServiceTemplate(usdRow, { currency: "CAD", fromCurrency: "USD", fx: 1.37, runId: "c2", heading: false });
  ok(converted.lines[0].rate === 135 && converted.lines[0].amount === 270 && !converted.lines[0].meta.template.unpriced, "with a rate: 100 × 1.37 converted and rounded to the $5 step (roundSuggested)", converted.lines[0]);
  const same = expandServiceTemplate(usdRow, { currency: "CAD", runId: "c3", heading: false });
  ok(same.lines[0].rate === 100 && same.lines[0].unitCost === 50, "the company's own row: already in its currency, taken as is", same.lines[0]);
  const unpricedRow = expandServiceTemplate({ id: "n", name: "N", templateLines: [{ kind: "other", name: "Permit", qty: 1, unit: "flat" }] }, { currency: "CAD", runId: "c4", heading: false });
  ok(unpricedRow.lines[0].rate === 0 && unpricedRow.lines[0].meta.template.unpriced, "a template line with no price lands at $0, flagged", unpricedRow.lines[0]);
}

section("F — duplicate adds, refill");
{
  const groups = [paintGroup("a", [])];
  const first = expandServiceTemplate(product, { measurements: measurementsFromGroups(groups), currency: "CAD", runId: "one" }).lines;
  const second = expandServiceTemplate(product, { measurements: measurementsFromGroups(groups), currency: "CAD", runId: "two" }).lines;
  let items = [...first, ...second];
  ok(items.length === 12 && new Set(items.map((l) => l.meta.template.runId)).size === 2, "the same service twice is two runs — two bathrooms is a real quote", items.length);
  // The estimator types a quantity on one waiting line of run one.
  items = items.map((l, i) => (i === 3 ? applyLineItemEdit(l, "quantity", 90) : l));
  // …then measures the den.
  const measured = measurementsFromGroups([paintGroup("a", [den])], { targetTempId: "a" });
  ok(refillableCount(items, "one", measured) === 3 && refillableCount(items, "two", measured) === 4, "refillable: run one has 3 (one was typed), run two 4", [refillableCount(items, "one", measured), refillableCount(items, "two", measured)]);
  const after = refillTemplateRun(items, "one", measured);
  ok(after[1].quantity === 368 && after[1].amount === 441.6 && after[1].meta.template.filled.value === 368 && !after[1].meta.template.awaiting, "run one's walls fill", after[1]);
  ok(after[2].quantity === 2, "run one's paint fills by coverage and waste", after[2]);
  ok(after[3].quantity === 90 && after[3].amount === 81, "a typed quantity is never overwritten", after[3]);
  ok(after.slice(6).every((l, i) => l === items[6 + i]), "run two untouched — same objects");
  ok(refillTemplateRun(items, "nope", measured).every((l, i) => l === items[i]) && refillTemplateRun(null, "one", measured).length === 0, "unknown run / hostile list → unchanged / empty");
}

section("G — where the template is offered");
{
  const g = { categoryId: "cat_ip", categoryKey: "interior_painting", estimateType: "interior" };
  ok(templateOffered(product, g), "linked quote type, any estimate type → offered");
  ok(!templateOffered({ ...product, templateEnabled: false }, g), "switched off in Settings → not offered");
  ok(!templateOffered({ ...product, estimateTypes: ["cabinets"] }, g), "limited to another painting estimate type → not offered");
  ok(!templateOffered(product, { categoryId: "cat_roof", categoryKey: "roofing_service" }), "another quote type → not offered");
  ok(!templateOffered({ ...product, templateLines: [] }, g) && !templateOffered(null, g) && !templateOffered("x", g), "no template / hostile → not offered");
  ok(templateOffered(product, { invoice: true }) && !templateOffered({ ...product, templateEnabled: false }, { invoice: true }), "an invoice (no quote type): any enabled template");
  const inv = expandServiceTemplate(product, { currency: "CAD", runId: "i", heading: false });
  ok(inv.lines.length === 5 && !inv.lines.some(isTextLine), "an invoice gets no heading line — its renderers would print it as $0.00");
}

section("H — the completeness check");
{
  const quote = { validUntil: "2099-01-01", client: { email: "a@b.c" }, processNotes: "Next steps", clientPhotos: [] };
  const lines = expandServiceTemplate(product, { measurements: null, currency: "CAD", runId: "q" }).lines;
  ok(unfinishedTemplateLines(lines).length === 4, "four measured lines still at $0", unfinishedTemplateLines(lines).map((l) => l.description));
  const checks = completenessChecks(quote, lines);
  const c = checks.find((x) => x.id === "template_lines_unfinished");
  ok(c && c.severity === "high" && /4 template lines are still at \$0/.test(c.title), "named as high before it goes out", c);
  const typed = lines.map((l) => (l.meta.template.awaiting ? applyLineItemEdit(l, "quantity", 10) : l));
  ok(!completenessChecks(quote, typed).some((x) => x.id === "template_lines_unfinished"), "cleared once quantities are typed");
  ok(!completenessChecks(quote, [{ description: "Plain line with words", quantity: 1, rate: 0, amount: 0 }]).some((x) => x.id === "template_lines_unfinished"), "a plain $0 line is not a template line — the check stays silent");
  // The stored row: scopeGroupPayload keeps the meta; the saved qty-0 line
  // reads qty 1 / $0 (the payload's existing rule) and is still flagged.
  const payload = scopeGroupPayload({ tempId: "x", persisted: true, categoryKey: "electrical", lineItems: lines }, null, "en");
  ok(payload.lineItems.length === 6 && payload.lineItems[1].meta.template.awaiting && unfinishedTemplateLines(payload.lineItems).length === 4, "saved: meta rides through, the stored quote is still flagged", payload.lineItems[1]);
}

section("I — ventCount / returnCount registered");
{
  ok(isMeasurementKey("ventCount") && isMeasurementKey("returnCount"), "both keys in lib/services/measurementKeys.js");
  ok(JSON.stringify(TRADE_MEASUREMENTS.air_duct_cleaning) === JSON.stringify(["ventCount", "returnCount"]), "air duct cleaning lists them first in its picker");
  ok(SEED_KEYS.every((k) => MEASUREMENT_KEY_LIST.includes(k)), "every key the seed files may use is registered — nothing pending", SEED_KEYS.filter((k) => !MEASUREMENT_KEY_LIST.includes(k)));
  const duct = Object.values(SERVICE_SEEDS).flatMap((s) => s.services).filter((s) => (s.templateLines || []).some((l) => l.measurementKey === "ventCount" || l.measurementKey === "returnCount"));
  ok(duct.length >= 1, "a seeded service prices by vents / returns", duct.map((s) => s.seedKey));
  const stored = duct.flatMap((s) => seedTemplateFor(s, { language: "en", currency: "USD" }).templateLines || []);
  ok(stored.some((l) => l.measurementKey === "ventCount") && stored.some((l) => l.measurementKey === "returnCount"), "the seed loader keeps the keys on the Product row (the sanitiser dropped them before)");
  const expanded = expandServiceTemplate({ id: "d", name: "Duct", templateLines: stored }, { currency: "USD", runId: "v", heading: false });
  const vent = expanded.lines.find((l) => l.meta.template.measurementKey === "ventCount");
  ok(vent && vent.quantity === 0 && vent.meta.template.awaiting && calculatorFor("ventCount", []) === null, "a vent line waits for the count, and names no calculator (counted on site)", vent);
}

console.log(`\n${passed} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
