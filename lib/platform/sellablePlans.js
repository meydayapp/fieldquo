// lib/platform/sellablePlans.js
//
// Which plans may be OFFERED, as opposed to which plans exist — and the one
// sentence any screen is allowed to say about why a plan is not on the menu.
//
// ── The failure this closes ────────────────────────────────────────────────
//
// Every plan in production carries stripePriceId = null. The platform admin
// screen already prints "No Stripe price ID — checkout will fail" on all four
// cards. That WAS the reason this file existed — but checkout no longer needs a
// Stripe price id (stripeBilling.js, point 2), so those four plans are buyable
// and this file was hiding all of them. What it withholds now is a plan with no
// usable price, or one negotiated with a single company.
//
// That is the worst shape a failure can take on a pricing page: it looks
// finished. The customer concludes the problem is their card, retries, and
// each retry has been creating a fresh company record (five "sunset" companies
// exist because of exactly this). The retry half is closed now — /api/companies
// refuses a second company for a login that already has a membership — but the
// half that matters here is not lying about which plans can be bought.
//
// ── Why this doesn't just hide them ────────────────────────────────────────
//
// Filtering unsellable plans out is correct, but on its own it would empty the
// pricing page completely today and silently kill the only route into the
// product. So the caller gets both halves: what is sellable, and whether
// anything was withheld — so the page can say "get in touch" rather than
// render a blank grid.
//
// A page that says "talk to us" converts worse than a working checkout and far
// better than a checkout that takes card details and fails.
//
// ── The price test is BORROWED, not restated ───────────────────────────────
//
// It used to be `Number.isFinite(price) && price >= 0`, written here by hand.
// lib/billing/interval.js decides the same question for the two Stripe
// checkout builders, and its answer is stricter: `money()` rejects <= 0,
// because Stripe will not create a recurring line for nothing and
// recurringLine() throws rather than inventing one.
//
// The two disagreed on exactly the row an operator is most likely to produce
// by accident: Plan.priceMonthly defaults to 0 in the schema and
// parsePlanFields only refuses NEGATIVE prices, so "save a new plan before
// typing the price" made a $0 row that this file called sellable, that the
// public pricing page therefore advertised, and that 500'd the moment anybody
// pressed Choose Plan. Two opinions about one question is how that happens, so
// there is one now: supportsInterval, the same function checkout asks.

import { supportsInterval } from "@/lib/billing/interval";

/** Can this plan actually be bought? (Monthly — the cadence every plan sells
 *  on. Annual is a separate question; see planStatus.) */
export function isSellable(plan) {
  if (!plan) return false;
  // A plan negotiated with one company is not on the menu, however healthy its
  // Stripe wiring is. "Custom (2 employees) — $90/mo" was rendering in the
  // customer-facing picker next to the three standard plans; isPublic is what
  // keeps a bespoke rate from being self-served by everyone else.
  //
  // `=== false` rather than falsy: a plan row read with a narrow select that
  // omits the column must not be silently treated as private and vanish from
  // the pricing page.
  if (plan.isPublic === false) return false;
  // ── stripePriceId is NOT the test, and requiring it emptied the page ─────
  //
  // This file was written when createBillingCheckoutSession looked a plan's
  // Stripe Price up by id, so a row without one really could not be bought.
  // That dependency was then removed deliberately — see the header of
  // lib/platform/stripeBilling.js, point 2: checkout builds `price_data` inline
  // from `plan.priceMonthly`, exactly as the trial session already did,
  // *because* requiring the id meant "Choose Plan" 500'd for every plan and
  // permanently for custom tiers.
  //
  // The removal never reached here. So every plan in production — all four,
  // none of which has ever had a price id — was withheld from the public
  // pricing page as unbuyable, while checkout would in fact have opened
  // perfectly. Ten live subscriptions were created against these very rows.
  //
  // What checkout actually needs is a public plan with a usable price, and that
  // is now the whole test. `stripePriceId` survives on the model as a lookup
  // key for mapping a subscription created OUTSIDE this app back to a plan
  // (stripeBilling.js recoverPlanId), which is a different job and does not
  // gate a sale.
  return supportsInterval(plan, "month");
}

