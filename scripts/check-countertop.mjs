// Countertop wired into the instant-estimate brain. Area-priced by installed
// $/sqft per material, with additive edge / cutout / backsplash extras. Pure.
import {
  computeInstantEstimate, INSTANT_ESTIMATE_TRADES, INSTANT_ESTIMATE_DEFAULTS,
  estimateCountertop,
} from "@/lib/estimate/instantEstimate";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

const cfg = { ...INSTANT_ESTIMATE_DEFAULTS.countertop, enabled: true };
const ct = (measurements, materialKey = "quartz") =>
  computeInstantEstimate({ trade: "countertop", measurements, materialKey, config: cfg });

console.log("\nRegistry");
ok("countertop registered", !!INSTANT_ESTIMATE_TRADES.countertop);
ok("measure is manual_area (reuses the area branch)", INSTANT_ESTIMATE_TRADES.countertop.measure === "manual_area");
ok("has materials", INSTANT_ESTIMATE_TRADES.countertop.hasMaterials === true);
ok("seeded defaults have priced materials", INSTANT_ESTIMATE_DEFAULTS.countertop.materials.every((m) => m.ratePerSqft > 0));

console.log("\nBasic quote: 40 sqft quartz");
const e = ct({ areaSqft: 40 });
ok("ok, low ≤ point ≤ high", e.ok && e.low <= e.point && e.point <= e.high, e);
ok("40 sqft × $80 quartz = ~$3200 point", Math.abs(e.point - 3200) <= 3200 * 0.001 + 10, e.point);
ok("breakdown names the material", e.breakdown[0].label.includes("quartz") || e.breakdown[0].label.includes("Quartz"), e.breakdown[0]);

console.log("\nMaterial choice changes the price");
const laminate = ct({ areaSqft: 40 }, "laminate").point;
const marble = ct({ areaSqft: 40 }, "marble").point;
ok("marble > laminate for the same area", marble > laminate, { laminate, marble });
ok("unknown material falls back to first, still prices", ct({ areaSqft: 40 }, "unobtanium").ok);

console.log("\nAdditive extras");
const bare = ct({ areaSqft: 40 }).point;
const withEdge = ct({ areaSqft: 40, edgeFt: 20 }).point;
const withCut = ct({ areaSqft: 40, cutouts: 2 }).point;
const withBack = ct({ areaSqft: 40, backsplashSqft: 15 }).point;
ok("edge adds 20ft × $12 = $240", withEdge - bare === 240, { diff: withEdge - bare });
ok("cutouts add 2 × $100 = $200", withCut - bare === 200, { diff: withCut - bare });
ok("backsplash adds 15 × $40 = $600", withBack - bare === 600, { diff: withBack - bare });
ok("extras appear as their own breakdown lines", (() => {
  const r = ct({ areaSqft: 40, edgeFt: 20, cutouts: 1, backsplashSqft: 10 });
  return r.breakdown.some((b) => /edge/i.test(b.label)) && r.breakdown.some((b) => /cutout/i.test(b.label)) && r.breakdown.some((b) => /backsplash/i.test(b.label));
})());
ok("zero extras add no lines", ct({ areaSqft: 40 }).breakdown.length === 1);

console.log("\nGates & hostile input");
ok("no config -> needsConfig", computeInstantEstimate({ trade: "countertop", materialKey: "quartz", measurements: { areaSqft: 40 }, config: null }).needsConfig === true);
ok("zero area -> ok:false", ct({ areaSqft: 0 }).ok === false);
ok("negative area -> ok:false", ct({ areaSqft: -10 }).ok === false);
ok("null measurements -> ok:false, no throw", ct(null).ok === false);
ok("negative extras clamp to 0 (no negative line)", estimateCountertop({ areaSqft: 40, edgeFt: -5, cutouts: -2 }, "quartz", cfg).point === bare, estimateCountertop({ areaSqft: 40, edgeFt: -5 }, "quartz", cfg).point);
ok("minimum charge floors a tiny job", ct({ areaSqft: 1 }, "laminate").point >= INSTANT_ESTIMATE_DEFAULTS.countertop.minCharge);
ok("material with 0 rate -> not configured", computeInstantEstimate({ trade: "countertop", materialKey: "x", measurements: { areaSqft: 40 }, config: { enabled: true, materials: [{ key: "x", label: "X", ratePerSqft: 0 }] } }).ok === false);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
