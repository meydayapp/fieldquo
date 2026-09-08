// Flooring + Painting: area × material with percentage surcharges, through the
// same computeInstantEstimate path. Pure.
import {
  computeInstantEstimate, INSTANT_ESTIMATE_TRADES, INSTANT_ESTIMATE_DEFAULTS,
} from "@/lib/estimate/instantEstimate";
import { TRADE_PRICE_BOOKS } from "@/app/data/tradePriceBooks";

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
// The seed is DERIVED from the painting price books (lib/estimate/instantSeed.js):
// base = interior standard-tier wall rate, exterior = standard-tier siding over
// it, condition tiers = the book's moderate/high over standard. Pinned against
// the book, not against literals, so a book edit moves this check with it.
const wallStd = TRADE_PRICE_BOOKS.interior_painting.complexity.standard.wallPricePerSqft;
const sidingStd = TRADE_PRICE_BOOKS.exterior_painting.complexity.standard.siding;
const p = est("painting", { areaSqft: 1000, scope: "interior", surfaceCondition: "good" }, "standard", paintCfg);
ok("1000 sqft interior standard ok", p.ok && p.point > 0, p);
ok("1000 × the book's standard wall rate", Math.abs(p.point - 1000 * wallStd) < 25, { point: p.point, wallStd });
const pExt = est("painting", { areaSqft: 1000, scope: "exterior", surfaceCondition: "good" }, "standard", paintCfg).point;
ok("exterior costs more than interior (siding over walls as the scope surcharge)", pExt > p.point, { interior: p.point, exterior: pExt });
ok("exterior is the book's siding rate over the wall rate", Math.abs(pExt - 1000 * sidingStd) < 30, { exterior: pExt, sidingStd });
const pPoor = est("painting", { areaSqft: 1000, scope: "interior", surfaceCondition: "poor" }, "standard", paintCfg).point;
ok("poor prep is priced above good (the book's high tier over standard)", pPoor > p.point, { good: p.point, poor: pPoor });
ok("the seed carries one grade — the book has no paint grade to invent a second from", paintCfg.materials.length === 1 && paintCfg.materials[0].key === "standard", paintCfg.materials);
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
