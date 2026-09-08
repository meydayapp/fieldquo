// scripts/check-material-calibration.mjs
//
//   npm run check:material-calibration
//
// The close-out material calibration, held end to end: the estimators emit a
// stable key and a basis on every line (both systems), the freeze keeps them,
// the sourcing list derives recipe-trade lines it used to skip, the PATCH
// cannot overwrite an estimate's quantity, a receipt may prefill the used
// quantity, the pure calibration returns a whole-number divisor that
// reproduces the job and refuses to guess where it cannot, every path it
// offers to apply is one the settings routes actually accept — executed, not
// read — the modal never draws the button where canApply is false, the route
// carries the review endpoint's three gates, and every string exists in all
// nine catalogues.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  materialCalibration,
  pickEstimateGroups,
  withPathSet,
  CALIBRATION_REASONS,
} from "@/lib/costing/materialCalibration";
import { estimateScopeGroupCost } from "@/lib/costing/estimateJobCost";
import { tradeMaterialsFor } from "@/lib/costing/tradeMaterials";
import { paintTakeoff, PAINT_TAKEOFF_DEFAULTS } from "@/lib/pricing/paintTakeoff";
import { getRecipe, sanitiseRecipeOverrides } from "@/app/data/materialRecipes";
import { getPriceBook, PRICE_BOOK_FIELDS, PRICE_BOOK_GROUPS, readField } from "@/app/data/tradePriceBooks";
import { PREFILLABLE, prefillMaterial, suggestedQuantity } from "@/lib/receipts/prefill";
import { deriveSourcingLines } from "@/lib/jobs/sourcingList";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra)?.slice(0, 300));
  }
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (p) => read(p).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

/* ══ 1. Both estimators name every line ═══════════════════════════════════ */

console.log("\nEvery estimated material carries a materialKey");

const cabinet = estimateScopeGroupCost({
  categoryKey: "cabinet_refinishing",
  intake: { doorCount: 20, drawerCount: 8, woodSpecies: "oak" },
});
ok("cabinet refinishing estimates from intake", cabinet && cabinet.materials.length >= 5);
ok("...every line has a materialKey", cabinet.materials.every((m) => typeof m.materialKey === "string" && m.materialKey), cabinet.materials.map((m) => m.materialKey));
ok("...tape, masking film, sandpaper, primer, top coat, hardener are all there",
  ["tape", "maskingFilm", "sandpaper", "primer", "topCoat", "hardener"].every((k) => cabinet.materials.some((m) => m.materialKey === k)));
ok("...tape's basis is the doors+drawers divisor at consumables.tape.perUnits",
  (() => { const t = cabinet.materials.find((m) => m.materialKey === "tape"); return t.basis.units === 28 && t.basis.path === "consumables.tape.perUnits" && t.basis.rate === 8 && t.basis.store === "recipe"; })(),
  cabinet.materials.find((m) => m.materialKey === "tape")?.basis);
ok("...masking film's basis carries the per-job allowance as an offset",
  cabinet.materials.find((m) => m.materialKey === "maskingFilm")?.basis?.offset === 1);
ok("...sandpaper has NO basis — a price per piece is not a consumption ratio",
  cabinet.materials.find((m) => m.materialKey === "sandpaper")?.basis === null);
ok("...primer's basis counts sqft OF COATING (three coats on oak)",
  cabinet.materials.find((m) => m.materialKey === "primer")?.basis?.units === (20 * 12 + 8 * 3) * 3);

const exterior = estimateScopeGroupCost({
  categoryKey: "exterior_painting",
  intake: { wallSquareFootage: 2000, coats: 2, trimLinearFt: 300 },
});
ok("exterior painting (production-rate recipe) keys wall and trim paint",
  ["wallPaint", "trimPaint"].every((k) => exterior?.materials.some((m) => m.materialKey === k)));

