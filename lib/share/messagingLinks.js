// lib/share/messagingLinks.js
//
// Deep links that hand a prefilled message to the user's OWN messaging app.
//
// Why this exists rather than sending through us: the platform's Twilio number
// can't text from a trial account, so a referral routed through the server
// fails for exactly the newest companies. A link into the user's own Messages
// or WhatsApp always works, comes from their number, and lets them pick the
// contact in an app that already has their address book.
//
// ── The sms: separator is genuinely platform-specific ───────────────────────
//
// There is no feature query for "does this device send SMS", and no capability
// test at all for which separator the handler expects. The two behaviours are
// real and incompatible:
//
//   iOS      sms:&body=…    (RFC 5724 says `?`, iOS has always wanted `&`)
//   Android  sms:?body=…    Chrome/Android drops the body given `&`
//
// So one UA sniff, confined to this file, used only to pick a character. Every
// other decision on the page is made from a media query. `sms:?&body=` — the
// "both" hack this replaces — is not a third option: iOS reads the empty `?`
// as the recipient and Android sees a malformed query, and either way some
// devices open Messages with an empty draft, which is the failure mode the
// user notices last (after they've already picked a contact).
//
// Everything here is pure: pass in the UA and touch-point count, get a string.
// scripts/check-share-links.mjs runs it against hostile input.

/**
 * iPadOS reports the desktop Safari UA ("Macintosh; Intel Mac OS X") and can
 * still open Messages, so the Mac-with-touch case is deliberately included.
 * A real Mac reports maxTouchPoints 0.
 */
export function isIosLike(userAgent = "", maxTouchPoints = 0) {
  const ua = String(userAgent || "");
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh|Mac OS X/i.test(ua) && Number(maxTouchPoints) > 1;
}

/**
 * Exported so the hook that subscribes to this query and the function that
 * evaluates it can't drift apart.
 */
export const SMS_CAPABLE_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

/**
 * Can this device hand a message to an SMS app at all?
 *
 * Measured, not sniffed: a coarse pointer with no hover is a phone or tablet.
 * A laptop with a touchscreen still reports `hover: hover`, and a desktop that
 * can't text must not be shown a button that opens nothing.
 *
 * `win` is passed in so this is testable and SSR-safe.
 */
export function canSendSms(win) {
  if (!win || typeof win.matchMedia !== "function") return false;
  return Boolean(win.matchMedia(SMS_CAPABLE_MEDIA_QUERY).matches);
}

/**
 * What the refer page needs to decide what to render, in one read of `window`.
 * Returns `{ canText, iosStyle }`; both false when there is no window (SSR),
 * which renders the desktop layout — the safe default, since it hides the one
 * control that can fail rather than showing it optimistically.
 */
export function detectMessagingCapability(win) {
  if (!win) return { canText: false, iosStyle: false };
  const nav = win.navigator || {};
  return {
    canText: canSendSms(win),
    iosStyle: isIosLike(nav.userAgent, nav.maxTouchPoints),
  };
}

/**
 * `sms:` href with the body encoded.
 *
 * The encoding is the load-bearing part: a referral URL carries `?` and `&`,
 * and unencoded those terminate the body — the user sends "Try FieldQuo:
 * https://…/refer" and the rest of their message is silently gone.
 */
export function smsShareHref(message, { iosStyle = false } = {}) {
  const separator = iosStyle ? "&" : "?";
  return `sms:${separator}body=${encodeURIComponent(String(message ?? ""))}`;
}

/**
 * wa.me works on phones AND on desktop (it hands off to WhatsApp Web or the
 * desktop app), which is why this one stays visible when the SMS button is
 * hidden. No recipient: WhatsApp opens its own contact picker.
 */
export function whatsappShareHref(message) {
  return `https://wa.me/?text=${encodeURIComponent(String(message ?? ""))}`;
}
