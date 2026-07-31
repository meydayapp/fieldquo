// lib/kitchen/pricing.js
//
// Cabinet and new-kitchen pricing. Pure functions — safe in the quote builder,
// the PDF renderer, an API route and the public client-facing designer.
//
// Adapted from working TrueFinish code the owner supplied. The MATHS is theirs
// and is left alone; it prices real kitchens that real clients have bought.
// What changed is everything that made it single-tenant:
//
//   * RATES BELONG TO THE COMPANY, not to this file. TrueFinish's $700/linear
//     foot is TrueFinish's number. `DEFAULT_CABINET_RATES` is now a starting
//     point a company edits under Settings, stored on `Company.cabinetRates`,
//     and resolved per quote. A cabinet maker in another city charging $450/lf
//     must never be quoted at someone else's rate.
//   * LINE ITEMS COME OUT IN FIELDQUO'S SHAPE. The source emitted
//     { id, title, unitPrice, total }; every quote, invoice, PDF and email in
//     this product reads { description, quantity, unit, rate, amount }. The
//     internal shape is kept for the designer's own breakdown UI and converted
//     once, at the boundary, by toLineItems().
//   * NOTHING TRUSTS ITS INPUT. This engine is reachable from the PUBLIC client
//     designer, where the element list arrives from a browser. A negative width
//     or a NaN rate must not produce a negative line on a quote, so widths,
//     counts and rates are clamped rather than assumed.
//
// Money never comes from the browser: the client posts a DESIGN, and the server
// reprices it from the company's own rates. Same rule as quote add-ons.

export const DOOR_MATERIALS = {
  // Multipliers are STARTING points — a company edits them on the cabinet-rates
  // screen, because the same door material costs a different shop a different
  // amount. MDF paint-grade is the 1.0 baseline everything else is relative to.
  mdf: { label: "MDF (paint-grade)", mult: 1.0 },
  hdf: { label: "HDF (moulded)", mult: 0.98 },
  laminate: { label: "Laminate", mult: 0.9 },
  thermofoil: { label: "Thermofoil", mult: 0.92 },
  maple: { label: "Maple", mult: 1.2 },
  white_oak: { label: "White oak", mult: 1.4 },
  cherry: { label: "Cherry", mult: 1.35 },
  solid_wood: { label: "Solid wood", mult: 1.45 },
  shaker_paint: { label: "Paint-grade Shaker", mult: 1.05 },
};

export const BOX_MATERIALS = {
  melamine: { label: "Premium melamine", mult: 1.0 },
  plywood: { label: "Plywood", mult: 1.15 },
};

export const DEFAULT_CABINET_RATES = {
  // ── pricing mode ──
  cabinetPricingMode: "perLinearFt", // "perLinearFt" | "material"

  // ── per-linear-foot rates ($/lf of cabinet width), custom + finished + installed ──
  lfBase: 700,
  lfUpper: 500, // uppers are smaller boxes; raise to 700 to match bases
  lfTall: 850,
  lfIsland: 700,
  drawerSurcharge: 75, // extra per drawer (multi-drawer boxes cost more)
  installIncludedInLf: true,

  // ── material multipliers (applied to the cabinet price) ──
  doorMaterialMult: {
    ...Object.fromEntries(
      Object.entries(DOOR_MATERIALS).map(([k, v]) => [k, v.mult]),
    ),
  },
  boxMaterialMult: {
    ...Object.fromEntries(
      Object.entries(BOX_MATERIALS).map(([k, v]) => [k, v.mult]),
    ),
  },

  // ── material-mode (cost-plus) — RTI white-melamine fits + markup ──
  base: { intercept: 82, perIn: 4.6 },
  wall: { intercept: 53, perIn: 5.0 },
  tall: { intercept: 140, perIn: 9.5 },
  island: { intercept: 82, perIn: 4.6 },
  heightMult: { 12: 0.55, 24: 0.85, 30: 1.0, 34: 1.08, 36: 1.14, 42: 1.28 },
  cornerPremium: 1.25,
  materialMarkup: 0.18,
  installMode: "perBox", // material-mode install: "perBox" | "perLinearFt"
  installPerBox: 120,
  installPerLinearFt: 120,

  // ── refinishing module (per piece) ──
  refinishPerDoor: 150,
  refinishPerDrawer: 150,

  // ── logistics ──
  deliveryFlat: 250,
  removalPerBox: 25,
};

