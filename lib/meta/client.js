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

// ── The messaging scopes, requested only once Meta approves them ───────────
//
// Page and Instagram messaging (app/app/messages) needs five more permissions
// than the ads import does. None of them is granted to this app yet: Meta will
// not review pages_messaging until it can SEE the feature working, and the
// feature cannot work without the permission — so the whole inbox is built,
// the webhook verifies real signatures, the send path is real, and this one
// constant stays out of the authorize URL until the review passes.
//
//   pages_messaging             — read and send Page conversations
//   pages_show_list             — list the Pages the person administers, so
//                                 they can pick one instead of typing an id
//   pages_read_engagement       — the Page's own name, for the channel label
//   instagram_basic             — resolve the Instagram business account
//                                 linked to the Page
//   instagram_manage_messages   — read and send Instagram business DMs
//
// DELIBERATELY not appended to META_OAUTH_SCOPE above: a company connecting
// Meta Ads today must keep being asked for ads_read alone. Widening the ads
// consent screen to five permissions nobody has been approved for would fail
// the OAuth dialog outright and break a connection flow that works.
export const META_MESSAGING_SCOPE = [
  "pages_messaging",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_messages",
].join(",");

/**
 * The one switch. Set META_MESSAGING_APPROVED=true once Meta has approved the
 * scopes above, and the authorize URL starts asking for them — that is the
 * whole change; every other part of the messaging feature is already written
 * against a real connection.
 *
 * Env rather than a constant so it can be flipped per environment (approved on
 * production, still off on a preview deployment) without a deploy of code.
 */
export function metaMessagingApproved() {
  return process.env.META_MESSAGING_APPROVED === "true";
}

// ── Lead ads: the permissions FieldQuo does NOT have yet ────────────────────
//
// `leads_retrieval` is what lets an app read a lead somebody submitted through
// Meta's built-in lead form ("Get a free painting estimate", tapped straight
// off the ad). It is NOT approved for this app: App Review has only ever been
// asked for `ads_read`. Everything under lib/meta/leadsImport.js,
// app/api/meta/leads/* and app/api/cron/meta-leads is built and executable,
// and none of it can receive a real lead until Meta grants these.
//
// What Meta documents as required to retrieve a lead
// (developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving,
// read 2026-09-08):
//
//   leads_retrieval        the permission itself
//   pages_show_list        needed to reach GET /me/accounts, which is the only
//                          way to obtain the PAGE access token the leadgen
//                          read requires — a user token alone is not enough
//   pages_read_engagement  Meta lists it alongside the two above
//   pages_manage_ads       Meta lists it alongside the two above
//   ads_management         listed for reading AD-LEVEL detail on the lead
//
// `ads_management` is deliberately absent from the list below. It is the
// heavier of the two App Review gates (docs/META-ADS-INTEGRATION.md Part 0)
// and it exists to CREATE and EDIT ads, which FieldQuo has scoped out
// entirely. Campaign attribution is resolved instead through the ad-account
// token this app already holds — see getAdAttribution() below, which reads
// the ad with `ads_read`. If that turns out to need ads_management after all,
// the lead still lands with no campaign on it: a missing attribution, not a
// missing lead.
//
// Two of these (pages_show_list, pages_read_engagement) are also in
// META_MESSAGING_SCOPE above. That overlap is real and harmless — Meta
// de-duplicates the scope string — and the two constants are kept separate
// rather than factored into a shared list because they are approved
// SEPARATELY, and a shared list would make one review's outcome silently
// change what the other feature asks for.
export const META_LEADS_SCOPE = [
  "leads_retrieval",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_ads",
].join(",");

/**
 * THE flag. One environment variable stands between this build and requesting
 * the lead permissions — set META_LEADS_ENABLED=1 the day Meta approves
 * `leads_retrieval`, and every company that connects (or reconnects) grants
 * them.
 *
 * Nothing else in the codebase decides this. Every screen, every route and
 * every job asks this one function, so there is no second place that can
 * disagree about whether leads are supposed to be flowing — which is the
 * difference between a feature that is honestly switched off and one that
 * looks live on one screen and dead on another.
 */
