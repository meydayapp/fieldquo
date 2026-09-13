// lib/site/access.js
//
// Who may change the company's website: an owner or an admin, nobody else.
//
// ── One rule, in one place ─────────────────────────────────────────────────
//
// app/api/settings/website/route.js gated on `user:manage`, which a supervisor
// holds; languages/route.js and photos/route.js beside it each carried their
// own `isAdmin(role)` asking for owner-or-admin. A supervisor could therefore
// open the builder, save, publish — and be refused the moment they added a
// language or a photo, which is a control that appears to work and doesn't.
// The parent route's own header always said "owners and admins only"; this
// makes the code say it too, once, and lib/permissions/settingsAccess.js's
// "owner-admin" row on app.settings.website hides the sidebar entry from
// exactly the people these routes refuse.
//
// Not `can(role, "user:manage")` on purpose: PERMISSIONS.owner/admin are ["*"]
// so that would also pass for them — and for a supervisor, which is the bug.
// A published page is the company's public face; running a crew does not
// carry the authority to rewrite it.

export function isWebsiteAdmin(role) {
  return role === "owner" || role === "admin";
}
