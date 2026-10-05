// lib/pricing/paintHeightPrep.js
//
// The painting PRESET's height, prep, access and crew figures — one copy,
// read by the quote builder's paint takeoff (lib/pricing/paintTakeoff.js) and
// by the drawing read (lib/planRead/). The owner (2026-10-05): "can you
// integrate that into the preset then?" — so these live in the book a company
// starts from (PAINT_TAKEOFF_DEFAULTS: `heightFactors`, `prepAllowances`,
// `dailySetupMinutes`, `accessRates`, `deliveryPerTrip`,
// `frameScaffoldPer100Sqft`, `crewPlan`), every company sees and edits them
// in Settings → Services beside its painting production rates, its edits
// override the preset key by key, and a company that never touches them
// prices on the preset.
//
// ══ What changes a typed quote ══════════════════════════════════════════════
//
// Only three things, each chosen by the estimator: a surface above 8 ft (the
// room's height, or the row's own working height), a substrate condition
// picked on a row, or access equipment added. A room of 8 ft or less with no
// condition prices byte for byte as before (scripts/check-paint-presets-
// height-prep.mjs, md5 of the takeoff output before and after).
//
// ══ How each source was checked ═════════════════════════════════════════════
//
//   NPC 2023    Craftsman Book Company, "2023 National Painting Cost
//               Estimator", the publisher's online preview
//               (https://www.craftsman-book.com/media/static/previews/2023_NPC_book_preview.pdf),
//               read page by page on 2026-10-05. Figure 15 "Typical equipment
//               purchase and rental prices" is printed on pp. 33–34 of the
//               preview; the rows below are copied from it digit for digit.
//               US dollars, 2023 — "Use the following rates only as a guide.
//               They may not be accurate for your area."
//   HTDF        "High Time Difficulty Factors", National Painting Cost
//               Estimator p. 139 — printed in the publisher's 2014 preview
//               (https://www.craftsman-book.com/media/static/previews/2014_NPC_book_preview.pdf)
//               and read there on 2026-10-05: "For labor calculations only:
//               Add 30% to the area for heights between 8 and 13 feet
//               (multiply by 1.3) … 13 to 17 feet (1.6) … 17 to 19 feet (1.9)
//               … 19 to 21 feet (2.2)", applied to "the surface above 8 feet"
//               (the "clip"). The 2023 preview (p. 9) still points at the same
//               table. Above 21 ft the book gives nothing: 2.2 is carried on
//               and LABELLED an extrapolation. FieldQuo weights a tall surface
//               across the bands (a 20 ft wall: 8 ft at ×1.0, 5 at ×1.3, 4 at
//               ×1.6, 2 at ×1.9, 1 at ×2.2); the book's own example prices a
//               whole clip at one factor, which for the tallest walls is the
//               higher figure — said here so nobody mistakes the weighting
//               for the book's.
//   Resene      Resene Paints Ltd, "Productivity Tables" (Oct 2012),
//               https://www.resene.co.nz/pdf/Productivity_Tables.pdf — hours
//               per m² for the average painting tradesperson, read on
//               2026-10-05. Converted to hours per 100 sq ft (× 100 ÷
//               10.7639) and nothing else.
//   GUESS       FieldQuo's own stated assumption, named as one.
//
// No imports — the engine imports this, and the engine imports nothing.

const SQFT_PER_M2 = 10.7639104;
const NPC_URL = "https://www.craftsman-book.com/media/static/previews/2023_NPC_book_preview.pdf";

export const SOURCES = Object.freeze({
  npc2023: Object.freeze({ name: "Craftsman National Painting Cost Estimator 2023 (online preview)", url: NPC_URL, checked: "Read in the preview, 2026-10-05", tag: "READ" }),
  htdf: Object.freeze({
    name: "High Time Difficulty Factors, National Painting Cost Estimator p. 139",
    url: "https://www.craftsman-book.com/media/static/previews/2014_NPC_book_preview.pdf",
    checked: "Read in the publisher's 2014 preview, p. 139, 2026-10-05 — labour only, on the area above 8 ft; above 21 ft is FieldQuo's extrapolation at ×2.2",
    tag: "READ",
  }),
  resene: Object.freeze({ name: "Resene Paints, Productivity Tables (Oct 2012)", url: "https://www.resene.co.nz/pdf/Productivity_Tables.pdf", checked: "Read in the published PDF, 2026-10-05", tag: "READ" }),
  guess: Object.freeze({ name: "FieldQuo assumption", url: null, checked: "Stated, not sourced — change it if it isn't how you work", tag: "GUESS" }),
});

const r = (n, dp = 4) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. LABOUR BY WORKING HEIGHT
// ═══════════════════════════════════════════════════════════════════════════

/** Bands of working height, in feet. `upTo` is inclusive; the last is open. */
export const HEIGHT_BANDS = Object.freeze([
  Object.freeze({ key: "b1", label: "up to 8 ft", from: 0, upTo: 8 }),
  Object.freeze({ key: "b2", label: "8–13 ft", from: 8, upTo: 13 }),
  Object.freeze({ key: "b3", label: "13–17 ft", from: 13, upTo: 17 }),
  Object.freeze({ key: "b4", label: "17–19 ft", from: 17, upTo: 19 }),
  Object.freeze({ key: "b5", label: "19–21 ft", from: 19, upTo: 21 }),
  // Not in the book: its table stops at 21 ft. Carried at its last factor
  // and said to be an extrapolation wherever it shows.
  Object.freeze({ key: "b6", label: "over 21 ft (extrapolated)", from: 21, upTo: null, extrapolated: true }),
]);

/** The preset multipliers on HOURS, per band. Source: SOURCES.htdf. */
export const HEIGHT_FACTOR_PRESET = Object.freeze({ b1: 1.0, b2: 1.3, b3: 1.6, b4: 1.9, b5: 2.2, b6: 2.2 });

