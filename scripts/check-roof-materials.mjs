// scripts/check-roof-materials.mjs
//
//   npm run check:roof-materials
//
// The main roofing material — the biggest single line in a re-roof — was the
// only line on the bill that did not price, and the quantity beside it was
// wrong too.
//
// ══ What the owner saw ════════════════════════════════════════════════════
//
//     Roofing · 21.63 squares · 14/12 · +10% waste
//     Standing seam metal — bundles — 72 bundle      ← no price set
//     Synthetic underlayment — 3 roll        $453.00
//     Ice & water membrane — 3 roll          $293.88
//     …every accessory priced…
//
// Two faults with one cause. `metal_standing_seam` said nothing about its own
// packaging, so roofingMaterials() fell through to ROOF_PACKAGING's asphalt
// default of three bundles to a square — a constant belonging to a different
// product — and then looked for `materialCostPerBundle`, which is null there
// because Home Depot Canada does not sell standing seam panel and inventing a
// price is not on offer. So the quantity was asphalt's arithmetic applied to
// steel, and the unit was a bundle nobody sells it in.
//
// ══ Executed, not read ════════════════════════════════════════════════════
//
// Sections 1-6 run the shipped pure functions: panelCoverageSqft(),
// roofMaterialCoverage(), applyMaterialOverrides() and tradeMaterialsFor()
// against real books and against hostile input — zero coverage, a missing
// price, an absurd area, a lap longer than the panel, a negative quantity, a
// price of zero, and an overrides map that is a string.
//
// Sections 7-9 read source, and read it DECOMMENTED. This file names the
// products and the units at length and would otherwise match its own prose.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// See the report in the commit message: every rule asserted here was broken in
// the shipped file and this check was confirmed to exit non-zero, then the file
// was restored from a `cp` backup.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  tradeMaterialsFor,
  roofMaterialCoverage,
  panelCoverageSqft,
  applyMaterialOverrides,
  ROOF_PACKAGING,
} from "@/lib/costing/tradeMaterials";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import { APP_MESSAGE_KEYS } from "../app/i18n/appMessages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(
      `  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`,
    );
  }
  return Boolean(cond);
}
const section = (t) => console.log(`\n${t}\n`);

/** Strip comments so a check cannot match its own prose. */
function decomment(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      out += c; i++; continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += "\n"; i++; continue; }
      out += " "; i++; continue;
    }
    if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
    out += c === "\n" ? "\n" : " ";
    i++;
  }
  return out;
}

/** The owner's roof: 2,163 sqft at 14/12, the address that started all this. */
const OWNERS_ROOF = {
  areaSqft: 2163,
  pitchRise: 14,
  layers: 1,
  iceWaterFt: 90,
  dripEdgeFt: 190,
  starterFt: 190,
  ridgeHipFt: 100,
  ridgeVentFt: 40,
};
const bill = (takeoff, overrides) =>
  tradeMaterialsFor("roofing_service", takeoff, overrides ?? null);
/** The main material's line — the FIRST line, by construction. */
const mainLine = (b) => b.materials.find((m) => m.materialKey === "bundles");

const BOOK = getPriceBook("roofing_service", null);

// ═══════════════════════════════════════════════════════════════════════════
section("1. A panel covers less than it measures");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Vicwest UltraVic, 36" net coverage x 93", 6" end lap. 36 x 87 / 144.
  ok(
    "Vicwest UltraVic covers 21.75 sqft, not its 23.25 sqft of steel",
    panelCoverageSqft({ coverWidthIn: 36, lengthIn: 93, endLapIn: 6 }) === 21.75,
    panelCoverageSqft({ coverWidthIn: 36, lengthIn: 93, endLapIn: 6 }),
  );
  ok(
    "…and with no lap it is the gross 23.25",
    panelCoverageSqft({ coverWidthIn: 36, lengthIn: 93, endLapIn: 0 }) === 23.25,
  );
  ok(
    "…so the lap costs real coverage, never adds it",
    panelCoverageSqft({ coverWidthIn: 36, lengthIn: 93, endLapIn: 6 }) <
      panelCoverageSqft({ coverWidthIn: 36, lengthIn: 93, endLapIn: 0 }),
  );

  // Hostile. Every one of these must be null — a coverage the caller can
  // fall back from — and never 0, NaN or Infinity, each of which divides
  // into an order for an infinite roof.
  const hostile = [
    ["no width", { coverWidthIn: 0, lengthIn: 93 }],
    ["no length", { coverWidthIn: 36, lengthIn: 0 }],
    ["negative width", { coverWidthIn: -36, lengthIn: 93 }],
    ["missing both", {}],
    ["strings", { coverWidthIn: "wide", lengthIn: "long" }],
    ["NaN", { coverWidthIn: NaN, lengthIn: NaN }],
    ["lap longer than the panel", { coverWidthIn: 36, lengthIn: 93, endLapIn: 400 }],
    ["lap exactly the panel", { coverWidthIn: 36, lengthIn: 93, endLapIn: 93 }],
  ];
  for (const [name, spec] of hostile) {
    ok(`${name} yields null, not a number to divide by`, panelCoverageSqft(spec) === null, panelCoverageSqft(spec));
  }
  ok("a negative lap is treated as no lap", panelCoverageSqft({ coverWidthIn: 36, lengthIn: 93, endLapIn: -20 }) === 23.25);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Coverage is a property of the material, and says where it came from");
