// Stairs: priced per tread by complexity + railing per ft. The per-tread rate
// is a company material rate, NOT the old hardcoded constant. Pure.
import {
  computeInstantEstimate, INSTANT_ESTIMATE_TRADES, INSTANT_ESTIMATE_DEFAULTS,
} from "@/lib/estimate/instantEstimate";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

const cfg = { ...INSTANT_ESTIMATE_DEFAULTS.stair, enabled: true };
const stair = (measurements, materialKey = "standard", config = cfg) =>
  computeInstantEstimate({ trade: "stair", measurements, materialKey, config });

console.log("\nRegistry + rate key");
ok("stair registered, stair_count measure, hasMaterials", INSTANT_ESTIMATE_TRADES.stair?.measure === "stair_count" && INSTANT_ESTIMATE_TRADES.stair.hasMaterials);
ok("defaults price per tread, not per sqft", INSTANT_ESTIMATE_DEFAULTS.stair.materials.every((m) => m.ratePerTread > 0 && m.ratePerSqft === undefined));

console.log("\nPer-tread pricing");
const s = stair({ treads: 13 });
ok("13 treads standard ok, range ordered", s.ok && s.low <= s.point && s.point <= s.high, s);
ok("13 × $110 = $1430", s.point === 1430, s.point);
ok("complexity tier changes price (open-riser > standard)", stair({ treads: 13 }, "high").point > s.point);
ok("more treads cost more", stair({ treads: 20 }).point > stair({ treads: 10 }).point);

console.log("\nRailing extra");
const noRail = stair({ treads: 13 }).point;
const withRail = stair({ treads: 13, railingFt: 12 }).point;
ok("railing 12ft × $60 = $720 on top", withRail - noRail === 720, { diff: withRail - noRail });
ok("railing is its own breakdown line", stair({ treads: 13, railingFt: 12 }).breakdown.some((b) => /railing/i.test(b.label)));
ok("no railing -> single line", stair({ treads: 13 }).breakdown.length === 1);

console.log("\nGates & hostile input");
ok("no config -> needsConfig", stair({ treads: 13 }, "standard", null).needsConfig === true);
ok("zero treads -> ok:false", stair({ treads: 0 }).ok === false);
ok("null measurements -> ok:false, no throw", stair(null).ok === false);
ok("minimum charge floors a 1-tread job", stair({ treads: 1 }).point >= INSTANT_ESTIMATE_DEFAULTS.stair.minCharge);
ok("tier with 0 rate -> not configured", computeInstantEstimate({ trade: "stair", materialKey: "x", measurements: { treads: 5 }, config: { enabled: true, materials: [{ key: "x", label: "X", ratePerTread: 0 }] } }).ok === false);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
