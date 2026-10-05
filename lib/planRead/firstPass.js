// lib/planRead/firstPass.js
//
// The first pass's labour and access, in code — everything the owner's live
// test (2026-10-05) found the read left to the estimator:
//
//   height      30–45 ft masonry priced at ground-level rates. Each surface's
//               area is split by working-height band (lib/planRead/takeoff.js)
//               and each band's share priced at the company's own production
//               rate ÷ the band's factor — written INLINE on the takeoff row,
//               so the quote builder prices it from the same figure
//               ("custom rate on this line only").
//   prep        not priced. Prep by substrate and condition is its own figure
//               on the line's "Prep hours" (the field set_prep_hours uses),
//               never folded into the paint rate; every hour says which cited
//               allowance it came from.
//   crew        no plan. Days on site = hours ÷ (crew × productive hours a
//               day); 2/3/4-painter options side by side.
//   access      $0. Each access line is priced from the company's own rental
//               rates, else from the cited reference table, for as long as the
//               work it serves takes — rounded to rental periods — and marked
//               "estimated from reference" until a person confirms or replaces
//               it.
//   assumptions questions instead of a price. `assumed` (firstPassRules.js)
//               drives the prep, the colours, the daily setup and the
//               productive day here; changing one re-prices without a model
//               call.
//
// Every figure carries `why` — the short source line the screen prints, so
// the estimator can confirm without asking the chat.
//
// Pure.

import { substrateRateFigures } from "@/lib/pricing/paintTakeoff";
import { heightFactorFromShares, heightKindFor, heightWhy, HEIGHT_PREP_PRESET } from "@/lib/pricing/paintHeightPrep";
import { HEIGHT_BANDS, CREW_DEFAULTS, ACCESS_REFERENCE_CURRENCY, figuresFor, priceRental } from "./referenceTables";
import { rateFor, rateRefusal } from "@/lib/marketing/fx";
import { substratePrep } from "./firstPassRules";
import { EQUIPMENT_LABELS, categoryForSubstrate } from "./catalogue";

const r = (n, dp = 2) => {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
};

// ═══════════════════════════════════════════════════════════════════════════
// THE CREW
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crew size, productive hours a day and the daily setup, each with where it
 * came from. A person's figure on the read wins; then the company's.
 *
 * @param model    the stored model (model.plan, model.assumed)
 * @param ctx      { fieldCrew } — active field workers on the Team page
 * @param figures  referenceTables.figuresFor(book)
 */
export function crewSettings({ model = null, ctx = {}, figures = {} } = {}) {
  const plan = model?.plan && typeof model.plan === "object" ? model.plan : {};
  const on = model?.assumed || {};
  let size;
  let sizeWhy;
  if (Number.isInteger(plan.crewSize) && plan.crewSize >= 1 && plan.crewSize <= 50) {
    size = plan.crewSize;
    sizeWhy = "set on this read";
  } else if (figures.crewSize) {
    size = figures.crewSize;
    sizeWhy = "your crew size (Settings → Services)";
  } else if (Number(ctx.fieldCrew) >= 1) {
    size = Math.min(50, Math.floor(Number(ctx.fieldCrew)));
    sizeWhy = `${size} active field worker${size === 1 ? "" : "s"} on your Team page`;
  } else {
    size = CREW_DEFAULTS.crewSize;
    sizeWhy = `FieldQuo's default of ${CREW_DEFAULTS.crewSize} painters — no field crew on your Team page yet`;
  }
  let hoursPerDay;
  let hoursWhy;
  if (Number(plan.hoursPerDay) >= 1 && Number(plan.hoursPerDay) <= 24) {
    hoursPerDay = Number(plan.hoursPerDay);
    hoursWhy = "set on this read";
  } else if (on.siteHours?.value === "restricted") {
    hoursPerDay = CREW_DEFAULTS.restrictedHoursPerDay;
    hoursWhy = `restricted site hours — ${CREW_DEFAULTS.restrictedHoursPerDay} productive hours a day (FieldQuo assumption)`;
  } else if (figures.hoursPerDay) {
    hoursPerDay = figures.hoursPerDay;
    hoursWhy = "your figure (Settings → Services)";
  } else {
    hoursPerDay = CREW_DEFAULTS.hoursPerDay;
    hoursWhy = `FieldQuo's default of ${CREW_DEFAULTS.hoursPerDay} productive hours a painter a day`;
  }
  const setupNeeded = on.occupied?.value === "yes" || on.heritage?.value === "listed";
  const setupPerDay = setupNeeded ? figures.setupHoursPerPainterDay ?? 50 / 60 : 0;
  return {
    size,
    sizeWhy,
    hoursPerDay,
    hoursWhy,
    setupPerDay,
    setupWhy: setupNeeded
      ? `${on.occupied?.value === "yes" ? "Occupied building" : "Heritage building"}: setup and clean-up every day, ${Math.round(setupPerDay * 60)} min a painter — ${figures.setupLine || ""}`
      : null,
    outOfHours: on.siteHours?.value === "out_of_hours",
  };
}

