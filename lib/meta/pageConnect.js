// lib/meta/pageConnect.js
//
// The two Graph reads that finish a Page connection, shared by the two routes
// that can finish one: app/api/settings/social/callback (a single Page, no
// chooser) and app/api/settings/social/finalize (the contractor picked one).
//
// They live here rather than being written twice because a Next.js route file
// may only export HTTP handlers — and because the copy is the one that rots
// (AGENTS.md failure class 4). Both are best-effort by contract, and both say
// below what "best effort" costs when it fails.
import {
  getPageInstagramAccount,
  listGrantedPermissions,
  grantedScopeString,
  subscribePageToMessaging,
  unsubscribePageFromMessaging,
  PAGE_MESSAGING_WEBHOOK_FIELDS,
  PAGE_LEADGEN_WEBHOOK_FIELD,
  META_LEADS_SCOPE,
} from "./client";

/**
 * The Instagram professional account linked to a Page, or two nulls.
 *
 * Failing here is NOT failing the connect: a Page whose Instagram lookup
 * errors still publishes to Facebook, and refusing the whole connection over
 * it would trade a working half for nothing. The contractor sees "no Instagram
 * account linked to this Page" either way — the same honest end state, reached
 * two ways, and reconnecting re-runs this read.
 *
 * Runs with the PAGE token, so a success here also proves the token about to
 * be stored can see the account about to be recorded beside it.
 */
export async function resolveInstagram({ pageToken, pageId }) {
  const res = await getPageInstagramAccount({ accessToken: pageToken, pageId }).catch(() => null);
  const ig = res?.ok ? res.data?.instagram_business_account : null;
  return { id: ig?.id || null, username: ig?.username || null };
}

/**
 * What Meta GRANTED, or null.
 *
 * Null when the read fails — never the list FieldQuo asked for. The whole
 * value of MetaPageConnection.scopes is that it records Meta's answer;
 * substituting our own question for it would let the settings panel
 * confidently report a permission the contractor un-ticked on the consent
 * screen, which is the failure this column exists to catch.
 */
export async function resolveGrantedScopes(userToken) {
  const res = await listGrantedPermissions({ accessToken: userToken }).catch(() => null);
  return res?.ok ? grantedScopeString(res.data) : null;
}

// ── The subscription that decides whether a message can ever arrive ────────
//
// Two permissions, and both are load-bearing for different halves of the same
// outcome:
//
//   pages_manage_metadata  Meta requires it on the /<page-id>/subscribed_apps
//                          edge itself. Without it the POST is refused.
//   pages_messaging        without it the subscription can SUCCEED and Meta
//                          still delivers no message event — a row saying
//                          "subscribed" over an inbox that stays empty, which
//                          is worse than not subscribing at all because it
//                          reads as working.
//
// Both live in lib/meta/client.js's META_MESSAGING_SCOPE and neither is on the
// PUBLISHING consent screen (META_PAGES_SCOPE), so on every deployment today
// this list is not satisfied and the subscribe is NOT ATTEMPTED. That is the
// third state the schema describes, and it is why "we never tried" is stored
// as two nulls rather than as a failure: telling a contractor Meta refused us
// when nobody asked Meta anything sends them to retry a button that cannot
// work.
export const WEBHOOK_SUBSCRIBE_PERMISSIONS = Object.freeze([
  "pages_manage_metadata",
  "pages_messaging",
]);

/**
 * The granted permission names as a Set. One parser for every question asked
 * of Meta's answer below — a second copy of this three-line split is exactly
 * the copy that would keep trimming while the other stopped (AGENTS.md failure
 * class 4).
 */
