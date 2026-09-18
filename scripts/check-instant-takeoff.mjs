#!/usr/bin/env node
// scripts/check-instant-takeoff.mjs
//
//   npm run check:instant-takeoff
//
// An instant quote opens in the editor with the same cost panel as a hand-built
// one. Until 2026-09-16 the draft stored only the price breakdown; the
// measurement was dropped after pricing, so the editor showed no hours, no
// materials and overhead against nothing. Now costingInputsForInstantTrade
// writes the builder's own takeoff for every instant trade, and the draft
// stores it on the scope group.
//
// Executed, not grepped: each mapping is run through tradeLabourHours,
// buildTradeLineItems and quoteCostSummary — the exact functions the editor's
// cost panel calls — and the numbers are asserted, so a renamed price-book
// field breaks this before it breaks a contractor's margin.
import { readFileSync } from "node:fs";
import { costingInputsForInstantTrade } from "@/lib/estimate/instantQuoteCosting";
import { tradeLabourHours, buildTradeLineItems } from "@/lib/pricing/tradeScope";
import { quoteCostSummary } from "@/lib/costing/quoteCosting";
import { INSTANT_ESTIMATE_TRADES } from "@/lib/estimate/instantEstimate";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const summary = (cat, takeoff, intakeValues) =>
  quoteCostSummary({ scopeGroups: [{ categoryKey: cat, label: cat, takeoff, intakeValues: intakeValues || {} }], price: 5000, labourRate: 35, overheadPct: 10 });

console.log("\n1. Every instant trade maps to something the editor can read\n");
const covered = new Set();
const cases = {
  roofing: ["roofing_service", "asphalt_shingles", { areaSqft: 2200, squares: 22, predominantPitch: { rise: 6 }, tearOffLayers: 1 }],
  flooring: ["flooring", "oak", { areaSqft: 850, surfaceCondition: "fair" }],
  stair: ["stairs", null, { treads: 13, railingFt: 14 }],
  painting: ["interior_painting", null, { areaSqft: 1200, scope: "interior", surfaceCondition: "good" }],
  cabinet_refinishing: ["cabinet_refinishing", null, { doorCount: 24, drawerCount: 10, woodSpecies: "oak" }],
  cabinet_refacing: ["cabinet_refacing", null, { doorCount: 24, drawerCount: 10, boxLinearFt: 20 }],
  countertop: ["countertop", "quartz", { areaSqft: 40, edgeFt: 12, cutouts: 1 }],
  epoxy: ["epoxy", "flake", { areaSqft: 500, surfaceCondition: "good" }],
  parging: ["parging", null, { areaSqft: 300, condition: "minor_repair", access: "ground" }],
  lawn_mowing: ["lawn_mowing", null, { areaSqft: 6000 }],
  junk_removal: ["junk_removal", null, { items: [{ key: "sofa", qty: 1 }], jobType: "single_items" }],
  gutters: ["gutter_services", null, { gutterFt: 184, downspouts: 6, trustworthy: true, imagery: { date: "2024-07-29", year: 2024, quality: "HIGH" }, basis: "eave", flags: [] }],
};
for (const trade of Object.keys(INSTANT_ESTIMATE_TRADES)) {
  const c = cases[trade];
  ok(Boolean(c), `${trade}: this check has a case for it`);
  if (!c) continue;
  const [cat, mat, m] = c;
  const { takeoff, intakeValues } = costingInputsForInstantTrade(trade, mat, m, { categoryKey: cat });
  ok(takeoff || intakeValues, `${trade}: the measurement reaches the group as a takeoff or intake values`);
  covered.add(trade);
}

