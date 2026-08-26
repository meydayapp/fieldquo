// scripts/check-paint-takeoff.mjs
//
// Executes the painting takeoff engine against the owner's OWN COMPLETED JOBS
// and asserts every figure to the cent. No database, no network, no key.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-paint-takeoff.mjs
//
// ── Why this file is the specification ─────────────────────────────────────
//
// Every production rate, paint price and coverage figure in
// lib/pricing/paintTakeoff.js was recovered by solving the owner's own invoices
// backwards. That makes them fragile in a specific way: they look like round
// numbers somebody could tidy. $47.83 a gallon looks like a typo for $47.85.
// 7/3 sqft per linear foot looks like it wants to be 2.
//
// It isn't and it doesn't. Change any one of them and a job he was actually
// paid for stops reproducing, which is what the assertions below are for.
//
// ── The two figures of his that do NOT reconcile ───────────────────────────
//
// Both are asserted here as NON-matches, deliberately, so that nobody later
// "fixes" the working arithmetic to agree with them:
//
//   1. "464 sqft ÷ 100 sqft/hr × $80/hr + prep $0 = $462". That arithmetic is
//      $371.20. The engine returns $371.20.
//   2. Soffit and fascia, 260 lnft at 30 lnft/hr, shown as $693.60. Exact
//      hours give $693.33. The $0.27 is his displayed 8.67 h multiplied by $80
//      — the round-then-multiply error — and the den proves he does not make it
//      anywhere else.

import {
  paintTakeoff,
  paintOptionalExtras,
  paintFormula,
  areaGeometry,
  displayHours,
  newPaintArea,
  newPaintSubstrate,
  PAINT_TAKEOFF_DEFAULTS,
  PAINT_SUBSTRATE_DEFAULTS,
  PAINT_PRODUCT_DEFAULTS,
  PAINT_AREA_TYPE_DEFAULTS,
} from "@/lib/pricing/paintTakeoff";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import {
  buildTradeLineItems,
  createTradeConfig,
  tradeLabourHours,
  tradeLabourDetail,
  tradeOptionalExtras,
} from "@/lib/pricing/tradeScope";
import { FALLBACK_LABOUR_RATE } from "@/lib/costing/quoteCosting";
import { hasTradeMaterials, tradeMaterialsFor } from "@/lib/costing/tradeMaterials";

let passed = 0;
function ok(name, cond, detail) {
  if (!cond) {
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
    process.exitCode = 1;
    return;
  }
  passed += 1;
}
function eq(name, actual, expected) {
  ok(name, actual === expected, `expected ${expected}, got ${actual}`);
}
function near(name, actual, expected, tol = 1e-9) {
  ok(
    name,
    Math.abs(actual - expected) <= tol,
    `expected ~${expected}, got ${actual}`,
  );
}

const B = PAINT_TAKEOFF_DEFAULTS;
const sub = (key, patch = {}) => ({ ...newPaintSubstrate(key, B), ...patch });

/* ══ 1. THE DEN — 10 ft × 13 ft, 9 ft ceiling, $85/hr ═══════════════════ */
//
// | substrate    | qty      | exact hrs | labour  | materials |
// | Ceiling      | 130 sqft | 1.1818    | 100.45  | 22.74     |
// | Walls        | 414 sqft | 4.140     | 351.90  | 122.71    |
// | Baseboard    | 46 lnft  | 1.150     |  97.75  |   4.40    |
// | Doors        | 3 sides  | 1.500     | 127.50  |  17.22    |
// | Door frames  | 2        | 0.500     |  42.50  |   6.89    |
// | Small closet | 1        | 1.000     |  85.00  |  25.19    |
// | Window sill  | 1        | 0.250     |  21.25  |   3.44    |
// Totals: 9.72 h, materials 202.59, labour 826.35, project 1,028.94.

