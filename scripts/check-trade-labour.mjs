// scripts/check-trade-labour.mjs
//
// Executes the roofing labour engine, the roofing and siding scope builders
// that read it, and the client-facing wording both trades put on a quote —
// against hostile input and against the reference calculator and published
// price bands this model was reconciled with. No database, no network, no key.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-trade-labour.mjs
//
// The three things worth guarding here, in order of how much money they move:
//
//   1. Pitch must never multiply the AREA. Google Solar's areaMeters2 is
//      already the sloped surface, and applying pitch to it again inflates a
//      steep roof by a third. The only sanctioned meeting of area and pitch is
//      slopedAreaSqft(), for a footprint typed off a survey.
//   2. Layers must be additive to the STRIP, not multiplicative on the job.
//   3. There must be a fixed component, so a per-square rate cannot be the
//      whole answer at either end of the size range.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hashQuote } from "@/lib/documents/signatureAudit";
import {
  roofLabour,
  roofCrewDays,
  pitchBand,
  slopedAreaSqft,
  PITCH_BANDS,
  ROOF_LABOUR_DEFAULTS,
} from "@/lib/pricing/roofLabour";
import { paverLabour, paverCrewDays } from "@/lib/pricing/paverLabour";
import {
  insulationTakeoff,
  recommendedR,
  codeMinimumR,
  depthForTarget,
} from "@/lib/pricing/insulation";
import {
  buildTradeLineItems,
  createTradeConfig,
  tradeLabourHours,
  tradeLabourDetail,
} from "@/lib/pricing/tradeScope";
import {
  getPriceBook,
  PRICE_BOOK_FIELDS,
  PRICE_BOOK_GROUPS,
  readField,
} from "@/app/data/tradePriceBooks";
import {
  tradeMaterialsFor,
  hasTradeMaterials,
} from "@/lib/costing/tradeMaterials";
import { estimateQuoteCost } from "@/lib/costing/estimateJobCost";
import {
  resolveServiceContent,
  dominantGlossary,
} from "@/lib/documents/serviceContent";

let pass = 0;
const fails = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (err) {
    fails.push(`${name}: ${err.message}`);
  }
}

const BOOK = getPriceBook("roofing_service");
// Every book, for the checks that compare a shipped constant against a source.
const BOOKS = {
  insulation: getPriceBook("insulation"),
};
const simple = (over = {}) => ({
  squares: 20,
  pitchRise: 4,
  layers: 1,
  storeys: "one",
  ...over,
});

/* ── 1. Pitch never touches area ───────────────────────────────────────── */

check("pitch scales hours, not squares", () => {
  const flat = roofLabour(simple({ pitchRise: 4 }));
  const steep = roofLabour(simple({ pitchRise: 10 }));
  assert.equal(flat.squares, 20);
  assert.equal(steep.squares, 20, "a steeper roof is not a bigger roof here");
  assert.ok(steep.hours > flat.hours);
});

check("the fixed hours are NOT scaled by pitch", () => {
  const flat = roofLabour(simple({ pitchRise: 4 }));
  const steep = roofLabour(simple({ pitchRise: 16 }));
  assert.equal(flat.fixedHours, steep.fixedHours);
});

check("a typed footprint converts UP by the pitch, and only there", () => {
  // 1,000 sqft footprint at 12/12 is 1,414 sqft of roof — sqrt(2).
  assert.equal(slopedAreaSqft(1000, 12), 1414.2);
  assert.equal(slopedAreaSqft(1000, 0), 1000);
  const fromFootprint = roofLabour({
    footprintSqft: 1000,
    pitchRise: 12,
    layers: 1,
  });
  assert.equal(fromFootprint.squares, 14.14);
  // A sloped area supplied directly is used as-is.
  const fromSloped = roofLabour({ areaSqft: 1000, pitchRise: 12, layers: 1 });
  assert.equal(fromSloped.squares, 10);
});

check("squares win over sqft, sqft over footprint", () => {
  const r = roofLabour({
    squares: 5,
    areaSqft: 9999,
    footprintSqft: 8888,
    pitchRise: 4,
  });
  assert.equal(r.squares, 5);
});

/* ── 2. Layers are additive to demolition ──────────────────────────────── */

check("a second layer adds strip hours, not install hours", () => {
  const one = roofLabour(simple({ layers: 1 }));
  const two = roofLabour(simple({ layers: 2 }));
  const install = (r) => r.breakdown.find((b) => b.key === "install").hours;
  const strip = (r) => r.breakdown.find((b) => b.key === "tear_off").hours;
  assert.equal(install(one), install(two), "installation does not care");
  assert.ok(strip(two) > strip(one));
  // And the extra layer costs LESS than the first: the roof is already open.
  assert.ok(strip(two) - strip(one) < strip(one));
});

check("zero layers means no strip and no dump run at all", () => {
  const r = roofLabour(simple({ layers: 0 }));
  assert.equal(
    r.breakdown.find((b) => b.key === "tear_off"),
    undefined,
  );
  assert.equal(
    r.breakdown.find((b) => b.key === "disposal"),
    undefined,
  );
});

check("three layers warns about the deck", () => {
  assert.ok(
    roofLabour(simple({ layers: 3 })).warnings.some((w) =>
      /sheathing/i.test(w),
    ),
  );
  assert.equal(roofLabour(simple({ layers: 1 })).warnings.length, 0);
});

/* ── 3. The fixed component exists and behaves ─────────────────────────── */

check("hours per square FALLS as the roof grows", () => {
  const small = roofLabour(simple({ squares: 6 }));
  const big = roofLabour(simple({ squares: 60 }));
  assert.ok(
    small.hoursPerSquare > big.hoursPerSquare,
    "a fixed mobilisation cost must make the small job dearer per square",
  );
});

check("mobilisation survives a roof with nothing else on it", () => {
  const r = roofLabour({ squares: 1, pitchRise: 4, layers: 0 });
  assert.ok(r.fixedHours >= ROOF_LABOUR_DEFAULTS.mobilisationHours);
});

check("dump runs step, they do not slide", () => {
  const runs = (sq, layers) => {
    const row = roofLabour(simple({ squares: sq, layers })).breakdown.find(
      (b) => b.key === "disposal",
    );
    return row ? row.hours / ROOF_LABOUR_DEFAULTS.dumpRunHours : 0;
  };
  assert.equal(runs(20, 1), 1);
  assert.equal(runs(21, 1), 2);
  // Two layers of debris off the same roof is twice the trailer.
  assert.equal(runs(20, 2), 2);
});

/* ── Reference-calculator parity on the part it can express ────────────── */

check("pitch bands reproduce the reference calculator exactly", () => {
  assert.equal(pitchBand(3).factor, 1.0);
  assert.equal(pitchBand(5).factor, 1.0);
  assert.equal(pitchBand(6).factor, 1.3);
  assert.equal(pitchBand(8).factor, 1.3);
  assert.equal(pitchBand(9).factor, 1.6);
  assert.equal(pitchBand(12).factor, 1.6);
  // And the two bands it has no opinion about.
  assert.equal(pitchBand(1).factor, 0.9);
  assert.equal(pitchBand(13).factor, 2.0);
});

check("field work agrees with the reference within 20%", () => {
  // Their 2.0 h/sq is all-in for install + underlayment + one layer stripped,
  // because they have nowhere else to put the strip. Ours is 2.3 for the same
  // three. The gap in a real job is the details and the fixed hours, not this.
  const ours =
    ROOF_LABOUR_DEFAULTS.installPerSquare +
    ROOF_LABOUR_DEFAULTS.underlaymentPerSquare +
    ROOF_LABOUR_DEFAULTS.tearOffFirstLayerPerSquare;
  assert.ok(Math.abs(ours - 2.0) / 2.0 < 0.2, `field work is ${ours} h/sq`);
});