/** Days on site for `workHours` at a crew. Productive time per day is the day
 *  less the daily setup. Pure. */
export function daysFor(workHours, size, hoursPerDay, setupPerDay = 0) {
  const productive = Math.max(0.5, Number(hoursPerDay) - Number(setupPerDay || 0));
  const crew = Math.max(1, Number(size) || 1);
  const days = Number(workHours) > 0 ? Number(workHours) / (crew * productive) : 0;
  return { days: r(days, 2), wholeDays: Math.max(days > 0 ? 1 : 0, Math.ceil(days - 1e-9)), setupHours: r(days * crew * Number(setupPerDay || 0), 2), productive };
}

// ═══════════════════════════════════════════════════════════════════════════
// PREP AND COLOURS — a surface's auto allowance
// ═══════════════════════════════════════════════════════════════════════════

/** Painting substrates the substrate/colour allowances apply to (areas). */
export const WALL_LIKE = new Set(["walls", "ceiling", "wall_two_storey", "siding_trim"]);

/** The condition a wall-like surface is priced on, from the read's assumptions. */
export function surfaceCondition(s, side, assumed = {}) {
  if (!WALL_LIKE.has(s.itemKey) || s.quantity?.unit !== "sqft") return null;
  const v = (side === "exterior" ? assumed.exteriorSurface : assumed.interiorSurface)?.value;
  return v && v !== "none" ? v : null;
}

/** Which side of the building a computed surface is on. */
export function surfaceSide(s, areaSide = null) {
  if (areaSide === "interior" || areaSide === "exterior") return areaSide;
  return categoryForSubstrate(s.itemKey) === "exterior_painting" ? "exterior" : "interior";
}

/**
 * The prep a surface carries by its substrate and the colours, from the
 * assumed assumptions and the cited allowances. A person's or the chat's
 * own prep hours on the line REPLACE it (they are the more specific figure),
 * and the result says so. Pure.
 *
 * @returns {{ hours, auto: { hours, lines }, manual: number|null, why }}
 */
