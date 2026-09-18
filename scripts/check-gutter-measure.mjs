#!/usr/bin/env node
// scripts/check-gutter-measure.mjs
//
//   npm run check:gutter-measure
//
// The gutter measurement, executed against the four Google Solar responses
// the owner's competitor was checked against (scripts/fixtures/
// solar-gutter-references.json — real API responses, recorded 2026-09-17,
// panel arrays stripped). The competitor's figures:
//
//   204 Avro Cir, Ottawa        184 ft / 6 downspouts   imagery 2024-07-08
//   250 First Ave, Ottawa       144 ft / 5 downspouts   imagery 2024-07-08
//   917 Littlerock St, Ottawa     7 ft / 4 downspouts   imagery 2018-06-02  (wrong building)
//   418 Bd Gréber, Gatineau      79 ft / 18 downspouts  imagery 2024-07-08  (a strip mall)
//
// The first two are the calibration; the last two are what must be REFUSED
// in words rather than priced. Every branch of deriveGutters, downspoutCount
// and gutterFlags runs here, plus hostile input.
import { readFileSync } from "node:fs";
import { summariseRoof, measurementWarnings } from "@/lib/measure/roofMeasurement";
import {
  deriveGutters,
  downspoutCount,
  eaveRunCount,
  gutterFlags,
  gutterTakeoffPatch,
  summariseGutters,
  imageryText,
  imageryDateText,
  lowSlopeShare,
  DOWNSPOUT_SPACING_FT,
  DOWNSPOUT_MIN_SPACING_FT,
  MIN_PLAUSIBLE_GUTTER_FT,
  MAX_PLAUSIBLE_GUTTER_FT,
  MAX_PLAUSIBLE_HOUSE_ROOF_SQFT,
  MAX_IMAGERY_AGE_YEARS,
} from "@/lib/measure/gutterMeasurement";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const within = (a, b, pct) => Math.abs(a - b) <= Math.abs(b) * pct;

const NOW = new Date("2026-09-17T12:00:00Z");
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/solar-gutter-references.json", import.meta.url), "utf8"));

/** measureRoof()'s return shape, from a recorded response — no network. */
function roofFrom(fx) {
  const ins = fx.insights;
  const summary = summariseRoof(ins);
  const pinDistanceM = fx.widened ? 36.3 : 3;
  return {
    ok: true,
    ...summary,
    pinDistanceM,
    searchWidened: fx.widened,
    imageryQuality: ins.imageryQuality,
    imageryDate: ins.imageryDate,
    precise: fx.precise,
    ...measurementWarnings({
      areaSqft: summary.areaSqft,
      pinDistanceM: fx.widened ? null : pinDistanceM,
      imageryQuality: ins.imageryQuality,
      imageryDate: ins.imageryDate,
      segmentCount: summary.segmentCount,
      precise: fx.precise,
    }),
  };
}

console.log("\n1. The two calibration houses land on the competitor's numbers\n");
{
  const avro = deriveGutters(roofFrom(fixtures.avro), NOW);
  ok(avro && within(avro.gutterFt, 184, 0.05), "204 Avro Cir: gutter within 5% of 184 ft", avro?.gutterFt);
  ok(avro?.downspouts === 6, "204 Avro Cir: 6 downspouts", avro?.downspouts);
  ok(avro?.basis === "eave", "204 Avro Cir: a hip roof reads its eaves", avro?.basis);
  ok(avro?.trustworthy === true && avro.flags.length === 0, "204 Avro Cir: no flags", avro?.flags);
  ok(avro?.imagery.date === "2024-07-29" && avro.imagery.quality === "HIGH", "204 Avro Cir: imagery 2024-07-29 HIGH", avro?.imagery);

  const first = deriveGutters(roofFrom(fixtures.firstave), NOW);
  ok(first && within(first.gutterFt, 144, 0.05), "250 First Ave: gutter within 5% of 144 ft", first?.gutterFt);
  ok(first?.downspouts === 5, "250 First Ave: 5 downspouts", first?.downspouts);
  ok(first?.basis === "perimeter", "250 First Ave: a flat roof offers its outline", first?.basis);
  ok(first?.lowSlopeShare >= 0.5, "250 First Ave: most of the roof is flat", first?.lowSlopeShare);
  ok(first?.trustworthy === true, "250 First Ave: trustworthy", first?.flags);
  const s = summariseGutters(first);
  ok(/flat/.test(s.headline) && /drains internally/.test(s.cannotKnow.join(" ")), "250 First Ave: the panel says it is flat and may drain internally", s);
}