const DEN = {
  model: "area_substrate",
  areas: [
    {
      ...newPaintArea("den", B),
      label: "Den",
      lengthFt: 10,
      widthFt: 13,
      heightFt: 9,
      substrates: [
        sub("ceiling"),
        sub("walls"),
        sub("baseboard"),
        sub("door", { quantity: 3 }),
        sub("door_frame", { quantity: 2 }),
        sub("closet_small", { quantity: 1 }),
        sub("window_sill", { quantity: 1 }),
      ],
    },
  ],
};

const den = paintTakeoff(DEN, B);
const denArea = den.areas[0];

/* — Geometry. Openings are NOT deducted; 414 is gross. — */
const geo = denArea.geometry;
eq("den: ceiling sqft = L × W", geo.ceilingSqft, 130);
eq("den: floor sqft = L × W", geo.floorSqft, 130);
eq("den: linear ft = 2 × (L + W)", geo.linearFt, 46);
eq("den: wall sqft = 2 × (L + W) × H, GROSS", geo.wallSqft, 414);

/* — Every line, to the cent. — */
const DEN_TABLE = {
  ceiling: { qty: 130, hours: 130 / 110, labour: 100.45, material: 22.74 },
  walls: { qty: 414, hours: 4.14, labour: 351.9, material: 122.71 },
  baseboard: { qty: 46, hours: 1.15, labour: 97.75, material: 4.4 },
  door: { qty: 3, hours: 1.5, labour: 127.5, material: 17.22 },
  door_frame: { qty: 2, hours: 0.5, labour: 42.5, material: 6.89 },
  closet_small: { qty: 1, hours: 1, labour: 85, material: 25.19 },
  window_sill: { qty: 1, hours: 0.25, labour: 21.25, material: 3.44 },
};
for (const [key, want] of Object.entries(DEN_TABLE)) {
  const l = denArea.lines.find((x) => x.key === key);
  ok(`den: ${key} produced a line`, Boolean(l));
  if (!l) continue;
  eq(`den: ${key} quantity`, l.quantity, want.qty);
  near(`den: ${key} exact hours`, l.hours, want.hours, 1e-9);
  eq(`den: ${key} labour`, l.labour, want.labour);
  eq(`den: ${key} materials`, l.material, want.material);
}

/* — Recovered production rates. — */
eq("rate: ceiling 110 sqft/hr", PAINT_SUBSTRATE_DEFAULTS.ceiling.productionRate, 110);
eq("rate: walls 100 sqft/hr", PAINT_SUBSTRATE_DEFAULTS.walls.productionRate, 100);
eq("rate: baseboard 40 lnft/hr", PAINT_SUBSTRATE_DEFAULTS.baseboard.productionRate, 40);
eq("rate: door 0.50 h per side", PAINT_SUBSTRATE_DEFAULTS.door.hoursPerUnit, 0.5);
eq("rate: door frame 0.25 h each", PAINT_SUBSTRATE_DEFAULTS.door_frame.hoursPerUnit, 0.25);
eq("rate: small closet 1.00 h each", PAINT_SUBSTRATE_DEFAULTS.closet_small.hoursPerUnit, 1);
eq("rate: window sill 0.25 h each", PAINT_SUBSTRATE_DEFAULTS.window_sill.hoursPerUnit, 0.25);
eq("stated: coats 2", PAINT_SUBSTRATE_DEFAULTS.walls.coats, 2);
eq("stated: coverage 350 sqft/gal", PAINT_PRODUCT_DEFAULTS.wall_interior.coverageSqftPerGal, 350);
eq("stated: 2-storey wall is its own substrate", typeof PAINT_SUBSTRATE_DEFAULTS.wall_two_storey, "object");

/* — Totals. — */
near("den: exact total hours", denArea.hours, 9.721818181818, 1e-9);
eq("den: total labour", denArea.labour, 826.35);
eq("den: total materials", denArea.material, 202.59);
eq("den: project total", denArea.total, 1028.94);
eq("den: deposit is exactly 25%", den.deposit, 257.24);

