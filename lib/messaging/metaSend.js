// lib/messaging/metaSend.js
//
// The one place a reply leaves the building for Meta's Send API.
//
// ══ It REFUSES rather than pretending ══════════════════════════════════════
//
// The most important thing in this file is what it does when the Page is not
// connected: it returns `{ ok: false, reason: "channel_not_connected" }`, the
// route writes that onto Message.failedReason, and the screen renders the
// bubble as failed with the reason on it. It does not return ok, it does not
// throw a generic error, and it never writes a message row that looks sent.
//
// That is the whole of AGENTS.md's first rule applied to the one control on
// this feature that could most easily lie: a contractor typing an answer to a
// homeowner and pressing Send. Today, for every real company, this function
// always takes that branch — Meta has not approved pages_messaging (see
// lib/meta/client.js's META_MESSAGING_SCOPE), so there is no channel and no
// token. The composer is disabled with the reason shown ON it, so nobody gets
// as far as pressing anything; this refusal is the second line of defence for
// the case where they do.
//
// ══ Why not lib/meta/client.js ═════════════════════════════════════════════
//
// That file owns the Graph API version and every ADS call, and its header says
// so: "Every function below reads." A send is a write, on a different
// permission, with a different token, and folding it in would make that
// header false. The version constant is imported rather than re-declared, so a
// Meta version bump is still the one-line change that file promises.

import { GRAPH_API_VERSION } from "@/lib/meta/client";
import { classifyMetaError } from "@/lib/meta/client";
import { decryptedChannelToken } from "./channels";
import { sendRefusalReason } from "./messageKinds";
import { serviceWindowRefusal } from "./serviceWindow";
import { isThreadControlError, threadControlAskable, THREAD_CONTROL_REASON } from "./threadControl";
import { isInstagramCapabilityError, INSTAGRAM_CAPABILITY_REASON } from "./instagramSendErrors";

