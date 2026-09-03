// lib/signup/setupGate.js
//
// May this person into /app yet, given that signup and PAYING for the thing
// are two separate events?
//
// ══ The hole ═══════════════════════════════════════════════════════════════
//
// app/api/companies/route.js creates the Company and the owner's Member row,
// and only THEN opens a Stripe Checkout session. Close the tab on Stripe's
// page and you keep the company: a real membership, a real dashboard, and no
// card. app/app/layout.js's getSetupRedirect() waved everyone through the
// moment `member.companyId` existed, so that was the whole gate.
//
// Measured on the live database on 2026-09-02: 32 companies, 20 with no
// Subscription row. Ten of those are the seeded demo fixtures (isDemo, no
// members). The other ten are real logins that never entered a card — one of
// them built a quote, one was created that same day, the oldest is from 8 July.
// The owner's ruling: "they still need to put a credit card… the dashboard
// should be [locked] until the sign up steps INCLUDING the stripe payment".
//
// ══ Why this is NOT just "no Subscription row → out" ═══════════════════════
//
// lib/billing/access.js deliberately grants FULL access to a company with no
// Subscription row, and its reasoning is correct and has to survive:
//
//   "a company created by hand, or one whose checkout webhook hasn't landed
//    yet, must not be locked out of a product they may well have paid for."
//
// Two different situations wear the same absence:
//
//   A. paid, and checkout.session.completed is still in flight   → let them in
//   B. never reached Stripe at all                               → send them back
//
// Nothing in this codebase persists that a checkout session was ever opened.
// Company has no stripeCustomerId (only stripeAccountId, which is Connect —
// the other direction of money entirely), getOrCreateStripeCustomer writes
// nothing, and Company.onboardingStatus is set to "pending" at creation and
// read by no one. So the distinguishing evidence is not local, and this file
// asks for it in two forms rather than inventing one:
//
//   1. TIME. Company→Subscription lag across the twelve live subscriptions:
//      ten landed within 130 seconds of the company being created (28, 28, 29,
//      29, 35, 36, 45, 50, 72, 130 — and that span INCLUDES the human typing
//      their card in). The two longer ones, 32 minutes and 8.3 hours, are a
//      person going back to a checkout they had left, not a slow webhook.
//      CHECKOUT_GRACE_MS is set from that: an hour is ~28x the observed
//      webhook latency, and /app itself carries the reconcile safety net
//      (app/app/page.js posts session_id to /api/platform/billing/reconcile-
//      session on arrival), so a gate that bounces people OFF /app has to be
//      looser than the time that net needs to fire.
//
//   2. STRIPE. Past the hour, the caller may pass `stripeSubscription`: does
//      a Stripe subscription exist for this company's customer? Checkout
//      creates the Stripe Subscription object as part of completing the
//      session, before the browser is redirected — so this is true the instant
//      someone pays, whether or not our webhook has landed. That is what stops
//      the 8.3-hour person, and anyone paying from the resumed flow, being
//      bounced straight back out of the page they just paid to reach.
//      `null` means "we could not find out" (Stripe down, no API key, search
//      lag) and is treated as evidence FOR them, never against.
//
// ══ Which way to be wrong ══════════════════════════════════════════════════
//
// This is the first enforcement of the rule that ever existed — the owner:
// "i don't think we have an enforcement for that type of freebee". A wrong
// lock takes a contractor's working day away; a wrong allow costs a few days
// of free usage, which is what has already been happening for two months. So
// every unknown here resolves to "allow", and the decision says WHY, so a
// support conversation can read the reason instead of guessing.

import { isBillingAdmin } from "@/lib/billing/billingAdmin";

/**
 * How long after a company is created we assume a checkout may still be
 * resolving, and let them in without asking Stripe anything.
 *
 * One hour, from the measurement in the header — not a round number picked
 * for looking sensible. The longest webhook-shaped lag in the live data is
 * 130 seconds; the two beyond that are humans returning to an abandoned
 * checkout, and they are caught by the Stripe evidence instead.
 */
export const CHECKOUT_GRACE_MS = 60 * 60 * 1000;

/** Where an owner who never paid is sent to finish. */
export const FINISH_SIGNUP_PATH = "/signup";

