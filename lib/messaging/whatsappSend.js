// lib/messaging/whatsappSend.js
//
// The one place a reply leaves the building for WhatsApp's Cloud API.
//
// Sibling of lib/messaging/metaSend.js, with the SAME refusal contract: it
// returns `{ ok: false, reason, message }`, the caller writes that onto
// Message.failedReason, and the screen renders a failed bubble with the reason
// on it. Never a silent success, never a sent-looking row for a message the
// homeowner did not get.
//
// ══ The one refusal metaSend.js does not have ══════════════════════════════
//
// `service_window_closed`. WhatsApp allows free text only within 24 hours of
// the customer's last message; outside it, only an approved TEMPLATE may be
// sent, and Meta refuses everything else with error 131047. So this file
// refuses free text outside the window BEFORE calling Meta — with a named
// reason of our own, a real sentence, and the template as the way through.
//
// That check is not a substitute for Meta's. It is the first of two:
//
//   1. lib/messaging/serviceWindow.js, here, before the request. Catches the
//      ordinary case — a thread that went quiet over the weekend — while the
//      contractor is still looking at the composer.
//   2. classifyWhatsAppError, below, on the response. Catches the cases the
//      first cannot: a window that closed in the seconds between, a clock that
//      disagrees with Meta's, an inbound message we never received because a
//      webhook was dropped. It maps 131047 onto the SAME `reason` string, so
//      a thread shows one explanation however the refusal arrived.
//
// ══ Why not lib/meta/client.js ═════════════════════════════════════════════
//
// Same argument metaSend.js makes and for the same reason: that file's header
// says "Every function below reads", and a send is a write, on a different
// permission, against a different product. Only the version constant and the
// error classifier are imported, so a Graph version bump stays the one-line
// change that file promises.

import { GRAPH_API_VERSION, classifyMetaError } from "@/lib/meta/client";
import { decryptedChannelToken } from "./channels";
import { sendRefusalReason } from "./messageKinds";
import { serviceWindowRefusal, RE_ENGAGEMENT_ERROR_CODE } from "./serviceWindow";
import { templateRefusal, templatePayload } from "./templates";

const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Send one WhatsApp message.
 *
 * @param {object}  channel              a MessagingChannel ROW (platform
 *                                       "whatsapp", with accessTokenEnc), or
 *                                       null when the company has none
 * @param {string}  recipientExternalId  the customer's wa_id
 * @param {string}  text                 the free-text body ("text" sends)
 * @param {Date|null} lastInboundAt      MessageThread.lastInboundAt — when the
 *                                       CUSTOMER last wrote. The window is
 *                                       computed from this and nothing else.
 * @param {string}  kind                 "text" | "template"
 * @param {object}  template             a WhatsAppTemplate row, for "template"
 * @param {string[]} params              the template's fill-in values
 * @param {Date}    now                  passed so the check can drive the
 *                                       boundary; defaults to the real clock
 * @param {boolean} isPrivate            the row's `private` column
 * @param {string}  direction            the row's `direction` column
 *
 * @returns {Promise<{ ok: true, externalId: string }
 *                  | { ok: false, reason: string, message: string }>}
 */
