// lib/quotes/shareToken.js
//
// The client's link, minted when the quote is SAVED — not when it is sent.
//
// ── Why the move ────────────────────────────────────────────────────────────
//
// The token used to be minted by the send route and by POST /share, which
// meant a quote had no link until somebody pressed Send. "Preview as client"
// and "Copy quote link" therefore sat greyed out on every draft, and the one
// moment an estimator actually wants to look at the client's copy — before it
// goes out, to spot anything — was the one moment the product refused. The
// owner's fix is the right one: a quote is going to be sent either way, so
// mint the token at save and let the STATUS decide who may open it
// (app/q/[token] and app/api/public/quotes/[token]).
//
// Minting early costs nothing and leaks nothing on its own. The token is a
// distribution capability, and it is still redacted from members below
// view_create_edit (lib/permissions/redactShareToken), still gated by the plan
// on POST /share, and the page it opens still refuses the world while the
// quote is a draft. What changed is WHEN the string exists, not who may use
// it.
//
// ── Stability is the point ──────────────────────────────────────────────────
//
// The same string before and after Send. An estimator who copies the link into
// a text message on Tuesday and presses Send on Wednesday must not find that
// the two point at different pages — that is precisely the "copy quote link"
// breakage the owner reported. So every writer here either mints a token or
// leaves the existing one alone; only POST /share with `rotate` replaces one,
// deliberately and on request.

import { randomBytes } from "crypto";

/**
 * 32 bytes of CSPRNG output, base64url.
 *
 * The token is the only thing standing between a stranger and this client's
 * pricing, so it has to be unguessable — cuid (sequential, timestamp-prefixed)
 * would not be. Kept identical to what the send and share routes minted before
 * this file existed, so tokens already in clients' inboxes and tokens minted
 * from here are the same kind of string.
 */
export function mintShareToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * The `data` fragment for a save.
 *
 * Returns `{}` when the quote already has a token, so spreading this into a
 * Prisma update can never overwrite a link that is already sitting in a
 * client's inbox. That is why it returns a fragment rather than a string: an
 * `ensureShareToken()` that returned the token would tempt a caller into
 * `data: { shareToken: ensure(...) }`, which is correct only until somebody
 * passes the wrong argument.
 *
 * @param existingToken the quote's current shareToken, or null/undefined on a
 *   create. Callers on the update path must SELECT it — passing undefined
 *   because the column wasn't read would re-mint on every save.
 */
export function shareTokenData(existingToken) {
  return existingToken ? {} : { shareToken: mintShareToken() };
}

/**
 * May this token's page be opened by the world?
 *
 * The one rule, in one place, because three surfaces ask it: the public page
 * (app/q/[token]), the public payload (app/api/public/quotes/[token]) and the
 * check that proves they agree. A draft is not a document yet — the numbers
 * are still being worked out — so the world gets the ordinary not-found, and
 * only a signed-in member of the owning company sees it, as a preview.
 *
 * Deliberately a status test and NOT a "does it have a token" test: now that
 * every saved quote has one, the existence of a token says nothing about
 * whether the quote is ready to be read.
 */
export function isPubliclyReadable(status) {
  return status !== "draft";
}
