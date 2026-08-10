// scripts/check-rewire.mjs
//
//   npm run check:rewire
//
// Executes lib/estimate/rewireTakeoff.js rather than reading it.
//
// This model exists because rewires get quoted off a $/sqft number somebody
// half-remembered, and the assertions below are not style checks — each one
// corresponds to a way the estimate could go quietly wrong:
//
//   * a code constant drifting, so the device count stops matching NEC 210.52
//     and the quote is short by twenty receptacles nobody counted
//   * the sub-linearity collapsing back to a flat multiplier, which over-buys
//     ~25% of the cable on a 3,000 sqft job
//   * the access multipliers losing their order, so a plaster-and-lath rewire
//     prices at open-wall rates — a 2.35× underquote on the largest line
//   * a caller rendering a single confident price from square footage alone,
//     which AGENTS.md forbids: the spread with the four intake facts unknown
//     is 2.3×, so a single number there is a control that appears to work
//   * hostile input (0, negative, absurd, NaN) producing a NEGATIVE or NaN
//     estimate instead of a refusal
//
// The quote-1 reconciliation pins the model to a REAL quote the owner holds:
// 1,461 sqft, 1958, single storey, 3bd/2ba, $21,915 all-in. The residential
// productivity factor was fitted against that one job, so if this assertion
// fails the calibration has drifted away from the only ground truth we have.

import {
  estimateRewire, estimateOpenings, estimateCircuits, estimateWire, estimateLabourHours,
  estimateMaterialCost, buildRoomSchedule, receptaclesForRoom, roomPerimeter,
  deriveAccessClass, missingIntake, getRewireCoefficients,
  NEC_RECEPTACLE_SPACING_FT, NEC_COUNTER_FIRST_SQFT, NEC_COUNTER_ADDITIONAL_SQFT,
  NEC_MANDATORY_CIRCUITS, NEC_GENERAL_LIGHTING_VA_PER_SQFT, NEC_EXTERIOR_RECEPTACLES_MIN,
  ACCESS_MULTIPLIERS, SERVICE_ENTRANCE_COST, REQUIRED_INTAKE, KNOWN_UNKNOWNS,
  REWIRE_COEFFICIENTS, MIN_SQFT, MAX_SQFT,
} from "@/lib/estimate/rewireTakeoff";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};

const full = (o = {}) => ({
  sqft: 1500, bedrooms: 3, baths: 2, storeys: 1,
  wallAccess: "finished", wallConstruction: "drywall", existingWiring: "modern_nm", ...o,
});

// ── 1. NEC-derived counts ────────────────────────────────────────────────
console.log("\nNEC Article 210 — the counts that are law, not preference");

ok("receptacle spacing is 12 ft (210.52(A), the 6-ft rule restated)", NEC_RECEPTACLE_SPACING_FT === 12);
ok("counter rule is 1 per first 9 ft² then 1 per 18 ft² (210.52(C))",
  NEC_COUNTER_FIRST_SQFT === 9 && NEC_COUNTER_ADDITIONAL_SQFT === 18);
ok("general lighting load is 3 VA/sqft (220.12)", NEC_GENERAL_LIGHTING_VA_PER_SQFT === 3);
ok("exterior minimum is 2, front and back (210.52(E))", NEC_EXTERIOR_RECEPTACLES_MIN === 2);
ok("mandatory circuits are 2 small-appliance + 1 laundry + 1 bath + 1 garage (210.11(C))",
  NEC_MANDATORY_CIRCUITS.smallAppliance === 2 && NEC_MANDATORY_CIRCUITS.laundry === 1
  && NEC_MANDATORY_CIRCUITS.bathroom === 1 && NEC_MANDATORY_CIRCUITS.garage === 1);

// The 12 ft rule has to actually divide the wall, not just sit in a constant.
const wall24 = receptaclesForRoom({ areaSqft: 36, doors: 0, breaksFt: 0, minimum: 1 }); // perim 24.1
const wall48 = receptaclesForRoom({ areaSqft: 144, doors: 0, breaksFt: 0, minimum: 1 }); // perim 48.3
ok("24 ft of wall -> 3 receptacles (ceil(24.1/12)=3 at the 6-ft rule)", wall24 === 3, wall24);
ok("48 ft of wall -> 5 (doubling wall space roughly doubles receptacles)", wall48 === 5, wall48);
ok("doors reduce wall space, so they reduce the count",
  receptaclesForRoom({ areaSqft: 144, doors: 3, breaksFt: 0, minimum: 1 })
  < receptaclesForRoom({ areaSqft: 144, doors: 0, breaksFt: 0, minimum: 1 }));
