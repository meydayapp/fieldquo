// lib/pricing/planOffer.js
//
// What one plan costs on one commitment, today, with whatever promotion is
// running — the ONE place a customer-facing price is worked out.
//
// ══ The owner's model (2026-09-28) ═════════════════════════════════════════
//
// The only REGULAR price is the monthly one (Solo 99, Crew 169, Shop 269,
// Scale 369, the same number in CAD, USD and AUD).
//
// The 1-year commitment is a STANDING PROMOTION for choosing it — "pay 10
// months, get 12", 990 for Solo, about 17% off twelve months. It is stored
// where it always was, Plan.priceAnnual, so no Stripe price, no existing
// subscription and no checkout path had to move; the console presents and
// edits it as the standing 1-year offer (/platform/billing/promotions).
//
// A time-limited SALE (a PlatformPromotion whose appliesTo covers "year") is
// measured against TWELVE TIMES THE MONTHLY PRICE — "40% off, applied to the
// 1-year commitment" is 12 × 99 × 0.6 = 712.80 for Solo's first year — and it
// REPLACES the standing offer for that year; it never stacks on it (40% off
// 990 would be 594, which is not what the owner is selling). The customer
// pays whichever is lower, so a weak sale — 10% off monthly is 1,069.20 — can
// never charge more than the standing 990: it loses, and the console warns.
// After the sale's year the plan renews at the standing offer then in force.
//
// A monthly sale is what priceFor() in lib/pricing/ladder.js always did:
// the monthly price less the discount, for durationMonths, then back.
//
// ══ Why one function, returning everything a card says ═════════════════════
//
// Four surfaces show a plan price to a customer (the in-app picker, /pricing,
// the signup plan step, the custom "Need more people?" card on two of them)
// and a fifth charges it (the Stripe checkout). Each used to divide its own
// numbers. This returns the crossed-out monthly, the big per-month figure,
// the billed total, the saving, the ribbon's percentage, the renewal and the
// exact Stripe discount in cents, so no renderer multiplies anything and the
// card and the charge cannot disagree. Pure: check:promotions-live executes
// it over every tier × currency × interval × promotion state.
//
// The browser never runs this against promotions it chose: the server
// resolves offers (lib/billing/promotions.js) and sends them, and checkout
// reprices from its own rows (AGENTS.md non-negotiable #5).

import {
  promotionIsLive,
  promotionApplies,
  priceFor,
  customSeatsFromTierKey,
  CUSTOM_TIER_KEY,
} from "@/lib/pricing/ladder";

function money(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}
const cents = (n) => Math.round(Number(n) * 100);
const fromCents = (c) => Math.round(c) / 100;
// Whole percent, from the real numbers — "Save 17%", never a typed figure.
const pct = (savedCents, ofCents) => (ofCents > 0 && savedCents > 0 ? Math.round((savedCents / ofCents) * 100) : 0);

/** The public face of a promotion — what a card may print. Never `notes`. */
function publicPromotion(p) {
  return {
    id: p.id ?? null,
    label: p.label || null,
    endsAt: p.endsAt ? new Date(p.endsAt).toISOString() : null,
    kind: p.discountKind === "amount" ? "amount" : "percent",
    value: Number(p.discountValue),
    durationMonths: Math.max(1, Math.floor(Number(p.durationMonths) || 3)),
  };
}

/** Stable order among equal offers, so two renders pick the same one. */
function better(a, b) {
  if (!b) return true;
  if (a.chargeCents !== b.chargeCents) return a.chargeCents < b.chargeCents;
  return String(a.promo.id || "") < String(b.promo.id || "");
}

/**
 * The first-year charge a sale produces on a plan, in cents, measured against
 * twelve times the monthly price — or null when the sale would take it to
 * zero or below (refused, the same rule priceFor applies to a month: Stripe
 * cannot bill nothing, and a 100% "sale" is a typo until proven otherwise).
 */
export function saleFirstYearCents(promotion, monthly) {
  const m = cents(monthly);
  const value = Number(promotion?.discountValue);
  if (!(m > 0) || !Number.isFinite(value) || value <= 0) return null;
  const c =
    promotion.discountKind === "amount"
      ? (m - cents(value)) * 12
      : Math.round(m * 12 * (1 - value / 100));
  return c > 0 ? c : null;
}

