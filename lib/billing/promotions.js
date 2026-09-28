// lib/billing/promotions.js
//
// The SERVER half of promotional pricing: which PlatformPromotion rows are
// running, what every plan costs under them, and the Stripe coupon that
// makes checkout charge exactly that.
//
// ══ Why this file exists — promotions were a dead control ═════════════════
//
// PlatformPromotion rows were created at /platform/billing/promotions,
// validated, previewed and audit-logged — and read by nothing outside
// /platform. The pricing page, the in-app plan picker, signup and the Stripe
// checkout never asked for them, so a promotion switched on discounted
// nobody while its console badge said "Applied to checkout". AGENTS.md's
// rule that matters most, exactly: a control that appears to work and
// doesn't.
//
// Every customer surface now resolves prices here and nowhere else:
//
//   /api/settings/plans          — the in-app picker (and its custom card)
//   /api/marketing/plans         — the signup plan step
//   app/(marketing)/pricing      — the public page (a server component)
//   lib/platform/stripeBilling   — both Checkout builders, the immediate
//                                  plan change and the scheduled one
//
// and check:promotions-live asserts each of those files calls it.
//
// ══ The browser sends a plan and a commitment, never an amount ════════════
//
// Non-negotiable #5. The offers a page renders are computed here and sent
// down; the checkout reloads the promotions from the database at the moment
// of purchase and reprices from its own Plan row. A promotion that ended
// between the page loading and the button being pressed is simply not
// applied — the charge follows the database, not the page.

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { recordError } from "@/lib/platform/errorLog";
import { promotionIsLive, promotionApplies, customTier, SUPPORTED_CURRENCIES, CUSTOM_MIN_SEATS, CUSTOM_MAX_SEATS } from "@/lib/pricing/ladder";
import { planOffer, planOffers, stripeDiscountSpec, promotionHonoured } from "@/lib/pricing/planOffer";

/** A Prisma row as plain data: Decimal → number, dates → ISO. */
export function normalisePromotion(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    active: row.active === true,
    startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : null,
    endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : null,
    discountKind: row.discountKind === "amount" ? "amount" : "percent",
    discountValue: Number(row.discountValue),
    durationMonths: Number(row.durationMonths) || 3,
    tierKeys: Array.isArray(row.tierKeys) ? row.tierKeys : null,
    currencies: Array.isArray(row.currencies) ? row.currencies : null,
    appliesTo: row.appliesTo || "month",
  };
}

/**
 * The promotions running at `now`, from the database — the switch AND the
 * dates, decided by promotionIsLive so this, the console badge and the
 * checkout cannot disagree. The WHERE narrows the read; the predicate decides.
 */