ok("habitable rooms floor at 2 — one receptacle fails the 6-ft rule on any real wall",
  receptaclesForRoom({ areaSqft: 4, doors: 1, breaksFt: 99 }) === 2);
ok("perimeter of a 144 ft² room is ~48 ft (matches a real 12×12)",
  Math.abs(roomPerimeter(144) - 48) < 1, roomPerimeter(144));

const o15 = estimateOpenings(full());
// counter area = max(24, 0.02×1500) = 30 ft²  ->  1 + ceil((30-9)/18) = 3
ok("1,500 sqft kitchen counter -> 3 receptacles by the 9/18 rule", o15.counterReceptacles === 3, o15.counterReceptacles);
// counter area = max(24, 0.02×1000) = 24 ft²  ->  1 + ceil((24-9)/18) = 2
ok("1,000 sqft kitchen counter -> 2 receptacles", estimateOpenings(full({ sqft: 1000 })).counterReceptacles === 2);
ok("exterior receptacles never below the code floor of 2",
  [600, 1000, 1500, 3000].every((s) => estimateOpenings(full({ sqft: s })).exteriorReceptacles >= 2));
ok("smoke/CO = 1 per bedroom + 1 per storey + 1 outside sleeping area",
  estimateOpenings(full({ bedrooms: 3, storeys: 2 })).smokeCo === 3 + 2 + 1);
ok("every bathroom gets at least one receptacle (210.52(D))",
  buildRoomSchedule({ sqft: 1500, bedrooms: 3, baths: 3 })
    .filter((r) => /bath/i.test(r.name)).every((r) => r.fixedReceptacles >= 1));

const c15 = estimateCircuits({ sqft: 1500, garage: true });
const c15NoGarage = estimateCircuits({ sqft: 1500, garage: false });
ok("general lighting circuits = ceil(sqft × 3 VA / 120 / 15) — 1,500 sqft -> 3",
  c15.generalLighting === 3, c15.generalLighting);
ok("2,000 sqft -> 4 general lighting circuits", estimateCircuits({ sqft: 2000 }).generalLighting === 4);
ok("mandatory circuits are counted on top of the load calc, not inside it",
  c15.circuits - c15.generalLighting - c15.dedicated - c15.spares === c15.mandatory);
ok("no garage removes exactly one mandatory circuit", c15.circuits - c15NoGarage.circuits === 1);
ok("panel is sized on poles and reported with a label", /\d+ A \/ \d+ space/.test(c15.panelLabel), c15.panelLabel);

// ── 2. Sub-linearity ─────────────────────────────────────────────────────
console.log("\nSub-linearity — cable follows wall perimeter, not floor area");

const sweep = [1000, 1500, 2000, 2500, 3000].map((s) => {
  const r = estimateRewire(full({ sqft: s, bedrooms: undefined, baths: undefined }));
  return { sqft: s, ftPerSqft: r.wire.feetPerSqft, openPer100: r.openings.openingsPer100Sqft, total: r.typical };
});
ok("cable ft/sqft falls monotonically as the house grows",
  sweep.every((row, i) => i === 0 || row.ftPerSqft < sweep[i - 1].ftPerSqft),
  sweep.map((r) => `${r.sqft}:${r.ftPerSqft}`));
ok("openings per 100 sqft falls too (same mechanism)",
  sweep[sweep.length - 1].openPer100 < sweep[0].openPer100,
  { at1000: sweep[0].openPer100, at3000: sweep[sweep.length - 1].openPer100 });
ok("3,000 sqft needs meaningfully less cable per sqft than 1,000 (>20% less)",
  sweep[4].ftPerSqft < sweep[0].ftPerSqft * 0.80,
  { at1000: sweep[0].ftPerSqft, at3000: sweep[4].ftPerSqft });
ok("but total cable still RISES with size — sub-linear is not shrinking",
  sweep.every((row, i) => i === 0 || row.total > sweep[i - 1].total));
ok("cable stays inside the published 1.5–2.1 ft/sqft band up to 2,000 sqft",
  sweep.slice(0, 3).every((r) => r.ftPerSqft >= 1.5 && r.ftPerSqft <= 2.1),
  sweep.slice(0, 3).map((r) => r.ftPerSqft));

