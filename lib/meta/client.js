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
//   pages_manage_metadata       — POST/DELETE /<page-id>/subscribed_apps, the
//                                 call that points the Page's messages at our
//                                 webhook. Meta lists it (with pages_show_list)
//                                 as required on the subscribed_apps edge —
//                                 developers.facebook.com/docs/graph-api/
//                                 reference/page/subscribed_apps, read
//                                 2026-09-08. Without it a Page connects, a
//                                 token is stored, the send path works, and
//                                 not one inbound message is ever delivered:
//                                 the identical hole subscribeAppToWaba()
//                                 closes for WhatsApp, whose own comment says
//                                 "without this, no webhook ever fires".
//
// DELIBERATELY not appended to META_OAUTH_SCOPE above: a company connecting
// Meta Ads today must keep being asked for ads_read alone. Widening the ads
// consent screen to five permissions nobody has been approved for would fail
// the OAuth dialog outright and break a connection flow that works.
export const META_MESSAGING_SCOPE = [
  "pages_messaging",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
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
 * The scope the Pages consent screen actually asks for: publishing, plus
 * messaging once Meta has approved it.
 *
 * ── Why ONE dialog and not two ─────────────────────────────────────────────
 *
 * A contractor thinks "I connected my Facebook Page". They do not think "I
 * connected it for posting, and separately for messages" — and two Connect
 * buttons for the same Page would make them learn which of two places holds
 * which half of Meta, which is the same reason SocialPublishingPanel.js's own
 * header gives for sitting beside the ads panel rather than in its own sidebar
 * row. So the Page connect asks for the union, and the ONE connection it
 * stores is what creates both the publishing connection and the inbox's
 * MessagingChannel rows.
 *
 * Composed the way metaRequestedScope() composes the ads flags, and for the
 * same reason spelled out there: `params.set("scope", base + mine)` written
 * twice silently drops the first, so a third feature landing later must not be
 * a hand-concatenated list. With messaging off this returns exactly
 * META_PAGES_SCOPE, byte for byte — asserted in
 * scripts/check-meta-pages-connect.mjs rather than left as a claim.
 *
 * Deliberately separate from metaRequestedScope(): that one builds the ADS
 * consent screen, whose scope must stay ads_read (plus its own pending
 * reviews) — widening it with five Page permissions would fail a dialog that
 * works today.
 */
export function metaPagesRequestedScope() {
  const parts = [META_PAGES_SCOPE];
  if (metaMessagingApproved()) parts.push(META_MESSAGING_SCOPE);
  // pages_show_list, pages_read_engagement and instagram_basic are in BOTH
  // lists; a reviewer reads the consent screen, and a repeated permission
  // there reads as carelessness even though Meta tolerates it.
  return [...new Set(parts.join(",").split(","))].join(",");
}

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
export function buildAuthorizeUrl({ redirectUri, state, scope, configId = null, rerequest = false }) {
  if (!redirectUri) throw new Error("buildAuthorizeUrl: redirectUri is required.");
  if (!state) throw new Error("buildAuthorizeUrl: state is required.");
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error("buildAuthorizeUrl: META_APP_ID is not configured.");
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
  });
  if (rerequest) {
    // ── Make Facebook ask again ──────────────────────────────────────────
    //
    // The Pages connect worked on the night of 2026-09-10 and never again
    // after FieldQuo's permissions were revoked and re-granted: Facebook kept
    // an EMPTY Page selection for the app and every later dialog inherited
    // it without showing the Page picker. `auth_type=rerequest` is Meta's
    // documented way to re-ask for declined grants; with a previously empty
    // asset selection it is what brings the "Which Pages?" step back. Sent
    // on the Pages flow only; harmless when there is nothing to re-ask.
    params.set("auth_type", "rerequest");
  }
  if (configId) {
    // ── Facebook Login for Business: a CONFIGURATION, not a scope ──────────
    //
    // Meta's own words for Business-type apps: "config_id has replaced scope
    // (which should not be used)". The Pages connect ran on `scope` alone,
    // and the owner — an admin of five Pages — got "That Facebook login
    // doesn't administer any Page" on every attempt: the dialog completed,
    // the token verified, /me/accounts answered an empty list. A
    // configuration (login variation "User access token", assets Pages +
    // Instagram, the Page permissions) is what makes the dialog show the
    // Page picker and mint a token that actually carries the Pages chosen.
    //
    // The two are mutually exclusive on the dialog, so `scope` is not sent
    // when a configuration is. `override_default_response_type` is what
    // makes Business Login honour response_type=code instead of its own
    // default. See docs/META-DASHBOARD-CURRENT.md, "Configurations".
    params.set("config_id", String(configId));
    params.set("override_default_response_type", "true");
  } else {
    // Every pending App Review that has been switched on, composed in one
    // place. This was two sequential `params.set("scope", …)` calls — one for
    // messaging, one for lead ads — and the second overwrote the first, so
    // enabling the newer feature would have silently un-asked for the older
    // one's permissions. See metaRequestedScope().
    params.set("scope", scope || metaRequestedScope());
  }
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

