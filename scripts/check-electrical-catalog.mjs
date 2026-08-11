// scripts/check-electrical-catalog.mjs
//
//   npm run check:electrical
//
// Executes the three electrical price-book files rather than reading them.
//
// Each assertion below corresponds to a way this price book could go quietly
// wrong, and most of them are named failure classes from AGENTS.md:
//
//   * a `rate` appearing on a catalogue line. defaultLineItems.js ships prices
//     absent on purpose — a plausible default lands on a document a homeowner
//     signs, unread, and Part 1's fifteen real estimates span 2.1× on the same
//     nominal job. One number cannot be right.
//   * a benchmark key that resolves to no catalogue line, or a catalogue line
//     with no benchmark. Both directions are the written-never-read failure
//     class: an orphan benchmark is guidance nothing can show, and an orphan
//     line is a chip whose "typical range" panel is silently empty.
//   * a material losing `brand`, `pack` or `scope`. §3.1 proves each of those
//     swings price further than brand choice normally does — 4.9× on roll size
//     alone, 6× on panel scope — so a material default without them is a number
//     a contractor cannot correct.
//   * a cost default appearing on a ceiling fan or an exterior lantern. Their
//     spread is 10.7× and 13.3× and it is homeowner taste, not trade. Part 4
//     rule #9: a default there is a fiction; an allowance is honest.
//   * a benchmark or material module reaching a client-facing route. These are
//     national ranges and internal costs — non-negotiable #4 says public
//     endpoints never return prices, and a rate card published openly is handed
//     to every competitor in the city.
//   * a confidence tag drifting to something outside read/derived/guess, or a
//     null range losing the sentence that says why it is null. Absence of a
//     statement is not a statement: a benchmark with no band has to say so.
//   * the two currencies being treated as one. Benchmarks are USD market
//     research; materials are CAD retail. §3.10 forbids deriving one from the
//     other, so a margin computed by subtracting them is arithmetic across two
//     currencies.

import { ELECTRICAL_LINE_ITEMS, ELECTRICAL_UNITS } from "@/app/data/electricalCatalog";
import { ELECTRICAL_BENCHMARKS } from "@/app/data/electricalBenchmarks";
import {
  ELECTRICAL_MATERIALS,
  ELECTRICAL_MATERIAL_MULTIPLIERS,
  getElectricalMaterials,
  hasElectricalMaterial,
} from "@/app/data/electricalMaterials";

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

const VALID_UNITS = new Set(Object.values(ELECTRICAL_UNITS));
const VALID_CONFIDENCE = new Set(["read", "derived", "guess"]);
const VALID_TYPES = new Set(["material", "allowance", "unpriced"]);

const catalogKeys = ELECTRICAL_LINE_ITEMS.map((i) => i.key);
const benchmarkKeys = Object.keys(ELECTRICAL_BENCHMARKS);
const materialKeys = Object.keys(ELECTRICAL_MATERIALS);

// ── 1. The catalogue ships a LIST, never a price ──────────────────────────
console.log("\nCatalogue — the list is the deliverable, the number is the contractor's");

const priced = ELECTRICAL_LINE_ITEMS.filter(
  (i) => typeof i.rate === "number" || typeof i.unitPrice === "number" || typeof i.price === "number",
);
ok("no catalogue line carries a numeric rate", priced.length === 0, priced.map((i) => i.key));
ok(
  "no catalogue line carries a rate key at all, even null",
  ELECTRICAL_LINE_ITEMS.every((i) => !("rate" in i)),
  ELECTRICAL_LINE_ITEMS.filter((i) => "rate" in i).map((i) => i.key),
);
ok("the catalogue is a non-trivial list", ELECTRICAL_LINE_ITEMS.length >= 40, ELECTRICAL_LINE_ITEMS.length);
ok(
  "every line has a non-empty description",
  ELECTRICAL_LINE_ITEMS.every((i) => typeof i.description === "string" && i.description.trim().length > 3),
);
ok(
  "every unit comes from the shared vocabulary",
  ELECTRICAL_LINE_ITEMS.every((i) => VALID_UNITS.has(i.unit)),
  ELECTRICAL_LINE_ITEMS.filter((i) => !VALID_UNITS.has(i.unit)).map((i) => [i.key, i.unit]),
);
ok(
  "the four defaultLineItems.js units are byte-identical, so the parallel wiring cannot drift",
  ELECTRICAL_UNITS.FLAT === "flat" &&
    ELECTRICAL_UNITS.EACH === "each" &&
    ELECTRICAL_UNITS.SQFT === "sqft" &&
    ELECTRICAL_UNITS.LF === "linear_ft",
);
ok("keys are unique", new Set(catalogKeys).size === catalogKeys.length);
ok(
  "descriptions are unique — the builder de-duplicates suggestions by description",
  new Set(ELECTRICAL_LINE_ITEMS.map((i) => i.description.toLowerCase())).size === ELECTRICAL_LINE_ITEMS.length,
);