// Direction alone is too weak an assertion: mutation-testing showed that
// removing the room-area caps entirely still leaves ft/sqft falling, because
// perimeter ∝ √area does most of the work. So pin the DEGREE of sub-linearity,
// not just its sign — these two bands are what actually detect the schedule
// being changed underneath the model.
const exponent = (lo, hi, pick) =>
  Math.log(pick(estimateRewire(full({ sqft: hi, bedrooms: undefined, baths: undefined })))
    / pick(estimateRewire(full({ sqft: lo, bedrooms: undefined, baths: undefined })))) / Math.log(hi / lo);
const kOpenings = exponent(1000, 3000, (r) => r.openings.openings);
const kWire = exponent(1000, 3000, (r) => r.wire.totalFt);
ok("openings scale as sqft^0.66–0.76 (shipped ≈0.71)",
  kOpenings > 0.66 && kOpenings < 0.76, Math.round(kOpenings * 1000) / 1000);
ok("cable scales as sqft^0.58–0.66 (shipped ≈0.62)",
  kWire > 0.58 && kWire < 0.66, Math.round(kWire * 1000) / 1000);
ok("room areas are capped, so a 3,000 sqft home gets more rooms not vaster ones",
  buildRoomSchedule({ sqft: 3000, bedrooms: 4, baths: 3 }).every((r) => r.areaSqft <= 360)
  && buildRoomSchedule({ sqft: 3000, bedrooms: 4, baths: 3 }).length
     > buildRoomSchedule({ sqft: 1000, bedrooms: 2, baths: 1 }).length);
ok("waste is applied — total ft exceeds raw ft",
  estimateRewire(full()).wire.totalFt > estimateRewire(full()).wire.rawFt);
ok("open walls waste less cable than fished (offcuts are unusable on old work)",
  estimateRewire(full({ wallAccess: "open" })).wire.wasteFactor
  < estimateRewire(full({ wallAccess: "finished" })).wire.wasteFactor);
ok("gauge split sums to the total footage",
  (() => { const w = estimateRewire(full()).wire;
    return Math.abs(w.byType.reduce((s, t) => s + t.feet, 0) - w.totalFt) <= w.byType.length; })());
ok("split B (all-20A) costs more cable than split A (14 AWG lighting)",
  estimateRewire(full({ overrides: { cableSplit: "B" } })).wire.cost
  > estimateRewire(full({ overrides: { cableSplit: "A" } })).wire.cost);

// ── 3. Access multipliers ────────────────────────────────────────────────
console.log("\nAccess multipliers — the largest lever in the model");

const order = ["open_walls", "light_reno", "fished_drywall", "plaster_lath", "knob_tube_historic"];
ok("multipliers are strictly increasing in difficulty",
  order.every((k, i) => i === 0 || ACCESS_MULTIPLIERS[k] > ACCESS_MULTIPLIERS[order[i - 1]]),
  order.map((k) => `${k}:${ACCESS_MULTIPLIERS[k]}`));
ok("open walls is the 1.0 base (NECA units are new-construction)", ACCESS_MULTIPLIERS.open_walls === 1);
ok("worst case is ~2.9× best — the spread the intake gate exists to resolve",
  Math.abs(ACCESS_MULTIPLIERS.knob_tube_historic / ACCESS_MULTIPLIERS.open_walls - 2.9) < 0.01);

const o = estimateOpenings(full()), ci = estimateCircuits({ sqft: 1500 });
const hoursFor = (a) => estimateLabourHours({ openings: o, circuits: ci, accessClass: a, storeys: 1 })?.totalHours;
ok("labour hours rise with access difficulty, in the same order",
  order.every((k, i) => i === 0 || hoursFor(k) > hoursFor(order[i - 1])),
  order.map((k) => `${k}:${hoursFor(k)}`));
ok("an unknown access class returns null rather than defaulting to the cheap one",
  estimateLabourHours({ openings: o, circuits: ci, accessClass: "sunshine", storeys: 1 }) === null);