/**
 * @param plan        { tierKey, currency, priceMonthly, priceAnnual } — a Plan
 *                    row, or a custom size priced by customTier()
 * @param interval    "month" | "year"
 * @param promotions  the promotions to consider (the server passes the live
 *                    ones; the console passes a draft, switched on)
 * @returns the card's figures; `available: false` when the plan is not sold on
 *          that commitment (no annual price, or no usable monthly one).
 */
export function planOffer({ plan, interval = "month", promotions = [], now = new Date() } = {}) {
  const currency = plan?.currency || null;
  const tierKey = plan?.tierKey || null;
  const monthly = money(plan?.priceMonthly ?? plan?.price);
  const list = (Array.isArray(promotions) ? promotions : []).filter(Boolean);
  const scope = { tierKey, currency, interval };
  // Ladder rows and custom sizes only. A legacy or bespoke row has no tierKey
  // — a rate negotiated with one company — and a public sale is not a
  // statement about it.
  const running = tierKey ? list.filter((p) => promotionIsLive(p, now) && promotionApplies(p, scope)) : [];

  if (interval === "month") {
    if (monthly === null) return { interval, available: false, currency, reason: "noMonthly" };
    let best = null;
    for (const p of running) {
      const priced = priceFor({ tier: { tierKey, price: monthly }, currency, promotion: p, now, interval: "month" });
      if (!priced.promoApplied) continue;
      const cand = { chargeCents: cents(priced.now), promo: publicPromotion(p), months: priced.durationMonths };
      if (better(cand, best)) best = cand;
    }
    const regularCents = cents(monthly);
    const chargeCents = best ? best.chargeCents : regularCents;
    return {
      interval,
      available: true,
      currency,
      monthly,
      // The figure a card prints large, per month.
      perMonth: fromCents(chargeCents),
      // What one invoice charges while the promotion runs.
      charge: fromCents(chargeCents),
      // The crossed-out figure — only when something is actually cheaper.
      crossedPerMonth: best ? monthly : null,
      saves: fromCents(regularCents - chargeCents),
      percent: pct(regularCents - chargeCents, regularCents),
      promo: best ? best.promo : null,
      promoMonths: best ? best.months : 0,
      // What it goes back to after the promotional months.
      renewal: monthly,
      renewalPerMonth: monthly,
      stripe: best
        ? { amountOffCents: regularCents - chargeCents, duration: "repeating", months: best.months, regularCents, chargeCents }
        : null,
    };
  }

  // ── The 1-year commitment ────────────────────────────────────────────────
  const standing = money(plan?.priceAnnual);
  if (monthly === null || standing === null) {
    return { interval: "year", available: false, currency, reason: standing === null ? "noAnnual" : "noMonthly" };
  }
  const twelveCents = cents(monthly) * 12;
  const standingCents = cents(standing);
  let best = null;
  // Sales that exist and apply but would charge MORE than (or the same as)
  // the standing offer. They are not applied — the customer pays the lower —
  // and they are returned so the console can say so beside the preview.
  const outranked = [];
  for (const p of running) {
    const first = saleFirstYearCents(p, monthly);
    if (first === null) continue;
    const promo = publicPromotion(p);
    if (first >= standingCents) {
      outranked.push({ promo, wouldChargeCents: first, wouldCharge: fromCents(first) });
      continue;
    }
    const cand = { chargeCents: first, promo };
    if (better(cand, best)) best = cand;
  }
  const chargeCents = best ? best.chargeCents : standingCents;
  const savesCents = Math.max(0, twelveCents - chargeCents);
  return {
    interval: "year",
    available: true,
    currency,
    monthly,
    twelveMonths: fromCents(twelveCents),
    standing: fromCents(standingCents),
    // Year one: the sale's charge while one runs, the standing offer otherwise.
    charge: fromCents(chargeCents),
    perMonth: fromCents(Math.round(chargeCents / 12)),
    // The monthly price, crossed out — whenever the year is actually cheaper.
    crossedPerMonth: savesCents > 0 ? monthly : null,
    saves: fromCents(savesCents),
    // The ribbon: against twelve months, whole percent, from the real numbers.
    percent: pct(savesCents, twelveCents),
    promo: best ? best.promo : null,
    outranked,
    // After a sale's year: the standing offer then in force.
    renewal: fromCents(standingCents),
    renewalPerMonth: fromCents(Math.round(standingCents / 12)),
    stripe: best
      ? {
          // The Stripe line is the standing annual price; the sale is the
          // difference, taken off the first year only.
          amountOffCents: standingCents - chargeCents,
          duration: "once",
          regularCents: standingCents,
          chargeCents,
        }
      : null,
  };
}

