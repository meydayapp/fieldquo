// docs/sales/manual/figures.js
//
// Figure keys for the sales-portal training manual → candidate files, in
// order of preference. The first candidate that exists is embedded; a `*`
// is a glob against the directory listing. When none exists the builder
// draws a "screenshot to follow" box in the figure's place.
//
// ══ Why two tiers of candidate ════════════════════════════════════════════
//
// docs/screens/sales-portal/ is meant to hold captures of the LIVE portal
// (signed in, production data, every tab). It was empty when this manual
// was first built — the capture needs a signed-in Chrome profile the owner
// had not provided (see that folder's README). The frames that DO exist are
// the real components rendered against fixtures: docs/screens/sales-console
// (the /sales/queue console), docs/screens/sales-messages (Texts),
// docs/screens/team-chat, and docs/screens/public (the marketing site and
// the two login pages, captured from production with no session).
//
// So every key lists the eventual live capture first, by the name the
// sales-portal README says it will carry, and the fixture render second.
// When the live captures land, rebuilding picks them up with no edit here.
// A key whose only candidates are live captures stays a placeholder until
// then — never a wrong picture standing in for the right one.
//
// Captions are in the content modules, per language; this file is paths.
export const FIGURES = {
  // Chapter 1 — your account
  "login": ["docs/screens/sales-portal/*sales-login*.png", "docs/screens/public/08-sales-login.png"],
  "pay-languages": ["docs/screens/sales-portal/*pay*.png"],

  // Chapter 2 — demo account
  "demo": ["docs/screens/sales-portal/*demo*.png"],

  // Chapter 3 — the console
  "console-idle": ["docs/screens/sales-portal/*queue*.png", "docs/screens/sales-console/desktop-idle.png"],
  "console-status": ["docs/screens/sales-portal/*status*.png", "docs/screens/sales-console/desktop-status-menu.png"],
  "console-call": ["docs/screens/sales-console/desktop-call.png"],
  "console-typed": ["docs/screens/sales-console/desktop-typed.png"],
  "console-typed-refused": ["docs/screens/sales-console/desktop-typed-refused.png"],
  "console-tab-company": ["docs/screens/sales-portal/*company*.png", "docs/screens/sales-console/desktop-tab-company.png"],
  "console-tab-contact": ["docs/screens/sales-portal/*contact*.png", "docs/screens/sales-console/desktop-tab-contact.png"],
  "console-tab-research": ["docs/screens/sales-portal/*research*.png", "docs/screens/sales-console/desktop-tab-research.png"],
  "console-tab-disposition": ["docs/screens/sales-portal/*disposition*.png", "docs/screens/sales-console/desktop-tab-disposition.png"],
  "console-tab-tasks": ["docs/screens/sales-portal/*tasks*.png", "docs/screens/sales-console/desktop-tab-tasks.png"],
  "console-tab-leads": ["docs/screens/sales-portal/*leads*.png", "docs/screens/sales-console/desktop-tab-leads.png"],
  "console-rail": ["docs/screens/sales-console/desktop-rail-expanded.png"],
  "console-mobile": ["docs/screens/sales-console/mobile-idle.png"],

  // Chapter 4 — claiming
  "queue-zone-pt": ["docs/screens/sales-portal/*zone*.png", "docs/screens/sales-console/desktop-zone-pt.png"],
  "queue-top-up": ["docs/screens/sales-console/desktop-top-up.png"],
  "queue-all-shut": ["docs/screens/sales-console/desktop-all-shut.png"],

  // Chapter 6 — incoming calls
  "ring": ["docs/screens/sales-console/desktop-ring.png"],
  "ring-answered": ["docs/screens/sales-console/desktop-ring-answered.png"],
  "voicemail": ["docs/screens/sales-portal/*voicemail*.png"],

  // Chapter 7 — texts
  "texts-thread": ["docs/screens/sales-portal/*texts-thread*.png", "docs/screens/sales-messages/desktop-thread-bottom.png"],
  "texts-canned": ["docs/screens/sales-messages/desktop-canned.png"],
  "texts-suppressed": ["docs/screens/sales-messages/desktop-suppressed.png"],
  "texts-new-text-refused": ["docs/screens/sales-messages/desktop-new-text-refused.png"],
  "texts-new-text-accepted": ["docs/screens/sales-messages/desktop-new-text-accepted.png"],
  "texts-mobile": ["docs/screens/sales-messages/mobile-thread.png"],

  // Chapter 8 — after a signup
  "signup-link-page": ["docs/screens/public/05-signup-sales.png"],
  "company-checkin": ["docs/screens/sales-messages/desktop-company-checkin.png"],
  "my-companies": ["docs/screens/sales-portal/*companies*.png"],

  // Chapter 9 — team chat
  "team-sales": ["docs/screens/sales-portal/*team*.png", "docs/screens/team-chat/sales-1280.png"],
  "team-group": ["docs/screens/team-chat/group-1280.png"],
  "team-mention": ["docs/screens/team-chat/mention-1280.png"],

  // Chapter 10 — the rest of the portal
  "today": ["docs/screens/sales-portal/*today*.png"],
  "my-leads": ["docs/screens/sales-portal/*my-leads*.png"],
  "calendar": ["docs/screens/sales-portal/*calendar*.png"],
  "notes": ["docs/screens/sales-portal/*notes*.png"],
  "playbook": ["docs/screens/sales-portal/*playbook*.png"],
  "support": ["docs/screens/sales-portal/*support*.png"],
  "pay": ["docs/screens/sales-portal/*pay*.png"],

  // Chapter 12 — resources (public site, captured from production)
  "public-home": ["docs/screens/public/00-home.png"],
  "public-pricing": ["docs/screens/public/01-pricing.png"],
  "public-features": ["docs/screens/public/02-features.png"],
  "public-help": ["docs/screens/public/03-help.png"],
  "public-contact": ["docs/screens/public/04-contact.png"],
};
