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
//   * the CEC branch being removed, bypassed, or fed NEC values — Canada is the
//     primary market, and a Canadian kitchen computed under NEC 210.11(C)(1) is
//     short by one to two circuits and by the whole two-pole AFCI bill
//   * `codeJurisdiction` acquiring a default. Defaulting it to NEC would price
//     every Canadian job under US rules and nothing would ever look wrong
//   * Quebec being computed instead of refused. CSA C22.10 is a different
//     document at a ~2015 vintage; a number here fails an inspection
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
  MANDATORY_CIRCUITS, NEC_GENERAL_LIGHTING_VA_PER_SQFT, NEC_EXTERIOR_RECEPTACLES_MIN,
  CEC_RECEPTACLE_SPACING_FT, CEC_COUNTER_MAX_SPACING_FT, CEC_SPLIT_RECEPTACLES_PER_CIRCUIT,
  CEC_KITCHEN_MIN_CIRCUITS, CEC_LIGHTING_ONLY_CIRCUIT_SHARE, BREAKER_COSTS,
  CODE_JURISDICTIONS, UNSUPPORTED_JURISDICTIONS, SUPPORTED_JURISDICTIONS,
  cecCounterReceptacles, cecKitchenCircuits, counterRunFt, estimateBreakers,
  receptacleSpacingFt, COUNTER_RUN_SHARE_OF_KITCHEN_PERIMETER,
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
  codeJurisdiction: "NEC",
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
  MANDATORY_CIRCUITS.NEC.smallAppliance === 2 && MANDATORY_CIRCUITS.NEC.laundry === 1
  && MANDATORY_CIRCUITS.NEC.bathroom === 1 && MANDATORY_CIRCUITS.NEC.garage === 1);

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

const c15 = estimateCircuits({ sqft: 1500, garage: true, codeJurisdiction: "NEC" });
const c15NoGarage = estimateCircuits({ sqft: 1500, garage: false, codeJurisdiction: "NEC" });
ok("general lighting circuits = ceil(sqft × 3 VA / 120 / 15) — 1,500 sqft -> 3",
  c15.generalLighting === 3, c15.generalLighting);
ok("2,000 sqft -> 4 general lighting circuits", estimateCircuits({ sqft: 2000, codeJurisdiction: "NEC" }).generalLighting === 4);
ok("mandatory circuits are counted on top of the load calc, not inside it",
  c15.circuits - c15.generalLighting - c15.dedicated - c15.spares === c15.mandatory);
ok("no garage removes exactly one mandatory circuit", c15.circuits - c15NoGarage.circuits === 1);
ok("panel is sized on poles and reported with a label", /\d+ A \/ \d+ space/.test(c15.panelLabel), c15.panelLabel);

// ── 2. The Canadian fork ─────────────────────────────────────────────────
//
// Canada is the primary market and the module shipped NEC-only. These
// assertions exist so the CEC branch cannot be deleted, bypassed, or quietly
// fed NEC values, and so a missing jurisdiction can never resolve to a default.
console.log("\nCEC — Canada is the primary market, not a translation of the US one");

// Constants, against docs/estimating-standards-and-licensing.md §1.1, §1.2, §2.2
ok("CEC spacing is 3.6 m ≈ 11.81 ft (26-712(a))",
  Math.abs(CEC_RECEPTACLE_SPACING_FT - 3.6 * 3.28084) < 0.01, CEC_RECEPTACLE_SPACING_FT);
ok("…and is within 2% of the NEC 12 ft figure, which is why the cable model carries over",
  Math.abs(CEC_RECEPTACLE_SPACING_FT - NEC_RECEPTACLE_SPACING_FT) / NEC_RECEPTACLE_SPACING_FT < 0.02,
  (NEC_RECEPTACLE_SPACING_FT - CEC_RECEPTACLE_SPACING_FT) / NEC_RECEPTACLE_SPACING_FT);
ok("CEC counter spacing is 1.8 m ≈ 5.906 ft — twice the 900 mm reach (26-712(d))",
  Math.abs(CEC_COUNTER_MAX_SPACING_FT - 1.8 * 3.28084) < 0.01, CEC_COUNTER_MAX_SPACING_FT);
ok("no more than two split receptacles per multi-wire branch circuit (26-722)",
  CEC_SPLIT_RECEPTACLES_PER_CIRCUIT === 2);
