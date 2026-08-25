// lib/servicePlans/stripeMandate.js
//
// The only file that talks to Stripe on behalf of a service plan: saving the
// client's payment method with a real mandate, and charging it off-session
// later.
//
// ── Which Stripe primitive, and why it fits the existing charge type ────────
//
// lib/stripe.js creates DESTINATION CHARGES: the PaymentIntent is created on
// the PLATFORM account with `transfer_data.destination` pointing at the
// company's connected account. Its own comment says so explicitly — "charge
// created on platform, transferred to company — NOT a direct charge".
//
// That single fact decides everything here. In a destination charge the
// Customer and the PaymentMethod live on the PLATFORM account, because that is
// where the charge is created. So:
//
//   * the SetupIntent is created on the platform, against a platform Customer;
//   * the saved PaymentMethod is a platform PaymentMethod;
//   * the later off-session PaymentIntent is a platform PaymentIntent carrying
//     the same `transfer_data.destination` and `application_fee_amount: 0` the
//     pay link already uses.
//
// It is the same charge, the same money route and the same connected account —
// the only difference is that it is confirmed without the client present. A
// direct-charge integration would need the customer and the payment method
// cloned onto the connected account, which is a different product and would
// contradict the two comments in lib/stripe.js.
//
// No Stripe Subscription, Price or Product is created. See the ServicePlan
// model for the four reasons. The consequence worth restating: nothing at
// Stripe can bill anybody on its own, so cancelling a plan cannot leave a live
// biller behind.
//
// ── The customer metadata trap ──────────────────────────────────────────────
//
// lib/platform/stripeBilling.js finds a tenant's billing Customer with
// `customers.search({ query: "metadata['companyId']:'<id>'" })`. If the
// customers created here carried a `companyId` metadata key, that search could
// return a HOMEOWNER'S customer record and attach FieldQuo's own subscription —
// and the homeowner's card — to it. Hence `fq_companyId` / `fq_clientId`, which
// that query cannot match. This is exactly the mixing that file's header warns
// about, one level down.

import { stripe } from "@/lib/stripe";
import { stripeCurrency } from "@/lib/currency";
import { mandateIntervalDescription } from "@/lib/servicePlans/consent";

/**
 * Payment methods a plan may be authorised on.
 *
 * `card` everywhere. `acss_debit` — Canadian pre-authorized debit — only for a
 * company billing in CAD, because Stripe requires the mandate currency to match
 * the client's bank account and a CAD account debited in USD fails days later.
 */
export function authorisableMethods(company) {
  const currency = stripeCurrency(company?.currency);
  return currency === "cad" ? ["card", "acss_debit"] : ["card"];
}

/**
 * Get or create the platform Stripe Customer that holds this CLIENT's payment
 * method. Reuses one across a client's plans — a homeowner on two plans should
 * not have two customer records and two saved copies of the same card.
 */
export async function getOrCreateClientCustomer({ client, companyId }) {
  try {
    const found = await stripe.customers.search({
      query: `metadata['fq_clientId']:'${client.id}'`,
      limit: 1,
    });
    if (found.data[0]?.id) return found.data[0].id;
  } catch {
    // Customer Search is eventually consistent and can be unavailable on a new
    // account. Falling through to create is correct: a duplicate customer is a
    // tidiness problem, a failed authorisation is a lost recurring sale.
  }

  const customer = await stripe.customers.create({
    name: client.name || undefined,
    email: client.email || undefined,
    metadata: { fq_clientId: client.id, fq_companyId: companyId },
  });
  return customer.id;
}

/**
 * A Stripe-hosted setup flow that saves the client's payment method with a
 * proper mandate. `mode: "setup"` — no money moves here.
 *
 * The four consent statements Stripe requires are NOT rendered by this page;
 * they were shown on our own /plan/<token> page and the client ticked them
 * before this session was ever created (see lib/servicePlans/consent.js and the
 * acceptedAt column). This session collects the instrument and, for
 * pre-authorized debit, Stripe's own PAD agreement on top.
 */
