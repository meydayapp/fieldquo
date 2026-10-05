// lib/billing/planLine.js
//
// The Stripe line that sells one plan on one cadence in one currency — the
// `{ price_data, quantity }` every subscription Checkout sends. Pure: no
// Stripe client, no database, so scripts/plan-currencies-dry-run.mjs prints
// EXACTLY the line a GBP or EUR checkout will send without opening Stripe.
//
// lib/platform/stripeBilling.js recurringLine() is the only production caller;
// it refuses a retired plan and an unbillable cadence first, then builds the
// line here. One builder, so the dry run and the checkout cannot disagree.
import { chargeFor, DEFAULT_INTERVAL } from "@/lib/billing/interval";
import { planTaxBehavior } from "@/lib/pricing/ladder";

/**
 * The lookup_key the reusable "Extra seat" Price of a custom plan is found
 * by — one per currency and cadence (a monthly Price cannot bill a year).
 * Minted lazily by lib/platform/stripeBilling.js ensureExtraSeatPrice.
 */
export function extraSeatLookupKey(currency, interval = DEFAULT_INTERVAL) {
  const cur = String(currency || "").toLowerCase();
  return `fq_extra_seat_${cur}${interval === "year" ? "_year" : ""}`;
}

/**
 * @param plan      a Plan row (name, priceMonthly, priceAnnual)
 * @param interval  "month" | "year"
 * @param currency  lowercase Stripe currency ("gbp")
 * @returns the line, or null when the plan cannot be billed on that cadence
 */
export function planLine({ plan, interval, currency }) {
  const charge = chargeFor(plan, interval);
  if (!charge) return null;
  // GBP and EUR say "+ VAT" on the pricing page, so their line says so to
  // Stripe Tax rather than inheriting the account default (lib/pricing/
  // ladder.js VAT_EXCLUSIVE_CURRENCIES). Every other currency sends nothing,
  // exactly as before.
  const taxBehavior = planTaxBehavior(currency);
  return {
    price_data: {
      currency,
      product_data: { name: `FieldQuo — ${plan.name}` },
      unit_amount: charge.unitAmountCents,
      recurring: { interval: charge.interval },
      ...(taxBehavior ? { tax_behavior: taxBehavior } : {}),
    },
    quantity: 1,
  };
}