/* — Displayed hours are ROUNDED; money uses EXACT hours. — */
eq("display: 0.25 h shows as 0.3", displayHours(0.25, 1), 0.3);
eq("display: 1.1818 h shows as 1.2", displayHours(130 / 110, 1), 1.2);
eq("display: the total shows as 9.72", denArea.displayHours, 9.72);
ok(
  "money: rounding hours first would have been wrong",
  // 1.2 × 85 = 102.00, and the sheet says 100.45. If these ever agree, the
  // engine has started rounding before it multiplies.
  Math.round(displayHours(130 / 110, 1) * 85 * 100) / 100 !== 100.45,
);
eq(
  "money: the ceiling line uses exact hours",
  Math.round((130 / 110) * 85 * 100) / 100,
  100.45,
);

/* ══ 2. THE EXTERIOR JOB — $80/hr ═══════════════════════════════════════ */

const EXT = (rows) => ({
  model: "area_substrate",
  areas: [
    {
      ...newPaintArea("exterior", B),
      label: "Exterior",
      measurement: "surface",
      surfaceSqft: 0,
      substrates: rows,
    },
  ],
});

const siding = paintTakeoff(EXT([sub("siding_trim", { quantity: 2340 })]), B)
  .areas[0].lines[0];
eq("exterior: hourly sell rate is $80", B.exteriorHourlySellRate, 80);
near("exterior: siding 2340 sqft ÷ 100 = 23.40 h", siding.hours, 23.4, 1e-9);
eq("exterior: siding labour $1,872.00", siding.labour, 1872);
eq("exterior: siding is ONE coat", siding.coats, 1);
eq("exterior: siding materials $720.02", siding.material, 720.02);

const soffit = paintTakeoff(EXT([sub("soffit_fascia", { quantity: 260 })]), B)
  .areas[0].lines[0];
near("exterior: soffit 260 lnft ÷ 30 = 8.6667 h", soffit.hours, 260 / 30, 1e-9);
eq("exterior: soffit displays as 8.7 at one decimal", soffit.displayHours, 8.7);
eq("exterior: soffit materials $373.34", soffit.material, 373.34);

// ── HIS $693.60, AND WHY THE ENGINE RETURNS $693.33 ──
// This is the whole discrepancy, asserted from both ends so it cannot be
// "fixed" by accident in either direction.
eq("discrepancy: exact hours give $693.33", soffit.labour, 693.33);
eq(
  "discrepancy: his $693.60 is 8.67 h (his displayed figure) × $80",
  Math.round(Math.round((260 / 30) * 100) / 100 * 80 * 100) / 100,
  693.6,
);
ok("discrepancy: the two differ by $0.27", Math.abs(693.6 - soffit.labour - 0.27) < 1e-9);

const garage = paintTakeoff(EXT([sub("garage_door", { quantity: 1 })]), B)
  .areas[0].lines[0];
eq("exterior: garage door labour $160.00 per item", garage.labour, 160);
eq("exterior: garage door materials $80.77", garage.material, 80.77);

// ── THE $462 LINE ──
// "464 sqft ÷ 100 sqft/hr × $80/hr + prep $0 = $462" is $371.20, not $462.
const line464 = paintTakeoff(
  EXT([sub("siding_trim", { quantity: 464, prepHours: 0 })]),
  B,
).areas[0].lines[0];
near("discrepancy: 464 ÷ 100 = 4.64 h", line464.hours, 4.64, 1e-9);
eq("discrepancy: 4.64 h × $80 = $371.20, not $462", line464.labour, 371.2);
ok("discrepancy: the engine does NOT return $462", line464.labour !== 462);

/* ══ 3. SELL RATE AND COST RATE STAY APART ═════════════════════════════ */

eq("costing: the burdened cost rate is still 35", FALLBACK_LABOUR_RATE, 35);
ok(
  "the sell rate is not the cost rate",
  B.hourlySellRate !== FALLBACK_LABOUR_RATE &&
    B.exteriorHourlySellRate !== FALLBACK_LABOUR_RATE,
);
// The same hours reach both sides, and only one of them ever meets the sell
// rate. If tradeLabourHours ever returned a MONEY figure this fails.
const hoursForCosting = tradeLabourHours("interior_painting", DEN, null);
near("costing: the trade reports the den's hours", hoursForCosting, denArea.hours, 0.01);
ok(
  "costing: hours are hours, not the priced labour",
  hoursForCosting !== denArea.labour,
);
near(
  "costing: cost side = same hours × 35",
  Math.round(hoursForCosting * FALLBACK_LABOUR_RATE * 100) / 100,
  340.26,
  0.02,
);