/** The Pages/Instagram login configuration id, when the owner has made one. */
export function metaPagesConfigId() {
  const v = process.env.META_PAGES_CONFIG_ID;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * What Meta says a user token actually carries — including the GRANULAR
 * grants: for `pages_show_list`, the ids of the Pages the person ticked in
 * the dialog. Asked with the app token (app id|secret), which is the only
 * caller /debug_token accepts for another token.
 *
 * This is how an empty /me/accounts is told apart: a login that ticked no
 * Page is a different fix ("connect again and choose your Pages") from a
 * login with no Page role at all ("create a Page first"), and the screen
 * used to say the second for both.
 */
export async function debugUserToken({ accessToken }) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { ok: false, kind: "not_configured" };
  return graphFetch("/debug_token", {
    accessToken: `${appId}|${appSecret}`,
    params: { input_token: accessToken },
  });
}

/**
 * Why /me/accounts came back empty, from a debug_token answer. Pure.
 *
 *   no_pages_selected  — pages_show_list was granted but with no Page ids:
 *                        the person went through the dialog and chose none
 *   pages_scope_missing — pages_show_list is not on the token at all: the
 *                        dialog never asked for it (a scope-only login on a
 *                        Business app, or a configuration without Pages)
 *   no_pages           — granted, Pages were ticked, and still none listed:
 *                        the account has no role on those Pages any more
 */
