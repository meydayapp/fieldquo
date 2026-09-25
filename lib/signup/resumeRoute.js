// lib/signup/resumeRoute.js
//
// Where a ?resume=<token> link sends somebody — decided BEFORE /signup shows
// them anything.
//
// ══ The bug this exists to stop ════════════════════════════════════════════
//
// 2026-09-25: the owner's "your free month is waiting" email, sent to his
// first test address, opened /signup on the ACCOUNT step, every field filled
// in but the password. He typed one and was told "This email
// already has a FieldQuo login. Sign in instead". The login had existed since
// 2026-09-13. The page decided "has a login" from the row's stepReached
// (lib/signup/salesFloor.js signupLeadForResume: accountExists = past the
// account step) — and this row was stuck ON the account step precisely
// because the account step had refused to make a second login for that
// address. The one person the rule was written for was the one it missed.
//
// His words: "i should be sent to the right path from the get go". So the
// server now asks the question that decides it — is there a User on this
// address, has their company finished signing up, and who is signed in on
// this browser — and the page acts on the answer before rendering a step.
//
// ══ What a resume token can never do ═══════════════════════════════════════
//
// Sign anybody in. It is a random string mailed to an address; it proves
// nothing about who is holding it. Every path below that ends in a login ends
// at /login, with the PASSWORD still to be typed — the token only chooses
// which address is in the box and what the sentence above it says.
//
// Pure. scripts/check-auth-link-routing.mjs executes every branch.

import { isInternalPath } from "@/lib/appUrl";
import { hasFinishedSignup } from "@/lib/signup/abandoned";

export const RESUME_ACTIONS = Object.freeze({
  // No login on this address: the account step, as before.
  SIGNUP: "signup",
  // Signed in as the address's owner with signup unfinished: carry on in
  // /signup, whose entry check lands them on the first unfinished step.
  CONTINUE: "continue",
  // Signed in as the owner and signup is finished: nothing to set up.
  APP: "app",
  // A login exists and nobody is signed in: sign-in, address filled.
  SIGN_IN: "sign_in",
  // Somebody ELSE is signed in on this browser: they choose, out loud.
  SWITCH: "switch_account",
});

/**
 * The login behind an address, from a User row read with its active
 * memberships' companies ({ isDemo, trialEndsAt, subscription }).
 *
 * `finished` is lib/signup/abandoned.js hasFinishedSignup — a Subscription
 * row OR the card-free trial — the same predicate every other reader of
 * "finished signing up" asks. hasFinishedSignup throws on an unselected
 * column, which is the point: read wrongly, "not finished" would send a
 * paying customer back through signup.
 */
export function loginFromUser(user) {
  if (!user?.id) return null;
  const companies = (user.memberships || []).map((m) => m?.company).filter((c) => c && !c.isDemo);
  return {
    userId: user.id,
    emailVerified: Boolean(user.emailVerified),
    hasCompany: companies.length > 0,
    finished: companies.some((c) => hasFinishedSignup(c)),
  };
}

/** /signup?resume=<token>, the way back here after sign-in. */
export function resumePath(token) {
  return `/signup?resume=${encodeURIComponent(String(token || ""))}`;
}

/**
 * @param prefill  what the token found (signupLeadForResume), or null
 * @param login    loginFromUser(...) for prefill.email, or null for none
 * @param session  { userId, email } of the browser's session, or null
 * @param token    the resume token itself
 *
 * @returns { action, to, finished, verified, hasLogin, sessionEmail }
 *   `to` is where the page navigates for APP and SIGN_IN, and where it
 *   carries on to after a SWITCH signs the other account out. Always an
 *   internal path.
 */
export function decideResumeRoute({ prefill = null, login = null, session = null, token = "" } = {}) {
  if (!prefill?.email) return { action: RESUME_ACTIONS.SIGNUP, to: null };
  const back = resumePath(token);
  const signedIn = Boolean(session?.userId);

  if (!login) {
    // Nobody owns this address yet. Signed in as someone else, the account
    // step would create the new login ON TOP of their session — so they are
    // asked first, and signed out before the form ever shows.
    if (signedIn) {
      return { action: RESUME_ACTIONS.SWITCH, to: back, hasLogin: false, sessionEmail: session.email || null };
    }
    return { action: RESUME_ACTIONS.SIGNUP, to: null };
  }

  // Finished → the app. Unfinished → back through this link, which the
  // signed-in entry check turns into the first unfinished step.
  const next = login.finished ? "/app" : back;
  const base = { finished: login.finished, verified: login.emailVerified, hasLogin: true };

  if (signedIn && session.userId === login.userId) {
    return login.finished ? { action: RESUME_ACTIONS.APP, to: "/app", ...base } : { action: RESUME_ACTIONS.CONTINUE, to: null, ...base };
  }
  if (signedIn) {
    // Never silently operate as the wrong account — and never silently sign
    // the right one out either. The page shows both addresses and asks.
    return { action: RESUME_ACTIONS.SWITCH, to: `/login?resume=${encodeURIComponent(String(token || ""))}`, sessionEmail: session.email || null, next, ...base };
  }
  return { action: RESUME_ACTIONS.SIGN_IN, to: `/login?resume=${encodeURIComponent(String(token || ""))}`, next, ...base };
}

/** A navigation target the browser may follow — internal paths only. */
export function safeResumeTarget(to) {
  return isInternalPath(to) ? to : null;
}