const detail = tradeLabourDetail("interior_painting", DEN, null);
ok("costing: a labour breakdown exists", Boolean(detail) && detail.parts.length === 1);
eq("costing: the breakdown names the area", detail.parts[0].name, "Den");

/* ══ 4. LINE ITEMS AND THE PRICE BOOK ══════════════════════════════════ */

const book = getPriceBook("interior_painting", null);
ok("book: interior_painting carries the takeoff", Boolean(book.takeoff));
eq("book: substrates are a keyed map, not an array", Array.isArray(book.takeoff.substrates), false);
eq("book: area types are a keyed map, not an array", Array.isArray(book.takeoff.areaTypes), false);
eq("book: no area type carries a defaultSqft",
  Object.values(PAINT_AREA_TYPE_DEFAULTS).some((a) => "defaultSqft" in a), false);

const items = buildTradeLineItems("interior_painting", DEN, null);
eq("lines: one per substrate", items.length, 7);
eq(
  "lines: they sum to the project total",
  Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100,
  1028.94,
);
ok(
  "lines: quantity × rate === amount on every line",
  items.every((i) => Math.round(i.quantity * i.rate * 100) / 100 === i.amount),
);
ok(
  "lines: the measurement is in the description",
  items.some((i) => i.description.includes("(414 sqft)")),
);

// An existing quote written against the complexity grid must not reprice.
const legacy = { rooms: [{ title: "Room", sqft: 200, walls: true, complexityLevel: "standard" }] };
const legacyItems = buildTradeLineItems("interior_painting", legacy, null);
eq("legacy: a takeoff with no `model` still prices off the grid", legacyItems.length, 1);
eq("legacy: 200 sqft × $2.50", legacyItems[0].amount, 500);
eq("legacy: it reports no hours", tradeLabourHours("interior_painting", legacy, null), 0);

const blank = createTradeConfig("interior_painting", null);
eq("blank: a new takeoff carries the model key", blank.model, "area_substrate");
eq("blank: it seeds NO area, so no zeroes pretend to be a measurement", blank.areas.length, 0);

/* ══ 5. A COMPANY OVERRIDE OF ONE SUBSTRATE KEEPS THE OTHERS ═══════════ */
//
// This is the whole reason substrates are a keyed map. As an array, mergeDeep
// REPLACES, and this company would lose every substrate but one.

const overridden = getPriceBook("interior_painting", {
  takeoff: { substrates: { walls: { productionRate: 80 } } },
});
eq("override: walls moved to 80 sqft/hr", overridden.takeoff.substrates.walls.productionRate, 80);
eq(
  "override: every other substrate survived",
  Object.keys(overridden.takeoff.substrates).length,
  Object.keys(PAINT_SUBSTRATE_DEFAULTS).length,
);
eq("override: the ceiling rate is untouched", overridden.takeoff.substrates.ceiling.productionRate, 110);
eq("override: the walls PRODUCT is untouched", overridden.takeoff.substrates.walls.productKey, "wall_interior");
const overriddenDen = paintTakeoff(DEN, overridden.takeoff);
eq("override: it changes the price it should", overriddenDen.areas[0].lines[1].labour, 439.88);
eq("override: and nothing else", overriddenDen.areas[0].lines[0].labour, 100.45);
// The array it is deliberately NOT modelled on, demonstrated:
const legacyOverride = getPriceBook("interior_painting", {
  roomTypes: [{ value: "den", label: "Den" }],
});
eq(
  "override: the LEGACY roomTypes array does discard the rest — the trap avoided",
  legacyOverride.roomTypes.length,
  1,
);

/* ══ 6. GALLONS — ROUNDING THEN SUMMING IS NOT SUMMING THEN ROUNDING ═══ */

