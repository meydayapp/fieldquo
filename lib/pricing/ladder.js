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

/**
 * The currencies the ladder is priced in — the SAME four numbers in each.
 *
 * AUD joined on 2026-09-24, the owner: Australia pays 99/169/269/369 in
 * Australian dollars, "same numbers", exactly as Canada does in CAD. No GBP
 * and no EUR rows, on purpose (same decision): a British or European company
 * is billed on the USD rows — see currencyForCountry. A new entry here is a
 * new set of Plan rows (scripts/seed-seat-ladder.mjs mints them, additive)
 * and a new column on every surface that lists currencies; it is not a
 * conversion and never becomes one.
 */
export const SUPPORTED_CURRENCIES = ["CAD", "USD", "AUD"];

/**
 * Where FieldQuo sells a plan at all: the countries Stripe is generally
 * available to businesses in (stripe.com/global, read 2026-09-25 — the 44
 * countries listed there, not the "preview" ones). The owner's rule of
 * 2026-09-24 is "any other Stripe-capable country = the USD ladder", and a
 * contractor in a country Stripe does not serve could not take a card
 * payment through FieldQuo anyway, so selling them the plan would sell a
 * product whose centre does not work where they are.
 */
export const STRIPE_COUNTRIES = new Set([
  "AU", "AT", "BE", "BR", "BG", "CA", "HR", "CY", "CZ", "DK", "EE", "FI",
  "FR", "DE", "GI", "GR", "HK", "HU", "IE", "IT", "JP", "LV", "LI", "LT",
  "LU", "MY", "MT", "MX", "NL", "NZ", "NO", "PL", "PT", "RO", "SG", "SK",
  "SI", "ES", "SE", "CH", "TH", "AE", "GB", "US",
]);

/**
 * ══ The fifth rung: "Need more people? Build a custom plan." ═══════════════
 *
 * The owner (2026-09-18): "one that says need more staff → create a custom;
 * the minimum is the current max (Scale); let them add more seats, kind of
 * doubling; we cater to small business — no more than 100 total employees
 * (crew + seats); use the current plan logic to determine how many more crew
 * per seat."
 *
 * Every number below is DERIVED from the four rungs above rather than typed
 * beside them, so a reprice of the ladder reprices the custom plan with it,
 * and check:seat-ladder asserts the derivation against the figures the owner
 * signed off:
 *
 *   crew per seat — from Crew upward the ladder holds a CONSTANT gap of five
 *                   between seats and crew (3+8, 6+11, 10+15). Solo's 1+5 is
 *                   the exception that makes the smallest plan viable and is
 *                   not the rule. A custom plan keeps the gap:
 *                       crew = seats + 5
 *                   so it grows "kind of doubling" — 20 seats brings 25 crew,
 *                   45 people in all.
 *
 *   price per seat — the last step of the ladder, Shop → Scale, is the price
 *                   the owner already put on a seat at the top end: $100 for
 *                   4 seats, $25 a seat a month. Cheaper than any earlier step
 *                   (Solo→Crew is $35 a seat, Crew→Shop $33), which is the
 *                   volume discount a bigger shop expects:
 *                       custom(seats) = $369 + $25 × (seats − 10)
 *                   The year keeps the ladder's own discount: the annual
 *                   price is the monthly one times the ratio Scale's annual
 *                   row carries (ten months by default — see
 *                   ANNUAL_FREE_MONTHS), so "two months free" is still true
 *                   of the fifth card.
 *
 *   the cap        — one hundred people in total, seats and crew together.
 *                   seats + (seats + 5) ≤ 100 gives forty-seven seats and
 *                   fifty-two crew: ninety-nine people, the largest company
 *                   FieldQuo sells to on its own. The forty-eighth seat is
 *                   refused, not rounded down.
 *
 *   the floor      — one more seat than Scale (eleven). Ten seats IS Scale,
 *                   and selling "Custom · 10 seats" at Scale's price under a
 *                   different name is a second row for the same thing.
 *
 * A custom plan lives in the Plan table like any rung — one row per seat
 * count per currency, tierKey "custom-<seats>", isPublic false — so every
 * reader of Plan.seats / Plan.crewSeats / Plan.name (seat enforcement,
 * statements, the platform console) prints it with no special case. Only
 * Stripe sees the split: Scale's price plus an "extra seat" price × quantity
 * (lib/platform/stripeBilling.js), which is how the invoice explains the
 * number.
 */