ok("a missing access class returns null too", estimateLabourHours({ openings: o, circuits: ci }) === null);
ok("rough-in + trim + panel add up to total hours", (() => {
  const l = estimateLabourHours({ openings: o, circuits: ci, accessClass: "fished_drywall", storeys: 1 });
  return Math.abs(l.roughInHours + l.trimOutHours + l.panelHours - l.totalHours) < 0.3;
})());
ok("trim-out is ~29% of rough+trim (40% of rough-in)", (() => {
  const l = estimateLabourHours({ openings: o, circuits: ci, accessClass: "fished_drywall", storeys: 1 });
  return Math.abs(l.trimOutHours / (l.roughInHours + l.trimOutHours) - 0.2857) < 0.01;
})());
ok("a second storey adds labour", hoursFor("fished_drywall")
  < estimateLabourHours({ openings: o, circuits: ci, accessClass: "fished_drywall", storeys: 2 }).totalHours);

console.log("\nAccess class derivation");
ok("open walls -> open_walls regardless of what's in them",
  deriveAccessClass({ wallAccess: "open", wallConstruction: "plaster_lath", existingWiring: "knob_tube" }) === "open_walls");
ok("partial -> light_reno", deriveAccessClass({ wallAccess: "partial", wallConstruction: "drywall", existingWiring: "modern_nm" }) === "light_reno");
ok("finished + drywall + modern -> fished_drywall",
  deriveAccessClass({ wallAccess: "finished", wallConstruction: "drywall", existingWiring: "modern_nm" }) === "fished_drywall");
ok("finished + plaster -> plaster_lath",
  deriveAccessClass({ wallAccess: "finished", wallConstruction: "plaster_lath", existingWiring: "modern_nm" }) === "plaster_lath");
ok("knob & tube wins over plaster — worst condition, not the average",
  deriveAccessClass({ wallAccess: "finished", wallConstruction: "plaster_lath", existingWiring: "knob_tube" }) === "knob_tube_historic");

// ── 4. The intake gate ───────────────────────────────────────────────────
console.log("\nIntake gate — no single price without the four facts");

const gated = estimateRewire({ sqft: 1500 });
ok("no intake at all -> needsIntake lists all four", gated.needsIntake.length === 4,
  gated.needsIntake.map((n) => n.key));
ok("no intake -> typical is NULL, so a UI cannot render one number", gated.typical === null);
ok("but a bracketing range is still returned", gated.low > 0 && gated.high > gated.low);
ok("the gated spread is wide enough to be obviously unquotable (>2×)", gated.high / gated.low > 2, gated.spread);
ok("gated result still shows every access class so the estimator can see the fork",
  Array.isArray(gated.byAccessClass) && gated.byAccessClass.length === 5);
ok("each required intake entry carries the question to ask",
  REQUIRED_INTAKE.every((e) => typeof e.question === "string" && e.question.length > 10));

for (const key of ["wallAccess", "wallConstruction", "existingWiring", "storeys"]) {
  const partial = full(); delete partial[key];
  const r = estimateRewire(partial);
  ok(`missing ${key} alone -> needsIntake, typical null`,
    r.needsIntake.some((n) => n.key === key) && r.typical === null, { needs: r.needsIntake.map((n) => n.key), typical: r.typical });
}
ok("an INVALID enum counts as missing, not as a silent fallback",
  estimateRewire(full({ wallAccess: "sort of open" })).typical === null);
ok("all four supplied -> a typical price exists", estimateRewire(full()).typical > 0);
ok("a fully specified estimate still returns low<typical<high", (() => {
  const r = estimateRewire(full()); return r.low < r.typical && r.typical < r.high;
})());
ok("missingIntake() agrees with estimateRewire's gate",
  missingIntake({ wallAccess: "finished", wallConstruction: "drywall", existingWiring: "modern_nm", storeys: 1 }).length === 0);
ok("unknowns are surfaced on every result, gated or not",
  gated.unknowns.length === KNOWN_UNKNOWNS.length && estimateRewire(full()).unknowns.length === KNOWN_UNKNOWNS.length);
ok("the six things the model cannot know are all named",
  ["asbestosOrLead", "atticAccess", "floorAccess", "panelLocation", "wallRepair", "historicDesignation"]
    .every((k) => KNOWN_UNKNOWNS.some((u) => u.key === k)));

// ── 5. Quote-1 reconciliation ────────────────────────────────────────────
console.log("\nReconciliation against the real 1,461 sqft quote ($21,915)");