const room = (label, roundUp) => ({
  ...newPaintArea("guest_room", B),
  label,
  lengthFt: 8,
  widthFt: 8,
  heightFt: 8,
  roundGallonsUp: roundUp,
  // Ceiling only: 64 sqft × 2 coats ÷ 350 = 0.3657 gal each.
  substrates: [sub("ceiling")],
});
const threeRooms = (roundUp) => ({
  model: "area_substrate",
  areas: [room("A", roundUp), room("B", roundUp), room("C", roundUp)],
});

const loose = paintTakeoff(threeRooms(false), B);
const tight = paintTakeoff(threeRooms(true), B);
near("gallons: each room needs 0.3657 gal", loose.areas[0].lines[0].gallons, (64 * 2) / 350, 1e-9);
eq("gallons: summed then rounded = 2 gal", loose.purchase[0].gallons, 2);
eq("gallons: rounded then summed = 3 gal", tight.purchase[0].gallons, 3);
ok("gallons: the order genuinely changes the answer", loose.purchase[0].gallons !== tight.purchase[0].gallons);
eq("gallons: and it changes the money too", tight.material > loose.material, true);
eq("gallons: rounding up charges whole tins", tight.areas[0].lines[0].material, 30.61);

// Per-substrate override beats the area's setting, in both directions.
const mixed = paintTakeoff(
  {
    model: "area_substrate",
    areas: [
      {
        ...room("Mixed", true),
        substrates: [sub("ceiling", { roundGallonsUp: false })],
      },
    ],
  },
  B,
);
near("gallons: a substrate can say no to an area that says yes", mixed.areas[0].lines[0].gallons, (64 * 2) / 350, 1e-9);

// Gallons never pool across products.
eq("gallons: rolled up per product, never across them", den.purchase.length, 3);
eq("gallons: ceiling flat", den.purchase.find((p) => p.productKey === "ceiling_flat").gallons, 1);
eq("gallons: interior wall", den.purchase.find((p) => p.productKey === "wall_interior").gallons, 3);
eq("gallons: trim enamel", den.purchase.find((p) => p.productKey === "trim_enamel").gallons, 1);

/* ══ 7. "NO PRODUCT" SKIPS MATERIAL, IT DOES NOT ZERO IT ═══════════════ */

const noProd = paintTakeoff(
  {
    model: "area_substrate",
    areas: [
      {
        ...newPaintArea("den", B),
        label: "Den",
        lengthFt: 10,
        widthFt: 13,
        heightFt: 9,
        substrates: [sub("walls", { noProduct: true })],
      },
    ],
  },
  B,
);
const npLine = noProd.areas[0].lines[0];
eq("no product: material is null, NOT 0", npLine.material, null);
eq("no product: gallons are null, NOT 0", npLine.gallons, null);
eq("no product: the labour still bills", npLine.labour, 351.9);
eq("no product: the line amount is labour alone", npLine.amount, 351.9);
eq("no product: nothing enters the buy list", noProd.purchase.length, 0);
eq("no product: the job's material total is 0 because there IS none", noProd.material, 0);

// An UNPRICED product is a third state: gallons known, cost unknown, counted.
const unpricedJob = paintTakeoff(
  {
    model: "area_substrate",
    areas: [
      {
        ...newPaintArea("den", B),
        label: "Den",
        lengthFt: 10,
        widthFt: 13,
        heightFt: 9,
        substrates: [sub("walls", { productKey: "primer" })],
      },
    ],
  },
  B,
);
const upLine = unpricedJob.areas[0].lines[0];
eq("unpriced: gallons are known", Math.round(upLine.gallons * 1000) / 1000, 2.76);
eq("unpriced: cost stays null rather than 0", upLine.material, null);
eq("unpriced: and it is COUNTED", unpricedJob.unpricedCount, 1);
ok("unpriced: distinct from no-product", upLine.noProduct === false && upLine.unpriced === true);

/* ══ 8. OPTIONAL AREAS AND SUBSTRATES ══════════════════════════════════ */

