// lib/quotes/addToQuoteLink.js
//
// "Add this price to your own quote →" — the one secondary line a quote email
// carries when the quote is addressed to a BUSINESS, and the page it opens
// (app/q/[token]/add). Owner-approved 2026-09-29.
//
// ══ Who gets the line ══════════════════════════════════════════════════════
//
// Client.type is the field that says it: `company` is "another business (e.g.
// a general contractor) that hires this company across many different job
// sites"; `individual` (the column default) is a homeowner. So the rule is
// exactly `client.type === "company"` — not "has a company name", not a
// guess from the email domain. A client whose type was never set is the
// default, a homeowner, and their email is byte-for-byte what it was before
// this line existed (scripts/check-quote-email-sections.mjs proves it).
//
// ══ The resume path ════════════════════════════════════════════════════════
//
// A contractor with no FieldQuo account taps "Create your free account" on
// the page. The link is /signup?next=/q/<token>/add — /signup already carries
// an internal `next` through the welcome questions and lands there after them
// (app/welcome/WelcomeFlow.js afterSetupUrl). That hand-off lives in
// sessionStorage, which dies with the tab; a contractor who verifies their
// email in another tab, or comes back tomorrow, would lose it. So the page
// ALSO leaves a short-lived cookie naming the quote, and afterSetupUrl falls
// back to it. The cookie carries the share token — the same credential that
// is already in their inbox and their browser history — and nothing else.
//
// Pure: no I/O, imported by the email, the page, the welcome flow and
// scripts/check-welcome-flow.mjs alike.

/**
 * The "which of your quotes" value that means "start a new quote" — shared by
 * the panel's select and the import route (lib/quotes/importTarget.js), which
 * cannot be imported into a browser bundle itself.
 */
export const NEW_IMPORT_TARGET = "new";

/** The add-to-your-quote page for a share token. */
export function addToQuotePath(token) {
  return `/q/${encodeURIComponent(String(token || ""))}/add`;
}

/** The same page from the absolute /q/<token> URL the email already holds. */
export function addToQuoteUrl(quoteUrl) {
  return `${String(quoteUrl || "").replace(/\/+$/, "")}/add`;
}

/** Does this quote email get the line? Business clients only. */
export function isBusinessClient(client) {
  return client?.type === "company";
}

/** The cookie the page leaves for the welcome flow to find. */
export const ADD_TO_QUOTE_COOKIE = "fq_add_quote";

/** A week: long enough to verify an email and come back, short enough to forget. */
export const ADD_TO_QUOTE_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

// Share tokens are 32 CSPRNG bytes in base64url (lib/quotes/shareToken.js):
// 43 characters. Older tokens in inboxes were minted the same way. Anything
// else in the cookie is not ours and is not turned into a URL.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,128}$/;

export function isShareTokenShape(token) {
  return typeof token === "string" && TOKEN_SHAPE.test(token);
}

/** The Set-Cookie-style string the page writes through document.cookie. */
export function addToQuoteCookie(token) {
  if (!isShareTokenShape(token)) return null;
  return `${ADD_TO_QUOTE_COOKIE}=${token}; Max-Age=${ADD_TO_QUOTE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

/** The string that clears it once the page is reached signed in. */
export function clearAddToQuoteCookie() {
  return `${ADD_TO_QUOTE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * Where a finished welcome flow should go when sessionStorage has nothing:
 * the add page for the token in the cookie, or null.
 *
 * @param cookieHeader document.cookie (or a request's Cookie header)
 */
export function pendingAddToQuotePath(cookieHeader) {
  const raw = String(cookieHeader || "");
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== ADD_TO_QUOTE_COOKIE) continue;
    const value = part.slice(i + 1).trim();
    return isShareTokenShape(value) ? addToQuotePath(value) : null;
  }
  return null;
}