/** Both commitments for one plan. */
export function planOffers({ plan, promotions = [], now = new Date() } = {}) {
  return {
    month: planOffer({ plan, interval: "month", promotions, now }),
    year: planOffer({ plan, interval: "year", promotions, now }),
  };
}

/**
 * What the 1-year tab's label says: "1-year commitment · save 17%", or
 * "save up to 40%" when the plans on the page disagree. From the offers the
 * page is actually showing, so the tab cannot promise a saving no card has.
 */
export function yearTabSaving(offers = []) {
  const percents = offers
    .map((o) => o?.year || o)
    .filter((o) => o && o.interval === "year" && o.available && o.percent > 0)
    .map((o) => o.percent);
  if (!percents.length) return { percent: 0, upTo: false };
  const max = Math.max(...percents);
  return { percent: max, upTo: percents.some((p) => p !== max) };
}

/**
 * The Stripe coupon a discounted checkout needs, as data — duration, window
 * and the id it is minted under — or null when there is no sale.
 *
 * ══ Why the id is deterministic ═══════════════════════════════════════════
 *
 * A coupon per promotion + currency + commitment + amount + window, named so
 * that asking for the same one twice FINDS it (lib/billing/promotions.js
 * retrieves by id before creating, and creates with the id as the
 * idempotency key). A re-run, a double click or two customers buying Solo
 * yearly in CAD on the same day all land on one coupon; a reprice of the
 * plan or an edit to the promotion is a different amount and so a different
 * coupon, never a silent change to one already on somebody's subscription.
 *
 * ══ Why a trial changes "once" into a short "repeating" ═══════════════════
 *
 * Stripe: a `once` coupon "applies only to the first invoice", and "is
 * considered used after the invoice finalizes". A subscription that starts
 * with a free trial issues a $0 invoice on day one — the first invoice — so a
 * `once` coupon attached at checkout would be spent on the free month and
 * the first real year would be charged in full. With a trial the coupon is
 * `repeating` for a window that covers the first paid invoice and ends long
 * before the renewal: trial days ÷ 28 rounded up, plus one month, so even a
 * run of short months cannot push the first charge outside it and the window
 * closes months before the renewal a year later. For a monthly sale it is
 * `durationMonths` + trial days ÷ 31 rounded up, which covers every promised
 * month after the trial — and, when a 30-day trial lands in a 31-day month,
 * can reach one invoice further. Stripe counts a coupon's months from the
 * day it is applied, not from the first charge, so it cannot be exact; it
 * errs toward the customer, never short.
 */
export function stripeDiscountSpec({ offer, promotionId, trialDays = 0 } = {}) {
  const s = offer?.stripe;
  if (!s || !(s.amountOffCents > 0) || !offer.currency) return null;
  const trial = trialDays > 0 ? Number(trialDays) : 0;
  let duration = s.duration;
  let months = null;
  if (offer.interval === "year") {
    if (trial > 0) {
      duration = "repeating";
      // ÷ 28: the shortest month, so the window always reaches the first
      // charge; a year later is far outside it.
      months = Math.ceil(trial / 28) + 1;
      // A window reaching the renewal would discount the second year too.
      if (months >= 12) return { refused: "trial_too_long" };
    }
  } else {
    duration = "repeating";
    // ÷ 31: the longest month, so the window never adds a whole extra month
    // for a trial that fits inside one.
    months = s.months + (trial > 0 ? Math.ceil(trial / 31) : 0);
    if (months > 36) return { refused: "trial_too_long" };
  }
  const cur = String(offer.currency).toLowerCase();
  const tag = duration === "once" ? "once" : `r${months}`;
  const id = `fqpromo_${String(promotionId || offer.promo?.id || "").replace(/[^A-Za-z0-9]/g, "")}_${cur}_${offer.interval === "year" ? "y" : "m"}_${s.amountOffCents}_${tag}`;
  return {
    id,
    amount_off: s.amountOffCents,
    currency: cur,
    duration,
    ...(duration === "repeating" ? { duration_in_months: months } : {}),
    regularCents: s.regularCents,
    chargeCents: s.chargeCents,
  };
}

