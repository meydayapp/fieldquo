// lib/pricing/ladder.js
//
// What a company pays: which tier they need, and what it costs today.
//
// ══ Seats and crew are different things ════════════════════════════════════
//
// A SEAT is somebody who can create or change a quote, job or invoice. CREW is
// everybody else — the people in the van who see their schedule, clock in and
// upload photos. Crew are included free, because they cost almost nothing to
// serve and charging for them is what makes the competition expensive for a
// real trades business.
//
// ══ Why a seat is not a job title ══════════════════════════════════════════
//
// The obvious implementation counts `role !== "employee"`. It is wrong, and
// gameably so: clampPermissions restricts what a GRANTER may hand out, and
// owners and admins are unrestricted —
//
//     if (actorRole === "owner" || actorRole === "admin") return requested;
//
// — so an owner can set all twenty estimators to Crew and then give each one
// `quotes: view_create_edit` through the custom grid. Twenty people writing
// quotes on a one-seat plan, and every label on the screen says Crew.
//
// So a seat is read off the GRID. If the permissions this person actually holds
// let them originate money, they are a seat, whatever the row is called. That
// also makes the count honest in the other direction: a shop that promotes a
// lead hand sees the seat appear, and can see why.
//
// ══ This file has no database in it ════════════════════════════════════════
//
// Every function is pure, so the whole ladder — including "what happens the day
// a promotion expires" — is executable in a check script rather than reasoned
// about. That path is by definition the one nobody exercises by hand.

import { hasLevel } from "@/lib/permissions/enforce";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The four rungs.
 *
 * Prices are the same NUMBER in each currency rather than a conversion: a
 * Canadian pays CAD$129 and an American USD$129. Competitors quote USD with no
 * selector, so a Canadian pays their sticker plus FX plus a card fee — matching
 * the number in local money is a real discount that costs nothing to give.
 *
 * `crew` is not a rounding of `seats`. It is the number the owner chose, tier
 * by tier, and the people totals it produces (6 / 11 / 17 / 25) are the ones on
 * the pricing page.
 */
export const SEAT_LADDER = [
  { tierKey: "solo", label: "Solo", seats: 1, crewSeats: 5, price: 129, sortOrder: 1 },
  { tierKey: "crew", label: "Crew", seats: 3, crewSeats: 8, price: 189, sortOrder: 2 },
  { tierKey: "shop", label: "Shop", seats: 6, crewSeats: 11, price: 289, sortOrder: 3 },
  { tierKey: "scale", label: "Scale", seats: 10, crewSeats: 15, price: 389, sortOrder: 4 },
];

export const SUPPORTED_CURRENCIES = ["CAD", "USD"];

/**
 * Which money this company is billed in — from their ADDRESS, never a picker.
 *
 * ══ Why it is not selectable ═══════════════════════════════════════════════
 *
 * A currency selector on a subscription is an arbitrage button. The two prices
 * are the same NUMBER, not a conversion, so a Canadian who picks USD is not
 * choosing a currency — they are choosing to pay about 38% more, and an
 * American who picks CAD is choosing to pay about 27% less. One of those is a
 * support ticket and the other is lost revenue, and neither is a decision a
 * customer should be invited to make.
 *
 * The company's country is already collected at signup and already drives the
 * tax jurisdiction, so it is the fact that exists rather than a new question.
 *
 * ══ Unknown is not CAD ═════════════════════════════════════════════════════
 *
 * Returns null when the country is missing or is somewhere we do not price.
 * Three of the twenty-nine companies on this deployment have no country at all,
 * and defaulting them to CAD would be padding absent data with a default — the
 * failure class AGENTS.md names — except here the padding is a price. The
 * caller asks for the address instead, which is one field and answerable.
 */
export function currencyForCountry(country) {
  const iso = String(country || "").trim().toUpperCase();
  if (iso === "CA" || iso === "CAN" || iso === "CANADA") return "CAD";
  if (iso === "US" || iso === "USA" || iso === "UNITED STATES") return "USD";
  return null;
}

/**
 * The symbol a price is written with.
 *
 * "US$" rather than "$" for USD on purpose: this product serves both countries
 * and a bare dollar sign in front of an American price shown to a Canadian is
 * the ambiguity the whole address rule exists to remove.
 */
export function currencyLabel(currency) {
  return currency === "USD" ? "US$" : currency === "CAD" ? "CA$" : "";
}

/** What one extra seat costs beyond a tier's included count. */
export const EXTRA_SEAT_PRICE = 29;

/**
 * Does this member's grid let them originate money?
 *
 * Owners and admins always can — PERMISSIONS gives them "*" and the grid is
 * skipped entirely for them, so asking hasLevel would answer for the wrong
 * reason. Everyone else is asked about the four categories that create
 * billable work. `requests` counts: a lead converted to a quote is the same
 * act one screen earlier.
 */
export const ROLES = ["owner", "admin", "supervisor", "employee"];

