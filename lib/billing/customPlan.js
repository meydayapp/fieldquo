// lib/billing/customPlan.js
//
// The fifth rung as a Plan ROW: "Custom · 20 seats · 25 crew", one per seat
// count per currency, made the first time somebody asks for it.
//
// ══ Why a row and not a column on the subscription ═════════════════════════
//
// The alternative was Subscription.extraSeats beside Scale's planId, with
// every reader adding it in. Every reader is the problem: seat enforcement
// (lib/pricing/seatLimit.js), the account page, statements, the platform
// console, the company detail page and the sales knowledge base all read
// Plan.seats, Plan.crewSeats, Plan.name and Plan.priceMonthly, and a column
// one of them forgot to add would print "Scale · 10 seats" to a company
// paying for twenty. A row is read by all of them with no new code, and it
// is what the schema already does for the four public rungs — the Plan
// comment on isPublic even describes this shape ("Custom (2 employees)"),
// from the per-headcount model the seat ladder replaced.
//
// ══ Idempotent, and never priced by the browser ════════════════════════════
//
// A screen sends a SEAT COUNT (AGENTS.md non-negotiable #5: the browser never
// sends money). This prices it from the Scale row of the company's own
// currency through customTier() in lib/pricing/ladder.js — the same formula
// the pricing page's stepper shows — and upserts on (tierKey, currency), the
// unique the seeder relies on, so two companies choosing twenty seats share
// one row and a retry creates nothing twice.
//
// The price is REWRITTEN on every ensure rather than left as first minted.
// A custom row is a derivation of Scale, not a rate an operator negotiated,
// so when Scale is repriced in /platform/billing/plans the custom sizes must
// follow — a row frozen at the old Scale price would undercut the ladder it
// is built from. (An existing subscriber's Stripe items are untouched by
// this, exactly as they are when a public rung is repriced.)

import { db } from "@/lib/db";
import {
  customTier,
  customSeatsAllowed,
  CUSTOM_MIN_SEATS,
  CUSTOM_MAX_SEATS,
  MAX_COMPANY_PEOPLE,
  SUPPORTED_CURRENCIES,
  SEAT_LADDER,
} from "@/lib/pricing/ladder";

const SCALE_KEY = SEAT_LADDER[SEAT_LADDER.length - 1].tierKey;

/** The sentence a refusal prints. Says the cap in words, as the owner asked. */
export const CUSTOM_SEATS_ERROR =
  `A custom plan runs from ${CUSTOM_MIN_SEATS} to ${CUSTOM_MAX_SEATS} seats — ` +
  `with the crew that come with them, no more than ${MAX_COMPANY_PEOPLE} people in all. ` +
  "Bigger than that? Contact us.";

/**
 * Parse a seat count from a request body. Integers only, in range, or null —
 * "20.5", "48" and "" are all refused, never rounded to something sellable.
 */
export function parseCustomSeats(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return customSeatsAllowed(n) ? n : null;
}

/**
 * The Scale row this currency prices from. Null when the ladder was never
 * seeded for the currency — there is then nothing to derive a custom plan
 * from, and the caller says so rather than inventing $369.
 */
export async function scaleRowFor(currency) {
  if (!SUPPORTED_CURRENCIES.includes(currency)) return null;
  return db.plan.findUnique({ where: { tierKey_currency: { tierKey: SCALE_KEY, currency } } });
}

/**
 * What the fifth card needs to price itself live, without a round trip per
 * click: the range, the per-seat prices and Scale's base in this currency.
 * Null when the currency has no Scale row (the card is then not rendered —
 * a stepper that cannot say a price is a dead control).
 */
export async function customOfferFor(currency) {
  return customOfferFromScale(await scaleRowFor(currency));
}

/** The pure half of customOfferFor, for a caller that already holds the row. */
export function customOfferFromScale(scale) {
  if (!scale || scale.retiredAt) return null;
  const floor = customTier(CUSTOM_MIN_SEATS, { base: scale });
  if (!floor) return null;
  return {
    currency: scale.currency,
    minSeats: CUSTOM_MIN_SEATS,
    maxSeats: CUSTOM_MAX_SEATS,
    maxPeople: MAX_COMPANY_PEOPLE,
    crewGap: floor.crewSeats - floor.seats,
    baseSeats: Number(scale.seats),
    baseMonthly: floor.baseMonthly,
    baseAnnual: floor.baseAnnual,
    seatPriceMonthly: floor.seatPriceMonthly,
    seatPriceAnnual: floor.seatPriceAnnual,
    aiCopilotEnabled: Boolean(scale.aiCopilotEnabled),
  };
}

/**
 * Find or create the Plan row for this many seats in this currency.
 *
 * @returns {Promise<{ plan, tier }>}  the row and the tier it was priced from
 * @throws  when the count is out of range or the currency has no Scale row —
 *          both are refusals the route turns into a 400 with the sentence.
 */
export async function ensureCustomPlan({ seats, currency }) {
  const n = parseCustomSeats(seats);
  if (n === null) {
    const err = new Error(CUSTOM_SEATS_ERROR);
    err.status = 400;
    throw err;
  }
  const scale = await scaleRowFor(currency);
  if (!scale) {
    const err = new Error(
      `FieldQuo has no ${currency || "priced"} plan ladder to build a custom plan from — please contact us.`,
    );
    err.status = 400;
    throw err;
  }
  const tier = customTier(n, { base: scale });
  const priced = {
    name: tier.name,
    priceMonthly: tier.price,
    priceAnnual: tier.priceAnnual,
    seats: tier.seats,
    crewSeats: tier.crewSeats,
    maxUsers: tier.seats + tier.crewSeats,
    sortOrder: tier.sortOrder,
  };
  const plan = await db.plan.upsert({
    where: { tierKey_currency: { tierKey: tier.tierKey, currency } },
    create: {
      tierKey: tier.tierKey,
      currency,
      ...priced,
      // Off the menu: the picker offers the stepper, never a list of thirty-
      // seven rows, and the public pricing page collapses one card per tier.
      isPublic: false,
      // Everything Scale includes, because a custom plan is Scale with more
      // people — not a different product.
      aiCopilotEnabled: scale.aiCopilotEnabled,
      aiMonthlyTokenCap: scale.aiMonthlyTokenCap,
      features: scale.features ?? undefined,
    },
    update: priced,
  });
  return { plan, tier };
}
