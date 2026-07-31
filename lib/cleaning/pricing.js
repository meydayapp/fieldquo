// lib/cleaning/pricing.js
//
// What a cleaning job costs.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The cleaning intake form already asked for square footage, bedrooms,
// bathrooms, frequency and whether it was a first clean — and NOTHING read
// bedrooms, bathrooms or isFirstClean. Five questions, none of which moved a
// price. The estimator typed a number in by hand and the answers sat in a JSON
// column.
//
// ── The model ──────────────────────────────────────────────────────────────
//
// Built from how the trade actually prices, cross-checked against Housecall
// Pro's published guidance (per-visit, per-room, per-square-foot, hourly, and
// recurring packages):
//
//   base      the larger of a square-foot rate and a per-room rate, so a big
//             empty loft and a small warren of rooms both come out sane
//   × type    standard / deep / move-out / post-construction
//   × condition                                lightly used → neglected
//   + rooms   extra bathrooms cost more than extra bedrooms — a bathroom is
//             the slowest room in any house
//   + pets    real extra time, and the single most under-charged factor
//   + add-ons oven, fridge, windows, cabinets, laundry
//   − frequency discount, applied LAST
//
// ── Rates belong to the company ────────────────────────────────────────────
//
// Same rule as the cabinet rate card. The defaults here are a plausible middle
// of the published market, not a price — a cleaner in rural Ontario and one in
// downtown Toronto do not charge the same, and shipping one of those as "the"
// price is quoting somebody else's business.
//
// ── Nothing trusts its input ───────────────────────────────────────────────
//
// Reachable from the public self-quote form, so every number is clamped. A
// negative square footage must not produce a negative line on a document
// somebody signs.

/** The starting rate card. Editable per company; see cleaningRates. */
export const DEFAULT_CLEANING_RATES = {
  // Per-visit floor. Below this a job doesn't cover the drive.
  minimumCents: 12000,

  // Two ways to size the job. The HIGHER wins — see basePrice().
  centsPerSqft: 15,
  centsPerRoom: 3500,

  // Bathrooms are the slow room. Charged on top of the base rather than folded
  // in, because two bathrooms in a small flat is a real cost the square footage
  // hides completely.
  extraBathroomCents: 2500,
  extraBedroomCents: 1200,

  // Pets. Hair is time, and the trade under-charges for it more than anything
  // else on this list.
  petCents: 1500,

  // What kind of clean.
  typeMultiplier: {
    standard: 1,
    deep: 1.6,
    move_out: 1.8,
    post_construction: 2.4,
  },

  // How hard it's going to be. Named for what a cleaner would say looking at a
  // photo, not "level 1 / level 2".
  conditionMultiplier: {
    well_kept: 0.9,
    normal: 1,
    needs_work: 1.3,
    neglected: 1.7,
  },

  // Recurring discount. The customer commits to a schedule; the cleaner gets a
  // predictable round and a shorter clean each time.
  frequencyDiscount: {
    one_time: 0,
    monthly: 0.05,
    biweekly: 0.12,
    weekly: 0.18,
  },

  // The first visit of a recurring plan is a deep clean in all but name — the
  // house has never been done to standard. Charged as a surcharge so the
  // ongoing price can stay low, which is what wins the contract.
  firstCleanMultiplier: 1.5,
};

/** Add-ons, priced flat. Ids are stable; prices come from the company card. */
export const CLEANING_ADDONS = [
  { key: "inside_oven", label: "Inside the oven", cents: 3500 },
  { key: "inside_fridge", label: "Inside the fridge", cents: 3000 },
  { key: "inside_cabinets", label: "Inside cabinets", cents: 4500 },
  { key: "interior_windows", label: "Interior windows", cents: 6000 },
  { key: "laundry", label: "A load of laundry", cents: 2000 },
  { key: "baseboards", label: "Baseboards", cents: 3500 },
  { key: "garage", label: "Garage sweep-out", cents: 4000 },
];

const round = (n) => Math.max(0, Math.round(n));

