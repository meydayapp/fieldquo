// lib/messaging/whatsappSettingsPath.js
//
// Where the WhatsApp panel lives, as one constant.
//
// Same reason lib/social/settingsPath.js exists: the connect route, the
// callback route and the panel itself all have to agree on the URL to redirect
// back to, and three copies of a path string is the one that rots — a moved
// panel would land a returning OAuth round trip on a 404, with a granted token
// and nothing to show for it.
//
// It is the Meta Ads screen, deliberately: every Meta connection a company
// makes lives on one settings row, so a contractor learns one place rather
// than which of four holds which quarter of Meta.
export const WHATSAPP_SETTINGS_PATH = "/app/settings/meta-ads";