function grantedPermissionSet(grantedScopes) {
  return new Set(
    String(grantedScopes || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Which of the two Meta did NOT grant, read off the GRANTED string rather than
 * the one FieldQuo asked for — same rule, same reason, as resolveGrantedScopes
 * above.
 *
 * `null` in (the permission read failed) returns the full list: not knowing
 * what was granted is not permission to assume it was. Pure, so the check
 * script can execute it against every hostile input.
 */
export function missingWebhookPermissions(grantedScopes) {
  const have = grantedPermissionSet(grantedScopes);
  return WEBHOOK_SUBSCRIBE_PERMISSIONS.filter((p) => !have.has(p));
}

// ── Which INBOXES this grant can honestly produce ──────────────────────────
//
// A MessagingChannel row is what lib/messaging/ingest.js resolves an inbound
// webhook against, and what app/app/messages presents as a working inbox with
// a live composer. Writing one for a Page whose messaging permission was never
// granted is the dead control AGENTS.md's first rule forbids, in its worst
// shape: a homeowner's question that Meta never delivers, sitting behind a
// screen that says the Page is connected.
//
// So the two lists below are read off Meta's GRANTED string, per platform,
// and they are different lists on purpose:
//
//   facebook   pages_messaging — the permission that both receives a Page
//                                conversation and lets POST /<page-id>/messages
//                                answer it.
//   instagram  pages_messaging AND instagram_manage_messages. The subscription
//                                is one call on the Page (see
//                                subscribePageToMessaging), so an Instagram
//                                account linked to a subscribed Page already
//                                DELIVERS — but replying on it is
//                                POST /me/messages with the Page token (see
//                                lib/messaging/metaSend.js's sendPath), which Meta gates
//                                behind instagram_manage_messages. A contractor
//                                who un-ticked that one on the consent screen
//                                would get an Instagram inbox whose composer
//                                looks live and 403s on Send.
export const FACEBOOK_INBOX_PERMISSIONS = Object.freeze(["pages_messaging"]);
export const INSTAGRAM_INBOX_PERMISSIONS = Object.freeze([
  "pages_messaging",
  "instagram_manage_messages",
]);

/**
 * @param {string|null} grantedScopes  Meta's own granted list
 * @returns {{ facebook: boolean, instagram: boolean }}
 *
 * Pure. `null` in — the permission read failed — answers false to both, for
 * the same reason missingWebhookPermissions returns the full list: not knowing
 * what was granted is not permission to assume it was.
 */
export function inboxPlatformsGranted(grantedScopes) {
  const have = grantedPermissionSet(grantedScopes);
  return {
    facebook: FACEBOOK_INBOX_PERMISSIONS.every((p) => have.has(p)),
    instagram: INSTAGRAM_INBOX_PERMISSIONS.every((p) => have.has(p)),
  };
}

/**
 * The Page webhook fields to ask Meta for, off what Meta GRANTED.
 *
 * The four messaging fields always (subscribePageWebhook is not reached
 * without the messaging grant), plus `leadgen` when `leads_retrieval` was
 * granted — see PAGE_LEADGEN_WEBHOOK_FIELD for why it is on this call at all.
 * Pure, so the check script executes every grant shape.
 */
export function pageWebhookFields(grantedScopes) {
  const have = grantedPermissionSet(grantedScopes);
  return have.has("leads_retrieval")
    ? [...PAGE_MESSAGING_WEBHOOK_FIELDS, PAGE_LEADGEN_WEBHOOK_FIELD]
    : [...PAGE_MESSAGING_WEBHOOK_FIELDS];
}

// ── Which feature is missing which permission ──────────────────────────────
//
// The settings panel already names what PUBLISHING lacks (the status route's
// missingScopes) and what the SUBSCRIBE lacks. What it could not say is
// "Instagram messages will never arrive because instagram_manage_messages was
// not granted" or "lead forms cannot be read because leads_retrieval was not
// granted" — and since 2026-09-12 the Pages connect runs on a Facebook Login
// for Business CONFIGURATION (META_PAGES_CONFIG_ID), so what is granted is
// whatever that configuration lists, not what META_MESSAGING_SCOPE or
// META_LEADS_SCOPE ask for. A permission missing from the configuration is
// missing from every company's token, silently. This is the list the panel
// prints, one line per feature, so it is visible the day it happens.
//
// Each list is the permissions a call FieldQuo actually makes needs:
//
//   facebookMessages   FACEBOOK_INBOX_PERMISSIONS + the subscribe's own two
//   instagramMessages  INSTAGRAM_INBOX_PERMISSIONS + the subscribe's two +
//                      instagram_basic (resolving the linked account)
//   leadForms          META_LEADS_SCOPE + pages_manage_metadata (the leadgen
//                      field rides on the same subscribed_apps call).
//                      ads_management is NOT here: Meta's lead-ads pages list
//                      it, FieldQuo deliberately does not request it (see
//                      META_LEADS_SCOPE), and naming a permission we never
//                      ask for as "missing" would send a contractor to a
//                      reconnect that cannot supply it.
//
// A feature this deployment has switched off is not listed at all: "missing a
// permission" for a feature nobody can use is noise.
export const FEATURE_PERMISSIONS = Object.freeze({
  facebookMessages: Object.freeze([
    ...new Set([...FACEBOOK_INBOX_PERMISSIONS, ...WEBHOOK_SUBSCRIBE_PERMISSIONS]),
  ]),
  instagramMessages: Object.freeze([
    ...new Set([...INSTAGRAM_INBOX_PERMISSIONS, ...WEBHOOK_SUBSCRIBE_PERMISSIONS, "instagram_basic"]),
  ]),
  leadForms: Object.freeze([
    ...new Set([...META_LEADS_SCOPE.split(","), "pages_manage_metadata"]),
  ]),
});

/**
 * @param {string|null} grantedScopes  Meta's own granted list
 * @param {{ messaging: boolean, leads: boolean }} enabled  which features this
 *        deployment has switched on (metaMessagingApproved / metaLeadsScopeEnabled)
 * @returns {Array<{ feature: string, missing: string[] }>|null}
 *
 * Null when the granted list could not be read — "we don't know" is not
 * "nothing is missing" (AGENTS.md failure class 5), and the panel prints
 * nothing rather than a confident all-clear. Pure.
 */
export function missingFeaturePermissions(grantedScopes, enabled = {}) {
  if (!grantedScopes) return null;
  const have = grantedPermissionSet(grantedScopes);
  const wanted = [];
  if (enabled.messaging) wanted.push("facebookMessages", "instagramMessages");
  if (enabled.leads) wanted.push("leadForms");
  return wanted
    .map((feature) => ({ feature, missing: FEATURE_PERMISSIONS[feature].filter((p) => !have.has(p)) }))
    .filter((row) => row.missing.length > 0);
}

/**
 * Subscribe this Page to FieldQuo's messaging webhook, and report exactly what
 * happened in the shape MetaPageConnection stores.
 *
 * @returns {Promise<{ webhookSubscribedAt: Date|null, webhookSubscribeError: string|null }>}
 *
 *   { at: Date,  error: null }   subscribed — messages will be delivered
 *   { at: null,  error: string } attempted and refused — the panel says so and
 *                                offers a retry
 *   { at: null,  error: null }   not attempted, because the permissions the
 *                                call needs were not granted
 *
 * Runs with the PAGE token, which is what the edge requires — a user token is
 * refused there. Never throws: a connect that reaches here has a working token
 * and a Page worth storing, and turning a Meta hiccup into a lost connection
 * would trade a fixable state for none at all. The state IS stored, which is
 * the difference between best-effort and silently skipped.
 */
export async function subscribePageWebhook({ pageToken, pageId, grantedScopes }) {
  const missing = missingWebhookPermissions(grantedScopes);
  if (missing.length) {
    return { webhookSubscribedAt: null, webhookSubscribeError: null };
  }

  const call = (fields) =>
    subscribePageToMessaging({ pageAccessToken: pageToken, pageId, fields }).catch((err) => ({
      ok: false,
      kind: "network",
      message: err?.message || "Could not reach Meta.",
    }));

  const fields = pageWebhookFields(grantedScopes);
  let res = await call(fields);

  // ── Lead forms must never cost the inbox ─────────────────────────────────
  //
  // Meta refuses the WHOLE request over one field it will not grant, and
  // `leadgen` carries requirements the messaging fields do not (a token from
  // someone with the Page's ADVERTISE task; Meta's lead-ads pages also list
  // ads_management, which FieldQuo deliberately does not request — see
  // META_LEADS_SCOPE in lib/meta/client.js). So a refusal of the combined
  // list is retried once WITHOUT it, and the stored outcome is the
  // messaging one — the only one MetaPageConnection records and the settings
  // panel reads. The lead half is logged, by name, rather than folded into
  // webhookSubscribeError, where it would tell a contractor their MESSAGES
  // are not arriving when they are. A network failure is not retried here:
  // it says nothing about the field list, and the panel's retry covers it.
  if (!res?.ok && res?.kind !== "network" && fields.includes(PAGE_LEADGEN_WEBHOOK_FIELD)) {
    console.warn(
      `[meta-page-subscribe] page=${pageId} leadgen refused (${res?.kind || "unknown_error"}: ${String(res?.message || "").slice(0, 200)}); subscribing messaging fields alone`,
    );
    res = await call(PAGE_MESSAGING_WEBHOOK_FIELDS);
  }

  if (!res?.ok) {
    return {
      webhookSubscribedAt: null,
      webhookSubscribeError: `${res?.kind || "unknown_error"}: ${res?.message || "Meta refused the webhook subscription."}`.slice(0, 500),
    };
  }

  // Meta answers `{ success: true }`. A 200 carrying success:false is a refusal
  // dressed as an OK, and treating it as a subscription is the whole failure
  // this function exists to prevent.
  if (res.data && res.data.success === false) {
    return {
      webhookSubscribedAt: null,
      webhookSubscribeError: "unknown_error: Meta answered the subscription without confirming it.",
    };
  }

  return { webhookSubscribedAt: new Date(), webhookSubscribeError: null };
}

/**
 * The mirror, run at disconnect.
 *
 * @returns {Promise<{ ok: boolean, skipped: boolean, error: string|null }>}
 *
 * `skipped` is a real answer and not a success: nothing was ever subscribed,
 * so there is nothing to remove and no failure to report. Distinguished from
 * ok:true so the disconnect route can stay quiet in the ordinary case and
 * WARN in the one that matters — a subscription we could not remove means
 * Meta keeps posting a contractor's customer messages to us after they revoked
 * our access.
 */
export async function unsubscribePageWebhook({ pageToken, pageId, wasSubscribed }) {
  if (!wasSubscribed) return { ok: false, skipped: true, error: null };
  if (!pageToken || !pageId) {
    return {
      ok: false,
      skipped: false,
      error: "unknown_error: no Page token left to remove the subscription with.",
    };
  }

  const res = await unsubscribePageFromMessaging({ pageAccessToken: pageToken, pageId }).catch((err) => ({
    ok: false,
    kind: "network",
    message: err?.message || "Could not reach Meta.",
  }));

  if (!res?.ok) {
    return {
      ok: false,
      skipped: false,
      error: `${res?.kind || "unknown_error"}: ${res?.message || "Meta refused to remove the webhook subscription."}`.slice(0, 500),
    };
  }
  return { ok: true, skipped: false, error: null };
}
