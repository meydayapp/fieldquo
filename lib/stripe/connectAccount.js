// lib/stripe/connectAccount.js
//
// What the app is allowed to SAY about a contractor's own Connect account: the
// wording for Stripe's requirement keys, the shape we read off a Stripe
// account object, and who may see the ids that identify that account.
//
// ── Not lib/platform/stripeBilling.js, and not lib/billing/billingAdmin.js ──
//
// Both of those are FieldQuo billing the CONTRACTOR. This file is the other
// integration entirely — the contractor being paid by a homeowner — and the
// first comment in lib/stripe.js warns never to let the two meet. An `acct_…`
// from here must never reach a Billing call, and the gate below must never be
// reused to decide who may cancel the FieldQuo plan.
//
// ── Why the wording lives here and not in the route ─────────────────────────
//
// humaniseRequirement() started as a private function inside
// app/api/stripe/connect/status/route.js. The moment a second surface needed
// to name an outstanding requirement, the cheap move was a second copy — and
// the copy is the one that rots, because it is the one nobody looks at. It is
// also the only way a check script can execute this wording against a real
// Stripe payload without booting a route that wants a database and a secret
// key.

// Stripe's requirement keys are machine names — "company.verification.document"
// means nothing to a contractor. Only the ones that actually come up for
// Canadian Express accounts are translated; anything unmapped falls through to
// a tidied version of the key rather than being hidden, because a requirement
// you can't see is one you can't clear.
export const REQUIREMENT_LABELS = {
  "business_profile.url": "A business website or product description",
  "business_profile.mcc": "Your industry",
  "business_profile.product_description": "A description of what you sell",
  "business_profile.support_phone": "A customer support phone number",
  "company.verification.document":
    "A document verifying the business (incorporation papers, CRA notice, or a registry search result)",
  "company.tax_id": "Your business number (BN)",
  "company.directors_provided":
    "Confirmation that you've listed every director",
  "company.owners_provided":
    "Confirmation that you've listed everyone owning 25% or more",
  "company.executives_provided": "Confirmation that you've listed executives",
  external_account: "A bank account for payouts",
  "tos_acceptance.date": "Accepting Stripe's terms of service",
  "individual.verification.document": "A photo of your ID",
  "individual.verification.additional_document": "A second piece of ID",
};

// Stripe's `requirements.disabled_reason` — why an account is restricted. It
// is a machine value like `requirements.past_due` or `rejected.fraud`, and the
// settings page printed it verbatim in a monospace font, twice, under a comment
// claiming it was "humanised the same way the requirement keys above it are".
// It was not. A contractor whose payouts were held read `rejected.listed` and
// had no idea whether that was about them, their bank, or a bug.
//
// Same shape and same rules as REQUIREMENT_LABELS: only the reasons Stripe
// actually returns, and anything unmapped falls through to a tidied key rather
// than being hidden — a reason you can't see is one you can't ask about.
export const DISABLED_REASON_LABELS = {
  "requirements.past_due":
    "Stripe is waiting on information that is now overdue.",
  "requirements.pending_verification":
    "Stripe is still checking what you sent. There is nothing to do.",
  "rejected.fraud": "Stripe closed the account for suspected fraud.",
  "rejected.terms_of_service":
    "Stripe closed the account for a terms of service violation.",
  "rejected.listed": "Stripe closed the account after a sanctions-list match.",
  "rejected.other": "Stripe closed the account.",
  listed: "Stripe is reviewing a possible sanctions-list match.",
  under_review: "Stripe is reviewing the account.",
  other: "Stripe has restricted the account and hasn't said why.",
  platform_paused: "FieldQuo paused this account.",
  rejected_other: "Stripe closed the account.",
  // Newer Stripe wording for the same two states as the dotted keys above.
  "requirements.past.due": "Stripe is waiting on information that is now overdue.",
};

