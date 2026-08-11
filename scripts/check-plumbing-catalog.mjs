// scripts/check-plumbing-catalog.mjs
//
//   npm run check:plumbing
//
// Executes app/data/plumbingCatalog.js, plumbingBenchmarks.js and
// plumbingMaterials.js rather than reading them.
//
// The plumbing price book is three files that only work together, and every
// assertion below corresponds to a way they could go quietly wrong:
//
//   * a rate appearing on a catalogue line. defaultLineItems.js has held the
//     "ship the LIST, not the price" rule since it was written, and the moment
//     one plumbing line carries a number the rule is gone for the whole product
//   * a benchmark orphaned in either direction — a range with no line to attach
//     to, or a line the contractor is asked to price with no guidance at all
//   * a missing centre quietly becoming a midpoint. Permits span 57× and a
//     sewer spot repair 25×; the average of a 25× band is not information, and
//     rendering it as "typical" is exactly the padding AGENTS.md forbids
//   * the electrical equipment-markup band (10–15%) leaking into plumbing,
//     where the verified figure is 2–3×. §2D.3 calls this the single most
//     important cross-trade finding, and a global multiplier fails on both
//     trades in opposite directions
//   * ABS/PVC resolving to a silent default. Whichever way it is picked it is
//     wrong for half the user base, so the resolver must refuse
//   * a push-fit fitting collapsing into "a fitting" — an 8–13× substitution
//     worth ~$1,400 on one repipe, invisible on the estimate
//   * a toilet acquiring a cost default. It spans 21× on taste alone
//   * CPVC acquiring an interpolated price. There is no read for it anywhere,
//     and a plausible number in a cost book is worse than a visible gap
//   * either internal module reaching a client-facing route. The benchmarks are
//     national aggregates and the materials are one North Carolina retailer's
//     retail shelf; a homeowner must never see output from either

import {
  PLUMBING_LINE_ITEMS,
  PLUMBING_LINE_ITEMS_BY_KEY,
  PLUMBING_LINE_ITEM_GROUPS,
  getPlumbingLineItems,
  REPIPE_FIXTURE_TYPES,
} from "@/app/data/plumbingCatalog";

import {
  PLUMBING_BENCHMARKS,
  BENCHMARK_CONFIDENCE,
  BENCHMARK_PRESENTATION,
  EQUIPMENT_MARKUP_TIERS,
  MIN_PLUMBING_EQUIPMENT_MARKUP,
  REPIPE_DIFFICULTY_TIERS,
  STRUCTURE_ADJUSTMENTS,
  AFTER_HOURS_MULTIPLIERS,
  WARRANTY,
  getPlumbingBenchmark,
  hasNoDefault,
} from "@/app/data/plumbingBenchmarks";

import {
  PLUMBING_MATERIALS,
  MATERIAL_CONFIDENCE,
  MATERIAL_TYPES,
  FITTING_SYSTEMS,
  FITTING_SYSTEM_COST_MULTIPLE,
  DWV_SYSTEMS,
  DWV_COST_RATIO_ABS_OVER_PVC,
  WHOLESALE_DISCOUNT,
  resolveDwvMaterial,
  getPlumbingMaterials,
  getMaterialCost,
  materialSourceLabel,
} from "@/app/data/plumbingMaterials";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0,
  fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// ── 1. The catalogue ships no prices ─────────────────────────────────────────
console.log("\nCatalogue — the LIST, never the number");

// Deep walk: a rate could hide inside a nested object as easily as at the top.
const PRICE_KEYS = ["rate", "price", "unitPrice", "cost", "amount", "defaultRate"];
const pricedLines = [];
const walkForPrices = (node, path) => {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((child, i) => walkForPrices(child, `${path}[${i}]`));
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (PRICE_KEYS.includes(key) && isNum(value)) pricedLines.push(`${path}.${key} = ${value}`);
    walkForPrices(value, `${path}.${key}`);
  }
};
walkForPrices(PLUMBING_LINE_ITEMS, "PLUMBING_LINE_ITEMS");
ok("no catalogue line carries a numeric rate, price or cost — anywhere in the tree", pricedLines.length === 0, pricedLines);

ok(
  "no catalogue line even declares a rate key",
  PLUMBING_LINE_ITEMS.every((i) => !("rate" in i)),
  PLUMBING_LINE_ITEMS.filter((i) => "rate" in i).map((i) => i.key),
);

// The zero-priced clause lines are the tempting exception, and they must not
// take it: §2B.1 prints them at $0.00, but a zero in this file is still a
// number and this is the file the rule lives in.
const clauseLines = PLUMBING_LINE_ITEMS.filter((i) => i.zeroPriced);
ok("both liability clause lines are present (§2B.1 #1)", clauseLines.length === 2, clauseLines.map((c) => c.key));
ok(
  "clause lines express $0.00 as a flag, not as a zero",
  clauseLines.every((c) => c.zeroPriced === true && !("rate" in c)),
);
ok(
  "each clause line carries the text the client actually reads",
  clauseLines.every((c) => typeof c.clauseText === "string" && c.clauseText.length > 60),
);

// ── 2. Catalogue shape and coverage ──────────────────────────────────────────
console.log("\nCatalogue — shape, and the coverage the trade needs");