check("a typical walkable tear-off lands in the published 2.5-3.5 band", () => {
  const r = roofLabour({
    squares: 25,
    pitchRise: 4,
    layers: 1,
    storeys: "one",
    dripEdgeFt: 200,
    starterFt: 110,
    iceWaterFt: 110,
    ridgeHipFt: 50,
    ventBoots: 3,
    boxVents: 2,
  });
  assert.ok(
    r.hoursPerSquare >= 2.5 && r.hoursPerSquare <= 3.5,
    `got ${r.hoursPerSquare} h/sq`,
  );
});

/* ── Crew ──────────────────────────────────────────────────────────────── */

check("crew size divides, but not for free", () => {
  const solo = roofCrewDays(100, { crewSize: 1 });
  const pair = roofCrewDays(100, { crewSize: 2 });
  assert.ok(solo.crewHours > pair.crewHours * 2, "a lone roofer loses hours");
  const six = roofCrewDays(100, { crewSize: 6 });
  assert.ok(six.labourHours > pair.labourHours, "a crowded roof loses hours");
});

check("setting every efficiency to 1 gives plain division back", () => {
  const flat = { crewEfficiency: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 } };
  assert.equal(roofCrewDays(120, { crewSize: 3, rates: flat }).crewHours, 40);
});

check("a crew of 0 or nonsense is a crew of 1, not a division by zero", () => {
  for (const size of [0, -3, null, undefined, NaN, "two", {}]) {
    const r = roofCrewDays(100, { crewSize: size });
    assert.ok(Number.isFinite(r.crewHours) && r.crewHours > 0, String(size));
  }
});

check("a job that takes any time at all books at least half a day", () => {
  assert.equal(roofCrewDays(0.2, { crewSize: 4 }).days, 0.5);
  assert.equal(roofCrewDays(0, { crewSize: 4 }).days, 0);
});

check("past the top of the table congestion keeps growing", () => {
  const six = roofCrewDays(100, { crewSize: 6 });
  const twelve = roofCrewDays(100, { crewSize: 12 });
  assert.ok(twelve.crewEfficiency >= six.crewEfficiency);
});

/* ── Absence is not zero ───────────────────────────────────────────────── */

check("no area is incomplete, not a free roof", () => {
  for (const cfg of [
    null,
    undefined,
    {},
    { squares: 0 },
    { areaSqft: "" },
    42,
    "roof",
  ]) {
    const r = roofLabour(cfg);
    assert.equal(r.incomplete, true, JSON.stringify(cfg));
    assert.equal(r.hours, 0);
    assert.ok(r.warnings.length > 0, "and it says why");
  }
  assert.equal(roofLabour(simple()).incomplete, false);
});

/* ── Hostile input ─────────────────────────────────────────────────────── */

check("__proto__ keys resolve to nothing, not to Object.prototype", () => {
  const r = roofLabour({
    squares: 10,
    pitchRise: 4,
    layers: 1,
    storeys: "__proto__",
    materialKey: "__proto__",
    materials: {},
  });
  assert.equal(r.materialFactor, 1);
  assert.equal(r.storeyFactor, 1);
  assert.ok(Number.isFinite(r.hours));
});

check("non-finite and negative input never escapes as a total", () => {
  const nasty = [
    1e308,
    1e400,
    -1,
    NaN,
    Infinity,
    -Infinity,
    "12abc",
    null,
    [],
    {},
  ];
  for (const v of nasty) {
    for (const field of [
      "squares",
      "pitchRise",
      "layers",
      "valleyFt",
      "chimneys",
      "deckSheets",
    ]) {
      const r = roofLabour({ ...simple(), [field]: v });
      assert.ok(
        Number.isFinite(r.hours) && r.hours >= 0,
        `${field}=${String(v)} gave ${r.hours}`,
      );
      const d = roofCrewDays(r.hours, { crewSize: 3 });
      assert.ok(
        Number.isFinite(d.days),
        `${field}=${String(v)} days=${d.days}`,
      );
    }
  }
});

check("a company can zero every rate without breaking the engine", () => {
  const zeroed = Object.fromEntries(
    Object.keys(ROOF_LABOUR_DEFAULTS).map((k) => [k, 0]),
  );
  const r = roofLabour(simple(), zeroed);
  assert.equal(r.hours, 0);
  assert.equal(r.incomplete, false, "zero hours is an answer; no area is not");
});

check("overriding one storey factor does not wipe the others", () => {
  const r = roofLabour(simple({ storeys: "one" }), {
    storeyFactor: { three_plus: 2 },
  });
  assert.equal(r.storeyFactor, 1, "one-storey survived the partial override");
});

/* ── The builder that sells it ─────────────────────────────────────────── */

check("a blank roofing takeoff prices nothing and crashes nothing", () => {
  const cfg = createTradeConfig("roofing_service");
  assert.ok(cfg && cfg.materialKey);
  assert.deepEqual(buildTradeLineItems("roofing_service", cfg), []);
  assert.equal(tradeLabourHours("roofing_service", cfg), 0);
});

check("line items price the components separately", () => {
  const cfg = {
    ...createTradeConfig("roofing_service"),
    areaSqft: 2000,
    pitchRise: 10,
    layers: 2,
    valleyFt: 40,
    chimneys: 1,
    deckSheets: 3,
  };
  const items = buildTradeLineItems("roofing_service", cfg);
  const has = (re) => items.some((i) => re.test(i.description));
  assert.ok(has(/Architectural shingles/));
  assert.ok(has(/Tear off/));
  assert.ok(has(/Additional existing layers \(1\)/));
  assert.ok(has(/Valleys/));
  assert.ok(has(/Chimney/));
  assert.ok(has(/sheathing/i));
  assert.ok(has(/Steep pitch/));
  assert.ok(items.every((i) => Number.isFinite(i.amount) && i.amount >= 0));
});

check("the steepness surcharge is last and is on everything above it", () => {
  const cfg = {
    ...createTradeConfig("roofing_service"),
    areaSqft: 2000,
    pitchRise: 10,
    layers: 1,
  };
  const items = buildTradeLineItems("roofing_service", cfg);
  const last = items[items.length - 1];
  assert.match(last.description, /Steep pitch/);
  const rest = items.slice(0, -1).reduce((s, i) => s + i.amount, 0);
  const pct = BOOK.steepnessSurcharge.steep;
  assert.ok(Math.abs(last.amount - rest * pct) < 0.02);
});

check("a walkable roof carries no surcharge line at all", () => {
  const cfg = {
    ...createTradeConfig("roofing_service"),
    areaSqft: 2000,
    pitchRise: 4,
    layers: 1,
  };
  const items = buildTradeLineItems("roofing_service", cfg);
  assert.ok(!items.some((i) => /pitch/i.test(i.description)));
});

check(
  "tradeLabourHours delegates to the engine, and the detail matches",
  () => {
    const cfg = {
      ...createTradeConfig("roofing_service"),
      areaSqft: 2500,
      pitchRise: 8,
      layers: 1,
      valleyFt: 30,
    };
    const hours = tradeLabourHours("roofing_service", cfg);
    const detail = tradeLabourDetail("roofing_service", cfg);
    assert.ok(hours > 0);
    assert.equal(hours, detail.hours);
    const summed = detail.breakdown.reduce((s, r) => s + r.hours, 0);
    assert.ok(
      Math.abs(summed - detail.hours) < 0.05,
      `${summed} vs ${detail.hours}`,
    );
  },
);