// ── 2. Coverage — the trade's habitual and habitually-forgotten work ──────
console.log("\nCoverage — what an electrician bills, including what they forget to bill");

const REQUIRED_COVERAGE = {
  "service / panel upgrade": ["panel_replacement", "service_upgrade_200a", "meter_base"],
  subpanel: ["subpanel", "subpanel_feeder"],
  rewire: ["whole_house_rewire", "rewire_per_opening", "knob_tube_replacement"],
  "EV charger": ["ev_charger_install", "circuit_240v"],
  "generator / transfer switch": ["generator_inlet_interlock", "transfer_switch"],
  "receptacles & switches": ["receptacle_replace", "receptacle_new", "gfci_receptacle", "switch_replace"],
  "lighting & recessed": ["fixture_swap", "recessed_new", "recessed_retrofit"],
  "ceiling fans": ["ceiling_fan_existing_box", "ceiling_fan_new_box"],
  "smoke / CO": ["smoke_co_alarm"],
  "troubleshooting & diagnostics": ["diagnostic", "labour_hourly"],
  "permits & inspection": ["permit", "reinspection"],
  trenching: ["trenching"],
  "forgotten extras": ["drywall_exclusion", "disposal", "travel_fee", "after_hours", "service_call"],
};
for (const [area, keys] of Object.entries(REQUIRED_COVERAGE)) {
  const missing = keys.filter((k) => !catalogKeys.includes(k));
  ok(`covers ${area}`, missing.length === 0, missing);
}

// ── 3. Catalogue ↔ benchmarks, both directions ────────────────────────────
console.log("\nBenchmarks — 1:1 with the catalogue, in both directions");

const orphanBenchmarks = benchmarkKeys.filter((k) => !catalogKeys.includes(k));
const unbenchmarked = catalogKeys.filter((k) => !benchmarkKeys.includes(k));
ok("no benchmark points at a line that does not exist", orphanBenchmarks.length === 0, orphanBenchmarks);
ok("no catalogue line is left without a benchmark", unbenchmarked.length === 0, unbenchmarked);
ok("the two files are the same size", benchmarkKeys.length === catalogKeys.length, {
  benchmarks: benchmarkKeys.length,
  catalogue: catalogKeys.length,
});

// ── 4. Benchmark shape ────────────────────────────────────────────────────
console.log("\nBenchmarks — shape, ordering, and the honesty of a missing band");

const badConfidence = benchmarkKeys.filter((k) => !VALID_CONFIDENCE.has(ELECTRICAL_BENCHMARKS[k].confidence));
ok("every confidence tag is read, derived or guess", badConfidence.length === 0, badConfidence);

const badCurrency = benchmarkKeys.filter((k) => ELECTRICAL_BENCHMARKS[k].currency !== "USD");
ok("every benchmark is USD — Part 2 is US market research", badCurrency.length === 0, badCurrency);

const noBasis = benchmarkKeys.filter((k) => {
  const b = ELECTRICAL_BENCHMARKS[k].basis;
  return typeof b !== "string" || b.trim().length < 40;
});
ok("every benchmark cites where its numbers came from", noBasis.length === 0, noBasis);

const partialRange = benchmarkKeys.filter((k) => {
  const b = ELECTRICAL_BENCHMARKS[k];
  const nulls = [b.low, b.typical, b.high].filter((v) => v === null || v === undefined).length;
  return nulls !== 0 && nulls !== 3;
});
ok("a range is either fully present or fully null, never half a statement", partialRange.length === 0, partialRange);

