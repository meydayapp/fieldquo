// lib/meta/oauthCookies.js
//
// Cookie names/lifetimes shared between the three legs of the connect flow
// (app/api/meta-ads/connect, .../callback, .../finalize) — one source so the
// three routes can't drift apart on a name or a maxAge the way three copies
// of the same string would (AGENTS.md failure class 4).
//
// Both cookies are httpOnly + secure + sameSite: lax, and both are deleted
// the moment they're read — neither is meant to outlive the single OAuth
// round trip it exists for.

/** CSRF state, set by /connect, checked and cleared by /callback. */
export const STATE_COOKIE = "meta_oauth_state";

/**
 * The long-lived token, held ONLY while a company has more than one ad
 * account and the settings screen is waiting on a pick — set by /callback,
 * read and cleared by /finalize. Never the token's permanent home; that's
 * MetaAdConnection.accessTokenEnc, encrypted, once an account is chosen.
 */
export const PENDING_TOKEN_COOKIE = "meta_oauth_pending_token";

export const OAUTH_COOKIE_MAX_AGE_SECONDS = 600;

export function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  };
}