export const KITCHEN_ACCESSORIES = [
  // ── Trim (existing) ──────────────────────────────────────────────
  {
    id: "toe_kick",
    category: "Trim",
    name: "Toe kick",
    unit: "8ft length",
    price: 38,
  },
  {
    id: "side_panel",
    category: "Trim",
    name: "Finished side / end panel",
    unit: "panel",
    price: 95,
  },
  {
    id: "filler",
    category: "Trim",
    name: "Filler strip",
    unit: "piece",
    price: 28,
  },
  {
    id: "crown_molding",
    category: "Trim",
    name: "Crown molding",
    unit: "8ft length",
    price: 72,
  },
  {
    id: "riser",
    category: "Trim",
    name: "Riser",
    unit: "8ft length",
    price: 46,
  },
  {
    id: "valance",
    category: "Trim",
    name: "Valance",
    unit: "piece",
    price: 58,
  },
  {
    id: "hood",
    category: "Trim",
    name: "Canopy / hood",
    unit: "unit",
    price: 420,
  },
  {
    id: "flute",
    category: "Trim",
    name: "Flute / post",
    unit: "piece",
    price: 64,
  },
  {
    id: "corner_shelf",
    category: "Trim",
    name: "Corner shelf cabinet",
    unit: "unit",
    price: 180,
  },
  {
    id: "light_valance",
    category: "Trim",
    name: "Light rail",
    unit: "8ft length",
    price: 40,
  },

  // ── Spice racks (pull-out) ───────────────────────────────────────
  {
    id: "spice_rack_4",
    category: "Spice racks",
    name: 'Spice rack 4¼" — 6" base & up',
    unit: "unit",
    price: 220,
  },
  {
    id: "spice_rack_6",
    category: "Spice racks",
    name: 'Spice rack 6¼" — 8" base & up',
    unit: "unit",
    price: 235,
  },
  {
    id: "spice_rack_8",
    category: "Spice racks",
    name: 'Spice rack 8⅛" — 10" base & up',
    unit: "unit",
    price: 250,
  },
  {
    id: "spice_rack_10",
    category: "Spice racks",
    name: 'Spice rack 10¼" — 12" base & up',
    unit: "unit",
    price: 265,
  },
  {
    id: "spice_jolly_150",
    category: "Spice racks",
    name: "JOLLY 2-shelf spice rack (XCR-150)",
    unit: "unit",
    price: 238,
  },

  // ── Lazy susans & corner solutions ───────────────────────────────
  {
    id: "lazy_susan_sm",
    category: "Corner solutions",
    name: "Lazy susan — regular, small",
    unit: "unit",
    price: 250,
  },
  {
    id: "lazy_susan_md",
    category: "Corner solutions",
    name: "Lazy susan — premium, medium",
    unit: "unit",
    price: 450,
  },
  {
    id: "magic_corner",
    category: "Corner solutions",
    name: "Soft-closing magic corner",
    unit: "unit",
    price: 600,
  },
  {
    id: "pie_susan_328",
    category: "Corner solutions",
    name: 'INOXA pie-shape lazy susan — 33" & up',
    unit: "unit",
    price: 478,
  },
  {
    id: "pie_susan_333",
    category: "Corner solutions",
    name: 'INOXA pie-shape lazy susan — 36" & up',
    unit: "unit",
    price: 498,
  },
  {
    id: "blind_corner_xlm",
    category: "Corner solutions",
    name: "INOXA combi peanut blind corner",
    unit: "unit",
    price: 698,
  },
  {
    id: "swing_tray_kidney",
    category: "Corner solutions",
    name: "Soft-closing swing trays — kidney",
    unit: "unit",
    price: 572.5,
  },

  // ── Pantry pull-outs ─────────────────────────────────────────────
  {
    id: "pantry_softclose",
    category: "Pantry pull-outs",
    name: "Soft-closing pantry unit",
    unit: "unit",
    price: 547.5,
  },
  {
    id: "pantry_narrow_broom",
    category: "Pantry pull-outs",
    name: 'Narrow pantry pullout w/ broom clips — 6" & up',
    unit: "unit",
    price: 748,
  },
  {
    id: "pantry_narrow_grey",
    category: "Pantry pull-outs",
    name: 'Premium narrow pantry pullout — 6" & up',
    unit: "unit",
    price: 1110,
  },
  {
    id: "pantry_pullout_18",
    category: "Pantry pull-outs",
    name: 'Premium pantry pull-out — 18" & up',
    unit: "unit",
    price: 1732,
  },
  {
    id: "pantry_premium_18",
    category: "Pantry pull-outs",
    name: 'Premium pantry pullout (grey) — 18" & up',
    unit: "unit",
    price: 2080,
  },

  // ── Waste bins ───────────────────────────────────────────────────
  {
    id: "waste_10",
    category: "Waste bins",
    name: 'Garbage bin 10½" — 12" base & up',
    unit: "unit",
    price: 210,
  },
  {
    id: "waste_13",
    category: "Waste bins",
    name: 'Garbage bin 13½" — 15" base & up',
    unit: "unit",
    price: 230,
  },
  {
    id: "waste_15",
    category: "Waste bins",
    name: 'Garbage bin 15¾" — 18" base & up',
    unit: "unit",
    price: 250,
  },
  {
    id: "waste_21",
    category: "Waste bins",
    name: 'Garbage bin 21" — 23" base & up',
    unit: "unit",
    price: 375,
  },
  {
    id: "waste_undersink",
    category: "Waste bins",
    name: "Under-sink garbage bin system",
    unit: "unit",
    price: 224.99,
  },
  {
    id: "waste_sige_450",
    category: "Waste bins",
    name: "Sige waste bin 450",
    unit: "unit",
    price: 282,
  },
  {
    id: "waste_sige_600",
    category: "Waste bins",
    name: "Sige waste bin 600",
    unit: "unit",
    price: 312,
  },

  // ── Functional hardware ──────────────────────────────────────────
  {
    id: "hinge_softclose",
    category: "Hardware",
    name: "Soft-close hinge (105° full overlay)",
    unit: "hinge",
    price: 5,
  },
  {
    id: "hinge_45",
    category: "Hardware",
    name: "Soft-close hinge — 45°",
    unit: "hinge",
    price: 10,
  },
  {
    id: "hinge_90",
    category: "Hardware",
    name: "Soft-close hinge — 90°",
    unit: "hinge",
    price: 10,
  },
  {
    id: "hinge_165",
    category: "Hardware",
    name: "Soft-close hinge — 165°",
    unit: "hinge",
    price: 15,
  },
  {
    id: "leg_adjustable",
    category: "Hardware",
    name: "Adjustable cabinet leg",
    unit: "leg",
    price: 2.5,
  },
  {
    id: "push_latch",
    category: "Hardware",
    name: "Push-to-open latch",
    unit: "piece",
    price: 5,
  },
  {
    id: "tipout_11",
    category: "Hardware",
    name: 'Sink tip-out tray — 11"',
    unit: "piece",
    price: 12,
  },
  {
    id: "tipout_14",
    category: "Hardware",
    name: 'Sink tip-out tray — 14"',
    unit: "piece",
    price: 14,
  },
  {
    id: "tipout_30",
    category: "Hardware",
    name: 'Sink tip-out tray — 30"',
    unit: "piece",
    price: 36,
  },

  // ── Lighting ─────────────────────────────────────────────────────
  {
    id: "led_strip",
    category: "Lighting",
    name: "Continuous LED strip (interior / under / toe-kick)",
    unit: "kit",
    price: 244.99,
  },
  {
    id: "led_profile_interior",
    category: "Lighting",
    name: "Interior strip lighting profile",
    unit: "piece",
    price: 25.99,
  },
  {
    id: "led_toekick_profile",
    category: "Lighting",
    name: "Toe-kick light profile",
    unit: "piece",
    price: 88,
  },
  {
    id: "led_driver",
    category: "Lighting",
    name: "LED driver / power supply (24 V)",
    unit: "unit",
    price: 138.99,
  },
  {
    id: "led_powercord",
    category: "Lighting",
    name: "Power cord — driver",
    unit: "unit",
    price: 11.85,
  },
  {
    id: "led_distributor",
    category: "Lighting",
    name: "6-way distributor (24 V)",
    unit: "unit",
    price: 21.35,
  },
];