/** A finite number in range, else the fallback. */
function num(v, fallback = 0, min = 0, max = 1e6) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** A rate card with every field finite, merged over the defaults. */
export function normaliseCleaningRates(input) {
  const r = { ...DEFAULT_CLEANING_RATES, ...(input && typeof input === "object" ? input : {}) };
  const out = { ...r };

  for (const k of [
    "minimumCents", "centsPerSqft", "centsPerRoom",
    "extraBathroomCents", "extraBedroomCents", "petCents",
  ]) {
    out[k] = num(r[k], DEFAULT_CLEANING_RATES[k], 0, 1e6);
  }

  const mult = (src, def, min, max) => {
    const o = { ...def };
    for (const [k, v] of Object.entries(src || {})) o[k] = num(v, def[k] ?? 1, min, max);
    return o;
  };
  out.typeMultiplier = mult(r.typeMultiplier, DEFAULT_CLEANING_RATES.typeMultiplier, 0.1, 10);
  out.conditionMultiplier = mult(r.conditionMultiplier, DEFAULT_CLEANING_RATES.conditionMultiplier, 0.1, 10);
  // A "discount" above 1 would invert the sign and pay the customer.
  out.frequencyDiscount = mult(r.frequencyDiscount, DEFAULT_CLEANING_RATES.frequencyDiscount, 0, 0.9);
  out.firstCleanMultiplier = num(r.firstCleanMultiplier, 1.5, 1, 5);

  return out;
}

/**
 * The base, before anything is applied to it.
 *
 * The LARGER of square-foot and per-room, deliberately. Each one alone gets a
 * common case badly wrong: a 2,400sqft open-plan loft is four rooms and pricing
 * it per room underestimates it; a 900sqft house chopped into eight small rooms
 * takes far longer than its footprint suggests. Taking the higher covers both,
 * which is what an experienced cleaner does in their head.
 */
function basePrice(rates, { squareFootage, rooms }) {
  const bySqft = num(squareFootage, 0, 0, 100000) * rates.centsPerSqft;
  const byRoom = num(rooms, 0, 0, 60) * rates.centsPerRoom;
  return Math.max(bySqft, byRoom);
}

/**
 * Price a cleaning job.
 *
 * @returns { total, lines, breakdown } — cents throughout.
 *          `lines` is the itemised working, because a cleaning quote that's one
 *          number is a quote the customer haggles with. Showing that the deep
 *          clean and the two dogs are what moved it turns an argument into a
 *          choice.
 */