check("the book's labour block is what the engine actually reads", () => {
  const cfg = {
    ...createTradeConfig("roofing_service"),
    areaSqft: 2000,
    pitchRise: 4,
    layers: 1,
  };
  const base = tradeLabourHours("roofing_service", cfg);
  const slower = tradeLabourHours("roofing_service", cfg, {
    labour: { installPerSquare: ROOF_LABOUR_DEFAULTS.installPerSquare * 2 },
  });
  assert.ok(slower > base, "editing the rate card must move the hours");
});

check("the chosen material's labourFactor is read", () => {
  const cfg = {
    ...createTradeConfig("roofing_service"),
    areaSqft: 2000,
    pitchRise: 4,
    layers: 1,
  };
  const asphalt = tradeLabourHours("roofing_service", cfg);
  const seam = tradeLabourHours("roofing_service", {
    ...cfg,
    materialKey: "metal_standing_seam",
  });
  assert.ok(seam > asphalt, "standing seam is not laid at shingle speed");
});

check("every price-book steepness key is a real band key", () => {
  const bands = new Set(PITCH_BANDS.map((b) => b.key));
  for (const key of Object.keys(BOOK.steepnessSurcharge)) {
    assert.ok(bands.has(key), `${key} matches no pitch band`);
  }
});

check("every material in the book has a rate and a labour factor", () => {
  for (const [key, m] of Object.entries(BOOK.materials)) {
    assert.ok(m.label, key);
    assert.ok(Number(m.pricePerSquare) > 0, key);
    assert.ok(Number(m.labourFactor) > 0, key);
  }
});

/* ── Siding, which is the same shape one trade over ────────────────────── */

const SIDING = getPriceBook("siding");

check("a blank siding takeoff prices nothing", () => {
  const cfg = createTradeConfig("siding");
  assert.ok(cfg && cfg.materialKey);
  assert.deepEqual(buildTradeLineItems("siding", cfg), []);
});

check("siding prices the components separately", () => {
  const cfg = {
    ...createTradeConfig("siding"),
    sqft: 2000,
    storeys: "two",
    rotRepairSqft: 40,
    trimFt: 220,
    fasciaFt: 140,
    soffitSqft: 300,
  };
  const items = buildTradeLineItems("siding", cfg);
  const has = (re) => items.some((i) => re.test(i.description));
  assert.ok(has(/Vinyl siding/));
  assert.ok(has(/Strip and dispose/));
  assert.ok(has(/House wrap/));
  assert.ok(has(/rot repair \(allowance\)/i));
  assert.ok(has(/Trim/));
  assert.ok(has(/Fascia/));
  assert.ok(has(/Soffit/));
  assert.match(items[items.length - 1].description, /Access — two storeys/);
  assert.ok(items.every((i) => Number.isFinite(i.amount) && i.amount >= 0));
});

check("a one-storey siding job carries no access line", () => {
  const cfg = { ...createTradeConfig("siding"), sqft: 1000, storeys: "one" };
  assert.ok(
    !buildTradeLineItems("siding", cfg).some((i) =>
      /Access/.test(i.description),
    ),
  );
});

check("the published $/sqft reproduce the published whole-house band", () => {
  // This Old House: roughly $8,000-$30,000 on a typical 2,000 sqft home,
  // averaging near $19,000. A 2,000 sqft house is about 2,000 sqft of wall.
  const wall = 2000;
  const price = (key) => {
    const cfg = {
      ...createTradeConfig("siding"),
      sqft: wall,
      materialKey: key,
      storeys: "one",
    };
    return buildTradeLineItems("siding", cfg).reduce((s, i) => s + i.amount, 0);
  };
  const vinyl = price("vinyl");
  const stone = price("stone_veneer");
  assert.ok(vinyl >= 8000 && vinyl <= 30000, `vinyl $${vinyl}`);
  assert.ok(stone >= 8000 && stone <= 45000, `stone $${stone}`);
  assert.ok(stone > vinyl * 2);
});

check("siding hours read the chosen material's labour factor", () => {
  const cfg = { ...createTradeConfig("siding"), sqft: 2000 };
  const vinyl = tradeLabourHours("siding", cfg);
  const stone = tradeLabourHours("siding", {
    ...cfg,
    materialKey: "stone_veneer",
  });
  assert.ok(vinyl > 0);
  assert.ok(
    Math.abs(stone - vinyl * SIDING.materials.stone_veneer.labourFactor) < 0.05,
    `${stone} vs ${vinyl}`,
  );
});

check("a __proto__ cladding falls back rather than resolving", () => {
  const cfg = {
    ...createTradeConfig("siding"),
    sqft: 1000,
    materialKey: "__proto__",
  };
  assert.ok(Number.isFinite(tradeLabourHours("siding", cfg)));
  assert.ok(
    buildTradeLineItems("siding", cfg).every((i) => Number.isFinite(i.amount)),
  );
});

check("every cladding in the book has a rate and a labour factor", () => {
  for (const [key, m] of Object.entries(SIDING.materials)) {
    assert.ok(m.label, key);
    assert.ok(Number(m.pricePerSqft) > 0, key);
    assert.ok(Number(m.labourFactor) > 0, key);
  }
});

/* ── Paving: the fix the flat 0.12 h/sqft needed ───────────────────────── */

const anchor = (over = {}) =>
  paverLabour({ patioSqft: 1220, complexityLevel: "moderate", ...over });

check("the anchor job reproduces the invoice's own six days", () => {
  // Custom Interlocking, 636 Mikinak Rd: 1,220 sqft, "6 Days to complete".
  // At three crew that is ~144 crew-hours, and the component model must land
  // on it or the constants are wrong.
  const r = anchor();
  assert.ok(Math.abs(r.hours - 144) / 144 < 0.06, `${r.hours} crew-hours`);
  const d = paverCrewDays(r.hours, { crewSize: 3 });
  assert.ok(Math.abs(d.days - 6) <= 0.5, `${d.days} days`);
});

check(
  "hours per sqft FALLS with size — the fixed component the flat rate lacked",
  () => {
    const small = paverLabour({ patioSqft: 300, complexityLevel: "moderate" });
    const mid = anchor();
    const big = paverLabour({ patioSqft: 3000, complexityLevel: "moderate" });
    assert.ok(
      small.hoursPerSqft > mid.hoursPerSqft &&
        mid.hoursPerSqft > big.hoursPerSqft,
      `${small.hoursPerSqft} / ${mid.hoursPerSqft} / ${big.hoursPerSqft}`,
    );
    // And the flat rate is wrong at both ends, which is the whole point.
    assert.ok(
      small.hours > 300 * 0.12,
      "a flat rate underquotes the small job",
    );
    assert.ok(big.hours < 3000 * 0.12, "and overquotes the big one");
  },
);

check(
  "depth is a driver: a driveway costs more than a patio of the same area",
  () => {
    const patio = paverLabour({ patioSqft: 3000, complexityLevel: "moderate" });
    const drive = paverLabour({
      drivewaySqft: 3000,
      complexityLevel: "moderate",
    });
    assert.ok(drive.hours > patio.hours, `${drive.hours} vs ${patio.hours}`);
    // 18" of base against 12" is 50% more spoil to dig, haul and replace.
    assert.ok(drive.spoilCuYd > patio.spoilCuYd * 1.3);
  },
);

