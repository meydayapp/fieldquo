// lib/calendar/googleClient.js
//
// The ONLY file that talks to Google's OAuth and Calendar endpoints — the
// same rule lib/ai/provider.js applies to the model vendor and lib/meta/
// client.js to Meta. Everything above this (the sync, the busy read, the
// routes) receives a `google` object shaped like `defaultGoogle` below, so
// scripts/check-google-calendar.mjs can hand in a fake and execute the real
// sync against it rather than assert about it.
//
// ── What is asked for, and why exactly this ──────────────────────────────
//
//   calendar.events    create / update / delete FieldQuo's OWN events on the
//                      member's primary calendar. Google classes it as a
//                      sensitive scope, which is what makes the verification
//                      form in docs/GOOGLE-CALENDAR.md necessary.
//   calendar.readonly  freebusy.query — the member's personal events as
//                      opaque busy blocks. NOT `calendar.freebusy` alone:
//                      that narrower scope exists but is refused for a
//                      primary-calendar freebusy read on consumer accounts
//                      in practice, and readonly is what Google's own
//                      verification reviewers expect beside events.
//   openid email       the address for "Connected as {email}". Non-sensitive;
//                      read off the id_token, never from a People API call.
//
// `access_type=offline` + `prompt=consent` together are what make Google
// return a REFRESH token, and return it every time — without `consent`, a
// second connect after a disconnect comes back with no refresh token and a
// connection that dies in an hour.
import { tokenCryptoConfigured, encryptToken, decryptToken } from "@/lib/meta/tokenCrypto";

export const GOOGLE_CALENDAR_SCOPES = Object.freeze([
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
]);

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_URL = "https://www.googleapis.com/calendar/v3";

/** The two vars docs/VERCEL.md lists. Trimmed; empty reads as unset. */
export function googleOAuthClientId() {
  return (process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim() || null;
}
function googleOAuthClientSecret() {
  return (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim() || null;
}

/**
 * Can this deployment connect a calendar at all? Three things, all needed:
 * the OAuth client pair, and the key the refresh token is encrypted under.
 * The settings panel asks this before drawing a button, and every route asks
 * it again before doing anything — a hidden control is not access control.
 */
export function googleCalendarConfigured() {
  return Boolean(googleOAuthClientId() && googleOAuthClientSecret() && tokenCryptoConfigured());
}

/** Which of the three is missing, for the panel's one honest sentence. */
export function googleCalendarMissing() {
  const missing = [];
  if (!googleOAuthClientId()) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!googleOAuthClientSecret()) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!tokenCryptoConfigured()) missing.push("META_TOKEN_ENCRYPTION_KEY");
  return missing;
}

/** Pure: the consent-screen URL. Exported so the check can read it back. */
export function buildGoogleAuthorizeUrl({ clientId = googleOAuthClientId(), redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

/**
 * The payload of a JWT, unverified. The id_token arrives over TLS straight
 * from Google's token endpoint in the same response as the access token, so
 * its signature proves nothing the transport did not already; it is read for
 * one non-security field (the email shown in the panel). Never used to
 * authenticate anything. Pure, and tolerant of garbage: null out.
 */
export function decodeIdTokenEmail(idToken) {
  if (typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json);
    const email = typeof payload?.email === "string" ? payload.email.trim() : "";
    return email || null;
  } catch {
    return null;
  }
}

/** One error shape for every failure below: { ok:false, status, message }. */
async function googleFetch(url, init = {}) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    return { ok: false, status: 0, message: `network: ${err?.message || "unreachable"}` };
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const message =
      data?.error?.message || data?.error_description || data?.error || text.slice(0, 200) || `HTTP ${res.status}`;
    return { ok: false, status: res.status, message: String(message) };
  }
  return { ok: true, status: res.status, data };
}

function form(body) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  };
}