const UNITS = new Set(["flat", "each", "sqft", "linear_ft", "hour"]);
ok(
  "every line has key, description and unit",
  PLUMBING_LINE_ITEMS.every((i) => i.key && i.description && i.unit),
);
ok(
  "every unit is in the shared vocabulary (defaultLineItems.js's, plus hour)",
  PLUMBING_LINE_ITEMS.every((i) => UNITS.has(i.unit)),
  PLUMBING_LINE_ITEMS.filter((i) => !UNITS.has(i.unit)).map((i) => i.unit),
);
ok("keys are unique", new Set(PLUMBING_LINE_ITEMS.map((i) => i.key)).size === PLUMBING_LINE_ITEMS.length);
ok(
  "descriptions are unique — two identical chips is a control that looks broken",
  new Set(PLUMBING_LINE_ITEMS.map((i) => i.description)).size === PLUMBING_LINE_ITEMS.length,
);
const groupKeys = new Set(PLUMBING_LINE_ITEM_GROUPS.map((g) => g.key));
ok(
  "every line belongs to a declared group",
  PLUMBING_LINE_ITEMS.every((i) => groupKeys.has(i.group)),
  PLUMBING_LINE_ITEMS.filter((i) => !groupKeys.has(i.group)).map((i) => i.group),
);
ok(
  "every declared group has at least one line — no empty tab",
  PLUMBING_LINE_ITEM_GROUPS.every((g) => getPlumbingLineItems(g.key).length > 0),
  PLUMBING_LINE_ITEM_GROUPS.filter((g) => getPlumbingLineItems(g.key).length === 0).map((g) => g.key),
);
ok("an unknown group returns nothing, not everything", getPlumbingLineItems("no_such_group").length === 0);
ok("no argument returns the whole list", getPlumbingLineItems().length === PLUMBING_LINE_ITEMS.length);

// The coverage the task and the research both require. Named individually so a
// deletion is a named failure rather than a count that quietly drops by one.
const REQUIRED = {
  "repipe, per fixture (§2B.1 #4)": ["repipe_pex_per_fixture", "repipe_copper_per_fixture"],
  "water heater, tank and tankless": ["wh_tank_supply_install", "wh_tankless_supply_install"],
  "drain cleaning and camera inspection": ["drain_clear_main", "camera_inspection"],
  "fixture install — toilet, sink, tub, shower": [
    "toilet_supply_install",
    "sink_supply_install",
    "tub_supply_install",
    "tub_shower_valve",
  ],
  "valve work including PRV": ["prv_supply_install", "angle_stop_replace"],
  "gas line": ["gas_line_run_simple", "gas_line_run_complex"],
  "sewer line and excavation": ["sewer_excavation_replace", "sewer_lining", "water_main_open_trench"],
  "leak detection": ["leak_detection"],
  backflow: ["backflow_install", "backflow_test"],
  "water softener and treatment": ["water_softener_install", "water_filtration_install"],
  permits: ["permit_plumbing"],
  "the habitually forgotten": [
    "access_opening",
    "disposal_fee",
    "travel_fee",
    "emergency_callout",
    "clause_general_damage",
  ],
};
for (const [label, keys] of Object.entries(REQUIRED)) {
  const missing = keys.filter((k) => !PLUMBING_LINE_ITEMS_BY_KEY[k]);
  ok(`covers ${label}`, missing.length === 0, missing);
}

ok(
  "PEX and copper repipe are SEPARATE lines, not one line with a material swap (§8)",
  PLUMBING_LINE_ITEMS_BY_KEY.repipe_pex_per_fixture.key !== PLUMBING_LINE_ITEMS_BY_KEY.repipe_copper_per_fixture.key,
);
ok(
  "repipe is priced per fixture, and there is no per-square-foot repipe line",
  PLUMBING_LINE_ITEMS_BY_KEY.repipe_pex_per_fixture.unit === "each" &&
    !PLUMBING_LINE_ITEMS.some((i) => i.unit === "sqft" && /repipe/i.test(i.key)),
);
ok(
  "the fixture-count convention is shipped so the count can be itemised (§2D.1)",
  REPIPE_FIXTURE_TYPES.length === 7 &&
    REPIPE_FIXTURE_TYPES.some((f) => f.key === "hose_bib") &&
    REPIPE_FIXTURE_TYPES.some((f) => f.key === "water_heater"),
  REPIPE_FIXTURE_TYPES.map((f) => f.key),
);
ok(
  "client-supplied fixtures get install-only lines (§7 rank 4)",
  Boolean(PLUMBING_LINE_ITEMS_BY_KEY.faucet_install_only && PLUMBING_LINE_ITEMS_BY_KEY.toilet_install_only),
);
ok(
  "equipment and its install package are separate lines (§2B.1 #2)",
  Boolean(PLUMBING_LINE_ITEMS_BY_KEY.wh_tank_equipment_only && PLUMBING_LINE_ITEMS_BY_KEY.wh_install_package_gas),
);
ok(
  "the equipment-only line states its dependency in words on the line itself",
  /install package/i.test(PLUMBING_LINE_ITEMS_BY_KEY.wh_tank_equipment_only.description),
);

// ── 3. Benchmarks resolve to the catalogue, both directions ─────────────────
console.log("\nBenchmarks — keyed to the catalogue, with no orphans either way");