/** The band a single working height falls in (8.0 ft is the first band). */
export function bandIndexFor(heightFt) {
  const h = Number(heightFt);
  if (!Number.isFinite(h) || h <= 8) return 0;
  if (h <= 13) return 1;
  if (h <= 17) return 2;
  if (h <= 19) return 3;
  if (h <= 21) return 4;
  return 5;
}

/** The factors in force: a book's `heightFactors` over the preset. */
export function heightFactors(book) {
  const own = book?.heightFactors && typeof book.heightFactors === "object" ? book.heightFactors : {};
  return HEIGHT_BANDS.map((b) => {
    const v = Number(own[b.key]);
    return Number.isFinite(v) && v >= 1 && v <= 10 ? v : HEIGHT_FACTOR_PRESET[b.key];
  });
}

/**
 * Share of an area inside each height band, between `bottomFt` and `topFt`.
 * Rectangle: in proportion to the height inside the band. Triangle (a gable,
 * apex up): the width narrows to nothing at the top. Equal bottom and top: a
 * plane worked AT that height (a ceiling). Pure.
 */
export function bandShares(bottomFt, topFt, shape = "rectangle") {
  const b = Math.max(0, Number(bottomFt) || 0);
  const t = Math.max(b, Number(topFt) || 0);
  const shares = HEIGHT_BANDS.map(() => 0);
  if (t - b < 1e-6) {
    shares[bandIndexFor(t)] = 1;
    return shares;
  }
  const area = (a, c) => (shape === "triangle" ? ((t - a) ** 2 - (t - c) ** 2) / 2 : c - a);
  const total = area(b, t);
  HEIGHT_BANDS.forEach((band, i) => {
    const lo = Math.max(b, band.from);
    const hi = Math.min(t, band.upTo === null ? Infinity : band.upTo);
    if (hi > lo) shares[i] = area(lo, hi) / total;
  });
  const sum = shares.reduce((a, x) => a + x, 0) || 1;
  return shares.map((x) => x / sum);
}

/** Wall-like substrates a height applies to floor-to-height; ceilings at it. */
export const HEIGHT_WALL_KEYS = Object.freeze(["walls", "siding_trim", "stain_fence"]);
export const HEIGHT_CEILING_KEYS = Object.freeze(["ceiling", "crown_moulding", "soffit_fascia"]);

/**
 * The height the company's production rates were MEASURED at. The book's
 * own rates are for work up to 8 ft, and its factors are on top of that. The
 * PRESET's wall and ceiling rates are not the book's: they were recovered
 * from the owner's 10 × 13 × 9 ft den (PAINT_SUBSTRATE_DEFAULTS, RECOVERED),
 * so they already pay for a 9 ft room — a 9 ft ceiling, which the book puts
 * in its 8–13 ft band, included. Charging the factors from 8 ft on top of
 * them would count that height twice, and reprice the den — the invoice
 * check:paint-takeoff reproduces to the cent. So a surface is charged for its
 * height relative to a surface of the same kind at THIS height. A company
 * whose rates are for 8 ft rooms sets 8 in Settings → Services, and then
 * prices exactly as the book says.
 */
export const HEIGHT_BASIS_PRESET_FT = 9;

export function heightBasisFt(book) {
  const v = Number(book?.heightBasisFt);
  return Number.isFinite(v) && v >= 0 && v <= 40 ? v : HEIGHT_BASIS_PRESET_FT;
}

/** Ceiling-like (worked AT a height) or wall-like (floor to a height). */
export function heightKindFor(substrateKey) {
  if (HEIGHT_CEILING_KEYS.includes(substrateKey)) return "ceiling";
  if (HEIGHT_WALL_KEYS.includes(substrateKey)) return "wall";
  return null;
}

/**
 * The factor on a surface's HOURS from its share of area in each band — the
 * one rule the builder and the drawing read share. The band-weighted factor
 * of the surface, divided by that of the same kind of surface at the rates'
 * own height (heightBasisFt), never below 1:
 *
 *   wall 0–16 ft, basis 9 ft:  (8×1 + 5×1.3 + 3×1.6)/16 = 1.206 ÷ 1.033 = 1.167
 *   ceiling at 15 ft:          1.6 ÷ 1.3 (a 9 ft ceiling's band) = 1.231
 *
 * Pure.
 * @returns {{ factor, raw, basis, basisFt, bands: [{ key, label, share, factor }] }}
 */
export function heightFactorFromShares(shares, kind, book) {
  const factors = heightFactors(book);
  const basisFt = heightBasisFt(book);
  const raw = shares.reduce((n, s, i) => n + s * factors[i], 0);
  const basisShares = kind === "ceiling" ? bandShares(basisFt, basisFt) : bandShares(0, basisFt);
  const basis = basisShares.reduce((n, s, i) => n + s * factors[i], 0) || 1;
  return {
    factor: r(Math.max(1, raw / basis)),
    raw: r(raw),
    basis: r(basis),
    basisFt,
    bands: HEIGHT_BANDS.map((b, i) => ({ key: b.key, label: b.label, share: r(shares[i]), factor: factors[i] })).filter((x) => x.share > 0),
  };
}

/**
 * The builder's rule for a takeoff row at a height (the room's height, or the
 * row's own working height): a wall from the floor to it, a ceiling worked at
 * it. Null — the row prices exactly as before — at 8 ft or less, for a
 * substrate that takes no height, or when the factor comes to 1 (a 9 ft room
 * on rates measured at 9 ft). Pure.
 */
