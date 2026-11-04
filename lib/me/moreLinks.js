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
// policies it points at, then their own documents — and last, notes from
// their manager, which arrive later and keep arriving.
//
// ── Why notes is a row (2026-11-04) ─────────────────────────────────────────
//
// /app/me/notes had exactly one way in: the notification a new note sends
// (lib/notifications/render.js). Miss it, dismiss it, or read it on a phone
// that was off, and there was no route back to your own write-ups — on the one
// screen in the product that asks the employee to ACKNOWLEDGE something. The
// nav audit's allowlist excused the page as "reached from the note
// notification and the home banner"; there is no home banner, for notes or for
// policies (WorkerHome.js links to neither), so the excuse was half true and
// the half that was true is not a menu.
//
// It also gives `notesPending` its first reader. /api/hr/me/summary has
// computed and returned that count since the HR module landed, and nothing
// anywhere displayed it — the written-and-never-read failure class AGENTS.md
// lists first. The other three counts here each had a row to sit on; this one
// did not, which is exactly why nobody noticed the page had no row either.
export const HR_MORE_LINKS = Object.freeze([
  { href: "/app/me/onboarding", labelKey: "app.hr.me.onboarding", icon: "ClipboardCheck", badge: "onboardingOpen" },
  { href: "/app/me/policies", labelKey: "app.hr.me.policies", icon: "ScrollText", badge: "policiesPending" },
  { href: "/app/me/documents", labelKey: "app.hr.me.documents", icon: "FileBadge", badge: "documentsExpiring" },
  { href: "/app/me/notes", labelKey: "app.hr.me.notes", icon: "MessageSquareWarning", badge: "notesPending" },
]);

export default HR_MORE_LINKS;