const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Where a reply is POSTed, per platform.
 *
 * Facebook:  POST graph.facebook.com/<page id>/messages
 * Instagram: POST graph.facebook.com/me/messages   (me = the Page, because
 *            the credential is the PAGE token the Instagram account is linked
 *            through)
 *
 * ══ Why Instagram is NOT /<ig account id>/messages any more ═══════════════
 *
 * It was, and every Instagram reply failed with
 * "(#3) Application does not have the capability to make this API call"
 * while Facebook replies on the same token went through (owner, 2026-09-28).
 * The path is one of two candidate causes — the other is the connection's
 * grant, which instagramSendErrors.js names — and it is the one in OUR code,
 * so it is fixed here rather than argued about. Which of the two Meta was
 * actually objecting to can only be settled by the next live send; no call
 * was made to Meta with a stored token to find out.
 *
 * FieldQuo connects Instagram through Facebook Login with a Page token — the
 * Messenger Platform's Instagram messaging. Meta's send page for that API
 * (developers.facebook.com/docs/messenger-platform/instagram/features/
 * send-message, read 2026-09-28) posts to "/PAGE-ID/messages" or
 * "/me/messages" with a "Page access token", naming "The ID of the Facebook
 * Page linked to your Instagram Professional account" as the path. The
 * /<IG_ID>/messages path belongs to the OTHER Instagram API — Instagram
 * Login, on graph.instagram.com, with an Instagram User token
 * (developers.facebook.com/documentation/instagram-platform/
 * instagram-api-with-instagram-login/messaging-api) — which FieldQuo does not
 * use. So the path was the wrong API's path for the token we hold.
 *
 * `me` rather than the Page id because the Instagram channel row is keyed on
 * the Instagram account id (the webhook's `entry.id`, see pageChannels.js)
 * and carries no Page id; `me` resolves to exactly the Page that issued the
 * token, and it is the form Meta's own sample uses. No new column, no second
 * copy of an id that could disagree with the first.
 */
function sendPath(channel) {
  return channel.platform === "instagram" ? "/me/messages" : `/${channel.externalId}/messages`;
}

/**
 * @param {object} channel  a MessagingChannel ROW (with accessTokenEnc), or
 *                          null when the company has none
 * @param {string} recipientExternalId  the participant's page-scoped id
 * @param {string} text
 * @returns {Promise<{ ok: true, externalId: string }
 *                  | { ok: false, reason: string, message: string }>}
 *
 * `reason` is a stable code the UI has a sentence for; `message` is the
 * detail for the log and for MessageThread's failure display.
 *
 * @param {boolean} [isPrivate]  the row's `private` column
 * @param {string}  [direction]  the row's `direction` column
 * @param {Date|string|null} [lastInboundAt]  MessageThread.lastInboundAt —
 *        the one input to the 24-hour window. Null means the customer never
 *        wrote, which is CLOSED (serviceWindow.js says why).
 * @param {Date} [now]  injected so a check can drive the boundary
 */
export async function sendMetaMessage({
  channel,
  recipientExternalId,
  text,
  private: isPrivate = false,
  direction = "out",
  lastInboundAt = null,
  now = new Date(),
}) {
  // ══ FIRST, before anything else, and on purpose ═════════════════════════
  //
  // A private note ("quoted high, they're shopping around") and a system line
  // are the two things in this thread that must never reach the homeowner.
  // This refuses them OUTRIGHT — it is not a `continue` in a loop somewhere
  // upstream, and it is not "the note route happens not to call this".
  //
  // Placed above the channel check deliberately, so it holds in the ONE case
  // that matters: a fully connected Page, a live token, a valid recipient, and
  // a note handed in by a route that got its wires crossed. Every guard below
  // this line would have waved that through.
  //
  // The note route (app/api/messaging/threads/[id]/note/route.js) does not
  // import this file at all, which is the structural half of the same rule.
  // This is the half that survives somebody wiring the two together later.
  const refusal = sendRefusalReason({ private: isPrivate, direction });
  if (refusal) {
    return {
      ok: false,
      reason: refusal,
      message:
        refusal === "private_note"
          ? "That is an internal note. It was never sent to the customer, and it never will be."
          : "Only a reply written to the customer can be sent — this was an internal record.",
    };
  }

  if (!channel) {
    return {
      ok: false,
      reason: "channel_not_connected",
      message:
        "No Facebook Page or Instagram account is connected, so this message was not sent.",
    };
  }
  if (channel.disconnectedAt) {
    return {
      ok: false,
      reason: "channel_disconnected",
      message: "That Page was disconnected, so this message was not sent.",
    };
  }
  if (channel.status !== "connected") {
    return {
      ok: false,
      reason: "channel_needs_reauth",
      message:
        "The connection to that Page has stopped working and needs reconnecting, so this message was not sent.",
    };
  }
  if (!recipientExternalId) {
    return {
      ok: false,
      reason: "no_recipient",
      message: "This conversation has no Meta recipient id, so nothing could be sent.",
    };
  }

  // ── The 24-hour standard messaging window (owner, 2026-09-22) ───────────
  //
  // Same place in the order as whatsappSend.js's: above the empty-text check
  // (a contractor typing into a closed window is told about the window, not
  // about the box) and above the token decrypt (no credential is read for a
  // request that will never be made). The composer is already disabled in
  // this state; this is the guard for the caller that is not the composer —
  // the AI employee, a draft approved late, a crafted request — and it gives
  // them the named reason instead of a translated Meta error after the fact.
  const windowRefusal = serviceWindowRefusal({
    platform: channel.platform,
    lastInboundAt,
    kind: "text",
    now,
  });
  if (windowRefusal) {
    return { ok: false, reason: windowRefusal.reason, message: windowRefusal.message };
  }

  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, reason: "empty", message: "There was nothing to send." };
  }

  let accessToken;
  try {
    accessToken = decryptedChannelToken(channel);
  } catch (err) {
    // A stored token that will not decrypt is NOT "expired" — it is a
    // configuration or corruption problem, and calling it expired would send
    // the contractor to reconnect a Page that is fine. Same distinction
    // lib/meta/tokenCrypto.js's header draws.
    return {
      ok: false,
      reason: "token_unreadable",
      message: `The stored Page credential could not be read (${err?.message || "unknown"}).`,
    };
  }

  let res;
  try {
    res = await fetch(`${GRAPH_BASE}${sendPath(channel)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientExternalId },
        message: { text },
        // RESPONSE is Meta's tag for a reply inside the 24-hour window a
        // person's own message opens. Anything outside it needs a message tag
        // (HUMAN_AGENT) FieldQuo is not approved for; the window check above
        // refuses that case first, and if Meta refuses it anyway (clock skew,
        // an inbound we never received) it arrives as a real error with a
        // real reason, not as a silent drop.
        messaging_type: "RESPONSE",
        access_token: accessToken,
      }),
    });
  } catch (err) {
    // FieldQuo's own connectivity, not a Meta verdict — nothing to classify.
    return {
      ok: false,
      reason: "network",
      message: `Could not reach Meta (${err?.message || "network error"}).`,
    };
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    // ── Another app holds this conversation ───────────────────────────────
    //
    // Named BEFORE the generic classifier, which would call it
    // `unknown_error` — see lib/messaging/threadControl.js for the incident
    // and for why code 10 alone is not enough. Meta's own sentence is kept in
    // `message` so the stored row still says exactly what Meta said; the
    // screen translates the reason into what to change.
    if (isThreadControlError(body)) {
      const said = body?.error?.message || "Message failed to send because another app is controlling this thread now.";
      return {
        ok: false,
        reason: THREAD_CONTROL_REASON,
        message: `Another app connected to this Page is controlling this conversation at Meta, so FieldQuo cannot reply in it (Meta: ${said})`,
      };
    }
    // ── Instagram: "(#3) … does not have the capability" ─────────────────
    //
    // Named for Instagram only — see lib/messaging/instagramSendErrors.js for
    // what Meta's docs say it can mean and why Facebook's code 3 is left to
    // the generic classifier.
    if (isInstagramCapabilityError(channel.platform, body)) {
      const said = body?.error?.message || "Application does not have the capability to make this API call.";
      return {
        ok: false,
        reason: INSTAGRAM_CAPABILITY_REASON,
        message: `Meta refused this Instagram reply: messaging for this Instagram account is not enabled for FieldQuo (Meta: ${said})`,
      };
    }
    const classified = classifyMetaError({ status: res.status, body, headers: res.headers });
    return {
      ok: false,
      // The classifier's own vocabulary, carried through rather than
      // re-invented, so a token problem here reads the same as a token problem
      // in the ads import.
      reason: `meta_${classified.kind}`,
      message: classified.message,
    };
  }

  const externalId = typeof body?.message_id === "string" ? body.message_id : null;
  if (!externalId) {
    // Meta answered 200 with no message id. Treated as a failure, not a
    // success: without an id there is nothing to de-duplicate the echo webhook
    // against, and "we think it went" is not something to show a contractor.
    return {
      ok: false,
      reason: "no_message_id",
      message: "Meta accepted the request but returned no message id.",
    };
  }

  return { ok: true, externalId };
}

/**
 * Ask Meta to hand this conversation to FieldQuo — request_thread_control.
 *
 * ══ What this is, and what it is NOT ════════════════════════════════════════
 *
 * Meta's Conversation Routing documents
 *
 *   POST /{PAGE-ID}/request_thread_control   recipient={id:PSID}  metadata
 *
 * for an app that does not hold a conversation to ASK the app that does
 * (developers.facebook.com/documentation/business-messaging/
 * messenger-platform/conversation-routing, read 2026-09-28; the same page
 * says request is "only supported in default" routing). Meta answering
 * `{ success: true }` means the request was DELIVERED — not that control
 * moved. The holder decides, and FieldQuo does not subscribe to the
 * messaging_handovers webhook that would report its answer, so the screen
 * says exactly that: asked, the other app decides, press Send to find out.
 *
 * `take_thread_control` is never called anywhere — see threadControlAskable
 * in ./threadControl.js for why taking is the company's decision, not ours.
 *
 * Refusals follow sendMetaMessage's contract: `{ ok: false, reason, message }`
 * with a stable reason, never a silent success.
 */
export async function requestMetaThreadControl({ channel, recipientExternalId }) {
  if (!channel) {
    return { ok: false, reason: "channel_not_connected", message: "No Facebook Page is connected." };
  }
  if (!threadControlAskable(channel.platform)) {
    return {
      ok: false,
      reason: "thread_control_unsupported",
      message: "Asking for a conversation is only available on Facebook Page conversations.",
    };
  }
  if (channel.disconnectedAt) {
    return { ok: false, reason: "channel_disconnected", message: "That Page was disconnected." };
  }
  if (channel.status !== "connected") {
    return {
      ok: false,
      reason: "channel_needs_reauth",
      message: "The connection to that Page has stopped working and needs reconnecting.",
    };
  }
  if (!recipientExternalId) {
    return { ok: false, reason: "no_recipient", message: "This conversation has no Meta recipient id." };
  }

  let accessToken;
  try {
    accessToken = decryptedChannelToken(channel);
  } catch (err) {
    return {
      ok: false,
      reason: "token_unreadable",
      message: `The stored Page credential could not be read (${err?.message || "unknown"}).`,
    };
  }

  let res;
  try {
    res = await fetch(`${GRAPH_BASE}/${channel.externalId}/request_thread_control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientExternalId },
        // Shown to whoever holds the conversation, where their app surfaces
        // it. Plain and in English: it is read by another app's operator, not
        // by the homeowner.
        metadata: "A team member wants to reply to this conversation from FieldQuo.",
        access_token: accessToken,
      }),
    });
  } catch (err) {
    return { ok: false, reason: "network", message: `Could not reach Meta (${err?.message || "network error"}).` };
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const classified = classifyMetaError({ status: res.status, body, headers: res.headers });
    return { ok: false, reason: `meta_${classified.kind}`, message: classified.message };
  }
  if (body?.success !== true) {
    // 200 without `success: true` is not a delivered request — same rule as a
    // send with no message id.
    return { ok: false, reason: "not_confirmed", message: "Meta answered without confirming the request." };
  }
  return { ok: true };
}

/**
 * The demo company's send, and only the demo company's.
 *
 * Mirrors lib/social/mockMetaGraphClient.js: a sales demo has to be able to
 * type a reply and see it appear. Returns a fabricated id with a fixed `demo_`
 * prefix so anyone reading a log can see at a glance that no message left the
 * building — the same discipline lib/social/metaConnection.js keeps for its
 * ids. Reachable only where connection.mock is true, which is decided from
 * Company.isDemo read fresh from the database.
 */
export function sendMockMessage() {
  return {
    ok: true,
    externalId: `demo_mid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    mock: true,
  };
}