export function heightFactorFor(substrateKey, heightFt, book) {
  const h = Number(heightFt);
  if (!Number.isFinite(h) || h <= 8) return null;
  const kind = heightKindFor(substrateKey);
  if (!kind) return null;
  const out = heightFactorFromShares(kind === "wall" ? bandShares(0, h) : bandShares(h, h), kind, book);
  if (!(out.factor > 1)) return null;
  return { ...out, heightFt: h, kind };
}

/** "16 ft wall: 8–13 ft ×1.3 on 31%, 13–17 ft ×1.6 on 19% … ÷ 1.033 (rates measured at 9 ft) = ×1.167". */
export function heightWhy(h) {
  if (!h) return "";
  const parts = h.bands.map((b) => `${b.label} ×${b.factor} on ${Math.round(b.share * 100)}%`).join(", ");
  return `${parts} = ×${h.raw}${h.basis !== 1 ? ` ÷ ×${h.basis} (your rates are measured at ${h.basisFt} ft)` : ""} = ×${h.factor} on the hours — ${SOURCES.htdf.name}${h.bands.some((b) => b.key === "b6") ? " (above 21 ft extrapolated at ×2.2 — the book stops at 21 ft)" : ""}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. PREPARATION BY SUBSTRATE AND CONDITION
// ═══════════════════════════════════════════════════════════════════════════

const per100 = (perM2) => r((perM2 / SQFT_PER_M2) * 100, 4);

/** The preset prep steps, in HOURS PER 100 SQ FT. Each is one Resene figure. */
export const PREP_ALLOWANCE_PRESET = Object.freeze({
  wash: per100(0.1),
  seal_smooth: per100(0.08),
  seal_medium: per100(0.1),
  seal_coarse: per100(0.13),
  colours: per100(0.08),
});

export const PREP_STEP_INFO = Object.freeze({
  wash: Object.freeze({ label: "Wash down, scrub and rinse", perM2: 0.1, line: "“Washing down surfaces … scrub and rinse clean (general surfaces)” — 0.10 h/m² (“interior preparatory washing/sealing – repaints”, p. 6)" }),
  seal_smooth: Object.freeze({ label: "Seal coat, smooth plaster or concrete", perM2: 0.08, line: "“Seal concrete or plaster — 1 coat Resene Concrete Primer or Resene Limelock, (a) smooth surface” — 0.08 h/m² (exterior concrete/plaster – new, p. 9)" }),
  seal_medium: Object.freeze({ label: "Masonry primer, medium texture (render)", perM2: 0.1, line: "Same table, “(b) medium texture” — 0.10 h/m²" }),
  seal_coarse: Object.freeze({ label: "Masonry primer, coarse (brick, stone, old masonry)", perM2: 0.13, line: "Same table, “(c) coarse surface” — 0.13 h/m²" }),
  colours: Object.freeze({ label: "Extra colours and cutting in", perM2: 0.08, line: "“Add value colours and cutting in” — 0.08 h/m² (p. 7), on the share of the area in a second or later colour" }),
});

/** Conditions an estimator (or the drawing read) picks — each a list of steps. */
export const PREP_CONDITIONS = Object.freeze({
  painted_plaster: Object.freeze({ label: "Previously painted plaster", steps: Object.freeze(["wash"]) }),
  bare_plaster: Object.freeze({ label: "Bare or new plaster", steps: Object.freeze(["seal_smooth"]) }),
  painted_masonry: Object.freeze({ label: "Previously painted masonry", steps: Object.freeze(["wash"]) }),
  bare_masonry: Object.freeze({ label: "Bare or old masonry / brick (masonry primer)", steps: Object.freeze(["wash", "seal_coarse"]) }),
  render: Object.freeze({ label: "Render / stucco (masonry primer)", steps: Object.freeze(["wash", "seal_medium"]) }),
  timber: Object.freeze({ label: "Painted timber", steps: Object.freeze(["wash"]) }),
  drywall: Object.freeze({ label: "Painted drywall", steps: Object.freeze(["wash"]) }),
  mixed: Object.freeze({ label: "Mixed", steps: Object.freeze(["wash"]) }),
});

/** A book's prep allowances (h per 100 sq ft) over the preset. */
export function prepAllowances(book) {
  const own = book?.prepAllowances && typeof book.prepAllowances === "object" ? book.prepAllowances : {};
  const out = {};
  for (const k of Object.keys(PREP_ALLOWANCE_PRESET)) {
    const v = Number(own[k]);
    const mine = Number.isFinite(v) && v >= 0 && v <= 100 && v !== PREP_ALLOWANCE_PRESET[k];
    out[k] = {
      key: k,
      per100: mine ? v : PREP_ALLOWANCE_PRESET[k],
      perSqft: (mine ? v : PREP_ALLOWANCE_PRESET[k]) / 100,
      own: mine,
      label: PREP_STEP_INFO[k].label,
      line: mine ? `Your figure: ${v} h per 100 sq ft (Settings → Services)` : `${SOURCES.resene.name}: ${PREP_STEP_INFO[k].line}`,
      tag: mine ? "YOURS" : SOURCES.resene.tag,
    };
  }
  return out;
}

/**
 * Prep hours a row carries for a condition: quantity × the condition's steps.
 * Square-foot rows only (a door's prep is not by the square foot). Pure.
 * @returns {{ hours, lines: [{ key, label, per100, hours, line }], why } | null}
 */
export function prepForCondition(condition, quantitySqft, book) {
  const c = condition && Object.hasOwn(PREP_CONDITIONS, condition) ? PREP_CONDITIONS[condition] : null;
  const q = Number(quantitySqft);
  if (!c || !(q > 0)) return null;
  const a = prepAllowances(book);
  const lines = c.steps.map((k) => ({ key: k, label: a[k].label, per100: a[k].per100, hours: r(q * a[k].perSqft, 2), line: a[k].line, tag: a[k].tag }));
  const hours = r(lines.reduce((n, l) => n + l.hours, 0), 2);
  return { hours, lines, why: `${c.label}: ${lines.map((l) => `${l.label} ${Math.round(q).toLocaleString("en-US")} sq ft × ${l.per100} h/100 sq ft = ${l.hours} h`).join(" + ")}` };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2b. PREP MATERIALS — what a condition consumes besides the paint
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner (2026-10-05): "the material cost calculator can complete itself —
// the prep materials, the paint and primer". When a row has a CONDITION, the
// condition's materials are counted on that row: primer or masonry sealer for
// a bare surface, filler, abrasives, tape, drop sheets and caulk for a
// previously painted one. Arithmetic in code; no model call.
//
//   coverage   sq ft of the row one unit serves. Primer's 350 sq ft a gallon
//              is the reference product's own (app/data/materialReference.js
//              primer_gal); the lower figures for render and old masonry, and
//              every consumable's spread, are FieldQuo's stated defaults
//              (GUESS — porous and rough surfaces drink more).
//   price      the company's own (Settings → Services → Access, height and
//              prep), else — primer — its paint book's primer price, else the
//              US shelf price the reference read on 2026-09-24, labelled
//              "default — set yours".
//
// A row with no condition counts nothing new: an ordinary room prices byte
// for byte as before.

export const PREP_MATERIALS = Object.freeze({
  primer_smooth: Object.freeze({ label: "Primer / sealer", unit: "gal", sqftPerUnit: 350, priceKey: "primer", source: "materialReference primer_gal coverage (350 sq ft/gal)" }),
  // Masonry spreads are the book's: NPC 2014 p. 140 (2014 preview), "Masonry
  // … water base primer and sealer" on new or used brick and CMU — 400 / 375 /
  // 350 sq ft a gallon (Slow / Medium / Fast), "the more porous the surface …
  // the more … material will be required". Old porous brick takes the
  // heaviest, 350; render the middle, 375.
  primer_render: Object.freeze({ label: "Masonry primer, render", unit: "gal", sqftPerUnit: 375, priceKey: "masonry_primer", source: "NPC 2014 p. 140 masonry primer & sealer, Medium row (375 sq ft/gal)" }),
  primer_masonry: Object.freeze({ label: "Masonry primer / sealer, brick and stone", unit: "gal", sqftPerUnit: 350, priceKey: "masonry_primer", source: "NPC 2014 p. 140 masonry primer & sealer on brick/CMU, heaviest row (350 sq ft/gal)" }),
  filler: Object.freeze({ label: "Filler / spackle", unit: "tub", sqftPerUnit: 400, priceKey: "filler", source: "FieldQuo default" }),
  abrasives: Object.freeze({ label: "Sanding sponges / abrasives", unit: "each", sqftPerUnit: 300, priceKey: "abrasives", source: "FieldQuo default" }),
  tape: Object.freeze({ label: "Painter's tape", unit: "roll", sqftPerUnit: 200, priceKey: "tape", source: "FieldQuo default" }),
  drop_sheets: Object.freeze({ label: "Drop sheets / plastic", unit: "each", sqftPerUnit: 500, priceKey: "drop_sheets", source: "FieldQuo default — reused across the job" }),
  caulk: Object.freeze({ label: "Paintable caulk", unit: "tube", sqftPerUnit: 300, priceKey: "caulk", source: "FieldQuo default" }),
});

/** What each condition consumes, besides the paint. */
export const CONDITION_MATERIALS = Object.freeze({
  painted_plaster: Object.freeze(["filler", "abrasives", "tape", "drop_sheets", "caulk"]),
  bare_plaster: Object.freeze(["primer_smooth", "tape", "drop_sheets"]),
  painted_masonry: Object.freeze(["filler", "abrasives", "tape", "drop_sheets"]),
  bare_masonry: Object.freeze(["primer_masonry", "tape", "drop_sheets"]),
  render: Object.freeze(["primer_render", "tape", "drop_sheets"]),
  timber: Object.freeze(["filler", "abrasives", "tape", "drop_sheets", "caulk"]),
  drywall: Object.freeze(["filler", "abrasives", "tape", "drop_sheets"]),
  mixed: Object.freeze(["filler", "abrasives", "tape", "drop_sheets"]),
});

/** The preset prices — US shelf prices, Home Depot 2026-09-24 (app/data/materialReference.js). */
export const PREP_MATERIAL_PRICE_PRESET = Object.freeze({ primer: 23.98, filler: 11.48, abrasives: 8.48, tape: 7.98, drop_sheets: 22.75, caulk: 3.62 });
export const PREP_MATERIAL_PRICE_SOURCE = "US shelf price, Home Depot 2026-09-24 (app/data/materialReference.js)";

/** Sundries — rollers, covers, brushes, trays — as a share of the paint. GUESS. */
export const SUNDRIES_PCT_PRESET = 5;

/** A material's price in force, and where it came from. */
export function prepMaterialPrice(priceKey, book) {
  const raw = book?.prepMaterialPrices && typeof book.prepMaterialPrices === "object" ? book.prepMaterialPrices[priceKey] : undefined;
  // null / "" is "not set" — Number(null) is 0, which would read as a free tub.
  const own = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
  // Masonry primer FOLLOWS the regular primer (the owner, 2026-10-05) until
  // the company sets its own: stored as "follows primer", never a copied
  // number, so a change to primer moves it too. Its coverage stays its own.
  if (priceKey === "masonry_primer") {
    if (Number.isFinite(own) && own >= 0) {
      return { price: own, source: "yours", label: "your masonry primer price" };
    }
    const primer = prepMaterialPrice("primer", book);
    return { price: primer.price, source: primer.source, label: "same as primer — set your own", follows: "primer" };
  }
  const preset = PREP_MATERIAL_PRICE_PRESET[priceKey];
  if (Number.isFinite(own) && own >= 0) return { price: own, source: "yours", label: "your price" };
  if (priceKey === "primer") {
    const product = Number(book?.products?.primer?.costPerGal);
    if (book?.products?.primer?.costPerGal !== null && book?.products?.primer?.costPerGal !== undefined && Number.isFinite(product) && product >= 0) {
      return { price: product, source: "yours", label: "your primer price" };
    }
  }
  return { price: preset, source: "default", label: `FieldQuo default — ${PREP_MATERIAL_PRICE_SOURCE}; set yours` };
}

/**
 * The materials a row with a condition consumes: fractional quantities (the
 * money, like the paint's), each with its price and where it came from.
 * Square-foot rows only. Null without a condition. Pure.
 */
export function prepMaterialsFor(condition, quantitySqft, book) {
  const keys = condition && Object.hasOwn(CONDITION_MATERIALS, condition) ? CONDITION_MATERIALS[condition] : null;
  const q = Number(quantitySqft);
  if (!keys || !(q > 0)) return null;
  const items = keys.map((k) => {
    const m = PREP_MATERIALS[k];
    const qty = q / m.sqftPerUnit;
    const p = prepMaterialPrice(m.priceKey, book);
    return { key: k, label: m.label, unit: m.unit, qty: r(qty, 4), unitPrice: p.price, cost: r(qty * p.price, 2), priceSource: p.source, priceLabel: p.label, basis: `${Math.round(q).toLocaleString("en-US")} sq ft ÷ ${m.sqftPerUnit} sq ft per ${m.unit} — ${m.source}` };
  });
  return { items, cost: r(items.reduce((n, i) => n + i.cost, 0), 2) };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DAILY SETUP, AND THE CREW'S DAY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Setup and clean-up, minutes per painter per day — the "SU" and "CU" of the
 * book's SURRPTUCU (NPC 2023 preview p. 10): "about 20 to 30 minutes each day
 * for repaint jobs" each; 25 + 25. Charged on an occupied or heritage
 * building, where a working site cannot be left set up overnight.
 */
export const DAILY_SETUP_PRESET_MINUTES = 50;
export const DAILY_SETUP_LINE = "SURRPTUCU — setup and clean-up “about 20 to 30 minutes each day for repaint jobs” each (NPC 2023 preview p. 10); 25 + 25 min";

export const CREW_PLAN_PRESET = Object.freeze({
  /** Productive hours per painter per day — the owner's default (2026-10-05). */
  hoursPerDay: 7.5,
  /** No field crew on the Team page: plan for two painters. */
  crewSize: 2,
});
/** Restricted site hours (a school in term, a church with services). GUESS. */
export const RESTRICTED_HOURS_PER_DAY = 6;
export const CREW_OPTIONS = Object.freeze([2, 3, 4]);

// ═══════════════════════════════════════════════════════════════════════════
// 4. ACCESS EQUIPMENT RENTAL — NPC 2023 Figure 15, US$ 2023
// ═══════════════════════════════════════════════════════════════════════════
//
// `size` is the row's top height in feet as the book states it. Matched to a
// WORKING height: a scaffold's figure is REACH; a step ladder's is its length
// and a painter works about 4 ft above it (GUESS); a scissor or boom lift's is
// its platform, and working height is platform + 6 ft — the manufacturers' own
// convention (a Genie GS-1930 is a 19 ft platform sold as 25 ft working).

const row = (size, label, day, week, month, page) => Object.freeze({ size, label, day, week, month, page });

export const ACCESS_REFERENCE = Object.freeze({
  step_ladder: Object.freeze({
    label: "Step ladder",
    reachAboveFt: 4,
    heading: "Ladders — Step, fiberglass or wood",
    rows: Object.freeze([
      row(6, "6' step ladder", 12.5, 37.9, 94.3, 33),
      row(8, "8' step ladder", 15.8, 47.2, 119, 33),
      row(10, "10' step ladder", 18.9, 56.8, 141, 33),
      row(12, "12' step ladder", 22.1, 66.2, 166, 33),
      row(14, "14' step ladder", 25.2, 75.8, 189, 33),
      row(16, "16' step ladder", 31.5, 94.3, 236, 33),
      row(20, "20' step ladder", 41, 122, 309, 33),
    ]),
  }),
  extension_ladder: Object.freeze({
    label: "Extension ladder",
    reachAboveFt: 0,
    heading: "Ladders — Aluminum extension",
    rows: Object.freeze([row(36, "16'–36' extension ladder", 47.2, 141, 354, 33), row(60, "40'–60' extension ladder", 71.5, 213, 534, 33)]),
  }),
  scaffold: Object.freeze({
    label: "Rolling scaffold tower",
    reachAboveFt: 0,
    heading: "Scaffolding, rolling stage, caster mounted, 30\" wide by 7' or 10' long",
    rows: Object.freeze([
      row(6, "rolling scaffold, 4'–6' reach", 62.8, 125, 252, 34),
      row(11, "rolling scaffold, 7'–11' reach", 78.6, 158, 315, 34),
      row(16, "rolling scaffold, 12'–16' reach", 110, 221, 441, 34),
      row(21, "rolling scaffold, 17'–21' reach", 150, 299, 598, 34),
      row(26, "rolling scaffold, 22'–26' reach", 166, 330, 662, 34),
      row(30, "rolling scaffold, 27'–30' reach", 180, 362, 725, 34),
    ]),
  }),
  scissor_lift: Object.freeze({
    label: "Scissor lift",
    reachAboveFt: 6,
    heading: "Scissor lifts — Electric powered, rolling with 2' x 3' platform, 650 lb capacity",
    rows: Object.freeze([row(30, "30' scissor lift", 119, 354, 1060, 34), row(40, "40' scissor lift", 205, 616, 1840, 34), row(50, "50' scissor lift", 236, 710, 2130, 34)]),
  }),
  boom_lift: Object.freeze({
    label: "Boom lift",
    reachAboveFt: 6,
    heading: "Boomlifts — Telescoping and articulating booms, self propelled, gas or diesel powered, 2-wheel drive",
    rows: Object.freeze([
      row(30, "21'–30' boom lift", 315, 944, 2820, 33),
      row(40, "31'–40' boom lift", 394, 1180, 3540, 33),
      row(50, "41'–50' boom lift", 513, 1550, 4630, 33),
      row(60, "51'–60' boom lift", 628, 1890, 5680, 33),
    ]),
  }),
  swing_stage: Object.freeze({
    label: "Swing stage",
    reachAboveFt: 0,
    heading: "Swing stage, rental — any length drop, motor operated, excluding safety gear and installation or dismantling",
    rows: Object.freeze([row(null, "swing stage", 158, 472, 1410, 34)]),
    note: "The book: excludes safety gear, installation and dismantling, and “must be set up by a professional”.",
  }),
  crane: Object.freeze({ label: "Crane", reachAboveFt: 0, heading: null, rows: Object.freeze([]) }),
});

/** Owned by default — "you own these" until the company sets a rental rate. */
export const LADDER_KINDS = new Set(["step_ladder", "extension_ladder"]);

export const ACCESS_REFERENCE_CURRENCY = "USD";
export const ACCESS_REFERENCE_YEAR = 2023;
export const ACCESS_KINDS = Object.freeze(Object.keys(ACCESS_REFERENCE));

/** Rental periods in WORKING days: a week covers five, a month twenty. GUESS. */
export const RENTAL_PERIODS = Object.freeze({ weekDays: 5, monthDays: 20 });

/**
 * The cheapest way to rent for `days` working days — months, weeks, days, any
 * of which may be rounded UP when a longer period costs less than the odd days
 * (4 days at $180 is more than a $362 week). Pure.
 */
export function cheapestRental(days, { day, week, month }) {
  const d = Math.max(1, Math.ceil(Number(days) || 0));
  const R = { day: Number(day) >= 0 && day !== null && day !== undefined ? Number(day) : null, week: Number(week) >= 0 && week !== null && week !== undefined ? Number(week) : null, month: Number(month) >= 0 && month !== null && month !== undefined ? Number(month) : null };
  if (R.day === null && R.week === null && R.month === null) return null;
  const P = RENTAL_PERIODS;
  let best = null;
  const maxMonths = R.month !== null ? Math.ceil(d / P.monthDays) : 0;
  for (let m = 0; m <= maxMonths; m++) {
    const afterM = Math.max(0, d - m * P.monthDays);
    const maxWeeks = R.week !== null ? Math.ceil(afterM / P.weekDays) : 0;
    for (let w = 0; w <= maxWeeks; w++) {
      const left = Math.max(0, afterM - w * P.weekDays);
      if (left > 0 && R.day === null) continue;
      const cost = m * (R.month || 0) + w * (R.week || 0) + left * (R.day || 0);
      if (!best || cost < best.cost - 1e-9) best = { cost: r(cost, 2), months: m, weeks: w, days: left };
    }
  }
  if (!best) return null;
  const parts = [];
  if (best.months) parts.push(`${best.months} month${best.months === 1 ? "" : "s"}`);
  if (best.weeks) parts.push(`${best.weeks} week${best.weeks === 1 ? "" : "s"}`);
  if (best.days) parts.push(`${best.days} day${best.days === 1 ? "" : "s"}`);
  return { ...best, text: parts.join(" + ") || "—" };
}

/**
 * The reference row for an equipment kind at a working height — the smallest
 * that reaches; `row: null` when none does (a 45 ft face on a tower). Pure.
 */
export function referenceRowFor(kind, workingHeightFt) {
  const ref = Object.hasOwn(ACCESS_REFERENCE, kind) ? ACCESS_REFERENCE[kind] : null;
  if (!ref || !ref.rows.length) return null;
  if (ref.rows.length === 1 && ref.rows[0].size === null) return { ref, row: ref.rows[0], needFt: null };
  const h = Number(workingHeightFt);
  const need = Number.isFinite(h) && h > 0 ? Math.max(0, h - ref.reachAboveFt) : 0;
  const hit = ref.rows.find((x) => x.size >= need) || null;
  return { ref, row: hit, needFt: r(need, 1) };
}

/**
 * The company's own rental rate for a kind (its currency), or null: the rate
 * for the size that reaches (`sizes["30"]`), else the kind's own rate for any
 * size, else nothing. `owned` — "we own this, no rental" (Settings → Services)
 * — is a rate of 0 for every period.
 */
export function ownAccessRate(book, kind, size = null) {
  const own = book?.accessRates?.[kind];
  if (!own || typeof own !== "object") return null;
  if (own.owned === true) return { day: 0, week: 0, month: 0, owned: true };
  const pick = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));
  const read = (o) => {
    if (!o || typeof o !== "object") return null;
    const day = pick(o.day);
    const week = pick(o.week);
    const month = pick(o.month);
    return day === null && week === null && month === null ? null : { day, week, month };
  };
  const bySize = size !== null && size !== undefined && own.sizes && typeof own.sizes === "object" ? read(own.sizes[String(size)]) : null;
  return bySize ? { ...bySize, size } : read(own);
}

/**
 * One access item priced — the one function the builder and the drawing read
 * both call. Order: the company's own rate for the kind → (scaffold) the
 * company's frame scaffold rate per 100 sq ft of face → the reference row that
 * reaches the working height, converted from US$ → nothing, with the reason.
 * Pure.
 *
 * @param o.fx  { rate, text } USD → the company's currency, or null
 * @returns {{ price, priceSource: "company"|"reference"|null, why, rental?, referenceRow?, unpricedReason? }}
 */
export function priceRental({ kind, workingHeightFt = null, days = 1, faceSqft = null, currency = null, fx = null, book = null }) {
  const label = ACCESS_REFERENCE[kind]?.label || kind;
  const need = Math.max(1, Math.ceil(Number(days) || 0));
  const periods = `a rental week covers ${RENTAL_PERIODS.weekDays} working days and a month ${RENTAL_PERIODS.monthDays} (FieldQuo assumption)`;
  const sizedRow = referenceRowFor(kind, workingHeightFt);
  const own = ownAccessRate(book, kind, sizedRow?.row?.size ?? null);
  if (own?.owned) return { price: 0, priceSource: "company", owned: true, why: `${label} — you own this, no rental (Settings → Services)` };
  if (own) {
    const rent = cheapestRental(need, own);
    if (rent) return { price: rent.cost, priceSource: "company", rental: { ...rent, rates: own, currency }, why: `${label}${own.size ? ` (${own.size} ft)` : ""} at your own rental rates (Settings → Services) for ${need} working day${need === 1 ? "" : "s"}: ${rent.text}; ${periods}` };
  }
  // Ladders (and the planks across them) are kit every painter owns: priced
  // at $0 and SAID, unless the company gives a rental rate for them. The
  // church read rented a $17.81 step ladder for each of ten rooms.
  if (LADDER_KINDS.has(kind)) return { price: 0, priceSource: "default_owned", owned: true, why: `${label} — FieldQuo assumes you own these (no rental). Hire them? Set a rental rate in Settings → Services → Equipment & access` };
  const frame = Number(book?.frameScaffoldPer100Sqft);
  if (kind === "scaffold" && Number.isFinite(frame) && frame >= 0 && book?.frameScaffoldPer100Sqft !== null && Number(faceSqft) > 0) {
    const price = r((Number(faceSqft) / 100) * frame, 2);
    return { price, priceSource: "company", why: `Frame scaffold, erected and dismantled: ${Math.round(faceSqft).toLocaleString("en-US")} sq ft of face × your ${frame} per 100 sq ft (Settings → Services)` };
  }
  const hit = referenceRowFor(kind, workingHeightFt);
  if (!hit) return { price: null, priceSource: null, unpricedReason: "no_reference", why: `NOT priced: FieldQuo holds no cited rental rate for a ${String(label).toLowerCase()} — type your price, or set your rate in Settings → Services → Equipment & access` };
  // Above the book's tallest row (the church: "scaffolding" to 33–42 ft, the
  // table's towers stop at 30 ft reach). A known kind is never left
  // unpriced for being tall: the row is EXTRAPOLATED from the table's own
  // last step, per foot, and the line says so — and that this is taller
  // than the equipment usually goes, so a frame scaffold or a lift quote
  // (or the company's rate) should replace it.
  let row = hit.row;
  let beyond = null;
  if (!row) {
    const rows = hit.ref.rows.filter((x) => Number.isFinite(x.size));
    const top = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (!top || !prev) return { price: null, priceSource: null, unpricedReason: "too_high", why: `NOT priced: the reference ${hit.ref.label.toLowerCase()} rows stop below a working height of ${workingHeightFt} ft — choose other access, type your price, or set your rate in Settings → Services → Equipment & access` };
    const span = top.size - prev.size;
    const extra = Math.max(0, hit.needFt - top.size);
    const per = (k) => (top[k] - prev[k]) / span;
    row = { ...top, size: r(hit.needFt, 1), day: r(top.day + per("day") * extra, 2), week: r(top.week + per("week") * extra, 2), month: r(top.month + per("month") * extra, 2), label: `${top.label} + ${r(extra, 1)} ft (extrapolated)` };
    beyond = `beyond the book's tallest row (${top.label}): ${r(extra, 1)} ft more at the table's own last step, +$${r(per("day"), 2)} a day per ft — taller than a ${hit.ref.label.toLowerCase()} usually goes; a frame scaffold or a lift quote, or your own rate, should replace it`;
  }
  const cur = String(currency || "").toUpperCase();
  const k = cur === ACCESS_REFERENCE_CURRENCY ? 1 : Number(fx?.rate) > 0 ? Number(fx.rate) : null;
  if (!k) return { price: null, priceSource: null, unpricedReason: "no_fx", referenceRow: row.label, why: `NOT priced: the reference rates are in US$ and FieldQuo holds no dated exchange rate to ${cur || "your currency"} — set your own rental rates in Settings → Services → Equipment & access` };
  const conv = (v) => r(v * k, 2);
  const rates = { day: conv(row.day), week: conv(row.week), month: conv(row.month) };
  const rent = cheapestRental(need, rates);
  const sized = hit.needFt === null ? "" : ` for a working height of ${workingHeightFt ?? "?"} ft`;
  return {
    price: rent.cost,
    priceSource: "reference",
    referenceRow: row.label,
    rental: { ...rent, rates, currency: cur },
    ...(beyond ? { extrapolated: true } : {}),
    why: `FieldQuo default, not your rate — ${row.label}${sized}, ${need} working day${need === 1 ? "" : "s"}: ${rent.text} — ${SOURCES.npc2023.name}, Figure 15 p. ${row.page}: $${row.day} day / $${row.week} week / $${row.month} month (US$ ${ACCESS_REFERENCE_YEAR}, not adjusted for inflation${k !== 1 && fx?.text ? `; converted ${fx.text}` : ""}); ${periods}${beyond ? `; ${beyond}` : ""}${hit.ref.note ? ` ${hit.ref.note}` : ""}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE PRESET'S KEYS IN THE BOOK, AND THE COMPANY'S OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════

/** What PAINT_TAKEOFF_DEFAULTS carries — the preset a company starts from. */
export const HEIGHT_PREP_PRESET = Object.freeze({
  heightFactors: HEIGHT_FACTOR_PRESET,
  heightBasisFt: HEIGHT_BASIS_PRESET_FT,
  prepAllowances: PREP_ALLOWANCE_PRESET,
  dailySetupMinutes: DAILY_SETUP_PRESET_MINUTES,
  // Empty: the reference table answers for every kind until the company
  // gives its own rate (its own currency) for one.
  accessRates: Object.freeze({}),
  // No cited figure exists for either: null until the company gives one.
  deliveryPerTrip: null,
  frameScaffoldPer100Sqft: null,
  crewPlan: CREW_PLAN_PRESET,
  // Empty, like accessRates: a price in here is ALWAYS the company's, so one
  // typed equal to the shelf price still reads "your price". The defaults
  // live in PREP_MATERIAL_PRICE_PRESET and prepMaterialPrice() labels them.
  prepMaterialPrices: Object.freeze({}),
  sundriesPct: SUNDRIES_PCT_PRESET,
});

const num = (v, max) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? r(n, 4) : undefined;
};

