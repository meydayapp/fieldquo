// scripts/check-roof-labour.mjs
//
// Executes the roofing labour engine, the roofing and siding scope builders
// that read it, and the client-facing wording both trades put on a quote —
// against hostile input and against the reference calculator and published
// price bands this model was reconciled with. No database, no network, no key.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-roof-labour.mjs
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
import {
  roofLabour,
  roofCrewDays,
  pitchBand,
  slopedAreaSqft,
  PITCH_BANDS,
  ROOF_LABOUR_DEFAULTS,
} from "@/lib/pricing/roofLabour";
import {
  buildTradeLineItems,
  createTradeConfig,
  tradeLabourHours,
  tradeLabourDetail,
} from "@/lib/pricing/tradeScope";
import { getPriceBook } from "@/app/data/tradePriceBooks";
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
console.log(`✓ roofing & siding: ${pass} checks passed`);
