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

/**
 * Who may SEE the company's billing state — plan, status, trial countdown.
 *
 * Narrower than isBillingAdmin, and deliberately so. The two questions look
 * alike and are not:
 *
 *   isBillingAdmin  — may act. Owner or admin, because at a 20-person company
 *                     the person who pays the bill is often not the owner.
 *   seesBillingState — may know. Owner only.
 *
 * The trial countdown was showing "47 days left" to anyone created through the
 * "Manager" preset, which maps to `admin`. The owner's call: how long the
 * company's trial has to run is commercial information about the BUSINESS —
 * the same reasoning that already took the badge away from employees. A
 * manager running crews does not need to know their employer's software is 47
 * days from a bill, and it is not a pleasant thing to learn from a sidebar.
 *
 * A support session still sees everything: non-negotiable #3 is "view
 * everything, edit nothing", and support seeing less than the customer is the
 * failure that rule exists to prevent.
 */
export function seesBillingState(role) {
  return role === "owner";
}

/** The one sentence all four routes say, so they can't say four things. */
export const BILLING_ADMIN_ERROR =
  "Only an owner or admin can change the plan or billing details.";
