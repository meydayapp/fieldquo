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

// ── The PAGE publishing connect flow's own two ─────────────────────────────
//
// Separate cookie NAMES, not a reuse of the two above, because the two flows
// can genuinely be in the air at once: a contractor who starts "Connect Meta
// Ads", leaves the tab, and starts "Connect Facebook & Instagram" in another
// would otherwise have the second flow's state overwrite the first's and the
// first callback would land on `bad_state` with nothing to explain it. Same
// options, same 10-minute life, same delete-on-read.
export const PAGES_STATE_COOKIE = "meta_pages_oauth_state";

/**
 * The long-lived USER token, held ONLY while the contractor picks which Page
 * to connect — set by /api/settings/social/callback, read and cleared by
 * /api/settings/social/finalize. Never the token's home: what gets stored is
 * the PAGE token for the chosen Page, encrypted, in MetaPageConnection.
 */
export const PAGES_PENDING_TOKEN_COOKIE = "meta_pages_oauth_pending";

/**
 * WhatsApp Embedded Signup's state, set by /api/settings/whatsapp/connect,
 * checked and cleared by /api/settings/whatsapp/callback.
 *
 * A third name for the same reason the second one exists: the three flows can
 * genuinely be in the air at once, and a shared name would let whichever
 * started last overwrite the first's state — landing that callback on
 * `bad_state` with nothing to explain it.
 *
 * There is deliberately no WhatsApp equivalent of the two PENDING_TOKEN
 * cookies. Embedded Signup grants over a specific WhatsApp Business Account,
 * so there is no "pick one of your Pages" step to hold a token across; the
 * business token is exchanged, used, encrypted into MessagingChannel and
 * dropped inside the callback.
 */
export const WHATSAPP_STATE_COOKIE = "meta_whatsapp_oauth_state";

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