const misordered = benchmarkKeys.filter((k) => {
  const b = ELECTRICAL_BENCHMARKS[k];
  if (b.typical === null) return false;
  return !(b.low <= b.typical && b.typical <= b.high);
});
ok("low <= typical <= high everywhere", misordered.length === 0, misordered);

const nullRanged = benchmarkKeys.filter((k) => ELECTRICAL_BENCHMARKS[k].typical === null);
const missingReason = nullRanged.filter((k) => {
  const r = ELECTRICAL_BENCHMARKS[k].noRange;
  return typeof r !== "string" || r.trim().length < 20;
});
ok("every null range says why it is null", missingReason.length === 0, missingReason);
ok(
  "a priced benchmark does not also claim to have no range",
  benchmarkKeys.filter((k) => ELECTRICAL_BENCHMARKS[k].typical !== null && ELECTRICAL_BENCHMARKS[k].noRange).length === 0,
);
ok("the research's explicit refusals actually shipped as refusals", nullRanged.length >= 4 && nullRanged.includes("service_upgrade_400a") && nullRanged.includes("heavy_fixture"), nullRanged);

// The one item whose market form is a multiplier, not an amount (§2D.1).
const withMultiplier = benchmarkKeys.filter((k) => ELECTRICAL_BENCHMARKS[k].multiplier);
ok(
  "a multiplier-priced item carries no dollar band",
  withMultiplier.every((k) => ELECTRICAL_BENCHMARKS[k].typical === null),
  withMultiplier,
);
ok(
  "after-hours is 1.5x weeknight to 3x holiday",
  ELECTRICAL_BENCHMARKS.after_hours.multiplier.low === 1.5 && ELECTRICAL_BENCHMARKS.after_hours.multiplier.high === 3,
);

// ── 5. Difficulty tiers must PRINT their criteria (§2B.1③, §2D.4) ─────────
console.log("\nDifficulty tiers — the criteria are the point, not the label");

const tiered = benchmarkKeys.filter((k) => ELECTRICAL_BENCHMARKS[k].difficultyTiers);
ok("difficulty tiers exist where the research quantified them", tiered.length >= 4, tiered);

const barelabels = [];
const tierOrderBroken = [];
for (const k of tiered) {
  const tiers = ELECTRICAL_BENCHMARKS[k].difficultyTiers;
  for (const t of tiers) {
    if (typeof t.criteria !== "string" || t.criteria.trim().length < 40) barelabels.push(`${k}.${t.level}`);
    if (!(t.low <= t.typical && t.typical <= t.high)) tierOrderBroken.push(`${k}.${t.level}`);
  }
  // Tiers only mean something if they actually escalate.
  const typicals = tiers.map((t) => t.typical);
  const ascending = typicals.every((v, i) => i === 0 || v >= typicals[i - 1]);
  ok(`${k}: tiers escalate`, ascending, typicals);
}
ok(
  "no tier is a bare label — Part 1's 'Level 1 / Level 3' is the anti-pattern",
  barelabels.length === 0,
  barelabels,
);
ok("every tier's own band is ordered", tierOrderBroken.length === 0, tierOrderBroken);
ok(
  "the rewire tiers run open-wall to knob-and-tube, which is the 2.9x access spread",
  ELECTRICAL_BENCHMARKS.whole_house_rewire.difficultyTiers.length === 5,
);

// ── 6. Warranty is two terms, never one string (§2D.5) ────────────────────
console.log("\nWarranty — parts and labour are different lengths");

const warranted = benchmarkKeys.filter((k) => ELECTRICAL_BENCHMARKS[k].warranty);
ok("warranty is carried on the substantial installs", warranted.length >= 5, warranted.length);

const badWarranty = warranted.filter((k) => {
  const w = ELECTRICAL_BENCHMARKS[k].warranty;
  const keys = Object.keys(w).sort().join(",");
  if (keys !== "labourTerm,partsTerm") return true;
  if (w.partsTerm === null && w.labourTerm === null) return true;
  return [w.partsTerm, w.labourTerm].some((t) => t !== null && (typeof t !== "string" || t.trim().length < 10));
});
ok("every warranty carries partsTerm AND labourTerm, and not both empty", badWarranty.length === 0, badWarranty);
ok(
  "no benchmark carries a single flat warranty string instead",
  benchmarkKeys.every((k) => typeof ELECTRICAL_BENCHMARKS[k].warranty !== "string"),
);