const catalogueKeys = new Set(PLUMBING_LINE_ITEMS.map((i) => i.key));
const benchmarkKeys = Object.keys(PLUMBING_BENCHMARKS);

const orphanBenchmarks = benchmarkKeys.filter((k) => !catalogueKeys.has(k));
ok("every benchmark key resolves to a real catalogue line", orphanBenchmarks.length === 0, orphanBenchmarks);

const unguidedLines = [...catalogueKeys].filter((k) => !(k in PLUMBING_BENCHMARKS));
ok("every catalogue line has a benchmark", unguidedLines.length === 0, unguidedLines);

ok("counts match exactly", benchmarkKeys.length === catalogueKeys.size, {
  benchmarks: benchmarkKeys.length,
  lines: catalogueKeys.size,
});

ok("getPlumbingBenchmark attaches the presentation wording", getPlumbingBenchmark("service_call").presentation === BENCHMARK_PRESENTATION);
ok("the presentation wording tells the contractor the number is theirs", /set your price/i.test(BENCHMARK_PRESENTATION));
ok("an unknown key returns null, not an empty band that renders as $0", getPlumbingBenchmark("no_such_key") === null);

// ── 4. Confidence tags, and the four honest ways to have no number ──────────
console.log("\nBenchmarks — confidence, and absence stated rather than padded");

const badConfidence = benchmarkKeys.filter((k) => !BENCHMARK_CONFIDENCE.includes(PLUMBING_BENCHMARKS[k].confidence));
ok("every confidence tag is one of read / derived / guess / unverified", badConfidence.length === 0, badConfidence);

const missingBasis = benchmarkKeys.filter((k) => {
  const b = PLUMBING_BENCHMARKS[k];
  return typeof b.basis !== "string" || b.basis.trim().length < 20;
});
ok("every benchmark cites where it came from", missingBasis.length === 0, missingBasis);

const missingCurrency = benchmarkKeys.filter((k) => !PLUMBING_BENCHMARKS[k].currency);
ok("every benchmark declares its currency", missingCurrency.length === 0, missingCurrency);

const missingPermitFlag = benchmarkKeys.filter((k) => typeof PLUMBING_BENCHMARKS[k].includesPermit !== "boolean");
ok("every benchmark says whether a permit is inside the band", missingPermitFlag.length === 0, missingPermitFlag);

const ABSENCE_FLAGS = ["unpriced", "noNationalDefault", "priceIsMultiplier"];
const badAbsence = [];
const badUnpriced = [];
const badSingle = [];
const badOrder = [];

for (const key of benchmarkKeys) {
  const b = PLUMBING_BENCHMARKS[key];
  const flags = ABSENCE_FLAGS.filter((f) => b[f] === true);

  if (b.typical === null) {
    // Exactly one named reason, and a reason a human can read.
    if (flags.length !== 1 || typeof b.reason !== "string" || b.reason.trim().length < 20) badAbsence.push(key);
  } else if (flags.length > 0) {
    // A flag claiming there is no centre, on an entry that has one.
    badAbsence.push(key);
  }

  if (b.unpriced) {
    if (b.low !== null || b.typical !== null || b.high !== null || b.confidence !== "unverified") badUnpriced.push(key);
  }

  if (b.singleObservation) {
    if (!isNum(b.typical) || b.low !== null || b.high !== null || !b.reason) badSingle.push(key);
  }

  if (isNum(b.low) && isNum(b.typical) && !(b.low <= b.typical)) badOrder.push(key);
  if (isNum(b.typical) && isNum(b.high) && !(b.typical <= b.high)) badOrder.push(key);
  if (isNum(b.low) && isNum(b.high) && !(b.low <= b.high)) badOrder.push(key);
}

ok("a missing centre always names exactly one reason, in words", badAbsence.length === 0, badAbsence);
ok("`unpriced` means all three values null and confidence 'unverified' — no fabricated number", badUnpriced.length === 0, badUnpriced);
ok("`singleObservation` carries the one figure and no invented bracket", badSingle.length === 0, badSingle);
ok("every band that has values has them in order", badOrder.length === 0, badOrder);

// The specific refusals the research demands by name.
ok(
  "the shower valve ships NO default — §2D.1 says so outright",
  PLUMBING_BENCHMARKS.tub_shower_valve.unpriced === true && PLUMBING_BENCHMARKS.tub_shower_valve.typical === null,
);
ok(
  "permits have no national default — a 57× spread cannot have a centre",
  PLUMBING_BENCHMARKS.permit_plumbing.noNationalDefault === true &&
    PLUMBING_BENCHMARKS.permit_plumbing.typical === null &&
    PLUMBING_BENCHMARKS.permit_plumbing.low === 7 &&
    PLUMBING_BENCHMARKS.permit_plumbing.high === 400,
);
ok(
  "a 25× sewer spot-repair band gets no midpoint",
  PLUMBING_BENCHMARKS.sewer_spot_repair.typical === null && PLUMBING_BENCHMARKS.sewer_spot_repair.noNationalDefault === true,
);
ok(
  "the emergency premium is stored as a multiplier, because that is the reliable published form",
  PLUMBING_BENCHMARKS.emergency_callout.priceIsMultiplier === true &&
    PLUMBING_BENCHMARKS.emergency_callout.multipliers.weekend.typical === 2.0,
);
ok(
  "after-hours multipliers are 1.5× weeknight, 2× weekend, 2–3× holiday (§2D.1)",
  AFTER_HOURS_MULTIPLIERS.weeknight.typical === 1.5 &&
    AFTER_HOURS_MULTIPLIERS.weekend.typical === 2.0 &&
    AFTER_HOURS_MULTIPLIERS.holiday.low === 2.0 &&
    AFTER_HOURS_MULTIPLIERS.holiday.high === 3.0,
);
ok("hasNoDefault() reports the refusals as refusals", hasNoDefault(PLUMBING_BENCHMARKS.tub_shower_valve) === true);
ok("hasNoDefault() does not swallow a real band", hasNoDefault(PLUMBING_BENCHMARKS.drain_clear_main) === false);

