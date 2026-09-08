// lib/messaging/send.js
//
// THE send. One function, three platforms, and the only place in the product
// that decides which API a reply goes out over.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// Before WhatsApp there were two callers of sendMetaMessage — the reply route
// and lib/aiEmployee/inbound.js — and adding a third platform to a two-branch
// world would have meant adding the same `if (platform === "whatsapp")` to
// both. Two copies of a routing decision is AGENTS.md failure class 4 aimed
// squarely at the one control on this feature that must not lie: a contractor
// pressing Send.
//
// So the branch lives here, once. Both callers ask for "send this on this
// channel" and get the same refusal contract back whichever API answered.
//
// ══ The contract, unchanged from metaSend.js ═══════════════════════════════
//
//   { ok: true,  externalId }
//   { ok: false, reason, message }
//
// Never a silent success. `reason` is a stable code the UI has a sentence for
// and Message.failedReason stores; `message` is the detail. Every caller
// writes the Message row EITHER WAY, so a conversation keeps the record that
// somebody tried and it did not go.

import { sendMetaMessage, sendMockMessage } from "./metaSend";
import { sendWhatsAppMessage, sendMockWhatsAppMessage } from "./whatsappSend";
import { usesMetaSend } from "./platforms";

/**
 * @param channel              the MessagingChannel ROW, or null
 * @param recipientExternalId  PSID (facebook/instagram) or wa_id (whatsapp)
 * @param text                 the free-text body
 * @param lastInboundAt        MessageThread.lastInboundAt. Ignored by the Meta
 *                             platforms; the 24-hour window on WhatsApp is
 *                             computed from it. Passed by every caller rather
 *                             than looked up here, so this function stays a
 *                             router and does not become a second place that
 *                             reads the database.
 * @param kind                 "text" | "template" | "media" | "location" (the
 *                             last three are WhatsApp only)
 * @param template             a WhatsAppTemplate row, for kind "template"
 * @param media                { type, mediaId, caption, filename } for kind
 *                             "media" — the id from a completed upload to
 *                             Meta, never anything a browser sent
 * @param location             { latitude, longitude, name, address } for kind
 *                             "location", resolved from the company's own row
 * @param params               the template's fill-in values
 * @param now                  injected so the check can drive the window
 *                             boundary; the real clock otherwise
 * @param private              the row's `private` column
 * @param direction            the row's `direction` column
 */
export async function sendOnChannel({
  channel,
  recipientExternalId,
  text,
  lastInboundAt = null,
  kind = "text",
  template = null,
  media = null,
  location = null,
  params = [],
  now = new Date(),
  private: isPrivate = false,
  direction = "out",
}) {
  // A missing channel is refused by whichever send would have handled it, and
  // there is no platform to ask. Routed to the Meta send because its message
  // ("No Facebook Page or Instagram account is connected") is the one a
  // company with no channels at all is in — a WhatsApp-specific sentence for a
  // company that never tried WhatsApp would be a confusing lie.
  const platform = channel?.platform || null;

  if (platform && !usesMetaSend(platform)) {
    return sendWhatsAppMessage({
      channel,
      recipientExternalId,
      text,
      lastInboundAt,
      kind,
      template,
      media,
      location,
      params,
      now,
      private: isPrivate,
      direction,
    });
  }

  // A template is a WhatsApp concept. Asking for one on a Page conversation is
  // a caller bug, and it is refused by name rather than quietly downgraded to
  // a text send — silently sending something other than what was asked for is
  // how a homeowner gets the wrong message.
  if (kind === "template") {
    return {
      ok: false,
      reason: "template_unsupported",
      message: "Message templates are a WhatsApp feature — this conversation is not on WhatsApp.",
    };
  }

  // ── Outbound media, and why Messenger does not get it in this change ────
  //
  // Not because it is impossible — the Messenger Send API takes an attachment
  // with a public URL, and a Cloudinary URL is one. Because it is a DIFFERENT
  // send: a different payload, a different set of Meta errors, a different
  // 24-hour rule (Meta's own, enforced by messaging_type rather than by us),
  // and no size table published the way WhatsApp's is. Building it by analogy
  // and hoping is how the second copy of a send path rots.
  //
  // So it is refused by NAME, and the composer does not offer the control on a
  // Page or Instagram thread — the refusal is the guard that survives somebody
  // wiring a new caller in later, exactly as the template one above is.
  if (kind === "media") {
    return {
      ok: false,
      reason: "media_unsupported",
      message:
        "Sending a photo is a WhatsApp feature today — this conversation is on Facebook or Instagram.",
    };
  }

  // A pin, refused by NAME for the same reason and with a reason of its own.
  // Not folded into `media_unsupported`: the Messenger Send API has no
  // location message at all (Meta removed it), where it does have attachments
  // — so "we have not built it" and "it does not exist" are two different
  // facts and a contractor reading the failed bubble should get the true one.
  if (kind === "location") {
    return {
      ok: false,
      reason: "location_unsupported",
      message:
        "Sending a location is a WhatsApp feature — Facebook and Instagram messages cannot carry one.",
    };
  }

  return sendMetaMessage({
    channel,
    recipientExternalId,
    text,
    private: isPrivate,
    direction,
  });
}

/**
 * The demo company's send, routed the same way.
 *
 * Two mock functions rather than one because the ids differ in shape
 * (`demo_mid_` vs `demo_wamid_`), and a demo whose WhatsApp ids looked like
 * Messenger ids would make a log harder to read for no gain.
 */
export function sendMockOnChannel(platform) {
  return usesMetaSend(platform) ? sendMockMessage() : sendMockWhatsAppMessage();
}
