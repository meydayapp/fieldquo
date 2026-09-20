// lib/calendar/googleState.js
//
// The OAuth `state` for the Google Calendar connect flow, SIGNED.
//
// The Meta flows keep a random nonce in a cookie and compare it to what comes
// back — enough against CSRF on its own. This one signs the nonce together
// with the member id, for one extra property: the callback can refuse a
// state that was not minted by THIS deployment for THIS member even before
// it reads the cookie, and a state whose cookie was replayed from a
// different session lands on `bad_state` with the member id disagreeing
// rather than a stranger's calendar being attached to somebody's account.
//
// Pure. scripts/check-google-calendar.mjs round-trips it and tampers with
// every field.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_STATE_COOKIE = "google_calendar_oauth_state";
export const GOOGLE_STATE_MAX_AGE_SECONDS = 600;

/** The signing key. The client secret is server-only and rotates with the
 *  OAuth client — exactly the lifetime a state signature should share. */
function signingSecret() {
  return (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim() || null;
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * @returns {string} `${nonce}.${memberId}.${issuedAt}.${signature}`
 */
export function signState({ memberId, nonce = randomBytes(18).toString("base64url"), now = Date.now(), secret = signingSecret() } = {}) {
  if (!secret) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET is not set — cannot sign an OAuth state.");
  if (typeof memberId !== "string" || !memberId) throw new Error("signState: memberId required.");
  const payload = `${nonce}.${memberId}.${Math.floor(now / 1000)}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * @returns {{ memberId: string, nonce: string }|null} null on ANY doubt —
 * a malformed string, a bad signature, an expired stamp, a nonce that does
 * not match the cookie. Never throws on hostile input.
 */
export function verifyState(state, { cookieValue, now = Date.now(), secret = signingSecret(), maxAgeSeconds = GOOGLE_STATE_MAX_AGE_SECONDS } = {}) {
  if (!secret) return null;
  if (typeof state !== "string" || typeof cookieValue !== "string") return null;
  // The cookie must be the exact string Google echoed back: the CSRF check.
  if (state.length !== cookieValue.length) return null;
  if (!timingSafeEqual(Buffer.from(state), Buffer.from(cookieValue))) return null;

  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [nonce, memberId, issued, signature] = parts;
  if (!nonce || !memberId || !/^\d+$/.test(issued) || !signature) return null;

  const expected = sign(`${nonce}.${memberId}.${issued}`, secret);
  if (expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;

  const age = Math.floor(now / 1000) - Number(issued);
  if (age < 0 || age > maxAgeSeconds) return null;
  return { memberId, nonce };
}

export function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: GOOGLE_STATE_MAX_AGE_SECONDS,
    path: "/",
  };
}
