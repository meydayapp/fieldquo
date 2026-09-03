// lib/ai/topupIntent.js
//
// Starting and confirming ONE AI credit top-up, from wherever the person was
// standing when they ran out — the settings page, or a dialog over a canvas.
//
// ══ The card on the subscription cannot be charged for this ════════════════
//
// The owner asked for a button that tops up "using the credit card information
// from the subscription". It cannot be done, and the reason is worth writing
// down here rather than rediscovering it:
//
//   1. Stripe: "When you save a payment method, you can only use it for the
//      specific usage you've included in your terms." The terms a company
//      agreed to at signup cover their SUBSCRIPTION. A one-off purchase of AI
//      credit is a different transaction — Stripe's own list of things the
//      terms must state names "scheduled installments, subscription payments,
//      or unscheduled top-ups" as DIFFERENT anticipated frequencies, and ours
//      says the first two. (docs.stripe.com/payments/save-and-reuse,
//      "Compliance".)
//
//   2. Mechanically, it would not even prefill. lib/platform/stripeBilling.js
//      creates the subscription session without
//      `saved_payment_method_options.payment_method_save`, so Stripe saves the
//      card with `allow_redisplay: limited` — "which prevents them from being
//      prefilled for returning purchases and allows you to comply with card
//      network rules". A dialog promising the saved card and then presenting
//      an empty card form is worse than one that never promised it.
//
//   3. This repo already decided this once. lib/voice/autoTopup.js exists for
//      companies that ALL have a subscription card on file, and it still runs
//      its own `mode: "setup"` Checkout with `usage: "off_session"` and records
//      its own terms (lib/voice/autoTopupConsent.js) before it may charge. If
//      the subscription mandate covered ad-hoc charges, that whole file would
//      be unnecessary.
//
// So the in-place flow ends at Stripe's payment page, and the dialog says so
// before anyone commits to anything. What it buys over the old flow is that
// the person comes BACK to the canvas they were on, with what they were doing
// still on screen — not that the payment happens without them.
//
// ══ One creation path, one settlement ══════════════════════════════════════
//
// Both `POST /api/settings/ai/topup` (the settings page's custom amount) and
// `POST /api/ai/topup` (the dialog's closed tier list) call the two functions
// below. Two routes building their own Checkout Sessions would be two demo
// branches, two metadata shapes and two things to keep in step — and the copy
// is always the one that rots. Crediting stays where it already was:
// lib/ai/topup.js's creditAiTopup, which the checkout.session.completed
// webhook also calls, keyed on the payment intent. There is no second way to
// turn this payment into credit.
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/platform/stripeBilling";
import { balanceFor, POOLS, creditDemoTopup } from "@/lib/voice/credits";
import { creditAiTopup } from "@/lib/ai/topup";

/**
 * Begin a top-up. Returns what the caller should do next; never throws.
 *
 * @param company     the company row, READ FRESH by the caller. `isDemo` is
 *                    this row's own statement about itself, never the
 *                    request's.
 * @param cents       already resolved server-side — from a tier id here, or
 *                    from normaliseTopup on the settings route. This function
 *                    does not accept anything a browser typed.
 * @param origin      getAppOrigin(request)
 * @param returnPath  an app path to come back to, ALREADY validated by
 *                    safeReturnPath. Null lands on the AI credit page, which
 *                    is where the settings flow has always landed.
 * @param deps        seams for scripts/check-ai-topup-inline.mjs. Production
 *                    callers pass nothing.
 *
 * @returns {{ok: true, simulated: true, balanceCents: number}
 *          | {ok: true, checkoutUrl: string}
 *          | {ok: false, reason: "stripe_unavailable"}}
 */
