// lib/stripe/bankDebit.js
//
// Bank debit on invoices — PURE. Which capability a connected account needs
// for its country, whether Stripe has granted it, which payment method that
// is, and the mandate options Checkout requires for a one-off Canadian
// pre-authorized debit. No Stripe client, no database, so the client
// portal and scripts/check-processing-fee.mjs can import it freely.
//
// ── Why one-off PAD is offered at all ─────────────────────────────────────
//
// The sales pitch and the help centre promise "bank debit in Canada capped at
// $5" on invoices; until this file existed PAD lived only on service-plan
// mandates (lib/servicePlans/stripeMandate.js) and a client paying an invoice
// had card (+ Affirm) only. A $5,000 invoice by card costs the contractor
// $150.30; by PAD, $5.00.
//
// ── Why the button only renders when Stripe has ACTIVATED the capability ─
//
// acss_debit_payments is REQUESTED for a Canadian account (and
// us_bank_account_ach_payments for a US one) at the status poll — see
// lib/stripe.js ensureChargeCapabilities — but Stripe grants it on its own
// schedule and may ask for more information. A session naming a method the
// account cannot take is rejected by Stripe with an opaque error, so the
// portal reads Company.stripeBankDebitEnabled, written only from the
// capability's `active` status, and shows nothing until then. Never a
// button that fails.

// Stripe capability → payment method, by the connected account's country.
export const BANK_DEBIT_BY_COUNTRY = Object.freeze({
  CA: Object.freeze({ capability: "acss_debit_payments", method: "acss_debit", currency: "cad" }),
  US: Object.freeze({ capability: "us_bank_account_ach_payments", method: "us_bank_account", currency: "usd" }),
});

/** The capability to request for an account's country, or null. */
export function debitCapabilityForCountry(country) {
  return BANK_DEBIT_BY_COUNTRY[String(country || "").toUpperCase()]?.capability || null;
}

/**
 * The bank-debit method Stripe has ACTIVATED on a connected account, from
 * the account object's `capabilities` map — or null. "pending" and
 * "inactive" are null: only `active` takes a charge.
 */
export function bankDebitMethodFor(account) {
  const caps = account?.capabilities || {};
  for (const entry of Object.values(BANK_DEBIT_BY_COUNTRY)) {
    if (caps[entry.capability] === "active") return entry.method;
  }
  return null;
}

/**
 * The bank-debit method a COMPANY can be paid by, from our own columns: the
 * flag Stripe's answer wrote, and the currency the company bills in (PAD is
 * CAD-only, ACH USD-only — a mismatch is null, not a guess).
 */
export function companyBankDebitMethod(company) {
  if (!company?.stripeBankDebitEnabled) return null;
  const cur = String(company.currency || "").toLowerCase();
  for (const entry of Object.values(BANK_DEBIT_BY_COUNTRY)) {
    if (entry.currency === cur) return entry.method;
  }
  return null;
}

/**
 * Checkout `payment_method_options` for a ONE-OFF pre-authorized debit.
 * Stripe requires the mandate schedule to be stated; "sporadic" is the
 * one-off schedule (an interval schedule with its interval_description is
 * the service-plan case — see lib/servicePlans/stripeMandate.js). A homeowner
 * is a personal debit; a company client a business one — read from the
 * client record, never assumed. `verification_method: "automatic"` lets
 * Stripe verify the account instantly where the bank supports it and fall
 * back to micro-deposits where it does not.
 */
/**
 * A homeowner is a personal debit; a company client a business one. Read
 * from the client record rather than assumed — the wrong transaction_type
 * is a defect in the mandate itself. Shared with the service-plan mandate.
 */
export function acssTransactionType(client) {
  return client?.type === "company" ? "business" : "personal";
}

export function acssDebitOneOffOptions({ client } = {}) {
  return {
    acss_debit: {
      mandate_options: {
        payment_schedule: "sporadic",
        transaction_type: acssTransactionType(client),
      },
      verification_method: "automatic",
    },
  };
}

/** Checkout `payment_method_options` for a one-off US ACH debit. */
export function usBankAccountOptions() {
  return { us_bank_account: { verification_method: "automatic" } };
}

/** Everything a bank-debit Checkout session needs for a method, or null. */
export function bankDebitSessionOptions(method, { client } = {}) {
  if (method === "acss_debit") return acssDebitOneOffOptions({ client });
  if (method === "us_bank_account") return usBankAccountOptions();
  return null;
}

// The user-facing pending/failed vocabulary on the invoice (lifecycle banner
// ids and portal copy) is keyed on these.
export const BANK_DEBIT_METHODS = Object.freeze(["acss_debit", "us_bank_account"]);
export function isBankDebitMethod(method) {
  return BANK_DEBIT_METHODS.includes(method);
}

// ── How much one bank debit may collect ──────────────────────────────────
//
// Stripe caps a Checkout Session paid by Canadian pre-authorized debit at
// $3,000.00 CAD. The cap is not documented on the acss_debit page; it was
// measured against Stripe Checkout in test mode on 2026-09-20 — a session
// naming only acss_debit is refused at 300,001 cents and accepted at 300,000
// — after the live refusal req_0ymITOokGO1xzZ on 2026-09-19: a homeowner
// tapped "Pay $4,150 from bank account" under the contractor's own logo and
// got a 500 (`amount_too_large`: "The Checkout Session's total amount due
// must be no more than $3,000.00 CAD for the provided payment method
// types"). Affirm on the same account accepted $5,000 CAD, so the limit is
// PAD's, not financing's.
//
// US ACH has NO measured cap here, and null means exactly that — "we have not
// measured one", never "unlimited". Writing a guessed figure would hide a
// button from a homeowner Stripe would have taken money from, or leave one
// up that Stripe refuses; both are the class of bug this file exists to
// stop. Measure before filling it in.
export const BANK_DEBIT_MAX_CENTS = Object.freeze({
  acss_debit: 300_000,
  us_bank_account: null,
});

/**
 * Whether ONE debit of `amountCents` by `method` is inside Stripe's cap.
 * An unknown method is not eligible (there is nothing to debit with); a
 * method with no measured cap is eligible at any amount.
 */
export function bankDebitAmountEligible({ method, amountCents } = {}) {
  if (!isBankDebitMethod(method)) return false;
  const max = BANK_DEBIT_MAX_CENTS[method];
  if (max == null) return true;
  return Number(amountCents) <= max;
}

/**
 * What the portal may offer for THIS amount: the company's method, whether
 * the amount is inside the cap, and the cap itself — so the page can say
 * why the button is absent ("Bank debit is available up to $3,000 — this
 * invoice is $4,150, so it's card only") rather than silently drop it.
 * Null when the company cannot take bank debit at all.
 */
export function bankDebitOffer({ company, amountCents } = {}) {
  const method = companyBankDebitMethod(company);
  if (!method) return null;
  return {
    method,
    eligible: bankDebitAmountEligible({ method, amountCents }),
    maxCents: BANK_DEBIT_MAX_CENTS[method],
  };
}