export function priceCleaning(input, ratesInput) {
  // `input = {}` in the signature does NOT cover an explicit null, and null is
  // what arrives: Quote.scopeDetails is nullable, and a quote with no intake
  // answers yet reads straight through to here.
  if (!input || typeof input !== "object") input = {};
  const rates = normaliseCleaningRates(ratesInput);

  const bedrooms = Math.floor(num(input.bedrooms, 0, 0, 30));
  const bathrooms = Math.floor(num(input.bathrooms, 0, 0, 30));
  const pets = Math.floor(num(input.pets, 0, 0, 20));
  const rooms = bedrooms + bathrooms + Math.floor(num(input.otherRooms, 0, 0, 30));

  const type = rates.typeMultiplier[input.cleaningType] ? input.cleaningType : "standard";
  const condition = rates.conditionMultiplier[input.condition] ? input.condition : "normal";
  const frequency =
    rates.frequencyDiscount[input.frequency] !== undefined ? input.frequency : "one_time";

  const lines = [];
  let subtotal = basePrice(rates, { squareFootage: input.squareFootage, rooms });
  lines.push({ key: "base", label: "Base clean", cents: round(subtotal) });

  // ── Multipliers, before the extras ────────────────────────────────────
  //
  // A deep clean doubles the WORK, not the cost of cleaning the oven — so the
  // multipliers land on the base and the flat add-ons come after. Applying them
  // to everything would charge 2.4× for a load of laundry.
  const typeMult = rates.typeMultiplier[type];
  if (typeMult !== 1) {
    const delta = subtotal * (typeMult - 1);
    subtotal += delta;
    lines.push({ key: "type", label: labelForType(type), cents: round(delta), multiplier: typeMult });
  }

  const condMult = rates.conditionMultiplier[condition];
  if (condMult !== 1) {
    const delta = subtotal * (condMult - 1);
    subtotal += delta;
    lines.push({ key: "condition", label: labelForCondition(condition), cents: round(delta), multiplier: condMult });
  }

  // ── Extras ────────────────────────────────────────────────────────────
  //
  // The first bathroom and bedroom are already in the base; only the ones
  // beyond one are surcharged. Charging for all of them double-counts.
  const extraBaths = Math.max(0, bathrooms - 1);
  if (extraBaths > 0) {
    const c = extraBaths * rates.extraBathroomCents;
    subtotal += c;
    lines.push({ key: "bathrooms", label: `${extraBaths} extra bathroom${extraBaths > 1 ? "s" : ""}`, cents: c });
  }
  const extraBeds = Math.max(0, bedrooms - 1);
  if (extraBeds > 0) {
    const c = extraBeds * rates.extraBedroomCents;
    subtotal += c;
    lines.push({ key: "bedrooms", label: `${extraBeds} extra bedroom${extraBeds > 1 ? "s" : ""}`, cents: c });
  }
  if (pets > 0) {
    const c = pets * rates.petCents;
    subtotal += c;
    lines.push({ key: "pets", label: `${pets} pet${pets > 1 ? "s" : ""}`, cents: c });
  }

  for (const key of Array.isArray(input.addOns) ? input.addOns : []) {
    const addon = CLEANING_ADDONS.find((a) => a.key === key);
    if (!addon) continue; // an id we don't sell is dropped, never priced
    const c = num(rates.addOnCents?.[key], addon.cents, 0, 1e6);
    subtotal += c;
    lines.push({ key: `addon_${key}`, label: addon.label, cents: c });
  }

  // ── First clean, then the recurring discount ──────────────────────────
  //
  // Order matters and this order is the point of the whole model: the surcharge
  // is on the ONE visit, and the discount is on the ONGOING price. Doing it the
  // other way discounts the deep clean and full-prices the easy visits, which
  // is backwards for both sides.
  const isFirst = Boolean(input.isFirstClean) && frequency !== "one_time";
  if (isFirst) {
    const delta = subtotal * (rates.firstCleanMultiplier - 1);
    subtotal += delta;
    lines.push({
      key: "first_clean",
      label: "First visit — brings the house up to standard",
      cents: round(delta),
      multiplier: rates.firstCleanMultiplier,
    });
  }

  const discountRate = rates.frequencyDiscount[frequency] || 0;
  let discount = 0;
  if (discountRate > 0 && !isFirst) {
    discount = subtotal * discountRate;
    subtotal -= discount;
    lines.push({
      key: "frequency",
      label: `${labelForFrequency(frequency)} — ${Math.round(discountRate * 100)}% off`,
      cents: -round(discount),
    });
  }

  // The floor is applied last and only if nothing else got us there. A job
  // below it doesn't cover the drive, and a cleaner who takes it once takes it
  // every week.
  let total = round(subtotal);
  if (total > 0 && total < rates.minimumCents) {
    lines.push({ key: "minimum", label: "Minimum charge", cents: rates.minimumCents - total });
    total = rates.minimumCents;
  }

  return {
    total,
    lines,
    breakdown: { type, condition, frequency, rooms, isFirst, discountRate },
  };
}

function labelForType(t) {
  return {
    standard: "Standard clean",
    deep: "Deep clean",
    move_out: "Move-out clean",
    post_construction: "Post-construction clean",
  }[t] || "Clean";
}

function labelForCondition(c) {
  return {
    well_kept: "Well kept — less work",
    normal: "Normal condition",
    needs_work: "Needs extra attention",
    neglected: "Heavily soiled",
  }[c] || "Normal condition";
}

function labelForFrequency(f) {
  return {
    one_time: "One-off",
    weekly: "Weekly",
    biweekly: "Every two weeks",
    monthly: "Monthly",
  }[f] || "One-off";
}

/** Priced lines in the shape QuoteScopeGroup reads. */
export function cleaningLineItems(input, rates) {
  const { lines } = priceCleaning(input, rates);
  return lines.map((l) => ({
    description: l.label,
    quantity: 1,
    unit: "flat",
    rate: l.cents / 100,
    amount: l.cents / 100,
  }));
}