export function classifyEmptyPageList(debugData) {
  const data = debugData && typeof debugData === "object" ? debugData.data || debugData : null;
  const scopes = Array.isArray(data?.scopes) ? data.scopes : [];
  const granular = Array.isArray(data?.granular_scopes) ? data.granular_scopes : [];
  if (!scopes.includes("pages_show_list")) return "pages_scope_missing";
  const pages = granular.find((g) => g && g.scope === "pages_show_list");
  const ids = Array.isArray(pages?.target_ids) ? pages.target_ids : [];
  if (ids.length === 0) return "no_pages_selected";
  return "no_pages";
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
  // DELETE carries its parameters in the QUERY STRING, not a body. Graph
  // ignores a form body on a DELETE — including the access_token in it — and
  // answers 400 "An access token is required", which reads exactly like a
  // missing credential rather than the wrong request shape it actually is.
  const inQueryString = method === "GET" || method === "DELETE";
  if (inQueryString) {
    url.search = search.toString();
  }
  const res = await fetch(url, {
    method,
    ...(!inQueryString && {
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

// ── Every insights field the sync asks Meta for ─────────────────────────────
//
// One list, exported, because Meta rejects the WHOLE request for a single
// field name it does not recognise — the failure is not "that column comes
// back empty", it is "no row comes back at all", surfaced through
// classifyMetaError as `unknown_error` and written to
// MetaAdConnection.lastSyncError by the sync route. So this is the list to
// re-verify on a GRAPH_API_VERSION bump, and scripts/check-meta-insights.mjs
// asserts every name here against the documented AdsInsights field set
// rather than trusting the spelling.
//
// Each name is verbatim from Meta's own AdsInsights field enum
// (facebook-nodejs-business-sdk src/objects/ads-insights.js, generated from
// the API spec; read 2026-09-11). The two names the brief for this change
// guessed at and which do NOT exist — `video_thru_play_actions`,
// `link_clicks` — are deliberately absent; the real names are
// `video_thruplay_watched_actions` and `inline_link_clicks`.
//
// Every field below LANDS in a MarketingSpend column (lib/meta/insightsImport.js
// says where). Nothing is requested that nothing stores: `cost_per_action_type`
// and the per-threshold video fields are real, but every rate this product
// shows is computed at read time from the stored counts (the schema's own
// comment on these columns), and a second, Meta-computed rate with its own
// attribution window would be a number that can disagree with ours on the same
// screen. AGENTS.md failure class 1, in the request rather than the schema.
export const CAMPAIGN_INSIGHT_FIELDS = Object.freeze([
  "campaign_id", // → externalId (`<campaignId>:<date>`) and MarketingSpend.campaignId
  "campaign_name", // → campaignName
  "objective", // → objective, Meta's OUTCOME_* value verbatim
  "spend", // → amount
  "impressions", // → impressions
  "reach", // → reach
  "clicks", // → clicks (every click, including on the Page name)
  "inline_link_clicks", // → linkClicks (clicks that left for the destination)
  // → conversions (lead-shaped types), messagingConversations, videoViews,
  //   postEngagements, and the whole array into actionsRaw
  "actions",
]);

/**
 * Daily, per-campaign insights for a date range — spend and everything Meta
 * reports beside it (CAMPAIGN_INSIGHT_FIELDS above).
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
      fields: CAMPAIGN_INSIGHT_FIELDS.join(","),
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
 * The Page ids a token was GRANTED for `pages_show_list`, from debug_token.
 * Pure over the debug answer.
 */
export function grantedPageIds(debugData) {
  const data = debugData && typeof debugData === "object" ? debugData.data || debugData : null;
  const granular = Array.isArray(data?.granular_scopes) ? data.granular_scopes : [];
  const entry = granular.find((g) => g && g.scope === "pages_show_list");
  const ids = Array.isArray(entry?.target_ids) ? entry.target_ids : [];
  return ids.map((id) => String(id)).filter((id) => /^\d+$/.test(id));
}

/**
 * Read Pages one by one, by the ids the grant named.
 *
 * ══ Why /me/accounts is not enough ════════════════════════════════════════
 *
 * Measured on 2026-09-12 from the owner's own attempt (/platform/errors,
 * pages_empty_no_pages): a USER token for this app, the login on the
 * configuration, `pages_show_list` granted with ONE Page, every Page
 * permission granted for it — and `/me/accounts` answered `{ data: [] }`.
 * A Page held through a business portfolio (task access on the new Pages
 * experience) is manageable by the person and grantable to the app, yet the
 * "list my Pages" edge does not list it. The grant itself names the Page,
 * and `GET /{page-id}?fields=id,name,access_token` with the user token
 * returns it, Page token included. So when the list is empty the ids from
 * the grant are read directly; the list stays the first choice because it
 * needs one request for any number of Pages.
 */
export async function fetchPagesByIds({ accessToken, pageIds = [] }) {
  const pages = [];
  for (const id of pageIds.slice(0, 25)) {
    const res = await graphFetch(`/${encodeURIComponent(id)}`, {
      accessToken,
      params: { fields: "id,name,access_token" },
    });
    if (res.ok && res.data?.id) pages.push(res.data);
  }
  return pages;
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

// ── The subscription, and the exact fields it asks for ─────────────────────
//
// Every field here is one lib/messaging/envelope.js PARSES. That is the whole
// selection rule, and it is deliberately narrower than "everything messaging-
// shaped Meta offers":
//
//   messages            item.message from a homeowner -> direction "in"
//   message_echoes      item.message the Page sent (from Meta's own inbox or
//                       from FieldQuo) -> direction "out". The parser has a
//                       named branch for it (`fromPage`), the monthly review
//                       cannot compute a response time without it, and the
//                       check script executes an echo — so it is read, and it
//                       has to be subscribed.
//   message_deliveries  item.delivery -> the delivery receipt
//   message_reads       item.read -> the read receipt
//
// `messaging_postbacks` is DELIBERATELY absent, and it is the one the brief
// for this change named. The parser's final branch counts a postback as
// `dropped` alongside opt-ins, reactions and referrals — "Real Meta events
// this build does nothing with". Subscribing to a field nothing reads is
// AGENTS.md failure class 1 pointed at a webhook: traffic that costs a
// signature verification, a parse and a log line, and produces no row. It
// goes in the day a branch reads it, not before.
//
// Meta rejects the WHOLE request for one unrecognised field rather than
// ignoring it, so this is the list to re-verify on a GRAPH_API_VERSION bump.
export const PAGE_MESSAGING_WEBHOOK_FIELDS = Object.freeze([
  "messages",
  "message_echoes",
  "message_deliveries",
  "message_reads",
]);

/**
 * Point a Page's messages at FieldQuo's webhook.
 *
 * ══ Why this exists, and what breaks without it ════════════════════════════
 *
 * Nothing. Visibly nothing, which is the problem. A Page connects, the token
 * is stored, /me/accounts answers, the Send API works — and Meta delivers no
 * inbound message to app/api/meta/messaging/webhook, because an app is only
 * sent a Page's events once it has been subscribed to that Page. The webhook
 * verifies signatures, de-duplicates retries and resolves tenants correctly,
 * and would have sat there empty forever.
 *
 * This is the same call, and the same failure mode, as
 * lib/meta/whatsappConnect.js's subscribeAppToWaba() — whose comment says
 * "without this, no webhook ever fires". Not shared with it because they are
 * different edges on different nodes with different tokens and different
 * required permissions; what IS shared is the discipline, and the fact that
 * both are the call whose failure must not be swallowed.
 *
 * ══ The PAGE token, never the user token ═══════════════════════════════════
 *
 * Meta requires "a Page access token requested by a person who can perform
 * CREATE_CONTENT, MANAGE, or MODERATE task on the Page" plus
 * pages_manage_metadata and pages_show_list
 * (developers.facebook.com/docs/graph-api/reference/page/subscribed_apps,
 * read 2026-09-08). A USER token on this edge is refused, and the parameter is
 * named pageAccessToken rather than accessToken so a call site cannot pass the
 * wrong one without it reading wrong.
 *
 * ══ Instagram ══════════════════════════════════════════════════════════════
 *
 * This one call covers Instagram DMs too. Meta's Instagram webhooks page
 * documents the subscription as `POST /me/subscribed_apps` where "/me
 * represents your app user's Instagram professional account ID or the Facebook
 * Page ID that is linked to your app user's Instagram professional account"
 * (developers.facebook.com/docs/instagram-platform/webhooks, read 2026-09-08).
 * The notifications then arrive under `"object": "instagram"`, which
 * lib/messaging/envelope.js's OBJECT_TO_PLATFORM already maps. So there is no
 * second per-tenant call to make: an Instagram account linked to a subscribed
 * Page is subscribed. What IS separate is a one-time app-level step in Meta's
 * App Dashboard — the `instagram` webhook object's own field list — which is
 * FieldQuo's configuration, not a contractor's, and cannot be done from here.
 */
export async function subscribePageToMessaging({ pageAccessToken, pageId }) {
  return graphFetch(`/${pageId}/subscribed_apps`, {
    accessToken: pageAccessToken,
    method: "POST",
    params: { subscribed_fields: PAGE_MESSAGING_WEBHOOK_FIELDS.join(",") },
  });
}

// ── The Conversations API: what the webhook cannot deliver ─────────────────
//
// A webhook delivers what happens AFTER the subscription. Every conversation
// the Page already had — last month's enquiries, the one the contractor was
// halfway through answering on their phone — never arrives, so a freshly
// connected inbox is empty until a stranger writes, and reads as "nobody has
// ever messaged this Page". The owner asked exactly that on the live screen.
//
// GET /<page-id>/conversations is the pull that fills the gap. One edge, two
// platforms, told apart by `platform=messenger|instagram` and BOTH read with
// the PAGE token — the linked Instagram account has no token of its own (the
// same fact lib/messaging/pageChannels.js records for the send path). It is a
// read; it needs pages_messaging (plus instagram_manage_messages for the
// Instagram half), which are the inbox permissions and nothing wider.
//
// The fields are exactly what lib/messaging/pageImport.js maps onto the
// webhook's own event shape, and no more: `messages` nested so one round trip
// per page of conversations brings the text, and `attachments` so a photo a
// homeowner sent last week lands in the same re-host queue as one sent
// tomorrow. Meta refuses the WHOLE request for one unrecognised field, so this
// is the list to re-verify on a GRAPH_API_VERSION bump.
export const CONVERSATION_MESSAGE_FIELDS = "id,from,to,message,created_time,attachments";
export const CONVERSATION_MESSAGES_LIMIT = 50;
/** The field list with `n` nested messages per conversation. */
export function conversationFields(messagesLimit = CONVERSATION_MESSAGES_LIMIT) {
  const n = Number.isInteger(messagesLimit) && messagesLimit > 0 ? messagesLimit : CONVERSATION_MESSAGES_LIMIT;
  return `id,participants,updated_time,messages.limit(${n}){${CONVERSATION_MESSAGE_FIELDS}}`;
}
export const CONVERSATION_FIELDS = conversationFields();

/**
 * Meta's "Please reduce the amount of data you're asking for, then retry
 * your request" — error code 1, HTTP 500, and NOT a rate limit or a token
 * problem: the response for this page would be too large. Seen on the
 * owner's own Instagram inbox on the first real run (Facebook's 84
 * conversations came through the same call). The caller asks for a smaller
 * page and fewer nested messages and tries again; see pageImport.js.
 */
export function isTooMuchDataError(result) {
  if (!result || result.ok) return false;
  return /reduce the amount of data/i.test(String(result.message || ""));
}

/** Meta's spelling of the two platforms on this edge, by our platform name. */
export const CONVERSATION_PLATFORM_PARAM = Object.freeze({
  facebook: "messenger",
  instagram: "instagram",
});

/**
 * One page of a Page's conversations, newest-updated first, with each
 * conversation's most recent 50 messages nested.
 *
 * `after` is Meta's own cursor from the previous page (`nextConversationCursor`
 * below reads it out) — the same cursor style listFormLeads' callers walk.
 *
 * @param platform  OUR platform name ("facebook" | "instagram"); refused
 *                  rather than passed through when it is neither, because a
 *                  bad `platform` value makes Meta answer 400 in a shape that
 *                  reads like a permission problem.
 */
export async function listPageConversations({
  pageAccessToken,
  pageId,
  platform,
  after,
  limit = 25,
  messagesLimit = CONVERSATION_MESSAGES_LIMIT,
}) {
  const platformParam = CONVERSATION_PLATFORM_PARAM[platform];
  if (!platformParam) {
    return { ok: false, kind: "unknown_error", message: `listPageConversations: unsupported platform ${String(platform)}` };
  }
  const params = { platform: platformParam, fields: conversationFields(messagesLimit), limit: String(limit) };
  if (after) params.after = after;
  return graphFetch(`/${pageId}/conversations`, { accessToken: pageAccessToken, params });
}

/**
 * The cursor for the next page of conversations, or null on the last page.
 * Pure. Meta sends `paging.next` (a full URL) as well; the cursor is used
 * rather than the URL so the request keeps going through graphFetch and the
 * version constant above, not a URL Meta minted.
 */
export function nextConversationCursor(body) {
  const after = body?.paging?.cursors?.after;
  return typeof after === "string" && after && body?.paging?.next ? after : null;
}

/**
 * Stop Meta sending this Page's messages here.
 *
 * A disconnect that leaves the subscription standing is a contractor's
 * customers still arriving at FieldQuo after they revoked our access — worse
 * than the missing subscribe, because it is data we were told to stop
 * receiving. Best effort in the sense that it must not block the token being
 * destroyed, but attempted, and its failure recorded rather than swallowed:
 * see app/api/settings/social/disconnect.
 */
export async function unsubscribePageFromMessaging({ pageAccessToken, pageId }) {
  return graphFetch(`/${pageId}/subscribed_apps`, {
    accessToken: pageAccessToken,
    method: "DELETE",
  });
}