export function metaLeadsScopeEnabled() {
  const raw = String(process.env.META_LEADS_ENABLED || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * The scope string the OAuth dialog actually asks for: the base ads scope,
 * plus whichever pending reviews have been switched on.
 *
 * ── Why this exists rather than a second `if` in buildAuthorizeUrl ─────────
 *
 * Messaging and lead ads are two independent App Reviews landing at two
 * different times, and each was written as `params.set("scope", base + mine)`.
 * Two of those in sequence is not two features — the second one silently
 * DROPS the first, so the day both approvals land, turning on lead ads would
 * quietly stop asking for pages_messaging and break an inbox that worked
 * yesterday. Composing a list cannot do that.
 *
 * With both flags off this returns exactly META_OAUTH_SCOPE, byte for byte —
 * asserted in scripts/check-meta-leads.mjs rather than left as a claim.
 */
export function metaRequestedScope() {
  const parts = [META_OAUTH_SCOPE];
  if (metaMessagingApproved()) parts.push(META_MESSAGING_SCOPE);
  if (metaLeadsScopeEnabled()) parts.push(META_LEADS_SCOPE);
  // Meta tolerates a repeated permission, but a de-duplicated string is what
  // a reviewer reads off the consent screen, and pages_show_list appears in
  // both lists above.
  return [...new Set(parts.join(",").split(","))].join(",");
}

// ── Organic PUBLISHING to a Page and its Instagram account ─────────────────
//
// A fourth scope set, for the fourth Meta surface: posting a Marketing
// Designer asset to a contractor's own Facebook Page and Instagram account
// (lib/social/publishDesign.js). Kept separate from META_OAUTH_SCOPE,
// META_MESSAGING_SCOPE and META_LEADS_SCOPE for the reason already written
// above for those two — four features, four App Reviews, four independent
// outcomes, and a shared list would let one review's result silently change
// what another feature asks for.
//
// Each permission below is here because a specific Graph call this codebase
// already makes requires it. Read off Meta's own reference pages (8 Sep 2026):
//
//   pages_show_list            GET /me/accounts — the only documented way to
//                              obtain the PAGE access token every publish call
//                              below needs. A user token cannot post to a Page.
//   pages_manage_posts         POST /{page-id}/photos (metaGraphClient.js's
//                              publishFacebookPhoto) and POST /{page-id}/feed.
//                              This is the permission that publishes.
//   pages_read_engagement      Listed by Meta alongside pages_manage_posts on
//                              the Page publishing endpoints, and what reads
//                              the Page's own name for the settings panel.
//   instagram_basic            Resolves the Instagram professional account
//                              linked to the Page (GET /{page-id}?fields=
//                              instagram_business_account) and is required on
//                              every IG Content Publishing call.
//   instagram_content_publish  POST /{ig-user}/media and
//                              POST /{ig-user}/media_publish. This is the
//                              permission that publishes to Instagram.
//
// `business_management` is deliberately NOT here, and this is the one genuine
// uncertainty in the list. Meta documents it as additionally required when the
// person connecting was granted their Page role through a Business Manager
// rather than a classic Page role — which is common for a contractor whose
// agency set the Page up. It is not needed for the API calls themselves, only
// for reaching a Business-owned Page's token, and it materially widens App
// Review. The decision here is to submit without it and add it only if Meta's
// reviewer (or a real Business-owned Page in development mode) proves it
// necessary — a wrong guess in this direction costs a resubmission; a wrong
// guess in the other costs a rejected review for over-asking.
export const META_PAGES_SCOPE = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

/**
 * THE flag for Facebook/Instagram publishing. None of META_PAGES_SCOPE is
 * approved for this app yet, so the Pages connect flow must not be offered as
 * a working control to a contractor — Settings says it is waiting on Meta
 * instead (AGENTS.md: never ship a control that appears to work and doesn't).
 *
 * On when EITHER:
 *   META_PAGES_ENABLED=1   — the switch to flip the day App Review passes;
 *   META_APP_MODE=development — Meta's own app modes. In Development mode a
 *                            Page/IG permission works for the app's own
 *                            admins, developers and testers WITHOUT review,
 *                            which is precisely how this flow gets tested
 *                            before there is anything to submit.
 *
 * Deliberately not NODE_ENV: a Vercel preview deployment runs NODE_ENV
 * "production" and a local `next dev` runs "development", and neither fact has
 * anything to do with whether Meta will honour the permission.
 */
export function metaPagesConnectEnabled() {
  const raw = String(process.env.META_PAGES_ENABLED || "").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  return String(process.env.META_APP_MODE || "").trim().toLowerCase() === "development";
}

// ── WhatsApp Business: the fifth Meta surface, and the fifth App Review ─────
//
// A contractor's own WhatsApp Business number, answered from the same inbox as
// their Page and Instagram messages. Connected through Meta's EMBEDDED SIGNUP
// flow, which is a different dialog again from the three above: the business
// authenticates with Meta, picks or creates a WhatsApp Business Account and a
// phone number, and the flow hands back that WABA id, the phone number id, and
// an exchangeable code
// (developers.facebook.com/docs/whatsapp/embedded-signup, read 2026-09-08).
//
// Each permission below is here because a specific Graph call this codebase
// makes requires it, read off Meta's own page:
//
//   whatsapp_business_messaging  POST /<phone-number-id>/messages — the send
//                                itself — and receiving the `messages`
//                                webhook. THIS is the permission the whole
//                                feature waits on.
//   whatsapp_business_management GET /<waba-id>/message_templates (the
//                                approved-template list the composer offers
//                                once the 24-hour window has closed),
//                                POST /<waba-id>/subscribed_apps at connect
//                                time, and GET /<waba-id>/phone_numbers for
//                                the number's verified name.
//
// `business_management` is deliberately NOT here. Meta lists it for Solution
// Partners sharing a credit line — FieldQuo does not; each contractor's WABA
// is billed to that contractor — and it materially widens App Review. Same
// call, same reasoning and same acceptance of the risk as META_PAGES_SCOPE's
// note above: a wrong guess in this direction costs a resubmission, a wrong
// guess in the other costs a rejection for over-asking.
//
// DELIBERATELY not composed into metaRequestedScope(). That function builds
// the ADS consent screen, and WhatsApp is its own dialog with its own callback
// and its own stored channel — exactly as META_PAGES_SCOPE is. Adding it there
// would widen the consent screen a contractor sees when they connect Meta Ads
// to include two permissions nobody has been approved for, which fails the
// dialog outright and breaks a flow that works today.
export const META_WHATSAPP_SCOPE = [
  "whatsapp_business_messaging",
  "whatsapp_business_management",
].join(",");

/**
 * THE flag for WhatsApp. `whatsapp_business_messaging` is not approved for
 * this app, so the connect flow must not be offered as a working control —
 * Settings says what it is waiting on instead (AGENTS.md: never ship a control
 * that appears to work and doesn't).
 *
 * On when EITHER:
 *   META_WHATSAPP_ENABLED=1  — the switch to flip the day App Review passes;
 *   META_APP_MODE=development — Meta's own app modes. In Development mode the
 *                            WhatsApp permissions work for the app's own
 *                            admins, developers and testers WITHOUT review,
 *                            which is precisely how the screencast Meta's
 *                            reviewer asks for gets recorded: the feature has
 *                            to be demonstrably working before the permission
 *                            can be requested at all.
 *
 * Deliberately not NODE_ENV, for the reason metaPagesConnectEnabled() gives: a
 * Vercel preview runs NODE_ENV "production" and neither fact has anything to
 * do with whether Meta will honour the permission.
 */
export function metaWhatsAppEnabled() {
  const raw = String(process.env.META_WHATSAPP_ENABLED || "").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  return String(process.env.META_APP_MODE || "").trim().toLowerCase() === "development";
}

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
 *
 * `scope` overrides what the dialog asks for, and exists for exactly one
 * caller: app/api/settings/social/connect, whose OAuth round trip is a
 * DIFFERENT consent screen for a different feature (META_PAGES_SCOPE — posting
 * to a Page, not reading ad spend). Omitted everywhere else, so the ads
 * connect flow keeps asking metaRequestedScope() byte for byte and cannot be
 * widened by a feature it has nothing to do with.
 */
export function buildAuthorizeUrl({ redirectUri, state, scope }) {
  if (!redirectUri) throw new Error("buildAuthorizeUrl: redirectUri is required.");
  if (!state) throw new Error("buildAuthorizeUrl: state is required.");
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error("buildAuthorizeUrl: META_APP_ID is not configured.");
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    // Every pending App Review that has been switched on, composed in one
    // place. This was two sequential `params.set("scope", …)` calls — one for
    // messaging, one for lead ads — and the second overwrote the first, so
    // enabling the newer feature would have silently un-asked for the older
    // one's permissions. See metaRequestedScope().
    scope: scope || metaRequestedScope(),
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

// ═══════════════════════════════════════════════════════════════════════════
// LEAD ADS
// ═══════════════════════════════════════════════════════════════════════════
//
// Every function below needs META_LEADS_SCOPE, which this app does not hold
// (see the constant's own comment). They are written, exported and exercised
// by scripts/check-meta-leads.mjs against hand-built responses; not one of
// them can return a real lead until Meta approves the permission. Nothing
// here guesses at that — a caller that reaches these while
// metaLeadsScopeEnabled() is false will get Meta's own permission error back
// through classifyMetaError, which is the honest failure.

/**
 * The Pages this person administers, each WITH its page access token.
 *
 * This is the step a user token cannot skip. Meta's leadgen read wants a Page
 * token, and GET /me/accounts is the only documented way to obtain one — it
 * is why `pages_show_list` is in META_LEADS_SCOPE and not an optional extra.
 *
 * The tokens in this response are never stored BY THE LEADS IMPORT. It uses
 * them for the one read that needs them and drops them: a page token at rest
 * is a second credential to encrypt, rotate and leak, and the user token
 * FieldQuo already stores can mint a fresh one whenever it is needed.
 *
 * Page PUBLISHING is the deliberate exception and says so here rather than
 * leaving the sentence above reading as a rule it breaks: a scheduled post
 * fires from a cron hours or days after the contractor closed the browser, so
 * there is no user token in play to mint from at that moment. It stores the
 * page token encrypted (MetaPageConnection.pageAccessTokenEnc, through
 * lib/meta/pageConnection.js) for exactly that reason.
 */
export async function listPages({ accessToken }) {
  return graphFetch("/me/accounts", {
    accessToken,
    params: { fields: "id,name,access_token", limit: "100" },
  });
}

/**
 * The lead forms attached to one Page — what the settings panel lists so a
 * contractor can switch individual forms on.
 *
 * `status` is Meta's own ACTIVE/ARCHIVED/DRAFT for the form. It is carried
 * through untouched rather than filtered here: an archived form that has
 * already produced leads is still a form whose past leads matter, and
 * deciding what to show is the panel's job, not this function's.
 */
export async function listPageLeadForms({ pageAccessToken, pageId }) {
  return graphFetch(`/${pageId}/leadgen_forms`, {
    accessToken: pageAccessToken,
    params: { fields: "id,name,status,created_time", limit: "200" },
  });
}

// The fields read off a leadgen object. Kept as one constant because a field
// Meta does not recognise fails the WHOLE request rather than being ignored,
// so this list is the thing to change — and re-verify — on a Graph version
// bump, not a string buried in two call sites.
//
// Deliberately limited to what Meta documents on the leadgen node itself.
// campaign_id/adset_id are NOT on it; they are resolved separately by
// getAdAttribution() below, from the ad id, with the ads_read token.
const LEAD_FIELDS = "id,created_time,ad_id,form_id,platform,field_data";

/**
 * One lead, by the leadgen id the webhook delivered.
 *
 * The webhook payload carries an id and nothing else useful — no name, no
 * email, no answers — so this call is not an enrichment step that could be
 * skipped on a slow day. It IS the lead.
 */
export async function getLead({ pageAccessToken, leadgenId }) {
  return graphFetch(`/${leadgenId}`, {
    accessToken: pageAccessToken,
    params: { fields: LEAD_FIELDS },
  });
}

/**
 * A page of leads for one form, newest first, optionally only those created
 * after a moment — the polling fallback's read.
 *
 * `since` is a UNIX timestamp in SECONDS (Meta's `filtering` takes epoch
 * seconds, not an ISO string). Omitted entirely when there is no cursor, so
 * Meta applies its own default window rather than FieldQuo inventing one and
 * importing three years of archived submissions as fresh leads.
 */
export async function listFormLeads({ pageAccessToken, formId, sinceUnixSeconds, limit = 100 }) {
  const params = { fields: LEAD_FIELDS, limit: String(limit) };
  if (Number.isFinite(sinceUnixSeconds) && sinceUnixSeconds > 0) {
    params.filtering = JSON.stringify([
      { field: "time_created", operator: "GREATER_THAN", value: Math.floor(sinceUnixSeconds) },
    ]);
  }
  return graphFetch(`/${formId}/leads`, { accessToken: pageAccessToken, params });
}

/**
 * Which campaign an ad belongs to — the ONLY attribution level that can be
 * joined to money.
 *
 * MarketingSpend keys a Meta-synced row by `<campaignId>:<date>`
 * (lib/meta/insightsImport.js), so a lead carrying a campaign id can be
 * counted against a cost and a lead carrying an ad id cannot. This runs with
 * the AD ACCOUNT token — `ads_read`, which this app already holds — rather
 * than the page token, so campaign attribution does not depend on the
 * permission that is still pending.
 *
 * Best-effort by contract: every caller treats a failure as "campaign
 * unknown" and stores null, because a lead that arrives without its campaign
 * is still a lead the contractor has to ring.
 */
export async function getAdAttribution({ accessToken, adId }) {
  return graphFetch(`/${adId}`, {
    accessToken,
    params: { fields: "id,name,campaign{id,name}" },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE PUBLISHING (META_PAGES_SCOPE — not approved yet, see that constant)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The Instagram professional account linked to a Page, or null when there
 * isn't one.
 *
 * Asked for in ONE call rather than "get the id, then get the username":
 * Meta's field expansion returns both, and a second round trip would be a
 * second way to fail halfway and store an id with no name beside it.
 *
 * Returns the same `{ ok, data }` / `{ ok:false, kind }` shape as every other
 * function here. `data.instagram_business_account` ABSENT is the normal answer
 * for a Page nobody has linked an account to — the caller stores null and
 * Facebook-only publishing carries on (docs/SOCIAL-PUBLISHING.md, "what a
 * contractor must set up on Meta's side"), which is why this is not an error.
 *
 * Runs with the PAGE token, not the user token: the page token is what the
 * publish calls use, so resolving the IG account with it proves the token
 * FieldQuo is about to store can actually see the account it is about to
 * record.
 */
/**
 * What Meta actually GRANTED this user token, as opposed to what the dialog
 * asked for. GET /me/permissions needs no permission of its own.
 *
 * Worth a round trip because Meta's consent screen lets a person un-tick
 * individual permissions: a contractor who clears "Manage your Page's posts"
 * gets a connection that looks perfect and 403s the first time they publish.
 * Storing the granted list (MetaPageConnection.scopes) is what lets the
 * settings panel say which permission is missing instead of leaving them to
 * discover it mid-campaign.
 */
export async function listGrantedPermissions({ accessToken }) {
  return graphFetch("/me/permissions", { accessToken });
}

/**
 * The granted permission NAMES from that response, as a comma-joined string —
 * pure, so the parsing is testable without a network call. Anything Meta
 * marked "declined" is dropped: a declined permission in the stored list would
 * be worse than no list at all.
 */
export function grantedScopeString(permissionsBody) {
  const rows = Array.isArray(permissionsBody?.data) ? permissionsBody.data : [];
  const granted = rows
    .filter((r) => r && r.status === "granted" && typeof r.permission === "string")
    .map((r) => r.permission);
  return granted.length ? granted.join(",") : null;
}

export async function getPageInstagramAccount({ accessToken, pageId }) {
  return graphFetch(`/${pageId}`, {
    accessToken,
    params: { fields: "id,name,instagram_business_account{id,username}" },
  });
}