ok("at least two kitchen branch circuits (26-712(d))", CEC_KITCHEN_MIN_CIRCUITS === 2);
ok("the CEC mandatory-circuit table is what sets that floor — it is read, not decoration",
  MANDATORY_CIRCUITS.CEC.kitchenCounter === CEC_KITCHEN_MIN_CIRCUITS
  && cecKitchenCircuits(0) === MANDATORY_CIRCUITS.CEC.kitchenCounter);
ok("mandatory circuits are jurisdiction-keyed, not a universal NEC table",
  MANDATORY_CIRCUITS.NEC.smallAppliance === 2 && MANDATORY_CIRCUITS.CEC.kitchenCounter === 2
  && MANDATORY_CIRCUITS.CEC.smallAppliance === undefined,
  Object.keys(MANDATORY_CIRCUITS));
ok("both supported jurisdictions carry an edition, so a rule number is a citation",
  SUPPORTED_JURISDICTIONS.length === 2
  && SUPPORTED_JURISDICTIONS.every((k) => typeof CODE_JURISDICTIONS[k].edition === "string" && CODE_JURISDICTIONS[k].edition.length > 3),
  SUPPORTED_JURISDICTIONS.map((k) => `${k}:${CODE_JURISDICTIONS[k].edition}`));
ok("breaker prices match Part 3 §3.2 — 2-pole AFCI $195, plain 1-pole $12.98–14.97",
  BREAKER_COSTS.cecAfci2Pole === 195
  && BREAKER_COSTS.cecPlain1Pole >= 12.98 && BREAKER_COSTS.cecPlain1Pole <= 14.97);
ok("every breaker price in the table is read by estimateBreakers — no knob that does nothing",
  (() => {
    const whole = readFileSync("lib/estimate/rewireTakeoff.js", "utf8");
    const start = whole.indexOf("export function estimateBreakers");
    const body = whole.slice(start, whole.indexOf("export function", start + 10));
    return start > 0 && Object.keys(BREAKER_COSTS).every((k) => body.includes(`priceOf("${k}")`));
  })(), Object.keys(BREAKER_COSTS));
ok("a two-pole AFCI is more than 10× a plain single-pole — that is where the money is",
  BREAKER_COSTS.cecAfci2Pole / BREAKER_COSTS.cecPlain1Pole > 10,
  BREAKER_COSTS.cecAfci2Pole / BREAKER_COSTS.cecPlain1Pole);

// The kitchen rule itself — pure functions, hostile input included
ok("8 counter receptacles -> 4 circuits (the worked example in docs §1.2)", cecKitchenCircuits(8) === 4, cecKitchenCircuits(8));
ok("the two-per-circuit cap actually divides: 4->2, 5->3, 6->3, 7->4",
  cecKitchenCircuits(4) === 2 && cecKitchenCircuits(5) === 3 && cecKitchenCircuits(6) === 3 && cecKitchenCircuits(7) === 4);
ok("never below the two-circuit code minimum, whatever the counter looks like",
  [0, 1, 2, -5, NaN, null, undefined, "three", Infinity].every((n) => cecKitchenCircuits(n) === 2),
  [0, 1, 2, -5, NaN].map(cecKitchenCircuits));
ok("counter receptacles divide the run at 1.8 m — 5.9 ft -> 1, 5.95 ft -> 2, 11.9 ft -> 3",
  cecCounterReceptacles(5.9) === 1 && cecCounterReceptacles(5.95) === 2 && cecCounterReceptacles(11.9) === 3,
  [5.9, 5.95, 11.9].map(cecCounterReceptacles));
ok("hostile counter runs return 0, never NaN",
  [0, -12, NaN, null, "long", {}].every((n) => cecCounterReceptacles(n) === 0));
ok("the counter run is floored at the cabinet break the wall-space deduction already assumes",
  counterRunFt(1) === 12 && counterRunFt(0) === 0);
ok("the counter run grows with the kitchen — a share of its own perimeter",
  counterRunFt(60) > counterRunFt(40) && Math.abs(counterRunFt(60) - 60 * COUNTER_RUN_SHARE_OF_KITCHEN_PERIMETER) < 0.01);

// End to end: the same house under each code
const necH = estimateRewire(full());
const cecH = estimateRewire(full({ codeJurisdiction: "CEC" }));
ok("a 1,500 sqft kitchen needs MORE circuits under the CEC than the NEC",
  cecH.circuits.kitchen > necH.circuits.kitchen, { NEC: necH.circuits.kitchen, CEC: cecH.circuits.kitchen });