const KIND_GROUP = {
  base: "cabinet",
  drawerBase: "cabinet",
  sinkBase: "cabinet",
  spiceBase: "cabinet",
  cornerBase: "cabinet",
  cornerBaseDiag: "cabinet",
  tall: "cabinet",
  fridgeSurround: "cabinet",
  hoodCabinet: "cabinet",
  wall: "cabinet",
  microwave: "cabinet",
  cornerWall: "cabinet",
  cornerWallDiag: "cabinet",
  island: "cabinet",
  fridge: "appliance",
  stove: "appliance",
  dishwasher: "appliance",
  hoodVent: "appliance",
  window: "opening",
  door: "opening",
};
const WALL_FAMILY = [
  "wall",
  "cornerWall",
  "cornerWallDiag",
  "microwave",
  "hoodCabinet",
];
const TALL_FAMILY = ["tall", "fridgeSurround"];
const CORNER_KINDS = [
  "cornerBase",
  "cornerBaseDiag",
  "cornerWall",
  "cornerWallDiag",
];


/* ─────────────────────── input that can't be trusted ───────────────────── */
//
// Everything below is reachable from the public client designer, so a number
// arriving here may be a string, negative, NaN, Infinity, or absent. None of
// those may reach a quote: a negative width would produce a NEGATIVE line item,
// which on a document a client signs is a discount nobody authorised.
//
// Clamped rather than rejected. A design with one silly cabinet should price the
// other twenty correctly and show that one at its floor, not fail to price at
// all — the client is sitting in front of it.

/** A finite number in [min, max], else `fallback`. */
function num(v, fallback = 0, min = 0, max = 1e7) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** A whole count in [0, max]. */
function count(v, max = 1000) {
  return Math.floor(num(v, 0, 0, max));
}

// Cabinet dimensions in inches. The ceilings are deliberately generous — a
// 240" run is unusual but real; 1e7 is not, and is what an overflow looks like.
const MAX_IN = 480;