const withOptional = {
  model: "area_substrate",
  areas: [
    DEN.areas[0],
    { ...room("Hallway", null), optional: true, clientNote: "If you want it done at the same time" },
    {
      ...newPaintArea("kitchen", B),
      label: "Kitchen",
      lengthFt: 10,
      widthFt: 10,
      heightFt: 9,
      substrates: [sub("ceiling"), sub("crown_moulding", { optional: true })],
    },
  ],
};
const opt = paintTakeoff(withOptional, B);
eq("optional: an optional area is out of the priced scope", opt.areas.length, 2);
eq("optional: and is priced separately", opt.optionalAreas.length, 1);
eq("optional: an optional substrate is out too", opt.optionalSubstrates.length, 1);

const withoutOptional = paintTakeoff(
  {
    model: "area_substrate",
    areas: [
      DEN.areas[0],
      { ...withOptional.areas[2], substrates: [sub("ceiling")] },
    ],
  },
  B,
);
eq(
  "optional: removing them changes nothing about the included total",
  opt.total,
  withoutOptional.total,
);
ok("optional: the extras carry real money", opt.optionalAreas[0].total > 0 && opt.optionalSubstrates[0].amount > 0);
eq("optional: optional gallons stay out of the buy list", opt.purchase.length, withoutOptional.purchase.length);

const extras = paintOptionalExtras(withOptional, B);
eq("optional: two offers reach the client", extras.length, 2);
eq("optional: the area's client note becomes the detail", extras[0].detail, "If you want it done at the same time");
ok("optional: every offer has a positive amount", extras.every((e) => e.amount > 0));
ok(
  "optional: they add up to the difference the client would pay",
  Math.abs(
    extras.reduce((s, e) => s + e.amount, 0) -
      (opt.optionalAreas[0].total + opt.optionalSubstrates[0].amount),
  ) < 0.005,
);
eq(
  "optional: the scope builder leaves them OUT of the line items",
  Math.round(
    buildTradeLineItems("interior_painting", withOptional, null).reduce(
      (s, i) => s + i.amount,
      0,
    ) * 100,
  ) / 100,
  opt.total,
);
eq("optional: tradeOptionalExtras surfaces them for the save route", tradeOptionalExtras("interior_painting", withOptional, null).length, 2);
eq("optional: and returns nothing for a legacy takeoff", tradeOptionalExtras("interior_painting", legacy, null).length, 0);
eq("optional: and nothing for a trade that has none", tradeOptionalExtras("roofing_service", {}, null).length, 0);

/* ══ 9. THE RATE FORMULA IS INTERNAL ══════════════════════════════════ */

const shown = paintTakeoff(
  {
    model: "area_substrate",
    areas: [{ ...DEN.areas[0], substrates: [sub("walls", { showFormula: true })] }],
  },
  B,
).areas[0].lines[0];
ok("formula: available when the estimator asks", typeof paintFormula(shown) === "string");
ok("formula: it contains the sell rate", paintFormula(shown).includes("85.00"));
eq("formula: null when the toggle is off", paintFormula(denArea.lines[1]), null);
eq("formula: null for a missing line", paintFormula(null), null);
// The client-facing surfaces render `description` and `amount`. If the formula
// were ever built into a description this fails.
ok(
  "formula: no line item description carries a rate",
  buildTradeLineItems("interior_painting", {
    model: "area_substrate",
    areas: [{ ...DEN.areas[0], substrates: [sub("walls", { showFormula: true })] }],
  }, null).every(
    (i) =>
      !i.description.includes("/hr") &&
      !i.description.includes("$") &&
      !i.description.includes("sqft/hr"),
  ),
);

/* ══ 10. HOSTILE INPUT ═════════════════════════════════════════════════ */