ok("the NEC kitchen stays at two small-appliance circuits at every size (210.11(C)(1) has no cap)",
  [900, 1500, 2500, 4000].every((s) => estimateRewire(full({ sqft: s, bedrooms: undefined, baths: undefined })).circuits.kitchen === 2));
ok("the CEC kitchen count RISES with the counter run — the split rule is not a constant",
  (() => {
    const k = [900, 1500, 2500, 4000].map((s) => estimateRewire(full({ sqft: s, bedrooms: undefined, baths: undefined, codeJurisdiction: "CEC" })).circuits.kitchen);
    return k[k.length - 1] > k[0] && k.every((v, i) => i === 0 || v >= k[i - 1]);
  })(),
  [900, 1500, 2500, 4000].map((s) => estimateRewire(full({ sqft: s, bedrooms: undefined, baths: undefined, codeJurisdiction: "CEC" })).circuits.kitchen));
ok("total circuit count differs between the codes — the fork reaches the panel",
  cecH.circuits.circuits > necH.circuits.circuits, { NEC: necH.circuits.circuits, CEC: cecH.circuits.circuits });
ok("CEC counter receptacles come from the 1.8 m linear rule, NOT the NEC 9/18 ft² area rule",
  cecH.openings.counterReceptacles === cecCounterReceptacles(cecH.openings.counterRunFt)
  && cecH.openings.counterReceptacles !== necH.openings.counterReceptacles,
  { NEC: necH.openings.counterReceptacles, CEC: cecH.openings.counterReceptacles });
ok("the CEC result carries the CEC spacing, not the NEC one",
  cecH.openings.receptacleSpacingFt === CEC_RECEPTACLE_SPACING_FT
  && necH.openings.receptacleSpacingFt === NEC_RECEPTACLE_SPACING_FT);
ok("receptacleSpacingFt() refuses an unknown jurisdiction rather than returning the US figure",
  receptacleSpacingFt("NEC") === 12 && receptacleSpacingFt("CEC") === CEC_RECEPTACLE_SPACING_FT
  && receptacleSpacingFt("CA") === null && receptacleSpacingFt(undefined) === null);

// Two-pole: the panel has to make room for them
ok("Canadian kitchen circuits are two-pole, so poles exceed circuits by the kitchen count",
  cecH.circuits.poles - cecH.circuits.circuits === necH.circuits.poles - necH.circuits.circuits + cecH.circuits.kitchen,
  { NEC: `${necH.circuits.circuits}c/${necH.circuits.poles}p`, CEC: `${cecH.circuits.circuits}c/${cecH.circuits.poles}p` });
ok("no two-pole kitchen breakers under the NEC", necH.circuits.twoPoleKitchen === 0 && cecH.circuits.twoPoleKitchen === cecH.circuits.kitchen);

// AFCI scope — a SHAPE difference, per docs §1.1
console.log("\nAFCI scope — NEC 210.12 by room, CEC 26-658 by circuit type");
ok("NEC buys one AFCI breaker per circuit and has no plain-breaker line",
  necH.material.breakers.lines.length === 1
  && necH.material.breakers.lines[0].count === necH.circuits.circuits
  && !necH.material.breakers.lines.some((l) => /plain/i.test(l.type)));
ok("CEC splits three ways — two-pole AFCI, one-pole AFCI, and plain",
  cecH.material.breakers.lines.length === 3
  && cecH.material.breakers.lines.some((l) => l.poles === 2 && l.count === cecH.circuits.kitchen));
ok("a lighting-only circuit needs no AFCI in Canada, so some circuits take a plain breaker",
  cecH.material.breakers.lines.some((l) => !/AFCI/i.test(l.type) && l.count > 0),
  cecH.material.breakers.lines.map((l) => `${l.type}:${l.count}`));
ok("…and they are priced as plain breakers, not as AFCIs at a plain label",
  cecH.material.breakers.lines.filter((l) => !/AFCI/i.test(l.type))
    .every((l) => l.unitCost === BREAKER_COSTS.cecPlain1Pole),
  cecH.material.breakers.lines.map((l) => `${l.type}:$${l.unitCost}`));
ok("every CEC breaker line cites the rule it comes from",
  cecH.material.breakers.lines.every((l) => /26-\d{3}/.test(l.rule)),
  cecH.material.breakers.lines.map((l) => l.rule));