check("the complexity tier is READ, never asked again", () => {
  const std = anchor({ complexityLevel: "standard" });
  const mod = anchor({ complexityLevel: "moderate" });
  const high = anchor({ complexityLevel: "high" });
  assert.ok(std.hours < mod.hours && mod.hours < high.hours);
  assert.equal(mod.complexity.tierFactor, 1, "moderate is the reference tier");
  // An unknown tier falls back to the reference rather than to 0 hours.
  assert.equal(
    anchor({ complexityLevel: "__proto__" }).complexity.tier,
    "moderate",
  );
  assert.equal(anchor({ complexityLevel: null }).complexity.tier, "moderate");
});

check("poor access and cuts come from the boxes already ticked", () => {
  const plain = anchor();
  const access = anchor({ poorAccess: true });
  const cuts = anchor({ curvesCuts: true });
  assert.ok(access.hours > plain.hours);
  assert.ok(cuts.hours > plain.hours);
  // Cuts touch LAYING only — the hole is the same hole.
  const layPlain = plain.breakdown.find((b) => b.key === "lay").hours;
  const layCuts = cuts.breakdown.find((b) => b.key === "lay").hours;
  const digPlain = plain.breakdown.find((b) => b.key === "excavation").hours;
  const digCuts = cuts.breakdown.find((b) => b.key === "excavation").hours;
  assert.ok(layCuts > layPlain);
  assert.equal(digPlain, digCuts);
});

check("mobilisation and haulage are NOT scaled by complexity", () => {
  const std = anchor({ complexityLevel: "standard", poorAccess: true });
  const high = anchor({ complexityLevel: "high", poorAccess: true });
  assert.equal(std.fixedHours, high.fixedHours);
});

check("paving hours survive hostile input", () => {
  for (const v of [1e308, 1e400, -1, NaN, Infinity, "12abc", null, [], {}]) {
    for (const f of [
      "patioSqft",
      "drivewaySqft",
      "wallFaceSqft",
      "perimeterFt",
    ]) {
      const r = paverLabour({
        patioSqft: 500,
        complexityLevel: "moderate",
        [f]: v,
      });
      assert.ok(Number.isFinite(r.hours) && r.hours >= 0, `${f}=${String(v)}`);
      assert.ok(Number.isFinite(paverCrewDays(r.hours, { crewSize: 3 }).days));
    }
  }
});

check("no area is incomplete, not a free patio", () => {
  for (const cfg of [null, {}, { patioSqft: 0 }, 42, "yard"]) {
    const r = paverLabour(cfg);
    assert.equal(r.incomplete, true, JSON.stringify(cfg));
    assert.equal(r.hours, 0);
  }
});

check("tradeLabourHours delegates paving to the engine", () => {
  const cfg = {
    ...createTradeConfig("paving"),
    patioSqft: 1220,
    complexityLevel: "moderate",
  };
  const hours = tradeLabourHours("paving", cfg);
  const detail = tradeLabourDetail("paving", cfg);
  assert.equal(hours, detail.hours);
  const summed = detail.breakdown.reduce((s, r) => s + r.hours, 0);
  assert.ok(Math.abs(summed - detail.hours) < 0.05);
  // The rate card moves it.
  assert.ok(
    tradeLabourHours("paving", cfg, { labour: { layHoursPerSqft: 0.124 } }) >
      hours,
  );
});

/* ── Insulation: depth, not area ───────────────────────────────────────── */

check(
  "ENERGY STAR targets are the published ones, and a zone is never assumed",
  () => {
    assert.equal(recommendedR(1, "attic", 0), 30);
    assert.equal(recommendedR(2, "attic", 0), 49);
    assert.equal(recommendedR(3, "attic", 0), 49);
    assert.equal(recommendedR(6, "attic", 0), 60);
    assert.equal(recommendedR(8, "attic", 0), 60);
    // The top-up row, where three to four inches are already there.
    assert.equal(recommendedR(1, "attic", 4), 25);
    assert.equal(recommendedR(3, "attic", 4), 38);
    assert.equal(recommendedR(6, "attic", 4), 49);
    assert.equal(recommendedR(6, "floor"), 30);
    // Absence of a recommendation is not a recommendation of zero.
    for (const z of ["", null, undefined, 0, 99, "__proto__", "six"]) {
      assert.equal(recommendedR(z, "attic", 0), null, String(z));
    }
  },
);

check("depth is target minus what is already there, over R per inch", () => {
  const d = depthForTarget({ targetR: 60, existingR: 0, rPerInch: 2.5 });
  assert.equal(d.inches, 24);
  const top = depthForTarget({
    targetR: 49,
    existingDepthIn: 4,
    rPerInch: 2.5,
  });
  assert.equal(top.existingR, 10);
  assert.equal(top.inches, 15.6);
  // Already there: nothing to add, and no negative depth.
  assert.equal(
    depthForTarget({ targetR: 30, existingR: 60, rPerInch: 2.5 }).inches,
    0,
  );
});

check("a cavity that cannot reach the target says so", () => {
  const d = depthForTarget({ targetR: 38, rPerInch: 3.2, maxDepthIn: 5.5 });
  assert.equal(d.capped, true);
  assert.equal(d.inches, 5.5);
  assert.ok(d.addedR < 38);
  const take = insulationTakeoff(
    { sqft: 900, targetR: 38, maxDepthIn: 5.5 },
    {
      label: "batt",
      rPerInch: 3.2,
      hoursPerSqft: 0.012,
      hoursPerSqftPerInch: 0.0006,
    },
  );
  assert.ok(take.warnings.some((w) => /cavity holds/i.test(w)));
});

check("a top-up costs less than a bare attic of the same area", () => {
  const base = {
    ...createTradeConfig("insulation"),
    climateZone: "6",
    sqft: 1200,
  };
  const bare = buildTradeLineItems("insulation", base);
  const top = buildTradeLineItems("insulation", {
    ...base,
    existingDepthIn: 4,
  });
  const sum = (i) => i.reduce((s, l) => s + l.amount, 0);
  assert.ok(sum(top) < sum(bare), `${sum(top)} vs ${sum(bare)}`);
  assert.ok(
    tradeLabourHours("insulation", { ...base, existingDepthIn: 4 }) <
      tradeLabourHours("insulation", base),
  );
  // And the line says what was already there, so the client can see why.
  assert.ok(top.some((l) => /already in place/.test(l.description)));
});

check("the priced result lands inside the published bands", () => {
  const base = {
    ...createTradeConfig("insulation"),
    climateZone: "6",
    sqft: 1200,
    airSeal: false,
  };
  const items = buildTradeLineItems("insulation", base);
  const total = items.reduce((s, l) => s + l.amount, 0);
  // Attic blown-in commonly $1,750-$5,500; blown-in $1.65-$3.80 per sqft.
  assert.ok(total >= 1750 && total <= 5500, `$${total}`);
  const perSqft = total / 1200;
  assert.ok(perSqft >= 1.65 && perSqft <= 3.8, `$${perSqft.toFixed(2)}/sqft`);
});