const finiteMoney = (v) => Number.isFinite(v) && v >= 0;
function sane(name, r) {
  ok(`hostile: ${name} — total is a finite, non-negative number`, finiteMoney(r.total), `got ${r.total}`);
  ok(`hostile: ${name} — labour is sane`, finiteMoney(r.labour), `got ${r.labour}`);
  ok(`hostile: ${name} — material is sane`, finiteMoney(r.material), `got ${r.material}`);
  ok(`hostile: ${name} — hours are sane`, finiteMoney(r.hours), `got ${r.hours}`);
  ok(`hostile: ${name} — deposit is sane`, finiteMoney(r.deposit), `got ${r.deposit}`);
  ok(
    `hostile: ${name} — every line is sane`,
    r.areas.every(
      (a) =>
        a.lines.every(
          (l) =>
            finiteMoney(l.amount) &&
            finiteMoney(l.labour) &&
            finiteMoney(l.hours) &&
            (l.material === null || finiteMoney(l.material)) &&
            (l.gallons === null || finiteMoney(l.gallons)),
        ),
    ),
  );
}

const hostileArea = (patch) => ({
  model: "area_substrate",
  areas: [{ ...newPaintArea("den", B), label: "X", lengthFt: 10, widthFt: 13, heightFt: 9, ...patch }],
});

// A "__proto__" substrate key out of stored JSON.
const protoJob = hostileArea({
  substrates: [
    { key: "__proto__", quantity: 5, coats: 2 },
    { key: "constructor", quantity: 5 },
    { key: "prototype", quantity: 5 },
    { key: "toString", quantity: 5 },
    sub("ceiling"),
  ],
});
const protoResult = paintTakeoff(protoJob, B);
eq("hostile: a __proto__ substrate produces no line", protoResult.areas[0].lines.length, 1);
eq("hostile: only the real substrate priced", protoResult.areas[0].lines[0].key, "ceiling");
eq("hostile: Object.prototype was not polluted", {}.quantity, undefined);
sane("__proto__ keys", protoResult);

// A "__proto__" PRODUCT key, and a "__proto__" area type.
const protoProduct = paintTakeoff(
  hostileArea({ areaType: "__proto__", substrates: [sub("ceiling", { productKey: "__proto__" })] }),
  B,
);
eq("hostile: a __proto__ product yields no material", protoProduct.areas[0].lines[0].material, null);
eq("hostile: and nothing in the buy list", protoProduct.purchase.length, 0);
sane("__proto__ product and area type", protoProduct);

// Negative and absurd dimensions.
sane("negative dimensions", paintTakeoff(hostileArea({ lengthFt: -10, widthFt: -13, heightFt: -9, substrates: [sub("ceiling"), sub("walls")] }), B));
const negGeo = areaGeometry({ measurement: "area", lengthFt: -10, widthFt: -13, heightFt: -9 });
eq("hostile: a negative room measures 0", negGeo.wallSqft, 0);

const huge = paintTakeoff(hostileArea({ lengthFt: 1e400, widthFt: "1e400", heightFt: Infinity, substrates: [sub("ceiling"), sub("walls"), sub("baseboard")] }), B);
sane("1e400 dimensions", huge);
eq("hostile: 1e400 does not become Infinity money", huge.total, 0);

const overflow = paintTakeoff(hostileArea({ lengthFt: 1e200, widthFt: 1e200, heightFt: 1e200, substrates: [sub("ceiling")] }), B);
sane("finite dimensions that overflow when multiplied", overflow);

sane("NaN and junk", paintTakeoff(hostileArea({ lengthFt: NaN, widthFt: "abc", heightFt: null, prepHours: "x", substrates: [sub("ceiling"), sub("door", { quantity: "many" })] }), B));

// A 0-quantity substrate.
const zeroQty = paintTakeoff(hostileArea({ substrates: [sub("door", { quantity: 0 }), sub("ceiling")] }), B);
eq("hostile: a 0-quantity substrate produces no line at all", zeroQty.areas[0].lines.length, 1);
ok("hostile: no $0.00 row reaches the client", buildTradeLineItems("interior_painting", zeroQty, null).every((i) => i.amount > 0));
sane("zero quantity", zeroQty);
// And 0 is respected as 0 rather than falling through to the geometry.
const zeroDerived = paintTakeoff(hostileArea({ substrates: [sub("ceiling", { quantity: 0 })] }), B);
eq("hostile: quantity 0 does not fall back to the measured 130", zeroDerived.areas[0].lines.length, 0);