console.log("\n2. The wrong-building cases are refused in words\n");
{
  // 917 Littlerock: the pin's own model is an 11 m² shed; the widened search
  // found the house. The competitor stopped at the shed and priced 7 ft.
  const lr = deriveGutters(roofFrom(fixtures.littlerock), NOW);
  ok(lr && lr.gutterFt >= MIN_PLAUSIBLE_GUTTER_FT && lr.gutterFt <= 200, "917 Littlerock: the HOUSE is measured, not the shed", lr?.gutterFt);
  ok(lr?.flags.some((f) => f.code === "stale_imagery" && !f.severe), "917 Littlerock: 2018 imagery is flagged", lr?.flags.map((f) => f.code));
  ok(lr?.flags.some((f) => f.code === "pin_off_building"), "917 Littlerock: says the pin was off the building", lr?.flags.map((f) => f.code));
  ok(/2018-06-02 \(medium quality\)/.test(lr?.imagery.text || ""), "917 Littlerock: imagery sentence reads like the roofing panel's", lr?.imagery.text);
  ok(lr?.trustworthy === true, "917 Littlerock: still fillable — old imagery is a flag, not a refusal", lr?.flags);

  // The competitor's 7 ft: what our flags say about THEIR number.
  const seven = gutterFlags({ gutterFt: 7, downspouts: 4, roofAreaSqft: 119, imageryDate: { year: 2018, month: 6, day: 2 }, imageryQuality: "MEDIUM" }, NOW);
  ok(!seven.trustworthy, "7 ft / 4 downspouts is refused");
  ok(seven.flags.some((f) => f.code === "gutter_too_short" && f.text === "7 ft of gutter is not a house — book an on-site measure."), "…with the owner's sentence", seven.flags);
  ok(seven.flags.some((f) => f.code === "downspout_ratio" && f.severe), "…and 4 downspouts on 7 ft is the ratio flag", seven.flags.map((f) => f.code));
  ok(seven.flags.some((f) => f.code === "stale_imagery"), "…and the 2018 imagery is named", seven.flags.map((f) => f.code));

  // 418 Bd Gréber: one flat facet, 15,730 sqft, street-interpolated pin.
  const gr = deriveGutters(roofFrom(fixtures.greber), NOW);
  ok(gr && !gr.trustworthy, "418 Gréber: not trustworthy", gr?.flags);
  ok(gr?.flags.some((f) => f.code === "not_a_house" && f.severe), "418 Gréber: 15,730 sqft is named as not a house", gr?.flags.map((f) => f.code));
  ok(gr?.flags.some((f) => f.code === "imprecise_geocode"), "418 Gréber: the street-interpolated pin is named", gr?.flags.map((f) => f.code));
  ok(gr?.downspouts * DOWNSPOUT_MIN_SPACING_FT <= gr?.gutterFt, "418 Gréber: never 18 downspouts on 79 ft — the cap holds", { ft: gr?.gutterFt, ds: gr?.downspouts });
}