export async function sendWhatsAppMessage({
  channel,
  recipientExternalId,
  text,
  lastInboundAt = null,
  kind = "text",
  template = null,
  params = [],
  now = new Date(),
  private: isPrivate = false,
  direction = "out",
}) {
  // ══ FIRST, before anything else — identical to metaSend.js ══════════════
  //
  // A private note and a system line must never reach the homeowner, and this
  // refuses them OUTRIGHT rather than relying on the note route not calling
  // here. Placed above every other guard so it holds in the one case that
  // matters: a live connection, an open window, a valid recipient, and a note
  // handed in by a route that got its wires crossed.
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
      message: "No WhatsApp number is connected, so this message was not sent.",
    };
  }
  if (channel.disconnectedAt) {
    return {
      ok: false,
      reason: "channel_disconnected",
      message: "That WhatsApp number was disconnected, so this message was not sent.",
    };
  }
  if (channel.status !== "connected") {
    return {
      ok: false,
      reason: "channel_needs_reauth",
      message:
        "The connection to that WhatsApp number has stopped working and needs reconnecting, so this message was not sent.",
    };
  }
  if (!recipientExternalId) {
    return {
      ok: false,
      reason: "no_recipient",
      message: "This conversation has no WhatsApp recipient, so nothing could be sent.",
    };
  }

  // ── The 24-hour customer service window ─────────────────────────────────
  //
  // Deliberately ABOVE the empty-text check and above the token decrypt. A
  // contractor typing into a closed window has to be told about the window,
  // not about an empty box, and the token must not be decrypted for a request
  // that is never going to be made.
  const windowRefusal = serviceWindowRefusal({
    platform: channel.platform,
    lastInboundAt,
    kind,
    now,
  });
  if (windowRefusal) {
    return { ok: false, reason: windowRefusal.reason, message: windowRefusal.message };
  }

  let message;
  if (kind === "template") {
    const bad = templateRefusal({ template, params });
    if (bad) return { ok: false, reason: bad.reason, message: bad.message };
    message = { type: "template", template: templatePayload({ template, params }) };
  } else {
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, reason: "empty", message: "There was nothing to send." };
    }
    message = {
      type: "text",
      // preview_url false on purpose. A link preview is fetched by WhatsApp
      // from whatever the message contains, and a quote link previewed into a
      // homeowner's chat would show a card FieldQuo does not control on a
      // surface that is supposed to look like the contractor's.
      text: { preview_url: false, body: text },
    };
  }

  let accessToken;
  try {
    accessToken = decryptedChannelToken(channel);
  } catch (err) {
    // A stored token that will not decrypt is a configuration or corruption
    // problem, NOT an expiry — calling it expired would send the contractor to
    // reconnect a number that is fine. Same distinction metaSend.js draws.
    return {
      ok: false,
      reason: "token_unreadable",
      message: `The stored WhatsApp credential could not be read (${err?.message || "unknown"}).`,
    };
  }

  let res;
  try {
    res = await fetch(`${GRAPH_BASE}/${channel.externalId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // A HEADER, where metaSend.js puts the token in the body. Meta's two
        // products differ here and the Cloud API documents the bearer header;
        // copying the other file's `access_token` body field is a 401 that
        // reads like a dead token.
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientExternalId,
        ...message,
      }),
    });
  } catch (err) {
    // FieldQuo's own connectivity, not a Meta verdict — nothing to classify.
    return {
      ok: false,
      reason: "network",
      message: `Could not reach WhatsApp (${err?.message || "network error"}).`,
    };
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) return classifyWhatsAppError({ status: res.status, body, headers: res.headers });

  // Cloud API answers { messaging_product, contacts: [...], messages: [{ id }] }
  const externalId =
    typeof body?.messages?.[0]?.id === "string" ? body.messages[0].id : null;
  if (!externalId) {
    // 200 with no message id. Treated as a failure, not a success: without an
    // id there is nothing for the status webhook to key against, and "we think
    // it went" is not something to show a contractor.
    return {
      ok: false,
      reason: "no_message_id",
      message: "WhatsApp accepted the request but returned no message id.",
    };
  }

  return { ok: true, externalId };
}

/**
 * Meta's refusal -> our vocabulary.
 *
 * Exported and pure so the check can execute it against a real 131047 body
 * rather than assert that a comment mentions the number.
 *
 * The ONE case handled specially is the re-engagement error, and it is mapped
 * onto the SAME `service_window_closed` reason the pre-flight check uses.
 * Two different strings for one situation would mean a contractor read one
 * explanation in the composer and a different one in the thread, for the same
 * message — and would mean the check could pass on a path that never agreed
 * with the screen.
 */
export function classifyWhatsAppError({ status, body, headers } = {}) {
  const code = Number(body?.error?.code);
  const detail = typeof body?.error?.error_data?.details === "string"
    ? body.error.error_data.details
    : null;

  if (code === RE_ENGAGEMENT_ERROR_CODE) {
    return {
      ok: false,
      reason: "service_window_closed",
      message:
        detail ||
        "More than 24 hours have passed since they last wrote, so WhatsApp refused the message. An approved template can reopen the conversation.",
    };
  }

  // 132001: the template does not exist in that language, or is not approved.
  // Named separately because the fix is a specific one — pick another
  // template, or wait for approval — and "Meta refused this" is not that.
  if (code === 132001) {
    return {
      ok: false,
      reason: "template_not_approved",
      message:
        detail || "WhatsApp has no approved template by that name in that language.",
    };
  }
  // 132000: the parameter count did not match the template.
  if (code === 132000) {
    return {
      ok: false,
      reason: "template_params",
      message: detail || "That template was sent with the wrong number of fill-in values.",
    };
  }
  // 131026: the number is not on WhatsApp, or has not accepted the terms.
  // Nothing about this connection is broken, so it must not be reported as a
  // token or a reauth problem — that would send a contractor to reconnect a
  // number that works.
  if (code === 131026) {
    return {
      ok: false,
      reason: "not_a_whatsapp_user",
      message:
        detail || "WhatsApp could not deliver to that number — they may not use WhatsApp.",
    };
  }
  // 133010: this number was never registered for the Cloud API. A connection
  // problem, and a specific one: the register step did not complete.
  if (code === 133010) {
    return {
      ok: false,
      reason: "number_not_registered",
      message:
        detail || "This number is not registered on the WhatsApp Business Platform yet.",
    };
  }

  // Everything else through the shared classifier, so a token problem here
  // reads the same as a token problem in the ads import.
  const classified = classifyMetaError({ status, body, headers });
  return { ok: false, reason: `meta_${classified.kind}`, message: classified.message };
}

/**
 * The demo company's send, and only the demo company's.
 *
 * Mirrors sendMockMessage in metaSend.js: a fixed `demo_` prefix so anyone
 * reading a log can see at a glance that no message left the building.
 * Reachable only where connection.mock is true, which is decided from
 * Company.isDemo read fresh from the database in lib/messaging/channels.js.
 */
export function sendMockWhatsAppMessage() {
  return {
    ok: true,
    externalId: `demo_wamid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    mock: true,
  };
}