export const CUSTOM_TIER_KEY = "custom";
export const CUSTOM_LABEL = "Custom";
/** Everyone, seats and crew together. The owner's ceiling. */
export const MAX_COMPANY_PEOPLE = 100;

const CREW_RUNG = SEAT_LADDER.find((t) => t.tierKey === "crew");
const SHOP_RUNG = SEAT_LADDER.find((t) => t.tierKey === "shop");
const SCALE_RUNG = SEAT_LADDER[SEAT_LADDER.length - 1];

/** crew − seats, read off the top of the ladder. Five today. */
export const CUSTOM_CREW_GAP = SCALE_RUNG.crewSeats - SCALE_RUNG.seats;
/** What one more seat costs a month: the Shop → Scale step, per seat. $25 today. */
export const CUSTOM_SEAT_PRICE = round2(
  (SCALE_RUNG.price - SHOP_RUNG.price) / (SCALE_RUNG.seats - SHOP_RUNG.seats),
);
/** One more than Scale. Eleven today. */
export const CUSTOM_MIN_SEATS = SCALE_RUNG.seats + 1;
/** The largest seat count whose seats + crew stays within the cap. Forty-seven today. */
export const CUSTOM_MAX_SEATS = Math.floor((MAX_COMPANY_PEOPLE - CUSTOM_CREW_GAP) / 2);
/** The stepper's shortcuts. Only those under the cap are offered. */
export const CUSTOM_QUICK_PICKS = Object.freeze(
  [15, 20, 30, 40].filter((n) => n >= CUSTOM_MIN_SEATS && n <= CUSTOM_MAX_SEATS),
);

/** "custom-20" → 20; anything else → null. */
export function customSeatsFromTierKey(tierKey) {
  const m = /^custom-(\d+)$/.exec(String(tierKey || ""));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= CUSTOM_MIN_SEATS && n <= CUSTOM_MAX_SEATS ? n : null;
}

/** Is this Plan row (or tier) one of the custom sizes? */
export function isCustomPlan(plan) {
  return customSeatsFromTierKey(plan?.tierKey) !== null;
}

/** Is this seat count one FieldQuo will sell on its own? */
export function customSeatsAllowed(seats) {
  const n = Number(seats);
  return Number.isInteger(n) && n >= CUSTOM_MIN_SEATS && n <= CUSTOM_MAX_SEATS;
}

/** The name every surface prints: "Custom · 20 seats · 25 crew". */
export function customPlanName(seats) {
  const n = Number(seats);
  return `${CUSTOM_LABEL} · ${n} seats · ${n + CUSTOM_CREW_GAP} crew`;
}

/**
 * The custom rung for a seat count, priced from a base.
 *
 * `base` is Scale as it stands — by default the ladder's constant, in
 * production the Scale Plan row of the company's currency, which an operator
 * may have repriced. Returns null for a count outside the sellable range
 * rather than clamping: a company that asked for forty-eight seats must be
 * told the cap, not silently sold forty-seven.
 *
 * `extraSeats` and `seatPriceMonthly` / `seatPriceAnnual` are the two Stripe
 * items in the making; the row's price is their sum to the cent.
 */
