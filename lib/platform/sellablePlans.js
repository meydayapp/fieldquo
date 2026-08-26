// lib/platform/sellablePlans.js
//
// Which plans may be OFFERED, as opposed to which plans exist.
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
// exist because of exactly this).
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

/** Can this plan actually be bought? */
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
  // key for mapping a webhook back to a plan (stripeBilling.js), which is a
  // different job and does not gate a sale.
  const price = Number(plan.priceMonthly);
  // A negative or non-numeric price reaching the public page was a real
  // incident, not a hypothetical — QA published "$-5 CAD /month" into the
  // first slot on the pricing grid. The API validates on write now; this is
  // the second line, for rows written before that guard existed.
  if (!Number.isFinite(price) || price < 0) return false;
  return true;
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