console.log("\n2. The trades the builder can cost from a takeoff produce hours and materials\n");
{
  const r = costingInputsForInstantTrade("roofing", "asphalt_shingles", cases.roofing[2], { categoryKey: "roofing_service" });
  const s = summary("roofing_service", r.takeoff, null);
  ok(tradeLabourHours("roofing_service", r.takeoff, null) > 0, "roofing: labour hours from squares and pitch", tradeLabourHours("roofing_service", r.takeoff, null));
  ok(s.materialTotal > 0 && s.labourHours > 0, "…and the cost summary carries hours and materials", { h: s.labourHours, m: s.materialTotal });
  ok(r.takeoff.layers === 1 && r.takeoff.materialKey === "asphalt_shingles" && r.takeoff.measuredFrom === "satellite", "…with tear-off layers, the material and where it was measured from", r.takeoff);

  const pi = costingInputsForInstantTrade("painting", null, cases.painting[2], { categoryKey: "interior_painting" });
  const si = summary("interior_painting", pi.takeoff, null);
  ok(pi.takeoff.model === "area_substrate" && pi.takeoff.areas[0].surfaceSqft === 1200 && pi.takeoff.areas[0].substrates[0].key === "walls", "interior painting: one measured surface of walls", pi.takeoff.areas[0]);
  ok(si.labourHours > 0 && si.materialTotal > 0, "…and it costs to hours and gallons", { h: si.labourHours, m: si.materialTotal });
  const pe = costingInputsForInstantTrade("painting", null, { areaSqft: 1800, scope: "exterior" }, { categoryKey: "exterior_painting" });
  const se = summary("exterior_painting", pe.takeoff, null);
  ok(pe.takeoff.areas[0].surface === "exterior" && pe.takeoff.areas[0].substrates[0].key === "siding_trim", "exterior painting: siding & trim on an exterior area");
  ok(se.labourHours > 0 && se.materialTotal > 0, "…and it costs", { h: se.labourHours, m: se.materialTotal });
  const scopeWins = costingInputsForInstantTrade("painting", null, { areaSqft: 100, scope: "exterior" }, { categoryKey: "interior_painting" });
  ok(scopeWins.takeoff.areas[0].surface === "exterior", "the homeowner's stated scope decides interior/exterior when it is given");

  const cab = costingInputsForInstantTrade("cabinet_refinishing", null, cases.cabinet_refinishing[2], { categoryKey: "cabinet_refinishing" });
  const sc = summary("cabinet_refinishing", null, cab.intakeValues);
  ok(cab.takeoff === null && cab.intakeValues.doorCount === 24 && cab.intakeValues.woodSpecies === "oak", "cabinets: doors, drawers and species as intake values (unit-priced, not a takeoff)");
  ok(sc.labourHours > 0 && sc.materialTotal > 0, "…and the recipe costs them", { h: sc.labourHours, m: sc.materialTotal });
}

console.log("\n3. Takeoff trades with no productivity figure still get their takeoff lines\n");
{
  const f = costingInputsForInstantTrade("flooring", "oak", cases.flooring[2], { categoryKey: "flooring" });
  ok(f.takeoff.sections[0].sqft === 850 && f.takeoff.sections[0].complexityLevel === "moderate", "flooring: one section with the area and 'fair' → moderate", f.takeoff);
  ok(buildTradeLineItems("flooring", f.takeoff, null).length >= 1, "…and the price book builds a line from it");
  const st = costingInputsForInstantTrade("stair", null, cases.stair[2], { categoryKey: "stairs" });
  ok(st.takeoff.sections[0].treads === 13 && st.takeoff.sections[0].handrailFt === 14, "stairs: treads and railing feet", st.takeoff);
  ok(buildTradeLineItems("stairs", st.takeoff, null).length >= 2, "…and the book builds tread and railing lines");
  const g = costingInputsForInstantTrade("gutters", null, cases.gutters[2], { categoryKey: "gutter_services" });
  ok(g.takeoff.workType === "replacement" && g.takeoff.gutterFt === 184 && g.takeoff.downspoutsInstalled === 6, "gutters: a replacement of 184 ft with 6 downspouts", g.takeoff);
  const gl = buildTradeLineItems("gutter_services", g.takeoff, null);
  ok(gl.some((l) => l.quantity === 184) && gl.some((l) => l.quantity === 6), "…and the gutter book prices the run and the downspouts", gl.map((l) => [l.description, l.quantity]));
}

console.log("\n4. Nothing invented\n");
{
  ok(costingInputsForInstantTrade("flooring", null, { areaSqft: 0 }).takeoff === null, "zero area → no takeoff");
  ok(costingInputsForInstantTrade("stair", null, {}).takeoff === null, "no treads → no takeoff");
  ok(costingInputsForInstantTrade("painting", null, { scope: "interior" }).takeoff === null, "no area → no paint takeoff");
  const r = costingInputsForInstantTrade("roofing", null, { areaSqft: 2000 });
  ok(!("pitchRise" in r.takeoff) && !("layers" in r.takeoff), "roofing without a pitch or layers leaves both absent, never 0", r.takeoff);
  ok(costingInputsForInstantTrade("nothing", null, { areaSqft: 5 }).takeoff === null, "an unknown trade maps to nothing");
}

console.log("\n5. The draft stores it on the group\n");
{
  const src = readFileSync("lib/estimate/createEstimateQuote.js", "utf8").replace(/\/\/.*$/gm, "");
  ok(/\.\.\.\(groupTakeoff && \{ takeoff: groupTakeoff \}\)/.test(src) && /\.\.\.\(groupIntake && \{ intakeValues: groupIntake \}\)/.test(src), "createEstimateDraft writes takeoff and intakeValues onto the scope group");
  ok(/categoryKey: category\?\.key \|\| null/.test(src), "…and hands the category key to the mapping (painting needs it)");
  ok(/lineItems,\s*subtotal: estimate\.point \|\| 0/.test(src), "…while the lines and the price stay the homeowner's breakdown");
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
