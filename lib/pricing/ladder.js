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
import {
  PERMISSION_CATEGORIES,
  PERMISSION_TOGGLES,
  PERMISSION_PRESETS,
} from "@/lib/permissions";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The four rungs.
 *
 * Prices are the same NUMBER in each currency rather than a conversion: a
 * Canadian pays 99 in Canadian dollars and an American 99 in US dollars.
 *
 * The tier is therefore NAMED without a currency — "Solo", not "Solo (CAD)".
 * A customer only ever sees the one row that matches their address, and telling
 * a Canadian their plan is "Solo (CAD)" invites the question of what the other
 * one costs, which is a question with no useful answer: it is the same number.
 * The currency lives in the `currency` column, where the operator console and
 * Stripe read it. Competitors quote USD with no
 * selector, so a Canadian pays their sticker plus FX plus a card fee — matching
 * the number in local money is a real discount that costs nothing to give.
 *
 * `crew` is not a rounding of `seats`. It is the number the owner chose, tier
 * by tier, and the people totals it produces (6 / 11 / 17 / 25) are the ones on
 * the pricing page.
 */
export const SEAT_LADDER = [
  { tierKey: "solo", label: "Solo", seats: 1, crewSeats: 5, price: 99, sortOrder: 1 },
  { tierKey: "crew", label: "Crew", seats: 3, crewSeats: 8, price: 169, sortOrder: 2 },
  { tierKey: "shop", label: "Shop", seats: 6, crewSeats: 11, price: 269, sortOrder: 3 },
  { tierKey: "scale", label: "Scale", seats: 10, crewSeats: 15, price: 369, sortOrder: 4 },
];

export const SUPPORTED_CURRENCIES = ["CAD", "USD"];

/**
 * What a year's commitment is worth.
 *
 * ══ Why it is not zero ═════════════════════════════════════════════════════
 *
 * It was. The owner said "the 1 yr commitment is just billed annually instead
 * of the no commitment" and that was built literally — same rate, one charge a
 * year. He then pointed at the competitor pricing he had already given me:
 * Connect is $139 a month monthly and $99 a month billed annually, about 29%
 * off. A commitment with no discount asks a customer to give up flexibility for
 * nothing, so nobody takes it, so the commitment is not bought — which is the
 * opposite of what it exists for.
 *
 * ══ Two months free ════════════════════════════════════════════════════════
 *
 * Expressed as MONTHS rather than a percentage because that is what a
 * contractor can check in his head: pay for ten, get twelve. A percentage means
 * a different amount on every rung and reads as a number somebody chose.
 *
 * It is 16.7%, less than the competitor's ~29% — deliberately, because this
 * ladder already undercuts them on the monthly rate, and discounting twice from
 * a lower base gives away margin to win a comparison that was already won.
 *
 * This is the DEFAULT. Plan.priceAnnual is a real column an operator edits in
 * /platform/billing/plans, so any rung can carry a different deal without a
 * deploy — and a plan whose annual price is null simply has no annual option.
 */
export const ANNUAL_FREE_MONTHS = 2;

/** What a year costs at the ladder's default: pay for ten, get twelve. */
export function defaultAnnualPrice(monthly) {
  const m = num(monthly);
  return m > 0 ? round2(m * (12 - ANNUAL_FREE_MONTHS)) : 0;
}

/**
 * What choosing the year actually saves, against paying monthly for a year.
 *
 * Returns the figures a card needs to SAY it — the saving, the effective
 * monthly rate, and the percentage — rather than leaving each renderer to do
 * the arithmetic and get a different answer. Zero saving returns `saves: 0` so
 * a caller can hide the badge instead of printing "Save $0".
 */
export function annualComparison({ priceMonthly, priceAnnual } = {}) {
  const monthly = num(priceMonthly);
  const annual = num(priceAnnual);
  if (!(monthly > 0) || !(annual > 0)) {
    return { available: false, saves: 0, percent: 0, perMonth: 0, twelveMonths: 0 };
  }
  const twelveMonths = round2(monthly * 12);
  const saves = round2(twelveMonths - annual);
  return {
    available: true,
    twelveMonths,
    saves: saves > 0 ? saves : 0,
    percent: saves > 0 ? Math.round((saves / twelveMonths) * 100) : 0,
    // The number a buyer compares against the monthly price on the card beside
    // it. Rounded to the cent, not the dollar — "$82.50 a month" is checkable
    // against $990 a year; "$83" is not.
    perMonth: round2(annual / 12),
  };
}

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

/**
 * The most any FREE person may hold: the Crew preset, dial for dial.
 *
 * Built from the preset rather than restated, so the ceiling cannot drift away
 * from the thing it is the ceiling of. A category the preset says nothing about
 * sits at its BOTTOM rung — a new category added to the grid next year is
 * therefore free at its lowest setting and paid above it, rather than free at
 * every setting because nobody remembered to come back here.
 */
const CREW_CEILING = Object.fromEntries(
  Object.keys(PERMISSION_CATEGORIES).map((key) => [
    key,
    PERMISSION_PRESETS.worker.values[key] ?? PERMISSION_CATEGORIES[key].levels[0].value,
  ]),
);

/** Where a level sits on its own ladder; -1 for anything unrecognised. */
function rung(category, value) {
  return PERMISSION_CATEGORIES[category].levels.findIndex((l) => l.value === value);
}

/**
 * Does this grid stay at or below what Crew gets?
 *
 * An unrecognised level reads as ABOVE the ceiling. The alternative — treating
 * a value we cannot place as harmless — makes a typo free, and this function
 * decides what a company pays.
 */
function withinCrewCeiling(grid) {
  for (const category of Object.keys(PERMISSION_CATEGORIES)) {
    const ceiling = rung(category, CREW_CEILING[category]);
    const held = grid[category] === undefined ? 0 : rung(category, grid[category]);
    if (held === -1 || held > ceiling) return false;
  }
  // Toggles are booleans, and Crew holds none of them. `true` where the preset
  // says false is an escalation exactly as a raised dial is.
  for (const toggle of Object.keys(PERMISSION_TOGGLES)) {
    if (grid[toggle] === true && PERMISSION_PRESETS.worker.values[toggle] !== true) {
      return false;
    }
  }
  return true;
}

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

  // ── Free is defined by a CEILING, not by four named categories ────────────
  //
  // This asked whether the person held quotes, jobs, invoices or requests at
  // view_create_edit — the four that originate money. Everything else was free
  // by omission, and the omission was the hole the owner walked into: he picked
  // Crew, moved one dial, and got somebody who edits the whole company's rota
  // at no charge. The same door was open on payroll: view_all, expenses across
  // the company, everyone's hours, every note, and clientsProperties:
  // full_edit — the exportable client list, on a row that costs nothing.
  //
  // A named-categories rule is a denylist, and CLIENT_RESTRICTED_FIELDS in
  // lib/permissions/enforce.js already makes the argument against those here:
  // a denylist silently leaks every column added later. This grid gains
  // categories. So the question is inverted — free means AT OR BELOW what Crew
  // is, and anything above it is a seat, whatever it is called on screen.
  //
  // It follows that the four originating categories still bill, because Crew
  // holds none of them above view_only. Nothing that was billable stops being
  // billable; things that were free and should not have been now are.
  return !withinCrewCeiling(grid);
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
