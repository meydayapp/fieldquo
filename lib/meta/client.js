// lib/meta/client.js
//
// The ONLY file that talks to Meta's Graph/Marketing API — same discipline
// lib/ai/provider.js keeps for OpenAI and lib/voice/retell.js keeps for
// Retell (AGENTS.md names both). One file owns the version string and every
// call to it, so a Meta API version bump (3-4 times a year — see
// docs/META-ADS-INTEGRATION.md Part 0/5) is a one-line change and a single
// re-test, not a hunt through scattered fetch() calls.
//
// ── Never seen a real Meta response ─────────────────────────────────────────
//
// This was written with no Meta App ID, no App Secret, and no test ad
// account — see docs/META-ADS-BUILD.md. Every network-facing function here
// is UNTESTED against the real API. What IS tested (see the pure helpers
// below and the mutation-tested error classifier) is written so that when
// real credentials exist, only graphFetch's actual HTTP call needs
// verifying — the URL building, scope, and error handling around it are
// already exercised against hostile/hand-built responses.
//
// ── ads_read only ────────────────────────────────────────────────────────
//
// Every function below reads. Nothing here creates, edits, or deletes a
// campaign — see docs/META-ADS-BUILD.md for why ad creation (ads_management)
// was scoped out of this pass. Requesting only ads_read keeps App Review to
// the lighter of the two gates docs/META-ADS-INTEGRATION.md Part 0 describes.

// Bump this one constant when Meta ships a new version FieldQuo has verified
// against — see docs/META-ADS-INTEGRATION.md Part 0 for why that happens
// several times a year and cannot be put off past the two-year floor.
export const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Scope kept to the single permission this build needs. Adding a second
// scope here later means re-running App Review — see
// docs/META-ADS-INTEGRATION.md Part 5.
export const META_OAUTH_SCOPE = "ads_read";

import { tokenCryptoConfigured } from "./tokenCrypto";

/**
 * Does FieldQuo itself have a Meta app to authorise against? Both env vars
 * come from Meta's own App Dashboard once an app is created there — neither
 * exists yet in this build (see docs/META-ADS-BUILD.md). Never throws, so a
 * settings screen can ask this before rendering a "Connect" button instead
 * of rendering one that 500s on click — see AGENTS.md's rule that a control
 * needing credentials that don't exist must say so, not pretend to work.
 */
export function metaAppConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

/**
 * Everything the connect flow needs to actually work: the app credentials
 * AND a real token-encryption key (lib/meta/tokenCrypto.js). Both are
 * required before "Connect Meta Ads" can do anything other than explain
 * what's missing.
 */
export function metaFullyConfigured() {
  return metaAppConfigured() && tokenCryptoConfigured();
}

/**
 * The URL a company's Meta OAuth "Connect" button sends the browser to.
 * Pure string-building — no network call, safe to unit-test directly.
 *
 * `state` must be an unguessable, per-attempt value the callback route
 * verifies against a short-lived server-side record (the standard OAuth CSRF
 * defence) — this function doesn't generate or validate it, only carries it
 * through.
 */