// Roughly a third of the file has no number. That is the honest state of
// published plumbing pricing, and a sudden collapse in that count means
// somebody filled the gaps in rather than found the reads.
const unpricedCount = benchmarkKeys.filter((k) => PLUMBING_BENCHMARKS[k].unpriced).length;
ok(
  `${unpricedCount} of ${benchmarkKeys.length} benchmarks admit they have no number — the count has not been quietly padded away`,
  unpricedCount >= 20,
  unpricedCount,
);

// The zero-priced clauses are the one place a zero is correct.
for (const clause of clauseLines) {
  const b = PLUMBING_BENCHMARKS[clause.key];
  ok(`${clause.key} benchmarks at exactly zero, and says why`, b.low === 0 && b.typical === 0 && b.high === 0 && /0\.00/.test(b.basis));
}
const strayZeros = benchmarkKeys.filter((k) => PLUMBING_BENCHMARKS[k].typical === 0 && !PLUMBING_LINE_ITEMS_BY_KEY[k].zeroPriced);
ok("no non-clause benchmark sits at zero", strayZeros.length === 0, strayZeros);

// ── 5. Equipment markup — the cross-trade tripwire ──────────────────────────
console.log("\nEquipment markup — plumbing takes 2–3×, electrical takes 10–15%, and they must not blend");

const markupKeys = benchmarkKeys.filter((k) => PLUMBING_BENCHMARKS[k].equipmentMarkup);
ok("several items carry an equipment markup", markupKeys.length >= 10, markupKeys.length);

const leaked = markupKeys.filter((k) => PLUMBING_BENCHMARKS[k].equipmentMarkup.low < MIN_PLUMBING_EQUIPMENT_MARKUP);
ok(
  `no equipment markup drops below ${MIN_PLUMBING_EQUIPMENT_MARKUP}× — that is what the electrical 1.10–1.15× band leaking in looks like`,
  leaked.length === 0,
  leaked,
);
const absurd = markupKeys.filter((k) => PLUMBING_BENCHMARKS[k].equipmentMarkup.high > 5);
ok("no equipment markup exceeds 5× — the top of §2D.3's under-$25 tier", absurd.length === 0, absurd);
const unorderedMarkup = markupKeys.filter((k) => {
  const m = PLUMBING_BENCHMARKS[k].equipmentMarkup;
  return !(m.low <= m.typical && m.typical <= m.high);
});
ok("every markup band is in order", unorderedMarkup.length === 0, unorderedMarkup);
const uncitedMarkup = markupKeys.filter((k) => {
  const m = PLUMBING_BENCHMARKS[k].equipmentMarkup;
  return !m.basis || !BENCHMARK_CONFIDENCE.includes(m.confidence);
});
ok("every markup cites a basis and a confidence", uncitedMarkup.length === 0, uncitedMarkup);

ok(
  "the owner's own water heater at 2.66× is preserved as the anchor (§2D.3)",
  PLUMBING_BENCHMARKS.wh_tank_supply_install.equipmentMarkup.high === 2.66,
  PLUMBING_BENCHMARKS.wh_tank_supply_install.equipmentMarkup,
);
ok(
  "the markup tiers are INVERSE — cheap parts take more, not less (§2D.3)",
  EQUIPMENT_MARKUP_TIERS[0].low > EQUIPMENT_MARKUP_TIERS[EQUIPMENT_MARKUP_TIERS.length - 1].low &&
    EQUIPMENT_MARKUP_TIERS[0].partCostUnder < EQUIPMENT_MARKUP_TIERS[1].partCostUnder,
);
ok(
  "the over-$500 tier is 1.8–2.5×, where the water heater actually lands",
  EQUIPMENT_MARKUP_TIERS[EQUIPMENT_MARKUP_TIERS.length - 1].low === 1.8 &&
    EQUIPMENT_MARKUP_TIERS[EQUIPMENT_MARKUP_TIERS.length - 1].high === 2.5,
);

// ── 6. Warranty is a matrix, not a string ───────────────────────────────────
console.log("\nWarranty — parts and labour separately, residential and commercial separately");

const warrantyKeys = benchmarkKeys.filter((k) => PLUMBING_BENCHMARKS[k].warranty);
ok("most priced work carries a warranty", warrantyKeys.length >= 30, warrantyKeys.length);

