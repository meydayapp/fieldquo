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

const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Meta's two messaging endpoints, which differ only in the path.
 *
 * Facebook: POST /<page id>/messages
 * Instagram: POST /<ig account id>/messages
 *
 * Same body, same token shape. One function, one branch.
 */
function sendPath(channel) {
  return `/${channel.externalId}/messages`;
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
 */
export async function sendMetaMessage({ channel, recipientExternalId, text }) {
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
        // FieldQuo is not approved for, and Meta refuses it — which arrives
        // here as a real error with a real reason, not as a silent drop.
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
