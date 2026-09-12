// docs/sales/manual/figures.js
//
// Figure keys for the sales-portal training manual → candidate files, in
// order of preference. The first candidate that exists is embedded; a `*`
// is a glob against the directory listing (first match in name order), and
// `{lang}` is the language of the manual being built. When none exists the
// builder draws a "screenshot to follow" box in the figure's place.
//
// ══ Three tiers of candidate ══════════════════════════════════════════════
//
// 1. docs/screens/live/sales/<lang>/<route-slug>.png — captures of the LIVE
//    portal from the owner's signed-in session (slug = the route with its
//    leading slash dropped and "/" → "-": /sales/pay → sales-pay.png). They
//    are listed first, per language, wherever the figure IS the whole route
//    as it opens; a key whose picture is a scrolled or pressed state of a
//    page (the language settings low on the Pay tab, say) does not list a
//    live capture, because the live file would be the wrong picture.
// 2. docs/screens/sales-portal/NN-<key>.<lang>.png — the real page
//    components rendered inside the real SalesShell against fixture data
//    that follows the manual's worked example (Daniel, Easy Roofers Inc.),
//    in en/fr/es. See docs/screens/sales-portal/harness/.
// 3. The older fixture renders of the queue console (docs/screens/
//    sales-console), Texts (sales-messages), Team (team-chat), and the
//    public site captured from production (docs/screens/public) — English.
//
// Rebuilding picks up whichever tier exists with no edit here. A key whose
// only candidates are absent stays a placeholder — never a wrong picture
// standing in for the right one.
//
// The globs are deliberately narrow: `*leads*` would also match
// 10-my-leads and hand the console's Leads tab the wrong screen.
//
// Captions are in the content modules, per language; this file is paths.
const LIVE = (slug) => `docs/screens/live/sales/{lang}/${slug}.png`;
const PORTAL = (name) => [`docs/screens/sales-portal/*-${name}.{lang}.png`, `docs/screens/sales-portal/*-${name}.en.png`];

export const FIGURES = {
  // Chapter 1 — your account
  "login": ["docs/screens/sales-portal/*sales-login*.png", "docs/screens/public/08-sales-login.png"],
  // 2026-09-12: the language pickers moved from Pay to their own Settings
  // tab; the figure follows them. docs/screens/sales-settings/ is shot by
  // that folder's harness; the old pay-languages screenshot stays as a
  // fallback until the per-language settings shots exist.
  "settings": ["docs/screens/sales-settings/settings-1280.{lang}.png", "docs/screens/sales-settings/settings-1280.png", ...PORTAL("pay-languages")],
  "pay-languages": PORTAL("pay-languages"),

  // Chapter 2 — demo account
  "demo": [LIVE("sales-demo"), ...PORTAL("demo")],

  // Chapter 3 — the console
  "console-idle": [LIVE("sales-queue"), "docs/screens/sales-console/desktop-idle.png"],
  "console-status": ["docs/screens/sales-console/desktop-status-menu.png"],
  "console-call": ["docs/screens/sales-console/desktop-call.png"],
  "console-typed": ["docs/screens/sales-console/desktop-typed.png"],
  "console-typed-refused": ["docs/screens/sales-console/desktop-typed-refused.png"],
  "console-tab-company": ["docs/screens/sales-console/desktop-tab-company.png"],
  "console-tab-contact": ["docs/screens/sales-console/desktop-tab-contact.png"],
  "console-tab-research": ["docs/screens/sales-console/desktop-tab-research.png"],
  "console-tab-disposition": ["docs/screens/sales-console/desktop-tab-disposition.png"],
  "console-tab-tasks": ["docs/screens/sales-console/desktop-tab-tasks.png"],
  "console-tab-leads": ["docs/screens/sales-console/desktop-tab-leads.png"],
  "console-rail": ["docs/screens/sales-console/desktop-rail-expanded.png"],
  "console-mobile": ["docs/screens/sales-console/mobile-idle.png"],

  // Chapter 4 — claiming
  "queue-zone-pt": ["docs/screens/sales-console/desktop-zone-pt.png"],
  "queue-top-up": ["docs/screens/sales-console/desktop-top-up.png"],
  "queue-all-shut": ["docs/screens/sales-console/desktop-all-shut.png"],

  // Chapter 6 — incoming calls
  "ring": ["docs/screens/sales-console/desktop-ring.png"],
  "ring-answered": ["docs/screens/sales-console/desktop-ring-answered.png"],
  "voicemail": [LIVE("sales-voicemail"), ...PORTAL("voicemail")],

  // Chapter 7 — texts
  "texts-thread": [LIVE("sales-messages"), "docs/screens/sales-messages/desktop-thread-bottom.png"],
  "texts-canned": ["docs/screens/sales-messages/desktop-canned.png"],
  "texts-suppressed": ["docs/screens/sales-messages/desktop-suppressed.png"],
  "texts-new-text-refused": ["docs/screens/sales-messages/desktop-new-text-refused.png"],
  "texts-new-text-accepted": ["docs/screens/sales-messages/desktop-new-text-accepted.png"],
  "texts-mobile": ["docs/screens/sales-messages/mobile-thread.png"],

  // Chapter 8 — after a signup
  "signup-link-page": ["docs/screens/public/05-signup-sales.png"],
  "company-checkin": ["docs/screens/sales-messages/desktop-company-checkin.png"],
  "my-companies": [LIVE("sales-companies"), ...PORTAL("my-companies")],

  // Chapter 9 — team chat
  "team-sales": [LIVE("sales-team"), "docs/screens/team-chat/sales-1280.png"],
  "team-group": ["docs/screens/team-chat/group-1280.png"],
  "team-mention": ["docs/screens/team-chat/mention-1280.png"],

  // Chapter 10 — the rest of the portal
  "today": [LIVE("sales"), ...PORTAL("today")],
  "my-leads": [LIVE("sales-leads"), ...PORTAL("my-leads")],
  "my-lead-detail": PORTAL("my-lead-detail"),
  "calendar": [LIVE("sales-calendar"), ...PORTAL("calendar")],
  "notes": [LIVE("sales-notes"), ...PORTAL("notes")],
  "note-open": PORTAL("note-open"),
  "playbook": [LIVE("sales-playbook"), ...PORTAL("playbook")],
  "support": [LIVE("sales-support"), ...PORTAL("support")],
  "pay": [LIVE("sales-pay"), ...PORTAL("pay-earnings")],

  // Chapter 12 — resources (public site, captured from production)
  "public-home": ["docs/screens/public/00-home.png"],
  "public-pricing": ["docs/screens/public/01-pricing.png"],
  "public-features": ["docs/screens/public/02-features.png"],
  "public-help": ["docs/screens/public/03-help.png"],
  "public-contact": ["docs/screens/public/04-contact.png"],
};