const roofTakeoff = { squares: 20, pitch: "6/12", materialKey: "asphalt_architectural", iceWaterFt: 60, dripEdgeFt: 120, starterFt: 120, ridgeHipFt: 40, ridgeVentFt: 30, stepFlashingFt: 20, ventBoots: 2, boxVents: 2 };
const roof = tradeMaterialsFor("roofing_service", roofTakeoff, null);
ok("roofing (takeoff system) produces a bill", roof && roof.materials.length > 5, roof?.materials?.length);
ok("...every roofing line has a materialKey", roof.materials.every((m) => m.materialKey), roof.materials.map((m) => m.materialKey));
ok("...and NO basis — packaging constants have no override path a company can save",
  roof.materials.every((m) => m.basis === null));

const paintTakeoffFixture = {
  model: "area_substrate",
  areas: [{ areaType: "den", lengthFt: 10, widthFt: 12, heightFt: 8, substrates: [{ key: "walls" }, { key: "ceiling" }] }],
};
const paint = tradeMaterialsFor("interior_painting", paintTakeoffFixture, null);
ok("interior painting keys each product", paint.materials.every((m) => m.materialKey) && paint.materials.some((m) => m.materialKey === "wall_interior"), paint.materials.map((m) => m.materialKey));
ok("...with a basis at takeoff.products.<key>.coverageSqftPerGal, store 'book'",
  paint.materials.every((m) => m.basis?.store === "book" && m.basis.path === `takeoff.products.${m.materialKey}.coverageSqftPerGal` && m.basis.units > 0 && m.basis.rate > 0),
  paint.materials.map((m) => m.basis));
const pt = paintTakeoff(paintTakeoffFixture, PAINT_TAKEOFF_DEFAULTS);
ok("paintTakeoff's purchase list carries coatingSqft and coverageSqftPerGal",
  pt.purchase.every((p) => p.coatingSqft > 0 && p.coverageSqftPerGal > 0), pt.purchase);
ok("...and coatingSqft ÷ coverage, ceiled, IS the gallons it reports",
  pt.purchase.every((p) => Math.ceil(p.coatingSqft / p.coverageSqftPerGal) === p.gallons), pt.purchase);

/* ══ 2. The freeze and the sourcing list keep them ════════════════════════ */

console.log("\nThe key and basis survive the freeze and reach the sourcing list");

const freeze = code("app/api/quotes/costingWrite.js");
ok("QuoteCosting.groups freezes materialKey and basis with each line",
  /materialKey: m\.materialKey \?\? null,\s*basis: m\.basis \?\? null,/.test(freeze));

const cabinetJob = {
  quote: {
    scopeGroups: [{ category: { key: "cabinet_refinishing" }, label: "Kitchen", intakeValues: { doorCount: 20, drawerCount: 8 }, takeoff: null }],
    costing: null,
  },
  recipeOverrides: {},
};
const derivedLines = deriveSourcingLines(cabinetJob);
ok("deriveSourcingLines produces lines for cabinet refinishing (it used to skip every recipe trade)",
  derivedLines.length >= 5 && derivedLines.every((l) => l.categoryKey === "cabinet_refinishing"), derivedLines.length);
ok("...each carrying its materialKey", derivedLines.every((l) => l.materialKey), derivedLines.map((l) => l.materialKey));
ok("...tape, sandpaper and primer among them", ["tape", "sandpaper", "primer"].every((k) => derivedLines.some((l) => l.materialKey === k)));

const frozenJob = {
  quote: {
    scopeGroups: cabinetJob.quote.scopeGroups,
    costing: { groups: [{ categoryKey: "cabinet_refinishing", label: "Kitchen", materials: [{ name: "Frozen tape", qty: 99, unit: "roll", materialKey: "tape", basis: null }] }] },
  },
  recipeOverrides: {},
};
const frozenLines = deriveSourcingLines(frozenJob);
ok("...and prefers the quote's FROZEN bill of materials when it was costed", frozenLines.length === 1 && frozenLines[0].name === "Frozen tape" && frozenLines[0].qty === 99, frozenLines);
ok("...but a recipe group with no intake answers yields nothing (absence is not padded)",
  deriveSourcingLines({ quote: { scopeGroups: [{ category: { key: "cabinet_refinishing" }, intakeValues: {} }] } }).length === 0);