console.log("\n3. The downspout rule\n");
{
  ok(DOWNSPOUT_SPACING_FT === 35 && DOWNSPOUT_MIN_SPACING_FT === 20, "constants are 35 ft spacing, 20 ft cap");
  ok(downspoutCount(184, 4) === 6, "184 ft → 6", downspoutCount(184, 4));
  ok(downspoutCount(144, 4) === 5, "144 ft → 5", downspoutCount(144, 4));
  ok(downspoutCount(35, 1) === 1, "35 ft, one run → 1", downspoutCount(35, 1));
  ok(downspoutCount(36, 1) === 1, "36 ft, one run → 1 (rounding up says 2, the 20 ft cap says 1)", downspoutCount(36, 1));
  ok(downspoutCount(41, 1) === 2, "41 ft, one run → 2 (rounded up, under the cap)", downspoutCount(41, 1));
  ok(downspoutCount(60, 4) === 3, "60 ft with 4 runs → capped at 3 (one per 20 ft)", downspoutCount(60, 4));
  ok(downspoutCount(30, 2) === 1, "30 ft with 2 runs → 1 (cap beats runs)", downspoutCount(30, 2));
  ok(downspoutCount(7, 2) === 1, "7 ft → 1, never 4", downspoutCount(7, 2));
  ok(downspoutCount(0, 2) === 0, "0 ft → 0", downspoutCount(0, 2));
  ok(downspoutCount(NaN, NaN) === 0 && downspoutCount("x", null) === 0, "garbage → 0");
  ok(downspoutCount(2000, 8) === 58, "2000 ft → 58 (and flagged elsewhere)", downspoutCount(2000, 8));
  ok(eaveRunCount({ shape: "gable" }) === 2 && eaveRunCount({ shape: "hip" }) === 4, "gable 2 runs, hip 4");
  ok(eaveRunCount({ shape: "complex", directions: [1, 2, 3, 4, 5] }) === 5, "complex: one per facing direction");
  ok(eaveRunCount({ shape: "complex", directions: [] }) === 1 && eaveRunCount(null) === 1, "no directions → 1, null → 1");
  ok(eaveRunCount({ shape: "gable" }, true) === 4, "flat overrides shape → 4 edges");
}

console.log("\n4. Flags on hostile input\n");
{
  const none = gutterFlags({ gutterFt: 184, downspouts: 6, roofAreaSqft: 3100, imageryDate: { year: 2024, month: 7, day: 29 } }, NOW);
  ok(none.trustworthy && none.flags.length === 0, "a normal house has no flags", none.flags);
  ok(!gutterFlags({ gutterFt: 39 }, NOW).trustworthy && gutterFlags({ gutterFt: 40 }, NOW).trustworthy, "40 ft is the floor, 39 is refused");
  ok(gutterFlags({ gutterFt: 600 }, NOW).trustworthy && !gutterFlags({ gutterFt: 601 }, NOW).trustworthy, "600 ft is the ceiling, 601 is refused");
  ok(gutterFlags({ gutterFt: 2000 }, NOW).flags[0].text === "2000 ft of gutter is more than a house — book an on-site measure.", "2000 ft sentence");
  ok(gutterFlags({ gutterFt: 0 }, NOW).flags.length === 0, "0 ft raises no size flag (there is nothing to judge — the caller has no measurement)");
  ok(!gutterFlags({ gutterFt: 200, roofAreaSqft: MAX_PLAUSIBLE_HOUSE_ROOF_SQFT + 1 }, NOW).trustworthy, "a roof over the house ceiling is refused");
  const stale = gutterFlags({ gutterFt: 200, imageryDate: { year: NOW.getFullYear() - MAX_IMAGERY_AGE_YEARS - 1 } }, NOW);
  ok(stale.trustworthy && stale.flags.some((f) => f.code === "stale_imagery"), "imagery older than 5 years is flagged but not refused");
  const fresh = gutterFlags({ gutterFt: 200, imageryDate: { year: NOW.getFullYear() - MAX_IMAGERY_AGE_YEARS } }, NOW);
  ok(fresh.flags.length === 0, "imagery exactly 5 years old is not flagged");
  ok(gutterFlags({ gutterFt: 200, imageryDate: null }, NOW).flags.length === 0, "missing imagery date raises no age flag");
  ok(gutterFlags({ gutterFt: 200, roofWarnings: [{ code: "far_from_pin", severe: true, text: "far" }] }, NOW).flags[0].code === "far_from_pin", "the roof's far_from_pin carries through");
  ok(gutterFlags({ gutterFt: 200, roofWarnings: [{ code: "stale_imagery", severe: false, text: "x" }] }, NOW).flags.length === 0, "the roof's own non-severe warnings do not double up");
  ok(gutterFlags({ gutterFt: 200, roofWarnings: "nope" }, NOW).flags.length === 0, "non-array roofWarnings tolerated");
  ok(gutterFlags(undefined, NOW).flags.length === 0, "no input → no flags");
  ok(gutterFlags({ gutterFt: 100, downspouts: 6 }, NOW).flags.some((f) => f.code === "downspout_ratio"), "6 downspouts on 100 ft (one per 17 ft) is the ratio flag");
  ok(!gutterFlags({ gutterFt: 100, downspouts: 5 }, NOW).flags.some((f) => f.code === "downspout_ratio"), "5 on 100 ft (one per 20) is allowed");
}

