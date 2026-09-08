// lib/messaging/platforms.js
//
// The closed set of messaging platforms, and the three things every part of
// the feature needs to know about one.
//
// ══ Why a registry rather than a third `case` ══════════════════════════════
//
// Before WhatsApp there were two platforms and four separate places that knew
// it: MessagingChannel.platform's comment, envelope.js's OBJECT_TO_PLATFORM,
// lib/aiEmployee/respond.js's platformSource(), and
// lib/attribution/loadMonthlyConversations.js's SOURCE_FOR_PLATFORM. The last
// two were the same map written twice — AGENTS.md failure class 4, and the
// copy that rots is the one nobody looks at, which here would mean a month of
// WhatsApp conversations quietly attributed to nothing.
//
// So the list is here, once, and the two maps are one map. Adding a fourth
// platform means adding one entry and finding out immediately what does not
// yet handle it, rather than discovering it in a rollup six weeks later.
//
// ══ What is NOT here ═══════════════════════════════════════════════════════
//
// Anything that differs in BEHAVIOUR rather than in vocabulary. The webhook
// envelope, the send body and the 24-hour service window are real differences
// between Meta's Send API and WhatsApp's Cloud API, and flattening them into
// a config object would produce a data structure with a `sendBodyShape` field
// — a switch statement with extra steps. Those live in their own files
// (envelope.js / whatsappEnvelope.js, metaSend.js / whatsappSend.js,
// serviceWindow.js) and lib/messaging/send.js picks between them once.

/**
 * Every platform a MessagingChannel row may name, in the order the settings
 * screen lists them. Frozen: nothing at runtime may add a fourth.
 */
export const MESSAGING_PLATFORMS = Object.freeze(["facebook", "instagram", "whatsapp"]);

/**
 * The platforms that arrive over META'S messaging webhook and leave over
 * Meta's Send API — as opposed to WhatsApp, which has its own of both.
 *
 * Named as a positive fact rather than tested as `!== "whatsapp"`: a fourth
 * platform added later defaults to "not one of Meta's two" and has to be
 * added here deliberately, which is the safe direction.
 */
export const META_SEND_PLATFORMS = Object.freeze(["facebook", "instagram"]);

/**
 * The platforms whose sends are bound by a 24-hour customer service window.
 *
 * Facebook and Instagram have their own version of this rule and Meta's Send
 * API enforces it with `messaging_type: "RESPONSE"` (see metaSend.js) — but
 * only WhatsApp offers a documented, approved way to send OUTSIDE it (a
 * template), which is the thing FieldQuo has to model, offer and refuse
 * against. So this list is "platforms where FieldQuo computes the window
 * itself", not "platforms Meta has a window for".
 */
export const SERVICE_WINDOW_PLATFORMS = Object.freeze(["whatsapp"]);

/** Is this string one of the three? Anything else is refused, never coerced. */
export function isMessagingPlatform(value) {
  return typeof value === "string" && MESSAGING_PLATFORMS.includes(value);
}

export function usesMetaSend(platform) {
  return META_SEND_PLATFORMS.includes(platform);
}

export function hasServiceWindow(platform) {
  return SERVICE_WINDOW_PLATFORMS.includes(platform);
}

/**
 * What `MessagingChannel.externalId` HOLDS for this platform.
 *
 * Documentation as data, on purpose: the settings panel prints it beside the
 * id, and a support call about "which id do I paste" has one answer. The
 * schema comment says the same thing; this is the copy a screen can render.
 */
export const EXTERNAL_ID_MEANING = Object.freeze({
  facebook: "Facebook Page id",
  instagram: "Instagram professional account id",
  whatsapp: "WhatsApp phone number id",
});

/**
 * The lead / conversation SOURCE a thread on this platform produces.
 *
 * One map, replacing the two identical ones named in this file's header. The
 * values are exactly lib/attribution/conversationOutcome.js's
 * CONVERSATION_SOURCES, which is asserted by the check rather than trusted:
 * a value that is not in that list silently drops a whole platform out of the
 * month-end rollup, which is a missing number nobody would notice.
 */
export const SOURCE_FOR_PLATFORM = Object.freeze({
  facebook: "meta_messenger",
  instagram: "meta_instagram",
  whatsapp: "meta_whatsapp",
});

/**
 * @param platform
 * @param fallback  what an unknown or absent platform produces. The two
 *                  callers want different answers — attribution wants null
 *                  ("this conversation has no source"), the AI employee's
 *                  callback tool wants "ai_employee" ("this lead came from
 *                  the employee") — so neither is baked in here.
 */
export function sourceForPlatform(platform, fallback = null) {
  return SOURCE_FOR_PLATFORM[platform] || fallback;
}

/** The i18n key for the platform badge on a thread. */
export function platformLabelKey(platform) {
  return isMessagingPlatform(platform) ? `app.messages.platform.${platform}` : null;
}
