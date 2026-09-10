// lib/sales/authRefusals.js
//
// The catalogue entry for every refusal the sales portal's front door returns.
//
// ══ Why this is a file and not two maps in two route handlers ══════════════
//
// A Next route module may only export the HTTP methods and the handful of
// segment config values; a stray export there is a build-time complaint, not a
// tidy place for a shared vocabulary. More to the point, the route and the
// SCREEN both need this map — the route stamps the code, the screen looks the
// sentence up — and two copies of a code table is how a screen ends up
// rendering a raw key for a refusal the route renamed.
//
// ══ Why codes at all, when the routes already return sentences ═════════════
//
// /sales/login and /sales/invite/[token] are the only FieldQuo screens a new
// sales hire sees before they have an account, and every word of feedback on
// them was English no matter which language they were hired in. Wrong
// password, expired link, link already used, account deactivated, password too
// short — five different things to do next, five English sentences.
//
// The sentences are unchanged and still travel in `error`. They are what a
// script, a log or a curl sees, and they are the fallback when a language has
// not got a key yet. The CODE is what lets the screen say the same thing in
// the reader's own language.
//
// ══ What is NOT collapsed ══════════════════════════════════════════════════
//
// The invite route deliberately answers with one sentence per refusal, and
// this map keeps that shape: four invite states, not one generic "invalid
// link". "Ask for a new invitation", "sign in with the password you set" and
// "ask a superadmin about your account" are three different instructions and a
// single translated sentence would give back exactly what the map exists to
// provide.
//
// The LOGIN route is the opposite, also deliberately: it answers every failure
// — no such rep, wrong password, never accepted, deactivated, left — with ONE
// sentence, because telling them apart tells a stranger which FieldQuo staff
// addresses are real. That single code stays single here. A future edit that
// splits it would be a security change, not a translation change.

/** Code → catalogue key. Every code any /api/sales/auth route can stamp. */
export const AUTH_REFUSAL_KEYS = Object.freeze({
  // The invitation link, in its four states.
  invite_unknown: "app.salesAuth.invite.unknown",
  invite_accepted: "app.salesAuth.invite.accepted",
  invite_expired: "app.salesAuth.invite.expired",
  invite_inactive: "app.salesAuth.invite.inactive",
  // Setting the password on that link.
  invite_weak_password: "app.salesAuth.invite.weakPassword",
  // Signing in. One code on purpose — see the header.
  login_invalid: "app.salesAuth.login.invalid",
  login_missing_fields: "app.salesAuth.login.missingFields",
});

/**
 * The key for a code, or null.
 *
 * Null rather than a guessed key: a code this build has never heard of must
 * fall back to the server's own sentence, not render a raw
 * key name at somebody trying to start their job.
 */
export function authRefusalKey(code) {
  return (code && AUTH_REFUSAL_KEYS[code]) || null;
}