export async function startAiTopup({ company, cents, origin, returnPath = null, deps = {} }) {
  const prisma = deps.db || db;
  const stripeClient = deps.stripe || stripe;
  const customerFor = deps.getOrCreateStripeCustomer || getOrCreateStripeCustomer;
  const demoCredit = deps.creditDemoTopup || creditDemoTopup;
  const readBalance = deps.balanceFor || balanceFor;

  // ── A sales demo never reaches Stripe ────────────────────────────────────
  //
  // Identical to the branch app/api/settings/ai/topup/route.js has always had,
  // and moved here rather than copied so a new surface cannot forget it. A rep
  // walking somebody through the designer is exactly the person most likely to
  // hit the empty-balance dialog, and a real Stripe Checkout with a real card
  // is what "the credits screen is one of the screens a demo is FOR" would
  // otherwise produce.
  if (company.isDemo) {
    await demoCredit({ companyId: company.id, cents, pool: POOLS.AI });
    return {
      ok: true,
      simulated: true,
      balanceCents: await readBalance(company.id, prisma, POOLS.AI),
    };
  }

  // Stripe appends the session id itself. `returnPath` has already been
  // through safeReturnPath, which forbids a query string, so this is the only
  // "?" in the URL and there is nothing for a caller to smuggle past it.
  const landing = returnPath || "/app/settings/ai-credit";
  const successUrl = `${origin}${landing}?aitopup={CHECKOUT_SESSION_ID}`;

  try {
    const customerId = await customerFor(company);
    const session = await stripeClient.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "FieldQuo — AI credit top-up" },
            unit_amount: cents,
          },
          quantity: 1,
        },
      ],
      // The two load-bearing keys, unchanged from the route this moved out of:
      // `companyId` is checked on the way back so a stranger visiting the
      // success URL can't credit somebody else's account, and `kind` is what
      // lib/stripe/settleCheckoutSession.js dispatches on.
      metadata: { companyId: company.id, kind: "ai_topup", cents: String(cents) },
      success_url: successUrl,
      cancel_url: `${origin}${landing}`,
    });
    return { ok: true, checkoutUrl: session.url };
  } catch {
    // Distinguished from every other refusal on purpose — "couldn't reach
    // Stripe" is not the same fact as "you don't have permission", and
    // collapsing them is how a contractor ends up guessing which applies.
    return { ok: false, reason: "stripe_unavailable" };
  }
}

/**
 * Confirm a returned Checkout Session and credit it — the redirect half of the
 * pair whose other half is the webhook.
 *
 * Whichever arrives second finds the ref already on the ledger and reports
 * `alreadyCredited`, because both go through creditAiTopup. That is what makes
 * a double confirm — a re-render, a refresh, two sidebars both noticing the
 * same `?aitopup=` in the URL — safe to be careless about on the client.
 *
 * @returns {{ok: false, reason: string} | {ok: true, credited: boolean,
 *            alreadyCredited?: boolean, cents?: number, balanceCents: number}}
 */
export async function confirmAiTopup({ sessionId, companyId, member = null, deps = {} }) {
  const prisma = deps.db || db;
  const stripeClient = deps.stripe || stripe;
  const settle = deps.creditAiTopup || creditAiTopup;
  const readBalance = deps.balanceFor || balanceFor;

  if (!sessionId) return { ok: false, reason: "no_session" };

  let session;
  try {
    session = await stripeClient.checkout.sessions.retrieve(sessionId);
  } catch {
    return { ok: false, reason: "stripe_unavailable" };
  }

  // The success URL is just a URL — anyone can visit it with anyone's session
  // id. Without this, a top-up could be confirmed onto the wrong account.
  if (session?.metadata?.companyId !== companyId) {
    return { ok: false, reason: "wrong_company" };
  }

  const result = await settle(session, { member, deps });

  return {
    ok: true,
    ...result,
    // The BALANCE, read after settlement, is what the screen is allowed to act
    // on. A payment that Stripe has accepted but not settled (`payment_status`
    // still unpaid on a delayed-notification method) leaves `credited: false`
    // and a balance that has not moved — and the dialog must show that as
    // "not landed yet", never as "you're topped up".
    balanceCents: await readBalance(companyId, prisma, POOLS.AI),
  };
}
