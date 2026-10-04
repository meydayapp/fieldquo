// lib/platform/readOnlyRequests.js
//
// Which requests a read-only support session ("View as company") must be
// refused — the ONE list, asked by three enforcement points:
//
//   middleware.js                 the gate in front of every /app and /api
//   lib/currentMember.js          assertReadOnly, the deliberate second gate
//   lib/impersonation/viewOnly.js the browser's guard, which stops the
//                                 request before it leaves and says "View
//                                 only" instead of a red 403 (2026-10-03)
//
// Moved here from lib/platform/impersonationToken.js (which re-exports both
// functions, so its importers are unchanged) because that module imports
// jose for the JWT, and the browser guard must not ship a JWT library to
// every /app page to read a list of paths. Import-free on purpose.

/** HTTP methods a read-only support session may use. */
export function isReadOnlyMethod(method) {
  return ["GET", "HEAD", "OPTIONS"].includes(
    String(method || "GET").toUpperCase(),
  );
}

/**
 * GETs that ACT for the company rather than read it: each starts or finishes
 * an OAuth hand-off whose end state is a connection saved into the company
 * (a Google calendar or Business Profile, a Facebook page, a WhatsApp number,
 * a Meta ad account), mints a Stripe onboarding link on its connected
 * account, or settles a Stripe Checkout return onto its balance.
 *
 * The method gate cannot see them. Until a superadmin's read-only session
 * resolved to the company owner's membership (lib/currentMember.js), a role
 * check the "viewer" stub failed refused them by accident; with owner-level
 * reads those role checks pass, so the refusal is stated here, on purpose,
 * and BOTH enforcement points — middleware.js and assertReadOnly — consult
 * this one list. Exact paths rather than a /connect|callback/ pattern:
 * /api/stripe/connect/status is a plain read. The mailbox connect/callback
 * routes are not listed: they already refuse a support session themselves,
 * with a redirect back to the settings page.
 */
export const WRITE_SHAPED_GET_PATHS = new Set([
  "/api/calendar/google/connect",
  "/api/calendar/google/callback",
  "/api/reviews/google/connect",
  "/api/reviews/google/callback",
  "/api/settings/social/connect",
  "/api/settings/social/callback",
  "/api/settings/whatsapp/connect",
  "/api/settings/whatsapp/callback",
  "/api/meta-ads/callback",
  "/api/tiktok/connect",
  "/api/tiktok/callback",
  "/api/stripe/connect/refresh",
  "/api/settings/voice/topup",
  "/api/settings/voice/auto-topup",
]);

/** Is this a GET a read-only support session must be refused like a write? */
export function isWriteShapedGet(pathname) {
  return WRITE_SHAPED_GET_PATHS.has(String(pathname || "").replace(/\/+$/, ""));
}
