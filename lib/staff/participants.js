// lib/staff/participants.js
//
// Who a staff participant IS, when there are two kinds of them.
//
// ══ Why a pair and not one id ═════════════════════════════════════════════
//
// FieldQuo has two staff sign-ins that are not going to merge: platform admins
// are `User` rows behind getCurrentPlatformAdmin, and sales reps are `SalesRep`
// rows with their own password, their own session and their own portal. A
// staff conversation has to hold both, so every participant row carries a
// nullable PAIR — userId or salesRepId — and this module is the only place
// that reads which one is filled.
//
// The alternative was a synthetic StaffIdentity table joining the two. It was
// rejected because it buys one column and costs referential integrity: with
// the pair, a deleted rep's memberships and authored rows are reachable by the
// database and go with them, and a row can never point at an identity that
// points at nothing.
//
// Pure. No imports, no I/O — scripts/check-staff-chat.mjs drives every branch,
// and a client component can import it without pulling `db` into the bundle
// (the mistake that broke the build on lib/sales/earnings.js this same day).

/** The two kinds, named once so nothing spells them itself. */
export const PARTICIPANT_KINDS = ["user", "rep"];

/**
 * Read the pair off any row that carries one — a membership, a message author,
 * or a viewer the gate resolved.
 *
 * Returns null when NEITHER is set, which is a broken row and must not be
 * silently treated as one kind or the other. Returns null when BOTH are set
 * too: that is a row nobody can attribute, and picking one would put words in
 * somebody's mouth.
 */
export function participantOf(row, { userField = "platformAdminId", repField = "salesRepId" } = {}) {
  if (!row || typeof row !== "object") return null;
  const userId = row[userField] || null;
  const repId = row[repField] || null;
  if (userId && repId) return null;

  if (userId) return { kind: "user", id: userId };
  if (repId) return { kind: "rep", id: repId };
  return null;
}

/** The same two participants are the same participant. */
export function sameParticipant(a, b) {
  return Boolean(a && b && a.kind === b.kind && a.id === b.id);
}

/**
 * A stable key for a direct pair.
 *
 * Sorted, so opening a DM from either side produces the SAME string, and the
 * column is unique — so two people pressing "message" on each other at the
 * same instant get one room because the database refuses the second, not
 * because a read-then-write happened to win. That is the same discipline
 * commissionRef uses for exactly-once earnings.
 *
 * Returns null for a pair with itself: a note-to-self room is a different
 * feature and must not be created by accident.
 */
export function directRoomKey(a, b) {
  if (!a?.kind || !a?.id || !b?.kind || !b?.id) return null;
  if (sameParticipant(a, b)) return null;

  const one = `${a.kind}:${a.id}`;
  const two = `${b.kind}:${b.id}`;
  return [one, two].sort().join("|");
}

/**
 * A display name, from whichever side of the pair is loaded.
 *
 * Never invents one. A participant whose row could not be loaded reads as
 * "Someone at FieldQuo" rather than as an id or an empty string — an id in a
 * conversation is worse than an honest placeholder, and an empty name renders
 * as a gap the reader has to guess at.
 */
export function participantName(row, { userField = "platformAdmin", repField = "salesRep" } = {}) {
  const user = row?.[userField];
  const rep = row?.[repField];
  const name = user?.name || user?.email || rep?.name || rep?.email || null;
  return name || "Someone at FieldQuo";
}

/**
 * Two letters for an avatar, matching what the SMS thread already draws.
 *
 * Deliberately the same rule, because the two surfaces sit one tab apart and a
 * person whose initials change between them reads as two people.
 */
export function participantInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "–";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