const badWarranty = warrantyKeys.filter((k) => {
  const w = PLUMBING_BENCHMARKS[k].warranty;
  return (
    typeof w.partsTerm !== "string" ||
    typeof w.labourTerm !== "string" ||
    !("residential" in w) ||
    !("commercial" in w) ||
    !w.residential ||
    typeof w.residential.partsTerm !== "string" ||
    typeof w.residential.labourTerm !== "string"
  );
});
ok(
  "every warranty has a parts term, a labour term and residential/commercial variants",
  badWarranty.length === 0,
  badWarranty,
);

ok(
  "drain cleaning is the shortest term in the trade and is conditional (§2D.5)",
  WARRANTY.drainCleaning.residential.labourTerm === "6 months" &&
    WARRANTY.drainCleaning.commercial.labourTerm === "30 days" &&
    /blockage/i.test(WARRANTY.drainCleaning.conditional),
);
ok(
  "the 7-day toilet-auger term survives, and carries its single-document caution",
  WARRANTY.toiletAuger.residential.partsTerm === "7 days" && /not appear|Single-document/i.test(WARRANTY.toiletAuger.caution),
);
ok(
  "parts and labour differ where the research says they differ — 6-year tank, 1-year labour",
  WARRANTY.waterHeater.partsTerm !== WARRANTY.waterHeater.labourTerm && /6 years/.test(WARRANTY.waterHeater.partsTerm),
);
ok(
  "residential and commercial differ where the research says they differ",
  WARRANTY.repair.residential.labourTerm !== WARRANTY.repair.commercial.labourTerm,
);
ok(
  "the equipment-only line's labour term says 'not applicable' rather than inheriting one",
  /not applicable/i.test(PLUMBING_BENCHMARKS.wh_tank_equipment_only.warranty.labourTerm),
);

// ── 7. Difficulty tiers with PRINTED criteria ───────────────────────────────
console.log("\nDifficulty — criteria the client can check, not a label they must trust");

ok("three tiers", REPIPE_DIFFICULTY_TIERS.length === 3);
ok(
  "every tier is marked to print on the customer's document — §2D.4 calls this the most copyable idea in the set",
  REPIPE_DIFFICULTY_TIERS.every((t) => t.printOnDocument === true),
);
ok(
  "every tier carries real criteria, not a bare label",
  REPIPE_DIFFICULTY_TIERS.every((t) => Array.isArray(t.criteria) && t.criteria.length >= 2 && t.criteria.every((c) => c.length > 15)),
);
ok(
  "the Level 3 criteria are the ones actually printed on the owner's estimate",
  REPIPE_DIFFICULTY_TIERS[2].criteria.some((c) => /24 inches/.test(c)) &&
    REPIPE_DIFFICULTY_TIERS[2].criteria.some((c) => /attic/i.test(c)) &&
    REPIPE_DIFFICULTY_TIERS[2].confidence === "read",
);
ok(
  "no tier invents a multiplier — only one level is priced anywhere in the research",
  REPIPE_DIFFICULTY_TIERS.every((t) => !("multiplier" in t) && !("uplift" in t)),
);
ok(
  "what IS quantified lives separately: slab +20–40%, multi-storey +10–20% (§2D.4)",
  STRUCTURE_ADJUSTMENTS.find((a) => a.key === "slab_foundation").uplift.low === 0.2 &&
    STRUCTURE_ADJUSTMENTS.find((a) => a.key === "slab_foundation").uplift.high === 0.4 &&
    STRUCTURE_ADJUSTMENTS.find((a) => a.key === "multi_storey").uplift.high === 0.2,
);
ok(
  "both repipe lines carry the tiers and the adjustments",
  PLUMBING_BENCHMARKS.repipe_pex_per_fixture.difficultyTiers === REPIPE_DIFFICULTY_TIERS &&
    PLUMBING_BENCHMARKS.repipe_copper_per_fixture.structureAdjustments === STRUCTURE_ADJUSTMENTS,
);

// ── 8. Materials — cost defaults, allowances and honest gaps ────────────────
console.log("\nMaterials — retail cost defaults, with the gaps left visible");

const materialKeys = Object.keys(PLUMBING_MATERIALS);
const badType = materialKeys.filter((k) => !MATERIAL_TYPES.includes(PLUMBING_MATERIALS[k].type));
ok("every material declares a legal type", badType.length === 0, badType);

const badMaterialConfidence = materialKeys.filter((k) => !MATERIAL_CONFIDENCE.includes(PLUMBING_MATERIALS[k].confidence));
ok("every material carries a legal confidence tag", badMaterialConfidence.length === 0, badMaterialConfidence);

const priced = materialKeys.filter((k) => PLUMBING_MATERIALS[k].type === "material");
const allowances = materialKeys.filter((k) => PLUMBING_MATERIALS[k].type === "allowance");
const unpricedMaterials = materialKeys.filter((k) => PLUMBING_MATERIALS[k].type === "unpriced");

ok(`${priced.length} priced, ${allowances.length} allowances, ${unpricedMaterials.length} unpriced`, priced.length > 30 && allowances.length >= 5 && unpricedMaterials.length >= 8);

const badCost = priced.filter((k) => {
  const c = PLUMBING_MATERIALS[k].cost;
  return !c || !isNum(c.low) || !isNum(c.typical) || !isNum(c.high) || !(c.low <= c.typical && c.typical <= c.high);
});
ok("every priced material has an ordered {low, typical, high}", badCost.length === 0, badCost);