export function surfacePrep(s, { side, assumed = {}, figures }) {
  const qty = Number(s.quantity?.value) || 0;
  const lines = [];
  if (WALL_LIKE.has(s.itemKey) && s.quantity?.unit === "sqft" && qty > 0 && figures?.prep) {
    const sub = side === "exterior" ? assumed.exteriorSurface : assumed.interiorSurface;
    const prep = substratePrep(sub?.value);
    for (const key of prep?.steps || []) {
      const step = figures.prep[key];
      lines.push({ key, label: step.label, perSqft: step.perSqft, quantity: qty, hours: r(qty * step.perSqft), why: `${prep.label}: ${step.line}`, tag: step.tag });
    }
    const colours = Number(assumed.colours?.value) || 1;
    if (colours > 1) {
      const step = figures.prep.colours;
      const share = (colours - 1) / colours;
      lines.push({ key: "colours", label: `${step.label} (${colours} colours)`, perSqft: step.perSqft, quantity: r(qty * share, 0), hours: r(qty * share * step.perSqft), why: step.line, tag: step.tag });
    }
  }
  const autoHours = r(lines.reduce((n, l) => n + l.hours, 0));
  const manual = typeof s.prepHours === "number" && s.prepHours > 0 ? s.prepHours : null;
  return {
    hours: manual ?? autoHours,
    auto: { hours: autoHours, lines },
    manual,
    why:
      manual !== null
        ? `${manual} h set ${s.prepSource === "ai" ? "by FieldQuo AI from the conversation" : "by your team"}${s.prepNote ? ` (${s.prepNote})` : ""}${autoHours > 0 ? ` — replaces the ${autoHours} h allowance` : ""}`
        : lines.length
          ? lines.map((l) => `${l.label}: ${l.quantity.toLocaleString("en-US")} × ${l.perSqft} h = ${l.hours} h`).join(" · ")
          : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HEIGHT → the takeoff row
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One surface's takeoff row at its working height. The share of its area in
 * each band (lib/planRead/takeoff.js) gives one factor on its HOURS through
 * the painting preset's own rule (lib/pricing/paintHeightPrep.js
 * heightFactorFromShares — the builder's rule too: the band-weighted factor
 * over that of a surface at the height the rates were measured at, never
 * below 1). Written as an INLINE rate on the row: the company's production ÷
 * the factor, its hours-per-item × the factor, or a flat rate × the factor
 * (a flat rate includes the labour) — so the quote builder prices the same
 * figure and shows "custom rate on this line only". A factor of 1 leaves the
 * row exactly as it was. Pure.
 *
 * @returns {{ row, height: { factor, raw, basis, basisFt, bands, baseRate, why } | null }}
 */
export function heightRow(row, { shares, itemKey, book, estimateType, unit }) {
  const ok = Array.isArray(shares) && shares.length === HEIGHT_BANDS.length;
  const kind = heightKindFor(itemKey) || (NO_HEIGHT_ITEMS.has(itemKey) ? null : "wall");
  const base = substrateRateFigures(row, book, estimateType);
  if (!ok || !kind || !base) return { row, height: null };
  const h = heightFactorFromShares(shares, kind, book);
  const baseRate =
    base.basis === "flat" ? `flat ${base.sellPerUnit}/${unit}` : base.rateBasis === "item" ? `${base.hoursPerUnit} h each` : `${base.productionRate} ${unit}/h`;
  const height = { ...h, baseRate, rateLabel: base.rateLabel, why: heightWhy(h) };
  if (!(h.factor > 1)) return { row, height };
  const f = h.factor;
  let rate;
  if (base.basis === "flat") {
    rate = { basis: "flat", sellPerUnit: r(base.sellPerUnit * f, 4), ...(base.hoursPerUnit ? { hoursPerUnit: r(base.hoursPerUnit * f, 4) } : {}), ...(base.productionRate ? { productionRate: r(base.productionRate / f, 4) } : {}) };
  } else if (base.rateBasis === "item") {
    rate = { basis: "production", hoursPerUnit: r(base.hoursPerUnit * f, 4) };
  } else {
    rate = { basis: "production", productionRate: r(base.productionRate / f, 4) };
  }
  rate.label = `${base.rateLabel} — ×${f} for height`;
  return { row: { ...row, rateKey: null, rate }, height };
}

/** Items whose own rate is for height already, or that are never worked high. */
const NO_HEIGHT_ITEMS = new Set(["wall_two_storey", "cab_door", "cab_drawer", "cab_box", "cab_builtin", "stain_cab_door", "stain_cab_drawer", "stain_vanity_door", "stain_vanity_drawer", "stain_deck", "stain_tread", "stain_riser"]);

// ═══════════════════════════════════════════════════════════════════════════
// ACCESS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One access line, priced. A price a person typed (or the chat entered from
 * their words) wins; otherwise the painting preset's one pricing function
 * (lib/pricing/paintHeightPrep.js priceRental — the same the quote builder
 * calls): the company's own rental rate for the kind, its frame scaffold rate
 * by the face, else the cited reference row that reaches the working height,
 * for the days the work takes. Never $0 unless a person said 0 (owned
 * equipment). Pure.
 *
 * @param a        the computed access line ({ id, equipment, heightFt, price, priceSource })
 * @param o.days   working days the equipment is needed
 */