check("every published Konstruction spray-foam figure is satisfied", () => {
  // Eight independent Toronto figures. Each is converted to dollars per square
  // foot per point of R and the shipped rate must fall inside all eight — which
  // is a stronger claim than "inside a band", because the eight were derived
  // from different units (board feet, $/sqft at a stated thickness, and three
  // whole-project totals) and they agree.
  const R = { spray_closed_cell: [6.5, 7.0], spray_open_cell: [3.5, 4.0] };
  const midR = (k) => (R[k][0] + R[k][1]) / 2;
  const rate = (k) => BOOKS.insulation.materials[k].installedPerSqftPerR;

  const rows = [
    // [material, low, high, implied R the price covers]
    ["spray_closed_cell", 1.5, 3.5, 1 * midR("spray_closed_cell")], // per board foot
    ["spray_closed_cell", 4.5, 7.5, 3 * midR("spray_closed_cell")], // $/sqft at 3"
    ["spray_closed_cell", 4500 / 1000, 8000 / 1000, 20], // basement, OBC R20
    [
      "spray_closed_cell",
      4500 / 1120,
      8500 / 1120,
      2 * midR("spray_closed_cell"),
    ], // garage at 2"
    [
      "spray_closed_cell",
      8000 / 2200,
      18000 / 2200,
      2 * midR("spray_closed_cell"),
    ], // home at 2"
    ["spray_open_cell", 0.8, 1.5, 1 * midR("spray_open_cell")], // per board foot
    ["spray_open_cell", 2.5, 5.0, 3.5 * midR("spray_open_cell")], // $/sqft at 3.5"
    [
      "spray_open_cell",
      2500 / 1120,
      5000 / 1120,
      3.5 * midR("spray_open_cell"),
    ], // garage
  ];

  for (const [key, lo, hi, coveredR] of rows) {
    const perR = rate(key);
    assert.ok(
      perR >= lo / coveredR - 1e-9 && perR <= hi / coveredR + 1e-9,
      `${key} at ${perR} is outside ${(lo / coveredR).toFixed(3)}–${(hi / coveredR).toFixed(3)}`,
    );
  }
});

check(
  "the OBC minimums are the published ones, and are not ENERGY STAR",
  () => {
    assert.equal(codeMinimumR("basement_wall"), 20);
    assert.equal(codeMinimumR("wall"), 22);
    assert.equal(codeMinimumR("attic"), 60);
    // Silent where the code is silent.
    for (const a of ["floor", "", null, "__proto__", "roof"]) {
      assert.equal(codeMinimumR(a), null, String(a));
    }
    // A code minimum and a recommendation are different claims. They agree on
    // the attic in Zone 6 and they have no wall figure in common at all.
    assert.equal(recommendedR(6, "attic", 0), codeMinimumR("attic"));
    assert.equal(recommendedR(6, "wall"), null);
  },
);

check(
  "the target basis is traceable, and manual beats code beats ENERGY STAR",
  () => {
    const base = {
      ...createTradeConfig("insulation"),
      sqft: 500,
      assembly: "wall",
    };
    const code = tradeLabourDetail("insulation", {
      ...base,
      targetBasis: "code",
    });
    assert.equal(code.targetR, 22);
    assert.equal(code.targetBasis, "code");
    const manual = tradeLabourDetail("insulation", {
      ...base,
      targetBasis: "code",
      targetR: 31,
    });
    assert.equal(manual.targetR, 31);
    assert.equal(manual.targetBasis, "manual");
    const es = tradeLabourDetail("insulation", {
      ...base,
      assembly: "attic",
      climateZone: "6",
    });
    assert.equal(es.targetR, 60);
    assert.equal(es.targetBasis, "energy_star");
    // Nothing to go on is "none", not a silent zero dressed as a target.
    assert.equal(tradeLabourDetail("insulation", base).targetBasis, "none");
  },
);

check(
  "open cell is quoted with the vapour barrier it needs; closed cell is not",
  () => {
    const base = {
      ...createTradeConfig("insulation"),
      sqft: 800,
      targetR: 20,
      airSeal: false,
    };
    const open = buildTradeLineItems("insulation", {
      ...base,
      materialKey: "spray_open_cell",
    });
    assert.ok(open.some((i) => /vapour barrier/i.test(i.description)));
    const closed = buildTradeLineItems("insulation", {
      ...base,
      materialKey: "spray_closed_cell",
    });
    assert.ok(
      !closed.some((i) => /vapour barrier/i.test(i.description)),
      "closed cell is its own barrier",
    );
    // And it is a decision, not a trap: turning it off removes the line.
    const off = buildTradeLineItems("insulation", {
      ...base,
      materialKey: "spray_open_cell",
      vapourBarrier: false,
    });
    assert.ok(!off.some((i) => /vapour barrier/i.test(i.description)));
  },
);

/* ── The archived PDF is keyed to the document, not to the quote ───────── */

check("the same document re-downloaded keeps ONE archived copy", () => {
  const q = {
    quoteNumber: "Q-1042",
    companyId: "c",
    clientId: "cl",
    total: "5000",
    lineItems: [{ description: "Roof", amount: 5000 }],
  };
  const key = (x) => `${x.quoteNumber}-${hashQuote(x).slice(0, 12)}`;
  // Display churn must not mint a new file — that is the storage bloat the
  // hash's excluded-fields list exists to prevent.
  assert.equal(
    key(q),
    key({ ...q, updatedAt: new Date("2020-01-01"), pdfUrl: "x" }),
  );
});

check(
  "a revised quote does NOT overwrite what the client already received",
  () => {
    const q = {
      quoteNumber: "Q-1042",
      companyId: "c",
      clientId: "cl",
      total: "5000",
      lineItems: [{ description: "Roof", amount: 5000 }],
    };
    const key = (x) => `${x.quoteNumber}-${hashQuote(x).slice(0, 12)}`;
    // Every part of the deal must move the key. This is the whole point: an
    // archive that overwrites is evidence that deletes itself.
    for (const revised of [
      { ...q, total: "5400" },
      { ...q, lineItems: [{ description: "Roof", amount: 5400 }] },
      { ...q, discount: "100" },
      {
        ...q,
        scopeGroups: [{ categoryId: "x", subtotal: "1", lineItems: [] }],
      },
    ]) {
      assert.notEqual(
        key(revised),
        key(q),
        JSON.stringify(revised).slice(0, 60),
      );
    }
  },
);

