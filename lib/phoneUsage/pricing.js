// lib/phoneUsage/pricing.js
//
// What a text or a call minute costs a company. PURE and import-free, so the
// crew meter, the business-number meter, the settlement cron and the platform
// cost table all read ONE rule.
//
// ══ The rule (owner, 2026-10-03) ═════════════════════════════════════════════
//
// A company pays TWICE what the message or minute cost FieldQuo at Twilio,
// using the price Twilio reports on the record itself — never less than the
// floor:
//
//   text      2¢ a segment     (CREW_SMS_CENTS)
//   photo     5¢ a message     (CREW_MMS_CENTS)
//   call      5¢ a minute      (BUSINESS_CALL_CENTS_PER_MINUTE)
//
// The floor is charged the moment the text or call happens (Twilio's price
// arrives minutes later, sometimes hours); lib/phoneUsage/settle.js tops it up
// to cost × 2 once the price is known. Rounding is UP to the cent, so the
// multiple is never below 2 — a 4.06¢ Bell inbound text (0.83¢ + a 3.23¢
// carrier fee) × 2 = 8.12¢ → 9¢.
//
// The floors used to live in lib/crew/messaging.js and lib/businessNumber/
// costs.js; both now re-export these, so there is one number per thing.

function rateFromEnv(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const MARKUP = 2;

export const TEXT_FLOOR_CENTS = rateFromEnv(process.env.CREW_SMS_CENTS, 2);
export const PHOTO_FLOOR_CENTS = rateFromEnv(process.env.CREW_MMS_CENTS, 5);
export const CALL_FLOOR_CENTS_PER_MINUTE = rateFromEnv(process.env.BUSINESS_CALL_CENTS_PER_MINUTE, 5);

/** Twilio price string ("-0.00830", USD) → millionths of a dollar, or null. */
export function priceToMicros(price) {
  if (price === null || price === undefined || price === "") return null;
  const n = Math.abs(Number(price));
  return Number.isFinite(n) ? Math.round(n * 1e6) : null;
}

/** Segments are capped at ten, like every meter here — a forged count must not invent a charge. */
export function cappedUnits(resource, units) {
  const n = Math.max(1, Math.ceil(Number(units) || 1));
  return resource === "call" ? n : Math.min(10, n);
}

/** The floor for one text / photo / call. */
export function floorCents({ resource = "message", units = 1, hasMedia = false } = {}) {
  const u = cappedUnits(resource, units);
  if (resource === "call") return u * CALL_FLOOR_CENTS_PER_MINUTE;
  if (hasMedia) return PHOTO_FLOOR_CENTS;
  return u * TEXT_FLOOR_CENTS;
}

/**
 * What the company pays for one text or call. PURE.
 *
 * @param providerCostMicros  Twilio's price for the whole record (all segments,
 *                            all legs of a call), or null while unknown
 */
export function chargeCentsFor({ resource = "message", units = 1, hasMedia = false, providerCostMicros = null } = {}) {
  const floor = floorCents({ resource, units, hasMedia });
  const cost = Number(providerCostMicros);
  if (providerCostMicros === null || providerCostMicros === undefined || !Number.isFinite(cost) || cost < 0) return floor;
  // 1¢ = 10,000 micros. Up, never down: rounding down could land under 2×.
  const marked = Math.ceil((cost * MARKUP) / 10000);
  return Math.max(floor, marked);
}

/** Cost per unit (segment / photo / minute), in micros. */
export function unitMicros({ resource = "message", units = 1, hasMedia = false, providerCostMicros }) {
  const u = resource === "message" && hasMedia ? 1 : cappedUnits(resource, units);
  return Math.round(Number(providerCostMicros) / u);
}

/** What one unit is charged when it costs `micros`. Used for tiers and banners. */
export function unitChargeCents(priceClass, micros) {
  const kind = classKind(priceClass);
  const floor = kind === "call" ? CALL_FLOOR_CENTS_PER_MINUTE : kind === "mms" ? PHOTO_FLOOR_CENTS : TEXT_FLOOR_CENTS;
  return Math.max(floor, Math.ceil((Number(micros) * MARKUP) / 10000));
}

/** CA | US | INTL — the other party's country, which decides Canadian carrier fees. */
export function countryBucket(country) {
  return country === "CA" || country === "US" ? country : "INTL";
}

/**
 * The cost-tracking bucket for a record. PURE.
 *
 *   sms_in_CA, sms_out_US, mms_in_CA, …   per direction and country
 *   call_forward, call_bridge             a forwarded call (in) or the Call button (out)
 */
export function priceClassFor({ resource = "message", direction = "in", hasMedia = false, country = null } = {}) {
  if (resource === "call") return direction === "out" ? "call_bridge" : "call_forward";
  return `${hasMedia ? "mms" : "sms"}_${direction === "out" ? "out" : "in"}_${countryBucket(country)}`;
}

export function classKind(priceClass) {
  const s = String(priceClass || "");
  if (s.startsWith("call_")) return "call";
  if (s.startsWith("mms_")) return "mms";
  return "sms";
}

/** Every class a banner or table can name — a closed list for the i18n keys. */
export const PRICE_CLASSES = Object.freeze([
  ...["sms", "mms"].flatMap((k) => ["in", "out"].flatMap((d) => ["CA", "US", "INTL"].map((c) => `${k}_${d}_${c}`))),
  "call_forward",
  "call_bridge",
]);

/** A tier is adopted (a real, sustained price) after this many sightings. */
export const SUSTAIN_COUNT = 5;

/**
 * What one more sighting of a unit price means. PURE.
 *
 * @param tier           the PhoneCostTier row AFTER incrementing, or null
 * @param adoptedInClass the OTHER adopted tiers in the class: [{ unitMicros }]
 * @returns {{ adopt: boolean, change: boolean, chargeCents, previousCents }}
 *   change → a sustained price nobody had seen before in a class that already
 *   had one: a platform notice, and a banner if what companies pay moved.
 */
export function tierDecision({ priceClass, tier, adoptedInClass = [] }) {
  const none = { adopt: false, change: false, chargeCents: null, previousCents: null, chargeMoved: false };
  if (!tier || tier.adoptedAt || Number(tier.observations) < SUSTAIN_COUNT) return none;
  const chargeCents = unitChargeCents(priceClass, tier.unitMicros);
  if (!adoptedInClass.length) return { ...none, adopt: true, chargeCents };
  const charges = adoptedInClass.map((t) => unitChargeCents(priceClass, t.unitMicros));
  const previousCents = Math.max(...charges);
  return {
    adopt: true,
    change: true,
    chargeCents,
    previousCents,
    // Companies hear about it only when it RAISES what they pay above the
    // class's dearest price so far. A cheaper new tier is just as likely to be
    // a carrier we had not happened to see yet as a real cut, and announcing
    // "now cost 2¢" for one of those would be a sentence about nothing; the
    // platform notice still records it.
    chargeMoved: chargeCents > previousCents,
  };
}