const q1 = estimateRewire({
  sqft: 1461, bedrooms: 3, baths: 2, storeys: 1,
  wallAccess: "finished", wallConstruction: "drywall", existingWiring: "cloth_braid",
});
ok("~113 openings", Math.abs(q1.openings.openings - 113) <= 3, q1.openings.openings);
ok("~105 crew-hours", Math.abs(q1.labour.totalHours - 105) <= 8, q1.labour.totalHours);
ok("~$194 per opening (mid-band of the published $100–300)",
  Math.abs(q1.perOpening - 194) <= 10, q1.perOpening);
ok("~$15.00 per sqft", Math.abs(q1.perSqft - 15) <= 0.75, q1.perSqft);
ok("typical lands within 3% of the real $21,915",
  Math.abs(q1.typical - 21915) / 21915 < 0.03, q1.typical);
ok("~19 circuits", Math.abs(q1.circuits.circuits - 19) <= 2, q1.circuits.circuits);
ok("~2,600 ft of cable", Math.abs(q1.wire.totalFt - 2600) <= 200, q1.wire.totalFt);
ok("hours per opening ≈ 0.93 for a fished drywall rewire",
  Math.abs(q1.labour.hoursPerOpening - 0.93) <= 0.08, q1.labour.hoursPerOpening);
ok("per-opening price sits inside the published $100–300 band",
  q1.perOpening >= 100 && q1.perOpening <= 300, q1.perOpening);

// ── 6. The service-entrance line ─────────────────────────────────────────
console.log("\nService entrance — its own line, defaulting off");

const noSvc = estimateRewire(full()), withSvc = estimateRewire(full({ includeServiceEntrance: true }));
ok("defaults OFF", noSvc.serviceEntrance === null);
ok("off -> an assumption says so, in words", noSvc.assumptions.some((a) => /service entrance/i.test(a)));
ok("on -> carries the researched $3,000–6,000 range",
  withSvc.serviceEntrance.low === 3000 && withSvc.serviceEntrance.high === 6000);
ok("on -> adds its typical to the price, not a $/sqft uplift",
  withSvc.typical - noSvc.typical === SERVICE_ENTRANCE_COST.typical,
  { delta: withSvc.typical - noSvc.typical });
ok("enabling it does not change device, circuit or cable counts (it is not area-scaled)",
  withSvc.openings.openings === noSvc.openings.openings
  && withSvc.circuits.circuits === noSvc.circuits.circuits
  && withSvc.wire.totalFt === noSvc.wire.totalFt);
ok("it is absent from the material lines — a separate line, not folded in",
  !noSvc.material.lines.some((l) => /service|mast|meter/i.test(l.label)));

// ── 7. Hostile input ─────────────────────────────────────────────────────
console.log("\nHostile input — refusal, never a negative or NaN price");

const hostile = [
  ["zero sqft", { sqft: 0 }],
  ["negative sqft", { sqft: -1500 }],
  ["absurd sqft", { sqft: 1e9 }],
  ["below the calibrated floor", { sqft: 50 }],
  ["above the calibrated ceiling", { sqft: 50000 }],
  ["NaN sqft", { sqft: NaN }],
  ["Infinity sqft", { sqft: Infinity }],
  ["null sqft", { sqft: null }],
  ["undefined sqft", { sqft: undefined }],
  ["string sqft", { sqft: "fifteen hundred" }],
  ["object sqft", { sqft: { evil: true } }],
  ["no input at all", {}],
];
for (const [name, input] of hostile) {
  const r = estimateRewire({ ...input, wallAccess: "finished", wallConstruction: "drywall", existingWiring: "modern_nm", storeys: 1 });
  ok(`${name} -> ok:false with a reason, no price`,
    r.ok === false && r.typical === null && r.low === null && typeof r.reason === "string",
    { ok: r.ok, typical: r.typical, reason: r.reason });
}
ok("the calibrated band is stated on the refusal so the caller knows why",
  estimateRewire({ sqft: 50000 }).reason.includes(String(MAX_SQFT))
  && estimateRewire({ sqft: 50 }).reason.includes(String(MIN_SQFT)));

