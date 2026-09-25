// scripts/check-material-prices.mjs
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-material-prices.mjs
//
// Every material price in the seed templates, cross-checked against the
// per-country Home Depot reference (app/data/materialReference.js).
//
//   A. A line that names a `materialRef` names a real reference row.
//   B. Its cost is within −25 % / +60 % of that country's reference price —
//      a contractor's cost is often under shelf price with a trade discount;
//      above means a wrong unit or pack size. US: unitCost (USD); CA:
//      unitCostByCountry.CA (CAD) against the .ca price.
//   C. Coverage agrees with the reference product in the same unit, per
//      country (the Canadian pack's own coverage when it differs).
//   D. The loader picks the company's country: a CAD company in Canada gets
//      the .ca cost marked "reference"; a CAD company on a line with no .ca
//      price gets the converted US cost marked "fx-estimate".
//   WARN: a material line with no materialRef whose name reads like a stocked
//      material the reference carries — printed, not failed; the report lists
//      why each such line stands (a captured competitor price, a specialist
//      supplier item).

import { SERVICE_SEEDS } from "@/app/data/serviceSeeds";
import { MATERIAL_REFERENCE } from "@/app/data/materialReference";
import { seedTemplateFor } from "@/lib/services/seeds";

let fail = 0;
let passed = 0;
const ok = (c, m, d) => {
  if (c) passed++;
  else {
    fail++;
    console.log("  FAIL " + m + (d === undefined ? "" : `  — ${JSON.stringify(d)}`));
  }
};
const ref = Object.fromEntries(MATERIAL_REFERENCE.map((r) => [r.key, r]));
const pct = (a, b) => Math.round(((a - b) / b) * 1000) / 10;
const mismatches = [];
const warns = [];
const STOCK_WORDS = ["drywall", "joint compound", "paint", "primer", "stain", "caulk", "sealant", "shingle", "underlayment", "tile", "grout", "thinset", "baseboard", "mulch", "sod", "seed", "fertilizer", "edging", "gravel", "filter", "toilet", "wax ring", "supply line", "water heater", "pex", "gfci", "breaker", "smoke", "thermostat", "capacitor", "flex duct", "gutter", "deck board", "fence panel", "vinyl plank", "lvp", "laminate"];

console.log("\nA/B/C — every material line with a reference");
let refLines = 0;
for (const [trade, seed] of Object.entries(SERVICE_SEEDS)) {
  for (const s of seed.services) {
    for (const l of s.templateLines || []) {
      if (l.kind !== "material") continue;
      if (!l.materialRef) {
        const n = `${l.name} ${l.description}`.toLowerCase();
        const hit = STOCK_WORDS.find((w) => n.includes(w));
        if (hit) warns.push({ trade, template: s.seedKey, line: l.name, word: hit, cost: l.unitCost });
        continue;
      }
      refLines++;
      const r = ref[l.materialRef];
      ok(Boolean(r), `${s.seedKey}: "${l.name}" materialRef ${l.materialRef} exists`);
      if (!r) continue;
      // US
      if (r.prices.US) {
        const d = pct(l.unitCost, r.prices.US.amount);
        const good = d >= -25 && d <= 60;
        ok(good, `${s.seedKey}: "${l.name}" US cost within −25/+60 % of reference`, { cost: l.unitCost, ref: r.prices.US.amount, d });
        if (!good) mismatches.push({ trade, template: s.seedKey, line: l.name, country: "US", seed: l.unitCost, hd: r.prices.US.amount, d });
        if (l.coverage && r.coverage && l.coverage.unit === r.coverage.unit) {
          ok(l.coverage.per === r.coverage.per, `${s.seedKey}: "${l.name}" coverage equals the reference`, { seed: l.coverage, ref: r.coverage });
        }
      }
      // CA
      const caCost = l.unitCostByCountry?.CA;
      if (r.prices.CA) {
        ok(Number.isFinite(caCost), `${s.seedKey}: "${l.name}" carries the Canadian cost the reference has`, l.unitCostByCountry);
        if (Number.isFinite(caCost)) {
          const d = pct(caCost, r.prices.CA.amount);
          const good = d >= -25 && d <= 60;
          ok(good, `${s.seedKey}: "${l.name}" CA cost within −25/+60 % of reference`, { cost: caCost, ref: r.prices.CA.amount, d });
          if (!good) mismatches.push({ trade, template: s.seedKey, line: l.name, country: "CA", seed: caCost, hd: r.prices.CA.amount, d });
          const caCov = r.prices.CA.coverage || r.coverage;
          const lineCov = l.coverageByCountry?.CA || l.coverage;
          if (lineCov && caCov && lineCov.unit === caCov.unit) {
            ok(lineCov.per === caCov.per, `${s.seedKey}: "${l.name}" CA coverage follows the Canadian product`, { seed: lineCov, ref: caCov });
          }
          if (r.prices.CA.unit && r.prices.CA.unit !== l.unit) ok(l.unitByCountry?.CA === r.prices.CA.unit, `${s.seedKey}: "${l.name}" CA unit is the Canadian pack`, l.unitByCountry);
        }
      } else {
        ok(caCost === undefined, `${s.seedKey}: "${l.name}" invents no Canadian cost the reference lacks`, caCost);
      }
    }
  }
}
ok(refLines > 20, "the seeds cost a meaningful number of lines from the reference", refLines);

