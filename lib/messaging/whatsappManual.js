// lib/messaging/whatsappManual.js
//
// The pure half of the pasted-credential door (app/api/settings/whatsapp/
// manual): what a body has to look like before a single call is made with
// it. Separate from the route so scripts/check-whatsapp.mjs can EXECUTE it
// against hostile input rather than read a regex off the route.
//
// ══ Why the ids are digits and nothing else ════════════════════════════════
//
// Both ids go into a Graph URL path — `/<phone-number-id>` and `/<waba-id>`.
// Meta's ids are decimal strings, and a value that is not one is at best a
// typo and at worst a path segment ("me/messages", "../oauth") aimed at
// turning the number read into a different request. Refusing anything but
// digits closes that before the URL is built, and does so with a sentence
// about the field the person filled in rather than a Meta error about a
// request they never meant to make.

/**
 * The two WhatsApp permissions a pasted token must carry. `business_management`
 * is what Meta's guide also suggests ticking, and it is deliberately NOT
 * required here: the connection reads and sends without it, and refusing a
 * working token over a permission nothing calls would be a gate with no reason.
 */
export const MANUAL_REQUIRED_SCOPES = Object.freeze([
  "whatsapp_business_messaging",
  "whatsapp_business_management",
]);

const ID_RE = /^\d{5,32}$/;
/**
 * Long enough for every Meta token shape seen (system user tokens run ~200
 * characters), short enough that a pasted web page is refused as a token
 * rather than sent to Meta as a bearer header.
 */
const TOKEN_MAX = 1024;

/**
 * @returns {{ ok: true, wabaId, phoneNumberId, accessToken }
 *         | { ok: false, code, message }}
 *
 * `code` is what the panel maps to a sentence; `message` is the English
 * fallback. The token is trimmed and otherwise untouched — never lower-cased,
 * never echoed back in a message.
 */
export function validateManualCredentials(body) {
  const src = body && typeof body === "object" ? body : {};
  const wabaId = typeof src.wabaId === "string" ? src.wabaId.trim() : "";
  const phoneNumberId = typeof src.phoneNumberId === "string" ? src.phoneNumberId.trim() : "";
  const accessToken = typeof src.accessToken === "string" ? src.accessToken.trim() : "";

  if (!ID_RE.test(wabaId)) {
    return { ok: false, code: "bad_waba_id", message: "The WhatsApp Business Account ID should be digits only." };
  }
  if (!ID_RE.test(phoneNumberId)) {
    return { ok: false, code: "bad_phone_number_id", message: "The phone number ID should be digits only." };
  }
  if (wabaId === phoneNumberId) {
    // The two ids are different objects and a person who pasted one twice has
    // not given us both. Said by name rather than left for Meta to answer
    // "unknown object" on the account read.
    return { ok: false, code: "same_ids", message: "The account ID and the phone number ID are the same value — they are two different ids." };
  }
  if (!accessToken) {
    return { ok: false, code: "bad_token", message: "Paste the permanent access token." };
  }
  if (accessToken.length > TOKEN_MAX || /\s/.test(accessToken)) {
    return { ok: false, code: "bad_token", message: "That doesn't look like an access token." };
  }
  return { ok: true, wabaId, phoneNumberId, accessToken };
}