console.log("\n5. Derivation, patch and imagery text on hostile input\n");
{
  ok(deriveGutters(null) === null && deriveGutters({}) === null && deriveGutters({ linear: null }) === null, "no linear geometry → null, never zero");
  ok(deriveGutters({ linear: { perimeterFt: 0, eaveFt: 0 } }) === null, "zero perimeter → null");
  const g = deriveGutters({ linear: { perimeterFt: 200, eaveFt: 120, rakeFt: 80, shape: "gable", directions: [{}, {}] }, areaSqft: 2000, lowSlopeShare: 0 }, NOW);
  ok(g.gutterFt === 120 && g.downspouts === 4 && g.basis === "eave", "gable: eave 120 → 4 downspouts", g);
  const flat = deriveGutters({ linear: { perimeterFt: 200, eaveFt: 120, rakeFt: 80, shape: "gable", directions: [{}, {}] }, areaSqft: 2000, lowSlopeShare: 0.6 }, NOW);
  ok(flat.gutterFt === 200 && flat.basis === "perimeter" && flat.eaveRuns === 4, "flat: perimeter 200, four edges", flat);

  const p = gutterTakeoffPatch(g, "replacement", "1 Main St");
  ok(p.gutterFt === 120 && p.downspoutsInstalled === 4 && p.downspoutsFlushed === undefined, "replacement writes downspoutsInstalled", p);
  const c = gutterTakeoffPatch(g, "cleaning", "1 Main St");
  ok(c.downspoutsFlushed === 4 && c.downspoutsInstalled === undefined, "cleaning writes downspoutsFlushed — buildGutters prices downspoutsInstalled on any work type", c);
  const r = gutterTakeoffPatch(g, "repair");
  ok(r.downspoutsFlushed === undefined && r.downspoutsInstalled === undefined && r.gutterFt === 120, "repair writes the footage only", r);
  ok(p.measuredFrom === "satellite" && Array.isArray(p.measuredFlags) && p.measuredImagery && "date" in p.measuredImagery, "the patch carries provenance, flags and imagery for the review");
  ok(gutterTakeoffPatch(null) === null, "null derivation → null patch");

  ok(imageryText({ year: 2018, month: 6, day: 2 }, "MEDIUM") === "The imagery is from 2018-06-02 (medium quality).", "imagery sentence", imageryText({ year: 2018, month: 6, day: 2 }, "MEDIUM"));
  ok(imageryText({ year: 2024 }, null) === "The imagery is from 2024.", "year-only, no quality");
  ok(imageryText(null) === null && imageryText({ year: "x" }) === null, "no date → null");
  ok(imageryDateText({ year: 2024, month: 7, day: 8 }) === "2024-07-08", "zero-padded");

  ok(lowSlopeShare(null) === 0 && lowSlopeShare([]) === 0, "lowSlopeShare on nothing is 0");
  ok(lowSlopeShare([{ pitchDegrees: 0.3, stats: { groundAreaMeters2: 60 } }, { pitchDegrees: 30, stats: { groundAreaMeters2: 40 } }]) === 0.6, "60/40 flat");
  ok(lowSlopeShare([{ pitchDegrees: 3, stats: { groundAreaMeters2: 1 } }]) === 1 && lowSlopeShare([{ pitchDegrees: 3.1, stats: { groundAreaMeters2: 1 } }]) === 0, "3° is flat, 3.1° is not");
  ok(lowSlopeShare([{ pitchDegrees: 0, stats: { groundAreaMeters2: "x" } }]) === 0, "garbage area ignored");
}

console.log(fail ? `\n${fail} FAILED\n` : "\nall passed\n");
process.exit(fail ? 1 : 0);
