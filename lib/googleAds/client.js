// lib/googleAds/client.js
//
// The ONLY file that talks to the Google Ads API — the same rule
// lib/meta/client.js keeps for Meta and lib/calendar/googleClient.js for
// Google's OAuth. OAuth itself (client id, code exchange, refresh, revoke) is
// borrowed whole from lib/calendar/googleClient.js: one Cloud project
// ("fieldquo"), one OAuth web client, one consent screen, one more scope.
// Everything above this file takes a `googleAds` object shaped like
// `defaultGoogleAds` below, so scripts/check-google-ads.mjs can hand in a
// fake and execute the real sync against fixtures. Nothing in this repo's
// checks ever calls Google.
//
// ── What the Google Ads API needs that the other Google APIs don't ─────────
//
//   1. The `adwords` scope on the company's consent. Google classes it as
//      SENSITIVE: until the OAuth consent screen is verified for it, only the
//      consent screen's test users can connect (docs/GOOGLE-ADS-INTEGRATION.md).
//   2. A DEVELOPER TOKEN, FieldQuo's — one per manager account, sent as the
//      `developer-token` header on every call. A new token has "Test account"
//      access only: every call against a REAL ad account answers
//      DEVELOPER_TOKEN_NOT_APPROVED until Google grants Basic access. Nothing
//      on our side can observe that grant without a real company's token, so
//      — exactly like GOOGLE_BUSINESS_API_APPROVED — the owner sets
//      GOOGLE_ADS_API_APPROVED=1 on the day Google's email arrives, and until
//      then no Connect button is drawn (googleAdsAvailable() below).
//   3. `login-customer-id` when the signed-in Google user reaches the ad
//      account THROUGH a manager (MCC) account rather than directly. Stored
//      on the connection when the account picker found the account under a
//      manager; omitted otherwise.
//
// The API itself is free: no per-call charge, only a daily operation quota
// (15,000 at Basic access) that one daily searchStream per company is
// nowhere near.
//
// ── The version ─────────────────────────────────────────────────────────────
//
// Google ships a new major version roughly quarterly and sunsets each about a
// year later; a sunset version answers 404/UNIMPLEMENTED to everything.
// GOOGLE_ADS_API_VERSION overrides the default so a sunset is an env change,
// not an emergency deploy — and classifyGoogleAdsError() names that failure
// in words ("api_version") instead of "unknown error".

import { tokenCryptoConfigured, decryptToken } from "@/lib/meta/tokenCrypto";
import {
  googleCalendarConfigured,
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  refreshGoogleAccessToken,
  revokeGoogleToken,
  decodeIdTokenEmail,
  googleOAuthClientId,
} from "@/lib/calendar/googleClient";

export const ADWORDS_SCOPE = "https://www.googleapis.com/auth/adwords";
export const GOOGLE_ADS_SCOPES = Object.freeze([ADWORDS_SCOPE, "openid", "email"]);
export const DEFAULT_API_VERSION = "v25";
const API_HOST = "https://googleads.googleapis.com";

/** FieldQuo's developer token. Trimmed; empty reads as unset. */
function developerToken() {
  return (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim() || null;
}

/** "v25", or the override — refused unless it LOOKS like a version. */
export function googleAdsApiVersion() {
  const v = (process.env.GOOGLE_ADS_API_VERSION || "").trim();
  return /^v\d{2,3}$/.test(v) ? v : DEFAULT_API_VERSION;
}

/** Google has granted Basic (or Standard) access to FieldQuo's developer token. Exactly "1". */
export function googleAdsApiApproved() {
  return String(process.env.GOOGLE_ADS_API_APPROVED ?? "").trim() === "1";
}

/**
 * Every env var this deployment still needs for a company to connect Google
 * Ads, by NAME (never value) — printed on the card so whoever runs the
 * deployment reads exactly what is missing. The approval flag is listed last
 * and separately (`waitingOnApproval`) because it is not a value anyone can
 * generate: it is Google's decision.
 */
export function googleAdsMissing() {
  const missing = [];
  if (!googleOAuthClientId()) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!(process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim()) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!tokenCryptoConfigured()) missing.push("META_TOKEN_ENCRYPTION_KEY");
  if (!developerToken()) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
  return missing;
}

/** Can a company on this deployment connect Google Ads end to end? */
export function googleAdsAvailable() {
  return googleCalendarConfigured() && Boolean(developerToken()) && googleAdsApiApproved();
}

export function buildGoogleAdsAuthorizeUrl({ redirectUri, state }) {
  return buildGoogleAuthorizeUrl({ redirectUri, state, scopes: GOOGLE_ADS_SCOPES });
}