export function customTier(seats, { base = null } = {}) {
  const n = Number(seats);
  if (!customSeatsAllowed(n)) return null;
  const baseMonthly = round2(num(base?.priceMonthly ?? base?.price ?? SCALE_RUNG.price));
  if (!(baseMonthly > 0)) return null;
  // The base's own year-to-month ratio, so the fifth card keeps whatever deal
  // Scale carries. No annual price on the base means no annual option here
  // either — never a year invented from twelve months.
  const baseAnnualRaw = base ? num(base.priceAnnual) : defaultAnnualPrice(baseMonthly);
  const baseAnnual = baseAnnualRaw > 0 ? round2(baseAnnualRaw) : null;
  const extraSeats = n - SCALE_RUNG.seats;
  const seatPriceMonthly = CUSTOM_SEAT_PRICE;
  const seatPriceAnnual =
    baseAnnual === null ? null : round2(seatPriceMonthly * (baseAnnual / baseMonthly));
  const price = round2(baseMonthly + extraSeats * seatPriceMonthly);
  const priceAnnual = baseAnnual === null ? null : round2(baseAnnual + extraSeats * seatPriceAnnual);
  return {
    tierKey: `${CUSTOM_TIER_KEY}-${n}`,
    label: CUSTOM_LABEL,
    name: customPlanName(n),
    custom: true,
    seats: n,
    crewSeats: n + CUSTOM_CREW_GAP,
    people: n + n + CUSTOM_CREW_GAP,
    price,
    priceAnnual,
    sortOrder: SCALE_RUNG.sortOrder + 1,
    // The Stripe split: Scale's line, plus this many extra seats at this price.
    baseTierKey: SCALE_RUNG.tierKey,
    baseMonthly,
    baseAnnual,
    extraSeats,
    seatPriceMonthly,
    seatPriceAnnual,
  };
}

/**
 * The two Stripe items hiding in a custom Plan ROW, from the row's own
 * numbers — so the items sum to the row's price to the cent, whatever an
 * operator did to Scale since the row was minted.
 *
 * The per-seat amount is the ladder's constant; the annual per-seat amount
 * carries the row's own year-to-month ratio; the base absorbs any rounding.
 * Null for a row that is not a custom size, or one whose price has been
 * edited below what its extra seats alone cost — that row cannot be split
 * honestly and must not reach Stripe as if it could.
 *
 * @returns {{ seats, extraSeats, base: { priceMonthly, priceAnnual },
 *             extra: { month, year } }|null}
 */
export function customPlanSplit(plan) {
  const seats = customSeatsFromTierKey(plan?.tierKey);
  if (!seats) return null;
  const monthly = round2(num(plan.priceMonthly));
  if (!(monthly > 0)) return null;
  const annualRaw = num(plan.priceAnnual);
  const annual = annualRaw > 0 ? round2(annualRaw) : null;
  const extraSeats = seats - SCALE_RUNG.seats;
  const extraMonth = CUSTOM_SEAT_PRICE;
  const extraYear = annual === null ? null : round2(extraMonth * (annual / monthly));
  const baseMonthly = round2(monthly - extraSeats * extraMonth);
  const baseAnnual = annual === null ? null : round2(annual - extraSeats * extraYear);
  if (!(baseMonthly > 0) || (baseAnnual !== null && !(baseAnnual > 0))) return null;
  return {
    seats,
    extraSeats,
    base: { priceMonthly: baseMonthly, priceAnnual: baseAnnual },
    extra: { month: extraMonth, year: extraYear },
  };
}

/**
 * The smallest custom size that holds this many seats and crew, or null past
 * the cap. Same absorption rule as tierFor(): crew may sit in spare seats,
 * seats never in crew slots. For N seats the plan holds N seats and 2N+5
 * people, so N = max(seats, ⌈(seats + crew − 5) / 2⌉), floored at eleven.
 */
export function customTierFor({ seats = 0, crew = 0 } = {}) {
  const s = Math.max(0, Math.floor(num(seats)));
  const c = Math.max(0, Math.floor(num(crew)));
  const n = Math.max(CUSTOM_MIN_SEATS, s, Math.ceil((s + c - CUSTOM_CREW_GAP) / 2));
  return customTier(n);
}

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
  if (iso === "AU" || iso === "AUS" || iso === "AUSTRALIA") return "AUD";
  // ── Everywhere else Stripe serves: the USD ladder ──────────────────────
  //
  // The owner, 2026-09-24. A British, Irish or German company is billed the
  // same four numbers in US dollars; there are no GBP or EUR rows. "UK" is
  // read as GB because hand-typed records say UK and ISO says GB. Anything
  // else — a country Stripe does not serve, or a string that is not a
  // country — is still null: "we don't sell there yet", never a guess.
  const code = iso === "UK" ? "GB" : iso;
  if (/^[A-Z]{2}$/.test(code) && STRIPE_COUNTRIES.has(code)) return "USD";
  return null;
}

