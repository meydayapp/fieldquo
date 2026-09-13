// lib/me/moreLinks.js
//
// Rows for the employee home's "More" tab that belong to the HR module.
//
// The employee shell (app/components/me/*) is another piece of work; this
// file is the seam between the two. The shell reads this list if it exists
// and draws one row per entry; the HR pages here need nothing from the
// shell beyond being linked. Keep the shape flat: an href, a label KEY (the
// shell translates through useTranslation), a lucide icon name as a
// string (so this file has no React import and can be read by a check
// script), and an optional `badge` — the name of a count in the
// /api/hr/me/summary payload the shell may show beside the row.
//
// Order is the order a new hire meets them: the checklist first, then the
// policies it points at, then their own documents.
export const HR_MORE_LINKS = Object.freeze([
  { href: "/app/me/onboarding", labelKey: "app.hr.me.onboarding", icon: "ClipboardCheck", badge: "onboardingOpen" },
  { href: "/app/me/policies", labelKey: "app.hr.me.policies", icon: "ScrollText", badge: "policiesPending" },
  { href: "/app/me/documents", labelKey: "app.hr.me.documents", icon: "FileBadge", badge: "documentsExpiring" },
]);

export default HR_MORE_LINKS;