export function buildAuthorizeUrl({ redirectUri, state }) {
  if (!redirectUri) throw new Error("buildAuthorizeUrl: redirectUri is required.");
  if (!state) throw new Error("buildAuthorizeUrl: state is required.");
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error("buildAuthorizeUrl: META_APP_ID is not configured.");
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: META_OAUTH_SCOPE,
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

/**
 * Classifies a Graph API error response into what the sync job (and the
 * settings screen) actually need to know. Pure — takes the parsed JSON body
 * (or null) and the HTTP status, returns a decision, never touches the
 * network. This is the function docs/META-ADS-BUILD.md's mutation-testing
 * notes cover in most detail, because getting this wrong is exactly the
 * "silently reports $0 spend" failure the brief calls out.
 *
 * Returns one of:
 *   { kind: "auth_error",    message }  — token invalid/expired/revoked;
 *                                         MetaAdConnection.status should
 *                                         become "needs_reauth"
 *   { kind: "rate_limited",  message, retryAfterSeconds }
 *   { kind: "not_found",     message }  — ad account id no longer resolves
 *                                         (deleted, or access revoked from
 *                                         Meta's side without a token error)
 *   { kind: "unknown_error", message }  — anything else; MetaAdConnection.
 *                                         status becomes "error", not
 *                                         "needs_reauth" — reconnecting
 *                                         won't fix a problem that isn't
 *                                         the token
 */
export function classifyMetaError({ status, body, headers } = {}) {
  const err = body && typeof body === "object" ? body.error : null;
  const code = err?.code;
  const message = (err && (err.message || err.error_user_msg)) || `Meta API returned HTTP ${status ?? "?"} with no error body.`;

  // 190 = OAuthException, Meta's own code for every token problem: expired,
  // revoked by the user, password changed, session invalidated. Subcodes
  // 458/460/463/467 narrow WHY, but "reconnect" is the same fix for all of
  // them, so they're not distinguished further here.
  if (code === 190 || status === 401) {
    return { kind: "auth_error", message };
  }

  // Meta's rate-limit family: 4 (app-level), 17 (user-level), 32 (page-level),
  // 613 (custom rate limit / ad account throttling) — see
  // docs/META-ADS-INTEGRATION.md Part 0 on the two-tier rate budget. HTTP 429
  // is included for a future version that moves this to a standard status.
  if (status === 429 || [4, 17, 32, 613].includes(code)) {
    const retryAfterHeader = headers?.get?.("retry-after") ?? headers?.["retry-after"];
    const retryAfterSeconds = Number.isFinite(Number(retryAfterHeader))
      ? Number(retryAfterHeader)
      : 300; // Meta's own documented Development-tier block window.
    return { kind: "rate_limited", message, retryAfterSeconds };
  }

  // 803 = "Some of the aliases you requested do not exist" / unknown object
  // id — the shape Meta returns for an ad account id that no longer resolves.
  if (code === 803 || status === 404) {
    return { kind: "not_found", message };
  }

  return { kind: "unknown_error", message };
}

/**
 * The one function that actually calls graph.facebook.com. Every exported
 * function below routes through this — nothing here constructs a second
 * fetch() to Meta anywhere else in the codebase.
 *
 * Returns `{ ok: true, data }` on success or `{ ok: false, ...classifyMetaError() }`
 * on failure — never throws for a Meta-side error, so a sync job can always
 * inspect `.kind` rather than wrapping every call in try/catch. A genuine
 * network failure (DNS, timeout) DOES throw, because that's not a Meta
 * response to classify — it's FieldQuo's own connectivity, and the caller's
 * try/catch around the whole sync already has to handle that class of error
 * for every other integration in this codebase.
 */
async function graphFetch(path, { accessToken, method = "GET", params = {} } = {}) {
  if (!accessToken) throw new Error("graphFetch: accessToken is required.");
  const url = new URL(`${GRAPH_BASE}${path}`);
  const search = new URLSearchParams({ ...params, access_token: accessToken });
  if (method === "GET") {
    url.search = search.toString();
  }
  const res = await fetch(url, {
    method,
    ...(method !== "GET" && {
      body: search,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }),
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null; // A non-JSON body still needs classifying below, not a throw.
  }

  if (!res.ok) {
    return { ok: false, ...classifyMetaError({ status: res.status, body, headers: res.headers }) };
  }
  return { ok: true, data: body };
}

/**
 * The token endpoint (/oauth/access_token) authenticates with
 * client_id/client_secret, not a bearer access_token, so it can't route
 * through graphFetch above — kept as its own small helper instead of
 * stretching graphFetch's contract to cover a call shape it doesn't share.
 */
async function oauthTokenFetch(params) {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.search = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    ...params,
  }).toString();
  const res = await fetch(url);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    return { ok: false, ...classifyMetaError({ status: res.status, body, headers: res.headers }) };
  }
  return { ok: true, data: body };
}

/** Short-lived code from the OAuth redirect -> a token (still short-lived). */
export async function exchangeCodeForToken({ code, redirectUri }) {
  return oauthTokenFetch({ redirect_uri: redirectUri, code });
}

/**
 * Short-lived token -> a long-lived one (~60 days). Meta's recommended
 * exchange, done once right after the OAuth callback so
 * MetaAdConnection.tokenExpiresAt reflects the long-lived window, not the
 * ~1-2 hour short-lived one.
 */
export async function exchangeForLongLivedToken({ shortLivedToken }) {
  return oauthTokenFetch({ grant_type: "fb_exchange_token", fb_exchange_token: shortLivedToken });
}

/** The ad accounts this token can read — for the "pick an account" step. */
export async function listAdAccounts({ accessToken }) {
  return graphFetch("/me/adaccounts", {
    accessToken,
    params: { fields: "id,name,currency,account_status" },
  });
}

/** One ad account's own name/currency/status — used to label a connection. */
export async function getAdAccount({ accessToken, adAccountId }) {
  return graphFetch(`/${adAccountId}`, {
    accessToken,
    params: { fields: "id,name,currency,account_status" },
  });
}

/**
 * Daily, per-campaign spend/impressions/clicks/actions for a date range.
 * `since`/`until` are "YYYY-MM-DD". `time_increment: 1` is what makes the
 * response one row per campaign per DAY rather than one summed row for the
 * whole range — lib/meta/insightsImport.js needs the daily rows to build
 * MarketingSpend's one-row-per-day shape.
 */
export async function getCampaignInsights({ accessToken, adAccountId, since, until }) {
  return graphFetch(`/${adAccountId}/insights`, {
    accessToken,
    params: {
      level: "campaign",
      time_range: JSON.stringify({ since, until }),
      time_increment: "1",
      fields: "campaign_id,campaign_name,spend,impressions,clicks,actions",
      limit: "500",
    },
  });
}