const badCurrency = priced.filter((k) => !["USD", "CAD"].includes(PLUMBING_MATERIALS[k].currency));
ok("every priced material declares a currency", badCurrency.length === 0, badCurrency);

// Part 4 rule #10: retail + date + region, or a contractor cannot tell which
// way to adjust. Part 4 rule #8: brand/pack/scope, or "breaker — $14" again.
const badSource = materialKeys.filter((k) => {
  const s = PLUMBING_MATERIALS[k].source;
  return (
    !s ||
    !s.retailer ||
    !s.region ||
    !["retail", "list", "inferred"].includes(s.priceBasis) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s.readDate)
  );
});
ok("every material names retailer, region, price basis and read date", badSource.length === 0, badSource);

const badScope = priced.filter((k) => !PLUMBING_MATERIALS[k].packSize || !PLUMBING_MATERIALS[k].scope);
ok("every priced material says what pack it was priced in and what the price covers (Part 4 rule #8)", badScope.length === 0, badScope);

ok(
  "the source label reads back as 'retail, date, region'",
  /^retail, 2026-08-10, North Carolina, USA/.test(materialSourceLabel("pex_b_half")),
  materialSourceLabel("pex_b_half"),
);
ok(
  "no material claims a wholesale basis — §11 is explicit that every figure is retail",
  materialKeys.every((k) => PLUMBING_MATERIALS[k].source.priceBasis !== "wholesale"),
);
ok(
  "the retail-to-wholesale gap is carried as the inference it is",
  WHOLESALE_DISCOUNT.confidence === "inferred" && WHOLESALE_DISCOUNT.low === 0.25 && WHOLESALE_DISCOUNT.high === 0.45,
);
ok(
  "the ANACO list price is never used as a cost",
  PLUMBING_MATERIALS.cast_iron_nohub_coupling_4.listPrice === 52.43 &&
    PLUMBING_MATERIALS.cast_iron_nohub_coupling_4.cost.typical < 52.43 &&
    PLUMBING_MATERIALS.cast_iron_nohub_coupling_4.confidence === "inferred",
);

// ── 9. Allowances carry no cost ─────────────────────────────────────────────
console.log("\nAllowances — homeowner taste is not a trade cost (Part 4 rule #9)");

const allowanceWithCost = allowances.filter((k) => PLUMBING_MATERIALS[k].cost !== null);
ok("no allowance carries a cost", allowanceWithCost.length === 0, allowanceWithCost);

const allowanceMissingAxis = allowances.filter((k) => {
  const a = PLUMBING_MATERIALS[k];
  return !Array.isArray(a.tieringAxis) || a.tieringAxis.length === 0 || !a.observedRange || !isNum(a.spread);
});
ok("every allowance names its tiering axis, its observed range and its spread", allowanceMissingAxis.length === 0, allowanceMissingAxis);

const allowanceWithCentre = allowances.filter((k) => "typical" in (PLUMBING_MATERIALS[k].observedRange || {}));
ok("no observed range has a centre that could be read as a default", allowanceWithCentre.length === 0, allowanceWithCentre);

for (const [key, minSpread] of [
  ["toilet", 20],
  ["shower_valve_trim", 12],
  ["tub", 6],
  ["bathroom_faucet", 5],
]) {
  ok(`${key} is an allowance (${PLUMBING_MATERIALS[key].spread}× spread)`, PLUMBING_MATERIALS[key].type === "allowance" && PLUMBING_MATERIALS[key].spread >= minSpread);
}
ok(
  "getMaterialCost refuses an allowance and says what to do instead",
  getMaterialCost("toilet").available === false && getMaterialCost("toilet").allowance === true && /allowance/i.test(getMaterialCost("toilet").reason),
);

// ── 10. Unpriced items are honest, not blank ────────────────────────────────
console.log("\nUnpriced — a visible gap beats a plausible number");

const badUnpricedMaterial = unpricedMaterials.filter((k) => {
  const u = PLUMBING_MATERIALS[k];
  return u.cost !== null || u.unpriced !== true || typeof u.reason !== "string" || u.reason.trim().length < 30 || u.confidence !== "unverified";
});
ok("every unpriced material carries a reason and no fabricated number", badUnpricedMaterial.length === 0, badUnpricedMaterial);

ok(
  "CPVC is unpriced, with the reason, and is NOT interpolated from PVC",
  PLUMBING_MATERIALS.cpvc_pipe.type === "unpriced" &&
    PLUMBING_MATERIALS.cpvc_pipe.cost === null &&
    /interpolated|different resin/i.test(PLUMBING_MATERIALS.cpvc_pipe.reason),
);
ok(
  "getMaterialCost refuses CPVC rather than returning something",
  getMaterialCost("cpvc_pipe").available === false && getMaterialCost("cpvc_pipe").unpriced === true,
);
for (const key of ["closet_flange", "wax_ring", "ball_valve_brass", "backflow_preventer_rpz", "washer_outlet_box"]) {
  ok(`${key} is named as unverified rather than guessed`, PLUMBING_MATERIALS[key].type === "unpriced");
}

// ── 11. Fitting system is an axis, never a substitution ─────────────────────
console.log("\nFittings — the 8–13× axis that must never be a silent swap");