/** "123-456-7890" or "1234567890" → "1234567890", or null. Pure. */
export function cleanCustomerId(raw) {
  const digits = String(raw ?? "").replace(/[\s-]/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
}

/** "1234567890" → "123-456-7890", the way Google Ads prints it. Pure. */
export function formatCustomerId(id) {
  const c = cleanCustomerId(id);
  return c ? `${c.slice(0, 3)}-${c.slice(3, 6)}-${c.slice(6)}` : null;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The one GAQL query the sync runs. Pure, and the dates are REFUSED unless
 * they are exactly YYYY-MM-DD — they are interpolated into a query string,
 * and nothing that is not a date gets near it.
 */
export function campaignDailyQuery({ since, until }) {
  if (!DAY_RE.test(since || "") || !DAY_RE.test(until || "")) throw new Error("campaignDailyQuery: since/until must be YYYY-MM-DD");
  return [
    "SELECT campaign.id, campaign.name, campaign.advertising_channel_type, segments.date,",
    "metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions",
    "FROM campaign",
    `WHERE segments.date BETWEEN '${since}' AND '${until}'`,
  ].join(" ");
}

export const CUSTOMER_QUERY =
  "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager, customer.test_account, customer.status FROM customer LIMIT 1";
export const CLIENTS_QUERY =
  "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.level, customer_client.status, customer_client.test_account FROM customer_client WHERE customer_client.level <= 1";

/**
 * Every GoogleAdsError in a failure body, as `{ code, message }` with code
 * "<family>.<VALUE>" (e.g. "authorizationError.DEVELOPER_TOKEN_NOT_APPROVED").
 * Google's REST error is `{ error: { code, status, message, details: [{
 * errors: [{ errorCode: { <family>: <VALUE> }, message }] }] } }`, and
 * searchStream wraps it in an array. Pure; tolerant of anything.
 */
export function extractGoogleAdsErrors(body) {
  const out = [];
  const roots = Array.isArray(body) ? body : [body];
  for (const root of roots) {
    const err = root?.error;
    if (!err || typeof err !== "object") continue;
    for (const d of Array.isArray(err.details) ? err.details : []) {
      for (const e of Array.isArray(d?.errors) ? d.errors : []) {
        const codeObj = e?.errorCode && typeof e.errorCode === "object" ? e.errorCode : {};
        const [family, value] = Object.entries(codeObj)[0] || [];
        out.push({ code: family ? `${family}.${value}` : null, message: typeof e?.message === "string" ? e.message : null });
      }
    }
    if (!out.length) out.push({ code: err.status ? `status.${err.status}` : null, message: typeof err.message === "string" ? err.message : null });
  }
  return out;
}

/**
 * HTTP status + body → one `kind` the sync and the card act on:
 *
 *   auth_error           the company's grant is gone (revoked, expired,
 *                        password changed) → connection "needs_reauth"
 *   developer_token      FieldQuo's token is not approved / invalid — not the
 *                        company's fault, nothing they can reconnect away
 *   permission           the Google user cannot read this ad account (often
 *                        a missing login-customer-id for a manager-reached one)
 *   customer_not_enabled the ad account is cancelled or suspended
 *   rate_limited         quota; try later, the connection is fine
 *   api_version          GOOGLE_ADS_API_VERSION is sunset
 *   unknown_error        anything else, Google's own sentence kept
 */
export function classifyGoogleAdsError(status, body) {
  const errors = extractGoogleAdsErrors(body);
  const codes = errors.map((e) => e.code || "");
  const message = errors.map((e) => e.message).filter(Boolean)[0] || (typeof body?.error_description === "string" ? body.error_description : null) || `HTTP ${status}`;
  const has = (re) => codes.some((c) => re.test(c));
  let kind = "unknown_error";
  if (has(/DEVELOPER_TOKEN/)) kind = "developer_token";
  else if (status === 401 || has(/^authenticationError\./) || body?.error === "invalid_grant") kind = "auth_error";
  else if (has(/USER_PERMISSION_DENIED|CUSTOMER_NOT_FOUND|ACTION_NOT_PERMITTED/)) kind = "permission";
  else if (has(/CUSTOMER_NOT_ENABLED|CUSTOMER_NOT_ACTIVE/)) kind = "customer_not_enabled";
  else if (status === 429 || has(/RESOURCE_EXHAUSTED|RESOURCE_TEMPORARILY_EXHAUSTED/)) kind = "rate_limited";
  else if (status === 404 || has(/UNIMPLEMENTED/)) kind = "api_version";
  return { kind, message: String(message).slice(0, 400), codes };
}

function headers(accessToken, loginCustomerId) {
  const h = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken() || "",
    "Content-Type": "application/json",
  };
  const login = cleanCustomerId(loginCustomerId);
  if (login) h["login-customer-id"] = login;
  return h;
}

async function adsFetch(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    return { ok: false, status: 0, kind: "unknown_error", message: `network: ${err?.message || "unreachable"}` };
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
    const c = classifyGoogleAdsError(res.status, data ?? { error: { message: text.slice(0, 300) } });
    return { ok: false, status: res.status, ...c };
  }
  return { ok: true, status: res.status, data };
}