ok("CEC breaker counts add up to the circuit count — none invented, none dropped",
  cecH.material.breakers.count === cecH.circuits.circuits,
  { breakers: cecH.material.breakers.count, circuits: cecH.circuits.circuits });
ok("telling the model there are no lighting-only circuits moves them into AFCI and costs more",
  (() => {
    const plain = (r) => r.material.breakers.lines
      .filter((l) => !/AFCI/i.test(l.type)).reduce((s, l) => s + l.count, 0);
    const all = estimateRewire(full({ codeJurisdiction: "CEC", overrides: { cecLightingOnlyCircuitShare: 0 } }));
    return all.material.breakers.cost > cecH.material.breakers.cost && plain(all) < plain(cecH);
  })());
ok("a hostile lighting-only share falls back rather than producing NaN breakers",
  [NaN, "half", null, -3, 99, {}].every((v) => {
    const r = estimateRewire(full({ codeJurisdiction: "CEC", overrides: { cecLightingOnlyCircuitShare: v } }));
    return Number.isFinite(r.typical) && r.typical > 0 && Number.isInteger(r.material.breakers.count);
  }));

// The money
ok("the CEC breaker bill exceeds the NEC one at shipped defaults",
  cecH.material.breakers.cost > necH.material.breakers.cost,
  { NEC: necH.material.breakers.cost, CEC: cecH.material.breakers.cost });
ok("the CEC estimate is dearer overall for the same house",
  cecH.typical > necH.typical, { NEC: necH.typical, CEC: cecH.typical, delta: cecH.typical - necH.typical });
ok("the material breaker line IS the estimateBreakers total — no second calculation to drift",
  [necH, cecH].every((r) => r.material.lines.find((l) => /breaker/i.test(l.label)).cost === r.material.breakers.cost));
ok("each result states which price list its breakers came from",
  /Canadian retail/.test(cecH.material.breakers.priceBasis) && /US trade/.test(necH.material.breakers.priceBasis));
ok("estimateBreakers refuses an unknown jurisdiction rather than picking the cheaper code",
  estimateBreakers({ circuits: cecH.circuits }) === null
  && estimateBreakers({ circuits: cecH.circuits, codeJurisdiction: "CA" }) === null);

// Nothing NEC-shaped may leak into a CEC answer
ok("NEC values do not leak: the CEC kitchen count is not NEC's flat two",
  cecH.circuits.kitchen !== MANDATORY_CIRCUITS.NEC.smallAppliance, cecH.circuits.kitchen);
ok("NEC values do not leak: no $55 US-trade AFCI appears on a CEC breaker line",
  !cecH.material.breakers.lines.some((l) => l.unitCost === BREAKER_COSTS.necAfci1Pole),
  cecH.material.breakers.lines.map((l) => l.unitCost));
ok("NEC values do not leak: the CEC takeoff differs in circuits, poles, cable and price",
  cecH.circuits.circuits !== necH.circuits.circuits && cecH.circuits.poles !== necH.circuits.poles
  && cecH.wire.totalFt !== necH.wire.totalFt && cecH.typical !== necH.typical);

// Refusal beats a wrong number
console.log("\nJurisdiction gate — Quebec is refused, blank is never defaulted");
ok("codeJurisdiction is a required intake fact", REQUIRED_INTAKE.some((e) => e.key === "codeJurisdiction"));
ok("missing jurisdiction -> typical null and the question is asked", (() => {
  const r = estimateRewire(full({ codeJurisdiction: undefined }));
  return r.typical === null && r.needsIntake.some((n) => n.key === "codeJurisdiction");
})());
ok("an invalid jurisdiction counts as missing — no fuzzy match, no case folding",
  ["cec", "CEC ", "Canada", "CA", "NFPA70", 26, {}].every((v) => {
    const r = estimateRewire(full({ codeJurisdiction: v }));
    return r.typical === null && (r.needsIntake || []).some((n) => n.key === "codeJurisdiction");
  }));
ok("Quebec is REFUSED, not computed — CSA C22.10 is a different document",
  (() => {
    const r = estimateRewire(full({ codeJurisdiction: "QC" }));
    return r.ok === false && r.typical === null && /C22\.10/.test(r.reason);
  })(), estimateRewire(full({ codeJurisdiction: "QC" })).reason);
