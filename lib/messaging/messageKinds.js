// lib/messaging/messageKinds.js
//
// What a row in a conversation IS, and the one question the send path asks.
//
// ══ Four kinds in one column, and why not two columns ══════════════════════
//
// Chatwoot separates `message_type` (incoming / outgoing / activity /
// template) from `private`. We kept one axis for the first three because of
// what every measurement in this feature is written as:
//
//     messages.filter((m) => m.direction === "out")
//
// That line appears in lib/messaging/monthlyReview.js (the reply time), in
// lib/messaging/ingest.js (the delivery watermark) and in the inbox preview.
// If an internal note or a system line were filed as "out", every one of them
// would count it as an answer the homeowner received. Widening `direction`
// means they are excluded by construction, not by everybody remembering to
// add `&& !m.private` in six places — and the sixth is always the one that
// gets forgotten.
//
// `private` is kept as its own boolean anyway, and NOT derived from
// `direction` at write time, because it is what the send path reads. Two
// independent facts have to be wrong before a note can reach a homeowner.
// That is the same deliberate doubling AGENTS.md non-negotiable #2 describes
// for impersonation: hiding a button is not access control, and neither is a
// single string comparison standing between a private note and Meta.
//
// Pure and dependency-free: the routes, the UI and scripts/check-messaging.mjs
// all resolve one list.

/** Every value Message.direction may hold. */
export const MESSAGE_DIRECTIONS = Object.freeze(["in", "out", "note", "activity"]);

/** The two that are a real message between two people. */
export const CONVERSATION_DIRECTIONS = Object.freeze(["in", "out"]);

export function normaliseDirection(value) {
  return MESSAGE_DIRECTIONS.includes(value) ? value : undefined;
}

/**
 * The row a private note is written as. ONE constructor, so `direction` and
 * `private` cannot be set inconsistently by a caller who sets one and forgets
 * the other — which is the failure mode of keeping two columns for one fact.
 */
export function noteRowFields() {
  return { direction: "note", private: true };
}

/** The row an activity line is written as. Never private, never sendable. */
export function activityRowFields() {
  return { direction: "activity", private: false };
}

/**
 * The invariant the two columns have to keep, as a predicate rather than as a
 * comment: "note" means private, and nothing else does. Executed against
 * fixtures by scripts/check-messaging.mjs, including the hand-built rows a
 * future route might get wrong.
 */
export function kindIsConsistent(message = {}) {
  const isNote = message.direction === "note";
  return isNote === (message.private === true);
}

/**
 * MAY THIS ROW LEAVE THE BUILDING?
 *
 * The only question lib/messaging/metaSend.js asks before it looks at a
 * channel, a token or a recipient. Both halves are checked, and the answer for
 * anything that is not a plain outbound message is no:
 *
 *   * private       — a note. Never, under any circumstance.
 *   * not "out"     — an inbound echo or a system line. Sending one back would
 *                     re-post the homeowner's own words to them.
 *
 * Returns a REASON rather than a boolean so the refusal that comes back names
 * which of the two stopped it — "channel_not_connected" and "you tried to send
 * a private note" are different conversations with support.
 */
export function sendRefusalReason(message = {}) {
  if (message.private === true) return "private_note";
  if (message.direction !== undefined && message.direction !== "out") return "not_outbound";
  return null;
}

/** Convenience for the readable half of the same question. */
export function isSendable(message = {}) {
  return sendRefusalReason(message) === null;
}

/**
 * Does this row count as a reply the homeowner actually received?
 *
 * The definition lib/messaging/monthlyReview.js and lib/messaging/waiting.js
 * both need, in one place: outbound, not a note, not a system line, and not a
 * send that failed. A failed reply is stored so the screen can say it failed;
 * counting it as an answer would report a response nobody got.
 */
export function isDeliveredReply(message = {}) {
  return message.direction === "out" && message.private !== true && !message.failedReason;
}
