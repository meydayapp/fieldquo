// lib/authErrors.js
//
// One place that turns a Better Auth failure into a sentence.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// /login and /accept-invitation both called signIn.email and both rendered
// `error.message` straight onto the screen. That message is Better Auth's own
// English string, so a French contractor got "Invalid email or password" in
// the middle of an otherwise French page — and, worse, three completely
// different situations all arrived looking the same:
//
//   · the password is wrong          → try again, or reset it
//   · three tries in ten seconds     → wait; trying harder makes it worse
//   · the request never landed       → nothing is wrong with the password
//
// The third is the one that costs a customer. Telling somebody their password
// is wrong when the real problem is a dropped connection sends them to the
// reset flow, into an inbox, and out of the product.
//
// ── Pure on purpose ────────────────────────────────────────────────────────
//
// signInErrorKey takes the error and returns a key. No `t`, no React, no
// fetch — so scripts/check-auth-errors.mjs runs the whole matrix of shapes
// Better Auth actually returns against it, instead of a regex arguing about
// what this file's source says. signInErrorText is the thin wrapper the pages
// call; it is given `t` rather than importing one, for the same reason.
//
// ── What is deliberately NOT mapped ────────────────────────────────────────
//
// EMAIL_NOT_VERIFIED: lib/auth.js sets requireEmailVerification: false, so
// sign-in never returns it. A branch for it would be copy for a state the
// server cannot produce — the "feature flag for a feature that doesn't exist"
// failure. Add it in the same commit that flips that flag, not before.

// Exported so a check can assert the catalogue carries every one of them,
// rather than trusting that the strings below are spelled the way the
// catalogue spells them.
export const SIGN_IN_ERROR_KEYS = {
  credentials: "app.auth.login.errorCredentials",
  throttled: "app.auth.login.errorThrottled",
  unreachable: "app.auth.login.errorUnreachable",
};

// The English of each, kept HERE rather than at the call sites.
//
// t() resolves language → English → this fallback → THE KEY ITSELF, and the
// last of those is the failure mode that matters: a bare
// "app.auth.login.errorThrottled" rendered in a red box to a contractor who
// cannot get into their own business. Until the catalogue carries these keys
// the fallback is what ships, and one copy of it beats two call sites drifting.
export const SIGN_IN_ERROR_EN = {
  [SIGN_IN_ERROR_KEYS.credentials]:
    "That email and password don’t match an account. Check them and try again, or reset your password below.",
  [SIGN_IN_ERROR_KEYS.throttled]:
    "Too many attempts in a row. Wait a minute and try again — there is nothing wrong with your account.",
  [SIGN_IN_ERROR_KEYS.unreachable]:
    "We couldn’t reach FieldQuo just now. Your password is fine — check your connection and try again in a moment.",
};

/**
 * Which sentence a failed sign-in should read.
 *
 * @param error  the `error` half of Better Auth's `{ data, error }`, or any
 *               thrown/rejected value. Anything falsy means "no failure", and
 *               returns null so a caller can't render an error box over a
 *               success.
 * @returns a key from SIGN_IN_ERROR_KEYS, or null.
 */
export function signInErrorKey(error) {
  if (!error) return null;

  const code = String(error.code || "").toUpperCase();
  // Number(null) is 0 and 0 is finite — the trap this repo keeps hitting. An
  // absent status has to fall through to "unreachable" rather than compare
  // equal to some small number, so nullish is turned into NaN first and every
  // test below is an equality against a real HTTP status.
  const status =
    error.status === null || error.status === undefined
      ? NaN
      : Number(error.status);

  // Better Auth's own default rule for /sign-in/email is 3 requests per 10
  // seconds. Three quick attempts at a password you half-remember is not an
  // attack, it is Tuesday, so this is the branch a real contractor hits most
  // often after the first one — and "invalid email or password" is an actively
  // wrong thing to tell them, because the next try would have worked.
  if (status === 429 || code === "TOO_MANY_REQUESTS") {
    return SIGN_IN_ERROR_KEYS.throttled;
  }

  // The enumeration-safe wording is load-bearing here for the same reason it is
  // on /forgot-password: one sentence for "no such account" and "wrong
  // password", or this form becomes a way to ask whether a given contractor
  // runs on FieldQuo. Better Auth already answers both with the same 401.
  if (
    code === "INVALID_EMAIL_OR_PASSWORD" ||
    code === "INVALID_PASSWORD" ||
    code === "USER_NOT_FOUND" ||
    status === 400 ||
    status === 401 ||
    status === 403
  ) {
    return SIGN_IN_ERROR_KEYS.credentials;
  }

  // 5xx, a fetch that never resolved, and anything Better Auth grows tomorrow.
  // Grouped on purpose: from the driveway, "our server broke" and "your signal
  // dropped" are the same instruction — wait and try again, and do NOT go and
  // reset a password that was never wrong.
  return SIGN_IN_ERROR_KEYS.unreachable;
}

/**
 * The sentence itself. Both pages call this, so neither can forget the
 * fallback and render a raw key.
 *
 * @param t      the caller's translator, so this module stays free of React.
 * @param error  Better Auth's `error`, or anything falsy for "no failure".
 * @returns the sentence, or "" when there was no failure.
 */
export function signInErrorText(t, error) {
  const key = signInErrorKey(error);
  return key ? t(key, SIGN_IN_ERROR_EN[key]) : "";
}