// Structural junk.
sane("no areas", paintTakeoff({ model: "area_substrate", areas: [] }, B));
sane("areas is not an array", paintTakeoff({ model: "area_substrate", areas: "nope" }, B));
sane("null config", paintTakeoff(null, B));
sane("null area entries", paintTakeoff({ model: "area_substrate", areas: [null, undefined, 7, "x"] }, B));
sane("substrates is not an array", paintTakeoff(hostileArea({ substrates: {} }), B));
eq("hostile: the scope builder survives all of it", buildTradeLineItems("interior_painting", { model: "area_substrate", areas: "nope" }, null).length, 0);

// Absurd coats and rates.
const madCoats = paintTakeoff(hostileArea({ substrates: [sub("ceiling", { coats: 1e9 }), sub("walls", { coats: -4 })] }), B);
eq("hostile: coats are clamped to 1–3", madCoats.areas[0].lines[0].coats, 2);
sane("absurd coats", madCoats);
sane("absurd typed rate", paintTakeoff(hostileArea({ substrates: [sub("ceiling", { productionRate: 1e-300 })] }), B));

// A negative markup below -100% would be a negative price.
sane("markup below -100%", paintTakeoff(DEN, { ...B, materialMarkupPct: -500 }));
eq(
  "hostile: a -500% markup floors at -100%, never negative money",
  paintTakeoff(DEN, { ...B, materialMarkupPct: -500 }).material,
  0,
);

/* ══ 11. THE COST SIDE GETS THE PAINT, AND IT GETS THE TINS ════════════ */
//
// The client is charged for the paint the room CONSUMED (0.742857 gal of
// ceiling flat = $22.74). The contractor pays for the TINS. Those are two
// different questions and the cost panel must be asked the second one.

ok("cost: painting derives a bill of materials", hasTradeMaterials("interior_painting"));
ok("cost: so does exterior", hasTradeMaterials("exterior_painting"));
const bill = tradeMaterialsFor("interior_painting", DEN, null);
eq("cost: one line per product, not per room", bill.materials.length, 3);
eq("cost: ceiling flat — 1 whole tin", bill.materials.find((m) => m.name === "Ceiling flat").qty, 1);
eq("cost: interior wall — 3 whole tins", bill.materials.find((m) => m.name === "Interior wall").qty, 3);
eq("cost: trim enamel — 1 whole tin", bill.materials.find((m) => m.name === "Trim enamel").qty, 1);
eq("cost: the tins cost 30.61 + 155.61 + 47.83", bill.materialTotal, 234.05);
ok(
  "cost: which is NOT what the client is charged for the paint",
  bill.materialTotal !== den.material,
);
eq("cost: nothing unpriced on a fully priced job", bill.unpricedCount, 0);
eq("cost: the bill carries no labour — hours come from tradeLabourHours", "labourBreakdown" in bill, false);
eq("cost: a legacy takeoff yields no bill", tradeMaterialsFor("interior_painting", legacy, null).materials.length, 0);
eq(
  "cost: an unpriced product is counted, not costed at zero",
  tradeMaterialsFor("interior_painting", {
    model: "area_substrate",
    areas: [{ ...DEN.areas[0], substrates: [sub("walls", { productKey: "primer" })] }],
  }, null).unpricedCount,
  1,
);
ok(
  "cost: hostile input cannot take the bill down",
  tradeMaterialsFor("interior_painting", { model: "area_substrate", areas: "nope" }, null)
    .materials.length === 0,
);

/* ══ Done ══════════════════════════════════════════════════════════════ */

if (process.exitCode) {
  console.error("\npaint takeoff: FAILED");
} else {
  console.log(`paint takeoff: ${passed} assertions passed`);
  console.log(
    `  den 10x13x9 @ $85/hr — 9.72 h, labour $826.35, materials $202.59, total $1,028.94, deposit $257.24`,
  );
  console.log(
    `  exterior @ $80/hr — siding $1,872.00 + $720.02, soffit $693.33 + $373.34, garage $160.00 + $80.77`,
  );
}
