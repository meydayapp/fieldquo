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
export const MESSAGING_PLATFORMS = Object.freeze(["facebook", "instagram", "whatsapp", "web", "sms", "email"]);

/**
 * The three that are META'S — a Page, an Instagram account, a WhatsApp
 * number, each connected with a token FieldQuo holds and each arriving over
 * a Meta webhook. "web" (the site chat widget) and "sms" (the shared system
 * number) are FieldQuo's own channels, added for the AI employee
 * (lib/aiEmployee/webChat.js, lib/aiEmployee/smsChannel.js): they share the
 * thread model and the inbox, but nothing about a token, an approval or a
 * 24-hour window applies to them. Everything that means "connected to Meta"
 * — listChannels, messagingConnection, saveChannel — reads THIS list.
 */
export const META_PLATFORMS = Object.freeze(["facebook", "instagram", "whatsapp"]);

/** FieldQuo's own two, for the same reason META_PLATFORMS is named. */
export const OWN_PLATFORMS = Object.freeze(["web", "sms"]);

/**
 * "email" — a conversation filed from a work mailbox the company connected
 * (lib/mailbox/). Neither Meta's nor one of the two the AI employee answers
 * on: it is not in META_PLATFORMS (no Page token, no approval) and not in
 * OWN_PLATFORMS (lib/aiEmployee/ownChannel.js must never mint one, and no
 * employee answers email). It is in MESSAGING_PLATFORMS so the inbox, the
 * score, the monthly review and the attribution read it as a conversation
 * like any other — which is the owner's rule for filed email.
 */
export const MAILBOX_PLATFORMS = Object.freeze(["email"]);

export function isMetaPlatform(platform) {
  return META_PLATFORMS.includes(platform);
}

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
 * The platforms whose sends are bound by a 24-hour customer service window,
 * and on which FieldQuo computes that window itself.
 *
 * All three of Meta's. This list used to be WhatsApp alone, on the reasoning
 * that Messenger and Instagram enforce the rule on Meta's side
 * (`messaging_type: "RESPONSE"`, see metaSend.js) and only WhatsApp has a
 * sanctioned way OUTSIDE it to model. The owner overruled that on 2026-09-22:
 * a Facebook thread past the window must show a closed state, say why and
 * what still works, and refuse the send — not let a contractor type an answer
 * and watch Meta bounce it. That is the WhatsApp reasoning in
 * serviceWindow.js's header, and it applies word for word to Messenger's
 * standard messaging window (developers.facebook.com/docs/messenger-platform/
 * policy/policy-overview — "24 hours to respond to a user"), which Instagram
 * messaging shares.
 *
 * Whether there is a way through once it closes is a SEPARATE fact, and it is
 * TEMPLATE_PLATFORMS below — not "is this WhatsApp" tested inline.
 */
export const SERVICE_WINDOW_PLATFORMS = Object.freeze(["whatsapp", "facebook", "instagram"]);

/**
 * The platforms with an approved way to message someone OUTSIDE the window:
 * a pre-approved template. WhatsApp only.
 *
 * Messenger and Instagram do have one of their own — the HUMAN_AGENT message
 * tag, which extends a reply to seven days — but it is gated behind Meta's
 * "Human Agent" permission, which is not in lib/meta/client.js's
 * META_MESSAGING_SCOPE and has never been requested in App Review. So on
 * those two a closed window has no way through inside FieldQuo, and the
 * screen says so and points at a call or an email. Adding HUMAN_AGENT is a
 * permission request first and a code change second; there is deliberately
 * no flag for it here (AGENTS.md failure class 8).
 */
export const TEMPLATE_PLATFORMS = Object.freeze(["whatsapp"]);

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

/** Does a closed window on this platform have a template to send instead? */
export function offersTemplates(platform) {
  return TEMPLATE_PLATFORMS.includes(platform);
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
  // FieldQuo's own channels have no external system; the id is ours, keyed
  // on the company so the @@unique([platform, externalId]) index holds.
  web: "FieldQuo web-chat channel (web:<companyId>)",
  sms: "FieldQuo SMS channel (sms:<companyId>)",
  email: "Connected work mailbox (email:<companyId>:<address>)",
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
  web: "web_chat",
  sms: "sms_chat",
  email: "email",
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