/**
 * The symbol a price is written with.
 *
 * "US$" rather than "$" for USD on purpose: this product serves both countries
 * and a bare dollar sign in front of an American price shown to a Canadian is
 * the ambiguity the whole address rule exists to remove. "A$" for AUD is the
 * same rule for the third dollar — and the one the RBA and ATO use.
 */
export function currencyLabel(currency) {
  return currency === "USD" ? "US$" : currency === "CAD" ? "CA$" : currency === "AUD" ? "A$" : "";
}

/**
 * A plan's price, written in the plan's OWN currency, or "—" if there isn't one.
 *
 * Lives beside currencyLabel because it is the same decision: MetricCard's
 * money() hardcodes en-CA/CAD, which would print CA$129 on the USD row of a
 * tier — the two prices are the same NUMBER, not a conversion, so the symbol is
 * the only thing telling them apart.
 *
 * ── Why the type check comes before Number() ─────────────────────────────
 *
 * This was `Number(value || 0)` on /platform/billing/plans, so a price that
 * never arrived printed a confident $0.00 on the screen the public pricing page
 * repeats. Number(null), Number(""), Number([]) and Number(false) are all 0 and
 * 0 is finite, so nothing downstream could tell a free plan from a failed load.
 * A real 0 still formats normally; only absence says it does not know.
 *
 * Here rather than in the page so check:platform-truth can execute it — a text
 * scan for `|| 0` passes the moment somebody writes `?? 0`, and says nothing
 * about the string that comes back.
 */
export function planMoney(value, currency) {
  const usable =
    typeof value === "number" ||
    (typeof value === "string" && value.trim() !== "");
  const n = usable ? Number(value) : NaN;
  if (!Number.isFinite(n)) return "—";
  return `${currencyLabel(currency) || "$"}${n.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
 * The smallest tier that fits, or null when nothing does — not even a custom
 * plan (more than a hundred people).
 *
 * Null means "talk to us" rather than the top tier: silently seating a
 * hundred-and-ten-person company on the largest custom plan would bill them
 * for forty-seven seats and leave people locked out with no explanation.
 *
 * Crew are checked as well as seats. A one-seat shop with nine crew does not
 * fit Solo, and finding that out at the tenth hire — rather than at signup — is
 * the surprise this returns a tier to avoid.
 */
export function tierFor({ seats = 0, crew = 0 } = {}) {
  const s = Math.max(0, Math.floor(num(seats)));
  const c = Math.max(0, Math.floor(num(crew)));
  // ── Crew may sit in an unused SEAT, and this used to refuse them ─────────
  //
  // The old rule was `s <= t.seats && c <= t.crewSeats`, which treats the two
  // allowances as separate buckets. The owner caught it on the twenty-
  // technician case: "we also have the 10 seats. 10 seats and 15 crews is
  // equal to 25 where did you learn how to math."
  //
  // He is right. A seat holder has strictly MORE access than a crew member, so
  // putting a field worker in a spare seat is always permitted — it is
  // over-provisioning, not a breach. Scale is 10 + 15, so twenty technicians
  // and two in the office is twenty-two people and fits: two office and eight
  // field take seats, the remaining twelve take crew slots.
  //
  // Under the old rule that company fit NOTHING, and /cost printed "our plans
  // stop at 25 people, talk to us" to a business of twenty-two.
  //
  // The seats condition stays, and it is the one that matters: a BILLABLE
  // person must have a real seat. Crew cannot absorb a seat, only the other
  // way round — which is what stops this becoming "any 25 people for $369".
  // ── Above Scale is a custom plan, not a conversation ─────────────────────
  //
  // Null used to mean "talk to us" for anyone past ten seats or twenty-five
  // people. The fifth rung (customTier above) now prices that on its own up
  // to a hundred people; null is reserved for the company that is bigger
  // than FieldQuo sells to, which is still a conversation.
  return (
    SEAT_LADDER.find((t) => s <= t.seats && s + c <= t.seats + t.crewSeats) ||
    customTierFor({ seats: s, crew: c })
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
