// Flooring + Painting: area × material with percentage surcharges, through the
// same computeInstantEstimate path. Pure.
import {
  computeInstantEstimate, INSTANT_ESTIMATE_TRADES, INSTANT_ESTIMATE_DEFAULTS,
} from "@/lib/estimate/instantEstimate";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

const floorCfg = { ...INSTANT_ESTIMATE_DEFAULTS.flooring, enabled: true };
const paintCfg = { ...INSTANT_ESTIMATE_DEFAULTS.painting, enabled: true };
const est = (trade, measurements, materialKey, config) => computeInstantEstimate({ trade, measurements, materialKey, config });

console.log("\nRegistry");
ok("flooring registered, manual_area, hasMaterials", INSTANT_ESTIMATE_TRADES.flooring?.measure === "manual_area" && INSTANT_ESTIMATE_TRADES.flooring.hasMaterials);
ok("painting registered, manual_area, hasMaterials", INSTANT_ESTIMATE_TRADES.painting?.measure === "manual_area" && INSTANT_ESTIMATE_TRADES.painting.hasMaterials);

console.log("\nFlooring");
const f = est("flooring", { areaSqft: 500, surfaceCondition: "good" }, "laminate", floorCfg);
ok("500 sqft laminate ok, range ordered", f.ok && f.low <= f.point && f.point <= f.high, f);
ok("500 × $4.5 = ~$2250", Math.abs(f.point - 2250) < 20, f.point);
const fPrep = est("flooring", { areaSqft: 500, surfaceCondition: "poor" }, "laminate", floorCfg).point;
ok("tear-out (poor) costs more than bare (good)", fPrep > f.point, { good: f.point, poor: fPrep });
ok("hardwood > carpet same area", est("flooring", { areaSqft: 500 }, "hardwood", floorCfg).point > est("flooring", { areaSqft: 500 }, "carpet", floorCfg).point);
ok("zero area -> ok:false", est("flooring", { areaSqft: 0 }, "laminate", floorCfg).ok === false);

console.log("\nPainting");
const p = est("painting", { areaSqft: 1000, scope: "interior", surfaceCondition: "good" }, "standard", paintCfg);
ok("1000 sqft interior standard ok", p.ok && p.point > 0, p);
ok("1000 × $2.75 = ~$2750", Math.abs(p.point - 2750) < 25, p.point);
const pExt = est("painting", { areaSqft: 1000, scope: "exterior", surfaceCondition: "good" }, "standard", paintCfg).point;
ok("exterior costs more than interior (30% scope surcharge)", pExt > p.point, { interior: p.point, exterior: pExt });
ok("exterior is ~30% over interior base", Math.abs(pExt - p.point * 1.3) < 30, { interior: p.point, exterior: pExt });
const pPoor = est("painting", { areaSqft: 1000, scope: "interior", surfaceCondition: "poor" }, "premium", paintCfg).point;
ok("premium + poor prep is the priciest combo", pPoor > p.point);
ok("both surcharges stack as separate breakdown lines", (() => {
  const r = est("painting", { areaSqft: 1000, scope: "exterior", surfaceCondition: "poor" }, "standard", paintCfg);
  return r.breakdown.some((b) => /scope/i.test(b.label)) && r.breakdown.some((b) => /surface/i.test(b.label));
})());

console.log("\nGates");
ok("flooring no config -> needsConfig", est("flooring", { areaSqft: 500 }, "laminate", null).needsConfig === true);
ok("painting null measurements -> ok:false", est("painting", null, "standard", paintCfg).ok === false);
ok("unknown material falls back to first priced", est("painting", { areaSqft: 100 }, "nope", paintCfg).ok);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
