// lib/messaging/threadControl.js
//
// "Another app is controlling this conversation" — Meta's Handover Protocol /
// Conversation Routing refusal, named.
//
// ══ The incident ═══════════════════════════════════════════════════════════
//
// The owner answered a Facebook Page conversation from Messages and the
// failed bubble read
//
//   meta_unknown_error: (#10) Message failed to send because another app is
//   controlling this thread now.
//
// Meta's own Business AI had already answered in that thread. On a Page with
// more than one app able to answer messages, Meta gives ONE app control of
// each conversation at a time, and every other app's Send API call is refused
// with code 10, subcode 2018300 — Meta's error-code table lists 2018300 as
// "Message failed to send because another app is controlling this thread now"
// (developers.facebook.com/docs/messenger-platform/error-codes, read
// 2026-09-28). For Instagram, Meta's own page could not be reached; a
// third-party Instagram DM error list (instantdm.com) reports the same code,
// subcode and sentence, and the classifier below matches both platforms
// identically so an Instagram variant is not left reading "unknown".
//
// "unknown error" was the one thing it was not: the fix is a setting the
// company controls, in Meta, and the screen should say which one.
//
// ══ Why this file is pure ══════════════════════════════════════════════════
//
// app/app/messages/page.js is "use client" and needs isThreadControlFailure()
// to translate a stored failedReason. The send module reaches the token
// decrypt, which reaches "@/lib/db"; importing one predicate through it would
// pull Prisma into the browser bundle — the split whatsappMediaLimits.js
// documents, for the same reason. So the vocabulary lives here and the network
// call (requestMetaThreadControl) lives in metaSend.js beside the send.

/** The stable reason code. Stored on Message.failedReason as `${reason}: …`. */
export const THREAD_CONTROL_REASON = "meta_other_app_controls_thread";

/** Meta's subcode for "another app is controlling this thread now". */
export const THREAD_CONTROL_SUBCODE = 2018300;

const THREAD_CONTROL_TEXT = /another app is controlling this thread/i;

/**
 * Is this Graph error body Meta's thread-control refusal?
 *
 * The subcode decides when Meta sends it. The sentence is matched as well
 * because the incident's own error arrived as "(#10) Message failed to send
 * because another app is controlling this thread now." and a body that lost
 * its subcode must not fall back to "unknown". Code 10 ALONE is not enough:
 * Meta uses 10 for the 24-hour window (2018278, 2534022), for a person who
 * cannot be messaged (2018108) and for a plain missing permission (1404170),
 * and telling a contractor to change Page routing for any of those would send
 * them to the wrong setting.
 */
export function isThreadControlError(body) {
  const err = body && typeof body === "object" ? body.error : null;
  if (!err || typeof err !== "object") return false;
  if (Number(err.error_subcode) === THREAD_CONTROL_SUBCODE) return true;
  const text = `${err.message || ""} ${err.error_user_msg || ""}`;
  return THREAD_CONTROL_TEXT.test(text);
}

/**
 * Does this stored Message.failedReason carry the thread-control refusal?
 *
 * The reply route stores `${reason}: ${message}`; the AI employee's send
 * (lib/aiEmployee/inbound.js) stores the bare reason. Both are recognised.
 */
export function isThreadControlFailure(failedReason) {
  if (typeof failedReason !== "string") return false;
  return failedReason === THREAD_CONTROL_REASON || failedReason.startsWith(`${THREAD_CONTROL_REASON}:`);
}

/**
 * Can FieldQuo ASK for this conversation (request_thread_control)?
 *
 * Facebook only. Meta documents POST /{PAGE-ID}/request_thread_control for
 * Messenger (Conversation Routing, developers.facebook.com/documentation/
 * business-messaging/messenger-platform/conversation-routing, read
 * 2026-09-28). The Instagram handover page could not be reached when this was
 * written, and an Instagram channel's externalId is the Instagram account,
 * not the Page — so calling the Messenger path with it is a guess, and a
 * button built on a guess is the control that appears to work. Instagram gets
 * the explanation and the settings to change, and no button.
 *
 * TAKE (take_thread_control) is deliberately never offered: Meta allows it
 * only to the Primary Receiver or on an idle conversation, and when it works
 * it silently removes the conversation from whatever the company chose to
 * answer it — Meta's Business AI in the incident. Asking leaves that choice
 * with the app that holds the conversation.
 */
export function threadControlAskable(platform) {
  return platform === "facebook";
}
