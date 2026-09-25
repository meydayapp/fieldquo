// lib/mailbox/oauthState.js
//
// The CSRF state for the Google and Microsoft mailbox connects. The signing
// and verifying is lib/calendar/googleState.js's — HMAC over nonce, member id
// and time, echoed back and compared against an httpOnly cookie — with the
// provider's own client secret as the key. Not a copy: the same two
// functions, a different cookie name per provider so a calendar connect and
// a mailbox connect in two tabs cannot consume each other's state.
//
// What the person ASKED for (the company mailbox or their own; with sending
// or without) rides in a second cookie. It is not trusted: the callback
// re-checks the role for "company" at the moment it saves, exactly as the
// connect route did, so a hand-edited cookie can ask for nothing the member
// could not have asked for anyway.

import { signState, verifyState, stateCookieOptions } from "@/lib/calendar/googleState";

export const STATE_COOKIE = { google: "mailbox_google_oauth_state", microsoft: "mailbox_ms_oauth_state" };
export const INTENT_COOKIE = "mailbox_oauth_intent";

export { signState, verifyState, stateCookieOptions };

/** { scope, send, reconnectId } → cookie value. */
export function encodeIntent({ scope = "member", send = false } = {}) {
  return `${scope === "company" ? "company" : "member"}.${send ? "1" : "0"}`;
}

export function decodeIntent(value) {
  const [scope, send] = String(value || "").split(".");
  return { scope: scope === "company" ? "company" : "member", send: send === "1" };
}
