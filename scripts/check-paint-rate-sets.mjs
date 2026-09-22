// scripts/check-paint-rate-sets.mjs
//
// Executes the painting takeoff's estimate types, rate sets, flat pricing,
// geometry overrides, per-area options and staining lines — the 2026-09-21
// builder mockup (b1, b2, b3, b4, b6) — against the owner's figures and
// against hostile input. No database, no network, no key.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-paint-rate-sets.mjs
//
// scripts/check-paint-takeoff.mjs still owns the recovered den and exterior
// job to the cent; this file proves that a takeoff WITH an estimate type and
// rate keys reproduces those same cents, and then exercises everything the
// type adds.

import {
  paintTakeoff,
  paintOptionalExtras,
  paintFormula,
  areaGeometry,
  newPaintArea,
  newPaintSubstrate,
  newPaintOption,
  estimateTypeOf,
  rateSetFor,
  ratesForSubstrate,
  substrateFits,
  sanitisePaintRate,
  sanitisePaintTakeoffOverrides,
  PAINT_TAKEOFF_DEFAULTS,
  PAINT_SUBSTRATE_DEFAULTS,
  PAINT_RATE_SET_DEFAULTS,
  PAINT_ESTIMATE_TYPES,
  PAINT_QUICK_PICKS,
  PAINT_AREA_TYPE_DEFAULTS,
  PAINT_OPTIONAL_EXTRAS_CAP,
  areaTypeSurfaces,
} from "@/lib/pricing/paintTakeoff";
import { getPriceBook, TRADE_PRICE_BOOKS } from "@/app/data/tradePriceBooks";
import { sanitiseRates } from "@/lib/pricing/sanitiseRates";
import {
  buildTradeLineItems,
  createTradeConfig,
  tradeOptionalExtras,
  tradeLabourHours,
} from "@/lib/pricing/tradeScope";
import { TRADE_CATALOG } from "@/lib/trades/catalog";
import { readFileSync } from "node:fs";

