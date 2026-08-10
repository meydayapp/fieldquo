// lib/billing/billingAdmin.js
//
// Who may move the company's own money: start a plan, open the Stripe portal,
// take a retention offer, cancel.
//
// Deliberately NOT `requirePermission(role, "user:manage")`, which is what
// three of these four routes used. Supervisors hold "user:manage" — it means
// "may manage people", i.e. invite an estimator and set their schedule — and
// nothing about hiring authority implies authority over the company's card.
// A supervisor could cancel the subscription the owner is paying for, or
// commit them to more seats, from a button on the Team page.
//
// Own file rather than four copies of the same two-term expression: the copy
// is the one that rots, and a billing gate that disagrees with its siblings is
// exactly the kind of drift nobody notices until someone uses it.
export function isBillingAdmin(role) {
  return role === "owner" || role === "admin";
}

/** The one sentence all four routes say, so they can't say four things. */
export const BILLING_ADMIN_ERROR =
  "Only an owner or admin can change the plan or billing details.";
