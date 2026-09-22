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

console.log("\nPer-tread pricing, plus the rest of the staircase from the step count");
// Treads are one line of five now: the risers, balusters, posts and handrail
// come from the step count and shape (lib/estimate/stairsFromSteps.js — the
// owner's "2 balusters a step, 4 to 5 posts") at the seed's own rates. 13
// steps, L by default: 13 treads × $110 + 15 risers × $25 + 26 balusters × $25
// + 4 posts × $150 + round(13 × 11 / 12 + 3) = 15 ft × $60.
//
// 15 risers, not 13: a flight has one more riser than tread (the top riser
// rises to the landing, which is not a tread) and an L is two flights.
const s = stair({ treads: 13 });
ok("13 treads standard ok, range ordered", s.ok && s.low <= s.point && s.point <= s.high, s);
ok("13 steps, L: 1430 + 375 + 650 + 600 + 900 = $3955, rounded to the $10 the range speaks in", s.point === 3960, s.point);
ok("treads line is 13 × $110 = $1430", s.breakdown[0].amount === 1430, s.breakdown[0]);
ok("five lines: treads, risers, balusters, posts, handrail", s.breakdown.length === 5, s.breakdown.map((b) => b.label));
ok("the handrail is estimated from the run when none was typed", /Handrail \(15 ft\)/.test(s.breakdown[4].label), s.breakdown[4]);
ok("complexity tier changes price (open-riser > standard)", stair({ treads: 13 }, "high").point > s.point);
ok("more treads cost more", stair({ treads: 20 }).point > stair({ treads: 10 }).point);
// A U over a straight run: three more newel posts, six more feet of rail —
// and two more risers, because a U is three flights against a straight run's
// one and every flight carries its own top riser.
ok(
  "a straight stair has 2 posts, a U has 5 — and a U carries two more risers",
  stair({ treads: 13, shape: "U" }).point - stair({ treads: 13, shape: "straight" }).point ===
    3 * 150 + (Math.round((13 * 11) / 12 + 6) - Math.round((13 * 11) / 12)) * 60 + 2 * 25,
);
ok("the assumption says where the counts came from", /estimated from 13 steps, L-shape/.test(s.assumptions[0]), s.assumptions);

console.log("\nRailing typed by the homeowner");
const derivedRail = stair({ treads: 13 }).breakdown[4].amount;
const withRail = stair({ treads: 13, railingFt: 12 });
ok("a typed 12 ft replaces the estimated run: 12 × $60 = $720", withRail.breakdown[4].amount === 720 && derivedRail === 900, { derivedRail, typed: withRail.breakdown[4] });
ok("railing is its own breakdown line", withRail.breakdown.some((b) => /handrail/i.test(b.label)));
ok("a zeroed baluster rate drops the line rather than charging $0", stair({ treads: 13 }, "standard", { ...cfg, balusterPrice: 0 }).breakdown.length === 4);

console.log("\nGates & hostile input");
ok("no config -> needsConfig", stair({ treads: 13 }, "standard", null).needsConfig === true);
ok("zero treads -> ok:false", stair({ treads: 0 }).ok === false);
ok("null measurements -> ok:false, no throw", stair(null).ok === false);
ok("minimum charge floors a 1-tread job", stair({ treads: 1 }).point >= INSTANT_ESTIMATE_DEFAULTS.stair.minCharge);
ok("tier with 0 rate -> not configured", computeInstantEstimate({ trade: "stair", materialKey: "x", measurements: { treads: 5 }, config: { enabled: true, materials: [{ key: "x", label: "X", ratePerTread: 0 }] } }).ok === false);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