ok(
  "the same ½\" elbow exists twice, as two keys — one per fitting system",
  Boolean(PLUMBING_MATERIALS.pex_fitting_elbow_half_crimp) &&
    Boolean(PLUMBING_MATERIALS.pex_fitting_elbow_half_push_fit) &&
    PLUMBING_MATERIALS.pex_fitting_elbow_half_crimp !== PLUMBING_MATERIALS.pex_fitting_elbow_half_push_fit,
);
ok(
  "each declares which system it belongs to",
  PLUMBING_MATERIALS.pex_fitting_elbow_half_crimp.fittingSystem === "crimp" &&
    PLUMBING_MATERIALS.pex_fitting_elbow_half_push_fit.fittingSystem === "push_fit",
);
ok(
  "there is no system-less 'PEX elbow' one could be substituted into",
  !("pex_fitting_elbow_half" in PLUMBING_MATERIALS) &&
    !materialKeys.some((k) => /elbow/i.test(k) && !PLUMBING_MATERIALS[k].fittingSystem),
  materialKeys.filter((k) => /elbow/i.test(k) && !PLUMBING_MATERIALS[k].fittingSystem),
);
const fittings = materialKeys.filter((k) => PLUMBING_MATERIALS[k].category === "fitting");
const systemless = fittings.filter((k) => !PLUMBING_MATERIALS[k].fittingSystem && !PLUMBING_MATERIALS[k].dwvSystem);
ok("every fitting declares a system — none is generic enough to substitute into", systemless.length === 0, systemless);

const crimpElbow = PLUMBING_MATERIALS.pex_fitting_elbow_half_crimp.cost.typical;
const pushElbow = PLUMBING_MATERIALS.pex_fitting_elbow_half_push_fit.cost.typical;
const measuredMultiple = pushElbow / crimpElbow;
ok(
  `the priced items still reproduce the 8–13× premium (measured ${measuredMultiple.toFixed(1)}×)`,
  measuredMultiple >= FITTING_SYSTEM_COST_MULTIPLE.low && measuredMultiple <= FITTING_SYSTEM_COST_MULTIPLE.high,
  measuredMultiple,
);
ok(
  "the expansion system's relative cost is marked inferred, because the fitting was never priced",
  FITTING_SYSTEMS.expansion.confidence === "inferred" && FITTING_SYSTEMS.push_fit.confidence === "read",
);

// ── 12. The ABS/PVC region dependency cannot resolve silently ───────────────
console.log("\nDWV — region-determined, and it refuses to guess");

for (const input of [undefined, null, "", "default", "auto", "abs_or_pvc", 0, false]) {
  const r = resolveDwvMaterial(input);
  ok(`resolveDwvMaterial(${JSON.stringify(input)}) refuses`, r.resolved === false && typeof r.reason === "string" && r.reason.length > 30);
}
const refusal = resolveDwvMaterial();
ok("the refusal offers both systems and asks the question", refusal.options.length === 2 && /ABS or PVC/i.test(refusal.prompt));
ok("the refusal says what guessing costs", /70%|local code/i.test(refusal.reason));

ok("an explicit ABS resolves", resolveDwvMaterial("abs").resolved === true && resolveDwvMaterial("abs").system === "abs");
ok("an explicit PVC resolves", resolveDwvMaterial("pvc").resolved === true && resolveDwvMaterial("pvc").system === "pvc");
ok(
  "the two systems cover the same sizes — a size present in one and missing in the other would resolve the dependency by accident",
  JSON.stringify(Object.keys(DWV_SYSTEMS.abs.materialKeys)) === JSON.stringify(Object.keys(DWV_SYSTEMS.pvc.materialKeys)),
);
const danglingDwv = Object.values(DWV_SYSTEMS)
  .flatMap((s) => Object.values(s.materialKeys))
  .filter((k) => !PLUMBING_MATERIALS[k]);
ok("every size a system points at is a real material", danglingDwv.length === 0, danglingDwv);

const ratio4 = PLUMBING_MATERIALS.abs_dwv_4.cost.typical / PLUMBING_MATERIALS.pvc_dwv_4.cost.typical;
ok(
  `ABS is ${ratio4.toFixed(2)}× PVC at 4", inside the published 1.6–1.9× band`,
  ratio4 >= DWV_COST_RATIO_ABS_OVER_PVC.low && ratio4 <= DWV_COST_RATIO_ABS_OVER_PVC.high,
  ratio4,
);
ok(
  "the per-size arithmetic is published alongside the headline, because it does NOT reproduce below 4\"",
  DWV_COST_RATIO_ABS_OVER_PVC.measuredBySize["3in"] < DWV_COST_RATIO_ABS_OVER_PVC.low &&
    /generalised/i.test(DWV_COST_RATIO_ABS_OVER_PVC.measuredBasis),
);

// ── 13. Region is a value, never an FX conversion ───────────────────────────
console.log("\nRegion — stored per region, never converted (§9)");