export function humaniseDisabledReason(reason) {
  if (!reason) return null;
  if (DISABLED_REASON_LABELS[reason]) return DISABLED_REASON_LABELS[reason];
  // Never the raw key. A reason we don't recognise is still a sentence.
  return String(reason).replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function humaniseRequirement(key) {
  if (REQUIREMENT_LABELS[key]) return REQUIREMENT_LABELS[key];

  // person_1TyErf.verification.document — the prefix is an opaque id, and
  // showing it helps nobody.
  const cleaned = String(key).replace(
    /^person_[A-Za-z0-9]+\./,
    "A director or owner: ",
  );
  return cleaned.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Everything we are willing to read off a retrieved Stripe account, in one
 * shape, computed once.
 *
 * Pure and total: a null account, or one Stripe returned without a
 * `requirements` object, produces the same keys with honest falsy values
 * rather than throwing halfway through building a response. The settings page
 * is the screen a contractor opens when payments are already going wrong; it
 * must not be the second thing that breaks.
 */
export function summariseConnectAccount(account) {
  const req = account?.requirements || {};

  // currently_due  — needed now, blocking
  // past_due       — overdue, definitely blocking
  // pending_verification — submitted, Stripe is checking. NOT the company's
  //                        problem, and telling them to "provide more
  //                        information" while Stripe reviews what they already
  //                        sent is how people end up submitting the same
  //                        document four times.
  const outstanding = [
    ...new Set([...(req.currently_due || []), ...(req.past_due || [])]),
  ];

  return {
    accountId: account?.id || null,
    // The address Stripe sends the Express sign-in code to. Stripe's own
    // Express docs describe direct dashboard access as "their account email
    // and an authentication code" — so when a contractor cannot get into
    // Stripe at all, this field is the answer, and nothing in FieldQuo showed
    // it to them.
    email: account?.email || null,
    chargesEnabled: Boolean(account?.charges_enabled),
    payoutsEnabled: Boolean(account?.payouts_enabled),
    detailsSubmitted: Boolean(account?.details_submitted),
    requirements: outstanding.map((key) => ({
      key,
      label: humaniseRequirement(key),
    })),
    eventuallyDue: (req.eventually_due || []).length,
    pendingVerification: (req.pending_verification || []).length > 0,
    // Stripe's own wording for why an account is restricted, when it has one.
    // More specific than anything we could infer.
    disabledReason: req.disabled_reason || null,
    currentDeadline: req.current_deadline || null,
  };
}

/**
 * Who may see the ids that IDENTIFY this Stripe account — the `acct_…` and the
 * email Stripe signs them in with.
 *
 * Owner only, and its own predicate rather than a reuse of either neighbour:
 *
 *   isBillingAdmin    — owner|admin. "May act on the company's card." Wider
 *                       than this, and about the wrong Stripe integration.
 *   seesBillingState  — owner, but about the FieldQuo PLAN — what the company
 *                       pays us and how long the trial has to run.
 *
 * The two happen to agree with this today. Collapsing them would mean a future
 * change to one silently changing the other, which is the exact trap
 * lib/permissions/settingsAccess.js writes down at length for isPayrollAdmin.
 *
 * Owner rather than owner|admin because this is the credential half of the
 * company's banking relationship: the pair of values that lets someone assert
 * to Stripe "this account is mine". That is the owner's, in the same way the
 * trial countdown is.
 */
export function seesStripeAccountIdentity(role) {
  return role === "owner";
}

/**
 * The owner-only half of the status payload — or null, which is how a
 * non-owner is refused.
 *
 * Refused by ABSENCE from the response rather than by a hidden block: a client
 * that never receives the value cannot leak it, and hiding a div is not access
 * control. The settings page renders this block if and only if this function
 * returned an object.
 *
 * A read-only support session is waved through for the same reason the status
 * read itself is: non-negotiable #3 is "view everything, edit nothing", and
 * "why is this company's money being held" is close to the most common thing a
 * support session is opened to answer. Refusing support the one identifier
 * that names the account makes the console worse at its job while protecting
 * nothing — middleware already rejects every non-read method under an
 * impersonation cookie, so this cannot become a write.
 */
export function accountIdentityFor(member, summary) {
  if (!member) return null;
  if (!member.impersonation && !seesStripeAccountIdentity(member.role))
    return null;

  return {
    accountId: summary?.accountId || null,
    email: summary?.email || null,
  };
}
