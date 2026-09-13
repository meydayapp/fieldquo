// scripts/forbidden-claims.mjs
//
// The sentences no public page may say, in one place.
//
// ══ Why a shared module, and why it is under scripts/ ══════════════════════
//
// check-feature-matrix.mjs and check-feature-pages.mjs each carried their own
// copy of this list, and check-product-pages.mjs was about to be the third.
// Three copies of a ban is three places for a pattern to be added to two of
// and forgotten in one — the copy-paste failure AGENTS.md names, applied to
// the thing that polices copy-paste.
//
// It lives beside the checkers and NOT in the data it polices, for the reason
// both of those files record in their headers: a ban that ships inside the
// file it guards gets edited away in the same commit that breaks it. A matrix
// entry cannot reach in here to un-ban itself.
//
// ══ The lists ══════════════════════════════════════════════════════════════
//
//   FORBIDDEN_CLAIMS   what FieldQuo does not have, per the owner: a phone
//                      application to install, and a demo a visitor can start.
//                      Applied to the matrix's own strings and to every
//                      rendered marketing page.
//   FORBIDDEN_PAGE_CLAIMS
//                      the same, plus the things a feature PAGE invents by
//                      itself because every competitor's page has them: an
//                      accounting or automation integration, and change
//                      orders. The matrix is not scanned for these — an
//                      exclusion's subject may legitimately name QuickBooks
//                      to say it is not integrated.
//   OVERSTATED         three phrases from the first version of
//                      app/data/productFeatures.js that read as true and were
//                      not. Named so the wording cannot be lifted back in.
//   JARGON             our vocabulary. A page written in it has failed at the
//                      only job it has.

export const FORBIDDEN_CLAIMS = Object.freeze([
  [/mobile app/i, "a mobile app"],
  [/native app/i, "a native app"],
  [/\bapp store\b/i, "the App Store"],
  [/google play/i, "Google Play"],
  [/\b(ios|android)\b/i, "iOS or Android"],
  [/download (the|our) app/i, "downloading an app"],
  [/\bdemos?\b/i, "a demo"],
  [/see it in action/i, "a demo, by another name"],
  [/\bsandbox\b/i, "a sandbox"],
]);

export const FORBIDDEN_PAGE_CLAIMS = Object.freeze([
  ...FORBIDDEN_CLAIMS,
  [/quickbooks/i, "QuickBooks"],
  [/\bxero\b/i, "Xero"],
  [/zapier/i, "Zapier"],
  [/change orders?\b/i, "change orders"],
]);

export const OVERSTATED = Object.freeze([
  [/every version tracked/i, '"every version tracked"'],
  [/reminders by email and text/i, '"reminders by email and text"'],
  [/pay contractors directly/i, '"pay contractors directly"'],
]);

export const JARGON = Object.freeze([
  "webhook", "endpoint", "schema", "prisma", "cron", "middleware", "boolean",
  "json", "api route", "tenant", "multi-tenant", "crud",
]);