export async function createAuthorisationSetupSession({
  plan,
  client,
  company,
  customerId,
  successUrl,
  cancelUrl,
}) {
  const methods = authorisableMethods(company);
  const currency = stripeCurrency(company?.currency);

  const params = {
    mode: "setup",
    customer: customerId,
    payment_method_types: methods,
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Read back by the webhook and by the return-leg reconcile, either of which
    // may get there first. Both converge on the same upsert.
    metadata: { servicePlanId: plan.id, companyId: company.id, clientId: client.id },
    setup_intent_data: {
      metadata: { servicePlanId: plan.id, companyId: company.id },
      // usage defaults to off_session, which is what we need — spelled out
      // because it is the whole point of this session and a future edit that
      // narrowed it to on_session would break every charge silently.
      usage: "off_session",
    },
  };

  if (methods.includes("acss_debit")) {
    // Canadian pre-authorized debit is a regulated mandate, not a stored token.
    // Stripe renders and emails the PAD agreement, and requires us to state the
    // schedule; interval_description is printed verbatim in that agreement, so
    // it MUST describe the cadence this plan actually bills on.
    params.payment_method_options = {
      acss_debit: {
        currency,
        mandate_options: {
          payment_schedule: "interval",
          interval_description: mandateIntervalDescription(
            plan.frequency,
            plan.language,
          ),
          // A homeowner is a personal debit; a company client is a business
          // one. Read from the client record rather than assumed — the wrong
          // transaction_type is a defect in the mandate itself.
          transaction_type: client?.type === "company" ? "business" : "personal",
        },
      },
    };
  }

  // Platform account, not the connected one — see the header.
  return stripe.checkout.sessions.create(params, { stripeAccount: undefined });
}

/**
 * Pull the payment method and mandate off a completed setup session.
 *
 * Returns null when the session is not finished, rather than a half-filled
 * object: a SetupIntent still awaiting micro-deposit verification has a payment
 * method that CANNOT yet be debited, and recording it as an authorisation would
 * be a mandate that isn't one.
 */
export async function readCompletedSetup(sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["setup_intent"],
  });
  if (session.status !== "complete") return null;

  const setupIntent =
    typeof session.setup_intent === "string"
      ? await stripe.setupIntents.retrieve(session.setup_intent)
      : session.setup_intent;

  if (!setupIntent || setupIntent.status !== "succeeded") return null;
  if (!setupIntent.payment_method) return null;

  const pmId =
    typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method.id;
  const paymentMethod = await stripe.paymentMethods.retrieve(pmId);

  return {
    session,
    stripeCustomerId:
      typeof session.customer === "string" ? session.customer : session.customer?.id,
    stripeSetupIntentId: setupIntent.id,
    stripePaymentMethodId: pmId,
    // Multi-use mandate. Pre-authorized debit always produces one; cards
    // usually don't, and null there is correct rather than missing.
    stripeMandateId:
      typeof setupIntent.mandate === "string"
        ? setupIntent.mandate
        : setupIntent.mandate?.id || null,
    paymentMethodType: paymentMethod.type,
    paymentMethodBrand:
      paymentMethod.card?.brand || paymentMethod.acss_debit?.institution_number || null,
    paymentMethodLast4:
      paymentMethod.card?.last4 || paymentMethod.acss_debit?.last4 || null,
  };
}

/**
 * Charge one occurrence off-session.
 *
 * Same destination-charge shape as createInvoiceCheckoutSession, confirmed
 * without the client present.
 *
 * @returns { outcome, paymentIntent?, code?, message? }
 *   outcome ∈ "succeeded"   money has moved; record the payment
 *           | "processing"  accepted but not settled (pre-authorized debit
 *                           takes ~5 business days). NOT paid.
 *           | "failed"      declined, or authentication is required and the
 *                           client is not here to give it. The caller falls
 *                           back to the pay link — which is tier 1, and is why
 *                           tier 1 has to work on its own.
 *
 * Never throws for a payment failure. A declined card is an expected outcome of
 * this function, not an exception: throwing would abort the run and leave the
 * remaining plans in the batch unbilled.
 */