export function priceAccessLine(a, { days, currency, fx = null, figures = {}, maxHeightFt = null, faceSqft = null } = {}) {
  const label = EQUIPMENT_LABELS[a.equipment] || a.equipment;
  const typed = typeof a.price === "number" && Number.isFinite(a.price) && a.price >= 0;
  const need = Math.max(1, Math.ceil(Number(days) || 0));
  const workingHeight = Number(a.heightFt) > 0 ? Number(a.heightFt) : Number(maxHeightFt) > 0 ? Number(maxHeightFt) : null;
  const base = { id: a.id, label, equipment: a.equipment, areaName: a.areaName || null, heightFt: workingHeight, days: need, zeroReason: a.zeroReason || null };
  if (typed) {
    return {
      ...base,
      price: r(a.price),
      priceSource: a.priceSource || "person",
      confirmed: true,
      why:
        a.price === 0
          ? "Your own equipment — no charge on this job"
          : a.priceSource === "ai"
            ? "Entered by FieldQuo AI from the estimator's own figure — verify"
            : a.confirmed
              ? `Confirmed by your team${a.confirmedWhy ? ` — ${a.confirmedWhy}` : ""}`
              : "Typed by your team",
    };
  }
  const priced = priceRental({ kind: a.equipment, workingHeightFt: workingHeight, days: need, faceSqft, currency, fx, book: figures.book || null });
  return { ...base, ...priced, confirmed: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * US$ → the company's currency, from a dated, sourced rate (lib/marketing/
 * fx.js — the same rates and refusal rules the rest of the product converts
 * with). Null when there is none, or it is too old: the reference rental
 * rates are then not used, and the line says so. Pure — `asOf` is required.
 */
export function usdFx(currency, rates, asOf) {
  const cur = String(currency || "").toUpperCase();
  if (!cur) return null;
  if (cur === ACCESS_REFERENCE_CURRENCY) return { rate: 1, text: null };
  const rt = rateFor(ACCESS_REFERENCE_CURRENCY, cur, rates);
  if (!rt || rateRefusal(rt, asOf || new Date())) return null;
  const k = rt.base === ACCESS_REFERENCE_CURRENCY ? rt.rate : 1 / rt.rate;
  return { rate: Math.round(k * 10000) / 10000, text: `at 1 USD = ${Math.round(k * 10000) / 10000} ${cur} (${rt.sourceName}, ${rt.rateDate})` };
}

/**
 * Which painting book's height / prep / crew / access figures the read uses.
 * Settings → Services writes them to BOTH painting rows (ServicesEditor's
 * setPaintTakeoff), so they normally agree — but a company whose interior
 * row was never saved (exterior-only) has its figures on the exterior book
 * alone, and taking the interior book first would quietly price its lifts
 * at FieldQuo's defaults. So: the first book carrying any figure of the
 * company's, else the interior one. Exported for the check.
 */
const OWN_FIGURE_KEYS = ["heightFactors", "heightBasisFt", "prepAllowances", "dailySetupMinutes", "accessRates", "accessDefaultsConfirmed", "deliveryPerTrip", "frameScaffoldPer100Sqft", "crewPlan", "prepMaterialPrices", "sundriesPct"];
export function figuresBook(books = {}) {
  const list = [books?.interior_painting, books?.exterior_painting].filter(Boolean);
  const own = list.find((b) => OWN_FIGURE_KEYS.some((k) => b[k] !== undefined && JSON.stringify(b[k]) !== JSON.stringify(HEIGHT_PREP_PRESET[k])));
  return own || list[0] || null;
}

/**
 * Everything priceProject's first pass needs, from the model, the company's
 * paint books and the server's context ({ currency, fx, fieldCrew }). Pure.
 */
export function firstPassOptions({ model = null, books = {}, ctx = {} } = {}) {
  const figures = figuresFor(figuresBook(books));
  return {
    figures,
    crew: crewSettings({ model, ctx, figures }),
    assumed: model?.assumed || {},
    // Quantities the estimator changed on the read's material list.
    materialQty: model?.materialQty && typeof model.materialQty === "object" ? model.materialQty : {},
    currency: ctx.currency || null,
    fx: ctx.fx || null,
  };
}

/** Delivery and pickup — only at the company's own figure: no cited one exists. */
export function deliveryLine(priced, figures) {
  const lifts = priced.filter((p) => ["scissor_lift", "boom_lift", "scaffold", "swing_stage"].includes(p.equipment) && p.price !== 0);
  if (!lifts.length) return null;
  if (figures?.deliveryPerTrip === null || figures?.deliveryPerTrip === undefined) {
    return { price: null, why: "Delivery and pickup of lifts and towers are not included — FieldQuo holds no cited figure. Set yours in Settings → Services." };
  }
  const trips = lifts.length * 2;
  return { price: r(trips * figures.deliveryPerTrip), trips, why: `${trips} trips (delivery and pickup for ${lifts.length} item${lifts.length === 1 ? "" : "s"}) × your ${figures.deliveryPerTrip} a trip` };
}

/**
 * Access a side NEEDS that the read did not list — work above 8 ft with no
 * access line for that area. One line per area, sized to its highest work:
 * step ladders to 12 ft, a rolling tower to 30 ft, a boom lift above.
 * Added at read time to the stored model (so every person and chat op works
 * on it), marked as FieldQuo's. Pure.
 */
export function missingAccess(computed) {
  const out = [];
  const areas = new Map((computed?.areas || []).map((a) => [a.id, a]));
  const covered = new Set((computed?.access || []).filter((a) => a.included !== false).map((a) => a.areaId || "*"));
  if (covered.has("*")) return out;
  const top = new Map();
  for (const s of computed?.surfaces || []) {
    if (!s.active || !Array.isArray(s.bands)) continue;
    const hi = s.bands.reduce((n, share, i) => (share > 0.001 ? i : n), 0);
    if (hi < 1) continue;
    const key = s.areaId || null;
    const height = s.topFt || HEIGHT_BANDS[hi].upTo || 30;
    top.set(key, Math.max(top.get(key) || 0, height, HEIGHT_BANDS[hi].from + 1));
  }
  for (const [areaId, h] of top) {
    if (covered.has(areaId || "*")) continue;
    const equipment = h <= 12 ? "step_ladder" : h <= 30 ? "scaffold" : "boom_lift";
    out.push({
      areaId,
      equipment,
      workingHeightFt: Math.ceil(h),
      heightRef: null,
      reason: `Added by FieldQuo: work up to about ${Math.ceil(h)} ft${areaId && areas.get(areaId) ? ` on ${areas.get(areaId).name}` : ""} on the measured drawings, and no access was listed for it`,
      included: true,
      price: null,
      auto: true,
    });
  }
  return out;
}