// ── 7. includesPermit and quantity bands ──────────────────────────────────
console.log("\nPermit inclusion and quantity bands");

const permitFlagged = benchmarkKeys.filter((k) => typeof ELECTRICAL_BENCHMARKS[k].includesPermit === "boolean");
ok("includesPermit is set on the permit-bearing jobs", permitFlagged.length >= 6, permitFlagged.length);
ok(
  "the bands that exclude the permit say so, so `permit` gets its own line (§2.5)",
  ELECTRICAL_BENCHMARKS.service_upgrade_200a.includesPermit === false &&
    ELECTRICAL_BENCHMARKS.whole_house_rewire.includesPermit === false,
);

const banded = benchmarkKeys.filter((k) => ELECTRICAL_BENCHMARKS[k].quantityBands);
ok("quantity bands exist where §1.3 and §2C.2 observed them", banded.length >= 4, banded);
const badBand = [];
for (const k of banded) {
  for (const b of ELECTRICAL_BENCHMARKS[k].quantityBands) {
    if (typeof b.label !== "string" || !b.label.trim()) badBand.push(`${k}: unlabelled band`);
    if (!(b.low <= b.typical && b.typical <= b.high)) badBand.push(`${k}.${b.label}`);
  }
}
ok("every quantity band is labelled and ordered", badBand.length === 0, badBand);
ok(
  "the first device costs more than the eleventh — §2C.2① is a truck-roll shape, not a discount",
  ELECTRICAL_BENCHMARKS.receptacle_replace.quantityBands[0].typical >
    ELECTRICAL_BENCHMARKS.receptacle_replace.quantityBands[2].typical,
);
ok(
  "an AFCI breaker fitted while the panel is open is cheaper than the same breaker as its own call-out (§2C.2②)",
  ELECTRICAL_BENCHMARKS.breaker_afci_gfci.quantityBands[0].typical <
    ELECTRICAL_BENCHMARKS.breaker_afci_gfci.quantityBands[1].typical,
);

// ── 8. The $0 clause lines (§2B.1) ────────────────────────────────────────
console.log("\nClause lines — exclusions priced at zero, inside the price table");

for (const k of ["drywall_exclusion", "concealed_conditions_clause"]) {
  const b = ELECTRICAL_BENCHMARKS[k];
  ok(`${k} is priced at zero, deliberately`, b.low === 0 && b.typical === 0 && b.high === 0);
}

// ── 9. Materials — the three fields a naive schema omits (§3.1) ───────────
console.log("\nMaterials — brand, pack and scope are mandatory (§3.1)");

ok("the material set is substantial", materialKeys.length >= 60, materialKeys.length);

const missingField = [];
for (const k of materialKeys) {
  const m = ELECTRICAL_MATERIALS[k];
  if (typeof m.brand !== "string" || !m.brand.trim()) missingField.push(`${k}.brand`);
  if (!m.pack || typeof m.pack.size !== "number" || typeof m.pack.unit !== "string" || !m.pack.unit.trim())
    missingField.push(`${k}.pack`);
  if (typeof m.scope !== "string" || m.scope.trim().length < 10) missingField.push(`${k}.scope`);
  if (typeof m.source !== "string" || !m.source.trim()) missingField.push(`${k}.source`);
  if (typeof m.label !== "string" || !m.label.trim()) missingField.push(`${k}.label`);
  if (!VALID_TYPES.has(m.type)) missingField.push(`${k}.type`);
}
ok("every material carries brand, pack (size + unit), scope and source", missingField.length === 0, missingField);
ok(
  "every material is CAD — Part 3 was read off homedepot.ca, and mixing it with the USD benchmarks is arithmetic across two currencies",
  materialKeys.every((k) => ELECTRICAL_MATERIALS[k].currency === "CAD"),
  materialKeys.filter((k) => ELECTRICAL_MATERIALS[k].currency !== "CAD"),
);
ok(
  "every source names the retailer, the region and the date it was read (Part 4 rule #10)",
  materialKeys.every((k) => {
    const s = ELECTRICAL_MATERIALS[k].source;
    return /retail/i.test(s) && /2026-08-10/.test(s) && /Gatineau|QC/i.test(s);
  }),
  materialKeys.filter((k) => !/retail/i.test(ELECTRICAL_MATERIALS[k].source)),
);

