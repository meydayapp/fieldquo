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
//                                POST /<ig-user-id>/messages, which Meta gates
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

  const res = await subscribePageToMessaging({ pageAccessToken: pageToken, pageId }).catch((err) => ({
    ok: false,
    kind: "network",
    message: err?.message || "Could not reach Meta.",
  }));

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
