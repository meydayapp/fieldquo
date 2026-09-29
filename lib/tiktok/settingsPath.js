// lib/tiktok/settingsPath.js
//
// TikTok's own settings screen. Its own page and sidebar row (directly under
// Meta Ads), not a card on the Meta screen: TikTok is not a Meta account, and
// the owner asked for it to be findable by its own name. The connect and
// callback routes bounce the browser back here, the page strips its own query
// string with it, and the composer links here to reconnect. A file of its own
// because the composer is a client component and lib/tiktok/config.js is not
// client-safe (it imports node:crypto through the token helper).
export const TIKTOK_SETTINGS_PATH = "/app/settings/tiktok";