export async function chargeOccurrenceOffSession({
  company,
  authorisation,
  amountCents,
  description,
  metadata = {},
  idempotencyKey,
}) {
  if (!(amountCents > 0)) {
    return { outcome: "failed", code: "zero_amount", message: "Nothing to charge." };
  }
  if (!company?.stripeAccountId) {
    return {
      outcome: "failed",
      code: "no_connected_account",
      message: "This company can't take online payments yet.",
    };
  }

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: stripeCurrency(company.currency),
        customer: authorisation.stripeCustomerId,
        payment_method: authorisation.stripePaymentMethodId,
        // Pinned to the method they actually authorised. Leaving this to
        // automatic payment methods would let an off-session confirm pick
        // something the mandate does not cover.
        payment_method_types: [authorisation.paymentMethodType],
        // Pre-authorized debit must be debited UNDER the mandate the client
        // accepted; Stripe treats a debit outside its terms as disputable.
        ...(authorisation.stripeMandateId
          ? { mandate: authorisation.stripeMandateId }
          : {}),
        off_session: true,
        confirm: true,
        description,
        // Identical to the pay link's money route: platform charge, transferred
        // to the connected account, no platform fee.
        application_fee_amount: 0,
        transfer_data: { destination: company.stripeAccountId },
        metadata,
      },
      // One key per occurrence. A cron that runs twice, or a retried invocation,
      // cannot charge the same visit twice even before the database's unique
      // index on ServicePlanOccurrence.stripePaymentIntentId is consulted.
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    if (intent.status === "succeeded") return { outcome: "succeeded", paymentIntent: intent };
    if (intent.status === "processing") return { outcome: "processing", paymentIntent: intent };
    return {
      outcome: "failed",
      paymentIntent: intent,
      code: intent.status,
      message: intent.last_payment_error?.message || `Payment ${intent.status}.`,
    };
  } catch (err) {
    // A declined off-session charge comes back as a 402 StripeCardError.
    // `authentication_required` is the important one: the bank wants the client
    // to authenticate and the client is not here. That is not a bug and not a
    // retry — it is a payment that has to be finished on-session, which is
    // exactly what the pay-link fallback is for.
    return {
      outcome: "failed",
      code: err?.code || err?.type || "stripe_error",
      message: err?.message || "The payment could not be taken.",
      paymentIntent: err?.payment_intent || null,
    };
  }
}

/**
 * Retrieve a PaymentIntent so a `processing` occurrence can be settled without
 * depending on a webhook being configured. See lib/servicePlans/run.js.
 */
export async function retrievePaymentIntent(id) {
  return stripe.paymentIntents.retrieve(id);
}

/**
 * Detach the saved payment method at Stripe.
 *
 * Called when a plan is cancelled or the contractor removes the method. The
 * database guard (ServicePlanAuthorisation.revokedAt, plus the plan's status)
 * already prevents a charge; this makes it structurally impossible as well,
 * which is the difference between "our code won't" and "it can't".
 *
 * Best-effort by contract: the caller has already committed the revocation, and
 * a Stripe hiccup here must not undo it or throw. It returns a reason instead.
 */
export async function detachPaymentMethod(paymentMethodId) {
  if (!paymentMethodId) return { detached: false, reason: "no_payment_method" };
  try {
    await stripe.paymentMethods.detach(paymentMethodId);
    return { detached: true };
  } catch (err) {
    // Already detached is a success in every sense that matters here.
    if (err?.code === "resource_missing") return { detached: true, reason: "already_detached" };
    console.error("[service-plans] detach failed:", err?.message);
    return { detached: false, reason: err?.message || "stripe_error" };
  }
}