const costProblems = [];
for (const k of materialKeys) {
  const m = ELECTRICAL_MATERIALS[k];
  if (m.type === "material") {
    if (!m.cost) costProblems.push(`${k}: material with no cost`);
    else if (!(m.cost.low <= m.cost.typical && m.cost.typical <= m.cost.high)) costProblems.push(`${k}: cost misordered`);
    else if (!(m.cost.low > 0)) costProblems.push(`${k}: non-positive cost`);
  } else if (m.cost) {
    costProblems.push(`${k}: ${m.type} carries a cost`);
  }
}
ok("materials have an ordered positive cost; allowances and gaps have none", costProblems.length === 0, costProblems);

// ── 10. Allowances and honest gaps ────────────────────────────────────────
console.log("\nAllowances (Part 4 rule #9) and the gaps §3.11 refused to fill");

const allowances = materialKeys.filter((k) => ELECTRICAL_MATERIALS[k].type === "allowance");
ok("the two 10x+ homeowner-taste items are allowances, not cost defaults",
  allowances.includes("ceiling_fan_allowance") && allowances.includes("exterior_lantern_allowance"), allowances);
ok(
  "every allowance explains its spread and what to do instead",
  allowances.every((k) => {
    const m = ELECTRICAL_MATERIALS[k];
    return typeof m.spread === "string" && m.spread.trim() && typeof m.guidance === "string" && m.guidance.trim();
  }),
);

const unpriced = materialKeys.filter((k) => ELECTRICAL_MATERIALS[k].type === "unpriced");
ok("§3.11's gaps ship as stated gaps rather than being dropped", unpriced.length >= 4, unpriced);
ok(
  "every gap says what is missing and why",
  unpriced.every((k) => typeof ELECTRICAL_MATERIALS[k].gap === "string" && ELECTRICAL_MATERIALS[k].gap.length > 40),
);
ok("the interlock kit is one of them — it is the commonest generator connection and has no price anywhere", unpriced.includes("interlock_kit"));

// ── 11. Executing the data, not just reading it ───────────────────────────
console.log("\nThe two spreads that make `pack` and `scope` load-bearing");

const perMetre = (k) => ELECTRICAL_MATERIALS[k].cost.typical / ELECTRICAL_MATERIALS[k].pack.size;
const coilRatio = perMetre("nmd90_12_2_coil_5m") / perMetre("nmd90_12_2_150m");
ok("identical 12/2 cable costs ~4.9x more per metre as a short coil (§3.1)", coilRatio > 4.5 && coilRatio < 5.3, Number(coilRatio.toFixed(2)));

const scopeRatio =
  ELECTRICAL_MATERIALS.panel_package_200a_30sp_afci.cost.typical /
  ELECTRICAL_MATERIALS.panel_main_breaker_200a_30ckt_bare.cost.typical;
ok("a 200 A panel is ~6x dearer as an AFCI package than bare (§3.1)", scopeRatio > 5.5 && scopeRatio < 6.5, Number(scopeRatio.toFixed(2)));

const packSaving =
  ELECTRICAL_MATERIALS.box_steel_1gang_30pk.cost.typical / ELECTRICAL_MATERIALS.box_steel_1gang_30pk.pack.size;
ok("the 30-pack box really is cheaper per unit than the each price", packSaving < ELECTRICAL_MATERIALS.box_steel_1gang_each.cost.typical);

ok(
  "the wire multipliers keep their order — direct burial dearest, then armoured",
  ELECTRICAL_MATERIAL_MULTIPLIERS.nmwuOverNmd90.low > ELECTRICAL_MATERIAL_MULTIPLIERS.ac90OverNmd90.low &&
    ELECTRICAL_MATERIAL_MULTIPLIERS.emtOverPvc.low > 2,
);
ok(
  "no CAD/USD conversion factor is exported — §3.10 forbids deriving one from the other",
  !("cadOverUsd" in ELECTRICAL_MATERIAL_MULTIPLIERS) && !("fx" in ELECTRICAL_MATERIAL_MULTIPLIERS),
);

// ── 12. getElectricalMaterials — getRecipe()'s merge semantics ────────────
console.log("\ngetElectricalMaterials — nested merge, and two documented refusals");