/** { resourceNames: ["customers/1234567890", …] } — the accounts this Google user can reach directly. */
export async function listAccessibleCustomers({ accessToken }) {
  return adsFetch(`${API_HOST}/${googleAdsApiVersion()}/customers:listAccessibleCustomers`, {
    method: "GET",
    headers: headers(accessToken, null),
  });
}

/** One GAQL query, paged `search` (small results: the customer, its clients). */
export async function search({ accessToken, customerId, loginCustomerId = null, query }) {
  const id = cleanCustomerId(customerId);
  if (!id) return { ok: false, status: 400, kind: "unknown_error", message: "invalid customer id" };
  return adsFetch(`${API_HOST}/${googleAdsApiVersion()}/customers/${id}/googleAds:search`, {
    method: "POST",
    headers: headers(accessToken, loginCustomerId),
    body: JSON.stringify({ query }),
  });
}

/** searchStream — every row in one response, as an array of batches. */
export async function searchStream({ accessToken, customerId, loginCustomerId = null, query }) {
  const id = cleanCustomerId(customerId);
  if (!id) return { ok: false, status: 400, kind: "unknown_error", message: "invalid customer id" };
  return adsFetch(`${API_HOST}/${googleAdsApiVersion()}/customers/${id}/googleAds:searchStream`, {
    method: "POST",
    headers: headers(accessToken, loginCustomerId),
    body: JSON.stringify({ query }),
  });
}

/** The stored refresh token → a live access token. Throws on a row that will not decrypt. */
export async function accessTokenFor(connection) {
  const refreshToken = decryptToken(connection.refreshTokenEnc);
  const res = await refreshGoogleAccessToken(refreshToken);
  if (!res.ok) {
    // invalid_grant = revoked or expired consent: the company must reconnect.
    const kind = /invalid_grant|unauthorized|revoked|expired/i.test(res.message || "") || res.status === 400 || res.status === 401 ? "auth_error" : "unknown_error";
    return { ok: false, status: res.status, kind, message: res.message };
  }
  return res;
}

// ── Pure: Google's rows → the importer's rows ───────────────────────────────

/** Every result row of a searchStream (array of batches) or search ({ results }) body. */
export function resultRows(data) {
  if (Array.isArray(data)) return data.flatMap((batch) => (Array.isArray(batch?.results) ? batch.results : []));
  return Array.isArray(data?.results) ? data.results : [];
}

function numberOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * One campaign × day result → the row lib/googleAds/spendPlan.js plans, or
 * an error entry. REST JSON spells fields in camelCase and int64s as
 * STRINGS ("costMicros": "12340000"); both are read.
 *
 * Required: campaign id, the day, cost. Everything else is null when Google
 * did not send it — a campaign with no impressions field is not a campaign
 * with zero impressions. (Google does omit zero-valued metrics in REST JSON,
 * which is why clicks/impressions/conversions read 0 rather than null when
 * the row exists and the field doesn't: a row Google returned for a day is
 * a statement about that day, and an omitted metric on it is Google's way
 * of writing 0.)
 */
export function parseCampaignDayRow(raw, { currency }) {
  const campaign = raw?.campaign || {};
  const metrics = raw?.metrics || {};
  const segments = raw?.segments || {};
  const campaignId = campaign.id !== undefined && /^\d{1,20}$/.test(String(campaign.id)) ? String(campaign.id) : null;
  const date = DAY_RE.test(segments.date || "") ? segments.date : null;
  const micros = numberOrNull(metrics.costMicros ?? metrics.cost_micros ?? 0);
  const errors = [];
  if (!campaignId) errors.push("missing campaign.id");
  if (!date) errors.push("missing segments.date");
  if (micros === null || micros < 0) errors.push(`unreadable cost_micros "${metrics.costMicros}"`);
  if (errors.length) return { status: "error", errors };
  const conv = numberOrNull(metrics.conversions ?? 0);
  return {
    status: "ok",
    row: {
      externalKey: `${campaignId}:${date}`,
      campaignId,
      campaignName: typeof campaign.name === "string" ? campaign.name : campaignId,
      objective: typeof (campaign.advertisingChannelType ?? campaign.advertising_channel_type) === "string" ? (campaign.advertisingChannelType ?? campaign.advertising_channel_type) : null,
      date,
      amount: Math.round((micros / 1e6) * 100) / 100,
      clicks: Math.round(numberOrNull(metrics.clicks ?? 0) ?? 0),
      impressions: Math.round(numberOrNull(metrics.impressions ?? 0) ?? 0),
      conversions: conv === null ? null : Math.round(conv * 100) / 100,
      currency: currency || null,
    },
  };
}