/**
 * The height/prep/access/crew overrides a company may save, cleaned. Only
 * keys this file knows; a factor below 1 (paying LESS for high work) is
 * refused. Returns {} when nothing survives. Pure.
 */
export function sanitiseHeightPrepOverrides(input) {
  const out = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  if (input.heightFactors && typeof input.heightFactors === "object" && !Array.isArray(input.heightFactors)) {
    const f = {};
    for (const b of HEIGHT_BANDS) {
      const v = num(input.heightFactors[b.key], 10);
      if (v !== undefined && v >= 1) f[b.key] = v;
    }
    if (Object.keys(f).length) out.heightFactors = f;
  }
  if (input.prepAllowances && typeof input.prepAllowances === "object" && !Array.isArray(input.prepAllowances)) {
    const p = {};
    for (const k of Object.keys(PREP_ALLOWANCE_PRESET)) {
      const v = num(input.prepAllowances[k], 100);
      if (v !== undefined) p[k] = v;
    }
    if (Object.keys(p).length) out.prepAllowances = p;
  }
  const basisFt = num(input.heightBasisFt, 40);
  if (basisFt !== undefined) out.heightBasisFt = basisFt;
  const setup = num(input.dailySetupMinutes, 240);
  if (setup !== undefined) out.dailySetupMinutes = setup;
  if (input.accessRates && typeof input.accessRates === "object" && !Array.isArray(input.accessRates)) {
    const rates = {};
    const periodsOf = (x) => {
      const day = num(x?.day, 100000);
      const week = num(x?.week, 100000);
      const month = num(x?.month, 1000000);
      // 0 is a rate: equipment the company owns costs a job nothing.
      if (day === undefined && week === undefined && month === undefined) return null;
      return { ...(day !== undefined ? { day } : {}), ...(week !== undefined ? { week } : {}), ...(month !== undefined ? { month } : {}) };
    };
    for (const kind of ACCESS_KINDS) {
      const x = input.accessRates[kind];
      if (!x || typeof x !== "object" || Array.isArray(x)) continue;
      const entry = { ...(periodsOf(x) || {}) };
      if (x.owned === true) entry.owned = true;
      // A size the reference table has, and nothing else ("30" → the 30 ft rows).
      if (x.sizes && typeof x.sizes === "object" && !Array.isArray(x.sizes)) {
        const known = new Set(ACCESS_REFERENCE[kind].rows.map((row) => String(row.size)));
        const sizes = {};
        for (const [size, v] of Object.entries(x.sizes)) {
          if (!known.has(size)) continue;
          const p = periodsOf(v);
          if (p) sizes[size] = p;
        }
        if (Object.keys(sizes).length) entry.sizes = sizes;
      }
      if (Object.keys(entry).length) rates[kind] = entry;
    }
    if (Object.keys(rates).length) out.accessRates = rates;
  }
  if (input.prepMaterialPrices && typeof input.prepMaterialPrices === "object" && !Array.isArray(input.prepMaterialPrices)) {
    const prices = {};
    for (const k of [...Object.keys(PREP_MATERIAL_PRICE_PRESET), "masonry_primer"]) {
      const v = num(input.prepMaterialPrices[k], 10000);
      if (v !== undefined) prices[k] = v;
    }
    if (Object.keys(prices).length) out.prepMaterialPrices = prices;
  }
  const sundries = num(input.sundriesPct, 50);
  if (sundries !== undefined) out.sundriesPct = sundries;
  // "Use FieldQuo's defaults" — the setup step's other way to done.
  if (input.accessDefaultsConfirmed === true) out.accessDefaultsConfirmed = true;
  const delivery = num(input.deliveryPerTrip, 100000);
  if (delivery !== undefined) out.deliveryPerTrip = delivery;
  const frame = num(input.frameScaffoldPer100Sqft, 100000);
  if (frame !== undefined) out.frameScaffoldPer100Sqft = frame;
  if (input.crewPlan && typeof input.crewPlan === "object" && !Array.isArray(input.crewPlan)) {
    const c = {};
    const hpd = num(input.crewPlan.hoursPerDay, 24);
    if (hpd !== undefined && hpd >= 1) c.hoursPerDay = hpd;
    const size = num(input.crewPlan.crewSize, 50);
    if (size !== undefined && size >= 1 && Number.isInteger(size)) c.crewSize = size;
    if (Object.keys(c).length) out.crewPlan = c;
  }
  return out;
}
