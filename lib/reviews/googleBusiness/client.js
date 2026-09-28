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
//
// ── A fourth API, for the Book button (2026-09-28) ──────────────────────────
//
//   place actions  mybusinessplaceactions.googleapis.com/v1/locations/{l}/placeActionLinks
//
// The "Book" button on a Business Profile is a PlaceActionLink. list, create
// and delete are the only three calls FieldQuo makes on it; there is no
// patch here on purpose — a link the company edits by hand on Google stays
// theirs. Same scope (business.manage), same approval gate, plus one more
// API to enable in the Cloud project (docs/GOOGLE-BUSINESS-PROFILE.md).
// The rules about WHICH link may be touched live in bookButton.js.

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
const PLACE_ACTIONS_URL = "https://mybusinessplaceactions.googleapis.com/v1";

export function buildBusinessAuthorizeUrl({ redirectUri, state }) {
  return buildGoogleAuthorizeUrl({ redirectUri, state, scopes: GOOGLE_BUSINESS_SCOPES });
}

// One request shape for every verb. GET was the only one until the Book
// button needed POST and DELETE; a second copy of the refusal parsing below
// would be the one that drifts, so the GET now rides on this.
async function googleSend(url, accessToken, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
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

async function googleGet(url, accessToken) {
  return googleSend(url, accessToken);
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

/**
 * The place-actions parent, pure: the v1 API names a location on its own —
 * `locations/456` — while the connection may hold either that or the v4
 * `accounts/1/locations/456`. Anything else is not a location: null.
 */
export function placeActionParent(locationName) {
  const m = /^(?:accounts\/[^/]+\/)?(locations\/[^/?#]+)$/.exec(String(locationName || "").trim());
  return m ? m[1] : null;
}

/**
 * One page of a location's place-action links, optionally only one type
 * (Google's filter syntax: `placeActionType=APPOINTMENT`).
 * { placeActionLinks: [{ name, uri, placeActionType, isPreferred, isEditable, providerType }], nextPageToken }
 */
export async function listPlaceActionLinks({ accessToken, parent, placeActionType = null, pageToken = null }) {
  const params = new URLSearchParams();
  if (placeActionType) params.set("filter", `placeActionType=${placeActionType}`);
  if (pageToken) params.set("pageToken", pageToken);
  const qs = params.toString();
  return googleGet(`${PLACE_ACTIONS_URL}/${parent}/placeActionLinks${qs ? `?${qs}` : ""}`, accessToken);
}

/** Create one link. Google answers the existing link for a duplicate (parent, uri, type). */
export async function createPlaceActionLink({ accessToken, parent, link }) {
  return googleSend(`${PLACE_ACTIONS_URL}/${parent}/placeActionLinks`, accessToken, { method: "POST", body: link });
}

/** Delete one link by its full name, `locations/{l}/placeActionLinks/{id}`. */
export async function deletePlaceActionLink({ accessToken, name }) {
  return googleSend(`${PLACE_ACTIONS_URL}/${name}`, accessToken, { method: "DELETE" });
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
  listPlaceActionLinks,
  createPlaceActionLink,
  deletePlaceActionLink,
  revoke: revokeGoogleToken,
});
