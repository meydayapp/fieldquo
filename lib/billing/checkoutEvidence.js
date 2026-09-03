// lib/billing/checkoutEvidence.js
//
// Did this company ever actually complete a Stripe Checkout?
//
// Asked only by lib/signup/setupGate.js, and only about a company that has NO
// Subscription row of its own — which is two different situations wearing the
// same absence (see that file's header). Nothing local can tell them apart:
// Company has no stripeCustomerId, getOrCreateStripeCustomer persists nothing,
// and no row records that a checkout session was opened. Stripe knows, so ask
// Stripe.
//
// ── Why "subscription", and not "customer" ────────────────────────────────
//
// A Stripe CUSTOMER is created by createTrialCheckoutSession before the person
// has typed a digit — every abandoned signup has one. Its existence proves we
// opened a checkout, not that anyone paid. A Stripe SUBSCRIPTION is created as
// part of COMPLETING a subscription-mode session, before the browser is
// redirected back, so it is true the instant they pay and true before our
// webhook lands. That timing is the whole point: it is what stops someone who
// has just paid from being bounced out of the page they paid to reach.
//
// ── Three answers, and null is not false ──────────────────────────────────
//
//   true   Stripe has a subscription for them. Let them in.
//   false  Stripe has no customer, or a customer with no subscription ever.
//   null   we could not find out — no API key, Stripe unreachable, a search
//          index that hasn't caught up. Read as "let them in" by the caller.
//
// Never throws. A gate that locks a contractor out because Stripe had a bad
// minute is strictly worse than one that lets a freeloader have another day.

import { stripe } from "@/lib/stripe";

/**
 * @param company  { id } — the FieldQuo company id, which is the metadata key
 *                 every customer we create carries.
 * @returns {Promise<boolean|null>}
 */
export async function stripeSubscriptionExists(company) {
  if (!company?.id) return null;

  try {
    // Customer Search is eventually consistent, which is why the caller only
    // reaches this past CHECKOUT_GRACE_MS — a customer created in the last
    // hour may genuinely not be indexed yet, and that window is covered by
    // time rather than by this call.
    const found = await stripe.customers.search({
      query: `metadata['companyId']:'${company.id}'`,
      limit: 1,
    });

    const customerId = found?.data?.[0]?.id;
    // No customer at all means no checkout session was ever opened for them,
    // which is a real and confident "no" rather than an absence of evidence.
    if (!customerId) return false;

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      // Every status, including canceled and incomplete_expired. The question
      // is "did money ever change hands here", not "are they current" — a
      // company whose subscription was cancelled has a Subscription row of
      // our own and never reaches this function anyway.
      status: "all",
      limit: 1,
    });

    return (subs?.data?.length || 0) > 0;
  } catch (err) {
    console.error(
      "[checkoutEvidence] couldn't ask Stripe about company",
      company.id,
      err?.message,
    );
    return null;
  }
}
