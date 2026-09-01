// lib/migrations/state.js
//
// The state machine for the paid data-migration service — the ONE place that
// decides which MigrationRequestStatus a transition is legal from. Every route
// under app/api/migrations/** and app/api/platform/migrations/** imports its
// answer from here rather than re-deriving it, because a rule stated twice is
// a rule that will disagree with itself the first time only one copy gets
// fixed (AGENTS.md: "the copy is the one that rots").
//
// Pure, deliberately — no db import, so scripts/check-migration-service.mjs
// can execute every edge (including the ones that must be REFUSED) without a
// database. See that script for what was mutation-tested.
//
// ── Why the write gate lives here too, not just in the write routes ────────
//
// canWrite() is the boundary that makes non-negotiable #3's exception narrow
// rather than general: a superadmin's write endpoint calls this on the
// FRESHLY-READ row immediately before writing, never on a status the caller
// remembered from an earlier request. "A migration for a company that has
// since cancelled" is exactly the case this exists to catch — cancelling is a
// real transition even from `paid` (see CANCEL_FROM below), and the write
// path must notice the instant it happens, not trust a value read a request
// ago.

export const MIGRATION_STATUSES = [
  "requested",
  "scheduled",
  "quoted",
  "accepted",
  "declined",
  "paid",
  "in_progress",
  "completed",
  "cancelled",
];

/** Terminal — nothing transitions FROM these. */
export const TERMINAL_STATUSES = new Set(["declined", "completed", "cancelled"]);

/**
 * Every legal edge, as `from -> [to, ...]`. Anything not listed is refused.
 *
 * ── Reading the shape of this on purpose ────────────────────────────────────
 *
 *   requested   -> scheduled | quoted | cancelled
 *   scheduled   -> quoted | cancelled
 *   quoted      -> accepted | declined | cancelled
 *   accepted    -> paid | cancelled
 *   paid        -> in_progress | completed | cancelled
 *   in_progress -> completed | cancelled
 *
 * Scheduling a consultation is a step toward a quote, not a hard gate in
 * front of one — a superadmin who already knows the scope from a phone call
 * outside the app may quote straight from `requested`. What IS a hard gate is
 * payment in front of any write; see canWrite() below.
 *
 * `paid -> cancelled` and `in_progress -> cancelled` exist for the case the
 * owner's brief calls out directly: a migration that WAS paid and is later
 * called off — a refund handled outside the product, a customer who backs out
 * after paying. This codebase does not issue that refund automatically (see
 * docs/MIGRATION-SERVICE.md, "what was not built"); what it guarantees is
 * that the moment status flips to `cancelled`, the write path closes, even
 * though the migration was paid a moment before.
 */
const TRANSITIONS = {
  requested: ["scheduled", "quoted", "cancelled"],
  scheduled: ["quoted", "cancelled"],
  quoted: ["accepted", "declined", "cancelled"],
  accepted: ["paid", "cancelled"],
  paid: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  declined: [],
  completed: [],
  cancelled: [],
};

/** Is `from -> to` a real edge in the state machine? */
export function canTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

/**
 * May a consultation be booked (or RE-booked) from this status?
 *
 * Deliberately not just `canTransition(status, "scheduled")` — the generic
 * graph has no self-loop (a state machine doesn't normally need one), but
 * this action does: a company that already booked a time and wants to move
 * it is still allowed to, right up until a price exists. Once `quoted`, the
 * conversation the call was FOR has already happened in spirit (a price was
 * set), so re-booking stops here rather than silently reopening a decided
 * quote's back-story.
 */
export function canSchedule(status) {
  return status === "requested" || status === "scheduled";
}

/** May a superadmin set a price from this status? */
export function canQuote(status) {
  return canTransition(status, "quoted");
}

/** May the company respond (accept or decline) from this status? */
export function canRespond(status) {
  return status === "quoted";
}

/** May the company open a Stripe Checkout session from this status? */
export function canPay(status) {
  return status === "accepted";
}

/**
 * May a superadmin write into the company's tenant right now?
 *
 * The single narrowest predicate in this file on purpose — every write route
 * calls exactly this, on a status read fresh from the database in the same
 * request that performs the write. `paid` and `in_progress` only: not
 * `accepted` (money hasn't moved), not `completed` (the superadmin declared
 * this migration finished and closed), not `cancelled` (see the TRANSITIONS
 * comment above — this is what makes `paid -> cancelled` actually revoke
 * write access rather than merely relabelling a still-writable row).
 */
export function canWrite(status) {
  return status === "paid" || status === "in_progress";
}

/**
 * May a SUPERADMIN cancel from this status? The full set — includes `paid`
 * and `in_progress`, which the company itself may not reach (see
 * canCompanyCancel below). This is the "refund handled outside the product"
 * door the brief's hostile-input case exercises: a superadmin can close write
 * access on a paid migration even though this codebase issues no Stripe
 * refund on its own.
 */
export function canCancel(status) {
  return canTransition(status, "cancelled");
}

/**
 * May the COMPANY cancel from this status? Narrower than canCancel: once
 * money has moved (`paid`/`in_progress`), backing out is a support
 * conversation about a refund, not a button — the same reasoning
 * lib/currentMember.js gives for keeping impersonation read-only rather than
 * "mostly read-only". Before payment, the company may always walk away.
 */
export function canCompanyCancel(status) {
  return canCancel(status) && status !== "paid" && status !== "in_progress";
}

/** May a superadmin mark this completed from its current status? */
export function canComplete(status) {
  return canTransition(status, "completed");
}

/**
 * May the company still upload a document? Wider than every other gate in
 * this file on purpose — a document (a QuickBooks export, a photographed
 * ledger) is USEFUL at almost every point of the conversation, including
 * before a price exists, and refusing it while a quote is still being worked
 * out would make the superadmin ask for the same file twice. Only closed once
 * the request is truly over: declined (the company said no) or cancelled
 * (withdrawn). Uploading after `completed` is still allowed deliberately —
 * a superadmin may ask for one more file to finish the last few records.
 */
export function canUploadDocument(status) {
  return status !== "declined" && status !== "cancelled";
}

/**
 * Throws a descriptive, user-safe error when `from -> to` is not a legal
 * edge. Every mutating route calls this immediately before writing the new
 * status, so "accept twice", "pay twice", "decline after paying" and "write
 * before paying" all fail with the same guard rather than four hand-rolled
 * ones that could each get the edge cases slightly differently wrong.
 */
export function assertTransition(from, to) {
  if (canTransition(from, to)) return;
  const err = new Error(
    TERMINAL_STATUSES.has(from)
      ? `This migration is already ${describeStatus(from)} and can't be changed further.`
      : `This migration is ${describeStatus(from)} — it can't move to ${describeStatus(to)} from there.`,
  );
  err.status = 409;
  throw err;
}

/** Throws unless a write is currently legal. Same 409 shape as assertTransition. */
export function assertWritable(status) {
  if (canWrite(status)) return;
  const err = new Error(
    status === "completed"
      ? "This migration is already marked completed — writes are closed."
      : status === "cancelled"
        ? "This migration was cancelled — no further writes are allowed."
        : "This migration hasn't been paid for yet — nothing can be written until it is.",
  );
  err.status = 409;
  throw err;
}

const LABELS = {
  requested: "requested",
  scheduled: "scheduled",
  quoted: "quoted",
  accepted: "accepted",
  declined: "declined",
  paid: "paid",
  in_progress: "in progress",
  completed: "completed",
  cancelled: "cancelled",
};

export function describeStatus(status) {
  return LABELS[status] || status;
}