let passed = 0;
function ok(name, cond, detail) {
  if (!cond) {
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
    process.exitCode = 1;
    return;
  }
  passed += 1;
}
const eq = (name, a, b) => ok(name, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const near = (name, a, b, tol = 1e-9) => ok(name, Math.abs(a - b) <= tol, `expected ~${b}, got ${a}`);

const B = PAINT_TAKEOFF_DEFAULTS;
const sub = (key, patch = {}, type = null) => ({ ...newPaintSubstrate(key, B, { estimateType: type }), ...patch });
const line = (r, key, i = 0) => r.areas[i].lines.find((l) => l.key === key);

/* ══ 1. DEFAULTS — seeded from the substrates, nothing changes ═══════════ */

for (const type of Object.keys(PAINT_ESTIMATE_TYPES)) {
  ok(`defaults: a rate set exists for ${type}`, Boolean(PAINT_RATE_SET_DEFAULTS[type]?.rates));
  ok(`defaults: ${type} has an hourly sell rate`, PAINT_RATE_SET_DEFAULTS[type].hourlySellRate > 0);
}
for (const key of Object.keys(PAINT_SUBSTRATE_DEFAULTS)) {
  if (key === "custom") continue;
  const def = PAINT_SUBSTRATE_DEFAULTS[key];
  const sets = Object.keys(PAINT_ESTIMATE_TYPES).filter((t) => PAINT_ESTIMATE_TYPES[t].surfaces.includes(def.surface));
  ok(`defaults: ${key} belongs to at least one estimate type`, sets.length > 0);
  for (const t of sets) {
    const r = PAINT_RATE_SET_DEFAULTS[t].rates[key];
    ok(`defaults: ${t} set seeds ${key}`, Boolean(r));
    if (!r) continue;
    eq(`defaults: ${t}/${key} points at its substrate`, r.substrate, key);
    if (def.rateBasis === "item") eq(`defaults: ${t}/${key} carries the substrate's hours`, r.hoursPerUnit, def.hoursPerUnit);
    else eq(`defaults: ${t}/${key} carries the substrate's production rate`, r.productionRate, def.productionRate);
  }
}
eq("defaults: 16 ft walls is the mockup's 80", PAINT_RATE_SET_DEFAULTS.interior.rates.walls_16ft.productionRate, 80);
eq("defaults: lots of cutting is 75", PAINT_RATE_SET_DEFAULTS.interior.rates.walls_cutting.productionRate, 75);
eq("defaults: bad condition is FLAT at $1.50", PAINT_RATE_SET_DEFAULTS.interior.rates.walls_bad_condition.sellPerUnit, 1.5);
eq("defaults: bad condition basis", PAINT_RATE_SET_DEFAULTS.interior.rates.walls_bad_condition.basis, "flat");
eq("defaults: the examples say so", PAINT_RATE_SET_DEFAULTS.interior.rates.walls_16ft.provenance, "example");
eq("defaults: the recovered wall rate says so", PAINT_RATE_SET_DEFAULTS.interior.rates.walls.provenance, "recovered");
eq("defaults: the two-storey analogue says so", PAINT_RATE_SET_DEFAULTS.interior.rates.wall_two_storey.provenance, "analogue");
eq("defaults: interior hourly is the den's $85", PAINT_RATE_SET_DEFAULTS.interior.hourlySellRate, 85);
eq("defaults: exterior hourly is the exterior job's $80", PAINT_RATE_SET_DEFAULTS.exterior.hourlySellRate, 80);
eq("defaults: commercial is an analogue copy", PAINT_RATE_SET_DEFAULTS.commercial.rates.walls.provenance, "analogue");
ok("defaults: commercial carries interior AND exterior substrates",
  Boolean(PAINT_RATE_SET_DEFAULTS.commercial.rates.walls) && Boolean(PAINT_RATE_SET_DEFAULTS.commercial.rates.siding_trim));
// The cabinet flat rate is the refinishing book's own number; this file
// cannot import that book from paintTakeoff.js, so the two are held equal here.
eq("defaults: cabinet door flat rate = cabinet_refinishing.perDoor",
  PAINT_RATE_SET_DEFAULTS.cabinets.rates.cab_door_flat.sellPerUnit, TRADE_PRICE_BOOKS.cabinet_refinishing.perDoor);
eq("defaults: drawer flat rate = cabinet_refinishing.perDrawer",
  PAINT_RATE_SET_DEFAULTS.cabinets.rates.cab_drawer_flat.sellPerUnit, TRADE_PRICE_BOOKS.cabinet_refinishing.perDrawer);
// Cabinet hours DERIVED from the owner's per-piece minutes (cabinetLabour.js).
near("defaults: painted cabinet door = (6+3+2.5+2×3)/60 h", PAINT_SUBSTRATE_DEFAULTS.cab_door.hoursPerUnit, 17.5 / 60);
near("defaults: stained cabinet door = (6+3+2.5+3×3)/60 h", PAINT_SUBSTRATE_DEFAULTS.stain_cab_door.hoursPerUnit, 20.5 / 60);
for (const key of Object.keys(PAINT_SUBSTRATE_DEFAULTS)) {
  const def = PAINT_SUBSTRATE_DEFAULTS[key];
  if (def.surface !== "staining") continue;
  ok(`defaults: staining ${key} is marked illustrative or derived`, ["illustrative", "derived"].includes(def.provenance));
  ok(`defaults: staining ${key} names its products`, Array.isArray(def.products) && def.products.length >= 1);
  for (const p of def.products) ok(`defaults: staining ${key} product ${p.productKey} exists`, Boolean(B.products[p.productKey]));
}
for (const key of ["stain_oil", "clear_water", "sanding_sealer", "wall_interior_premium"]) {
  eq(`defaults: ${key} is UNPRICED, not guessed`, B.products[key].costPerGal, null);
}
for (const type of Object.keys(PAINT_QUICK_PICKS)) {
  for (const pick of PAINT_QUICK_PICKS[type]) {
    const def = PAINT_SUBSTRATE_DEFAULTS[pick.key];
    ok(`picks: ${type}/${pick.key} is a substrate`, Boolean(def));
    ok(`picks: ${type}/${pick.key} fits the type`, substrateFits(def, { estimateType: type }));
  }
}
for (const key of Object.keys(PAINT_AREA_TYPE_DEFAULTS)) {
  const surfaces = areaTypeSurfaces(PAINT_AREA_TYPE_DEFAULTS[key]);
  ok(`area types: ${key} belongs to a type`, Object.keys(PAINT_ESTIMATE_TYPES).some((t) => surfaces.some((s) => PAINT_ESTIMATE_TYPES[t].surfaces.includes(s))));
  eq(`area types: ${key} carries no defaultSqft`, "defaultSqft" in PAINT_AREA_TYPE_DEFAULTS[key], false);
}

/* ══ 2. CONTINUITY — the den, with a type and rate keys, to the cent ═════ */

const denArea = (type) => ({
  ...newPaintArea("den", B, { estimateType: type }),
  label: "Den",
  lengthFt: 10,
  widthFt: 13,
  heightFt: 9,
  substrates: [
    sub("ceiling", {}, type),
    sub("walls", {}, type),
    sub("baseboard", {}, type),
    sub("door", { quantity: 3 }, type),
    sub("door_frame", { quantity: 2 }, type),
    sub("closet_small", { quantity: 1 }, type),
    sub("window_sill", { quantity: 1 }, type),
  ],
});
const legacy = paintTakeoff({ model: "area_substrate", areas: [denArea(null)] }, B);
const typed = paintTakeoff({ model: "area_substrate", estimateType: "interior", areas: [denArea("interior")] }, B);
eq("continuity: rows under a type carry the seeded rate key", denArea("interior").substrates[1].rateKey, "walls");
eq("continuity: rows without a type carry none", denArea(null).substrates[1].rateKey, null);
eq("continuity: legacy den total $1,028.94", legacy.total, 1028.94);
eq("continuity: typed den total $1,028.94", typed.total, 1028.94);
eq("continuity: typed den labour", typed.labour, 826.35);
eq("continuity: typed den materials", typed.material, 202.59);
near("continuity: typed den hours", typed.hours, 9.721818181818);
eq("continuity: the type is reported", typed.estimateType, "interior");
eq("continuity: the rate set is reported", typed.rateSet.hourlySellRate, 85);
eq("continuity: legacy reports no type", legacy.estimateType, null);
eq("continuity: legacy reports no rate set", legacy.rateSet, null);
eq("continuity: an unknown type is null", estimateTypeOf({ estimateType: "garden" }), null);
eq("continuity: a __proto__ type is null", estimateTypeOf({ estimateType: "__proto__" }), null);
// Commercial: the analogue copy prices the den identically at $85.
const commercial = paintTakeoff({ model: "area_substrate", estimateType: "commercial", areas: [denArea("commercial")] }, B);
eq("continuity: commercial reproduces the den from its copied card", commercial.total, 1028.94);
// An exterior area under commercial takes the exterior hourly.
const comExt = paintTakeoff({
  model: "area_substrate",
  estimateType: "commercial",
  areas: [{ ...newPaintArea("exterior", B, { estimateType: "commercial" }), surface: "exterior", substrates: [sub("garage_door", { quantity: 1 }, "commercial")] }],
}, B);
eq("continuity: exterior area under commercial bills $80/h", comExt.areas[0].hourlySellRate, 80);
eq("continuity: garage door $160 either way", line(comExt, "garage_door").labour, 160);
eq("continuity: staining hourly is $85", rateSetFor(B, "staining").hourlySellRate, 85);
eq("continuity: no type → no set", rateSetFor(B, null), null);
eq("continuity: junk type → no set", rateSetFor(B, "__proto__"), null);

/* ══ 3. THE MOCKUP'S LIVING ROOM — 15 × 16 × 8 ═══════════════════════════ */

const living = (patch = {}) => ({
  model: "area_substrate",
  estimateType: "interior",
  areas: [{
    ...newPaintArea("living_room", B, { estimateType: "interior" }),
    label: "Living room",
    widthFt: 15,
    lengthFt: 16,
    heightFt: 8,
    substrates: [sub("walls", {}, "interior"), sub("baseboard", {}, "interior"), sub("door", { quantity: 2 }, "interior")],
    ...patch,
  }],
});
const lr = paintTakeoff(living(), B);
eq("living room: 62 lnft", lr.areas[0].geometry.linearFt, 62);
eq("living room: 496 sqft of wall", lr.areas[0].geometry.wallSqft, 496);
eq("living room: 240 sqft ceiling", lr.areas[0].geometry.ceilingSqft, 240);
near("living room: walls 4.96 h", line(lr, "walls").hours, 4.96);
eq("living room: walls labour $421.60", line(lr, "walls").labour, 421.6);
eq("living room: walls paint $147.01", line(lr, "walls").material, 147.01);
eq("living room: walls $568.61", line(lr, "walls").amount, 568.61);
eq("living room: baseboard $137.68", line(lr, "baseboard").amount, 137.68);
eq("living room: door $96.48", line(lr, "door").amount, 96.48);
eq("living room: area total $802.77", lr.areas[0].total, 802.77);
eq("living room: the row says which rate", line(lr, "walls").rateKey, "walls");
eq("living room: and its label", line(lr, "walls").rateLabel, "8 ft walls");
// The ceiling as an optional substrate is the mockup's +$227.43.
const lrCeiling = paintTakeoff(living({ substrates: [sub("walls", {}, "interior"), sub("ceiling", { optional: true }, "interior")] }), B);
eq("living room: optional ceiling $227.43", lrCeiling.optionalSubstrates[0].amount, 227.43);
eq("living room: optional ceiling is out of the total", lrCeiling.total, 568.61);

/* ══ 4. SITUATION-NAMED RATES — production, flat, inline, mismatched ═════ */

const at = (rateKey) => paintTakeoff(living({ substrates: [sub("walls", { rateKey }, "interior")] }), B);
near("rates: 16 ft walls → 496 ÷ 80 = 6.2 h", line(at("walls_16ft"), "walls").hours, 6.2);
eq("rates: 16 ft walls labour $527.00", line(at("walls_16ft"), "walls").labour, 527);
eq("rates: paint is the same whatever the rate", line(at("walls_16ft"), "walls").material, 147.01);
near("rates: lots of cutting → 496 ÷ 75", line(at("walls_cutting"), "walls").hours, 496 / 75);
const bad = line(at("walls_bad_condition"), "walls");
eq("flat: $1.50 × 496 = $744.00", bad.labour, 744);
eq("flat: basis reported", bad.basis, "flat");
eq("flat: sell per unit reported", bad.sellPerUnit, 1.5);
near("flat: hours still schedule at the substrate's 100 sqft/hr", bad.hours, 4.96);
eq("flat: materials unchanged", bad.material, 147.01);
eq("flat: amount = labour + paint", bad.amount, 891.01);
ok("flat: the formula says per square foot", paintFormula({ ...bad, showFormula: true }).includes("$1.50/sqft"));
ok("flat: the formula still shows the hours (displayed at one decimal)", paintFormula({ ...bad, showFormula: true }).includes("(5 h)"));
// Flat with prep: prep bills hourly.
const badPrep = line(paintTakeoff(living({ substrates: [sub("walls", { rateKey: "walls_bad_condition", prepHours: 2 }, "interior")] }), B), "walls");
eq("flat: 2 h prep adds 2 × $85", badPrep.labour, 744 + 170);
// A rate for another substrate is ignored, not applied.
const mismatch = paintTakeoff(living({ substrates: [sub("ceiling", { rateKey: "walls_16ft" }, "interior")] }), B);
near("mismatch: a wall rate on a ceiling row is ignored", line(mismatch, "ceiling").hours, 240 / 110);
eq("mismatch: and the row reports no rate", line(mismatch, "ceiling").rateKey, null);
// An unknown key, a __proto__ key.
near("unknown key: falls back to the substrate", line(at("no_such_rate"), "walls").hours, 4.96);
near("__proto__ key: falls back to the substrate", line(at("__proto__"), "walls").hours, 4.96);
eq("__proto__ key: nothing polluted", {}.productionRate, undefined);
// Inline custom rate on the line.
const inlineRow = sub("walls", { rateKey: null, rate: { label: "My rate", basis: "production", productionRate: 50 } }, "interior");
const inline = line(paintTakeoff(living({ substrates: [inlineRow] }), B), "walls");
near("inline: 496 ÷ 50 = 9.92 h", inline.hours, 9.92);
eq("inline: reported as inline", inline.rateInline, true);
const inlineFlat = line(paintTakeoff(living({ substrates: [sub("walls", { rateKey: null, rate: { basis: "flat", sellPerUnit: 2 } }, "interior")] }), B), "walls");
eq("inline flat: $2 × 496", inlineFlat.labour, 992);
// A set rate wins over an inline one when both are present.
const both = line(paintTakeoff(living({ substrates: [sub("walls", { rateKey: "walls_16ft", rate: { basis: "production", productionRate: 50 } }, "interior")] }), B), "walls");
near("both: the set's key wins", both.hours, 6.2);

/* ══ 5. EMPTY SETS, ZERO RATES, HIDDEN RATES ═════════════════════════════ */

const emptySet = { ...B, rateSets: { interior: { rates: {} } } };
const es = paintTakeoff(living(), emptySet);
near("empty set: rows fall back to the substrate", line(es, "walls").hours, 4.96);
eq("empty set: hourly falls back to the book's $85", es.areas[0].hourlySellRate, 85);
eq("empty set: total is the mockup's", es.areas[0].total, 802.77);
const noSets = paintTakeoff(living(), { ...B, rateSets: undefined });
eq("no sets at all: total is the mockup's", noSets.areas[0].total, 802.77);
const junkSets = paintTakeoff(living(), { ...B, rateSets: "nope" });
eq("junk sets: total is the mockup's", junkSets.areas[0].total, 802.77);
const zeroRate = { ...B, rateSets: { interior: { hourlySellRate: 0, rates: { walls: { substrate: "walls", basis: "production", productionRate: 0 } } } } };
const zr = paintTakeoff(living(), zeroRate);
near("zero rate: 0 sqft/hr falls back to the substrate's 100", line(zr, "walls").hours, 4.96);
eq("zero rate: a 0 hourly falls back to the book's $85", zr.areas[0].hourlySellRate, 85);
const zeroFlat = line(paintTakeoff(living({ substrates: [sub("walls", { rateKey: null, rate: { basis: "flat", sellPerUnit: 0 } }, "interior")] }), B), "walls");
eq("zero flat: labour is 0, not NaN", zeroFlat.labour, 0);
eq("zero flat: the line is paint only", zeroFlat.amount, 147.01);
ok("zero flat: nothing at $0 reaches the client", buildTradeLineItems("interior_painting", living({ substrates: [sub("walls", { rateKey: null, rate: { basis: "flat", sellPerUnit: 0 }, noProduct: true }, "interior")] }), null).length === 0);
const negRate = line(paintTakeoff(living(), { ...B, rateSets: { interior: { hourlySellRate: -85, rates: { walls: { substrate: "walls", basis: "flat", sellPerUnit: -3 } } } } }), "walls");
eq("negative flat: never negative money", negRate.labour, 0);
const infRate = paintTakeoff(living(), { ...B, rateSets: { interior: { hourlySellRate: 1e400, rates: { walls: { substrate: "walls", basis: "production", productionRate: 1e-320 } } } } });
ok("infinite hourly: total stays finite", Number.isFinite(infRate.total));
// Hidden rates are skipped by the engine and the picker.
const hiddenBook = getPriceBook("interior_painting", { takeoff: { rateSets: { interior: { rates: { walls_16ft: { hidden: true } } } } } }).takeoff;
near("hidden: a hidden rate key falls back to the substrate", line(paintTakeoff(living({ substrates: [sub("walls", { rateKey: "walls_16ft" }, "interior")] }), hiddenBook), "walls").hours, 4.96);
ok("hidden: the picker omits it", !ratesForSubstrate(rateSetFor(hiddenBook, "interior"), "walls").some((r) => r.key === "walls_16ft"));
const picker = ratesForSubstrate(rateSetFor(B, "interior"), "walls");
eq("picker: the substrate's own rate is first", picker[0].key, "walls");
ok("picker: lists every wall rate", ["walls_16ft", "walls_cutting", "walls_bad_condition"].every((k) => picker.some((r) => r.key === k)));
ok("picker: lists no ceiling rate", !picker.some((r) => r.substrate === "ceiling"));
eq("picker: junk set → []", ratesForSubstrate(null, "walls").length, 0);
eq("picker: junk rates → []", ratesForSubstrate({ rates: "x" }, "walls").length, 0);

/* ══ 6. GEOMETRY OVERRIDES — the editable strip ═════════════════════════ */

const ov = (patch) => paintTakeoff(living(patch), B);
eq("override: wall sqft 400 drives the walls line", line(ov({ wallSqftOverride: 400 }), "walls").quantity, 400);
eq("override: linear ft 50 drives the baseboard", line(ov({ linearFtOverride: 50 }), "baseboard").quantity, 50);
eq("override: the derived figure is still reported", ov({ wallSqftOverride: 400 }).areas[0].derived.wallSqft, 496);
eq("override: 0 is an override (no ceiling)", ov({ ceilingSqftOverride: 0, substrates: [sub("ceiling", {}, "interior")] }).areas[0].lines.length, 0);
eq("override: null is not", areaGeometry({ measurement: "area", lengthFt: 16, widthFt: 15, heightFt: 8, wallSqftOverride: null }).wallSqft, 496);
eq("override: '' is not", areaGeometry({ measurement: "area", lengthFt: 16, widthFt: 15, heightFt: 8, wallSqftOverride: "" }).wallSqft, 496);
eq("override: 'abc' is not", areaGeometry({ measurement: "area", lengthFt: 16, widthFt: 15, heightFt: 8, wallSqftOverride: "abc" }).wallSqft, 496);
eq("override: 1e400 is not", areaGeometry({ measurement: "area", lengthFt: 16, widthFt: 15, heightFt: 8, wallSqftOverride: 1e400 }).wallSqft, 496);
eq("override: a negative wall is 0", areaGeometry({ measurement: "area", lengthFt: 16, widthFt: 15, heightFt: 8, wallSqftOverride: -40 }).wallSqft, 0);
eq("override: a single wall refuses a ceiling", areaGeometry({ measurement: "wall", linearFt: 20, heightFt: 8, ceilingSqftOverride: 100 }).ceilingSqft, 0);
eq("override: a single wall refuses a floor", areaGeometry({ measurement: "surface", surfaceSqft: 200, floorSqftOverride: 100 }).floorSqft, 0);
eq("override: a single wall still takes a wall override", areaGeometry({ measurement: "wall", linearFt: 20, heightFt: 8, wallSqftOverride: 150 }).wallSqft, 150);
eq("override: legacy `surface` style still reads its sqft", areaGeometry({ measurement: "surface", surfaceSqft: 2340, linearFt: 260 }).wallSqft, 2340);

/* ══ 7. OPTIONS — extra coat, premium paint, custom ══════════════════════ */

const withOptions = (options, patch = {}) => paintTakeoff(living({ options, ...patch }), B);
const extra = withOptions([newPaintOption("extra_coat", { substrateIndex: 0 })]);
const xc = extra.areas[0].options[0];
ok("extra coat: priced", Boolean(xc));
near("extra coat: 50% of 4.96 h", xc.hours, 2.48);
eq("extra coat: labour 2.48 × $85", xc.labour, 210.8);
eq("extra coat: one more coat of paint, 496 ÷ 350 gal", xc.material, 73.51);
eq("extra coat: $284.31", xc.amount, 284.31);
eq("extra coat: the takeoff's figure is reported", xc.computedAmount, 284.31);
eq("extra coat: not custom", xc.custom, false);
eq("extra coat: default label", xc.label, "Extra coat on walls");
eq("extra coat: the included total is untouched", extra.areas[0].total, 802.77);
const xcCustom = withOptions([newPaintOption("extra_coat", { substrateIndex: 0, amount: 180, label: "Extra coat on walls" })]).areas[0].options[0];
eq("extra coat: a typed amount wins", xcCustom.amount, 180);
eq("extra coat: and is marked custom", xcCustom.custom, true);
eq("extra coat: the takeoff's figure is still there", xcCustom.computedAmount, 284.31);
const xcNoLabour = paintTakeoff(living({ options: [newPaintOption("extra_coat", { substrateIndex: 0 })] }), { ...B, extraCoatHoursPct: 0 }).areas[0].options[0];
eq("extra coat: at 0% it is paint alone", xcNoLabour.amount, 73.51);
const xcOnMissing = withOptions([newPaintOption("extra_coat", { substrateIndex: 9 })]);
eq("extra coat: on a row that does not exist → no option", xcOnMissing.areas[0].options.length, 0);
const xcOnOptional = withOptions([newPaintOption("extra_coat", { substrateIndex: 0 })], { substrates: [sub("walls", { optional: true }, "interior")] });
eq("extra coat: on an optional row → no option", xcOnOptional.areas[0].options.length, 0);
const xcNoProduct = withOptions([newPaintOption("extra_coat", { substrateIndex: 0 })], { substrates: [sub("walls", { noProduct: true }, "interior")] }).areas[0].options[0];
eq("extra coat: on a no-product line is labour alone", xcNoProduct.amount, 210.8);

// Premium: unpriced by default, priced through an override.
const prem = withOptions([newPaintOption("premium_paint", { substrateIndex: 0, productKey: "wall_interior_premium" })]).areas[0].options[0];
eq("premium: unpriced product → amount null", prem.amount, null);
eq("premium: and says so", prem.unpriced, true);
eq("premium: default label names the product", prem.label, "Premium paint upgrade (Premium interior wall)");
const pricedBook = getPriceBook("interior_painting", { takeoff: { products: { wall_interior_premium: { costPerGal: 70 } } } }).takeoff;
const prem2 = paintTakeoff(living({ options: [newPaintOption("premium_paint", { substrateIndex: 0, productKey: "wall_interior_premium" })] }), pricedBook).areas[0].options[0];
eq("premium: 2.834 gal × ($70) − $147.01 = $51.39", prem2.amount, 51.39);
eq("premium: no hours", prem2.hours, 0);
const premCustom = withOptions([newPaintOption("premium_paint", { substrateIndex: 0, productKey: "wall_interior_premium", amount: 96 })]).areas[0].options[0];
eq("premium: a typed amount prices an unpriced product", premCustom.amount, 96);
eq("premium: unknown product → no option", withOptions([newPaintOption("premium_paint", { substrateIndex: 0, productKey: "__proto__" })]).areas[0].options.length, 0);
// A cheaper "premium" never refunds.
const cheaper = paintTakeoff(living({ options: [newPaintOption("premium_paint", { substrateIndex: 0, productKey: "ceiling_flat" })] }), B).areas[0].options[0];
eq("premium: a cheaper product floors at $0", cheaper.amount, 0);

// Custom.
const custom = withOptions([newPaintOption("custom", { label: "Colour consult", amount: 120 })]).areas[0].options[0];
eq("custom: priced by hand", custom.amount, 120);
eq("custom: no amount → unpriced", withOptions([newPaintOption("custom", { label: "x" })]).areas[0].options[0].amount, null);
eq("custom: junk kind → dropped", withOptions([{ kind: "magic", amount: 5 }]).areas[0].options.length, 0);
eq("custom: junk entries → dropped", withOptions([null, 7, "x", []]).areas[0].options.length, 0);
eq("custom: 1e400 amount → 0", withOptions([newPaintOption("custom", { label: "x", amount: 1e400 })]).areas[0].options[0].amount ?? 0, 0);
eq("custom: negative amount → 0", withOptions([newPaintOption("custom", { label: "x", amount: -50 })]).areas[0].options[0].amount, 0);

// Through to the client: paintOptionalExtras and tradeOptionalExtras.
const offers = paintOptionalExtras(living({
  options: [
    newPaintOption("extra_coat", { substrateIndex: 0 }),
    newPaintOption("premium_paint", { substrateIndex: 0, productKey: "wall_interior_premium" }),
    newPaintOption("custom", { label: "Colour consult", amount: 120, detail: "An hour with our colour consultant" }),
  ],
  substrates: [sub("walls", {}, "interior"), sub("ceiling", { optional: true }, "interior")],
}), B);
eq("offers: ceiling + extra coat + custom (premium unpriced is left out)", offers.length, 3);
eq("offers: the ceiling names its room", offers[0].areaLabel, "Living room");
eq("offers: the ceiling is a substrate offer", offers[0].kind, "substrate");
eq("offers: the extra coat is named under its room", offers[1].description, "Living room — Extra coat on walls");
eq("offers: the extra coat kind", offers[1].kind, "extra_coat");
eq("offers: the custom option's detail travels", offers[2].detail, "An hour with our colour consultant");
ok("offers: none carries a rate", offers.every((o) => !("rate" in o) && !("hourlySellRate" in o) && !("productionRate" in o)));
eq("offers: tradeOptionalExtras passes areaLabel through", tradeOptionalExtras("interior_painting", living({ substrates: [sub("ceiling", { optional: true }, "interior")] }), null)[0].areaLabel, "Living room");
ok("offers: the cap is above the editor's 8 and finite", PAINT_OPTIONAL_EXTRAS_CAP > 8 && PAINT_OPTIONAL_EXTRAS_CAP <= 100);
const many = paintOptionalExtras({
  model: "area_substrate",
  estimateType: "interior",
  areas: Array.from({ length: 30 }, (_, i) => ({ ...living().areas[0], label: `Room ${i}`, options: [newPaintOption("custom", { label: "a", amount: 1 }), newPaintOption("custom", { label: "b", amount: 1 })] })),
}, B);
eq("offers: capped", many.length, PAINT_OPTIONAL_EXTRAS_CAP);
// An optional AREA's own options are not offered separately.
const optArea = paintTakeoff(living({ optional: true, options: [newPaintOption("custom", { label: "x", amount: 5 })] }), B);
eq("offers: an optional area's options stay inside it", optArea.options.length, 0);

/* ══ 8. STAINING — two products per line ═════════════════════════════════ */

const kitchen = (book = B) => paintTakeoff({
  model: "area_substrate",
  estimateType: "staining",
  areas: [{
    ...newPaintArea("kitchen", book, { estimateType: "staining" }),
    label: "Kitchen",
    substrates: [sub("stain_cab_door", { quantity: 26 }, "staining"), sub("stain_cab_drawer", { quantity: 9 }, "staining")],
  }],
}, book);
const k = kitchen();
eq("staining: a kitchen under Staining is a staining area", newPaintArea("kitchen", B, { estimateType: "staining" }).surface, "staining");
const doors = line(k, "stain_cab_door");
near("staining: 26 doors × 0.3417 h", doors.hours, 26 * 20.5 / 60);
eq("staining: labour at $85", doors.labour, 755.08);
eq("staining: two products on the line", doors.materials.length, 2);
near("staining: stain gallons 26 × 6.25 ÷ 400", doors.materials[0].gallons, 26 * 6.25 / 400);
near("staining: clear gallons 26 × 6.25 × 2 ÷ 400", doors.materials[1].gallons, 26 * 6.25 * 2 / 400);
eq("staining: unpriced products cost nothing and say so", doors.material, null);
eq("staining: counted as unpriced", doors.unpriced, true);
eq("staining: two lines with unpriced paint count as two, not four", k.unpricedCount, 2);
eq("staining: the buy list has stain and clear", k.purchase.length, 2);
ok("staining: gallons roll up per product", k.purchase.find((p) => p.productKey === "clear_water").fractionalGallons > k.purchase.find((p) => p.productKey === "stain_oil").fractionalGallons);
eq("staining: line.gallons is the first product's, for older readers", doors.gallons, doors.materials[0].gallons);
const pricedStain = getPriceBook("interior_painting", { takeoff: { products: { stain_oil: { costPerGal: 60 }, clear_water: { costPerGal: 55 } } } }).takeoff;
const kp = line(kitchen(pricedStain), "stain_cab_door");
eq("staining: priced → 0.40625 × 60 + 0.8125 × 55", kp.material, 69.07);
eq("staining: nothing unpriced once priced", kitchen(pricedStain).unpricedCount, 0);
// Per-product coats on the row.
const rowCoats = sub("stain_cab_door", { quantity: 26, products: [{ productKey: "stain_oil", coats: 2 }, { productKey: "clear_water", coats: 3 }] }, "staining");
const rc = line(paintTakeoff({ model: "area_substrate", estimateType: "staining", areas: [{ ...newPaintArea("kitchen", B, { estimateType: "staining" }), substrates: [rowCoats] }] }, B), "stain_cab_door");
near("staining: the row's own coats per product", rc.materials[1].gallons, 26 * 6.25 * 3 / 400);
eq("staining: absurd coats fall back to the substrate's (1 coat of stain)", line(paintTakeoff({ model: "area_substrate", estimateType: "staining", areas: [{ ...newPaintArea("kitchen", B, { estimateType: "staining" }), substrates: [sub("stain_cab_door", { quantity: 1, products: [{ productKey: "stain_oil", coats: 99 }] }, "staining")] }] }, B), "stain_cab_door").materials[0].coats, 1);
eq("staining: junk products → falls back to the substrate's", line(paintTakeoff({ model: "area_substrate", estimateType: "staining", areas: [{ ...newPaintArea("kitchen", B, { estimateType: "staining" }), substrates: [sub("stain_cab_door", { quantity: 1, products: "x" }, "staining")] }] }, B), "stain_cab_door").materials.length, 2);
eq("staining: a deck reads the floor area", line(paintTakeoff({ model: "area_substrate", estimateType: "staining", areas: [{ ...newPaintArea("deck", B, { estimateType: "staining" }), lengthFt: 12, widthFt: 16, heightFt: 0, substrates: [sub("stain_deck", {}, "staining")] }] }, B), "stain_deck").quantity, 192);
eq("staining: flat cabinet rate from the cabinets set — $150 a door", line(paintTakeoff({ model: "area_substrate", estimateType: "cabinets", areas: [{ ...newPaintArea("kitchen", B, { estimateType: "cabinets" }), substrates: [sub("cab_door", { quantity: 10, rateKey: "cab_door_flat" }, "cabinets")] }] }, B), "cab_door").labour, 1500);
near("cabinets: hours still schedule from the owner's minutes", line(paintTakeoff({ model: "area_substrate", estimateType: "cabinets", areas: [{ ...newPaintArea("kitchen", B, { estimateType: "cabinets" }), substrates: [sub("cab_door", { quantity: 10, rateKey: "cab_door_flat" }, "cabinets")] }] }, B), "cab_door").hours, 10 * 17.5 / 60);

/* ══ 9. A CUSTOM LINE ════════════════════════════════════════════════════ */

const customLine = line(paintTakeoff(living({ substrates: [sub("custom", { label: "Move the piano", unit: "job", quantity: 1, rate: { basis: "flat", sellPerUnit: 150 } }, "interior")] }), B), "custom");
eq("custom line: flat $150", customLine.labour, 150);
eq("custom line: its own unit", customLine.unit, "job");
eq("custom line: no product", customLine.noProduct, true);
eq("custom line: with no rate it produces nothing", paintTakeoff(living({ substrates: [sub("custom", { quantity: 1 }, "interior")] }), B).areas[0].lines.length, 0);

/* ══ 10. THE SANITISER — the rate card's boundary ════════════════════════ */

const S = sanitisePaintTakeoffOverrides;
eq("sanitise: null → null", S(null), null);
eq("sanitise: [] → null", S([]), null);
eq("sanitise: {} → null", S({}), null);
eq("sanitise: junk → null", S({ rateSets: "x", products: 7, extraCoatHoursPct: "abc" }), null);
const good = S({
  extraCoatHoursPct: 35,
  materialMarkupPct: "12",
  rateSets: {
    interior: {
      hourlySellRate: 95,
      rates: {
        walls_16ft: { label: "16 ft walls", substrate: "walls", basis: "production", productionRate: 90, provenance: "recovered" },
        c_new: { label: "  Textured   walls ", situation: "Knockdown", substrate: "walls", basis: "flat", sellPerUnit: 2.25 },
        hide_me: { hidden: true },
        zero: { label: "Zero", substrate: "walls", basis: "production", productionRate: 0 },
        flatless: { label: "No price", substrate: "walls", basis: "flat" },
        stranger: { label: "x", substrate: "roof", basis: "production", productionRate: 5 },
        "Bad Key!": { label: "x", substrate: "walls", basis: "production", productionRate: 5 },
        __proto__: { label: "x", substrate: "walls", basis: "production", productionRate: 5 },
      },
    },
    garden: { hourlySellRate: 1 },
    __proto__: { hourlySellRate: 1 },
  },
  products: {
    wall_interior: { costPerGal: 55, label: "Interior wall" },
    stain_oil: { costPerGal: 60 },
    aura: { label: "Aura", coverageSqftPerGal: 400, costPerGal: 80, surface: "interior", premiumFor: "wall_interior" },
    nameless: { coverageSqftPerGal: 400, costPerGal: 80 },
    coverless: { label: "x", costPerGal: 80 },
    __proto__: { label: "x", coverageSqftPerGal: 1 },
  },
});
eq("sanitise: extra coat pct kept", good.extraCoatHoursPct, 35);
eq("sanitise: markup coerced", good.materialMarkupPct, 12);
eq("sanitise: hourly kept", good.rateSets.interior.hourlySellRate, 95);
eq("sanitise: a default rate's figure kept", good.rateSets.interior.rates.walls_16ft.productionRate, 90);
eq("sanitise: provenance is never the client's to set", good.rateSets.interior.rates.walls_16ft.provenance, "custom");
eq("sanitise: label whitespace collapsed", good.rateSets.interior.rates.c_new.label, "Textured walls");
eq("sanitise: flat rate kept", good.rateSets.interior.rates.c_new.sellPerUnit, 2.25);
eq("sanitise: hidden kept", good.rateSets.interior.rates.hide_me.hidden, true);
eq("sanitise: a zero rate dropped", good.rateSets.interior.rates.zero, undefined);
eq("sanitise: a flat rate with no price dropped", good.rateSets.interior.rates.flatless, undefined);
eq("sanitise: an unknown substrate dropped", good.rateSets.interior.rates.stranger, undefined);
eq("sanitise: a bad key dropped", good.rateSets.interior.rates["Bad Key!"], undefined);
eq("sanitise: an unknown type dropped", good.rateSets.garden, undefined);
eq("sanitise: __proto__ set dropped", Object.prototype.hasOwnProperty.call(good.rateSets, "__proto__"), false);
eq("sanitise: __proto__ rate dropped", Object.prototype.hasOwnProperty.call(good.rateSets.interior.rates, "__proto__"), false);
eq("sanitise: a known product's cost kept", good.products.wall_interior.costPerGal, 55);
eq("sanitise: a known product's unchanged label not stored", good.products.wall_interior.label, undefined);
eq("sanitise: staining product priced", good.products.stain_oil.costPerGal, 60);
eq("sanitise: a new product kept with its coverage", good.products.aura.coverageSqftPerGal, 400);
eq("sanitise: a new product's upgrade target kept", good.products.aura.premiumFor, "wall_interior");
eq("sanitise: a nameless new product dropped", good.products.nameless, undefined);
eq("sanitise: a coverless new product dropped", good.products.coverless, undefined);
eq("sanitise: __proto__ product dropped", Object.prototype.hasOwnProperty.call(good.products, "__proto__"), false);
eq("sanitise: Object.prototype untouched", {}.hourlySellRate, undefined);
eq("sanitise rate: 1e400 figure dropped", sanitisePaintRate({ label: "x", substrate: "walls", basis: "production", productionRate: 1e400 }), null);
eq("sanitise rate: negative dropped", sanitisePaintRate({ label: "x", substrate: "walls", basis: "flat", sellPerUnit: -1 }), null);
eq("sanitise rate: 'any' substrate allowed", sanitisePaintRate({ label: "x", substrate: "any", basis: "flat", sellPerUnit: 1 }).substrate, "any");
eq("sanitise rate: label capped at 80", sanitisePaintRate({ label: "x".repeat(200), substrate: "walls", basis: "flat", sellPerUnit: 1 }).label.length, 80);

// Through sanitiseRates, beside the declared coverage path, and only for painting.
const merged = sanitiseRates("interior_painting", {
  takeoff: {
    products: { wall_interior: { coverageSqftPerGal: 320, costPerGal: 55 } },
    rateSets: { interior: { rates: { walls_16ft: { label: "16 ft walls", substrate: "walls", basis: "production", productionRate: 90 } } } },
  },
});
eq("sanitiseRates: the declared coverage path survives", merged.takeoff.products.wall_interior.coverageSqftPerGal, 320);
eq("sanitiseRates: the cost lands beside it", merged.takeoff.products.wall_interior.costPerGal, 55);
eq("sanitiseRates: the rate set lands", merged.takeoff.rateSets.interior.rates.walls_16ft.productionRate, 90);
eq("sanitiseRates: exterior_painting accepts the same subtree", sanitiseRates("exterior_painting", { takeoff: { extraCoatHoursPct: 40 } }).takeoff.extraCoatHoursPct, 40);
eq("sanitiseRates: a roofer's rates carry no takeoff", sanitiseRates("roofing_service", { takeoff: { extraCoatHoursPct: 40 } }), null);
// And the merge into the book keeps every other default.
const book = getPriceBook("interior_painting", merged);
eq("merge: the overridden rate", book.takeoff.rateSets.interior.rates.walls_16ft.productionRate, 90);
eq("merge: its label from the override", book.takeoff.rateSets.interior.rates.walls_16ft.label, "16 ft walls");
eq("merge: the other rates untouched", book.takeoff.rateSets.interior.rates.walls.productionRate, 100);
eq("merge: the other sets untouched", book.takeoff.rateSets.exterior.rates.siding_trim.productionRate, 100);
// Walls: 414 × 2 ÷ 320 = 2.5875 gal × $55 = $142.31 (was $122.71); the small
// closet drinks the same paint: 85 × 2 ÷ 320 × $55 = $29.22 (was $25.19).
eq("merge: the den reprices by exactly the two wall-paint lines", paintTakeoff({ model: "area_substrate", estimateType: "interior", areas: [denArea("interior")] }, book.takeoff).total, 1052.57);
eq("merge: the den's wall paint at 320 sqft/gal and $55", line(paintTakeoff({ model: "area_substrate", estimateType: "interior", areas: [denArea("interior")] }, book.takeoff), "walls").material, 142.31);

/* ══ 11. SCOPE, CONFIG, ICONS ════════════════════════════════════════════ */

eq("config: interior opens on Interior", createTradeConfig("interior_painting").estimateType, "interior");
eq("config: exterior opens on Exterior", createTradeConfig("exterior_painting").estimateType, "exterior");
eq("config: exterior's seeded area is an exterior one", createTradeConfig("exterior_painting").areas[0].surface, "exterior");
const noted = buildTradeLineItems("interior_painting", living({ clientNote: "Furniture moved by the client" }), null);
eq("scope: the client note prints under the first line", noted[0].detail, "Furniture moved by the client");
eq("scope: and only the first", noted[1].detail, undefined);
eq("scope: no note, no detail", buildTradeLineItems("interior_painting", living(), null)[0].detail, undefined);
ok("scope: a flat line reaches the document at its flat price",
  buildTradeLineItems("interior_painting", living({ substrates: [sub("walls", { rateKey: "walls_bad_condition" }, "interior")] }), null)[0].amount === 891.01);
near("costing: hours for a flat line still reach the cost panel",
  tradeLabourHours("interior_painting", living({ substrates: [sub("walls", { rateKey: "walls_bad_condition" }, "interior")] }), null), 4.96);
ok("scope: nothing in a line item names the rate",
  buildTradeLineItems("interior_painting", living(), null).every((i) => !JSON.stringify(i).includes("sqft/hr") && !("rateKey" in i)));

// Every icon the trade catalogue names is in ServiceTiles' curated map, so
// no tile falls back to the Package box (Interior Painting did).
const tilesSrc = readFileSync(new URL("../app/components/quotes/builder/ServiceTiles.js", import.meta.url), "utf8");
const mapSrc = tilesSrc.slice(tilesSrc.indexOf("const ICONS = {"), tilesSrc.indexOf("};", tilesSrc.indexOf("const ICONS = {")));
for (const icon of new Set(Object.values(TRADE_CATALOG).map((c) => c.icon).filter(Boolean))) {
  ok(`icons: ServiceTiles maps ${icon}`, new RegExp(`\\b${icon}\\b`).test(mapSrc));
}

/* ══ Done ════════════════════════════════════════════════════════════════ */

if (process.exitCode) {
  console.error("\npaint rate sets: FAILED");
} else {
  console.log(`paint rate sets: ${passed} assertions passed`);
  console.log("  living room 15×16×8 @ interior set — $802.77; 16 ft walls $527.00; bad condition $1.50/sqft $744.00; extra coat $284.31");
  console.log("  den with estimate type + rate keys — $1,028.94, unchanged");
}
