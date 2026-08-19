// scripts/check-share-links.mjs
//
// Exercises lib/share/messagingLinks.js against the input that actually breaks
// it: referral URLs with query strings, UA strings that lie about the device,
// and the empty/missing message. Run with plain node.
//
//   node scripts/check-share-links.mjs

import {
  isIosLike,
  canSendSms,
  detectMessagingCapability,
  smsShareHref,
  whatsappShareHref,
} from "../lib/share/messagingLinks.js";

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `\n      got:      ${actual}\n      expected: ${expected}`}`);
}

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const MAC = IPAD_DESKTOP_UA;
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ── platform detection ─────────────────────────────────────────────────────
check("iPhone is iOS-like", isIosLike(IPHONE, 5), true);
check("iPad reporting desktop UA is iOS-like", isIosLike(IPAD_DESKTOP_UA, 5), true);
check("real Mac is not iOS-like", isIosLike(MAC, 0), false);
check("Android is not iOS-like", isIosLike(ANDROID, 5), false);
check("Windows is not iOS-like", isIosLike(WINDOWS, 0), false);
check("missing UA is not iOS-like", isIosLike(undefined, undefined), false);

// ── capability ─────────────────────────────────────────────────────────────
const phoneWindow = {
  navigator: { userAgent: IPHONE, maxTouchPoints: 5 },
  matchMedia: (q) => ({ matches: q === "(hover: none) and (pointer: coarse)" }),
};
const desktopWindow = {
  navigator: { userAgent: WINDOWS, maxTouchPoints: 0 },
  matchMedia: () => ({ matches: false }),
};
// A laptop with a touchscreen: coarse pointer available, but hover works, so
// the media query does not match and we must not offer SMS.
const touchLaptopWindow = {
  navigator: { userAgent: WINDOWS, maxTouchPoints: 10 },
  matchMedia: () => ({ matches: false }),
};
check("phone can text", canSendSms(phoneWindow), true);
check("desktop cannot text", canSendSms(desktopWindow), false);
check("touch laptop cannot text", canSendSms(touchLaptopWindow), false);
check("no window (SSR) cannot text", canSendSms(undefined), false);
check("window without matchMedia cannot text", canSendSms({}), false);

check("SSR capability canText", detectMessagingCapability(null).canText, false);
check("SSR capability iosStyle", detectMessagingCapability(null).iosStyle, false);
check("iPhone capability iosStyle", detectMessagingCapability(phoneWindow).iosStyle, true);
check("iPhone capability canText", detectMessagingCapability(phoneWindow).canText, true);
check(
  "window with no navigator does not throw",
  detectMessagingCapability({ matchMedia: () => ({ matches: true }) }).iosStyle,
  false,
);

// ── href building ──────────────────────────────────────────────────────────
//
// The real message: a sentence, then a URL that itself carries a query string.
// Unencoded, everything from the first `&` is lost.
const URL_WITH_QUERY = "https://fieldquo.com/refer/acme-painting?src=app&utm=share";
const MESSAGE = `Try FieldQuo — I use it for my quotes & invoices, and you get 3 months free: ${URL_WITH_QUERY}`;

const ios = smsShareHref(MESSAGE, { iosStyle: true });
const android = smsShareHref(MESSAGE, { iosStyle: false });

check("iOS uses & separator", ios.startsWith("sms:&body="), true);
check("Android uses ? separator", android.startsWith("sms:?body="), true);
check("no stray ?& hybrid", ios.includes("sms:?&") || android.includes("sms:?&"), false);

// Exactly one unencoded `&` on iOS (the separator) and none on Android: any
// more means the body is being cut in the middle of the referral URL.
check("iOS body carries one raw &", (ios.match(/&/g) || []).length, 1);
check("Android body carries no raw &", (android.match(/&/g) || []).length, 0);
check("Android carries one raw ?", (android.match(/\?/g) || []).length, 1);
check("iOS carries no raw ?", (ios.match(/\?/g) || []).length, 0);

// Round-trip: what the messaging app would decode must be the whole message.
const decoded = decodeURIComponent(ios.slice("sms:&body=".length));
check("iOS body round-trips intact", decoded, MESSAGE);
check(
  "Android body round-trips intact",
  decodeURIComponent(android.slice("sms:?body=".length)),
  MESSAGE,
);

const wa = whatsappShareHref(MESSAGE);
check("WhatsApp href prefix", wa.startsWith("https://wa.me/?text="), true);
check(
  "WhatsApp body round-trips intact",
  decodeURIComponent(wa.slice("https://wa.me/?text=".length)),
  MESSAGE,
);
check("WhatsApp carries one raw ?", (wa.match(/\?/g) || []).length, 1);
check("WhatsApp carries no raw &", (wa.match(/&/g) || []).length, 0);

// Hostile / empty input: a link is still well-formed rather than "sms:?body=undefined".
check("undefined message", smsShareHref(undefined, { iosStyle: true }), "sms:&body=");
check("null message", whatsappShareHref(null), "https://wa.me/?text=");
check("no options object", smsShareHref("hi"), "sms:?body=hi");
const emoji = smsShareHref("50% off 🎉 #deal", { iosStyle: false });
check("percent/hash/emoji encoded", emoji, "sms:?body=50%25%20off%20%F0%9F%8E%89%20%23deal");
check("emoji round-trips", decodeURIComponent(emoji.slice("sms:?body=".length)), "50% off 🎉 #deal");
check("newline encoded", smsShareHref("a\nb"), "sms:?body=a%0Ab");

console.log(failures === 0 ? "\nAll share-link checks passed." : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
