// lib/sales/outreachPipeline.js
//
// SalesLead.status, and the two rules about it.
//
// ══ Why this is not in lib/sales/outreach.js ═══════════════════════════════
//
// The pipeline statuses are needed by the API routes AND by the screens that
// render them, and lib/sales/outreach.js imports node:crypto — for the token
// generator and the timing-safe secret check, both of which are server-only by
// nature. A "use client" component importing that module drags node:crypto into
// the browser bundle and fails the build.
//
// The alternative was to retype the five statuses and their labels in the two
// client components, which is exactly the copy-paste duplication AGENTS.md
// lists as a recurring failure class — and the copy that rots would be the one
// on screen, quietly showing a status the server no longer accepts. So the list
// moves down into a module with no imports at all, and both sides read the same
// five strings.
//
// lib/sales/outreach.js re-exports these so server code has one import to
// remember.

/** In pipeline order. The SalesLead header in prisma/schema.prisma is the authority. */
export const LEAD_STATUSES = ["new", "contacted", "demoed", "signed", "lost"];

export const LEAD_STATUS_LABELS = {
  new: "New",
  contacted: "Contacted",
  demoed: "Demoed",
  signed: "Signed",
  lost: "Lost",
};

export function isLeadStatus(value) {
  return LEAD_STATUSES.includes(value);
}

/**
 * The status a lead should be in after we successfully send to it.
 *
 * Only `new` moves. A lead already at `demoed` does not fall back to
 * `contacted` because the rep chased it again — a pipeline stage that walks
 * backwards on an ordinary action is a stage nobody trusts. And `signed` /
 * `lost` are the rep's own judgement; an email is not evidence against either.
 */
export function statusAfterSend(status) {
  return status === "new" ? "contacted" : status;
}
