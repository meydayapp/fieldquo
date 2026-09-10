// lib/sales/numbers.js
//
// The numbers FieldQuo's own reps call from: search, buy, assign, hand back.
//
// ══ What this file is NOT ═════════════════════════════════════════════════
//
// It does not search, buy or release. lib/crew/platformNumber.js already does
// all three and has listed `sales_voice` in PLATFORM_NUMBER_PURPOSES since
// 2026-09-06, with the panel on /platform/crew-lines. A second buyer was
// written here before that was checked and deleted once it was: two ways to
// rent a phone number is the parallel system AGENTS.md warns about, and the
// copy nobody looks at is the one that ends up charging twice.
//
// What was genuinely missing is the last step — giving a bought number to a
// REP — and that is all this file holds.

/**
 * The caller ID for one rep, given the numbers FieldQuo holds.
 *
 * ── Assignment beats locality, and that is the point ─────────────────────
 *
 * chooseCallerId() in lib/sales/calls/browserDial.js picks by AREA CODE,
 * because a local number gets answered: a contractor in Buffalo answers a 716
 * and lets an unknown one ring out. That is right for a shared pool.
 *
 * It is wrong the moment a number belongs to somebody. A contractor who rings
 * back has to reach the person who rang them, and a rep whose number is
 * answered by another rep is worse off than a rep with no number at all — the
 * callback is the whole reason a rep wants one.
 *
 * So a rep with an assigned number presents it, always. A rep without one
 * falls through to the pool and the locality rule, unchanged.
 *
 * Pure over rows the caller has already read, so the check can drive it.
 */
export function callerIdForRep(salesRepId, numbers = []) {
  const rows = Array.isArray(numbers) ? numbers : [];
  const mine = salesRepId
    ? rows.find((n) => n.assignedRepId === salesRepId && n.active !== false && n.e164)
    : null;
  if (mine) return { e164: mine.e164, reason: "assigned", pool: [] };

  // Only UNASSIGNED numbers are shared. A number belonging to another rep is
  // in nobody else's pool: two reps presenting one number means a callback
  // cannot be routed to either of them.
  const pool = rows.filter((n) => !n.assignedRepId && n.active !== false && n.e164).map((n) => n.e164);
  return { e164: null, reason: pool.length ? "pool" : "none", pool };
}

/** The purpose a rep's calling number carries. See the schema comment. */
export const SALES_VOICE_PURPOSE = "sales_voice";

/**
 * Who holds a number, as one answer a screen can print.
 *
 * Two nullable columns, at most one set — see the schema comment on why that
 * beats a polymorphic holder id. This is the one place that reads the pair, so
 * every surface says the same thing about the same row.
 *
 * Returns `{ kind, id, name }` with kind "rep" | "admin" | "pool".
 */
export function holderOf(number = {}) {
  if (number.assignedRepId) {
    return { kind: "rep", id: number.assignedRepId, name: number.assignedRep?.name || "a rep" };
  }
  if (number.assignedAdminId) {
    return {
      kind: "admin",
      id: number.assignedAdminId,
      // A PlatformAdmin has an email and may have no name.
      name: number.assignedAdmin?.name || number.assignedAdmin?.email || "an admin",
    };
  }
  return { kind: "pool", id: null, name: null };
}

/**
 * What is wrong with an assignment request, or null.
 *
 * The one rule worth enforcing in code rather than in a comment: a number
 * belongs to at most one person. Two ids arriving together is a caller bug and
 * silently preferring one of them is how a number ends up answering for
 * somebody who never claimed it.
 */
export function assignmentProblem({ salesRepId = null, platformAdminId = null } = {}) {
  if (salesRepId && platformAdminId) {
    return "A number belongs to one person. Pick a rep or an admin, not both.";
  }
  return null;
}