/**
 * Should the promotion be honoured on THIS purchase path?
 *
 * A new subscription (Checkout), a change booked for the period end (the
 * schedule's new phase carries the coupon) and an immediate change on a
 * trialing subscription (the next invoice IS the first paid one) all charge
 * the discounted figure exactly as the card says. One path cannot: an
 * immediate upgrade on a PAID yearly subscription to another yearly plan.
 * Stripe keeps the billing date, puts the prorations on the renewal invoice
 * a year away, and a `once` coupon would be spent there — discounting the
 * second year instead of this one. The card for that one case shows the
 * standing offer and says why, rather than a price the charge would not
 * match.
 *
 * @param change  classifyPlanChange()'s answer, or null for a new purchase
 */
export function promotionHonoured({ change = null, subscriptionStatus = null, currentInterval = null, nextInterval } = {}) {
  if (!change) return true;
  if (change.applies !== "now") return true;
  if (subscriptionStatus === "trialing") return true;
  if (nextInterval === "year" && currentInterval === "year") return false;
  return true;
}

/** "custom-20" and "custom" match the custom card; rungs match themselves. */
export function tierScopeKey(tierKey) {
  return customSeatsFromTierKey(tierKey) !== null ? CUSTOM_TIER_KEY : tierKey;
}

// ── The standing 1-year offer ──────────────────────────────────────────────
//
// Stored per plan row in Plan.priceAnnual (see the header), edited for every
// ladder row at once from /platform/billing/promotions. Two ways to say it,
// both the owner's: "N months free" (pay 12 − N; the ladder's default is two)
// or a percentage off twelve months of the monthly price.

/** The year a standing offer makes of one monthly price, or null. */
export function standingAnnualFor(monthly, offer) {
  const m = money(monthly);
  if (m === null || !offer) return null;
  const v = Number(offer.value);
  if (offer.kind === "months") {
    if (!Number.isInteger(v) || v < 1 || v > 11) return null;
    return fromCents(cents(m) * (12 - v));
  }
  if (offer.kind === "percent") {
    if (!Number.isFinite(v) || v <= 0 || v >= 100) return null;
    return fromCents(Math.round(cents(m) * 12 * (1 - v / 100)));
  }
  return null;
}

/** Validation for the standing-offer panel. */
export function parseStandingOffer(body = {}) {
  const kind = body?.kind;
  const value = Number(body?.value);
  if (kind === "months") {
    if (!Number.isInteger(value) || value < 1 || value > 11)
      return { error: "Months free has to be a whole number from 1 to 11 — twelve free months is not a year anybody pays for." };
    return { data: { kind, value } };
  }
  if (kind === "percent") {
    if (!Number.isFinite(value) || value <= 0 || value >= 100)
      return { error: "The percentage off twelve months has to be above 0 and below 100." };
    return { data: { kind, value: Math.round(value * 100) / 100 } };
  }
  return { error: 'Say the offer as "months" free or a "percent" off twelve months.' };
}

/**
 * What the standing offer IS across the rows: one statement when every row
 * carries the same deal, "varies" (with the rows) when an operator gave a
 * tier its own, "none" when no row sells a year. Read, never assumed —
 * ANNUAL_FREE_MONTHS is only what a row is minted with.
 */
export function standingOfferSummary(plans = []) {
  const rows = (plans || [])
    .filter((p) => p && p.tierKey && !p.retiredAt)
    .map((p) => {
      const m = money(p.priceMonthly);
      const a = money(p.priceAnnual);
      if (m === null || a === null) return { plan: p, monthsPaid: null, percent: null, annual: null };
      const twelve = cents(m) * 12;
      const annual = cents(a);
      return {
        plan: p,
        monthsPaid: annual % cents(m) === 0 ? annual / cents(m) : null,
        percent: pct(twelve - annual, twelve),
        annual: a,
      };
    });
  if (!rows.length || rows.every((r) => r.annual === null)) return { kind: "none", rows };
  const first = rows[0];
  const uniform = rows.every((r) => r.monthsPaid === first.monthsPaid && r.percent === first.percent);
  return {
    kind: uniform ? "uniform" : "varies",
    monthsPaid: uniform ? first.monthsPaid : null,
    monthsFree: uniform && first.monthsPaid !== null ? 12 - first.monthsPaid : null,
    percent: uniform ? first.percent : null,
    rows,
  };
}
