// lib/sales/messages/rooms.js
//
// The four buckets a rep's text conversations fall into, decided once.
//
// ══ The order is the rep's priority, and it is fixed ══════════════════════
//
//   Needs a reply    the last message is theirs. Somebody is waiting.
//   Waiting on them  the last message is ours. Nothing to do but wait.
//   Drafts due       an unsent check-in exists for this contact. The next
//                    action is ours, but it is written already.
//   Done             the rep filed it, and nobody has written since.
//
// A conversation is in exactly ONE bucket, tested in the order written:
// "done" first, because a filed conversation with an old draft attached is
// still filed; then "they wrote last", because a person waiting outranks a
// draft the rep can send any time; then the draft; then waiting.
//
// Pure — a list in, buckets out — so scripts/check-sales-messages.mjs drives
// every rule with fixtures rather than trusting four sentences of prose.
/**
 * Is the thread done, given when the other side last wrote?
 *
 * Pure, and HERE rather than in readState.js, because this module is
 * imported by the screen (a client bundle) and readState.js imports the
 * database client. A thread with no filing is not done; a filing older than
 * their last message is not done either — they wrote after it, so it is
 * open again.
 */
export function isThreadDone(state, lastInboundAt) {
  const doneAt = state?.doneAt ? new Date(state.doneAt) : null;
  if (!doneAt || Number.isNaN(doneAt.getTime())) return false;
  const inbound = lastInboundAt ? new Date(lastInboundAt) : null;
  if (!inbound || Number.isNaN(inbound.getTime())) return true;
  return inbound.getTime() <= doneAt.getTime();
}

export const GROUP_NEEDS_REPLY = "needsReply";
export const GROUP_WAITING = "waiting";
export const GROUP_DRAFTS = "drafts";
export const GROUP_DONE = "done";

/** In display order. The screen maps each key to a translated title. */
export const GROUP_ORDER = Object.freeze([GROUP_NEEDS_REPLY, GROUP_WAITING, GROUP_DRAFTS, GROUP_DONE]);

/**
 * Which bucket one conversation belongs in.
 *
 * @param conversation  `{ lastDirection, lastInboundAt, openDrafts, readState }`
 *   as salesConversations() emits it, with `readState` = `{ readAt, doneAt }`
 *   or null.
 */
export function groupOf(conversation = {}) {
  if (isThreadDone(conversation.readState, conversation.lastInboundAt)) return GROUP_DONE;
  if (conversation.lastDirection === "in") return GROUP_NEEDS_REPLY;
  if ((Number(conversation.openDrafts) || 0) > 0) return GROUP_DRAFTS;
  return GROUP_WAITING;
}

/**
 * The list, bucketed and ordered newest-activity-first within each bucket.
 *
 * Every bucket is present even when empty — the screen decides whether to
 * draw an empty header, and a missing key is the kind of undefined a render
 * trips over.
 *
 * @returns `{ needsReply: [], waiting: [], drafts: [], done: [] }`
 */
export function groupConversations(conversations) {
  const groups = Object.fromEntries(GROUP_ORDER.map((k) => [k, []]));
  for (const c of Array.isArray(conversations) ? conversations : []) {
    if (!c) continue;
    groups[groupOf(c)].push(c);
  }
  const at = (c) => {
    const d = c?.lastAt ? new Date(c.lastAt) : null;
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  };
  for (const key of GROUP_ORDER) groups[key].sort((a, b) => at(b) - at(a));
  return groups;
}