ok("no overrides returns the defaults untouched", getElectricalMaterials() === ELECTRICAL_MATERIALS);
ok("an empty override object returns the defaults untouched", getElectricalMaterials({}) === ELECTRICAL_MATERIALS);

const partial = getElectricalMaterials({ breaker_1p_15a: { cost: { typical: 9.5 } } });
ok("overriding cost.typical keeps cost.low and cost.high", partial.breaker_1p_15a.cost.typical === 9.5 && partial.breaker_1p_15a.cost.low === 12.98 && partial.breaker_1p_15a.cost.high === 29.71, partial.breaker_1p_15a.cost);
ok("overriding cost keeps brand, pack, scope and source", partial.breaker_1p_15a.pack.unit === "each" && Boolean(partial.breaker_1p_15a.source));
ok("other materials fall through untouched", partial.rw90_6 === ELECTRICAL_MATERIALS.rw90_6);
ok(
  "overrides never mutate the shared defaults",
  ELECTRICAL_MATERIALS.breaker_1p_15a.cost.typical === 14.97,
  ELECTRICAL_MATERIALS.breaker_1p_15a.cost.typical,
);

const packed = getElectricalMaterials({ nmd90_12_2_150m: { pack: { size: 300 } } });
ok("overriding pack.size keeps pack.unit — a roll with no unit is the §3.1 failure", packed.nmd90_12_2_150m.pack.unit === "m roll" && packed.nmd90_12_2_150m.pack.size === 300, packed.nmd90_12_2_150m.pack);

const unknown = getElectricalMaterials({ not_a_real_material: { cost: { low: 1, typical: 1, high: 1 } } });
ok("an unknown key is ignored, not materialised into a phantom material", !("not_a_real_material" in unknown));

const sneaky = getElectricalMaterials({ ceiling_fan_allowance: { cost: { low: 1, typical: 2, high: 3 } } });
ok("a cost cannot be attached to an allowance (Part 4 rule #9)", !sneaky.ceiling_fan_allowance.cost);
const retyped = getElectricalMaterials({ ceiling_fan_allowance: { type: "material" } });
ok("type is not overridable — the classification is evidence, not preference", retyped.ceiling_fan_allowance.type === "allowance");
const allowanceSet = getElectricalMaterials({ ceiling_fan_allowance: { allowance: { typical: 400 } } });
ok("an allowance amount IS overridable, which is the supported way to set one", allowanceSet.ceiling_fan_allowance.allowance.typical === 400);

ok("hasElectricalMaterial answers for gaps too", hasElectricalMaterial("interlock_kit") && !hasElectricalMaterial("nope"));

// ── 13. Boundary — internal modules, never client-facing ──────────────────
console.log("\nBoundary — benchmarks and material costs never reach a client surface");

const CLIENT_DIRS = ["app/quote", "app/book", "app/q", "app/portal", "app/site", "app/embed"];
const INTERNAL_MODULES = ["electricalBenchmarks", "electricalMaterials"];
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
      for (const mod of INTERNAL_MODULES) if (src.includes(mod)) offenders.push(`${p} -> ${mod}`);
    }
  }
};
CLIENT_DIRS.forEach(walk);
ok("no client-facing route imports the benchmarks or the material costs", offenders.length === 0, offenders);

const benchSrc = readFileSync("app/data/electricalBenchmarks.js", "utf8");
const matSrc = readFileSync("app/data/electricalMaterials.js", "utf8");
const catSrc = readFileSync("app/data/electricalCatalog.js", "utf8");

ok("the benchmarks module says in words that it is not client-facing", /Nothing here is client-facing/i.test(benchSrc));
ok("the materials module says in words that it is not client-facing", /Nothing here is client-facing/i.test(matSrc));
ok("the catalogue states the rate-absent rule", /deliberately absent/i.test(catSrc));
ok(
  "both internal modules warn that USD and CAD must not be subtracted",
  /Do not subtract them/i.test(benchSrc) && /Do not subtract them/i.test(matSrc),
);
ok("the materials module labels its figures retail, so a user knows which way to adjust", /RETAIL prices/i.test(matSrc));
ok(
  "the confidence register survives in the benchmarks source",
  /\bread\b/.test(benchSrc) && /\bderived\b/.test(benchSrc) && /\bguess\b/.test(benchSrc),
);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