check("the PDF routes actually use those keys", () => {
  // A grep, because the alternative is asserting against a route that needs a
  // request, a session and a database. The failure this guards is somebody
  // "simplifying" the key back to the quote number.
  const quotePdf = readFileSync(
    new URL("../app/api/quotes/[id]/pdf/route.js", import.meta.url),
    "utf8",
  );
  assert.match(
    quotePdf,
    /publicId: `\$\{quote\.quoteNumber\}-\$\{hashQuote\(quote\)/,
  );
  const invoicePdf = readFileSync(
    new URL("../app/api/invoices/[id]/pdf/route.js", import.meta.url),
    "utf8",
  );
  assert.match(
    invoicePdf,
    /publicId: `\$\{invoice\.invoiceNumber\}-v\$\{invoice\.version/,
  );
  // And neither may let the archive take down the download again.
  for (const [name, src] of [
    ["quote", quotePdf],
    ["invoice", invoicePdf],
  ]) {
    assert.match(src, /try \{[\s\S]*uploadBuffer[\s\S]*\} catch/, name);
  }
});

/* ── The rate card must not point at fields that do not exist ──────────── */

check(
  "every rate-card row resolves to a real field, in a labelled group",
  () => {
    // Two siding materials silently missed their cost field when it was added by
    // regex, and the rate card would have rendered two rows that read blank and
    // saved nothing. A row pointing at a path the book does not have is a control
    // that appears to work and doesn't — the rule this codebase is swept for.
    const dead = [];
    for (const [key, fields] of Object.entries(PRICE_BOOK_FIELDS)) {
      const book = getPriceBook(key);
      for (const f of fields) {
        if (readField(book, f.path) === undefined)
          dead.push(`${key}: ${f.path}`);
        if (f.group && !PRICE_BOOK_GROUPS[f.group])
          dead.push(`${key}: unlabelled group "${f.group}"`);
      }
    }
    assert.deepEqual(dead, []);
  },
);

/* ── The bill of materials ─────────────────────────────────────────────── */

const bill = (key, takeoff, overrides) =>
  tradeMaterialsFor(key, { ...createTradeConfig(key), ...takeoff }, overrides);

check("every trade with a takeoff-derived bill produces one", () => {
  const cases = {
    roofing_service: {
      areaSqft: 2400,
      pitchRise: 8,
      layers: 1,
      dripEdgeFt: 180,
    },
    siding: { sqft: 2000, trimFt: 200 },
    insulation: { climateZone: "6", sqft: 1200 },
    paving: { patioSqft: 1220, complexityLevel: "moderate" },
  };
  for (const [key, takeoff] of Object.entries(cases)) {
    assert.ok(hasTradeMaterials(key), key);
    const b = bill(key, takeoff);
    assert.ok(b && b.materials.length > 0, `${key} produced nothing`);
    assert.ok(
      b.materials.every((m) => m.qty > 0),
      `${key} has a zero quantity`,
    );
    assert.ok(
      b.materials.every((m) => Number.isFinite(m.cost) && m.cost >= 0),
      key,
    );
  }
  assert.equal(hasTradeMaterials("plumbing"), false);
  assert.equal(bill("plumbing", { sqft: 100 }), null);
});

check("an unpriced material is counted, never costed at zero", () => {
  // Roofing is now priced off Home Depot Canada, so the all-null case moved to
  // the lines that genuinely have no source: chimney flashing is bent from
  // coil on site and has no part number. It must still come out with a
  // quantity, no money, and a place in unpricedCount — a $0 chimney line would
  // tell the margin panel the flashing was free.
  const b = bill("roofing_service", {
    areaSqft: 2400,
    pitchRise: 8,
    layers: 1,
    chimneys: 1,
  });
  const chimney = b.materials.find((m) => /Chimney/.test(m.name));
  assert.ok(chimney, "the chimney line is still on the sourcing list");
  assert.equal(chimney.unitCost, null);
  assert.equal(chimney.cost, 0);
  assert.ok(chimney.unpriced);
  assert.equal(
    b.unpricedCount,
    b.materials.filter((m) => m.unpriced).length,
    "the count is the count",
  );
  // And the rest of the roof is priced, so the total is not zero.
  assert.ok(b.materialTotal > 0);
});

check("roofing is priced, and against the Home Depot Canada reads", () => {
  // 24 squares of architectural shingle at GAF Timberline HDZ, $41.93 a
  // 33.3 sqft bundle, plus 10% waste: 24 x 3 x 1.1 = 79.2 -> 80 bundles.
  const b = bill("roofing_service", {
    areaSqft: 2400,
    pitchRise: 8,
    layers: 1,
  });
  const line = (re) => b.materials.find((m) => re.test(m.name));
  const shingles = line(/bundles/);
  assert.equal(shingles.unitCost, 41.93);
  assert.equal(shingles.qty, 80);
  assert.equal(shingles.cost, 3354.4);
  // Underlayment is a 1,000 sqft roll, so 24 squares plus waste is 3 rolls.
  assert.equal(line(/underlayment/i).qty, 3);
  assert.equal(line(/underlayment/i).unitCost, 151);
  // Nails: a 7,200 coil box does 15 squares at the six-nail pattern.
  assert.equal(line(/nails/i).qty, 2);
  assert.equal(b.unpricedCount, 0, "nothing on this roof is unsourced");
  assert.ok(b.materialTotal > 3000 && b.materialTotal < 5000, b.materialTotal);
});

check("waste moves the quantity and never the unit cost", () => {
  // The rule the owner asked for: 10% more material, at the same price per
  // bundle. Zero the waste on the rate card and the count drops back to the
  // measured roof while every unitCost stays exactly where it was.
  const measured = bill(
    "roofing_service",
    { areaSqft: 2400, pitchRise: 8, layers: 1, dripEdgeFt: 180 },
    { wastePct: 0 },
  );
  const wasted = bill("roofing_service", {
    areaSqft: 2400,
    pitchRise: 8,
    layers: 1,
    dripEdgeFt: 180,
  });
  const qty = (b, re) => b.materials.find((m) => re.test(m.name)).qty;
  const unit = (b, re) => b.materials.find((m) => re.test(m.name)).unitCost;
  assert.equal(qty(measured, /bundles/), 72);
  assert.equal(qty(wasted, /bundles/), 80);
  assert.equal(qty(measured, /Drip edge/), 18);
  assert.equal(qty(wasted, /Drip edge/), 20);
  for (const re of [/bundles/, /Drip edge/, /underlayment/i])
    assert.equal(unit(measured, re), unit(wasted, re), String(re));
  // Counted things are not wasted: nobody buys a tenth of a vent boot.
  const boots = (b) => b.materials.find((m) => /vent boots/i.test(m.name)).qty;
  const withBoots = (over) =>
    bill(
      "roofing_service",
      { areaSqft: 2400, pitchRise: 8, layers: 1, ventBoots: 3 },
      over,
    );
  assert.equal(boots(withBoots()), 3);
  assert.equal(boots(withBoots({ wastePct: 0 })), 3);
});

check("a material that isn't three bundles to a square says so", () => {
  // Metal panel and low-slope membrane carry their own bundlesPerSquare.
  // Ordering 3 panels to a square would buy a third more roof than exists.
  const at = (materialKey) =>
    bill("roofing_service", {
      areaSqft: 2400,
      pitchRise: 8,
      layers: 1,
      materialKey,
    }).materials.find((m) => /bundles/.test(m.name));
  // 24 squares + 10% at 4.3 panels a square (Vicwest UltraVic, 23.25 sqft).
  assert.equal(at("metal_corrugated").qty, Math.ceil(24 * 1.1 * 4.3));
  // One 100 sqft cap sheet roll to a square.
  assert.equal(at("membrane_flat").qty, Math.ceil(24 * 1.1));
  // Cedar's coverage is known (25 sqft a bundle) even though its price is not.
  const cedar = at("cedar_shake");
  assert.equal(cedar.qty, Math.ceil(24 * 1.1 * 4));
  assert.equal(cedar.unitCost, null);
});

check("siding and insulation buy the box the product comes in", () => {
  // Stone veneer is a 49.32 sqft box, not the 200 sqft vinyl default.
  const stone = bill("siding", {
    sqft: 2000,
    materialKey: "stone_veneer",
  }).materials.find((m) => /veneer/i.test(m.name));
  assert.equal(stone.qty, Math.ceil(2000 / 49.32));
  assert.equal(stone.unitCost, 298);
  const vinyl = bill("siding", { sqft: 2000 }).materials.find((m) =>
    /Vinyl/.test(m.name),
  );
  assert.equal(vinyl.qty, 10, "2,000 sqft in 200 sqft boxes");
  assert.equal(vinyl.unitCost, 262);
  // House wrap is a 900 sqft Tyvek roll, not the 1,350 that was never sold.
  const wrap = bill("siding", { sqft: 2000, housewrap: true }).materials.find(
    (m) => /wrap/i.test(m.name),
  );
  assert.equal(wrap.qty, 3);
  assert.equal(wrap.unitCost, 137);
});

check("paving is priced, and against the two Ottawa suppliers", () => {
  const b = bill("paving", {
    patioSqft: 1220,
    complexityLevel: "moderate",
    paverOption: "standard",
  });
  const line = (re) => b.materials.find((m) => re.test(m.name));
  const base = line(/Granular base/);
  const sand = line(/Bedding sand/);
  const delivery = line(/delivery/i);
  // Greely Sand's ladder fits $33.50/cu yd + $190 delivery exactly, and at a
  // full 16-yard load that is $45.38/cu yd. Manotick Gardens lists $45.00.
  assert.ok(
    base.unitCost >= 43 && base.unitCost <= 47,
    `$${base.unitCost}/cu yd`,
  );
  assert.ok(
    sand.unitCost >= 40 && sand.unitCost <= 46,
    `$${sand.unitCost}/cu yd`,
  );
  assert.equal(delivery.unitCost, 190);
  // 1,220 sqft at a 12" frost-region base, plus 20% compaction.
  assert.ok(base.qty > 50 && base.qty < 58, `${base.qty} cu yd`);
  assert.ok(b.materialTotal > 0);
});

check(
  "delivery is charged per LOAD, so it stops scaling with the yardage",
  () => {
    const small = bill("paving", {
      patioSqft: 300,
      complexityLevel: "moderate",
    });
    const big = bill("paving", {
      patioSqft: 3000,
      complexityLevel: "moderate",
    });
    const loads = (b) => b.materials.find((m) => /delivery/i.test(m.name)).qty;
    const yards = (b) =>
      b.materials.find((m) => /Granular base/.test(m.name)).qty;
    assert.ok(loads(big) > loads(small));
    // Per cubic yard, delivery is cheaper on the big job — which is the point.
    assert.ok(
      (loads(big) * 190) / yards(big) < (loads(small) * 190) / yards(small),
    );
  },
);

check("the bill follows the takeoff, not an average", () => {
  const one = bill("roofing_service", {
    areaSqft: 2400,
    pitchRise: 6,
    layers: 1,
  });
  const two = bill("roofing_service", {
    areaSqft: 4800,
    pitchRise: 6,
    layers: 1,
  });
  const bundles = (b) => b.materials.find((m) => /bundles/.test(m.name)).qty;
  // 3 bundles to a square, 24 squares, +10% waste: 79.2 rounded up.
  assert.equal(bundles(one), 80);
  assert.equal(bundles(two), 159);
  // Details are bought by the foot the estimator counted, not by the area.
  const withValleys = bill("roofing_service", {
    areaSqft: 2400,
    pitchRise: 6,
    layers: 1,
    dripEdgeFt: 180,
  });
  assert.equal(
    withValleys.materials.find((m) => /Drip edge/.test(m.name)).qty,
    20,
    "180 ft plus 10% waste, in 10 ft lengths",
  );
});

check("insulation buys by the packaging its material actually comes in", () => {
  const at = (materialKey) =>
    bill("insulation", { climateZone: "6", sqft: 1200, materialKey }).materials;
  assert.ok(at("blown_fiberglass").some((m) => m.unit === "bag"));
  assert.ok(at("batt_fiberglass").some((m) => m.unit === "bundle"));
  assert.ok(at("spray_closed_cell").some((m) => m.unit === "set"));
  assert.ok(at("rigid_board").some((m) => m.unit === "sheet"));
  // And the vapour barrier rides with the material that needs one.
  assert.ok(at("spray_open_cell").some((m) => /vapour barrier/i.test(m.name)));
  assert.ok(
    !at("spray_closed_cell").some((m) => /vapour barrier/i.test(m.name)),
  );
});

check("a top-up buys fewer bags than a bare attic", () => {
  const bags = (over) =>
    bill("insulation", {
      climateZone: "6",
      sqft: 1200,
      ...over,
    }).materials.find((m) => m.unit === "bag").qty;
  assert.ok(bags({ existingDepthIn: 4 }) < bags({}));
});

check("the bill returns NO labour — hours come from tradeLabourHours", () => {
  // Returning hours here as well would count every one of them twice: the
  // quote page already adds tradeLabourHours into manualLabourHours.
  const est = estimateQuoteCost({
    scopeGroups: [
      {
        tempId: "a",
        label: "Roof",
        categoryKey: "roofing_service",
        takeoff: {
          ...createTradeConfig("roofing_service"),
          areaSqft: 2400,
          pitchRise: 8,
          layers: 1,
        },
      },
    ],
    price: 20000,
    labourRatePerHour: 35,
  });
  assert.equal(
    est.groups.reduce((s2, g) => s2 + g.labourHours, 0),
    0,
  );
  // Roofing is priced now, so the panel gets a real material figure rather
  // than a count of blanks. Both facts matter and both are asserted: the
  // money is there, and nothing on this roof is silently costed at zero.
  assert.ok(est.materialTotal > 0, "and the panel is told what it costs");
  assert.equal(est.unpricedMaterials, 0);
});

check("a blank takeoff buys nothing", () => {
  for (const key of ["roofing_service", "siding", "insulation", "paving"]) {
    const b = tradeMaterialsFor(key, createTradeConfig(key));
    assert.deepEqual(b.materials, [], key);
    assert.equal(b.materialTotal, 0, key);
  }
});

check("the bill survives hostile input", () => {
  const bases = {
    roofing_service: { areaSqft: 2400, pitchRise: 8, layers: 1 },
    siding: { sqft: 2000 },
    insulation: { climateZone: "6", sqft: 1200 },
    paving: { patioSqft: 1220 },
  };
  for (const v of [
    1e308,
    1e400,
    -1,
    NaN,
    Infinity,
    "x",
    null,
    [],
    {},
    "__proto__",
  ]) {
    for (const [key, base] of Object.entries(bases)) {
      for (const f of Object.keys(base).concat([
        "materialKey",
        "paverOption",
      ])) {
        const b = tradeMaterialsFor(key, {
          ...createTradeConfig(key),
          ...base,
          [f]: v,
        });
        assert.ok(b, `${key}.${f}=${String(v)} returned null`);
        assert.ok(
          b.materials.every(
            (m) =>
              Number.isFinite(m.qty) && Number.isFinite(m.cost) && m.qty >= 0,
          ),
          `${key}.${f}=${String(v)}`,
        );
        assert.ok(Number.isFinite(b.materialTotal), `${key}.${f}=${String(v)}`);
      }
    }
  }
});

/* ── Process timelines ─────────────────────────────────────────────────── */

check("sourced trades carry timelines; unsourced ones carry none", () => {
  for (const key of [
    "insulation",
    "drywall",
    "general_contracting",
    "construction",
  ]) {
    const steps = resolveServiceContent(key, null).steps;
    assert.ok(steps.length > 0, key);
    assert.ok(
      steps.every((s) => s.timeline),
      `${key} has a step with no timeline`,
    );
  }
  // A duration is the most quotable sentence on a quote. Inventing one for a
  // trade with no source would put a commitment in a contractor's mouth.
  const roofing = resolveServiceContent("roofing_service", null).steps;
  assert.ok(roofing.every((s) => !s.timeline));
});

check("steps stay numbered from 1 whatever a company does to them", () => {
  const custom = resolveServiceContent("insulation", {
    processSteps: [
      { title: "Only step", body: "x", timeline: "1 day" },
      { title: "Second", body: "y" },
    ],
  });
  assert.deepEqual(
    custom.steps.map((s) => s.num),
    [1, 2],
  );
  assert.equal(custom.steps[0].timeline, "1 day");
  assert.equal(custom.steps[1].timeline, undefined);
  // An empty or junk override falls back rather than blanking the document.
  for (const bad of [[], null, "steps", 42, {}]) {
    const r = resolveServiceContent("insulation", { processSteps: bad });
    assert.ok(r.steps.length > 0, JSON.stringify(bad));
  }
});

check("closed-cell and open-cell R per inch match the published specs", () => {
  // Konstruction: closed cell R-6.5 to R-7.0 per inch at 2 lb; open cell
  // R-3.5 to R-4.0 at 0.5 lb. This book must sit inside both.
  const cc = BOOKS.insulation.materials.spray_closed_cell.rPerInch;
  const oc = BOOKS.insulation.materials.spray_open_cell.rPerInch;
  assert.ok(cc >= 6.5 && cc <= 7.0, `closed cell R${cc}/inch`);
  assert.ok(oc >= 3.5 && oc <= 4.0, `open cell R${oc}/inch`);
});

check("the quoted foam LINE lands inside the published $/sqft band", () => {
  // The eight-figure check above proves the RATE. This proves the thing that
  // reaches a client: the priced line for the material, at the thickness the
  // published band is quoted at. Vapour barrier and air sealing are excluded
  // deliberately — they are separate lines here because they are separate
  // work, and folding them in would compare our total against somebody else's
  // subtotal.
  const foamLine = (materialKey, targetR) => {
    const cfg = {
      ...createTradeConfig("insulation"),
      sqft: 1000,
      targetR,
      materialKey,
      airSeal: false,
      vapourBarrier: false,
    };
    return (
      buildTradeLineItems("insulation", cfg).reduce((s, l) => s + l.amount, 0) /
      1000
    );
  };
  const cc = foamLine("spray_closed_cell", 3 * 6.75);
  assert.ok(
    cc >= 4.5 && cc <= 7.5,
    `closed cell $${cc.toFixed(2)}/sqft at 3in`,
  );
  const oc = foamLine("spray_open_cell", 3.5 * 3.75);
  assert.ok(
    oc >= 2.5 && oc <= 5.0,
    `open cell $${oc.toFixed(2)}/sqft at 3.5in`,
  );
});

check("Canadian asphalt roofing quotes inside the local per-sqft band", () => {
  // A Canadian asphalt re-roof commonly quotes $4.50-$7.50 per square foot of
  // roof, tear-off included. The roofing book is US-derived, so this is the
  // check that it did not need the same correction the spray foams did.
  const cfg = {
    ...createTradeConfig("roofing_service"),
    areaSqft: 2400,
    pitchRise: 5,
    layers: 1,
  };
  const perSqft =
    buildTradeLineItems("roofing_service", cfg).reduce(
      (s, i) => s + i.amount,
      0,
    ) / 2400;
  assert.ok(perSqft >= 4.5 && perSqft <= 7.5, `$${perSqft.toFixed(2)}/sqft`);
});

check(
  "vinyl siding reproduces the published installed rate, and says what it adds",
  () => {
    // The published "$6 per square foot installed for vinyl" is the CLADDING.
    // The same source's next sentence — "tear-off, rot repair and trim often
    // swing the total more than the cladding brand" — is the reason those are
    // separate lines here rather than folded in. So the apples-to-apples check
    // is the cladding alone, and the full job is checked against the wider
    // Canadian $4-$10 band that a strip and a weather barrier put it in.
    const sum = (cfg) =>
      buildTradeLineItems("siding", cfg).reduce((s, i) => s + i.amount, 0) /
      2000;
    const bare = sum({
      ...createTradeConfig("siding"),
      sqft: 2000,
      storeys: "one",
      tearOff: false,
      housewrap: false,
    });
    assert.ok(
      Math.abs(bare - 6) < 0.01,
      `cladding alone $${bare.toFixed(2)}/sqft`,
    );
    const full = sum({
      ...createTradeConfig("siding"),
      sqft: 2000,
      storeys: "one",
    });
    assert.ok(
      full > bare,
      "the strip and the wrap are real money, not folded in",
    );
    assert.ok(full >= 4 && full <= 10, `full job $${full.toFixed(2)}/sqft`);
  },
);

check("closed-cell on a wall lands inside the US spray foam band too", () => {
  const cfg = {
    ...createTradeConfig("insulation"),
    sqft: 900,
    targetR: 20,
    materialKey: "spray_closed_cell",
    airSeal: false,
  };
  const perSqft =
    buildTradeLineItems("insulation", cfg).reduce((s, l) => s + l.amount, 0) /
    900;
  assert.ok(perSqft >= 2.75 && perSqft <= 7.5, `$${perSqft.toFixed(2)}/sqft`);
});

check("foil makes no R-value claim anywhere", () => {
  const cfg = {
    ...createTradeConfig("insulation"),
    sqft: 800,
    climateZone: "6",
    materialKey: "radiant_barrier",
    airSeal: false,
  };
  const items = buildTradeLineItems("insulation", cfg);
  assert.equal(items.length, 1);
  assert.ok(!/R\d/.test(items[0].description), items[0].description);
  const d = tradeLabourDetail("insulation", cfg);
  assert.equal(d.rated, false);
  assert.equal(d.finalR, 0);
  assert.ok(d.warnings.some((w) => /emissivity/i.test(w)));
});

check("insulation survives hostile input", () => {
  const base = {
    ...createTradeConfig("insulation"),
    climateZone: "6",
    sqft: 1000,
  };
  for (const v of [1e308, 1e400, -1, NaN, Infinity, "x", null, [], {}]) {
    for (const f of [
      "sqft",
      "existingDepthIn",
      "existingR",
      "targetR",
      "maxDepthIn",
      "baffles",
    ]) {
      const h = tradeLabourHours("insulation", { ...base, [f]: v });
      assert.ok(Number.isFinite(h) && h >= 0, `${f}=${String(v)} -> ${h}`);
      assert.ok(
        buildTradeLineItems("insulation", { ...base, [f]: v }).every((i) =>
          Number.isFinite(i.amount),
        ),
        `${f}=${String(v)}`,
      );
    }
  }
});

check("a blank insulation takeoff prices nothing", () => {
  const cfg = createTradeConfig("insulation");
  assert.equal(cfg.climateZone, "", "no zone is assumed");
  assert.deepEqual(buildTradeLineItems("insulation", cfg), []);
  assert.equal(tradeLabourHours("insulation", cfg), 0);
});

check("insulation carries its own quote wording", () => {
  const c = resolveServiceContent("insulation", null);
  assert.ok(c.included.length > 0);
  assert.ok(c.mayChange.length >= 2);
  assert.ok(c.glossary.some((g) => /R-value/i.test(g.term)));
});

/* ── The quote wording ─────────────────────────────────────────────────── */

check("roofing carries the two new client-facing blocks", () => {
  const c = resolveServiceContent("roofing_service", null);
  assert.ok(c.mayChange.length >= 3);
  assert.ok(c.glossary.length >= 4);
  assert.ok(c.mayChange.every((e) => e.title && e.body));
  assert.ok(c.glossary.every((e) => e.term && e.body));
});

check("a trade with nothing to say says nothing", () => {
  // Absence of a statement is not a statement: a generic "your price may
  // change if..." on behalf of a contractor who never said it is a contract
  // term they did not agree to.
  const c = resolveServiceContent("plumbing", null);
  assert.deepEqual(c.mayChange, []);
  assert.deepEqual(c.glossary, []);
  assert.ok(c.included.length > 0, "the existing content still resolves");
});

check("the glossary follows the money, and survives an empty quote", () => {
  const groups = [
    { categoryKey: "plumbing", subtotal: 400 },
    { categoryKey: "roofing_service", subtotal: 14000 },
  ];
  assert.ok(dominantGlossary(groups).length > 0);
  assert.deepEqual(
    dominantGlossary([{ categoryKey: "plumbing", subtotal: 1 }]),
    [],
  );
  assert.deepEqual(dominantGlossary([]), []);
  assert.deepEqual(dominantGlossary(), []);
});

if (fails.length) {
  console.error(`✗ ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ trade labour & pricing: ${pass} checks passed`);
