// lib/reviews/googleBusiness/client.js
//
// The only file that talks to Google's Business Profile endpoints. OAuth
// itself — the client id, the code exchange, the refresh, the revoke — is
// borrowed whole from lib/calendar/googleClient.js: one Cloud project, one
// OAuth client, one consent screen. This adds one scope and three GETs.
//
// ── Three APIs, because Google split them ───────────────────────────────────
//
//   accounts   mybusinessaccountmanagement.googleapis.com/v1/accounts
//   locations  mybusinessbusinessinformation.googleapis.com/v1/{account}/locations
//   reviews    mybusiness.googleapis.com/v4/{account}/{location}/reviews
//
// Reviews are served only by the legacy v4 surface — none of the v1 splits
// carry them, and Google has said nothing about a replacement. All three
// answer nothing until Google has approved the project's "Basic API Access"
// application (quota starts at 0): docs/GOOGLE-BUSINESS-PROFILE.md has the
// steps, and quotaMessage() in sync.js turns the refusal into a sentence.
//
// Every function returns { ok, status, data } or { ok:false, status, message }
// — never throws on Google's answer — so the sync can stamp the message on
// the connection row and the screen can print it.

import { buildGoogleAuthorizeUrl, accessTokenFor, exchangeGoogleCode, revokeGoogleToken, decodeIdTokenEmail } from "@/lib/calendar/googleClient";

export const GOOGLE_BUSINESS_SCOPES = Object.freeze([
  "https://www.googleapis.com/auth/business.manage",
  "openid",
  "email",
]);

export const BUSINESS_SCOPE = GOOGLE_BUSINESS_SCOPES[0];

const ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const INFO_URL = "https://mybusinessbusinessinformation.googleapis.com/v1";
const REVIEWS_URL = "https://mybusiness.googleapis.com/v4";

export function buildBusinessAuthorizeUrl({ redirectUri, state }) {
  return buildGoogleAuthorizeUrl({ redirectUri, state, scopes: GOOGLE_BUSINESS_SCOPES });
}

async function googleGet(url, accessToken) {
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
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
      data?.error?.message || data?.error_description || data?.error || text.slice(0, 300) || `HTTP ${res.status}`;
    return { ok: false, status: res.status, message: String(message), reason: data?.error?.status || null };
  }
  return { ok: true, status: res.status, data };
}

/** { accounts: [{ name: "accounts/123", accountName, type }] } */
export async function listBusinessAccounts({ accessToken }) {
  return googleGet(ACCOUNTS_URL, accessToken);
}

/** { locations: [{ name: "locations/456", title, storefrontAddress }] } — paged. */
export async function listBusinessLocations({ accessToken, accountName, pageToken = null }) {
  const params = new URLSearchParams({
    readMask: "name,title,storefrontAddress",
    pageSize: "100",
  });
  if (pageToken) params.set("pageToken", pageToken);
  return googleGet(`${INFO_URL}/${accountName}/locations?${params}`, accessToken);
}

/**
 * One page of reviews for `accounts/{a}/locations/{l}`. The v4 name joins
 * the account and the location; the v1 locations list returns only
 * `locations/456`, so the caller composes the pair.
 */
export async function listLocationReviews({ accessToken, locationName, pageToken = null }) {
  const params = new URLSearchParams({ pageSize: "50" });
  if (pageToken) params.set("pageToken", pageToken);
  return googleGet(`${REVIEWS_URL}/${locationName}/reviews?${params}`, accessToken);
}

/** The full-name join, pure: ("accounts/1", "locations/2") → "accounts/1/locations/2". */
export function fullLocationName(accountName, locationName) {
  const a = String(accountName || "").replace(/\/+$/, "");
  const l = String(locationName || "").replace(/^\/+/, "");
  if (!a || !l) return null;
  if (l.startsWith("accounts/")) return l;
  return `${a}/${l}`;
}

export { accessTokenFor, exchangeGoogleCode, revokeGoogleToken, decodeIdTokenEmail };

/**
 * The object the sync takes as `deps.google`. Real by default; the check
 * hands in a fake with the same keys and a scripted quota refusal.
 */
export const defaultBusinessGoogle = Object.freeze({
  accessTokenFor,
  listAccounts: listBusinessAccounts,
  listLocations: listBusinessLocations,
  listReviews: listLocationReviews,
  revoke: revokeGoogleToken,
});