/** The code from the callback → { access_token, refresh_token, id_token }. */
export async function exchangeGoogleCode({ code, redirectUri }) {
  return googleFetch(
    TOKEN_URL,
    form({
      code,
      client_id: googleOAuthClientId() || "",
      client_secret: googleOAuthClientSecret() || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  );
}

/** A refresh token → a short-lived access token. Never stored. */
export async function refreshGoogleAccessToken(refreshToken) {
  const res = await googleFetch(
    TOKEN_URL,
    form({
      refresh_token: refreshToken,
      client_id: googleOAuthClientId() || "",
      client_secret: googleOAuthClientSecret() || "",
      grant_type: "refresh_token",
    }),
  );
  if (!res.ok) return res;
  const token = res.data?.access_token;
  return token ? { ok: true, accessToken: token } : { ok: false, status: 502, message: "no access_token in refresh reply" };
}

/**
 * Revoke at Google. Revoking the REFRESH token invalidates every access token
 * minted from it, so this is the one call disconnect needs. Best-effort by
 * contract — a Google refusal must never stop the row being destroyed.
 */
export async function revokeGoogleToken(token) {
  return googleFetch(`${REVOKE_URL}?${new URLSearchParams({ token })}`, { method: "POST" });
}

function authed(accessToken, extra = {}) {
  return {
    ...extra,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(extra.headers || {}) },
  };
}

const enc = encodeURIComponent;

/**
 * `conferenceDataVersion=1` is the query flag that makes Google honour a
 * `conferenceData.createRequest` in the body and mint a Meet link — without
 * it the request is silently ignored and the event has no link. Sent only
 * when the body asks for one, so an ordinary insert is byte-for-byte what it
 * was.
 */
function conferenceQuery(event) {
  return event?.conferenceData ? "?conferenceDataVersion=1" : "";
}

export async function insertGoogleEvent({ accessToken, calendarId, event }) {
  return googleFetch(
    `${CALENDAR_URL}/calendars/${enc(calendarId)}/events${conferenceQuery(event)}`,
    authed(accessToken, { method: "POST", body: JSON.stringify(event) }),
  );
}

export async function patchGoogleEvent({ accessToken, calendarId, eventId, event }) {
  return googleFetch(
    `${CALENDAR_URL}/calendars/${enc(calendarId)}/events/${enc(eventId)}${conferenceQuery(event)}`,
    authed(accessToken, { method: "PATCH", body: JSON.stringify(event) }),
  );
}

export async function getGoogleEvent({ accessToken, calendarId, eventId }) {
  return googleFetch(`${CALENDAR_URL}/calendars/${enc(calendarId)}/events/${enc(eventId)}`, authed(accessToken));
}

export async function deleteGoogleEvent({ accessToken, calendarId, eventId }) {
  const res = await googleFetch(
    `${CALENDAR_URL}/calendars/${enc(calendarId)}/events/${enc(eventId)}`,
    authed(accessToken, { method: "DELETE" }),
  );
  // Already gone is the outcome we wanted. 410 is Google's "was deleted".
  if (!res.ok && (res.status === 404 || res.status === 410)) return { ok: true, status: res.status, data: null };
  return res;
}

/** Every event FieldQuo ever wrote to this calendar, by the private property. */
export async function listGoogleEventsByPrivateProperty({ accessToken, calendarId, key, value, pageToken = null }) {
  const params = new URLSearchParams({
    privateExtendedProperty: `${key}=${value}`,
    showDeleted: "false",
    maxResults: "250",
    singleEvents: "true",
  });
  if (pageToken) params.set("pageToken", pageToken);
  return googleFetch(`${CALENDAR_URL}/calendars/${enc(calendarId)}/events?${params}`, authed(accessToken));
}

/** freebusy.query for one calendar → { ok, busy: [{ start, end }] }. */
export async function queryGoogleFreeBusy({ accessToken, calendarId, timeMin, timeMax }) {
  const res = await googleFetch(
    `${CALENDAR_URL}/freeBusy`,
    authed(accessToken, {
      method: "POST",
      body: JSON.stringify({
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString(),
        items: [{ id: calendarId }],
      }),
    }),
  );
  if (!res.ok) return res;
  const cal = res.data?.calendars?.[calendarId] || Object.values(res.data?.calendars || {})[0] || {};
  if (Array.isArray(cal.errors) && cal.errors.length) {
    return { ok: false, status: 502, message: cal.errors.map((e) => e?.reason || "error").join(", ") };
  }
  const busy = (Array.isArray(cal.busy) ? cal.busy : [])
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
    .filter((b) => !Number.isNaN(b.start.getTime()) && !Number.isNaN(b.end.getTime()) && b.end > b.start);
  return { ok: true, busy };
}

/**
 * The credential dance in one place: the stored blob → a live access token.
 * Throws on a row whose ciphertext will not open (wrong key, corruption) —
 * the caller records that on the row as lastError rather than as "expired",
 * which is a different failure Google itself reports.
 */
export async function accessTokenFor(connection) {
  const refreshToken = decryptToken(connection.refreshTokenEnc);
  return refreshGoogleAccessToken(refreshToken);
}

export { encryptToken, decryptToken };

/**
 * The object the sync and the busy read take as `deps.google`. Real by
 * default; the check passes its own with the same keys.
 */
export const defaultGoogle = Object.freeze({
  accessTokenFor,
  insertEvent: insertGoogleEvent,
  patchEvent: patchGoogleEvent,
  getEvent: getGoogleEvent,
  deleteEvent: deleteGoogleEvent,
  listByPrivateProperty: listGoogleEventsByPrivateProperty,
  freeBusy: queryGoogleFreeBusy,
  revoke: revokeGoogleToken,
});

// The client the sync and the busy read use when a caller passes none. The
// real one, except under scripts/check-google-calendar.mjs, which swaps in a
// fake so computeAvailableSlots — which calls googleBusyRanges with no deps —
// can be executed end to end without a network. Nothing in app/ or lib/
// calls the override; grep it to be sure.
let active = defaultGoogle;
export function activeGoogle() {
  return active;
}
export function overrideGoogleForChecks(fake) {
  active = fake || defaultGoogle;
}