/** A customer (or customer_client) result → { id, name, currency, manager, testAccount, status, level }. */
export function parseCustomerRow(raw, key = "customer") {
  const c = raw?.[key] || (key === "customerClient" ? raw?.customer_client : null) || {};
  const id = cleanCustomerId(c.id);
  if (!id) return null;
  return {
    id,
    name: typeof (c.descriptiveName ?? c.descriptive_name) === "string" && (c.descriptiveName ?? c.descriptive_name).trim() ? (c.descriptiveName ?? c.descriptive_name).trim() : null,
    currency: typeof (c.currencyCode ?? c.currency_code) === "string" ? (c.currencyCode ?? c.currency_code) : null,
    manager: Boolean(c.manager),
    testAccount: Boolean(c.testAccount ?? c.test_account),
    status: typeof c.status === "string" ? c.status : null,
    level: c.level !== undefined ? Number(c.level) : null,
  };
}

/**
 * Every ad account the signed-in Google user can import from — the ones it
 * reaches directly, and the client accounts under any manager it reaches —
 * as picker options `{ customerId, loginCustomerId, name, currency,
 * viaManager, testAccount }`. Bounded: 25 accessible accounts, the direct
 * clients of each manager. An account reachable directly is offered without
 * a login-customer-id; one reachable only through a manager carries it.
 */
export async function listAdAccountOptions({ accessToken, api = defaultGoogleAds }) {
  const accessible = await api.listAccessibleCustomers({ accessToken });
  if (!accessible.ok) return accessible;
  const ids = (Array.isArray(accessible.data?.resourceNames) ? accessible.data.resourceNames : [])
    .map((r) => cleanCustomerId(String(r).replace(/^customers\//, "")))
    .filter(Boolean)
    .slice(0, 25);
  const options = new Map();
  const failures = [];
  for (const id of ids) {
    const res = await api.search({ accessToken, customerId: id, loginCustomerId: id, query: CUSTOMER_QUERY });
    if (!res.ok) {
      // One unreadable account (cancelled, no permission) must not hide the
      // rest. A developer-token refusal, though, refuses every account the
      // same way — return it, so the card can say the real reason.
      if (res.kind === "developer_token" || res.kind === "auth_error" || res.kind === "api_version") return res;
      failures.push({ customerId: id, kind: res.kind, message: res.message });
      continue;
    }
    const me = parseCustomerRow(resultRows(res.data)[0]);
    if (!me) continue;
    if (!me.manager) {
      options.set(me.id, { customerId: me.id, loginCustomerId: null, name: me.name, currency: me.currency, viaManager: null, testAccount: me.testAccount });
      continue;
    }
    const clients = await api.search({ accessToken, customerId: me.id, loginCustomerId: me.id, query: CLIENTS_QUERY });
    if (!clients.ok) {
      failures.push({ customerId: me.id, kind: clients.kind, message: clients.message });
      continue;
    }
    for (const r of resultRows(clients.data)) {
      const c = parseCustomerRow(r, "customerClient");
      if (!c || c.manager || c.id === me.id || c.level !== 1) continue;
      if (c.status && c.status !== "ENABLED") continue;
      if (options.has(c.id)) continue; // direct access wins: no login-customer-id needed
      options.set(c.id, { customerId: c.id, loginCustomerId: me.id, name: c.name, currency: c.currency, viaManager: me.name || formatCustomerId(me.id), testAccount: c.testAccount });
    }
  }
  return { ok: true, options: [...options.values()], failures };
}

export { exchangeGoogleCode, revokeGoogleToken, decodeIdTokenEmail };

/** The object the sync and the routes take as `api`. Real by default; the check hands in a fake. */
export const defaultGoogleAds = Object.freeze({
  accessTokenFor,
  listAccessibleCustomers,
  search,
  searchStream,
});