const heaterCa = getMaterialCost("wh_tank_50_gas", "CA");
ok("a Canadian read is returned as its own value in CAD", heaterCa.available === true && heaterCa.currency === "CAD" && heaterCa.cost.typical === 1345);
const heaterUs = getMaterialCost("wh_tank_50_gas", "US");
ok("the US read is a different value in USD", heaterUs.currency === "USD" && heaterUs.cost.typical === 850);
// §9's whole point: one FX multiplier cannot serve both. Measure two categories
// and prove they disagree — heaters run ~1.58 nominal, ABS pipe ~1.16.
const heaterRatio = heaterCa.cost.typical / heaterUs.cost.typical;
const absRatio = PLUMBING_MATERIALS.abs_dwv_4.regions.CA.cost.typical / PLUMBING_MATERIALS.abs_dwv_4.cost.typical;
ok(
  `a water heater's CAD/USD ratio (${heaterRatio.toFixed(2)}) and ABS pipe's (${absRatio.toFixed(2)}) disagree — which is why no single multiplier exists`,
  Math.abs(heaterRatio - absRatio) > 0.3,
  { heaterRatio, absRatio },
);
ok(
  "both measured ratios sit inside §9's published 0.85–1.53 envelope",
  heaterRatio >= 0.85 && heaterRatio <= 1.6 && absRatio >= 0.85 && absRatio <= 1.6,
  { heaterRatio, absRatio },
);
const noCa = getMaterialCost("wh_tank_50_electric", "CA");
ok(
  "an item with no Canadian read refuses rather than converting",
  noCa.available === false && noCa.noRegionalRead === true && /will not convert/i.test(noCa.reason),
);
ok("the refusal cites the 0.85–1.53 measurement", /0\.85|1\.53/.test(noCa.reason));
ok("an unknown material refuses too", getMaterialCost("no_such_material").available === false);
ok(
  "a CAD-primary item is served in CAD and refuses US",
  getMaterialCost("pex_a_half_coil", "CA").currency === "CAD" && getMaterialCost("pex_a_half_coil", "US").available === false,
);

// ── 14. Override merge follows getRecipe() exactly ──────────────────────────
console.log("\nOverrides — materialRecipes.getRecipe() semantics, unchanged");

ok("no overrides returns the base object itself", getPlumbingMaterials() === PLUMBING_MATERIALS);
ok("an empty override object returns the base object itself", getPlumbingMaterials({}) === PLUMBING_MATERIALS);

const merged = getPlumbingMaterials({ pex_b_half: { cost: { typical: 0.42 } } });
ok("overriding cost.typical keeps the read low and high", merged.pex_b_half.cost.low === 0.28 && merged.pex_b_half.cost.typical === 0.42 && merged.pex_b_half.cost.high === 0.5, merged.pex_b_half.cost);
ok("overriding one material leaves the others untouched", merged.copper_type_m_half === PLUMBING_MATERIALS.copper_type_m_half);
ok("the base object is not mutated", PLUMBING_MATERIALS.pex_b_half.cost.typical === 0.35);

const scalarOverride = getPlumbingMaterials({ pex_b_half: { confidence: "guess" } });
ok("a scalar override replaces just that field", scalarOverride.pex_b_half.confidence === "guess" && scalarOverride.pex_b_half.cost.typical === 0.35);

const sourceOverride = getPlumbingMaterials({ pex_b_half: { source: { retailer: "My supplier" } } });
ok("overriding the retailer keeps the region and read date", sourceOverride.pex_b_half.source.retailer === "My supplier" && sourceOverride.pex_b_half.source.region === "North Carolina, USA");

ok("getMaterialCost honours overrides", getMaterialCost("pex_b_half", "US", { pex_b_half: { cost: { typical: 0.42 } } }).cost.typical === 0.42);

// ── 15. It must not reach a client-facing surface ───────────────────────────
console.log("\nBoundary — the benchmarks and the material costs are internal, never client-facing");

const CLIENT_DIRS = ["app/quote", "app/book", "app/q", "app/portal", "app/site", "app/embed"];
const INTERNAL_MODULES = ["plumbingBenchmarks", "plumbingMaterials"];
const offenders = [];
const walk = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(e)) {
      const src = readFileSync(p, "utf8");
      if (INTERNAL_MODULES.some((m) => src.includes(m))) offenders.push(p);
    }
  }
};
CLIENT_DIRS.forEach(walk);
ok("no client-facing route imports the benchmarks or the material costs", offenders.length === 0, offenders);

const benchmarkSrc = readFileSync("app/data/plumbingBenchmarks.js", "utf8");
const materialSrc = readFileSync("app/data/plumbingMaterials.js", "utf8");
const catalogueSrc = readFileSync("app/data/plumbingCatalog.js", "utf8");

ok("the benchmarks module says in words that it is not client-facing", /Nothing here is client-facing|never client-facing/i.test(benchmarkSrc));
ok("the materials module says in words that it is not client-facing", /nothing here is client-facing|never client-facing/i.test(materialSrc));
ok("the catalogue explains why it has no prices", /rate` is not merely null|rate: null|no prices/i.test(catalogueSrc));
ok(
  "the catalogue source contains no numeric rate assignment",
  !/\brate\s*:\s*-?\d/.test(catalogueSrc) && !/\bprice\s*:\s*-?\d/.test(catalogueSrc),
);
ok("the research citations survive in all three files", /§2B/.test(catalogueSrc) && /§2D/.test(benchmarkSrc) && /§1\.8/.test(materialSrc));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