ok("both Quebec spellings are refused", ["QC", "CSA_C22_10"].every((v) =>
  estimateRewire(full({ codeJurisdiction: v })).ok === false));
ok("Quebec is not listed as missing intake — the question was answered, the answer is unsupported",
  estimateRewire(full({ codeJurisdiction: "QC" })).needsIntake.length === 0
  && missingIntake({ codeJurisdiction: "QC" }).every((e) => e.key !== "codeJurisdiction"));
ok("Quebec is refused before floor area is even checked — no partial answer",
  estimateRewire({ sqft: 999999, codeJurisdiction: "QC" }).ok === false
  && /C22\.10/.test(estimateRewire({ sqft: 999999, codeJurisdiction: "QC" }).reason));
ok("every unsupported jurisdiction carries a reason in words",
  Object.values(UNSUPPORTED_JURISDICTIONS).every((v) => typeof v === "string" && v.length > 30));

// With the jurisdiction unknown the range must span both codes, not pick one
const noJur = estimateRewire({ sqft: 1500 });
ok("no jurisdiction -> byAccessClass spans both codes (5 classes × 2)",
  noJur.byAccessClass.length === 10
  && new Set(noJur.byAccessClass.map((p) => p.codeJurisdiction)).size === 2,
  noJur.byAccessClass.length);
ok("no jurisdiction -> no single takeoff is handed out",
  noJur.openings === null && noJur.circuits === null && noJur.wire === null && noJur.material === null);
ok("…but both takeoffs are, side by side",
  SUPPORTED_JURISDICTIONS.every((k) => noJur.byJurisdiction[k]?.circuits?.circuits > 0),
  Object.keys(noJur.byJurisdiction || {}));
ok("the unknown-jurisdiction bracket contains both codes' fully-specified prices",
  noJur.low <= Math.min(necH.typical, cecH.typical) && noJur.high >= Math.max(necH.typical, cecH.typical),
  { low: noJur.low, NEC: necH.typical, CEC: cecH.typical, high: noJur.high });
ok("estimateOpenings and estimateCircuits refuse an unknown jurisdiction rather than assuming NEC",
  estimateOpenings({ sqft: 1500, bedrooms: 3, baths: 2 }) === null
  && estimateCircuits({ sqft: 1500 }) === null
  && estimateCircuits({ sqft: 1500, codeJurisdiction: "QC" }) === null);

// The words on the result, not just the numbers
console.log("\nAssumptions — the jurisdiction and edition, in words, on every result");
ok("a CEC result names the code and the edition",
  cecH.assumptions.some((a) => /CEC 26-712/.test(a) && /C22\.1:24/.test(a)),
  cecH.assumptions);
ok("a CEC result says Quebec is not supported",
  cecH.assumptions.some((a) => /Quebec/i.test(a) && /not supported/i.test(a)));
ok("a CEC result states the kitchen circuit count and the split-receptacle cap",
  cecH.assumptions.some((a) => /two split receptacles/i.test(a) && a.includes(String(cecH.circuits.kitchen))));
ok("a CEC result admits the CEC load calculation is not implemented",
  cecH.assumptions.some((a) => /8-110|8-200/.test(a) && /NOT implemented/i.test(a)));
ok("a CEC result admits the breaker prices are on a different currency basis",
  cecH.assumptions.some((a) => /CAD/.test(a) && /US trade/i.test(a)));
ok("an NEC result names the NEC and admits three editions are live",
  necH.assumptions.some((a) => /NEC Article 210/.test(a) && /editions/i.test(a)), necH.assumptions);
ok("an NEC result admits its AFCI scope over-reaches rather than hiding it",
  necH.assumptions.some((a) => /210\.12/.test(a) && /over-reach/i.test(a)));
ok("no jurisdiction -> the result says the range spans both codes",
  noJur.assumptions.some((a) => /jurisdiction not supplied/i.test(a) && /NEC/.test(a) && /CEC/.test(a)),
  noJur.assumptions);

// ── 3. Sub-linearity ─────────────────────────────────────────────────────
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

// ── 4. Access multipliers ────────────────────────────────────────────────
console.log("\nAccess multipliers — the largest lever in the model");

const order = ["open_walls", "light_reno", "fished_drywall", "plaster_lath", "knob_tube_historic"];
ok("multipliers are strictly increasing in difficulty",
  order.every((k, i) => i === 0 || ACCESS_MULTIPLIERS[k] > ACCESS_MULTIPLIERS[order[i - 1]]),
  order.map((k) => `${k}:${ACCESS_MULTIPLIERS[k]}`));