/**
 * What the /app shell should do with this request.
 *
 * Pure, and every input is a plain value, so scripts/check-signup-gate.mjs can
 * run the whole state matrix — including the ones nobody reaches by hand, like
 * an impersonating admin looking at a demo company that has no subscription.
 *
 * @param impersonating   a read-only support session (or a demo sandbox).
 * @param hasSession      a Better Auth session exists.
 * @param companyId       the resolved member's company, or null.
 * @param membershipExists  an active Member row exists for this user. Only
 *                        consulted when companyId is null — it separates "no
 *                        company" from "a company that failed to resolve".
 * @param billingReason   member.billingAccess.reason, from accessFor(). The
 *                        ONE value this acts on is "no_subscription"; every
 *                        other reason (active, trialing, past_due, canceled,
 *                        grace_expired, canceled_expired) means a Subscription
 *                        row exists and the billing gate owns the decision.
 * @param role            the member's role, for who may actually pay.
 * @param isDemo          Company.isDemo — a FieldQuo-owned sales fixture.
 * @param companyCreatedAt  Company.createdAt.
 * @param stripeSubscription  true / false / null — see the header.
 * @param now             injectable, so the tests aren't time-dependent.
 *
 * @returns {{ action: "allow"|"redirect"|"setup_incomplete", reason: string, path?: string }}
 */
export function setupGateDecision({
  impersonating = false,
  hasSession = false,
  companyId = null,
  membershipExists = false,
  billingReason = null,
  role = null,
  isDemo = false,
  companyCreatedAt = null,
  stripeSubscription = null,
  now = new Date(),
} = {}) {
  // ── A support session is never a signup ─────────────────────────────────
  //
  // First, before anything looks at a subscription. An impersonated member
  // carries a real companyId and the demo fixtures have no Subscription row at
  // all, so without this a platform admin opening a demo would be redirected
  // into that company's signup — the exact thing non-negotiable #2 is about,
  // wearing a different hat.
  if (impersonating) {
    return { action: "allow", reason: "impersonation" };
  }

  if (companyId) {
    // ── A Subscription row exists: not our problem ────────────────────────
    //
    // past_due, canceled, grace_expired, canceled_expired all live here, and
    // they are the LOCK path — a different state with its own screen
    // (AccountLocked) and its own escape route. This gate and that one cannot
    // both fire, by construction rather than by ordering: lock needs a row,
    // this needs the absence of one.
    if (billingReason !== "no_subscription") {
      return { action: "allow", reason: "subscription_exists" };
    }

    // A seeded sales fixture. scripts/seed-demos.mjs creates no logins and no
    // subscription, and there is nobody to send to checkout.
    if (isDemo) {
      return { action: "allow", reason: "demo_company" };
    }

    // Checkout may still be resolving — including the reconcile that /app
    // itself performs on arrival. See CHECKOUT_GRACE_MS.
    const createdAt = companyCreatedAt ? new Date(companyCreatedAt) : null;
    const age = createdAt ? now.getTime() - createdAt.getTime() : null;
    if (age === null || Number.isNaN(age) || age < CHECKOUT_GRACE_MS) {
      return { action: "allow", reason: "within_checkout_grace" };
    }

    // Anything other than a flat "no, Stripe has never had a subscription for
    // this company" lets them through. null is our ignorance, not their fault.
    if (stripeSubscription !== false) {
      return {
        action: "allow",
        reason: stripeSubscription === true ? "stripe_has_subscription" : "stripe_unknown",
      };
    }

    // ── Nobody ever paid ──────────────────────────────────────────────────
    //
    // Whoever can actually settle it goes back to the last step of signup.
    // isBillingAdmin, not `role === "owner"`, because that is the gate
    // /api/platform/billing/checkout already applies to the POST the resumed
    // page makes — a second, narrower rule here would render a button the
    // route accepts, or hide one it would have honoured.
    if (isBillingAdmin(role)) {
      return {
        action: "redirect",
        path: FINISH_SIGNUP_PATH,
        reason: "checkout_never_completed",
      };
    }

    // ── An invited employee of a company that never paid ──────────────────
    //
    // NOT a redirect. /signup sets up a NEW business, and its own resume path
    // needs a caller who may open checkout; sending an estimator there would
    // offer them a second company beside the one they were invited to, which
    // is the failure the comment in getSetupRedirect has warned about since it
    // was written. They get a screen that says what is wrong, who can fix it,
    // and offers the one control that works from here: sign out.
    return { action: "setup_incomplete", reason: "checkout_never_completed_no_billing_rights" };
  }

  // ── No company on the member ────────────────────────────────────────────
  //
  // Middleware already sends a request with no session to /login. Redirecting
  // to /signup here would be the wrong door.
  if (!hasSession) {
    return { action: "allow", reason: "no_session" };
  }

  // A Member row that exists but wouldn't resolve — a company missing its
  // authOrgId, say — is a different fault, and /signup would invite them to
  // create a SECOND company beside the one they already belong to.
  if (membershipExists) {
    return { action: "allow", reason: "membership_unresolved" };
  }

  // Signed in, no company at all: the account was created and the tab closed
  // before "Continue to Payment", which is the only thing that posts the
  // company. /signup resumes from the draft in sessionStorage.
  return { action: "redirect", path: FINISH_SIGNUP_PATH, reason: "no_company" };
}