// ═══════════════════════════════════════════════════════════════════════════

{
  const c = (m, p) => roofMaterialCoverage(m, p);

  ok("a stated sqftPerUnit wins", c({ sqftPerUnit: 25, unit: "bundle" }).source === "stated");
  ok("…and is the number used", c({ sqftPerUnit: 25, unit: "bundle" }).sqftPerUnit === 25);
  ok("panel geometry answers next", c({ panel: { coverWidthIn: 36, lengthIn: 93, endLapIn: 6 } }).source === "panel");
  ok("…and names the unit 'panel' without being told", c({ panel: { coverWidthIn: 36, lengthIn: 93 } }).unit === "panel");
  ok("legacy bundlesPerSquare still answers", c({ bundlesPerSquare: 4 }).source === "bundlesPerSquare");
  ok("…at 25 sqft a bundle", c({ bundlesPerSquare: 4 }).sqftPerUnit === 25);
  ok("nothing said falls back to asphalt's three to a square", c({}, {}).source === "default");
  ok("…which is 33.33 sqft", c({}, {}).sqftPerUnit === 33.33);

  // The 73rd bundle. `unitsPerSquare` is what the order divides by and it must
  // come from the figure the material stated, never from the two-decimal
  // coverage beside it: 2,400 sqft over 33.33 is 72.007, which ceils to 73 and
  // buys a bundle the roof does not need. Asserted on BOTH rungs that state a
  // per-square figure, because asphalt_arch takes the default and a material
  // with its own bundlesPerSquare takes the legacy one.
  ok("the default rung's unitsPerSquare is exactly 3", c({}, {}).unitsPerSquare === 3, c({}, {}).unitsPerSquare);
  ok("…and so is the legacy rung's", c({ bundlesPerSquare: 3 }).unitsPerSquare === 3, c({ bundlesPerSquare: 3 }).unitsPerSquare);
  ok("…and a stated coverage divides at full precision", c({ sqftPerUnit: 21.75 }).unitsPerSquare === 100 / 21.75);

  // Hostile. The one thing that must never happen is a zero or non-finite
  // sqftPerUnit, because roofingMaterials divides by it.
  const hostileCoverage = [
    ["null material", null, null],
    ["a string", "shingles", null],
    ["negative sqftPerUnit", { sqftPerUnit: -10 }, null],
    ["zero sqftPerUnit", { sqftPerUnit: 0 }, null],
    ["NaN sqftPerUnit", { sqftPerUnit: NaN }, null],
    ["zero bundlesPerSquare", { bundlesPerSquare: 0 }, null],
    ["negative bundlesPerSquare", { bundlesPerSquare: -3 }, null],
    ["a zero default in the book", {}, { bundlesPerSquare: 0 }],
    ["a book that is a string", {}, "nope"],
    ["a panel with no dimensions", { panel: {} }, null],
  ];
  for (const [name, m, p] of hostileCoverage) {
    const got = c(m, p);
    ok(
      `${name} still yields a positive, finite coverage`,
      Number.isFinite(got.sqftPerUnit) && got.sqftPerUnit > 0 && typeof got.unit === "string" && got.unit.length > 0,
      got,
    );
  }
  ok(
    "the default is asphalt's constant, re-asserted rather than trusted from the book",
    c({}, { bundlesPerSquare: 0 }).sqftPerUnit === Math.round((100 / ROOF_PACKAGING.bundlesPerSquare) * 100) / 100,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The owner's bill: the main material prices, in the unit it is sold in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const seam = bill({ ...OWNERS_ROOF, materialKey: "metal_standing_seam" });
  const line = mainLine(seam);
  ok("standing seam is NOT counted in bundles", line.unit !== "bundle", line.unit);
  ok("…it is counted in square feet", line.unit === "sqft", line.unit);
  ok("…and the line's NAME no longer claims a second, wrong unit", !/bundle/i.test(line.name), line.name);
  // 21.63 squares x 1.1 waste x 100 sqft. The old bill said 72 bundle.
  ok("…the quantity is the roof, wasted, in square feet", line.qty === Math.ceil(21.63 * 1.1 * 100), line.qty);
  ok("…and it is still honestly unpriced rather than costed at zero", line.unpriced === true && line.cost === 0, line);
  ok("…with a null unitCost, not a 0", line.unitCost === null, line.unitCost);

  const cedar = mainLine(bill({ ...OWNERS_ROOF, materialKey: "cedar_shake" }));
  ok("cedar is bundles, four to a square (25 sqft each)", cedar.unit === "bundle" && cedar.qty === Math.ceil((21.63 * 1.1 * 100) / 25), cedar);

  const corr = mainLine(bill({ ...OWNERS_ROOF, materialKey: "metal_corrugated" }));
  ok("corrugated steel is panels", corr.unit === "panel", corr.unit);
  ok("…at the lapped 21.75 sqft, not the gross 23.25", corr.qty === Math.ceil((21.63 * 1.1 * 100) / 21.75), corr.qty);
  ok("…and it is priced, so the biggest line carries money", corr.unpriced === false && corr.cost > 0, corr);

  const membrane = mainLine(bill({ ...OWNERS_ROOF, materialKey: "membrane_flat" }));
  ok("cap sheet is a roll, which is what GAF sells", membrane.unit === "roll", membrane.unit);

  // The asphalt numbers check-trade-labour.mjs asserts, restated here so a
  // change to the coverage ladder cannot quietly move the default trade.
  const asph = bill({ areaSqft: 2400, pitchRise: 8, layers: 1 });
  const a = mainLine(asph);
  ok("architectural asphalt is unchanged: 80 bundles", a.qty === 80 && a.unit === "bundle", a);
  ok("…at the Home Depot read of $41.93", a.unitCost === 41.93);
  // 24 squares, three to a square, no waste. 72 exactly — see section 2 on
  // why this is the assertion that catches a rounded divisor.
  ok("…and no waste means exactly 72, not 73", mainLine(bill({ areaSqft: 2400, pitchRise: 8, layers: 1 }, { wastePct: 0 })).qty === 72, mainLine(bill({ areaSqft: 2400, pitchRise: 8, layers: 1 }, { wastePct: 0 })).qty);
  // The same roof through the LEGACY rung — a material carrying its own
  // bundlesPerSquare — which asphalt_arch does not exercise.
  ok(
    "…and a material stating 3 bundles a square also lands on 72",
    mainLine(bill({ areaSqft: 2400, pitchRise: 8, layers: 1, materialKey: "legacy_test" }, { wastePct: 0, materials: { legacy_test: { label: "Legacy", pricePerSquare: 500, labourFactor: 1, bundlesPerSquare: 3, materialCostPerBundle: 40 } } })).qty === 72,
  );

  ok("every roofing line still carries a materialKey", asph.materials.every((m) => m.materialKey), asph.materials.map((m) => m.materialKey));
  ok(
    "no line is ever costed with a null price",
    asph.materials.every((m) => (m.unpriced ? m.cost === 0 : m.unitCost > 0 && m.cost > 0)),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Every unit the book can produce has a word for it");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Written AND read: a unit the bill emits with no message key renders the
  // English word on a French screen. Derived from the book rather than from a
  // list here, so adding a material to the price book fails this check rather
  // than silently shipping an untranslated unit.
  for (const [key, material] of Object.entries(BOOK.materials)) {
    const { unit } = roofMaterialCoverage(material, BOOK.packaging || {});
    ok(
      `${key} counts in "${unit}", and that word has a translation key`,
      APP_MESSAGE_KEYS.includes(`app.materialUnit.${unit}`),
      unit,
    );
  }
  // The accessory units too — these are literals in roofingMaterials().
  for (const u of ["roll", "length", "bundle", "section", "piece", "each", "sheet", "box"]) {
    ok(`the accessory unit "${u}" has a translation key`, APP_MESSAGE_KEYS.includes(`app.materialUnit.${u}`));
  }
  for (const k of ["app.materialSummary.squares", "app.materialSummary.pitch", "app.materialSummary.waste"]) {
    ok(`the summary key ${k} is defined`, APP_MESSAGE_KEYS.includes(k));
  }

  // "Roofing · 21.63 squares · 14/12 · +10% waste" was three English strings
  // with nothing behind them. The tokens are the same three facts as keys and
  // numbers; without them the panel falls back to the English and a French
  // screen says "squares".
  const b = bill(OWNERS_ROOF);
  ok("the roofing bill carries summary tokens", Array.isArray(b.summaryTokens) && b.summaryTokens.length === 3, b.summaryTokens);
  ok("…every one of which is a defined key", b.summaryTokens.every((s) => APP_MESSAGE_KEYS.includes(s.key)), b.summaryTokens.map((s) => s.key));
  ok("…carrying the same numbers the English says", b.summaryTokens[0].values.n === 21.63 && b.summaryTokens[1].values.rise === 14 && b.summaryTokens[2].values.pct === 10, b.summaryTokens);
  ok("…and no waste drops the waste token rather than saying +0%", bill(OWNERS_ROOF, { wastePct: 0 }).summaryTokens.length === 2);
  ok("…while the English summary still ships, for the stored costing row", b.summaryParts.join(" · ") === "21.63 squares · 14/12 · +10% waste", b.summaryParts);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. An estimator can type over the book, and it sticks");
// ═══════════════════════════════════════════════════════════════════════════

{
  const base = bill({ ...OWNERS_ROOF, materialKey: "metal_standing_seam" });
  const unpricedBefore = base.unpricedCount;

  const priced = bill({
    ...OWNERS_ROOF,
    materialKey: "metal_standing_seam",
    materialOverrides: { bundles: { unitCost: 12.5 } },
  });
  const line = mainLine(priced);
  ok("a typed price prices the line the book could not", line.unpriced === false, line);
  ok("…at the typed number", line.unitCost === 12.5 && line.cost === Math.round(line.qty * 12.5 * 100) / 100, line);
  ok("…and the unpriced count drops by exactly one", priced.unpricedCount === unpricedBefore - 1, [unpricedBefore, priced.unpricedCount]);
  ok("…and the group's material total moves with it", priced.materialTotal > base.materialTotal);
  ok("…the book's own answer is kept beside it", line.overriddenUnitCost === true && line.derivedUnitCost === null, line);

  const qty = mainLine(bill({ ...OWNERS_ROOF, materialKey: "cedar_shake", materialOverrides: { bundles: { qty: 40 } } }));
  ok("a typed quantity replaces the derived one", qty.qty === 40 && qty.overriddenQty === true, qty);
  ok("…and remembers what the book said", qty.derivedQty === Math.ceil((21.63 * 1.1 * 100) / 25), qty.derivedQty);

  const both = mainLine(bill({ ...OWNERS_ROOF, materialKey: "cedar_shake", materialOverrides: { bundles: { qty: 40, unitCost: 60 } } }));
  ok("both together cost out", both.cost === 2400, both);

  // Zero is a statement, and a different one at each end of the line.
  const zeroQty = bill({ ...OWNERS_ROOF, materialOverrides: { underlayment: { qty: 0 } } }).materials.find((m) => m.materialKey === "underlayment");
  ok("a quantity of zero keeps the line, so it can be undone", zeroQty && zeroQty.qty === 0 && zeroQty.cost === 0, zeroQty);
  const zeroCost = mainLine(bill({ ...OWNERS_ROOF, materialKey: "cedar_shake", materialOverrides: { bundles: { unitCost: 0 } } }));
  ok("a price of zero is 'somebody said free', not 'nobody said'", zeroCost.unpriced === false && zeroCost.cost === 0, zeroCost);

  // Refusals. Each of these must leave the derived line exactly as it was.
  const derived = mainLine(bill({ ...OWNERS_ROOF, materialKey: "metal_corrugated" }));
  const rejected = [
    ["a negative quantity", { qty: -5 }],
    ["a negative price", { unitCost: -20 }],
    ["a NaN quantity", { qty: NaN }],
    ["a string price", { unitCost: "cheap" }],
    ["an empty patch", {}],
    ["nulls", { qty: null, unitCost: null }],
  ];
  for (const [name, patch] of rejected) {
    const got = mainLine(bill({ ...OWNERS_ROOF, materialKey: "metal_corrugated", materialOverrides: { bundles: patch } }));
    ok(`${name} is refused and the book's answer stands`, got.qty === derived.qty && got.unitCost === derived.unitCost, got);
  }

  // Hostile shapes for the map itself. None may throw — a throw here takes the
  // whole cost panel down while somebody is typing.
  for (const [name, over] of [
    ["a string", "underlayment=3"],
    ["an array", [{ qty: 4 }]],
    ["null", null],
    ["a number", 7],
    ["a key nobody sells", { flux_capacitor: { qty: 9 } }],
    ["a patch that is a string", { bundles: "cheap" }],
    ["a patch that is null", { bundles: null }],
  ]) {
    const got = bill({ ...OWNERS_ROOF, materialKey: "metal_corrugated", materialOverrides: over });
    ok(`overrides as ${name} changes nothing and does not throw`, got && mainLine(got).qty === derived.qty, got && mainLine(got).qty);
  }

  // Inherited keys are not overrides. `own()` is the guard; without it
  // "constructor" and "toString" would resolve off Object.prototype.
  const inherited = bill({ ...OWNERS_ROOF, materialKey: "metal_corrugated", materialOverrides: Object.create({ bundles: { qty: 1 } }) });
  ok("an override inherited through the prototype is ignored", mainLine(inherited).qty === derived.qty, mainLine(inherited).qty);

  // applyMaterialOverrides on its own, against a bill that is not a bill.
  ok("a non-array bill comes back unchanged", applyMaterialOverrides(null, { a: { qty: 1 } }) === null || Array.isArray(applyMaterialOverrides(null, {})));
  ok("a line with no materialKey cannot be overridden", applyMaterialOverrides([{ name: "x", qty: 1, unit: "each" }], { undefined: { qty: 9 } })[0].qty === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Absurd input produces a bill, not an Infinity");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("a zero roof produces no bill at all", bill({ areaSqft: 0, pitchRise: 6, layers: 0 }).materials.length === 0);
  ok("a negative roof produces no bill", bill({ areaSqft: -2000, pitchRise: 6, layers: 0 }).materials.length === 0);
  ok("a takeoff that is not an object returns null", bill("2000 sqft") === null);

  const huge = bill({ areaSqft: 1e9, pitchRise: 6, layers: 1, materialKey: "metal_standing_seam" });
  ok("a billion square feet still yields finite numbers", huge.materials.every((m) => Number.isFinite(m.qty) && Number.isFinite(m.cost)), huge.materials.map((m) => m.qty));
  ok("…and a finite total", Number.isFinite(huge.materialTotal));

  const noPitch = bill({ areaSqft: 2000, layers: 1 });
  ok("a roof with no pitch is incomplete rather than divided by zero", Array.isArray(noPitch.materials));

  const badKey = bill({ ...OWNERS_ROOF, materialKey: "no_such_material" });
  ok("an unknown material falls back to the book's default and still prices", mainLine(badKey).unpriced === false, mainLine(badKey));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The rate card names the unit the bill counts");
// ═══════════════════════════════════════════════════════════════════════════

{
  const src = decomment(read("app/data/tradePriceBooks.js"));
  // Pull the roofing material cost fields out of PRICE_BOOK_FIELDS and check
  // each suffix against the unit that material actually resolves to. A field
  // asking for "$ / bundle" beside a line reading "122 panel" is two answers
  // to one question, and it is the answer on the rate card that gets typed.
  const UNIT_WORD = { bundle: "bundle", panel: "panel", sqft: "sq ft", roll: "roll" };
  for (const key of Object.keys(BOOK.materials)) {
    const { unit } = roofMaterialCoverage(BOOK.materials[key], BOOK.packaging || {});
    const re = new RegExp(
      `path:\\s*"materials\\.${key}\\.materialCostPerBundle"[\\s\\S]{0,700}?suffix:\\s*"([^"]+)"`,
    );
    const m = src.match(re);
    if (!ok(`${key} has a rate-card field`, Boolean(m))) continue;
    ok(`…whose suffix says "${UNIT_WORD[unit]}", the unit the bill counts`, m[1].includes(UNIT_WORD[unit]), m[1]);
  }
  ok(
    "the stored path is still materialCostPerBundle, so saved overrides survive",
    Object.keys(BOOK.materials).every((k) => src.includes(`materials.${k}.materialCostPerBundle`)),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The address handed to the Solar API is one Google resolved");
// ═══════════════════════════════════════════════════════════════════════════

{
  const t = decomment(read("app/components/quotes/builder/TradeTakeoff.js"));
  ok("the measure panel imports the shared address picker", /import AddressAutocomplete from "@\/app\/components\/AddressAutocomplete"/.test(t));
  ok("…and renders it", /<AddressAutocomplete/.test(t));
  ok(
    "…rather than constructing a second Places autocomplete of its own",
    !/new\s+window\.google\.maps\.places\.Autocomplete/.test(t) && !/useLoadScript/.test(t),
  );
  ok("picking a suggestion measures it", /onPlaceSelected=\{[\s\S]{0,220}measure\(picked\)/.test(t));
  ok(
    "…and measures the FORMATTED address, not what was half-typed",
    /const picked = place\?\.address \|\| ""/.test(t) && /measure\(picked\)/.test(t),
  );
  ok(
    "measure() takes the address to use rather than only reading state",
    /async function measure\(override\)/.test(t) && /String\(override \?\? address\)/.test(t),
  );
  // The old free-text input is gone. It is the thing that let a half-typed
  // street name reach a geocoder that answers confidently about anything.
  ok("no free-text address input is left behind", !/placeholder="917 Littlerock/.test(t));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The boxes on the bill are wired to something that saves");
// ═══════════════════════════════════════════════════════════════════════════

{
  const panel = decomment(read("app/components/quotes/builder/CostMarginPanel.js"));
  const builder = decomment(read("app/components/quotes/builder/QuoteBuilder.js"));

  ok("the panel accepts an override callback", /onMaterialOverride = null/.test(panel));
  ok("…and renders quantity and price inputs for a line", /onOverride\(m\.materialKey, \{\s*qty:/.test(panel) && /onOverride\(m\.materialKey, \{\s*unitCost:/.test(panel));
  ok("…with a way back to the derived numbers", /onOverride\(m\.materialKey, null\)/.test(panel));
  ok("…and stays read-only when no callback is passed", /const editable = Boolean\(onOverride && m\.materialKey\)/.test(panel));

  ok("the quote builder passes one", /onMaterialOverride=\{updateMaterialOverride\}/.test(builder));
  ok(
    "…and it writes to the takeoff, which is what gets saved",
    /takeoff: \{ \.\.\.g\.takeoff, materialOverrides: all \}/.test(builder),
  );
  ok(
    "…and refuses a persisted group, whose takeoff never leaves the screen",
    /g\.tempId !== groupTempId \|\| !g\.takeoff \|\| g\.persisted/.test(builder),
  );
  ok(
    "…and the panel is told which groups those are",
    /editableMaterialGroups=\{scopeGroups/.test(builder) && /editableMaterialGroups\.includes\(g\.tempId\)/.test(panel),
  );

  // The override has to survive the round trip through the ONE function every
  // consumer calls, or the yard buys against the old number.
  const mats = decomment(read("lib/costing/tradeMaterials.js"));
  ok(
    "tradeMaterialsFor applies the takeoff's overrides",
    /applyMaterialOverrides\(\s*\(result\.materials \|\| \[\]\)\.filter\(Boolean\),\s*takeoff\.materialOverrides,\s*\)/.test(mats),
  );
  const sourcing = decomment(read("lib/jobs/sourcingList.js"));
  ok(
    "…so the job's sourcing list reads the same corrected numbers",
    /tradeMaterialsFor\(/.test(sourcing),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:roof-materials is a script", typeof pkg.scripts?.["check:roof-materials"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:roof-materials"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