/** Can this plan be bought on a one-year commitment? Its own question: a tier
 *  with no priceAnnual is monthly-only, which is a shape, not a fault. */
export function isSellableAnnually(plan) {
  if (!plan) return false;
  if (plan.isPublic === false) return false;
  return supportsInterval(plan, "year");
}

/**
 * The ONE sentence a screen may print about a plan's standing.
 *
 * ══ Why the copy lives in a lib and not in the card ════════════════════════
 *
 * /platform/billing/plans printed two warnings on every card — "No Stripe
 * price ID — checkout will fail" and "Annual price with no Stripe ID — annual
 * checkout will fail" — and both were false for every plan the product has
 * ever had. A warning that is always wrong is worse than no warning: it trains
 * the reader to skip the one that matters.
 *
 * They were false because they were a SECOND opinion, written beside the card,
 * about a question this file already answers. So the sentence is derived here,
 * from the same predicate the pricing page filters on, and the card renders
 * whatever comes back. A check script can execute this; it cannot execute JSX.
 *
 * Exactly one line, in this precedence:
 *
 *   no_price      the fault worth fixing — it is why the plan is missing from
 *                 /pricing, and it is one field away from being fixed.
 *   private       withheld on purpose. Not a warning; the card carries a
 *                 "Private" badge and this says what the badge means.
 *   monthly_only  sellable, monthly, no annual option. The only place an
 *                 annual sentence is allowed to appear.
 *
 * @returns {{ code: string|null, tone: "warning"|"note"|null, text: string|null }}
 */
export function planStatus(plan) {
  if (!supportsInterval(plan, "month")) {
    return {
      code: "no_price",
      tone: "warning",
      // Names the field and the fix. "Checkout will fail" on its own sent the
      // last reader looking for a Stripe dashboard that had nothing to do with
      // it.
      text:
        "No usable monthly price — set a monthly price above 0 or this plan " +
        "can't be bought, and it won't appear on the pricing page.",
    };
  }
  if (plan.isPublic === false) {
    return {
      code: "private",
      tone: "note",
      text:
        "Private — deliberately kept off the pricing page and the " +
        "company-facing picker. Its own subscribers keep it.",
    };
  }
  if (!supportsInterval(plan, "year")) {
    return {
      code: "monthly_only",
      tone: "note",
      // Deliberately does not repeat "no annual price" — the card's price list
      // already says that. This says what the absence MEANS.
      text: "Monthly only — the 1-year commitment isn't offered on this plan.",
    };
  }
  return { code: null, tone: null, text: null };
}

/**
 * Split a plan list into what may be shown and what was held back.
 *
 * @returns { sellable, withheld, allWithheld }
 *   allWithheld is the state the pricing page has to handle explicitly —
 *   plans exist, none can be bought, and saying nothing at all would look
 *   like FieldQuo has no product.
 */
export function partitionPlans(plans) {
  const list = Array.isArray(plans) ? plans : [];
  const sellable = list.filter(isSellable);
  return {
    sellable,
    withheld: list.filter((p) => !isSellable(p)),
    allWithheld: list.length > 0 && sellable.length === 0,
  };
}

/**
 * Why each withheld plan was withheld, for an operator-facing log.
 *
 * The alert that fires when the pricing page has nothing to offer used to say
 * "all N plans are missing a Stripe price ID" — an explanation that was wrong
 * for every plan that has ever existed, sending whoever read it to the Stripe
 * dashboard. It says what actually happened now.
 */
export function withheldReasons(plans) {
  return (Array.isArray(plans) ? plans : []).map((p) => ({
    name: p?.name ?? null,
    reason: planStatus(p).code,
  }));
}