console.log("\nD — the loader picks the company's country");
{
  const svc = { seedKey: "fixture.a.b", templateLines: [
    { kind: "material", name: "Ceiling paint", description: "", qty: 1, unit: "gallon", unitPrice: 29.98, unitCost: 23.98, taxable: true, measurementKey: "ceilingSqft", coverage: { per: 187.5, unit: "sqft" }, materialRef: "ceiling_paint_gal", unitCostByCountry: { CA: 60.97 }, unitPriceByCountry: { CA: 76.21 }, unitByCountry: { CA: "pail" }, coverageByCountry: { CA: { per: 375, unit: "sqft" } } },
    { kind: "material", name: "LVP", description: "", qty: 1, unit: "box", unitPrice: 53.59, unitCost: 42.87, taxable: true, measurementKey: "floorSqft", coverage: { per: 22, unit: "sqft" }, materialRef: "lvp" },
  ] };
  const ca = seedTemplateFor(svc, { language: "en", currency: "CAD", country: "CA" }).templateLines;
  ok(ca[0].unitCost === 60.97 && ca[0].unit === "pail" && ca[0].coverage?.per === 375 && ca[0].costSource === "reference", "CA company: the .ca pail, its cost and coverage, marked reference", ca[0]);
  ok(ca[1].costSource === "fx-estimate" && ca[1].unitCost > 42.87, "CA company, no .ca price: the US cost converted and marked fx-estimate", ca[1]);
  const us = seedTemplateFor(svc, { language: "en", currency: "USD", country: "US" }).templateLines;
  ok(us[0].unitCost === 23.98 && us[0].unit === "gallon" && us[0].costSource === "reference", "US company: the US gallon at its shelf cost", us[0]);
  const noCountry = seedTemplateFor(svc, { language: "en", currency: "CAD" }).templateLines;
  ok(noCountry[0].costSource === "fx-estimate", "no country on the company: converted and marked, never a guessed Canadian price", noCountry[0]);
}

if (mismatches.length) {
  console.log("\nMismatches (trade | template | line | country | seed cost | Home Depot | % diff)");
  for (const m of mismatches) console.log(`  ${m.trade} | ${m.template} | ${m.line} | ${m.country} | ${m.seed} | ${m.hd} | ${m.d}%`);
}
if (warns.length) {
  console.log(`\nWARN — ${warns.length} material lines read like a stocked material but carry no materialRef (trade | template | line | word | cost):`);
  for (const w of warns) console.log(`  ${w.trade} | ${w.template} | ${w.line} | ${w.word} | ${w.cost}`);
}
console.log(`\n${passed} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