export async function livePromotions({ now = new Date(), client = db } = {}) {
  // ── A failed read is "no sale", never a failed page or checkout ──────────
  //
  // Every surface that sells a plan now asks this first, so a throw here
  // would take the pricing page, the picker and the checkout down with it —
  // for a discount. The one expected cause is a deploy that lands before
  // PlatformPromotion.appliesTo exists in the database. Answering "none" is
  // consistent everywhere (the card and the charge both fall back to the
  // regular price together) and the fault is recorded, not swallowed.
  let rows;
  try {
    rows = await client.platformPromotion.findMany({
      where: { active: true, endsAt: { gt: now } },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
  } catch (err) {
    await recordError({
      area: "billing",
      code: "promotions_unreadable",
      message: `Running promotions could not be read, so none were applied: ${err?.message || err}`,
    }).catch(() => {});
    return [];
  }
  return (rows || []).map(normalisePromotion).filter((p) => promotionIsLive(p, now));
}

/**
 * Only the promotions that apply in EVERY one of these currencies.
 *
 * /pricing does not know the visitor's currency — it is decided by the
 * business address at signup — and shows one card per tier for all of them.
 * A sale scoped to CAD alone cannot be printed there without promising it to
 * an American, so it is shown only where the currency is known (signup, the
 * in-app picker) and the public card keeps the price every visitor gets.
 */
export function universalPromotions(promotions, currencies = SUPPORTED_CURRENCIES) {
  return (promotions || []).filter((p) =>
    currencies.every((currency) => promotionApplies({ currencies: p.currencies }, { currency })),
  );
}

/** Every plan with its two offers attached, as `offers: { month, year }`. */
export function withOffers(plans, { promotions = [], now = new Date(), honoured = () => true } = {}) {
  return (plans || []).map((plan) => {
    const plain = { ...plan, priceMonthly: Number(plan.priceMonthly), priceAnnual: plan.priceAnnual == null ? null : Number(plan.priceAnnual) };
    const offers = {
      month: planOffer({ plan: plain, interval: "month", promotions: honoured(plain, "month") ? promotions : [], now }),
      year: planOffer({ plan: plain, interval: "year", promotions: honoured(plain, "year") ? promotions : [], now }),
    };
    for (const interval of ["month", "year"]) {
      if (!honoured(plain, interval)) {
        const would = planOffer({ plan: plain, interval, promotions, now });
        if (would.promo) offers[interval] = { ...offers[interval], withheld: { reason: "immediate_annual_upgrade", promo: would.promo } };
      }
    }
    return { ...plan, offers };
  });
}

/**
 * The custom card's offers for every sellable size, keyed by seat count.
 *
 * The card is a stepper, priced in the browser from Scale's base; the
 * PROMOTIONAL figures are resolved here for all thirty-seven sizes (eleven to
 * forty-seven seats, two commitments each — a few kilobytes) so the stepper
 * reads its sale price off the server's answer instead of applying a discount
 * itself. The custom row is priced by the same customTier() the checkout's
 * ensureCustomPlan mints it with.
 */
export function customOfferTable(offer, { promotions = [], now = new Date(), honoured = () => true } = {}) {
  if (!offer) return null;
  const base = { priceMonthly: offer.baseMonthly, priceAnnual: offer.baseAnnual };
  const table = {};
  for (let seats = CUSTOM_MIN_SEATS; seats <= CUSTOM_MAX_SEATS; seats++) {
    const tier = customTier(seats, { base });
    if (!tier) continue;
    const plan = { tierKey: tier.tierKey, currency: offer.currency, priceMonthly: tier.price, priceAnnual: tier.priceAnnual };
    table[seats] = {
      month: planOffer({ plan, interval: "month", promotions: honoured(plan, "month") ? promotions : [], now }),
      year: planOffer({ plan, interval: "year", promotions: honoured(plan, "year") ? promotions : [], now }),
    };
  }
  return table;
}

/**
 * A predicate for withOffers/customOfferTable: may a promotion be shown on
 * this card, given how pressing it would be charged? See promotionHonoured.
 */
export function honouredFor({ subscription, currentPlan, classify }) {
  return (plan, interval) => {
    const live = subscription?.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(subscription.status);
    if (!live || !currentPlan) return true;
    const change = classify({
      currentPlan,
      currentInterval: subscription.billingInterval,
      nextPlan: plan,
      nextInterval: interval,
    });
    return promotionHonoured({
      change,
      subscriptionStatus: subscription.status,
      currentInterval: subscription.billingInterval || "month",
      nextInterval: interval,
    });
  };
}

// ── The Stripe coupon ─────────────────────────────────────────────────────

/** Stripe caps a coupon name at 40 characters (see lib/billing/retention.js). */
function couponName(label) {
  const text = String(label || "FieldQuo promotion").trim();
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

/**
 * Find the coupon by its deterministic id, or create it under that id with
 * the id as the idempotency key. A coupon that exists under the id but
 * disagrees with the spec is refused rather than used — the id encodes the
 * amount, currency and window, so a mismatch means somebody edited it in the
 * Stripe dashboard, and charging an amount this code did not compute is the
 * one thing this must not do.
 */
export async function ensurePromotionCoupon(spec, { promotion } = {}) {
  let found = null;
  try {
    found = await stripe.coupons.retrieve(spec.id);
  } catch (err) {
    if (err?.code !== "resource_missing" && err?.statusCode !== 404) throw err;
  }
  if (!found) {
    try {
      found = await stripe.coupons.create(
        {
          id: spec.id,
          name: couponName(promotion?.label),
          amount_off: spec.amount_off,
          currency: spec.currency,
          duration: spec.duration,
          ...(spec.duration === "repeating" ? { duration_in_months: spec.duration_in_months } : {}),
          metadata: {
            fieldquo: "platform_promotion",
            promotionId: String(promotion?.id || ""),
          },
        },
        { idempotencyKey: `fq-coupon-${spec.id}` },
      );
    } catch (err) {
      // Two checkouts racing to mint the same coupon: the loser reads the
      // winner's. Anything else is a real failure.
      if (err?.code !== "resource_already_exists") throw err;
      found = await stripe.coupons.retrieve(spec.id);
    }
  }
  const matches =
    found &&
    found.amount_off === spec.amount_off &&
    String(found.currency || "").toLowerCase() === spec.currency &&
    found.duration === spec.duration &&
    (spec.duration !== "repeating" || found.duration_in_months === spec.duration_in_months) &&
    found.valid !== false;
  if (!matches) {
    throw new Error(
      `Stripe coupon ${spec.id} does not match the promotion it is named for ` +
        `(amount_off ${found?.amount_off} ${found?.currency}, ${found?.duration}) — refusing to charge it.`,
    );
  }
  return found.id;
}

/**
 * The discount a purchase should carry, decided NOW from the database.
 *
 * @returns null when no promotion applies (the charge is the regular one), or
 *   { discounts: [{ coupon }], record } — `record` is what is written to
 *   Subscription.promotionApplied and the checkout metadata.
 */
export async function checkoutPromotion({ plan, interval, currency, trialDays = 0, now = new Date(), client = db }) {
  if (!plan?.tierKey) return null;
  // A CAD amount on a USD subscription would be a different discount, and
  // Stripe would refuse it anyway. The plan row's currency is what the offer
  // was priced in; only a purchase in that currency takes it.
  if (String(currency || "").toLowerCase() !== String(plan.currency || "").toLowerCase()) return null;
  const promotions = await livePromotions({ now, client });
  if (!promotions.length) return null;
  const offer = planOffer({
    plan: { ...plan, priceMonthly: Number(plan.priceMonthly), priceAnnual: plan.priceAnnual == null ? null : Number(plan.priceAnnual) },
    interval,
    promotions,
    now,
  });
  if (!offer.available || !offer.promo) return null;
  const promotion = promotions.find((p) => p.id === offer.promo.id) || offer.promo;
  const spec = stripeDiscountSpec({ offer, promotionId: promotion.id, trialDays });
  if (!spec || spec.refused) return null;
  const coupon = await ensurePromotionCoupon(spec, { promotion });
  return {
    discounts: [{ coupon }],
    record: {
      promotionId: promotion.id,
      label: promotion.label || null,
      coupon,
      interval,
      currency: spec.currency,
      regularCents: spec.regularCents,
      chargeCents: spec.chargeCents,
      discountCents: spec.amount_off,
      duration: spec.duration,
      ...(spec.duration_in_months ? { durationInMonths: spec.duration_in_months } : {}),
      ...(interval === "month" ? { promotionalMonths: offer.promoMonths } : {}),
      appliedAt: new Date(now).toISOString(),
    },
  };
}

/** The record, squeezed into one Stripe metadata value (500 chars max). */
export function promotionMetadata(record) {
  if (!record) return {};
  const compact = {
    p: record.promotionId,
    c: record.coupon,
    i: record.interval,
    cur: record.currency,
    r: record.regularCents,
    ch: record.chargeCents,
    d: record.discountCents,
    l: String(record.label || "").slice(0, 80),
  };
  return { promotion: JSON.stringify(compact) };
}

/** The record back out of a checkout session's metadata, or null. */
export function promotionFromMetadata(metadata) {
  const raw = metadata?.promotion;
  if (!raw) return null;
  try {
    const m = JSON.parse(raw);
    if (!m?.p || !m?.c) return null;
    return {
      promotionId: m.p,
      coupon: m.c,
      interval: m.i || null,
      currency: m.cur || null,
      regularCents: Number(m.r) || null,
      chargeCents: Number(m.ch) || null,
      discountCents: Number(m.d) || null,
      label: m.l || null,
    };
  } catch {
    return null;
  }
}

/**
 * What a completed Checkout Session says was charged, added to the record.
 * A trial session charges nothing today (amount_total 0); the discounted
 * charge is then recorded from the first paid invoice — see below.
 */
export function promotionFromCheckoutSession(session, { now = new Date() } = {}) {
  const base = promotionFromMetadata(session?.metadata);
  if (!base) return null;
  return {
    ...base,
    sessionId: session.id || null,
    checkout: {
      amountTotalCents: Number.isFinite(session.amount_total) ? session.amount_total : null,
      amountDiscountCents: Number.isFinite(session.total_details?.amount_discount) ? session.total_details.amount_discount : null,
      amountTaxCents: Number.isFinite(session.total_details?.amount_tax) ? session.total_details.amount_tax : null,
    },
    recordedAt: new Date(now).toISOString(),
  };
}

/** Coupon ids an invoice was discounted by, across Stripe's API shapes. */
function invoiceCouponIds(invoice) {
  const ids = new Set();
  const add = (c) => {
    const id = typeof c === "string" ? c : c?.id;
    if (id) ids.add(id);
  };
  add(invoice?.discount?.coupon);
  for (const d of invoice?.discounts || []) {
    if (typeof d === "object") add(d?.coupon || d?.source?.coupon);
  }
  for (const t of invoice?.total_discount_amounts || []) {
    if (typeof t?.discount === "object") add(t.discount?.coupon || t.discount?.source?.coupon);
  }
  return ids;
}

/**
 * The first invoice that actually carried the promotion's coupon, recorded
 * onto the row: what Stripe collected, the discount and the tax (Stripe Tax
 * computes on the discounted subtotal). Null when this invoice is not that
 * one — another coupon, no coupon, already recorded — so the webhook writes
 * nothing. Pure.
 */
export function promotionChargedFromInvoice(applied, invoice) {
  if (!applied?.coupon || !invoice?.id) return null;
  if (applied.charged?.invoiceId) return null;
  if (!invoiceCouponIds(invoice).has(applied.coupon)) return null;
  const discountCents = (invoice.total_discount_amounts || []).reduce((s, t) => s + (Number(t?.amount) || 0), 0);
  const taxCents = Number.isFinite(invoice.tax)
    ? invoice.tax
    : (invoice.total_taxes || invoice.total_tax_amounts || []).reduce((s, t) => s + (Number(t?.amount) || 0), 0);
  return {
    ...applied,
    charged: {
      invoiceId: invoice.id,
      amountPaidCents: Number.isFinite(invoice.amount_paid) ? invoice.amount_paid : null,
      subtotalCents: Number.isFinite(invoice.subtotal) ? invoice.subtotal : null,
      discountCents,
      taxCents,
      currency: invoice.currency || null,
      at: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : invoice.created
          ? new Date(invoice.created * 1000).toISOString()
          : null,
    },
  };
}

export { planOffers };
