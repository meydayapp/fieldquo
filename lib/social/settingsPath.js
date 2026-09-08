// lib/social/settingsPath.js
//
// Where a contractor manages the Facebook/Instagram publishing connection —
// one constant, because four files need to agree on it: the connect route and
// the callback route both bounce the browser back here after Meta, the
// disconnect flow reloads it, and the panel itself strips its own query
// string with it.
//
// It is a section of the Meta Ads settings screen rather than a screen of its
// own: both cards are "a Meta account this company connects", they sit under
// the same sidebar row, and a second row would have split one integration
// across two places a contractor has to know to look in. Change it here and
// the redirects follow.
export const SOCIAL_SETTINGS_PATH = "/app/settings/meta-ads";