const sourcing = code("lib/jobs/sourcingList.js");
ok("regenerate loads the quote's costing and the recipe overrides", /costing: \{ select: \{ groups: true \} \}/.test(sourcing) && /recipeOverridesFor\(companyId\)/.test(sourcing));

/* ══ 3. The estimate quantity is protected; the used quantity is captured ═ */

console.log("\nqty stays the estimate; actualQty is what was used");

const schema = read("prisma/schema.prisma");
ok("JobMaterial carries actualQty and materialKey", /actualQty Decimal\? @db\.Decimal\(12, 2\)/.test(schema) && /materialKey String\?/.test(schema));

const patch = code("app/api/jobs/[id]/materials/route.js");
ok("PATCH refuses qty on a derived line, out loud", /if \(body\.qty !== undefined && !line\.addedByHand\)[\s\S]{0,400}status: 400/.test(patch));
ok("...and writes qty only when the line was added by hand", /body\.qty !== undefined &&\s*line\.addedByHand && \{ qty:/.test(patch));
ok("...writes actualQty", /\.\.\.\(actualQty !== undefined && purchased && \{ actualQty \}\)/.test(patch));
ok("...refuses a non-numeric or negative used quantity", /!Number\.isFinite\(n\) \|\| n < 0[\s\S]{0,300}status: 400/.test(patch));
ok("...and a quantity-only PATCH leaves the receipt fields alone", /const isTick = body\.purchased !== undefined;/.test(patch) && /\.\.\.\(isTick && \{/.test(patch));
ok("...the shape returns actualQty and materialKey", /actualQty: m\.actualQty == null \? null : num\(m\.actualQty\)/.test(patch) && /materialKey: m\.materialKey/.test(patch));

ok("PREFILLABLE carries actualQty", PREFILLABLE.includes("actualQty"));
ok("a one-line receipt printing '3' offers 3", suggestedQuantity({ items: [{ quantity: "3" }] }) === 3);
ok("...'2 EA' offers 2", suggestedQuantity({ items: [{ quantity: "2 EA" }] }) === 2);
ok("...a two-line receipt offers nothing — it cannot say which line is which", suggestedQuantity({ items: [{ quantity: "3" }, { quantity: "1" }] }) === null);
ok("...'3.5 kg' offers nothing — not a count", suggestedQuantity({ items: [{ quantity: "3.5 kg" }] }) === null);
ok("...and a typed quantity is never overwritten by the scan", prefillMaterial({ actualQty: 4 }, { actualQty: 3 }).values.actualQty === 4 && prefillMaterial({ actualQty: 4 }, { actualQty: 3 }).kept.includes("actualQty"));
const scanRoute = code("app/api/receipts/scan/route.js");
ok("the scan route offers actualQty from the receipt and reads the stored one", /actualQty: suggestedQuantity\(extraction\.data\)/.test(scanRoute) && /actualQty: material\.actualQty === null/.test(scanRoute));
const scanner = code("app/components/purchasing/ReceiptScanner.js");
ok("the scanner carries actualQty through both prefill calls via one helper pair", /existingFromDraft\(draft\), offeredFromScan\(scan\)/.test(scanner) && (scanner.match(/existingFromDraft\(draft\), offeredFromScan\(scan\)/g) || []).length === 2);
const list = code("app/components/jobs/JobMaterials.js");
ok("the materials list asks how many were used, pre-filled from the estimate", /actualQty: String\(m\.qty \?\? ""\)/.test(list) && /app\.jobMaterials\.usedLabel/.test(list));
ok("...sends actualQty with the tick", /actualQty:\s*draft\.actualQty === "" \|\| !Number\.isFinite\(qty\) \? null : qty/.test(list));
ok("...and lets a bought line record it afterwards through a quantity-only PATCH", /send\("PATCH", \{ materialId: m\.id, actualQty: qty \}\)/.test(list));
ok("...never shows the estimate as if it were the used quantity", /app\.jobMaterials\.usedUnknown/.test(list));

/* ══ 4. The pure calibration ══════════════════════════════════════════════ */

console.log("\nmaterialCalibration: whole-number divisors that reproduce the job, and honest refusals");

const tapeBasis = { store: "recipe", units: 2500, unitLabel: "doorsDrawers", path: "consumables.tape.perUnits", rate: 125, rateLabel: "doorsDrawersPerRoll", kind: "divisor", offset: 0, whole: true };
const groups = [{ categoryKey: "cabinet_refinishing", materials: [
  { name: "Painter's tape", qty: 20, unit: "roll", materialKey: "tape", basis: tapeBasis },
  { name: "Masking film", qty: 3, unit: "roll", materialKey: "maskingFilm", basis: { ...tapeBasis, path: "consumables.maskingFilm.perUnits", rate: 15, offset: 1, units: 28 } },
  { name: "Hardener / catalyst", qty: 2, unit: "qt", materialKey: "hardener", basis: { store: "recipe", units: 24, unitLabel: "quartsTopCoat", path: "hardenerPctOfTopCoat", rate: 0.05, rateLabel: "catalystPerQuart", kind: "multiplier", offset: 0, whole: false } },
  { name: "Sandpaper / abrasives", qty: 28, unit: "unit", materialKey: "sandpaper", basis: null },
] }];
const currentRates = { recipes: { cabinet_refinishing: { consumables: { tape: { perUnits: 125 }, maskingFilm: { perUnits: 15 } }, hardenerPctOfTopCoat: 0.05 } }, books: {} };
const run = (rows) => materialCalibration({ materials: rows, groups, currentRates });

const [tape] = run([{ id: "m1", materialKey: "tape", categoryKey: "cabinet_refinishing", name: "Painter's tape", unit: "roll", qty: 20, actualQty: 27 }]);
ok("tape 20 est / 27 actual over 2,500 → a whole-number divisor", tape.canApply && Number.isInteger(tape.suggestedRate), tape);
ok("...that REPRODUCES the 27 rolls under the recipe's own ceil()", Math.ceil(2500 / tape.suggestedRate) === 27, tape.suggestedRate);
ok("...is 93 (nearest whole to 2500/27)", tape.suggestedRate === 93, tape.suggestedRate);
ok("...with the delta against today's rate", tape.deltaPct === -25.6 && tape.currentRate.value === 125 && tape.currentRate.path === "consumables.tape.perUnits", tape);
ok("...and per-unit figures both ways", tape.estimatedPerUnit === 0.008 && tape.actualPerUnit === 0.0108, tape);

const [noActual] = run([{ id: "m1", materialKey: "tape", categoryKey: "cabinet_refinishing", name: "Painter's tape", unit: "roll", qty: 20, actualQty: null }]);
ok("missing actualQty → no suggestion, canApply false, reason no_actual", !noActual.canApply && noActual.suggestedRate === null && noActual.reason === CALIBRATION_REASONS.NO_ACTUAL, noActual);
ok("...but the current rate and the denominator are still reported", noActual.currentRate?.value === 125 && noActual.unitsOfWork === 2500);

const [same] = run([{ id: "m1", materialKey: "tape", categoryKey: "cabinet_refinishing", name: "Painter's tape", unit: "roll", qty: 20, actualQty: 20 }]);
ok("used exactly the estimate → matches, nothing to apply", !same.canApply && same.reason === CALIBRATION_REASONS.MATCHES);

const [film] = run([{ id: "m2", materialKey: "maskingFilm", categoryKey: "cabinet_refinishing", name: "Masking film", unit: "roll", qty: 3, actualQty: 1 }]);
ok("masking film used within its per-job allowance → within_allowance, no suggestion", !film.canApply && film.reason === CALIBRATION_REASONS.WITHIN_ALLOWANCE, film);
const [film2] = run([{ id: "m2", materialKey: "maskingFilm", categoryKey: "cabinet_refinishing", name: "Masking film", unit: "roll", qty: 3, actualQty: 5 }]);
ok("...and above it, the offset is subtracted before dividing (28 ÷ 4 → 7)", film2.canApply && film2.suggestedRate === 7 && 1 + Math.ceil(28 / 7) === 5, film2);

const [hard] = run([{ id: "m3", materialKey: "hardener", categoryKey: "cabinet_refinishing", name: "Hardener / catalyst", unit: "qt", qty: 2, actualQty: 3 }]);
ok("a multiplier rate (catalyst %) suggests actual ÷ units as a fraction", hard.canApply && hard.suggestedRate === 0.125, hard);

const [sand] = run([{ id: "m4", materialKey: "sandpaper", categoryKey: "cabinet_refinishing", name: "Sandpaper / abrasives", unit: "unit", qty: 28, actualQty: 30 }]);
ok("a line with no basis → not_overridable, never a button", !sand.canApply && sand.reason === CALIBRATION_REASONS.NOT_OVERRIDABLE);

const [byName] = run([{ id: "m5", materialKey: null, categoryKey: "cabinet_refinishing", name: "Painter's tape", unit: "roll", qty: 20, actualQty: 27 }]);
ok("a row written before materialKey existed matches on name + unit", byName.canApply && byName.suggestedRate === 93);
ok("a hand-added line is left out entirely", run([{ id: "h", addedByHand: true, categoryKey: "cabinet_refinishing", name: "Gas", unit: "each", qty: 1, actualQty: 2 }]).length === 0);
ok("an unknown line → no_basis", run([{ id: "x", materialKey: "nope", categoryKey: "cabinet_refinishing", name: "?", unit: "each", qty: 1, actualQty: 2 }])[0].reason === CALIBRATION_REASONS.NO_BASIS);

const [noRate] = materialCalibration({ materials: [{ id: "m1", materialKey: "tape", categoryKey: "cabinet_refinishing", name: "Painter's tape", unit: "roll", qty: 20, actualQty: 27 }], groups, currentRates: { recipes: {}, books: {} } });
ok("no current rate to compare against → no_rate, no button", !noRate.canApply && noRate.reason === CALIBRATION_REASONS.NO_RATE);

ok("pickEstimateGroups prefers a frozen set that carries a basis", pickEstimateGroups({ frozen: groups, derived: [] }).source === "frozen");
ok("...and falls back to the derivation when the freeze predates basis", pickEstimateGroups({ frozen: [{ categoryKey: "x", materials: [{ name: "a", qty: 1 }] }], derived: groups }).source === "derived");

ok("withPathSet sets a nested path without touching siblings", JSON.stringify(withPathSet({ consumables: { tape: { perUnits: 8, costPerRoll: 8 } } }, "consumables.tape.perUnits", 6)) === JSON.stringify({ consumables: { tape: { perUnits: 6, costPerRoll: 8 } } }));
ok("...and refuses a prototype key", !("polluted" in {}) && Object.keys(withPathSet({}, "__proto__.polluted", 1)).length === 0 && !("polluted" in {}));

/* ══ 5. Every offered path is one the settings routes accept — executed ═══ */

console.log("\nEvery recipe basis path survives sanitiseRecipeOverrides; every book path survives the rate card");

for (const [key, est] of [["cabinet_refinishing", cabinet], ["exterior_painting", exterior]]) {
  for (const m of est.materials) {
    if (!m.basis) continue;
    const { overrides, errors } = sanitiseRecipeOverrides(key, withPathSet({}, m.basis.path, m.basis.whole ? 7 : 0.07));
    const kept = m.basis.path.split(".").reduce((n, p) => (n == null ? undefined : n[p]), overrides);
    ok(`${key} ${m.materialKey} → ${m.basis.path} is accepted by sanitiseRecipeOverrides`, errors.length === 0 && kept !== undefined, { errors, overrides });
    const merged = getRecipe(key, overrides);
    const live = m.basis.path.split(".").reduce((n, p) => (n == null ? undefined : n[p]), merged);
    ok(`...and getRecipe reads it back`, live === (m.basis.whole ? 7 : 0.07), live);
  }
}
// The recipe re-run with the suggested tape divisor predicts the recorded rolls.
const recal = estimateScopeGroupCost({ categoryKey: "cabinet_refinishing", intake: { doorCount: 20, drawerCount: 8 }, recipeOverrides: { consumables: { tape: { perUnits: 7 } } } });
ok("re-running the estimate with a suggested divisor moves the tape count", recal.materials.find((m) => m.materialKey === "tape").qty === Math.ceil(28 / 7));

for (const book of ["interior_painting", "exterior_painting"]) {
  const fields = PRICE_BOOK_FIELDS[book];
  const coverage = fields.filter((f) => /^takeoff\.products\.[a-z_]+\.coverageSqftPerGal$/.test(f.path));
  ok(`${book} declares a coverage path per paint product`, coverage.length === Object.keys(PAINT_TAKEOFF_DEFAULTS.products).length, coverage.map((f) => f.path));
  ok(`...all internal (never a client-facing price) and in a labelled group`, coverage.every((f) => f.internal === true && PRICE_BOOK_GROUPS[f.group]));
  ok(`...and each resolves to a real number on the default book`, coverage.every((f) => Number(readField(getPriceBook(book), f.path)) > 0));
}
// The override lands where paintTakeoff reads, and moves the buy list.
const patched = { takeoff: { products: { wall_interior: { coverageSqftPerGal: 200 } } } };
const before = tradeMaterialsFor("interior_painting", paintTakeoffFixture, null).materials.find((m) => m.materialKey === "wall_interior");
const after = tradeMaterialsFor("interior_painting", paintTakeoffFixture, patched).materials.find((m) => m.materialKey === "wall_interior");
ok("a saved coverage override changes the gallons paintTakeoff buys (the loop closes for interior paint)", before.qty < after.qty && after.basis.rate === 200, { before: before.qty, after: after.qty });
ok("...and leaves the other products' coverage alone", readField(getPriceBook("interior_painting", patched), "takeoff.products.ceiling_flat.coverageSqftPerGal") === 350);
const svc = code("app/api/settings/service-categories/route.js");
ok("sanitiseRates keeps exactly the PRICE_BOOK_FIELDS paths (so the coverage row is saved, and nothing else new is)", /for \(const field of fields\) \{\s*const value = readPath\(rates, field\.path\);/.test(svc));

// The paint calibration through the pure function, with the book as the rate source.
const paintGroups = [{ categoryKey: "interior_painting", materials: paint.materials }];
const [wallCal] = materialCalibration({
  materials: [{ id: "w", materialKey: "wall_interior", categoryKey: "interior_painting", name: "Interior wall", unit: "gal", qty: before.qty, actualQty: before.qty + 1 }],
  groups: paintGroups,
  currentRates: { recipes: {}, books: { interior_painting: getPriceBook("interior_painting") } },
});
ok("interior wall paint: one gallon over → a lower whole-number coverage that reproduces the tins bought",
  wallCal.canApply && Number.isInteger(wallCal.suggestedRate) && Math.ceil(before.basis.units / wallCal.suggestedRate) === before.qty + 1 && wallCal.currentRate.store === "book", wallCal);

/* ══ 6. The route and the modal ═══════════════════════════════════════════ */

console.log("\nThe calibration route is gated like the review; the modal never draws a dead button");

const route = code("app/api/jobs/[id]/costing/calibration/route.js");
ok("route: jobCosting toggle", /hasToggle\(full, "jobCosting"\)/.test(route));
ok("route: the job's EDIT level", /requireLevel\(full, "jobs", "view_create_edit"/.test(route));
ok("route: assigned-jobs scope on the query", /companyId: member\.companyId, \.\.\.assignedJobWhere\(full\)/.test(route));
ok("route: the job's view level first", /levelOrRefusal\(member, "jobs", "view_only"/.test(route));
ok("route: never writes (no db.*.update/create/upsert/delete)", !/db\.\w+\.(update|create|upsert|delete)/.test(route));
ok("route: the button is withheld from a caller the settings routes would refuse", /canWriteCostBasis\(full, "materialRecipes"\)/.test(route) && /\["owner", "admin"\]\.includes\(member\.role\)/.test(route) && /CALIBRATION_REASONS\.PERMISSION/.test(route));
const review = code("app/api/jobs/[id]/costing/review/route.js");
for (const gate of [/hasToggle\(full, "jobCosting"\)/, /requireLevel\(full, "jobs", "view_create_edit"/, /\.\.\.assignedJobWhere\(full\)/]) {
  ok(`route and review share gate ${gate}`, gate.test(route) && gate.test(review));
}

const modal = code("app/components/jobs/CostReview.js");
ok("modal fetches the calibration", /\/api\/jobs\/\$\{jobId\}\/costing\/calibration/.test(modal));
const applyRenders = modal.match(/app\.jobCosting\.calibApply"/g) || [];
ok("modal renders the apply button exactly once, inside `l.canApply ? (`", applyRenders.length === 1 && /l\.canApply \? \(\s*<button[\s\S]{0,700}app\.jobCosting\.calibApply"/.test(modal));
ok("...a line with no used quantity says to record it, with a link to the list", /app\.jobCosting\.calibRecord"[\s\S]{0,200}goToMaterials/.test(modal));
ok("...the section renders only when at least one line has actualQty", /calibLines\.length > 0 && calib\.hasActuals && \(/.test(modal));
ok("...a failed load is said, not hidden", /calib\?\.failed && \(/.test(modal) && /app\.jobCosting\.calibLoadFailed/.test(modal));
ok("...applying reads the current override document and sets ONE path on it", /withPathSet\(overrides, path, value\)/.test(modal) && /withPathSet\(cat\.rateOverrides \|\| \{\}, path, value\)/.test(modal));
ok("...the rate-card write round-trips enabled/defaultRate/unit (the PATCH nulls what it isn't sent)", /enabled: cat\.enabled,\s*defaultRate: cat\.defaultRate \?\? null,\s*unit: cat\.unit \?\? null,/.test(modal));
ok("...success names the new value and links to Settings", /app\.jobCosting\.calibApplied"/.test(modal) && /\/app\/settings\/material-costs/.test(modal) && /\/app\/settings\/services/.test(modal));
ok("...never swallows a failed apply", /await reportResponseError\(res, t\("app\.jobCosting\.calibApplyFailed"/.test(modal));
ok("the materials list carries the anchor the modal scrolls to", /id="job-materials"/.test(list));

/* ══ 7. Nine catalogues ═══════════════════════════════════════════════════ */

console.log("\nEvery string in all nine catalogues");

const catalogue = read("app/i18n/appMessages.js");
const literalKeys = [...new Set([
  ...[...modal.matchAll(/t\(\s*"(app\.jobCosting\.calib[a-zA-Z_]+)"/g)].map((m) => m[1]),
  ...[...list.matchAll(/t\(\s*"(app\.jobMaterials\.[a-zA-Z_]+)"/g)].map((m) => m[1]),
  "app.receipt.field.actualQty",
])];
const dynamicKeys = [
  ...Object.values(CALIBRATION_REASONS).filter((r) => r !== CALIBRATION_REASONS.NO_ACTUAL).map((r) => `app.jobCosting.calibReason_${r}`),
  ...[...cabinet.materials, ...exterior.materials, ...paint.materials].filter((m) => m.basis).flatMap((m) => [`app.jobCosting.calibUnit_${m.basis.unitLabel}`, `app.jobCosting.calibRate_${m.basis.rateLabel}`]),
];
for (const k of [...new Set([...literalKeys, ...dynamicKeys])]) {
  const n = (catalogue.match(new RegExp(`"${k.replace(/\./g, "\\.")}": `, "g")) || []).length;
  ok(`${k} exists in all nine catalogues`, n === 9, n);
}
ok("no new string types its own currency symbol", !/calib[A-Za-z_]+": "[^"]*\$/.test(catalogue));

console.log(`\ncheck-material-calibration: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