/** The width of an element, in inches, always sane. */
function widthOf(el) {
  return num(el?.width, 24, 1, MAX_IN);
}

/**
 * A rates object with every field a finite number.
 *
 * Merged over the defaults, so a company that has only edited `lfBase` still
 * gets working values for everything else — and so a rates blob saved by an
 * older version of the settings page can't leave a new field undefined and
 * price a cabinet at NaN.
 */
export function normaliseRates(input) {
  const r = { ...DEFAULT_CABINET_RATES, ...(input && typeof input === "object" ? input : {}) };
  const out = { ...r };

  for (const k of [
    "lfBase", "lfUpper", "lfTall", "lfIsland", "drawerSurcharge",
    "refinishPerDoor", "refinishPerDrawer", "deliveryFlat", "removalPerBox",
    "installPerBox", "installPerLinearFt",
  ]) {
    out[k] = num(r[k], DEFAULT_CABINET_RATES[k], 0, 100000);
  }
  out.cornerPremium = num(r.cornerPremium, 1.25, 1, 5);
  out.materialMarkup = num(r.materialMarkup, 0.18, 0, 5);

  // Multipliers: a zero here would silently make a material free.
  const mult = (src, def) => {
    const o = { ...def };
    for (const [k, v] of Object.entries(src || {})) o[k] = num(v, def[k] ?? 1, 0.1, 10);
    return o;
  };
  out.doorMaterialMult = mult(r.doorMaterialMult, DEFAULT_CABINET_RATES.doorMaterialMult);
  out.boxMaterialMult = mult(r.boxMaterialMult, DEFAULT_CABINET_RATES.boxMaterialMult);

  for (const tier of ["base", "wall", "tall", "island"]) {
    const d = DEFAULT_CABINET_RATES[tier];
    const v = r[tier] || {};
    out[tier] = {
      intercept: num(v.intercept, d.intercept, 0, 100000),
      perIn: num(v.perIn, d.perIn, 0, 10000),
    };
  }
  out.heightMult = mult(r.heightMult, DEFAULT_CABINET_RATES.heightMult);

  // Enumerations: an unknown mode would fall through every branch below.
  out.cabinetPricingMode =
    r.cabinetPricingMode === "material" ? "material" : "perLinearFt";
  out.installMode = r.installMode === "perLinearFt" ? "perLinearFt" : "perBox";
  out.installIncludedInLf = r.installIncludedInLf !== false;

  return out;
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const isCabinet = (el) => KIND_GROUP[el.kind] === "cabinet";
const isFloorRun = (kind) => !WALL_FAMILY.includes(kind);

/* ───────────────────────────── factories ──────────────────────────────── */
export function createKitchenConfig(overrides = {}) {
  return {
    serviceType: "kitchen",
    supplyMode: "supply_install",
    room: { width: 144, depth: 120, ceiling: 96 },
    elements: [],
    accessories: [],
    rates: { ...DEFAULT_CABINET_RATES },
    modules: {
      delivery: true,
      removeOld: false,
      refinish: true,
      countertop: false,
    },
    refinish: { mode: "auto", doors: 0, drawers: 0 },
    countertop: {
      sqft: 0,
      materialPerSqft: 65,
      fabInstallPerSqft: 45,
      edgeFt: 0,
      edgePerFt: 15,
    },
    ...overrides,
  };
}

export function createAccessoryLine(accId, quantity = 1) {
  const a = KITCHEN_ACCESSORIES.find((x) => x.id === accId);
  return a ? { ...a, quantity } : null;
}

/* ─────────────────────────── per-cabinet pricing ──────────────────────── */
function lfRateFor(kind, rates) {
  if (TALL_FAMILY.includes(kind)) return rates.lfTall;
  if (WALL_FAMILY.includes(kind)) return rates.lfUpper;
  if (kind === "island") return rates.lfIsland;
  return rates.lfBase;
}

export function estimateBoxPrice(el, rates = DEFAULT_CABINET_RATES) {
  // material-mode (cost-plus) box price
  if (!isCabinet(el)) return 0;
  const w = widthOf(el);
  let raw;
  if (TALL_FAMILY.includes(el.kind))
    raw = rates.tall.intercept + rates.tall.perIn * w;
  else if (WALL_FAMILY.includes(el.kind))
    raw =
      (rates.wall.intercept + rates.wall.perIn * w) *
      (rates.heightMult[el.config?.heightClass || "30"] || 1);
  else if (el.kind === "island")
    raw = rates.island.intercept + rates.island.perIn * w;
  else raw = rates.base.intercept + rates.base.perIn * w;
  if (CORNER_KINDS.includes(el.kind)) raw *= rates.cornerPremium;
  return round2(raw * (1 + rates.materialMarkup));
}

// The most faces one cabinet can plausibly have. A tall pantry with stacked
// doors tops out around eight; twelve is generous. Enforced on the PRODUCT, not
// on each factor: clamping doors to 40 and rows to 10 independently still lets
// one tampered box claim 400 doors, which at a $150 refinishing rate is a
// $60,000 line item on a quote — arithmetically valid and obviously absurd.
const MAX_FACES_PER_CABINET = 12;

export function countCabinetFaces(el) {
  const c = el?.config || {};
  return {
    doors: Math.min(
      count(c.doors, 40) * Math.max(1, count(c.doorRows, 10)),
      MAX_FACES_PER_CABINET,
    ),
    drawers: Array.isArray(c.drawers)
      ? Math.min(c.drawers.length, MAX_FACES_PER_CABINET)
      : 0,
  };
}

function materialMult(el, rates) {
  const dm = rates.doorMaterialMult?.[el.config?.doorMaterial || "mdf"] ?? 1;
  const bm = rates.boxMaterialMult?.[el.config?.boxMaterial || "melamine"] ?? 1;
  return dm * bm;
}

// Canonical per-cabinet price. Returns { cabinet, install, total }.
// perLinearFt: cabinet = width-ft × tier rate × material mult (+ drawer surcharge,
//              × corner premium). Install bundled unless installIncludedInLf=false.
// material:    cabinet = RTI box cost; install per box / per-lf.
export function priceCabinet(el, rates = DEFAULT_CABINET_RATES) {
  if (!isCabinet(el)) return { cabinet: 0, install: 0, total: 0 };

  if ((rates.cabinetPricingMode || "perLinearFt") === "perLinearFt") {
    const lf = widthOf(el) / 12;
    let cabinet = lf * lfRateFor(el.kind, rates) * materialMult(el, rates);
    if (CORNER_KINDS.includes(el.kind)) cabinet *= rates.cornerPremium;
    const drawers = countCabinetFaces(el).drawers;
    cabinet += drawers * (rates.drawerSurcharge || 0);
    const install = rates.installIncludedInLf
      ? 0
      : rates.installMode === "perLinearFt"
        ? isFloorRun(el.kind)
          ? lf * rates.installPerLinearFt
          : 0
        : rates.installPerBox;
    return {
      cabinet: round2(cabinet),
      install: round2(install),
      total: round2(cabinet + install),
    };
  }

  // material mode
  const cabinet = estimateBoxPrice(el, rates);
  const install =
    rates.installMode === "perLinearFt"
      ? isFloorRun(el.kind)
        ? round2((widthOf(el) / 12) * rates.installPerLinearFt)
        : 0
      : rates.installPerBox;
  return {
    cabinet,
    install: round2(install),
    total: round2(cabinet + install),
  };
}

export function getKitchenLinearFeet(elements = [], which = "all") {
  return round2(
    elements
      .filter((e) => {
        if (!isCabinet(e)) return false;
        if (which === "base") return isFloorRun(e.kind);
        if (which === "upper") return WALL_FAMILY.includes(e.kind);
        return true;
      })
      .reduce((s, e) => s + widthOf(e) / 12, 0),
  );
}

export function countKitchenFaces(elements = []) {
  const acc = { doors: 0, drawers: 0 };
  (elements || []).forEach((e) => {
    if (isCabinet(e)) {
      const f = countCabinetFaces(e);
      acc.doors += f.doors;
      acc.drawers += f.drawers;
    }
    // island modules live in config.modules — count their faces too
    if (e.kind === "island") {
      (e.config?.modules || []).forEach((m) => {
        const f = countCabinetFaces({ config: m.config || {} });
        acc.doors += f.doors;
        acc.drawers += f.drawers;
      });
    }
  });
  return acc;
}
/* ───────────────────────── line-item builders ─────────────────────────── */
function matLabel(el) {
  const d = DOOR_MATERIALS[el.config?.doorMaterial || "mdf"]?.label || "MDF";
  const b =
    BOX_MATERIALS[el.config?.boxMaterial || "melamine"]?.label || "Melamine";
  return `${d} doors · ${b} box`;
}

function describeCabinet(el) {
  const c = el.config || {};
  const bits = [`${el.width}"W`];
  if (WALL_FAMILY.includes(el.kind))
    bits.push(`${c.heightClass || el.height}"H wall`, `${el.depth}"D`);
  else bits.push(`${el.height}"H`, `${el.depth}"D`);
  if (c.doors) {
    const rows = c.doorRows || 1;
    bits.push(
      rows > 1
        ? `${c.doors}×${rows} stacked doors`
        : `${c.doors} door${c.doors > 1 ? "s" : ""}`,
    );
  }
  if ((c.drawers || []).length) {
    const big = c.drawers.filter((d) => d === "big").length;
    const med = c.drawers.filter((d) => d === "medium").length;
    const sm = c.drawers.length - big - med;
    const parts = [];
    if (sm) parts.push(`${sm} small`);
    if (med) parts.push(`${med} medium`);
    if (big) parts.push(`${big} large`);
    bits.push(
      `${parts.join(" + ")} drawer${c.drawers.length > 1 ? "s" : ""}${c.drawersAtBottom ? " at base" : ""}`,
    );
  }
  if (c.sink) bits.push("farmhouse sink");
  bits.push(matLabel(el));
  return bits.join(" · ");
}

function labelFor(kind) {
  return (
    {
      base: "Base cabinet",
      drawerBase: "Drawer base",
      sinkBase: "Sink base",
      spiceBase: "Spice / pull-out base",
      cornerBase: "Corner base (L)",
      cornerBaseDiag: "Corner base (45°)",
      tall: "Tall / pantry",
      fridgeSurround: "Fridge surround",
      hoodCabinet: "Hood cabinet",
      wall: "Wall cabinet",
      microwave: "Microwave cabinet",
      cornerWall: "Corner wall (L)",
      cornerWallDiag: "Corner wall (45°)",
      island: "Island",
    }[kind] || kind
  );
}

function mkLine(id, title, quantity, unitPrice, category, description, meta) {
  return {
    id,
    title,
    description: description || "",
    quantity,
    unit: "unit",
    unitPrice: round2(unitPrice),
    total: round2((quantity || 1) * (unitPrice || 0)),
    category: category || "service",
    ...(meta ? { meta } : {}),
  };
}

// One line PER cabinet. perLinearFt → all-in price; material → box only.
export function buildCabinetLineItems(
  elements = [],
  rates = DEFAULT_CABINET_RATES,
) {
  const perLf = (rates.cabinetPricingMode || "perLinearFt") === "perLinearFt";
  return elements.filter(isCabinet).map((el, i) => {
    const p = priceCabinet(el, rates);
    const price = perLf ? p.total : p.cabinet; // material mode bills install separately
    return mkLine(
      el.id || `cab_${i}`,
      `${labelFor(el.kind)} — ${el.width}"`,
      1,
      price,
      "cabinet",
      describeCabinet(el),
      {
        wall: el.wall,
        pos: el.pos,
        cabinet: p.cabinet,
        install: p.install,
        doorMaterial: el.config?.doorMaterial || "mdf",
        boxMaterial: el.config?.boxMaterial || "melamine",
      },
    );
  });
}

function isAppliance(el) {
  return KIND_GROUP[el.kind] === "appliance";
}

function applianceLabel(kind) {
  return (
    {
      fridge: "Fridge",
      stove: "Range / stove",
      dishwasher: "Dishwasher",
      hoodVent: "Hood vent",
    }[kind] || kind
  );
}

/**
 * Appliance supply/install lines.
 *
 * Unlike cabinets, these have no rate card to derive from — a fridge costs
 * whatever the contractor is buying it for — so the price genuinely lives on the
 * element. That makes it the one figure a tampered design could move, which is
 * why the client-facing route re-attaches appliance pricing from the
 * contractor's saved design rather than accepting the client's copy. See
 * mergeClientDesign().
 *
 * Clamped here as well, because defence at one layer is defence nobody checks.
 */
export function buildApplianceLineItems(elements = []) {
  if (!Array.isArray(elements)) return [];
  return elements
    .filter((el) => isAppliance(el) && el?.config?.billable)
    .map((el, i) => {
      const supply = num(el.config?.supplyPrice, 0, 0, 100000);
      const install = num(el.config?.installPrice, 0, 0, 100000);
      const total = supply + install;

      return mkLine(
        el.id || `appliance_${i}`,
        `${applianceLabel(el.kind)} supply / install`,
        1,
        total,
        "appliance",
        `${el.width || 0}"W × ${el.height || 0}"H × ${el.depth || 0}"D`,
        {
          wall: el.wall,
          pos: el.pos,
          supply,
          install,
        },
      );
    });
}

export function buildInstallLineItem(
  elements = [],
  rates = DEFAULT_CABINET_RATES,
) {
  const perLf = (rates.cabinetPricingMode || "perLinearFt") === "perLinearFt";
  if (perLf && rates.installIncludedInLf) return []; // bundled into lf rate
  const cabs = elements.filter(isCabinet);
  if (!cabs.length) return [];
  if (rates.installMode === "perLinearFt") {
    const lf = getKitchenLinearFeet(elements, "base");
    if (lf <= 0) return [];
    return [
      mkLine(
        "kit_install",
        `Installation (${lf} linear ft)`,
        lf,
        rates.installPerLinearFt,
        "service",
        "Level, scribe, fasten & align",
      ),
    ];
  }
  return [
    mkLine(
      "kit_install",
      `Installation (${cabs.length} boxes)`,
      cabs.length,
      rates.installPerBox,
      "service",
      "Level, scribe, fasten & align",
    ),
  ];
}

/**
 * Accessory lines, repriced from the CATALOGUE by id.
 *
 * The saved config carries a whole accessory object, price included, and the
 * source trusted that price. Reachable from the public designer, that is the
 * browser setting the amount on a quote — the exact thing quote add-ons are
 * forbidden from doing (AGENTS.md §5: the client posts `addOnIds` only, the
 * server reprices from its own rows).
 *
 * So only the id and the quantity survive; name, unit and price come from
 * KITCHEN_ACCESSORIES here on the server. An id that isn't in the catalogue is
 * dropped rather than priced at whatever came with it.
 */
export function buildAccessoryLineItems(accessories = []) {
  if (!Array.isArray(accessories)) return [];
  return accessories
    .map((a) => {
      const def = KITCHEN_ACCESSORIES.find((x) => x.id === a?.id);
      if (!def) return null;
      const quantity = count(a.quantity, 500);
      if (quantity <= 0 || !(def.price > 0)) return null;
      return mkLine(
        `acc_${def.id}`,
        def.name,
        quantity,
        def.price,
        "material",
        `${quantity} × ${def.unit}`,
      );
    })
    .filter(Boolean);
}

export function buildRefinishLineItems(config, rates = DEFAULT_CABINET_RATES) {
  const r = config.refinish || { mode: "auto" };
  const counts =
    r.mode === "manual"
      ? { doors: r.doors || 0, drawers: r.drawers || 0 }
      : countKitchenFaces(config.elements);
  const out = [];
  if (counts.doors > 0)
    out.push(
      mkLine(
        "kit_refinish_doors",
        `Custom finishing — doors (${counts.doors})`,
        counts.doors,
        rates.refinishPerDoor,
        "service",
        "Strip, degrease, sand, prime, spray custom colour (per door)",
      ),
    );
  if (counts.drawers > 0)
    out.push(
      mkLine(
        "kit_refinish_drawers",
        `Custom finishing — drawer fronts (${counts.drawers})`,
        counts.drawers,
        rates.refinishPerDrawer,
        "service",
        "Spray-finished drawer fronts (per piece)",
      ),
    );
  return out;
}

export function buildKitchenCountertopLineItems(config) {
  const ct = config.countertop || {};
  const out = [];
  const sqft = ct.sqft || 0;
  if (sqft > 0) {
    if (ct.materialPerSqft > 0)
      out.push(
        mkLine(
          "kit_ct_mat",
          `Countertop material (${sqft} sqft)`,
          sqft,
          ct.materialPerSqft,
          "material",
          "Slab material",
        ),
      );
    if (ct.fabInstallPerSqft > 0)
      out.push(
        mkLine(
          "kit_ct_fab",
          `Countertop fab + install (${sqft} sqft)`,
          sqft,
          ct.fabInstallPerSqft,
          "service",
          "Template, fabricate, install",
        ),
      );
  }
  if ((ct.edgeFt || 0) > 0 && (ct.edgePerFt || 0) > 0)
    out.push(
      mkLine(
        "kit_ct_edge",
        `Countertop edge (${ct.edgeFt} ft)`,
        ct.edgeFt,
        ct.edgePerFt,
        "service",
        "Edge profile",
      ),
    );
  return out;
}

export function buildKitchenLineItems(config, ratesOverride, opts = {}) {
  if (!config || typeof config !== "object") return [];

  // Normalised HERE, once, rather than in each builder. Every path into pricing
  // goes through this function, so this is the single place a rates blob from
  // the database — or a design posted by a browser — becomes numbers that the
  // arithmetic below can rely on.
  const rates = normaliseRates(ratesOverride || config.rates);

  // A design with a runaway element count would build a quote nobody can read
  // and a PDF that never renders. Real kitchens do not have 500 boxes.
  const elements = Array.isArray(config.elements) ? config.elements.slice(0, 300) : [];
  config = { ...config, elements };

  const m = config.modules || {};
  const supplyOnly = config.supplyMode === "supply_only";
  const items = [];

  items.push(...buildCabinetLineItems(elements, rates));
  items.push(...buildApplianceLineItems(elements));
  if (!supplyOnly) items.push(...buildInstallLineItem(elements, rates));
  items.push(...buildAccessoryLineItems(config.accessories));
  if (m.refinish) items.push(...buildRefinishLineItems(config, rates));
  if (m.countertop) {
    if (opts.countertopItems?.length) items.push(...opts.countertopItems);
    else items.push(...buildKitchenCountertopLineItems(config));
  }
  if (m.delivery && rates.deliveryFlat > 0)
    items.push(
      mkLine(
        "kit_delivery",
        "Delivery & handling",
        1,
        rates.deliveryFlat,
        "service",
        "Freight to site",
      ),
    );
  if (m.removeOld) {
    const n = elements.filter(isCabinet).length;
    if (n > 0)
      items.push(
        mkLine(
          "kit_removal",
          `Remove & dispose existing cabinetry (${n})`,
          1,
          n * rates.removalPerBox,
          "service",
          "Tear-out & haul-away",
        ),
      );
  }
  return items;
}

export function getKitchenBreakdown(config, ratesOverride, opts = {}) {
  const items = buildKitchenLineItems(config, ratesOverride, opts);
  const sum = (pred) =>
    round2(items.filter(pred).reduce((s, i) => s + i.total, 0));
  return {
    cabinetry: sum((i) => i.category === "cabinet"),
    appliances: sum((i) => i.category === "appliance"),
    install: sum((i) => i.id === "kit_install"),
    accessories: sum((i) => i.id.startsWith("acc_")),
    refinish: sum((i) => i.id.startsWith("kit_refinish")),
    countertop: sum((i) => i.id.startsWith("kit_ct")),
    logistics: sum((i) => i.id === "kit_delivery" || i.id === "kit_removal"),
    total: round2(items.reduce((s, i) => s + i.total, 0)),
    linearFeet: getKitchenLinearFeet(config.elements, "all"),
    items,
  };
}

export function getKitchenTotal(config, ratesOverride, opts = {}) {
  return round2(
    buildKitchenLineItems(config, ratesOverride, opts).reduce(
      (s, i) => s + (i.total || 0),
      0,
    ),
  );
}



/* ─────────────────── the boundary with the rest of FieldQuo ────────────── */

/**
 * Convert priced kitchen items into the line-item shape everything else reads.
 *
 * Quotes, invoices, PDFs and emails all consume
 * `{ description, quantity, unit, rate, amount }` — see QuoteScopeGroup.lineItems.
 * The internal shape above ({ id, title, unitPrice, total, category, meta })
 * carries more than that on purpose: the designer's breakdown panel groups by
 * `category` and highlights a cabinet on the drawing from `meta.wall`/`meta.pos`.
 *
 * Converting once, here, is why the designer can keep its richer shape without
 * every downstream reader learning about it. The description folds the title and
 * the spec together because that is the single string a client reads on the
 * printed quote — losing the "36"W · 2 doors · Maple doors" detail there would
 * make the document less useful than the drawing it came from.
 */
export function toLineItems(items = []) {
  return items.map((i) => ({
    description: i.description ? `${i.title} — ${i.description}` : i.title,
    quantity: i.quantity ?? 1,
    unit: i.unit || "unit",
    rate: i.unitPrice ?? 0,
    amount: i.total ?? 0,
  }));
}

/** A design priced straight into FieldQuo line items. */
export function kitchenLineItems(config, rates, opts = {}) {
  return toLineItems(buildKitchenLineItems(config, rates, opts));
}

/**
 * Fold a client's edits into the contractor's saved design.
 *
 * The public designer lets a homeowner move boxes, change a door material and
 * pick a colour — the things the design is FOR. It must not let them change
 * what those things cost.
 *
 * Cabinet prices are safe already: they derive from the company's rate card,
 * which the browser never sees. Appliances are the exception — their price is
 * carried on the element, because a fridge has no rate card — so those figures
 * are taken from the CONTRACTOR's copy, matched by element id, and the client's
 * are discarded. An appliance the client added that the contractor never priced
 * comes back non-billable rather than free.
 *
 * Room dimensions come from the contractor too. The room is a measured fact
 * about the house; a client shrinking it to 60" would reprice nothing directly
 * but would produce a drawing the installer cannot build to.
 *
 * @param saved   the design as the contractor last saved it
 * @param client  the design as posted by the public designer
 */
export function mergeClientDesign(saved, client) {
  if (!client || typeof client !== "object") return saved || null;
  if (!saved || typeof saved !== "object") saved = {};

  const savedAppliances = new Map(
    (Array.isArray(saved.elements) ? saved.elements : [])
      .filter((e) => isAppliance(e) && e?.id)
      .map((e) => [e.id, e.config || {}]),
  );

  const elements = (Array.isArray(client.elements) ? client.elements : []).map((el) => {
    if (!isAppliance(el)) return el;
    const original = savedAppliances.get(el?.id);
    return {
      ...el,
      config: {
        ...(el.config || {}),
        // Absent from the contractor's design => the client added it, and
        // nobody has priced it. Shown on the drawing, billed at nothing.
        billable: original ? Boolean(original.billable) : false,
        supplyPrice: original?.supplyPrice ?? 0,
        installPrice: original?.installPrice ?? 0,
      },
    };
  });

  return {
    ...saved,
    ...client,
    elements,
    room: saved.room || client.room,
    // Rates are resolved from the company on every price, so whatever the
    // browser sent here is irrelevant — dropped anyway, so a saved config can
    // never carry a stale copy of someone's rate card.
    rates: undefined,
    // Accessories keep only id + quantity; buildAccessoryLineItems reprices
    // them from the catalogue regardless, and storing a price we ignore invites
    // someone later to read it.
    accessories: (Array.isArray(client.accessories) ? client.accessories : [])
      .map((a) => ({ id: a?.id, quantity: count(a?.quantity, 500) }))
      .filter((a) => a.id && a.quantity > 0),
  };
}