console.log("\nMissing bedrooms/baths — inferred, but never silently");
const noBd = estimateRewire(full({ bedrooms: undefined, baths: undefined }));
ok("still prices", noBd.ok && noBd.typical > 0);
ok("says it assumed a bedroom count", noBd.assumptions.some((a) => /bedroom/i.test(a)));
ok("says it assumed a bathroom count", noBd.assumptions.some((a) => /bathroom/i.test(a)));
ok("hostile bedroom counts don't produce NaN", (() => {
  return [-5, NaN, "three", null, 1e6, Infinity, { x: 1 }].every((b) => {
    const r = estimateRewire(full({ bedrooms: b }));
    return r.ok && Number.isFinite(r.typical) && r.typical > 0;
  });
})());
ok("hostile storeys don't produce NaN or a negative",
  [-2, NaN, "two", 1e6].every((s) => {
    const r = estimateRewire(full({ storeys: s }));
    return r.typical === null || (Number.isFinite(r.typical) && r.typical > 0);
  }));
ok("every returned money value is a finite non-negative number", (() => {
  const r = estimateRewire(full({ includeServiceEntrance: true }));
  const nums = [r.low, r.typical, r.high, r.perOpening, r.perSqft, r.material.total, r.wire.cost,
    ...r.material.lines.map((l) => l.cost), ...r.wire.byType.map((t) => t.cost)];
  return nums.every((n) => Number.isFinite(n) && n >= 0);
})());
ok("hostile coefficient overrides fall back rather than poisoning the price", (() => {
  const r = estimateRewire(full({ overrides: { deviceHopFt: -50, residentialProductivityFactor: NaN, labourRatePerHour: "free" } }));
  return r.ok && Number.isFinite(r.typical) && r.typical > 0;
})());

// ── 8. Company overrides ─────────────────────────────────────────────────
console.log("\nCompany overrides (mirrors getRecipe in materialRecipes.js)");
ok("no overrides returns the shared defaults object", getRewireCoefficients() === REWIRE_COEFFICIENTS);
ok("empty overrides returns the shared defaults too", getRewireCoefficients({}) === REWIRE_COEFFICIENTS);
ok("a flat override applies", getRewireCoefficients({ deviceHopFt: 20 }).deviceHopFt === 20);
ok("a nested override does not blow away its siblings", (() => {
  const m = getRewireCoefficients({ roughInMinutes: { receptacle: 99 } }).roughInMinutes;
  return m.receptacle === 99 && m.switch === REWIRE_COEFFICIENTS.roughInMinutes.switch;
})());
ok("overriding one access multiplier keeps the rest", (() => {
  const a = getRewireCoefficients({ accessMultipliers: { plaster_lath: 3 } }).accessMultipliers;
  return a.plaster_lath === 3 && a.open_walls === 1;
})());
ok("overrides never mutate the shared defaults",
  REWIRE_COEFFICIENTS.deviceHopFt === 12 && REWIRE_COEFFICIENTS.roughInMinutes.receptacle === 35);
ok("a higher labour rate raises the price",
  estimateRewire(full({ labourRatePerHour: 150 })).typical > estimateRewire(full({ labourRatePerHour: 95 })).typical);
ok("bidding tight to code (ratio 1.0) lowers device count and price", (() => {
  const tight = estimateRewire(full({ overrides: { practicalReceptacleRatio: 1.0 } }));
  const std = estimateRewire(full());
  return tight.openings.openings < std.openings.openings && tight.typical < std.typical;
})());

// ── 9. It must not reach a client-facing surface ─────────────────────────
console.log("\nBoundary — internal cost model, never client-facing");

const CLIENT_DIRS = ["app/quote", "app/book", "app/q", "app/portal", "app/site", "app/embed"];
const offenders = [];
const walk = (dir) => {
  let entries; try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(e) && readFileSync(p, "utf8").includes("rewireTakeoff")) offenders.push(p);
  }
};
CLIENT_DIRS.forEach(walk);
ok("no client-facing route imports the takeoff model", offenders.length === 0, offenders);

const src = readFileSync("lib/estimate/rewireTakeoff.js", "utf8");
ok("the module says in words that it is not client-facing", /not?\s*client-facing|Nothing here is client-facing/i.test(src));
ok("every GUESS coefficient is labelled as one", (src.match(/\[GUESS\]/g) || []).length >= 15,
  (src.match(/\[GUESS\]/g) || []).length);
ok("READ, DERIVED and NEC tags all survive in the source",
  /\[READ\]/.test(src) && /\[DERIVED\]/.test(src) && /\[NEC/.test(src));
ok("the single-quote calibration carries its caution", /CAUTION/.test(src));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