export function isBillableSeat(member) {
  if (!member || typeof member !== "object") return false;
  if (!ROLES.includes(member.role)) return false;
  if (member.role === "owner" || member.role === "admin") return true;

  // ── Deliberately stricter than hasLevel, and only here ────────────────────
  //
  // hasLevel treats a member with NO grid as unrestricted — every member
  // predates the permission grid, and refusing them everything would have
  // locked out an entire customer base on deploy. That default is right for
  // access and wrong for billing: it turns a half-written row, or an employee
  // whose grid was never set, into a charge.
  //
  // Money errs the other way. An under-count is a conversation; an over-count
  // is an invoice for a seat nobody has, and the customer is right. So a member
  // with no grid is billed on their ROLE, which is the only thing about them
  // that is certainly true.
  const grid = member.permissions;
  if (!grid || typeof grid !== "object") {
    return member.role === "supervisor";
  }

  return ["quotes", "jobs", "invoices", "requests"].some((category) =>
    hasLevel(member, category, "view_create_edit"),
  );
}

/**
 * Split a roster into what it costs and what it doesn't.
 *
 * Inactive members are counted in neither. A deactivated account cannot write a
 * quote, and billing for it would be charging for a seat somebody has already
 * taken away — the complaint that writes itself.
 */
export function countSeats(members = []) {
  const active = (Array.isArray(members) ? members : []).filter(
    (m) => m && m.active !== false,
  );
  const seats = active.filter(isBillableSeat).length;
  return { seats, crew: active.length - seats, total: active.length };
}

/**
 * The smallest tier that fits, or null when nothing does.
 *
 * Null means "talk to us" rather than the top tier: a shop that needs twelve
 * seats is a conversation, and silently seating them on Scale would bill them
 * for ten and leave two people locked out with no explanation.
 *
 * Crew are checked as well as seats. A one-seat shop with nine crew does not
 * fit Solo, and finding that out at the tenth hire — rather than at signup — is
 * the surprise this returns a tier to avoid.
 */
export function tierFor({ seats = 0, crew = 0 } = {}) {
  const s = Math.max(0, Math.floor(num(seats)));
  const c = Math.max(0, Math.floor(num(crew)));
  return (
    SEAT_LADDER.find((t) => s <= t.seats && c <= t.crewSeats) || null
  );
}

/**
 * Is this promotion running right now?
 *
 * Both halves have to hold. `active` is the switch an operator flips; `endsAt`
 * is the date it stops regardless. A promotion whose date has passed is over
 * even if nobody remembered to turn it off — which is the entire reason the
 * date is required rather than optional.
 */
export function promotionIsLive(promo, now = new Date()) {
  if (!promo || promo.active !== true) return false;
  const t = new Date(now).getTime();
  if (!Number.isFinite(t)) return false;
  const ends = promo.endsAt ? new Date(promo.endsAt).getTime() : NaN;
  // No end date is not a promotion. Treated as not running rather than as
  // running forever, because the failure that costs money is the one where a
  // discount quietly never stops.
  if (!Number.isFinite(ends) || t >= ends) return false;
  if (promo.startsAt) {
    const starts = new Date(promo.startsAt).getTime();
    if (Number.isFinite(starts) && t < starts) return false;
  }
  return true;
}

/** Does it apply to this tier and currency? Empty lists mean "all". */
export function promotionApplies(promo, { tierKey, currency } = {}) {
  const list = (v) => (Array.isArray(v) && v.length ? v : null);
  const tiers = list(promo?.tierKeys);
  const currencies = list(promo?.currencies);
  if (tiers && !tiers.includes(tierKey)) return false;
  if (currencies && !currencies.includes(currency)) return false;
  return true;
}

/**
 * What this tier costs today, and what it reverts to.
 *
 * Always returns BOTH numbers. A pricing page that shows only the promotional
 * figure is the practice that gets a marketing team a letter, and the renderer
 * should not have to go and work out the other one.
 *
 * @returns {{ regular, now, promoApplied, durationMonths, revertsTo, saving,
 *             label, endsAt }}
 */
export function priceFor({ tier, currency = "CAD", promotion = null, now = new Date() } = {}) {
  const regular = round2(num(tier?.price ?? tier?.priceMonthly));
  const base = {
    regular,
    now: regular,
    promoApplied: false,
    durationMonths: 0,
    revertsTo: regular,
    saving: 0,
    label: null,
    endsAt: null,
  };
  if (!tier) return base;
  if (!promotionIsLive(promotion, now)) return base;
  if (!promotionApplies(promotion, { tierKey: tier.tierKey, currency })) return base;

  const value = num(promotion.discountValue);
  const discounted =
    promotion.discountKind === "amount"
      ? regular - value
      : regular * (1 - value / 100);

  // Clamped at zero, and a discount that would take the price to or below zero
  // is refused rather than rendered as free: a $0 subscription line is rejected
  // by Stripe on a one-time item and would fail at checkout, which is a worse
  // way to discover a typo than seeing the price not move.
  const nowPrice = round2(Math.max(0, discounted));
  if (!(nowPrice > 0) || nowPrice >= regular) return base;

  return {
    regular,
    now: nowPrice,
    promoApplied: true,
    durationMonths: Math.max(1, Math.floor(num(promotion.durationMonths) || 3)),
    revertsTo: regular,
    saving: round2(regular - nowPrice),
    label: promotion.label || null,
    endsAt: promotion.endsAt || null,
  };
}

/** The whole ladder, priced, for a pricing page. */
export function ladderFor({ currency = "CAD", promotion = null, now = new Date() } = {}) {
  return SEAT_LADDER.map((tier) => ({
    ...tier,
    currency,
    people: tier.seats + tier.crewSeats,
    pricing: priceFor({ tier, currency, promotion, now }),
  }));
}