ok("open walls is the 1.0 base (NECA units are new-construction)", ACCESS_MULTIPLIERS.open_walls === 1);
ok("worst case is ~2.9× best — the spread the intake gate exists to resolve",
  Math.abs(ACCESS_MULTIPLIERS.knob_tube_historic / ACCESS_MULTIPLIERS.open_walls - 2.9) < 0.01);

const o = estimateOpenings(full()), ci = estimateCircuits({ sqft: 1500, codeJurisdiction: "NEC" });
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

// ── 5. The intake gate ───────────────────────────────────────────────────
console.log("\nIntake gate — no single price without the four facts");

const gated = estimateRewire({ sqft: 1500, codeJurisdiction: "NEC" });
ok("jurisdiction known but nothing else -> needsIntake lists the other four", gated.needsIntake.length === 4,
  gated.needsIntake.map((n) => n.key));
ok("no intake -> typical is NULL, so a UI cannot render one number", gated.typical === null);
ok("but a bracketing range is still returned", gated.low > 0 && gated.high > gated.low);
ok("the gated spread is wide enough to be obviously unquotable (>2×)", gated.high / gated.low > 2, gated.spread);
ok("gated result still shows every access class so the estimator can see the fork",
  Array.isArray(gated.byAccessClass) && gated.byAccessClass.length === 5);
ok("each required intake entry carries the question to ask",
  REQUIRED_INTAKE.every((e) => typeof e.question === "string" && e.question.length > 10));

for (const key of ["codeJurisdiction", "wallAccess", "wallConstruction", "existingWiring", "storeys"]) {
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
  missingIntake({ codeJurisdiction: "NEC", wallAccess: "finished", wallConstruction: "drywall", existingWiring: "modern_nm", storeys: 1 }).length === 0);
ok("unknowns are surfaced on every result, gated or not",
  gated.unknowns.length === KNOWN_UNKNOWNS.length && estimateRewire(full()).unknowns.length === KNOWN_UNKNOWNS.length);
ok("the six things the model cannot know are all named",
  ["asbestosOrLead", "atticAccess", "floorAccess", "panelLocation", "wallRepair", "historicDesignation"]
    .every((k) => KNOWN_UNKNOWNS.some((u) => u.key === k)));

// ── 6. Quote-1 reconciliation ────────────────────────────────────────────
console.log("\nReconciliation against the real 1,461 sqft quote ($21,915)");

const q1 = estimateRewire({
  sqft: 1461, bedrooms: 3, baths: 2, storeys: 1, codeJurisdiction: "NEC",
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

// ── 7. The service-entrance line ─────────────────────────────────────────
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

// ── 8. Hostile input ─────────────────────────────────────────────────────
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
  const r = estimateRewire({ ...input, codeJurisdiction: "NEC", wallAccess: "finished", wallConstruction: "drywall", existingWiring: "modern_nm", storeys: 1 });
  ok(`${name} -> ok:false with a reason, no price`,
    r.ok === false && r.typical === null && r.low === null && typeof r.reason === "string",
    { ok: r.ok, typical: r.typical, reason: r.reason });
}
ok("the calibrated band is stated on the refusal so the caller knows why",
  estimateRewire({ sqft: 50000, codeJurisdiction: "NEC" }).reason.includes(String(MAX_SQFT))
  && estimateRewire({ sqft: 50, codeJurisdiction: "NEC" }).reason.includes(String(MIN_SQFT)));

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

// ── 9. Company overrides ─────────────────────────────────────────────────
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

// ── 10. It must not reach a client-facing surface ─────────────────────────
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
ok("READ, DERIVED, NEC and CEC tags all survive in the source",
  /\[READ\]/.test(src) && /\[DERIVED\]/.test(src) && /\[NEC/.test(src) && /\[CEC/.test(src));
ok("the single-quote calibration carries its caution", /CAUTION/.test(src));
ok("CEC rule NUMBERS are cited — 26-712, 26-722 and 26-658 all appear",
  /26-712/.test(src) && /26-722/.test(src) && /26-658/.test(src));
ok("the mandatory-circuit table no longer claims universality — it is keyed, not NEC_-prefixed",
  !/export const NEC_MANDATORY_CIRCUITS/.test(src) && /export const MANDATORY_CIRCUITS/.test(src));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
